// Mozart - Rondo Alla Turca
// composed @by Wolfgang Amadeus Mozart
// A theme sketch in the same note(<...>) style as the example
setcpm(140/0.5)

// Right hand - melody outline
$: note(`<
  e5 d5 c5 b4 a4 b4 c5 d5
  e5 d5 c5 b4 a4 g4 a4 b4
  c5 b4 a4 g4 a4 b4 c5 d5
  e5 d5 c5 b4 a4 g4 a4 e4
>`)
  .s('piano').velocity(0.72)
  .room(0.35).roomsize(5)._pianoroll()

// Left hand - classical accompaniment
$: note(`<
  a2@2 e3@2 a3@2 e3@2
  a2@2 e3@2 a3@2 e3@2
  a2@2 e3@2 a3@2 e3@2
  e2@2 b2@2 e3@2 b2@2
>`)
  .s('piano').velocity(0.45)
  .room(0.35).roomsize(5)
