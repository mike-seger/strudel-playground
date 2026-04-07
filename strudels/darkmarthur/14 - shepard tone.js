// @title SHAPARD TONE
// @author Mario D. Quiroz

// // Endless riser (Shepard–Risset-ish) with Strudel primitives

// const VOICES = 6     // fewer = lighter CPU
// const RISE = 8       // cycles per octave-rise (bigger = slower)
// const STEPS = 64     // event density (bigger = smoother, heavier)
// const BASE = 48      // MIDI base (48 = C3-ish)

// const ramp = saw.slow(RISE).range(0, 12)     // 0..12 semitones
// const win  = tri.slow(RISE)                  // 0..1..0 loudness window

// $: note(
//     ramp.add(BASE).segment(STEPS)
//       .echoWith(VOICES, 1/VOICES, (p,i) => p.add(12*i))  // stack octaves, phase-shifted
//   )
//   .s("sine")
//   .gain(win.mul(0.12))
//   .release(0.05)
//   .room(0.2).size(4)



_shepard_riser: note(saw.slow(8).range(48,60).segment(48).echoWith(6, 1/6, (p,i)=>p.add(12*i)))
  .s("sine")
  .gain(tri.slow(8).mul(0.12))
  .release(0.05)


// PURE NOISE RISER (looping). Change slow(8) to slow(4), slow(16), etc.
_atonal_noise: s("pink")
  .gain(saw.slow(8).segment(64).range(0, 0.7))
  .hpf(saw.slow(8).segment(64).range(40, 9000))
  .lpf(saw.slow(8).segment(64).range(800, 18000))
  .release(0.2)
  .room(0.25).size(6)

// TONAL RISER (pitched). BASE/TO = MIDI notes. Example: C3(48) -> C4(60)
_tonal_noise: note(saw.slow(8).segment(64).range(48, 60))
  .s("sawtooth")
  .noise(0.2) // adds airy noise on top (optional)
  .gain(saw.slow(8).segment(64).range(0, 0.35))
  .lpf(saw.slow(8).segment(64).range(400, 16000))
  .release(0.15)
  .room(0.2).size(5)



