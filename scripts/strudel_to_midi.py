#!/usr/bin/env python3
"""
Convert a Strudel .js piano file (using note(`<...>`) blocks) to a MIDI file.
No external dependencies — writes the MIDI binary format directly.

Usage:
    python3 scripts/strudel_to_midi.py  strudels/classical/alla-turca.js  [-o output.mid]
"""
import re
import struct
import sys
import os
import argparse

# ── Note name → MIDI number ──────────────────────────────────────────────
NOTE_MAP = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}


def note_to_midi(name):
    """Convert e.g. 'c#4', 'eb3', 'a5' to a MIDI note number."""
    m = re.match(r'^([a-g])(#|b)?(-?\d+)$', name.strip().lower())
    if not m:
        return None
    letter, accidental, octave = m.group(1), m.group(2), int(m.group(3))
    midi = NOTE_MAP[letter] + (octave + 1) * 12
    if accidental == '#':
        midi += 1
    elif accidental == 'b':
        midi -= 1
    return midi


# ── Strudel pattern parser ───────────────────────────────────────────────
def extract_note_blocks(js_text):
    """Return list of (velocity_float, num_slowcat_lines, pattern_string) from note(`<...>`) blocks."""
    blocks = []
    # Find all note(`< ... >`) with their chained .velocity(N)
    pattern = re.compile(
        r"""\$:\s*note\(\s*`\s*<(.*?)>\s*`\s*\)(.+?)(?=\n\n|\n//|\n\$:|\Z)""",
        re.DOTALL,
    )
    for m in pattern.finditer(js_text):
        body = m.group(1)
        chain = m.group(2)
        vel = 0.7
        vm = re.search(r'\.velocity\(([0-9.]+)\)', chain)
        if vm:
            vel = float(vm.group(1))
        # Count non-empty lines = slow-cat elements
        num_lines = len([l for l in body.strip().splitlines() if l.strip()])
        blocks.append((vel, max(1, num_lines), body))
    return blocks


def parse_tokens(body):
    """Parse the inside of a <...> block into a flat list of (note_names_or_rest, duration_beats).

    Supports:
      - plain notes:  c4  d#5  eb3
      - rests:        ~
      - duration:     c4@2  ~@3  c4@1/2
      - chords:       [c4,e4,g4]  or  [c4 e4 g4]  (simultaneous)
      - repetition:   [g#3 c#4 e4]*3
    """
    # Normalise whitespace; collapse newlines
    body = ' '.join(body.split())
    events = []
    i = 0
    tokens = tokenize(body)
    for tok, dur in tokens:
        events.append((tok, dur))
    return events


def tokenize(body):
    """Yield (content, duration_beats) tokens from the pattern body."""
    i = 0
    n = len(body)
    while i < n:
        if body[i] in ' \t\n':
            i += 1
            continue

        if body[i] == '[':
            # Find matching ]
            depth = 1
            j = i + 1
            while j < n and depth > 0:
                if body[j] == '[':
                    depth += 1
                elif body[j] == ']':
                    depth -= 1
                j += 1
            bracket_content = body[i + 1:j - 1]
            i = j

            # Check for *N repetition
            repeat = 1
            if i < n and body[i] == '*':
                m = re.match(r'\*(\d+)', body[i:])
                if m:
                    repeat = int(m.group(1))
                    i += len(m.group(0))

            # Check for @dur
            dur = parse_at_duration(body, i)
            if dur is not None:
                dur_val, consumed = dur
                i += consumed
            else:
                dur_val = None  # will be calculated

            # Determine if chord (comma-separated) or sub-sequence (space-separated)
            if ',' in bracket_content:
                # Chord: notes play simultaneously
                notes = [n.strip() for n in bracket_content.split(',')]
                note_dur = dur_val if dur_val else 1.0
                for _ in range(repeat):
                    yield (notes, note_dur)
            else:
                # Sub-sequence: notes divide the beat equally
                sub_tokens = bracket_content.split()
                count = len(sub_tokens) * repeat
                each_dur = (dur_val if dur_val else 1.0) / count
                for _ in range(repeat):
                    for st in sub_tokens:
                        if st == '~':
                            yield ('~', each_dur)
                        else:
                            yield ([st], each_dur)
        elif body[i] == '~':
            i += 1
            dur = parse_at_duration(body, i)
            if dur is not None:
                dur_val, consumed = dur
                i += consumed
            else:
                dur_val = 1.0
            yield ('~', dur_val)
        else:
            # Plain note token
            m = re.match(r'[a-gA-G][#b]?\d+', body[i:])
            if m:
                note_name = m.group(0)
                i += len(note_name)
                dur = parse_at_duration(body, i)
                if dur is not None:
                    dur_val, consumed = dur
                    i += consumed
                else:
                    dur_val = 1.0
                yield ([note_name], dur_val)
            else:
                i += 1  # skip unknown


def parse_at_duration(body, i):
    """If body[i:] starts with @N or @N/D, return (float_value, chars_consumed)."""
    if i >= len(body) or body[i] != '@':
        return None
    m = re.match(r'@(\d+)(?:/(\d+))?', body[i:])
    if not m:
        return None
    num = int(m.group(1))
    den = int(m.group(2)) if m.group(2) else 1
    return (num / den, len(m.group(0)))


# ── Extract setcpm() ─────────────────────────────────────────────────────
def extract_cpm(js_text):
    """Return cycles per minute from setcpm(expr)."""
    m = re.search(r'setcpm\((.+?)\)', js_text)
    if m:
        try:
            return eval(m.group(1))
        except Exception:
            return 120
    return 120


