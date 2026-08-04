#!/usr/bin/env python
"""Validate Ahordian's bundled audio assets.

Mechanically enforces the audio policy that would otherwise have to be re-reasoned
every time an asset is added:

  1. Licence coverage  - every audio file is accounted for in LICENSES.md, by its own
                         filename or by its containing directory path.
  2. Real audio        - magic bytes match the extension (a renamed HTML error page
                         plays as silence and 404s nowhere).
  3. Note names        - every guitar sample filename parses to a MIDI note.
  4. Tone parity       - guitar tones cover identical note sets, so switching tone can
                         never change which notes are sampled.
  5. Shift budget      - reports the largest pitch shift any target note requires.
  6. Attribution       - reports licences that require attribution to ship.

Dependency-free. Exit code 0 = pass, 1 = failures.

    python .claude/skills/guitar-audio-intelligence/scripts/validate_audio_assets.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

AUDIO_EXTS = {".mp3", ".wav", ".ogg", ".flac", ".m4a"}
MANIFEST_NAME = "LICENSES.md"

# Attribution-requiring licence markers, matched case-insensitively in the manifest.
ATTRIBUTION_MARKERS = ("cc-by", "cc by", "attribution 3.0", "attribution 4.0")

NOTE_SEMITONES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
NOTE_RE = re.compile(r"^([A-G])([#b]?)(-?\d+)$")

MAX_ACCEPTABLE_SHIFT = 2  # semitones; beyond this, add a sample instead


def note_to_midi(name: str) -> int | None:
    m = NOTE_RE.match(name)
    if not m:
        return None
    letter, accidental, octave = m.group(1), m.group(2), int(m.group(3))
    semis = NOTE_SEMITONES[letter] + (1 if accidental == "#" else -1 if accidental == "b" else 0)
    return (octave + 1) * 12 + semis


def sniff(path: Path) -> str | None:
    """Return a coarse format guess from the file's leading bytes."""
    with path.open("rb") as fh:
        head = fh.read(12)
    if head[:3] == b"ID3" or (len(head) > 1 and head[0] == 0xFF and head[1] & 0xE0 == 0xE0):
        return "mp3"
    if head[:4] == b"RIFF" and head[8:12] == b"WAVE":
        return "wav"
    if head[:4] == b"OggS":
        return "ogg"
    if head[:4] == b"fLaC":
        return "flac"
    if head[4:8] == b"ftyp":
        return "m4a"
    return None


def find_audio_root(start: Path) -> Path | None:
    for base in (start, *start.parents):
        candidate = base / "app" / "static" / "audio"
        if candidate.is_dir():
            return candidate
    return None


def main() -> int:
    root = find_audio_root(Path(__file__).resolve())
    if root is None:
        print("FAIL  could not locate app/static/audio from this script's location")
        return 1

    manifest_path = root / MANIFEST_NAME
    if not manifest_path.is_file():
        print(f"FAIL  missing manifest: {manifest_path}")
        return 1
    manifest = manifest_path.read_text(encoding="utf-8")
    manifest_lower = manifest.lower()

    files = sorted(p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in AUDIO_EXTS)
    if not files:
        print(f"FAIL  no audio files found under {root}")
        return 1

    failures: list[str] = []
    warnings: list[str] = []

    print(f"audio root: {root}")
    print(f"files:      {len(files)}\n")

    # 1 + 2 -- coverage and magic bytes
    for path in files:
        rel = path.relative_to(root).as_posix()
        parent = path.parent.relative_to(root).as_posix()
        covered = path.name.lower() in manifest_lower or (parent and parent.lower() in manifest_lower)
        if not covered:
            failures.append(f"unlicensed: {rel} - neither '{path.name}' nor '{parent}/' appears in {MANIFEST_NAME}")

        actual = sniff(path)
        expected = path.suffix.lower().lstrip(".")
        if actual is None:
            failures.append(f"not audio: {rel} - leading bytes match no known audio format")
        elif actual != expected:
            failures.append(f"format mismatch: {rel} - extension .{expected}, content looks like {actual}")

        if path.stat().st_size < 1024:
            warnings.append(f"suspiciously small ({path.stat().st_size} B): {rel}")

    # 3 + 4 + 5 -- guitar note names, tone parity, shift budget
    guitar_root = root / "guitar"
    tones: dict[str, dict[str, int]] = {}
    if guitar_root.is_dir():
        for tone_dir in sorted(p for p in guitar_root.iterdir() if p.is_dir()):
            notes: dict[str, int] = {}
            for path in sorted(tone_dir.iterdir()):
                if path.suffix.lower() not in AUDIO_EXTS:
                    continue
                midi = note_to_midi(path.stem)
                if midi is None:
                    failures.append(f"unparseable note name: {path.relative_to(root).as_posix()}")
                else:
                    notes[path.stem] = midi
            tones[tone_dir.name] = notes

        if len(tones) > 1:
            reference_name, reference = next(iter(tones.items()))
            for name, notes in list(tones.items())[1:]:
                missing = sorted(set(reference) - set(notes))
                extra = sorted(set(notes) - set(reference))
                if missing:
                    failures.append(f"tone parity: '{name}' missing {missing} present in '{reference_name}'")
                if extra:
                    failures.append(f"tone parity: '{name}' has {extra} absent from '{reference_name}'")

        for name, notes in tones.items():
            if not notes:
                continue
            midis = sorted(notes.values())
            worst = 0
            for target in range(midis[0], midis[-1] + 1):
                worst = max(worst, min(abs(target - m) for m in midis))
            status = "ok" if worst <= MAX_ACCEPTABLE_SHIFT else "OVER BUDGET"
            line = (
                f"guitar/{name}: {len(notes)} samples, MIDI {midis[0]}-{midis[-1]}, "
                f"max pitch shift {worst} semitone(s) - {status}"
            )
            print(line)
            if worst > MAX_ACCEPTABLE_SHIFT:
                failures.append(
                    f"shift budget: guitar/{name} needs up to {worst} semitones of shift "
                    f"(limit {MAX_ACCEPTABLE_SHIFT}) - add samples"
                )

    # 6 -- attribution
    print()
    attributed = [m for m in ATTRIBUTION_MARKERS if m in manifest_lower]
    if attributed:
        print(f"ATTRIBUTION REQUIRED - {MANIFEST_NAME} declares {attributed}.")
        print("  The credit block in that file must ship in user-facing credits.")
    else:
        print("No attribution-requiring licence declared.")

    print()
    for w in warnings:
        print(f"WARN  {w}")
    for f in failures:
        print(f"FAIL  {f}")

    if failures:
        print(f"\n{len(failures)} failure(s).")
        return 1
    print(f"\nPASS - {len(files)} audio files, all licensed and well-formed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
