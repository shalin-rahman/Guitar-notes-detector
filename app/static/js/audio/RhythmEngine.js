/**
 * Owns the groove: which voice fires on which 16th, how hard, and how far off
 * the straight grid it sits.
 *
 * Two things changed from the previous version and they are related:
 *
 *  - Patterns are velocity maps, not 1/0 hit maps, and they use all five voices.
 *    Before, `shuffle` and `swing` were plain aliases of `blues`, `straight` was
 *    an alias of `rock`, and `playTick` only ever fired kick/snare/hihat at a
 *    flat velocity — so `hihat-open` and `ride` were dead code and every style
 *    with a triplet feel played straight.
 *
 *  - Swing lives here, applied as a per-hit time offset. `BackingTrackEngine`
 *    used to swing by stretching alternate 16ths of the grid itself, which
 *    dragged the chord placement along with it. The grid is straight now; only
 *    drum hits are displaced. Do not reintroduce grid-level swing or the feel
 *    will be applied twice.
 */
export default class RhythmEngine {
    constructor(drumSampler) {
        this.sampler = drumSampler;

        // 16 steps per 4/4 measure. Values are velocities in 0..1; 0 is a rest.
        // `swing` is 0 for a straight feel and 1 for a full triplet feel.
        this.patterns = {
            // Straight 8th hats, backbeat, one pushed kick.
            'rock': {
                swing: 0,
                kick:        [1.0, 0, 0, 0,   0, 0, 0, 0,  0.9, 0, 0, 0,   0, 0, 0.6, 0],
                snare:       [0, 0, 0, 0,   1.0, 0, 0, 0,   0, 0, 0, 0,  1.0, 0, 0, 0],
                hihat:       [0.9, 0, 0.5, 0, 0.85, 0, 0.5, 0, 0.9, 0, 0.5, 0, 0.85, 0, 0, 0],
                'hihat-open':[0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0.8, 0],
                ride:        [0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0]
            },

            // 16th hats with 8th-note accents, syncopated second kick, snare ghost.
            'pop': {
                swing: 0,
                kick:        [1.0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0.9, 0,  0, 0, 0, 0],
                snare:       [0, 0, 0, 0,   1.0, 0, 0, 0,   0, 0, 0, 0,  1.0, 0, 0, 0.3],
                hihat:       [0.85, 0.4, 0.55, 0.4, 0.8, 0.4, 0.55, 0.4,
                              0.85, 0.4, 0.55, 0.4, 0.8, 0.4, 0.55, 0.45],
                'hihat-open':[0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0],
                ride:        [0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0]
            },

            // 12/8 shuffle on the ride, triplet feel, kick on 1 and 3.
            'blues': {
                swing: 1,
                kick:        [1.0, 0, 0, 0,   0, 0, 0, 0,  0.85, 0, 0, 0,  0, 0, 0, 0],
                snare:       [0, 0, 0, 0,   1.0, 0, 0, 0,   0, 0, 0, 0,  1.0, 0, 0, 0.25],
                hihat:       [0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0],
                'hihat-open':[0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0],
                ride:        [0.8, 0, 0.45, 0, 0.75, 0, 0.45, 0,
                              0.8, 0, 0.45, 0, 0.75, 0, 0.45, 0]
            },

            // Same triplet feel as blues but driven on the hats, with an open-hat lift.
            'shuffle': {
                swing: 1,
                kick:        [1.0, 0, 0, 0,   0, 0, 0, 0.4, 0.85, 0, 0, 0,  0, 0, 0, 0],
                snare:       [0, 0, 0, 0,   1.0, 0, 0, 0,   0, 0, 0, 0,  1.0, 0, 0, 0],
                hihat:       [0.9, 0, 0.5, 0, 0.85, 0, 0.5, 0, 0.9, 0, 0.5, 0, 0.85, 0, 0, 0],
                'hihat-open':[0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0.75, 0],
                ride:        [0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0]
            },

            // Jazz: ride pattern carries time, hat on 2 and 4, kick feathered,
            // snare comping as ghost notes.
            'swing': {
                swing: 1,
                kick:        [0.22, 0, 0, 0, 0.2, 0, 0, 0, 0.22, 0, 0, 0, 0.2, 0, 0, 0],
                snare:       [0, 0, 0, 0,   0, 0, 0.28, 0,  0, 0, 0, 0,  0, 0, 0.32, 0],
                hihat:       [0, 0, 0, 0,  0.55, 0, 0, 0,   0, 0, 0, 0, 0.55, 0, 0, 0],
                'hihat-open':[0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0],
                ride:        [0.8, 0, 0.45, 0, 0.7, 0, 0.45, 0,
                              0.8, 0, 0.45, 0, 0.7, 0, 0.45, 0]
            },

            // Plainest possible straight-8ths time: no fills, no accents worth the name.
            'straight': {
                swing: 0,
                kick:        [1.0, 0, 0, 0,   0, 0, 0, 0,  0.95, 0, 0, 0,  0, 0, 0, 0],
                snare:       [0, 0, 0, 0,   1.0, 0, 0, 0,   0, 0, 0, 0,  1.0, 0, 0, 0],
                hihat:       [0.7, 0, 0.7, 0, 0.7, 0, 0.7, 0, 0.7, 0, 0.7, 0, 0.7, 0, 0.7, 0],
                'hihat-open':[0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0],
                ride:        [0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0,   0, 0, 0, 0]
            }
        };

        this.voices = ['kick', 'snare', 'hihat', 'hihat-open', 'ride'];
    }

    async loadSamples() {
        await this.sampler.loadSamples();
    }

    /**
     * How far a 16th step sits from its straight position, in 16ths.
     *
     * Straight, the four 16ths of a beat sit at 0, 1/4, 1/2, 3/4 of the beat.
     * At a full triplet feel they sit at 0, 1/3, 2/3, 5/6. `swing` interpolates
     * between the two, so 0 is dead straight and 1 is a proper shuffle.
     */
    swingOffsetIn16ths(step, swing) {
        if (!swing) return 0;
        // Offsets expressed as a fraction of a beat, then scaled to 16ths (×4).
        const perBeat = [0, 1 / 3 - 1 / 4, 2 / 3 - 1 / 2, 5 / 6 - 3 / 4];
        return perBeat[step % 4] * swing * 4;
    }

    /**
     * Fire whatever the pattern places on this 16th.
     *
     * @param sixteenthDur seconds per straight 16th note. Defaults to 0, which
     *   collapses every swing offset to zero — a caller that cannot supply the
     *   tempo gets a straight feel rather than wrong timing.
     */
    playTick(genre, tickIndex, startTime, volume = 0.8, sixteenthDur = 0) {
        const pattern = this.patterns[genre] || this.patterns['pop'];
        const step = ((tickIndex % 16) + 16) % 16;

        const offset = this.swingOffsetIn16ths(step, pattern.swing) * sixteenthDur;
        const when = startTime + offset;

        for (const voice of this.voices) {
            const row = pattern[voice];
            if (!row) continue;
            const vel = row[step];
            if (!vel) continue;
            this.sampler.scheduleDrumHit(voice, when, Math.min(1, vel * volume));
        }
    }
}
