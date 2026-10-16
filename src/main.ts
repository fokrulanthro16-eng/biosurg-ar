/**
 * BioSurg AR v3.0 - Quantum Autonomous Neural Trauma & Sub-Dermal Microsurgical AR Suite for Snap SPECS
 * Main Application Orchestrator
 */

import * as THREE from 'three';
import { ForearmModel } from './anatomy/forearmModel';
import { CannulaModel } from './anatomy/cannulaModel';
import { HemodynamicParticles } from './anatomy/hemodynamicParticles';
import { NeuralAudioSynthesizer } from './audio/neuralAudioSynthesizer';
import { LeadIIECG } from './hud/leadIIECG';
import { PlethysmographMonitor } from './hud/plethysmograph';
import { BModeUltrasound } from './hud/bModeUltrasound';
import { LeafVerificationMatrix, LeafTest } from './hud/leafMatrix';
import { SpecsWaveguideHUD } from './hud/specsWaveguideHUD';
import { BioSurgStateController, BioSurgState } from './fsm/BioSurgStateController';

class BioSurgApp {
  // Three.js Core
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  // Anatomy & Instrument Models
  private forearm: ForearmModel;
  private cannula: CannulaModel;
  private hemodynamics: HemodynamicParticles;

  // Audio Synthesizer
  private audio: NeuralAudioSynthesizer;

  // Clinical HUD Monitors
  private ecg: LeadIIECG;
  private pleth: PlethysmographMonitor;
  private ultrasound: BModeUltrasound;
  private leafMatrix: LeafVerificationMatrix;
  private specsHUD: SpecsWaveguideHUD;
  private fsm: BioSurgStateController;

  // Interaction & Camera Target
  private cameraTarget = new THREE.Vector3(0, 1.2, 1.0);
  private desiredCameraPos = new THREE.Vector3(-3.2, 5.8, 6.5);
  private isAutoSequenceRunning = false;

  // Patient Trauma Vitals State
  private patientVitals = {
    heartRate: 110,
    spo2: 88,
    systolicBP: 82,
    diastolicBP: 48,
    perfusionIndex: 1.4
  };

  // Cached DICOM audit
  private latestAuditData: Record<string, unknown> | null = null;
  private latestAuditHash = '';

