/**
 * BioSurg AR v3.0 - Live B-Mode Ultrasound Sector Radar
 * 60-Degree Sector Acoustic Scan rendering hypoechoic tissue, anechoic vessel lumen,
 * and hyper-reflective echogenic needle tip with acoustic reverberation.
 */

export interface UltrasoundTelemetry {
  needleDepthMm: number; // 0.0mm to 4.2mm
  targetOffsetMm: number;
  inLumen: boolean;
  gainDb: number;
  frequencyMhz: number;
}

export class BModeUltrasound {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sweepAngle = 0;
  private needleDepth = 0.0; // 0.0 mm to 4.2 mm
  private targetDepth = 4.2; // mm
  private sectorSpan = Math.PI / 3; // 60 degrees (±30 deg from center)
  private frequencyMhz = 12.0; // 12 MHz high-frequency vascular probe
  private gainDb = 54;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get CanvasRenderingContext2D for Ultrasound');
    this.ctx = context;
  }

  public setNeedleDepth(depthMm: number): void {
    this.needleDepth = Math.max(0.0, Math.min(5.0, depthMm));
  }

  public update(deltaTime: number): UltrasoundTelemetry {
    // Sector beam sweep oscillating back and forth at 18 Hz
    this.sweepAngle += deltaTime * 8.5;
    this.render();

    const inLumen = Math.abs(this.needleDepth - this.targetDepth) < 0.25;
    return {
      needleDepthMm: parseFloat(this.needleDepth.toFixed(2)),
      targetOffsetMm: parseFloat((this.targetDepth - this.needleDepth).toFixed(2)),
      inLumen,
      gainDb: this.gainDb,
      frequencyMhz: this.frequencyMhz
    };
  }

  public render(): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    // Fade buffer for phosphor persistence
    ctx.fillStyle = 'rgba(4, 10, 18, 0.22)';
    ctx.fillRect(0, 0, width, height);

    const apexX = width * 0.5;
    const apexY = 24;
    const maxRadius = height - 32;

    const startAngle = Math.PI * 0.5 - this.sectorSpan * 0.5;
    const endAngle = Math.PI * 0.5 + this.sectorSpan * 0.5;

    // Draw Sector Boundary & Arc Lines
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.25)';
    ctx.lineWidth = 1;

    // Radial edges
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(apexX + Math.cos(startAngle) * maxRadius, apexY + Math.sin(startAngle) * maxRadius);
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(apexX + Math.cos(endAngle) * maxRadius, apexY + Math.sin(endAngle) * maxRadius);
    ctx.stroke();

    // Concentric depth calibration rings (every 1.5 cm)
    for (let r = 0.25; r <= 1.0; r += 0.25) {
      const radius = maxRadius * r;
      ctx.beginPath();
      ctx.arc(apexX, apexY, radius, startAngle, endAngle);
      ctx.stroke();

      // Depth ticks (e.g. 1cm, 2cm, 3cm, 4cm)
      const tickDepth = (r * 5.0).toFixed(1);
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(0, 255, 204, 0.5)';
      ctx.fillText(`${tickDepth}cm`, apexX + Math.cos(endAngle) * radius + 4, apexY + Math.sin(endAngle) * radius);
    }

    // Clip to sector for acoustic speckle rendering
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.arc(apexX, apexY, maxRadius, startAngle, endAngle);
    ctx.closePath();
    ctx.clip();

    // 1. Hypoechoic tissue speckle (acoustic scatter)
    ctx.fillStyle = 'rgba(0, 255, 204, 0.04)';
    for (let i = 0; i < 40; i++) {
      const rx = apexX + (Math.random() - 0.5) * maxRadius * 1.1;
      const ry = apexY + Math.random() * maxRadius;
      ctx.fillRect(rx, ry, 1.5, 1.5);
    }

    // 2. Hyperechoic fascial boundaries (bright acoustic reflections at tissue interfaces)
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(apexX, apexY + maxRadius * 0.32, maxRadius * 0.45, 6, 0.05, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(apexX, apexY + maxRadius * 0.52, maxRadius * 0.52, 5, -0.04, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Anechoic vessel lumen (radial artery cross section - blood does not reflect ultrasound, appears dark void)
    const vesselCenterY = apexY + maxRadius * (this.targetDepth / 5.0);
    const vesselRadius = 24;

    ctx.fillStyle = '#02060b';
    ctx.beginPath();
    ctx.ellipse(apexX, vesselCenterY, vesselRadius * 1.25, vesselRadius, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hyperechoic vessel wall margin (bright acoustic rim)
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.7)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Dynamic blood flow micro-Doppler shimmer in lumen
    ctx.fillStyle = 'rgba(0, 170, 255, 0.22)';
    ctx.beginPath();
    ctx.arc(apexX + Math.sin(this.sweepAngle * 3.0) * 8, vesselCenterY, 8, 0, Math.PI * 2);
    ctx.fill();

    // 4. Echogenic needle tip advancement
    // needle tip progress from surface (apexY) to lumen (vesselCenterY)
    const needleProgress = this.needleDepth / 5.0;
    const needleTipY = apexY + maxRadius * needleProgress;
    const needleTipX = apexX - 18 + needleProgress * 18; // 25-degree angled entry toward vessel center

    // Needle shaft hyperechoic line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(apexX - 32, apexY);
    ctx.lineTo(needleTipX, needleTipY);
    ctx.stroke();

    // Bright acoustic comet-tail reverberation artifact behind needle tip
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(needleTipX, needleTipY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Reverberation streaks
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.35)';
    ctx.lineWidth = 1;
    for (let d = 4; d <= 20; d += 5) {
      ctx.beginPath();
      ctx.moveTo(needleTipX - 3, needleTipY + d);
      ctx.lineTo(needleTipX + 3, needleTipY + d);
      ctx.stroke();
    }

    // 5. Sweeping sector scanline beam
    const currentSweep = Math.sin(this.sweepAngle);
    const beamAngle = Math.PI * 0.5 + currentSweep * (this.sectorSpan * 0.5);
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(apexX + Math.cos(beamAngle) * maxRadius, apexY + Math.sin(beamAngle) * maxRadius);
    ctx.stroke();

    ctx.restore();

    // 6. Target acquisition lock reticle when needle reaches target
    if (Math.abs(this.needleDepth - this.targetDepth) < 0.25) {
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(needleTipX, needleTipY, 14, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#00ffcc';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText('LUMEN ACQUIRED', needleTipX + 16, needleTipY + 3);
    }

    // Ultrasound header HUD
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText('B-MODE ULTRASOUND [RADAR SECTOR]', 8, 14);

    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${this.needleDepth.toFixed(1)}mm / ${this.targetDepth.toFixed(1)}mm`, width - 96, 16);

    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(0, 255, 204, 0.75)';
    ctx.fillText(`${this.frequencyMhz}MHz L-PROBE | GN: ${this.gainDb}dB | RADIAL ARTERY`, 8, height - 6);
  }
}
