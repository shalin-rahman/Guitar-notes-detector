/**
 * TonnetzManager.js
 *
 * Renders an interactive Tonnetz harmonic lattice and bridges it to a
 * dedicated FretboardManager so that harmonic-space selection and physical
 * guitar positions stay in sync.
 *
 * Architecture notes:
 * - Pure SVG rendering (no canvas), identical approach to CircleManager.
 * - All state lives on the instance; no module-level globals.
 * - Audio uses window.AhordianApp.player.playNote(), same pattern as
 *   FretboardManager's note-indicator click handler.
 * - Animation lives entirely in CSS (tz-* classes in style.css) so it runs
 *   off the main thread. JS only adds/removes classes.
 */

import AppConfig from './AppConfig.js';
import FretboardManager from './FretboardManager.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ─── Tonnetz geometry constants ───────────────────────────────────────────────

// How many columns and rows of nodes to render.
// Columns (perfect-fifth axis) and rows (major-third axis).
const COLS = 9;
const ROWS = 5;

// Node geometry
const NODE_R   = 22;        // circle radius px (in viewBox units)
const COL_STEP = 68;        // horizontal spacing between nodes (P5 step)
const ROW_STEP = 44;        // vertical spacing between node rows (M3 step)
const ROW_OFFSET = 34;      // odd-row horizontal offset for triangular grid
const PAD_X    = 48;        // left/right viewBox padding
const PAD_Y    = 48;        // top/bottom viewBox padding

// Viewbox dimensions derived from geometry
const VB_W = PAD_X * 2 + (COLS - 1) * COL_STEP + ROW_OFFSET;
const VB_H = PAD_Y * 2 + (ROWS - 1) * ROW_STEP;

// Interval names for the 12 semitones (relative to a root)
const INTERVAL_NAMES = [
    'R', 'b2', '2', 'b3', '3', '4', '#4/b5', '5', 'b6', '6', 'b7', '7'
];

// Chord formulas: semitone intervals from root
const CHORD_FORMULAS = {
    'Major':     [0, 4, 7],
    'Minor':     [0, 3, 7],
    'Dom 7':     [0, 4, 7, 10],
    'Maj 7':     [0, 4, 7, 11],
    'Min 7':     [0, 3, 7, 10],
    'Sus 2':     [0, 2, 7],
    'Sus 4':     [0, 5, 7],
    'Dim':       [0, 3, 6],
    'Dim 7':     [0, 3, 6, 9],
    'Aug':       [0, 4, 8],
    'Half-dim':  [0, 3, 6, 10],
};

// Scale formulas
const SCALE_FORMULAS = {
    'Major (Ionian)':    [0, 2, 4, 5, 7, 9, 11],
    'Natural Minor':     [0, 2, 3, 5, 7, 8, 10],
    'Pentatonic Major':  [0, 2, 4, 7, 9],
    'Pentatonic Minor':  [0, 3, 5, 7, 10],
    'Blues':             [0, 3, 5, 6, 7, 10],
    'Dorian':            [0, 2, 3, 5, 7, 9, 10],
    'Mixolydian':        [0, 2, 4, 5, 7, 9, 10],
    'Lydian':            [0, 2, 4, 6, 7, 9, 11],
    'Phrygian':          [0, 1, 3, 5, 7, 8, 10],
    'Locrian':           [0, 1, 3, 5, 6, 8, 10],
    'Harmonic Minor':    [0, 2, 3, 5, 7, 8, 11],
    'Melodic Minor':     [0, 2, 3, 5, 7, 9, 11],
};

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Pitch class (0–11) from note name string, ignoring octave. */
function pitchClass(noteName) {
    const bare = noteName.replace(/[0-9]/g, '');
    return AppConfig.NOTE_NAMES.indexOf(bare);
}

/** Wrap semitone index into 0–11. */
function mod12(n) { return ((n % 12) + 12) % 12; }

// ─── Node coordinate mapping ──────────────────────────────────────────────────

/**
 * Returns { x, y, pc } for every visible node.
 * The lattice axes:
 *   right  → +7 semitones (perfect fifth)
 *   up     → +4 semitones (major third)   — SVG y grows downward so "up" = -y
 *
 * We anchor the center-cell to pitch class 0 (C) and let the tiling wrap mod 12.
 */
