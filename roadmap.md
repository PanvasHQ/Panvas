0. PRODUCT VISION

Panvas is a local-first, desktop-first digital workspace for thinking, studying, writing, drawing, organizing, and working with documents.

The long-term product combines ideas from:

Samsung Notes
Microsoft OneNote
Apple Notes / iPad note-taking
Excalidraw
GoodNotes
PDF annotation applications
Photoshop / Clip Studio Paint — future advanced drawing stage
modern workspace/document applications

But Panvas is not a clone of any of them.

The goal is to create a unified workspace where users can:

Write
Draw
Organize
Annotate
Import
Search
Research
Create diagrams
Work with PDFs
Work with images
Take handwritten notes

while keeping the experience:

local-first
fast
visually clean
desktop-first
keyboard-friendly
stylus-friendly
extensible
eventually multi-device
1. GOVERNING DEVELOPMENT RULES

These rules apply to every implementation task.

1.1 One task at a time

Only implement the feature explicitly requested.

Do not bundle unrelated improvements.

1.2 Never redesign unrelated UI

If the task is:

Add Insert Page

do not redesign:

sidebar
toolbar
settings
canvas
dashboard

unless required for that feature.

1.3 Do not invent features

If something is not specified in the roadmap or current task:

DO NOT IMPLEMENT IT.

Ask for clarification if necessary.

1.4 Preserve existing design language

Panvas has an established visual language.

New features must match the existing:

typography
spacing
borders
radius
shadows
colors
iconography
toolbar style
panel style
interaction patterns

Do not blindly copy Samsung Notes.

Samsung Notes is a feature reference, not a visual-design specification.

1.5 UI vs functionality

Every feature must be classified as one of:

UI / Mockup
Functional
Architecture / Infrastructure
Future

Do not mark a feature complete merely because its UI exists.

Example:

[UI] Insert Page button

is not equivalent to:

[Functional] Insert Page actually creates a persistent page
1.6 Local-first principle

Panvas must work without an internet connection.

Core functionality must not depend on cloud connectivity.

Internet OFF
     ↓
Panvas still works
     ↓
Changes stored locally
     ↓
Internet returns
     ↓
Optional sync
1.7 Data model before cloud

Do not implement cloud synchronization before the native Panvas data model is stable.

The correct order is:

UI
 ↓
Functional page/canvas system
 ↓
Native data model
 ↓
Local persistence
 ↓
Import/export
 ↓
Search
 ↓
Sync architecture
 ↓
Cloud providers
1.8 Validation

After every implementation task:

npx tsc -b

Fix TypeScript errors introduced by the task.

Do not silently ignore errors.

1.9 Stop after task completion

After completing the requested task:

STOP.

Do not continue implementing the next roadmap item automatically.

Wait for approval/instruction.

2. PHASE 1 — FOUNDATION ✅
- [x] Project setup
- [x] Electron shell
- [x] Routing
- [x] Theme engine
- [x] Local persistence
- [x] Global state
- [x] Base layout
3. PHASE 2 — DESKTOP SHELL ✅
- [x] Native window layout
- [x] Sidebar foundation
- [x] Top navigation
- [x] Search bar
- [x] Theme switching
- [x] Dashboard shell
4. PHASE 3 — DASHBOARD ✅
- [x] Home dashboard
- [x] Recent items
- [x] Quick create
- [x] Schedule widget
- [x] Tasks widget
5. PHASE 4 — NOTEBOOK SYSTEM

This is one of the core systems of Panvas.

The notebook system should eventually provide the functionality expected from a serious handwriting/note-taking application.

5A — Notebook Hierarchy ✅
- [x] Notebook
- [x] Section
- [x] Page
- [x] IndexedDB
- [x] Sidebar hierarchy

Target hierarchy:

Workspace
 └── Notebook
      └── Section
           └── Page
