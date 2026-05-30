# Panvas

**The Visual Research Workspace for Engineers, Researchers, and Creators.**

Panvas is an infinite canvas application that blends diagrams, code, equations, research, and notes into one cohesive visual environment. It is built with a local-first architecture for absolute privacy and speed, with optional cloud synchronization.

---

### 🚀 Project Status
- **Public Marketing Website:** Deployed and Live.
- **Workspace Application:** Currently in Private Development.

---

## 🎨 Vision & Features

*   **Visual Thinking:** Break out of linear documents. Panvas gives you the freedom to mix hand-drawn architecture diagrams, state machines, and system mind maps exactly where you need them.
*   **Structured Workspaces:** Organize your thoughts into unlimited nested folders. Pin critical architecture canvases, group related notes, and navigate your entire engineering knowledge base instantly.
*   **Local First Architecture:** Your data never leaves your machine unless you want it to. True local-first architecture means sub-millisecond interactions, offline support by default, and absolute privacy.
*   **Engineering Native:** First-class support for Markdown, LaTeX equations, Mermaid diagrams, and syntax-highlighted code blocks.

---

## 🛠️ Tech Stack

- **Frontend Core:** React 18, TypeScript, Vite
- **Canvas Rendering:** Excalidraw Core
- **Styling & UI:** Tailwind CSS, Framer Motion, Lucide Icons
- **State Management:** Zustand
- **Routing:** Wouter
- **Database & Auth:** Supabase (PostgreSQL)
- **Local Storage:** IndexedDB (idb)
- **Analytics:** PostHog

---

## 💻 Local Development Setup

To run Panvas locally, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sumitahmed/Panvas.git
   cd Panvas
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup (Optional):**
   Copy `.env.example` to `.env` if you are actively developing authentication or cloud sync features.
   ```bash
   cp .env.example .env
   ```
   *Note: For V1 public testing, you can set `VITE_MARKETING_ONLY=true` in your `.env` to simulate the production lock-down.*

4. **Start the development server:**
   ```bash
   npm run dev
   ```

---

## 📦 Build Commands

- `npm run dev`: Starts the local development server.
- `npm run build`: Compiles TypeScript and builds the production bundle via Vite.
- `npm run preview`: Serves the compiled production bundle (`dist/`) locally for testing.

---

## 🌐 Deployment Instructions

Panvas is optimized for zero-configuration deployment to **Vercel**. 

1. Push your repository to GitHub.
2. Import the project in your Vercel Dashboard.
3. Vercel will automatically detect the Vite framework and configure the build settings (`npm run build` / `dist`).
4. **Important**: Under the Environment Variables section in Vercel, add:
   - `VITE_MARKETING_ONLY=true` (Required to lock down the workspace for V1)
   - `VITE_POSTHOG_KEY=...` (For analytics)
   - `VITE_SUPABASE_URL=...` (Optional for V1)
   - `VITE_SUPABASE_ANON_KEY=...` (Optional for V1)
5. Click **Deploy**.

*Note: SPA routing is handled automatically via the included `vercel.json` file.*
