// Franz Liszt - La Campanella
// Using chord and arp modularization based on the Moby example pattern

setcpm(90)

const mychords = {
  Gsm: "0,3,7",    // G# Minor
  Ds:  "0,4,7",    // D# Major
  E:   "0,4,7"     // E Major
}

const myarps = {
  // 6/8 left hand wide leaps (Bass -> Rest -> Rest -> Mid -> Rest -> High)
  jump: "[0 ~ ~ 1 ~ 2]", 
  resolve: "[0 ~ ~ ~ ~ ~]"
}

const mymelody = {
  // The famous "bell" right hand theme
  // Alternating between melody notes and the high D# bell
  m1: "[d#5 d#6 c#5 d#6 d#5 d#6]",
  m2: "[e5 d#6 d#5 d#6 c#5 d#6]",
  m3: "[b4 d#6 a#4 d#6 g#4 d#6]",
  m4: "[g4 d#6 g4 d#6 g#4 d#6]", // G natural acting as F double sharp
  m5: "[a#4 d#6 a#4 d#6 b4 d#6]",
  m6: "[c#5 d#6 c#5 d#6 d#5 d#6]"
}

// Left hand
$: "<g#2 g#2 g#2 d#2 d#2 g#2>"
  .add("<Gsm Gsm Gsm Ds Ds Gsm>".pick(mychords))
  .arp("<jump!5 resolve!1>".pick(myarps))
  .note().s('piano').velocity(0.4)._pianoroll()

// Right hand using the exact same .pick() modular technique
$: "<m1 m2 m3 m4 m5 m6>"
  .pick(mymelody)
  .note().s('piano').velocity(0.6)._pianoroll()
