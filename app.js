import { songs as songEntries } from './strudels/index.js';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';

// ── Capture the AudioContext created by Strudel ──
let strudelAudioCtx = null;
const OrigAudioContext = window.AudioContext;
window.AudioContext = function(...args) {
  const ctx = new OrigAudioContext(...args);
  strudelAudioCtx = ctx;
  return ctx;
};
window.AudioContext.prototype = OrigAudioContext.prototype;

// ── Patch fetch to fix broken JSON (trailing/missing commas) ──
const _fetch = window.fetch;
window.fetch = async function (...args) {
  const resp = await _fetch.apply(this, args);
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
  if (url.endsWith('.json') || /\.json\?/.test(url)) {
    const clone = resp.clone();
    resp.json = async () => {
      let text = await clone.text();
      try {
        return JSON.parse(text);
      } catch {
        // Step 1: strip trailing commas before ] or }
        text = text.replace(/,(\s*[\]}])/g, '$1');
        // Step 2: iteratively insert missing commas
        for (let i = 0; i < 50; i++) {
          try {
            return JSON.parse(text);
          } catch (e) {
            const m = e.message.match(/position (\d+)/);
            if (!m) throw e;
            const p = parseInt(m[1]);
            let j = p - 1;
            while (j >= 0 && /\s/.test(text[j])) j--;
            const last = text[j], next = text[p];
            if ((last === ']' || last === '"') && (next === '"' || next === '[')) {
              text = text.substring(0, j + 1) + ',' + text.substring(j + 1);
            } else {
              throw e;
            }
          }
        }
      }
    };
  }
  return resp;
};

const songList = document.getElementById('song-list');
const playBtn = document.getElementById('play-btn');
const applyBtn = document.getElementById('apply-btn');
const resetBtn = document.getElementById('reset-btn');
const playIcon = document.getElementById('play-icon');
const statusEl = document.getElementById('status');

