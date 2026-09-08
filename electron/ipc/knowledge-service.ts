import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  FindRelatedInput,
  KnowledgeHealthReport,
  KnowledgeNoteContext,
  KnowledgeNoteRef,
  KnowledgeNoteSummary,
  KnowledgeProvenance,
  KnowledgeReferenceInput,
  KnowledgeRelationship,
  KnowledgeResponse,
  KnowledgeSearchInput,
  KnowledgeSearchResult,
} from '../../src/types/knowledge';

type Frontmatter = Record<string, string | number | boolean | string[]>;

interface VaultNote {
  path: string;
  title: string;
  body: string;
  source: string;
  frontmatter: Frontmatter;
}

interface VaultIndex {
  notes: VaultNote[];
  byPath: Map<string, VaultNote>;
  byId: Map<string, VaultNote>;
}

const RELATION_FIELDS = ['related', 'derived_from', 'used_by', 'depends_on', 'implemented_by', 'supports', 'contradicts'] as const;
const CONTROLLED_TYPES = new Set(['source', 'concept', 'entity', 'project', 'claim', 'question', 'decision', 'experiment', 'insight', 'session']);
const CONTROLLED_STATUSES = new Set(['draft', 'active', 'evergreen', 'archived', 'disputed']);
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILES = 1_000;
const MAX_CONTENT_CHARS = 12_000;

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function parseScalar(value: string): string | number | boolean {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function parseMarkdown(source: string, notePath: string): VaultNote {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const frontmatter: Frontmatter = {};
  let body = source;

  if (match) {
    body = source.slice(match[0].length);
    const lines = match[1].split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const field = lines[index].match(/^([A-Za-z_][A-Za-z0-9_]*):(?:\s*(.*))?$/);
      if (!field) continue;
      const [, key, rawValue = ''] = field;
      if (rawValue !== '') {
        frontmatter[key] = parseScalar(rawValue);
        continue;
      }
      const items: string[] = [];
      while (index + 1 < lines.length && /^\s{2}-\s+/.test(lines[index + 1])) {
        index += 1;
        items.push(String(parseScalar(lines[index].replace(/^\s{2}-\s+/, ''))));
      }
      frontmatter[key] = items;
    }
  }

  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return {
    path: notePath,
    title: heading || path.posix.basename(notePath, '.md'),
    body: body.trim(),
    source,
    frontmatter,
  };
}

function excerpt(text: string, query?: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const found = query ? normalized.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1;
  const start = found < 0 ? 0 : Math.max(0, found - 120);
  const end = Math.min(normalized.length, start + 480);
  return `${start > 0 ? '…' : ''}${normalized.slice(start, end)}${end < normalized.length ? '…' : ''}`;
}

function canonicalPath(candidate: unknown): string | undefined {
  if (typeof candidate !== 'string' || !candidate || candidate.length > 1_024 || path.posix.isAbsolute(candidate) || candidate.includes('\\') || candidate.split('/').includes('..')) return undefined;
  const normalized = path.posix.normalize(candidate.replace(/^\.\//, ''));
  return normalized.endsWith('.md') ? normalized : `${normalized}.md`;
}

function wikilinkTarget(value: string): string | undefined {
  const match = value.match(/^\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]$/);
  return match?.[1]?.trim();
}

function allWikilinks(source: string): string[] {
  return [...source.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)].map((match) => match[1].trim());
}

export class KnowledgeService {
  constructor(private readonly vaultRoot = process.env.PANVAS_KNOWLEDGE_VAULT) {}

  private unavailable<T>(reason: 'not-configured' | 'not-found' | 'invalid-request' | 'unavailable', message: string): KnowledgeResponse<T> {
    return { available: false, reason, message };
  }

