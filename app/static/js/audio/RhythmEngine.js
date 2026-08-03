export default class RhythmEngine {
    constructor(drumSampler) {
        this.sampler = drumSampler;
        
        // Patterns defined by 16th note steps (16 steps per measure in 4/4)
        this.patterns = {
            'pop': {
                kick:  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
                snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
                hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
            },
            'rock': {
                kick:  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
                snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
                hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
            },
            'blues': {
                kick:  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
                snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
                hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
            }
        };
        
        // Aliases so BackingTrackEngine style names map correctly
        this.patterns['shuffle'] = this.patterns['blues'];
        this.patterns['swing']   = this.patterns['blues'];
        this.patterns['straight'] = this.patterns['rock'];
    }

    async loadSamples() {
        await this.sampler.loadSamples();
    }

    // Called by a scheduler to play a specific 16th note tick
    playTick(genre, tickIndex, startTime, volume = 0.8) {
        const pattern = this.patterns[genre] || this.patterns['pop'];
        
        const step = tickIndex % 16;
        
        if (pattern.kick[step]) {
            this.sampler.scheduleDrumHit('kick', startTime, volume);
        }
        if (pattern.snare[step]) {
            this.sampler.scheduleDrumHit('snare', startTime, volume);
        }
        if (pattern.hihat[step]) {
            this.sampler.scheduleDrumHit('hihat', startTime, volume * 0.7); // Hi-hats usually quieter
        }
    }
}
