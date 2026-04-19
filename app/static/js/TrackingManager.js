export default class TrackingManager {
    constructor(elements) {
        this.elements = elements; 
        this.recentNotes = [];
        this.noteClearTimeout = null;
        this.stabilizationBuffer = [];
        this.last10Buffer = [];
        this.lastHistoryItem = "";
        this.lastHistoryTime = 0;
    }

    addToTicker(text, isChord) {
        const ticker = this.elements.scrollingTicker;
        const el = document.createElement('div');
        el.className = 'ticker-item' + (isChord ? ' chord-item' : '');
        el.textContent = text;
        ticker.appendChild(el);
        setTimeout(() => { if (ticker.contains(el)) el.remove(); }, 4000);
    }

    addToHistory(note) {
        const now = Date.now();
        if (note === this.lastHistoryItem && now - this.lastHistoryTime < 2000) return;
        this.lastHistoryItem = note;
        this.lastHistoryTime = now;

        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `<span class="note">${note}</span><span class="time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>`;
        
        this.elements.historyList.prepend(item);
        this.elements.historyList.querySelectorAll('.empty-state').forEach(p => p.remove());
        if (this.elements.historyList.children.length > 20) this.elements.historyList.removeChild(this.elements.historyList.lastChild);
    }

    updateLast10(note, sargam) {
        const entry = { n: note, s: sargam };
        if (this.last10Buffer.length > 0 && this.last10Buffer[this.last10Buffer.length - 1].n === note) return;
        this.last10Buffer.push(entry);
        if (this.last10Buffer.length > 10) this.last10Buffer.shift();
        
        this.elements.last10List.innerHTML = this.last10Buffer.map(e => `
            <span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; border: 1px solid var(--glass-border);">
                <strong style="color:var(--primary)">${e.n}</strong> 
                <span style="color:#fbbf24">[${e.s}]</span>
            </span>`).join('');
    }

    exportLog() {
        let content = "Ahordian Transcription Export\n=============================\n\n";
        const items = this.elements.historyList.querySelectorAll('.history-item');
        if (items.length === 0) return alert("No transcription data to save yet.");
        
        Array.from(items).reverse().forEach(item => {
            content += item.innerText.replace(/\n+/g, '\n') + "\n\n";
        });
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ahordian-Export-${new Date().getTime()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }
}
