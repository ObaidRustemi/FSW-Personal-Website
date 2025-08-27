// Canvas2D compositor for rain-on-glass effect integrated with the menu overlay
// Lightweight MVP: capture overlay background on open, render refractive droplets

const DPR_CAP = 2; // performance cap

class RainOnGlass {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = this.canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    this.drops = [];
    this.micro = [];
    this.running = false;
    this.last = 0;

    // offscreen buffers for sharp/blurred background
    this.bgSharp = document.createElement('canvas');
    this.bgBlur = document.createElement('canvas');
    this.bgSharpCtx = this.bgSharp.getContext('2d');
    this.bgBlurCtx = this.bgBlur.getContext('2d');

    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  async captureBackground() {
    const overlay = document.querySelector('.menu .menu-overlay');
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
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
      this.bgSharpCtx.drawImage(shot, 0, 0);
      this.bgBlurCtx.filter = 'blur(8px)';
      this.bgBlurCtx.drawImage(this.bgSharp, 0, 0);
      this.bgBlurCtx.filter = 'none';
    } catch (e) {
      // fallback: clear buffers
      this.bgSharpCtx.clearRect(0, 0, this.bgSharp.width, this.bgSharp.height);
      this.bgBlurCtx.clearRect(0, 0, this.bgBlur.width, this.bgBlur.height);
      // eslint-disable-next-line no-console
      console.warn('RainOnGlass background capture failed:', e);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    // initial population
    for (let i = 0; i < 12; i++) this.spawn();
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
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  spawn(x, y, r) {
    const radius = r || Math.max(8, Math.exp(Math.random() * 1.2) * 6);
    this.drops.push({
      x: x ?? Math.random() * this.canvas.width,
      y: y ?? (-20 * this.dpr),
      r: radius,
      vx: (Math.random() - 0.5) * 0.4,
      vy: 0,
      stretch: 1,
      stick: 0.92 + Math.random() * 0.06
    });
  }

  update(dt) {
    const g = 0.28;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.vy += g * (d.r / 18);
      d.vy *= d.stick;
      d.vx *= 0.985;
      d.stretch = 1 + Math.min(d.vy / (10 * d.r), 1.1);
      d.x += d.vx * this.dpr;
      d.y += d.vy * this.dpr;
      if (d.y - d.r > this.canvas.height + 40) this.drops.splice(i, 1);
    }

    // merging (coarse)
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

    // keep population
    if (this.drops.length < 80 && Math.random() < 0.2) this.spawn();
  }

  render() {
    const ctx = this.ctx;
    this.clear();

    // draw droplets with refraction
    for (const d of this.drops) {
      const x = d.x / this.dpr;
      const y = d.y / this.dpr;
      const rx = (d.r * 0.92) / this.dpr;
      const ry = (d.r * 0.92 * d.stretch) / this.dpr;

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.clip();
      // draw blurred snapshot (base) then sharp snapshot slightly offset (refraction)
      const offsetX = (d.r * 0.25) / this.dpr;
      const offsetY = (-d.r * 0.15) / this.dpr;
      ctx.drawImage(this.bgBlur, 0, 0, this.canvas.width, this.canvas.height, 0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
      ctx.drawImage(this.bgSharp, 0, 0, this.canvas.width, this.canvas.height, offsetX, offsetY, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
      ctx.restore();

      // specular highlight
      const hg = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.35, rx * 0.05, x, y, rx);
      hg.addColorStop(0, 'rgba(255,255,255,0.9)');
      hg.addColorStop(0.2, 'rgba(255,255,255,0.45)');
      hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();

      // rim
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = Math.max(1, this.dpr) / this.dpr;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  loop(t) {
    if (!this.running) return;
    const dt = Math.min((t - this.last) / 1000, 0.1);
    this.last = t;
    this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
  }
}

// Wire to menu toggler
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

function onClose() {
  if (rain) rain.stop();
}

if (toggler) {
  toggler.addEventListener('change', () => {
    if (toggler.checked) onOpen(); else onClose();
  });
}

// also expose for manual debugging
window.__rainOnGlass = {
  capture: () => rain?.captureBackground(),
  start: () => rain?.start(),
  stop: () => rain?.stop()
};


