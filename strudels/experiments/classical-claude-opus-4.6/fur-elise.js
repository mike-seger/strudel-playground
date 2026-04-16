// Für Elise (Bagatelle No. 25 in A minor)
// composed @by Ludwig van Beethoven
// WoO 59 - main theme
setcpm(130/2)

// Right hand - iconic opening theme
$: note(`<
  [e5 d#5] [e5 d#5 e5 b4 d5 c5] [a4@2 ~]
  [~ c4 e4 a4] [b4@2 ~] [~ e4 g#4 b4]
  [c5@2 ~] [~ e4 e5 d#5] [e5 d#5 e5 b4 d5 c5]
  [a4@2 ~] [~ c4 e4 a4] [b4@2 ~]
  [~ e4 c5 b4] [a4@2 ~] [~ e4 e5 d#5]

  [e5 d#5] [e5 d#5 e5 b4 d5 c5] [a4@2 ~]
  [~ c4 e4 a4] [b4@2 ~] [~ e4 g#4 b4]
  [c5@2 ~] [~ e4 e5 d#5] [e5 d#5 e5 b4 d5 c5]
  [a4@2 ~] [~ c4 e4 a4] [b4@2 ~]
  [~ e4 c5 b4] [a4@2 ~] ~
>`)
  .s('piano').velocity(0.75)
  .room(0.5).roomsize(5)._pianoroll()

// Left hand - bass accompaniment
$: note(`<
  ~ ~ [a2 [e3,a3,c4]]
  [a2 [e3,a3,c4]] [e2 [e3,g#3,b3]] [e2 [e3,g#3,b3]]
  [a2 [e3,a3,c4]] ~ ~
  [a2 [e3,a3,c4]] [a2 [e3,a3,c4]] [e2 [e3,g#3,b3]]
  [e2 [e3,g#3,b3]] [a2 [e3,a3,c4]] ~

  ~ ~ [a2 [e3,a3,c4]]
  [a2 [e3,a3,c4]] [e2 [e3,g#3,b3]] [e2 [e3,g#3,b3]]
  [a2 [e3,a3,c4]] ~ ~
  [a2 [e3,a3,c4]] [a2 [e3,a3,c4]] [e2 [e3,g#3,b3]]
  [e2 [e3,g#3,b3]] [a2 [e3,a3,c4]] ~
>`)
  .s('piano').velocity(0.45)
  .room(0.5).roomsize(5)
