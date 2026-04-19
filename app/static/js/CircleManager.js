import FretboardManager from './FretboardManager.js';
import AppConfig from './AppConfig.js';

export default class CircleManager {
    constructor(containerId, appRef) {
        this.container = document.getElementById(containerId);
        this.appRef = appRef;
        this.activeKeyIndex = -1;
        this.activeMode = 'major';
        
        this.fretboard = new FretboardManager('cof-fretboard');

        this.keys = [
            { maj: 'C',  min: 'Am',  sig: '0 Sharps/Flats' },
            { maj: 'G',  min: 'Em',  sig: '1 Sharp (F#)' },
            { maj: 'D',  min: 'Bm',  sig: '2 Sharps (F#, C#)' },
            { maj: 'A',  min: 'F#m', sig: '3 Sharps (F#, C#, G#)' },
            { maj: 'E',  min: 'C#m', sig: '4 Sharps (F#, C#, G#, D#)' },
            { maj: 'B',  min: 'G#m', sig: '5 Sharps (F#, C#, G#, D#, A#)' },
            { maj: 'F#', min: 'D#m', sig: '6 Sharps (F#, C#, G#, D#, A#, E#)' },
            { maj: 'Db', min: 'Bbm', sig: '5 Flats (Bb, Eb, Ab, Db, Gb)' },
            { maj: 'Ab', min: 'Fm',  sig: '4 Flats (Bb, Eb, Ab, Db)' },
            { maj: 'Eb', min: 'Cm',  sig: '3 Flats (Bb, Eb, Ab)' },
            { maj: 'Bb', min: 'Gm',  sig: '2 Flats (Bb, Eb)' },
            { maj: 'F',  min: 'Dm',  sig: '1 Flat (Bb)' }
        ];

        this.elements = {
            title: document.getElementById('cof-key-title'),
            sig: document.getElementById('cof-key-sig'),
            relMin: document.getElementById('cof-relative-minor'),
            diatonic: document.getElementById('cof-diatonic-chords'),
            playBtn: document.getElementById('cof-play-scale')
        };

        this.render();
        this.bindEvents();
        
        // Default to C Major so fretboard is visibly rendered immediately
        setTimeout(() => this.selectKey(0), 100);
    }

    render() {
        const size = 500;
        const center = size / 2;
        const outerRadius = 220;
        const midRadius = 140;
        const innerRadius = 60;

        let svg = `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" class="cof-svg">`;
        svg += `<defs>
            <filter id="cof-glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="cof-shadow"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.5"/></filter>
        </defs>`;

        // Draw segments
        for (let i = 0; i < 12; i++) {
            const angleStart = (i * 30 - 15 - 90) * Math.PI / 180;
            const angleEnd = ((i + 1) * 30 - 15 - 90) * Math.PI / 180;

            // Outer Segment (Major)
            const outerPath = this.createSegmentPath(center, center, midRadius, outerRadius, angleStart, angleEnd);
            svg += `<path d="${outerPath}" class="cof-segment cof-maj" data-idx="${i}" data-mode="major" fill="rgba(255, 255, 255, 0.05)" stroke="var(--glass-border)" stroke-width="2" />`;

            // Inner Segment (Minor)
            const innerPath = this.createSegmentPath(center, center, innerRadius, midRadius, angleStart, angleEnd);
            svg += `<path d="${innerPath}" class="cof-segment cof-min" data-idx="${i}" data-mode="minor" fill="rgba(0, 0, 0, 0.2)" stroke="var(--glass-border)" stroke-width="2" />`;

            // Text Placement
            const textAngle = (i * 30 - 90) * Math.PI / 180;
            const majX = center + Math.cos(textAngle) * (midRadius + (outerRadius - midRadius) / 2);
            const majY = center + Math.sin(textAngle) * (midRadius + (outerRadius - midRadius) / 2) + 6;
            
            const minX = center + Math.cos(textAngle) * (innerRadius + (midRadius - innerRadius) / 2);
            const minY = center + Math.sin(textAngle) * (innerRadius + (midRadius - innerRadius) / 2) + 5;

            svg += `<text x="${majX}" y="${majY}" class="cof-text cof-maj-text" data-idx="${i}" data-mode="major">${this.keys[i].maj}</text>`;
            svg += `<text x="${minX}" y="${minY}" class="cof-text cof-min-text" data-idx="${i}" data-mode="minor">${this.keys[i].min}</text>`;
        }

        // Center hub
        svg += `<circle cx="${center}" cy="${center}" r="${innerRadius}" fill="var(--bg-color)" stroke="var(--glass-border)" stroke-width="2" filter="url(#cof-shadow)"/>`;
        svg += `<text x="${center}" y="${center + 2}" class="cof-center-text" text-anchor="middle" dominant-baseline="middle">Key</text>`;

        svg += `</svg>`;
        this.container.innerHTML = svg;
    }

    createSegmentPath(cx, cy, rIn, rOut, aStart, aEnd) {
        const x1In = cx + rIn * Math.cos(aStart), y1In = cy + rIn * Math.sin(aStart);
        const x2In = cx + rIn * Math.cos(aEnd), y2In = cy + rIn * Math.sin(aEnd);
        const x1Out = cx + rOut * Math.cos(aStart), y1Out = cy + rOut * Math.sin(aStart);
        const x2Out = cx + rOut * Math.cos(aEnd), y2Out = cy + rOut * Math.sin(aEnd);
        const largeArc = (aEnd - aStart) > Math.PI ? 1 : 0;
        
        return `M ${x1In} ${y1In} L ${x1Out} ${y1Out} A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2Out} ${y2Out} L ${x2In} ${y2In} A ${rIn} ${rIn} 0 ${largeArc} 0 ${x1In} ${y1In} Z`;
    }

