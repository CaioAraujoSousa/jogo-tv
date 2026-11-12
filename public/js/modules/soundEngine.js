class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = localStorage.getItem("game_muted") === "true";
    this.currentTrack = null;
    this.loopTimer = null;
    this.lastPlayedStep = -1;
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
      if (this.currentTrack && !this.loopTimer && !this.isMuted) {
        this.startSyncedLoop(this.currentTrack);
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
        this.startSyncedLoop(this.currentTrack);
      }
    });

    document.body.appendChild(btn);
  }

  playTone(freq, duration, type = "sine", volume = 0.08, delay = 0) {
    if (this.isMuted || !freq) return;
    this.initContext();
    if (!this.ctx || this.ctx.state !== "running") return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const startTime = this.ctx.currentTime + delay;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  stopLoopOnly() {
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    this.lastPlayedStep = -1;
  }

  stopMusic() {
    this.currentTrack = null;
    this.stopLoopOnly();
  }

  getTracks() {
    return {
      // 1. LOBBY: Bossa / Wii-Shop Groove (Melodia + Baixo marcado)
      lobby: {
        stepMs: 220,
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

      // 2. DESENHO: Arcade Upbeat (Criativo, rápido e envolvente)
      drawing: {
        stepMs: 180,
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

      // 3. VOTAÇÃO: Game Show Funky / Kahoot Tension
      voting: {
        stepMs: 210,
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

      // 4. PÓDIO: Fanfarra de Campeão (Acordes vibrantes)
      podium: {
        stepMs: 200,
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
    if (this.currentTrack === trackName && this.loopTimer) return;
    this.currentTrack = trackName;
    this.startSyncedLoop(trackName);
  }

  startSyncedLoop(trackName) {
    this.stopLoopOnly();
    if (this.isMuted) return;
    this.initContext();

    const track = this.getTracks()[trackName];
    if (!track) return;

    const len = track.melody.length;

    // Sincronizado pelo relógio global (Date.now()):
    // Todos os dispositivos tocam exatamente o mesmo compasso ao mesmo tempo
    const checkStep = () => {
      if (this.isMuted || !this.ctx || this.ctx.state !== "running") return;

      const globalStep = Math.floor(Date.now() / track.stepMs);
      if (globalStep === this.lastPlayedStep) return;
      this.lastPlayedStep = globalStep;

      const idx = globalStep % len;
      const dur = (track.stepMs / 1000) * 0.85;

      const leadFreq = track.melody[idx];
      const bassFreq = track.bass[idx];

      if (leadFreq > 0) {
        this.playTone(leadFreq, dur, track.leadType, track.leadVol);
      }
      if (bassFreq > 0) {
        this.playTone(bassFreq, dur * 1.05, track.bassType, track.bassVol);
      }
    };

    checkStep();
    this.loopTimer = setInterval(checkStep, 25);
  }

  // Bip mais encorpado para os últimos 5 segundos
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