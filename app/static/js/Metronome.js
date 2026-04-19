export default class Metronome {
    constructor() {
        this.audioContext = null;
        this.nextTickTime = 0;
        this.bpm = 120;
        this.lookahead = 25.0; // How frequently to call scheduling function (in ms)
        this.scheduleAheadTime = 0.1; // How far ahead to schedule audio (in s)
        this.currentTick = 0;
        this.timerID = null;
        this.isPlaying = false;
        
        this.onTick = null; // Callback for visual pulse
    }

    initAudio() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    scheduler() {
        while (this.nextTickTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this.scheduleTick(this.currentTick, this.nextTickTime);
            this.advanceTick();
        }
    }

    advanceTick() {
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextTickTime += secondsPerBeat;
        this.currentTick++;
        if (this.currentTick === 4) this.currentTick = 0;
    }

    scheduleTick(beatNumber, time) {
        const osc = this.audioContext.createOscillator();
        const envelope = this.audioContext.createGain();

        osc.frequency.value = beatNumber === 0 ? 1000 : 800;
        envelope.gain.value = 1;
        envelope.gain.exponentialRampToValueAtTime(1, time);
        envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

        osc.connect(envelope);
        envelope.connect(this.audioContext.destination);

        osc.start(time);
        osc.stop(time + 0.1);

        if (this.onTick) {
            const delay = (time - this.audioContext.currentTime) * 1000;
            setTimeout(() => {
                if (this.isPlaying) this.onTick(beatNumber === 0);
            }, delay);
        }
    }

    start() {
        if (this.isPlaying) return;
        this.initAudio();
        this.isPlaying = true;
        this.currentTick = 0;
        this.nextTickTime = this.audioContext.currentTime;
        this.timerID = setInterval(() => this.scheduler(), this.lookahead);
    }

    stop() {
        this.isPlaying = false;
        clearInterval(this.timerID);
    }

    setBpm(newBpm) {
        this.bpm = Math.max(40, Math.min(250, newBpm));
    }
}
