# Dating Show Notebook (Standalone)

A pure HTML/JS/CSS version of the Dating Show Notebook.

## Features
- No build step required.
- No backend dependency.
- Data stored in `localStorage`.
- Import/Export data via JSON text area.
- Download data as JSON file.

## How to Run
1. Run `start.cmd` to start the local static server on port 23762.
2. Open `http://localhost:23762` in your browser.
3. Use `kill.cmd` to stop the server.

## Architecture
- **React**: UI library (via CDN).
- **HTM**: JSX-like syntax in pure JS (via CDN).
- **Tailwind CSS**: Styling (via CDN).
- **Lucide React**: Icons (via CDN).
- **Node.js**: Minimal static server for local development.
