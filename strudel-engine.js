// ── Strudel audio engine ──
// Pure audio/scheduling logic — no DOM or UI concerns.
// Replicates what @strudel/web's initStrudel() does, using individual packages
// so Vite can properly deduplicate shared modules.

import { Pattern, evalScope, setTime, pure } from '@strudel/core';
import {
  initAudioOnFirstClick,
  registerSynthSounds,
  registerZZFXSounds,
  webaudioRepl,
  samples,
  aliasBank,
  getAudioContext,
  getSuperdoughAudioController,
  setLogger,
} from '@strudel/webaudio';
import { transpiler } from '@strudel/transpiler';
import { miniAllStrings } from '@strudel/mini';
import { registerSoundfonts } from '@strudel/soundfonts';

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
        text = text.replace(/,(\s*[\]}])/g, '$1');
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

let repl = null;
let initDone = null;

// ── Sample pack base URLs (same as @strudel/repl prebake) ──
const DOUGH =
  'https://raw.githubusercontent.com/felixroos/dough-samples/main';
const UZU_DRUMKIT =
  'https://raw.githubusercontent.com/tidalcycles/uzu-drumkit/main';
const ALIAS_URL =
  'https://raw.githubusercontent.com/todepond/samples/main/tidal-drum-machines-alias.json';

// Track which sample URLs failed so we can retry them
let failedSampleURLs = [];
let aliasLoaded = false;

// ── Polyfills for @strudel/repl-only APIs ──
function installPolyfills() {
  const P = Object.getPrototypeOf(window.note('c'));
  if (!P._scope) P._scope = P.scope || function () { return this; };
  if (!P._pianoroll) P._pianoroll = P.pianoroll || function () { return this; };
  if (!P._punchcard) P._punchcard = function () { return this; };
  if (!P._spectrum) P._spectrum = function () { return this; };
  if (!P._spiral) P._spiral = function () { return this; };
  if (!P._pitchwheel) P._pitchwheel = function () { return this; };
  if (!P.piano) P.piano = function () { return this; };
  if (!P.scope) P.scope = function () { return this; };
  if (!P.pianoroll) P.pianoroll = function () { return this; };
  if (!P.punchcard) P.punchcard = function () { return this; };
  if (!window.slider) {
    window.slider = (defaultVal) => pure(defaultVal);
  }
  if (!window.sliderWithID) {
    window.sliderWithID = (_id, defaultVal) => pure(defaultVal);
  }
  if (!window.setGainCurve) {
    window.setGainCurve = () => {};
  }
}

async function loadSamplePacks(urls) {
  const results = await Promise.all(
    urls.map(url => samples(url)
      .then(() => ({ url, ok: true }))
      .catch(e => { console.warn('[engine] sample load failed:', url.split('/').pop(), e.message); return { url, ok: false }; })
    )
  );
  failedSampleURLs = results.filter(r => !r.ok).map(r => r.url);
  if (failedSampleURLs.length === 0 && !aliasLoaded) {
    try {
      aliasBank(ALIAS_URL);
      aliasLoaded = true;
    } catch (e) {
      console.warn('[engine] aliasBank failed:', e.message);
    }
  }
  if (failedSampleURLs.length > 0) {
    console.warn(`[engine] ${failedSampleURLs.length} sample pack(s) failed to load (offline?)`);
  }
}

async function retryFailedSamples() {
  if (failedSampleURLs.length === 0) return;
  console.log(`[engine] retrying ${failedSampleURLs.length} failed sample pack(s)...`);
  await loadSamplePacks([...failedSampleURLs]);
}