# ── MIDI writer (no dependencies) ────────────────────────────────────────
def write_varlen(value):
    buf = []
    buf.append(value & 0x7F)
    value >>= 7
    while value:
        buf.append((value & 0x7F) | 0x80)
        value >>= 7
    return bytes(reversed(buf))


def build_midi(tracks_data, tpb=480, bpm=120):
    """Build a complete MIDI file as bytes.

    tracks_data: list of lists of (abs_tick, midi_note, velocity, dur_ticks)
    """
    num_tracks = len(tracks_data)
    # Header
    header = b'MThd' + struct.pack('>I', 6) + struct.pack('>HHH', 1, num_tracks, tpb)

    track_chunks = []
    for track_events in tracks_data:
        raw = b''
        # Tempo meta event at tick 0
        us_per_beat = int(60_000_000 / bpm)
        raw += write_varlen(0)
        raw += bytes([0xFF, 0x51, 0x03])
        raw += struct.pack('>I', us_per_beat)[1:]  # 3 bytes

        # Sort events, build note-on / note-off pairs
        midi_events = []
        for abs_tick, note, vel, dur in sorted(track_events):
            midi_events.append((abs_tick, 0x90, note, vel))
            midi_events.append((abs_tick + dur, 0x80, note, 0))
        midi_events.sort(key=lambda e: (e[0], e[1]))

        prev_tick = 0
        for abs_tick, status, note, vel in midi_events:
            delta = abs_tick - prev_tick
            raw += write_varlen(delta)
            raw += bytes([status, note, vel])
            prev_tick = abs_tick

        # End of track
        raw += write_varlen(0) + bytes([0xFF, 0x2F, 0x00])
        track_chunks.append(b'MTrk' + struct.pack('>I', len(raw)) + raw)

    return header + b''.join(track_chunks)


# ── Main conversion ──────────────────────────────────────────────────────
def convert(js_path, output_path, bpm_override=None):
    with open(js_path) as f:
        js_text = f.read()

    cpm = extract_cpm(js_text)
    blocks = extract_note_blocks(js_text)

    if not blocks:
        print("No note(`<...>`) blocks found.", file=sys.stderr)
        sys.exit(1)

    # Each cycle = 1 measure. cpm = cycles/min → bpm_for_cycle = cpm
    # We treat 1 beat in the pattern = 1 quarter note in MIDI
    # So BPM = cpm * beats_per_cycle.  We need to figure out beats_per_cycle
    # from the pattern.  For simplicity, count the total beats in the first
    # block and divide by number of lines (= measures in the <> slow-cat).

    tpb = 480
    tracks_data = []
    max_slowcat_lines = 1

    for vel_float, num_lines, body in blocks:
        max_slowcat_lines = max(max_slowcat_lines, num_lines)
        events_list = parse_tokens(body)
        if not events_list:
            continue

        vel_midi = max(1, min(127, int(vel_float * 127)))
        midi_events = []
        tick = 0

        for token, dur_beats in events_list:
            dur_ticks = int(dur_beats * tpb)
            if token != '~' and isinstance(token, list):
                for note_name in token:
                    mn = note_to_midi(note_name)
                    if mn is not None:
                        midi_events.append((tick, mn, vel_midi, dur_ticks))
            tick += dur_ticks

        tracks_data.append(midi_events)

    # In Strudel's <...> (slow-cat), each non-empty line plays for one cycle.
    # cpm = cycles per minute.  total_beats across ALL lines is spread over
    # max_slowcat_lines cycles.  So beats_per_cycle = total / num_cycles.
    # MIDI BPM = beats_per_cycle * cpm.
    total_ticks = 0
    if tracks_data:
        total_ticks = max(
            (max((e[0] + e[3] for e in t), default=0) for t in tracks_data),
            default=0,
        )
    total_beats = total_ticks / tpb if total_ticks else 4
    beats_per_cycle = total_beats / max_slowcat_lines
    computed_bpm = beats_per_cycle * cpm

    if bpm_override is not None:
        bpm = bpm_override
        print(f"Using BPM override: {bpm} (auto-detected was {computed_bpm:.0f})", file=sys.stderr)
    elif computed_bpm > 300:
        # Likely a bad setcpm value; fall back to cpm as BPM (treat each
        # cycle = 1 beat, which often gives a musically reasonable result)
        bpm = min(cpm, 300)
        print(f"Auto-detected BPM≈{computed_bpm:.0f} seems too high "
              f"(setcpm={cpm}, {beats_per_cycle:.0f} beats/cycle). "
              f"Clamping to {bpm:.0f}. Use --bpm to override.", file=sys.stderr)
    else:
        bpm = computed_bpm

    midi_bytes = build_midi(tracks_data, tpb=tpb, bpm=bpm)

    with open(output_path, 'wb') as f:
        f.write(midi_bytes)

    print(f"Wrote {output_path}  ({len(tracks_data)} tracks, "
          f"{sum(len(t) for t in tracks_data)} notes, "
          f"BPM≈{bpm:.0f})", file=sys.stderr)


def main():
    p = argparse.ArgumentParser(description='Convert Strudel .js to MIDI')
    p.add_argument('input', help='Strudel .js file')
    p.add_argument('-o', '--output', help='Output .mid path (default: same name .mid)')
    p.add_argument('--bpm', type=float, help='Override BPM (default: auto from setcpm)')
    args = p.parse_args()

    out = args.output
    if not out:
        out = os.path.splitext(args.input)[0] + '.mid'

    convert(args.input, out, bpm_override=args.bpm)


if __name__ == '__main__':
    main()
