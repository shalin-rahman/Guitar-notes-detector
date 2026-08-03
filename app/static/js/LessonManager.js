import { icon } from './Icons.js';

export const LESSON_DATA = [
    {
        id: 'lesson-1',
        title: 'Guitar Fundamentals & Posture',
        category: 'Beginner',
        icon: 'guitar',
        description: 'Learn string names, holding the pick, and proper fretting finger posture.',
        steps: [
            {
                title: '1. Standard Tuning & Strings',
                content: 'The 6 strings from lowest (thickest) to highest (thinnest) are tuned to E2, A2, D3, G3, B3, E4. A helpful mnemonic is: <strong>E</strong>very <strong>A</strong>mateur <strong>D</strong>oes <strong>G</strong>etting <strong>B</strong>etter <strong>E</strong>asy!',
                actionText: 'Play Open Low E',
                playNote: 'E2'
            },
            {
                title: '2. Fretting Technique',
                content: 'Press down just behind the fretwire using the tip of your finger, not the pad. Keep your thumb centered on the back of the neck for maximum leverage.',
                actionText: 'Test Fret 1 on Low E (F2)',
                playNote: 'F2'
            },
            {
                title: '3. Your First Open Chord: E Minor',
                content: 'Place finger 2 (middle) on fret 2 of String 5 (A), and finger 3 (ring) on fret 2 of String 4 (D). Strum all 6 strings.',
                actionText: 'Play Em Chord',
                playChord: ['E2', 'B2', 'E3', 'G3', 'B3', 'E4']
            }
        ]
    },
    {
        id: 'lesson-2',
        title: 'The Minor Pentatonic Scale',
        category: 'Intermediate',
        icon: 'sheet',
        description: 'Master Position 1 of the A Minor Pentatonic scale—the most famous soloing shape in rock history.',
        steps: [
            {
                title: '1. Scale Formula & Notes',
                content: 'Minor Pentatonic consists of 5 notes: Root (1), Minor 3rd (b3), Perfect 4th (4), Perfect 5th (5), and Minor 7th (b7). In A Minor: A, C, D, E, G.',
                actionText: 'Show Scale on Fretboard',
                showScale: ['A', 'C', 'D', 'E', 'G']
            },
            {
                title: '2. Low String Run',
                content: 'Play fret 5 on String 6 (A), then fret 8 (C). Then move to String 5: fret 5 (D), fret 7 (E).',
                actionText: 'Play Low String Sequence',
                playSequence: ['A2', 'C3', 'D3', 'E3']
            },
            {
                title: '3. Full 2-Octave Run',
                content: 'Ascend through all 6 strings using fingers 1 & 4 on strings 6, 2, 1 and fingers 1 & 3 on strings 5, 4, 3.',
                actionText: 'Play Full Scale Run',
                playSequence: ['A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5']
            }
        ]
    },
    {
        id: 'lesson-3',
        title: 'Advanced Technique: Legato & Tapping',
        category: 'Advanced',
        icon: 'rocket',
        description: 'Develop fluid speed using hammer-ons, pull-offs, and two-handed fretboard tapping.',
        steps: [
            {
                title: '1. Hammer-On Precision',
                content: 'Pick String 3 fret 5, then hammer down firmly on fret 7 without picking again. Focus on equal volume between picked and hammered notes.',
                actionText: 'Play Hammer-On Sequence',
                playSequence: ['C4', 'D4']
            },
            {
                title: '2. Pull-Off Technique',
                content: 'Fret string 3 at frets 5 and 7 simultaneously. Pick fret 7, then "flick" the string downward off fret 7 so fret 5 sounds clearly.',
                actionText: 'Play Pull-Off Sequence',
                playSequence: ['D4', 'C4']
            },
            {
                title: '3. Right-Hand Fret Tapping',
                content: 'Use your right-hand index or middle finger to tap fret 12 on String 1, pull off to fret 8, then pull off to fret 5. Loop this triad lick smoothly.',
                actionText: 'Play Tapping Triad Lick',
                playSequence: ['E5', 'C5', 'A4', 'E5', 'C5', 'A4']
            }
        ]
    }
];

export default class LessonManager {
    constructor(appRef) {
        this.app = appRef;
        this.currentLesson = LESSON_DATA[0];
        this.currentStepIndex = 0;
        this.completedLessons = JSON.parse(localStorage.getItem('ahordian_completed_lessons') || '[]');

        this.elements = {
            list: document.getElementById('lesson-list'),
            title: document.getElementById('lesson-title'),
            desc: document.getElementById('lesson-desc'),
            stepTitle: document.getElementById('lesson-step-title'),
            stepContent: document.getElementById('lesson-step-content'),
            stepActionBtn: document.getElementById('lesson-step-action-btn'),
            prevStepBtn: document.getElementById('lesson-prev-btn'),
            nextStepBtn: document.getElementById('lesson-next-btn'),
            completeBtn: document.getElementById('lesson-complete-btn'),
            progressText: document.getElementById('lesson-progress-text')
        };

        this.renderLessonList();
        this.loadLesson(this.currentLesson.id);
        this.bindEvents();
    }

