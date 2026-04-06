// chriswillsflannery/acidbass
// 140 bpm
// 60 converts bpm to bps
// 4 rhythmic subdivision
setCps(140/60/4)

// defining a global context for orbit bus 2
// basically here saying we define a shared global bus where multiple
// sounds will be processed together using same effects
const BUS_2 = 2;

// synthesize 4 on the floor 909
$: s("sbd!4")
  // visualize waveform
  ._scope()// sidechain synths to bd
// 234 means sidechain applied across orbit 2,3,4
// attack - time in s for ducked signals to return to baseline
// depth - how much volume is reduced during duck period
.duck("2:3:4").duckattack(.2).duckdepth(.8)

// 10 random possible notes
// sub 7 - subtract 1 octave
// seg(16) - 16th notes subdivision
$bass: n(irand(9).sub(7).seg(16)).scale("c:minor")
// repeat every cycle (ribbon)
.rib(46,1)
  // add distortion
  .distort("2.2:.3")
.s("sawtooth")
// low pass filter 200 hz
.lpf(200)
// low pass envelope 2
// .lpenv(2)
// low pass env slider
.lpenv(slider(2.696,0,8))
// increase resonance
.lpq(10)
// use shared bus 2
.orbit(BUS_2)