  private async listMarkdown(relative = '', seen = { count: 0 }): Promise<string[]> {
    const root = this.vaultRoot!;
    const directory = path.join(root, relative);
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const child = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        files.push(...await this.listMarkdown(child, seen));
      } else if (entry.isFile() && entry.name.toLocaleLowerCase().endsWith('.md')) {
        seen.count += 1;
        if (seen.count > MAX_FILES) throw new Error('Knowledge vault exceeds the local consumer file limit.');
        files.push(child);
      }
    }
    return files;
  }

  private async load(): Promise<KnowledgeResponse<VaultIndex>> {
    if (!this.vaultRoot?.trim()) {
      return this.unavailable('not-configured', 'Knowledge access is disabled. Set PANVAS_KNOWLEDGE_VAULT in the Electron main-process environment.');
    }
    try {
      const root = path.resolve(this.vaultRoot);
      const stat = await fs.stat(root);
      if (!stat.isDirectory()) return this.unavailable('unavailable', 'The configured knowledge vault is not a directory.');
      const files = await this.listMarkdown();
      if (files.length > MAX_FILES) return this.unavailable('unavailable', 'Knowledge vault exceeds the local consumer file limit.');
      const notes = await Promise.all(files.map(async (relative) => parseMarkdown(await fs.readFile(path.join(root, relative), 'utf8'), relative.replace(/\\/g, '/'))));
      const byPath = new Map(notes.map((note) => [note.path, note]));
      const byId = new Map<string, VaultNote>();
      for (const note of notes) {
        const id = asString(note.frontmatter.id);
        if (id && !byId.has(id)) byId.set(id, note);
      }
      return { available: true, data: { notes, byPath, byId } };
    } catch {
      return this.unavailable('unavailable', 'The local knowledge vault could not be read.');
    }
  }

  private resolveLink(index: VaultIndex, candidate: string): VaultNote | undefined {
    if (candidate.toLocaleLowerCase().endsWith('.base')) return undefined;
    const direct = canonicalPath(candidate);
    if (direct && index.byPath.has(direct)) return index.byPath.get(direct);
    const lower = candidate.toLocaleLowerCase();
    const matches = index.notes.filter((note) => note.title.toLocaleLowerCase() === lower || asStrings(note.frontmatter.aliases).some((alias) => alias.toLocaleLowerCase() === lower));
    return matches.length === 1 ? matches[0] : undefined;
  }

  private resolveReference(index: VaultIndex, input: KnowledgeReferenceInput): VaultNote | undefined {
    if (input.id) return index.byId.get(input.id);
    if (input.path) return this.resolveLink(index, input.path);
    return undefined;
  }

  private validReference(input: unknown): input is KnowledgeReferenceInput {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
    const value = input as KnowledgeReferenceInput;
    const idValid = value.id === undefined || (typeof value.id === 'string' && value.id.length <= 128);
    const pathValid = value.path === undefined || Boolean(canonicalPath(value.path));
    return idValid && pathValid && (typeof value.id === 'string' || typeof value.path === 'string');
  }

  private noteRef(note: VaultNote): KnowledgeNoteRef {
    return {
      path: note.path,
      ...(asString(note.frontmatter.id) ? { id: asString(note.frontmatter.id) } : {}),
      title: note.title,
      ...(asString(note.frontmatter.type) ? { type: asString(note.frontmatter.type) } : {}),
      ...(asString(note.frontmatter.status) ? { status: asString(note.frontmatter.status) } : {}),
    };
  }

  private provenance(index: VaultIndex, note: VaultNote): KnowledgeProvenance {
    return {
      ...(asString(note.frontmatter.provenance_status) ? { status: asString(note.frontmatter.provenance_status) } : {}),
      ...(asString(note.frontmatter.confidence) ? { confidence: asString(note.frontmatter.confidence) } : {}),
      ...(asString(note.frontmatter.captured) ? { captured: asString(note.frontmatter.captured) } : {}),
      ...(asString(note.frontmatter.reviewed) ? { reviewed: asString(note.frontmatter.reviewed) } : {}),
      sources: asStrings(note.frontmatter.derived_from)
        .map(wikilinkTarget)
        .filter((target): target is string => Boolean(target))
        .map((target) => this.resolveLink(index, target))
        .filter((source): source is VaultNote => Boolean(source))
        .map((source) => this.noteRef(source)),
    };
  }

  private uncertainty(note: VaultNote): string[] {
    const uncertainty: string[] = [];
    if (note.frontmatter.status === 'disputed') uncertainty.push('This record is disputed; competing evidence is intentionally retained.');
    if (note.frontmatter.status === 'draft') uncertainty.push('This record is planned or deferred and is not a completed implementation fact.');
    if (asStrings(note.frontmatter.tags).includes('documentation-derived')) uncertainty.push('This record is documentation-derived and has not been promoted to a source-code-verified claim.');
    return uncertainty;
  }

  private summary(index: VaultIndex, note: VaultNote, query?: string): KnowledgeNoteSummary {
    return {
      ref: this.noteRef(note),
      excerpt: excerpt(note.body, query),
      tags: asStrings(note.frontmatter.tags),
      provenance: this.provenance(index, note),
      uncertainty: this.uncertainty(note),
    };
  }

  private outgoing(index: VaultIndex, note: VaultNote): KnowledgeRelationship[] {
    const seen = new Set<string>();
    const edges: KnowledgeRelationship[] = [];
    const add = (targetText: string, relation: string, typed: boolean) => {
      const target = this.resolveLink(index, targetText);
      if (!target) return;
      const key = `${target.path}|${relation}|${typed}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({ from: this.noteRef(note), to: this.noteRef(target), relation, direction: 'outgoing', typed });
    };
    for (const relation of RELATION_FIELDS) {
      for (const value of asStrings(note.frontmatter[relation])) {
        const target = wikilinkTarget(value);
        if (target) add(target, relation, true);
      }
    }
    for (const target of allWikilinks(note.source)) add(target, 'wikilink', false);
    return edges;
  }

  private relationships(index: VaultIndex, note: VaultNote): KnowledgeRelationship[] {
    const outgoing = this.outgoing(index, note);
    const incoming: KnowledgeRelationship[] = [];
    for (const candidate of index.notes) {
      for (const edge of this.outgoing(index, candidate)) {
        if (edge.to.path === note.path) incoming.push({ ...edge, direction: 'incoming' });
      }
    }
    return [...outgoing, ...incoming];
  }

  async search(input: KnowledgeSearchInput): Promise<KnowledgeResponse<KnowledgeSearchResult>> {
    if (!input || typeof input !== 'object' || typeof input.query !== 'string' || !input.query.trim() || input.query.length > 200 ||
      (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 25)) ||
      ![input.types, input.statuses, input.tags].every((values) => values === undefined || (Array.isArray(values) && values.length <= 50 && values.every((value) => typeof value === 'string' && value.length <= 80)))) {
      return this.unavailable('invalid-request', 'Provide a non-empty knowledge query of at most 200 characters.');
    }
    const loaded = await this.load();
    if (!loaded.available) return loaded;
    const query = input.query.trim();
    const types = new Set((input.types ?? []).map((value) => value.toLocaleLowerCase()));
    const statuses = new Set((input.statuses ?? []).map((value) => value.toLocaleLowerCase()));
    const tags = new Set((input.tags ?? []).map((value) => value.toLocaleLowerCase()));
    const score = (note: VaultNote): number => {
      const title = note.title.toLocaleLowerCase();
      const notePath = note.path.toLocaleLowerCase();
      const body = note.body.toLocaleLowerCase();
      const needle = query.toLocaleLowerCase();
      if (!title.includes(needle) && !notePath.includes(needle) && !body.includes(needle) && !asStrings(note.frontmatter.tags).some((tag) => tag.toLocaleLowerCase().includes(needle))) return -1;
      return (title === needle ? 1_000 : title.includes(needle) ? 700 : 0) + (notePath.includes(needle) ? 300 : 0) + (asStrings(note.frontmatter.tags).some((tag) => tag.toLocaleLowerCase().includes(needle)) ? 150 : 0) + (body.includes(needle) ? 10 : 0);
    };
    const limit = Math.max(1, Math.min(input.limit ?? 10, 25));
    const results = loaded.data.notes
      .filter((note) => !types.size || types.has(asString(note.frontmatter.type)?.toLocaleLowerCase() ?? ''))
      .filter((note) => !statuses.size || statuses.has(asString(note.frontmatter.status)?.toLocaleLowerCase() ?? ''))
      .filter((note) => !tags.size || asStrings(note.frontmatter.tags).some((tag) => tags.has(tag.toLocaleLowerCase())))
      .map((note) => ({ note, score: score(note) }))
      .filter((result) => result.score >= 0)
      .sort((left, right) => right.score - left.score || left.note.path.localeCompare(right.note.path))
      .slice(0, limit)
      .map(({ note }) => this.summary(loaded.data, note, query));
    return { available: true, data: { query, results, reason: 'deterministic-local-text-and-metadata-match' } };
  }

  async getNoteContext(input: KnowledgeReferenceInput): Promise<KnowledgeResponse<KnowledgeNoteContext>> {
    if (!this.validReference(input)) return this.unavailable('invalid-request', 'Provide a canonical note path or stable ID.');
    const loaded = await this.load();
    if (!loaded.available) return loaded;
    const note = this.resolveReference(loaded.data, input ?? {});
    if (!note) return this.unavailable('not-found', 'No canonical knowledge note matched the supplied path or stable ID.');
    return { available: true, data: { ...this.summary(loaded.data, note), content: note.body.slice(0, MAX_CONTENT_CHARS), relationships: this.relationships(loaded.data, note) } };
  }

  async getNoteRef(input: KnowledgeReferenceInput): Promise<KnowledgeResponse<KnowledgeNoteRef>> {
    if (!this.validReference(input)) return this.unavailable('invalid-request', 'Provide a canonical note path or stable ID.');
    const loaded = await this.load();
    if (!loaded.available) return loaded;
    const note = this.resolveReference(loaded.data, input ?? {});
    return note ? { available: true, data: this.noteRef(note) } : this.unavailable('not-found', 'No canonical knowledge note matched the supplied path or stable ID.');
  }

  async findRelated(input: FindRelatedInput): Promise<KnowledgeResponse<KnowledgeRelationship[]>> {
    if (!this.validReference(input) || (input.depth !== undefined && input.depth !== 1 && input.depth !== 2) ||
      (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50))) {
      return this.unavailable('invalid-request', 'Provide a canonical note path or stable ID with valid traversal options.');
    }
    const loaded = await this.load();
    if (!loaded.available) return loaded;
    const note = this.resolveReference(loaded.data, input ?? {});
    if (!note) return this.unavailable('not-found', 'No canonical knowledge note matched the supplied path or stable ID.');
    const depth = input.depth === 2 ? 2 : 1;
    const limit = Math.max(1, Math.min(input.limit ?? 30, 50));
    const visited = new Set([note.path]);
    let frontier = [note];
    const output: KnowledgeRelationship[] = [];
    for (let step = 0; step < depth && output.length < limit; step += 1) {
      const next: VaultNote[] = [];
      for (const current of frontier) {
        for (const edge of this.relationships(loaded.data, current)) {
          if (output.length >= limit) break;
          output.push(edge);
          const neighbor = edge.direction === 'outgoing' ? edge.to : edge.from;
          if (!visited.has(neighbor.path)) {
            const candidate = loaded.data.byPath.get(neighbor.path);
            if (candidate) next.push(candidate);
            visited.add(neighbor.path);
          }
        }
      }
      frontier = next;
    }
    return { available: true, data: output };
  }

  async health(): Promise<KnowledgeResponse<KnowledgeHealthReport>> {
    const loaded = await this.load();
    if (!loaded.available) return loaded;
    const managed = loaded.data.notes.filter((note) => note.frontmatter.schema_version === 1);
    const report: KnowledgeHealthReport = {
      checkedAt: new Date().toISOString(), markdownFiles: loaded.data.notes.length, managedRecords: managed.length,
      schemaViolations: [], invalidIds: [], duplicateIds: [], brokenLinks: [], orphanRecords: [], invalidRelations: [], missingProvenance: [], staleSources: [], disputedRecords: [], plannedRecords: [],
    };
    const ids = new Map<string, string[]>();
    const today = Date.now();
    for (const note of managed) {
      const f = note.frontmatter;
      if (!CONTROLLED_TYPES.has(asString(f.type) ?? '') || !CONTROLLED_STATUSES.has(asString(f.status) ?? '') || !DATE.test(String(f.created)) || !DATE.test(String(f.modified))) report.schemaViolations.push(note.path);
      const id = asString(f.id);
      if (id) {
        if (!UUID_V4.test(id)) report.invalidIds.push(note.path);
        const paths = ids.get(id) ?? []; paths.push(note.path); ids.set(id, paths);
      }
      if (['source', 'claim', 'decision', 'insight'].includes(asString(f.type) ?? '') && (!asString(f.provenance_status) || !asString(f.confidence))) report.missingProvenance.push(note.path);
      if (f.status === 'disputed') report.disputedRecords.push(note.path);
      if (f.status === 'draft') report.plannedRecords.push(note.path);
      if (f.type === 'source') {
        const reviewed = asString(f.reviewed) ?? asString(f.captured);
        if (!reviewed || !DATE.test(reviewed) || today - Date.parse(`${reviewed}T00:00:00Z`) > 90 * 86_400_000) report.staleSources.push(note.path);
      }
      for (const relation of RELATION_FIELDS) {
        for (const value of asStrings(f[relation])) {
          const targetText = wikilinkTarget(value);
          const target = targetText && this.resolveLink(loaded.data, targetText);
          if (!target) {
            report.invalidRelations.push(`${note.path}: ${relation}`);
            continue;
          }
          const targetType = asString(target.frontmatter.type);
          const valid =
            relation === 'related' ||
            relation === 'depends_on' ||
            (relation === 'derived_from' && (['source', 'claim', 'concept'].includes(targetType ?? '') || target.path.startsWith('architecture/'))) ||
            (relation === 'used_by' && ['project', 'decision', 'session'].includes(targetType ?? '')) ||
            (relation === 'implemented_by' && targetType === 'project') ||
            (relation === 'supports' && targetType === 'claim') ||
            (relation === 'contradicts' && ['claim', 'source', 'concept'].includes(targetType ?? ''));
          if (!valid) report.invalidRelations.push(`${note.path}: ${relation}`);
        }
      }
      for (const target of allWikilinks(note.source)) {
        if (!target.toLocaleLowerCase().endsWith('.base') && !this.resolveLink(loaded.data, target)) report.brokenLinks.push(`${note.path}: ${target}`);
      }
    }
    for (const [id, paths] of ids) if (paths.length > 1) report.duplicateIds.push(id);
    const managedPaths = new Set(managed.map((note) => note.path));
    for (const note of managed) {
      const related = this.relationships(loaded.data, note).some((edge) =>
        edge.direction === 'outgoing' ? managedPaths.has(edge.to.path) : managedPaths.has(edge.from.path),
      );
      if (!related) report.orphanRecords.push(note.path);
    }
    return { available: true, data: report };
  }
}
