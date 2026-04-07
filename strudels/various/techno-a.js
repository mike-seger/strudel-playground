samples('github:AustinOliverHaskell/ms-teams-sounds-strudel')


BEAT: s("[[bd hh] [bd hh] [bd hh] [bd hh]]").bank("rolandtr909").lpf(6000).gain(1.5)._scope()

_BEAT_2: sound("alarm").slice(4, "1").lpf(500)

$AHHHH: sound("ring").slice(16, "1").speed("<-2 -2 -2>").fast(4).gain(2.0).room(1).roomsize(10.0).hpf(1500)._scope()

HUMMMMMM: sound("remix").slice(8, "0 4 0 4").fast(8).lpf(200).gain(0.5)._scope()

UNEDITED_SAMPLE: sound("ring").mask("0 1 0 1 0")

//SAMPLE: arrange(
//    [10, sound("ring").slice(16, "1 <1 1 1 3 4 4>").speed("<-1 2>")],
//    [4, sound("ring").slice(16, "1 <[3 4] [3 4] [3 4] [3 4] [3 4] [3 4]>").speed("<-1 3 -1 -1>")]
//).gain(1.50).fast(2)

_UNEDITED_SAMPLE: sound("ring").slice(8, "<0 1 2 3 4 5 6 7>*2")
_UNEDITED_SAMPLE_REMIX: sound("remix").slice(8, "<0 1 2 3 4 5 6 7>*2")
//HUM: n("<1 2 3 4 3 4 3 2 1 0>*32").scale("A:Major").lpf(200)