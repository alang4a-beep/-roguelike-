

// A simple synthesizer using Web Audio API to avoid external file dependencies
class AudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private bgmOscillators: OscillatorNode[] = [];
  private bgmGain: GainNode | null = null;
  private isBgmPlaying: boolean = false;

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
    if (this.bgmGain) {
      // Smooth fade
      const now = this.ctx?.currentTime || 0;
      this.bgmGain.gain.setTargetAtTime(mute ? 0 : 0.05, now, 0.5);
    }
  }

  public getMute() {
    return this.isMuted;
  }

  // SFX: Light blip for typing
  public playTypeSound() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // SFX: Sword Slash / Heavy Impact (Distinct from error)
  public playHitSound(isCrit: boolean) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Noise Burst (Impact Texture)
    // Create a short burst of noise for the "crunch" or "hit"
    const bufferSize = this.ctx.sampleRate * 0.1; // 0.1 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    // Filter the noise to make it less harsh (Lowpass)
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(isCrit ? 3000 : 1000, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(t);

    // 2. Tonal Swipe (The "Slash" or "Thud")
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

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

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime); // Lower pitch
    osc.frequency.linearRampToValueAtTime(80, this.ctx.currentTime + 0.2); // Pitch bend down
    
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  // SFX: Player hurt
  public playPlayerHurtSound() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    // Noise-like using multiple oscillators
    for (let i = 0; i < 3; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.frequency.setValueAtTime(100 + Math.random() * 200, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }
  }

  // SFX: Explosion for boss death
  public playExplosionSound() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    const gain = this.ctx.createGain();
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    filter.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 1);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1);

    noise.start();
  }

  // SFX: Level Up / Wave Clear
  public playVictorySound() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major Arpeggio
    
    notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        gain.gain.setValueAtTime(0.1, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.4);
        
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.4);
    });
  }

  // BGM: Simple ambient drone loop
  // Disabled per request, but keeping method sig compatible
  public startBGM() {
      // No-op
  }

  public stopBGM() {
    this.isBgmPlaying = false;
    this.bgmOscillators.forEach(osc => {
        try { osc.stop(); } catch(e) {}
    });
    this.bgmOscillators = [];
  }
}

export const audioManager = new AudioManager();