/**
 * Rain Effect Utility Functions
 * Organic enhancement utilities for natural, varied rain effects
 */

// Vector2 utility class for 2D operations
class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  
  static create(x, y) {
    return new Vec2(x, y);
  }
  
  add(other) {
    return new Vec2(this.x + other.x, this.y + other.y);
  }
  
  subtract(other) {
    return new Vec2(this.x - other.x, this.y - other.y);
  }
  
  multiply(scalar) {
    return new Vec2(this.x * scalar, this.y * scalar);
  }
  
  distance(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  
  normalize() {
    const len = this.length();
    return len > 0 ? new Vec2(this.x / len, this.y / len) : new Vec2(0, 0);
  }
}

// Rectangle utility class
class Rect {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
  
  get min() {
    return new Vec2(this.x, this.y);
  }
  
  get size() {
    return new Vec2(this.width, this.height);
  }
  
  get max() {
    return new Vec2(this.x + this.width, this.y + this.height);
  }
}

// Jitter option interface
class JitterOption {
  constructor(base, jitter) {
    this.base = base;
    this.jitter = jitter;
  }
}

/**
 * Generate jittered values with natural variation
 * @param {JitterOption} option - Object with base and jitter values
 * @returns {number|Vec2} - Jittered value
 */
function randomJittered(option) {
  if (typeof option.base === 'number') {
    // For numbers: base ± jitter
    return option.base + option.jitter * (Math.random() * 2 - 1);
  } else if (option.base instanceof Vec2) {
    // For Vec2: jitter each component
    return new Vec2(
      option.base.x + option.jitter.x * (Math.random() * 2 - 1),
      option.base.y + option.jitter.y * (Math.random() * 2 - 1)
    );
  } else if (Array.isArray(option.base)) {
    // For arrays: jitter each element
    return [
      option.base[0] + option.jitter[0] * (Math.random() * 2 - 1),
      option.base[1] + option.jitter[1] * (Math.random() * 2 - 1)
    ];
  }
  return option.base;
}

/**
 * Generate random point within a rectangle
 * @param {Rect} rect - Rectangle to sample from
 * @returns {Vec2} - Random point within rectangle
 */
function randomInRect(rect) {
  return new Vec2(
    rect.x + Math.random() * rect.width,
    rect.y + Math.random() * rect.height
  );
}

// Golden ratio constant for noise generation
const PHI = 1.61803398874989484820459;

/**
 * Fractional part of a number
 * @param {number} x - Input number
 * @returns {number} - Fractional part
 */
function fract(x) {
  return x - Math.floor(x);
}

/**
 * Generate organic noise using golden ratio
 * Based on: https://www.shadertoy.com/view/ltB3zD
 * @param {Vec2} xy - Non-zero integer coordinates
 * @param {number} seed - Non-zero integer seed
 * @returns {number} - Noise value in [-1, 1]
 */
function goldNoise(xy, seed) {
  const golden = xy.multiply(PHI);
  const distance = golden.distance(xy);
  return fract(Math.tan(distance * seed) * xy.x) * 2 - 1;
}

/**
 * Generate tent noise for smooth variations
 * @param {number} t - Time/position parameter
 * @param {number} seed - Seed for variation
 * @returns {number} - Tent noise value
 */
function tentNoise(t, seed) {
  const frac = fract(t);
  const grid = Math.floor(t + seed);
  const noise = Math.sin(grid * 12.9898 + seed * 78.233) * 43758.5453;
  return (fract(noise) * 2 - 1) * (1 - Math.abs(frac * 2 - 1));
}

/**
 * Generate random value in (-1, 1)
 * @returns {number} - Random value
 */
function random() {
  return Math.random() * 2 - 1;
}

/**
 * Generate random value in range [min, max]
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Random value in range
 */
function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Generate organic drop shape variation
 * @param {Vec2} position - Drop position
 * @param {number} seed - Unique seed for this drop
 * @returns {number} - Shape variation factor
 */
function organicShapeVariation(position, seed) {
  const noise1 = goldNoise(position.multiply(0.1), seed);
  const noise2 = goldNoise(position.multiply(0.05), seed + 1000);
  return 1 + (noise1 * 0.1 + noise2 * 0.05);
}

/**
 * Generate natural drop size variation
 * @param {number} baseSize - Base drop size
 * @param {number} variation - Variation amount
 * @returns {number} - Varied drop size
 */
function naturalDropSize(baseSize, variation = 0.3) {
  const jittered = randomJittered(new JitterOption(baseSize, baseSize * variation));
  return Math.max(0.5, jittered); // Ensure minimum size
}

/**
 * Generate natural drop speed variation
 * @param {number} baseSpeed - Base drop speed
 * @param {number} variation - Variation amount
 * @returns {number} - Varied drop speed
 */
function naturalDropSpeed(baseSpeed, variation = 0.2) {
  const jittered = randomJittered(new JitterOption(baseSpeed, baseSpeed * variation));
  return Math.max(0.1, jittered); // Ensure minimum speed
}

/**
 * Generate organic trail intensity
 * @param {number} age - Drop age
 * @param {number} seed - Drop seed
 * @returns {number} - Trail intensity
 */
function organicTrailIntensity(age, seed) {
  const baseIntensity = 0.5;
  const variation = tentNoise(age * 0.1, seed) * 0.3;
  return Math.max(0, Math.min(1, baseIntensity + variation));
}

// Export all utilities
window.RainUtils = {
  Vec2,
  Rect,
  JitterOption,
  randomJittered,
  randomInRect,
  goldNoise,
  tentNoise,
  random,
  randomRange,
  organicShapeVariation,
  naturalDropSize,
  naturalDropSpeed,
  organicTrailIntensity,
  fract,
  PHI
};

console.log('🌧️ Rain Utils loaded - Organic enhancement functions available!');
