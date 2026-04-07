/*
@title untitled
@by onefeather
*/

// recommended theme: archBtw
samples('github:0nefeather/akas-dnb-essentials')

// setGainCurve(x => Math.pow(x, 2))
setCps(170/60/4)

const BIG_GAIN = slider(1)

// *****************
// drums
// *****************

// hi-hat
$: s("hats:3!8") // 3 12
  .decay(.5)
  .slow(2)
  .color("mediumslateblue")
  .almostNever(x=>x.ply("2 | 4").color("lime"))
  .duck(2)
  .gain(slider(0.739).mul(BIG_GAIN))
  ._pianoroll( { playhead: 1, hideNegative: true } )

//break sample
$: s("drum_loops/2:8").fit()
  .color("mediumslateblue")
  .scrub(irand(16).div(16).seg(8)
    .rib("<12.25 32>", 2) // 4 11.25* 33* 40
  ).sometimesBy(0.05, x=>x.ply("2 | 3").color("lime"))
  .gain(slider(0.625).mul(BIG_GAIN))
  ._scope()

// ********************
// pads
// ********************

// vox
const VOX_GAIN = slider(0.813)
$: s("pads_drones").scrub("0 .42 .14 .69").n("6")
  .note("36")
  .color("mediumslateblue")
  .sometimesBy(slider(0.498), x=>x.ply("2 | 4 | 8").color("lime"))
  .superimpose(x=>x.note("60"))
  .gain(VOX_GAIN.mul(BIG_GAIN))
  ._scope()
// pads

const chops = [
  { degrade: 0, chop: ".8@3 .1" },
  { degrade: 0, chop: ".16!3 .7@5" },
  { degrade: 0.25, chop: rand.seg(8) }
]

var ch = 2

$: s("pads_drones")
  .scrub(pick(chops.map(c => c.chop), ch))
  .n("3")
  .degradeBy(pick(chops.map(c => c.degrade), ch))
  .superimpose(x=>x.note("48"))
  .rib(68, 2)
  .color("mediumslateblue")
  .sometimesBy(
    slider(0.2, 0, 1, 0.05), x=>x.ply("2 | 4")
      .note("72")
      .hpf(4000)
      .decay(0.1)
      .color("lime")
  )
  .gain(slider(0.511).mul(BIG_GAIN))
  ._pianoroll( { playhead: 1, hideNegative: true } )

// ***************
// bass
// ***************

$: note("<f1!8 c1!8>")
  .s("tri")
  .orbit(2)
  .color("mediumslateblue")
  // .pan(0.3)
  .gain(slider(0.444, 0, 3).mul(BIG_GAIN))
  ._pianoroll()

$: note("<f2!8 c2!8>")
  .s("sawtooth")
  .lpf(
      sine.range(200, 15000).fast(24)
  )
  .gain(slider(1.022, 0, 2).mul(BIG_GAIN))

$: note("<f2!8 c2!8, f3!8 c3!8>")
  .s("triangle")
  .orbit(2)
  .color("mediumslateblue")
  .gain(slider(1.125, 0, 3).mul(BIG_GAIN))
  // .pan(0.7)
  .phaser(2)
  .phasercenter(800)
  // ._spiral({ steady: .96, colorizeInactive: true, inset: 2, cap: "round", logSpiral: true, playheadColor: "lime"})

// **************
// twinkle
// ************** 

$: n(irand(16).add(8))
  .struct("x*8")
  .s("sine")
  .degradeBy(0.45)
  .rib("13 | 7", 2) 
  .scale("<F:dorian!4>")
  .echo(4, 1/16, .8)
  .decay(0.1)
  .room(0.9)
  .pan(sine.slow(2))
  .gain(slider(0.784).mul(BIG_GAIN))
  .color("mediumslateblue")
  ._pianoroll({playhead: 0, playheadColor: "mediumslateblue", flipTime: true})

// idk why this is needed but its there to stop things from breaking
 $: note("<f1!8 c1!8>")
  .s("tri")
  .gain(1.75)
  .orbit(2)
  .gain(0)