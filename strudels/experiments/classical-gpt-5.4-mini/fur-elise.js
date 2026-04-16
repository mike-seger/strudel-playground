// Für Elise (Bagatelle No. 25 in A minor)
// composed @by Ludwig van Beethoven
// WoO 59 - main theme
setcpm(330/1)

// Right hand - iconic opening theme
$: note(`<
  e5 d#5 e5 d#5 e5 b4 d5 c5 a4
  [c5 e5 a5] b4 e4 g#4 b4 c5 e5
  e5 d#5 e5 d#5 e5 b4 d5 c5 a4
  [c5 e5 a5] b4 e4 g#4 b4 a4 ~
>`)
  .s('piano').velocity(0.75)
  .room(0.5).roomsize(5)._pianoroll()

// Left hand - bass accompaniment
$: note(`<
  a2@2 e3@2 a2@2 e3@2
  a2@2 e3@2 e2@2 b2@2
  a2@2 e3@2 a2@2 e3@2
  a2@2 e3@2 e2@2 a2@2
>`)
  .s('piano').velocity(0.45)
  .room(0.5).roomsize(5)
