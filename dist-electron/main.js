var O = Object.defineProperty;
var N = (d, s, n) => s in d ? O(d, s, { enumerable: !0, configurable: !0, writable: !0, value: n }) : d[s] = n;
var j = (d, s, n) => N(d, typeof s != "symbol" ? s + "" : s, n);
import { app as g, ipcMain as l, BrowserWindow as W, dialog as P } from "electron";
import a from "path";
import { fileURLToPath as F } from "url";
import h, { promises as c } from "fs";
import { webcrypto as J } from "node:crypto";
let E = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
const R = 128;
let v, y;
function _(d) {
  if (d < 0 || d > 1024) throw new RangeError("Wrong ID size");
  !v || v.length < d ? (v = Buffer.allocUnsafe(d * R), J.getRandomValues(v), y = 0) : y + d > v.length && (J.getRandomValues(v), y = 0), y += d;
}
function q(d = 21) {
  _(d |= 0);
  let s = "";
  for (let n = y - d; n < y; n++)
    s += E[v[n] & 63];
  return s;
}
function f(d) {
  const s = q(12);
  return d ? `${d}-${s}` : s;
}
class T {
  constructor() {
    j(this, "queue", []);
    j(this, "isWriting", !1);
  }
  async enqueue(s, n) {
    return new Promise((e, t) => {
      this.queue.push({ filePath: s, data: n, resolve: e, reject: t }), this.processNext();
    });
  }
  async processNext() {
    if (this.isWriting || this.queue.length === 0) return;
    this.isWriting = !0;
    const s = /* @__PURE__ */ new Map(), n = [];
    for (; this.queue.length > 0; ) {
      const e = this.queue.shift();
      s.set(e.filePath, e), n.push({ resolve: e.resolve, reject: e.reject });
    }
    for (const [e, t] of s.entries())
      try {
        await this.atomicWrite(e, t.data);
      } catch (o) {
        console.error("Failed atomic write:", o);
      }
    for (const e of n)
      e.resolve();
    this.isWriting = !1, this.queue.length > 0 && this.processNext();
  }
  async atomicWrite(s, n) {
    const e = s + ".tmp";
    await c.writeFile(e, n, "utf8");
    let t = 5, o = 100;
    for (; t > 0; )
      try {
        await c.rename(e, s);
        return;
      } catch (i) {
        if (i.code === "EPERM" || i.code === "EBUSY" || i.code === "EACCES") {
          if (t--, t === 0) throw i;
          await new Promise((u) => setTimeout(u, o)), o *= 2;
        } else
          throw i;
      }
  }
}
const p = new T();
class C {
  // workspaceId -> workspaceDir
  constructor() {
    j(this, "baseDir");
    j(this, "workspaceRegistry", /* @__PURE__ */ new Map());
    this.baseDir = a.join(g.getPath("documents"), "Panvas");
  }
  getWorkspaceDirById(s) {
    const n = this.workspaceRegistry.get(s);
    if (!n) throw new Error(`Workspace ${s} not found in registry`);
    return n;
  }
  registerWorkspace(s, n) {
    this.workspaceRegistry.set(s, n);
  }
  getWorkspaceDirByName(s) {
    return a.join(this.baseDir, s);
  }
  getPanvasDir(s) {
    return a.join(s, ".panvas");
  }
  getWorkspaceJsonPath(s) {
    return a.join(this.getPanvasDir(s), "workspace.json");
  }
  async readWorkspaceJson(s) {
    const n = await c.readFile(this.getWorkspaceJsonPath(s), "utf8"), e = JSON.parse(n);
    return e.folders = e.folders || [], e.canvasFiles = e.canvasFiles || [], e.notebooks = e.notebooks || [], e.notebookSections = e.notebookSections || [], e.notebookPages = e.notebookPages || [], e;
  }
  async writeWorkspaceJson(s, n) {
    const e = this.getWorkspaceJsonPath(s);
    await p.enqueue(e, JSON.stringify(n, null, 2));
  }
  async ensureBaseDir() {
    await c.mkdir(this.baseDir, { recursive: !0 }).catch(() => {
    });
  }
}
const r = new C();
function x() {
  l.handle("workspace:create", async (d, s) => {
    await r.ensureBaseDir();
    const n = f("ws"), e = r.getWorkspaceDirByName(s), t = a.join(e, ".panvas");
    await c.mkdir(t, { recursive: !0 });
    const o = Date.now(), i = {
      id: n,
      name: s,
      createdAt: o,
      updatedAt: o,
      isPinned: !1,
      syncStatus: "local",
      userId: null,
      deletedAt: null,
      isSystem: !1,
      version: 1,
      folders: [],
      canvasFiles: [],
      notebooks: [],
      notebookSections: [],
      notebookPages: []
    };
    return await c.writeFile(a.join(t, "system.json"), JSON.stringify({ version: 1, migration_complete: !0 }, null, 2)), await c.writeFile(a.join(t, "workspace.json"), JSON.stringify(i, null, 2)), await c.writeFile(a.join(t, "settings.json"), JSON.stringify({ version: 1 }, null, 2)), await c.mkdir(a.join(t, "journal"), { recursive: !0 }), await c.mkdir(a.join(t, "recovery"), { recursive: !0 }), await c.mkdir(a.join(t, "temp"), { recursive: !0 }), await c.mkdir(a.join(t, "Plugins"), { recursive: !0 }), await c.mkdir(a.join(e, "Assets", "images"), { recursive: !0 }), await c.mkdir(a.join(e, "Assets", "pdfs"), { recursive: !0 }), await c.mkdir(a.join(e, "Assets", "videos"), { recursive: !0 }), await c.mkdir(a.join(e, "Assets", "audio"), { recursive: !0 }), await c.mkdir(a.join(e, "Assets", "attachments"), { recursive: !0 }), await c.mkdir(a.join(e, "Notebooks"), { recursive: !0 }), await c.mkdir(a.join(e, "Canvas"), { recursive: !0 }), await c.mkdir(a.join(e, "PDF"), { recursive: !0 }), r.registerWorkspace(n, e), i;
  }), l.handle("workspace:openDialog", async (d) => {
    const s = W.fromWebContents(d.sender), n = s ? await P.showOpenDialog(s, { properties: ["openDirectory", "createDirectory"] }) : await P.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    if (n.canceled || n.filePaths.length === 0)
      return null;
    const e = n.filePaths[0], t = a.join(e, ".panvas");
    if (h.existsSync(t))
      try {
        const o = await r.readWorkspaceJson(e);
        return r.registerWorkspace(o.id, e), o;
      } catch {
        throw new Error("Selected folder is not a valid Panvas workspace or is corrupted.");
      }
    else {
      const o = a.basename(e), i = f("ws");
      await c.mkdir(t, { recursive: !0 });
      const u = Date.now(), w = {
        id: i,
        name: o,
        createdAt: u,
        updatedAt: u,
        isPinned: !1,
        syncStatus: "local",
        userId: null,
        deletedAt: null,
        isSystem: !1,
        version: 1,
        folders: [],
        canvasFiles: [],
        notebooks: [],
        notebookSections: [],
        notebookPages: []
      };
      return await c.writeFile(a.join(t, "system.json"), JSON.stringify({ version: 1, migration_complete: !0 }, null, 2)), await c.writeFile(a.join(t, "workspace.json"), JSON.stringify(w, null, 2)), await c.writeFile(a.join(t, "settings.json"), JSON.stringify({ version: 1 }, null, 2)), await c.mkdir(a.join(t, "journal"), { recursive: !0 }), await c.mkdir(a.join(t, "recovery"), { recursive: !0 }), await c.mkdir(a.join(t, "temp"), { recursive: !0 }), await c.mkdir(a.join(t, "Plugins"), { recursive: !0 }), await c.mkdir(a.join(e, "Assets", "images"), { recursive: !0 }), await c.mkdir(a.join(e, "Assets", "pdfs"), { recursive: !0 }), await c.mkdir(a.join(e, "Assets", "videos"), { recursive: !0 }), await c.mkdir(a.join(e, "Assets", "audio"), { recursive: !0 }), await c.mkdir(a.join(e, "Assets", "attachments"), { recursive: !0 }), await c.mkdir(a.join(e, "Notebooks"), { recursive: !0 }), await c.mkdir(a.join(e, "Canvas"), { recursive: !0 }), await c.mkdir(a.join(e, "PDF"), { recursive: !0 }), r.registerWorkspace(i, e), w;
    }
  }), l.handle("workspace:getAll", async (d) => {
    await r.ensureBaseDir();
    const s = r.getWorkspaceDirByName(""), n = [], e = await c.readdir(s, { withFileTypes: !0 }).catch(() => []);
    for (const t of e)
      if (t.isDirectory()) {
        const o = a.join(s, t.name);
        try {
          const i = await r.readWorkspaceJson(o);
          r.registerWorkspace(i.id, o), n.push(i);
        } catch {
        }
      }
    return n;
  }), l.handle("workspace:update", async (d, s, n) => {
    const e = r.getWorkspaceDirById(s), t = await r.readWorkspaceJson(e);
    return Object.assign(t, n, { updatedAt: Date.now() }), await r.writeWorkspaceJson(e, t), t;
  }), l.handle("workspace:reorder", async (d, s, n, e) => {
    const t = r.getWorkspaceDirById(s), o = await r.readWorkspaceJson(t);
    let i;
    if (n === "folder") i = o.folders;
    else if (n === "notebook") i = o.notebooks;
    else if (n === "canvas") i = o.canvasFiles;
    else if (n === "section") i = o.notebookSections;
    else if (n === "page") i = o.notebookPages;
    else return !1;
    const u = new Map(e.map((w, k) => [w, k]));
    return i.sort((w, k) => {
      const D = u.has(w.id) ? u.get(w.id) : 999999, B = u.has(k.id) ? u.get(k.id) : 999999;
      return D - B;
    }), i.forEach((w, k) => {
      w.order = k;
    }), await r.writeWorkspaceJson(t, o), !0;
  }), l.handle("folder:create", async (d, s, n, e) => {
    const t = r.getWorkspaceDirById(s), o = await r.readWorkspaceJson(t), i = {
      id: f("f"),
      workspaceId: s,
      parentId: e,
      name: n,
      order: o.folders.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
      isExpanded: !1
    };
    return o.folders.push(i), await r.writeWorkspaceJson(t, o), i;
  }), l.handle("folder:getAll", async (d, s) => {
    const n = r.getWorkspaceDirById(s);
    return (await r.readWorkspaceJson(n)).folders || [];
  }), l.handle("folder:update", async (d, s, n, e) => {
    const t = r.getWorkspaceDirById(s), o = await r.readWorkspaceJson(t), i = o.folders.find((u) => u.id === n);
    return i && (Object.assign(i, e, { updatedAt: Date.now() }), await r.writeWorkspaceJson(t, o)), i;
  }), l.handle("folder:delete", async (d, s, n) => {
    const e = r.getWorkspaceDirById(s), t = await r.readWorkspaceJson(e);
    return t.folders = t.folders.filter((o) => o.id !== n), await r.writeWorkspaceJson(e, t), !0;
  }), l.handle("canvasFile:create", async (d, s, n, e) => {
    const t = r.getWorkspaceDirById(s), o = await r.readWorkspaceJson(t), i = {
      id: f("canvas"),
      workspaceId: s,
      folderId: e,
      name: n,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastOpenedAt: Date.now(),
      order: o.canvasFiles.length,
      isPinned: !1,
      deletedAt: null
    };
    o.canvasFiles.push(i), await r.writeWorkspaceJson(t, o);
    const u = { canvasFileId: i.id, elements: [], appState: {}, files: {}, version: 1 }, w = a.join(t, "Canvas", `${i.id}.json`);
    return await p.enqueue(w, JSON.stringify(u, null, 2)), i;
  }), l.handle("canvasFile:getAll", async (d, s) => {
    const n = r.getWorkspaceDirById(s);
    return (await r.readWorkspaceJson(n)).canvasFiles || [];
  }), l.handle("canvasFile:update", async (d, s, n, e) => {
    const t = r.getWorkspaceDirById(s), o = await r.readWorkspaceJson(t), i = o.canvasFiles.find((u) => u.id === n);
    return i && (Object.assign(i, e, { updatedAt: Date.now() }), await r.writeWorkspaceJson(t, o)), i;
  }), l.handle("canvasFile:delete", async (d, s, n) => {
    const e = r.getWorkspaceDirById(s), t = await r.readWorkspaceJson(e);
    return t.canvasFiles = t.canvasFiles.filter((o) => o.id !== n), await r.writeWorkspaceJson(e, t), !0;
  }), l.handle("canvas:save", async (d, s, n, e) => {
    const t = r.getWorkspaceDirById(s), o = a.join(t, "Canvas", `${n}.json`);
    await p.enqueue(o, JSON.stringify(e, null, 2));
  }), l.handle("canvas:load", async (d, s, n) => {
    const e = r.getWorkspaceDirById(s), t = a.join(e, "Canvas", `${n}.json`);
    if (h.existsSync(t)) {
      const o = await c.readFile(t, "utf8");
      return JSON.parse(o);
    }
    return null;
  }), l.handle("notebook:create", async (d, s, n, e) => {
    const t = r.getWorkspaceDirById(s), o = {
      id: f("nb"),
      workspaceId: s,
      folderId: e,
      name: n,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: 0,
      deletedAt: null
    }, i = a.join(t, "Notebooks", o.id);
    await c.mkdir(a.join(i, "pages"), { recursive: !0 }), await p.enqueue(a.join(i, "notebook.json"), JSON.stringify(o, null, 2));
    const u = await r.readWorkspaceJson(t);
    return u.notebooks.push(o), await r.writeWorkspaceJson(t, u), o;
  }), l.handle("notebook:getAll", async (d, s) => {
    const n = r.getWorkspaceDirById(s);
    return (await r.readWorkspaceJson(n)).notebooks || [];
  }), l.handle("notebook:update", async (d, s, n, e) => {
    const t = r.getWorkspaceDirById(s), o = await r.readWorkspaceJson(t), i = o.notebooks.find((u) => u.id === n);
    return i && (Object.assign(i, e, { updatedAt: Date.now() }), await r.writeWorkspaceJson(t, o)), i;
  }), l.handle("notebook:delete", async (d, s, n) => {
    const e = r.getWorkspaceDirById(s), t = await r.readWorkspaceJson(e);
    return t.notebooks = t.notebooks.filter((o) => o.id !== n), await r.writeWorkspaceJson(e, t), !0;
  }), l.handle("notebookSection:create", async (d, s, n, e) => {
    const t = r.getWorkspaceDirById(s), o = {
      id: f("sec"),
      notebookId: n,
      name: e,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: 0,
      deletedAt: null
    }, i = await r.readWorkspaceJson(t);
    return o.order = i.notebookSections.length, i.notebookSections.push(o), await r.writeWorkspaceJson(t, i), o;
  }), l.handle("notebookSection:getAll", async (d, s) => {
    const n = r.getWorkspaceDirById(s);
    return (await r.readWorkspaceJson(n)).notebookSections || [];
  }), l.handle("notebookSection:update", async (d, s, n, e) => {
    const t = r.getWorkspaceDirById(s), o = await r.readWorkspaceJson(t), i = o.notebookSections.find((u) => u.id === n);
    return i && (Object.assign(i, e, { updatedAt: Date.now() }), await r.writeWorkspaceJson(t, o)), i;
  }), l.handle("notebookSection:delete", async (d, s, n) => {
    const e = r.getWorkspaceDirById(s), t = await r.readWorkspaceJson(e);
    return t.notebookSections = t.notebookSections.filter((o) => o.id !== n), await r.writeWorkspaceJson(e, t), !0;
  }), l.handle("notebookPage:create", async (d, s, n, e, t) => {
    const o = r.getWorkspaceDirById(s), i = await r.readWorkspaceJson(o), u = {
      id: f("page"),
      notebookId: n,
      sectionId: e,
      title: t,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: i.notebookPages.length,
      deletedAt: null
    };
    i.notebookPages.push(u), await r.writeWorkspaceJson(o, i);
    const w = a.join(o, "Notebooks", n, "pages");
    await c.mkdir(w, { recursive: !0 });
    const k = a.join(w, `${u.id}.json`), D = a.join(w, `${u.id}.content.json`);
    return await p.enqueue(k, JSON.stringify(u, null, 2)), await p.enqueue(D, JSON.stringify({ type: "doc", content: [] }, null, 2)), u;
  }), l.handle("notebookPage:getAll", async (d, s) => {
    const n = r.getWorkspaceDirById(s);
    return (await r.readWorkspaceJson(n)).notebookPages || [];
  }), l.handle("notebookPage:update", async (d, s, n, e) => {
    const t = r.getWorkspaceDirById(s), o = await r.readWorkspaceJson(t), i = o.notebookPages.find((u) => u.id === n);
    return i && (Object.assign(i, e, { updatedAt: Date.now() }), await r.writeWorkspaceJson(t, o)), i;
  }), l.handle("notebookPage:delete", async (d, s, n) => {
    const e = r.getWorkspaceDirById(s), t = await r.readWorkspaceJson(e);
    return t.notebookPages = t.notebookPages.filter((o) => o.id !== n), await r.writeWorkspaceJson(e, t), !0;
  }), l.handle("notebook:savePage", async (d, s, n, e, t) => {
    const o = r.getWorkspaceDirById(s), i = a.join(o, "Notebooks", n, "pages");
    await c.mkdir(i, { recursive: !0 });
    const u = a.join(i, `${e}.content.json`);
    await p.enqueue(u, JSON.stringify(t, null, 2));
  }), l.handle("notebook:loadPage", async (d, s, n, e) => {
    const t = r.getWorkspaceDirById(s), o = a.join(t, "Notebooks", n, "pages", `${e}.content.json`);
    if (h.existsSync(o)) {
      const i = await c.readFile(o, "utf8");
      return JSON.parse(i);
    }
    return null;
  }), l.handle("notebook:saveDrawing", async (d, s, n, e, t) => {
    const o = r.getWorkspaceDirById(s), i = a.join(o, "Notebooks", n, "pages");
    await c.mkdir(i, { recursive: !0 });
    const u = a.join(i, `${e}.drawing.json`);
    await p.enqueue(u, JSON.stringify(t, null, 2));
  }), l.handle("notebook:loadDrawing", async (d, s, n, e) => {
    const t = r.getWorkspaceDirById(s), o = a.join(t, "Notebooks", n, "pages", `${e}.drawing.json`);
    if (h.existsSync(o)) {
      const i = await c.readFile(o, "utf8");
      return JSON.parse(i);
    }
    return null;
  }), l.handle("settings:get", async (d, s, n) => {
    const e = a.join(g.getPath("userData"), "panvas", "settings.json");
    if (h.existsSync(e)) {
      const t = await c.readFile(e, "utf8"), o = JSON.parse(t);
      return o[n] !== void 0 ? o[n] : null;
    }
    return null;
  }), l.handle("settings:set", async (d, s, n, e) => {
    const t = a.join(g.getPath("userData"), "panvas", "settings.json");
    let o = {};
    if (h.existsSync(t)) {
      const i = await c.readFile(t, "utf8");
      o = JSON.parse(i);
    } else
      await c.mkdir(a.join(g.getPath("userData"), "panvas"), { recursive: !0 });
    return o[n] = e, await p.enqueue(t, JSON.stringify(o, null, 2)), !0;
  }), l.handle("theme:set", async (d, s) => {
    const n = W.fromWebContents(d.sender);
    if (n) {
      const e = s === "dark" ? "#ffffff" : "#000000", t = s === "dark" ? "#0d0d0d" : s === "ink" ? "#f7f4eb" : "#ffffff";
      n.setTitleBarOverlay({
        color: t,
        symbolColor: e
      });
    }
    return !0;
  }), l.handle("migration:importWorkspace", async (d, s, n) => {
    await r.ensureBaseDir();
    const e = r.getWorkspaceDirByName(s.name), t = a.join(e, ".panvas");
    if (await c.mkdir(t, { recursive: !0 }), await c.writeFile(a.join(t, "system.json"), JSON.stringify({ version: 1, migration_complete: !0 }, null, 2)), await c.writeFile(a.join(t, "workspace.json"), JSON.stringify(s, null, 2)), await c.writeFile(a.join(t, "settings.json"), JSON.stringify({ version: 1 }, null, 2)), await c.mkdir(a.join(t, "journal"), { recursive: !0 }), await c.mkdir(a.join(t, "recovery"), { recursive: !0 }), await c.mkdir(a.join(t, "temp"), { recursive: !0 }), await c.mkdir(a.join(t, "Plugins"), { recursive: !0 }), await c.mkdir(a.join(e, "Assets", "images"), { recursive: !0 }), await c.mkdir(a.join(e, "Assets", "pdfs"), { recursive: !0 }), await c.mkdir(a.join(e, "Assets", "videos"), { recursive: !0 }), await c.mkdir(a.join(e, "Assets", "audio"), { recursive: !0 }), await c.mkdir(a.join(e, "Assets", "attachments"), { recursive: !0 }), await c.mkdir(a.join(e, "Notebooks"), { recursive: !0 }), await c.mkdir(a.join(e, "Canvas"), { recursive: !0 }), await c.mkdir(a.join(e, "PDF"), { recursive: !0 }), s.notebooks)
      for (const o of s.notebooks)
        await c.mkdir(a.join(e, "Notebooks", o.id, "pages"), { recursive: !0 });
    for (const o of n) {
      const i = a.join(e, "Canvas", `${o.canvasFileId}.json`);
      await p.enqueue(i, JSON.stringify(o, null, 2));
    }
    return r.registerWorkspace(s.id, e), !0;
  });
}
const $ = F(import.meta.url), S = a.dirname($);
process.env.APP_ROOT = a.join(S, "..");
const Z = a.join(process.env.APP_ROOT, "dist-electron"), A = a.join(process.env.APP_ROOT, "dist"), b = process.env.VITE_DEV_SERVER_URL;
process.env.VITE_PUBLIC = b ? a.join(process.env.APP_ROOT, "public") : A;
const L = a.join(process.env.VITE_PUBLIC, "panvas-logo-1.1.png");
let m;
function I() {
  m = new W({
    width: 1200,
    height: 800,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#00000000",
      // Transparent overlay so native buttons blend seamlessly with any header theme
      symbolColor: "#ffffff"
    },
    autoHideMenuBar: !0,
    // Remove default Electron menu bar
    icon: L,
    // Configure the correct Panvas icon
    webPreferences: {
      preload: a.join(S, "preload.mjs"),
      // vite-plugin-electron outputs .mjs by default sometimes, we will check output format later
      contextIsolation: !0,
      nodeIntegration: !1
    }
  }), b ? m.loadURL(b) : m.loadFile(a.join(A, "index.html"));
}
g.on("window-all-closed", () => {
  process.platform !== "darwin" && (g.quit(), m = null);
});
g.on("activate", () => {
  W.getAllWindows().length === 0 && I();
});
g.whenReady().then(() => {
  x(), I();
});
export {
  Z as MAIN_DIST,
  A as RENDERER_DIST,
  b as VITE_DEV_SERVER_URL
};
