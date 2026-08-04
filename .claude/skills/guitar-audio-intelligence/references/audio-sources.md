# Audio Sources and Licensing

## The rule

**Never use an audio file merely because it is downloadable.** Determine the licence before
downloading, record it before bundling, and if the licence cannot be established, the file is
not usable — however good it sounds.

## Licence categories

| Category | Redistribution | Attribution | Use in Ahordian |
|---|---|---|---|
| CC0 / public domain | yes | not required | preferred |
| CC-BY | yes | **mandatory** | allowed, attribution must ship in the UI or docs |
| CC-BY-SA | yes | mandatory + share-alike | avoid — viral terms affect the project |
| CC-NC | non-commercial only | mandatory | avoid — constrains the project's future |
| Commercial sample library | usually forbidden | n/a | not bundleable |
| Unknown | assume forbidden | n/a | do not use |

CC-BY attribution is a licence condition, not a courtesy. Dropping it makes the
redistribution unlicensed.

## What Ahordian ships

Every bundled file is recorded in `app/static/audio/LICENSES.md` with source, author, and
licence. Currently:

- **Guitar, steel** — MusyngKite soundfont, CC0. 19 samples.
- **Guitar, nylon** — FatBoy soundfont, CC0. 19 samples.
- **Drums** — Pearl kit, **CC-BY 3.0 — attribution is mandatory**. 5 samples.

When adding assets, update `LICENSES.md` in the same change and run:

```
python .claude/skills/guitar-audio-intelligence/scripts/validate_audio_assets.py
```

It checks manifest coverage, file magic bytes, note-name parsing, note-set parity between
guitar tones, and reports which licences require attribution. A file that plays but is not in
the manifest is exactly the failure this catches — nothing else in the app will complain.

## Sourcing preferences, in order

1. **Existing bundled packs.** Extending coverage of a pack already licensed and documented
   is always cheaper than introducing a new source.
2. **CC0 soundfonts** (MusyngKite, FatBoy and similar sf2-derived sets). Broad, consistent,
   no attribution burden.
3. **CC0 / CC-BY freesound-style recordings.** Check each file individually — licences vary
   per upload inside one collection, and a pack-level claim is not evidence.
4. **Own recordings.** Full control, no licence question, but consistency across a range is
   real work.
5. **Synthesis.** No licence at all. The correct answer when a sound is needed once and
   fidelity is secondary.

## Evaluating a pack before adopting it

- **Range coverage.** Enough notes that no target needs more than ~2 semitones of shift.
- **Consistency.** Uniform recording chain, level, and room across notes. An inconsistent
  pack sounds worse than a smaller consistent one.
- **Loop / tail behaviour.** Clean decay, no abrupt truncation, no dead air before the attack.
- **Format and size.** mp3 for web delivery, wav where decode fidelity matters. Total payload
  matters — the app fetches these over the network.
- **Naming.** Note-named files (`A3.mp3`) map directly; MIDI-numbered or arbitrary names need
  a mapping table, which is a place for bugs.
