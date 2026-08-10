# Build and Runtime Architecture

Panvas uses a modern frontend build stack integrated with Electron.

## Toolchain
- **Package Manager**: npm
- **Bundler / Dev Server**: Vite (`vite v6.4.2`)
- **TypeScript Compiler**: `tsc` (TypeScript 5.x)
- **Framework**: React 18

## Configuration Files

### `vite.config.ts`
The central hub for the build process.
- Uses `@vitejs/plugin-react` for React fast refresh.
- Uses `vite-plugin-electron/simple` to seamlessly integrate Electron into the Vite dev server. This allows Vite to automatically compile `electron/main.ts` and `electron/preload.ts`, and launch the Electron binary.
- Maps `@` to `./src` for absolute imports.

### `package.json` Scripts
- `"prestart": "npm run build"` - Ensures that the `dist` folder always contains the most recent codebase before starting the production application.
- `"start": "electron ."` - Starts the production Electron binary directly against the compiled `dist` folder.
- `"dev": "vite"` - Starts the Vite dev server and launches Electron via the Vite plugin. This is the **primary development script** needed for hot-module replacement (HMR).
- `"build": "tsc -b && vite build"` - Compiles TypeScript types and builds the optimized production bundles into `dist` and `dist-electron`.

## Output Directories
- `dist/`: Contains the optimized HTML/JS/CSS assets for the React renderer.
- `dist-electron/`: Contains the compiled Node.js outputs for the main process (`main.js`, `preload.js`).

## Target Environments
Because of Vite's flexible configuration, Panvas can run in two modes:
1. **Desktop Native**: Launched via Electron. Uses IPC for file system access.
2. **Browser Native**: Can theoretically be hosted on Vercel/Netlify. Bypasses IPC and falls back to IndexedDB.
