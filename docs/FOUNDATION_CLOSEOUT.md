# Panvas Foundation Closeout

## Knowledge infrastructure

Status: complete.

The canonical knowledge source is the Obsidian vault at `Panvas Knowledge Infrastructure/`: portable Markdown, YAML frontmatter, stable UUID v4 identifiers, typed relationships, wikilinks, and provenance links. The vault contains 46 Markdown files, including 43 managed records, plus the architectural source documents, system conventions, project/feature records, decisions, claims, entities, and sources.

Knowledge-specific application files:

- `electron/ipc/knowledge-service.ts` — main-process, local read-only vault reader and deterministic retrieval.
- `electron/ipc/knowledge-handlers.ts` — five validated read-only IPC handlers.
- `electron/main.ts` — registers the handlers.
- `electron/preload.ts` — exposes only the five methods.
- `src/types/knowledge.ts` and `src/types/electron.d.ts` — public renderer contract.
- `src/components/knowledge/KnowledgeWorkspace.tsx`, `src/app/App.tsx`, and `src/components/layout/Sidebar.tsx` — the `#/app/knowledge` UI route.

The agent access model remains Obsidian/MCP-based. Writer clients use their approved-writer profile; normal clients remain read-only. Panvas is not an MCP client and has no Obsidian credential. It receives only `PANVAS_KNOWLEDGE_VAULT` in the Electron main process and exposes these read-only operations: `search_knowledge`, `get_note_context`, `find_related`, `knowledge_health`, and `get_note_ref`.

Stable IDs live in `id` frontmatter. Source-derived records use `derived_from`, provenance status, confidence, capture/review dates, and explicit `draft`/`disputed` statuses. The renderer displays canonical references, content, related notes, provenance, status, uncertainty, and health; it cannot write to the vault.

Final live validation (packaged Electron): all five operations returned canonical vault data; 43 managed records and 46 Markdown files were checked; broken links and orphan records were both zero. The renderer exposed exactly the five read-only knowledge methods and no Node runtime, filesystem bridge, MCP bridge, or knowledge write operation.

Deployment hygiene item: the current vault is OneDrive-backed and its Obsidian Local REST API plugin stores its local API key in ignored `.obsidian` plugin configuration. It is not in Markdown notes, Panvas source, or release artifacts. Keep that configuration out of source control, protect it with local filesystem permissions, and rotate it if the vault is ever shared or copied outside the approved local environment.

## Foundation baseline

### Final packaging note

A fresh unpacked x64 package was generated and inspected after the source-map exclusion was added. Its ASAR contained no source maps, environment files, MCP configuration, or vault content. The unpacked executable is not Authenticode-signed. The final release remains gated on a clean-profile interactive installation/launch check, signing, and a checksum calculated from the final signed installer.

Electron now runs with context isolation, sandboxing, disabled Node integration, disabled webviews, denied permission requests, production DevTools disabled, validated navigation, HTTPS-only external links, validated IPC sender origins, bounded IPC payloads, and path-safe identifiers. The Windows packaging configuration is ASAR-based, includes only built renderer/main artifacts and production dependencies, and excludes source maps.

The remaining release prerequisites are operational rather than code changes: a branded Windows `.ico`, a stable legal publisher identity, an Authenticode code-signing certificate with timestamping, a final successful installer build, and release-time publication of that installer’s generated SHA-256 checksum. Unsigned binaries can still receive SmartScreen/Defender reputation warnings; signing and clean release provenance reduce that risk but do not eliminate it.
