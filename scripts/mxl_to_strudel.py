#!/usr/bin/env python3
"""Convert a MusicXML (.mxl / .musicxml / .xml) file to Strudel mini-notation.

Uses music21 to parse, then outputs two $: note(`<...>`) blocks (RH and LH)
ready to paste into a Strudel .js pattern file.

Usage:
    python3 scripts/mxl_to_strudel.py path/to/score.mxl

Requirements: pip install music21
"""
import re
import sys
from math import gcd
from fractions import Fraction

from music21 import converter, meter, tempo, note, chord, stream


def pitch_to_strudel(p):
    """Convert a music21 Pitch to strudel mini-notation like 'c#4', 'bb3'."""
    name = p.step.lower()
    acc = ''
    if p.accidental:
        alt = int(p.accidental.alter)
        if alt > 0:
            acc = '#' * alt
        elif alt < 0:
            acc = 'b' * abs(alt)
    return f"{name}{acc}{p.octave}"


def measure_to_strudel(m, sixteenths_per_measure):
    """Convert a music21 Measure to a strudel mini-notation line.

    Uses Fraction arithmetic to find the GCD of all durations within the
    measure, then expresses each note as an integer weight relative to that
    GCD.  This correctly handles 32nd notes, triplets, and any subdivision
    without rounding errors.

    Returns a string like "c4@4 [e4,g4]@8 ~@4".
    """
    events = []

    # Gather all notes, chords, and rests with their duration as Fraction
    for el in m.flatten().notesAndRests:
        ql = Fraction(el.duration.quarterLength).limit_denominator(256)
        if ql <= 0:
            continue

        if isinstance(el, chord.Chord):
            pitches = sorted([pitch_to_strudel(p) for p in el.pitches],
                             key=note_sort_key)
            token = f"[{','.join(pitches)}]"
        elif isinstance(el, note.Note):
            token = pitch_to_strudel(el.pitch)
        elif isinstance(el, note.Rest):
            token = '~'
        else:
            continue
        events.append((float(el.offset), ql, token))

    if not events:
        return f"~@{sixteenths_per_measure}"

    # Sort by offset
    events.sort(key=lambda x: x[0])

    # Find GCD of all durations in this measure → the base grid unit
    durations = [ev[1] for ev in events]
    grid = durations[0]
    for d in durations[1:]:
        grid = _fraction_gcd(grid, d)

    # Express each duration as an integer multiple of the grid
    tokens = []
    for _, dur, token in events:
        w = int(dur / grid)
        if w < 1:
            w = 1
        if w != 1:
            tokens.append(f"{token}@{w}")
        else:
            tokens.append(token)

    return ' '.join(tokens)


def _fraction_gcd(a, b):
    """GCD of two Fractions."""
    return Fraction(gcd(a.numerator * b.denominator, b.numerator * a.denominator),
                    a.denominator * b.denominator)


NOTE_ORDER = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}


def note_sort_key(note_str):
    m = re.match(r'([a-g])(#|b)?(\d+)', note_str)
    if not m:
        return 0
    base = NOTE_ORDER.get(m.group(1), 0)
    acc = 1 if m.group(2) == '#' else (-1 if m.group(2) == 'b' else 0)
    octave = int(m.group(3))
    return octave * 12 + base + acc


def compute_setcpm(bpm, sixteenths_per_measure):
    """Compute setcpm value: cpm = bpm * 4 / sixteenths_per_measure."""
    num = int(round(bpm * 4))
    den = sixteenths_per_measure
    g = gcd(num, den)
    num //= g
    den //= g
    if den == 1:
        return str(num)
    return f"{num}/{den}"


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/mxl_to_strudel.py path/to/score.mxl", file=sys.stderr)
        sys.exit(1)

    path = sys.argv[1]
    score = converter.parse(path)

    # Get time signature
    time_sigs = list(score.flat.getElementsByClass(meter.TimeSignature))
    if time_sigs:
        ts = time_sigs[0]
        sixteenths_per_measure = int(ts.barDuration.quarterLength * 4)
    else:
        sixteenths_per_measure = 16  # default 4/4

    # Get tempo (convert to quarter-note BPM regardless of beat unit)
    tempos = list(score.flat.getElementsByClass(tempo.MetronomeMark))
    bpm = 120.0  # default quarter-note BPM
    if tempos:
        t = tempos[0]
        # t.number is BPM in terms of the referent (beat unit)
        # t.referent.quarterLength converts to quarter-note equivalent
        bpm = t.number * t.referent.quarterLength

    setcpm_val = compute_setcpm(bpm, sixteenths_per_measure)

    # Get parts (assume first = RH, second = LH)
    parts = list(score.parts)
    if len(parts) < 2:
        print("WARNING: Expected 2 parts, found", len(parts), file=sys.stderr)

    rh_part = parts[0] if len(parts) > 0 else None
    lh_part = parts[1] if len(parts) > 1 else None

    print(f"// setcpm({setcpm_val})", file=sys.stderr)
    print(f"// Time signature: {ts if time_sigs else '4/4'}", file=sys.stderr)
    print(f"// Tempo: {bpm} BPM", file=sys.stderr)
    print(f"// Sixteenths per measure: {sixteenths_per_measure}", file=sys.stderr)

    # Process RH
    rh_lines = []
    if rh_part:
        for m in rh_part.getElementsByClass(stream.Measure):
            line = measure_to_strudel(m, sixteenths_per_measure)
            rh_lines.append(line)

    # Process LH
    lh_lines = []
    if lh_part:
        for m in lh_part.getElementsByClass(stream.Measure):
            line = measure_to_strudel(m, sixteenths_per_measure)
            lh_lines.append(line)

    print(f"setcpm({setcpm_val})")
    print()
    print("// Right hand")
    print("$: note(`<")
    for line in rh_lines:
        print(f"  {line}")
    print(">`)")
    print("  .s('piano').velocity(0.72)")
    print("  .room(0.35).roomsize(5)._pianoroll()")
    print()
    print("// Left hand")
    print("$: note(`<")
    for line in lh_lines:
        print(f"  {line}")
    print(">`)")
    print("  .s('piano').velocity(0.45)")
    print("  .room(0.35).roomsize(5)")


if __name__ == '__main__':
    main()
