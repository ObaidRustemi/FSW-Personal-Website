// Canvas2D compositor for rain-on-glass effect integrated with the menu overlay
// Lightweight MVP: capture overlay background on open, render refractive droplets

const DPR_CAP = 2; // performance cap
const urlParams = (typeof window !== 'undefined') ? new URLSearchParams(window.location.search) : new URLSearchParams('');
const TEST_MODE = (typeof navigator !== 'undefined' && (navigator.webdriver === true)) ||
  (typeof window !== 'undefined' && (urlParams.has('testMode') || document.documentElement?.dataset?.disableRain === '1'));

class RainOnGlass {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    this.drops = [];
    this.micro = [];
    this.condensation = []; // Fine condensation droplets for sparkling effect
    this.running = false;
    this.last = 0;
    this.hasBackground = false;
    this.testMode = false; // Initialize testMode property

    // offscreen buffers for sharp/blurred background
    this.bgSharp = document.createElement('canvas');
    this.bgBlur = document.createElement('canvas');
    this.bgSharpCtx = this.bgSharp.getContext('2d', { willReadFrequently: true });
    this.bgBlurCtx = this.bgBlur.getContext('2d', { willReadFrequently: true });
    
    // Multi-pass blur system (inspired by WebGL implementation)
    this.blurSteps = []; // Array of canvas buffers for downsampling/upsampling
    this.blurIterations = 4; // Number of blur passes
    // optional miniature reflection buffer (RainyDay-style)
    this.bgMini = document.createElement('canvas');
    this.bgMiniCtx = this.bgMini.getContext('2d');
    this.miniInverted = true; // 180° inverted by default
    
    // trail buffer for condensation trails and water film
    this.trailBuffer = document.createElement('canvas');
    this.trailCtx = this.trailBuffer.getContext('2d', { willReadFrequently: true });

    const q = urlParams;

    // optional collision grid
    this.enableCollisions = (q.get('collisions') ?? '') !== '0' && (options.enableCollisions ?? true);
    this.collisionCell = Number(q.get('cell')) || options.collisionCell || 40; // px in device space
    this.grid = null; // lazily created

    // gravity configuration (angle in degrees for ergonomics)
    const gravityDeg = Number(q.get('gravityDeg')) || options.gravityDeg || 90; // 90 = down
    this.gravityAngleRad = (gravityDeg * Math.PI) / 180;
    // Align to rainyday-style options
    this.blurPx = Number(q.get('blur')) || options.blur || 8; // background blur strength
    this.fps = Number(q.get('fps')) || options.fps || 60;
    this.gravityBase = Number(q.get('gravity')) || options.gravity || 0.6; // base scalar (increased for proper fall)
    this.gravityVariance = Number(q.get('gravVar')) || options.gravityVariance || 0; // 0..1 small randomness
    this.gravityThreshold = Number(q.get('gravityThreshold')) || options.gravityThreshold || 3; // px

    // trails configuration
    this.enableSmudgeTrail = (q.get('smudge') ?? options.smudge ?? '1') !== '0';
    this.trailThresholdPx = Number(q.get('trailStep')) || options.trailStep || 50; // distance to leave smudge
    
    // condensation configuration
    this.enableCondensation = (q.get('condensation') ?? options.condensation ?? '1') !== '0';
    this.condensationDensity = Number(q.get('condDensity')) || options.condensationDensity || 0.8; // Increased for dense coverage
    this.condensationSize = Number(q.get('condSize')) || options.condensationSize || 1.2; // Larger micro-droplets
    this.condensationSparkle = Number(q.get('condSparkle')) || options.condensationSparkle || 0.9; // More sparkle
    
    // enhanced physics configuration
    this.enableTrails = (q.get('trails') ?? options.enableTrails ?? '1') !== '0';
    this.dragCoeff = Number(q.get('drag')) || options.dragCoeff || 0.8; // drag coefficient
    this.windX = Number(q.get('windX')) || options.windX || 0; // wind force X
    this.windY = Number(q.get('windY')) || options.windY || 0; // wind force Y
    this.adhesionBase = Number(q.get('adhesion')) || options.adhesionBase || 0.92; // base adhesion (stickiness)
    this.slideThreshold = Number(q.get('slideThreshold')) || options.slideThreshold || 8; // radius threshold for sliding
    this.terminalVelocity = Number(q.get('terminalVel')) || options.terminalVelocity || 15; // max fall speed
    
    // control panel properties
    this.sizeVariance = Number(q.get('sizeVariance')) || options.sizeVariance || 1.0; // drop size variance multiplier
    this.trailIntensity = Number(q.get('trailIntensity')) || options.trailIntensity || 0.5; // trail intensity multiplier
    
    // Advanced physics parameters (inspired by RaindropFX)
    this.trailDropDensity = Number(q.get('trailDensity')) || options.trailDropDensity || 0.2; // density of trail droplets
    this.trailDistance = [Number(q.get('trailDistMin')) || options.trailDistance?.[0] || 20, 
                         Number(q.get('trailDistMax')) || options.trailDistance?.[1] || 30]; // trail droplet spacing
    this.trailDropSize = [Number(q.get('trailSizeMin')) || options.trailDropSize?.[0] || 0.3,
                         Number(q.get('trailSizeMax')) || options.trailDropSize?.[1] || 0.5]; // trail droplet size range
    this.trailSpread = Number(q.get('trailSpread')) || options.trailSpread || 0.6; // trail spread factor
    this.velocitySpread = Number(q.get('velocitySpread')) || options.velocitySpread || 0.3; // velocity-based spread
    this.evaporate = Number(q.get('evaporate')) || options.evaporate || 10; // evaporation rate
    this.shrinkRate = Number(q.get('shrinkRate')) || options.shrinkRate || 0.01; // size shrinking rate
    this.xShifting = [Number(q.get('xShiftMin')) || options.xShifting?.[0] || 0,
                     Number(q.get('xShiftMax')) || options.xShifting?.[1] || 0.1]; // horizontal drift range
    this.slipRate = Number(q.get('slipRate')) || options.slipRate || 0.1; // slip rate for random motion
    
    // Advanced rendering parameters - Enhanced for micro-lens effect
    this.refractBase = Number(q.get('refractBase')) || options.refractBase || 0.8; // base refraction strength (increased for stronger lens effect)
    this.refractScale = Number(q.get('refractScale')) || options.refractScale || 1.2; // refraction scaling (increased for stronger lens effect)
    this.raindropLightPos = options.raindropLightPos || [-1, 1, 2, 0]; // light position for highlights
    this.raindropDiffuseLight = options.raindropDiffuseLight || [0.2, 0.2, 0.2]; // diffuse lighting
    this.raindropShadowOffset = Number(q.get('shadowOffset')) || options.raindropShadowOffset || 0.8; // shadow offset
    this.raindropLightBump = Number(q.get('lightBump')) || options.raindropLightBump || 1; // lighting bump factor

    // standalone/demo configuration
    this.standalone = Boolean(options.standalone);
    this.backgroundSource = options.backgroundSource; // 'body' | HTMLElement | selector
    this.bgSourceEl = null;

    // atmosphere & readability helpers
    this.saturation = (typeof options.saturation === 'number') ? options.saturation : (urlParams.has('sat') ? Math.max(0, Math.min(1, Number(urlParams.get('sat')))) : 0.85);
    this.fogEnabled = (urlParams.get('fog') ?? (options.fog ?? '1')) !== '0';
    this.fogStrength = (typeof options.fogStrength === 'number') ? options.fogStrength : (urlParams.has('fogStrength') ? Math.max(0, Math.min(0.25, Number(urlParams.get('fogStrength')))) : 0.08);
    this.avgLuma = 0;
    this.overlayEl = this.standalone ? null : document.querySelector('.menu .menu-overlay');

    // miniature reflection/refraction options
    this.useMiniRefraction = (options.useMiniRefraction !== undefined) ? Boolean(options.useMiniRefraction) : (urlParams.get('mini') !== '0'); // default ON
    this.miniBoost = (options.miniBoost !== undefined) ? Boolean(options.miniBoost) : (urlParams.get('miniBoost') !== '0' && urlParams.get('boost') !== '0'); // default ON
    this.reflectionScaledownFactor = Number(options.reflectionScaledownFactor) || 2; // lower = higher cost/quality
    this.reflectionDropMappingWidth = Number(options.reflectionDropMappingWidth) || 200;   // device px
    this.reflectionDropMappingHeight = Number(options.reflectionDropMappingHeight) || 200; // device px
    this.miniMagnification = Number(options.miniMagnification) || 1.16; // stronger lens when boosted
    this.miniOffsetScale = Number(options.miniOffsetScale) || 1.35;     // boosts offsetX/offsetY



    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();

