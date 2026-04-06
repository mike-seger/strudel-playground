import { songs as songEntries } from './strudels/index.js';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';

const songList = document.getElementById('song-list');
const playBtn = document.getElementById('play-btn');
const applyBtn = document.getElementById('apply-btn');
const playIcon = document.getElementById('play-icon');
const statusEl = document.getElementById('status');

let playing = false;
let activeLi = null;
let songs = []; // populated after fetching
let currentSongIndex = -1;

const SONG_KEY = 'strudel-current-song';
const resetRequested = new URLSearchParams(window.location.search).has('reset');
if (resetRequested) {
  localStorage.removeItem(SONG_KEY);
  // Clean the URL so subsequent reloads don't keep resetting
  const url = new URL(window.location);
  url.searchParams.delete('reset');
  window.history.replaceState({}, '', url);
}

// ── Manage strudel-editor lifecycle ──
const patternDisplay = document.getElementById('pattern-display');

// Hydra (and similar) append a full-screen canvas to <body>.
// Catch those and move them into #pattern-display.
const bodyObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeName === 'CANVAS' && node.parentElement === document.body) {
        node.style.cssText = 'width:100%!important;height:100%!important;position:absolute!important;top:0!important;left:0!important;z-index:0!important;';
        patternDisplay.prepend(node);
      }
    }
  }
});
bodyObserver.observe(document.body, { childList: true });

function destroyRepl() {
  const old = document.getElementById('repl');
  if (old) {
    try { old.editor?.stop(); } catch {}
  }
  patternDisplay.innerHTML = '';
}

function createRepl(code) {
  destroyRepl();
  // Use innerHTML with HTML comment syntax — this is how strudel-editor reads code
  const escaped = code.replace(/-->/g, '-- >');
  patternDisplay.innerHTML = `<strudel-editor id="repl"><!--\n${escaped}\n--></strudel-editor>`;
  const el = document.getElementById('repl');
  // Also call setCode once the editor instance is ready
  const trySetCode = () => {
    if (el.editor) {
      el.editor.setCode(code);
    } else {
      setTimeout(trySetCode, 150);
    }
  };
  setTimeout(trySetCode, 100);
  return el;
}

// ── Derive a display name from file content or filename ──
function deriveName(code, path) {
  // Try @title tag anywhere in the first 10 lines
  const lines = code.split('\n');
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const titleMatch = lines[i].match(/@title\s+(.+)/);
    if (titleMatch) return titleMatch[1].trim();
  }
  // Try first line: // "Song Name" or // Song Name
  const firstLine = lines[0];
  const quoted = firstLine.match(/^\/\/\s*"(.+?)"/);
  if (quoted) return quoted[1];
  const plain = firstLine.match(/^\/\/\s*(.+)/);
  if (plain) return plain[1].trim();
  // Fallback: filename without extension
  return path.replace(/^.*\//, '').replace(/\.js$/, '');
}

// ── Load all songs ──
async function loadSongs() {
  const results = await Promise.all(
    songEntries.map(async (entry) => {
      const url = 'strudels/' + entry.path.replace(/^\.\//, '');
      const resp = await fetch(url);
      let code = await resp.text();
      // Strip sourceMappingURL lines added by Vite/bundlers
      code = code.replace(/\n?\/\/# sourceMappingURL=.*$/gm, '').trimEnd();
      const name = deriveName(code, entry.path);
      return { ...entry, code, name };
    })
  );
  songs = results;
  initUI();
}

// ── CodeMirror 6 editor ──
const editorParent = document.getElementById('editor');

const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '15px' },
  '.cm-scroller': { overflow: 'auto', lineHeight: '1.6' },
  '.cm-content': { padding: '12px 0' },
  '.cm-gutters': { background: '#181825', border: 'none' },
});

let view = new EditorView({
  state: EditorState.create({
    doc: '',
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      bracketMatching(),
      closeBrackets(),
      javascript(),
      oneDark,
      editorTheme,
      EditorView.lineWrapping,
      syntaxHighlighting(defaultHighlightStyle),
      keymap.of([...defaultKeymap, indentWithTab]),
    ],
  }),
  parent: editorParent,
});

function setEditorCode(code) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: code },
  });
}

function getEditorCode() {
  return view.state.doc.toString();
}

// ── Populate sidebar ──
let sortedSongs = [];

function initUI() {
  sortedSongs = songs
    .map((song, i) => ({ ...song, originalIndex: i }))
    .sort((a, b) => a.name.localeCompare(b.name));

  renderSongList('');

  // Restore last song, or default to first
  const savedIndex = localStorage.getItem(SONG_KEY);
  let targetIndex = 0;
  if (savedIndex !== null) {
    const idx = parseInt(savedIndex);
    if (idx >= 0 && idx < songs.length) targetIndex = idx;
  }
  // Find the <li> matching the target original index
  const targetLi = Array.from(songList.querySelectorAll('li'))
    .find(li => parseInt(li.dataset.index) === targetIndex);
  if (targetLi) {
    targetLi.scrollIntoView({ block: 'center' });
    selectSong(targetIndex, targetLi);
  }
}

function renderSongList(filter) {
  songList.innerHTML = '';
  let re;
  try {
    re = filter ? new RegExp(filter, 'i') : null;
  } catch {
    re = null;
  }
  sortedSongs.forEach((song) => {
    if (re && !re.test(song.name)) return;
    const li = document.createElement('li');
    li.textContent = song.name;
    li.dataset.index = song.originalIndex;
    li.addEventListener('click', () => selectSong(song.originalIndex, li));
    if (activeLi && activeLi.dataset.index === li.dataset.index) {
      li.classList.add('active');
      activeLi = li;
    }
    songList.appendChild(li);
  });
}

