#!/usr/bin/env python3
"""
Convert a MIDI file to a Strudel .js pattern file.
No external dependencies — imports parse_midi.py from the same directory.

Usage:
    python3 scripts/midi_to_strudel.py path/to/file.mid [options]

Options:
    --title NAME        Song title (default: derived from filename)
    --composer NAME     Composer name (default: "Unknown")
    --split NOTE        MIDI note number to split RH/LH (default: 60 = C4)
    --measures M1-M2    Only convert measures M1 through M2 (default: all)
    --velocity FLOAT    Base velocity 0.0-1.0 (default: 0.7)
    --quantize FRAC     Quantize to fraction of a beat: 4=16th, 2=8th, 1=quarter
                        (default: 4)
    --output PATH       Write to file instead of stdout
    --cpm EXPR          setcpm() expression (default: auto from MIDI tempo)
"""
import sys
import os
import argparse
from fractions import Fraction

# Import the parser from the same directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_midi import parse_midi, midi_to_name


def quantize_tick(tick, tpb, quant_frac):
    """Quantize a tick value to the nearest grid position.
    quant_frac: subdivisions per beat (4 = 16th notes, 2 = 8th, 1 = quarter)
    """
    grid = tpb / quant_frac
    return round(tick / grid) * grid


def note_name_lower(midi_note):
    """Convert MIDI note number to lowercase strudel note name."""
    name = midi_to_name(midi_note)
    # Strudel uses lowercase: c4, d#5, etc.
    return name.lower().replace('#', '#')


def ticks_to_beat_duration(dur_ticks, tpb):
    """Convert tick duration to a Fraction of beats."""
    return Fraction(dur_ticks, tpb)


def format_duration(frac):
    """Format a Fraction duration for strudel's @N syntax.
    Returns '' if duration is 1 beat, otherwise '@N' or '@N/D'.
    """
    if frac == 1:
        return ''
    if frac.denominator == 1:
        return f'@{frac.numerator}'
    return f'@{frac.numerator}/{frac.denominator}'


def events_to_measures(events, tpb, time_sigs, measure_range=None):
    """Group events into measures. Each measure is a list of (beat_offset_frac, notes, dur_frac).
    notes is a list of lowercase note names sounding at the same tick.
    """
    # Determine beats per measure from initial time sig
    num, den = time_sigs[0][1], time_sigs[0][2]
    beats_per_measure = Fraction(num * 4, den)

    measures = {}  # measure_num -> list of (beat_offset, [note_names], dur)
    ts_idx = 0

    for start, trk, note, vel, dur in events:
        # Track time sig changes
        while ts_idx + 1 < len(time_sigs) and time_sigs[ts_idx + 1][0] <= start:
            ts_idx += 1
            num, den = time_sigs[ts_idx][1], time_sigs[ts_idx][2]
            beats_per_measure = Fraction(num * 4, den)

        beat = Fraction(start, tpb)
        meas_num = int(beat / beats_per_measure) + 1

        if measure_range and (meas_num < measure_range[0] or meas_num > measure_range[1]):
            continue

        beat_in_measure = beat % beats_per_measure
        dur_frac = Fraction(dur, tpb)

        if meas_num not in measures:
            measures[meas_num] = []
        measures[meas_num].append((beat_in_measure, note_name_lower(note), dur_frac))

    return measures, beats_per_measure


def build_strudel_voice(measures, beats_per_measure, quantize_grid):
    """Convert measure data into a strudel note() pattern string.

    Returns a list of measure strings suitable for joining with newlines.
    """
    if not measures:
        return []

    sorted_meas = sorted(measures.keys())
    lines = []

    for meas_num in sorted_meas:
        events = measures[meas_num]
        # Group by beat offset
        beat_groups = {}
        for beat_off, name, dur in events:
            # Quantize beat offset
            q = Fraction(round(float(beat_off) * quantize_grid), quantize_grid)
            if q not in beat_groups:
                beat_groups[q] = ([], dur)
            beat_groups[q][0].append(name)

        # Build the measure: divide into slots on the quantize grid
        grid_size = Fraction(1, quantize_grid)
        total_slots = int(beats_per_measure / grid_size)

        tokens = []
        slot = Fraction(0)
        pending_rest = 0

        for i in range(total_slots):
            pos = i * grid_size
            if pos in beat_groups:
                # Flush any pending rests
                if pending_rest > 0:
                    rest_dur = format_duration(Fraction(pending_rest, quantize_grid))
                    tokens.append(f'~{rest_dur}')
                    pending_rest = 0

                notes, dur = beat_groups[pos]
                if len(notes) == 1:
                    note_str = notes[0]
                else:
                    # Chord: [note1,note2]
                    note_str = ','.join(sorted(notes))

                # Calculate how many grid slots this note spans
                dur_slots = max(1, round(float(dur) * quantize_grid))
                note_dur = format_duration(Fraction(dur_slots, quantize_grid))
                tokens.append(f'{note_str}{note_dur}')

                # Skip slots consumed by this note's duration beyond the first
                # (handled by the sequential nature of the pattern)
            else:
                # Check if this slot is consumed by a previous long note
                consumed = False
                for prev_pos, (pnotes, pdur) in beat_groups.items():
                    if prev_pos < pos:
                        end = prev_pos + pdur
                        if pos < end:
                            consumed = True
                            break
                if not consumed:
                    pending_rest += 1

        # Flush trailing rests
        if pending_rest > 0:
            rest_dur = format_duration(Fraction(pending_rest, quantize_grid))
            tokens.append(f'~{rest_dur}')

        line = ' '.join(tokens)
        lines.append(f'  {line}')

    return lines


