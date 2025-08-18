/**
 * 🌊 WATER FRAGMENT SHADER
 * 
 * Basic fragment shader for water surface effects
 * Handles per-pixel coloring and optical effects
 */

// Precision declaration (required for fragment shaders)
precision mediump float;

// Uniforms (shared across all fragments)
uniform float uTime;        // Animation time
uniform vec2 uResolution;   // Screen resolution
uniform vec3 uWaterColor;   // Base water color

// Varyings (received from vertex shader)
varying vec2 vUv;           // UV coordinates
varying vec3 vPosition;     // World position

void main() {
  // Basic water color with transparency
  vec3 waterColor = uWaterColor;
  
  // Simple transparency based on position (will be enhanced later)
  float alpha = 0.4;
  
  // Add subtle variation based on UV coordinates
  float variation = sin(vUv.x * 10.0 + uTime) * 0.1 + 0.9;
  waterColor *= variation;
  
  // Output final color
  gl_FragColor = vec4(waterColor, alpha);
}