let playing = false;
let paused = false;
let pausedElapsed = 0;
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
    const editor = old.editor;
    if (editor) {
      try {
        const scheduler = editor.repl?.scheduler;
        if (scheduler) {
          scheduler.stop?.();
          scheduler.setStarted?.(false);
        }
      } catch {}
      try { editor.stop(); } catch {}
    }
  }
  // Kill residual audio (e.g. white-noise buffers left running)
  if (strudelAudioCtx && strudelAudioCtx.state === 'running') {
    strudelAudioCtx.suspend();
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
  // Try first line: // "Song Name" or // Song Name (skip if it contains a URL)
  const firstLine = lines[0];
  if (!/https?:\/\//.test(firstLine)) {
    const quoted = firstLine.match(/^\/\/\s*"(.+?)"/);
    if (quoted) return quoted[1];
    const plain = firstLine.match(/^\/\/\s*(.+)/);
    if (plain) return plain[1].trim();
  }
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

// Track collapsed state per folder across re-renders
const collapsedFolders = new Set(); // Start empty; folders default to collapsed unless explicitly expanded
const expandedFolders = new Set();

function renderSongList(filter) {
  songList.innerHTML = '';
  let re;
  try {
    re = filter ? new RegExp(filter, 'i') : null;
  } catch {
    re = null;
  }

  // Derive folder from path: "./foo/bar.js" → "foo", "./baz.js" → ""
  function folderOf(song) {
    const p = song.path.replace(/^\.\//, '');
    const slash = p.lastIndexOf('/');
    return slash === -1 ? '' : p.substring(0, slash);
  }

  // Group songs by folder, preserving alphabetical sort within each group
  const groups = new Map(); // folder → songs[]
  sortedSongs.forEach((song) => {
    if (re && !re.test(song.name)) return;
    const folder = folderOf(song);
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push(song);
  });

  // Sort folder keys: root ("") first, then alphabetical
  const folders = [...groups.keys()].sort((a, b) => {
    if (a === '') return -1;
    if (b === '') return 1;
    return a.localeCompare(b);
  });

  for (const folder of folders) {
    const isFolder = folder !== '';
    // Default collapsed unless explicitly expanded
    const collapsed = isFolder && !expandedFolders.has(folder);

    if (isFolder) {
      const header = document.createElement('li');
      header.className = 'folder-header';
      if (collapsed) header.classList.add('collapsed');
      header.innerHTML = `<span class="folder-arrow">${collapsed ? '▸' : '▾'}</span> ${folder}`;
      header.addEventListener('click', () => {
        if (expandedFolders.has(folder)) {
          expandedFolders.delete(folder);
        } else {
          expandedFolders.add(folder);
        }
        renderSongList(songFilter.value);
      });
      songList.appendChild(header);
    }

    if (isFolder && collapsed) continue;

    for (const song of groups.get(folder)) {
      const li = document.createElement('li');
      li.textContent = song.name;
      li.dataset.index = song.originalIndex;
      if (isFolder) li.classList.add('in-folder');
      li.addEventListener('click', () => selectSong(song.originalIndex, li));
      if (activeLi && activeLi.dataset.index === li.dataset.index) {
        li.classList.add('active');
        activeLi = li;
      }
      songList.appendChild(li);
    }
  }
}

const songFilter = document.getElementById('song-filter');
songFilter.addEventListener('input', () => renderSongList(songFilter.value));

// ── Keyboard navigation in sidebar ──
const sidebar = document.getElementById('sidebar');
let navDebounce = null;

function handleSidebarNav(e) {
  // Left/Right arrow: seek ±10s when playing and sidebar is focused
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && playing) {
    if (!sidebar.contains(document.activeElement) && document.activeElement !== sidebar) return;
    e.preventDefault();
    e.stopPropagation();
    const deltaMs = e.key === 'ArrowRight' ? 10000 : -10000;
    seekToCycleFromMs(Math.max(0, (Date.now() - playStartTime) + deltaMs));
    playStartTime -= deltaMs;
    return;
  }
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  // Only handle when sidebar or its children are focused
  if (!sidebar.contains(document.activeElement) && document.activeElement !== sidebar) return;
  e.preventDefault();
  e.stopPropagation();
  if (navDebounce) return;
  navDebounce = setTimeout(() => { navDebounce = null; }, 150);
  const items = Array.from(songList.querySelectorAll('li'));
  if (items.length === 0) return;
  // Find current position: active song or highlighted folder header
  let curIdx = items.findIndex((li) => li.classList.contains('active') || li.classList.contains('nav-highlight'));
  let nextIdx;
  if (e.key === 'ArrowDown') {
    nextIdx = curIdx < items.length - 1 ? curIdx + 1 : 0;
  } else {
    nextIdx = curIdx > 0 ? curIdx - 1 : items.length - 1;
  }
  const nextLi = items[nextIdx];
  // Remove any previous folder highlight
  songList.querySelectorAll('.nav-highlight').forEach(el => el.classList.remove('nav-highlight'));

  if (nextLi.classList.contains('folder-header')) {
    // Expand the folder if collapsed, then skip to the next song item
    const folder = nextLi.textContent.replace(/^[▸▾]\s*/, '');
    if (!expandedFolders.has(folder)) {
      expandedFolders.add(folder);
      renderSongList(songFilter.value);
    }
    // Re-query after possible re-render, find the header again and advance past it
    const refreshed = Array.from(songList.querySelectorAll('li'));
    const headerIdx = refreshed.findIndex(li =>
      li.classList.contains('folder-header') && li.textContent.replace(/^[▸▾]\s*/, '') === folder
    );
    const step = e.key === 'ArrowDown' ? 1 : -1;
    let songIdx = headerIdx + step;
    if (songIdx >= refreshed.length) songIdx = 0;
    if (songIdx < 0) songIdx = refreshed.length - 1;
    // Skip consecutive headers (edge case)
    while (refreshed[songIdx]?.classList.contains('folder-header')) {
      songIdx += step;
      if (songIdx >= refreshed.length) songIdx = 0;
      if (songIdx < 0) songIdx = refreshed.length - 1;
    }
    const songLi = refreshed[songIdx];
    if (songLi) {
      songLi.scrollIntoView({ block: 'center', behavior: 'smooth' });
      selectSong(parseInt(songLi.dataset.index), songLi);
    }
  } else {
    nextLi.scrollIntoView({ block: 'center', behavior: 'smooth' });
    selectSong(parseInt(nextLi.dataset.index), nextLi);
  }
}

document.addEventListener('keydown', handleSidebarNav, true);

renderSongList('');

function selectSong(index, li) {
  // Skip if already on this song
  if (currentSongIndex === index) return;
  const wasPlaying = playing;
  if (wasPlaying) fullStop();
  if (activeLi) activeLi.classList.remove('active');
  li.classList.add('active');
  activeLi = li;
  currentSongIndex = index;
  localStorage.setItem(SONG_KEY, index);
  setEditorCode(songs[index].code);
  // Pre-load code into a fresh repl
  createRepl(songs[index].code);
  if (wasPlaying) {
    setTimeout(() => play(), 200);
  }
}

// ── Apply: push editor code into the strudel repl ──
function applyCode() {
  const code = getEditorCode();
  // Recreate the repl with new code to ensure clean state
  const replEl = createRepl(code);
  if (playing) {
    setTimeout(() => {
      const ed = replEl.editor;
      if (ed) ed.evaluate();
    }, 200);
  }
}

// ── Progress / elapsed time ──
const progressSlider = document.getElementById('progress');
const elapsedEl = document.getElementById('elapsed');
let progressRAF = null;
let playStartTime = 0;
let seekOffset = 0;
let isSeeking = false;

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m + ':' + String(sec).padStart(2, '0');
}

