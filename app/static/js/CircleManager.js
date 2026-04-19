import AppConfig from './AppConfig.js';
import FretboardManager from './FretboardManager.js';

export default class CircleManager {
    constructor(containerId, appRef = null) {
        this.container = document.getElementById(containerId);
        this.appRef = appRef;
        
        // Use dedicated fretboard if available on screen, else fallback to global
        const dedicatedFb = document.getElementById('cof-fretboard');
        if (dedicatedFb) {
            this.fretboard = new FretboardManager('cof-fretboard');
        } else {
            this.fretboard = appRef ? appRef.fretboard : null;
        }
        this.keys = [
            { maj: 'C', min: 'Am' }, { maj: 'G', min: 'Em' }, { maj: 'D', min: 'Bm' },
            { maj: 'A', min: 'F#m' }, { maj: 'E', min: 'C#m' }, { maj: 'B', min: 'G#m' },
            { maj: 'Gb', min: 'Ebm' }, { maj: 'Db', min: 'Bbm' }, { maj: 'Ab', min: 'Fm' },
            { maj: 'Eb', min: 'Cm' }, { maj: 'Bb', min: 'Gm' }, { maj: 'F', min: 'Dm' }
        ];

        this.elements = {
            title: document.getElementById('cof-key-title'),
            sig: document.getElementById('cof-key-sig'),
            scaleNotes: document.getElementById('cof-scale-notes'),
            relMinor: document.getElementById('cof-relative-minor'),
            diatonic: document.getElementById('cof-diatonic-chords'),
            playBtn: document.getElementById('cof-play-scale'),
            intervalsToggle: document.getElementById('cof-intervals-toggle'),
            voicingsToggle: document.getElementById('cof-show-voicings'),
            quizToggle: document.getElementById('cof-quiz-mode'),
            scaleSelect: document.getElementById('cof-scale-select'),
            positionFilters: document.getElementById('cof-position-filters'),
            extractPentaBtn: document.getElementById('cof-extract-penta'),
            quizType: document.getElementById('quiz-type'),
            quizModule: document.getElementById('quiz-module'),
            quizPrompt: document.getElementById('quiz-prompt'),
            quizStatus: document.getElementById('quiz-status'),
            quizStartBtn: document.getElementById('quiz-start-btn')
        };

        this.activeKeyIndex = -1;
        this.activeMode = 'major';
        this.currentScaleNotes = [];
        this.currentRot = 0;
        this.quizActive = false;
        this.targetNote = null;

        this.initScaleSelector();
        this.render();
        this.bindEvents();
    }

