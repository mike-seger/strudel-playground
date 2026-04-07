setcpm(120/4)

// the "to your soul" part; technically the song has a tie at the end of 
// the measure and the bass line is ON the beat, but idk if it's possible 
// to do ties in strudel?  so instead, I bumped everything one note over 
// (note +1) so that the held note could start on the downbeat
$: note("<[4@14 3 4]/2>")
.sound("gm_voice_oohs")
  .scale("c4:minor")
._pianoroll()

// off by one bass line (not sexy. not sure how to dedupe within measures, yet, when stuff not easily divisible...?
$: note("<[d2 c2 c3 c2 c3 c2 c3 c2] [c3 bb1 bb2 bb1 bb2 bb1 bb2 bb1] [bb2 f2 f3 f2 f3 f2 f3 f2] [f3 eb2 eb3 eb2 eb3 eb2 eb3 eb2]>")
.sound("gm_synth_bass_2")
._pianoroll()

// bass line not off by one
_$: note("<[c2 c3]*4 [bb1 bb2]*4 [f2 f3]*4 [eb2 eb3 eb2 eb3 eb2 eb3 eb2 d2]>")
.sound("gm_synth_bass_2")
._pianoroll()

// til ~ is "no note here"; this line is pushed (note + 1) to accommodate for the "to your soul" line
$: note("<[1 ~ 0 2@2 0 2@2] [2 ~ 0 1@2 0 1@2] [1 ~ 0 3@2 0 3@2] [3 ~ 0 2@2 0 2@2]>")
.sound("piano")
  .scale("c5:minor")
._pianoroll()

// not off by one
_$: note("<[~ 0 2@2 0 2@2 2] [~ 0 1@2 0 1@2 1] [~ 0 3@2 0 3@2 3] [~ 0 2@2 0 2@2 1]>")
.sound("piano")
  .scale("c5:minor")
._pianoroll()