// tcb-salvage

// TCB Salvage Op v3 — bass split, blended layers
  stack(
    // Sub-bass anchor — stays low, holds the floor
    note("<c2 eb2 ab1 bb1>")
      .sound("sawtooth").cutoff(200)
      .decay(.3).sustain(.2).gain(.5),

    // Mid-bass riff — octave jumps as texture, not lead
    note("c2 c3 eb2 eb3 ab1 ab2 bb1 bb2")
      .sound("sawtooth").cutoff(450)
      .decay(.08).sustain(0).gain(.25),

    // Kick — four on the floor
    s("bd*4").gain(.55),

    // Hats — humanized 2-bar pattern
    s("<[hh hh ~ hh hh hh ~ hh] [hh ~ hh hh ~ hh hh hh]>")
      .gain("<[.28 .12 ~ .22 .28 .1 ~ .18] [.28 ~ .14 .22 ~ .12 .28 .16]>"),

    // Clap on 2 and 4
    s("~ cp ~ cp").gain(.3),

    // Lead arp — minor key urgency, filtered sweep
    note("[c4 eb4 g4 bb4 c5 bb4 g4 eb4]")
      .sound("square")
      .cutoff(sine.range(600, 2400).slow(8))
      .decay(.07).sustain(.04)
      .gain(.3)
      .delay(.2).delaytime(.333).delayfeedback(.35),

    // Dark chord progression
    note("<[c3,eb3,g3] [ab2,c3,eb3] [bb2,d3,f3] [g2,bb2,d3]>")
      .sound("sawtooth")
      .cutoff(1000).decay(.25).sustain(.3)
      .gain(.22).room(.3).roomsize(.5)
  ).cpm(35)