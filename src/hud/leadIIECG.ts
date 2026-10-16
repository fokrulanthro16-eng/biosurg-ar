/**
 * BioSurg AR v3.0 - Clinical Lead-II ECG Waveform
 * Real-time 2D Canvas rendering of 110 BPM Tachycardia Trauma ECG with dynamic R-wave peak detection
 */

export interface ECGMetrics {
  heartRate: number; // 110 BPM
  prInterval: number; // ms
  qrsDuration: number; // ms
  qtInterval: number; // ms
  stElevation: number; // mV
  rWaveDetected: boolean;
}

export class LeadIIECG {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private history: number[] = [];
  private maxPoints = 320;
  private timeStep = 0;
  private bpm = 110;
  private onRWaveCallback: ((metrics: ECGMetrics) => void) | null = null;
  private lastRWaveTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get CanvasRenderingContext2D for ECG');
    this.ctx = context;

    // Prepopulate buffer with baseline
    for (let i = 0; i < this.maxPoints; i++) {
      this.history.push(0);
    }
  }

  public setOnRWaveCallback(cb: (metrics: ECGMetrics) => void): void {
    this.onRWaveCallback = cb;
  }

  public setBPM(bpm: number): void {
    this.bpm = bpm;
  }

  /**
   * Generates physiological Lead-II ECG waveform:
   * P wave, PR segment, Q drop, R tall spike, S dip, ST segment, T wave
   */
  private sampleECG(t: number): { value: number; isRWave: boolean } {
    // Cycle duration in seconds for given BPM
    const cycleDuration = 60 / this.bpm; // For 110 BPM ~ 0.545 sec
    const cyclePos = (t % cycleDuration) / cycleDuration; // 0.0 to 1.0

    let value = 0.0;
    let isRWave = false;

    if (cyclePos < 0.12) {
      // P wave (atrial depolarization)
      const pPhase = (cyclePos - 0.06) / 0.06;
      value = Math.exp(-Math.pow(pPhase * 3.5, 2)) * 0.18;
    } else if (cyclePos >= 0.12 && cyclePos < 0.18) {
      // PR segment (isoelectric baseline)
      value = 0.0;
    } else if (cyclePos >= 0.18 && cyclePos < 0.22) {
      // Q wave (septal depolarization dip)
      const qPhase = (cyclePos - 0.20) / 0.02;
      value = -Math.exp(-Math.pow(qPhase * 3.5, 2)) * 0.14;
    } else if (cyclePos >= 0.22 && cyclePos < 0.30) {
      // R wave (ventricular depolarization massive spike)
      const rPhase = (cyclePos - 0.25) / 0.035;
      value = Math.exp(-Math.pow(rPhase * 3.0, 2)) * 1.35;
      if (value > 1.0) {
        isRWave = true;
      }
    } else if (cyclePos >= 0.30 && cyclePos < 0.36) {
      // S wave (basal ventricular dip)
      const sPhase = (cyclePos - 0.33) / 0.03;
      value = -Math.exp(-Math.pow(sPhase * 3.5, 2)) * 0.32;
    } else if (cyclePos >= 0.36 && cyclePos < 0.44) {
      // ST segment (mild ischemic ST elevation in trauma shock +0.08mV)
      value = 0.08;
    } else if (cyclePos >= 0.44 && cyclePos < 0.68) {
      // T wave (ventricular repolarization)
      const tPhase = (cyclePos - 0.54) / 0.10;
      value = Math.exp(-Math.pow(tPhase * 3.0, 2)) * 0.35 + 0.04;
    } else {
      // Isoelectric TP baseline
      value = 0.0;
    }

    // Add mild physiological noise
    const noise = (Math.random() - 0.5) * 0.025;
    return { value: value + noise, isRWave };
  }

  public update(deltaTime: number): ECGMetrics {
    this.timeStep += deltaTime;
    const { value, isRWave } = this.sampleECG(this.timeStep);

    // Push into rolling history buffer
    this.history.push(value);
    if (this.history.length > this.maxPoints) {
      this.history.shift();
    }

    // Trigger R-wave callback with debouncing
    const now = performance.now();
    let justDetectedR = false;
    if (isRWave && (now - this.lastRWaveTime > 350)) {
      this.lastRWaveTime = now;
      justDetectedR = true;
      if (this.onRWaveCallback) {
        this.onRWaveCallback({
          heartRate: this.bpm,
          prInterval: 142,
          qrsDuration: 84,
          qtInterval: 338,
          stElevation: 0.12,
          rWaveDetected: true
        });
      }
    }

    this.render();

    return {
      heartRate: this.bpm,
      prInterval: 142,
      qrsDuration: 84,
      qtInterval: 338,
      stElevation: 0.12,
      rWaveDetected: justDetectedR
    };
  }

  public render(): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    // Clear background
    ctx.fillStyle = 'rgba(6, 14, 24, 0.92)';
    ctx.fillRect(0, 0, width, height);

    // Grid lines (ECG millimeter grid)
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.09)';
    const gridSize = 16;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Midline isoelectric baseline
    const midY = height * 0.58;
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.18)';
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // Draw ECG Lead-II waveform
    const stepX = width / (this.maxPoints - 1);
    const scaleY = height * 0.38;

    // Glowing bloom under-stroke
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.25)';
    ctx.beginPath();
    for (let i = 0; i < this.history.length; i++) {
      const x = i * stepX;
      const y = midY - this.history[i] * scaleY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Sharp foreground trace
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#00ffcc';
    ctx.beginPath();
    for (let i = 0; i < this.history.length; i++) {
      const x = i * stepX;
      const y = midY - this.history[i] * scaleY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Current cursor sweep head
    const headIndex = this.history.length - 1;
    const headX = headIndex * stepX;
    const headY = midY - this.history[headIndex] * scaleY;

    // Glowing sweep blip
    const gradient = ctx.createRadialGradient(headX, headY, 1, headX, headY, 7);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.4, '#00ffcc');
    gradient.addColorStop(1, 'rgba(0, 255, 204, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(headX, headY, 7, 0, Math.PI * 2);
    ctx.fill();

    // Telemetry text overlay
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText('LEAD-II ECG [TRAUMA RHYTHM]', 8, 14);

    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillStyle = this.bpm > 100 ? '#ffaa00' : '#00ffcc';
    ctx.fillText(`${this.bpm} BPM`, width - 68, 16);

    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(0, 255, 204, 0.7)';
    ctx.fillText('QRS: 84ms | ST-ELEV: +0.12mV | TACHYCARDIA', 8, height - 6);
  }
}