    render() {
        if (!this.container) return;
        const size = 600; 
        const center = size / 2;
        const outerRadius = 200;
        const midRadius = 135;
        const innerRadius = 75;

        let svg = `<svg viewBox="0 0 ${size} ${size}" class="cof-svg" id="circle-svg" style="overflow: visible;">
            <defs>
                <filter id="cof-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="5" />
                    <feOffset dx="0" dy="0" result="offsetblur" />
                    <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>`;

        // 1. ROTATING WHEEL GROUP
        svg += `<g id="cof-wheel" style="transition: transform 0.6s cubic-bezier(0.5, 0, 0.5, 1); transform-origin: ${center}px ${center}px;">`;
        
        const romanMap = ['I', 'V', 'II', 'VI', 'III', 'VII', 'IV#', 'Db', 'Ab', 'Eb', 'Bb', 'F']; 
        
        for (let i = 0; i < 12; i++) {
            const angleStart = (i * 30 - 15 - 90) * Math.PI / 180;
            const angleEnd = ((i + 1) * 30 - 15 - 90) * Math.PI / 180;
            const majKey = this.keys[i].maj;
            const baseColor = AppConfig.CHROMATIC_COLORS[majKey] || '#444';

            // Outer Major Segment (Restoring Chromatic Colors with high visibility)
            const outerPath = this.createSegmentPath(center, center, midRadius, outerRadius, angleStart, angleEnd);
            svg += `<path d="${outerPath}" class="cof-segment cof-maj" data-idx="${i}" data-mode="major" fill="${baseColor}" fill-opacity="0.8" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />`;

            // Inner Minor Segment
            const innerPath = this.createSegmentPath(center, center, innerRadius, midRadius, angleStart, angleEnd);
            svg += `<path d="${innerPath}" class="cof-segment cof-min" data-idx="${i}" data-mode="minor" fill="${baseColor}" fill-opacity="0.4" stroke="rgba(255,255,255,0.1)" stroke-width="1" />`;

            const textAngle = (i * 30 - 90) * Math.PI / 180;
            const majX = center + Math.cos(textAngle) * (midRadius + (outerRadius - midRadius) / 2);
            const majY = center + Math.sin(textAngle) * (midRadius + (outerRadius - midRadius) / 2);
            const minX = center + Math.cos(textAngle) * (innerRadius + (midRadius - innerRadius) / 2);
            const minY = center + Math.sin(textAngle) * (innerRadius + (midRadius - innerRadius) / 2);

            // Upright Key Labels (Straight as requested)
            svg += `<text x="${majX}" y="${majY}" class="cof-text cof-maj-text" data-idx="${i}" data-mode="major" style="transform-origin: ${majX}px ${majY}px; font-weight: 800; font-size: 18px;">${this.keys[i].maj}</text>`;
            svg += `<text x="${minX}" y="${minY}" class="cof-text cof-min-text" data-idx="${i}" data-mode="minor" style="transform-origin: ${minX}px ${minY}px; font-weight: 600; font-size: 13px;">${this.keys[i].min}</text>`;
        }
        svg += `</g>`;

        // 2. STATIC GROUP (The stationary parts)
        svg += `<g id="cof-static">
            <circle cx="${center}" cy="${center}" r="${innerRadius}" fill="var(--bg-color)" stroke="var(--glass-border)" stroke-width="2" filter="url(#cof-shadow)"/>
            <text x="${center}" y="${center}" class="cof-center-text" text-anchor="middle" dominant-baseline="middle" fill="var(--primary)" font-weight="900" font-size="24">KEY</text>
            
            <!-- Global Pointer -->
            <path d="M ${center-14} ${center-outerRadius-12} L ${center+14} ${center-outerRadius-12} L ${center} ${center-outerRadius+10} Z" fill="var(--primary)" />
            
            <!-- STATIC FUNCTIONAL ROMANS -->`;
        
        const romans = [
            { pos: 0, maj: 'I', min: 'vi' },
            { pos: 1, maj: 'V', min: 'iii' },
            { pos: -1, maj: 'IV', min: 'ii' },
            { pos: 5, maj: '', min: 'vii°' }
        ];

        romans.forEach(r => {
            const angle = (r.pos * 30 - 90) * Math.PI / 180;
            const rX = center + Math.cos(angle) * (outerRadius + 42);
            const rY = center + Math.sin(angle) * (outerRadius + 42);
            if (r.maj) svg += `<text x="${rX}" y="${rY - 8}" class="static-roman" fill="var(--primary)" font-size="22" font-weight="900" text-anchor="middle" dominant-baseline="middle" style="text-shadow:0 0 12px var(--primary-glow)">${r.maj}</text>`;
            if (r.min) svg += `<text x="${rX}" y="${rY + 12}" class="static-roman" fill="#aaa" font-size="16" font-weight="700" text-anchor="middle" dominant-baseline="middle">${r.min}</text>`;
        });

        svg += `</g>`;
        svg += `<g id="cof-neighborhood"></g>`;
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

    initScaleSelector() {
        if (!this.elements.scaleSelect) return;
        this.elements.scaleSelect.innerHTML = AppConfig.SCALE_DEFINITIONS.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
        this.elements.scaleSelect.value = "Major (Ionian)";
    }

    bindEvents() {
        this.container.querySelectorAll('.cof-segment').forEach(seg => {
            seg.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'));
                const mode = e.target.getAttribute('data-mode') || 'major';
                this.selectKey(idx, mode);
            });
        });

        this.elements.playBtn.addEventListener('click', () => {
            if (this.activeKeyIndex !== -1 && this.appRef) {
                const k = this.keys[this.activeKeyIndex];
                this.appRef.triggerScale(this.elements.scaleSelect.value, this.activeMode === 'major' ? k.maj : k.min);
            }
        });

        this.elements.intervalsToggle.addEventListener('change', (e) => {
            if (this.appRef && this.appRef.fretboard) this.appRef.fretboard.setDisplayMode(e.target.checked ? 'intervals' : 'notes');
        });

        this.elements.quizToggle.addEventListener('change', (e) => {
            this.elements.quizModule.style.display = e.target.checked ? 'block' : 'none';
            if (!e.target.checked) this.stopQuiz();
        });

        this.elements.quizStartBtn.addEventListener('click', () => {
            if (this.quizActive) this.stopQuiz();
            else this.startQuiz();
        });

