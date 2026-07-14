# LEC Web Application

The web client for the LEC Hierarchy Visualizer dashboard. Built using React, Vite, Tailwind CSS, Framer Motion, and Lucide icons.

---

## 1. Features

- **Dynamic Interactive Mind Map (Map View)**: Cascading, horizontally expanding lanes detailing Branches, Churches, MCs, Buscentas, and Cells, with absolute overlays and arrow pointers.
- **Hierarchical List Explorer (List View)**: Indented collapsible folder-tree layout showing leaders, cell shepherds, and members with distinct visual boundaries.
- **Search Filtering**: Realtime query filtering across units and leaders, expanding branches automatically on matches.
- **Image Inspection Modal**: Photo modal with overlay rendering.
- **Data Integrity Tools**: Built-in scripts to validate tree connections and leader allocations.

---

## 2. Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### Installation
1. Navigate to the webapp directory:
   ```bash
   cd LEC-webApp
   ```
2. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   *Add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` credentials.*
3. Install dependencies:
   ```bash
   npm install
   ```

### Development Server
Start the local Vite development server with Hot Module Replacement (HMR):
```bash
npm run dev
```

### Build & Production Production
Compile the production assets:
```bash
npm run build
```
Verify the build output locally:
```bash
npm run preview
```

---

## 3. Data Integrity & Verification Scripts

The project includes custom ES modules to inspect database hierarchy relationships:
- **`inspect_integrity.mjs`**: General database validation check.
- **`check_units_parents.mjs`**: Validates parent-child linkages in unit nodes.
- **`inspect_leaders.mjs`**: Identifies unallocated or overlapping leader assignments.
- **`inspect_tree.mjs`**: Visualizes the calculated JSON tree representation in the terminal.

Run any script via Node:
```bash
node inspect_integrity.mjs
```
