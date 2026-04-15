samples('https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/refs/heads/master/strudel.json')
setCpm(140/4)

const house = note("c2 d#2 c2 d#2").s("house")
  .dec(0.5)
  .diode(1, 1)

const houser = note("[c2 d#2 c2 d#2]!2".swing(10)).s("house")
  // .dec(0.5)
  .room(0.5)
  .penv(128)
  .diode(0.3, 1)
  // .jux(rev)

const ch2 = note("c,d#,f".arp("[0,1] [0,2]!2".fast(4)).add(7))
 // .attack(0.01)
 // .transpose("3m")
 // .dec(0.1)
 .penv(20)
 // .dec(sine.range(0.5, 1).fast(8))
 .s("sine")
 // .detune(1800)
 // .phaser(2)
 .dec(0.2)
 .lpf(200)
  .lpe(2)
 .room(0.4)
  .delay(0.125)
 // .lpe(2)
 // .diode(0, 1)
 .fm(sine.range(8, 40).fast(2))


const ch22 = note("c!8".sub(sine.range(14, 16)))
 // .attack(0.01)
 // .transpose("3m 5d")
 // .dec(0.1)
 // .dec(sine.range(0.5, 1).fast(8))
 .s("sine")
 // .detune(1800)
 // .phaser(1)
 .dec(0.2)
 .lpf(600)
 .lpe(2)
 .diode(2, 1)
 .fm(sine.range(0, 1).fast(2))
 .room(0.5)
 // .delay(0.125)
 // .room(0.5)

const str = note("<c4>".mul("1 2 4".fast(2)).seg("16"))
 .s("wt_digital:5")
  .wt(sine.range(0, 8).fast(8))
  .lpe(1)
 // .attack(0.2)
  .lpf(800)
  .room(0.5)
 // .dec(0.5)
 .delay(0.125)

const bass = note("<c>".sub("14".fast(4)).seg("16"))
  // .dec(0.2)
  // .release(0.2)
  .s("sine,supersaw")
  .diode(0.5, 1)
  // .lpf(800)
  // .room(0.5)

const hh = n("~ ~ 0 ~").fast(4)
  .s("rolandtr909_hh,white")
  .dec(0.1)
  .delay(0.125)

const cp = note("~ ~ d#3 ~").fast(2)
  .s("rolandtr909_cp")
  .dec(0.1)


const rd16 = n("0!16")
  // .attack(0.1)
  .s("white")
  .dec(0.1)
  .velocity(sine.range(0.3, 0.1).fast(4))
  .room(0.3)
  // .jux(rev)
  .gain(0.7)
  // .delay(0.125)

const top = s("breaks:20/2")
  .fit()
  .penv(2)
  // .phaser(8)
  // .hpf(1200)
  // .dec(0.8)
  .lpf(1200)
  .dec(0.4)
  .scrub("{0 1 2 3 4 5 6 7}%8".seg("<8>").div("<16>"))
// .dec(0.1)


const top2 = s("breaks:38/2")
  .fit().lpf(1200)
  // .phaser(8)
  // .hpf(1200)
  .dec(0.1)
  .scrub("{0 1 2 3 4 5 6 7}%8".seg("<8>").div("<8>"))

const top3 = s("breaks:45/2")
  .fit().lpf(1200)
  // .phaser(8)
  // .hpf(1200)
  // .dec(0.8)
  .scrub("{0 1 2 3 4 5 6 7}%8".seg("8").div("16"))

$: stack(
  house.duckorbit(2).duckattack(0.1).duckons(0.25).duckdepth(0.6),
  houser.gain(0.7).orbit(2),
  // ch2.gain(0.8).orbit(2),
  ch22.orbit(2),
  // bass.orbit(2),
  // str.gain(0.2).orbit(2),
  hh.orbit(2),
  cp.orbit(2),
  // rd16.every(2, x=>x.velocity(0)),
  // top.gain(0.5).orbit(2),
  // top2.gain(0.5).orbit(2),
  // top3.gain(0.5).orbit(2),
)
  .hpf(slider(0, 0, 1200))
  // .scope()
