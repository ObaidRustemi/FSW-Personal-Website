// Canvas2D compositor for rain-on-glass effect integrated with the menu overlay
// Lightweight MVP: capture overlay background on open, render refractive droplets

const DPR_CAP = 2; // performance cap
const urlParams = (typeof window !== 'undefined') ? new URLSearchParams(window.location.search) : new URLSearchParams('');
const TEST_MODE = (typeof navigator !== 'undefined' && (navigator.webdriver === true)) ||
  (typeof window !== 'undefined' && (urlParams.has('testMode') || document.documentElement?.dataset?.disableRain === '1'));

class RainOnGlass {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = this.canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    this.drops = [];
    this.micro = [];
    this.condensation = []; // Fine condensation droplets for sparkling effect
    this.running = false;
    this.last = 0;
    this.hasBackground = false;

    // offscreen buffers for sharp/blurred background
    this.bgSharp = document.createElement('canvas');
    this.bgBlur = document.createElement('canvas');
    this.bgSharpCtx = this.bgSharp.getContext('2d');
    this.bgBlurCtx = this.bgBlur.getContext('2d');
    
    // Multi-pass blur system (inspired by WebGL implementation)
    this.blurSteps = []; // Array of canvas buffers for downsampling/upsampling
    this.blurIterations = 4; // Number of blur passes
    // optional miniature reflection buffer (RainyDay-style)
    this.bgMini = document.createElement('canvas');
    this.bgMiniCtx = this.bgMini.getContext('2d');
    this.miniInverted = true; // 180° inverted by default
    
    // trail buffer for condensation trails and water film
    this.trailBuffer = document.createElement('canvas');
    this.trailCtx = this.trailBuffer.getContext('2d');

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
    this.condensationDensity = Number(q.get('condDensity')) || options.condensationDensity || 0.3; // 0-1
    this.condensationSize = Number(q.get('condSize')) || options.condensationSize || 0.8; // multiplier for tiny droplets
    this.condensationSparkle = Number(q.get('condSparkle')) || options.condensationSparkle || 0.6; // 0-1 sparkle intensity
    
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
    // Better size distribution - mix of small, medium, and large drops
    let radius;
    if (r) {
      radius = r;
    } else {
      const sizeRand = Math.random();
      if (sizeRand < 0.3) {
        // Small drops (30%)
        radius = 4 + Math.random() * 4;
      } else if (sizeRand < 0.8) {
        // Medium drops (50%)
        radius = 8 + Math.random() * 8;
      } else {
        // Large drops (20%)
        radius = 16 + Math.random() * 10;
      }
      radius *= this.dpr * this.sizeVariance; // Apply size variance multiplier
    }
    
    const spawnX = x ?? (radius + Math.random() * (this.canvas.width - 2 * radius));
    
    this.drops.push({
      x: spawnX,
      y: y ?? (-radius - Math.random() * 100 * this.dpr),  // Scale initial Y by DPR too
      r: radius,
      vx: (Math.random() - 0.5) * 0.3,
      vy: 0,
      stretch: 1,
      stick: this.adhesionBase + Math.random() * 0.06,
      label: (urlParams.get('debugRain') === '1') && Math.random() < 0.2,
      shapePoints: null,
      _shapeDirty: false,
      // Enhanced physics properties
      mass: radius * radius, // mass ∝ r²
      prevX: spawnX,
      prevY: y ?? (-radius - Math.random() * 100 * this.dpr),
      adhesion: this.adhesionBase,
      _trailAccumulated: 0
    });
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
    if (!this.enableCondensation || this.condensation.length >= 2000) return;
    
