// ============================================
// Panvas — Release & Distribution Metadata
// Canonical typed release parameters matching release.md
// ============================================

export interface WindowsReleaseMetadata {
  version: string;
  releaseTag: string;
  releaseDate: string;
  installerFileName: string;
  architecture: string;
  osRequirement: string;
  installerType: string;
  signingStatus: string;
  downloadUrl: string;
  releaseNotesUrl: string;
  checksumUrl: string;
  checksumSha256: string;
  installerSize: string;
  checksumVerificationNote: string;
}

export interface WebDistributionMetadata {
  appRoute: string;
  libraryRoute: string;
  storageEngine: string;
  primaryBrowsers: string[];
  caveatBrowsers: string;
}

export interface ProjectMetadata {
  name: string;
  tagline: string;
  description: string;
  version: string;
  year: number;
  githubRepoUrl: string;
  githubReleasesUrl: string;
  githubIssuesUrl: string;
  creatorGithubUrl: string;
  creatorWebsiteUrl: string;
  creatorEmailUrl: string;
  license: string;
}

export const PANVAS_RELEASE = {
  project: {
    name: 'Panvas',
    tagline: 'Local-First Visual Research Workspace',
    description: 'A local-first visual workspace where structured notebooks, vector handwriting, PDF annotation, infinite canvas, and technical thinking live together.',
    version: '0.1.0',
    year: 2026,
    githubRepoUrl: 'https://github.com/sumitahmed/Panvas',
    githubReleasesUrl: 'https://github.com/sumitahmed/Panvas/releases',
    githubIssuesUrl: 'https://github.com/sumitahmed/Panvas/issues',
    creatorGithubUrl: 'https://github.com/sumitahmed',
    creatorWebsiteUrl: 'https://sumitahmed.me/',
    creatorEmailUrl: 'mailto:sksumitahmed007@gmail.com',
    license: 'MIT',
  },
  windows: {
    version: '0.1.0',
    releaseTag: 'v0.1.0',
    releaseDate: 'September 2026',
    installerFileName: 'Panvas-0.1.0-Setup.exe',
    architecture: 'x64 (64-bit)',
    osRequirement: 'Windows 10 (1809+) / Windows 11 (64-bit)',
    installerType: 'NSIS Setup Wizard',
    signingStatus: 'Unsigned (v0.1.0); verify SHA-256 checksum',
    downloadUrl: 'https://github.com/sumitahmed/Panvas/releases/download/v0.1.0/Panvas-0.1.0-Setup.exe',
    releaseNotesUrl: 'https://github.com/sumitahmed/Panvas/releases/tag/v0.1.0',
    checksumUrl: 'https://github.com/sumitahmed/Panvas/releases/download/v0.1.0/SHA256SUMS.txt',
    checksumSha256: '9d4cfcded4e3b76d8880ab4948901de0c56e2595dc793b5eb2433c4430158edd',
    installerSize: '261,279,635 bytes',
    checksumVerificationNote: 'Verify the installer against the official SHA-256 checksum published on the GitHub Releases page.',
  },
  web: {
    appRoute: '/app',
    libraryRoute: '/app/library',
    storageEngine: 'Origin-scoped Dexie IndexedDB (Local System of Record)',
    primaryBrowsers: ['Google Chrome', 'Microsoft Edge', 'Brave (Chromium 120+)'],
    caveatBrowsers: 'Firefox (Gecko 125+) and Safari (WebKit 17+) supported on best-effort basis',
  },
} as const;
