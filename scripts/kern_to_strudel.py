#!/usr/bin/env python3
"""Convert a Humdrum Kern score to Strudel mini-notation.

Reads a .krn file and outputs two $: note(`<...>`) blocks (RH and LH)
ready to paste into a Strudel .js pattern file.

Usage:
    python3 scripts/kern_to_strudel.py path/to/score.krn

Supports two modes:
1. Section-marked files (*> labels + norep expansion) — e.g. Alla Turca
2. Section-free files (barline-only measures) — e.g. Moonlight Sonata

Voice splits (*^/*v), grace notes, and chords are handled automatically.
Spine identity is tracked through splits and merges across measures.
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
    s = re.sub(r'^[\(<>\[\]{}/_]+', '', s)
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
    s = re.sub(r'^[\(<>\[\]{}/_]+', '', s)
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
        # Round to avoid floating point noise (e.g. 1.3333333 → 1.33333)
        return f"{ns}@{round(dur, 5):g}"


def events_to_strudel(events):
    return ' '.join(format_strudel_token(d, n) for d, n in events)


def process_spine_ops(parts, spine_ids):
    """Process spine split (*^) and merge (*v) operations.
    Returns new spine_ids list reflecting the structural change.
    """
    new_ids = []
    i = 0
    while i < len(parts):
        p = parts[i].strip()
        if p == '*^':
            # Split: one spine becomes two with the same voice ID
            new_ids.append(spine_ids[i])
            new_ids.append(spine_ids[i])
            i += 1
        elif p == '*v':
            # Merge: consecutive *v spines collapse into one
            merge_id = spine_ids[i]
            while i < len(parts) and parts[i].strip() == '*v':
                i += 1
            new_ids.append(merge_id)
        else:
            if i < len(spine_ids):
                new_ids.append(spine_ids[i])
            i += 1
    return new_ids


def process_measure_data(mlines, spine_ids):
    """Process a measure's data lines with full spine tracking.

    Handles mid-measure spine splits/merges by segmenting data at
    spine operations and processing each segment independently.

    Returns (lh_events, rh_events, final_spine_ids).
    """
    segments = []
    current_ids = list(spine_ids)
    current_data = []

    for line in mlines:
        parts = line.split('\t')
        if any(p.strip() in ('*^', '*v') for p in parts):
            if current_data:
                segments.append((list(current_ids), current_data))
                current_data = []
            current_ids = process_spine_ops(parts, current_ids)
            continue
        first = parts[0].strip()
        if first.startswith('!') or first.startswith('*'):
            continue
        current_data.append(line)

    if current_data:
        segments.append((list(current_ids), current_data))

    lh_all = []
    rh_all = []

    for seg_ids, seg_data in segments:
        lh_cols = [i for i, sid in enumerate(seg_ids) if sid == 0]
        rh_cols = [i for i, sid in enumerate(seg_ids) if sid == 1]

        # LH: parse each sub-spine column and merge
        if len(lh_cols) == 1:
            lh_events = parse_column_events(seg_data, lh_cols[0])
        elif len(lh_cols) > 1:
            sub = [parse_column_events(seg_data, c) for c in lh_cols]
            lh_events = sub[0]
            for s in sub[1:]:
                lh_events = merge_voices(lh_events, s)
        else:
            lh_events = []

        # RH: parse each sub-spine column and merge
        if len(rh_cols) == 1:
            rh_events = parse_column_events(seg_data, rh_cols[0])
        elif len(rh_cols) > 1:
            sub = [parse_column_events(seg_data, c) for c in rh_cols]
            rh_events = sub[0]
            for s in sub[1:]:
                rh_events = merge_voices(rh_events, s)
        else:
            rh_events = []

        lh_all.extend(lh_events)
        rh_all.extend(rh_events)

    return lh_all, rh_all, current_ids


def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <input.krn>", file=sys.stderr)
        sys.exit(1)

    with open(sys.argv[1]) as f:
        raw_lines = [l.rstrip('\n') for l in f]

    # Detect time signature → measure_sixteenths
    measure_sixteenths = 8  # default for 2/4
    for line in raw_lines:
        for col in line.split('\t'):
            m = re.match(r'\*M(\d+)/(\d+)', col.strip())
            if m:
                num, den = int(m.group(1)), int(m.group(2))
                measure_sixteenths = int(num * 16 / den)
                break
        else:
            continue
        break

    # Detect tempo (MM marking)
    tempo_mm = None
    for line in raw_lines:
        for col in line.split('\t'):
            m = re.match(r'\*MM(\d+)', col.strip())
            if m:
                tempo_mm = int(m.group(1))
                break
        else:
            continue
        break

    # Check if the file uses *> section markers
    has_sections = any(
        parts[0].strip().startswith('*>') and not parts[0].strip().startswith('*>norep')
        for line in raw_lines
        if '\t' in line
        for parts in [line.split('\t')]
        if parts[0].strip().startswith('*>')
    )

    # Initialize spine IDs from the ** header and *staff markers.
    # Default: sequential kern index. Then override with *staff markers
    # where *staff2 → 0 (LH) and *staff1 → 1 (RH).
    spine_ids = []
    kern_idx = 0
    for line in raw_lines:
        if line.startswith('**'):
            for p in line.split('\t'):
                if p.strip() == '**kern':
                    spine_ids.append(kern_idx)
                    kern_idx += 1
                else:
                    spine_ids.append(-1)
            break

    # Override with *staff assignments if present
    for line in raw_lines:
        parts = line.split('\t')
        if any(p.strip().startswith('*staff') for p in parts):
            for i, p in enumerate(parts):
                ps = p.strip()
                if ps == '*staff2':
                    spine_ids[i] = 0  # LH
                elif ps == '*staff1':
                    spine_ids[i] = 1  # RH
            break

    if has_sections:
        rh_lines, lh_lines = _process_with_sections(raw_lines, measure_sixteenths)
    else:
        rh_lines, lh_lines = _process_with_spine_tracking(
            raw_lines, spine_ids, measure_sixteenths)

    # Post-process: combine half-measure pairs into full measures (both hands in sync)
    rh_combined, lh_combined = combine_half_measures_paired(
        rh_lines, lh_lines, measure_sixteenths)

    if len(rh_combined) != len(lh_combined):
        print(f"WARNING: RH has {len(rh_combined)} lines, LH has {len(lh_combined)} lines",
              file=sys.stderr)

    # Determine tempo comment
    if tempo_mm:
        print(f"// Tempo: MM{tempo_mm}, measure = {measure_sixteenths} sixteenths",
              file=sys.stderr)

    print("// Right hand")
    print("$: note(`<")
    for content, comment in rh_combined:
        print(f"{content}")
    print(">`)")
    print("  .s('piano').velocity(0.72)")
    print("  .room(0.35).roomsize(5)._pianoroll()")
    print()
    print("// Left hand")
    print("$: note(`<")
    for content, comment in lh_combined:
        print(f"{content}")
    print(">`)")
    print("  .s('piano').velocity(0.45)")
    print("  .room(0.35).roomsize(5)")


def _process_with_sections(raw_lines, measure_sixteenths):
    """Process a kern file that uses *> section markers (original mode)."""
    current_section = ''
    measures = []
    current_lines = []
    current_mnum = 0

    for line in raw_lines:
        if not line or line.startswith('!!!') or line.startswith('**'):
            continue

        parts = line.split('\t')
        first = parts[0].strip()

        if first.startswith('*>') and not first.startswith('*>norep'):
            if current_lines:
                measures.append((current_section, current_mnum, list(current_lines)))
                current_lines = []
            current_section = first.replace('*>', '')
            continue

        if first.startswith('='):
            if current_lines:
                measures.append((current_section, current_mnum, list(current_lines)))
                current_lines = []
            m = re.search(r'(\d+)', first)
            if m:
                current_mnum = int(m.group(1))
            continue

        if first.startswith('*'):
            if '*^' in line or '*v' in line:
                current_lines.append(line)
            continue

        if first.startswith('!'):
            continue

        current_lines.append(line)

    if current_lines:
        measures.append((current_section, current_mnum, list(current_lines)))

    norep = {'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'I2', 'J'}

    rh_lines = []
    lh_lines = []

    for section, mnum, mlines in measures:
        if section not in norep:
            continue

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
                        lh_events.extend(parse_column_events(batch, 0))
                        upper = parse_column_events(batch, 1)
                        lower = parse_column_events(batch, 2)
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

        rh_str = events_to_strudel(rh_events) if rh_events else f'~@{measure_sixteenths}'
        lh_str = events_to_strudel(lh_events) if lh_events else f'~@{measure_sixteenths}'

        rh_total = sum(d for d, _ in rh_events) if rh_events else 0
        lh_total = sum(d for d, _ in lh_events) if lh_events else 0

        rh_lines.append((rh_total, f"  {rh_str}", f"{section} m{mnum}"))
        lh_lines.append((lh_total, f"  {lh_str}", f"{section} m{mnum}"))

    return rh_lines, lh_lines


def _process_with_spine_tracking(raw_lines, spine_ids, measure_sixteenths):
    """Process a kern file without section markers, using full spine tracking."""
    spine_ids = list(spine_ids)
    measures = []
    current_mnum = 0
    current_mlines = []

    for line in raw_lines:
        if not line or line.startswith('!!!') or line.startswith('**'):
            continue

        parts = line.split('\t')
        first = parts[0].strip()

        # Barline
        if first.startswith('='):
            if current_mlines:
                lh_ev, rh_ev, spine_ids = process_measure_data(
                    current_mlines, spine_ids)
                measures.append((current_mnum, lh_ev, rh_ev))
                current_mlines = []
            m = re.search(r'(\d+)', first)
            if m:
                current_mnum = int(m.group(1))
            continue

        # Metadata: keep spine ops, skip everything else
        if first.startswith('*'):
            if any(p.strip() in ('*^', '*v') for p in parts):
                current_mlines.append(line)
            continue

        if first.startswith('!'):
            continue

        current_mlines.append(line)

    if current_mlines:
        lh_ev, rh_ev, spine_ids = process_measure_data(
            current_mlines, spine_ids)
        measures.append((current_mnum, lh_ev, rh_ev))

    rh_lines = []
    lh_lines = []

    for mnum, lh_ev, rh_ev in measures:
        rh_str = events_to_strudel(rh_ev) if rh_ev else f'~@{measure_sixteenths}'
        lh_str = events_to_strudel(lh_ev) if lh_ev else f'~@{measure_sixteenths}'

        rh_total = sum(d for d, _ in rh_ev) if rh_ev else 0
        lh_total = sum(d for d, _ in lh_ev) if lh_ev else 0

        rh_lines.append((rh_total, f"  {rh_str}", f"m{mnum}"))
        lh_lines.append((lh_total, f"  {lh_str}", f"m{mnum}"))

    return rh_lines, lh_lines


def combine_half_measures(lines, measure_sixteenths=8):
    """Combine consecutive half-measures (dur < measure_sixteenths) into full measures.
    Input: [(dur, content_str, comment_str), ...]
    Output: [(content_str, comment_str), ...]
    """
    result = []
    i = 0
    threshold = measure_sixteenths - 0.1  # tolerance for floating-point totals
    while i < len(lines):
        dur, content, comment = lines[i]
        if dur < threshold and i + 1 < len(lines):
            dur2, content2, comment2 = lines[i + 1]
            if abs(dur + dur2 - measure_sixteenths) < 0.1:
                combined = f"{content} {content2.strip()}"
                result.append((combined, f"{comment} + {comment2}"))
                i += 2
                continue
            # Can't combine; pad with rest
            pad = measure_sixteenths - dur
            result.append((f"  ~@{pad:g} {content.strip()}", f"{comment} (pickup)"))
            i += 1
            continue
        elif dur < threshold:
            # Last line, pad
            pad = measure_sixteenths - dur
            result.append((f"  ~@{pad:g} {content.strip()}", f"{comment} (padded)"))
            i += 1
            continue
        result.append((content, comment))
        i += 1
    return result


def combine_half_measures_paired(rh_lines, lh_lines, measure_sixteenths=8):
    """Combine half-measures in both hands simultaneously, keeping line counts in sync.
    Only combines when BOTH hands are short at the same position.
    When only one hand is short, pads it with a rest.
    """
    rh_result = []
    lh_result = []
    i = 0
    threshold = measure_sixteenths - 0.1
    n = min(len(rh_lines), len(lh_lines))

    while i < n:
        rh_dur, rh_content, rh_comment = rh_lines[i]
        lh_dur, lh_content, lh_comment = lh_lines[i]

        rh_short = rh_dur < threshold
        lh_short = lh_dur < threshold

        if (rh_short or lh_short) and i + 1 < n:
            rh_dur2, rh_content2, rh_comment2 = rh_lines[i + 1]
            lh_dur2, lh_content2, lh_comment2 = lh_lines[i + 1]

            # Only combine when both hands are short (pickup bars, split measures)
            if rh_short and lh_short:
                rh_sum_ok = abs(rh_dur + rh_dur2 - measure_sixteenths) < 0.1
                lh_sum_ok = abs(lh_dur + lh_dur2 - measure_sixteenths) < 0.1
                if rh_sum_ok or lh_sum_ok:
                    rh_result.append((f"{rh_content} {rh_content2.strip()}", f"{rh_comment} + {rh_comment2}"))
                    lh_result.append((f"{lh_content} {lh_content2.strip()}", f"{lh_comment} + {lh_comment2}"))
                    i += 2
                    continue

        # Pad short measures with leading rest
        if rh_short:
            pad = measure_sixteenths - rh_dur
            if pad > 0:
                rh_result.append((f"  ~@{pad:g} {rh_content.strip()}", f"{rh_comment} (pickup)"))
            else:
                rh_result.append((rh_content, rh_comment))
        else:
            rh_result.append((rh_content, rh_comment))

        if lh_short:
            pad = measure_sixteenths - lh_dur
            if pad > 0:
                lh_result.append((f"  ~@{pad:g} {lh_content.strip()}", f"{lh_comment} (pickup)"))
            else:
                lh_result.append((lh_content, lh_comment))
        else:
            lh_result.append((lh_content, lh_comment))

        i += 1

    return rh_result, lh_result


def merge_voices(upper, lower):
    """Merge two sub-voice event lists into a combined list.
    Where notes overlap, create chords. Simple approach: lay out both
    on a timeline and combine simultaneous attacks.
    """
    timeline = {}

    def _round_t(val):
        """Round to 10 decimal places to avoid floating-point key collisions."""
        return round(val, 10)

    def _add_events(events):
        nonlocal timeline
        t = 0.0
        for dur, notes in events:
            rt = _round_t(t)
            real_notes = [n for n in notes if n != '~']
            if rt not in timeline:
                timeline[rt] = (dur, list(real_notes) if real_notes else ['~'])
            else:
                existing_dur, existing_notes = timeline[rt]
                existing_real = [n for n in existing_notes if n != '~']
                all_notes = existing_real + (real_notes if real_notes else [])
                if all_notes:
                    merged = sorted(set(all_notes), key=note_sort_key)
                else:
                    merged = ['~']
                timeline[rt] = (min(existing_dur, dur), merged)
            t += dur

    _add_events(upper)
    _add_events(lower)

    result = []
    sorted_times = sorted(timeline.keys())
    for i, time in enumerate(sorted_times):
        dur, notes = timeline[time]
        if i + 1 < len(sorted_times):
            max_dur = sorted_times[i + 1] - time
            dur = min(dur, max_dur)
        # Skip events with negligible duration (floating-point noise)
        if dur < 0.01:
            continue
        result.append((round(dur, 10), notes))

    return result


if __name__ == '__main__':
    main()
