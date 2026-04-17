#!/usr/bin/env python3
"""Convert a MusicXML (.mxl / .musicxml / .xml) file to Strudel mini-notation.

Uses music21 to parse, then outputs two $: note(`<...>`) blocks (RH and LH)
with onset-based timeline and a global grid for consistent timing.

Each measure line in the Strudel slow-cat `<...>` is guaranteed to sum to
the same total weight (= units_per_measure), so every measure plays for
exactly one cycle at the tempo set by setcpm().

Usage:
    python3 scripts/mxl_to_strudel.py path/to/score.mxl

Requirements: pip install music21
"""
import re
import sys
from math import gcd
from fractions import Fraction

from music21 import converter, meter, tempo, note, chord, stream

# Reduced-fraction denominators that correspond to standard musical
# subdivisions (whole through 64th notes, plus triplets and dots).
# Anything else (e.g. 59ths, 10ths) is treated as an artifact.
STANDARD_DENOMINATORS = frozenset({1, 2, 3, 4, 6, 8, 12, 16, 24, 48})

# Finest allowed grid (quarter-length).  Caps absurdly small GCDs.
MIN_GRID = Fraction(1, 48)


# ------------------------------------------------------------------ helpers

def pitch_to_strudel(p):
    """Convert a music21 Pitch to strudel name like 'c#4', 'bb3'."""
    name = p.step.lower()
    acc = ''
    if p.accidental:
        alt = int(p.accidental.alter)
        if alt > 0:
            acc = '#' * alt
        elif alt < 0:
            acc = 'b' * abs(alt)
    return f"{name}{acc}{p.octave}"


NOTE_ORDER = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}


def note_sort_key(s):
    """Sort key for strudel pitch strings (low to high)."""
    m = re.match(r'([a-g])(#*|b*)(\d+)', s)
    if not m:
        return 0
    base = NOTE_ORDER.get(m.group(1), 0)
    acc_str = m.group(2)
    acc = acc_str.count('#') - acc_str.count('b')
    return int(m.group(3)) * 12 + base + acc


def _fraction_gcd(a, b):
    """GCD of two Fraction values."""
    return Fraction(gcd(a.numerator * b.denominator, b.numerator * a.denominator),
                    a.denominator * b.denominator)


# ------------------------------------------------------------------ grid

def compute_global_grid(score, measure_ql):
    """Find the finest grid ql that divides all standard note-onset offsets
    and the measure duration.

    Offsets with non-standard denominators (MusicXML artifacts like 8/59)
    are excluded so they don't shrink the GCD to an impractical value.
    Such onsets are rounded to the nearest grid position at render time.
    """
    values = {measure_ql}
    for part in score.parts:
        for m in part.getElementsByClass(stream.Measure):
            for el in m.flatten().notesAndRests:
                off = Fraction(el.offset).limit_denominator(256)
                if off > 0:
                    values.add(off)

    standard = [v for v in values
                if v > 0 and v.limit_denominator(256).denominator
                in STANDARD_DENOMINATORS]
    if not standard:
        standard = [v for v in values if v > 0]
    if not standard:
        return Fraction(1, 4)

    g = standard[0]
    for v in standard[1:]:
        g = _fraction_gcd(g, v)

    return max(g, MIN_GRID)


# ------------------------------------------------------------------ measure

