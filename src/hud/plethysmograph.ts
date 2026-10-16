/**
 * BioSurg AR v3.0 - Hypovolemic Shock SpO2 Plethysmograph & ABP Monitor
 * Real-time 2D Canvas rendering of photoplethysmogram with dicrotic notch and arterial blood pressure telemetry
 */

export interface ShockTelemetry {
  spo2: number; // Percentage (e.g., 88% trauma -> 98% restored)
  systolicBP: number; // mmHg (e.g., 82)
  diastolicBP: number; // mmHg (e.g., 48)
  perfusionIndex: number; // % (e.g. 1.2% in shock -> 4.5% normal)
  shockIndex: number; // HR / SBP (110 / 82 = 1.34 severe trauma)
}

export class PlethysmographMonitor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private history: number[] = [];
  private maxPoints = 260;
  private timeStep = 0;
  private spo2 = 88;
  private systolic = 82;
  private diastolic = 48;
  private perfusionIndex = 1.4;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get CanvasRenderingContext2D for Plethysmograph');
    this.ctx = context;

    for (let i = 0; i < this.maxPoints; i++) {
      this.history.push(0);
    }
  }

  public setVitals(spo2: number, systolic: number, diastolic: number, pi: number): void {
    this.spo2 = spo2;
    this.systolic = systolic;
    this.diastolic = diastolic;
    this.perfusionIndex = pi;
  }

  /**
   * Generates photoplethysmogram with dicrotic notch:
   * Rapid systolic upstroke, crest, catacrotic limb, dicrotic notch, diastolic wave
   */
  private samplePPG(t: number): number {
    const cycleDuration = 60 / 110; // Synced with 110 BPM
    const phase = (t % cycleDuration) / cycleDuration;

    let ppg = 0;
    if (phase < 0.28) {
      // Rapid systolic rise
      const up = phase / 0.28;
      ppg = Math.sin(up * Math.PI * 0.5);
    } else if (phase >= 0.28 && phase < 0.44) {
      // Early systolic descent
      const descent = (phase - 0.28) / 0.16;
      ppg = 1.0 - descent * 0.42;
    } else if (phase >= 0.44 && phase < 0.54) {
      // Dicrotic notch reflection (aortic valve closure)
      const notch = (phase - 0.44) / 0.10;
      ppg = 0.58 + Math.sin(notch * Math.PI) * 0.12;
    } else {
      // Diastolic runoff decay
      const runoff = (phase - 0.54) / 0.46;
      ppg = 0.58 * Math.exp(-runoff * 3.2);
    }

    // Dampen amplitude if SpO2 / Perfusion is low (hypovolemia)
    const shockDampening = this.spo2 < 90 ? 0.72 : 1.0;
    const noise = (Math.random() - 0.5) * 0.02;
    return (ppg * shockDampening) + noise;
  }

  public update(deltaTime: number): ShockTelemetry {
    this.timeStep += deltaTime;
    const val = this.samplePPG(this.timeStep);
    this.history.push(val);
    if (this.history.length > this.maxPoints) {
      this.history.shift();
    }

    this.render();

    const shockIndex = parseFloat((110 / this.systolic).toFixed(2));
    return {
      spo2: this.spo2,
      systolicBP: this.systolic,
      diastolicBP: this.diastolic,
      perfusionIndex: this.perfusionIndex,
      shockIndex
    };
  }

  public render(): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    // Background
    ctx.fillStyle = 'rgba(6, 14, 24, 0.92)';
    ctx.fillRect(0, 0, width, height);

    // Subtle Grid
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = 'rgba(0, 170, 255, 0.08)';
    for (let x = 0; x < width; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Baseline
    const baseY = height * 0.82;
    const scaleY = height * 0.65;
    const stepX = width / (this.maxPoints - 1);

    // Waveform fill gradient
    const fillGrad = ctx.createLinearGradient(0, height * 0.2, 0, height);
    fillGrad.addColorStop(0, 'rgba(0, 180, 255, 0.35)');
    fillGrad.addColorStop(1, 'rgba(0, 180, 255, 0.0)');

    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let i = 0; i < this.history.length; i++) {
      const x = i * stepX;
      const y = baseY - this.history[i] * scaleY;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, baseY);
    ctx.closePath();
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Waveform stroke
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#00bbff';
    ctx.beginPath();
    for (let i = 0; i < this.history.length; i++) {
      const x = i * stepX;
      const y = baseY - this.history[i] * scaleY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Telemetry text overlay
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#00bbff';
    ctx.fillText('PLETHYSMOGRAPH / SpO2', 8, 14);

    // SpO2 percentage badge
    const spo2Color = this.spo2 < 90 ? '#ff0055' : (this.spo2 < 95 ? '#ffaa00' : '#00ffcc');
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillStyle = spo2Color;
    ctx.fillText(`${this.spo2}% SpO2`, width - 82, 16);

    // Arterial Blood Pressure & Shock Index
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(0, 200, 255, 0.85)';
    ctx.fillText(`ABP: ${this.systolic}/${this.diastolic} mmHg | PI: ${this.perfusionIndex}%`, 8, height - 6);
  }
}
