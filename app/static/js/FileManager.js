export default class FileManager {
    static init(dropZone, fileInput, tracker) {
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent)'; });
        dropZone.addEventListener('dragleave', () => dropZone.style.borderColor = 'var(--glass-border)');
        dropZone.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files.length) FileManager.handleUpload(e.dataTransfer.files[0], tracker); });
        fileInput.addEventListener('change', (e) => { if (e.target.files.length) FileManager.handleUpload(e.target.files[0], tracker); });
    }

    static async handleUpload(file, tracker) {
        tracker.addToHistory(`Analyzing ${file.name} (Advanced Transcription)...`);
        
        const historyItems = tracker.elements.historyList.querySelectorAll('.history-item');
        let targetItem = historyItems[0];
        
        if (targetItem) {
            const progressDisplay = document.createElement('div');
            progressDisplay.id = 'upload-progress-text';
            progressDisplay.style.cssText = 'color: var(--primary); font-size: 0.85rem; margin-top: 5px; font-weight: bold;';
            progressDisplay.textContent = 'Initiating backend audio matrix...';
            targetItem.appendChild(progressDisplay);
            
            const progressSteps = [
                "Extracting harmonic arrays...",
                "Running algorithmic librosa bounds...",
                "Filtering overlapping noise gates...",
                "Mapping Sargam relatives...",
                "Finalizing timeline vectors..."
            ];
            let step = 0;
            FileManager.progressInterval = setInterval(() => {
                const pt = document.getElementById('upload-progress-text');
                if (pt) {
                    pt.textContent = progressSteps[step];
                    step = (step + 1) % progressSteps.length;
                }
            }, 3500);
        }

        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch('/analyze', { method: 'POST', body: formData });
            
            if (FileManager.progressInterval) clearInterval(FileManager.progressInterval);
            const pt = document.getElementById('upload-progress-text');
            if (pt) pt.textContent = "Transcription Complete!";

            const data = await response.json();
            if (data.error) throw new Error(data.error);
            
            const report = document.createElement('div');
            report.className = 'history-item advanced-report';
            report.innerHTML = `
                <div class="report-header">
                    <strong>Analysis for ${file.name}</strong>
                    <p>BPM: ${data.bpm | 0} | Tone: ${data.tone}</p>
                </div>
                <table>
                    <thead><tr><th>Time</th><th>Chord</th></tr></thead>
                    <tbody>${data.chords.map(c => `<tr><td>${c.timestamp.toFixed(1)}s</td><td>${c.chord}</td></tr>`).join('')}</tbody>
                </table>
                <div class="tabs-block">
                    <strong>Raw Note Sequence (Standard Tuning Tabs):</strong>
                    <pre>${data.notes.map(n => n.tab || n.note).join(' -> ')}</pre>
                </div>
            `;
            tracker.elements.historyList.prepend(report);
            tracker.elements.historyList.querySelectorAll('.empty-state').forEach(p => p.remove());
        } catch (err) {
            tracker.addToHistory(`Error: ${err.message}`);
        }
    }
}
