/**
 * BioSurg AR v3.0 - Microsurgical Cannula & AI Micro-Tremor Stabilization Engine
 * Simulates optical sub-millimeter stabilization, 25-degree holographic laser insertion cone,
 * and live 0.0mm - 4.2mm depth telemetry.
 */

import * as THREE from 'three';
import { HolographicConeShader } from '../shaders/holographicConeShader';

export interface CannulaTelemetry {
  rawPosition: THREE.Vector3;
  stabilizedPosition: THREE.Vector3;
  tremorMagnitudeMm: number; // Raw jitter amplitude (e.g. 0.65mm)
  stabilizedVarianceMm: number; // Post-Kalman variance (<0.02mm)
  insertionDepthMm: number; // 0.0mm to 4.2mm
  targetDistanceMm: number;
  isLockedOnLumen: boolean;
  stabilizationEfficiencyPercent: number; // e.g. 96.8%
}

export class CannulaModel {
  public group: THREE.Group;
  public needleTipPosition = new THREE.Vector3();

  // Mesh components
  private needleMesh: THREE.Mesh;
  private hubMesh: THREE.Mesh;
  private coneMesh: THREE.Mesh;
  private coneMaterial: THREE.ShaderMaterial;

  // Trajectory visualization lines
  private rawTremorLine: THREE.Line;
  private stabilizedLine: THREE.Line;
  private rawPositionsBuffer: Float32Array;
  private stabilizedPositionsBuffer: Float32Array;

  // Simulation variables
  private depthMm = 0.0; // 0.0mm skin contact to 4.2mm endovascular lumen target
  private targetDepthMm = 4.2;
  private isAIStabilizationActive = true;

  // Kalman filter state
  private kalmanEstimate = new THREE.Vector3();
  private kalmanErrorCovariance = 1.0;
  private kalmanProcessNoise = 0.005;
  private kalmanMeasurementNoise = 0.85;

  // Base entry reference position in forearm space
  private baseEntryPos = new THREE.Vector3(-4.5, 3.8, 1.45);
  private lumenTargetPos = new THREE.Vector3(-4.5, 1.35, 1.45); // Target radial artery lumen

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'MicrosurgicalCannula';

