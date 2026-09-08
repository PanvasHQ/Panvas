import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function isTrustedRendererUrl(url: string, devServerUrl: string | undefined, rendererDirectory: string): boolean {
  try {
    if (devServerUrl) return new URL(url).origin === new URL(devServerUrl).origin;
    const expected = pathToFileURL(path.join(rendererDirectory, 'index.html')).href;
    return url.split('#')[0] === expected;
  } catch {
    return false;
  }
}

export function isAudioOnlyMediaRequest(permission: string, mediaTypes: readonly string[] | undefined, isMainFrame: boolean): boolean {
  return permission === 'media'
    && isMainFrame
    && Array.isArray(mediaTypes)
    && mediaTypes.length > 0
    && mediaTypes.every(type => type === 'audio');
}

export function isAudioOnlyMediaCheck(permission: string, mediaType: string | undefined, isMainFrame: boolean): boolean {
  return permission === 'media' && mediaType === 'audio' && isMainFrame;
}