// Seeking: when user drags or clicks, restart playback from that offset
progressSlider.addEventListener('input', () => {
  isSeeking = true;
});

progressSlider.addEventListener('change', () => {
  const maxMs = 10 * 60 * 1000;
  const seekMs = (parseInt(progressSlider.value) / 1000) * maxMs;
  isSeeking = false;
  if (!playing && paused) {
    // Update the stored elapsed so resume starts from this position
    pausedElapsed = seekMs;
    elapsedEl.textContent = formatTime(seekMs);
    return;
  }
  if (!playing) return;
  // Treat the slider as 0–1000 mapping to 0–10 minutes
  playStartTime = Date.now() - seekMs;
  seekOffset = seekMs;
  isSeeking = false;
  // Seek the cyclist to the matching cycle position
  seekToCycleFromMs(seekMs);
});

function startProgressLoop(resume) {
  if (resume && pausedElapsed > 0) {
    playStartTime = Date.now() - pausedElapsed;
  } else {
    playStartTime = Date.now();
    seekOffset = 0;
    progressSlider.value = 0;
  }
  const maxMs = 10 * 60 * 1000;
  const tick = () => {
    if (!playing) {
      return;
    }
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

function stopProgressLoop() {
  if (progressRAF) cancelAnimationFrame(progressRAF);
  progressRAF = null;
  progressSlider.value = 0;
  elapsedEl.textContent = '0:00';
  pausedElapsed = 0;
}

// ── Playback controls ──
function play() {
  const code = getEditorCode();
  const replEl = document.getElementById('repl');

  if (paused) {
    // Resume from paused position (slider may have been moved while paused)
    const scheduler = getScheduler();
    if (scheduler) {
      if (strudelAudioCtx) strudelAudioCtx.resume();
      scheduler.clock.start();
      scheduler.setStarted(true);
      seekToCycleFromMs(pausedElapsed);
    }
    paused = false;
    playing = true;
    playBtn.classList.add('playing');
    playIcon.innerHTML = '&#9646;&#9646;';
    statusEl.textContent = 'Playing';
    startProgressLoop(true);
    return;
  }

  if (!replEl) createRepl(code);
  else replEl.setAttribute('code', code);

  // Resume audio context in case it was suspended during cleanup
  if (strudelAudioCtx && strudelAudioCtx.state === 'suspended') {
    strudelAudioCtx.resume();
  }

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
  statusEl.textContent = 'Playing';
  startProgressLoop();
}

function pause() {
  const scheduler = getScheduler();
  if (scheduler) {
    scheduler.clock.pause();
    scheduler.setStarted(false);
  }
  if (strudelAudioCtx) strudelAudioCtx.suspend();
  pauseProgressLoop();
  playing = false;
  paused = true;
  playBtn.classList.remove('playing');
  playIcon.innerHTML = '&#9654;';
  statusEl.textContent = 'Paused';
}

function fullStop() {
  stopProgressLoop();
  paused = false;
  destroyRepl();
  playing = false;
  playBtn.classList.remove('playing');
  playIcon.innerHTML = '&#9654;';
  statusEl.textContent = 'Stopped';
  if (currentSongIndex >= 0) {
    createRepl(getEditorCode());
  }
}

playBtn.addEventListener('click', () => {
  if (playing) pause(); else play();
});

resetBtn.addEventListener('click', () => {
  const wasPlaying = playing;
  fullStop();
  if (wasPlaying) {
    setTimeout(() => play(), 200);
  }
});

applyBtn.addEventListener('click', applyCode);

// ── Fast-forward / Rewind ──
function getScheduler() {
  const el = document.getElementById('repl');
  return el?.editor?.repl?.scheduler;
}

function seekToCycle(target) {
  const scheduler = getScheduler();
  if (!scheduler) return;
  target = Math.max(0, target);
  if (typeof scheduler.setCycle === 'function') {
    scheduler.setCycle(target);
  } else {
    scheduler.clock.stop();
    scheduler.lastEnd = target;
    scheduler.lastBegin = target;
    scheduler.num_ticks_since_cps_change = 0;
    scheduler.num_cycles_at_cps_change = target;
    scheduler.clock.start();
  }
}

function seekToCycleFromMs(ms) {
  const scheduler = getScheduler();
  if (!scheduler) return;
  const cps = scheduler.cps || 0.5;
  seekToCycle((ms / 1000) * cps);
}

// ── About button ──
document.getElementById('about-btn').addEventListener('click', () => {
  window.open('doc/', '_blank');
});

// ── Start ──
loadSongs();
