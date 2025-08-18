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
    
    // OPTICAL EFFECTS: Configure renderer for photorealistic PBR rendering
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.sortObjects = true;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    // Enable modern rendering features for photorealism
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;  // Proper color space
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; // Cinematic tone mapping
    this.renderer.toneMappingExposure = 1.2;                // Enhanced exposure for water effects
    this.renderer.physicallyCorrectLights = true;          // Realistic light falloff
    
    // Enable shadows for realistic light interaction
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;  // Soft realistic shadows
    
    console.log('🟢 CHECKPOINT 1: PBR renderer setup with advanced rendering features');
    
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

  // OPTICAL EFFECTS: 50-75 Photorealistic Water Droplets with Advanced Light Interaction
  initParticleSystem() {
    console.log('🎯 OPTICAL EFFECTS: Starting photorealistic water droplet system...');
    
    // Add advanced lighting for photorealistic water
    this.addBasicLighting();
    
    // Create 50-75 photorealistic water droplets
    this.createTestParticles();
    
    // Start enhanced glass physics simulation
    this.startPhysicsLoop();
    
    console.log('✅ OPTICAL EFFECTS: Photorealistic water droplet system initialized');
  }
  
  createTestParticles() {
    // OPTICAL EFFECTS: 15-25 large photorealistic water droplets for visible effects testing
    console.log('🔄 OPTICAL EFFECTS: Generating large photorealistic water droplets for visibility testing...');
    
    const targetCount = 15 + Math.floor(Math.random() * 11); // 15-25 particles (focus on quality)
    
    // OPTICAL EFFECTS: Larger droplets for visible PBR effects
    const sizeCategories = [
      { type: 'tiny', radius: 0.03, weight: 0.3 },     // 30% tiny droplets (doubled size)
      { type: 'small', radius: 0.05, weight: 0.35 },   // 35% small droplets (doubled size)
      { type: 'medium', radius: 0.08, weight: 0.25 },  // 25% medium droplets (doubled size)  
      { type: 'large', radius: 0.12, weight: 0.1 }     // 10% large droplets (doubled size)
    ];
    
    for (let i = 0; i < targetCount; i++) {
      // SCALE UP PHASE 2: Choose from 4 size categories with realistic weights
      const rand = Math.random();
      let category;
      if (rand < 0.4) category = sizeCategories[0];        // tiny (40%)
      else if (rand < 0.75) category = sizeCategories[1];  // small (35%)
      else if (rand < 0.95) category = sizeCategories[2];  // medium (20%)
      else category = sizeCategories[3];                   // large (5%)
      
      // Generate natural distribution across glass surface
      const position = this.generateNaturalPosition(category.type);
      
      const particle = this.createWaterParticle(position, i, category);
      this.particles.push(particle);
      this.scene.add(particle.mesh);
    }
    
    console.log(`✨ OPTICAL EFFECTS: Created ${this.particles.length} photorealistic water droplets with PBR materials (Physical Rendering)`);
  }
  
  generateNaturalPosition(sizeType) {
    // SCALE UP PHASE 2: Enhanced natural distribution with condensation zones
    
    // Define condensation hotspots (areas where droplets form more often)
    const condensationZones = [
      { center: { x: 0.0, y: 0.0 }, radius: 0.3, weight: 0.4 },    // Central zone
      { center: { x: -0.4, y: -0.2 }, radius: 0.25, weight: 0.25 }, // Upper left cluster
      { center: { x: 0.3, y: 0.1 }, radius: 0.2, weight: 0.2 },   // Lower right cluster
      { center: { x: 0.0, y: -0.5 }, radius: 0.15, weight: 0.1 },  // Bottom cluster
      { center: { x: -0.2, y: 0.4 }, radius: 0.1, weight: 0.05 }   // Top cluster (weights now add to 1.0)
    ];
    
    // Choose a condensation zone or random area
    const useZone = Math.random() < 0.7; // 70% chance to use a hotspot
    
    if (useZone) {
      // Pick a zone weighted by importance
      const zoneRand = Math.random();
      let selectedZone;
      let cumulative = 0;
      for (const zone of condensationZones) {
        cumulative += zone.weight;
        if (zoneRand <= cumulative) {
          selectedZone = zone;
          break;
        }
      }
      
      // Safety fallback - if no zone selected, use central zone
      if (!selectedZone) {
        selectedZone = condensationZones[0]; // Central zone
        console.warn('🚨 Zone selection fallback triggered, using central zone');
      }
      
      // Generate position within the selected zone
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * selectedZone.radius;
      const sizeOffset = this.getSizePositionOffset(sizeType);
      
      return {
        x: selectedZone.center.x + Math.cos(angle) * distance * sizeOffset,
        y: selectedZone.center.y + Math.sin(angle) * distance * sizeOffset,
        z: 0
      };
    } else {
      // Random position anywhere on glass (for natural variation)
      const bounds = this.getSizeBounds(sizeType);
      return {
        x: bounds.x[0] + Math.random() * (bounds.x[1] - bounds.x[0]),
        y: bounds.y[0] + Math.random() * (bounds.y[1] - bounds.y[0]),
        z: 0
      };
    }
  }
  
  getSizePositionOffset(sizeType) {
    // Larger droplets stay closer to zone centers, smaller ones spread out more
    if (sizeType === 'tiny') return 1.2;     // Can spread outside zones
    if (sizeType === 'small') return 1.0;    // Normal zone spread
    if (sizeType === 'medium') return 0.8;   // Stay closer to center
    return 0.6; // large - stay very close to center
  }
  
  getSizeBounds(sizeType) {
    // Fallback bounds for random positioning
    if (sizeType === 'tiny') return { x: [-0.8, 0.8], y: [-0.8, 0.8] };
    if (sizeType === 'small') return { x: [-0.6, 0.6], y: [-0.6, 0.6] };
    if (sizeType === 'medium') return { x: [-0.4, 0.4], y: [-0.4, 0.4] };
    return { x: [-0.3, 0.3], y: [-0.3, 0.3] }; // large
  }
  
  createWaterParticle(position, id, category) {
    // SHAPE REALISM: Create realistic droplet shapes based on size and surface tension
    const radius = category.radius;
    const geometry = new THREE.SphereGeometry(radius, 16, 12); // Higher detail for shape deformation
    
    // Apply realistic droplet deformation based on size
    this.applyDropletShape(geometry, category);
    
    // OPTICAL EFFECTS: Dramatic water materials for visible PBR effects
    let materialProps;
    if (category.type === 'tiny') {
      materialProps = { 
        color: 0xffffff,        // Pure white (water is colorless)
        transparent: true, 
        opacity: 0.7,          // More visible for testing effects
        roughness: 0.0,        // Perfectly smooth (glass-like)
        metalness: 0.0,        // Water is not metallic
        ior: 1.33,             // Water's index of refraction
        transmission: 1.0,     // Maximum light transmission
        envMapIntensity: 2.0,  // Strong environment reflections
        clearcoat: 1.0,        // Full clearcoat effect
        clearcoatRoughness: 0.0 // Mirror smooth
      };
    } else if (category.type === 'small') {
      materialProps = { 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.75,         // More visible
        roughness: 0.0,        
        metalness: 0.0,
        ior: 1.33,
        transmission: 1.0,     // Maximum transmission
        envMapIntensity: 2.2,  // Stronger reflections
        clearcoat: 1.0,
        clearcoatRoughness: 0.0
      };
    } else if (category.type === 'medium') {
      materialProps = { 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.8,          // Very visible for dramatic effects
        roughness: 0.0,        
        metalness: 0.0,
        ior: 1.33,
        transmission: 1.0,     // Maximum transmission
        envMapIntensity: 2.5,  // Very strong reflections
        clearcoat: 1.0,
        clearcoatRoughness: 0.0
      };
    } else {
      materialProps = { 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.85,         // Most visible for maximum drama
        roughness: 0.0,        
        metalness: 0.0,
        ior: 1.33,             
        transmission: 1.0,     // Maximum light transmission
        envMapIntensity: 3.0,  // Maximum reflections
        clearcoat: 1.0,
        clearcoatRoughness: 0.0
      };
    }
    
    // OPTICAL EFFECTS: Use MeshPhysicalMaterial for the most advanced PBR properties (transmission, clearcoat, etc.)
    const material = new THREE.MeshPhysicalMaterial(materialProps);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y, position.z);
    
    // Create particle object with size-based physics properties
    const particle = {
      id: id,
      mesh: mesh,
      x: position.x,
      y: position.y,
      z: position.z,
      // SCALE UP PHASE 1: Size-based physics
      vx: 0,                           // X velocity
      vy: 0,                           // Y velocity  
      vz: 0,                           // Z velocity
      radius: radius,                  // Actual collision radius
      mass: Math.pow(radius * 25, 3),  // Mass scales with volume (larger = heavier)
      size: category.type              // Track size category
    };
    
    // Reduced logging for better performance with 50-75 droplets
    if (id % 10 === 0) { // Only log every 10th droplet
      console.log(`${this.getSizeEmoji(category.type)} OPTICS: ${category.type} photorealistic droplet ${id} (r=${radius}) at:`, position);
    }
    return particle;
  }
  
  applyDropletShape(geometry, category) {
    // SHAPE REALISM: Deform sphere to create realistic water droplet shape
    const positions = geometry.attributes.position.array;
    const radius = category.radius;
    
    // Deformation parameters based on droplet size
    let flatteningFactor, bulgeFactor, contactAngle;
    if (category.type === 'tiny') {
      flatteningFactor = 0.1;   // Minimal flattening
      bulgeFactor = 1.05;       // Slight bulge
      contactAngle = 0.8;       // High surface tension
    } else if (category.type === 'small') {
      flatteningFactor = 0.2;   // Light flattening
      bulgeFactor = 1.1;        // More bulge
      contactAngle = 0.7;       // Medium surface tension
    } else if (category.type === 'medium') {
      flatteningFactor = 0.35;  // Noticeable flattening
      bulgeFactor = 1.15;       // Clear bulge
      contactAngle = 0.6;       // Lower surface tension
    } else {
      flatteningFactor = 0.5;   // Significant flattening
      bulgeFactor = 1.2;        // Pronounced bulge
      contactAngle = 0.5;       // Lowest surface tension
    }
    
    // Apply droplet deformation to each vertex
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];
      
      // Distance from center in Y (vertical) direction
      const normalizedY = y / radius;
      
      // Flatten bottom (where droplet contacts glass)
      if (normalizedY < -0.3) { // Bottom portion
        const flattenAmount = Math.abs(normalizedY + 0.3) * flatteningFactor;
        positions[i + 1] = y + flattenAmount * radius; // Move up (flatten)
      }
      
      // Bulge sides (surface tension effect)
      if (normalizedY > -0.3 && normalizedY < 0.5) { // Middle portion
        const distanceFromCenter = Math.sqrt(x * x + z * z);
        const bulgeAmount = (1 - Math.abs(normalizedY)) * (bulgeFactor - 1);
        
        if (distanceFromCenter > 0) {
          const bulgeMultiplier = 1 + bulgeAmount;
          positions[i] = x * bulgeMultiplier;     // X bulge
          positions[i + 2] = z * bulgeMultiplier; // Z bulge
        }
      }
      
      // Create contact angle at the base
      if (normalizedY < -0.1 && normalizedY > -0.4) {
        const contactEffect = contactAngle + (1 - contactAngle) * Math.abs(normalizedY + 0.1) / 0.3;
        const distanceFromCenter = Math.sqrt(x * x + z * z);
        
        if (distanceFromCenter > 0) {
          positions[i] = x * contactEffect;
          positions[i + 2] = z * contactEffect;
        }
      }
    }
    
    // Update geometry
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals(); // Recalculate lighting normals
    
    // Reduced logging to prevent console spam
    // console.log(`🌊 Applied ${category.type} droplet shape deformation`);
  }
  
  getSizeEmoji(sizeType) {
    if (sizeType === 'tiny') return '💧';    // tiny droplet
    if (sizeType === 'small') return '🔹';   // small droplet  
    if (sizeType === 'medium') return '🔷';  // medium droplet
    return '🔵'; // large droplet
  }

  addBasicLighting() {
    // Only add lighting once
    if (this.hasLighting) return;
    
    // OPTICAL EFFECTS: Advanced lighting system for photorealistic water
    
    // Ambient light for overall illumination (very soft for dramatic contrast)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(ambientLight);
    
    // Main directional light (bright sunlight for caustics and reflections)
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(3, 4, 2);
    mainLight.castShadow = false; // Shadows would complicate transparency
    this.scene.add(mainLight);
    
    // Secondary light for realistic water reflections (cooler tone)
    const fillLight = new THREE.DirectionalLight(0xaaccff, 0.6);
    fillLight.position.set(-2, 2, 3);
    this.scene.add(fillLight);
    
    // Point light for water sparkle and caustic effects
    const sparkleLight = new THREE.PointLight(0xffffff, 0.8, 3);
    sparkleLight.position.set(0.5, 0.5, 1.5);
    this.scene.add(sparkleLight);
    
    // Additional point light for enhanced caustics
    const causticLight = new THREE.PointLight(0xffffff, 0.6, 2.5);
    causticLight.position.set(-0.5, -0.5, 1.2);
    this.scene.add(causticLight);
    
    // Rim light for edge highlighting (makes water edges glow)
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(0, 0, -1); // From behind
    this.scene.add(rimLight);
    
    this.hasLighting = true;
    console.log('✨ OPTICAL EFFECTS: Advanced lighting system for photorealistic water');
  }

  // OPTICAL EFFECTS: Enhanced Physics for 50-75 Photorealistic Droplets  
  startPhysicsLoop() {
    console.log('✨ OPTICAL EFFECTS: Starting enhanced physics for photorealistic droplets...');
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
      // OPTICAL EFFECTS: Apply enhanced physics for photorealistic droplets
      this.applyGlassAdhesion(particle);
      this.applySurfaceTension(particle);
      this.applyGravity(particle);
      this.applyGlassFriction(particle);
      this.checkBoundaries(particle);
      this.updatePosition(particle);
    });
    
    // Check collisions between particles (optimized for photorealistic rendering)
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
  
  // MILESTONE 4 + SCALE UP: Size-based Surface Tension Forces
  applySurfaceTension(particle) {
    // Water molecules attract each other (cohesion) - stronger for larger droplets
    this.particles.forEach(otherParticle => {
      if (otherParticle === particle) return;
      
      const dx = otherParticle.x - particle.x;
      const dy = otherParticle.y - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Attraction range varies by particle sizes
      const combinedRadius = particle.radius + otherParticle.radius;
      const attractionRange = combinedRadius * 4; // Larger particles attract from further
      
      if (distance > 0 && distance < attractionRange) {
        // Attraction strength based on particle sizes
        const sizeMultiplier = (particle.mass + otherParticle.mass) / 2;
        const attractionStrength = (attractionRange - distance) / attractionRange * 0.0005 * sizeMultiplier;
        
        // Pull particles toward each other
        particle.vx += (dx / distance) * attractionStrength;
        particle.vy += (dy / distance) * attractionStrength;
      }
    });
  }
  
  applyGravity(particle) {
    // SCALE UP PHASE 2: Enhanced size-based gravity for 4 categories
    let gravityStrength;
    if (particle.size === 'tiny') {
      gravityStrength = 0.00005;     // Tiny droplets barely affected
    } else if (particle.size === 'small') {
      gravityStrength = 0.0001;      // Small droplets fall very slowly
    } else if (particle.size === 'medium') {
      gravityStrength = 0.0003;      // Medium droplets fall normally
    } else {
      gravityStrength = 0.0006;      // Large droplets fall faster
    }
    
    particle.vy -= gravityStrength;
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