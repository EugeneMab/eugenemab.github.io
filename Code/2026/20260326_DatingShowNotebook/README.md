# Dating Show Notebook

A specialized tool for tracking interactions, messages, and team formations in dating reality shows.

## Features

- **Episode & Event Management**: Organize data by episode and event (e.g., Episode 1-1, 1-2).
- **Person Profiles**:
  - Add/Remove male and female participants.
  - Profile images can be added directly via clipboard (auto-cropped to 200x200).
  - Track "Range" visibility (which episodes each person appears in).
- **SVG-Centric Architecture**:
  - **Single SVG Layout**: Both the main event view and the participant management view are rendered within a single, high-performance SVG.
  - **Manual Scaling**: All UI elements (images, text, inputs, buttons) are manually scaled and positioned based on `bodyScale` and `descriptionScale`, avoiding traditional CSS transforms for cleaner rendering and scrolling.
  - **Integrated Interaction**: HTML elements (inputs, textareas, buttons) are seamlessly embedded into the SVG using XHTML-compliant `foreignObject` tags.
- **Interactive Connections**:
  - **Messages**: Draw strong (bold) or weak (thin) message arrows between participants. Supports same-gender and cross-gender connections.
  - **Teams**: Assign participants to up to 5 distinct colored teams with dynamically calculated center points and connection lines.
- **UI Customization**:
  - Precision zoomable body view.
  - Adjustable description text size.
- **Session Undo**: Revert accidental operations with a 50-step history stack.

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Zustand, SVG + `foreignObject`.
- **Backend**: Node.js, Express, TypeScript (executed via `tsx`).
- **Storage**: Local `data.json` on disk.

## Ports

- **Frontend**: `3762`
- **Backend**: `13762`

## Getting Started

### Prerequisites

- Node.js (v18+)

### Launching

1. Open a terminal in the project directory.
2. Run `start.cmd` (optionally provide a folder path: `start.cmd "C:\path\to\data"`).
3. The UI will be available at [http://localhost:3762/](http://localhost:3762/).

### Stopping

Run `kill.cmd` (previously `stop.cmd`) to gracefully shut down the backend service.

## Implementation Details

The application uses a unique "SVG-first" rendering strategy:

1. **Coordinate System**: The entire layout is mapped to a logical coordinate system.
2. **Dynamic Rendering**: React calculates the final SVG `viewBox`, `width`, and `height` based on the current zoom level and content size.
3. **HTML Integration**: To maintain full interactivity (text selection, input focusing, image pasting), HTML components are wrapped in `foreignObject` with the `http://www.w3.org/1999/xhtml` namespace.
4. **Scrolling**: The SVG is placed inside a standard `overflow: auto` container, providing a native scrolling experience even when zoomed in.

## Project Structure

- `backend/`: Express server logic.
- `frontend/`: React application.
- `data.json`: Local persistence (created automatically in the target folder).
- `start.cmd`: Windows batch script to launch the app.
- `kill.cmd`: Windows batch script to stop the app.