    // preset-based spawner (min, base, ratePerSecond, count optional)
    // Enhanced rates for more drops
    this.presets = [
      { min: 1, base: 2.5, rate: 9 },   // micro beads (denser)
      { min: 3, base: 4.5, rate: 7 },   // small
      { min: 6, base: 8.5, rate: 4 },   // medium
      { min: 12, base: 16, rate: 0.8 }  // big
    ];
    // accumulators for fractional spawning
    this._spawnAcc = this.presets.map(() => 0);

    // preset API timer
    this._rainTimer = null;
    this._resizeTimer = null;
  }

  async captureBackground() {
    // In test mode, skip capturing to keep screenshots deterministic
    if (TEST_MODE) {
      this.hasBackground = false;
      return;
    }
    if (this.standalone) {
      return this.captureBackgroundStandalone();
    }
    const overlay = document.querySelector('.menu .menu-overlay');
    if (!overlay) return;
    // Allow layout/transform to apply after menu toggle
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const rect = overlay.getBoundingClientRect();
    if (!rect || rect.width < 2 || rect.height < 2) {
      // If overlay rect is not measurable yet, skip capture now
      this.hasBackground = false;
      return;
    }
    const w = Math.ceil(rect.width * this.dpr);
    const h = Math.ceil(rect.height * this.dpr);
    this.bgSharp.width = this.bgBlur.width = w;
    this.bgSharp.height = this.bgBlur.height = h;

    try {
      // use html2canvas to snapshot the viewport region under the overlay
      const shot = await html2canvas(document.body, {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        scale: this.dpr,
        backgroundColor: null,
        useCORS: true
      });
      if (shot && shot.width > 0 && shot.height > 0) {
      this.bgSharpCtx.drawImage(shot, 0, 0);
        if (this.saturation < 1) this.applyDesaturate(this.bgSharpCtx, this.bgSharp.width, this.bgSharp.height, this.saturation);
      } else {
        // Invalid shot; mark as no background captured
        this.hasBackground = false;
        return;
      }
      // Deterministic JS blur: draw sharp → apply box blur into bgBlur
      this.bgBlurCtx.clearRect(0, 0, this.bgBlur.width, this.bgBlur.height);
      this.bgBlurCtx.drawImage(this.bgSharp, 0, 0);
      this.applyBoxBlur(this.bgBlurCtx, this.bgBlur.width, this.bgBlur.height, Math.max(0, Math.floor(this.blurPx)));

      this.hasBackground = true;
      // compute luminance from downscaled buffer and tune overlay for text readability
      this.computeAverageLuminance();
      this.applyOverlayTuning();
    } catch (e) {
      // fallback: clear buffers
      this.bgSharpCtx.clearRect(0, 0, this.bgSharp.width, this.bgSharp.height);
      this.bgBlurCtx.clearRect(0, 0, this.bgBlur.width, this.bgBlur.height);
      // eslint-disable-next-line no-console
      console.warn('RainOnGlass background capture failed:', e);
      this.hasBackground = false;
    }
  }

  async captureBackgroundStandalone() {
    try {
      // Determine capture target and dimensions
      let targetEl = null;
      if (this.backgroundSource === 'body' || !this.backgroundSource) {
        targetEl = document.body;
      } else if (typeof this.backgroundSource === 'string') {
        targetEl = document.querySelector(this.backgroundSource);
      } else if (this.backgroundSource instanceof HTMLElement) {
        targetEl = this.backgroundSource;
      }
      if (!targetEl) targetEl = document.body;

      // Compute capture rect in CSS pixels
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rect = (targetEl === document.body)
        ? { left: 0, top: 0, width: vw, height: vh }
        : targetEl.getBoundingClientRect();
      if (!rect || rect.width < 2 || rect.height < 2) {
        this.hasBackground = false;
        return;
      }

      const w = Math.ceil(rect.width * this.dpr);
      const h = Math.ceil(rect.height * this.dpr);
      this.bgSharp.width = this.bgBlur.width = w;
      this.bgSharp.height = this.bgBlur.height = h;
      this.trailBuffer.width = w;
      this.trailBuffer.height = h;
      this.bgMini.width = Math.max(1, Math.floor(w / 2));
      this.bgMini.height = Math.max(1, Math.floor(h / 2));

      // If target is an IMG element and complete, draw directly for speed
      if (targetEl.tagName === 'IMG' && targetEl.complete && targetEl.naturalWidth > 0) {
        this.bgSharpCtx.drawImage(targetEl, 0, 0, w, h);
        if (this.saturation < 1) this.applyDesaturate(this.bgSharpCtx, this.bgSharp.width, this.bgSharp.height, this.saturation);
      } else {
        const shot = await html2canvas(targetEl, {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          scale: this.dpr,
          backgroundColor: null,
          useCORS: true
        });
        if (!shot || shot.width === 0 || shot.height === 0) {
          this.hasBackground = false;
          return;
        }
        this.bgSharpCtx.drawImage(shot, 0, 0);
        if (this.saturation < 1) this.applyDesaturate(this.bgSharpCtx, this.bgSharp.width, this.bgSharp.height, this.saturation);
      }

      // Create blurred buffer using multi-pass blur system
      this.bgBlurCtx.clearRect(0, 0, this.bgBlur.width, this.bgBlur.height);
      this.bgBlurCtx.drawImage(this.bgSharp, 0, 0);
      
      // Use new multi-pass blur for higher quality
      const blurStrength = Math.max(0, Math.floor(this.blurPx));
      if (blurStrength > 0) {
        this.multiPassBlur(this.bgSharp, this.bgBlur, blurStrength);
      } else {
        // No blur needed, just copy
        this.bgBlurCtx.drawImage(this.bgSharp, 0, 0);
      }

      // Create miniature inverted buffer for optional higher-contrast refraction feel
      try {
        const mx = this.bgMiniCtx;
        mx.setTransform(1, 0, 0, 1, 0, 0);
        mx.clearRect(0, 0, this.bgMini.width, this.bgMini.height);
        mx.translate(this.bgMini.width / 2, this.bgMini.height / 2);
        if (this.miniInverted) mx.rotate(Math.PI);
        mx.drawImage(this.bgSharp, -this.bgMini.width / 2, -this.bgMini.height / 2, this.bgMini.width, this.bgMini.height);
      } catch(_) {}

      this.hasBackground = true;
      // Evaluate luminance for potential overlay tuning (noop in standalone)
      this.computeAverageLuminance();
    } catch (e) {
      this.bgSharpCtx.clearRect(0, 0, this.bgSharp.width, this.bgSharp.height);
      this.bgBlurCtx.clearRect(0, 0, this.bgBlur.width, this.bgBlur.height);
      // eslint-disable-next-line no-console
      console.warn('RainOnGlass standalone capture failed:', e);
      this.hasBackground = false;
    }
  }

  // Simple separable box blur (two-pass) for determinism across browsers
  applyBoxBlur(ctx, w, h, radius) {
    if (radius <= 0) return;
    try {
      const img = ctx.getImageData(0, 0, w, h);
      const data = img.data;
      const tmp = new Uint8ClampedArray(data.length);
      const pass = (src, dst, r, horizontal) => {
        const lenOuter = horizontal ? h : w;
        const lenInner = horizontal ? w : h;
        const step = 4;
        const line = new Float32Array(lenInner * 4);
        for (let outer = 0; outer < lenOuter; outer++) {
          // collect line
          for (let inner = 0; inner < lenInner; inner++) {
            const idx = horizontal ? (outer * w + inner) * 4 : (inner * w + outer) * 4;
            line[inner * 4 + 0] = src[idx + 0];
            line[inner * 4 + 1] = src[idx + 1];
            line[inner * 4 + 2] = src[idx + 2];
            line[inner * 4 + 3] = src[idx + 3];
          }
          // box window
          const windowSize = r * 2 + 1;
          let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
          for (let i = -r; i <= r; i++) {
            const k = Math.min(lenInner - 1, Math.max(0, i));
            sumR += line[k * 4 + 0];
            sumG += line[k * 4 + 1];
            sumB += line[k * 4 + 2];
            sumA += line[k * 4 + 3];
          }
          for (let inner = 0; inner < lenInner; inner++) {
            const outIdx = horizontal ? (outer * w + inner) * 4 : (inner * w + outer) * 4;
            dst[outIdx + 0] = sumR / windowSize | 0;
            dst[outIdx + 1] = sumG / windowSize | 0;
            dst[outIdx + 2] = sumB / windowSize | 0;
            dst[outIdx + 3] = sumA / windowSize | 0;
            // slide window
            const iRemove = inner - r;
            const iAdd = inner + r + 1;
            const kRemove = Math.min(lenInner - 1, Math.max(0, iRemove));
            const kAdd = Math.min(lenInner - 1, Math.max(0, iAdd));
            sumR += line[kAdd * 4 + 0] - line[kRemove * 4 + 0];
            sumG += line[kAdd * 4 + 1] - line[kRemove * 4 + 1];
            sumB += line[kAdd * 4 + 2] - line[kRemove * 4 + 2];
            sumA += line[kAdd * 4 + 3] - line[kRemove * 4 + 3];
          }
        }
      };
      pass(data, tmp, radius, true);
      pass(tmp, data, radius, false);
      ctx.putImageData(img, 0, 0);
    } catch(_) {
      // fallback: leave as-is
    }
  }

  // Apply saturation adjustment using luminance mix method
  applyDesaturate(ctx, w, h, saturation) {
    try {
      // Use CSS filter on a temp canvas to avoid per-pixel JS loop on large frames
      const tmp = document.createElement('canvas');
      tmp.width = w; tmp.height = h;
      const tctx = tmp.getContext('2d');
      const satPct = Math.round(Math.max(0, Math.min(1, saturation)) * 100);
      tctx.filter = `saturate(${satPct}%)`;
      tctx.drawImage(this.bgSharp, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tmp, 0, 0);
    } catch (_) {}
  }

  start() {
    if (TEST_MODE) return; // do not animate in tests
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    

    
    // initial population (tunable, with mobile-aware defaults)
    const isMobile = (typeof window !== 'undefined') && (window.matchMedia?.('(max-width: 768px)').matches || 'ontouchstart' in window.navigator || /Mobi|Android/i.test(window.navigator.userAgent));
    const defaultDensity = isMobile ? 26 : 42;  // Denser default population
    this.initialDensity = Number(urlParams.get('density')) || defaultDensity;
    this.maxDrops = Number(urlParams.get('maxDrops')) || 180;  // Higher cap
    this.spawnChance = Number(urlParams.get('spawn')) || 0.42; // Higher spawn rate
    for (let i = 0; i < this.initialDensity; i++) this.spawn();
    requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    this.drops.length = 0;
    this.micro.length = 0;
    this.clear();
  }

  pause() {
    this.running = false;
    // Don't clear drops - keep them frozen in place
  }

  resume() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.canvas.width = vw * this.dpr;
    this.canvas.height = vh * this.dpr;
    this.canvas.style.width = vw + 'px';
    this.canvas.style.height = vh + 'px';
    // re-apply overlay tuning on resize
    this.applyOverlayTuning();
    // In standalone mode, recapture background on resize (debounced)
    if (this.standalone && !TEST_MODE) {
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => { this.captureBackgroundStandalone().then(() => this.render()); }, 120);
    }
  }

  clear() {
    // Clear in device pixel space with identity transform
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  computeAverageLuminance() {
    try {
      if (!this.bgSharp || this.bgSharp.width === 0 || this.bgSharp.height === 0) return 0;
      const step = 16; // sample grid step for performance
      const w = this.bgSharp.width, h = this.bgSharp.height;
      const ctx = this.bgSharpCtx;
      const img = ctx.getImageData(0, 0, w, h).data;
      let sum = 0, count = 0;
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          const i = (y * w + x) * 4;
          const r = img[i], g = img[i+1], b = img[i+2];
          // Rec. 709 luma
          const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          sum += l; count++;
        }
      }
      this.avgLuma = count ? (sum / count) : 0;
      return this.avgLuma;
    } catch (_) {
      return 0;
    }
  }

  applyOverlayTuning() {
    if (TEST_MODE) return; // keep tests deterministic
    const el = this.overlayEl;
    if (!el) return;
    const luma = this.avgLuma || 0;
    // default CSS values
    let blurPx = 7;
    let alpha = 0.17;
    if (luma > 180) { // very bright background/text -> increase separation
      blurPx = 10; alpha = 0.22;
    } else if (luma > 120) { // moderately bright
      blurPx = 8.5; alpha = 0.19;
    }
    el.style.backdropFilter = `blur(${blurPx}px)`;
    el.style.backgroundColor = `rgba(255,255,255,${alpha})`;
  }



  spawn(x, y, r) {
    // Organic size distribution using natural variations
    let radius;
    if (r) {
      radius = r;
    } else {
      // Use natural drop size variations
      const baseSize = 8; // Base medium drop size
      const sizeVariation = 0.4; // 40% variation
      radius = window.RainUtils?.naturalDropSize(baseSize, sizeVariation) || (baseSize + Math.random() * baseSize * sizeVariation);
      
      // More random size distribution with higher variation
      const sizeCategory = Math.random();
      if (sizeCategory < 0.4) {
        // Small drops (40%) - 3-10px base with high variation
        radius = window.RainUtils?.naturalDropSize(6, 0.6) || (6 + Math.random() * 4);
      } else if (sizeCategory < 0.8) {
        // Medium drops (40%) - 8-20px base with high variation
        radius = window.RainUtils?.naturalDropSize(14, 0.5) || (14 + Math.random() * 6);
      } else {
        // Large drops (20%) - 15-30px base with high variation
        radius = window.RainUtils?.naturalDropSize(22, 0.4) || (22 + Math.random() * 8);
      }
      radius *= this.dpr * this.sizeVariance; // Apply size variance multiplier
    }
    
    // Ensure minimum radius to prevent rendering errors
    radius = Math.max(0.5, radius);
    
    // Organic positioning using randomInRect for more natural distribution
    let spawnX, spawnY;
    if (x !== undefined) {
      spawnX = x;
    } else {
      // Use organic positioning within spawn area
      const spawnRect = window.RainUtils ? new window.RainUtils.Rect(radius, 0, this.canvas.width - 2 * radius, 50) : null;
      const organicPos = window.RainUtils ? window.RainUtils.randomInRect(spawnRect) : null;
      spawnX = organicPos ? organicPos.x : (radius + Math.random() * (this.canvas.width - 2 * radius));
    }
    
    if (y !== undefined) {
      spawnY = y;
    } else {
      // Organic Y positioning with natural variation
      const baseY = -radius - 50;
      const yVariation = window.RainUtils?.randomRange(0, 100) || Math.random() * 100;
      spawnY = baseY - yVariation * this.dpr;
    }
    
    this.drops.push({
      x: spawnX,
      y: spawnY,
      r: radius,
      // More random velocity variations
      vx: window.RainUtils?.randomRange(-0.8, 0.8) || ((Math.random() - 0.5) * 0.8),
      vy: 0,
      stretch: 1,
      // More random adhesion with higher variation
      stick: window.RainUtils?.randomJittered(new window.RainUtils.JitterOption(this.adhesionBase, 0.15)) || (this.adhesionBase + Math.random() * 0.15),
      label: (urlParams.get('debugRain') === '1') && Math.random() < 0.2,
      shapePoints: null,
      _shapeDirty: false,
      // Enhanced physics properties with organic variations
      mass: radius * radius, // mass ∝ r²
      prevX: spawnX,
      prevY: spawnY,
      adhesion: this.adhesionBase,
      _trailAccumulated: 0,
      // Advanced physics properties with natural variations
      density: window.RainUtils?.randomJittered(new window.RainUtils.JitterOption(1.0, 0.1)) || 1.0, // Organic density variation
      spread: { x: 0, y: 0 }, // Shape deformation
      resistance: 0, // Dynamic friction
      shifting: 0, // Horizontal drift
      lastTrailPos: { x: spawnX, y: spawnY },
      // Organic trail spacing with natural variation
      nextTrailDistance: window.RainUtils?.randomRange(15, 35) || (20 + Math.random() * 20),
      nextRandomTime: 0, // Random motion timing
      // Unique seed for organic variations
      _organicSeed: Math.floor(Math.random() * 10000)
    });
  }

  // Random motion system inspired by RainDrop class
  randomMotion(drop) {
    try {
      // Calculate maximum resistance based on drop size and slip rate
      const maxResistance = (8 + Math.random() * 8) * (1 - this.slipRate) ** 2 * 4;
      drop.resistance = Math.random() * this.gravityBase * maxResistance;
      drop.shifting = Math.random() * (this.xShifting[0] + Math.random() * (this.xShifting[1] - this.xShifting[0]));
    } catch (error) {
      console.warn('Error in randomMotion:', error);
    }
  }

  // Multi-pass blur system (inspired by WebGL BlurRenderer)
  initBlurSteps(width, height) {
    // Initialize blur step canvases if needed
    for (let i = 0; i <= this.blurIterations; i++) {
      if (!this.blurSteps[i]) {
        this.blurSteps[i] = document.createElement('canvas');
        this.blurSteps[i].getContext('2d');
      }
      
      // Calculate size for this step (downsampling)
      const stepWidth = Math.max(1, Math.floor(width / Math.pow(2, i)));
      const stepHeight = Math.max(1, Math.floor(height / Math.pow(2, i)));
      
      // Resize if needed
      if (this.blurSteps[i].width !== stepWidth || this.blurSteps[i].height !== stepHeight) {
        this.blurSteps[i].width = stepWidth;
        this.blurSteps[i].height = stepHeight;
      }
    }
  }

  downSampleBlur(inputCanvas, iteration) {
    const ctx = this.blurSteps[iteration].getContext('2d');
    const inputCtx = inputCanvas.getContext('2d');
    
    // Clear the target canvas
    ctx.clearRect(0, 0, this.blurSteps[iteration].width, this.blurSteps[iteration].height);
    
    // Draw input at half size (downsampling)
    ctx.drawImage(inputCanvas, 0, 0, this.blurSteps[iteration].width, this.blurSteps[iteration].height);
    
    // Apply subtle blur for downsampling
    ctx.filter = 'blur(0.5px)';
    ctx.drawImage(inputCanvas, 0, 0, this.blurSteps[iteration].width, this.blurSteps[iteration].height);
    ctx.filter = 'none';
  }

  upSampleBlur(inputCanvas, iteration, targetWidth, targetHeight) {
    const ctx = this.blurSteps[iteration].getContext('2d');
    
    // Clear the target canvas
    ctx.clearRect(0, 0, this.blurSteps[iteration].width, this.blurSteps[iteration].height);
    
    // Draw input at double size (upsampling)
    ctx.drawImage(inputCanvas, 0, 0, this.blurSteps[iteration].width, this.blurSteps[iteration].height);
    
    // Apply subtle blur for upsampling
    ctx.filter = 'blur(0.5px)';
    ctx.drawImage(inputCanvas, 0, 0, this.blurSteps[iteration].width, this.blurSteps[iteration].height);
    ctx.filter = 'none';
  }

  multiPassBlur(sourceCanvas, targetCanvas, blurStrength = 1.0) {
    const sourceCtx = sourceCanvas.getContext('2d');
    const targetCtx = targetCanvas.getContext('2d');
    
    // Initialize blur steps
    this.initBlurSteps(sourceCanvas.width, sourceCanvas.height);
    
    // Step 0: Copy source to first blur step
    const step0Ctx = this.blurSteps[0].getContext('2d');
    step0Ctx.clearRect(0, 0, this.blurSteps[0].width, this.blurSteps[0].height);
    step0Ctx.drawImage(sourceCanvas, 0, 0);
    
    // Downsample: progressively reduce size
    let currentInput = this.blurSteps[0];
    for (let i = 1; i <= this.blurIterations; i++) {
      this.downSampleBlur(currentInput, i);
      currentInput = this.blurSteps[i];
    }
    
    // Upsample: progressively increase size back
    for (let i = this.blurIterations - 1; i >= 0; i--) {
      this.upSampleBlur(currentInput, i, this.blurSteps[i].width, this.blurSteps[i].height);
      currentInput = this.blurSteps[i];
    }
    
    // Final blur pass with configurable strength
    targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    targetCtx.filter = `blur(${blurStrength}px)`;
    targetCtx.drawImage(currentInput, 0, 0, targetCanvas.width, targetCanvas.height);
    targetCtx.filter = 'none';
  }

  spawnCondensation() {
    if (!this.enableCondensation || this.testMode || this.condensation.length >= 3000) return; // Increased limit
    
    // Spawn dense micro-condensation like the reference implementation
    const count = Math.floor(this.condensationDensity * 40 * Math.random()); // Much higher density
    for (let i = 0; i < count; i++) {
      const x = Math.random() * this.canvas.width;
      const y = Math.random() * this.canvas.height;
      const size = (0.2 + Math.random() * 1.8) * this.condensationSize * this.dpr; // More size variation
      
      this.condensation.push({
        x: x,
        y: y,
        r: size,
        sparkle: Math.random() * this.condensationSparkle,
        life: 0.6 + Math.random() * 0.8, // Longer life for dense coverage
        age: 0,
        twinkle: Math.random() * Math.PI * 2, // for sparkle animation
        _isMicroCondensation: true // Mark for special rendering
      });
    }
  }

  layTrail(drop, prevX, prevY) {
    try {
      if (!this.enableTrails || !this.trailCtx) return;
      
      // Enhanced trail parameters using RaindropFX-inspired system
      const baseWidth = Math.max(0.8, drop.r * 0.4 * this.trailSpread);
      const widthVariation = baseWidth * 0.3;
      const w = baseWidth + (Math.random() - 0.5) * widthVariation;
      
      // Enhanced trail visibility for realistic rivulets
      const trailSpeed = Math.hypot(drop.vx, drop.vy);
      const velocityFactor = Math.min(1, trailSpeed / 8); // Normalize speed
      const baseAlpha = Math.min(0.4, 0.1 + drop.r * 0.012 + velocityFactor * 0.15); // More visible trails
      const alphaVariation = baseAlpha * 0.3;
      const alpha = baseAlpha + (Math.random() - 0.5) * alphaVariation;
      
      // Enhanced horizontal drift using xShifting parameters
      const driftRange = this.xShifting[1] - this.xShifting[0];
      const drift = this.xShifting[0] + Math.random() * driftRange;
      const midX = (prevX + drop.x) / 2 + drift;
      const midY = (prevY + drop.y) / 2;
      
      this.trailCtx.save();
      // Skip white trail strokes in test mode
      if (!this.testMode) {
        this.trailCtx.strokeStyle = `rgba(255,255,255,${alpha})`;
        this.trailCtx.lineWidth = w;
        this.trailCtx.lineCap = 'round';
        this.trailCtx.globalCompositeOperation = 'lighter';
        
        // Draw curved trail for more natural water flow
        this.trailCtx.beginPath();
        this.trailCtx.moveTo(prevX, prevY);
        this.trailCtx.quadraticCurveTo(midX, midY, drop.x, drop.y);
        this.trailCtx.stroke();
      }
      this.trailCtx.restore();
      
      // Spawn trail droplets occasionally (inspired by RaindropFX)
      if (Math.random() < this.trailDropDensity * 0.1) {
        this.spawnTrailDroplet(drop, prevX, prevY);
      }
    } catch (error) {
      console.warn('Error in layTrail:', error);
    }
  }
  
  spawnTrailDroplet(parentDrop, prevX, prevY) {
    try {
      if (!this.enableTrails) return;
      
      // Create small trail droplet
      const trailSize = this.trailDropSize[0] + Math.random() * (this.trailDropSize[1] - this.trailDropSize[0]);
      const trailRadius = Math.max(0.5, parentDrop.r * trailSize); // Ensure minimum radius
      
      // Position along the trail path
      const t = Math.random();
      const x = prevX + (parentDrop.x - prevX) * t;
      const y = prevY + (parentDrop.y - prevY) * t;
      
      // Add some spread
      const spreadX = (Math.random() - 0.5) * this.trailSpread * 2;
      const spreadY = (Math.random() - 0.5) * this.trailSpread * 2;
      
      this.drops.push({
        x: x + spreadX,
        y: y + spreadY,
        r: trailRadius,
        vx: parentDrop.vx * 0.5 + (Math.random() - 0.5) * 0.2,
        vy: parentDrop.vy * 0.5 + (Math.random() - 0.5) * 0.2,
        stretch: 1,
        stick: this.adhesionBase + Math.random() * 0.06,
        label: false,
        shapePoints: null,
        _shapeDirty: false,
        mass: trailRadius * trailRadius,
        prevX: x + spreadX,
        prevY: y + spreadY,
        adhesion: this.adhesionBase,
        _trailAccumulated: 0,
        _isTrailDroplet: true // Mark as trail droplet
      });
    } catch (error) {
      console.warn('Error in spawnTrailDroplet:', error);
    }
  }

  evolveTrails() {
    try {
      if (!this.enableTrails || !this.trailCtx) return;
      
      // Evaporate: darken alpha a tiny bit (slower evaporation for longer trails)
      this.trailCtx.save();
      this.trailCtx.globalCompositeOperation = 'destination-out';
      this.trailCtx.fillStyle = 'rgba(0,0,0,0.005)'; // Reduced from 0.01 for longer-lasting trails
      this.trailCtx.fillRect(0, 0, this.trailBuffer.width, this.trailBuffer.height);
      this.trailCtx.restore();
      
      // Diffuse: soft blur to widen rivulets (more subtle blur)
      this.trailCtx.save();
      this.trailCtx.filter = 'blur(0.8px)'; // Reduced blur for more defined trails
      const tmp = this.trailCtx.getImageData(0, 0, this.trailBuffer.width, this.trailBuffer.height);
      this.trailCtx.clearRect(0, 0, this.trailBuffer.width, this.trailBuffer.height);
      this.trailCtx.putImageData(tmp, 0, 0);
      this.trailCtx.restore();
    } catch (error) {
      console.warn('Error in evolveTrails:', error);
    }
  }

  update(dt) {
    try {
      const g = this.gravityBase;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
        
        // Validate drop data
        if (!d || typeof d.x !== 'number' || typeof d.y !== 'number' || typeof d.r !== 'number') {
          console.warn('Invalid drop data at index', i, d);
          this.drops.splice(i, 1);
          continue;
        }
      
      // Store previous position for trail rendering
      const prevX = d.x;
      const prevY = d.y;
      
      // Advanced physics system inspired by RainDrop class
      const dtScale = Math.max(0.016, Math.min(0.1, dt)) * this.fps / 1.0; // normalize to configured fps
      
      // Validate dtScale is finite
      if (!isFinite(dtScale) || dtScale <= 0) {
        console.warn('Invalid dtScale for drop', i, 'dtScale:', dtScale, 'dt:', dt, 'fps:', this.fps);
        continue; // Skip this drop's update
      }
      
      // Random motion intervals (inspired by RainDrop class)
      if (d.nextRandomTime <= this.last) {
        d.nextRandomTime = this.last + (0.1 + Math.random() * 0.4); // motionInterval
        this.randomMotion(d);
      }
      
      // Evaporation (mass decreases over time) - prevent negative mass (skip for test drops)
      if (!d._testDrop) {
        d.mass = Math.max(0, d.mass - this.evaporate * dtScale);
        if (d.mass <= 0) {
          d._dead = true;
        }
      }
      
      // Skip physics calculations for dead drops
      if (d._dead || d.mass <= 0) {
        continue;
      }
      
      // Initialize resistance and shifting if they don't exist (for backward compatibility)
      if (!d.resistance || !isFinite(d.resistance)) {
        d.resistance = 0;
      }
      if (!d.shifting || !isFinite(d.shifting)) {
        d.shifting = 0;
      }
      
      // Advanced physics calculation with validation
      const force = this.gravityBase * d.mass - d.resistance;
      const acceleration = force / d.mass;
      
      // Validate physics calculations (skip for test drops)
      if (!d._testDrop && (!isFinite(force) || !isFinite(acceleration) || !isFinite(d.mass) || d.mass <= 0)) {
        console.warn('Invalid physics values for drop', i, 'force:', force, 'acceleration:', acceleration, 'mass:', d.mass);
        d._dead = true; // Mark as dead instead of trying to fix
        continue;
      }
      
      d.vy += acceleration * dtScale;
      if (d.vy < 0) d.vy = 0; // Prevent upward movement
      d.vx = Math.abs(d.vy) * d.shifting; // Horizontal drift based on vertical speed
      
      // Validate velocities are finite
      if (!isFinite(d.vx) || !isFinite(d.vy)) {
        console.warn('Invalid velocities for drop', i, 'vx:', d.vx, 'vy:', d.vy);
        d.vx = 0;
        d.vy = 0;
      }
      
      // Update position with validation
      const newX = d.x + d.vx * dtScale;
      const newY = d.y + d.vy * dtScale;
      
      // Validate new positions are finite
      if (isFinite(newX) && isFinite(newY)) {
        d.x = newX;
        d.y = newY;
      } else {
        console.warn('Invalid position update for drop', i, 'newX:', newX, 'newY:', newY, 'vx:', d.vx, 'vy:', d.vy, 'dtScale:', dtScale);
        // Reset to safe values
        d.x = Math.max(0, Math.min(this.canvas.width, d.x || 0));
        d.y = Math.max(0, Math.min(this.canvas.height, d.y || 0));
        d.vx = 0;
        d.vy = 0;
      }
      
      // Add wind effect
      d.vx += this.windX * dtScale;
      d.vy += this.windY * dtScale;
      
      // Initialize spread if it doesn't exist (for backward compatibility)
      if (!d.spread) {
        d.spread = { x: 0, y: 0 };
      }
      
      // Velocity-based spread (inspired by RainDrop class)
      const currentDropSpeed = Math.hypot(d.vx, d.vy);
      if (currentDropSpeed > 5 && d.r > 0) {
        const spreadByVelocity = this.velocitySpread * 2 * Math.atan(Math.abs(d.vy * 0.005)) / Math.PI;
        d.spread.y = Math.max(d.spread.y, spreadByVelocity);
      }
      
      // Shrink spread over time
      d.spread.x *= Math.pow(this.shrinkRate, dtScale);
      d.spread.y *= Math.pow(this.shrinkRate, dtScale);
      
      // Initialize lastTrailPos if it doesn't exist (for backward compatibility)
      if (!d.lastTrailPos) {
        d.lastTrailPos = { x: d.x, y: d.y };
      }
      if (!d.nextTrailDistance) {
        d.nextTrailDistance = 20 + Math.random() * 20;
      }
      
      // Distance-based trail generation (inspired by RainDrop class)
      const distanceMoved = Math.hypot(d.x - d.lastTrailPos.x, d.y - d.lastTrailPos.y);
      if (distanceMoved > d.nextTrailDistance) {
        this.layTrail(d, d.lastTrailPos.x, d.lastTrailPos.y);
        d.lastTrailPos.x = d.x;
        d.lastTrailPos.y = d.y;
        d.nextTrailDistance = 20 + Math.random() * 20; // New random distance
      }
      
      // variance (wind jitter)
      if (this.gravityVariance) d.vx += (Math.random() * 2 - 1) * this.gravityVariance * dtScale * 0.1;
      
      // Apply drag and adhesion
      const vyDamp = Math.pow(d.stick, dtScale);
      d.vy *= vyDamp;
      d.vx *= Math.pow(0.985, dtScale);
      
      // Update position
      d.x += d.vx * dtScale;
      d.y += d.vy * dtScale;
      
      // Advanced physics: evaporation and shrinking (inspired by RaindropFX) (skip for test drops)
      if (!d._testDrop) {
        if (d._isTrailDroplet) {
          // Trail droplets evaporate faster
          d.r = Math.max(0, d.r - this.evaporate * dtScale * 0.1);
          if (d.r <= 0.5) {
            d._dead = true;
          }
        } else {
          // Regular droplets shrink slowly
          d.r = Math.max(0, d.r - this.shrinkRate * dtScale);
          if (d.r <= 1) {
            d._dead = true;
          }
        }
      }
      
      // Velocity-based stretch (inspired by RaindropFX)
      const stretchSpeed = Math.hypot(d.vx, d.vy);
      if (stretchSpeed > 5 && d.r > 0) {
        d.stretch = 1 + Math.min(stretchSpeed / (10 * d.r), 1.1) * this.velocitySpread;
      } else {
        d.stretch = 1;
      }
      
      // Lay trail if drop moved significantly
      if (Math.abs(d.x - prevX) > 0.5 || Math.abs(d.y - prevY) > 0.5) {
        this.layTrail(d, prevX, prevY);
      }
      
      // Update previous position
      d.prevX = prevX;
      d.prevY = prevY;
      const alongGravity = d.vx * Math.cos(this.gravityAngleRad) + d.vy * Math.sin(this.gravityAngleRad);
      d.stretch = 1 + Math.min(alongGravity / (10 * d.r), 1.1);
      // mark shape dirty when speed low or very low acceleration
      const speed = Math.hypot(d.vx, d.vy);
      d._shapeDirty = speed < 1.5 * this.dpr;
      // Position already updated in the new physics system above
      
      // remove only when fully off-screen; allow reach to bottom (skip for test drops)
      if (!d._testDrop && d.y - d.r > this.canvas.height + 5) this.drops.splice(i, 1);
      // mark for smudge trail if moved enough
      if (this.enableSmudgeTrail) {
        if (d._trailY === undefined) d._trailY = d.y;
        if (Math.abs(d.y - d._trailY) > this.trailThresholdPx) {
          d._leaveTrail = true;
          d._trailY = d.y;
        }
      }
      // TRAIL_DROPS-like micro-drop trail: probabilistic and size-scaled
      if (!TEST_MODE && this.enableSmudgeTrail) {
        if (!d._lastTrailSpawnY) d._lastTrailSpawnY = d.y;
        const dist = Math.abs(d.y - d._lastTrailSpawnY);
        const threshold = Math.max(10 * this.dpr, d.r * 0.6);
        if (dist > threshold && Math.random() < 0.25 && this.drops.length < this.maxDrops) {
          const microR = Math.max(1.5 * this.dpr, Math.ceil(d.r / 6));
          this.spawn(d.x, d.y - d.r - 4 * this.dpr, microR);
          d._lastTrailSpawnY = d.y;
        }
      }
    }

    // merging (grid-assisted if enabled)
    if (this.enableCollisions) {
      const cell = this.collisionCell * this.dpr;
      const cols = Math.max(1, Math.ceil(this.canvas.width / cell));
      const rows = Math.max(1, Math.ceil(this.canvas.height / cell));
      if (!this.grid || this.grid.cols !== cols || this.grid.rows !== rows) {
        this.grid = { cols, rows, buckets: Array.from({ length: cols * rows }, () => []) };
      } else {
        for (const b of this.grid.buckets) b.length = 0;
      }
      // bin drops
      for (let i = 0; i < this.drops.length; i++) {
        const d = this.drops[i];
        
        // Validate drop coordinates and cell size
        if (!isFinite(d.x) || !isFinite(d.y) || !isFinite(cell) || cell <= 0) {
          console.warn('Invalid drop coordinates or cell size for drop', i, 'x:', d.x, 'y:', d.y, 'cell:', cell);
          continue;
        }
        
        const cx = Math.min(cols - 1, Math.max(0, Math.floor(d.x / cell)));
        const cy = Math.min(rows - 1, Math.max(0, Math.floor(d.y / cell)));
        
        // Validate calculated grid coordinates
        if (!isFinite(cx) || !isFinite(cy)) {
          console.warn('Invalid grid coordinates for drop', i, 'cx:', cx, 'cy:', cy);
          continue;
        }
        
        const bucketIndex = cy * cols + cx;
        const bucket = this.grid.buckets[bucketIndex];
        if (bucket && Array.isArray(bucket)) {
          bucket.push(i);
        } else {
          console.warn('Invalid bucket at index', bucketIndex, 'for drop', i);
        }
      }
      // check local neighborhoods
      const neighborOffsets = [0, 1, -1, cols, -cols]; // reduce checks for perf
      for (let bi = 0; bi < this.grid.buckets.length; bi++) {
        const base = this.grid.buckets[bi];
        if (!base || !Array.isArray(base) || base.length === 0) continue;
        for (const off of neighborOffsets) {
          const ni = bi + off;
          if (ni < 0 || ni >= this.grid.buckets.length) continue;
          const neigh = this.grid.buckets[ni];
          if (!neigh || !Array.isArray(neigh)) continue;
          for (let aIdx = 0; aIdx < base.length; aIdx++) {
            for (let bIdx = 0; bIdx < neigh.length; bIdx++) {
              const iA = base[aIdx];
              const iB = neigh[bIdx];
              if (iA === iB) continue;
              const a = this.drops[iA];
              const b = this.drops[iB];
              if (!a || !b) continue;
              const dx = a.x - b.x, dy = a.y - b.y;
              const dist = Math.hypot(dx, dy);
              if (dist < (a.r + b.r) * 0.75) {
                const newR = Math.sqrt(a.r * a.r + b.r * b.r);
                a.x = (a.x + b.x) / 2; a.y = (a.y + b.y) / 2; a.r = newR; a.vy = Math.max(a.vy, b.vy) * 1.1; a.stick = 0.95;
                // remove b efficiently by flagging
                b._dead = true;
              }
            }
          }
        }
      }
      // compact remove
      this.drops = this.drops.filter(d => !d._dead);
    } else {
      // fallback O(n^2)
    for (let i = 0; i < this.drops.length; i++) {
      for (let j = i + 1; j < this.drops.length; j++) {
        const a = this.drops[i], b = this.drops[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < (a.r + b.r) * 0.75) {
          const newR = Math.sqrt(a.r * a.r + b.r * b.r);
          a.x = (a.x + b.x) / 2; a.y = (a.y + b.y) / 2; a.r = newR; a.vy = Math.max(a.vy, b.vy) * 1.1; a.stick = 0.95;
          this.drops.splice(j, 1); j--;
        }
      }
    }
    }

    // Update condensation droplets (skip in test mode)
    if (this.enableCondensation && !this.testMode) {
      for (let i = this.condensation.length - 1; i >= 0; i--) {
        const c = this.condensation[i];
        c.age += dt;
        c.twinkle += dt * 3; // sparkle animation
        
        // Fade out over time
        c.life -= dt * 0.1;
        if (c.life <= 0) {
          this.condensation.splice(i, 1);
        }
      }
      
      // Spawn new condensation occasionally
      if (Math.random() < 0.01) { // 1% chance per frame (reduced from 2%)
        this.spawnCondensation();
      }
    }

    // Evolve trails (evaporation and diffusion)
    this.evolveTrails();

    // keep population (preset-based spawn)
    this.spawnFromPresets(dt);
    
    } catch (error) {
      console.error('Error in RainOnGlass.update():', error);
      console.error('Stack trace:', error.stack);
      // Try to recover by clearing problematic drops
      this.drops = this.drops.filter(d => d && typeof d.x === 'number' && typeof d.y === 'number' && typeof d.r === 'number');
    }
  }

  spawnFromPresets(dt) {
    if (this.drops.length >= this.maxDrops) return;
    const limit = this.maxDrops - this.drops.length;
    for (let p = 0; p < this.presets.length; p++) {
      const preset = this.presets[p];
      // expected spawns this frame
      this._spawnAcc[p] += (preset.rate || 0) * dt;
      while (this._spawnAcc[p] >= 1 && this.drops.length < this.maxDrops) {
        this._spawnAcc[p] -= 1;
        // Skip normal rain generation during test mode
        if (this.testMode) {
          break;
        }
        const r = (preset.min + Math.random() * (preset.base || 1)) * this.dpr;
        this.spawn(undefined, undefined, r);
      }
    }
  }

  // RainyDay-style API
  preset(min, base, quan) {
    return { min, base, quan };
  }

  rain(presets, speedMs = 0) {
    // clear previous timer
    if (this._rainTimer) { try { clearInterval(this._rainTimer); } catch(_) {} this._rainTimer = null; }
    if (!Array.isArray(presets) || presets.length === 0) return;

    if (speedMs > 0) {
      // animated: probabilistic spawn
      this._rainTimer = setInterval(() => {
        if (this.drops.length >= this.maxDrops) return;
        const r = Math.random();
        let chosen = null;
        for (let i = 0; i < presets.length; i++) {
          const p = presets[i];
          if (r < (p.quan ?? 1)) { chosen = p; break; }
        }
        if (!chosen) chosen = presets[presets.length - 1];
        const radius = (chosen.min + Math.random() * (chosen.base || 1)) * this.dpr;
        this.spawn(undefined, undefined, radius);
      }, Math.max(10, speedMs));
    } else {
      // static: spawn quan count for each preset
      for (let i = 0; i < presets.length; i++) {
        const p = presets[i];
        const count = Math.max(0, Math.floor(p.quan || 0));
        for (let c = 0; c < count; c++) {
          const radius = (p.min + Math.random() * (p.base || 1)) * this.dpr;
          this.spawn(undefined, undefined, radius);
        }
      }
    }
  }

  render() {
    try {
    const ctx = this.ctx;
    // Don't clear canvas during test mode to preserve test drawings
    if (!this.testMode) {
      this.clear();
    } else {
      console.log('🔍 TEST MODE: Canvas NOT cleared');
    }
      // Draw in CSS pixel coordinates; scale context to DPR
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Atmospheric fog overlay (subtle vertical gradient)
    if (!TEST_MODE && !this.testMode && this.fogEnabled && this.fogStrength > 0) {
      const W = this.canvas.width / this.dpr;
      const H = this.canvas.height / this.dpr;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      const a = Math.max(0, Math.min(0.25, this.fogStrength));
      g.addColorStop(0, `rgba(255,255,255,${a * 0.6})`);
      g.addColorStop(0.6, `rgba(255,255,255,${a * 0.25})`);
      g.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // draw droplets with refraction
    for (const d of this.drops) {
      // Test drop validation (silent)
      if (d._testDrop) {
        // Validation passed - no logging needed
      }
      
      // Skip droplets with invalid radius (prevent createRadialGradient errors)
      if (!d.r || d.r <= 0 || !isFinite(d.r)) {
        if (d._testDrop) console.log('❌ TEST DROP REJECTED: Invalid radius');
        continue;
      }
      
      const x = d.x / this.dpr;
      const y = d.y / this.dpr;
      
      // Validate that x and y are finite numbers
      if (!isFinite(x) || !isFinite(y)) {
        if (d._testDrop) console.log('❌ TEST DROP REJECTED: Invalid position');
        continue;
      }
      // Enhanced droplet shape calculation using spread system (inspired by RainDrop class)
      const baseRadius = Math.max(0.1, (d.r * 0.92) / this.dpr);
      const rx = Math.max(0.1, baseRadius * (1 + (d.spread?.x || 0))); // Horizontal spread
      const ry = Math.max(0.1, baseRadius * (1 + (d.spread?.y || 0)) * (d.stretch || 1)); // Vertical spread + stretch
      
      // Validate that rx and ry are finite numbers
      if (!isFinite(rx) || !isFinite(ry) || rx <= 0 || ry <= 0) {
        if (d._testDrop) console.log('❌ TEST DROP REJECTED: Invalid rx/ry', { rx, ry });
        continue;
      }

      ctx.save();
      ctx.beginPath();
      if (ry > rx * 1.15 || Math.abs(d.vy) > 6) {
        // Teardrop path (inspired by rainyday.js teardrop)
        const yr = 1 + 0.1 * Math.min(8, Math.abs(d.vy));
        ctx.moveTo(x - rx / yr, y);
        ctx.bezierCurveTo(x - rx, y - rx * 2, x + rx, y - rx * 2, x + rx / yr, y);
        ctx.bezierCurveTo(x + rx, y + yr * rx, x - rx, y + yr * rx, x - rx / yr, y);
      } else {
        // Irregular perimeter for slow/sticky drops
        const needNew = !d.shapePoints || d._shapeDirty;
        if (needNew) {
          const iterations = 5;
          // generate fractalized circle outline points (0..1 around circumference)
          const points = [];
          let list = { first: { x: 0, y: 1, next: { x: 1, y: 1, next: null } } };
          let minY = 1, maxY = 1;
          for (let it = 0; it < iterations; it++) {
            let p = list.first;
            while (p.next) {
              const n = p.next; const dx = n.x - p.x;
              const newX = 0.5 * (p.x + n.x);
              const newY = 0.5 * (p.y + n.y) + dx * (Math.random() * 2 - 1);
              const np = { x: newX, y: newY, next: n };
              p.next = np; p = n;
              if (newY < minY) minY = newY; else if (newY > maxY) maxY = newY;
            }
          }
          // normalize to 0..1
          const norm = (maxY !== minY) ? (1 / (maxY - minY)) : 0;
          let p = list.first; while (p) { p.y = (maxY !== minY) ? ((p.y - minY) * norm) : 1; p = p.next; }
          // sample into array (improve cache)
          p = list.first; while (p) { points.push({ x: p.x, y: p.y }); p = p.next; }
          d.shapePoints = points;
          d._shapeDirty = false;
        }
        const pts = d.shapePoints;
        if (pts && pts.length > 2) {
          // draw irregular path scaled to rx/ry
          let theta = 0, rad = ry; // use ry for vertical radius
          const twoPi = Math.PI * 2;
          const p0 = pts[0];
          let r0 = ry * 0.88 + p0.y * (ry * 0.12);
          ctx.moveTo(x + r0 * Math.cos(theta), y + r0 * Math.sin(theta));
          for (let i = 1; i < pts.length; i++) {
            const pi = pts[i];
            theta = twoPi * pi.x;
            const ri = ry * 0.88 + pi.y * (ry * 0.12);
            ctx.lineTo(x + ri * Math.cos(theta), y + ri * Math.sin(theta));
          }
          ctx.closePath();
        } else {
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        }
      }
      ctx.clip();
      
      // NEW ENHANCED REFRACTION: Position-dependent background sampling with organic shapes
      if (this.hasBackground && this.bgSharp.width > 0 && this.bgSharp.height > 0 && rx > 2) {
        // Enhanced refraction parameters for micro-lens effect (inspired by ChatGPT analysis)
        const sizeFactor = Math.min(1, rx / 8); // Scale effect by droplet size
        const baseOffsetX = rx * this.refractBase * 0.5 * sizeFactor;  // Stronger horizontal distortion for micro-lens
        const baseOffsetY = -ry * (this.refractBase * 0.4) * sizeFactor; // Stronger vertical distortion for micro-lens
        const baseMag = 1.05 + (0.02 * sizeFactor);  // Stronger magnification for micro-lens effect
        const boost = (this.useMiniRefraction && this.miniBoost) ? this.miniOffsetScale * 0.8 * sizeFactor : 1; // Stronger boost
        const offsetX = baseOffsetX * boost * this.refractScale;   // Enhanced horizontal refraction
        const offsetY = baseOffsetY * boost * this.refractScale;   // Enhanced vertical refraction
        const mag = (this.useMiniRefraction && this.miniBoost) ? Math.min(1.15, this.miniMagnification * 0.8 * sizeFactor) : baseMag; // Enhanced magnification
        
        // Calculate source rectangle with refraction offset
        let sx, sy, sw, sh, srcCanvas;
        if (this.useMiniRefraction && this.bgMini && this.bgMini.width > 0 && this.bgMini.height > 0) {
          // sample from miniature buffer (lower bandwidth, stronger look)
          const scaleX = this.bgMini.width / (this.bgSharp.width);
          const scaleY = this.bgMini.height / (this.bgSharp.height);
          const scaleDown = Math.max(1, Math.floor(this.reflectionScaledownFactor / (this.miniBoost ? 1 : 1))); // keep as configured
          const mapW = (this.reflectionDropMappingWidth / scaleDown) / this.dpr;
          const mapH = (this.reflectionDropMappingHeight / scaleDown) / this.dpr;
          sx = Math.max(0, Math.min(this.bgMini.width - mapW, (x - mapW / 2 + offsetX) * this.dpr * scaleX));
          sy = Math.max(0, Math.min(this.bgMini.height - mapH, (y - mapH / 2 + offsetY) * this.dpr * scaleY));
          sw = Math.min(mapW, this.bgMini.width - sx);
          sh = Math.min(mapH, this.bgMini.height - sy);
          srcCanvas = this.bgMini;
        } else {
          sx = Math.max(0, Math.min(this.bgSharp.width - rx * 2 * this.dpr, (x - rx + offsetX) * this.dpr));
          sy = Math.max(0, Math.min(this.bgSharp.height - ry * 2 * this.dpr, (y - ry + offsetY) * this.dpr));
          sw = Math.min(rx * 2 * this.dpr, this.bgSharp.width - sx);
          sh = Math.min(ry * 2 * this.dpr, this.bgSharp.height - sy);
          srcCanvas = this.bgSharp;
        }
        
        if (sw > 0 && sh > 0) {
          // TRUE CIRCULAR REFRACTION: Radial sampling instead of rectangular
          const radius = Math.min(rx, ry);
          const centerX = x;
          const centerY = y;
          
          // Check if it's a test drop
          if (d._testDrop) {
            // For test drops, draw a semi-transparent royal blue border to show refraction area
            ctx.strokeStyle = 'royalblue';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, rx, ry, d.rotation || 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          ctx.save();
          
          // ORGANIC SHAPE VARIATION: Use goldNoise for natural droplet shapes
          let organicRadiusX = radius;
          let organicRadiusY = radius;
          
          if (window.RainUtils && d._organicSeed) {
            // Use goldNoise for organic shape variation based on drop position and seed
            const shapeVariation = window.RainUtils.organicShapeVariation(
              new window.RainUtils.Vec2(centerX, centerY), 
              d._organicSeed
            );
            organicRadiusX = radius * shapeVariation;
            organicRadiusY = radius * (1 + (shapeVariation - 1) * 0.5); // Slightly different Y variation
          }
          
          // Create organic elliptical mask (not perfect circle)
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, organicRadiusX, organicRadiusY, 0, 0, Math.PI * 2);
          ctx.clip();
          
          // Create temporary canvas for radial sampling
          const tempCanvas = document.createElement('canvas');
          const tempSize = Math.ceil(radius * 2);
          tempCanvas.width = tempSize;
          tempCanvas.height = tempSize;
          const tempCtx = tempCanvas.getContext('2d');
          
          // PROPER RADIAL SAMPLING: Show magnified background through water lens
          // Create a larger sampling area to capture background content
          const sampleRadius = radius * 1.5; // Sample larger area for background content
          const sampleSize = Math.ceil(sampleRadius * 2);
          
        // POSITION-DEPENDENT SAMPLING: Each drop samples from its specific location
        // This creates the effect where drops show different background content based on where they fall
        const positionOffsetX = offsetX * (1 + Math.sin(centerX * 0.01) * 0.3); // Vary offset based on position
        const positionOffsetY = offsetY * (1 + Math.cos(centerY * 0.008) * 0.2); // Vary offset based on position
        
        // Sample from the drop's specific position on the background
        const sourceX = Math.max(0, Math.min(srcCanvas.width - sampleSize, (centerX - sampleRadius + positionOffsetX) * this.dpr));
        const sourceY = Math.max(0, Math.min(srcCanvas.height - sampleSize, (centerY - sampleRadius + positionOffsetY) * this.dpr));
          const sourceW = Math.min(sampleSize, srcCanvas.width - sourceX);
          const sourceH = Math.min(sampleSize, srcCanvas.height - sourceY);
          
          if (sourceW > 0 && sourceH > 0) {
            // Draw the background sample with magnification (like water droplet lens)
            const magSize = radius * 2 * mag; // Magnified size
            const magX = centerX - magSize / 2;
            const magY = centerY - magSize / 2;
            
            // Apply radial distortion by drawing with circular mask
            tempCtx.save();
            tempCtx.beginPath();
            tempCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            tempCtx.clip();
            
            // Draw magnified background (this creates the lens effect)
            tempCtx.drawImage(srcCanvas, sourceX, sourceY, sourceW, sourceH, 
              magX, magY, magSize, magSize);
            
            tempCtx.restore();
            
            // Draw the sampled background to the main canvas
            ctx.drawImage(tempCanvas, 0, 0, tempSize, tempSize, 
              centerX - radius, centerY - radius, radius * 2, radius * 2);
          }
          
          // No need for putImageData - we drew directly to tempCtx
          
          // Apply magnification and draw
          const drawSize = radius * 2 * mag;
          const drawX = centerX - drawSize / 2;
          const drawY = centerY - drawSize / 2;
          
          ctx.drawImage(tempCanvas, 0, 0, tempSize, tempSize, drawX, drawY, drawSize, drawSize);
          
          ctx.restore();
        }
      }
      ctx.restore();

      // optional trail: tiny dot behind the drop
      if (!TEST_MODE && !this.testMode && Math.random() < 0.08) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.arc(x - rx * 0.1, y - ry - 1, Math.max(0.5, rx * 0.15), 0, Math.PI * 2);
        ctx.fill();
      }
      // optional smudge trail (sample a thin strip from sharp background)
      if (!TEST_MODE && this.enableSmudgeTrail && this.hasBackground && d._leaveTrail) {
        d._leaveTrail = false;
        const stripW = Math.max(4, Math.min(24, d.r));
        const stripH = Math.max(2, Math.min(8, d.r * 0.3));
        const sSx = Math.max(0, Math.floor((x * this.dpr - stripW) ));
        const sSy = Math.max(0, Math.floor((y * this.dpr - ry * this.dpr - stripH)));
        const sSw = Math.min(this.bgSharp.width - sSx, Math.floor(stripW * 2));
        const sSh = Math.min(this.bgSharp.height - sSy, Math.floor(stripH));
        if (sSw > 0 && sSh > 0) {
          const prevAlpha2 = ctx.globalAlpha;
          ctx.globalAlpha = 0.18;
          ctx.drawImage(this.bgSharp, sSx, sSy, sSw, sSh, x - stripW, y - ry - stripH, sSw / this.dpr, sSh / this.dpr);
          ctx.globalAlpha = prevAlpha2;
        }
      }

      // Enhanced specular highlight for micro-lens effect (skip in test mode)
      if (!this.testMode) {
        // Primary highlight - stronger for micro-lens effect
        const hg = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.3, 0, x - rx * 0.15, y - ry * 0.15, rx * 0.8);
        hg.addColorStop(0, 'rgba(255,255,255,0.98)');
        hg.addColorStop(0.1, 'rgba(255,255,255,0.8)');
        hg.addColorStop(0.3, 'rgba(255,255,255,0.4)');
        hg.addColorStop(0.6, 'rgba(255,255,255,0.15)');
        hg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();

        // Secondary highlight for micro-lens depth
        const hg2 = ctx.createRadialGradient(x - rx * 0.1, y - ry * 0.1, 0, x - rx * 0.05, y - ry * 0.05, rx * 0.3);
        hg2.addColorStop(0, 'rgba(255,255,255,0.6)');
        hg2.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hg2;
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();

        // Enhanced rim for micro-lens definition
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = Math.max(2, this.dpr * 1.0) / this.dpr;
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      }

      // edge darkening for depth - stronger for more 3D effect
      const edgeG = ctx.createRadialGradient(x, y, rx * 0.5, x, y, rx);
      edgeG.addColorStop(0, 'rgba(0,0,0,0)');
      edgeG.addColorStop(0.7, 'rgba(0,0,0,0.05)');
      edgeG.addColorStop(0.9, 'rgba(0,0,0,0.15)');
      edgeG.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = edgeG;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();

      // Temporary deployment marker: label a few droplets
      if (d.label) {
        ctx.save();
        ctx.font = 'bold 12px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        const ty = y - ry - 6;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.strokeText('RAINDROP', x, ty);
        ctx.fillStyle = '#4dff87';
        ctx.fillText('RAINDROP', x, ty);
        ctx.restore();
      }
    }

    // Render trail effects (fog/condensation from water film)
    if (this.enableTrails) {
      ctx.save();
      ctx.globalAlpha = 0.15 * this.trailIntensity; // Apply trail intensity multiplier
      ctx.globalCompositeOperation = 'overlay'; // Changed from 'screen' for more natural blending
      ctx.drawImage(this.trailBuffer, 0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
      ctx.restore();
    }

    // Render condensation droplets (tiny sparkling points) - skip in test mode
    if (this.enableCondensation && !this.testMode && this.condensation.length > 0) {
      ctx.save();
      for (const c of this.condensation) {
        const x = c.x / this.dpr;
        const y = c.y / this.dpr;
        const r = c.r / this.dpr;
        
        // Enhanced sparkle effect like the reference implementation
        const sparkleIntensity = 0.4 + 0.6 * Math.abs(Math.sin(c.twinkle));
        const alpha = c.life * sparkleIntensity * c.sparkle;
        
        // Create more visible sparkling highlight (skip in test mode)
        if (!this.testMode) {
          ctx.globalAlpha = alpha * 0.8;
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          
          // Add bright center sparkle for micro-condensation effect
          ctx.globalAlpha = alpha * 1.2;
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 1.2})`;
          ctx.beginPath();
          ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
          ctx.fill();
          if (alpha > 0.5) {
            ctx.globalAlpha = alpha * 0.8;
            ctx.fillStyle = 'rgba(255, 255, 255, 1)';
            ctx.beginPath();
            ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }
    
    } catch (error) {
      console.error('Error in RainOnGlass.render():', error);
      console.error('Stack trace:', error.stack);
      // Try to clear and restart rendering
      this.clear();
    }
  }

  loop(t) {
    try {
    if (!this.running) return;
      
      // Frame pacing: clamp dt and skip update when tab is throttled to reduce CPU
      const dtRaw = (t - this.last) / 1000;
      const dt = Math.min(Math.max(0, dtRaw), 0.08);
    this.last = t;
      
      // Debug logging every 60 frames (about once per second at 60fps)
      if (Math.floor(t / 1000) !== this._lastDebugSecond) {
        this._lastDebugSecond = Math.floor(t / 1000);
        console.log(`RainOnGlass Debug - Drops: ${this.drops.length}, Condensation: ${this.condensation.length}, dt: ${dt.toFixed(3)}`);
      }
      
      // simple dynamic drop cap based on frame delta (coarse scaler)
      const budgetScale = dt > 0.03 ? 0.85 : 1.0;
      if (budgetScale < 1 && this.drops.length > 0) {
        const keep = Math.max(15, Math.floor(this.drops.length * budgetScale));
        if (keep < this.drops.length) this.drops.length = keep;
      }
      
    this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
      
    } catch (error) {
      console.error('Error in RainOnGlass.loop():', error);
      console.error('Stack trace:', error.stack);
      // Stop the animation loop to prevent infinite error spam
      this.running = false;
    }
  }
}

// Wire to menu toggler
// Initialization modes: menu-overlay (default) or standalone demo
(function initRainIntegration(){
const toggler = document.querySelector('.menu-wrap .toggler');
const rainCanvas = document.getElementById('rain-glass');
let rain;

function ensureInstance() {
  if (!rain && rainCanvas) rain = new RainOnGlass(rainCanvas);
}

function onOpen() {
  ensureInstance();
  rain.captureBackground().then(() => rain.start());
}
  function onClose() { if (rain) rain.stop(); }

if (toggler) {
    toggler.addEventListener('change', () => { if (toggler.checked) onOpen(); else onClose(); });
}

  // Expose class and helpers globally for standalone demos
  window.RainOnGlass = RainOnGlass;
window.__rainOnGlass = {
    get instance(){ return rain; },
  capture: () => rain?.captureBackground(),
  start: () => rain?.start(),
    stop: () => rain?.stop(),
    clearAndRestart: () => { if (!rain) return; rain.drops = []; for (let i = 0; i < rain.initialDensity; i++) rain.spawn(); },
    set: (params = {}) => {
      if (!rain) return;
      if (typeof params.gravityDeg === 'number') rain.gravityAngleRad = params.gravityDeg * Math.PI / 180;
      if (typeof params.gravity === 'number') rain.gravityBase = params.gravity;
      if (typeof params.gravVar === 'number') rain.gravityVariance = params.gravVar;
      if (typeof params.collisions === 'boolean') rain.enableCollisions = params.collisions;
      if (typeof params.cell === 'number') rain.collisionCell = Math.max(10, params.cell);
      if (typeof params.smudge === 'boolean') rain.enableSmudgeTrail = params.smudge;
      if (typeof params.density === 'number') rain.initialDensity = Math.max(0, Math.floor(params.density));
      if (typeof params.maxDrops === 'number') rain.maxDrops = Math.max(1, Math.floor(params.maxDrops));
      if (typeof params.spawn === 'number') rain.spawnChance = Math.min(1, Math.max(0, params.spawn));
    },
    restart: async () => { if (!rain) return; rain.stop(); await rain.captureBackground(); for (let i = 0; i < rain.initialDensity; i++) rain.spawn(); rain.start(); }
  };
})();

// Controls UI removed per user request


