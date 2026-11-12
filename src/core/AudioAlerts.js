/**
 * ============================================================================
 * SOL DEL NORTE - SISTEMA DE ALERTAS SONORAS (WEB AUDIO API SINTETIZADO)
 * Sonidos gastronómicos sutiles sin archivos MP3 externos
 * ============================================================================
 */

class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  playOrderSent() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      // Doble tono suave tipo campanita de cocina
      const now = this.ctx.currentTime;
      this.createBeep(880, now, 0.15, 'sine');
      this.createBeep(1320, now + 0.12, 0.25, 'sine');
    } catch (e) {
      console.warn('Audio no disponible o bloqueado por el navegador', e);
    }
  }

  playOrderReady() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      // Triada ascendente clara (Listo para servir)
      const now = this.ctx.currentTime;
      this.createBeep(659.25, now, 0.12, 'sine');       // E5
      this.createBeep(830.61, now + 0.10, 0.12, 'sine'); // G#5
      this.createBeep(987.77, now + 0.20, 0.35, 'sine'); // B5
    } catch (e) {
      console.warn('Audio no disponible', e);
    }
  }

  playWarning() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;
      this.createBeep(330, now, 0.15, 'triangle');
      this.createBeep(290, now + 0.12, 0.2, 'triangle');
    } catch (e) {
      console.warn('Audio no disponible', e);
    }
  }

  createBeep(freq, startTime, duration, type = 'sine') {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.12, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}

export const sound = new SoundSynthesizer();
