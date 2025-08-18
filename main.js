// 🌊 Three.js ES Modules Import
import * as THREE from 'three';

// Auto-close menu functionality
document.addEventListener('DOMContentLoaded', function() {
  const menuToggle = document.querySelector('.toggler');
  const menuLinks = document.querySelectorAll('.menu-content a');

  menuLinks.forEach(link => {
    link.addEventListener('click', function() {
      // Only close menu for internal links (not external ones)
      if (this.getAttribute('href').startsWith('#')) {
        menuToggle.checked = false;
      }
    });
  });
});

// 🌊 PHOTOREALISTIC WATER PHYSICS SYSTEM
class WaterPhysicsEngine {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.canvas = null;
    this.droplets = [];           // Keep for CSS droplet compatibility
    this.particles = [];          // NEW: Physics-based particle system
    this.isActive = false;
    this.hasLighting = false;     // Track lighting state
    this.physicsRunning = false;  // MILESTONE 2: Physics simulation state
    
    console.log('🌊 Water Physics Engine: Initializing...');
    this.init();
  }

  init() {
    // Get canvas element
    this.canvas = document.getElementById('water-physics-canvas');
    if (!this.canvas) {
      console.error('❌ Water Physics Canvas not found!');
      return;
    }

    // Setup Three.js scene
    this.setupScene();
    this.setupCamera();
    this.setupRenderer();
    this.setupEventListeners();
    
    console.log('✅ Water Physics Engine: Ready!');
  }

  setupScene() {
    this.scene = new THREE.Scene();
    // Transparent background - no interfering with existing menu
    this.scene.background = null;
  }

  setupCamera() {
    // Orthographic camera for 2D overlay effect
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(
      -aspect, aspect, 1, -1, 0.1, 1000
    );
    this.camera.position.z = 5;
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,           // Transparent background
      antialias: true,       // Smooth edges
      powerPreference: 'high-performance',
      premultipliedAlpha: false
    });
    
    // CHECKPOINT 1: Simple renderer - no advanced features
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.sortObjects = true;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    console.log('🟢 CHECKPOINT 1: Basic renderer setup with ES Modules');
    
    this.updateSize();
  }

  setupEventListeners() {
    // Watch for menu open/close
    const menuToggle = document.querySelector('.toggler');
    if (menuToggle) {
      menuToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.startWaterPhysics();
        } else {
          this.stopWaterPhysics();
        }
      });
    }

    // Handle window resize
    window.addEventListener('resize', () => this.updateSize());
  }

  updateSize() {
    const menu = document.querySelector('.menu');
    if (menu && this.renderer) {
      const rect = menu.getBoundingClientRect();
      this.renderer.setSize(rect.width, rect.height);
      
      // Update camera aspect ratio
      const aspect = rect.width / rect.height;
      this.camera.left = -aspect;
      this.camera.right = aspect;
      this.camera.updateProjectionMatrix();
    }
  }

  startWaterPhysics() {
    console.log('🌊 Starting Water Physics...');
    this.isActive = true;
    this.canvas.style.opacity = '1';
    
    // MILESTONE 1: Initialize particle system
    this.initParticleSystem();
    
    // Start render loop
    this.animate();
  }

  stopWaterPhysics() {
    console.log('🌊 Stopping Water Physics...');
    this.isActive = false;
    this.physicsRunning = false;  // MILESTONE 2: Stop physics simulation
    this.canvas.style.opacity = '0';
    
    // Clear all droplets and particles
    this.clearDroplets();
  }

  // MILESTONE 1, 2 & 3: Particle System with Glass Physics
  initParticleSystem() {
    console.log('🎯 MILESTONE 3: Starting glass surface physics...');
    
    // Add basic lighting for particles
    this.addBasicLighting();
    
    // Create 3 test particles at different positions
    this.createTestParticles();
    
    // MILESTONE 2 & 3: Start glass physics simulation
    this.startPhysicsLoop();
    
    console.log('✅ MILESTONE 3: Glass surface physics initialized');
  }
  
  createTestParticles() {
    // MILESTONE 4: Create more varied particles for organic behavior
    const positions = [
      // Original 3 particles
      { x: 0.0, y: -0.3, z: 0 },     // Center
      { x: 0.2, y: -0.1, z: 0 },     // Upper right  
      { x: -0.15, y: -0.6, z: 0 },   // Lower left
      
      // Additional particles for clustering
      { x: 0.05, y: -0.25, z: 0 },   // Near center
      { x: -0.1, y: -0.4, z: 0 },    // Mid left
      { x: 0.35, y: 0.1, z: 0 },     // Far upper right
      { x: -0.25, y: 0.2, z: 0 },    // Upper left
      { x: 0.1, y: -0.7, z: 0 }      // Lower center
    ];
    
    positions.forEach((pos, index) => {
      // Add slight randomization for organic feel
      const randomOffset = {
        x: pos.x + (Math.random() - 0.5) * 0.02,
        y: pos.y + (Math.random() - 0.5) * 0.02,
        z: pos.z
      };
      
      const particle = this.createWaterParticle(randomOffset, index);
      this.particles.push(particle);
      this.scene.add(particle.mesh);
    });
    
    console.log(`💧 MILESTONE 4: Created ${this.particles.length} particles with surface tension`);
  }
  
  createWaterParticle(position, id) {
    // Simple sphere geometry for now
    const geometry = new THREE.SphereGeometry(0.04, 12, 12);
    
    // Simple blue material (will upgrade in later milestones)
    const material = new THREE.MeshPhongMaterial({
      color: 0x4466ff,       // Blue for visibility
      transparent: false,    // Solid for now
      opacity: 1.0
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y, position.z);
    
    // Create particle object with physics properties
    const particle = {
      id: id,
      mesh: mesh,
      x: position.x,
      y: position.y,
      z: position.z,
      // MILESTONE 2: Physics properties
      vx: 0,           // X velocity
      vy: 0,           // Y velocity  
      vz: 0,           // Z velocity
      radius: 0.04,    // Collision radius
      mass: 1.0        // Mass for physics
    };
    
    console.log(`💧 MILESTONE 3: Water particle ${id} created with glass physics at:`, position);
    return particle;
  }

  addBasicLighting() {
    // Only add lighting once
    if (this.hasLighting) return;
    
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    
    // Directional light to make it shine
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);
    
    this.hasLighting = true;
    console.log('💡 MICRO 4: Basic lighting added');
  }

  // MILESTONE 2 & 3: Glass Surface Physics Simulation
  startPhysicsLoop() {
    console.log('🪟 MILESTONE 3: Starting glass surface physics simulation...');
    this.physicsRunning = true;
    this.runPhysics();
  }
  
  runPhysics() {
    if (!this.physicsRunning || !this.isActive) return;
    
    // Update physics for all particles
    this.updatePhysics();
    
    // Continue physics loop
    requestAnimationFrame(() => this.runPhysics());
  }
  
  updatePhysics() {
    this.particles.forEach(particle => {
      // MILESTONE 4: Apply enhanced water physics
      this.applyGlassAdhesion(particle);
      this.applySurfaceTension(particle);
      this.applyGravity(particle);
      this.applyGlassFriction(particle);
      this.checkBoundaries(particle);
      this.updatePosition(particle);
    });
    
    // Check collisions between particles
    this.checkCollisions();
  }
  
  // MILESTONE 3: Glass Surface Physics
  applyGlassAdhesion(particle) {
    // Water sticks to glass surface - resist movement away from glass center
    const glassCenter = { x: 0, y: 0 }; // Center of glass surface
    const dx = glassCenter.x - particle.x;
    const dy = glassCenter.y - particle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      // Adhesion force pulls particles toward glass center (weak)
      const adhesionStrength = 0.0005;
      particle.vx += (dx / distance) * adhesionStrength;
      particle.vy += (dy / distance) * adhesionStrength;
    }
  }
  
  // MILESTONE 4: Surface Tension Forces
  applySurfaceTension(particle) {
    // Water molecules attract each other (cohesion)
    this.particles.forEach(otherParticle => {
      if (otherParticle === particle) return;
      
      const dx = otherParticle.x - particle.x;
      const dy = otherParticle.y - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const attractionRange = 0.15; // Range where surface tension works
      
      if (distance > 0 && distance < attractionRange) {
        // Attraction gets stronger as particles get closer
        const attractionStrength = (attractionRange - distance) / attractionRange * 0.001;
        
        // Pull particles toward each other
        particle.vx += (dx / distance) * attractionStrength;
        particle.vy += (dy / distance) * attractionStrength;
      }
    });
  }
  
  applyGravity(particle) {
    // MILESTONE 3: Weaker gravity (water on glass resists falling)
    particle.vy -= 0.0003; // Much weaker gravity than air
  }
  
  applyGlassFriction(particle) {
    // Water slides slowly on glass surface
    const frictionCoefficient = 0.95; // Strong friction
    particle.vx *= frictionCoefficient;
    particle.vy *= frictionCoefficient;
  }
  
  checkBoundaries(particle) {
    // MILESTONE 3: Glass surface boundaries (water sticks to edges)
    const bounds = {
      left: -0.8,
      right: 0.8, 
      top: 0.8,
      bottom: -0.8
    };
    
    // Water sticks to glass edges (no bouncing)
    if (particle.x <= bounds.left) {
      particle.x = bounds.left;
      particle.vx = Math.max(0, particle.vx); // Stop moving left
    }
    if (particle.x >= bounds.right) {
      particle.x = bounds.right;
      particle.vx = Math.min(0, particle.vx); // Stop moving right
    }
    if (particle.y <= bounds.bottom) {
      particle.y = bounds.bottom;
      particle.vy = Math.max(0, particle.vy); // Stop moving down
    }
    if (particle.y >= bounds.top) {
      particle.y = bounds.top;
      particle.vy = Math.min(0, particle.vy); // Stop moving up
    }
  }
  
  checkCollisions() {
    // Check each particle against every other particle
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const p1 = this.particles[i];
        const p2 = this.particles[j];
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = p1.radius + p2.radius;
        
        if (distance < minDistance && distance > 0) {
          // Particles are colliding - push them apart
          const overlap = minDistance - distance;
          const separationX = (dx / distance) * overlap * 0.5;
          const separationY = (dy / distance) * overlap * 0.5;
          
          p1.x -= separationX;
          p1.y -= separationY;
          p2.x += separationX;
          p2.y += separationY;
        }
      }
    }
  }
  
  updatePosition(particle) {
    // Update particle position based on velocity
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.z += particle.vz;
    
    // Update Three.js mesh position
    particle.mesh.position.set(particle.x, particle.y, particle.z);
    
    // MILESTONE 3: Glass surface resistance (instead of air resistance)
    const surfaceResistance = 0.98; // Water moves slowly on glass
    particle.vx *= surfaceResistance;
    particle.vy *= surfaceResistance;
    particle.vz *= surfaceResistance;
  }

  // MILESTONE 1: Particle System Management

  clearDroplets() {
    // Clear old droplets (for compatibility)
    this.droplets.forEach(droplet => {
      this.scene.remove(droplet);
      droplet.geometry.dispose();
      droplet.material.dispose();
    });
    this.droplets = [];
    
    // Clear particles
    this.particles.forEach(particle => {
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      particle.mesh.material.dispose();
    });
    this.particles = [];
    
    console.log('🗑️ Cleared all droplets and particles');
  }

  animate() {
    if (!this.isActive) return;
    
    // Add subtle animation to droplets for realism
    this.animateDroplets();
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);
    
    // Debug: Log first few frames to ensure rendering is happening
    if (this.frameCount < 3) {
      console.log(`🎬 Frame ${this.frameCount}: Rendering photorealistic water droplets`);
      this.frameCount = (this.frameCount || 0) + 1;
    }
    
    // Continue animation loop
    requestAnimationFrame(() => this.animate());
  }

  animateDroplets() {
    // CHECKPOINT 2: Maintain water droplet position
    this.droplets.forEach((droplet) => {
      droplet.position.set(0.15, -0.5, 0); // Keep ~20px to the right, slightly lower
    });
  }
}

// Initialize Water Physics Engine when DOM is ready (ES Modules version)
document.addEventListener('DOMContentLoaded', function() {
  // Three.js is already imported as ES module, no need to check
  console.log('🌊 Three.js ES Modules: Ready!');
  
  // Small delay to ensure DOM is fully ready
  setTimeout(() => {
    window.waterPhysics = new WaterPhysicsEngine();
    console.log('🟢 CHECKPOINT 1: Water Physics Engine initialized with ES Modules');
  }, 100);
});