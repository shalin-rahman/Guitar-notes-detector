# Sound Design: Sampling, Strumming, Synthesis

## What buys realism, in order

real licensed samples → multisamples → velocity variation → string-aware voicing →
strum direction → subtle timing/velocity humanization → synthesis fallback

Spend from the left. Each step is worth more than everything to its right, so reaching for
humanization while still shifting a sample five semitones is effort in the wrong place.

## Sampling vocabulary

- **Sample** — a recorded audio file of one note or hit.
- **Sample pack / soundfont** — a set of samples covering an instrument's range.
- **Round robin** — alternating between several recordings of the same note so repeats don't
  sound identical.
- **Velocity layer** — different recordings for soft vs. hard attack. Volume scaling alone
  does not reproduce this: a hard pick changes timbre, not just level.
- **Pitch shifting** — resampling a nearby note to cover a missing one.
- **Multisampling** — recording enough notes that shifting stays small.
- **Sustain / release / decay** — envelope stages. Guitar has a sharp attack and a long,
  non-linear decay.
- **Dry / wet** — before / after effects.

## Pitch shifting has a quality budget

Playing a buffer at a different rate changes pitch *and* duration and shifts formants. It is
acceptable within roughly **±2 semitones** and degrades audibly beyond ±3 — a shifted note
sounds like a different instrument, not the same one played higher.

Ahordian ships 19 samples per tone across E2–C6 (MIDI 40–84, roughly every 3 semitones, so
no note inside the range needs more than **1 semitone** of shift) and covers the gaps by
shifting from the
nearest sampled neighbour: `rate = 2 ** ((target - source) / 12)`, so a semitone is `1.0595`.
Exact matches must play at rate `1.0`. If a note requires more than ~2 semitones of shift,
adding a sample is the better fix than accepting the artefact.

## Strumming is not a chord played at once

A strum is a **sequence** of note attacks in one gesture:

- Adjacent-string delay: **10–30 ms**, tighter for fast strums, wider for slow ones.
- **Downstroke** sounds low string → high; **upstroke** sounds high → low. The order is
  the primary perceptual cue, more than any timbre difference.
- Amplitude is uneven across strings — the pick does not hit them all equally.
- The strings the pick crosses may be a subset of six (partial strum).
- Muted strings produce a percussive click with no pitch, and removing them entirely sounds
  less realistic than including the click.
- Chord changes overlap: the previous chord's ring decays into the next attack.

Playing six buffers at the same timestamp sounds synthetic and always will, no matter how good
the samples are.

## Humanization

Small deliberate variation, applied per note:

- Timing jitter around the strum delay, a few ms.
- Velocity variation per string.
- Slight pitch variation (a few cents) — real fretting is not perfect.
- Release/damping variation between notes.

Keep it small. Overdone humanization reads as sloppy playing, not as human playing. Vary each
note independently; a single random offset applied to the whole chord changes nothing
perceptually.

## Synthesis fallback

`GuitarSynthFallback` exists so the app makes sound before or without samples. Treat it as a
**graceful degradation path, not a competing instrument**: it must accept the same note
requests, respect the same envelope shape, and route through the same gain structure so
switching between sampled and synth playback does not change levels.

Physically-informed approaches (Karplus-Strong plucked string, additive with an inharmonic
partial series) sound far more guitar-like than a bare oscillator, but a fallback that is
always available beats a better one that sometimes fails to initialize.

## Rules

- Never bypass `AudioSessionManager` — every source node is registered so exclusivity and
  global stop work.
- Never let two packs share a buffer key. `SampleManager.buffers` is one flat map; keys are
  namespaced (`guitar:<tone>:<note>`) because two tones cover identical note names and the
  second load would otherwise silently overwrite the first with no error anywhere.
- Load lazily and memoize per pack; do not fetch every tone on cold start.
- Preload before a timed exercise starts. A first-note fetch stall inside a metronome-driven
  drill is a functional bug, not a slow load.
- Decode once, reuse the `AudioBuffer`. Never re-decode per note.
