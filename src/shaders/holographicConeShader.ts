/**
 * BioSurg AR v3.0 - Holographic Insertion Cone Shader
 * 25-Degree Optical Vector Guide with live millimeter depth rings and Fresnel rim glow
 */

export const HolographicConeShader = {
  uniforms: {
    uTime: { value: 0.0 },
    uDepthProgress: { value: 0.0 }, // 0.0 (skin contact) to 1.0 (4.2mm lumen target)
    uSafetyStatus: { value: 0.0 }, // 0.0 = Safe (cyan/green), 1.0 = Caution (amber), 2.0 = Breach (red)
    uConeColor: { value: null }
  },

  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying vec3 vViewPosition;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,

  fragmentShader: `
    precision highp float;

    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying vec3 vViewPosition;

    uniform float uTime;
    uniform float uDepthProgress;
    uniform float uSafetyStatus;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);

      // Fresnel rim glow for holographic AR presence
      float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 2.2);

      // Concentric depth calibration rings scanning down the 25-degree cone
      float scanRings = sin(vUv.y * 42.0 - uTime * 4.0);
      float rings = smoothstep(0.7, 0.95, scanRings) * 0.65;

      // Millimeter grid ticks along the insertion vector axis
      float ticks = step(0.92, fract(vUv.y * 12.0)) * 0.4;
      float longitudinalLines = step(0.93, fract(vUv.x * 16.0)) * 0.35;

      // Base Holographic Color Scheme
      // Normal: Cyber Cyan (#00ffcc)
      // Caution: Warning Amber (#ffaa00)
      // Breach: Trauma Red (#ff0044)
      vec3 safeColor = vec3(0.0, 1.0, 0.85);
      vec3 cautionColor = vec3(1.0, 0.72, 0.0);
      vec3 breachColor = vec3(1.0, 0.08, 0.25);

      vec3 baseConeColor = safeColor;
      if (uSafetyStatus > 1.5) {
        baseConeColor = breachColor;
      } else if (uSafetyStatus > 0.5) {
        baseConeColor = cautionColor;
      }

      // Live penetration wave travelling downward towards the vascular lumen
      float pulseWave = smoothstep(0.0, 0.1, abs(vUv.y - uDepthProgress)) * 0.5;
      pulseWave = (1.0 - pulseWave) * 1.5;

      // Combine wireframe, rings, Fresnel and pulsing insertion wave
      float totalAlpha = fresnel * 0.75 + rings + ticks + longitudinalLines + pulseWave * 0.5;
      totalAlpha = clamp(totalAlpha * 0.85, 0.05, 0.95);

      vec3 finalColor = baseConeColor + vec3(pulseWave * 0.4);

      gl_FragColor = vec4(finalColor, totalAlpha);
    }
  `
};
