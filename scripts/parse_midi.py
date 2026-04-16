#!/usr/bin/env python3
"""
Parse MIDI files and display note events grouped by measure.
No external dependencies — uses only the Python standard library.

Usage:
    python3 scripts/parse_midi.py path/to/file.mid
"""
import struct
import sys

NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']


def midi_to_name(n):
    octave = (n // 12) - 1
    return f"{NOTE_NAMES[n % 12]}{octave}"


def read_varlen(data, offset):
    result = 0
    while True:
        b = data[offset]
        offset += 1
        result = (result << 7) | (b & 0x7F)
        if not (b & 0x80):
            break
    return result, offset


def parse_midi(path):
    """Parse a MIDI file and return (tpb, tempos, time_sigs, events).

    Returns:
        tpb: ticks per beat
        tempos: list of (abs_tick, microseconds_per_beat, bpm)
        time_sigs: list of (abs_tick, numerator, denominator)
        events: list of (abs_tick, track_idx, midi_note, velocity, dur_ticks)
    """
    with open(path, 'rb') as f:
        data = f.read()

    assert data[:4] == b'MThd'
    header_len = struct.unpack('>I', data[4:8])[0]
    fmt, num_tracks, tpb = struct.unpack('>HHH', data[8:14])

    offset = 8 + header_len
    all_events = []
    tempos = [(0, 500000, 120.0)]
    time_sigs = [(0, 4, 4)]

    for track_idx in range(num_tracks):
        assert data[offset:offset + 4] == b'MTrk', \
            f"Expected MTrk at {offset}, got {data[offset:offset+4]}"
        track_len = struct.unpack('>I', data[offset + 4:offset + 8])[0]
        track_end = offset + 8 + track_len
        pos = offset + 8

        abs_tick = 0
        notes_on = {}
        running_status = 0

        while pos < track_end:
            delta, pos = read_varlen(data, pos)
            abs_tick += delta
            byte = data[pos]

            if byte == 0xFF:  # Meta event
                pos += 1
                meta_type = data[pos]; pos += 1
                length, pos = read_varlen(data, pos)
                meta_data = data[pos:pos + length]; pos += length

                if meta_type == 0x51:  # Tempo
                    tempo = (meta_data[0] << 16) | (meta_data[1] << 8) | meta_data[2]
                    bpm = 60_000_000 / tempo
                    tempos.append((abs_tick, tempo, bpm))
                elif meta_type == 0x58:  # Time signature
                    num = meta_data[0]
                    den = 2 ** meta_data[1]
                    time_sigs.append((abs_tick, num, den))
                elif meta_type == 0x03:  # Track name
                    name = meta_data.decode('ascii', errors='replace')
                    print(f"  Track {track_idx}: '{name}'", file=sys.stderr)

            elif byte in (0xF0, 0xF7):  # SysEx
                pos += 1
                length, pos = read_varlen(data, pos)
                pos += length

            elif byte & 0x80:  # Status byte
                running_status = byte
                pos += 1
                status = byte & 0xF0

                if status == 0x90:
                    note = data[pos]; pos += 1
                    vel = data[pos]; pos += 1
                    if vel > 0:
                        notes_on[note] = (abs_tick, vel)
                    elif note in notes_on:
                        start, v = notes_on.pop(note)
                        all_events.append((start, track_idx, note, v, abs_tick - start))
                elif status == 0x80:
                    note = data[pos]; pos += 1
                    pos += 1  # skip release velocity
                    if note in notes_on:
                        start, v = notes_on.pop(note)
                        all_events.append((start, track_idx, note, v, abs_tick - start))
                elif status in (0xA0, 0xB0, 0xE0):
                    pos += 2
                elif status in (0xC0, 0xD0):
                    pos += 1
            else:
                # Running status
                status = running_status & 0xF0
                if status == 0x90:
                    note = byte; pos += 1
                    vel = data[pos]; pos += 1
                    if vel > 0:
                        notes_on[note] = (abs_tick, vel)
                    elif note in notes_on:
                        start, v = notes_on.pop(note)
                        all_events.append((start, track_idx, note, v, abs_tick - start))
                elif status == 0x80:
                    note = byte; pos += 1
                    pos += 1
                    if note in notes_on:
                        start, v = notes_on.pop(note)
                        all_events.append((start, track_idx, note, v, abs_tick - start))
                elif status in (0xA0, 0xB0, 0xE0):
                    pos += 2
                elif status in (0xC0, 0xD0):
                    pos += 1

        offset = track_end

    all_events.sort(key=lambda x: (x[0], x[2]))
    return tpb, tempos, time_sigs, all_events, fmt, num_tracks


def print_events(path):
    tpb, tempos, time_sigs, events, fmt, num_tracks = parse_midi(path)

    num, den = time_sigs[0][1], time_sigs[0][2]
    beats_per_measure = num * (4 / den)

    print(f"File: {path}")
    print(f"Format: {fmt}, Tracks: {num_tracks}, Ticks/beat: {tpb}")
    print(f"Time signature: {num}/{den} (beats/measure={beats_per_measure})")
    print(f"Tempo: {tempos[0][2]:.0f} BPM (initial)")
    print(f"Total notes: {len(events)}")
    print(f"\n{'Tick':>7} {'Meas':>5} {'Beat':>7} {'Trk':>4} {'Note':>5}"
          f" {'Vel':>4} {'Dur(t)':>7} {'Dur(b)':>7}")

    current_measure = -1
    ts_idx = 0

    for start, trk, note, vel, dur in events:
        while ts_idx + 1 < len(time_sigs) and time_sigs[ts_idx + 1][0] <= start:
            ts_idx += 1
            num, den = time_sigs[ts_idx][1], time_sigs[ts_idx][2]
            beats_per_measure = num * (4 / den)

        beat = start / tpb
        measure = int(beat / beats_per_measure) + 1
        beat_in_measure = (beat % beats_per_measure) + 1
        dur_beats = dur / tpb

        if measure != current_measure:
            current_measure = measure
            print(f"\n  ---- Measure {measure} ----")

        print(f"{start:>7} {measure:>5} {beat_in_measure:>7.2f} {trk:>4}"
              f" {midi_to_name(note):>5} {vel:>4} {dur:>7} {dur_beats:>7.3f}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <midi_file> [midi_file ...]", file=sys.stderr)
        sys.exit(1)
    for path in sys.argv[1:]:
        print_events(path)
        print("\n" + "=" * 70 + "\n")