export async function init() {
  if (initDone) return initDone;
  console.log('[engine] init starting');

  // Filter out noisy superdough deprecation warnings
  setLogger((...args) => {
    const msg = args[0];
    if (typeof msg === 'string' && msg.includes('Deprecation warning')) return;
    if (typeof msg === 'string' && msg.includes("Can't do arithmetic on control pattern")) return;
    if (typeof msg === 'string' && msg.includes('not found! Is it loaded')) return;
    console.log(...args);
  });

  // Replicate what @strudel/web's initStrudel() does:
  initAudioOnFirstClick();
  miniAllStrings();
  repl = webaudioRepl({ transpiler });
  console.log('[engine] repl created:', Object.keys(repl));
  setTime(() => repl.scheduler.now());

  initDone = (async () => {
    // 1. Default prebake: load modules + synth sounds
    const loadModules = evalScope(
      evalScope,
      import('@strudel/core'),
      import('@strudel/mini'),
      import('@strudel/tonal'),
      import('@strudel/webaudio'),
      {
        hush: () => repl.stop(),
        evaluate: (code) => repl.evaluate(code, true),
        slider: (defaultVal) => pure(defaultVal),
        sliderWithID: (_id, defaultVal) => pure(defaultVal),
      },
    );
    await Promise.all([loadModules, registerSynthSounds()]);
    console.log('[engine] modules loaded, synth sounds registered');

    // 2. Our extra prebake: soundfonts + sample packs (non-fatal if offline)
    const sampleURLs = [
      `${DOUGH}/tidal-drum-machines.json`,
      `${DOUGH}/piano.json`,
      `${DOUGH}/Dirt-Samples.json`,
      `${DOUGH}/vcsl.json`,
      `${DOUGH}/mridangam.json`,
      `${UZU_DRUMKIT}/strudel.json`,
    ];
    const misc = [
      registerSoundfonts(),
      registerZZFXSounds(),
    ].map(p => Promise.resolve(p).catch(e => console.warn('[engine] load failed:', e.message)));
    await Promise.all(misc);
    await loadSamplePacks(sampleURLs);

    // 3. Make .play() work on patterns
    Pattern.prototype.play = function () {
      initDone.then(() => repl.setPattern(this, true));
      return this;
    };

    // Pre-create orbits 0-9 so duck() doesn't error on missing targets
    try {
      const ctrl = getSuperdoughAudioController();
      if (ctrl?.getOrbit) {
        for (let i = 0; i < 10; i++) ctrl.getOrbit(i);
      }
    } catch {}

    installPolyfills();
    console.log('[engine] init complete');
    return repl;
  })();

  repl = await initDone;
  return repl;
}

export async function evaluateCode(code) {
  console.log('[engine] evaluateCode called');
  await init();
  await retryFailedSamples();
  const ac = getAudioContext?.();
  console.log('[engine] AudioContext state:', ac?.state);
  if (ac?.state === 'suspended') await ac.resume();
  // Stop first to reset clock phase & cycle position (avoids "skip query: too late" spam)
  try { repl?.stop(); } catch {}
  console.log('[engine] calling repl.evaluate, code length:', code.length);
  const result = await repl.evaluate(code, true);
  console.log('[engine] evaluate result:', result);
  return result;
}

export function stop() {
  try { repl?.stop(); } catch {}
}

export function pause() {
  try { repl?.pause(); } catch {}
}

export async function resume() {
  try {
    // Reset clock phase to avoid "skip query: too late" spam.
    // clock.stop() resets phase to 0 without touching cyclist.lastEnd,
    // so the pattern continues from where it was paused.
    repl?.scheduler?.clock?.stop();
    await repl?.start();
  } catch (e) {
    console.warn('[engine] resume failed:', e.message);
  }
}

export function getScheduler() {
  return repl?.scheduler ?? null;
}

export function getCps() {
  return repl?.scheduler?.cps ?? 0.5;
}

export function seekToCycle(target) {
  const scheduler = getScheduler();
  if (!scheduler) return;
  target = Math.max(0, target);
  if (typeof scheduler.setCycle === 'function') {
    scheduler.setCycle(target);
  } else {
    scheduler.lastEnd = target;
    scheduler.lastBegin = target;
    scheduler.num_ticks_since_cps_change = 0;
    scheduler.num_cycles_at_cps_change = target;
  }
}

export function seekToCycleFromMs(ms) {
  seekToCycle((ms / 1000) * getCps());
}

export function nowCycle() {
  return repl?.scheduler?.now() ?? 0;
}
