import AppConfig from './AppConfig.js';

export default class PitchDetector {
    static autoCorrelate(buf, sampleRate, sensitivityParam = 80) {
        let SIZE = buf.length;
        let MAX_SAMPLES = Math.floor(SIZE / 2);
        let best_offset = -1;
        let best_correlation = 0;
        let rms = 0;

        for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
        rms = Math.sqrt(rms / SIZE);
        
        let threshold = 0.002 + ((100 - sensitivityParam) / 100) * 0.098;
        if (rms < threshold) return -1;

        let lastCorrelation = 1;
        for (let offset = AppConfig.MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
            let correlation = 0;
            for (let i = 0; i < MAX_SAMPLES; i++) {
                correlation += Math.abs((buf[i]) - (buf[i + offset]));
            }
            correlation = 1 - (correlation / MAX_SAMPLES);

            if ((correlation > AppConfig.CORRELATION_THRESHOLD) && (correlation > lastCorrelation)) {
                if (correlation > best_correlation) {
                    best_correlation = correlation;
                    best_offset = offset;
                }
            }
            lastCorrelation = correlation;
        }
        if (best_correlation > 0.01) return sampleRate / best_offset;
        return -1;
    }
}