def split_hands(events, split_note=60):
    """Split events into right hand (>= split_note) and left hand (< split_note)."""
    rh = [e for e in events if e[2] >= split_note]
    lh = [e for e in events if e[2] < split_note]
    return rh, lh


def generate_strudel(midi_path, title=None, composer=None, split_note=60,
                     measure_range=None, velocity=0.7, quantize_grid=4,
                     cpm_expr=None):
    """Generate a complete Strudel .js file from a MIDI file."""
    tpb, tempos, time_sigs, events, fmt, num_tracks = parse_midi(midi_path)

    if not title:
        title = os.path.splitext(os.path.basename(midi_path))[0]
    if not composer:
        composer = "Unknown"

    # Determine tempo
    initial_bpm = tempos[0][2]
    if not cpm_expr:
        # Strudel setcpm sets cycles per minute.
        # With time sig N/D, one cycle = one measure = N * (4/D) beats
        num, den = time_sigs[0][1], time_sigs[0][2] if len(time_sigs[0]) > 2 else 4
        beats_per_measure = num * 4 / den
        cpm = initial_bpm / beats_per_measure
        cpm_expr = f"{initial_bpm:.0f}/{beats_per_measure:.0f}"

    # Split into hands
    rh_events, lh_events = split_hands(events, split_note)

    # Build measures
    rh_measures, bpm_frac = events_to_measures(rh_events, tpb, time_sigs, measure_range)
    lh_measures, _ = events_to_measures(lh_events, tpb, time_sigs, measure_range)

    rh_lines = build_strudel_voice(rh_measures, bpm_frac, quantize_grid)
    lh_lines = build_strudel_voice(lh_measures, bpm_frac, quantize_grid)

    # Assemble output
    out = []
    out.append(f'// {title}')
    out.append(f'// composed @by {composer}')
    out.append(f'// Converted from MIDI — {len(events)} notes')
    out.append(f'setcpm({cpm_expr})')
    out.append('')

    if rh_lines:
        out.append('// Right hand')
        out.append('$: note(`<')
        out.extend(rh_lines)
        out.append('>`)')
        out.append(f"  .s('piano').velocity({velocity})")
        out.append(f"  .room(0.35).roomsize(3)._pianoroll()")
        out.append('')

    if lh_lines:
        out.append('// Left hand')
        out.append('$: note(`<')
        out.extend(lh_lines)
        out.append('>`)')
        out.append(f"  .s('piano').velocity({velocity * 0.7:.2f})")
        out.append(f"  .room(0.35).roomsize(3)")

    return '\n'.join(out)


def main():
    parser = argparse.ArgumentParser(
        description='Convert MIDI to Strudel .js pattern file')
    parser.add_argument('midi_file', help='Path to MIDI file')
    parser.add_argument('--title', help='Song title')
    parser.add_argument('--composer', default='Unknown', help='Composer name')
    parser.add_argument('--split', type=int, default=60,
                        help='MIDI note to split RH/LH (default: 60 = C4)')
    parser.add_argument('--measures', help='Measure range M1-M2')
    parser.add_argument('--velocity', type=float, default=0.7,
                        help='Base velocity 0.0-1.0')
    parser.add_argument('--quantize', type=int, default=4,
                        help='Grid subdivisions per beat (4=16th, 2=8th)')
    parser.add_argument('--cpm', help='setcpm() expression override')
    parser.add_argument('--output', '-o', help='Output file path')
    args = parser.parse_args()

    measure_range = None
    if args.measures:
        parts = args.measures.split('-')
        measure_range = (int(parts[0]), int(parts[1]))

    result = generate_strudel(
        args.midi_file,
        title=args.title,
        composer=args.composer,
        split_note=args.split,
        measure_range=measure_range,
        velocity=args.velocity,
        quantize_grid=args.quantize,
        cpm_expr=args.cpm,
    )

    if args.output:
        with open(args.output, 'w') as f:
            f.write(result + '\n')
        print(f"Written to {args.output}", file=sys.stderr)
    else:
        print(result)


if __name__ == '__main__':
    main()
