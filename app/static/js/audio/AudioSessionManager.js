export const AudioSessionType = {
    METRONOME: { id: "metronome", label: "Metronome", screen: "home-screen" },
    JAM_TRACK: { id: "jam-track", label: "Jam Station", screen: "fretboard-screen" },
    EAR_TRAINING: { id: "ear-training", label: "Ear Training", screen: "ear-training-screen" },
    NOTE_PREVIEW: { id: "note-preview", label: "Note Preview", screen: "tools-screen" },
    TRANSCRIPTION: { id: "transcription", label: "Transcription", screen: "detector-screen" },
    ANALYSIS: { id: "analysis", label: "Audio Analysis", screen: "tools-screen" },
    TAB_PLAYER: { id: "tab-player", label: "Tab Player", screen: "tab-player-screen" }
};

export default class AudioSessionManager {
    constructor(audioContext) {
        this.ctx = audioContext;
        this.activeSessions = new Set();
        
        // Master routing architecture
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1.0;
        
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);
        
        // Instrument Gains
        this.instrumentGains = {
            guitar: this.ctx.createGain(),
            drums: this.ctx.createGain(),
            metronome: this.ctx.createGain(),
            default: this.ctx.createGain()
        };

        // Connect instruments to master
        Object.values(this.instrumentGains).forEach(gain => gain.connect(this.masterGain));

        // Connect Master -> Compressor -> Destination
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);
        
        this.isMuted = false;
        this.masterVolume = 1.0;
        this.onStateChangeCallback = null;
    }
    
    getDestination() {
        return this.instrumentGains.default;
    }

    getInstrumentDestination(name) {
        return this.instrumentGains[name] || this.instrumentGains.default;
    }
    
    setInstrumentVolume(name, val) {
        const gainNode = this.instrumentGains[name];
        if (gainNode) {
            gainNode.gain.setValueAtTime(val, this.ctx.currentTime);
        }
    }

    setMasterVolume(val) {
        this.masterVolume = val;
        if (!this.isMuted) {
            this.masterGain.gain.setValueAtTime(val, this.ctx.currentTime);
        }
        this.notifyStateChange();
    }
    
    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
        } else {
            this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
        }
        this.notifyStateChange();
        return this.isMuted;
    }

    startSession(sessionTypeObj, options = { exclusive: false }) {
        if (options.exclusive) {
            this.activeSessions.clear();
        }
        this.activeSessions.add(sessionTypeObj);
        
        // Resume context if suspended
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        
        this.notifyStateChange();
    }
    
    stopSession(sessionTypeObj) {
        this.activeSessions.delete(sessionTypeObj);
        this.notifyStateChange();
    }
    
    stopAll() {
        this.activeSessions.clear();
        this.notifyStateChange();
    }
    
    isActive(sessionTypeObj) {
        return this.activeSessions.has(sessionTypeObj);
    }
    
    getActiveState() {
        const activeArray = Array.from(this.activeSessions);
        if (activeArray.length === 0) {
            return { active: false, type: null, label: null, screen: null, muted: this.isMuted, masterVolume: this.masterVolume };
        }
        // Just return the most recently added session for the pill
        const current = activeArray[activeArray.length - 1];
        return {
            active: true,
            type: current.id,
            label: current.label,
            screen: current.screen,
            muted: this.isMuted,
            masterVolume: this.masterVolume
        };
    }

    notifyStateChange() {
        if (this.onStateChangeCallback) {
            this.onStateChangeCallback(this.getActiveState());
        }
    }
}
