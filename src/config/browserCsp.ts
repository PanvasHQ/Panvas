const SCRIPT_SOURCE = "script-src 'self' https://accounts.google.com/gsi/client";

/**
 * Excalidraw's development dependency graph uses dynamic code generation.
 * Keep that exception confined to Vite's local development transform; the
 * checked-in and production HTML remain on the strict policy.
 */
export function applyDevelopmentBrowserCsp(html: string, development: boolean): string {
  if (!development) return html;
  if (!html.includes(SCRIPT_SOURCE)) throw new Error('Panvas CSP script-src directive is missing.');
  return html.replace(SCRIPT_SOURCE, `${SCRIPT_SOURCE} 'unsafe-eval'`);
}