5B — Notebook Page Layout ✅
- [x] Breadcrumb
- [x] Notebook page shell
- [x] A4 paper layout
- [x] Right inspector
- [x] Metadata area
5C — Page Properties UI ✅
- [x] Page type
- [x] Paper color
- [x] Template
- [x] Orientation
- [x] Page size
- [x] Margins
- [x] Zoom
- [x] Template preview
5D — Floating Notebook Toolbar ✅
- [x] Floating toolbar
- [x] Compact desktop controls
- [x] Tool states
- [x] Tooltips
- [x] Overflow menu
5E — Writing Tools
UI completed
- [x] Pen
- [x] Pencil
- [x] Highlighter
- [x] Eraser
- [x] Stroke eraser UI
- [x] Area eraser UI
- [x] Lasso UI
- [x] Selection UI
Functional implementation
- [x] Real pen strokes
- [x] Real pencil strokes
- [x] Real highlighter strokes
- [x] Stroke erasing
- [x] Area erasing
- [x] Selection
- [x] Move selected handwriting
- [x] Resize selected objects
- [x] Change stroke color
- [x] Change stroke width
- [x] Undo/redo for drawing
- [x] Persistent handwriting data
6. PHASE 5 — NOTEBOOK PAGE MANAGEMENT

This phase incorporates the major page-management functionality observed in Samsung Notes.

6A — Insert Page

Priority: HIGH

- [x] Add Page button
- [x] Insert page after current page
- [x] Insert page before current page
- [x] Create page from selected template
- [x] Persist new page
- [x] Automatically update page count
- [x] Preserve page ordering

Example:

Page 1
Page 2
Page 3  ← current

Insert Page

Page 1
Page 2
Page 3
Page 4  ← new
6B — Page Numbering
- [x] Display current page number
- [x] Display total page count

Example:

3 / 12

or:

Page 3 of 12

The page number should update automatically when pages are:

created
deleted
reordered
6C — Page Sorter

Inspired by the Samsung Notes page sorter.

- [x] Page sorter view
- [x] Thumbnail previews
- [x] Current-page highlighting
- [x] Multi-page selection
- [x] Drag pages to reorder
- [x] Delete pages
- [x] Duplicate pages
- [x] Insert pages
- [x] Move pages
- [x] Page numbering updates

Target:

┌─────┐ ┌─────┐ ┌─────┐
│  1  │ │  2  │ │  3  │
│     │ │     │ │     │
└─────┘ └─────┘ └─────┘

        Drag to reorder
7. PHASE 6 — NOTEBOOK CONTENT ENGINE

This converts the current notebook UI into a real editable workspace.

7A — Native Content Model

Panvas pages must not simply be screenshots.

A page should contain structured objects.

Conceptually:

Page
│
├── Text
├── Handwriting
├── Shapes
├── Images
├── Tables
├── Code
├── Callouts
├── Sticky Notes
├── Dividers
└── Attachments

Every object must have:

ID
type
position
size
content
styling
metadata

where applicable.

7B — Rich Text
- [x] Rich text UI foundation
- [x] Typography UI
- [x] Inline formatting UI
- [x] Lists UI
- [x] Quote UI

Functional:

- [x] Bold
- [x] Italic
- [x] Underline
- [x] Strikethrough
- [x] Font size
- [x] Font family
- [x] Text color
- [x] Highlight color
- [x] Alignment
- [x] Bulleted lists
- [x] Numbered lists
- [x] Checklists
8. PHASE 7 — FONT SYSTEM

Inspired by the Samsung Notes text experience.

Panvas text must support multiple fonts rather than a single default typeface.

8A — Standard Fonts
- [x] Font selector
- [x] Font preview
- [x] Font size
- [x] Font weight
- [x] Font style
8B — Handwriting-style Fonts

Create a separate category:

Handwriting

Examples conceptually:

Clean Handwriting
Casual Handwriting
Marker
Notebook
Calligraphy

These are actual text fonts, not handwriting recognition.

Therefore:

Typed text
      ↓
Handwriting-style font
      ↓
Looks handwritten
      ↓
Still editable/searchable text
9. PHASE 8 — IMPORT & INSERT SYSTEM

