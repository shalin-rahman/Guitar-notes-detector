/**
 * Every icon in the app lives here — one file, one visual language.
 *
 * Two maps, because they are consumed differently:
 *   Icons      — full <svg> strings keyed by screen id, injected into the nav bar.
 *   UiIconPaths — inner markup only, wrapped to the requested size by icon().
 *
 * All artwork is 24x24, no fill, 2px round-joined strokes in currentColor, so a
 * button icon and a nav icon read as the same set. Keep new icons to that spec.
 */

const STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

export const Icons = {
    'home-screen': `<svg viewBox="0 0 24 24" ${STROKE}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    'detector-screen': `<svg viewBox="0 0 24 24" ${STROKE}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
    'tools-screen': `<svg viewBox="0 0 24 24" ${STROKE}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
    'chord-explorer-screen': `<svg viewBox="0 0 24 24" ${STROKE}><rect x="2" y="2" width="6" height="20" rx="1"/><rect x="9" y="6" width="6" height="16" rx="1"/><rect x="16" y="10" width="6" height="12" rx="1"/></svg>`,
    // Ascending steps — a scale. (Was a smiley face, which said nothing about scales.)
    'scale-explorer-screen': `<svg viewBox="0 0 24 24" ${STROKE}><polyline points="3 20 8 20 8 14 13 14 13 8 18 8 18 3 21 3"/></svg>`,
    // Strings crossing frets. Distinct from tab-player-screen, which keeps the music note.
    'fretboard-screen': `<svg viewBox="0 0 24 24" ${STROKE}><rect x="3" y="2" width="18" height="20" rx="2"/><line x1="9" y1="2" x2="9" y2="22"/><line x1="15" y1="2" x2="15" y2="22"/><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="15" x2="21" y2="15"/></svg>`,
    'circle-screen': `<svg viewBox="0 0 24 24" ${STROKE}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/></svg>`,
    'ear-training-screen': `<svg viewBox="0 0 24 24" ${STROKE}><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`,
    'practice-screen': `<svg viewBox="0 0 24 24" ${STROKE}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    'lessons-screen': `<svg viewBox="0 0 24 24" ${STROKE}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    'tab-player-screen': `<svg viewBox="0 0 24 24" ${STROKE}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    'guide-screen': `<svg viewBox="0 0 24 24" ${STROKE}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
    'settings-screen': `<svg viewBox="0 0 24 24" ${STROKE}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
};

/**
 * Inner markup for functional icons. Names describe the ROLE, not the picture, so
 * a button reads `data-icon="record"` rather than `data-icon="red-circle"`.
 */
export const UiIconPaths = {
    // transport
    play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>',
    record: '<circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/>',
    loop: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    prev: '<polygon points="17 4 7 12 17 20 17 4" fill="currentColor" stroke="none"/>',
    next: '<polygon points="7 4 17 12 7 20 7 4" fill="currentColor" stroke="none"/>',
    metronome: '<path d="M12 3l7 16H5z"/><line x1="12" y1="19" x2="19" y2="7"/>',
    timer: '<circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 15 14"/><line x1="9" y1="2" x2="15" y2="2"/>',

    // actions
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
    edit: '<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    cross: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    jump: '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>',
    chevron: '<polyline points="6 9 12 15 18 9"/>',
    tap: '<path d="M9 11V5a2 2 0 0 1 4 0v6"/><path d="M13 8a2 2 0 0 1 4 0v3"/><path d="M17 10a2 2 0 0 1 4 0v4a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7v-2a2 2 0 0 1 4 0"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><line x1="18" y1="16" x2="18" y2="20"/><line x1="16" y1="18" x2="20" y2="18"/>',
    dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',

    // subjects
    guitar: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    note: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="16" x2="21" y2="16"/>',
    piano: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 4v9M12 4v9M17 4v9"/>',
    drum: '<ellipse cx="12" cy="7" rx="9" ry="4"/><path d="M3 7v10c0 2.2 4 4 9 4s9-1.8 9-4V7"/><line x1="7" y1="11" x2="4" y2="20"/><line x1="17" y1="11" x2="20" y2="20"/>',
    mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>',
    ear: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
    volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    'volume-off': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/>',
    // open arc so a CSS rotation reads as motion
    loading: '<path d="M21 12a9 9 0 1 1-6.2-8.56"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    rocket: '<path d="M5 13c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="M14 4c3 0 6 3 6 6 0 4-5 8-9 10l-3-3C10 13 10 4 14 4z"/><circle cx="15" cy="9" r="1.5"/>',
    bulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V18h8v-3.3A7 7 0 0 0 12 2z"/>',
    trophy: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    flame: '<path d="M12 2s5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-5 0 2 1 3 2 3 1.5 0 2-1.5 1-4-.5-1.5-2-3-2-4z"/>',
    run: '<circle cx="15" cy="4" r="2"/><path d="M13 9l-3 3 2 4-3 6"/><path d="M13 9l4 2 1 4"/><path d="M10 12L5 11"/>',
    dumbbell: '<line x1="6" y1="12" x2="18" y2="12"/><rect x="2" y="8" width="4" height="8" rx="1"/><rect x="18" y="8" width="4" height="8" rx="1"/>',
    layers: '<polygon points="12 2 2 8 12 14 22 8 12 2"/><polyline points="2 14 12 20 22 14"/>',
    wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="3" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="21"/><line x1="3" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="21" y2="12"/>',
    heart: '<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z"/>'
};

/**
 * Builds an inline <svg> for a functional icon.
 * Returns '' for an unknown name so a typo degrades to a text-only label rather
 * than dumping "undefined" into the UI.
 */
export function icon(name, { size = 16, className = 'ui-icon' } = {}) {
    const paths = UiIconPaths[name];
    if (!paths) return '';
    return `<svg class="${className}" viewBox="0 0 24 24" width="${size}" height="${size}" ` +
           `${STROKE} aria-hidden="true" focusable="false">${paths}</svg>`;
}

/**
 * Replaces every `<span data-icon="play">` under `root` with its SVG. Lets markup
 * declare icons without repeating path data, and is idempotent so it can be re-run
 * over content rendered later.
 */
export function hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]:not([data-icon-done])').forEach(el => {
        const svg = icon(el.dataset.icon, { size: Number(el.dataset.iconSize) || 16 });
        if (!svg) return;
        el.innerHTML = svg;
        el.setAttribute('data-icon-done', '');
    });
}
