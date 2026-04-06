## Usage

### Getting started

Serve the repository from its root directory with any static file server:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080` in a browser.

Alternatively, if you have Node.js installed you can use the Vite dev server for auto-reloading:

```
npm install
npm run dev
```

### Interface overview

The interface is split into two areas:

- **Sidebar** (left) — song list with regex filter
- **Editor** (right) — CodeMirror code editor with bottom toolbar

### Selecting a song

Click any song name in the sidebar to load it into the editor. Use [[Arrow Up]] and [[Arrow Down]] to navigate with the keyboard. Type in the filter box to narrow the list with a regular expression.

### Editing and applying

Edit the Strudel code in the editor and click **Apply** (or press the button) to push changes into the running pattern. The editor preserves your edits while you switch between songs.

### Play / Pause

Click the **play** button to start the pattern. Click again to stop. When you switch songs while playing, the new song starts automatically.

### Remembering your song

The playground saves the currently selected song in `localStorage`. When you reload the page, it picks up where you left off. Add `?reset=true` to the URL to clear the saved selection.
