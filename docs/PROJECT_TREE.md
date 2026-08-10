# Project tree

```text
.
├─ docs/                 handoff documentation (this set)
├─ public/               shipped marketing/static image assets
├─ src/
│  ├─ app/               App bootstrap/routing
│  ├─ components/
│  │  ├─ layout/         AppShell, TopBar, Sidebar, StatusBar
│  │  ├─ workspace/      real workspace content/tree + explorer preview
│  │  ├─ canvas/         Excalidraw integration and canvas preview UI
│  │  ├─ notebook/       notebook hierarchy/page visual components
│  │  ├─ pdf/            static PDF workspace UI
│  │  ├─ library/        static library UI + reusable file preview cards
│  │  ├─ appearance/     theme studio preview
│  │  ├─ pen-toolbar/    universal pen UI preview
│  │  ├─ system/         system-component gallery preview
│  │  ├─ auth/, settings/, marketing/, legal/, ui/
│  ├─ database/          Dexie schema and CRUD modules
│  ├─ repositories/      domain abstraction over database modules
│  ├─ stores/            Zustand state/actions
│  ├─ services/          auth, Supabase, sync, storage metrics
│  ├─ hooks/             autosave and keyboard shortcuts
│  ├─ types/             workspace/canvas/notebook/sync contracts
│  ├─ styles/            global tokens and block styles
│  └─ lib/               analytics, ID/debounce/shortcut utilities, validation
├─ supabase/             schema and migrations
├─ tests/                Playwright auth-isolation test
├─ v1/                   older duplicate project snapshot; do not edit casually
├─ package.json          scripts/dependencies
├─ tailwind.config.ts    token utilities/theme extension
└─ vite.config.ts        Vite/React configuration
```

`src/Background Images/` contains design/source imagery. `UIUX/` is untracked design-reference material and must not be treated as runtime source without explicit adoption.