function buildNodes() {
    const nodes = [];
    // Start pitch class at top-left.
    // Top-left corner: C is placed at row=2, col=0 (roughly center-left).
    const anchorPC = 0; // C
    const anchorRow = Math.floor(ROWS / 2);
    const anchorCol = 0;

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            // Semitone offsets from anchor
            const fifthSteps = col - anchorCol;              // +7 per step
            const thirdSteps = anchorRow - row;              // +4 per step (row up = +4)
            const pc = mod12(anchorPC + fifthSteps * 7 + thirdSteps * 4);

            const x = PAD_X + col * COL_STEP + (row % 2) * ROW_OFFSET;
            const y = PAD_Y + row * ROW_STEP;

            nodes.push({ row, col, x, y, pc });
        }
    }
    return nodes;
}

/**
 * Build edge list (pairs of node indices) for each interval type.
 * P5 edges connect horizontally adjacent nodes (+7 st / col+1).
 * M3 edges connect to the node one row above, same col or col-1.
 * m3 edges are implied: they connect P5-up-left (they close the triangles).
 */
function buildEdges(nodes) {
    const p5Edges = [], m3Edges = [], M3Edges = [];

    const key = (r, c) => nodes.findIndex(n => n.row === r && n.col === c);

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const i = key(row, col);
            if (i === -1) continue;

            // P5: same row, col+1
            const j5 = key(row, col + 1);
            if (j5 !== -1) p5Edges.push([i, j5]);

            // M3: row-1, col (even rows shift right)
            if (row > 0) {
                const colAbove = row % 2 === 0 ? col - 1 : col;
                const jM3 = key(row - 1, colAbove);
                if (jM3 !== -1) M3Edges.push([i, jM3]);

                // m3: row-1, col+1 (other diagonal)
                const colAbove2 = row % 2 === 0 ? col : col + 1;
                const jm3 = key(row - 1, colAbove2);
                if (jm3 !== -1) m3Edges.push([i, jm3]);
            }
        }
    }
    return { p5Edges, m3Edges, M3Edges };
}

// ─── TonnetzManager ──────────────────────────────────────────────────────────

export default class TonnetzManager {
    /**
     * @param {string} svgContainerId  - id of the <div> that will hold the SVG
     * @param {string} fretboardId     - id of the <div> for the dedicated fretboard
     * @param {object|null} appRef     - reference to the main App instance
     */
    constructor(svgContainerId, fretboardId, appRef = null) {
        this.svgContainer = document.getElementById(svgContainerId);
        this.appRef = appRef;

        // Dedicated fretboard for this screen
        this.fretboard = new FretboardManager(fretboardId);

        // Apply current handedness / tuning from app settings if available
        if (appRef) {
            const settings = appRef.loadSettings ? appRef.loadSettings() : null;
            if (settings) {
                if (settings.handedness) this.fretboard.setHandedness(settings.handedness);
                if (settings.defaultTuning) {
                    const tuning = AppConfig.ALTERNATE_TUNINGS.find(t => t.name === settings.defaultTuning);
                    if (tuning) this.fretboard.setTuning(tuning.notes);
                }
            }
        }

        // State
        this.activeRoot = 0;          // pitch class 0 = C
        this.activeChordTones = new Set();  // set of pitch class indices
        this.activeScaleTones = new Set();  // set of pitch class indices
        this.hoveredPC = -1;
        this.selectedPC = -1;         // last explicitly clicked note node
        this.showIntervals = false;
        this.activeChordName = null;
        this.activeScaleName = null;

        // Pre-compute geometry
        this.nodes = buildNodes();
        const { p5Edges, m3Edges, M3Edges } = buildEdges(this.nodes);
        this.p5Edges = p5Edges;
        this.m3Edges = m3Edges;
        this.M3Edges = M3Edges;

        this._render();
        this._bindPanelEvents();
    }

    // ─── Rendering ─────────────────────────────────────────────────────────────

