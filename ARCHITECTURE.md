# ScriptForge - Product Architecture & Specifications

## 1. Product Architecture
**Client-Side (Frontend):**
- **Framework:** React 19 (Vite instead of Next.js for current environment support).
- **Styling:** Tailwind CSS + custom class aggregation.
- **Routing:** React Router DOM (Client-side routing).
- **State Management:** Zustand (for global application state) + React Context (for Authentication/Theme).
- **Animations:** Motion (Framer Motion).

**Server-Side (Backend/Services):**
- **Authentication:** Firebase Auth (Google Provider + Email/Password).
- **Database:** Firebase Firestore (NoSQL Document Store for projects, scripts, scenes, character bibles).
- **Storage:** Firebase Cloud Storage (for character photos, assets, exports).
- **AI Services:** Gemini API (@google/genai) via server-side Node proxy (Express) for scene brainstorming, dialogue improvement, and AI copilot.

## 2. Database Schema (Firestore)

**Collections:**
- `users`
  - `id` (String - UID)
  - `displayName`, `email`, `photoURL`, `createdAt`
- `projects`
  - `id` (String)
  - `ownerId` (String - UID)
  - `title`, `logline`, `updatedAt`, `createdAt`
- `scripts` (Sub-collection under `projects` OR top-level linked by `projectId`)
  - `blocks` (Array of objects: type [scene_heading, action, character, dialogue], content)
- `characters`
  - `projectId`, `name`, `role`, `description`, `photoUrl`, `arc`, `relationships` (Array/Map)
- `beats`
  - `projectId`, `title`, `description`, `act` (1, 2, 3), `order`

## 3. Folder Structure
```
/src
  /assets         # Static assets (images, icons)
  /components
    /ui           # Reusable generic UI components (buttons, inputs, modals)
    /editor       # Screenplay editor specific components
    /dashboard    # Projects overview components
    /board        # Beat board components
  /contexts       # React contexts (AuthContext, ThemeContext)
  /hooks          # Custom hooks (useAuth, useFirestore, useGemini)
  /lib            # Utility functions (cn, formatting, constants)
  /pages          # Top-level route components
  /services       # API & external service wrappers (firebase, AI proxy fetchers)
  /stores         # Zustand state stores
  /types          # TypeScript interfaces and enums
```

## 4. UI Sitemap
- `/` - Landing Page (Features, Pricing, LoginCTA) -> *Skipped for MVP if Auth enforced*
- `/login` - Authentication Route
- `/dashboard` - Protected: User's recent projects & templates
- `/project/:projectId`
  - `/editor` - Core Screenplay Writing Editor
  - `/character-bible` - Character Management
  - `/beat-board` - Drag-and-drop Card Board
  - `/story-bible` - Locations & Timelines
  - `/export` - Output Formats

## 5. MVP Feature List
- [x] Secure Firebase Authentication (Google/Email).
- [x] Dashboard to create, read, update, and delete screenplay projects.
- [x] Interactive Editor with simulated industry-standard formatting.
- [x] Basic Character Bible for creating profiles and relationships.
- [x] Basic Beat Board (Story Cards).
- [ ] Server-Side Gemini API Proxy proxy endpoint for "AI Assistant" (Brainstorming/Dialogue).

## 6. Development Roadmap
- **Phase 1 (MVP):** Auth, Dashboard, Basic Editor formatting, Database Setup.
- **Phase 2 (Story Tools):** Character Bible & Beat Board CRUD.
- **Phase 3 (AI Integration):** Integrate Gemini API via backend express server for script analysis and copilot features.
- **Phase 4 (Real-time & Desktop):** Switch core editor to collaborative CRDTs (like Yjs), prepare Tauri/Electron wrapper for Desktop.
- **Phase 5 (Export):** PDF generation, fountain parser.

## 7. Recommended Libraries
- `firebase` (Backend BaaS)
- `react-router-dom` (Routing)
- `zustand` (State)
- `lucide-react` (Icons)
- `@google/genai` (Server-side AI)
- `framer-motion` (Animations)
- `yjs` + `y-prosemirror` (Future: Real-time syncing)

## 8. Screen-by-Screen Breakdown
1. **Login Screen:** Clean, focused entry with "Sign in with Google".
2. **Dashboard:** Grid/List of projects. Top navbar with user profile. "New Project" FAB.
3. **App Shell (Workspace):** Sidebar on the left (Editor, Characters, Beat Board, Export).
4. **Editor:** Clean white or dark-slate canvas in the center. Auto-indentation based on text rules (e.g. ALL CAPS triggers Character/Scene Heading).
5. **Character Bible:** Master-detail view. List of characters on the left, detailed profile card with photo upload on the right.
6. **Beat Board:** Kanban-style or corkboard grid layout simulating index cards.