    bindEvents() {
        if (this.elements.prevStepBtn) {
            this.elements.prevStepBtn.addEventListener('click', () => {
                if (this.currentStepIndex > 0) {
                    this.currentStepIndex--;
                    this.renderStep();
                }
            });
        }
        if (this.elements.nextStepBtn) {
            this.elements.nextStepBtn.addEventListener('click', () => {
                if (this.currentStepIndex < this.currentLesson.steps.length - 1) {
                    this.currentStepIndex++;
                    this.renderStep();
                }
            });
        }
        if (this.elements.completeBtn) {
            this.elements.completeBtn.addEventListener('click', () => {
                if (!this.completedLessons.includes(this.currentLesson.id)) {
                    this.completedLessons.push(this.currentLesson.id);
                    localStorage.setItem('ahordian_completed_lessons', JSON.stringify(this.completedLessons));
                    this.renderLessonList();
                    this.elements.completeBtn.innerHTML = `<span class="btn-ico">${icon('check')}</span>Completed!`;
                }
            });
        }
        if (this.elements.stepActionBtn) {
            this.elements.stepActionBtn.addEventListener('click', () => {
                const step = this.currentLesson.steps[this.currentStepIndex];
                if (!step) return;

                this.app.initAudioContext();
                if (step.playNote) {
                    this.app.player.playNote(step.playNote);
                    this.app.fretboard.showNote(step.playNote);
                } else if (step.playChord) {
                    this.app.playSequence([step.playChord.join('-')], 600);
                } else if (step.playSequence) {
                    this.app.playSequence(step.playSequence, 350);
                } else if (step.showScale) {
                    this.app.fretboard.showScale(step.showScale);
                }
            });
        }
    }

    renderLessonList() {
        if (!this.elements.list) return;
        this.elements.list.innerHTML = LESSON_DATA.map(l => {
            const isDone = this.completedLessons.includes(l.id);
            const isActive = l.id === this.currentLesson.id;
            return `
                <div class="dash-card lesson-card ${isActive ? 'active-lesson' : ''}" onclick="window.AhordianApp.lessonManager.loadLesson('${l.id}')">
                    <div class="row-split">
                        <span class="lesson-card-title"><span class="btn-ico">${icon(l.icon, { size: 18 })}</span><strong>${l.title}</strong></span>
                        <span class="lesson-badge ${isDone ? 'done' : ''}">${isDone ? 'Completed' : l.category}</span>
                    </div>
                    <p class="lesson-card-desc">${l.description}</p>
                </div>
            `;
        }).join('');
    }

    loadLesson(id) {
        const lesson = LESSON_DATA.find(l => l.id === id);
        if (!lesson) return;

        this.currentLesson = lesson;
        this.currentStepIndex = 0;

        if (this.elements.title) this.elements.title.innerHTML = `<span class="btn-ico">${icon(lesson.icon, { size: 20 })}</span>${lesson.title}`;
        if (this.elements.desc) this.elements.desc.textContent = lesson.description;

        this.renderLessonList();
        this.renderStep();
    }

    renderStep() {
        const step = this.currentLesson.steps[this.currentStepIndex];
        if (!step) return;

        if (this.elements.stepTitle) this.elements.stepTitle.textContent = step.title;
        if (this.elements.stepContent) this.elements.stepContent.innerHTML = step.content;
        if (this.elements.stepActionBtn) this.elements.stepActionBtn.innerHTML = `<span class="btn-ico">${icon('play')}</span>${step.actionText}`;

        if (this.elements.progressText) {
            this.elements.progressText.textContent = `Step ${this.currentStepIndex + 1} of ${this.currentLesson.steps.length}`;
        }

        if (this.elements.prevStepBtn) this.elements.prevStepBtn.disabled = this.currentStepIndex === 0;
        if (this.elements.nextStepBtn) this.elements.nextStepBtn.disabled = this.currentStepIndex === this.currentLesson.steps.length - 1;

        if (this.elements.completeBtn) {
            const isDone = this.completedLessons.includes(this.currentLesson.id);
            this.elements.completeBtn.innerHTML = isDone
                ? `<span class="btn-ico">${icon('check')}</span>Completed`
                : 'Mark as Complete';
        }
    }
}
