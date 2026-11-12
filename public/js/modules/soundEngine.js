// Mude para false se quiser que a MÚSICA toque só na TV e os celulares toquem apenas EFEITOS SONOROS (recomendado para salas com muitos celulares)
const PLAY_MUSIC_ON_MOBILE = true;

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = localStorage.getItem("game_muted") === "true";
    this.currentTrack = null;
    this.schedulerTimer = null;
    this.nextNoteTime = 0;
    this.currentStep = 0;
    this.isMobileControl = window.location.pathname.includes("controle");
    this.mountToggleButton();
    this.setupAutoUnlock();
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  setupAutoUnlock() {
    const unlock = () => {
      this.initContext();
      if (this.currentTrack && !this.schedulerTimer && !this.isMuted) {
        this.startScheduler(this.currentTrack);
      }
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
  }

  mountToggleButton() {
    if (document.getElementById("sound-toggle-btn")) return;
    const btn = document.createElement("button");
    btn.id = "sound-toggle-btn";
    btn.type = "button";
    btn.textContent = this.isMuted ? "🔇" : "🔊";
    Object.assign(btn.style, {
      position: "fixed",
      bottom: "15px",
      left: "15px",
      width: "44px",
      height: "44px",
      borderRadius: "50%",
      background: "#1e293b",
      border: "2px solid #38bdf8",
      color: "#ffffff",
      fontSize: "1.2rem",
      cursor: "pointer",
      zIndex: "9999",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      padding: "0",
    });

    btn.addEventListener("click", () => {
      this.initContext();
      this.isMuted = !this.isMuted;
      localStorage.setItem("game_muted", this.isMuted);
      btn.textContent = this.isMuted ? "🔇" : "🔊";
      if (this.isMuted) {
        this.stopLoopOnly();
      } else if (this.currentTrack) {
        this.startScheduler(this.currentTrack);
      }
    });

    document.body.appendChild(btn);
  }

  // Agenda a nota exatamente no relógio de hardware da placa de som (nunca atrasa nem oscila)
  scheduleToneAt(freq, duration, type, volume, exactStartTime) {
    if (this.isMuted || !freq || !this.ctx || this.ctx.state !== "running") {
      return;
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const start = Math.max(this.ctx.currentTime, exactStartTime);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  playTone(freq, duration, type = "sine", volume = 0.08, delay = 0) {
    if (this.isMuted || !freq) return;
    this.initContext();
    if (!this.ctx || this.ctx.state !== "running") return;
    this.scheduleToneAt(
      freq,
      duration,
      type,
      volume,
      this.ctx.currentTime + delay,
    );
  }

  stopLoopOnly() {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  stopMusic() {
    this.currentTrack = null;
    this.stopLoopOnly();
  }

  getTracks() {
    return {
      // 1. LOBBY: Bossa / Wii-Shop Groove
      lobby: {
        stepSec: 0.22,
        leadType: "triangle",
        leadVol: 0.06,
        bassType: "sine",
        bassVol: 0.08,
        melody: [
          523.25, 0, 659.25, 587.33, 523.25, 0, 392.0, 440.0,
          493.88, 0, 587.33, 523.25, 440.0, 0, 392.0, 0,
        ],
        bass: [
          130.81, 0, 196.0, 0, 146.83, 0, 220.0, 0,
          164.81, 0, 246.94, 0, 196.0, 0, 146.83, 196.0,
        ],
      },

      // 2. DESENHO: Arcade Upbeat
      drawing: {
        stepSec: 0.18,
        leadType: "square",
        leadVol: 0.03,
        bassType: "triangle",
        bassVol: 0.075,
        melody: [
          523.25, 659.25, 783.99, 659.25, 880.0, 783.99, 659.25, 523.25,
          587.33, 698.46, 880.0, 698.46, 783.99, 659.25, 587.33, 392.0,
        ],
        bass: [
          130.81, 130.81, 261.63, 130.81, 174.61, 174.61, 349.23, 174.61,
          146.83, 146.83, 293.66, 146.83, 196.0, 196.0, 246.94, 196.0,
        ],
      },

      // 3. VOTAÇÃO: Game Show Funky
      voting: {
        stepSec: 0.21,
        leadType: "sawtooth",
        leadVol: 0.028,
        bassType: "triangle",
        bassVol: 0.085,
        melody: [
          440.0, 0, 523.25, 493.88, 440.0, 0, 659.25, 0,
          440.0, 0, 587.33, 523.25, 493.88, 0, 392.0, 493.88,
        ],
        bass: [
          110.0, 110.0, 0, 130.81, 146.83, 0, 130.81, 110.0,
          110.0, 110.0, 0, 146.83, 164.81, 0, 146.83, 130.81,
        ],
      },

      // 4. PÓDIO: Fanfarra de Campeão
      podium: {
        stepSec: 0.2,
        leadType: "square",
        leadVol: 0.038,
        bassType: "triangle",
        bassVol: 0.08,
        melody: [
          523.25, 659.25, 783.99, 1046.5, 0, 783.99, 1046.5, 0,
          880.0, 698.46, 587.33, 783.99, 659.25, 783.99, 1046.5, 0,
        ],
        bass: [
          130.81, 196.0, 261.63, 130.81, 174.61, 220.0, 261.63, 174.61,
          146.83, 220.0, 196.0, 246.94, 130.81, 196.0, 261.63, 0,
        ],
      },
    };
  }

  playMusic(trackName) {
    if (this.isMobileControl && !PLAY_MUSIC_ON_MOBILE) return;
    if (this.currentTrack === trackName && this.schedulerTimer) return;
    this.currentTrack = trackName;
    this.startScheduler(trackName);
  }

  startScheduler(trackName) {
    this.stopLoopOnly();
    if (this.isMuted) return;
    if (this.isMobileControl && !PLAY_MUSIC_ON_MOBILE) return;

    this.initContext();
    if (!this.ctx || this.ctx.state !== "running") return;

    const track = this.getTracks()[trackName];
    if (!track) return;

    const len = track.melody.length;
    const stepMs = track.stepSec * 1000;

    // Alinha o início do compasso pelo relógio, mas a partir daí usa o clock da placa de som!
    const nowMs = Date.now();
    this.currentStep = Math.floor(nowMs / stepMs) % len;
    const remainderSec = (stepMs - (nowMs % stepMs)) / 1000;
    this.nextNoteTime = this.ctx.currentTime + remainderSec;

    const lookaheadSec = 0.12; // Agenda 120ms à frente no hardware para nunca oscilar

    const schedule = () => {
      if (this.isMuted || !this.ctx || this.ctx.state !== "running") return;

      // Se a aba ficou em segundo plano e voltou, realinha o relógio sem engolir notas
      if (this.nextNoteTime < this.ctx.currentTime - 0.2) {
        this.nextNoteTime = this.ctx.currentTime + 0.05;
      }

      while (this.nextNoteTime < this.ctx.currentTime + lookaheadSec) {
        const idx = this.currentStep % len;
        const dur = track.stepSec * 0.85;

        const leadFreq = track.melody[idx];
        const bassFreq = track.bass[idx];

        if (leadFreq > 0) {
          this.scheduleToneAt(
            leadFreq,
            dur,
            track.leadType,
            track.leadVol,
            this.nextNoteTime,
          );
        }
        if (bassFreq > 0) {
          this.scheduleToneAt(
            bassFreq,
            dur * 1.05,
            track.bassType,
            track.bassVol,
            this.nextNoteTime,
          );
        }

        this.nextNoteTime += track.stepSec;
        this.currentStep = (this.currentStep + 1) % len;
      }
    };

    schedule();
    this.schedulerTimer = setInterval(schedule, 40);
  }

  sfxTick() {
    this.playTone(880, 0.07, "triangle", 0.12, 0);
    this.playTone(1760, 0.04, "sine", 0.06, 0.02);
  }

  sfxSubmit() {
    this.playTone(523.25, 0.09, "triangle", 0.1, 0);
    this.playTone(659.25, 0.14, "triangle", 0.1, 0.08);
  }

  sfxReveal(hasMasterpiece = false) {
    this.stopMusic();
    if (hasMasterpiece) {
      this.playTone(523.25, 0.18, "triangle", 0.11, 0);
      this.playTone(659.25, 0.18, "triangle", 0.11, 0.11);
      this.playTone(783.99, 0.18, "triangle", 0.11, 0.22);
      this.playTone(1046.5, 0.45, "square", 0.06, 0.33);
    } else {
      this.playTone(440, 0.12, "triangle", 0.1, 0);
      this.playTone(554.37, 0.12, "triangle", 0.1, 0.1);
      this.playTone(659.25, 0.28, "triangle", 0.11, 0.2);
    }
  }
}

export const sound = new SoundEngine();