# Guitar Domain Reference

## Tuning and pitch

| String | Note | MIDI | Hz |
|---|---|---|---|
| 6th (lowest) | E2 | 40 | 82.41 |
| 5th | A2 | 45 | 110.00 |
| 4th | D3 | 50 | 146.83 |
| 3rd | G3 | 55 | 196.00 |
| 2nd | B3 | 59 | 246.94 |
| 1st (highest) | E4 | 64 | 329.63 |

Intervals between adjacent strings are **5 5 5 4 5** semitones — the major-third gap
between G3 and B3 is why chord shapes are irregular and why string/fret mapping cannot use
a uniform formula.

Fret *n* on a string adds *n* semitones. A 22-fret neck spans E2 (MIDI 40) to D6 (MIDI 86);
24 frets reach E6 (88).

Common alternate tunings: Drop D (`D2 A2 D3 G3 B3 E4`, 6th down a tone), DADGAD
(`D2 A2 D3 G3 A3 D4`), Open G (`D2 G2 D3 G3 B3 D4`), half-step down (all −1).

**Capo at fret *n*** raises every open string by *n* semitones and makes fret *n* the new
nut. Shapes are preserved, sounding pitch is not — a "C shape" with a capo at 2 sounds D.
Fretboard code must distinguish *shape position* from *sounding pitch*, and fret numbers
displayed to the user are usually capo-relative while detection is always absolute.

## Terminology

**Structure** — *fret*: semitone division of the neck. *Open string*: sounded unfretted.
*Barre*: one finger stopping several strings. *Position*: which fret the hand is anchored at.

**Harmony** — *root*: the note a chord is named from. *Bass note*: the lowest note actually
sounding, which may not be the root. *Interval*: distance between two pitches. *Triad*: root
+ 3rd + 5th. *7th chord*: triad + 7th. *sus2 / sus4*: the 3rd is **replaced** by the 2nd or
4th. *add9*: the 9th is **added**, the 3rd stays — sus and add are not variations of one
idea. *Power chord*: root + 5th (+ octave root), no 3rd, so it has **no quality** — neither
major nor minor. *Voicing*: the specific arrangement of notes chosen. *Inversion*: a chord
whose bass note is not the root (`C/E`, `C/G`).

**Technique** — *hammer-on* / *pull-off*: pitch change with no new pick attack, so the onset
is weak or absent. *Slide*: continuous pitch glide between two frets. *Bend*: pitch raised by
pushing the string, typically 100–200 cents, arbitrary intermediate values. *Vibrato*:
periodic pitch modulation, roughly 4–7 Hz. *Harmonics*: fundamental suppressed, an overtone
dominates. *Palm mute*: shortened decay, damped high partials. *Alternate picking*, *economy
picking*, *fingerstyle*, *arpeggio*, *strumming*: attack patterns, not pitch phenomena.

## Why these matter to detection

Each technique breaks a specific naive assumption:

| Technique | Breaks |
|---|---|
| Hammer-on / pull-off | onset detection — pitch changes with no attack transient |
| Slide | note segmentation — one continuous event, many pitches |
| Bend | equal-temperament quantization — the pitch is genuinely between frets |
| Vibrato | pitch stability — a stable note reads as modulated |
| Harmonics | fundamental tracking — the fundamental isn't the loudest partial |
| Palm mute | duration and energy gates — short and quiet but intentional |

Do not treat any of these as noise to be filtered. Filtering bends and vibrato removes
expression the user is deliberately producing, and a transcription that quantizes a bend to
the nearest fret is wrong in a way the user will immediately hear.

## Fretboard inference

One pitch maps to **several** string/fret positions. E4 (MIDI 64) in standard tuning is
available at 6 places: open 1st string, 5th fret 2nd, 9th fret 3rd, 14th fret 4th, 19th fret
5th, 24th fret 6th. Pitch alone cannot recover the fingering.

```
pitch (MIDI)
  → all (string, fret) where openMidi[string] + fret == pitch, 0 <= fret <= maxFret
  → drop positions excluded by capo (fret must be 0 or >= capoFret)
  → score against constraints
  → best playable interpretation
```

Scoring constraints, roughly in order of weight:

1. **One note per string.** A chord's notes must occupy distinct strings — this alone
   eliminates most combinations, and is the cheapest constraint to apply first.
2. **Hand span.** Fretted notes should fall within ~4 frets (a comfortable four-finger
   span); open strings are free and exempt.
3. **Position continuity.** Prefer positions near the previous note or chord. Minimizing
   movement is what a player actually does, and it is the strongest disambiguator in a
   melodic line.
4. **Low frets and open strings** preferred, all else equal.
5. **Barre feasibility.** Several notes at the same fret on adjacent strings can be one
   finger; this makes otherwise impossible spans playable.

For a *single* highlighted note with no context, highlighting every valid position is
correct and useful — it teaches the user the equivalences. For a *sequence* or a *detected
chord*, highlighting every position is noise; pick the fingering.

`VoicingGenerator.generateVoicings(strings, targetNotes, rootNote)` already exists for the
chord case. Extend it rather than writing a second mapper.

## Chord recognition implications

A real guitar chord is not a clean set of chord tones. Open-position C major
(`x32010`) sounds `C3 E3 G3 C4 E4` — root doubled, third doubled, five notes for a triad.
Expect: doubled roots and thirds, **omitted fifths** (very common), omitted roots (jazz
voicings), open strings that don't belong to the chord, inversions from a fretted bass, and
partial voicings when only 3 strings are struck.

Therefore chord recognition must tolerate incomplete and over-complete note sets. Requiring
every chord tone to be present and nothing else will fail on most real playing.
