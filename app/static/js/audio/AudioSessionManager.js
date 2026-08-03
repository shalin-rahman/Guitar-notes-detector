export const AudioSessionType = {
    METRONOME: "metronome",
    JAM_TRACK: "jam-track",
    EAR_TRAINING: "ear-training",
    NOTE_PREVIEW: "note-preview",
    TRANSCRIPTION: "transcription",
    ANALYSIS: "analysis"
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
        
        // Connect Master -> Compressor -> Destination
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);
        
        this.isMuted = false;
        this.previousMasterVolume = 1.0;
    }
    
    getDestination() {
        return this.masterGain;
    }
    
    setMasterVolume(val) {
        this.masterGain.gain.setValueAtTime(val, this.ctx.currentTime);
        if (val > 0) {
            this.isMuted = false;
            this.previousMasterVolume = val;
        } else {
            this.isMuted = true;
        }
    }
    
    toggleMute() {
        if (this.isMuted) {
            this.setMasterVolume(this.previousMasterVolume || 1.0);
        } else {
            this.previousMasterVolume = this.masterGain.gain.value;
            this.setMasterVolume(0);
        }
        return this.isMuted;
    }

    startSession(sessionType, options = { exclusive: false }) {
        if (options.exclusive) {
            this.activeSessions.clear();
        }
        this.activeSessions.add(sessionType);
        
        // Resume context if suspended
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        
        this.notifyStateChange();
    }
    
    stopSession(sessionType) {
        this.activeSessions.delete(sessionType);
        this.notifyStateChange();
    }
    
    stopAll() {
        this.activeSessions.clear();
        this.notifyStateChange();
    }
    
    isActive(sessionType) {
        return this.activeSessions.has(sessionType);
    }
    
    onStateChangeCallback = null;
    
    notifyStateChange() {
        if (this.onStateChangeCallback) {
            this.onStateChangeCallback(Array.from(this.activeSessions));
        }
    }
}
