# LEC Project Design Document

This document outlines the architectural design, features, styling tokens, state propagation, and platform-specific implementations of the **LEC Hierarchy Visualizer** across both Web and Mobile platforms.

---

## 1. System Overview & Core Goals

The **LEC Hierarchy Visualizer** serves as a core administrative and visual representation of the church's structural units (Branches, Churches, MCs, Buscentas, Cells, and Members). 

The system delivers two distinct visual layouts:
- **List View**: A collapsible, tree-based representation highlighting hierarchical vertical lines and clear groupings of cell personnel.
- **Map View**: A multi-lane, horizontal mind map drill-down visualization where child nodes dynamically expand into new columns.

---

## 2. Directory & Component Structure

### Web Application (`LEC-webApp`)
All components reside in `src/components/`:
- **`HierarchyTree.jsx`**: The main orchestrator. Manages view modes, search inputs, active zone selectors, and lists collapsible tree node cards.
- **`CollapsibleNode.jsx`**: Manages individual tree branch node components, animations, and child expansions.
- **`MindMapDrillDown.jsx`**: The main Map View component. Renders the horizontal mind map board, handles cascading click handlers, and maps visual styles.
- **`common/ImageModal.jsx`**: A reusable modal popup for viewing full-size high-resolution photos of leaders and members.

### Mobile Application (`LEC-mobileApp`)
All components reside in `src/components/`:
- **`HierarchyTree.js`**: The main orchestrator of the mobile dashboard. Implements custom toggle buttons, state controls, search layouts, and tree nodes.
- **`MindMapDrillDown.js`**: Implements the mobile horizontal map view. Manages absolute lanes, connection lines, custom caret layouts, and dynamic scrollable spacers.
- **`ImageModal.js`**: A modal component using `Modal` and React Native's `Image` with animated zoom capabilities for profile photo inspection.

---

## 3. Visual Layout Models & UI Elements

### 3.1 List View (Collapsible Tree Node Layout)
The tree is structured as a recursive, vertical list with custom indentation offsets per level.
- **Visual Connection Lines**:
  - A vertical line (`left: 0`, `top: 0`, `bottom: 0`, `width: 1`) traces the parent hierarchy.
  - A horizontal curve (`left: 0`, `top: 32`, `width: 12` to `24`, `height: 1`) connects the vertical line directly to the node card.
- **Left Border Color Branding**: Node cards have a `borderLeftWidth: 4` border colored according to their unit type:
  - **BRANCH**: Yellow (`#fbbf24`)
  - **CHURCH**: Purple (`#c084fc`)
  - **MC**: Blue (`#60a5fa`)
  - **BUSCENTA**: Magenta (`#f472b6`)
  - **CELL**: Coral (`#fca5a5`)
- **Personnel Division / Tiers**:
  When a node expands, its members are grouped cleanly:
  1. **Cell Shepherds**: Highlighted at the top with a luxurious yellow border (`borderWidth: 2`, `borderColor: '#fbbf24'`).
  2. **Other Leaders/Assistants**: Displayed next with an emerald border (`borderWidth: 1`, `borderColor: '#10b981'`).
  3. **General Members Grid**: Separated by a thin divider line and labeled "General Membership".

### 3.2 Map View (Mind Map Layout)
The mind map provides an interactive, columnar layout displaying lanes from left to right.
- **Active Zone Head Card**: Renders at the top center of the mind map. Displays the zone head's avatar, role, name, and visual indicator lines connecting it downward.
- **Connector Lines**: Renders horizontal and vertical lines (`h-0.5`, `w-0.5`) connecting the top MC cards in a bridge-like tree.
- **Column Lanes**: The lane body features dynamic tint overlays:
  - **Dark Tint overlay** (top `165px`) matching the theme color to frame the main leader card.
  - **Light Tint overlay** (remaining body height) to house the child cards.
- **Cascading Absolute Expansion Panels**:
  - Selecting a card renders its child lane absolutely positioned to the right (`left: 215px`, `width: 220px`).
  - This overlays the adjacent lane area.
  - An arrow caret (`position: 'absolute'`, `left: -6`, `top: 22`, `width: 12`, `height: 12`, rotated at `45deg`) points directly back at the parent card.
- **Dynamic Scroll Spacer**:
  - Because absolutely positioned overlays do not impact the horizontal container size in layout engines, a physical spacer is added at the end of the scrollable row.
  - Its width adjusts dynamically as follows:
    $$\text{Spacer Width} = (\text{Active Selection Level}) \times 230\text{px}$$
  - This allows horizontal scrolling to all active panels.

---

## 4. Theme Design Tokens (`MC_THEMES`)

Themes use custom RGBA color styling in mobile and Tailwind classes in the web app:

```javascript
const MC_THEMES = [
  {
    // 1 — Violet (Agape MC)
    namePlateBg: 'rgba(92, 61, 181, 0.9)',
    darkTint: 'rgba(46, 16, 101, 0.5)',
    lightTint: 'rgba(46, 16, 101, 0.15)',
    textColor: '#a78bfa',
    accentText: '#c084fc',
    buscentaBg: 'rgba(46, 16, 101, 0.3)',
    buscentaBorder: 'rgba(139, 92, 246, 0.2)',
    buscentaActiveBg: 'rgba(92, 61, 181, 0.6)',
    buscentaActiveBorder: 'rgba(139, 92, 246, 0.6)',
    cellBg: 'rgba(46, 16, 101, 0.2)',
    cellBorder: 'rgba(139, 92, 246, 0.15)',
    cellActiveBg: 'rgba(92, 61, 181, 0.5)',
    cellActiveBorder: 'rgba(139, 92, 246, 0.55)',
    shepherdBg: 'rgba(46, 16, 101, 0.45)',
    shepherdBorder: 'rgba(139, 92, 246, 0.25)',
    shepherdText: '#ddd6fe',
    memberBg: 'rgba(46, 16, 101, 0.2)',
    memberBorder: 'rgba(139, 92, 246, 0.15)',
    memberText: '#e2e8f0',
    activeGlow: {
      shadowColor: '#8B00FF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    }
  },
  {
    // 2 — Rose (Dunamis MC)
    namePlateBg: 'rgba(159, 18, 57, 0.9)',
    darkTint: 'rgba(76, 5, 25, 0.5)',
    lightTint: 'rgba(76, 5, 25, 0.15)',
    textColor: '#fb7185',
    accentText: '#fda4af',
    buscentaBg: 'rgba(76, 5, 25, 0.3)',
    buscentaBorder: 'rgba(244, 63, 94, 0.2)',
    buscentaActiveBg: 'rgba(159, 18, 57, 0.6)',
    buscentaActiveBorder: 'rgba(244, 63, 94, 0.6)',
    cellBg: 'rgba(76, 5, 25, 0.2)',
    cellBorder: 'rgba(244, 63, 94, 0.15)',
    cellActiveBg: 'rgba(159, 18, 57, 0.5)',
    cellActiveBorder: 'rgba(244, 63, 94, 0.55)',
    shepherdBg: 'rgba(76, 5, 25, 0.45)',
    shepherdBorder: 'rgba(244, 63, 94, 0.25)',
    shepherdText: '#ffe4e6',
    memberBg: 'rgba(76, 5, 25, 0.2)',
    memberBorder: 'rgba(244, 63, 94, 0.15)',
    memberText: '#e2e8f0',
    activeGlow: {
      shadowColor: '#f43f5e',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    }
  },
  {
    // 3 — Black (Media SM)
    namePlateBg: 'rgba(24, 24, 27, 0.95)',
    darkTint: 'rgba(9, 9, 11, 0.6)',
    lightTint: 'rgba(9, 9, 11, 0.15)',
    textColor: '#a1a1aa',
    accentText: '#d4d4d8',
    buscentaBg: 'rgba(39, 39, 42, 0.3)',
    buscentaBorder: 'rgba(82, 82, 91, 0.2)',
    buscentaActiveBg: 'rgba(39, 39, 42, 0.6)',
    buscentaActiveBorder: 'rgba(113, 113, 122, 0.6)',
    cellBg: 'rgba(39, 39, 42, 0.2)',
    cellBorder: 'rgba(82, 82, 91, 0.15)',
    cellActiveBg: 'rgba(39, 39, 42, 0.5)',
    cellActiveBorder: 'rgba(113, 113, 122, 0.55)',
    shepherdBg: 'rgba(39, 39, 42, 0.45)',
    shepherdBorder: 'rgba(82, 82, 91, 0.25)',
    shepherdText: '#f4f4f5',
    memberBg: 'rgba(39, 39, 42, 0.2)',
    memberBorder: 'rgba(82, 82, 91, 0.15)',
    memberText: '#d4d4d8',
    activeGlow: {
      shadowColor: '#ffffff',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    }
  },
  {
    // 4 — Blue (New Testament MC)
    namePlateBg: 'rgba(30, 58, 138, 0.9)',
    darkTint: 'rgba(23, 37, 84, 0.5)',
    lightTint: 'rgba(23, 37, 84, 0.15)',
    textColor: '#60a5fa',
    accentText: '#93c5fd',
    buscentaBg: 'rgba(23, 37, 84, 0.3)',
    buscentaBorder: 'rgba(59, 130, 246, 0.2)',
    buscentaActiveBg: 'rgba(30, 58, 138, 0.6)',
    buscentaActiveBorder: 'rgba(59, 130, 246, 0.6)',
    cellBg: 'rgba(23, 37, 84, 0.2)',
    cellBorder: 'rgba(59, 130, 246, 0.15)',
    cellActiveBg: 'rgba(30, 58, 138, 0.5)',
    cellActiveBorder: 'rgba(59, 130, 246, 0.55)',
    shepherdBg: 'rgba(23, 37, 84, 0.45)',
    shepherdBorder: 'rgba(59, 130, 246, 0.25)',
    shepherdText: '#dbeafe',
    memberBg: 'rgba(23, 37, 84, 0.2)',
    memberBorder: 'rgba(59, 130, 246, 0.15)',
    memberText: '#e2e8f0',
    activeGlow: {
      shadowColor: '#3b82f6',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    }
  },
  {
    // 5 — Amber/Brown (Soul Winners' MC)
    namePlateBg: 'rgba(120, 53, 4, 0.9)',
    darkTint: 'rgba(69, 26, 3, 0.45)',
    lightTint: 'rgba(69, 26, 3, 0.1)',
    textColor: '#f59e0b',
    accentText: '#fbbf24',
    buscentaBg: 'rgba(69, 26, 3, 0.25)',
    buscentaBorder: 'rgba(245, 158, 11, 0.2)',
    buscentaActiveBg: 'rgba(120, 53, 4, 0.5)',
    buscentaActiveBorder: 'rgba(245, 158, 11, 0.5)',
    cellBg: 'rgba(69, 26, 3, 0.15)',
    cellBorder: 'rgba(245, 158, 11, 0.15)',
    cellActiveBg: 'rgba(120, 53, 4, 0.4)',
    cellActiveBorder: 'rgba(245, 158, 11, 0.45)',
    shepherdBg: 'rgba(69, 26, 3, 0.35)',
    shepherdBorder: 'rgba(245, 158, 11, 0.2)',
    shepherdText: '#fef3c7',
    memberBg: 'rgba(69, 26, 3, 0.15)',
    memberBorder: 'rgba(245, 158, 11, 0.15)',
    memberText: '#e2e8f0',
    activeGlow: {
      shadowColor: '#f59e0b',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    }
  },
  {
    // 6 — Emerald (Fallback)
    namePlateBg: 'rgba(6, 95, 70, 0.9)',
    darkTint: 'rgba(4, 120, 87, 0.5)',
    lightTint: 'rgba(4, 120, 87, 0.15)',
    textColor: '#34d399',
    accentText: '#6ee7b7',
    buscentaBg: 'rgba(4, 120, 87, 0.3)',
    buscentaBorder: 'rgba(16, 185, 129, 0.2)',
    buscentaActiveBg: 'rgba(6, 95, 70, 0.6)',
    buscentaActiveBorder: 'rgba(16, 185, 129, 0.6)',
    cellBg: 'rgba(4, 120, 87, 0.2)',
    cellBorder: 'rgba(16, 185, 129, 0.15)',
    cellActiveBg: 'rgba(6, 95, 70, 0.5)',
    cellActiveBorder: 'rgba(16, 185, 129, 0.55)',
    shepherdBg: 'rgba(4, 120, 87, 0.45)',
    shepherdBorder: 'rgba(16, 185, 129, 0.25)',
    shepherdText: '#d1fae5',
    memberBg: 'rgba(4, 120, 87, 0.2)',
    memberBorder: 'rgba(16, 185, 129, 0.15)',
    memberText: '#e2e8f0',
    activeGlow: {
      shadowColor: '#10b981',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    }
  }
];
```