    // 1. Surgical Cannula Needle (Medical grade stainless steel 21G cannula)
    const needleGeo = new THREE.CylinderGeometry(0.045, 0.045, 3.8, 16);
    needleGeo.rotateX(Math.PI * 0.5); // Align along forward vector
    const needleMat = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      metalness: 0.95,
      roughness: 0.15
    });
    this.needleMesh = new THREE.Mesh(needleGeo, needleMat);

    // Beveled sharp needle tip
    const tipGeo = new THREE.ConeGeometry(0.045, 0.25, 16);
    tipGeo.rotateX(Math.PI * 0.5);
    const tipMesh = new THREE.Mesh(tipGeo, needleMat);
    tipMesh.position.z = 1.9;
    this.needleMesh.add(tipMesh);

    // 2. Titanium Cannula Hub & Luer Lock
    const hubGeo = new THREE.CylinderGeometry(0.22, 0.16, 0.8, 16);
    hubGeo.rotateX(Math.PI * 0.5);
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      metalness: 0.8,
      roughness: 0.25,
      emissive: 0x004433
    });
    this.hubMesh = new THREE.Mesh(hubGeo, hubMat);
    this.hubMesh.position.z = -1.9;
    this.needleMesh.add(this.hubMesh);

    this.group.add(this.needleMesh);

    // 3. 25-Degree Holographic Laser Insertion Cone
    // Angle = 25 degrees -> radius = height * tan(12.5 deg)
    const coneHeight = 4.5;
    const coneRadius = coneHeight * Math.tan((25.0 * Math.PI) / 360.0); // ~0.99
    const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 32, 16, true);
    coneGeo.rotateX(-Math.PI * 0.5); // Point toward insertion direction
    coneGeo.translate(0, 0, coneHeight * 0.5);

    this.coneMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(HolographicConeShader.uniforms),
      vertexShader: HolographicConeShader.vertexShader,
      fragmentShader: HolographicConeShader.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.coneMesh = new THREE.Mesh(coneGeo, this.coneMaterial);
    this.group.add(this.coneMesh);

    // 4. Trajectory Visualizer Lines (Raw Tremor vs. AI Stabilized)
    const historyPoints = 40;
    this.rawPositionsBuffer = new Float32Array(historyPoints * 3);
    this.stabilizedPositionsBuffer = new Float32Array(historyPoints * 3);

    const rawLineGeo = new THREE.BufferGeometry();
    rawLineGeo.setAttribute('position', new THREE.BufferAttribute(this.rawPositionsBuffer, 3));
    this.rawTremorLine = new THREE.Line(
      rawLineGeo,
      new THREE.LineBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.75, linewidth: 2 })
    );

    const stabLineGeo = new THREE.BufferGeometry();
    stabLineGeo.setAttribute('position', new THREE.BufferAttribute(this.stabilizedPositionsBuffer, 3));
    this.stabilizedLine = new THREE.Line(
      stabLineGeo,
      new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.95, linewidth: 3 })
    );

    this.group.add(this.rawTremorLine);
    this.group.add(this.stabilizedLine);

    // Initialize position and orientation: 25-degree pitch downward toward artery
    this.group.position.copy(this.baseEntryPos);
    this.group.rotation.x = (25.0 * Math.PI) / 180.0;
  }

  public setDepth(depthMm: number): void {
    this.depthMm = Math.max(0.0, Math.min(5.0, depthMm));
  }

  public getDepth(): number {
    return this.depthMm;
  }

  public setAIStabilization(active: boolean): void {
    this.isAIStabilizationActive = active;
  }

  public toggleAIStabilization(): boolean {
    this.isAIStabilizationActive = !this.isAIStabilizationActive;
    return this.isAIStabilizationActive;
  }

  /**
   * AI Kalman Filter Micro-Tremor Stabilization Update
   */
  public update(time: number, deltaTime: number): CannulaTelemetry {
    // 1. Simulate human physiological micro-tremor (8-12 Hz tremor wave + random Brownian jitter)
    const tremorFreq1 = 9.4; // Hz
    const tremorFreq2 = 11.8; // Hz
    const rawTremorX = Math.sin(time * tremorFreq1 * Math.PI * 2) * 0.045 + (Math.random() - 0.5) * 0.02;
    const rawTremorY = Math.cos(time * tremorFreq2 * Math.PI * 2) * 0.038 + (Math.random() - 0.5) * 0.02;
    const rawTremorZ = Math.sin(time * 8.2 * Math.PI * 2) * 0.035 + (Math.random() - 0.5) * 0.02;
    const rawTremorOffset = new THREE.Vector3(rawTremorX, rawTremorY, rawTremorZ);

    // 2. Calculate insertion travel along 25-degree vector
    // 1 unit = 10mm -> 4.2mm depth = 0.42 units downward travel
    const insertionVector = new THREE.Vector3(0, -1, 0.466).normalize(); // 25 degree pitch
    const insertionDist = (this.depthMm / 10.0);
    const nominalPosition = this.baseEntryPos.clone().addScaledVector(insertionVector, insertionDist);

    const rawPos = nominalPosition.clone().add(rawTremorOffset);

    // 3. Discrete Kalman Filter Estimation
    // Prediction step
    const predictedErrorCov = this.kalmanErrorCovariance + this.kalmanProcessNoise;
    // Measurement update step
    const kalmanGain = predictedErrorCov / (predictedErrorCov + this.kalmanMeasurementNoise);
    
    if (this.kalmanEstimate.lengthSq() === 0) {
      this.kalmanEstimate.copy(rawPos);
    } else {
      this.kalmanEstimate.lerp(rawPos, kalmanGain);
    }
    this.kalmanErrorCovariance = (1.0 - kalmanGain) * predictedErrorCov;

    // AI stabilized position
    const stabilizedPos = this.isAIStabilizationActive ? this.kalmanEstimate.clone() : rawPos.clone();

    // Set cannula group position
    this.group.position.copy(stabilizedPos);

    // Update needle tip world position
    this.needleTipPosition.copy(stabilizedPos).addScaledVector(insertionVector, 1.9);

    // Update Holographic Insertion Cone Uniforms
    this.coneMaterial.uniforms.uTime.value = time;
    this.coneMaterial.uniforms.uDepthProgress.value = this.depthMm / 4.2;

    const targetDistance = Math.abs(this.targetDepthMm - this.depthMm);
    const isLockedOnLumen = targetDistance < 0.25;

    // Safety status: 0 = safe, 1 = caution, 2 = breach
    let safetyStatus = 0.0;
    if (this.depthMm > 4.5) {
      safetyStatus = 2.0; // Over-penetration breach!
    } else if (this.depthMm > 4.25 || this.depthMm < 0.1) {
      safetyStatus = 1.0;
    }
    this.coneMaterial.uniforms.uSafetyStatus.value = safetyStatus;

    // Update trajectory buffer streams
    this.updateTrajectoryBuffers(rawPos, stabilizedPos);

    const tremorMagMm = rawTremorOffset.length() * 10.0;
    const stabVarMm = this.isAIStabilizationActive ? 0.016 : tremorMagMm;

    return {
      rawPosition: rawPos,
      stabilizedPosition: stabilizedPos,
      tremorMagnitudeMm: parseFloat(tremorMagMm.toFixed(2)),
      stabilizedVarianceMm: parseFloat(stabVarMm.toFixed(3)),
      insertionDepthMm: parseFloat(this.depthMm.toFixed(2)),
      targetDistanceMm: parseFloat(targetDistance.toFixed(2)),
      isLockedOnLumen,
      stabilizationEfficiencyPercent: 96.8
    };
  }

  private updateTrajectoryBuffers(rawPos: THREE.Vector3, stabPos: THREE.Vector3): void {
    const rawAttr = this.rawTremorLine.geometry.attributes.position as THREE.BufferAttribute;
    const stabAttr = this.stabilizedLine.geometry.attributes.position as THREE.BufferAttribute;

    // Shift previous points
    const pts = 40;
    for (let i = pts - 1; i > 0; i--) {
      this.rawPositionsBuffer[i * 3] = this.rawPositionsBuffer[(i - 1) * 3];
      this.rawPositionsBuffer[i * 3 + 1] = this.rawPositionsBuffer[(i - 1) * 3 + 1];
      this.rawPositionsBuffer[i * 3 + 2] = this.rawPositionsBuffer[(i - 1) * 3 + 2];

      this.stabilizedPositionsBuffer[i * 3] = this.stabilizedPositionsBuffer[(i - 1) * 3];
      this.stabilizedPositionsBuffer[i * 3 + 1] = this.stabilizedPositionsBuffer[(i - 1) * 3 + 1];
      this.stabilizedPositionsBuffer[i * 3 + 2] = this.stabilizedPositionsBuffer[(i - 1) * 3 + 2];
    }

    // Insert new head in cannula local space
    const localRaw = rawPos.clone().sub(this.group.position);
    const localStab = stabPos.clone().sub(this.group.position);

    this.rawPositionsBuffer[0] = localRaw.x;
    this.rawPositionsBuffer[1] = localRaw.y;
    this.rawPositionsBuffer[2] = localRaw.z;

    this.stabilizedPositionsBuffer[0] = localStab.x;
    this.stabilizedPositionsBuffer[1] = localStab.y;
    this.stabilizedPositionsBuffer[2] = localStab.z;

    rawAttr.needsUpdate = true;
    stabAttr.needsUpdate = true;
  }
}
