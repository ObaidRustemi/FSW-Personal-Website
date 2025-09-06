/**
 * Rain Engine Manager - Dual Engine Architecture
 * Provides unified API for WebGL (RaindropFX) and Canvas2D (RainyDay.js) rain effects
 */

// Unified API Interface
class RainEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = this.mergeDefaultOptions(options);
    this.isRunning = false;
    this.animationId = null;
  }

  async start() {
    throw new Error('start() must be implemented by engine');
  }

  stop() {
    throw new Error('stop() must be implemented by engine');
  }

  resize(width, height) {
    throw new Error('resize() must be implemented by engine');
  }

  async setBackground(source) {
    throw new Error('setBackground() must be implemented by engine');
  }

  setIntensity(level) {
    throw new Error('setIntensity() must be implemented by engine');
  }

  setWind(strength) {
    throw new Error('setWind() must be implemented by engine');
  }

  setCondensation(enabled) {
    throw new Error('setCondensation() must be implemented by engine');
  }

  destroy() {
    throw new Error('destroy() must be implemented by engine');
  }

  mergeDefaultOptions(options) {
    return {
      // Common options
      width: this.canvas.width || 800,
      height: this.canvas.height || 600,
      background: options.background || null,
      intensity: options.intensity || 2, // 0-3 scale
      wind: options.wind || 0.5, // 0-1 scale
      condensation: options.condensation !== false, // default true
      
      // Engine-specific options will be merged by individual engines
      ...options
    };
  }
}

// WebGL RaindropFX Engine Implementation
class RaindropFXEngine extends RainEngine {
  constructor(canvas, options = {}) {
    super(canvas, options);
    this.renderer = null;
    this.simulator = null;
    this.isWebGLSupported = this.detectWebGLSupport();
    
    if (!this.isWebGLSupported) {
      throw new Error('WebGL not supported, use RainyDayEngine instead');
    }
  }

  detectWebGLSupport() {
    try {
      // Create a test canvas for WebGL detection
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
      
      if (!gl) return false;
      
      // Test basic WebGL functionality
      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      
      if (!vertexShader || !fragmentShader) return false;
      
      // Clean up
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      
      return true;
    } catch (e) {
      console.warn('WebGL detection failed:', e);
      return false;
    }
  }

  async start() {
    if (this.isRunning) return;
    
    try {
      // Initialize WebGL renderer and simulator
      await this.initializeWebGL();
      this.isRunning = true;
      this.animationLoop();
    } catch (error) {
      console.error('Failed to start RaindropFX engine:', error);
      throw error;
    }
  }

  async initializeWebGL() {
    console.log('Initializing RaindropFX WebGL engine...');
    
    // Ensure canvas is properly sized
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      console.warn('Canvas has zero dimensions, setting default size');
      this.canvas.width = 800;
      this.canvas.height = 600;
    }
    
    // Create a WebGL context with proper error handling
    let gl = null;
    try {
      // Try WebGL2 first with minimal options
      gl = this.canvas.getContext('webgl2');
      
      if (!gl) {
        // Fallback to WebGL1
        gl = this.canvas.getContext('webgl');
      }
      
      if (!gl) {
        // Last resort: experimental-webgl
        gl = this.canvas.getContext('experimental-webgl');
      }
    } catch (error) {
      console.error('WebGL context creation error:', error);
      throw new Error('WebGL context creation failed: ' + error.message);
    }
    
    if (!gl) {
      throw new Error('WebGL context creation failed - no WebGL support available');
    }
    
