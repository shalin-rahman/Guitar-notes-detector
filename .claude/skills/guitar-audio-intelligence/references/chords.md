# Chord Recognition

## Chord recognition is not pitch detection

Detected pitches are **evidence**. A chord label is an **interpretation** of that evidence
under musical context. Code that maps a note set directly to a name is not doing chord
recognition.

## Pipeline

```
detected notes (pitch, onset, confidence)
  → drop low-confidence notes
  → identify the bass note (lowest reliable pitch — keep it, it is not redundant)
  → reduce to pitch classes (set, not multiset — but keep the doubling count for scoring)
  → generate candidates from templates
  → score each candidate
  → temporal smoothing across frames
  → best label + confidence + alternatives
```

Reducing to pitch classes discards octave and bass information. Capture the bass note
**before** reducing — it is what separates C6 from Am7, and inversions from root position.

## Candidates

Templates as semitone offsets from the root:

| Quality | Offsets | Notes |
|---|---|---|
| major | 0 4 7 | |
| minor | 0 3 7 | |
| diminished | 0 3 6 | |
| augmented | 0 4 8 | |
| sus2 | 0 2 7 | 3rd replaced |
| sus4 | 0 5 7 | 3rd replaced |
| 5 (power) | 0 7 | no quality — do not label major or minor |
| 6 | 0 4 7 9 | |
| m6 | 0 3 7 9 | |
| 7 | 0 4 7 10 | dominant |
| maj7 | 0 4 7 11 | |
| m7 | 0 3 7 10 | |
| m7b5 | 0 3 6 10 | |
| dim7 | 0 3 6 9 | symmetric — 4 enharmonic spellings, needs context |
| add9 | 0 4 7 14 | 3rd retained |
| 9 | 0 4 7 10 14 | implies the 7th |

Generate against all 12 roots, then score. Add extensions **only** when the evidence supports
them — labelling a triad as an 11th chord because one stray note appeared is a worse error
than under-labelling.

## Scoring

Weigh, don't filter:

- **Required tones present.** Root and 3rd carry the identity. The **5th is routinely
  omitted** on guitar and its absence must cost almost nothing.
- **Extra tones.** Penalize notes outside the template, but lightly — open strings ring
  whether they belong or not.
- **Bass note.** Bass == root supports root position. Bass == another chord tone means an
  inversion, which is a *different label* (`C/E`), not a worse match.
- **Missing root.** Legitimate for jazz voicings; heavily penalize for open-position guitar
  where the root is nearly always played.
- **Doubling.** A doubled root strengthens the root hypothesis.
- **Key context.** Diatonic candidates in the established key outrank chromatic ones.
- **Adjacent chords.** Functional motion (V→I, ii→V) is likelier than an arbitrary pair.
- **Playability.** If two labels fit equally, prefer the one with a plausible guitar
  fingering in the current tuning near the previous hand position.

### The ambiguity that actually matters

`{C, E, G, A}` is genuinely ambiguous:

- **C6** — root C, added 6th. Likely if the bass is C and the key is C.
- **Am7** — root A, minor 7th (A C E G). Likely if the bass is A, or the key is C and the
  chord functions as vi.

Same four pitch classes, two correct answers, decided **only** by bass note and key. This is
why bass and context are inputs, not refinements.

By contrast `{C, E, G}` is not meaningfully ambiguous — it is C major, or `C/E` / `C/G` by
bass note. Do not manufacture candidates like A minor or F major for it: A minor requires A,
F major requires F and A, and none is present. Candidates whose required tones are simply
absent from the evidence belong to the *missing-note* branch of scoring and must be ranked
far below a template that actually matches. A scoring function that treats absent evidence as
weak evidence will hallucinate chords.

## Temporal smoothing

Per-frame chord output is unusable — it flickers. Aggregate pitch classes over ~100–250 ms,
and apply hysteresis: a new label must beat the current one by a margin *and* persist for
several frames before replacing it.

```
frames: C C C Am C C   →  C
```

A single dissenting frame is a transient, not a chord change. Real chord changes on guitar
also have a **strum smear** of 10–30 ms where both chords are partly sounding — during that
window the note set is genuinely a mixture, so a change should be committed after the smear,
not during it.

## Output

Report the label with its confidence, and expose alternatives when the margin is thin:

```
C major — 94%

Likely C major
  C major 47%  ·  A minor 42%
```

The second form is the honest rendering of a close call and is more useful than a confident
guess. Never round a 47% winner up to a plain answer.

Where the detected voicing is known, showing it alongside the label (`C/E`, or the fret
positions) tells the user something the label alone cannot.