const songFilter = document.getElementById('song-filter');
songFilter.addEventListener('input', () => renderSongList(songFilter.value));

// ── Keyboard navigation in sidebar ──
const sidebar = document.getElementById('sidebar');
let navDebounce = null;

function handleSidebarNav(e) {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  // Only handle when sidebar or its children are focused
  if (!sidebar.contains(document.activeElement) && document.activeElement !== sidebar) return;
  e.preventDefault();
  e.stopPropagation();
  if (navDebounce) return;
  navDebounce = setTimeout(() => { navDebounce = null; }, 150);
  const items = Array.from(songList.querySelectorAll('li'));
  if (items.length === 0) return;
  const activeIdx = items.findIndex((li) => li.classList.contains('active'));
  let nextIdx;
  if (e.key === 'ArrowDown') {
    nextIdx = activeIdx < items.length - 1 ? activeIdx + 1 : 0;
  } else {
    nextIdx = activeIdx > 0 ? activeIdx - 1 : items.length - 1;
  }
  const nextLi = items[nextIdx];
  nextLi.scrollIntoView({ block: 'center', behavior: 'smooth' });
  selectSong(parseInt(nextLi.dataset.index), nextLi);
}

document.addEventListener('keydown', handleSidebarNav, true);

renderSongList('');

function selectSong(index, li) {
  // Skip if already on this song
  if (currentSongIndex === index) return;
  const wasPlaying = playing;
  // Full stop: destroy the old repl on song switch
  if (playing || paused) {
    const el = document.getElementById('repl');
    if (el?.editor) try { el.editor.stop(); } catch {}
  }
  resetProgressLoop();
  playing = false;
  paused = false;
  playBtn.classList.remove('playing');
  playIcon.innerHTML = '&#9654;';
  statusEl.textContent = 'Stopped';

  if (activeLi) activeLi.classList.remove('active');
  li.classList.add('active');
  activeLi = li;
  currentSongIndex = index;
  localStorage.setItem(SONG_KEY, index);
  setEditorCode(songs[index].code);
  // Fresh repl for the new song
  createRepl(songs[index].code);
  if (wasPlaying) {
    setTimeout(() => play(), 200);
  }
}

// ── Apply: push editor code into the strudel repl ──
function applyCode() {
  const code = getEditorCode();
  const el = document.getElementById('repl');
  const editor = el?.editor;
  if (editor && playing) {
    // Hot-swap code without destroying the repl
    editor.setCode(code);
    editor.evaluate();
  } else {
    // Not playing — recreate repl with new code
    createRepl(code);
  }
}

// ── Progress / elapsed time ──
const progressSlider = document.getElementById('progress');
const elapsedEl = document.getElementById('elapsed');
let progressRAF = null;
let playStartTime = 0;
let pausedElapsed = 0;
let isSeeking = false;

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m + ':' + String(sec).padStart(2, '0');
}

// Seeking: when user drags or clicks, adjust the elapsed timer
progressSlider.addEventListener('input', () => {
  isSeeking = true;
});

progressSlider.addEventListener('change', () => {
  const maxMs = 10 * 60 * 1000;
  const seekMs = (parseInt(progressSlider.value) / 1000) * maxMs;
  playStartTime = Date.now() - seekMs;
  pausedElapsed = seekMs;
  isSeeking = false;
});

function startProgressLoop(resume) {
  if (resume) {
    playStartTime = Date.now() - pausedElapsed;
  } else {
    playStartTime = Date.now();
    pausedElapsed = 0;
    progressSlider.value = 0;
  }
  const maxMs = 10 * 60 * 1000;
  const tick = () => {
    if (!playing) return;
    if (!isSeeking) {
      const elapsed = Date.now() - playStartTime;
      elapsedEl.textContent = formatTime(elapsed);
      progressSlider.value = Math.min(1000, Math.floor((elapsed / maxMs) * 1000));
    }
    progressRAF = requestAnimationFrame(tick);
  };
  progressRAF = requestAnimationFrame(tick);
}

function pauseProgressLoop() {
  pausedElapsed = Date.now() - playStartTime;
  if (progressRAF) cancelAnimationFrame(progressRAF);
  progressRAF = null;
}

function resetProgressLoop() {
  if (progressRAF) cancelAnimationFrame(progressRAF);
  progressRAF = null;
  pausedElapsed = 0;
  progressSlider.value = 0;
  elapsedEl.textContent = '0:00';
}

// ── Playback controls ──
let paused = false;

function play() {
  const replEl = document.getElementById('repl');
  if (!replEl) createRepl(getEditorCode());

  const resume = paused;
  const tryEval = () => {
    const el = document.getElementById('repl');
    const editor = el?.editor;
    if (editor) {
      editor.evaluate();
    } else {
      setTimeout(tryEval, 200);
    }
  };
  setTimeout(tryEval, 100);
  playing = true;
  paused = false;
  playBtn.classList.add('playing');
  playIcon.innerHTML = '&#9646;&#9646;';
  statusEl.textContent = resume ? 'Resumed' : 'Playing';
  startProgressLoop(resume);
}

function stop() {
  const el = document.getElementById('repl');
  const editor = el?.editor;
  if (editor) {
    try { editor.stop(); } catch {}
  }
  pauseProgressLoop();
  playing = false;
  paused = true;
  playBtn.classList.remove('playing');
  playIcon.innerHTML = '&#9654;';
  statusEl.textContent = 'Paused';
}

playBtn.addEventListener('click', () => {
  if (playing) stop(); else play();
});

applyBtn.addEventListener('click', applyCode);

// ── About button ──
document.getElementById('about-btn').addEventListener('click', () => {
  window.open('doc/', '_blank');
});

// ── Start ──
loadSongs();