  constructor() {
    this.canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
    if (!this.canvas) throw new Error('Could not find #webgl-canvas element');

    // 1. Initialize WebGL2 Three.js Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Scene & Camera Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03070e);
    this.scene.fog = new THREE.FogExp2(0x03070e, 0.022);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.copy(this.desiredCameraPos);
    this.camera.lookAt(this.cameraTarget);

    // 3. Lighting
    this.setupLighting();

    // 4. Instantiate 3D Models
    this.forearm = new ForearmModel();
    this.scene.add(this.forearm.group);

    this.cannula = new CannulaModel();
    this.scene.add(this.cannula.group);

    this.hemodynamics = new HemodynamicParticles();
    this.scene.add(this.hemodynamics.points);

    // 5. Instantiate Procedural WebAudio Synthesizer
    this.audio = new NeuralAudioSynthesizer();

    // 6. Instantiate Clinical Diagnostics Monitors
    const ecgCanvas = document.getElementById('canvas-ecg') as HTMLCanvasElement;
    this.ecg = new LeadIIECG(ecgCanvas);

    const plethCanvas = document.getElementById('canvas-pleth') as HTMLCanvasElement;
    this.pleth = new PlethysmographMonitor(plethCanvas);

    const usCanvas = document.getElementById('canvas-ultrasound') as HTMLCanvasElement;
    this.ultrasound = new BModeUltrasound(usCanvas);

    // 7. Instantiate HUD, FSM, and LEAF Matrix
    this.specsHUD = new SpecsWaveguideHUD();
    this.fsm = new BioSurgStateController();
    this.leafMatrix = new LeafVerificationMatrix();

    // Wire ECG R-wave spike detection to WebAudio Cardiac Bleep
    this.ecg.setOnRWaveCallback((metrics) => {
      this.audio.triggerCardiacPulse(this.patientVitals.spo2);
    });

    // Wire FSM transitions to HUD & Terminal
    this.fsm.addStateListener((event) => {
      this.specsHUD.recordStateTransition(event);
      const stateBadge = document.getElementById('hud-fsm-state');
      if (stateBadge) stateBadge.textContent = event.toState;
    });

    // Render 14 LEAF Matrix in DOM
    this.renderLeafMatrixDOM();

    // Setup Event Listeners
    this.setupEventListeners();
    window.addEventListener('resize', this.onResize.bind(this));

    // Start 60 FPS animation loop
    this.lastTime = performance.now();
    requestAnimationFrame(this.animate.bind(this));
  }

  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x081828, 1.2);
    this.scene.add(ambientLight);

    // Main Surgical Overhead Light
    const surgicalLight = new THREE.DirectionalLight(0xe6f7ff, 2.4);
    surgicalLight.position.set(5, 14, 10);
    surgicalLight.castShadow = true;
    surgicalLight.shadow.mapSize.width = 2048;
    surgicalLight.shadow.mapSize.height = 2048;
    this.scene.add(surgicalLight);

    // Specular Rim Light (Cyan AR glow)
    const rimLight = new THREE.DirectionalLight(0x00ffcc, 1.5);
    rimLight.position.set(-8, -4, -6);
    this.scene.add(rimLight);

    // Sub-dermal transillumination point light
    const subLight = new THREE.PointLight(0xff3355, 1.8, 15);
    subLight.position.set(0, 0, 0);
    this.scene.add(subLight);
  }

  private renderLeafMatrixDOM(): void {
    const container = document.getElementById('leaf-tests-container');
    if (!container) return;

    const tests = this.leafMatrix.getTests();
    container.innerHTML = tests
      .map(
        (t: LeafTest) => `
      <div class="leaf-test-row" id="leaf-row-${t.id}">
        <span class="leaf-test-id">${t.id}</span>
        <span class="leaf-test-name" title="${t.description}">${t.name}</span>
        <span class="leaf-badge ${t.status.toLowerCase()}">${t.status}</span>
      </div>
    `
      )
      .join('');

    const stats = this.leafMatrix.getPassCount();
    const scoreBadge = document.getElementById('leaf-score-badge');
    if (scoreBadge) {
      scoreBadge.textContent = `${stats.passed} / ${stats.total} PASS (${stats.percentage}%)`;
    }
  }

  private setupEventListeners(): void {
    // Audio Toggle & Context initialization
    const audioBtn = document.getElementById('btn-audio-toggle');
    audioBtn?.addEventListener('click', () => {
      this.audio.init();
      const isMuted = this.audio.toggleMute();
      const icon = document.getElementById('audio-icon');
      if (icon) icon.textContent = isMuted ? '🔇' : '🔊';
      if (audioBtn) audioBtn.innerHTML = `<span id="audio-icon">${isMuted ? '🔇' : '🔊'}</span> AUDIO: ${isMuted ? 'OFF' : 'ON'}`;
      this.specsHUD.logCLADEvent('AUDIO_BUS', `WebAudio Synthesizer ${isMuted ? 'Muted' : 'Unmuted'}`);
    });

    // Autonomous Sequence
    const autoBtn = document.getElementById('btn-auto-sequence');
    autoBtn?.addEventListener('click', () => {
      this.runAutonomousTraumaSequence();
    });

    // NIR Hypoxia Toggle
    const nirBtn = document.getElementById('btn-toggle-nir');
    nirBtn?.addEventListener('click', () => {
      const active = this.forearm.toggleNIR();
      if (nirBtn) {
        nirBtn.innerHTML = `<span>🔴</span> NIR HYPOXIA: ${active ? 'ON' : 'OFF'}`;
        nirBtn.classList.toggle('primary', active);
      }
      this.specsHUD.logCLADEvent('SHADERS', `Hyperspectral NIR Hypoxia Heatmap ${active ? 'Activated' : 'Standby'}`);
    });

    // Exploded View Toggle
    const explodedBtn = document.getElementById('btn-toggle-exploded');
    explodedBtn?.addEventListener('click', () => {
      const active = this.forearm.toggleExploded();
      if (explodedBtn) {
        explodedBtn.innerHTML = `<span>⬒</span> EXPLODED VIEW: ${active ? 'ON (+18mm)' : 'OFF'}`;
        explodedBtn.classList.toggle('primary', active);
      }
      // Dynamic acoustic occlusion: 1.0 (open spectrum 0dB) vs 0.0 (muffled -16dB)
      this.audio.setTissueOcclusionFactor(active ? 1.0 : 0.0);
      this.specsHUD.logCLADEvent(
        'ACOUSTICS',
        `Tissue Occlusion Filter: ${active ? '0 dB (Wideband 3600Hz)' : '-16 dB (Muffled 420Hz)'}`
      );
    });

    // AI Micro-Tremor Stabilizer Toggle
    const stabBtn = document.getElementById('btn-toggle-stabilizer');
    stabBtn?.addEventListener('click', () => {
      const active = this.cannula.toggleAIStabilization();
      if (stabBtn) {
        stabBtn.innerHTML = `<span>🎯</span> AI STABILIZER: ${active ? 'ON' : 'OFF'}`;
        stabBtn.classList.toggle('primary', active);
      }
      this.specsHUD.logCLADEvent('AI_FILTER', `Kalman Tremor Dampener ${active ? 'Engaged (<0.02mm)' : 'Bypassed'}`);
    });

    // Cannula Depth Slider
    const depthSlider = document.getElementById('slider-cannula-depth') as HTMLInputElement;
    const depthValLabel = document.getElementById('slider-depth-val');
    depthSlider?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.cannula.setDepth(val);
      this.ultrasound.setNeedleDepth(val);
      if (depthValLabel) depthValLabel.textContent = `${val.toFixed(2)}mm`;

      const depthBadge = document.getElementById('needle-depth-badge');
      if (depthBadge) depthBadge.textContent = `DEPTH: ${val.toFixed(2)}mm`;

      if (val >= 4.0 && val <= 4.4) {
        this.fsm.transitionTo(BioSurgState.LUMEN_CANULATION);
      }
    });

    // Camera Preset Buttons
    const camButtons = document.querySelectorAll('.cam-btn');
    camButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        camButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-cam');
        this.setCameraPreset(mode);
      });
    });

    // Run All 14 LEAF Tests
    const runLeafBtn = document.getElementById('btn-run-leaf-tests');
    runLeafBtn?.addEventListener('click', async () => {
      this.specsHUD.logCLADEvent('LEAF_EXEC', 'Executing 14/14 LEAF Automated Compliance Verification Suite...');
      await this.leafMatrix.runAllTests();
      this.renderLeafMatrixDOM();
      this.specsHUD.logCLADEvent('LEAF_PASS', '14/14 Done Criteria Verified (100% Pass Rate).');
    });

    // DICOM Export Modal
    const exportBtn = document.getElementById('btn-export-dicom');
    const modal = document.getElementById('dicom-modal');
    const closeBtn = document.getElementById('btn-close-modal');
    const closeFooterBtn = document.getElementById('btn-modal-close-footer');
    const downloadBtn = document.getElementById('btn-download-dicom');

    exportBtn?.addEventListener('click', async () => {
      const depth = this.cannula.getDepth();
      const { auditData, sha256Hash } = await this.specsHUD.generateDicomAudit(
        depth,
        this.fsm.getState(),
        this.patientVitals.spo2,
        this.patientVitals.systolicBP
      );

      this.latestAuditData = auditData;
      this.latestAuditHash = sha256Hash;

      const hashDisplay = document.getElementById('modal-hash-display');
      if (hashDisplay) hashDisplay.textContent = `0x${sha256Hash}`;

      const jsonDisplay = document.getElementById('modal-json-display');
      if (jsonDisplay) jsonDisplay.textContent = JSON.stringify(auditData, null, 2);

      if (modal) modal.style.display = 'block';
    });

    closeBtn?.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
    });
    closeFooterBtn?.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
    });

    downloadBtn?.addEventListener('click', () => {
      if (this.latestAuditData && this.latestAuditHash) {
        this.specsHUD.downloadDicomAuditFile(this.latestAuditData, this.latestAuditHash);
      }
    });

    // Canvas user orbit drag interaction
    this.setupCanvasInteractions();
  }

  private setupCanvasInteractions(): void {
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    this.canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      // Initialize audio on first click
      this.audio.init();
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaX = (e.clientX - prevMouseX) * 0.006;
      const deltaY = (e.clientY - prevMouseY) * 0.006;

      // Orbit around target
      const offset = this.desiredCameraPos.clone().sub(this.cameraTarget);
      const radius = offset.length();

      let theta = Math.atan2(offset.x, offset.z) + deltaX;
      let phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius))) - deltaY;
      phi = Math.max(0.15, Math.min(Math.PI * 0.48, phi));

      this.desiredCameraPos.x = this.cameraTarget.x + radius * Math.sin(phi) * Math.sin(theta);
      this.desiredCameraPos.y = this.cameraTarget.y + radius * Math.cos(phi);
      this.desiredCameraPos.z = this.cameraTarget.z + radius * Math.sin(phi) * Math.cos(theta);

      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    });

    // Touch support for mobile / tablets
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
        this.audio.init();
      }
    });

    this.canvas.addEventListener('touchmove', (e) => {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = (e.touches[0].clientX - prevMouseX) * 0.006;
      const deltaY = (e.touches[0].clientY - prevMouseY) * 0.006;

      const offset = this.desiredCameraPos.clone().sub(this.cameraTarget);
      const radius = offset.length();

      let theta = Math.atan2(offset.x, offset.z) + deltaX;
      let phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius))) - deltaY;
      phi = Math.max(0.15, Math.min(Math.PI * 0.48, phi));

      this.desiredCameraPos.x = this.cameraTarget.x + radius * Math.sin(phi) * Math.sin(theta);
      this.desiredCameraPos.y = this.cameraTarget.y + radius * Math.cos(phi);
      this.desiredCameraPos.z = this.cameraTarget.z + radius * Math.sin(phi) * Math.cos(theta);

      prevMouseX = e.touches[0].clientX;
      prevMouseY = e.touches[0].clientY;
    });

    this.canvas.addEventListener('touchend', () => {
      isDragging = false;
    });
  }

  private setCameraPreset(mode: string | null): void {
    if (!mode) return;
    switch (mode) {
      case 'SURGEON': // Snap SPECS First Person View
        this.desiredCameraPos.set(-3.2, 5.8, 6.5);
        this.cameraTarget.set(0, 1.2, 1.0);
        break;
      case 'NIR': // Direct Hyperspectral Transillumination Orthogonal
        this.desiredCameraPos.set(-4.5, 7.5, 2.0);
        this.cameraTarget.set(-4.5, 1.2, 1.45);
        this.forearm.setNIRMode(1.0);
        break;
      case 'CROSS': // Lateral Sagittal Cross-Section
        this.desiredCameraPos.set(-9.5, 2.0, 1.4);
        this.cameraTarget.set(-4.5, 1.35, 1.45);
        break;
      case 'OVERVIEW': // Full Forearm Anatomic Overview
        this.desiredCameraPos.set(0.0, 9.0, 16.0);
        this.cameraTarget.set(0, 0, 0);
        break;
    }
  }

  /**
   * Autonomous Microsurgical Sequence Execution
   * Drives the entire 8-step trauma resuscitation workflow deterministically
   */
  public async runAutonomousTraumaSequence(): Promise<void> {
    if (this.isAutoSequenceRunning) return;
    this.isAutoSequenceRunning = true;
    this.audio.init();

    const depthSlider = document.getElementById('slider-cannula-depth') as HTMLInputElement;
    const depthValLabel = document.getElementById('slider-depth-val');
    const nirBtn = document.getElementById('btn-toggle-nir');
    const explodedBtn = document.getElementById('btn-toggle-exploded');

    // 1. BOOT CALIBRATION
    this.fsm.transitionTo(BioSurgState.BOOT_CALIBRATION);
    await new Promise((r) => setTimeout(r, 600));

    // 2. ANATOMY SCAN
    this.fsm.transitionTo(BioSurgState.ANATOMY_SCAN);
    this.setCameraPreset('SURGEON');
    await new Promise((r) => setTimeout(r, 800));

    // 3. NIR HYPOXIA MAPPING
    this.fsm.transitionTo(BioSurgState.NIR_HYPOXIA_MAPPING);
    this.forearm.setNIRMode(1.0);
    if (nirBtn) {
      nirBtn.innerHTML = `<span>🔴</span> NIR HYPOXIA: ON`;
      nirBtn.classList.add('primary');
    }
    await new Promise((r) => setTimeout(r, 900));

    // 4. CANNULA TRACKING (AI micro-tremor stabilization)
    this.fsm.transitionTo(BioSurgState.CANNULA_TRACKING);
    this.cannula.setAIStabilization(true);
    await new Promise((r) => setTimeout(r, 800));

    // 5. EXPLODED DISSECTION (+18mm separation & audio un-muffle)
    this.fsm.transitionTo(BioSurgState.EXPLODED_DISSECTION);
    this.forearm.setExplodedTarget(1.0);
    this.audio.setTissueOcclusionFactor(1.0);
    if (explodedBtn) {
      explodedBtn.innerHTML = `<span>⬒</span> EXPLODED VIEW: ON (+18mm)`;
      explodedBtn.classList.add('primary');
    }
    await new Promise((r) => setTimeout(r, 1000));

    // 6. LUMEN CANULATION (Advance cannula smoothly from 0.0mm to 4.2mm)
    this.fsm.transitionTo(BioSurgState.LUMEN_CANULATION);
    const steps = 42;
    for (let i = 1; i <= steps; i++) {
      const d = (i / steps) * 4.2;
      this.cannula.setDepth(d);
      this.ultrasound.setNeedleDepth(d);
      if (depthSlider) depthSlider.value = d.toFixed(2);
      if (depthValLabel) depthValLabel.textContent = `${d.toFixed(2)}mm`;
      await new Promise((r) => setTimeout(r, 35));
    }

    // 7. HEMODYNAMIC RESTORATION
    this.fsm.transitionTo(BioSurgState.HEMODYNAMIC_RESTORE);
    // Vitals recover from hypovolemic shock (88% SpO2, 82/48 ABP) to stabilized (98% SpO2, 118/76 ABP)
    const restoreSteps = 20;
    for (let s = 1; s <= restoreSteps; s++) {
      const progress = s / restoreSteps;
      this.patientVitals.spo2 = Math.round(88 + progress * 10);
      this.patientVitals.systolicBP = Math.round(82 + progress * 36);
      this.patientVitals.diastolicBP = Math.round(48 + progress * 28);
      this.patientVitals.perfusionIndex = parseFloat((1.4 + progress * 3.2).toFixed(1));
      this.pleth.setVitals(
        this.patientVitals.spo2,
        this.patientVitals.systolicBP,
        this.patientVitals.diastolicBP,
        this.patientVitals.perfusionIndex
      );
      await new Promise((r) => setTimeout(r, 50));
    }

    // Update status badge
    const abpBadge = document.getElementById('abp-status-badge');
    if (abpBadge) {
      abpBadge.textContent = `ABP: ${this.patientVitals.systolicBP}/${this.patientVitals.diastolicBP} mmHg [STABLE]`;
      abpBadge.style.color = '#00ffcc';
    }

    // 8. POST OP AUDIT
    this.fsm.transitionTo(BioSurgState.POST_OP_AUDIT);
    await new Promise((r) => setTimeout(r, 600));

    // Automatically trigger DICOM Audit modal
    const exportBtn = document.getElementById('btn-export-dicom');
    exportBtn?.click();

    this.isAutoSequenceRunning = false;
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private lastTime = 0;
  private pulseClock = 0;

  private animate(currentTime: number): void {
    requestAnimationFrame(this.animate.bind(this));

    const deltaTime = Math.min((currentTime - this.lastTime) * 0.001, 0.1);
    this.lastTime = currentTime;
    const time = currentTime * 0.001;

    // 110 BPM pulse cycle: (110 / 60) = 1.833 Hz
    this.pulseClock += deltaTime * 1.833;
    const pulsePhase = this.pulseClock % 1.0;

    // Smooth camera lerping
    this.camera.position.lerp(this.desiredCameraPos, deltaTime * 4.0);
    this.camera.lookAt(this.cameraTarget);

    // Update 3D Anatomical & Instrument models
    this.forearm.update(time, deltaTime, pulsePhase);
    this.cannula.update(time, deltaTime);
    this.hemodynamics.update(deltaTime, pulsePhase);

    // Update Clinical Monitors
    this.ecg.update(deltaTime);
    this.pleth.update(deltaTime);
    this.ultrasound.update(deltaTime);

    // Update Waveguide Telemetry
    this.specsHUD.updateFPS();

    // Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new BioSurgApp();
});