Panvas should become capable of receiving content from outside the application.

9A — PDF Import
- [x] Import PDF
- [x] File picker
- [x] Drag & drop PDF
- [x] PDF preview
- [x] Open PDF in PDF Workspace
- [x] Attach PDF to notebook
- [x] Store PDF locally
9B — Image Import
- [x] Insert image
- [x] Image file picker
- [x] Drag & drop image
- [x] Paste image
- [x] Resize image
- [x] Move image
- [x] Rotate image
- [x] Delete image
- [x] Image selection
9C — Universal Drag & Drop

- [x] Panvas should support dragging supported files from:

- [x] Windows Explorer
- [x] Desktop
- [x] Browser
- [x] Other applications

into Panvas.

Supported initial targets:

- [x] Images
- [x] PDFs

Future:

Audio
Video
Documents
10. PHASE 9 — PDF WORKSPACE

The current PDF Workspace UI exists and should now move toward functionality.

10A — PDF Workspace UI ✅
 PDF workspace shell
 Document page
 Breadcrumb
 Page navigation
 Zoom
 Fullscreen
 Thumbnail layout
10B — PDF Viewer
 Real PDF rendering
 Multi-page PDF
 Page navigation
 Page thumbnails
 Zoom
 Fit page
 Fit width
 Fullscreen
10C — PDF Annotation
 Annotation toolbar UI
 Annotation sidebar UI

Functional:

 Pen
 Highlighter
 Text annotation
 Shapes
 Underline
 Strike-through
 Eraser
 Selection
10D — PDF Comments
 Comments panel
 Annotation list
 Add comment
 Reply
 Delete comment
 Navigate to annotation
10E — PDF → Panvas Note

Panvas should eventually support converting imported PDF content into a notebook workflow.

Possible workflow:

Import PDF
     ↓
Open PDF Workspace
     ↓
Annotate / read
     ↓
Create Panvas Note
     ↓
PDF + annotations/content
     ↓
Editable Panvas notebook workflow

Exact conversion behavior must be designed before implementation.

Do not invent the conversion mechanism.

11. PHASE 10 — NOTE SEARCH

Search must eventually work inside the actual contents of notes, not merely search notebook/page names.

10A — Global Search
 Search notebooks
 Search sections
 Search pages
 Search files
 Search tags
10B — Content Search

Search:

Typed text

and eventually:

OCR text
Handwriting recognition text
PDF text
10C — Search Results

Example:

Search: "SQL"

Notebook
 └── DBMS

Page 12
"SQL JOIN operations..."

Page 19
"SQL normalization..."

Clicking a result should navigate directly to the source.

12. PHASE 11 — HANDWRITING INTELLIGENCE

This is a major future notebook capability.

11A — Handwriting → Text

User writes:

Hello world

Panvas can convert it into:

Hello world

Requirements:

- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
11B — Automatic Handwriting → Handwriting Font

This is the feature described from Samsung Notes.

The user writes naturally, but Panvas internally converts the content into editable text using a handwriting-style font.

Concept:

User writes

        ✍️
        ↓
Recognition
        ↓
Text
        ↓
Handwriting font
        ↓
Looks handwritten

Important:

Visual result:
handwritten

Underlying object:
editable text

Therefore it can eventually be:

searched
copied
edited
resized
recolored
converted
synchronized
13. PHASE 12 — WORKSPACE EXPLORER

The Workspace Explorer UI already exists.

It must now become a real content-management system.

12A — Workspace Explorer ✅
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
12B — Functional Explorer
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
12C — Search & Navigation
- [x] 
- [x] 
- [x] 
- [x] 

Functional:

- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
14. PHASE 13 — INFINITE CANVAS

The Canvas is a separate core workspace.

