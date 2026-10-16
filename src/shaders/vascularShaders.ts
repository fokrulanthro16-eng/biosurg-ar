/**
 * BioSurg AR v3.0 - Vascular & Hemodynamic Pulse Shaders
 * Intricate 3D Vascular Arborization with 110 BPM Bioluminescent Hemodynamic Pulse
 */

export const VascularShader = {
  uniforms: {
    uTime: { value: 0.0 },
    uPulsePhase: { value: 0.0 }, // Synced to 110 BPM ECG R-wave
    uIsArtery: { value: 1.0 }, // 1.0 = Oxygenated Artery (Crimson/Scarlet), 0.0 = Deoxygenated Vein (Cobalt/Cyan)
    uExplodeOffset: { value: 0.0 },
    uPerfusionRate: { value: 1.0 }
  },

  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    varying vec3 vViewPosition;
    uniform float uExplodeOffset;
    uniform float uPulsePhase;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      
      // Dynamic systolic arterial dilation during 110 BPM tachycardia pulse
      float systolicDilation = sin(uPulsePhase * 3.14159) * 0.08;
      vec3 expandedPosition = position + normal * systolicDilation;

      // Vertical displacement for exploded view
      vec3 displacedPosition = expandedPosition + vec3(0.0, uExplodeOffset, 0.0);

      vec4 mvPosition = modelViewMatrix * vec4(displacedPosition, 1.0);
      vViewPosition = -mvPosition.xyz;
      vWorldPosition = (modelMatrix * vec4(displacedPosition, 1.0)).xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,

  fragmentShader: `
    precision highp float;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    varying vec3 vViewPosition;

    uniform float uTime;
    uniform float uPulsePhase;
    uniform float uIsArtery;
    uniform float uPerfusionRate;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);

      // Fresnel edge lighting for bioluminescent AR visualization
      float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 2.0);

      // Bioluminescent hemodynamic flow wave travelling downstream
      float flowSpeed = uTime * 4.5 * uPerfusionRate;
      float flowWave = sin(vUv.x * 35.0 - flowSpeed) * 0.5 + 0.5;

      // Systolic pulse surge
      float systolicSpike = pow(sin(uPulsePhase * 3.14159), 4.0) * 0.85;

      // Color palette
      // Arterial: Radiant Crimson with Gold-amber oxygenated core
      vec3 arterialDeep = vec3(0.78, 0.04, 0.12);
      vec3 arterialBioluminescent = vec3(1.0, 0.35, 0.15);
      vec3 arterialCore = mix(arterialDeep, arterialBioluminescent, flowWave + systolicSpike);

      // Venous: Deep Royal Blue with glowing Cyan oxygen-depleted lumen
      vec3 venousDeep = vec3(0.05, 0.18, 0.58);
      vec3 venousBioluminescent = vec3(0.0, 0.75, 0.95);
      vec3 venousCore = mix(venousDeep, venousBioluminescent, flowWave * 0.7);

      vec3 baseVesselColor = mix(venousCore, arterialCore, uIsArtery);

      // Rim glow for spatial AR clarity through tissue layers
      vec3 rimColor = mix(vec3(0.0, 0.8, 1.0), vec3(1.0, 0.5, 0.2), uIsArtery);
      vec3 finalColor = baseVesselColor + rimColor * (fresnel * 0.65 + systolicSpike * 0.4);

      gl_FragColor = vec4(finalColor, 0.92);
    }
  `
};
