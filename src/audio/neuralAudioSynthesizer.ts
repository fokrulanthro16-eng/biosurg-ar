/**
 * BioSurg AR v3.0 - WebAudio Doppler & Neural Audio Synthesizer
 * 100% Procedural synthesis: ICU Cardiac Monitor Bleep, Pulsed-Wave Doppler Ultrasound,
 * and Dynamic Acoustic Tissue Occlusion Biquad Filter.
 */

export class NeuralAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private isInitialized = false;
  private isMuted = false;
  private masterGain: GainNode | null = null;

  // Cardiac Bleep Nodes
  private cardiacGain: GainNode | null = null;

  // Doppler Ultrasound Nodes
  private dopplerGain: GainNode | null = null;
  private dopplerOcclusionFilter: BiquadFilterNode | null = null;
  private dopplerSource: AudioBufferSourceNode | null = null;
  private dopplerLFO: OscillatorNode | null = null;
  private dopplerLFOGain: GainNode | null = null;
  private dopplerResonantFilter: BiquadFilterNode | null = null;

  // Tissue Occlusion State: 0.0 (intact skin, -16 dB muffled) to 1.0 (exploded/cross-section, 0 dB clear)
  private currentOcclusion = 0.0;

  constructor() {
    // Initialized on first user interaction or trigger
  }

  public init(): boolean {
    if (this.isInitialized) return true;

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // --- CARDIAC MONITOR SETUP ---
      this.cardiacGain = this.ctx.createGain();
      this.cardiacGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      this.cardiacGain.connect(this.masterGain);

      // --- PULSED-WAVE DOPPLER ULTRASOUND SETUP ---
      this.setupDopplerEngine();

      this.isInitialized = true;
      return true;
    } catch (err) {
      console.warn('WebAudio failed to initialize:', err);
      return false;
    }
  }

  private setupDopplerEngine(): void {
    if (!this.ctx || !this.masterGain) return;

    // 1. Generate 3-second procedural pink/turbulent noise buffer
    const bufferSize = this.ctx.sampleRate * 3;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Paul Kellet's filtered pink noise algorithm
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    // 2. Continuous looping noise source
    this.dopplerSource = this.ctx.createBufferSource();
    this.dopplerSource.buffer = noiseBuffer;
    this.dopplerSource.loop = true;

    // 3. Resonant Bandpass Filter mimicking blood flow RBC scattering
    this.dopplerResonantFilter = this.ctx.createBiquadFilter();
    this.dopplerResonantFilter.type = 'bandpass';
    this.dopplerResonantFilter.frequency.setValueAtTime(850, this.ctx.currentTime);
    this.dopplerResonantFilter.Q.setValueAtTime(3.8, this.ctx.currentTime);

    // 4. LFO for 110 BPM tachycardia systolic turbulence modulation (110 / 60 = 1.833 Hz)
    this.dopplerLFO = this.ctx.createOscillator();
    this.dopplerLFO.type = 'sawtooth';
    this.dopplerLFO.frequency.setValueAtTime(1.833, this.ctx.currentTime);

    this.dopplerLFOGain = this.ctx.createGain();
    this.dopplerLFOGain.gain.setValueAtTime(450, this.ctx.currentTime);

    // LFO frequency modulates resonant filter center frequency
    this.dopplerLFO.connect(this.dopplerLFOGain);
    this.dopplerLFOGain.connect(this.dopplerResonantFilter.frequency);

    // 5. Dynamic Acoustic Tissue Occlusion Filter (Biquad Lowpass)
    // -16 dB muffled at 420 Hz (intact skin) to 0 dB full spectrum at 3600 Hz (exploded view)
    this.dopplerOcclusionFilter = this.ctx.createBiquadFilter();
    this.dopplerOcclusionFilter.type = 'lowpass';
    this.dopplerOcclusionFilter.frequency.setValueAtTime(420, this.ctx.currentTime); // Intact tissue state
    this.dopplerOcclusionFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

    // 6. Doppler Gain
    this.dopplerGain = this.ctx.createGain();
    this.dopplerGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

    // Connect Doppler chain
    this.dopplerSource.connect(this.dopplerResonantFilter);
    this.dopplerResonantFilter.connect(this.dopplerOcclusionFilter);
    this.dopplerOcclusionFilter.connect(this.dopplerGain);
    this.dopplerGain.connect(this.masterGain);

    this.dopplerSource.start(0);
    this.dopplerLFO.start(0);
  }

  /**
   * Procedural ICU Cardiac Monitor Pulse Bleep
   * Triggered synchronously when the visual Lead-II ECG registers an R-wave spike
   */
  public triggerCardiacPulse(spo2 = 92): void {
    if (!this.ctx || !this.cardiacGain || this.isMuted) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    
    // Pitch pitch-shifts slightly based on SpO2 (standard medical monitor acoustic telemetry)
    // 98% SpO2 = 980 Hz, 85% SpO2 = 720 Hz
    const baseFreq = 650 + (spo2 / 100) * 350;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const pulseEnv = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(baseFreq, now);

    // Second harmonic for authentic clinical piezo chime
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(baseFreq * 2.0, now);

    pulseEnv.gain.setValueAtTime(0.0001, now);
    pulseEnv.gain.linearRampToValueAtTime(0.28, now + 0.012);
    pulseEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc1.connect(pulseEnv);
    osc2.connect(pulseEnv);
    pulseEnv.connect(this.cardiacGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.15);
    osc2.stop(now + 0.15);
  }

  /**
   * Dynamic Acoustic Tissue Occlusion
   * @param factor 0.0 (Skin intact: -16 dB cutoff ~420 Hz) to 1.0 (Skin exploded: 0 dB cutoff ~3600 Hz)
   */
  public setTissueOcclusionFactor(factor: number): void {
    this.currentOcclusion = Math.max(0.0, Math.min(1.0, factor));
    if (!this.ctx || !this.dopplerOcclusionFilter) return;

    const now = this.ctx.currentTime;
    // Map factor smoothly: 0.0 -> 420 Hz (-16dB muffled), 1.0 -> 3600 Hz (0dB open spectrum)
    const targetFreq = 420 + Math.pow(this.currentOcclusion, 1.8) * 3180;
    this.dopplerOcclusionFilter.frequency.setTargetAtTime(targetFreq, now, 0.08);

    // Boost Doppler volume slightly when layers are open
    if (this.dopplerGain) {
      const targetGain = 0.28 + this.currentOcclusion * 0.32;
      this.dopplerGain.gain.setTargetAtTime(targetGain, now, 0.08);
    }
  }

  public getTissueOcclusionFactor(): number {
    return this.currentOcclusion;
  }

  public setMute(mute: boolean): void {
    this.isMuted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0.0 : 0.75, this.ctx.currentTime, 0.05);
    }
  }

  public toggleMute(): boolean {
    this.setMute(!this.isMuted);
    return this.isMuted;
  }

  public resumeAudio(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
}