13A — Canvas UI ✅
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
13B — Canvas Toolbox UI ✅
- [x] 
- [x] 
- [x] 
13C — Canvas Engine
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
13D — Canvas Objects
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
13E — Canvas Persistence
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
15. PHASE 14 — SETTINGS
14A — General
- [x] 
- [x] 
- [x] 
- [x] 
14B — Appearance
- [x] 
- [x] 
- [x] 
14C — Pen Settings
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
14D — Canvas Settings
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
14E — Keyboard Shortcuts
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
14F — Storage
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
16. PHASE 15 — THEME SHOWCASE

Panvas should have a dedicated theme system rather than a few hard-coded colors.

Themes

Initial:

- [x] 
- [x] 
- [x] 

Future:

- [x] 
- [x] 
- [x] 
- [x] 

The theme engine must remain centralized.

Do not hard-code theme colors inside individual components.

17. PHASE 16 — FILE / DOCUMENT OPERATIONS

Inspired by the workflow observed in Samsung Notes.

16A — Insert

Panvas Insert menu should eventually support:

Insert
├── Image
├── PDF
├── Drawing
├── Sticky Note
├── Table
├── Code
├── Divider
└── Other supported objects

Only implement items that have reached their corresponding roadmap phase.

16B — Save / Export
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
16C — Import
- [x] 
- [x] 
- [x] 
- [x] 
18. PHASE 17 — PAGE / DOCUMENT ORGANIZATION
Page operations
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
Notebook operations
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
19. PHASE 18 — POLISH

Only after core functionality is stable.

- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
20. PHASE 19 — LOCAL-FIRST DATA ARCHITECTURE

This phase establishes the foundation required for cloud sync.

Panvas should maintain a clear separation between:

UI
 ↓
Application State
 ↓
Panvas Data Model
 ↓
Local Persistence

The UI must not directly depend on OneDrive.

Native Panvas data model

Conceptually:

Workspace
│
├── Notebook
│    ├── Section
│    │    ├── Page
│    │    │    ├── Text
│    │    │    ├── Handwriting
│    │    │    ├── Images
│    │    │    ├── Shapes
│    │    │    └── Attachments
│
└── Canvas
     ├── Text
     ├── Drawing
     ├── Image
     └── Shapes

The actual schema must be designed and finalized before cloud synchronization.

21. PHASE 20 — CLOUD SYNC & MULTI-DEVICE
FUTURE — NOT MVP

Cloud synchronization should not be implemented until the local data architecture is stable.

22. CLOUD SYNC PRODUCT DIRECTION

Panvas should be:

LOCAL-FIRST
        +
OPTIONAL CLOUD SYNC
        +
MULTI-DEVICE ACCESS

The user should never be forced to have an internet connection to use Panvas.

23. ONE DRIVE SYNC

The first cloud provider to investigate/implement is:

Microsoft OneDrive

The reason is that the OneDrive ecosystem provides APIs through Microsoft Graph and supports application-specific storage.

Joplin is a useful architectural reference because it supports OneDrive synchronization.

Important: Panvas should not simply rely on the normal OneDrive desktop folder.

The intended architecture is:

Panvas
   ↓
Microsoft Authentication
   ↓
Microsoft Graph
   ↓
OneDrive
24. MICROSOFT AUTHENTICATION

Future implementation:

- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 

Panvas should request only the permissions necessary for its synchronization system.

25. PANVAS SYNC ENGINE

Do not hard-code OneDrive directly into every notebook/page component.

Create an abstraction:

SyncProvider

Conceptually:

SyncProvider
│
├── upload()
├── download()
├── list()
├── update()
├── delete()
└── getMetadata()

Then:

OneDriveProvider
GoogleDriveProvider       ← future
DropboxProvider            ← future
PanvasCloudProvider        ← future

can implement the same interface.

26. LOCAL SYNC QUEUE

Changes should be tracked locally.

Conceptually:

User edits page
       ↓
Local database updated
       ↓
Change added to sync queue
       ↓
Internet available?
       │
       ├── YES → Sync
       │
       └── NO  → Wait

When internet returns:

Sync queue
    ↓
Cloud
27. MULTI-DEVICE WORKFLOW

Example:

Panvas Desktop
      ↓
Write notes
      ↓
Local storage
      ↓
OneDrive
      ↓
Panvas Mobile
      ↓
Same notebook

The mobile application must independently connect to the user's cloud storage.

Simply having OneDrive installed on the phone is not sufficient.

The architecture is:

             OneDrive
                │
        Microsoft Graph
          ↙           ↘
     Panvas PC      Panvas Mobile
28. OFFLINE-FIRST SYNC

Example:

Laptop
  ↓
Offline
  ↓
Edit Page 7
  ↓
Save locally

Later:

Internet returns
      ↓
Sync engine detects pending change
      ↓
Upload

The user should not lose work because of an offline connection.

29. CONFLICT HANDLING

Initially:

- [x] 
- [x] 
- [x] 
- [x] 

Possible initial strategy:

Last-write-wins

but this must be implemented carefully.

Future advanced strategy:

Object-level merging
CRDT / collaborative data model

Do not implement CRDT merely because it sounds advanced.

30. CLOUD DATA STRUCTURE

The cloud should contain native Panvas data, not screenshots of pages.

Conceptually:

Panvas Sync Storage
│
├── workspace
│
├── notebooks
│   ├── notebook
│   ├── sections
│   └── pages
│
├── canvases
│
└── resources
    ├── images
    ├── PDFs
    └── attachments

The exact file/database format must be finalized before implementation.

31. CLOUD SECURITY

Future requirements:

- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 

Panvas should not assume that cloud storage itself is equivalent to application-level encryption.

32. FUTURE CLOUD PROVIDERS

After OneDrive:

Google Drive
Dropbox

Potentially later:

Panvas Cloud

The provider abstraction should make this possible without rewriting the entire application.

33. MOBILE COMPANION
FUTURE

Once the desktop/local/cloud architecture is stable:

- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 

Mobile should share the Panvas data model, not duplicate a completely different storage model.

34. ADVANCED FUTURE FEATURES

These are explicitly NOT current development tasks.

AI
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
Collaboration
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
Advanced Drawing

Inspired by:

Photoshop
Clip Studio Paint
professional digital illustration software

Future possibilities:

- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 

This is a long-term stage and is NOT part of the MVP.

Plugin System
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
35. FEATURE REFERENCE — SAMSUNG NOTES

The following features were identified from Samsung Notes usage and screenshots.

They are inspiration/reference requirements, not a command to clone Samsung Notes.

Observed/desired capabilities:

Page management
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
Import / insert
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
- [x] 
Text
- [x] 
- [x] 
- [x] 
- [x] 
Handwriting
- [x] 
- [x] 
- [x] 
Navigation
- [x] 
- [x] 
- [x] 
- [x] 
Document operations
- [x] 
- [x] 
- [x] 
- [x] 

These features should be implemented in Panvas only when their corresponding roadmap phases are reached.

36. PANVAS FEATURE PRIORITY

When deciding what to implement next, use this hierarchy.

Tier 1 — Core
Notebook
Page
Writing
Drawing
Persistence
Page management
Workspace explorer
Tier 2 — Essential productivity
Search
Import
Export
PDF
Images
Drag & drop
Page sorter
Rich text
Keyboard shortcuts
Tier 3 — Intelligence
OCR
Handwriting recognition
Handwriting-to-font
AI
Tier 4 — Cloud
Sync
OneDrive
Multi-device
Mobile
Tier 5 — Advanced
Collaboration
Advanced drawing
Plugins
Panvas Cloud
37. CURRENT DEVELOPMENT STATE

The existing project already has substantial UI foundations completed:

Foundation                 ✅
Desktop Shell              ✅
Dashboard                  ✅
Notebook UI                ✅
Workspace Explorer UI      ✅
PDF Workspace UI           ✅
Canvas UI                  ✅
Toolbar UI                 ✅
Properties UI              ✅
Rich Text UI               ✅

But many of these are still:

UI / prototype

rather than fully functional systems.

Therefore the next development stage is not simply adding more screens.

