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
    
    // Enable transparency and proper blending
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.sortObjects = true;
    this.renderer.setPixelRatio(window.devicePixelRatio);
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
    // Simple sphere geometry for realistic droplet
    const geometry = new THREE.SphereGeometry(0.05, 16, 16);
    
    // Transparent blue water material
    const material = new THREE.MeshBasicMaterial({
      color: 0x00aaff,      // Blue water color
      transparent: true,
      opacity: 0.4,         // Transparent
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      depthWrite: false
    });
    
    console.log('💧 Three.js droplet created - opacity:', material.opacity);
    
    const droplet = new THREE.Mesh(geometry, material);
    
    // Position to the right of CSS droplet for comparison
    droplet.position.set(0.3, -0.5, 0);
    
    this.scene.add(droplet);
    this.droplets.push(droplet);
    
    console.log('💧 Test droplet created at:', droplet.position);
  }

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
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);
    
    // Debug: Log first few frames to ensure rendering is happening
    if (this.frameCount < 5) {
      console.log(`🎬 Frame ${this.frameCount}: Rendering scene with ${this.droplets.length} droplets`);
      this.frameCount = (this.frameCount || 0) + 1;
    }
    
    // Continue animation loop
    requestAnimationFrame(() => this.animate());
  }
}

// Initialize Water Physics Engine when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Check Three.js loading with multiple attempts
  let attempts = 0;
  const maxAttempts = 10;
  
  function checkThreeJS() {
    attempts++;
    
    if (typeof THREE !== 'undefined') {
      console.log('🌊 Three.js Water Physics: Ready!');
      window.waterPhysics = new WaterPhysicsEngine();
    } else if (attempts < maxAttempts) {
      setTimeout(checkThreeJS, 200);
    } else {
      console.error('❌ Three.js failed to load after', maxAttempts, 'attempts!');
    }
  }
  
  // Start checking after initial delay
  setTimeout(checkThreeJS, 100);
});