# Panvas V1 Final QA Test Matrix

*Document Version: 1.0.0 — Authoritative Pre-Release QA Matrix*  
*Date: September 10, 2026*  
*Status: READY FOR QA EXECUTION*  
*Target Release: Panvas v1.0.0*

---

## 1. Test Matrix Overview & Execution Protocol

This matrix outlines all test scenarios required to validate Panvas V1 across supported environments. Every test must be executed against the release candidate build (`v1.0.0-rc.1` or final `v1.0.0`) and signed off prior to public release.

### 1.1 Target Platform Coverage

| Platform ID | Environment / Shell | OS Version | Primary Storage Backend | Network Support |
|---|---|---|---|---|
| **`PLT-WIN`** | Windows Desktop (Electron x64) | Windows 10 / 11 (22H2+) | Local Filesystem (`Documents/Panvas/`) | Zero network required; optional Google Drive |
| **`PLT-CHR`** | Google Chrome (Desktop) | Windows / macOS / Linux | IndexedDB (Dexie) + OPFS | Offline-first PWA; optional Google Drive |
| **`PLT-EDG`** | Microsoft Edge (Desktop) | Windows 10 / 11 | IndexedDB (Dexie) + OPFS | Offline-first PWA; optional Google Drive |
| **`PLT-FFX`** | Mozilla Firefox (Desktop) | Windows / macOS / Linux | IndexedDB (Dexie) | Local notes; optional Google Drive |
| **`PLT-SAF`** | Safari / iPadOS Web | iPadOS 17+ / macOS 14+ | IndexedDB (Dexie) | Local notes; touch/pencil web verification |

---

## 2. Dedicated Data Loss & Recovery Verification Suite

> [!CAUTION]
> These tests are strictly **MANDATORY**. A failure in any test in this section constitutes an immediate release blocker.

| Test ID | Scenario Description | Execution Procedure | Expected Result | Platform | Status | Tester / Date | Notes |
|---|---|---|---|---|---|---|---|
| **`DATA-01`** | **SIGKILL during Ink Stroke Drawing** | Draw 10 continuous vector strokes on a Notebook page; immediately terminate process via Task Manager (`End Process`) while pen is down. Relaunch app. | All previously completed strokes persist cleanly. No corrupted strokes or app crash on reload. | `PLT-WIN` | `[ ] UNTESTED` | — | Validates atomic write queue flush. |
| **`DATA-02`** | **SIGKILL during Rich Text Typing** | Type 5 paragraphs of formatted rich text in TipTap editor; terminate process immediately via `taskkill /F /IM Panvas.exe`. Relaunch app. | Text typed up to the last debounced autosave interval (<= 500ms) is completely restored. | `PLT-WIN` | `[ ] UNTESTED` | — | Validates rich text autosave hook. |
| **`DATA-03`** | **Corrupted `workspace.json` Recovery** | Intentionally truncate or inject invalid syntax into `.panvas/workspace.json` while Panvas is closed. Launch Panvas. | Panvas detects invalid JSON, restores metadata from `.panvas/workspace.json.bak`, and presents user with recovery notification. | `PLT-WIN` | `[ ] UNTESTED` | — | Validates backup file rollback. |
| **`DATA-04`** | **Rapid Page Switching under Heavy Load** | Add 20 elements across 5 pages, then switch between pages at high speed (10 page switches in 5 seconds) while typing. | No race condition or dropped write. All 5 pages reflect their respective final state. | `PLT-WIN`, `PLT-CHR` | `[ ] UNTESTED` | — | Validates store unmount flush logic. |
| **`DATA-05`** | **Network Drop during Google Drive Backup** | Initiate Google Drive cloud backup sync; disconnect Wi-Fi mid-transfer (50% progress). Reconnect Wi-Fi after 30 seconds. | App gracefully handles network drop, marks sync as `PAUSED` or `RETRYING` in `StatusBar`, and resumes cleanly upon reconnection without vault corruption. | `PLT-WIN`, `PLT-CHR` | `[ ] UNTESTED` | — | Validates cloud sync resilience. |
| **`DATA-06`** | **Read-Only / Disk Full Handling** | Set `.panvas/` directory permissions to Read-Only; attempt to save a note. | App displays clear error toast ("Storage write failed: check permissions"), prevents silent data loss, and offers export/copy fallback. | `PLT-WIN` | `[ ] UNTESTED` | — | Validates error boundary notification. |