    // Set up basic WebGL state
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    
    this.gl = gl;
    console.log('WebGL context created successfully');
  }

  animationLoop() {
    if (!this.isRunning) return;
    
    // Simple animated gradient to show WebGL is working
    const time = performance.now() * 0.001;
    const r = 0.1 + 0.1 * Math.sin(time);
    const g = 0.2 + 0.1 * Math.cos(time * 0.7);
    const b = 0.4 + 0.1 * Math.sin(time * 1.3);
    
    this.gl.clearColor(r, g, b, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    
    this.animationId = requestAnimationFrame(() => this.animationLoop());
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.options.width = width;
    this.options.height = height;
    
    if (this.gl) {
      this.gl.viewport(0, 0, width, height);
    }
  }

  async setBackground(source) {
    this.options.background = source;
    // Placeholder for background loading
    console.log('Setting background:', source);
  }

  setIntensity(level) {
    this.options.intensity = Math.max(0, Math.min(3, level));
    // Map intensity to engine-specific parameters
    const intensityMap = {
      0: { dropletsPerSeconds: 0, spawnLimit: 0 },
      1: { dropletsPerSeconds: 200, spawnLimit: 500 },
      2: { dropletsPerSeconds: 500, spawnLimit: 1000 },
      3: { dropletsPerSeconds: 800, spawnLimit: 2000 }
    };
    
    const params = intensityMap[Math.floor(this.options.intensity)];
    Object.assign(this.options, params);
  }

  setWind(strength) {
    this.options.wind = Math.max(0, Math.min(1, strength));
    // Map wind to xShifting parameter
    this.options.xShifting = [0, strength * 0.12];
  }

  setCondensation(enabled) {
    this.options.condensation = enabled;
    this.options.mist = enabled;
  }

  destroy() {
    this.stop();
    if (this.gl) {
      // Clean up WebGL resources
      this.gl = null;
    }
  }
}

// Canvas2D RainyDay Engine Implementation
class RainyDayEngine extends RainEngine {
  constructor(canvas, options = {}) {
    super(canvas, options);
    this.rainyDay = null;
    this.rainyDayOptions = this.buildRainyDayOptions();
  }

  buildRainyDayOptions() {
    return {
      image: this.options.background,
      fps: 24,
      blur: 8 + (this.options.intensity * 2), // 8-14 based on intensity
      enableCollisions: true,
      gravityAngleVariance: 0.01 + (this.options.wind * 0.02), // 0.01-0.03
      trail: this.options.condensation ? 'TRAIL_SMUDGE' : 'TRAIL_DROPS',
      presets: this.getIntensityPresets()
    };
  }

  getIntensityPresets() {
    const intensityPresets = {
      0: [],
      1: [[3, 5, 0.3, 50]],
      2: [[3, 5, 0.6, 50], [6, 8, 0.2, 30]],
      3: [[3, 5, 0.8, 50], [6, 8, 0.4, 30], [10, 15, 0.1, 20]]
    };
    return intensityPresets[Math.floor(this.options.intensity)] || intensityPresets[2];
  }

  async start() {
    if (this.isRunning) return;
    
    try {
      // Initialize RainyDay.js
      await this.initializeRainyDay();
      this.isRunning = true;
    } catch (error) {
      console.error('Failed to start RainyDay engine:', error);
      throw error;
    }
  }

  async initializeRainyDay() {
    // Check if RainyDay is available
    if (typeof RainyDay === 'undefined') {
      throw new Error('RainyDay.js library not loaded. Please ensure the script is included.');
    }
    
    console.log('Initializing RainyDay.js engine...');
    
    // Ensure we have a proper IMG element for RainyDay.js
    let imageElement = this.options.background;
    
    // Handle different background source types
    if (typeof this.options.background === 'string' && this.options.background.startsWith('#')) {
      imageElement = document.querySelector(this.options.background);
    }
    
    // If we have a canvas or other non-IMG element, create a proper IMG element
    if (!imageElement || imageElement.tagName !== 'IMG') {
      console.log('Creating IMG element for RainyDay.js...');
      imageElement = await this.createImageElementForRainyDay();
    }
    
    // Wait for image to load
    if (imageElement.tagName === 'IMG') {
      console.log('Waiting for background image to load...');
      await new Promise((resolve, reject) => {
        if (imageElement.complete) {
          resolve();
        } else {
          imageElement.onload = resolve;
          imageElement.onerror = reject;
        }
      });
    }
    
    try {
      // Create RainyDay instance with proper IMG element
      this.rainyDay = new RainyDay({
        image: imageElement,
        fps: this.rainyDayOptions.fps,
        blur: this.rainyDayOptions.blur,
        enableCollisions: this.rainyDayOptions.enableCollisions,
        gravityAngleVariance: this.rainyDayOptions.gravityAngleVariance
      });
      
      console.log('RainyDay instance created successfully');
      
      // Start rain with presets
      if (this.rainyDayOptions.presets.length > 0) {
        this.rainyDay.rain(this.rainyDayOptions.presets, 50);
        console.log('Rain started with presets:', this.rainyDayOptions.presets);
      }
      
    } catch (error) {
      console.error('Failed to create RainyDay instance:', error);
      throw new Error('Failed to create RainyDay instance: ' + error.message);
    }
  }

