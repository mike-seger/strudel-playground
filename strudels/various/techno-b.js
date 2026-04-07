$BEAT: s("[bd <hh bd> - bd]*2").bank("tr909").dec(.4).room(0.25)
._scope()

$HIGHS: s("<hh rim [rim hh] rim >*2").bank("tr909").dec(0.4)

// @note: This is where I left off, I want this to be meatier
//$CROW: sound("<crow ->").room(1.5).gain(perlin.range(0.0, 0.8)).echo(perlin.range(0, 4), 1/8, 0.5)

_$BASELINE: n("<-9 -11 -13> * 8")
  .scale("A:major").sound("gm_fretless_bass")
  .sometimes(add(note("-15")))
  .dec(16.0)
  .echo(perlin.range(4, 6), 1/8, .2)
._pianoroll()

$BUZZ: n("-15")  
  .scale("A:major").sound("gm_distortion_guitar").lpf(50).decay(10.0).gain(2.5)
._scope()
  
$: arrange(
  //[4, "<7 5 7 5 7 5 3 5 3 ->*8"],
  //[2, "<- 1 3 5 5 7 5 5 - 7>*8"],
  [2, "<[ 5 -, 7 -]> * 8"],
  [2, "<[ 5 -, 3 -]> * 8"],
  [2, "<[ 5 -, 9 -, 3 -]> * 8"],
)
//$MELODY: n("<8 5 8 5 8 5 3 5 3 ->*8")
.scale("A:major").sound("gm_fretless_bass")
.sometimes(add(note("<13 9 7 5>")))
// ._pitchwheel()
