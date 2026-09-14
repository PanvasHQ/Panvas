/** Browser-safe URL for the Panvas mark.
 *
 * Electron loads the renderer from a `file:` URL, where a root-relative path
 * points at the drive root. Browser routes (for example `/app/library`) need
 * a root-relative URL so the asset is not resolved under the current route.
 */
export const PANVAS_LOGO_SRC =
  typeof window !== 'undefined' && window.location.protocol === 'file:'
    ? './panvas_logo.png'
    : '/panvas_logo.png';