    _render() {
        if (!this.svgContainer) return;

        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`);
        svg.setAttribute('id', 'tonnetz-svg');
        svg.classList.add('tonnetz-svg');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'Tonnetz harmonic lattice');
        svg.style.cssText = 'width:100%;height:100%;overflow:visible;';

        // ── defs ──
        const defs = document.createElementNS(SVG_NS, 'defs');
        defs.innerHTML = `
            <filter id="tz-glow-active" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="tz-glow-soft" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
        `;
        svg.appendChild(defs);

        // ── edge group (drawn under nodes) ──
        const edgeGroup = document.createElementNS(SVG_NS, 'g');
        edgeGroup.setAttribute('id', 'tz-edges');
        edgeGroup.setAttribute('aria-hidden', 'true');

        const addEdges = (edgePairs, cssClass) => {
            edgePairs.forEach(([i, j]) => {
                const a = this.nodes[i], b = this.nodes[j];
                const line = document.createElementNS(SVG_NS, 'line');
                line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
                line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
                line.classList.add('tz-edge', cssClass);
                line.dataset.pcA = a.pc;
                line.dataset.pcB = b.pc;
                edgeGroup.appendChild(line);
            });
        };
        addEdges(this.p5Edges, 'tz-edge-p5');
        addEdges(this.M3Edges, 'tz-edge-M3');
        addEdges(this.m3Edges, 'tz-edge-m3');
        svg.appendChild(edgeGroup);

        // ── interval label arrows (static, on hover) ──
        // Small text along the first row to orient the user
        this._appendAxisLabels(svg);

        // ── node group ──
        const nodeGroup = document.createElementNS(SVG_NS, 'g');
        nodeGroup.setAttribute('id', 'tz-nodes');

        this.nodes.forEach((node, idx) => {
            const g = document.createElementNS(SVG_NS, 'g');
            g.classList.add('tz-node-group');
            g.setAttribute('tabindex', '0');
            g.setAttribute('role', 'button');
            g.setAttribute('aria-label', `${AppConfig.NOTE_NAMES[node.pc]}, pitch class ${node.pc}`);
            g.dataset.pc = node.pc;
            g.dataset.idx = idx;
            g.style.transformOrigin = `${node.x}px ${node.y}px`;

            const color = AppConfig.CHROMATIC_COLORS[AppConfig.NOTE_NAMES[node.pc]] || '#888';

            // Outer glow ring (visible for chord tones / active)
            const ring = document.createElementNS(SVG_NS, 'circle');
            ring.setAttribute('cx', node.x); ring.setAttribute('cy', node.y);
            ring.setAttribute('r', NODE_R + 5);
            ring.classList.add('tz-ring');
            ring.setAttribute('fill', 'none');
            ring.setAttribute('stroke', color);
            ring.setAttribute('stroke-width', '2');

            // Main circle
            const circle = document.createElementNS(SVG_NS, 'circle');
            circle.setAttribute('cx', node.x); circle.setAttribute('cy', node.y);
            circle.setAttribute('r', NODE_R);
            circle.classList.add('tz-circle');
            circle.setAttribute('fill', color);
            circle.setAttribute('stroke', 'rgba(255,255,255,0.25)');
            circle.setAttribute('stroke-width', '1.5');

            // Note label
            const label = document.createElementNS(SVG_NS, 'text');
            label.setAttribute('x', node.x); label.setAttribute('y', node.y - 3);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('dominant-baseline', 'middle');
            label.classList.add('tz-label-note');
            label.textContent = AppConfig.NOTE_NAMES[node.pc];

            // Interval sub-label (shown in interval mode)
            const sublabel = document.createElementNS(SVG_NS, 'text');
            sublabel.setAttribute('x', node.x); sublabel.setAttribute('y', node.y + 10);
            sublabel.setAttribute('text-anchor', 'middle');
            sublabel.setAttribute('dominant-baseline', 'middle');
            sublabel.classList.add('tz-label-interval');

            g.appendChild(ring);
            g.appendChild(circle);
            g.appendChild(label);
            g.appendChild(sublabel);

            // Events
            g.addEventListener('click', () => this._onNodeClick(node.pc));
            g.addEventListener('mouseenter', () => this._onNodeHover(node.pc, g));
            g.addEventListener('mouseleave', () => this._onNodeLeave());
            g.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._onNodeClick(node.pc); }
            });

            nodeGroup.appendChild(g);
        });

        svg.appendChild(nodeGroup);

        // ── tooltip (absolutely positioned div, not SVG) ──
        // We'll manage it via a separate HTML element appended to the container.

        this.svgContainer.innerHTML = '';
        this.svgContainer.appendChild(svg);

        // Tooltip div
        let tip = document.getElementById('tz-tooltip');
        if (!tip) {
            tip = document.createElement('div');
            tip.id = 'tz-tooltip';
            tip.className = 'tz-tooltip';
            tip.setAttribute('aria-hidden', 'true');
            document.body.appendChild(tip);
        }
        this._tooltip = tip;

        this._refreshNodeStates();
        this._refreshEdgeStates();
    }

    /** Small arrows along the bottom edge to teach the Tonnetz axes. */
    _appendAxisLabels(svg) {
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('aria-hidden', 'true');
        g.classList.add('tz-axis-labels');

        // P5 arrow → bottom
        const y = VB_H - 8;
        const x0 = PAD_X + 1 * COL_STEP;
        const x1 = PAD_X + 2 * COL_STEP;
        this._addAxisArrow(g, x0, y, x1, y, 'P5 →');

        // M3 arrow ↗ bottom-left area
        const bx = PAD_X;
        const by = VB_H - PAD_Y / 2 + 12;
        // just a text hint
        const m3txt = document.createElementNS(SVG_NS, 'text');
        m3txt.setAttribute('x', bx);
        m3txt.setAttribute('y', by - ROW_STEP * 0.55);
        m3txt.classList.add('tz-axis-text');
        m3txt.textContent = '↗ M3';
        g.appendChild(m3txt);

        svg.appendChild(g);
    }

    _addAxisArrow(g, x1, y1, x2, y2, label) {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2 - 6); line.setAttribute('y2', y2);
        line.classList.add('tz-axis-line');
        g.appendChild(line);

        const txt = document.createElementNS(SVG_NS, 'text');
        txt.setAttribute('x', (x1 + x2) / 2);
        txt.setAttribute('y', y1 - 6);
        txt.setAttribute('text-anchor', 'middle');
        txt.classList.add('tz-axis-text');
        txt.textContent = label;
        g.appendChild(txt);
    }

    // ─── State refresh ─────────────────────────────────────────────────────────

    _refreshNodeStates() {
        const groups = document.querySelectorAll('#tz-nodes .tz-node-group');
        const neighborPCs = this._getNeighborPCs(this.selectedPC >= 0 ? this.selectedPC : this.activeRoot);

        groups.forEach(g => {
            const pc = parseInt(g.dataset.pc, 10);
            const isRoot = pc === this.activeRoot;
            const isSelected = pc === this.selectedPC;
            const isChordTone = this.activeChordTones.has(pc);
            const isScaleTone = this.activeScaleTones.has(pc);
            const isNeighbor = neighborPCs.has(pc) && !isChordTone && !isScaleTone;

            g.classList.toggle('tz-root', isRoot);
            g.classList.toggle('tz-selected', isSelected);
            g.classList.toggle('tz-chord-tone', isChordTone);
            g.classList.toggle('tz-scale-tone', isScaleTone && !isChordTone);
            g.classList.toggle('tz-neighbor', isNeighbor);
            g.classList.toggle('tz-inactive', !isRoot && !isSelected && !isChordTone && !isScaleTone && !isNeighbor);

            // Interval sub-label
            const sublabel = g.querySelector('.tz-label-interval');
            if (sublabel) {
                if (this.showIntervals) {
                    const semitones = mod12(pc - this.activeRoot);
                    sublabel.textContent = INTERVAL_NAMES[semitones];
                    sublabel.setAttribute('display', 'block');
                } else {
                    sublabel.textContent = '';
                    sublabel.setAttribute('display', 'none');
                }
            }

            // Main label font adjustments for root vs others
            const noteLabel = g.querySelector('.tz-label-note');
            if (noteLabel) {
                if (this.showIntervals) {
                    noteLabel.setAttribute('y', parseInt(g.querySelector('circle.tz-circle').getAttribute('cy')) - 5);
                } else {
                    noteLabel.setAttribute('y', g.querySelector('circle.tz-circle').getAttribute('cy'));
                }
            }

            // glow filter
            const circle = g.querySelector('.tz-circle');
            if (circle) {
                if (isRoot || isSelected || isChordTone) {
                    circle.setAttribute('filter', 'url(#tz-glow-active)');
                } else if (isScaleTone || isNeighbor) {
                    circle.setAttribute('filter', 'url(#tz-glow-soft)');
                } else {
                    circle.removeAttribute('filter');
                }
            }
        });
    }

    _refreshEdgeStates() {
        document.querySelectorAll('#tz-edges .tz-edge').forEach(edge => {
            const pcA = parseInt(edge.dataset.pcA, 10);
            const pcB = parseInt(edge.dataset.pcB, 10);
            const activePCs = new Set([
                ...this.activeChordTones,
                ...this.activeScaleTones,
                ...(this.selectedPC >= 0 ? [this.selectedPC] : []),
                this.activeRoot
            ]);
            const lit = activePCs.has(pcA) && activePCs.has(pcB);
            edge.classList.toggle('tz-edge-active', lit);
        });
    }

    /** Pitch classes at harmonic distance 1 from a given pc (P5, P4, M3, m3). */
    _getNeighborPCs(pc) {
        if (pc < 0) return new Set();
        return new Set([
            mod12(pc + 7),   // P5
            mod12(pc - 7),   // P4
            mod12(pc + 4),   // M3
            mod12(pc - 4),   // m6 (minor third below)
            mod12(pc + 3),   // m3
            mod12(pc - 3),   // M6
        ]);
    }

    // ─── Events ────────────────────────────────────────────────────────────────

    _onNodeClick(pc) {
        const noteName = AppConfig.NOTE_NAMES[pc];
        this.selectedPC = pc;

        // Play the note (one octave above middle C range, same as guitar fretboard)
        if (window.AhordianApp?.player) {
            window.AhordianApp.player.playNote(noteName + '4');
        }

        // If a chord is active, show that chord on the fretboard
        if (this.activeChordTones.size > 0) {
            const chordNotes = [...this.activeChordTones].map(p => AppConfig.NOTE_NAMES[p]);
            this.fretboard.showScale(chordNotes);
        } else {
            // Just flash this note's positions
            this.fretboard.flashNotes([noteName + '3', noteName + '4', noteName + '5'], 900);
        }

        this._refreshNodeStates();
        this._refreshEdgeStates();
        this._updateInfoPanel(pc);
    }

    _onNodeHover(pc, groupEl) {
        this.hoveredPC = pc;
        const noteName = AppConfig.NOTE_NAMES[pc];
        const semitones = mod12(pc - this.activeRoot);
        const intervalName = INTERVAL_NAMES[semitones];
        const pos = this.fretboard.findBestPosition(noteName);
        const posText = pos ? `String ${pos.string + 1}, Fret ${pos.fret}` : 'Open string';

        const rect = groupEl.getBoundingClientRect();
        this._tooltip.innerHTML = `
            <span class="tz-tip-note">${noteName}</span>
            <span class="tz-tip-interval">${intervalName}</span>
            <span class="tz-tip-pos">${posText}</span>
        `;
        this._tooltip.classList.add('visible');
        this._tooltip.style.left = `${rect.left + rect.width / 2}px`;
        this._tooltip.style.top  = `${rect.top - 72}px`;

        // Subtle fretboard highlight on hover (no sound)
        const groups = document.querySelectorAll('#tz-nodes .tz-node-group');
        groups.forEach(g => {
            g.classList.toggle('tz-hovered', parseInt(g.dataset.pc, 10) === pc);
        });
    }

    _onNodeLeave() {
        this.hoveredPC = -1;
        this._tooltip.classList.remove('visible');
        document.querySelectorAll('.tz-node-group.tz-hovered').forEach(g => g.classList.remove('tz-hovered'));
    }

    // ─── Panel binding ─────────────────────────────────────────────────────────

    _bindPanelEvents() {
        // Root selector
        const rootSel = document.getElementById('tz-root-select');
        if (rootSel) {
            rootSel.addEventListener('change', e => {
                this.activeRoot = parseInt(e.target.value, 10);
                this.selectedPC = this.activeRoot;
                this._onRootChanged();
            });
        }

        // Chord selector
        const chordSel = document.getElementById('tz-chord-select');
        if (chordSel) {
            chordSel.addEventListener('change', e => {
                this.activeChordName = e.target.value;
                this._applyChord(e.target.value);
            });
        }

        // Scale selector
        const scaleSel = document.getElementById('tz-scale-select');
        if (scaleSel) {
            scaleSel.addEventListener('change', e => {
                this.activeScaleName = e.target.value;
                this._applyScale(e.target.value);
            });
        }

        // Interval label toggle
        const intervalToggle = document.getElementById('tz-interval-toggle');
        if (intervalToggle) {
            intervalToggle.addEventListener('change', e => {
                this.showIntervals = e.target.checked;
                this._refreshNodeStates();
            });
        }

        // Clear button
        const clearBtn = document.getElementById('tz-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearSelection());
        }

        // Play chord button
        const playBtn = document.getElementById('tz-play-btn');
        if (playBtn) {
            playBtn.addEventListener('click', () => this._playActiveChord());
        }

        // Chord-type quick buttons (rendered in HTML)
        document.querySelectorAll('.tz-chord-quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const chordName = btn.dataset.chord;
                this.activeChordName = chordName;
                document.querySelectorAll('.tz-chord-quick-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Also sync the select if present
                const sel = document.getElementById('tz-chord-select');
                if (sel) sel.value = chordName;
                this._applyChord(chordName);
            });
        });
    }

    _onRootChanged() {
        // Re-apply active chord/scale with new root
        if (this.activeChordName && this.activeChordName !== '--') this._applyChord(this.activeChordName);
        else if (this.activeScaleName && this.activeScaleName !== '--') this._applyScale(this.activeScaleName);
        else {
            this.activeChordTones = new Set();
            this.activeScaleTones = new Set();
        }
        this._refreshNodeStates();
        this._refreshEdgeStates();
        this._updateInfoPanel(this.activeRoot);
    }

    _applyChord(chordName) {
        const formula = CHORD_FORMULAS[chordName];
        if (!formula) {
            this.activeChordTones = new Set();
        } else {
            this.activeChordTones = new Set(formula.map(st => mod12(this.activeRoot + st)));
        }
        // Clear scale when a chord is active
        this.activeScaleTones = new Set();

        this._refreshNodeStates();
        this._refreshEdgeStates();

        // Show on fretboard
        if (this.activeChordTones.size > 0) {
            const noteNames = [...this.activeChordTones].map(pc => AppConfig.NOTE_NAMES[pc]);
            this.fretboard.showScale(noteNames);
        }

        this._updateInfoPanel(this.activeRoot);
        this._updatePlayBtn();
    }

    _applyScale(scaleName) {
        const formula = SCALE_FORMULAS[scaleName];
        if (!formula) {
            this.activeScaleTones = new Set();
        } else {
            this.activeScaleTones = new Set(formula.map(st => mod12(this.activeRoot + st)));
        }
        // Chord tones get absorbed by scale display
        this.activeChordTones = new Set();

        this._refreshNodeStates();
        this._refreshEdgeStates();

        // Show on fretboard
        if (this.activeScaleTones.size > 0) {
            const noteNames = [...this.activeScaleTones].map(pc => AppConfig.NOTE_NAMES[pc]);
            this.fretboard.showScale(noteNames);
        }

        this._updateInfoPanel(this.activeRoot);
        this._updatePlayBtn();
    }

    _playActiveChord() {
        if (!this.appRef || !this.appRef.player) return;
        const activePCs = this.activeChordTones.size > 0 ? this.activeChordTones : this.activeScaleTones;
        if (activePCs.size === 0) return;
        const notes = [...activePCs].map(pc => AppConfig.NOTE_NAMES[pc] + '4');
        // Staggered arpeggio
        notes.forEach((n, i) => {
            setTimeout(() => this.appRef.player.playNote(n), i * 100);
        });
    }

    _updatePlayBtn() {
        const btn = document.getElementById('tz-play-btn');
        if (!btn) return;
        const hasActive = this.activeChordTones.size > 0 || this.activeScaleTones.size > 0;
        btn.disabled = !hasActive;
    }

    // ─── Info Panel ────────────────────────────────────────────────────────────

    _updateInfoPanel(pc) {
        const noteName = AppConfig.NOTE_NAMES[pc];
        const semitones = mod12(pc - this.activeRoot);
        const intervalName = INTERVAL_NAMES[semitones];

        // Note name
        const noteEl = document.getElementById('tz-info-note');
        if (noteEl) noteEl.textContent = noteName;

        // Interval
        const intEl = document.getElementById('tz-info-interval');
        if (intEl) intEl.textContent = pc === this.activeRoot ? 'Root' : intervalName;

        // Nearest fret position
        const posEl = document.getElementById('tz-info-position');
        if (posEl) {
            const pos = this.fretboard.findBestPosition(noteName);
            posEl.textContent = pos
                ? `String ${pos.string + 1}, Fret ${pos.fret}`
                : 'Open string / not found';
        }

        // Neighboring chords text
        const relEl = document.getElementById('tz-info-relations');
        if (relEl) {
            const p5 = AppConfig.NOTE_NAMES[mod12(pc + 7)];
            const p4 = AppConfig.NOTE_NAMES[mod12(pc - 7)];
            const rel = AppConfig.NOTE_NAMES[mod12(pc - 3)];  // relative minor root
            relEl.innerHTML = `
                <span class="tz-rel-tag">P5 → ${p5}</span>
                <span class="tz-rel-tag">P4 → ${p4}</span>
                <span class="tz-rel-tag">Rel. min → ${rel}</span>
            `;
        }

        // Active chord/scale label
        const chordLabel = document.getElementById('tz-info-chord-label');
        if (chordLabel) {
            const root = AppConfig.NOTE_NAMES[this.activeRoot];
            if (this.activeChordTones.size > 0 && this.activeChordName) {
                chordLabel.textContent = `${root} ${this.activeChordName}`;
            } else if (this.activeScaleTones.size > 0 && this.activeScaleName) {
                chordLabel.textContent = `${root} ${this.activeScaleName}`;
            } else {
                chordLabel.textContent = root;
            }
        }
    }

    // ─── Public API ────────────────────────────────────────────────────────────

    /** Called by App.onNoteDetected() when a note is live-detected. */
    onExternalNote(noteName) {
        // Only respond if this screen is visible
        if (!this.svgContainer || !this.svgContainer.getClientRects().length) return;
        const pc = pitchClass(noteName);
        if (pc < 0) return;

        // Briefly pulse all matching nodes
        document.querySelectorAll(`#tz-nodes .tz-node-group[data-pc="${pc}"]`).forEach(g => {
            g.classList.add('tz-external-hit');
            setTimeout(() => g.classList.remove('tz-external-hit'), 600);
        });
    }

    /** Clear all chord/scale highlights. */
    clearSelection() {
        this.activeChordTones = new Set();
        this.activeScaleTones = new Set();
        this.activeChordName = null;
        this.activeScaleName = null;
        this.selectedPC = -1;

        const chordSel = document.getElementById('tz-chord-select');
        if (chordSel) chordSel.value = '--';
        const scaleSel = document.getElementById('tz-scale-select');
        if (scaleSel) scaleSel.value = '--';

        document.querySelectorAll('.tz-chord-quick-btn').forEach(b => b.classList.remove('active'));

        this.fretboard.clearOverlay();
        this._refreshNodeStates();
        this._refreshEdgeStates();
        this._updatePlayBtn();
        this._updateInfoPanel(this.activeRoot);
    }

    /** Set root from outside (e.g. when user navigates to this screen). */
    setRoot(noteNameOrPC) {
        const pc = typeof noteNameOrPC === 'number'
            ? noteNameOrPC
            : pitchClass(noteNameOrPC);
        if (pc < 0) return;
        this.activeRoot = pc;
        this.selectedPC = pc;

        const rootSel = document.getElementById('tz-root-select');
        if (rootSel) rootSel.value = String(pc);

        this._onRootChanged();
    }
}
