// ── Strudel audio engine ──
// Pure audio/scheduling logic — no DOM or UI concerns.
// Replicates what @strudel/web's initStrudel() does, using individual packages
// so Vite can properly deduplicate shared modules.

import { Pattern, evalScope, setTime } from '@strudel/core';
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

// ── Polyfills for @strudel/repl-only APIs ──
function installPolyfills() {
  const P = Object.getPrototypeOf(window.note('c'));
  if (!P._scope) P._scope = P.scope || function () { return this; };
  if (!P._pianoroll) P._pianoroll = P.pianoroll || function () { return this; };
  if (!P._punchcard) P._punchcard = function () { return this; };
  if (!P._spectrum) P._spectrum = function () { return this; };
  if (!window.slider) {
    window.slider = (defaultVal) => defaultVal;
  }
  if (!window.sliderWithID) {
    window.sliderWithID = (_id, defaultVal) => defaultVal;
  }
}

export async function init() {
  if (initDone) return initDone;
  console.log('[engine] init starting');

  // Filter out noisy superdough deprecation warnings
  setLogger((...args) => {
    const msg = args[0];
    if (typeof msg === 'string' && msg.includes('Deprecation warning')) return;
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
        slider: (defaultVal) => defaultVal,
        sliderWithID: (_id, defaultVal) => defaultVal,
      },
    );
    await Promise.all([loadModules, registerSynthSounds()]);
    console.log('[engine] modules loaded, synth sounds registered');

    // 2. Our extra prebake: soundfonts + sample packs
    await Promise.all([
      registerSoundfonts(),
      registerZZFXSounds(),
      samples(`${DOUGH}/tidal-drum-machines.json`),
      samples(`${DOUGH}/piano.json`),
      samples(`${DOUGH}/Dirt-Samples.json`),
      samples(`${DOUGH}/vcsl.json`),
      samples(`${DOUGH}/mridangam.json`),
      samples(`${UZU_DRUMKIT}/strudel.json`),
    ]);
    aliasBank(
      'https://raw.githubusercontent.com/todepond/samples/main/tidal-drum-machines-alias.json'
    );

    // 3. Make .play() work on patterns
    Pattern.prototype.play = function () {
      initDone.then(() => repl.setPattern(this, true));
      return this;
    };

    // Pre-create orbits 0-4 so duck() doesn't error on missing targets
    try {
      const ctrl = getSuperdoughAudioController();
      if (ctrl?.getOrbit) {
        for (let i = 0; i < 5; i++) ctrl.getOrbit(i);
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

export function resume() {
  try {
    // Reset clock phase to avoid "skip query: too late" spam.
    // clock.stop() resets phase to 0 without touching cyclist.lastEnd,
    // so the pattern continues from where it was paused.
    repl?.scheduler?.clock?.stop();
    repl?.start();
  } catch {}
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
