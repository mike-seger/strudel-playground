/*
  @title   Switch Angel's live trance music coding demo
  @by      AngelVision@im_switch_angel
  @url     https://instagram.com/lildata.music
*/

// Retyping of Switch Angel's live trance music coding demo from https://www.youtube.com/watch?v=GWXCCBsOMSg
//
// This includes the inlined custom functions used in the demo,
// lifted from https://github.com/switchangel/strudel-scripts/blob/main/allscripts(deprecated).js
//

setCpm(140/4)

// lpf between 0 and 1
register('rlpf', (x, pat) => { return pat.lpf(pure(x).mul(12).pow(4)) })

//hpf between 0 and 1
register('rhpf', (x, pat) => { return pat.hpf(pure(x).mul(12).pow(4)) })

register('o', (orbit, pat) => pat.orbit(orbit))

register('trancegate', (density, seed, length, x) => {
  console.log(x);
  return x.struct(
    rand.mul(density).round().seg(16).rib(seed, length)
  ).fill(0.8).clip(.8)
})

$: s("bd:2!4")._scope()
$: n("<3@3 4 5 @3 6>*2".add("-14,-21"))
  .s("supersaw")
  .scale("g:minor")
  //.trancegate(1.5,45,2)
  .seg(16)
  .o(2)
  .rlpf(slider(0.539))
  .lpenv(2)
  .gain(1.4)
  ._pianoroll()

$: n("0@2 <-7 [-5 -2]>@3 <0 -3 1 2>@3".add("7,-7")
     .add("<5 4 0 <0 2>>"))
  .s("supersaw")
  .scale("g:minor")
  .trancegate(1.5,45,2)
  .o(3)
  .delay(0.4).pan(rand)
  .rlpf(slider(0.925))
  .lpenv(2)
  ._pianoroll()
$: s("pulse!16").dec(.1).fm(time).fmh(time).o(4)


// $: s("supersaw").trancegate(1.5,45,2).o(2).rlpf(slider(1))

// $: n("0".add(-14)).scale("g:minor").s("supersaw").trancegate(1.5,45,1).o(2).rlpf(slider(0.575))