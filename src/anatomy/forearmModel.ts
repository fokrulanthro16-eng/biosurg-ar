/**
 * BioSurg AR v3.0 - Forearm Anatomical Model & Dynamic Quad-Layer Exploded Architecture
 * Epidermis (SSS/NIR), Subcutaneous Fascia, Radial & Ulnar Arterial Tree, Skeletal Radius & Ulna
 */

import * as THREE from 'three';
import { ForearmSSSShader } from '../shaders/forearmShaders';
import { VascularShader } from '../shaders/vascularShaders';

export class ForearmModel {
  public group: THREE.Group;

  // Layer groups for independent exploded-view kinematics
  public epidermisLayer: THREE.Group;
  public fasciaLayer: THREE.Group;
  public vascularLayer: THREE.Group;
  public skeletalLayer: THREE.Group;

  // Shaders & materials
  private skinMaterial: THREE.ShaderMaterial;
  private arteryMaterial: THREE.ShaderMaterial;
  private veinMaterial: THREE.ShaderMaterial;
  private boneMaterial: THREE.MeshStandardMaterial;
  private fasciaMaterial: THREE.MeshStandardMaterial;

  // Exploded View kinematics state
  private explodedProgress = 0.0; // 0.0 = Fused anatomic state, 1.0 = Fully exploded (+18mm)
  private targetExplodedProgress = 0.0;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'ForearmAnatomy';

    this.epidermisLayer = new THREE.Group();
    this.epidermisLayer.name = 'Layer_Epidermis';

    this.fasciaLayer = new THREE.Group();
    this.fasciaLayer.name = 'Layer_Fascia';

    this.vascularLayer = new THREE.Group();
    this.vascularLayer.name = 'Layer_Vascular';

    this.skeletalLayer = new THREE.Group();
    this.skeletalLayer.name = 'Layer_Skeletal';

    this.group.add(this.skeletalLayer);
    this.group.add(this.vascularLayer);
    this.group.add(this.fasciaLayer);
    this.group.add(this.epidermisLayer);

