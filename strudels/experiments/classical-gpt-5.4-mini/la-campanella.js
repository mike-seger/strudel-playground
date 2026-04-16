// Franz Liszt - La Campanella
// composed @by Franz Liszt
// From the Paganini Étude No. 3 theme
setcpm(290/1)

// Right hand - bell theme sketch
$: note(`<
  d#6 ~ d#6 c#6 d#6 ~ b5 ~
  d#6 ~ d#6 c#6 d#6 ~ a#5 ~
  d#6 ~ d#6 c#6 d#6 ~ b5 ~
  d#6 ~ d#6 c#6 d#6 ~ g#5 ~
>`)
  .s('piano').velocity(0.65)
  .room(0.45).roomsize(6)._pianoroll()

// Left hand - jumping accompaniment
$: note(`<
  g#2@2 ~ ~ d#2@2 ~ ~
  g#2@2 ~ ~ d#2@2 ~ ~
  g#2@2 ~ ~ e2@2 ~ ~
  d#2@2 ~ ~ g#2@2 ~ ~
>`)
  .s('piano').velocity(0.42)
  .room(0.45).roomsize(6)
