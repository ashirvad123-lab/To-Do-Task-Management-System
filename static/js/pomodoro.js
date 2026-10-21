/**
 * pomodoro.js - Focus Pomodoro Timer Module
 * Integrated with the active task list, plays synthesised notification chimes,
 * and tracks completed focus sessions.
 */

class PomodoroTimer {
    constructor() {
        this.durationMinutes = 25;
        this.timeRemaining = 25 * 60;
        this.timerId = null;
        this.isRunning = false;
        this.currentMode = 'work'; // 'work', 'short', 'long'
        this.completedSessions = 0;
        this.activeTaskId = null;
        this.soundEnabled = true;

        this.initDOMElements();
        this.bindEvents();
        this.updateDisplay();
    }

    initDOMElements() {
        this.modal = document.getElementById('pomodoroModal');
        this.navPomoBtn = document.getElementById('openPomodoroBtn');
        this.navDisplay = document.getElementById('navPomoDisplay');
        this.clockDisplay = document.getElementById('pomodoroClockDisplay');
        this.toggleBtn = document.getElementById('pomoToggleBtn');
        this.resetBtn = document.getElementById('pomoResetBtn');
        this.playIcon = document.getElementById('pomoPlayIcon');
        this.modeButtons = document.querySelectorAll('.pomo-mode-btn');
        this.taskSelect = document.getElementById('pomoTaskSelect');
        this.soundToggle = document.getElementById('pomoSoundToggle');
        this.completedCountElem = document.getElementById('pomoCompletedCount');
    }

    bindEvents() {
        if (this.navPomoBtn) {
            this.navPomoBtn.addEventListener('click', () => this.openModal());
        }

        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggle());
        }

        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => this.reset());
        }

        if (this.soundToggle) {
            this.soundToggle.addEventListener('change', (e) => {
                this.soundEnabled = e.target.checked;
            });
        }

        if (this.taskSelect) {
            this.taskSelect.addEventListener('change', (e) => {
                this.activeTaskId = e.target.value ? parseInt(e.target.value) : null;
            });
        }

        this.modeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const mode = target.dataset.mode;
                const minutes = parseInt(target.dataset.time, 10);
                this.switchMode(mode, minutes);
            });
        });
    }

    switchMode(mode, minutes) {
        this.pause();
        this.currentMode = mode;
        this.durationMinutes = minutes;
        this.timeRemaining = minutes * 60;

        this.modeButtons.forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector(`.pomo-mode-btn[data-mode="${mode}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        this.updateDisplay();
    }

    toggle() {
        if (this.isRunning) {
            this.pause();
        } else {
            this.start();
        }
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.playIcon.textContent = '⏸ Pause';
        this.toggleBtn.classList.add('btn-warning');
        this.toggleBtn.classList.remove('btn-primary');

        this.timerId = setInterval(() => {
            if (this.timeRemaining > 0) {
                this.timeRemaining--;
                this.updateDisplay();
            } else {
                this.completeSession();
            }
        }, 1000);
    }

    pause() {
        if (!this.isRunning) return;
        this.isRunning = false;
        clearInterval(this.timerId);
        this.timerId = null;
        this.playIcon.textContent = '▶ Start';
        this.toggleBtn.classList.remove('btn-warning');
        this.toggleBtn.classList.add('btn-primary');
    }

    reset() {
        this.pause();
        this.timeRemaining = this.durationMinutes * 60;
        this.updateDisplay();
    }

    updateDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (this.clockDisplay) {
            this.clockDisplay.textContent = formatted;
        }
        if (this.navDisplay) {
            this.navDisplay.textContent = formatted;
        }

        // Update page title if running
        if (this.isRunning) {
            document.title = `(${formatted}) TaskFlow Focus`;
        } else {
            document.title = 'TaskFlow • Modern Task Management System';
        }
    }

    async completeSession() {
        this.pause();
        this.playChime();

        if (this.currentMode === 'work') {
            this.completedSessions++;
            if (this.completedCountElem) {
                this.completedCountElem.textContent = this.completedSessions;
            }

            // If a task is attached, log pomodoro to backend!
            if (this.activeTaskId && window.API) {
                try {
                    await window.API.logPomodoro(this.activeTaskId);
                    if (window.app) {
                        window.app.loadTasks();
                        window.app.loadStats();
                    }
                } catch (e) {
                    console.error('Failed to log pomodoro to task:', e);
                }
            }

            if (window.app && window.app.showToast) {
                window.app.showToast('🎉 Focus session complete! Time for a well-earned break.', 'success');
            }

            // Auto-switch to short break
            this.switchMode('short', 5);
        } else {
            if (window.app && window.app.showToast) {
                window.app.showToast('🔔 Break is over! Ready to focus again?', 'warning');
            }
            this.switchMode('work', 25);
        }
    }

    playChime() {
        if (!this.soundEnabled) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();

            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;

                const startTime = ctx.currentTime + (idx * 0.12);
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.2, startTime + 0.04);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(startTime);
                osc.stop(startTime + 0.6);
            });
        } catch (e) {
            console.warn('Audio chime playback error:', e);
        }
    }

    openModal(taskId = null) {
        if (this.modal) {
            this.modal.classList.remove('hidden');
        }
        if (taskId) {
            this.setTask(taskId);
        }
    }

    closeModal() {
        if (this.modal) {
            this.modal.classList.add('hidden');
        }
    }

    populateTasksDropdown(tasks) {
        if (!this.taskSelect) return;
        const currentVal = this.taskSelect.value;
        this.taskSelect.innerHTML = '<option value="">-- No specific task --</option>';

        tasks.filter(t => !t.completed).forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = `${t.title} (${t.category})`;
            this.taskSelect.appendChild(opt);
        });

        if (currentVal) {
            this.taskSelect.value = currentVal;
        }
    }

    setTask(taskId) {
        this.activeTaskId = taskId;
        if (this.taskSelect) {
            this.taskSelect.value = taskId;
        }
        this.openModal();
    }
}

window.PomodoroTimer = PomodoroTimer;
