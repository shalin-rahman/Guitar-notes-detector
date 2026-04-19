import MusicEngine from './MusicEngine.js';

export default class UIManager {
    constructor(elements, tracker) {
        this.elements = elements;
        this.tracker = tracker;
        this.canvasCtx = this.elements.canvas.getContext('2d');
        window.addEventListener('resize', this.resizeCanvas.bind(this));
        this.resizeCanvas();
    }

    resizeCanvas() {
        this.elements.canvas.width = this.elements.canvas.parentElement.clientWidth - 40;
        this.elements.canvas.height = 120;
    }

    drawWaveform(dataArray) {
        this.canvasCtx.clearRect(0, 0, this.elements.canvas.width, this.elements.canvas.height);
        this.canvasCtx.lineWidth = 2;
        this.canvasCtx.strokeStyle = '#ffd700'; // Match golden theme
        this.canvasCtx.beginPath();
        const sliceWidth = this.elements.canvas.width * 1.0 / dataArray.length;
        let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] * 100.0;
            const y = this.elements.canvas.height / 2 + v;
            if (i === 0) this.canvasCtx.moveTo(x, y);
            else this.canvasCtx.lineTo(x, y);
            x += sliceWidth;
        }
        this.canvasCtx.stroke();
    }

    resetUI() {
        this.elements.currentNote.textContent = "--";
        this.elements.currentSargam.textContent = "-";
        this.elements.currentFreq.textContent = "0.0 Hz";
        this.elements.currentTab.textContent = "";
        this.elements.needle.style.transform = `rotate(0deg)`;
        this.elements.needle.classList.remove('in-tune');
    }

    render(freq, confidence = 0) {
        // Update Confidence Bar
        if (this.elements.confidenceBar) {
            this.elements.confidenceBar.style.width = `${confidence * 100}%`;
            this.elements.confidenceBar.style.background = confidence > 0.8 ? 'var(--primary)' : (confidence > 0.5 ? '#f59e0b' : '#ef4444');
        }

        if (freq <= 0 || freq >= 2000) return this.resetUI();

        const noteData = MusicEngine.freqToNote(freq);
        const sargamNote = MusicEngine.getSargamBase(noteData.name, this.elements.saRoot.value, this.elements.saSymbols.value);
        
        // Stabilize
        this.tracker.stabilizationBuffer.push({ name: noteData.name, sargam: sargamNote, cents: noteData.cents, tab: noteData.tab, freq: freq });
        if (this.tracker.stabilizationBuffer.length > 7) this.tracker.stabilizationBuffer.shift();
        
        let modeMap = {};
        let maxEl = this.tracker.stabilizationBuffer[0].name;
        let maxCount = 1;
        for (let d of this.tracker.stabilizationBuffer) {
            modeMap[d.name] = (modeMap[d.name] || 0) + 1;
            if (modeMap[d.name] > maxCount) { maxEl = d.name; maxCount = modeMap[d.name]; }
        }
        
        if (maxCount >= 4) {
            const stableData = this.tracker.stabilizationBuffer.slice().reverse().find(d => d.name === maxEl);
            
            this.elements.currentNote.textContent = stableData.name;
            this.elements.currentSargam.textContent = stableData.sargam;
            this.elements.currentFreq.textContent = `${stableData.freq.toFixed(1)} Hz`;
            this.elements.currentTab.textContent = stableData.tab ? `[ ${stableData.tab} ]` : "";
            
            this.elements.needle.style.transform = `rotate(${stableData.cents * 0.9}deg)`;
            stableData.cents > -6 && stableData.cents < 6 ? this.elements.needle.classList.add('in-tune') : this.elements.needle.classList.remove('in-tune');

            if (Math.abs(stableData.cents) < 10) {
                this.tracker.addToHistory(`${stableData.name} - ${stableData.sargam}`);
                this.tracker.addToTicker(`${stableData.name} [${stableData.sargam}]`, false);
                this.tracker.updateLast10(stableData.name, stableData.sargam);
                this.handleChordLogic(stableData.name, stableData.sargam);
            }
        }
    }
    
    handleChordLogic(stableName) {
        const baseNote = stableName.replace(/[0-9]/g, '');
        if (!this.tracker.recentNotes.includes(baseNote)) {
            this.tracker.recentNotes.push(baseNote);
            if (this.tracker.recentNotes.length > 5) this.tracker.recentNotes.shift();
            
            const predicted = MusicEngine.estimateBasicChord(this.tracker.recentNotes);
            this.elements.liveChord.textContent = predicted;
            if (predicted !== "None" && predicted !== "Unknown") {
                const sargamChordBase = MusicEngine.getSargamBase(predicted.split(' ')[0], this.elements.saRoot.value, this.elements.saSymbols.value);
                this.tracker.addToTicker(`${predicted} [${sargamChordBase}]`, true);
            }
            
            clearTimeout(this.tracker.noteClearTimeout);
            this.tracker.noteClearTimeout = setTimeout(() => {
                this.tracker.recentNotes = [];
                this.elements.liveChord.textContent = "None";
            }, 2500);
        }
    }
}
