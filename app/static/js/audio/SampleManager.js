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
    }
    
    setStatus(newStatus) {
        this.status = newStatus;
        if (this.onStatusChange) {
            this.onStatusChange(this.status);
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
    
    async loadSamplePack(packDefinition) {
        this.setStatus(SampleStatus.LOADING);
        
        let loadedCount = 0;
        const total = Object.keys(packDefinition).length;
        
        const loadPromises = Object.entries(packDefinition).map(async ([key, url]) => {
            const success = await this.loadSample(key, url);
            if (success) {
                loadedCount++;
            }
        });
        
        await Promise.allSettled(loadPromises);
        
        if (loadedCount === total) {
            this.setStatus(SampleStatus.READY);
        } else if (loadedCount > 0) {
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
