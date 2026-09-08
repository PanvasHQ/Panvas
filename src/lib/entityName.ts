/**
 * Panvas entity-name validation (workspaces, folders, notebooks, sections,
 * pages, canvases). Names become filesystem directories/files on Windows, so
 * reserved device names must be rejected even with extensions — Windows still
 * treats `CON.txt` as the reserved device `CON`.
 */

// COM0/LPT0 are not classically reserved but some Windows APIs treat them
// inconsistently; the audited contract lists COM1-9/LPT1-9, which is what we
// enforce alongside CON/PRN/AUX/NUL.
const WINDOWS_RESERVED_BASE_NAMES = new Set([
  'con', 'prn', 'aux', 'nul',
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
]);

export class InvalidEntityNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEntityNameError';
  }
}

/**
 * Validates a user-entered entity name. Returns the trimmed name.
 * Throws InvalidEntityNameError with a clean Panvas message on rejection.
 * Valid names pass through untouched (no silent rewriting).
 */
export function validateEntityName(rawName: string, kind = 'item'): string {
  const name = rawName.trim();
  if (!name) throw new InvalidEntityNameError(`${kind} name is required.`);
  if (name.length > 128) throw new InvalidEntityNameError(`${kind} name is too long (maximum 128 characters).`);
  if (/^[. ]+$/.test(name) || /[<>:"/\\|?*\u0000-\u001F]/.test(name)) {
    throw new InvalidEntityNameError(`${kind} name contains characters that are not allowed on Windows.`);
  }
  // Windows reserves the BASE name even when an extension is present
  // ("CON.txt" → reserved), and case-insensitively ("con", "lpt9.notes").
  const baseName = name.split('.')[0]?.trim().toLowerCase() ?? '';
  if (WINDOWS_RESERVED_BASE_NAMES.has(baseName)) {
    throw new InvalidEntityNameError(`"${name}" is a reserved Windows device name and cannot be used as a ${kind} name.`);
  }
  return name;
}
