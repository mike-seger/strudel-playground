// github:kyleproj techno song

setcps(0.56);
stack(
    arrange(
      [ 48, sound("- - - -") ],
      [ 32, sound("bd bd bd bd") ]
    ).bank("RolandTR909")
      .gain(1.2).lpf(120).freq(45),
      arrange(
      [ 16, sound("- - - -") ],
      [ 64, sound("bd bd bd bd") ]
    ).bank("RolandTR909")
      .gain(0.8),
    arrange(
        [8, sound("- - - -").bank("RolandTR909")],
        [64, sound("<hh <oh hh> hh oh <[hh hh] hh oh>>*8").bank("RhythmAce")],
        [64, sound("<hh <hh, hh> hh oh <hh [oh hh]>>*8").bank("RolandTR909")],
      ).someCycles(scramble(4))
      .decay(sine.range(0.25, 1.0).slow(32))
      .gain(0.5)
      .room(0.3).rfade(0.3).rsize(0.3)
      .orbit(1),
    arrange(
        [32, sound("- - - -").bank("RhythmAce")],
        [32, sound("<rd rd rd <rd rd [rd rd]>>*8").bank("RolandTR909")],
        [32, sound("- - - -").bank("RhythmAce")],
      )
      .decay(sine.range(0.25, 0.65).slow(16))
      .gain(0.25)
      .room(0.8).rfade(0.8).rsize(0.8)
      .orbit(5),
    arrange(
      [48, sound("- - - -").bank("RhythmAce") ],
      [32, sound("- sd - sd").bank("RhythmAce") ],
    )
      .gain(0.7).decay(0.1)
      .room(0.5).rfade(0.5).rsize(0.5).orbit(4),
    arrange (
      [4, "<<e4 b3 g3 c4>*4 <b3 e3 c4>*4>"],
      [4, "<<f4 g3 a3 e4>*4 <f3 e3 c4>*4>"]
    ).note()
      .sound("sawtooth").someCycles(scramble(4))
      .attack(0)
      .decay(0.1)
      .release(0)
      .gain(1.2)
      .fast(4)
      .lpf(sine.range(200, 1000).slow(8))
      .delay(0.2)
      .room(sine.range(0.2, 0.6).slow(8)).rsize(2.0)
      .pan(sine.range(-0.8, 0.8).slow(8)).orbit(2),
    arrange (
        [8, "<- a1 a1 <a1 g2>>*8"],
        [4, "<- f1 f1 <f1 e2>>*8"]
    ).note()
      .sound("sawtooth").lpf(200).decay(0.08).gain(4.5).fast(2),
    note("<- a1 a1 <a1 g2>>*8")
      .sound("piano")
      .lpf(sine.range(130, 250).slow(16)).decay(sine.range(0.06, 0.08).slow(32)).gain(3.0).fast(2)
      .room(0.5).rsize(0.5).rfade(0.5)
      .orbit(3).late(8),
    note("<- a5 a5 a5 a5>*8").someCycles(scramble(4))
      .decay(0.035)
      .room(0.5).rsize(0.5).rfade(0.5)
      .orbit(7)
      .gain(sine.range(0.1, 1.3).slow(16))
      .sound("gm_ocarina").late(16),
    arrange (
        [16, "f2, e2, a3, g4, f3, e4"],
        [16, "a2, b2, d3, b4, a3, d4"]
      ).note()
      .sound("gm_pad_new_age, gm_string_ensemble_2")
      .lpf(sine.range(170, 300).slow(8))
      .attack(8).decay(32).release(4).gain(0.8)
      .room(1.5).rsize(1.0).rfade(1.0)
      .pan(sine.range(-0.7, 0.7).slow(8))
      .orbit(6).slow(2).spread(1)
)._spectrum().pianoroll()