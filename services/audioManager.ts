
// A simple synthesizer using Web Audio API to avoid external file dependencies
class AudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private bgmOscillators: OscillatorNode[] = [];
  private bgmGain: GainNode | null = null;

  constructor() {
    // We defer initialization until the first interaction to comply with browser autoplay policies
  }

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMute(mute: boolean) {
    this.isMuted = mute;
    // Also cancel speech if muted
    if (mute) {
      this.cancelSpeak();
    }
    if (this.bgmGain && this.ctx) {
      // Smooth fade
      const now = this.ctx.currentTime;
      this.bgmGain.gain.setTargetAtTime(mute ? 0 : 0.05, now, 0.5);
    }
  }

  public getMute() {
    return this.isMuted;
  }

  // Text-to-Speech
  public speak(text: string) {
    if (this.isMuted) return;
    
    // Cancel any current speech
    this.cancelSpeak();

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-TW'; // Force Traditional Chinese (Taiwan)
      utterance.rate = 0.85;    // Slightly slower for clarity
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }

  public cancelSpeak() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  // SFX: Light blip for typing
  public playTypeSound() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx; // Capture for TS safety

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  // SFX: Sword Slash / Heavy Impact (Distinct from error)
  public playHitSound(isCrit: boolean) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx; // Capture for TS safety

    const t = ctx.currentTime;

    // 1. Noise Burst (Impact Texture)
    // Create a short burst of noise for the "crunch" or "hit"
    const bufferSize = ctx.sampleRate * 0.1; // 0.1 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    // Filter the noise to make it less harsh (Lowpass)
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(isCrit ? 3000 : 1000, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t);

    // 2. Tonal Swipe (The "Slash" or "Thud")
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (isCrit) {
        // Critical: Metallic "Shwing" - High pitch Sawtooth sweeping down
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.25);
        
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

        osc.start(t);
        osc.stop(t + 0.25);
    } else {
        // Normal: Heavy "Thwack" - Triangle sweeping fast
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, t); 
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
        
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.1);

        osc.start(t);
        osc.stop(t + 0.1);
    }
  }

  // SFX: Error buzz (Distinct low drone)
  public playErrorSound() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx; // Capture for TS safety

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, ctx.currentTime); // Lower pitch
    osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.2); // Pitch bend down
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  // SFX: Player hurt
  public playPlayerHurtSound() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx; // Capture for TS safety

    // Noise-like using multiple oscillators
    for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.setValueAtTime(100 + Math.random() * 200, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    }
  }

  // SFX: Explosion for boss death
  public playExplosionSound() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx; // Capture for TS safety

    const bufferSize = ctx.sampleRate * 2; // 2 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    const gain = ctx.createGain();
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    filter.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);

    noise.start();
  }

  // SFX: Level Up / Wave Clear
  public playVictorySound() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx; // Capture for TS safety

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major Arpeggio
    
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        gain.gain.setValueAtTime(0.1, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.4);
        
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.4);
    });
  }

  // BGM: Simple ambient drone loop
  public startBGM() {
      // No-op
  }

  public stopBGM() {
    this.bgmOscillators.forEach(osc => {
        try { osc.stop(); } catch(e) {}
    });
    this.bgmOscillators = [];
  }
}

export const audioManager = new AudioManager();
