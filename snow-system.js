// Three.js Shader-Based Snow System for Main Page
// Based on Soledad Penadés tutorial + Three Nebula concepts
// 10,000 particles running entirely on GPU

console.log('Snow system - initializing...');

import * as THREE from 'three';

class SnowSystem {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Snow container #${containerId} not found`);
      return;
    }

    // Mobile detection for performance optimization
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
                    || window.innerWidth <= 768;

    // Configuration - BALANCED VARIABLE SNOW SYSTEM (Mobile-optimized)
    this.config = {
      particleCount: this.isMobile ? 3000 : 10000,    // Fewer particles on mobile
      width: 100,
      height: 100,
      depth: 100,
      speedV: 1.0,            // 2x faster falling speed
      speedH: 0.8,            // Horizontal wind speed
      radiusX: 3.0,           // Balanced drift radius
      radiusZ: 3.0,           // Balanced drift radius
      size: this.isMobile ? 80.0 : 100.0,            // Smaller particles on mobile
      scale: 4.0,             // Distance scale for perspective
      opacity: 0.4,           // Lower opacity for atmospheric depth
      
      // Dynamic intensity system (FAST changes every 5-15 seconds)
      minIntensity: 0.3,      // Subtle flurries
      maxIntensity: this.isMobile ? 2.5 : 3.5,      // Less intense on mobile
      intensityChangeSpeed: 0.08, // Faster intensity transitions
      minChangeInterval: 5,   // Minimum 5 seconds between changes
      maxChangeInterval: 15,  // Maximum 15 seconds between changes
    };
    
    console.log(`Snow system - ${this.isMobile ? 'Mobile' : 'Desktop'} mode (${this.config.particleCount} particles)`);
    
    // Dynamic state
    this.currentIntensity = 0.5;  // Start at medium
    this.targetIntensity = 0.5;
    this.intensityChangeTimer = 0;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particleSystem = null;
    this.clock = new THREE.Clock();
    this.isRunning = false;
    this.animationId = null;

    this.init();
  }

  init() {
    console.log('Snow system - creating Three.js scene...');

    // Scene (no fog - keeps particles crisp like the tutorial)
    this.scene = new THREE.Scene();

    // Camera (closer to particle system for immersive feel)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 1, 1000);
    this.camera.position.set(0, 0, 50); // Closer camera like the tutorial
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    // Create particle system with custom shaders
    this.createParticleSystem();

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());

    console.log('Snow system initialized with', this.config.particleCount, 'particles');
  }

  createParticleSystem() {
    const { particleCount, width, height, depth } = this.config;

    // Geometry - create random positions (VARIED Y for natural distribution)
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const speeds = new Float32Array(particleCount); // Per-particle speed variation

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * width;        // x: random horizontal
      positions[i3 + 1] = Math.random() * height;           // y: FULL random height (0 to height)
      positions[i3 + 2] = (Math.random() - 0.5) * depth;    // z: random depth
      
      // Each particle has unique speed (0.5x to 1.5x base speed)
      speeds[i] = 0.5 + Math.random();
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1)); // Custom attribute

    // Load snowflake texture
    const textureLoader = new THREE.TextureLoader();
    const snowflakeTexture = this.createSnowflakeTexture();

    // Custom shader material with DYNAMIC INTENSITY
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uHeight: { value: height },
        uSpeedV: { value: this.config.speedV },
        uSpeedH: { value: this.config.speedH },
        uRadiusX: { value: this.config.radiusX },
        uRadiusZ: { value: this.config.radiusZ },
        uSize: { value: this.config.size },
        uScale: { value: this.config.scale },
        uOpacity: { value: this.config.opacity },
        uColor: { value: new THREE.Color(0xffffff) },
        uTexture: { value: snowflakeTexture },
        uIntensity: { value: 1.0 }, // Dynamic intensity multiplier
      },
      vertexShader: `
        uniform float uTime;
        uniform float uHeight;
        uniform float uSpeedV;
        uniform float uSpeedH;
        uniform float uRadiusX;
        uniform float uRadiusZ;
        uniform float uSize;
        uniform float uScale;
        uniform float uIntensity;
        
        attribute float speed; // Per-particle speed variation

        void main() {
          vec3 pos = position;
          
          // BALANCED MOVEMENT: Gentle turbulence using multiple sine waves
          float turbulence = sin(uTime * 0.5 + position.x * 0.1) * 0.2 
                           + cos(uTime * 0.3 + position.z * 0.15) * 0.15;
          
          // Horizontal sine/cosine drift for natural wind movement
          // Using position.z and position.x as phase offset creates unique paths per particle
          pos.x += cos((uTime + position.z) * 0.25 * uSpeedH) * uRadiusX * uIntensity;
          pos.x += turbulence * 1.5; // Add gentle turbulence to x
          
          pos.z += sin((uTime + position.x) * 0.25 * uSpeedH) * uRadiusZ * uIntensity;
          pos.z += turbulence * 1.2; // Add gentle turbulence to z
          
          // Vertical falling with seamless looping via mod()
          // Each particle falls at its own speed, modified by intensity
          pos.y = mod(pos.y - uTime * uSpeedV * speed * uIntensity, uHeight);
          
          // Transform to clip space
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          
          // Perspective-based size (closer = larger, more dramatic with scale=4.0)
          gl_PointSize = uSize * (uScale / length(mvPosition.xyz));
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform sampler2D uTexture;

        void main() {
          // Sample texture at particle coordinate
          vec4 texColor = texture2D(uTexture, gl_PointCoord);
          
          // Apply color tint and opacity
          gl_FragColor = texColor * vec4(uColor, uOpacity);
          
          // Discard fully transparent pixels
          if (gl_FragColor.a < 0.01) discard;
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    });

    // Create particle system (offset downward to center particles)
    this.particleSystem = new THREE.Points(geometry, material);
    this.particleSystem.position.y = -height / 2;
    this.scene.add(this.particleSystem);
  }

  createSnowflakeTexture() {
    // Generate a procedural snowflake texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Create radial gradient for soft snowflake
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    // Add some sparkle in the center
    const sparkleGradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 8);
    sparkleGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    sparkleGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sparkleGradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    console.log('Snow system - started');
    this.animate();
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    console.log('Snow system - stopped');
  }

  animate() {
    if (!this.isRunning) return;

    this.animationId = requestAnimationFrame(() => this.animate());

    const elapsedTime = this.clock.getElapsedTime();
    const delta = this.clock.getDelta();

    if (this.particleSystem && this.particleSystem.material) {
      // Balanced time multiplier for natural effect (4x)
      this.particleSystem.material.uniforms.uTime.value = elapsedTime * 4;
      
      // FAST DYNAMIC INTENSITY SYSTEM - Changes every 5-15 seconds like real weather
      this.intensityChangeTimer += delta;
      
      // Change target intensity every 5-15 seconds (FAST transitions)
      const changeInterval = this.config.minChangeInterval + 
                            Math.random() * (this.config.maxChangeInterval - this.config.minChangeInterval);
      
      if (this.intensityChangeTimer > changeInterval) {
        this.intensityChangeTimer = 0;
        // Pick new random intensity (subtle flurries to full blizzard)
        this.targetIntensity = this.config.minIntensity + 
                              Math.random() * (this.config.maxIntensity - this.config.minIntensity);
        
        const intensityLabel = this.targetIntensity < 0.6 ? '🌨️ Light flurries' :
                              this.targetIntensity < 1.2 ? '❄️ Steady snow' :
                              this.targetIntensity < 2.0 ? '🌬️ Heavy snow' :
                              this.targetIntensity < 2.8 ? '🧙‍♂️ BLIZZARD' : '❄️🌪️ WHITEOUT';
        console.log(`${intensityLabel} (${this.targetIntensity.toFixed(2)}x)`);
      }
      
      // Smoothly interpolate current intensity toward target (FASTER transitions)
      this.currentIntensity += (this.targetIntensity - this.currentIntensity) * 
                               this.config.intensityChangeSpeed;
      
      // Update shader uniform
      this.particleSystem.material.uniforms.uIntensity.value = this.currentIntensity;
    }

    // Subtle camera rotation for dynamic feel
    this.camera.position.x = Math.sin(elapsedTime * 0.05) * 10;
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  destroy() {
    this.stop();
    
    if (this.particleSystem) {
      this.particleSystem.geometry.dispose();
      this.particleSystem.material.dispose();
      this.scene.remove(this.particleSystem);
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.container && this.renderer.domElement) {
        this.container.removeChild(this.renderer.domElement);
      }
    }

    window.removeEventListener('resize', () => this.onWindowResize());
    console.log('Snow system - destroyed');
  }
}

// Export for use in main integration script
export default SnowSystem;

