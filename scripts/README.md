# Scripts

Utility scripts for the Strudel Playground. All Python scripts use only the standard library (no `pip install` needed).

## parse_midi.py

Parse a MIDI file and print note events grouped by measure.

```bash
python3 scripts/parse_midi.py path/to/file.mid
```

## midi_to_strudel.py

Convert a MIDI file to a Strudel `.js` pattern file.

```bash
python3 scripts/midi_to_strudel.py path/to/file.mid -o strudels/classical/song.js
```

Options:

| Flag | Description |
|---|---|
| `--title NAME` | Song title (default: derived from filename) |
| `--composer NAME` | Composer name |
| `--split NOTE` | MIDI note number to split RH/LH (default: 60 = C4) |
| `--measures M1-M2` | Only convert measures M1 through M2 |
| `--velocity FLOAT` | Base velocity 0.0–1.0 |
| `--quantize N` | Grid subdivisions per beat (4 = 16th notes, 2 = 8th) |
| `--cpm EXPR` | Override the `setcpm()` expression |
| `-o, --output PATH` | Output `.js` file path |

Example — convert the first 16 measures, quantized to 16th notes:

```bash
python3 scripts/midi_to_strudel.py tmp/alla-turca.mid \
  --title "Alla Turca" --composer "Mozart" \
  --measures 1-16 --quantize 4 \
  -o strudels/classical/alla-turca.js
```

## strudel_to_midi.py

Convert a Strudel `.js` pattern file (using `note(\`<...>\`)` blocks) to MIDI.

```bash
python3 scripts/strudel_to_midi.py strudels/classical-gpt-5.4-mini/alla-turca.js -o tmp/alla-turca.mid --bpm 140
```

Options:

| Flag | Description |
|---|---|
| `-o, --output PATH` | Output `.mid` path (default: same basename as input) |
| `--bpm N` | Override BPM (default: auto-detected from `setcpm()`) |

If the auto-detected BPM exceeds 300 it is clamped automatically. Use `--bpm` to set an exact tempo.

## recreate-index.sh

Regenerate `strudels/index.js` by scanning the `strudels/` directory for `.js` files.

```bash
./scripts/recreate-index.sh
```
