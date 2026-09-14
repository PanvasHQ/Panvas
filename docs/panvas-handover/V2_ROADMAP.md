# Panvas Post-V1 Architecture & Future Engineering Reference

> **Document Type**: Future Engineering Reference & Technical Design Archive  
> **Authority**: Engineering Handover & Future Architecture  
> **Canonical Public Roadmap**: [`docs/ROADMAP.md`](../ROADMAP.md) *(Authoritative Roadmap)*  
> **Status**: POST-V1 PLANNING  
> **Last Reconciled**: September 10, 2026 (Pre-Hardening Baseline Reconciliation)  
> **Strategic Progression**:  
> - **V1: Foundation + Reliability** *(Current Feature-Frozen Core)*  
> - **V2: Knowledge Canvas** *(Notion-Style Blocks + Spatial Freedom)*  
> - **V3: Extensibility + Intelligence** *(Embedded Web, MCP, Plugins, AI)*  

---

## 1. Executive Vision: The Three-Generation Evolution

Panvas follows a structured three-generation evolutionary roadmap:

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│            PANVAS V1            │   │            PANVAS V2            │   │            PANVAS V3            │
│     FOUNDATION + RELIABILITY    │──▶│         KNOWLEDGE CANVAS        │──▶│   EXTENSIBILITY + INTELLIGENCE  │
│                                 │   │                                 │   │                                 │
│ • 5-Tier Document Hierarchy     │   │ • Structured Content Blocks     │   │ • Embedded Web Research Browser │
│ • 2D Vector Ink Engine          │   │ • Technical Code & LaTeX Cards  │   │ • Model Context Protocol (MCP)  │
│ • PDF Workspace & In-Place Ink  │   │ • Document Frames on Canvas     │   │ • Sandboxed Extension Runtime   │
│ • Excalidraw Freeform Canvas    │   │ • Page & Section Backlinks      │   │ • Private Local / Hybrid AI     │
│ • Atomic WriteQueue & Storage   │   │ • Planning Cards & Board Layouts│   │ • Autonomous Agent Pipelines    │
└─────────────────────────────────┘   └─────────────────────────────────┘   └─────────────────────────────────┘
```

- **Panvas V1 = Foundation + Reliability**: Feature-frozen on core local-first capabilities. Focused entirely on production hardening, data integrity, security, and packaging.
- **Panvas V2 = The Knowledge Canvas**: Unifies the spatial drawing freedom of Excalidraw with the structured knowledge and documentation capabilities of Notion, seamlessly integrated with Panvas's local-first notebook and PDF workflows. Full specifications are maintained in [**`docs/ROADMAP.md`**](../ROADMAP.md).
- **Panvas V3 = Extensibility + Intelligence**: Introduces sandboxed third-party plugins, Model Context Protocol integration, an embedded research browser, and private document intelligence.

---

## 2. Technical Specifications: Extensibility & Intelligence (V3 Horizon)

The architectural specifications below preserve the detailed designs originally drafted for Panvas's advanced platform capabilities:

$$\text{Embedded Web} + \text{MCP Tools} + \text{Extension API} + \text{Panvas AI} \longrightarrow \text{Automated Research Pipelines}$$

All items in this section are classified as **`V3 PLANNED`** and are **STRICTLY EXCLUDED FROM THE V1 RELEASE GATE**.

---

### Pillar 1: Embedded Web Workspace / Research Browser (`V3 PLANNED`)

- **Concept**: A low-friction research companion embedded inside Panvas, allowing users to consult documentation, academic papers, Wikipedia, GitHub, and web references without leaving their notes.
- **Primary Capabilities**:
  - Toolbar entry in the primary Panvas workspace shell.
  - Default home destination: Google / search provider.
  - Omnibox URL / search input with history navigation (Back, Forward, Reload, Stop, Home, Open in External Browser).
  - State feedback: loading indicators, HTTPS certificate badges, and in-app offline/error states.
  - Research companion workflow: clean extraction of rich text, Markdown, LaTeX, and images into Panvas notes, safe drag-and-drop, and citation card creation.
- **Security Architecture**:
  - **Desktop Target (Electron `^43.3.0`)**: Implemented via isolated `WebContentsView` with strict boundaries:
    - `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.
    - Zero Panvas preload script exposure (`window.panvas` is strictly inaccessible to remote sites).
    - Zero IPC emitter access to the Electron Main process.
    - Quarantined session partition: `session.fromPartition('persist:panvas_research_browser')`.
    - Strict protocol validation: allow only `http:` and `https:`; reject dangerous schemes (`file:`, `javascript:`, `data:`, `smb:`, etc.).
    - Strict permission handlers: camera, mic, and geolocation blocked or gated behind explicit prompt UX.
  - **Web / PWA Target**: Safe fallback using external browser tabs or sandboxed link preview cards when embedding is restricted by target `X-Frame-Options` or CSP headers.

