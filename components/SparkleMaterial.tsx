import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';

const SparkleShaderMaterial = shaderMaterial(
  {
    time: 0,
    color: new THREE.Color(1.0, 0.4, 0.7), // Default pink
    size: 5.0,
    pixelRatio: 1,
  },
  // Vertex Shader
  `
    uniform float time;
    uniform float size;
    uniform float pixelRatio;
    attribute float randomScale;
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Twinkle effect based on time and randomScale
      float twinkle = sin(time * 5.0 + randomScale * 10.0) * 0.5 + 0.5;
      
      // Size attenuation
      gl_PointSize = size * pixelRatio * (1.0 + twinkle) * (30.0 / -mvPosition.z);
      
      vAlpha = 0.6 + 0.4 * twinkle; 
    }
  `,
  // Fragment Shader
  `
    uniform vec3 color;
    varying float vAlpha;

    void main() {
      // Circular particle with soft edge
      vec2 center = gl_PointCoord - 0.5;
      float dist = length(center);
      if (dist > 0.5) discard;
      
      // Diamond flare look (simple cross plus core)
      float intensity = 1.0 - (dist * 2.0);
      intensity = pow(intensity, 1.5);

      gl_FragColor = vec4(color + vec3(0.5) * intensity, vAlpha * intensity);
    }
  `
);

export { SparkleShaderMaterial };
