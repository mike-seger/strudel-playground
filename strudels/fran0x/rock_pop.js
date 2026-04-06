// DRUMS
let drums = sound("bd*4, [~ <sd cp>]*2, [~ hh]*4")
  .bank("RolandTR909")
  .room(.1).size(.6)
  .gain(.9)

let rim = sound("bd rim")
  .bank("RolandTR707")
  .delay(".5")
  .gain(.7)
  .pan(rand)

// BASS
let bass = note("<[36 48]*4 [34 46]*4 [41 53]*4 [39 51]*4>")
  .sound("gm_acoustic_bass")
  .lpf("200 1000 200 1000")
  .room(.2).size(.7)
  .pan(-0.2)
  .gain(1.2)

// GUITAR 1 – HIGH SPACEY HOOK / PAD
let guitar1 = note("72 <75 74 77 75>")
  .sound("gm_electric_guitar_clean")
  .drive(.3)
  .lpf("800 2500")
  .room(.5).size(.9)
  .attack(.03)
  .pan(.2)

// GUITAR 2 – MID-HIGH ARPEGGIO / MOTION
let guitar2 = n(`<
[~ 0] 2 [0 2] [~ 2]
[~ 0] 1 [0 1] [~ 1]
[~ 0] 3 [0 3] [~ 3]
[~ 0] 2 [0 2] [~ 2]
>*4`)
  .scale("C5:minor")
  .sound("gm_electric_guitar_clean")
  .drive(.5)
  .lpf("1000 3500")
  .room(.25).size(.6)
  .attack(.015)
  .pan(rand)
  .gain(.7)

// GUITAR 3 – RHYTHM / POWER-CHORD LAYER
let guitar3 = note("<[48 55]*2 [46 53]*2 [48 56]*2 [46 50 58 62]*2>")
  .sound("gm_overdriven_guitar")  
  .gain(1)                         
  .drive(.7)                       
  .lpf("2000 6000")                
  .hpf(200)                        
  .room(.15).size(.4)              
  .attack(.005)                    
  .pan(-.1)

let the_drums = stack(drums, rim)
let the_bass = stack(the_drums, bass)
let the_guitars = stack(the_bass, guitar1, guitar2, guitar3)

arrange(
  [4, the_drums],
  [4, the_bass],
  [8, the_guitars],
)