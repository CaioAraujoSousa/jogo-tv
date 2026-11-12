class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = localStorage.getItem("game_muted") === "true";
    this.currentTrack = null;
    this.loopTimer = null;
    this.stepIndex = 0;
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
        this.playMusic(this.currentTrack);
      }
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
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
        this.playMusic(this.currentTrack);
      }
    });

    document.body.appendChild(btn);
  }

  playTone(freq, duration, type = "sine", volume = 0.08, delay = 0) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || this.ctx.state !== "running") return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const startTime = this.ctx.currentTime + delay;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
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
  }

  stopMusic() {
    this.currentTrack = null;
    this.stopLoopOnly();
  }

  playMusic(trackName) {
    if (this.currentTrack === trackName && this.loopTimer) return;
    this.currentTrack = trackName;
    this.stopLoopOnly();
    this.stepIndex = 0;

    if (this.isMuted) return;
    this.initContext();

    const tracks = {
      // 1. Lobby: Lo-fi / Lounge descontraído
      lobby: {
        tempo: 420,
        type: "triangle",
        volume: 0.05,
        notes: [261.63, 329.63, 392.0, 493.88, 392.0, 329.63, 293.66, 349.23],
      },
      // 2. Desenho: Ritmo criativo e animado
      drawing: {
        tempo: 260,
        type: "sine",
        volume: 0.05,
        notes: [
          329.63, 392.0, 440.0, 523.25, 440.0, 392.0, 329.63, 293.66, 349.23,
          440.0, 523.25, 587.33, 523.25, 440.0, 392.0, 329.63,
        ],
      },
      // 3. Votação: Clima de game show / suspense curioso
      voting: {
        tempo: 350,
        type: "triangle",
        volume: 0.05,
        notes: [220.0, 0, 261.63, 246.94, 220.0, 0, 196.0, 246.94],
      },
      // 4. Pódio: Fanfarra de celebração vitoriosa
      podium: {
        tempo: 240,
        type: "square",
        volume: 0.035,
        notes: [
          523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 659.25, 783.99,
        ],
      },
    };

    const track = tracks[trackName];
    if (!track) return;

    const tick = () => {
      if (this.isMuted || !this.ctx || this.ctx.state !== "running") return;
      const freq = track.notes[this.stepIndex % track.notes.length];
      if (freq > 0) {
        this.playTone(freq, (track.tempo / 1000) * 0.85, track.type, track.volume);
      }
      this.stepIndex++;
    };

    tick();
    this.loopTimer = setInterval(tick, track.tempo);
  }

  // Efeitos Sonoros Rápidos (SFX)
  sfxTick() {
    this.playTone(880, 0.08, "sine", 0.09);
  }

  sfxSubmit() {
    this.playTone(523.25, 0.1, "triangle", 0.09, 0);
    this.playTone(659.25, 0.15, "triangle", 0.09, 0.09);
  }

  sfxReveal(hasMasterpiece = false) {
    this.stopMusic();
    if (hasMasterpiece) {
      // Acorde dourado especial para "Obra de arte!"
      this.playTone(523.25, 0.2, "triangle", 0.1, 0);
      this.playTone(659.25, 0.2, "triangle", 0.1, 0.12);
      this.playTone(783.99, 0.2, "triangle", 0.1, 0.24);
      this.playTone(1046.5, 0.45, "triangle", 0.12, 0.36);
    } else {
      this.playTone(440, 0.12, "sine", 0.09, 0);
      this.playTone(554.37, 0.12, "sine", 0.09, 0.1);
      this.playTone(659.25, 0.28, "sine", 0.1, 0.2);
    }
  }
}

export const sound = new SoundEngine();