        if (this.elements.extractPentaBtn) {
            this.elements.extractPentaBtn.addEventListener('click', () => this.extractPentatonic());
        }
    }

    startQuiz() {
        if (this.activeKeyIndex === -1) {
            this.elements.quizStatus.textContent = "Please select a key on the circle first!";
            return;
        }
        this.quizActive = true;
        this.elements.quizStartBtn.textContent = "Stop Quiz";
        this.nextQuizRound();
    }

    stopQuiz() {
        this.quizActive = false;
        this.targetNote = null;
        this.elements.quizStartBtn.textContent = "Start Quiz";
        this.elements.quizPrompt.textContent = "Ready?";
        this.elements.quizStatus.textContent = "Select a key, then press start.";
    }

    nextQuizRound() {
        if (!this.quizActive) return;
        const type = this.elements.quizType.value;
        const randIdx = Math.floor(Math.random() * this.currentScaleNotes.length);
        this.targetNote = this.currentScaleNotes[randIdx];

        if (type === 'degree') {
            const degrees = ['1st (Root)', '2nd', '3rd', '4th', '5th', '6th', '7th'];
            this.elements.quizPrompt.textContent = `Find: ${degrees[randIdx]}`;
        } else {
            this.elements.quizPrompt.textContent = `Find: ???`; 
            if (this.appRef && this.appRef.player) this.appRef.player.playNote(this.targetNote + "4");
        }
        this.elements.quizStatus.textContent = "Play it on your guitar...";
    }

    handleDetectedNote(noteName) {
        if (!this.quizActive || !this.targetNote) return;
        const noteOnly = noteName.replace(/[0-9]/g, '');
        if (noteOnly === this.targetNote) {
            this.elements.quizPrompt.textContent = "CORRECT! ✨";
            this.elements.quizStatus.textContent = `Great! That was indeed ${this.targetNote}`;
            if (this.fretboard) {
                this.fretboard.showScale([this.targetNote]);
                this.fretboard.pluckString(0); // visual ping
            }
            this.targetNote = null;
            setTimeout(() => this.nextQuizRound(), 1500);
        }
    }

    selectKey(idx, mode = null) {
        if (mode) this.activeMode = mode;
        this.activeKeyIndex = idx;
        const k = this.keys[idx];
        const rootNote = this.activeMode === 'major' ? k.maj : k.min;
        
        const flatMap = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'F#m': 'F#', 'C#m': 'C#', 'G#m': 'G#', 'Ebm': 'D#', 'Bbm': 'A#', 'Fm': 'F', 'Cm': 'C', 'Gm': 'G', 'Dm': 'D', 'Am': 'A', 'Em': 'E', 'Bm': 'B' };
        let searchNote = rootNote.replace('m', '');
        if (flatMap[rootNote]) searchNote = flatMap[rootNote].replace('m', '');
        const rootIdx = AppConfig.NOTE_NAMES.indexOf(searchNote);
        
        const rot = -idx * 30;
        const wheel = document.getElementById('cof-wheel');
        if (wheel) wheel.style.transform = `rotate(${rot}deg)`;
        
        this.container.querySelectorAll('.cof-text').forEach(el => {
            el.style.transform = `rotate(${-rot}deg)`;
            el.style.transition = 'transform 0.6s cubic-bezier(0.5, 0, 0.5, 1)';
        });

        this.elements.title.textContent = `${rootNote} ${this.activeMode === 'major' ? 'Major (Ionian)' : 'Minor (Aeolian)'}`;
        this.elements.relMinor.textContent = `Relative ${this.activeMode === 'major' ? 'Minor' : 'Major'}: ${this.activeMode === 'major' ? k.min : k.maj}`;
        
        const scaleDef = AppConfig.SCALE_DEFINITIONS.find(s => s.name === this.elements.scaleSelect.value) || AppConfig.SCALE_DEFINITIONS[0];
        const intervals = scaleDef.intervals || scaleDef.arohan || [0];
        
        const currentNotes = intervals.map(inter => AppConfig.NOTE_NAMES[(rootIdx + inter) % 12]);
        if (this.elements.scaleNotes) {
            this.elements.scaleNotes.innerHTML = currentNotes.map(n => 
                `<button class="note-pill-btn" onclick="window.AhordianApp.circleManager.showNote('${n}')">${n}</button>`
            ).join(' ');
        }
        this.currentScaleNotes = currentNotes;
        const formulaMap = { 0: '1', 1: 'b2', 2: '2', 3: 'b3', 4: '3', 5: '4', 6: '#4', 7: '5', 8: 'b6', 9: '6', 10: 'b7', 11: '7' };
        
        // Advanced: Calculate Key Signature (Sharps/Flats)
        const sigData = this.getKeySignatureDetails(idx);
        let sigText = sigData.count === 0 ? "Natural Key" : `${sigData.count} ${sigData.type === '#' ? "Sharps (#)" : "Flats (b)"}`;
        if (sigData.notes.length > 0) {
            sigText += ` <span style="font-size:0.7rem; color:var(--primary); opacity:0.8;">(${sigData.notes.join(', ')})</span>`;
        }
        
        const roman = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
        this.updatePositionFilters(rootIdx, rootNote);
        this.fretboard.showScale(this.currentScaleNotes);
        
        // UI Display
        this.elements.sig.innerHTML = `<span style="color:var(--primary)">Signature:</span> ${sigText} <br> <span style="color:var(--text-muted); font-size:0.75rem;">Formula: ${intervals.map(i => formulaMap[i % 12] || i).join(' ')}</span>`;

        this.elements.diatonic.innerHTML = intervals.map((interval, index) => {
            const chordRootName = AppConfig.NOTE_NAMES[(rootIdx + interval) % 12];
            const label = roman[index] || (index + 1);
            const isMinor = label.toLowerCase() === label;
            const isDim = label.includes('°');
            const triadIntervals = isDim ? [0, 3, 6] : (isMinor ? [0, 3, 7] : [0, 4, 7]);
            const chordIdx = AppConfig.NOTE_NAMES.indexOf(chordRootName);
            const triadNotes = triadIntervals.map(i => AppConfig.NOTE_NAMES[(chordIdx + i) % 12]);
            const btnData = JSON.stringify(triadNotes).replace(/"/g, '&quot;');
            return `<button class="cof-chord-btn" onclick="window.AhordianApp.circleManager.playDiatonicChord('${chordRootName}', ${btnData})"><strong>${label}</strong><br>${chordRootName}${isMinor && !isDim ? 'm' : ''}${isDim ? 'dim' : ''}</button>`;
        }).join('');

        this.updateHarmonicNeighborhood(idx);

        this.elements.playBtn.disabled = false;
        if (this.elements.extractPentaBtn) {
            this.elements.extractPentaBtn.disabled = (intervals.length !== 7);
        }
    }

    getKeySignatureDetails(idx) {
        // Circle sequence: C G D A E B Gb Db Ab Eb Bb F
        // Indices:         0 1 2 3 4 5  6  7  8  9 10 11
        const sharpOrder = ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'];
        const flatOrder = ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'];
        
        if (idx === 0) return { count: 0, type: '', notes: [] };
        if (idx <= 5) return { count: idx, type: '#', notes: sharpOrder.slice(0, idx) };
        if (idx === 6) return { count: 6, type: 'b', notes: flatOrder.slice(0, 6) }; // Gb
        return { count: 12 - idx, type: 'b', notes: flatOrder.slice(0, 12 - idx) };
    }

    updateHarmonicNeighborhood(idx) {
        const neighbors = [(idx + 11) % 12, idx, (idx + 1) % 12];
        
        this.container.querySelectorAll('.cof-segment').forEach(el => {
            const elIdx = parseInt(el.getAttribute('data-idx'));
            const isNeighbor = neighbors.includes(elIdx);
            
            el.classList.remove('active', 'inactive-shroud');
            if (isNeighbor) {
                el.classList.add('active');
                el.style.stroke = 'var(--primary)';
                el.style.strokeWidth = elIdx === idx ? '3' : '1.5';
            } else {
                el.classList.add('inactive-shroud');
                el.style.stroke = 'rgba(255,255,255,0.1)';
                el.style.strokeWidth = '1';
            }
        });

        // Add a visual "Neighborhood" container/effect
        const group = document.getElementById('cof-neighborhood');
        if (group) {
            const size = 600; const center = size / 2;
            const outerRadius = 215;
            const innerRadius = 65;
            
            const startAngle = (idx * 30 - 45 - 90) * Math.PI / 180;
            const endAngle = (idx * 30 + 45 - 90) * Math.PI / 180;
            
            const path = this.createSegmentPath(center, center, innerRadius, outerRadius, startAngle, endAngle);
            group.innerHTML = `<path d="${path}" fill="var(--primary)" fill-opacity="0.05" stroke="var(--primary)" stroke-width="2" stroke-dasharray="5,5" style="pointer-events:none;" />
                               <text x="${center}" y="${center + innerRadius + 140}" fill="var(--primary)" font-size="10" font-weight="800" text-anchor="middle" style="letter-spacing:1px; opacity:0.6;">HARMONIC NEIGHBORHOOD</text>`;
        }
    }

    updatePositionFilters(rootIdx, rootName) {
        const pos6 = this.fretboard.findPositionOnString(rootName, 5);
        const pos5 = this.fretboard.findPositionOnString(rootName, 4);
        let anchorFret = pos6 ? pos6.fret : (pos5 ? pos5.fret : 0);
        if (anchorFret > 12) anchorFret -= 12;

        const patterns = [
            { name: "C", min: anchorFret - 3, max: anchorFret + 1 },
            { name: "A", min: anchorFret - 1, max: anchorFret + 3 },
            { name: "G", min: anchorFret + 2, max: anchorFret + 6 },
            { name: "E", min: anchorFret + 5, max: anchorFret + 9 },
            { name: "D", min: anchorFret + 8, max: anchorFret + 12 }
        ];

        let html = `<button class="secondary-btn small-btn sample-btn active-box" style="background:var(--primary); color:#000; font-weight:900;" onclick="window.AhordianApp.circleManager.filterByRange(null, null)">HIGHLIGHT ALL</button>`;
        patterns.forEach(p => {
            const min = Math.max(0, p.min);
            const max = p.max;
            html += `<button class="secondary-btn small-btn sample-btn" onclick="window.AhordianApp.circleManager.filterByRange(${min}, ${max})"><strong>${p.name}</strong><br><span style="font-size:0.6rem; opacity:0.8">Fr ${min}-${max}</span></button>`;
        });

        [1, 2, 3, 4, 5].forEach(p => {
            const start = anchorFret + (p-1)*2;
            html += `<button class="secondary-btn small-btn sample-btn" style="opacity:0.9" onclick="window.AhordianApp.circleManager.filterByRange(${start}, ${start+4})"><strong>P${p}</strong><br><span style="font-size:0.6rem; opacity:0.8">Fr ${start}-${start+4}</span></button>`;
        });
        this.elements.positionFilters.innerHTML = html;
        
        // Also populate the duplicate filters on the Main Fretboard screen if it exists
        const mainFbFilters = document.getElementById('fb-position-filters');
        if (mainFbFilters) mainFbFilters.innerHTML = html;
    }

    filterByRange(min, max) {
        if (min === null) this.fretboard.showScale(this.currentScaleNotes);
        else this.fretboard.showScale(this.currentScaleNotes, { min, max });
    }

    showNote(noteName) {
        this.fretboard.showScale([noteName]);
    }

    playDiatonicChord(rootName, triadNotesArray) {
        if (this.appRef) this.appRef.playSequence([triadNotesArray.join('-')], 100);
        if (this.elements.voicingsToggle && this.elements.voicingsToggle.checked) {
            const isMinor = triadNotesArray.length >= 2 && AppConfig.NOTE_NAMES.indexOf(triadNotesArray[1]) === (AppConfig.NOTE_NAMES.indexOf(triadNotesArray[0]) + 3) % 12;
            const target = AppConfig.CHORD_VOICINGS.find(v => v.name === rootName && v.type === (isMinor ? 'min' : 'maj'));
            if (target) { this.fretboard.showVoicing(target.pos); return; }
        }
        this.fretboard.showScale(triadNotesArray);
    }

    extractPentatonic() {
        if (!this.currentScaleNotes || this.currentScaleNotes.length < 7) return;
        
        let penta = [];
        if (this.activeMode === 'major') {
            // Major Pentatonic: 1, 2, 3, 5, 6 (Remove 4, 7)
            penta = [this.currentScaleNotes[0], this.currentScaleNotes[1], this.currentScaleNotes[2], this.currentScaleNotes[4], this.currentScaleNotes[5]];
        } else {
            // Minor Pentatonic: 1, b3, 4, 5, b7 (Remove 2, 6)
            penta = [this.currentScaleNotes[0], this.currentScaleNotes[2], this.currentScaleNotes[3], this.currentScaleNotes[4], this.currentScaleNotes[6]];
        }
        
        this.fretboard.showScale(penta);
        if (this.appRef && this.appRef.tracker) {
            this.appRef.tracker.addToTicker(`Extracted ${this.activeMode === 'major' ? 'Major' : 'Minor'} Pentatonic: ${penta.join(' ')}`, true);
        }
    }
}
