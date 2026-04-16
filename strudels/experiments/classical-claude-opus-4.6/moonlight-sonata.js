// Moonlight Sonata (Piano Sonata No. 14)
// composed @by Ludwig van Beethoven
// Op. 27, No. 2 - 1st movement (Adagio sostenuto)
setcpm(56/4)

// Right hand - triplet arpeggios
$: note(`<
  [g#3 c#4 e4]*3 [g#3 c#4 e4]*3
  [g#3 c#4 e4]*3 [g#3 c#4 e4]*3
  [a3 c#4 e4]*3 [a3 c#4 e4]*3
  [a3 d4 f#4]*3 [g#3 b3 e4]*3

  [g#3 c#4 e4]*3 [g#3 c#4 e4]*3
  [g#3 c#4 e4]*3 [g#3 c#4 e4]*3
  [a3 c#4 e4]*3 [a3 d4 f#4]*3
  [g#3 b3 e4]*3 [g#3 c#4 e4]*3
>`)
  .s('piano').velocity(0.4)
  .room(0.7).roomsize(8).roomdim(3000)._pianoroll()

// Melody - upper voice (emerges from arpeggios)
$: note(`<
  ~@2 ~@2
  [~ g#4] [~ a4] [~ f#4] [~ e4]
  [~ g#4] [~ a4]
  [~ a4] [~ g#4]

  ~@2 ~@2
  [~ g#4] [~ a4] [~ f#4] [~ e4]
  [~ a4] [~ g#4]
  [~ e4] [~ e4]
>`)
  .s('piano').velocity(0.65)
  .room(0.7).roomsize(8).roomdim(3000)

// Bass - sustained notes
$: note(`<
  c#2@2 c#2@2
  a1@2 d2 e2
  c#2@2 c#2@2
  a1@2 e2 c#2
>`)
  .s('piano').velocity(0.5)
  .room(0.7).roomsize(8).roomdim(3000)
