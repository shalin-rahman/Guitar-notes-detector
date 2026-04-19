import PitchDetector from './PitchDetector.js';
import MusicEngine from './MusicEngine.js';

export default class FileManager {
    static init(dropZone, fileInput, tracker) {
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { 
            e.preventDefault(); 
            dropZone.style.borderColor = 'var(--primary)'; 
            dropZone.style.background = 'rgba(255,215,0,0.05)';
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.style.borderColor = 'var(--glass-border)';
            dropZone.style.background = '';
        });
        dropZone.addEventListener('drop', (e) => { 
            e.preventDefault(); 
            dropZone.style.borderColor = 'var(--glass-border)';
            dropZone.style.background = '';
            if (e.dataTransfer.files.length) FileManager.processLocally(e.dataTransfer.files[0], tracker); 
        });
        fileInput.addEventListener('change', (e) => { 
            if (e.target.files.length) FileManager.processLocally(e.target.files[0], tracker); 
        });
    }

    static async processLocally(file, tracker) {
        tracker.addToHistory(`[Local DSP] Initializing analysis for ${file.name}...`);
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            
            const channelData = audioBuffer.getChannelData(0); // Primary channel
            const sampleRate = audioBuffer.sampleRate;
            const windowSize = 2048;
            const stepSize = 1024; // 50% overlap for precision
            
            tracker.addToHistory(`Processing ${Math.round(audioBuffer.duration)}s audio buffer...`);
            
            const detectedSequence = [];
            let lastNote = null;
            let stabilityCount = 0;

            for (let i = 0; i < channelData.length - windowSize; i += stepSize) {
                const chunk = channelData.slice(i, i + windowSize);
                const freq = PitchDetector.autoCorrelate(chunk, sampleRate, 85);
                const noteData = MusicEngine.freqToNote(freq);

                if (noteData && Math.abs(noteData.cents) < 15) {
                    if (noteData.name === lastNote) {
                        stabilityCount++;
                        if (stabilityCount === 3) { // Note is stable for ~70ms
                            detectedSequence.push({
                                note: noteData.name,
                                time: i / sampleRate
                            });
                        }
                    } else {
                        lastNote = noteData.name;
                        stabilityCount = 0;
                    }
                } else {
                    lastNote = null;
                    stabilityCount = 0;
                }
            }

            // Filter duplicates and transients
            const uniqueTranscription = [];
            let current = null;
            detectedSequence.forEach(hit => {
                if (!current || hit.note !== current.note) {
                    uniqueTranscription.push(hit);
                    current = hit;
                }
            });

            // Render Report
            const report = document.createElement('div');
            report.className = 'history-item advanced-report';
            report.style.borderLeft = '4px solid var(--primary)';
            report.innerHTML = `
                <div class="report-header" style="margin-bottom: 10px;">
                    <strong style="color: var(--primary);">DSP Analysis: ${file.name}</strong>
                    <p style="font-size: 0.8rem; color: var(--text-muted);">${uniqueTranscription.length} nodes detected across ${audioBuffer.duration.toFixed(1)}s</p>
                </div>
                <div class="transcription-timeline" style="display: flex; gap: 4px; overflow-x: auto; padding: 10px 0; border-top: 1px solid var(--glass-border);">
                    ${uniqueTranscription.map(t => `
                        <div class="timeline-node" style="padding: 4px 8px; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 4px; min-width: 50px; text-align: center;">
                            <div style="color: var(--primary); font-weight: 800;">${t.note.replace(/[0-9]/g, '')}</div>
                            <div style="font-size: 0.6rem; color: var(--text-muted);">${t.time.toFixed(1)}s</div>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 10px;">
                    <button class="primary-btn small-btn" onclick="window.AhordianApp.playSequence(${JSON.stringify(uniqueTranscription.map(t => t.note.replace(/[0-9]/g, ''))).replace(/"/g, '&quot;')})">Play Transcribed Riff</button>
                    <button class="secondary-btn small-btn" onclick="window.AhordianApp.loadTranscriptionToTape(${JSON.stringify(uniqueTranscription.map(t => t.note.replace(/[0-9]/g, ''))).replace(/"/g, '&quot;')})">Send to Tape</button>
                </div>
            `;
            
            tracker.elements.historyList.prepend(report);
            tracker.elements.historyList.querySelectorAll('.empty-state').forEach(p => p.remove());

        } catch (err) {
            tracker.addToHistory(`Local Analysis Error: ${err.message}`);
            console.error(err);
        }
    }
}
