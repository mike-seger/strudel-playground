// Licensed with CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/

// ¸,ø¤º°`°º¤ø,¸¸,ø¤º°`°º¤ø, ✧ ✦ ✧     @title ACIDIL   ✧ ✦ ✧ ¸,ø¤º°`°º¤ø,¸¸,ø¤º°`°º¤ø,
// ¸,ø¤º°`°º¤ø,¸¸,ø¤º°`°º¤ø, ✧ ✦ ✧ @by Mario D. Quiroz  ✧ ✦ ✧ ¸,ø¤º°`°º¤ø,¸¸,ø¤º°`°º¤ø,¸

// https://www.instagram.com/mariodquiroz/
// https://soundcloud.com/mario-quiroz
// https://link.me/mariodquiroz

/////////// UTILS CODE ///////////
register('acid', (lpfMin, lpfMax, pat) => {
  return pat
  .s('supersaw')
  .detune(irand(2))
  .unison(rand.range(0,3).slow(3))
  .lpf(sine.range(lpfMin, lpfMax).segment(50).slow(3))
  .lpenv(2)
  .dist(1)
  .lpq(15)
})

/////////// STRUDEL CODE ///////////
setcpm(120 / 4);
const KEY = 'A'
const MODE = ':Phrygian'

_kick: s("bd bd bd bd")
  .bank("tr505")
  .lpf(1500)
  .dist(2)
  .duck(2)

const OPENHAT = false;
_hihat: s(OPENHAT ? "~ oh ~ oh ~ oh ~ oh" : "~ hh ~ hh ~ hh ~ hh")
  .room(OPENHAT ? 2 : 0.4)
  .bank("tr808")
  .dist(1)

const ISCLAP = true;
_snare:  s(ISCLAP ? "~ cp ~ cp" : "~ sd ~ sd")
  .bank("tr909")

acid_bass: cat([
    n("0 1 0 3 5 0 7 9"),
    n("0 1 0 3 5 11 13 10")
  ])
  .scale(KEY + 2 + MODE)
  .acid(100, 500)
  .fast(1)
  .orbit(2)

_chord: n("[0, 3, 5]".add("<0 0 4 7>"))
  .scale(KEY + 3 + MODE)
  .sound("piano")
  .room(2)

_lead: n("{1 1 3 5 ~ ~ [4 6] 5}%16")
  .scale(KEY + 3 + MODE)
  .transpose("0 2".slow(6))
  .sound("gm_koto")
  .room(2)
  

// let PTN_MUSIC = "3 4 5 [6 7]*2";
// MUSIC: n(PTN_MUSIC).scale("c3:minor").fast(1).sound("piano").lpf(1000);


// ///////////   P5 CODE   ///////////
// const { mountP5, hydraGate } = await import(
//   'https://cdn.jsdelivr.net/gh/darkmarthur/LiveCoding@v1.1.1/utils/strudel-p5.mjs'
// );

// const api = await mountP5({
//   webgl: true,

//   //  P5 SETUP FUNCTION
//   setup(p, { g, size }) {
//     g.noStroke();
//     g.rectMode(g.CENTER);

//     const { w, h } = size;
//     g.SQ = {
//       x: 0,
//       y: 0,
//       s: Math.min(w, h) * 0.12,
//       colorIdx: 0,
//       colors: [
//         [255, 200, 200],
//         [200, 255, 200],
//         [200, 200, 255],
//         [255, 240, 180],
//         [240, 180, 255],
//       ],
//       downPrev: false
//     };
//   },

//   //  P5 DRAW FUNCTION
//   draw(p, { g, size, pointer }) {
//     const { w, h } = size;
//     if (!w || !h) return;

//     g.resetMatrix();
//     g.rectMode(g.CORNER);
//     g.fill(0, 24);
//     g.rect(-w / 2, -h / 2, w, h);

//     const t = p.millis() * 0.001;
//     const amp = w * 0.3;
//     const baseX = Math.sin(t) * amp;
//     const baseY = 0;

//     const cx = pointer.inside ? (pointer.x - w / 2) : baseX;
//     const cy = pointer.inside ? (pointer.y - h / 2) : baseY;

//     const SQ = g.SQ;
//     const followRadius = Math.max(w, h) * 0.25;
//     const dx = cx - SQ.x, dy = cy - SQ.y;
//     const dist = Math.hypot(dx, dy);

//     const targetX = (pointer.inside && dist < followRadius) ? cx : baseX;
//     const targetY = (pointer.inside && dist < followRadius) ? cy : baseY;

//     const ease = 0.12;
//     SQ.x += (targetX - SQ.x) * ease;
//     SQ.y += (targetY - SQ.y) * ease;

//     if (pointer.down && !SQ.downPrev) {
//       SQ.colorIdx = (SQ.colorIdx + 1) % SQ.colors.length;
//     }
//     SQ.downPrev = pointer.down;

//     const [r, gC, b] = SQ.colors[SQ.colorIdx];
//     g.rectMode(g.CENTER);
//     g.fill(r, gC, b, 210);
//     g.push();
//     g.translate(SQ.x, SQ.y, 0);
//     g.rect(0, 0, SQ.s, SQ.s);
//     g.pop();
//   },
// });

// /////////// HYDRA CODE ///////////
// await initHydra();
// await hydraGate({ sourceIndex: 0 }); //  REQUIRED TO VISUALIZE P5 OVER HYDRA
// window.P5VIS = { on: 1 }; //  OPTIONAL TO MIX HYDRA/P5

// //  HYDRA DEMO ANIMATION
// const oscLayer = osc(12, 0.03, 0.3)
//   .color(H(PTN_MUSIC))

// //  GLOBAL VIDEO MIXER
// src(s0)
//   .blend(solid(0, 0, 0), () => 1 - window.P5VIS.on)
//   .blend(oscLayer, 0.5)
//   .contrast(1.1)
//   .brightness(0.02)
//   .out(o0);