---

## 3. Comprehensive Functional Test Matrix (16 Core Areas)

### Area 1: Workspace & Library Management
| Test ID | Test Case | Steps to Execute | Expected Behavior | Platform | Status |
|---|---|---|---|---|---|
| `LIB-01` | Create New Workspace | Open Workspace menu -> Click "New Workspace" -> Name "Research 2026" -> Create. | Workspace directory created on disk (`Documents/Panvas/Research 2026/.panvas/`); workspace tree updates immediately. | `PLT-WIN` | `[ ] UNTESTED` |
| `LIB-02` | Switch Workspaces | Create 2 workspaces with distinct notebooks. Switch between them via sidebar dropdown. | Workspace state unloads previous vault and loads selected vault cleanly in < 300ms. | `PLT-WIN`, `PLT-CHR` | `[ ] UNTESTED` |
| `LIB-03` | Rename Workspace | Right-click workspace -> Rename -> "Thesis Notes" -> Enter. | Directory renamed on disk; references in `workspaces.json` updated cleanly. | `PLT-WIN` | `[ ] UNTESTED` |
| `LIB-04` | Delete Workspace | Delete workspace with confirmation prompt. | Vault removed from index; active workspace switches to default gracefully. | `PLT-WIN` | `[ ] UNTESTED` |

