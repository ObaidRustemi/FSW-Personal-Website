// Weather Controller - Toggles between Snow (main page) and Rain (overlay menu)
// Snow ❄️ on landing page → Rain 🌧️ when menu opens

import SnowSystem from './snow-system.js';

console.log('Weather controller - initializing...');

// Initialize systems
let snowSystem = null;
let raindropFx = null;
let isRainInitialized = false;

// Composite background state (for live snow behind glass)
let compositeCanvas = null;
let compositeCtx = null;
let cityBackgroundImage = null;
let animationFrameId = null;
let updateComposite = null;

const toggler = document.querySelector('.menu-wrap .toggler');
const rainCanvas = document.querySelector('#rain-glass');

if (!toggler) {
  console.error('Menu toggler not found!');
}

if (!rainCanvas) {
  console.error('Rain canvas not found!');
}

// ❄️ SNOW SYSTEM (Main Page)
function initSnow() {
  if (snowSystem) return;
  
  console.log('Initializing snow system for main page...');
  
  // Create snow container if it doesn't exist
  let snowContainer = document.getElementById('snow-container');
  if (!snowContainer) {
    snowContainer = document.createElement('div');
    snowContainer.id = 'snow-container';
    snowContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 1;
    `;
    document.body.insertBefore(snowContainer, document.body.firstChild);
  }

  snowSystem = new SnowSystem('snow-container');
  snowSystem.start();
}

function startSnow() {
  if (snowSystem) {
    snowSystem.start();
    console.log('Snow system - started');
  }
}

function stopSnow() {
  if (snowSystem) {
    snowSystem.stop();
    console.log('Snow system - stopped');
  }
}

// 🌧️ RAIN SYSTEM (Overlay Menu) - Pre-initialize for instant startup
async function preInitRain() {
  if (!rainCanvas || isRainInitialized) return;
  
  console.log('Pre-initializing rain system for instant startup...');
  
  // Resize canvas to match window
  function resizeCanvas() {
    const rect = rainCanvas.getBoundingClientRect();
    rainCanvas.width = rect.width;
    rainCanvas.height = rect.height;
  }
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Load city background image
  cityBackgroundImage = new Image();
  cityBackgroundImage.src = '/city-night-bg.jpg';
  await new Promise((resolve, reject) => {
    cityBackgroundImage.onload = resolve;
    cityBackgroundImage.onerror = reject;
  });

  console.log('City background image pre-loaded');

  // Initialize RaindropFX with just the city background
  // The snow layer will be visible THROUGH the glass via canvas blend mode
  raindropFx = new RaindropFX({
    canvas: rainCanvas,
    background: cityBackgroundImage,

    // Rendering options - SHARP background with MODERATE mist
    backgroundBlurSteps: 2,
    mist: true,
    mistColor: [0.04, 0.05, 0.06, 0.7],
    mistTime: 8,
    mistBlurStep: 3,

    // Droplet spawning - GENTLE rain
    dropletsPerSeconds: 40,
    dropletSize: [8, 25],

    // Raindrop appearance - SUBTLE refraction (realistic)
    smoothRaindrop: [0.96, 1.0],
    refractBase: 0.3,
    refractScale: 0.4,
    raindropCompose: "smoother",

    // Lighting - Subtle glass/water properties
    raindropLightPos: [-1, 1, 2, 0],
    raindropDiffuseLight: [0.3, 0.3, 0.3],
    raindropShadowOffset: 0.6,
    raindropSpecularLight: [0.2, 0.2, 0.2],
    raindropSpecularShininess: 128,
    raindropLightBump: 0.7,
    raindropEraserSize: [0.88, 1.05],

    // Physics simulation - GENTLE
    spawnInterval: [0.03, 0.12],
    spawnSize: [60, 150],
    spawnLimit: 800,
    slipRate: 0.6,
    motionInterval: [0.2, 0.8],
    xShifting: [0.0, 0.06],
    colliderSize: 0.8,
    trailDropDensity: 0.2,
    trailDropSize: [0.3, 0.5],
    trailDistance: [20, 30],
    trailSpread: 0.4,
    initialSpread: 0.5,
    shrinkRate: 0.015,
    velocitySpread: 0.3,
    evaporate: 15,
    gravity: 1200,
  });

  isRainInitialized = true;
  console.log("RaindropFX pre-initialized and ready for instant startup");
}

function startRain() {
  if (!raindropFx || !isRainInitialized) {
    console.error('Rain not initialized yet!');
    return;
  }
  
  raindropFx.start();
  console.log("Rain system - started instantly!");
}

function stopRain() {
  if (raindropFx && isRainInitialized) {
    raindropFx.stop();
    console.log("Rain system - stopped");
  }
}

// 🌦️ WEATHER TOGGLE - Wire to menu toggler
// Snow ALWAYS runs, rain ADDS on top when menu opens (layered effect)
if (toggler && rainCanvas) {
  toggler.addEventListener('change', () => {
    if (toggler.checked) {
      // Menu opened - KEEP snow running, ADD rain on top
      console.log('Menu opened - starting rain (snow visible behind glass)...');
      startRain();
    } else {
      // Menu closed - STOP rain, snow continues
      console.log('Menu closed - stopping rain (snow continues)...');
      stopRain();
    }
  });
  
  console.log('Weather controller - wired to menu toggler (layered mode)');
} else {
  console.error('Weather controller - missing canvas or toggler');
}

// 🚀 INITIALIZE ON PAGE LOAD
if (typeof RaindropFX !== 'undefined') {
  // Wait for DOM to be fully ready, then pre-init both systems
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await preInitRain();
      initSnow(); // Start snow immediately on page load
    });
  } else {
    // DOM already loaded
    (async () => {
      await preInitRain();
      initSnow(); // Start snow immediately on page load
    })();
  }
} else {
  console.error('RaindropFX library not loaded!');
}

