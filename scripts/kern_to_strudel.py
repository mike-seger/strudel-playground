#!/usr/bin/env python3
"""Convert a Humdrum Kern score to Strudel mini-notation.

Reads a .krn file and outputs two $: note(`<...>`) blocks (RH and LH)
ready to paste into a Strudel .js pattern file.

Usage:
    python3 scripts/kern_to_strudel.py path/to/score.krn

The Kern file must use *> section markers and the norep expansion order.
Voice splits (*^/*v), grace notes, and chords are handled automatically.
"""
import re
import sys

NOTE_ORDER = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}


def note_sort_key(note_str):
    m = re.match(r'([a-g])(#|b)?(\d+)', note_str)
    if not m:
        return 0
    base = NOTE_ORDER.get(m.group(1), 0)
    acc = 1 if m.group(2) == '#' else (-1 if m.group(2) == 'b' else 0)
    octave = int(m.group(3))
    return octave * 12 + base + acc


def kern_to_strudel_pitch(token):
    """Convert a kern pitch token like 'cc#', 'BB-', 'eenLL' to strudel 'c#5', 'bb1', 'e5'."""
    s = token.strip()
    s = re.sub(r'^[\(<>/]+', '', s)
    s = re.sub(r'^\d+\.?', '', s)
    # Remove non-pitch modifiers
    s = re.sub(r'[LJq()\[\]\'\{\}><~tT:;\d\s\.\,X/]+', '', s)
    if not s or s.startswith('r'):
        return None
    m = re.match(r'^([a-gA-G]+)(#{1,2}|-{1,2}|n)?', s)
    if not m:
        return None
    letters = m.group(1)
    acc = m.group(2) or ''
    if acc == 'n':
        acc = ''
    base = letters[0].lower()
    count = len(letters)
    if letters[0].islower():
        octave = 3 + count
    else:
        octave = 4 - count
    return f"{base}{acc.replace('-', 'b')}{octave}"


def kern_dur_sixteenths(token):
    """Extract duration from kern token as sixteenth-note count."""
    s = token.strip()
    s = re.sub(r'^[\(<>/]+', '', s)
    m = re.match(r'(\d+)(\.?)', s)
    if not m:
        return None
    val = int(m.group(1))
    if val == 0:
        return None
    result = 16 / val
    if m.group(2):
        result *= 1.5
    return result


def is_grace(token):
    """Check if a kern token is a grace note."""
    s = token.strip()
    s = re.sub(r'^[\(<>/]+', '', s)
    s = re.sub(r'^\d+\.?', '', s)
    return 'q' in s


def parse_column_events(lines, col_idx):
    """Extract sequential events from a specific column.
    Returns [(dur_sixteenths, [strudel_note_names]), ...]
    """
    events = []
    for line in lines:
        parts = line.split('\t')
        if col_idx >= len(parts):
            continue
        cell = parts[col_idx].strip()
        if cell == '.' or cell == '':
            continue
        if cell.startswith('*') or cell.startswith('!'):
            continue

        tokens = cell.split()

        # Skip grace notes
        if any(is_grace(t) for t in tokens):
            continue

        # Check for rest
        has_rest = False
        rest_dur = None
        for t in tokens:
            clean = re.sub(r'^[\(<>/]+', '', t.strip())
            if re.match(r'\d+r', clean):
                has_rest = True
                rest_dur = kern_dur_sixteenths(t)
                break

        if has_rest:
            if rest_dur:
                events.append((rest_dur, ['~']))
            continue

        # Parse notes (chord = space-separated)
        dur = None
        notes = []
        for t in tokens:
            d = kern_dur_sixteenths(t)
            if d is not None and dur is None:
                dur = d
            n = kern_to_strudel_pitch(t)
            if n:
                notes.append(n)

        if notes and dur:
            # Sort notes low→high, deduplicate
            notes = sorted(set(notes), key=note_sort_key)
            events.append((dur, notes))

    return events


