/**
 * 🌊 WATER VERTEX SHADER
 * 
 * Basic vertex shader for water surface effects
 * Handles geometry transformations and prepares data for fragment shader
 */

// Vertex attributes (automatically provided by Three.js)
// - position: vertex position
// - uv: texture coordinates

// Uniforms (shared across all vertices)
uniform float uTime;        // Animation time
uniform vec2 uResolution;   // Screen resolution

// Varyings (passed to fragment shader)
varying vec2 vUv;           // UV coordinates for fragment shader
varying vec3 vPosition;     // World position for fragment shader

void main() {
  // Pass UV coordinates to fragment shader
  vUv = uv;
  
  // Calculate world position
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vPosition = worldPosition.xyz;
  
  // Basic vertex transformation (no displacement yet)
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