### Area 2: Notebook & TipTap Rich Text Editor
| Test ID | Test Case | Steps to Execute | Expected Behavior | Platform | Status |
|---|---|---|---|---|---|
| `TXT-01` | Rich Text Formatting | Type headings (H1-H3), bold (`Ctrl+B`), italic (`Ctrl+I`), code block, bullet list, ordered list. | TipTap renders all formats cleanly; styles persist across page reload. | `ALL` | `[ ] UNTESTED` |
| `TXT-02` | Markdown Shortcuts | Type `# Heading`, `- List item`, ```` Code`, `> Blockquote`. | Auto-transforms into rich text elements immediately on space/enter. | `ALL` | `[ ] UNTESTED` |
| `TXT-03` | Keyboard Navigation | Navigate text with arrows, home/end, select with Shift+arrows, delete words with Ctrl+Backspace. | Cursor moves accurately; no focus loss or scroll jumping. | `ALL` | `[ ] UNTESTED` |
| `TXT-04` | Undo / Redo Stack | Type sentence, format bold, press `Ctrl+Z` twice, press `Ctrl+Y` / `Ctrl+Shift+Z`. | History stack unwinds and reapplies edits accurately. | `ALL` | `[ ] UNTESTED` |

### Area 3: Vector Inking & 2D Drawing Engine
| Test ID | Test Case | Steps to Execute | Expected Behavior | Platform | Status |
|---|---|---|---|---|---|
| `INK-01` | Pen Tool Stroke & Smoothing | Select Pen tool, choose color & stroke width, draw smooth curves and handwriting. | Smooth Catmull-Rom spline curves rendered with low latency (< 16ms frame time). | `PLT-WIN`, `PLT-CHR` | `[ ] UNTESTED` |
| `INK-02` | Highlighter Tool | Select Highlighter, choose yellow/green, draw over rich text and pencil strokes. | Semi-transparent stroke rendered beneath ink and text without obscuring readability. | `ALL` | `[ ] UNTESTED` |
| `INK-03` | Stroke Eraser Tool | Select Eraser, drag across vector strokes. | Intersected strokes are deleted cleanly; canvas redraws without leftover artifacts. | `ALL` | `[ ] UNTESTED` |
| `INK-04` | Stylus Pressure / Tablet Input | Use Wacom / Microsoft Surface Pen / Apple Pencil to draw with variable pressure. | Stroke thickness responds dynamically to pressure input where hardware supports it. | `PLT-WIN`, `PLT-SAF` | `[ ] UNTESTED` |

### Area 4: Media & Attachments
| Test ID | Test Case | Steps to Execute | Expected Behavior | Platform | Status |
|---|---|---|---|---|---|
| `MED-01` | Image Drag & Drop | Drag PNG/JPEG file from OS desktop directly onto active Notebook page. | Universal drop router accepts image, stores binary in assets store, and renders resizable image element. | `PLT-WIN`, `PLT-CHR` | `[ ] UNTESTED` |
| `MED-02` | Image Resize & Move | Select image element, drag corner handles to resize, drag body to reposition. | Image scales with aspect ratio lock, handles update smoothly, position persists on save. | `ALL` | `[ ] UNTESTED` |
| `MED-03` | Image Deletion | Select image element, press `Delete` key. | Image removed from page DOM and store; disk asset unreferenced cleanly. | `ALL` | `[ ] UNTESTED` |

### Area 5: Sticky Notes & Canvas Elements
| Test ID | Test Case | Steps to Execute | Expected Behavior | Platform | Status |
|---|---|---|---|---|---|
| `STK-01` | Sticky Note Creation | Click Sticky Note button on toolbar, click on canvas/notebook page. | Sticky note created with default color (Yellow) and autofocus on textarea. | `ALL` | `[ ] UNTESTED` |
| `STK-02` | Sticky Note Color Change | Open sticky color palette, change to Blue, Pink, Green, Orange. | Sticky background and header update immediately; color persists on reload. | `ALL` | `[ ] UNTESTED` |
| `STK-03` | Sticky Note Layering & Drag | Create 3 overlapping stickies, drag across page, change z-index order. | Smooth dragging without ghosting; z-index respected across reloads. | `ALL` | `[ ] UNTESTED` |

### Area 6: Page Templates & Layout Modes
| Test ID | Test Case | Steps to Execute | Expected Behavior | Platform | Status |
|---|---|---|---|---|---|
| `TPL-01` | Background Templates | Change page template to Grid, Ruled, Dotted, Cornell, Isometric, Blank. | SVG grid/lines render crisp at any zoom level; grid spacing scales consistently. | `ALL` | `[ ] UNTESTED` |
| `TPL-02` | Viewport Scroll Modes | Toggle Vertical Scrolling, Horizontal Scrolling, and Two-Page Book view. | Layout reflows smoothly; page index indicator and navigation update correctly. | `ALL` | `[ ] UNTESTED` |
| `TPL-03` | Page Sorter / Reordering | Open Page Sorter thumbnail modal, drag Page 3 before Page 1. | Pages reordered in notebook store and serialized index file cleanly. | `ALL` | `[ ] UNTESTED` |

### Area 7: PDF Workspace & Annotations
| Test ID | Test Case | Steps to Execute | Expected Behavior | Platform | Status |
|---|---|---|---|---|---|
| `PDF-01` | PDF File Import | Drag a 20-page PDF document into Panvas library. | PDF imported, stored in assets, thumbnail sidebar generated, first page displayed. | `PLT-WIN`, `PLT-CHR` | `[ ] UNTESTED` |
| `PDF-02` | PDF Inking & Highlighting | Annotate PDF pages with pen and highlighter tools. | Inking overlays align accurately with PDF text; annotations scale with zoom level. | `ALL` | `[ ] UNTESTED` |
| `PDF-03` | PDF Multi-Page Navigation | Use thumbnail sidebar and scroll to navigate from Page 1 to Page 20. | Pages load lazily via PDF.js worker without UI freeze or memory runaway. | `ALL` | `[ ] UNTESTED` |
| `PDF-04` | PDF Export with Annotations | Click Export -> Export PDF with annotations. | Generates flattened or layered PDF containing both original document and vector ink drawings. | `PLT-WIN`, `PLT-CHR` | `[ ] UNTESTED` |

### Area 8: Infinite Visual Canvas (Excalidraw 0.17.6)
| Test ID | Test Case | Steps to Execute | Expected Behavior | Platform | Status |
|---|---|---|---|---|---|
| `CNV-01` | Canvas Creation & Shapes | Open Canvas view, draw rectangles, ellipses, arrows, freehand lines, text. | Excalidraw 0.17.6 renders crisp vectors; pan and zoom operate smoothly at 60fps. | `ALL` | `[ ] UNTESTED` |
| `CNV-02` | Custom LaTeX Block | Insert LaTeX Block, type `E = mc^2` and `\int_0^\infty e^{-x^2} dx`. | KaTeX renders mathematical formula crisply inside canvas container. | `ALL` | `[ ] UNTESTED` |
| `CNV-03` | Custom Mockup Block | Insert UI Mockup block, add button, input, toggle elements. | Interactive mockup components render and preserve state in canvas payload. | `ALL` | `[ ] UNTESTED` |
| `CNV-04` | Canvas Autosave & Reload | Add 50 elements, close app, relaunch. | Canvas restores exact viewport position, zoom level, and all elements intact. | `PLT-WIN`, `PLT-CHR` | `[ ] UNTESTED` |

### Area 9: Audio Recording & Voice Notes
| Test ID | Test Case | Steps to Execute | Expected Behavior | Platform | Status |
|---|---|---|---|---|---|
| `AUD-01` | Audio Recording Capture | Click Record Audio button, speak for 15 seconds, click Stop. | Audio captured via MediaRecorder API, saved as WebM/WAV, attached to note. | `PLT-WIN`, `PLT-CHR` | `[ ] UNTESTED` |
| `AUD-02` | Audio Playback & Waveform | Click Play on audio attachment. | Audio plays smoothly with working scrub bar, volume control, and duration timer. | `ALL` | `[ ] UNTESTED` |

### Area 10: Global Search & Command Palette
| Test ID | Test Case | Steps to Execute | Expected Behavior | Platform | Status |
|---|---|---|---|---|---|
| `SCH-01` | Command Palette Launch | Press `Ctrl+K` (or `Cmd+K` on Mac). | Command palette overlay appears instantly with input focus. | `ALL` | `[ ] UNTESTED` |
| `SCH-02` | Note Title & Content Search | Type search query matching notebook title or rich text content. | Matching notes listed with preview snippets; clicking item navigates directly to target note. | `ALL` | `[ ] UNTESTED` |
| `SCH-03` | Action Commands | Type "> New Notebook", "> Change Theme", "> Toggle Sidebar". | Command executes action immediately upon selection. | `ALL` | `[ ] UNTESTED` |

### Area 11: Local Filesystem Persistence (Desktop)
| Test ID | Test Case | Steps to Execute | Expected Behavior | Platform | Status |
|---|---|---|---|---|---|
| `FS-01` | Serialized Write Queue | Perform 30 rapid changes (draw strokes, edit text, rename notebook). | All writes serialized via `write-queue.ts`; zero disk write race conditions or file locks. | `PLT-WIN` | `[ ] UNTESTED` |
| `FS-02` | Directory Structure Integrity | Inspect `Documents/Panvas/<Workspace>/.panvas/` on disk. | Files structured cleanly (`workspace.json`, `notebooks/`, `canvases/`, `assets/`, `backups/`). | `PLT-WIN` | `[ ] UNTESTED` |

### Area 12: Browser Storage & IndexedDB Fallback
| Test ID | Test Case | Steps to Execute | Expected Behavior | Platform | Status |
|---|---|---|---|---|---|
| `IDB-01` | Browser Persistent Storage Grant | Launch Panvas in Chrome/Edge. Inspect storage status via `navigator.storage.persisted()`. | Returns `true`; browser grants persistent storage quota to prevent eviction. | `PLT-CHR`, `PLT-EDG` | `[ ] UNTESTED` |
| `IDB-02` | Dexie Fallback CRUD | Perform all notebook and canvas operations in browser mode. | All operations read and write to IndexedDB tables cleanly with zero errors. | `PLT-CHR`, `PLT-FFX` | `[ ] UNTESTED` |

### Area 13: Google Drive Cloud Sync
| Test ID | Test Case | Steps to Execute | Expected Behavior | Platform | Status |
|---|---|---|---|---|---|
| `GDR-01` | Google OAuth2 Authentication | Open Settings -> Cloud Sync -> Connect Google Drive. Authorize in browser. | Tokens acquired safely; `cloudSyncStore` reflects `CONNECTED` status. | `PLT-WIN`, `PLT-CHR` | `[ ] UNTESTED` |
| `GDR-02` | Full Workspace Cloud Backup | Click "Sync Now" -> monitor progress. | Snapshot uploaded to Google Drive `Panvas_Backups` folder; `StatusBar` displays "Synced Just Now". | `PLT-WIN`, `PLT-CHR` | `[ ] UNTESTED` |
| `GDR-03` | Cloud Sync Disconnect | Click "Disconnect Google Drive". | Cloud tokens purged from secure storage; local workspace remains 100% intact. | `PLT-WIN`, `PLT-CHR` | `[ ] UNTESTED` |

### Area 14: Offline / Airplane Mode Resilience
| Test ID | Test Case | Steps to Execute | Expected Behavior | Platform | Status |
|---|---|---|---|---|---|
| `OFF-01` | Zero Network Boot | Disconnect all network interfaces; launch Panvas desktop app. | App boots instantly without hang, timeout errors, or missing asset failures. | `PLT-WIN` | `[ ] UNTESTED` |
| `OFF-02` | Full Offline Note Creation | Create notebook, draw ink, write rich text, insert image while offline. | All features function 100% locally with zero degradation. | `ALL` | `[ ] UNTESTED` |

### Area 15: Import / Export Capabilities
| Test ID | Test Case | Steps to Execute | Expected Behavior | Platform | Status |
|---|---|---|---|---|---|
| `EXP-01` | Export Note as PDF | Open notebook page -> File -> Export -> PDF. | High-quality PDF generated containing background template, rich text, and vector ink. | `ALL` | `[ ] UNTESTED` |
| `EXP-02` | Export Canvas as PNG / SVG | Open canvas -> Export -> PNG / SVG. | High-resolution image generated with transparent or selected background. | `ALL` | `[ ] UNTESTED` |
| `EXP-03` | Workspace Backup Export (.zip) | Settings -> Storage -> Export Full Workspace Backup. | Creates standard zip archive containing entire `.panvas/` directory. | `PLT-WIN`, `PLT-CHR` | `[ ] UNTESTED` |

### Area 16: Settings, Themes & Customization
| Test ID | Test Case | Steps to Execute | Expected Behavior | Platform | Status |
|---|---|---|---|---|---|
| `SET-01` | Theme Studio Switching | Switch through all 6 themes (Dark, Light, System, Cyberpunk, Forest, Sepia). | All UI elements (TopBar, Sidebar, Modals, Canvas toolbar) update CSS variables cleanly. | `ALL` | `[ ] UNTESTED` |
| `SET-02` | Custom Storage Location | Change storage path in Settings to custom directory (e.g., `D:\Notes\Panvas`). | Files moved/initialized at target path; active pointer updated atomically. | `PLT-WIN` | `[ ] UNTESTED` |

---

## 4. Large Dataset & Stress Testing

| Stress Test ID | Test Parameter | Target Volume | Expected Behavior | Status |
|---|---|---|---|---|
| `STR-01` | Notebook Page Count | 150 Pages in a single notebook | Page navigation remains smooth (< 100ms switch time); memory usage < 350 MB. | `[ ] UNTESTED` |
| `STR-02` | Vector Ink Complexity | 2,500 ink strokes on a single page | Canvas panning and zooming maintains >= 50 fps; smooth spline rendering. | `[ ] UNTESTED` |
| `STR-03` | Large PDF Document | 120-page technical manual (45 MB) | PDF loads in < 2 seconds; pages render on demand via PDF.js worker without memory leak. | `[ ] UNTESTED` |
| `STR-04` | Canvas Object Density | 500 mixed Excalidraw shapes, text, LaTeX blocks | Canvas maintains smooth dragging, zooming, and sub-second serialization to disk. | `[ ] UNTESTED` |

---

## 5. QA Sign-Off & Release Gate Certification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PANVAS V1 QA SIGN-OFF CERTIFICATE                     │
│                                                                             │
│   Total Test Cases: 45                                                      │
│   Passed: ___ / 45       Failed: ___ / 45       Blocked: ___ / 45           │
│                                                                             │
│   Data Loss Tests (DATA-01 to DATA-06): [ ] 100% PASSED                     │
│   Functional Tests (Area 1 to 16):      [ ] 100% PASSED                     │
│   Stress & Performance Tests:           [ ] 100% PASSED                     │
│                                                                             │
│   QA Lead Signature: _______________________ Date: ______________________    │
│   Build Hash / Commit: _________________________________________________    │
└─────────────────────────────────────────────────────────────────────────────┘
```