def measure_to_strudel(m, grid_ql, units_per_measure):
    """Onset-based conversion of a single measure.

    1. Collects every note/chord attack with its quantised grid position.
    2. Merges simultaneous attacks (multi-voice) into chords.
    3. Derives durations from onset-to-onset intervals.
    4. Total weight always equals *units_per_measure*.
    """
    # ---- collect attacks by grid position ----
    onsets = {}                       # grid_pos -> set(pitch_str)
    for el in m.flatten().notes:      # notes + chords, NOT rests
        off = Fraction(el.offset).limit_denominator(256)
        gp = int(round(float(off / grid_ql)))
        gp = max(0, min(gp, units_per_measure - 1))

        pitches = set()
        if isinstance(el, chord.Chord):
            for p in el.pitches:
                pitches.add(pitch_to_strudel(p))
        elif isinstance(el, note.Note):
            pitches.add(pitch_to_strudel(el.pitch))

        if pitches:
            onsets.setdefault(gp, set()).update(pitches)

    if not onsets:
        return f"~@{units_per_measure}"

    # ---- handle pickup / anacrusis ----
    padding = Fraction(getattr(m, 'paddingLeft', 0) or 0).limit_denominator(256)
    if padding > 0:
        pad = int(round(float(padding / grid_ql)))
        shifted = {}
        for gp, p in onsets.items():
            new_gp = min(gp + pad, units_per_measure - 1)
            shifted.setdefault(new_gp, set()).update(p)
        onsets = shifted

    positions = sorted(onsets)

    # ---- build weighted events ----
    events = []
    if positions[0] > 0:
        events.append((positions[0], None))           # leading rest
    for i, pos in enumerate(positions):
        nxt = positions[i + 1] if i + 1 < len(positions) else units_per_measure
        events.append((nxt - pos, sorted(onsets[pos], key=note_sort_key)))

    # ---- render tokens ----
    tokens = []
    for w, pitches in events:
        if w < 1:
            continue
        if pitches is None:
            tok = '~'
        elif len(pitches) == 1:
            tok = pitches[0]
        else:
            tok = f"[{','.join(pitches)}]"
        tokens.append(f"{tok}@{w}" if w != 1 else tok)

    return ' '.join(tokens)


# ------------------------------------------------------------------ setcpm

def compute_setcpm(bpm, measure_ql):
    """setcpm = measures per minute = quarter-BPM / measure_ql."""
    r = Fraction(bpm).limit_denominator(1000) / Fraction(measure_ql)
    return str(r.numerator) if r.denominator == 1 else f"{r.numerator}/{r.denominator}"


# ------------------------------------------------------------------ main

def main():
    if len(sys.argv) < 2:
        print("Usage: mxl_to_strudel.py <score.mxl>", file=sys.stderr)
        sys.exit(1)

    score = converter.parse(sys.argv[1])

    # time signature (first encountered)
    ts_list = list(score.flat.getElementsByClass(meter.TimeSignature))
    ts = ts_list[0] if ts_list else None
    measure_ql = Fraction(ts.barDuration.quarterLength) if ts else Fraction(4)

    # tempo -> quarter-note BPM
    tempos = list(score.flat.getElementsByClass(tempo.MetronomeMark))
    if tempos:
        t = tempos[0]
        bpm = t.number * t.referent.quarterLength
    else:
        bpm = 120.0

    grid_ql = compute_global_grid(score, measure_ql)
    upm = int(measure_ql / grid_ql)
    cpm = compute_setcpm(bpm, measure_ql)

    print(f"// grid={grid_ql} ql -> {upm} units/measure", file=sys.stderr)
    print(f"// setcpm({cpm})  ts={ts or '4/4'}  bpm={bpm}", file=sys.stderr)

    parts = list(score.parts)
    if len(parts) < 2:
        print(f"WARNING: Expected 2 parts, found {len(parts)}", file=sys.stderr)

    rh = parts[0] if parts else None
    lh = parts[1] if len(parts) > 1 else None

    def convert_part(part):
        lines = []
        if part:
            for m_obj in part.getElementsByClass(stream.Measure):
                lines.append(measure_to_strudel(m_obj, grid_ql, upm))
        return lines

    rh_lines = convert_part(rh)
    lh_lines = convert_part(lh)

    print(f"setcpm({cpm})")
    print()
    print("// Right hand")
    print("$: note(`<")
    for ln in rh_lines:
        print(f"  {ln}")
    print(">`)")
    print("  .s('piano').velocity(0.72)")
    print("  .room(0.35).roomsize(5)._pianoroll()")
    print()
    print("// Left hand")
    print("$: note(`<")
    for ln in lh_lines:
        print(f"  {ln}")
    print(">`)")
    print("  .s('piano').velocity(0.45)")
    print("  .room(0.35).roomsize(5)")


if __name__ == '__main__':
    main()