    // Initialize custom materials
    this.skinMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(ForearmSSSShader.uniforms),
      vertexShader: ForearmSSSShader.vertexShader,
      fragmentShader: ForearmSSSShader.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide
    });
    this.skinMaterial.uniforms.uLightPosition.value = new THREE.Vector3(5, 12, 10);

    this.arteryMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(VascularShader.uniforms),
      vertexShader: VascularShader.vertexShader,
      fragmentShader: VascularShader.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide
    });
    this.arteryMaterial.uniforms.uIsArtery.value = 1.0;

    this.veinMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(VascularShader.uniforms),
      vertexShader: VascularShader.vertexShader,
      fragmentShader: VascularShader.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide
    });
    this.veinMaterial.uniforms.uIsArtery.value = 0.0;

    this.boneMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8e2d4,
      roughness: 0.42,
      metalness: 0.1,
      bumpScale: 0.05
    });

    this.fasciaMaterial = new THREE.MeshStandardMaterial({
      color: 0xffeedd,
      roughness: 0.6,
      metalness: 0.05,
      transparent: true,
      opacity: 0.45,
      wireframe: false
    });

    this.buildAnatomy();
  }

  private buildAnatomy(): void {
    // 1. Epidermis (Outer Dermal Envelope)
    const armLength = 26.0; // cm
    const elbowRadius = 4.2;
    const wristRadius = 2.8;

    const armGeo = new THREE.CylinderGeometry(wristRadius, elbowRadius, armLength, 48, 32, true);
    // Rotate arm along X-axis to lie horizontally like a patient's supinated forearm
    armGeo.rotateZ(Math.PI * 0.5);
    const skinMesh = new THREE.Mesh(armGeo, this.skinMaterial);
    skinMesh.castShadow = true;
    skinMesh.receiveShadow = true;
    this.epidermisLayer.add(skinMesh);

    // 2. Subcutaneous Fascia & Adipose layer
    const fasciaGeo = new THREE.CylinderGeometry(wristRadius * 0.94, elbowRadius * 0.94, armLength * 0.98, 36, 24, true);
    fasciaGeo.rotateZ(Math.PI * 0.5);
    const fasciaMesh = new THREE.Mesh(fasciaGeo, this.fasciaMaterial);
    this.fasciaLayer.add(fasciaMesh);

    // 3. Skeletal Structures: Radius & Ulna
    this.buildBones(armLength);

    // 4. Vascular Tree: Radial Artery, Ulnar Artery, Interosseous, Cephalic & Basilic Veins
    this.buildVessels(armLength);
  }

  private buildBones(armLength: number): void {
    // Radius Bone (lateral forearm bone, expands at wrist)
    const radiusCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-armLength * 0.48, 0.4, 1.2),
      new THREE.Vector3(-armLength * 0.25, 0.2, 1.3),
      new THREE.Vector3(0.0, 0.0, 1.25),
      new THREE.Vector3(armLength * 0.25, -0.2, 1.4),
      new THREE.Vector3(armLength * 0.48, -0.3, 1.6)
    ]);
    const radiusGeo = new THREE.TubeGeometry(radiusCurve, 32, 0.68, 16, false);
    const radiusMesh = new THREE.Mesh(radiusGeo, this.boneMaterial);
    radiusMesh.castShadow = true;
    this.skeletalLayer.add(radiusMesh);

    // Ulna Bone (medial forearm bone, prominent olecranon at elbow)
    const ulnaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-armLength * 0.48, -0.3, -1.4),
      new THREE.Vector3(-armLength * 0.25, -0.1, -1.3),
      new THREE.Vector3(0.0, 0.0, -1.2),
      new THREE.Vector3(armLength * 0.25, 0.1, -1.1),
      new THREE.Vector3(armLength * 0.48, 0.4, -0.9)
    ]);
    const ulnaGeo = new THREE.TubeGeometry(ulnaCurve, 32, 0.75, 16, false);
    const ulnaMesh = new THREE.Mesh(ulnaGeo, this.boneMaterial);
    ulnaMesh.castShadow = true;
    this.skeletalLayer.add(ulnaMesh);
  }

  private buildVessels(armLength: number): void {
    // 1. Radial Artery (Primary microsurgical target along lateral wrist border)
    const radialCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-armLength * 0.46, 1.35, 1.45),
      new THREE.Vector3(-armLength * 0.22, 1.25, 1.35),
      new THREE.Vector3(0.0, 1.15, 1.2),
      new THREE.Vector3(armLength * 0.22, 1.05, 0.95),
      new THREE.Vector3(armLength * 0.45, 0.95, 0.7)
    ]);
    const radialGeo = new THREE.TubeGeometry(radialCurve, 40, 0.22, 16, false);
    const radialMesh = new THREE.Mesh(radialGeo, this.arteryMaterial);
    radialMesh.name = 'RadialArtery';
    this.vascularLayer.add(radialMesh);

    // 2. Ulnar Artery (Medial companion artery)
    const ulnarCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-armLength * 0.46, 1.2, -1.3),
      new THREE.Vector3(-armLength * 0.22, 1.05, -1.1),
      new THREE.Vector3(0.0, 0.95, -0.9),
      new THREE.Vector3(armLength * 0.22, 0.85, -0.75),
      new THREE.Vector3(armLength * 0.45, 0.75, -0.6)
    ]);
    const ulnarGeo = new THREE.TubeGeometry(ulnarCurve, 40, 0.20, 16, false);
    const ulnarMesh = new THREE.Mesh(ulnarGeo, this.arteryMaterial);
    ulnarMesh.name = 'UlnarArtery';
    this.vascularLayer.add(ulnarMesh);

    // 3. Deep Palmar Arch & Perforating Arterioles (Branching network)
    const branch1Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-armLength * 0.35, 1.3, 1.4),
      new THREE.Vector3(-armLength * 0.32, 1.45, 0.8),
      new THREE.Vector3(-armLength * 0.30, 1.5, 0.2),
      new THREE.Vector3(-armLength * 0.28, 1.2, -0.5)
    ]);
    const branch1Geo = new THREE.TubeGeometry(branch1Curve, 24, 0.12, 12, false);
    const branch1Mesh = new THREE.Mesh(branch1Geo, this.arteryMaterial);
    this.vascularLayer.add(branch1Mesh);

    const branch2Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-armLength * 0.1, 1.15, 1.2),
      new THREE.Vector3(-armLength * 0.05, 1.35, 0.6),
      new THREE.Vector3(0.02, 1.2, -0.2)
    ]);
    const branch2Geo = new THREE.TubeGeometry(branch2Curve, 20, 0.09, 12, false);
    const branch2Mesh = new THREE.Mesh(branch2Geo, this.arteryMaterial);
    this.vascularLayer.add(branch2Mesh);

    // 4. Superficial Veins: Cephalic & Basilic Vein
    const cephalicCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-armLength * 0.46, 2.1, 0.8),
      new THREE.Vector3(-armLength * 0.2, 2.3, 1.1),
      new THREE.Vector3(0.05, 2.4, 1.3),
      new THREE.Vector3(armLength * 0.3, 2.5, 1.5),
      new THREE.Vector3(armLength * 0.46, 2.6, 1.7)
    ]);
    const cephalicGeo = new THREE.TubeGeometry(cephalicCurve, 36, 0.24, 14, false);
    const cephalicMesh = new THREE.Mesh(cephalicGeo, this.veinMaterial);
    this.vascularLayer.add(cephalicMesh);
  }

  /**
   * Exploded-view vertical kinematics separation:
   * Epidermis: +18.0 mm
   * Subcutaneous Fascia: +9.0 mm
   * Vascular: 0.0 mm
   * Skeletal: -9.0 mm
   */
  public setExplodedTarget(target: number): void {
    this.targetExplodedProgress = Math.max(0.0, Math.min(1.0, target));
  }

  public toggleExploded(): boolean {
    this.setExplodedTarget(this.targetExplodedProgress > 0.5 ? 0.0 : 1.0);
    return this.targetExplodedProgress > 0.5;
  }

  public setNIRMode(factor: number): void {
    const val = Math.max(0.0, Math.min(1.0, factor));
    this.skinMaterial.uniforms.uNIRMode.value = val;
  }

  public getNIRMode(): number {
    return this.skinMaterial.uniforms.uNIRMode.value;
  }

  public toggleNIR(): boolean {
    const isNIR = this.skinMaterial.uniforms.uNIRMode.value > 0.5;
    this.setNIRMode(isNIR ? 0.0 : 1.0);
    return !isNIR;
  }

  public update(time: number, deltaTime: number, pulsePhase: number): void {
    // Smooth kinematic spring lerping for exploded view
    this.explodedProgress += (this.targetExplodedProgress - this.explodedProgress) * (deltaTime * 5.0);

    // Displace layers in world space (units scaled: 1.0 unit = 10 mm)
    // +18mm = +1.8 units
    const maxDisplacement = 1.8;
    const currentDisplacement = this.explodedProgress * maxDisplacement;

    this.epidermisLayer.position.y = currentDisplacement;
    this.fasciaLayer.position.y = currentDisplacement * 0.5; // +9mm
    this.vascularLayer.position.y = 0.0; // Reference 0mm
    this.skeletalLayer.position.y = -currentDisplacement * 0.5; // -9mm

    // Update uniform times and pulse phases
    this.skinMaterial.uniforms.uTime.value = time;
    this.skinMaterial.uniforms.uPulseWave.value = pulsePhase;
    this.skinMaterial.uniforms.uExplodeOffset.value = currentDisplacement;

    this.arteryMaterial.uniforms.uTime.value = time;
    this.arteryMaterial.uniforms.uPulsePhase.value = pulsePhase;
    this.arteryMaterial.uniforms.uExplodeOffset.value = 0.0;

    this.veinMaterial.uniforms.uTime.value = time;
    this.veinMaterial.uniforms.uPulsePhase.value = pulsePhase;
    this.veinMaterial.uniforms.uExplodeOffset.value = 0.0;
  }

  public getExplodedProgress(): number {
    return this.explodedProgress;
  }
}
