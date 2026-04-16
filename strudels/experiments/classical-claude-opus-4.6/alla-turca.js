// Mozart - Rondo Alla Turca (K.331, 3rd Movement)
// composed @by Wolfgang Amadeus Mozart
setcpm(560/1)

// Right hand - A minor ornamental theme + contrasting passage
$: note(`<
  b4 a4 g#4 a4 c5@2 ~@2
  d5 c5 b4 c5 e5@2 ~@2
  f5 e5 d#5 e5 b5 a5 g#5 a5
  b5 a5 g#5 a5 c6@2 ~@2
  b4 a4 g#4 a4 c5@2 ~@2
  d5 c5 b4 c5 e5@2 ~@2
  f5 e5 d#5 e5 b5 a5 g#5 a5
  a5@4 ~@4
  c5 d5 e5 f5 e5 d5 c5 b4
  a4 b4 c5 d5 c5 b4 a4 g#4
  a4 b4 c5 d5 e5 f5 e5 d5
  c5@2 b4@2 a4@2 ~@2
  b4 a4 g#4 a4 c5@2 ~@2
  d5 c5 b4 c5 e5@2 ~@2
  f5 e5 d#5 e5 b5 a5 g#5 a5
  a5@4 ~@4
>`)
  .s('piano').velocity(0.72)
  .room(0.35).roomsize(5)._pianoroll()

// Left hand - accompaniment
$: note(`<
  [a2,e3]@4 [a3,c4]@4
  [a2,e3]@4 [a3,c4]@4
  [d3,f3]@4 [d3,a3]@4
  [e3,g#3]@4 [e3,b3]@4
  [a2,e3]@4 [a3,c4]@4
  [a2,e3]@4 [a3,c4]@4
  [d3,f3]@4 [d3,a3]@4
  [a2,c3,e3]@4 ~@4
  [a2,c3,e3]@4 [a2,c3,e3]@4
  [a2,c3,e3]@4 [e2,g#2,b2]@4
  [a2,c3,e3]@4 [d3,f3,a3]@4
  [e2,g#2,b2]@4 [e2,g#2,b2]@4
  [a2,e3]@4 [a3,c4]@4
  [a2,e3]@4 [a3,c4]@4
  [d3,f3]@4 [d3,a3]@4
  [a2,c3,e3]@4 ~@4
>`)
  .s('piano').velocity(0.45)
  .room(0.35).roomsize(5)