  async createImageElementForRainyDay() {
    // Create a new IMG element for RainyDay.js
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    
    // Set up the image source
    if (typeof this.options.background === 'string') {
      if (this.options.background.startsWith('http') || this.options.background.startsWith('data:')) {
        img.src = this.options.background;
      } else {
        // Assume it's a URL
        img.src = this.options.background;
      }
    } else if (this.options.background && this.options.background.tagName === 'IMG') {
      img.src = this.options.background.src;
    } else {
      // Create a default background
      img.src = 'data:image/svg+xml;base64,' + btoa(`
        <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#4a90e2;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#357abd;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grad)"/>
        </svg>
      `);
    }
    
    return img;
  }

  stop() {
    this.isRunning = false;
    if (this.rainyDay) {
      this.rainyDay.pause();
    }
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.options.width = width;
    this.options.height = height;
    
    if (this.rainyDay) {
      // RainyDay doesn't have a direct resize method, so we need to recreate
      this.stop();
      this.initializeRainyDay();
    }
  }

  async setBackground(source) {
    this.options.background = source;
    this.rainyDayOptions.image = source;
    
    if (this.rainyDay) {
      // Update RainyDay background
      this.rainyDay.clear();
      this.rainyDay = new RainyDay(this.rainyDayOptions);
      if (this.isRunning) {
        this.rainyDay.rain(this.rainyDayOptions.presets, 50);
      }
    }
  }

  setIntensity(level) {
    this.options.intensity = Math.max(0, Math.min(3, level));
    this.rainyDayOptions.presets = this.getIntensityPresets();
    this.rainyDayOptions.blur = 8 + (level * 2);
    
    if (this.rainyDay && this.isRunning) {
      this.rainyDay.clear();
      this.rainyDay.rain(this.rainyDayOptions.presets, 50);
    }
  }

  setWind(strength) {
    this.options.wind = Math.max(0, Math.min(1, strength));
    this.rainyDayOptions.gravityAngleVariance = 0.01 + (strength * 0.02);
    
    if (this.rainyDay) {
      this.rainyDay.gravityAngleVariance = this.rainyDayOptions.gravityAngleVariance;
    }
  }

  setCondensation(enabled) {
    this.options.condensation = enabled;
    this.rainyDayOptions.trail = enabled ? 'TRAIL_SMUDGE' : 'TRAIL_DROPS';
    
    if (this.rainyDay) {
      // Update trail mode
      this.rainyDay.trail = this.rainyDayOptions.trail;
    }
  }

  destroy() {
    this.stop();
    if (this.rainyDay) {
      this.rainyDay.clear();
      this.rainyDay = null;
    }
  }
}

