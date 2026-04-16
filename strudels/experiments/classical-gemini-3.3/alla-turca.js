// Mozart - Rondo Alla Turca
// Using chord and arp modularization based on the Moby example

setcpm(132/2)

const mychords = {
  Am: "0,3,7",     // A Minor
  E:  "0,4,7",     // E Major
  C:  "0,4,7",     // C Major
  G:  "0,4,7"      // G Major
}

const myarps = {
  march: "0 [1,2] ~ [1,2]", 
  resolve: "0 ~ ~ ~"
}

const mymelody = {
  m1: "[b4 a4 g#4 a4] c5 ~",
  m2: "[d5 c5 b4 c5] e5 ~",
  m3: "[f5 e5 d#5 e5] [b5 a5 g#5 a5]",
  m4: "[b5 a5 g#5 a5] [c6 c5 b4 a4]",
  m5: "[g#4 a4 b4 a4] [g#4 f#4 e4 d4]",
  m6: "c4 b3 a3 ~"
}

// Left hand
$: "<a2!4 c3!2 g2!2 a2!2 e2!2 a2!2!2>"
  .add("<Am!4 C!2 G!2 Am!2 E!2 Am!4>".pick(mychords))
  .arp("<march!15 resolve!1>".pick(myarps))
  .note().s('piano').velocity(0.4)._pianoroll()

// Right hand using the exact same .pick() modular technique
$: "<m1 m2 m3 m4 m5 m6>"
  .pick(mymelody)
  .note().s('piano').velocity(0.6)._pianoroll()
