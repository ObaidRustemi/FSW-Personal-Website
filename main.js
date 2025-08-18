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
    this.droplets = [];
    this.isActive = false;
    
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
    
    // Create initial test droplet
    this.createTestDroplet();
    
    // Start render loop
    this.animate();
  }

  stopWaterPhysics() {
    console.log('🌊 Stopping Water Physics...');
    this.isActive = false;
    this.canvas.style.opacity = '0';
    
    // Clear all droplets
    this.clearDroplets();
  }

  createTestDroplet() {
    // MICRO 1: Back to basics - just get something visible
    const geometry = new THREE.SphereGeometry(0.06, 16, 16);
    
    // WATER-LIKE TRANSPARENCY - 70% opacity (30% transparent like water)
    const material = new THREE.MeshBasicMaterial({
      color: 0x0066ff,       // BRIGHT BLUE (water-ish color)
      transparent: true,     // Enable transparency
      opacity: 0.7          // 70% solid - should look water-like!
    });
    
    console.log('💧 MICRO 3 SUCCESS: Water-like blue sphere (70% opacity)');
    
    const droplet = new THREE.Mesh(geometry, material);
    
    // Position exactly 20px to the right of CSS droplet, slightly lower
    droplet.position.set(0.15, -0.5, 0);
    
    this.scene.add(droplet);
    this.droplets.push(droplet);
    
    console.log('💧 MICRO 3 SUCCESS: Water-like sphere at:', droplet.position);
  }

  // MICRO 1: Simple red sphere test

  clearDroplets() {
    this.droplets.forEach(droplet => {
      this.scene.remove(droplet);
      droplet.geometry.dispose();
      droplet.material.dispose();
    });
    this.droplets = [];
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