// Main Engine Manager
class RainEngineManager {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = options;
    this.currentEngine = null;
    this.engineType = null;
    this.performanceMonitor = new PerformanceMonitor();
  }

  // Detect WebGL support
  detectWebGLSupport() {
    try {
      // Create a test canvas for WebGL detection
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
      
      if (!gl) return false;
      
      // Test basic WebGL functionality
      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      
      if (!vertexShader || !fragmentShader) return false;
      
      // Clean up
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      
      return true;
    } catch (e) {
      console.warn('WebGL detection failed:', e);
      return false;
    }
  }

  // Create appropriate engine
  createEngine(forceType = null) {
    const webglSupported = this.detectWebGLSupport();
    const engineType = forceType || (webglSupported ? 'webgl' : 'canvas2d');
    
    console.log(`Creating ${engineType} engine (WebGL supported: ${webglSupported})`);
    
    switch (engineType) {
      case 'webgl':
        if (!webglSupported) {
          console.warn('WebGL not supported, falling back to Canvas2D');
          return this.createEngine('canvas2d');
        }
        
        try {
          this.currentEngine = new RaindropFXEngine(this.canvas, this.options);
          this.engineType = 'webgl';
          console.log('WebGL engine created successfully');
        } catch (error) {
          console.warn('WebGL engine creation failed, falling back to Canvas2D:', error.message);
          return this.createEngine('canvas2d');
        }
        break;
        
      case 'canvas2d':
        this.currentEngine = new RainyDayEngine(this.canvas, this.options);
        this.engineType = 'canvas2d';
        console.log('Canvas2D engine created successfully');
        break;
        
      default:
        throw new Error(`Unknown engine type: ${engineType}`);
    }
    
    return this.currentEngine;
  }

  // Switch between engines
  async switchEngine(engineType) {
    if (this.engineType === engineType) return;
    
    const wasRunning = this.currentEngine?.isRunning || false;
    
    // Stop current engine
    if (this.currentEngine) {
      this.currentEngine.stop();
      this.currentEngine.destroy();
    }
    
    // Create new engine
    this.createEngine(engineType);
    
    // Restart if was running
    if (wasRunning) {
      await this.currentEngine.start();
    }
    
    console.log(`Switched to ${engineType} engine`);
  }

  // Unified API methods
  async start() {
    if (!this.currentEngine) {
      this.createEngine();
    }
    return this.currentEngine.start();
  }

  stop() {
    if (this.currentEngine) {
      this.currentEngine.stop();
    }
  }

  resize(width, height) {
    if (this.currentEngine) {
      this.currentEngine.resize(width, height);
    }
  }

  async setBackground(source) {
    if (this.currentEngine) {
      return this.currentEngine.setBackground(source);
    }
  }

  setIntensity(level) {
    if (this.currentEngine) {
      this.currentEngine.setIntensity(level);
    }
  }

  setWind(strength) {
    if (this.currentEngine) {
      this.currentEngine.setWind(strength);
    }
  }

  setCondensation(enabled) {
    if (this.currentEngine) {
      this.currentEngine.setCondensation(enabled);
    }
  }

  destroy() {
    if (this.currentEngine) {
      this.currentEngine.destroy();
      this.currentEngine = null;
    }
  }

  // Get current engine info
  getEngineInfo() {
    return {
      type: this.engineType,
      isRunning: this.currentEngine?.isRunning || false,
      webglSupported: this.detectWebGLSupport()
    };
  }
}

// Performance Monitor
class PerformanceMonitor {
  constructor() {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fps = 60;
    this.fpsHistory = [];
  }

  update() {
    this.frameCount++;
    const now = performance.now();
    
    if (now - this.lastTime >= 1000) {
      this.fps = this.frameCount;
      this.fpsHistory.push(this.fps);
      
      // Keep only last 10 FPS readings
      if (this.fpsHistory.length > 10) {
        this.fpsHistory.shift();
      }
      
      this.frameCount = 0;
      this.lastTime = now;
    }
  }

  getAverageFPS() {
    if (this.fpsHistory.length === 0) return this.fps;
    return this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
  }

  shouldSwitchToFallback() {
    return this.getAverageFPS() < 30 && this.fpsHistory.length >= 5;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RainEngineManager, RaindropFXEngine, RainyDayEngine };
} else {
  window.RainEngineManager = RainEngineManager;
  window.RaindropFXEngine = RaindropFXEngine;
  window.RainyDayEngine = RainyDayEngine;
}