---

### Pillar 2: Model Context Protocol (MCP) Integration Platform (`V3 PLANNED`)

- **Concept**: Native support for Anthropic's Model Context Protocol, enabling Panvas to communicate bidirectionally with external toolchains, computational engines, and local data sources.
- **Primary Capabilities**:
  - **Server Registration**: Connect to local MCP servers running via `stdio` child processes or remote servers via `SSE`/HTTP.
  - **Capability & Tool Discovery**: Inspect server metadata, declared tools, resources, and prompt templates.
  - **Connection Monitoring**: Real-time status indicators in Settings (`Connected`, `Reconnecting`, `Error`, `Disconnected`).
  - **Granular Trust Gates**: Explicit user consent dialogs before any MCP server is authorized to read note contents, query canvases, or execute local tools.

---

### Pillar 3: Panvas Extension / Plugin Foundation (`V3 PLANNED`)

- **Concept**: An extensibility architecture inspired philosophically by developer tools like Obsidian, enabling power users and developers to customize Panvas workflows safely.
- **Primary Capabilities**:
  - **Extension Manifest (`panvas-extension.json`)**:
    ```json
    {
      "id": "panvas-bibtex-manager",
      "name": "BibTeX Citation Manager",
      "version": "1.0.0",
      "description": "Insert LaTeX and BibTeX citations directly into notebook notes.",
      "author": "Research Community",
      "minPanvasVersion": "3.0.0",
      "permissions": ["notebook.read", "notebook.write"],
      "entry": "dist/index.js",
      "capabilities": ["commands", "sidebarPanels"]
    }
    ```
  - **Contribution Points**:
    - Custom Commands (registered into `CommandPalette` / `Ctrl+K`).
    - Custom Toolbar Actions (buttons in page/canvas toolbars).
    - Custom Sidebar Panels (research tool tabs).
    - Custom Format Importers / Exporters.
  - **Stable Public API Façade**: Extensions interact with Panvas strictly through a versioned public API boundary (`panvas.*`). Plugins are strictly prohibited from accessing raw Zustand stores, Dexie tables, or Electron IPC internals.
  - **Least-Privilege Capability Model**: User-approved permissions (`workspace.read`, `workspace.write`, `notebook.read`, `notebook.write`, `canvas.read`, `canvas.write`, `network`, `clipboard`, `filesystem`).

---

### Pillar 4: Panvas Intelligence & AI-Native Research Workflows (`V3 PLANNED`)

- **Concept**: Intelligent research augmentation grounded strictly in the user's private local documents, avoiding superficial chatbot overlays.
- **Primary Capabilities**:
  1. **Contextual Note Assistant**: Private, local (WASM/Ollama) or opt-in cloud LLM chat grounded directly in open notebook pages and research collections.
  2. **Semantic Document Understanding**: High-fidelity PDF information extraction, table parsing, and citation graph generation.
  3. **AI-Assisted Organization**: Conceptual auto-tagging, automatic cross-notebook backlinking, and smart topic clustering.
  4. **AI Canvas & Diagram Generation**: Text-to-diagram generation, automatic mind mapping, and smart Excalidraw layout synthesis.
  5. **Autonomous Research Agent Workflows**: Agentic pipelines orchestrating Web research + MCP computational tools + Panvas canvas synthesis to conduct multi-step technical investigations.

---

## 3. V3 Architectural Synergy: The Autonomous Research Loop

When these four pillars converge in V3, Panvas enables an automated research loop:

```
                  ┌─────────────────────────────────────┐
                  │    Panvas Intelligence (AI Core)     │
                  └──────────────────┬──────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│  Embedded Web Tool  │   │  MCP Server Network │   │    Extension API    │
│  - Academic Papers  │   │  - Python Engine    │   │  - Custom Visualizers│
│  - Documentation    │   │  - SQLite Database  │   │  - LaTeX Exporters  │
│  - Web References   │   │  - ArXiv Fetcher    │   │  - Study Workflows  │
└──────────┬──────────┘   └──────────┬──────────┘   └──────────┬──────────┘
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     ▼
                  ┌─────────────────────────────────────┐
                  │      Panvas Workspace of Record     │
                  │   Notebooks • Canvases • Annotations│
                  └─────────────────────────────────────┘
```

---

## 4. Development Precondition

> [!CAUTION]
> **No post-V1 development (Knowledge Canvas, Embedded Web, MCP, Extensions, or AI) may begin until Panvas V1 has fully satisfied all 13 criteria of the [Definitive V1 Release Gate](V1_FEATURE_SCOPE.md#6-definitive-panvas-v1-release-gate) and production deployment is finalized.**
