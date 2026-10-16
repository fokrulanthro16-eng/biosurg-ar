/**
 * BioSurg AR v3.0 - Bioluminescent Hemodynamic GPU Particle System
 * Simulates micro-perfusion & red blood cell flow along vascular spline trajectories,
 * surging with 110 BPM systolic cardiac ejection.
 */

import * as THREE from 'three';

export class HemodynamicParticles {
  public points: THREE.Points;
  private particleCount = 1200;
  private positions: Float32Array;
  private progress: Float32Array;
  private speeds: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;

  // Vascular flow spline (Radial Artery trajectory)
  private pathCurve: THREE.CatmullRomCurve3;

  constructor() {
    const armLength = 26.0;
    this.pathCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-armLength * 0.46, 1.35, 1.45),
      new THREE.Vector3(-armLength * 0.22, 1.25, 1.35),
      new THREE.Vector3(0.0, 1.15, 1.2),
      new THREE.Vector3(armLength * 0.22, 1.05, 0.95),
      new THREE.Vector3(armLength * 0.45, 0.95, 0.7)
    ]);

    this.positions = new Float32Array(this.particleCount * 3);
    this.progress = new Float32Array(this.particleCount);
    this.speeds = new Float32Array(this.particleCount);
    this.colors = new Float32Array(this.particleCount * 3);
    this.sizes = new Float32Array(this.particleCount);

    const geo = new THREE.BufferGeometry();

    for (let i = 0; i < this.particleCount; i++) {
      this.progress[i] = Math.random();
      this.speeds[i] = 0.08 + Math.random() * 0.12;

      // Initial position on spline + micro radial displacement
      const pt = this.pathCurve.getPoint(this.progress[i]);
      const radialOffset = (Math.random() - 0.5) * 0.18;
      this.positions[i * 3] = pt.x;
      this.positions[i * 3 + 1] = pt.y + radialOffset;
      this.positions[i * 3 + 2] = pt.z + radialOffset;

      // Bioluminescent gold-amber / glowing crimson RBC color
      const isOxygenated = Math.random() > 0.3;
      if (isOxygenated) {
        this.colors[i * 3] = 1.0; // R
        this.colors[i * 3 + 1] = 0.4 + Math.random() * 0.4; // G
        this.colors[i * 3 + 2] = 0.1; // B
      } else {
        this.colors[i * 3] = 0.1;
        this.colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
        this.colors[i * 3 + 2] = 1.0;
      }

      this.sizes[i] = 2.5 + Math.random() * 3.5;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    // Particle Material with additive glow blending
    const mat = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(geo, mat);
    this.points.name = 'HemodynamicParticles';
  }

  public update(deltaTime: number, pulsePhase: number): void {
    const posAttr = this.points.geometry.attributes.position as THREE.BufferAttribute;

    // Systolic velocity surge at 110 BPM R-wave
    const systolicSurge = 1.0 + Math.pow(Math.sin(pulsePhase * Math.PI), 4.0) * 2.8;

    for (let i = 0; i < this.particleCount; i++) {
      this.progress[i] += this.speeds[i] * deltaTime * systolicSurge;
      if (this.progress[i] > 1.0) {
        this.progress[i] -= 1.0;
      }

      const pt = this.pathCurve.getPoint(this.progress[i]);
      // Small jitter turbulence
      const turb = Math.sin(this.progress[i] * 40.0) * 0.04;

      this.positions[i * 3] = pt.x;
      this.positions[i * 3 + 1] = pt.y + turb;
      this.positions[i * 3 + 2] = pt.z + turb;
    }

    posAttr.needsUpdate = true;
  }
}
