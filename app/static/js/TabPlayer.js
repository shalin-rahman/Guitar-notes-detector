export const SONG_TABS = [
    {
        id: 'song-1',
        title: 'Smoke on the Water (Riff)',
        artist: 'Deep Purple',
        tuning: 'Standard (E A D G B E)',
        bpm: 112,
        tabLines: [
            "e|---------------------------------------|",
            "B|---------------------------------------|",
            "G|--0--3--5---0--3--6-5---0--3--5---3--0-|",
            "D|--0--3--5---0--3--6-5---0--3--5---3--0-|",
            "A|---------------------------------------|",
            "E|---------------------------------------|"
        ],
        playbackNotes: [
            ['G3', 'D3'], ['A#3', 'F3'], ['C4', 'G3'],
            ['G3', 'D3'], ['A#3', 'F3'], ['C#4', 'G#3'], ['C4', 'G3'],
            ['G3', 'D3'], ['A#3', 'F3'], ['C4', 'G3'],
            ['A#3', 'F3'], ['G3', 'D3']
        ]
    },
    {
        id: 'song-2',
        title: 'Seven Nation Army (Intro)',
        artist: 'The White Stripes',
        tuning: 'Standard (E A D G B E)',
        bpm: 124,
        tabLines: [
            "e|---------------------------------------|",
            "B|---------------------------------------|",
            "G|---------------------------------------|",
            "D|--2---2--5--2--0----3---2--------------|",
            "A|--2---2--5--2--0----3---2--------------|",
            "E|--0---0--3--0-------1---0--------------|"
        ],
        playbackNotes: [
            ['E2', 'B2'], ['E2', 'B2'], ['G2', 'D3'], ['E2', 'B2'], ['D2', 'A2'], ['F2', 'C3'], ['E2', 'B2']
        ]
    },
    {
        id: 'song-3',
        title: 'Fur Elise (Classical Guitar Riff)',
        artist: 'L. v. Beethoven',
        tuning: 'Standard (E A D G B E)',
        bpm: 130,
        tabLines: [
            "e|--7--6--7--6--7--2--5--3--0------------|",
            "B|---------------------------------------|",
            "G|---------------------------------------|",
            "D|---------------------------------------|",
            "A|---------------------------------------|",
            "E|---------------------------------------|"
        ],
        playbackNotes: [
            'B4', 'A#4', 'B4', 'A#4', 'B4', 'F#4', 'A4', 'G4', 'E4'
        ]
    }
];

export default class TabPlayer {
    constructor(appRef) {
        this.app = appRef;
        this.currentSong = SONG_TABS[0];
        this.isPlaying = false;
        this.isLooping = false;
        this.speed = 1.0;
        this.currentNoteIndex = -1;
        this.timer = null;

        this.elements = {
            select: document.getElementById('tab-song-select'),
            title: document.getElementById('tab-song-title'),
            artist: document.getElementById('tab-song-artist'),
            display: document.getElementById('tab-display'),
            playBtn: document.getElementById('tab-play-btn'),
            stopBtn: document.getElementById('tab-stop-btn'),
            loopBtn: document.getElementById('tab-loop-btn'),
            speedSelect: document.getElementById('tab-speed-select')
        };

        this.init();
        this.bindEvents();
    }

    init() {
        if (!this.elements.select) return;
        this.elements.select.innerHTML = SONG_TABS.map(s => `
            <option value="${s.id}">${s.title} — ${s.artist}</option>
        `).join('');
        this.loadSong(SONG_TABS[0].id);
    }

    bindEvents() {
        if (this.elements.select) {
            this.elements.select.addEventListener('change', (e) => this.loadSong(e.target.value));
        }
        if (this.elements.playBtn) {
            this.elements.playBtn.addEventListener('click', () => this.play());
        }
        if (this.elements.stopBtn) {
            this.elements.stopBtn.addEventListener('click', () => this.stop());
        }
        if (this.elements.loopBtn) {
            this.elements.loopBtn.addEventListener('click', () => {
                this.isLooping = !this.isLooping;
                this.elements.loopBtn.classList.toggle('active', this.isLooping);
                this.elements.loopBtn.textContent = this.isLooping ? '🔁 Loop: ON' : '🔁 Loop: OFF';
            });
        }
        if (this.elements.speedSelect) {
            this.elements.speedSelect.addEventListener('change', (e) => {
                this.speed = parseFloat(e.target.value);
            });
        }
    }

    loadSong(id) {
        this.stop();
        const song = SONG_TABS.find(s => s.id === id);
        if (!song) return;

        this.currentSong = song;
        if (this.elements.title) this.elements.title.textContent = song.title;
        if (this.elements.artist) this.elements.artist.textContent = `${song.artist} | Tuning: ${song.tuning} | BPM: ${song.bpm}`;

        this.renderTab();
    }

    renderTab() {
        if (!this.elements.display) return;
        this.elements.display.innerHTML = `<pre class="ascii-tab">${this.currentSong.tabLines.join('\n')}</pre>`;
    }

    play() {
        if (this.isPlaying) return;
        this.app.initAudioContext();
        this.isPlaying = true;
        this.currentNoteIndex = 0;

        if (this.elements.playBtn) this.elements.playBtn.disabled = true;
        if (this.elements.stopBtn) this.elements.stopBtn.disabled = false;

        this.step();
    }

    step() {
        if (!this.isPlaying) return;

        const notes = this.currentSong.playbackNotes;
        if (this.currentNoteIndex >= notes.length) {
            if (this.isLooping) {
                this.currentNoteIndex = 0;
            } else {
                this.stop();
                return;
            }
        }

        const noteGroup = notes[this.currentNoteIndex];
        if (Array.isArray(noteGroup)) {
            // Play power chord or dyad
            noteGroup.forEach(n => this.app.player.playNote(n));
            this.app.fretboard.showScale(noteGroup.map(n => n.replace(/[0-9]/g, '')));
        } else {
            this.app.player.playNote(noteGroup);
            this.app.fretboard.showNote(noteGroup);
        }

        this.currentNoteIndex++;

        // Base tempo interval (milliseconds per beat) scaled by speed
        const baseInterval = (60000 / this.currentSong.bpm) * 0.85;
        const actualInterval = baseInterval / this.speed;

        this.timer = setTimeout(() => this.step(), actualInterval);
    }

    stop() {
        this.isPlaying = false;
        if (this.timer) clearTimeout(this.timer);
        this.currentNoteIndex = -1;

        if (this.elements.playBtn) this.elements.playBtn.disabled = false;
        if (this.elements.stopBtn) this.elements.stopBtn.disabled = true;
    }
}
