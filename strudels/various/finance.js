/* man in finance @by v10101a 
+ "das ist bass" @by enelg,froos
*/

samples({
  finance:  ['man-in-finance/finance_00.wav', 'man-in-finance/finance_01.wav', 'man-in-finance/finance_02.wav', 'man-in-finance/murrayhill.wav']
}, 'github:sandpills/v10101a-samples/main/');


$: n("<1 0>").s("finance").slow(2).clip(1)
  .mask("<1 1 1 0>/4")

$: n("0").s("finance").slow(2).clip(1.4)
  .struct("1(<3 5>,8)")
  .mask("<0 0 0 1>/4").gain(0.8).room(1.2)

$: note("<a1 c2>/2")
.sound("supersaw")
.euclidLegato(9,16)
.ftype('24db')
.lpf(tri.rangex(2000,400).slow(8))
.lpenv(6)
.dist("2:.4")
.echo(2, 1/16, .7)
.mul(gain("[.5 1!3]*4")) //side chain
.add(note("<[0 5]*4 [5 10]*4>"))
// .hush()

$: s("oh*16")
  .bank("RolandTR909")
  .decay(sine.range(.2,.4))
  .dist("1:.3")
  .mul(gain("[<0!3 1> .2 1 <0!3 .2>]*4")) //groove
  .mul(gain("[.2 1!3]*4")) //side chain
  .pan(tri.range(.7,.3))
  .hpf(800)
  .room(.1)
  .mask("<0 1>/8")
  // .hush()

$: s("bd*4").bank('RolandTR909').dist("1:1")

.scope()
// @version 1.1