---

## 5. State Management & Filtering Logic

### 5.1 Drill-Down Selections
Selecting a node updates state variables representing active nodes at each hierarchy depth level:
- **`selectedL2Id`**: Active level 2 (typically Buscenta nodes).
- **`selectedL3Id`**: Active level 3 (typically Cell nodes).
- **`selectedL4Id`**: Active level 4 (additional subdivisions).
- **`selectedL5Id`**: Active level 5.

Selecting a node at an upper level automatically clears selection states downstream. For example:
- Changing `selectedL2Id` sets `selectedL3Id`, `selectedL4Id`, and `selectedL5Id` to `null`.
- Switching zones (the root level tabs) clears all selection states.

### 5.2 Search & Tree Filtering
When a user enters a search term:
1. Matches are searched against unit names and leader names.
2. Nodes that match are expanded automatically.
3. Parents of matching nodes are forced open to display search results.
4. Non-matching branches are collapsed or hidden, keeping the list display clean.

---

## 6. Animations & Performance Optimizations

### 6.1 Web Framer Motion Configuration
Lanes and overlays use Framer Motion variants:
```javascript
initial={{ opacity: 0, x: -12 }}
animate={{ opacity: 1, x: 0 }}
exit={{ opacity: 0, x: -8 }}
transition={{ duration: 0.22, ease: "easeOut" }}
```
An `AnimatePresence` wrapper ensures items animate smoothly as they enter or exit.

### 6.2 Mobile LayoutAnimation Config
In React Native, layout size changes (e.g., expanding and collapsing collapsible cards in List View) are animated using the native thread:
```javascript
LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
```
On Android, this requires experimental layout animation support enabled in the native shell:
```javascript
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
```

### 6.3 Card Selection Animation
Active cards dynamically adjust styling configurations:
- **Scale Lift**: Selected card applies a `transform: [{ scale: 1.01 }]` style.
- **Thicker Border**: Changes `borderWidth` from `1` to `1.5`.
- **Rotated Blue Chevron**: Chevron rotates 90 degrees and switches color to `#3385ff`.
- **Shadow Glow**: Applies standard shadow properties (`shadowRadius: 8`, `shadowOpacity: 0.3`) for elevation and color.
