# Cuboid 3D

## Name
- Cuboid 3D

## Introduction
Cuboid 3D is a standalone browser-based editor for building simple 3D scenes from cuboids. It combines a scene tree, editing tools, camera controls, undo history, and export/import features inside a single HTML file.

## How to Use
### Linux
1. Open `git_root_folder/Code/2026/20260330_Cuboid/Cuboid.html` in a modern browser.
2. Use the toolbar to add cuboids, group objects, split or copy selections, and save or load scenes.
3. Use the scene tree on the left to select and organize objects.
4. Use the canvas to inspect the scene and interact with the camera.
5. Export the result as JSON, OBJ, PNG, or JPG when needed.

### Windows
1. Open `GitRootFolder\Code\2026\20260330_Cuboid\Cuboid.html` in a modern browser.
2. Use the toolbar to add cuboids, group objects, split or copy selections, and save or load scenes.
3. Use the scene tree on the left to select and organize objects.
4. Use the canvas to inspect the scene and interact with the camera.
5. Export the result as JSON, OBJ, PNG, or JPG when needed.

## Architecture
- `Cuboid.html`: self-contained application with the HTML layout, CSS styling, and JavaScript logic.
- Scene state: keeps the scene graph, selection state, camera state, and undo snapshots in memory.
- Persistence layer: stores recovery data in `localStorage` and supports JSON import/export.
- Rendering layer: uses WebGL on the main canvas to draw cuboids, outlines, and view updates.
- `Cuboid.md`: captures the original implementation plan and feature goals for the app.
