import AppConfig from './AppConfig.js';

export default class FretboardManager {
    constructor(containerId, initialTuning = null) {
        this.container = document.getElementById(containerId);
        this.numFrets = 16;
        this.strings = initialTuning || ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];
        this.persistentNotes = [];
        this.displayMode = 'notes'; // 'notes' or 'intervals'
        this.showNoteNames = true;
        this.render();
    }

    setDisplayMode(mode) {
        this.displayMode = mode;
        this.render();
    }

    setTuning(tuningNotes) {
        this.strings = tuningNotes;
        this.render();
    }

    // Convert flat notation to sharp for internal consistency
    static flatToSharp(noteName) {
        const flatMap = { 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B' };
        for (const [flat, sharp] of Object.entries(flatMap)) {
            if (noteName.startsWith(flat)) return noteName.replace(flat, sharp);
        }
        return noteName;
    }

    render() {
        const width = 1100;
        const height = 220;
        const topMargin = 22;
        const bottomMargin = 16;
        const leftMargin = 36;
        const rightMargin = 20;
        const fretableWidth = width - leftMargin - rightMargin;
        const fretWidth = fretableWidth / this.numFrets;
        const stringAreaHeight = height - topMargin - bottomMargin;
        const stringGap = stringAreaHeight / (this.strings.length - 1);

        let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">`;

        // SVG filter for glow
        svg += `<defs>
            <filter id="glow-active"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="glow-persist"><feGaussianBlur stdDeviation="1.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>`;

        // Background (rosewood)
        svg += `<rect x="${leftMargin}" y="${topMargin}" width="${fretableWidth}" height="${stringAreaHeight}" fill="#2c1e14" rx="3" />`;

        // Fret numbers along the top and bottom for clarity
        for (let i = 1; i <= this.numFrets; i++) {
            const x = leftMargin + (i - 0.5) * fretWidth;
            svg += `<text x="${x}" y="${topMargin - 6}" fill="#999" font-size="10" font-weight="bold" text-anchor="middle" font-family="Outfit, sans-serif">${i}</text>`;
            svg += `<text x="${x}" y="${height - bottomMargin + 12}" fill="#999" font-size="10" font-weight="bold" text-anchor="middle" font-family="Outfit, sans-serif">${i}</text>`;
        }

        // Frets and inlay dots
        for (let i = 0; i <= this.numFrets; i++) {
            const x = leftMargin + i * fretWidth;
            const className = i === 0 ? 'fb-nut' : 'fb-fret';
            svg += `<line x1="${x}" y1="${topMargin}" x2="${x}" y2="${topMargin + stringAreaHeight}" class="${className}" />`;

            if ([3, 5, 7, 9, 12, 15].includes(i)) {
                const dotX = leftMargin + (i - 0.5) * fretWidth;
                if (i === 12) {
                    svg += `<circle cx="${dotX}" cy="${topMargin + stringGap * 1.5}" r="3.5" class="fb-inlay" />`;
                    svg += `<circle cx="${dotX}" cy="${topMargin + stringGap * 3.5}" r="3.5" class="fb-inlay" />`;
                } else {
                    svg += `<circle cx="${dotX}" cy="${topMargin + stringAreaHeight / 2}" r="3.5" class="fb-inlay" />`;
                }
            }
        }

        // Strings with open string labels
        for (let i = 0; i < this.strings.length; i++) {
            const y = topMargin + i * stringGap;
            const thickness = 1 + (i * 0.5);
            svg += `<line x1="${leftMargin}" y1="${y}" x2="${width - rightMargin}" y2="${y}" class="fb-string" data-str="${i}" style="stroke-width: ${thickness}px" />`;

            // Open string note label
            const openNote = this.getNoteAt(i, 0);
            if (openNote) {
                const label = openNote.replace(/[0-9]/g, '');
                svg += `<text x="${leftMargin - 8}" y="${y + 1}" fill="#ffd700" font-size="9" font-weight="bold" text-anchor="end" dominant-baseline="central" font-family="Outfit, sans-serif">${label}</text>`;
            }
        }

        // Note name labels on each fret position
        if (this.showNoteNames) {
            for (let s = 0; s < this.strings.length; s++) {
                for (let f = 1; f <= this.numFrets; f++) {
                    const note = this.getNoteAt(s, f);
                    if (!note) continue;
                    const label = note.replace(/[0-9]/g, '');
                    const isSharp = label.includes('#');
                    const x = leftMargin + (f - 0.5) * fretWidth;
                    const y = topMargin + s * stringGap;
                    svg += `<text x="${x}" y="${y + 1}" fill="${isSharp ? 'rgba(150,150,150,0.5)' : 'rgba(255,215,0,0.4)'}" font-size="${isSharp ? '8' : '9'}" font-weight="${isSharp ? '400' : '600'}" text-anchor="middle" dominant-baseline="central" font-family="Outfit, sans-serif">${label}</text>`;
                }
            }
        }

        svg += `<g id="note-indicators"></g>`;
        svg += `</svg>`;
        this.container.innerHTML = svg;

        // Re-draw persistent overlays
        if (this.persistentNotes.length > 0) {
            this.persistentNotes.forEach(p => this.drawNoteIndicator(p.note, p.pos, true));
        }
    }

    getNoteAt(stringIdx, fret) {
        const rawTuning = this.strings[stringIdx];
        const normalized = FretboardManager.flatToSharp(rawTuning);
        const noteName = normalized.replace(/[0-9]/g, '');
        const octave = parseInt(normalized.replace(/[^0-9]/g, ''));

        const baseIdx = AppConfig.NOTE_NAMES.indexOf(noteName);
        if (baseIdx === -1) return null;

        const totalHalfSteps = baseIdx + fret;
        const noteIdx = totalHalfSteps % 12;
        const octaveShift = Math.floor(totalHalfSteps / 12);
        return AppConfig.NOTE_NAMES[noteIdx] + (octave + octaveShift);
    }

    findBestPosition(noteName) {
        const positions = [];
        for (let s = 0; s < this.strings.length; s++) {
            for (let f = 0; f <= this.numFrets; f++) {
                const currentNote = this.getNoteAt(s, f);
                if (!currentNote) continue;
                if (currentNote === noteName || currentNote.replace(/[0-9]/g, '') === noteName) {
                    positions.push({ string: s, fret: f, note: currentNote });
                }
            }
        }
        return positions.sort((a, b) => a.fret - b.fret)[0];
    }

    showScale(noteNames, bounds = null) {
        this.persistentNotes = [];
        if (!noteNames || noteNames.length === 0) return;
        
        const rootNoteLabel = noteNames[0]; // Assume first note in array is the Root

        for (let s = 0; s < this.strings.length; s++) {
            for (let f = 0; f <= this.numFrets; f++) {
                if (bounds && (f < bounds.min || f > bounds.max)) {
                    // Open strings are sometimes played in CAGED, but strict bounding is visually clearer
                    if (f !== 0) continue; 
                    if (f === 0 && bounds.min > 3) continue; // Only keep open strings if bounds are close
                }
                const currentNote = this.getNoteAt(s, f);
                if (!currentNote) continue;
                
                const label = currentNote.replace(/[0-9]/g, '');
                const noteIndex = noteNames.indexOf(label);
                if (noteIndex !== -1) {
                    // For triad mappings, the first note in array is interval 1.
                    // But wait, if playing a subset, noteNames might just be the triad.
                    // We'll map to array index+1 blindly for simple relative scale degrees, 
                    // or explicitly rely on the root note.
                    this.persistentNotes.push({ 
                        note: currentNote, 
                        pos: { string: s, fret: f, isRoot: noteIndex === 0, interval: noteIndex + 1 } 
                    });
                }
            }
        }
        this.render();
    }

    clearOverlay() {
        this.persistentNotes = [];
        this.render();
    }

    pluckString(stringIdx) {
        const stringEl = this.container.querySelector(`[data-str="${stringIdx}"]`);
        if (!stringEl) return;
        stringEl.style.stroke = '#ffd700';
        stringEl.style.filter = 'drop-shadow(0 0 4px #ffd700)';
        setTimeout(() => {
            stringEl.style.stroke = '';
            stringEl.style.filter = '';
        }, 600);
    }

    drawNoteIndicator(noteName, pos, isPersistent = false) {
        const group = this.container.querySelector('#note-indicators');
        if (!group) return;

        const leftMargin = 36;
        const rightMargin = 20;
        const topMargin = 22;
        const bottomMargin = 16;
        const width = 1100;
        const height = 220;
        const fretableWidth = width - leftMargin - rightMargin;
        const fretWidth = fretableWidth / this.numFrets;
        const stringAreaHeight = height - topMargin - bottomMargin;
        const stringGap = stringAreaHeight / (this.strings.length - 1);

        const x = pos.fret === 0 ? leftMargin - 2 : leftMargin + (pos.fret - 0.5) * fretWidth;
        const y = topMargin + pos.string * stringGap;
        const label = noteName.replace(/[0-9]/g, '');

        if (!isPersistent) this.pluckString(pos.string);

        const isKeyRoot = pos.isRoot || false;
        const noteColor = AppConfig.CHROMATIC_COLORS[label] || '#ffd700';

        const indicator = document.createElementNS("http://www.w3.org/2000/svg", "g");
        // Root notes get a specialized heavy vibrant glow
        indicator.setAttribute("filter", isPersistent ? (isKeyRoot ? "url(#glow-active)" : "url(#glow-persist)") : "url(#glow-active)");

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        
        // Sizing logic: Make all markers completely visible and readable
        const radius = isPersistent ? (isKeyRoot ? 12 : 11) : 12.5;
        circle.setAttribute("r", radius);
        
        // Premium aesthetic shading: Full maximum opacity for everything, no more ghosting! 
        circle.setAttribute("fill", noteColor);
        circle.setAttribute("fill-opacity", "1");
        
        // Sleek contrast borders: Root gets heavy bright rim, others get a clean thin dark rim
        circle.setAttribute("stroke", isKeyRoot ? "#ffffff" : "rgba(0,0,0,0.4)");
        circle.setAttribute("stroke-width", isKeyRoot ? "2.5" : "1");
        
        // Drop shadow for everything to pop off the wood
        circle.style.filter = `drop-shadow(0px 3px 5px rgba(0,0,0,0.6))`;

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", x);
        text.setAttribute("y", y);
        
        // Text contrasting logic: All text large and bold
        text.setAttribute("fill", "#ffffff");
        text.style.textShadow = "0px 1px 2px rgba(0,0,0,0.8)"; // Text shadow for guaranteed legibility!
        text.setAttribute("font-size", "11");
        text.setAttribute("font-weight", "800");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "central");
        text.setAttribute("font-family", "Outfit, sans-serif");
        
        // Display functional intervals instead of note text if toggled AND this is a persistently calculated scale degree
        let displayValue = label;
        if (this.displayMode === 'intervals' && isPersistent && pos.interval !== undefined) {
            displayValue = pos.interval.toString();
        }
        text.textContent = displayValue;

        indicator.appendChild(circle);
        indicator.appendChild(text);
        
        // Add interactive plucking functionality!
        indicator.style.cursor = 'pointer';
        indicator.addEventListener('click', () => {
            // Check if global app instance exists to trigger synthesizer
            if (window.AhordianApp && window.AhordianApp.player) {
                window.AhordianApp.player.playNote(noteName);
                
                // Visual feedback ping on the local fretboard
                this.pluckString(pos.string);
                circle.setAttribute("stroke", "#ffffff");
                circle.setAttribute("stroke-width", "3");
                setTimeout(() => {
                    circle.setAttribute("stroke", isPersistent ? strkColor : "#ffffff");
                    circle.setAttribute("stroke-width", isKeyRoot ? "2" : "1.5");
                }, 200);
            }
        });
        
        group.appendChild(indicator);

        if (!isPersistent) {
            setTimeout(() => {
                circle.setAttribute("fill", "rgba(255,215,0,0.2)");
                circle.setAttribute("r", "6");
                setTimeout(() => indicator.remove(), 250);
            }, 800);
        }
    }

    showNote(noteName, position = null) {
        const pos = position || this.findBestPosition(noteName);
        if (!pos) return null;
        this.drawNoteIndicator(noteName, pos, false);
        return pos;
    }
}