    bindEvents() {
        const segments = this.container.querySelectorAll('.cof-segment');
        segments.forEach(seg => {
            seg.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'));
                const mode = e.target.getAttribute('data-mode') || 'major';
                this.selectKey(idx, mode);
            });
        });

        this.elements.playBtn.addEventListener('click', () => {
            if (this.activeKeyIndex !== -1 && this.appRef) {
                const k = this.keys[this.activeKeyIndex];
                const rootName = this.activeMode === 'major' ? k.maj : k.min.replace('m', '');
                this.appRef.elements.manualNoteInput.value = rootName; // sets the exact parsed root note
                
                // Trigger the audio sequence locally without jumping tabs
                this.appRef.triggerScale(this.activeMode === 'major' ? 'Major (Ionian)' : 'Aeolian (Minor)');
            }
        });
    }

    selectKey(idx) {
        this.activeKeyIndex = idx;
        const k = this.keys[idx];

        // Format Diatonic Chords string logic
        const rootNote = k.maj;
        const rootIdx = AppConfig.NOTE_NAMES.indexOf(rootNote);
        const intervals = [0, 2, 4, 5, 7, 9, 11]; // Major Ionian scale
        const roman = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
        const diatonicArray = intervals.map((interval, index) => {
            const noteName = AppConfig.NOTE_NAMES[(rootIdx + interval) % 12];
            return `<strong>${roman[index]}</strong>: ${noteName}`;
        });

        // Calculate CAGED anchor frets (Standard Tuning assumption)
        // E-string root (Standard: E2 is offset 4) - fret = (rootIdx - 4 + 12) % 12
        const eFret = (rootIdx - AppConfig.NOTE_NAMES.indexOf('E') + 12) % 12;
        const aFret = (rootIdx - AppConfig.NOTE_NAMES.indexOf('A') + 12) % 12;
        const dFret = (rootIdx - AppConfig.NOTE_NAMES.indexOf('D') + 12) % 12;
        
        // C-shape (Root on A string, pinky) -> Index is aFret - 3
        // A-shape (Root on A string, index) -> Index is aFret
        // G-shape (Root on E string, pinky) -> Index is eFret - 3
        // E-shape (Root on E string, index) -> Index is eFret
        // D-shape (Root on D string, index) -> Index is dFret
        const cagedText = `
            <span class="caged-tag"><strong>C</strong>-Shape: Fr ${((aFret - 3 + 12) % 12) || 12}</span> | 
            <span class="caged-tag"><strong>A</strong>-Shape: Fr ${aFret || 12}</span> | 
            <span class="caged-tag"><strong>G</strong>-Shape: Fr ${((eFret - 3 + 12) % 12) || 12}</span> | 
            <span class="caged-tag"><strong>E</strong>-Shape: Fr ${eFret || 12}</span> | 
            <span class="caged-tag"><strong>D</strong>-Shape: Fr ${dFret || 12}</span>
        `;

        // Update UI info panel
        this.elements.title.textContent = `Key of ${k.maj} Major`;
        this.elements.sig.innerHTML = `<strong>Signature:</strong> ${k.sig}`;
        this.elements.relMin.innerHTML = `<strong>Relative Minor:</strong> ${k.min}`;
        this.elements.diatonic.innerHTML = `<strong>Diatonic Chords:</strong> <br> <span style="font-size: 0.9em;">${diatonicArray.join(' | ')}</span><br><br><strong>CAGED Roots:</strong> <br> <span style="font-size: 0.9em; color: var(--primary);">${cagedText}</span>`;
        this.elements.playBtn.disabled = false;
        
        // CSS Animation & Active State Reset
        this.container.querySelectorAll('.cof-segment').forEach(el => {
            el.classList.remove('active');
            el.style.fill = ''; // reset inline styles
        });
        this.container.querySelectorAll('.cof-text').forEach(el => {
            el.classList.remove('active');
            el.style.fill = '';
        });

        // Apply active state to the specific selected key
        this.container.querySelectorAll(`.cof-segment[data-idx="${idx}"]`).forEach(el => el.classList.add('active'));
        this.container.querySelectorAll(`.cof-text[data-idx="${idx}"]`).forEach(el => el.classList.add('active'));
        
        // Highlight Diatonic Neighbors (IV and V slice)
        const leftIdx = (idx - 1 + 12) % 12;
        const rightIdx = (idx + 1) % 12;
        [leftIdx, rightIdx].forEach(neighborIdx => {
            this.container.querySelectorAll(`.cof-segment[data-idx="${neighborIdx}"]`).forEach(el => {
                el.style.fill = 'rgba(255, 215, 0, 0.15)'; // Golden neighbor highlight
            });
            this.container.querySelectorAll(`.cof-text[data-idx="${neighborIdx}"]`).forEach(el => {
                el.style.fill = 'rgba(255, 215, 0, 0.7)';
            });
        });

        // Optional spin alignment animation (rotates the SVG to put selected key at top)
        const rotateAngle = -idx * 30;
        const svgEl = this.container.querySelector('svg');
        if (svgEl) {
            svgEl.style.transform = `rotate(${rotateAngle}deg)`;
        }
        
        // Keep the text upright despite SVG rotation!
        this.container.querySelectorAll('.cof-text').forEach(t => {
            t.style.transform = `rotate(${-rotateAngle}deg)`;
            t.style.transformOrigin = `${t.getAttribute('x')}px ${t.getAttribute('y')}px`;
        });
        
        // Render scale overlay on the Circle's localized fretboard instance
        const ascending = intervals.map(inter => AppConfig.NOTE_NAMES[(rootIdx + inter) % 12]);
        this.fretboard.showScale(ascending);
    }
}
