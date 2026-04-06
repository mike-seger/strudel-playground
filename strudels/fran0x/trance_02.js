register('o', (orbit, pat) => pat.orbit(orbit))

register('fill', function (pat) {
  return new Pattern(function (state) {
    const lookbothways = 1;
    const haps = pat.query(
      state.withSpan(span =>
        new TimeSpan(span.begin.sub(lookbothways), span.end.add(lookbothways))
      )
    );
    const onsets = haps.map(hap => hap.whole.begin)
      .sort((a, b) => a.compare(b))
      .filter((x, i, arr) => i == (arr.length - 1) || x.ne(arr[i + 1]));
    const newHaps = [];
    for (const hap of haps) {
      if (hap.part.begin.gte(state.span.end)) continue;
      const next = onsets.find(onset => onset.gte(hap.whole.end));
      if (next.lte(state.span.begin)) continue;

      const whole = new TimeSpan(hap.whole.begin, next);
      const part  = new TimeSpan(
        hap.part.begin.max(state.span.begin),
        next.min(state.span.end)
      );
      newHaps.push(new Hap(whole, part, hap.value, hap.context, hap.stateful));
    }
    return newHaps;
  });
});

register('trancegate', (density, seed, length, x) => {
  return x.struct(rand.mul(density).round().seg(16).rib(seed, length)).fill().clip(.7)
})

register('rlpf', (x, pat) => { return pat.lpf(pure(x).mul(12).pow(4)) })

setCpm(140/4)
setGainCurve(x => Math.pow(x, 2))

$: s("bd:2!4")
  .duck("3:4:5:6")
  .duckdepth(.8)
  .duckattack(.16)
  ._scope()

$: n("0".add(-14))
  .scale("g:minor")
  .s("supersaw")
  .trancegate(1.5,45,1).o(2)
  .detune(.35).unison(3) 
  .rlpf(.5)               
  .room(.25).size(.9)     
  .lpenv(2)

$: n("0@2 <0 2 4 6 7 7 _ 4 2>@3 <0 -3 2 1>@3".add(7))
  .scale("g:minor")
  .s("supersaw")
  .trancegate(1.7,90,1).o(3) 
  .distort(0.7)
  .superimpose((x) => x.detune("<0.5>"))
  .detune(.4).unison(4)      
  .delay(.7).pan(rand)
  .rlpf(.7)             
  .room(.3).size(.95)
  .lpenv(2)
  ._scope()

$: s("white").clip(0).gain(0)
  .color("<[#00FF88 #000000]>")
  .punchcard({
    vertical: 1,
    flipTime: 1,
    fold: 0,
    stroke: 1,
    playheadColor: 'rgba(0, 0, 0, 0)',
    fontFamily: "x3270"
  })