def format_strudel_token(dur, notes):
    """Format a single strudel token."""
    if len(notes) == 1:
        ns = notes[0]
    else:
        ns = f"[{','.join(notes)}]"
    if dur == 1:
        return ns
    elif dur == int(dur):
        return f"{ns}@{int(dur)}"
    else:
        return f"{ns}@{dur:g}"


def events_to_strudel(events):
    return ' '.join(format_strudel_token(d, n) for d, n in events)


def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <input.krn>", file=sys.stderr)
        sys.exit(1)

    with open(sys.argv[1]) as f:
        raw_lines = [l.rstrip('\n') for l in f]

    # Group into sections and measures
    current_section = ''
    measures = []  # (section, measure_num, [lines])
    current_lines = []
    current_mnum = 0

    for line in raw_lines:
        if not line or line.startswith('!!!') or line.startswith('**'):
            continue

        parts = line.split('\t')
        first = parts[0].strip()

        # Section marker
        if first.startswith('*>') and not first.startswith('*>norep'):
            if current_lines:
                measures.append((current_section, current_mnum, list(current_lines)))
                current_lines = []
            current_section = first.replace('*>', '')
            continue

        # Barline
        if first.startswith('='):
            if current_lines:
                measures.append((current_section, current_mnum, list(current_lines)))
                current_lines = []
            m = re.search(r'(\d+)', first)
            if m:
                current_mnum = int(m.group(1))
            continue

        # Skip pure metadata lines (key sig, meter, etc.) but keep data
        if first.startswith('*'):
            # Keep voice split markers
            if '*^' in line or '*v' in line:
                current_lines.append(line)
            continue

        if first.startswith('!'):
            continue

        current_lines.append(line)

    if current_lines:
        measures.append((current_section, current_mnum, list(current_lines)))

    # Norep section order
    norep = {'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'I2', 'J'}

    rh_lines = []
    lh_lines = []

    for section, mnum, mlines in measures:
        if section not in norep:
            continue

        # Filter data lines (keep voice split markers)
        data_lines = [l for l in mlines
                       if '\t' in l and not l.strip().startswith('!!')]

        if not data_lines:
            continue

        has_split = any('*^' in l or '*v' in l for l in data_lines)

        if has_split:
            rh_events = []
            lh_events = []
            in_split = False
            batch = []

            for dl in data_lines:
                if '*^' in dl:
                    if batch:
                        rh_events.extend(parse_column_events(batch, 1))
                        lh_events.extend(parse_column_events(batch, 0))
                    batch = []
                    in_split = True
                    continue
                elif '*v' in dl:
                    if batch:
                        # During split: col0=LH, col1=RH_upper, col2=RH_lower
                        lh_events.extend(parse_column_events(batch, 0))
                        # Merge both RH sub-voices
                        upper = parse_column_events(batch, 1)
                        lower = parse_column_events(batch, 2)
                        # Interleave by time position
                        rh_events.extend(merge_voices(upper, lower))
                    batch = []
                    in_split = False
                    continue
                else:
                    batch.append(dl)

            if batch:
                if in_split:
                    lh_events.extend(parse_column_events(batch, 0))
                    upper = parse_column_events(batch, 1)
                    lower = parse_column_events(batch, 2)
                    rh_events.extend(merge_voices(upper, lower))
                else:
                    rh_events.extend(parse_column_events(batch, 1))
                    lh_events.extend(parse_column_events(batch, 0))
        else:
            rh_events = parse_column_events(data_lines, 1)
            lh_events = parse_column_events(data_lines, 0)

        rh_str = events_to_strudel(rh_events) if rh_events else '~@8'
        lh_str = events_to_strudel(lh_events) if lh_events else '~@8'

        # Verify total duration = 8 sixteenths
        rh_total = sum(d for d, _ in rh_events) if rh_events else 0
        lh_total = sum(d for d, _ in lh_events) if lh_events else 0

        rh_lines.append((rh_total, f"  {rh_str}", f"{section} m{mnum}"))
        lh_lines.append((lh_total, f"  {lh_str}", f"{section} m{mnum}"))

    # Post-process: combine half-measure pairs into full measures
    rh_combined = combine_half_measures(rh_lines)
    lh_combined = combine_half_measures(lh_lines)

    if len(rh_combined) != len(lh_combined):
        print(f"WARNING: RH has {len(rh_combined)} lines, LH has {len(lh_combined)} lines",
              file=sys.stderr)

    print("// Right hand")
    print("$: note(`<")
    for content, comment in rh_combined:
        print(f"{content}  // {comment}")
    print(">`)")
    print("  .s('piano').velocity(0.72)")
    print("  .room(0.35).roomsize(5)._pianoroll()")
    print()
    print("// Left hand")
    print("$: note(`<")
    for content, comment in lh_combined:
        print(f"{content}  // {comment}")
    print(">`)")
    print("  .s('piano').velocity(0.45)")
    print("  .room(0.35).roomsize(5)")


def combine_half_measures(lines):
    """Combine consecutive half-measures (dur < 8) into full measures.
    Input: [(dur, content_str, comment_str), ...]
    Output: [(content_str, comment_str), ...]
    """
    result = []
    i = 0
    while i < len(lines):
        dur, content, comment = lines[i]
        if dur < 8 and i + 1 < len(lines):
            dur2, content2, comment2 = lines[i + 1]
            if dur + dur2 == 8:
                combined = f"{content} {content2.strip()}"
                result.append((combined, f"{comment} + {comment2}"))
                i += 2
                continue
            # Can't combine; pad with rest
            pad = int(8 - dur)
            result.append((f"  ~@{pad} {content.strip()}", f"{comment} (pickup)"))
            i += 1
            continue
        elif dur < 8:
            # Last line, pad
            pad = int(8 - dur)
            result.append((f"  ~@{pad} {content.strip()}", f"{comment} (padded)"))
            i += 1
            continue
        result.append((content, comment))
        i += 1
    return result


def merge_voices(upper, lower):
    """Merge two sub-voice event lists into a combined list.
    Where notes overlap, create chords. Simple approach: lay out both
    on a timeline and combine simultaneous attacks.
    """
    timeline = {}

    t = 0.0
    for dur, notes in upper:
        real_notes = [n for n in notes if n != '~']
        if t not in timeline:
            timeline[t] = (dur, list(real_notes) if real_notes else ['~'])
        else:
            existing_dur, existing_notes = timeline[t]
            existing_real = [n for n in existing_notes if n != '~']
            all_notes = existing_real + (real_notes if real_notes else [])
            if all_notes:
                merged = sorted(set(all_notes), key=note_sort_key)
            else:
                merged = ['~']
            timeline[t] = (min(existing_dur, dur), merged)
        t += dur

    t = 0.0
    for dur, notes in lower:
        real_notes = [n for n in notes if n != '~']
        if t not in timeline:
            timeline[t] = (dur, list(real_notes) if real_notes else ['~'])
        else:
            existing_dur, existing_notes = timeline[t]
            existing_real = [n for n in existing_notes if n != '~']
            all_notes = existing_real + (real_notes if real_notes else [])
            if all_notes:
                merged = sorted(set(all_notes), key=note_sort_key)
            else:
                merged = ['~']
            timeline[t] = (min(existing_dur, dur), merged)
        t += dur

    result = []
    sorted_times = sorted(timeline.keys())
    for i, time in enumerate(sorted_times):
        dur, notes = timeline[time]
        if i + 1 < len(sorted_times):
            max_dur = sorted_times[i + 1] - time
            dur = min(dur, max_dur)
        result.append((dur, notes))

    return result


if __name__ == '__main__':
    main()
