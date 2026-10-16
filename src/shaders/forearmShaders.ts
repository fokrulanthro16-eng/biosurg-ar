/**
 * BioSurg AR v3.0 - Forearm Anatomy Shaders
 * Hyperspectral Near-Infrared (NIR) & Sub-Surface Scattering (SSS) GLSL Shaders
 */

export const ForearmSSSShader = {
  uniforms: {
    uTime: { value: 0.0 },
    uNIRMode: { value: 0.0 }, // 0.0 = Standard Dermal SSS, 1.0 = Hyperspectral NIR Hypoxia Heatmap
    uHypoxiaIntensity: { value: 0.85 }, // Ischemia intensity
    uPulseWave: { value: 0.0 }, // Synced to 110 BPM systolic pulse
    uSubsurfaceColor: { value: null }, // Skin subdermal capillary red
    uBaseSkinColor: { value: null },
    uTranslucency: { value: 0.65 },
    uLightPosition: { value: null },
    uExplodeOffset: { value: 0.0 }
  },

  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    varying vec3 vViewPosition;
    uniform float uExplodeOffset;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      
      // Exploded-view vertical translation
      vec3 displacedPosition = position + vec3(0.0, uExplodeOffset, 0.0);
      vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
      vWorldPosition = worldPosition.xyz;
      
      vec4 mvPosition = modelViewMatrix * vec4(displacedPosition, 1.0);
      vViewPosition = -mvPosition.xyz;
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
    uniform float uNIRMode;
    uniform float uHypoxiaIntensity;
    uniform float uPulseWave;
    uniform float uTranslucency;
    uniform vec3 uLightPosition;

    // Simplex noise helper
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1  = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      vec3 lightDir = normalize(uLightPosition - vWorldPosition);

      // --- STANDARD SUB-SURFACE SCATTERING (SSS) ---
      float NdotL = max(dot(normal, lightDir), 0.0);
      
      // Backward light bleed through translucent dermal thickness
      float backScatter = max(0.0, dot(-lightDir, viewDir)) * uTranslucency;
      float curvatureScatter = pow(1.0 - abs(dot(normal, viewDir)), 2.8) * 0.45;
      
      // Base skin tone with capillary blood blush
      vec3 epidermisTone = vec3(0.92, 0.74, 0.65);
      vec3 capillaryGlow = vec3(0.95, 0.22, 0.18) * (1.0 + 0.2 * uPulseWave);
      
      vec3 sssSkinColor = mix(epidermisTone * (NdotL * 0.7 + 0.3), capillaryGlow, (backScatter + curvatureScatter) * 0.6);

      // --- HYPERSPECTRAL NEAR-INFRARED (NIR) HYPOXIA HEATMAP ---
      // Distal ischemia zone centered near radial puncture site (uv.x around 0.5 - 0.7, uv.y around 0.4 - 0.6)
      vec2 ischemiaCenter = vec2(0.58, 0.48);
      float dist = length((vUv - ischemiaCenter) * vec2(1.8, 1.0));
      
      // Multi-octave organic hypoxia field
      float noiseVal = snoise(vUv * 7.5 + vec2(uTime * 0.08, 0.0)) * 0.15;
      float hypoxiaGradient = clamp(1.0 - (dist + noiseVal) / 0.45, 0.0, 1.0) * uHypoxiaIntensity;

      // Hyperspectral NIR Colors:
      // High oxygen / normal perfusion = deep infrared dark cyan / blue
      // Severe ischemia = glowing amber (#ffaa00) to necrotic hypoxic magenta (#ff0055)
      vec3 normalNIR = vec3(0.02, 0.15, 0.28);
      vec3 ischemicAmber = vec3(1.0, 0.62, 0.05);
      vec3 hypoxicMagenta = vec3(1.0, 0.05, 0.42);
      
      // Pulsating ischemic metabolic distress glow
      float pulseGlow = sin(uTime * 3.5 + dist * 12.0) * 0.2 + 0.8;
      vec3 hypoxiaColor = mix(normalNIR, mix(ischemicAmber, hypoxicMagenta, hypoxiaGradient), hypoxiaGradient * pulseGlow);
      
      // Grid reticle lines for AR holographic depth perception in NIR mode
      float gridX = step(0.96, fract(vUv.x * 32.0));
      float gridY = step(0.96, fract(vUv.y * 32.0));
      vec3 holographicGrid = vec3(0.0, 1.0, 0.8) * max(gridX, gridY) * 0.35 * uNIRMode;

      // Seamlessly interpolate between Standard SSS Dermal mode and Hyperspectral NIR Mode
      vec3 finalColor = mix(sssSkinColor, hypoxiaColor + holographicGrid, uNIRMode);
      
      // Sub-dermal transparency fade for transillumination
      float alpha = mix(0.92, 0.82, uNIRMode);

      gl_FragColor = vec4(finalColor, alpha);
    }
  `
};
