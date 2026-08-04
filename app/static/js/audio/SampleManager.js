export const SampleStatus = {
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    PARTIAL: 'partial',
    ERROR: 'error'
};

export default class SampleManager {
    constructor(audioContext) {
        this.ctx = audioContext;
        this.buffers = new Map();
        this.status = SampleStatus.IDLE;
        this.onStatusChange = null;
        // label -> { label, loaded, total }, in the order the packs were requested,
        // so the UI can show one aggregate line: "Guitar 6/6 · Drums 5/5".
        this.packs = new Map();
    }

    /** Per-pack progress for the status UI. */
    getPackProgress() {
        return [...this.packs.values()];
    }

    setStatus(newStatus) {
        this.status = newStatus;
        if (this.onStatusChange) {
            this.onStatusChange(this.status, this.getPackProgress());
        }
    }
    
    async loadSample(key, url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.buffers.set(key, audioBuffer);
            return true;
        } catch (error) {
            console.warn(`SampleManager: Error loading ${key} from ${url}:`, error);
            return false;
        }
    }
    
    /**
     * Loads a pack of samples. Multiple packs (guitar, drums) are loaded concurrently
     * against one manager, so progress is accumulated on the instance rather than
     * per call — otherwise whichever pack finished last would overwrite the verdict
     * and a fully-loaded guitar pack could report ERROR because drums 404'd.
     */
    async loadSamplePack(packDefinition, packLabel = 'Audio') {
        const total = Object.keys(packDefinition).length;
        if (total === 0) return;

        this._expected = (this._expected || 0) + total;
        this._loaded = this._loaded || 0;
        this._pending = (this._pending || 0) + 1;

        const pack = { label: packLabel, loaded: 0, total };
        this.packs.set(packLabel, pack);

        this.setStatus(SampleStatus.LOADING);

        const loadPromises = Object.entries(packDefinition).map(async ([key, url]) => {
            const success = await this.loadSample(key, url);
            if (success) {
                // Safe without a lock: increments happen on the single JS thread.
                this._loaded++;
                pack.loaded++;
            }
        });

        await Promise.allSettled(loadPromises);

        this._pending--;
        // Report only once every in-flight pack has settled.
        if (this._pending > 0) return;

        if (this._loaded === this._expected) {
            this.setStatus(SampleStatus.READY);
        } else if (this._loaded > 0) {
            this.setStatus(SampleStatus.PARTIAL);
        } else {
            this.setStatus(SampleStatus.ERROR);
        }
    }
    
    getBuffer(key) {
        return this.buffers.get(key);
    }
    
    hasBuffer(key) {
        return this.buffers.has(key);
    }
}
