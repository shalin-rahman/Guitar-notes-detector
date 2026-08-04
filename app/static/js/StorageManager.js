export default class StorageManager {
    static SETTINGS_KEY = 'ahordian_settings';
    static HISTORY_KEY = 'ahordian_history';

    static DEFAULT_SETTINGS = {
        handedness: 'right',
        // Must match an AppConfig.ALTERNATE_TUNINGS name — the settings <option>
        // values come from there, and a value matching none of them leaves the
        // select rendering blank.
        defaultTuning: 'Standard',
        // A GUITAR_TONES id from audio/GuitarSampler.js — also the directory name
        // under static/audio/guitar/.
        guitarTone: 'steel',
        metronome: {
            bpm: 120,
            sound: 'beep',
            signature: 4
        }
    };

    static loadSettings() {
        try {
            const data = localStorage.getItem(this.SETTINGS_KEY);
            if (data) {
                return { ...this.DEFAULT_SETTINGS, ...JSON.parse(data) };
            }
        } catch (e) {
            console.error("Failed to load settings:", e);
        }
        return this.DEFAULT_SETTINGS;
    }

    static saveSettings(settings) {
        try {
            const current = this.loadSettings();
            const updated = { ...current, ...settings };
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(updated));
        } catch (e) {
            console.error("Failed to save settings:", e);
        }
    }

    static saveRecentItem(item) {
        try {
            let history = JSON.parse(localStorage.getItem(this.HISTORY_KEY) || '[]');
            // Remove if already exists to put it at the top
            history = history.filter(h => h.id !== item.id);
            history.unshift({ ...item, timestamp: Date.now() });
            
            // Keep only last 10
            if (history.length > 10) history.pop();
            
            localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
        } catch (e) {
            console.error("Failed to save recent item:", e);
        }
    }

    static getRecentItems() {
        try {
            return JSON.parse(localStorage.getItem(this.HISTORY_KEY) || '[]');
        } catch (e) {
            return [];
        }
    }
}
