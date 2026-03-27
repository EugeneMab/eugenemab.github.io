# Dating Show Notebook

A specialized tool for tracking interactions, messages, and team formations in dating reality shows.

## Features

- **Episode & Event Management**: Organize data by episode and event (e.g., Episode 1-1, 1-2).
- **Person Profiles**:
  - Add/Remove male and female participants.
  - Profile images can be added directly via clipboard (auto-cropped to 200x200).
  - Track "Range" visibility (which episodes each person appears in).
- **Interactive Connections**:
  - **Messages**: Draw strong or weak message arrows between participants.
  - **Teams**: Assign participants to up to 5 colored teams.
  - **Automatic Layout**: Team points are dynamically calculated based on the average position of members.
- **UI Customization**:
  - Zoomable body view.
  - Adjustable description text size.
- **Session Undo**: Revert accidental operations with a 50-step history stack.

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Zustand.
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

Run `stop.cmd` to gracefully shut down the backend service.

## Project Structure

- `backend/`: Express server logic.
- `frontend/`: React application.
- `data.json`: Local persistence (created automatically in the target folder).
- `start.cmd`: Windows batch script to launch the app.
- `stop.cmd`: Windows batch script to stop the app.
