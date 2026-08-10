# 15 — Development & Debugging Guide (15_DEVELOPMENT_AND_DEBUGGING_GUIDE.md)

## 1. Prerequisites & Environment Setup

* **Node.js**: Recommended Version `18.x` or `20.x` LTS.
* **Package Manager**: `npm` (v9+).
* **Operating System**: Windows 10/11 (Primary development environment), macOS, or Linux.

---

## 2. CLI Commands & Scripts

### 2.1 Start Application in Electron Desktop Mode
```bash
npm start
```
*Executes `npm run build` (compiles TypeScript & bundles Vite assets) and launches native Electron app (`electron .`).*

### 2.2 Run Vite Dev Server (Web Mode)
```bash
npm run dev
```
*Launches Vite dev server at `http://localhost:3000` with hot-module replacement (HMR).*

### 2.3 Run Mandatory TypeScript Validation
```bash
npx tsc -b
```
*Runs strict TypeScript project build check across all `.ts` and `.tsx` files. Must pass zero errors before committing any task.*

### 2.4 Run Production Build
```bash
npm run build
```
*Builds production bundles into `dist/` (renderer) and `dist-electron/` (main/preload).*

---

## 3. Critical Troubleshooting: Electron Zombie Process Locks

### 3.1 Symptom
When restarting `npm start` after a crash or hot-reload, PDF imports fail with:
`Failed to import PDF: UnknownError: Internal error`
Terminal logs:
`ERROR:net\disk_cache\cache_util_win.cc: Access is denied. (0x5)`
`ERROR:storage\browser\quota\quota_database.cc: Could not open the quota database, resetting.`

### 3.2 Cause
An orphaned background `electron.exe` process is still running in the Windows process table, holding an exclusive OS lock on the IndexedDB database files in `%USERPROFILE%/AppData/Roaming/panvas/`.

### 3.3 Resolution Command
Run this in PowerShell or Command Prompt before starting `npm start`:
```powershell
taskkill /F /IM electron.exe /T
```

---

## 4. Debugging & Logs

### 4.1 Renderer Process Logs
In Electron desktop mode, open Chromium Developer Tools:
* Press `CTRL + SHIFT + I` (or `F12`) inside the application window.
* Switch to the **Console** tab to inspect React state, Zustand store logs, and PDF.js execution errors.

### 4.2 Main Process & IPC Logs
Electron main process logs (`console.log`, `console.error` in `electron/main.ts` or `electron/ipc/domain-handlers.ts`) output directly to the **terminal window** where `npm start` was executed.

### 4.3 Inspecting Disk Storage
To inspect local filesystem persistence data on Windows:
```
%USERPROFILE%\Documents\Panvas\<WorkspaceName>\.panvas\workspace.json
```
Open `workspace.json` in VS Code to inspect serialized folder, notebook, section, and page arrays.
