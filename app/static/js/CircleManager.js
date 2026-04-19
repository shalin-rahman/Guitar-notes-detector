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
            playBtn: document.getElementById('cof-play-scale'),
            intervalsToggle: document.getElementById('cof-intervals-toggle'),
            voicingsToggle: document.getElementById('cof-show-voicings'),
            quizToggle: document.getElementById('cof-quiz-mode'),
            scaleSelect: document.getElementById('cof-scale-select'),
            
            // Quiz UI
            quizModule: document.getElementById('quiz-module'),
            quizPrompt: document.getElementById('quiz-prompt'),
            quizStatus: document.getElementById('quiz-status'),
            quizStartBtn: document.getElementById('quiz-start-btn')
        };

        this.quizActive = false;
        this.targetNote = null;
        this.targetChord = null; // Triad array
        this.quizType = 'note'; // 'note' or 'chord'

        this.initScaleSelector();
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

            svg += `<text x="${majX}" y="${majY - 6}" class="cof-text cof-maj-text" data-idx="${i}" data-mode="major">${this.keys[i].maj}</text>`;
            svg += `<text x="${majX}" y="${majY + 12}" class="cof-text cof-roman cof-maj-roman" data-idx="${i}" data-mode="major" fill="rgba(255,215,0,0.8)" font-size="12" font-weight="700"></text>`;

            svg += `<text x="${minX}" y="${minY - 4}" class="cof-text cof-min-text" data-idx="${i}" data-mode="minor">${this.keys[i].min}</text>`;
            svg += `<text x="${minX}" y="${minY + 10}" class="cof-text cof-roman cof-min-roman" data-idx="${i}" data-mode="minor" fill="rgba(200,200,200,0.8)" font-size="10" font-weight="700"></text>`;
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

    initScaleSelector() {
        if (!this.elements.scaleSelect) return;
        const options = AppConfig.SCALE_DEFINITIONS.map(s => `<option value="${s.name}">${s.name}</option>`);
        this.elements.scaleSelect.innerHTML = options.join('');
        // Default to Major
        this.elements.scaleSelect.value = "Major (Ionian)";
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
                const rootName = this.activeMode === 'major' ? k.maj : k.min;
                const scaleName = this.elements.scaleSelect.value;
                this.appRef.triggerScale(scaleName, rootName.replace('m', ''));
            }
        });

        // Scale Select Change
        if (this.elements.scaleSelect) {
            this.elements.scaleSelect.addEventListener('change', () => {
                if (this.activeKeyIndex !== -1) {
                    this.selectKey(this.activeKeyIndex);
                }
            });
        }

        // Interval Toggle Logic
        if (this.elements.intervalsToggle) {
            this.elements.intervalsToggle.addEventListener('change', (e) => {
                this.fretboard.setDisplayMode(e.target.checked ? 'intervals' : 'notes');
            });
        }

        // Quiz Mode
        if (this.elements.quizToggle) {
            this.elements.quizToggle.addEventListener('change', (e) => {
                this.elements.quizModule.style.display = e.target.checked ? 'block' : 'none';
                if (!e.target.checked) this.stopQuiz();
            });
        }

        if (this.elements.quizStartBtn) {
            this.elements.quizStartBtn.addEventListener('click', () => {
                if (this.quizActive) this.stopQuiz();
                else this.startQuiz();
            });
        }
    }

    startQuiz() {
        if (this.currentKeyIndex === null) {
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
        
        // Pick a random note from the current scale
        const randIdx = Math.floor(Math.random() * this.currentScaleNotes.length);
        this.targetNote = this.currentScaleNotes[randIdx];
        
        this.elements.quizPrompt.textContent = `Find: ${this.targetNote}`;
        this.elements.quizStatus.textContent = "Listen and play on your guitar...";
        
        // Play the target note so user hears it (Ear Training!)
        if (this.appRef && this.appRef.player) {
            this.appRef.player.playNote(this.targetNote + "4");
        }
    }

    handleDetectedNote(noteName) {
        if (!this.quizActive || !this.targetNote) return;
        
        const detectedBase = noteName.replace(/[0-9]/g, '');
        if (detectedBase === this.targetNote) {
            // Success!
            this.elements.quizPrompt.textContent = "CORRECT! ✨";
            this.elements.quizStatus.textContent = `Great! That was indeed ${this.targetNote}`;
            
            // Visual celebration on fretboard
            this.fretboard.showNote(noteName);
            
            this.targetNote = null;
            setTimeout(() => this.nextQuizRound(), 1500);
        }
    }

    selectKey(idx, mode = null) {
        if (mode) this.activeMode = mode;
        this.activeKeyIndex = idx;
        const k = this.keys[idx];
        const rootNote = this.activeMode === 'major' ? k.maj : k.min;
        
        // Find selected scale definition
        const scaleDef = AppConfig.SCALE_DEFINITIONS.find(s => s.name === this.elements.scaleSelect.value) || AppConfig.SCALE_DEFINITIONS[0];
        const intervals = scaleDef.intervals || scaleDef.arohan || [0];

        // Convert flat to sharp for exact array mapping
        const flatMap = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
        let searchNote = flatMap[rootNote] || rootNote;
        
        const rootIdx = AppConfig.NOTE_NAMES.indexOf(searchNote);
        const roman = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
        
        // Interactive Diatonic Chord Buttons
        const diatonicArray = intervals.map((interval, index) => {
            const chordRootName = AppConfig.NOTE_NAMES[(rootIdx + interval) % 12];
            const isMinor = roman[index].toLowerCase() === roman[index]; // simple check
            const isDim = roman[index].includes('°');
            
            // Build the triad for visual highlight
            const triadIntervals = isDim ? [0, 3, 6] : (isMinor ? [0, 3, 7] : [0, 4, 7]);
            const chordIdx = AppConfig.NOTE_NAMES.indexOf(chordRootName);
            const triadNotes = triadIntervals.map(i => AppConfig.NOTE_NAMES[(chordIdx + i) % 12]);
            const btnData = JSON.stringify(triadNotes).replace(/"/g, '&quot;');
            
            return `<button class="cof-chord-btn" onclick="window.AhordianApp.circleManager.playDiatonicChord('${chordRootName}', ${btnData})"><strong>${roman[index]}</strong><br>${chordRootName}${isMinor && !isDim ? 'm' : ''}${isDim ? 'dim' : ''}</button>`;
        });

        // Calculate CAGED anchor frets (Standard Tuning assumption)
        const eFret = (rootIdx - AppConfig.NOTE_NAMES.indexOf('E') + 12) % 12;
        const aFret = (rootIdx - AppConfig.NOTE_NAMES.indexOf('A') + 12) % 12;
        const dFret = (rootIdx - AppConfig.NOTE_NAMES.indexOf('D') + 12) % 12;
        
        const cFret = (aFret - 3 + 12) % 12 || 12;
        const aFrame = aFret || 12;
        const gFret = (eFret - 3 + 12) % 12 || 12;
        const eFrame = eFret || 12;
        const dFrame = dFret || 12;

        // Create interactive CAGED filter buttons
        const createCagedBtn = (shape, fretPos) => {
            const minFreq = Math.max(0, fretPos - 1);
            const maxFreq = minFreq + 4; // 4-fret span
            return `<button class="caged-btn" onclick="window.AhordianApp.circleManager.filterCAGED(${minFreq}, ${maxFreq}, this)"><strong>${shape}</strong>-Shape (Fr ${fretPos})</button>`;
        };

        const cagedHtml = `
            ${createCagedBtn('C', cFret)}
            ${createCagedBtn('A', aFrame)}
            ${createCagedBtn('G', gFret)}
            ${createCagedBtn('E', eFrame)}
            ${createCagedBtn('D', dFrame)}
        `;

        // Update UI info panel
        this.elements.title.textContent = `${rootNote} ${scaleDef.name}`;
        this.elements.sig.innerHTML = `<strong>Signature:</strong> ${k.sig}`;
        this.elements.relMin.innerHTML = `<strong>Relative Minor:</strong> ${k.min}`;
        
        // Inject grid HTML
        if (scaleDef.name.includes("Major") || scaleDef.name.includes("Minor") || scaleDef.name.includes("Lydian") || scaleDef.name.includes("Dorian")) {
             this.elements.diatonic.innerHTML = `
                <strong>Diatonic Triads:</strong>
                <div class="cof-chord-grid">${diatonicArray.join('')}</div>
                <strong>Visual CAGED Filters:</strong>
                <div class="caged-grid">${cagedHtml}</div>
            `;
        } else {
            // Highlighting non-diatonic scales (Raags/Pentatonics)
            this.elements.diatonic.innerHTML = `
                <strong>Visual CAGED Filters:</strong>
                <div class="caged-grid">${cagedHtml}</div>
            `;
        }
        
        this.elements.playBtn.disabled = false;
        
        // Save current scale for later filtering
        this.currentScaleNotes = intervals.map(inter => AppConfig.NOTE_NAMES[(rootIdx + inter) % 12]);
        
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
            this.container.querySelectorAll(`.cof-maj-text[data-idx="${neighborIdx}"], .cof-min-text[data-idx="${neighborIdx}"]`).forEach(el => {
                el.style.fill = 'rgba(255, 215, 0, 0.7)';
            });
        });

        // ----------------------------------------
        // Dynamically Inject Roman Numerals into SVG
        // ----------------------------------------
        this.container.querySelectorAll('.cof-roman').forEach(el => el.textContent = '');
        
        const setRoman = (i, mode, text) => {
            const el = this.container.querySelector(`.cof-${mode}-roman[data-idx="${i}"]`);
            if (el) el.textContent = text;
        };

        // Major Mode Chords
        setRoman(idx, 'maj', 'I');
        setRoman(leftIdx, 'maj', 'IV');
        setRoman(rightIdx, 'maj', 'V');
        
        // Minor Mode Chords
        setRoman(idx, 'min', 'vi');
        setRoman(leftIdx, 'min', 'ii');
        setRoman(rightIdx, 'min', 'iii');
        
        // Diminished Chord (Right + 1 on Inner Ring)
        const dimIdx = (idx + 2) % 12;
        setRoman(dimIdx, 'min', 'vii°');

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
        this.fretboard.showScale(this.currentScaleNotes);
    }

    playDiatonicChord(rootName, triadNotesArray) {
        // Trigger audio strum globally
        if (this.appRef) {
            this.appRef.playSequence([triadNotesArray.join('-')], 100);
        }

        // Check if we should show a specific guitar voicing
        if (this.elements.voicingsToggle && this.elements.voicingsToggle.checked) {
            const isMinor = triadNotesArray.length >= 2 && AppConfig.NOTE_NAMES.indexOf(triadNotesArray[1]) === (AppConfig.NOTE_NAMES.indexOf(triadNotesArray[0]) + 3) % 12;
            const voicing = AppConfig.CHORD_VOICINGS.find(v => v.name === rootName && v.type === (isMinor ? 'min' : 'maj'));
            if (voicing) {
                this.fretboard.showVoicing(voicing.pos);
                return;
            }
        }

        // Visually map ONLY the triad to the miniature fretboard (abstract circles)
        this.fretboard.showScale(triadNotesArray);
        
        // Remove active state from caged buttons
        this.elements.diatonic.querySelectorAll('.caged-btn').forEach(b => b.classList.remove('active'));
    }

    filterCAGED(minFret, maxFret, btnEl) {
        // Toggle button UI
        this.elements.diatonic.querySelectorAll('.caged-btn').forEach(b => b.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');

        // Render the full scale but bounded by CAGED mechanics
        this.fretboard.showScale(this.currentScaleNotes, { min: minFret, max: maxFret });
    }
}
