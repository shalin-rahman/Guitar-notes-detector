import AppConfig from './AppConfig.js';

export default class PitchDetector {
    static lastCorrelation = 0;
    static autoCorrelate(buf, sampleRate, sensitivityParam = 80) {
        let SIZE = buf.length;
        let rms = 0;
        for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
        rms = Math.sqrt(rms / SIZE);
        
        let threshold = 0.002 + ((100 - sensitivityParam) / 100) * 0.098;
        if (rms < threshold) return -1;

        let correlations = new Array(SIZE / 2).fill(0);

        // 1. True Autocorrelation (Multiplying signal against shifted self)
        for (let offset = 0; offset < SIZE / 2; offset++) {
            let correlation = 0;
            for (let i = 0; i < SIZE / 2; i++) {
                correlation += buf[i] * buf[i + offset];
            }
            correlations[offset] = correlation;
        }

        // 2. Normalize against energy at lag 0 (Perfect match = 1.0)
        let c0 = correlations[0];
        if (c0 === 0) return -1;
        for (let i = 0; i < correlations.length; i++) {
            correlations[i] /= c0;
        }

        // 3. Skip the initial DC offset peak to avoid mathematically trivial lag-0 errors
        let startLag = 0;
        while (startLag < correlations.length && correlations[startLag] >= 0) startLag++;
        while (startLag < correlations.length && correlations[startLag] <= 0) startLag++;

        let MIN_SAMPLES = Math.floor(sampleRate / 2000); // 2kHz limit
        if (startLag < MIN_SAMPLES) startLag = MIN_SAMPLES;
        let MAX_SAMPLES = Math.floor(sampleRate / 40);   // 40Hz limit

        let best_offset = -1;
        let best_correlation = 0;

        // 4. Peak picking with Octave-Error Prevention
        for (let offset = startLag; offset < MAX_SAMPLES && offset < correlations.length - 1; offset++) {
            let correlation = correlations[offset];
            
            if (correlation > correlations[offset - 1] && correlation > correlations[offset + 1]) {
                // Heuristic: The *First* prominent peak is the genuine fundamental. 
                // Later/higher peaks are harmonic overtones (octaves), locking early prevents false positives!
                if (correlation > 0.85) { 
                    best_correlation = correlation;
                    best_offset = offset;
                    break; 
                } else if (correlation > best_correlation) {
                    best_correlation = correlation;
                    best_offset = offset;
                }
            }
        }
        
        // 5. Parabolic Interpolation for Sub-sample Accuracy (Massively reduces latency jitter)
        this.lastCorrelation = best_correlation;
        if (best_correlation > 0.5 && best_offset > -1) {
            let y1 = correlations[best_offset - 1];
            let y2 = correlations[best_offset];
            let y3 = correlations[best_offset + 1];
            
            let exactOffset = best_offset;
            let denominator = (2 * y2 - y1 - y3);
            if (denominator > 0) {
                exactOffset += (y3 - y1) / (2 * denominator);
            }
            return sampleRate / exactOffset;
        }
        
        return -1;
    }
}
