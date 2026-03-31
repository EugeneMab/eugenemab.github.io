# Implementation Plan - Cuiboid 3D Application

## Objective
Develop "Cuiboid", a single-file (HTML/JS/CSS) 3D application for rendering and editing cuboid-based scenes using WebGL. Features include grouping, camera controls, object manipulation (copy/split/add), and file persistence.

## Architecture & Tech Stack
- **Single File**: All code (CSS, HTML, JS) will reside in `index.html`.
- **WebGL 2.0/1.0**: Direct WebGL API for rendering.
- **Matrix Math**: Custom minimal matrix library for Model-View-Projection (MVP) transformations (Y-up coordinate system).
- **UI**: Vanilla JS DOM manipulation for the Object Tree and Toolbar.
- **State Management**: A reactive-style state object with an **Undo History (last 100 steps)**.
- **Persistence**: `localStorage` for session recovery with a "saved" flag; JSON for file export/import.

## Data Model
### Scene Graph
- **Group**: `{ id: string, name: string, type: 'group', children: Array<Group|Cuboid>, parentId: string|null }`
- **Cuboid**: `{ id: string, type: 'cuboid', x, y, z, w, h, d, color: '#rrggbb' }`
- **Root**: A unique, non-deletable root group.

### Camera State
- **Position**: `x, y, z`
- **Rotation**: `span` (yaw), `tilt` (pitch), `roll`
- **Projection**: `zoom` (distance adjustment)

## Implementation Phases

### Phase 1: Foundation & Layout
- HTML structure: `sidebar-left` (tree), `main-view` (canvas), `toolbar-top` (controls/info).
- CSS: Dark theme CAD-style UI.

### Phase 2: WebGL Engine
- Shaders:
  - Object shader: Flat colors with basic shading.
  - Wireframe shader: For selection outlines and Axis.
- Buffer Management: 12 triangles per cuboid with a **0.1 margin** shrink.
- Axis rendering (toggleable).

### Phase 3: Camera System
- Y-up coordinate system.
- 4x2 Camera Presets: Front, Left, Right, Back (Level and 45° overhead).
- Interaction Modes: Move, Depth, Rotation, Zoom, Roll.

### Phase 4: Scene Graph & UI Sync
- Tree view with multi-selection and drag-and-drop grouping.
- Unique name generation for groups.

### Phase 5: Editing Tools
- **Add Cuboid**: X, Y, Z, W, H, D, color inputs.
- **Color Picker**: HSL to Hex.
- **Copy**: Linear duplication (X/Y/Z) with gap and count.
- **Split**: Slices a cuboid into two new ones, replacing the original.
- **Delete**: Remove selection.
- **Undo**: 100-step stack in memory.

### Phase 6: Selection & Info
- Wireframe outline for selected objects.
- Info bar updates with properties of the single selected cuboid.

### Phase 7: Persistence & Export
- **Session Recovery**: Load from `localStorage` on start. If the "saved" flag is false, prompt the user to save.
- **JSON Export/Import**: Nested structure preserving the scene graph (root -> subgroup -> object).
- **OBJ Export**: `v x y z r g b` format.

## Verification & Testing
- Test undo/redo consistency.
- Verify "margin 0.1" prevents Z-fighting.
- Confirm Y-up orientation.
- Validate JSON import/export accuracy.