    // Spawn tiny condensation droplets across the surface
    const count = Math.floor(this.condensationDensity * 20 * Math.random()); // Reduced from 50
    for (let i = 0; i < count; i++) {
      const x = Math.random() * this.canvas.width;
      const y = Math.random() * this.canvas.height;
      const size = (0.5 + Math.random() * 1.5) * this.condensationSize * this.dpr;
      
      this.condensation.push({
        x: x,
        y: y,
        r: size,
        sparkle: Math.random() * this.condensationSparkle,
        life: 0.8 + Math.random() * 0.4, // 0.8-1.2
        age: 0,
        twinkle: Math.random() * Math.PI * 2 // for sparkle animation
      });
    }
  }

  layTrail(drop, prevX, prevY) {
    try {
      if (!this.enableTrails || !this.trailCtx) return;
      
      // More realistic trail parameters
      const baseWidth = Math.max(0.8, drop.r * 0.4); // Thinner base width
      const widthVariation = baseWidth * 0.3; // Add natural variation
      const w = baseWidth + (Math.random() - 0.5) * widthVariation;
      
      // More subtle alpha with size-based variation
      const baseAlpha = Math.min(0.25, 0.05 + drop.r * 0.008);
      const alphaVariation = baseAlpha * 0.4;
      const alpha = baseAlpha + (Math.random() - 0.5) * alphaVariation;
      
      // Add slight horizontal drift for more natural flow
      const drift = (Math.random() - 0.5) * 0.5;
      const midX = (prevX + drop.x) / 2 + drift;
      const midY = (prevY + drop.y) / 2;
      
      this.trailCtx.save();
      this.trailCtx.strokeStyle = `rgba(255,255,255,${alpha})`;
      this.trailCtx.lineWidth = w;
      this.trailCtx.lineCap = 'round';
      this.trailCtx.globalCompositeOperation = 'lighter';
      
      // Draw curved trail for more natural water flow
      this.trailCtx.beginPath();
      this.trailCtx.moveTo(prevX, prevY);
      this.trailCtx.quadraticCurveTo(midX, midY, drop.x, drop.y);
      this.trailCtx.stroke();
      this.trailCtx.restore();
    } catch (error) {
      console.warn('Error in layTrail:', error);
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
      
      // Simplified but effective physics - back to working system
      const strength = g * (d.r / 25);  // Reduced gravity strength for slower fall
      const dtScale = Math.max(0.016, Math.min(0.1, dt)) * this.fps / 1.0; // normalize to configured fps
      
      // Apply gravity in device pixel space
      d.vx += Math.cos(this.gravityAngleRad) * strength * dtScale * this.dpr;
      d.vy += Math.sin(this.gravityAngleRad) * strength * dtScale * this.dpr;
      
      // Add wind effect
      d.vx += this.windX * dtScale;
      d.vy += this.windY * dtScale;
      
      // variance (wind jitter)
      if (this.gravityVariance) d.vx += (Math.random() * 2 - 1) * this.gravityVariance * dtScale * 0.1;
      
      // Apply drag and adhesion
      const vyDamp = Math.pow(d.stick, dtScale);
      d.vy *= vyDamp;
      d.vx *= Math.pow(0.985, dtScale);
      
      // Update position
      d.x += d.vx * dtScale;
      d.y += d.vy * dtScale;
      
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
      
      // remove only when fully off-screen; allow reach to bottom
      if (d.y - d.r > this.canvas.height + 5) this.drops.splice(i, 1);
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
        const cx = Math.min(cols - 1, Math.max(0, Math.floor(d.x / cell)));
        const cy = Math.min(rows - 1, Math.max(0, Math.floor(d.y / cell)));
        this.grid.buckets[cy * cols + cx].push(i);
      }
      // check local neighborhoods
      const neighborOffsets = [0, 1, -1, cols, -cols]; // reduce checks for perf
      for (let bi = 0; bi < this.grid.buckets.length; bi++) {
        const base = this.grid.buckets[bi];
        if (base.length === 0) continue;
        for (const off of neighborOffsets) {
          const ni = bi + off;
          if (ni < 0 || ni >= this.grid.buckets.length) continue;
          const neigh = this.grid.buckets[ni];
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

    // Update condensation droplets
    if (this.enableCondensation) {
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
      this.clear();
      // Draw in CSS pixel coordinates; scale context to DPR
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Atmospheric fog overlay (subtle vertical gradient)
    if (!TEST_MODE && this.fogEnabled && this.fogStrength > 0) {
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
      const x = d.x / this.dpr;
      const y = d.y / this.dpr;
      const rx = (d.r * 0.92) / this.dpr;
      const ry = (d.r * 0.92 * d.stretch) / this.dpr;

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
      
      // Draw refracted background inside droplet
      if (this.hasBackground && this.bgSharp.width > 0 && this.bgSharp.height > 0) {
        // Refraction parameters
        const baseOffsetX = rx * 0.22;
        const baseOffsetY = -ry * 0.12;
        const baseMag = 1.06;
        const boost = (this.useMiniRefraction && this.miniBoost) ? this.miniOffsetScale : 1;
        const offsetX = baseOffsetX * boost;   // boosted horizontal refraction offset
        const offsetY = baseOffsetY * boost;   // boosted vertical refraction offset
        const mag = (this.useMiniRefraction && this.miniBoost) ? this.miniMagnification : baseMag; // boosted magnification
        
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
          // Draw magnified sharp background
          const dw = sw * mag / this.dpr;
          const dh = sh * mag / this.dpr;
          const dx = x - dw / 2;
          const dy = y - dh / 2;
          
          ctx.drawImage(srcCanvas, sx, sy, sw, sh, dx, dy, dw, dh);
        }
      }
      ctx.restore();

      // optional trail: tiny dot behind the drop
      if (!TEST_MODE && Math.random() < 0.08) {
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

      // specular highlight - stronger for better visibility
      const hg = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.35, 0, x - rx * 0.2, y - ry * 0.2, rx * 0.9);
      hg.addColorStop(0, 'rgba(255,255,255,0.95)');
      hg.addColorStop(0.1, 'rgba(255,255,255,0.7)');
      hg.addColorStop(0.3, 'rgba(255,255,255,0.3)');
      hg.addColorStop(0.6, 'rgba(255,255,255,0.1)');
      hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();

      // rim - more prominent for definition
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = Math.max(1.5, this.dpr * 0.75) / this.dpr;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();

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

    // Render condensation droplets (tiny sparkling points)
    if (this.enableCondensation && this.condensation.length > 0) {
      ctx.save();
      for (const c of this.condensation) {
        const x = c.x / this.dpr;
        const y = c.y / this.dpr;
        const r = c.r / this.dpr;
        
        // Sparkle effect based on twinkle animation
        const sparkleIntensity = 0.3 + 0.7 * Math.abs(Math.sin(c.twinkle));
        const alpha = c.life * sparkleIntensity * c.sparkle;
        
        // Create sparkling highlight
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        
        // Add a tiny bright center for extra sparkle
        if (alpha > 0.5) {
          ctx.globalAlpha = alpha * 0.8;
          ctx.fillStyle = 'rgba(255, 255, 255, 1)';
          ctx.beginPath();
          ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
          ctx.fill();
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


