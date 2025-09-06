/**
 * 🌊 WATER SHADER SYSTEM
 * 
 * Advanced WebGL water droplet effects using Three.js shaders
 * Based on photorealistic water rendering techniques
 * Fallback: CSS droplet system in menu.css
 */

import * as THREE from 'three';

// Disable dynamic rendering in automated tests for deterministic screenshots
const TEST_MODE = (typeof navigator !== 'undefined' && navigator.webdriver === true) ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('testMode')) ||
  (typeof document !== 'undefined' && document.documentElement?.dataset?.disableRain === '1');

// SHADER 2: Create basic canvas element for WebGL
console.log('🌊 SHADER SYSTEM: Initializing...');

// SHADER 3: Three.js scene, camera, renderer
let scene, camera, renderer;
let waterCanvas;

function initThreeJS() {
  console.log('🌊 SHADER 3: Initializing Three.js scene...');
  
  // Scene setup
  scene = new THREE.Scene();
  
  // Camera setup (orthographic for 2D overlay effect)
  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 10);
  camera.position.z = 1;
  
  // Renderer setup
  renderer = new THREE.WebGLRenderer({
    canvas: waterCanvas,
    alpha: true,
    antialias: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  console.log('✅ SHADER 3: Three.js initialized');
  
  // Handle window resize
  window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = -aspect;
  camera.right = aspect;
  camera.updateProjectionMatrix();
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  // Update resolution uniform for shader
  if (waterMaterial && waterMaterial.uniforms && waterMaterial.uniforms.uResolution) {
    waterMaterial.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  }
}

// SHADER 7: Test basic shader material loads correctly
let waterPlane;
let waterMaterial;
let startTime = Date.now();

async function loadShaderFiles() {
  console.log('🌊 SHADER 7: Loading shader files...');
  
  try {
    // Load vertex shader
    const vertexResponse = await fetch('./water.vert');
    const vertexShader = await vertexResponse.text();
    
    // Load fragment shader  
    const fragmentResponse = await fetch('./water.frag');
    const fragmentShader = await fragmentResponse.text();
    
    console.log('✅ SHADER 7: Shader files loaded successfully');
    return { vertexShader, fragmentShader };
  } catch (error) {
    console.error('❌ SHADER 7: Failed to load shader files:', error);
    return null;
  }
}

async function createWaterShaderPlane() {
  console.log('🌊 SHADER 7: Creating water shader plane...');
  
  // Load shader files
  const shaders = await loadShaderFiles();
  if (!shaders) {
    console.error('❌ SHADER 7: Could not load shaders, falling back to basic material');
    return createFallbackPlane();
  }
  
  // Create a plane geometry with subdivisions to show noise displacement
  const geometry = new THREE.PlaneGeometry(2, 2, 32, 32); // 32x32 subdivisions
  
  // Create shader material with our custom shaders
  waterMaterial = new THREE.ShaderMaterial({
    vertexShader: shaders.vertexShader,
    fragmentShader: shaders.fragmentShader,
    uniforms: {
      uTime: { value: 0.0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uWaterColor: { value: new THREE.Vector3(0.0, 0.5, 1.0) } // Blue water color
    },
    transparent: true,
    side: THREE.DoubleSide
  });
  
  // Create the mesh
  waterPlane = new THREE.Mesh(geometry, waterMaterial);
  scene.add(waterPlane);
  
  console.log('✅ SHADER 7: Water shader plane added to scene');
}

function createFallbackPlane() {
  console.log('🌊 SHADER 7: Creating fallback plane...');
  
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0x0088ff,
    transparent: true,
    opacity: 0.3
  });
  
  waterPlane = new THREE.Mesh(geometry, material);
  scene.add(waterPlane);
  
  console.log('✅ SHADER 7: Fallback plane added to scene');
}

function animate() {
  requestAnimationFrame(animate);
  
  // Update time uniform for shader animation
  if (waterMaterial && waterMaterial.uniforms && waterMaterial.uniforms.uTime) {
    const elapsedTime = (Date.now() - startTime) / 1000.0;
    waterMaterial.uniforms.uTime.value = elapsedTime;
  }
  
  // Render the scene
  renderer.render(scene, camera);
}

async function startShaderSystem() {
  console.log('🌊 Starting shader system...');
  await createWaterShaderPlane();
  animate();
  console.log('✅ Shader system running');
}

// Create canvas element for WebGL rendering
function createWaterCanvas() {
  const canvas = document.createElement('canvas');
  canvas.id = 'water-shader-canvas';
  canvas.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 8;
  `;
  
  console.log('🌊 SHADER 2: Canvas element created');
  return canvas;
}

// Add canvas to menu overlay when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const menuOverlay = document.querySelector('.menu-overlay');
  if (menuOverlay) {
    if (TEST_MODE) {
      // In test mode, skip rendering to keep visuals stable
      setupMenuAutoClose();
      console.log('🧪 TEST_MODE: Skipping shader system');
      return;
    }
    waterCanvas = createWaterCanvas();
    menuOverlay.appendChild(waterCanvas);
    console.log('✅ SHADER 2: Canvas added to menu overlay');
    
    // Initialize Three.js after canvas is in DOM
    initThreeJS();
    
    // Start the shader system (async)
    await startShaderSystem();
    
    // Set up auto-close menu for internal navigation links
    setupMenuAutoClose();
  } else {
    console.warn('❌ SHADER 2: Menu overlay not found');
  }
});

// Auto-close menu when internal navigation links are clicked
function setupMenuAutoClose() {
  console.log('🔧 Setting up menu auto-close for internal links...');
  
  // Find all internal navigation links (not external links with target="_blank")
  const internalLinks = document.querySelectorAll('.menu-content a:not([target="_blank"])');
  const toggler = document.querySelector('.toggler');
  
  if (!toggler) {
    console.warn('❌ Toggler not found for auto-close setup');
    return;
  }
  
  internalLinks.forEach(link => {
    link.addEventListener('click', () => {
      console.log('🔧 Internal link clicked, closing menu...');
      // Uncheck the toggler to close the menu
      toggler.checked = false;
    });
  });
  
  console.log(`✅ Auto-close setup complete for ${internalLinks.length} internal links`);
}

console.log('🌊 SHADER SYSTEM: Module loaded');