We must progressively convert the existing UI into a functioning application.

38. IMPORTANT IMPLEMENTATION ORDER

The recommended long-term order is:

                    PANVAS
                       │
                       ▼
              Existing UI Foundation
                       │
                       ▼
             Notebook Functionality
                       │
                       ▼
               Page Management
                       │
                       ▼
             Drawing / Writing Engine
                       │
                       ▼
             Native Data Model
                       │
                       ▼
              Local Persistence
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
        Search       Import       Export
          │            │            │
          ▼            ▼            ▼
       Handwriting     PDF       File System
          │
          ▼
       Sync Engine
          │
          ▼
       OneDrive
          │
          ▼
       Mobile
          │
          ▼
   Advanced / AI / Collaboration
39. ANTI-HALLUCINATION RULE

For Antigravity and any AI coding agent:

Before implementing a task, determine:

Which roadmap phase does this belong to?
Is the feature UI-only or functional?
What existing components should be reused?
What existing behavior must remain unchanged?
What is explicitly required by the task?
What is explicitly NOT required?

If the answer cannot be determined from:

Current code
+
Current roadmap
+
Explicit user instruction

DO NOT GUESS.

Ask for clarification.

40. NO FEATURE CREEP

Do not turn:

"Add Insert Page"

into:

Insert Page
+
Page sorter
+
PDF import
+
Cloud sync
+
Mobile sync
+
AI

Implement only:

Insert Page

unless the user explicitly asks for the additional functionality.

41. ROADMAP MODIFICATION POLICY

This roadmap is intended to remain the long-term source of truth for the project.

However, it can be modified when necessary.

If a new requirement appears:

New idea
   ↓
Discuss
   ↓
Determine phase
   ↓
Update roadmap
   ↓
Then implement

Do not silently change the roadmap during implementation.

42. DEFINITION OF DONE

A feature is considered complete only when:

UI exists
        +
Interaction works
        +
State updates correctly
        +
Data persists
        +
Existing functionality is not broken
        +
TypeScript passes
        +
Requested scope is complete

For example:

Insert Page

Not complete:

[+] button exists

Complete:

[+] button
   ↓
Creates page
   ↓
Correct position
   ↓
Page persists
   ↓
Page count updates
   ↓
Page sorter updates
   ↓
Navigation works
43. FINAL PRODUCT DIRECTION

The final Panvas ecosystem should eventually look like:

                         PANVAS
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
    NOTEBOOK             CANVAS              PDF
        │                  │                  │
        │                  │                  │
        ▼                  ▼                  ▼
- [x] 
- [x] 
- [x] 
- [x] 
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                           ▼
                    WORKSPACE EXPLORER
                           │
                           ▼
                       SEARCH
                           │
                           ▼
                    LOCAL DATA LAYER
                           │
                           ▼
                     SYNC ENGINE
                           │
                 ┌─────────┴─────────┐
                 ▼                   ▼
              OneDrive            Future
                 │
                 ▼
             MULTI-DEVICE
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
      PC      Android    iPad

And much later:

                     PANVAS
                       │
       ┌───────────────┼────────────────┐
       │               │                │
       ▼               ▼                ▼
      AI          Collaboration    Advanced Art
                                      │
                                      ▼
                              Photoshop /
                              Clip Studio
                              level tools
The most important thing

Don't let the roadmap become a feature wishlist that we randomly jump through.

It should act like our contract:

Roadmap → choose ONE task → implement → test → npx tsc -b → inspect → approve → next task.

And when you give Antigravity a prompt, we can explicitly tell it:

"Read roadmap.md first. This file is the source of truth. Implement only the requested task and do not infer additional features."

That should dramatically reduce the kind of hallucination/feature creep you were running into earlier.

One thing I'd keep flexible: the exact implementation details of the OneDrive sync format, conflict resolution, handwriting engine, and PDF→Note conversion should not be frozen yet. The product direction is frozen in this roadmap; those low-level technical decisions should be made when we reach those phases.