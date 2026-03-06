/**
 * MACHINEMIND CINEMA ENGINE v2.0
 * Drop-in cinematic web experience library
 * 
 * CDN Dependencies (load BEFORE this file):
 *   - Lenis 1.1.18
 *   - GSAP 3.12.5 + ScrollTrigger
 *   - Three.js r128
 *   - Matter.js 0.20.0
 *   - PixiJS 7.3.2
 *   - SplitType (latest)
 *   - Lottie-web 5.12.2
 *
 * Usage: <script src="cinema-engine.js"></script>
 * All effects activate via data-* attributes. Zero config needed.
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // LAYER 0: PERFORMANCE ENGINE — runs first, determines everything
  // ═══════════════════════════════════════════════════════════════
  const Perf = {
    isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    isLowPower: navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 4 : true,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    tier: 'cinema',

    init() {
      if (this.reducedMotion) this.tier = 'minimal';
      else if (this.isLowPower || this.isMobile) this.tier = 'standard';
      else this.tier = 'cinema';

      document.documentElement.dataset.perfTier = this.tier;

      // GPU hints for animated elements
      document.querySelectorAll('[data-velocity],[data-magnetic],[data-text]').forEach(el => {
        el.style.willChange = 'transform';
      });
    },

    particles(base) {
      if (this.tier === 'minimal') return 0;
      if (this.tier === 'standard') return Math.floor(base * 0.25);
      return base;
    }
  };


  // ═══════════════════════════════════════════════════════════════
  // LAYER 1: PRELOADER
  // ═══════════════════════════════════════════════════════════════
  class Preloader {
    constructor(opts = {}) {
      this.brandName = opts.brandName || 'MACHINEMIND';
      this.accentColor = opts.accentColor || '#c9a96e';
      this.onComplete = opts.onComplete || (() => {});
      this.build();
    }

    build() {
      const el = document.createElement('div');
      el.id = 'cinema-preloader';
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:20px">
          <div class="pl-counter" style="font-family:'Clash Display',sans-serif;font-size:clamp(56px,12vw,140px);font-weight:600;letter-spacing:-0.04em;color:#f0f0f8;line-height:1">0</div>
          <div style="width:180px;height:1px;background:rgba(255,255,255,0.08);position:relative;overflow:hidden">
            <div class="pl-fill" style="position:absolute;left:0;top:0;height:100%;width:0%;background:${this.accentColor}"></div>
          </div>
          <div class="pl-brand" style="font-family:'Satoshi',sans-serif;font-size:10px;letter-spacing:0.35em;text-transform:uppercase;color:rgba(255,255,255,0.3)">${this.brandName}</div>
        </div>`;
      el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#050510;display:flex;align-items:center;justify-content:center';
      document.body.prepend(el);
      document.body.style.overflow = 'hidden';
      this.el = el;
      this.run();
    }

    run() {
      const counter = this.el.querySelector('.pl-counter');
      const fill = this.el.querySelector('.pl-fill');

      if (Perf.reducedMotion) {
        // Skip animation entirely
        setTimeout(() => this.exit(), 200);
        return;
      }

      const tl = gsap.timeline({ onComplete: () => this.exit() });
      tl.to({ v: 0 }, {
        v: 100, duration: 1.6, ease: 'power2.inOut',
        onUpdate() {
          const val = Math.round(this.targets()[0].v);
          counter.textContent = val;
          fill.style.width = val + '%';
        }
      });
    }

    exit() {
      if (Perf.reducedMotion) {
        this.el.remove();
        document.body.style.overflow = '';
        this.onComplete();
        window.dispatchEvent(new CustomEvent('cinema:ready'));
        return;
      }

      gsap.to(this.el, {
        clipPath: 'inset(50% 0 50% 0)',
        duration: 0.7,
        ease: 'power3.inOut',
        onComplete: () => {
          this.el.remove();
          document.body.style.overflow = '';
          this.onComplete();
          window.dispatchEvent(new CustomEvent('cinema:ready'));
        }
      });
    }
  }


  // ═══════════════════════════════════════════════════════════════
  // LAYER 2: SMOOTH SCROLL (Lenis + GSAP sync)
  // ═══════════════════════════════════════════════════════════════
  function initSmoothScroll() {
    if (typeof Lenis === 'undefined') return null;
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    if (typeof gsap !== 'undefined' && gsap.ticker) {
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    if (typeof ScrollTrigger !== 'undefined') {
      lenis.on('scroll', ScrollTrigger.update);
    }
    return lenis;
  }


  // ═══════════════════════════════════════════════════════════════
  // LAYER 3: TEXT SCRAMBLE ENGINE
  // ═══════════════════════════════════════════════════════════════
  class TextScramble {
    constructor(el) {
      this.el = el;
      this.chars = '!<>-_\\/[]{}—=+*^?#________';
      this.frame = 0;
      this.queue = [];
      this.rafId = null;
    }

    setText(newText) {
      const old = this.el.innerText;
      const len = Math.max(old.length, newText.length);
      return new Promise(resolve => {
        this.resolve = resolve;
        this.queue = [];
        for (let i = 0; i < len; i++) {
          this.queue.push({
            from: old[i] || '',
            to: newText[i] || '',
            start: Math.floor(Math.random() * 40),
            end: Math.floor(Math.random() * 40) + Math.floor(Math.random() * 40),
          });
        }
        cancelAnimationFrame(this.rafId);
        this.frame = 0;
        this.update();
      });
    }

    update() {
      let out = '', done = 0;
      for (let i = 0; i < this.queue.length; i++) {
        let { from, to, start, end, char } = this.queue[i];
        if (this.frame >= end) { done++; out += to; }
        else if (this.frame >= start) {
          if (!char || Math.random() < 0.28) {
            char = this.chars[Math.floor(Math.random() * this.chars.length)];
            this.queue[i].char = char;
          }
          out += `<span style="opacity:0.4;color:var(--cinema-accent,#c9a96e)">${char}</span>`;
        } else { out += from; }
      }
      this.el.innerHTML = out;
      if (done === this.queue.length) this.resolve();
      else { this.rafId = requestAnimationFrame(() => { this.frame++; this.update(); }); }
    }
  }


  // ═══════════════════════════════════════════════════════════════
  // LAYER 4: TEXT ANIMATIONS (SplitType powered)
  // ═══════════════════════════════════════════════════════════════
  function initTextAnimations() {
    if (typeof SplitType === 'undefined' || typeof gsap === 'undefined') return;

    // SLIDE UP — words rise from clip-masked lines with slight skew
    document.querySelectorAll('[data-text="slide-up"]').forEach(el => {
      const split = new SplitType(el, { types: 'lines, words' });
      split.lines.forEach(line => {
        const wrap = document.createElement('div');
        wrap.style.overflow = 'hidden';
        line.parentNode.insertBefore(wrap, line);
        wrap.appendChild(line);
      });
      gsap.from(split.words, {
        yPercent: 110, skewY: 3, duration: 1.2, stagger: 0.025,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    // ROTATE IN — characters flip in on Y axis
    document.querySelectorAll('[data-text="rotate-in"]').forEach(el => {
      const split = new SplitType(el, { types: 'chars' });
      split.chars.forEach(c => { c.style.display = 'inline-block'; c.style.perspective = '600px'; });
      gsap.from(split.chars, {
        rotateY: 90, opacity: 0, duration: 0.7, stagger: 0.018,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 82%', once: true }
      });
    });

    // SCROLL FADE — words illuminate as you scroll through
    document.querySelectorAll('[data-text="scroll-fade"]').forEach(el => {
      const split = new SplitType(el, { types: 'words' });
      split.words.forEach(w => { w.style.opacity = '0.08'; w.style.transition = 'opacity 0.25s'; });
      ScrollTrigger.create({
        trigger: el, start: 'top 72%', end: 'bottom 28%',
        onUpdate: (self) => {
          const idx = Math.floor(self.progress * split.words.length);
          split.words.forEach((w, i) => {
            if (w.dataset.accent) {
              w.style.opacity = i <= idx ? '1' : '0.08';
              w.style.color = i <= idx ? 'var(--cinema-accent, #c9a96e)' : '';
            } else {
              w.style.opacity = i <= idx ? '1' : '0.08';
            }
          });
        }
      });
    });

    // SCRAMBLE — characters decode from random glyphs
    document.querySelectorAll('[data-text="scramble"]').forEach(el => {
      const scrambler = new TextScramble(el);
      const final = el.textContent;
      el.textContent = '';
      ScrollTrigger.create({
        trigger: el, start: 'top 82%',
        onEnter: () => scrambler.setText(final), once: true
      });
    });

    // WAVE — characters stagger in a sine pattern
    document.querySelectorAll('[data-text="wave"]').forEach(el => {
      const split = new SplitType(el, { types: 'chars' });
      split.chars.forEach(c => c.style.display = 'inline-block');
      gsap.from(split.chars, {
        y: (i) => Math.sin(i * 0.5) * 50,
        opacity: 0, duration: 0.55, stagger: 0.012, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }
      });
    });

    // CHARS UP — individual characters slide up (classic editorial)
    document.querySelectorAll('[data-text="chars-up"]').forEach(el => {
      const split = new SplitType(el, { types: 'lines, chars' });
      split.lines.forEach(line => {
        const wrap = document.createElement('div');
        wrap.style.overflow = 'hidden';
        line.parentNode.insertBefore(wrap, line);
        wrap.appendChild(line);
      });
      gsap.from(split.chars, {
        yPercent: 100, duration: 0.8, stagger: 0.015, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }
      });
    });
  }


  // ═══════════════════════════════════════════════════════════════
  // LAYER 5: SCROLL VELOCITY REACTIONS
  // ═══════════════════════════════════════════════════════════════
  class ScrollVelocity {
    constructor() {
      this.v = 0;
      this.lastY = window.scrollY;
      this.lastT = Date.now();
      this.els = document.querySelectorAll('[data-velocity]');
      if (!this.els.length) return;
      window.addEventListener('scroll', () => {
        const now = Date.now();
        const dt = now - this.lastT;
        if (dt > 0) {
          this.v = (window.scrollY - this.lastY) / dt;
          this.lastY = window.scrollY;
          this.lastT = now;
        }
      }, { passive: true });
      this.tick();
    }

    tick() {
      requestAnimationFrame(() => this.tick());
      this.v *= 0.9;
      const abs = Math.min(Math.abs(this.v), 1);
      this.els.forEach(el => {
        switch (el.dataset.velocity) {
          case 'skew':
            el.style.transform = `skewY(${this.v * 3}deg)`; break;
          case 'blur':
            el.style.filter = `blur(${abs * 6}px)`; break;
          case 'stretch':
            el.style.transform = `scaleY(${1 + abs * 0.12})`; break;
          case 'opacity':
            el.style.opacity = 1 - abs * 0.4; break;
          case 'letterspace':
            el.style.letterSpacing = `${abs * 15}px`; break;
          case 'rgb-split':
            const s = abs * 3;
            el.style.textShadow = `${s}px 0 rgba(255,0,0,0.5), -${s}px 0 rgba(0,255,255,0.5)`; break;
        }
      });
    }
  }


  // ═══════════════════════════════════════════════════════════════
  // LAYER 6: MAGNETIC ELEMENTS
  // ═══════════════════════════════════════════════════════════════
  function initMagnetics() {
    document.querySelectorAll('[data-magnetic]').forEach(el => {
      const strength = parseFloat(el.dataset.magnetic) || 0.3;
      const inner = el.querySelector('[data-magnetic-inner]');

      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        gsap.to(el, { x: dx * strength, y: dy * strength, duration: 0.35, ease: 'power3.out' });
        if (inner) gsap.to(inner, { x: dx * strength * 0.5, y: dy * strength * 0.5, duration: 0.35, ease: 'power3.out' });
      });

      el.addEventListener('mouseleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.55, ease: 'elastic.out(1, 0.4)' });
        if (inner) gsap.to(inner, { x: 0, y: 0, duration: 0.55, ease: 'elastic.out(1, 0.4)' });
      });
    });
  }


  // ═══════════════════════════════════════════════════════════════
  // LAYER 7: MAGNETIC IMAGE HOVER
  // ═══════════════════════════════════════════════════════════════
  function initMagneticImages() {
    document.querySelectorAll('[data-magnetic-image]').forEach(el => {
      const img = el.querySelector('img');
      if (!img) return;
      el.style.position = 'relative';
      el.style.overflow = 'hidden';

      // Light overlay
      const ov = document.createElement('div');
      ov.style.cssText = `position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity 0.3s;
        background:radial-gradient(circle at var(--mx,50%) var(--my,50%),rgba(255,255,255,0.12) 0%,transparent 55%);
        mix-blend-mode:overlay;`;
      el.appendChild(ov);

      el.addEventListener('mouseenter', () => ov.style.opacity = '1');
      el.addEventListener('mouseleave', () => {
        ov.style.opacity = '0';
        gsap.to(img, { scale: 1, x: 0, y: 0, duration: 0.5, ease: 'power3.out' });
      });
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const mx = ((e.clientX - r.left) / r.width * 100);
        const my = ((e.clientY - r.top) / r.height * 100);
        el.style.setProperty('--mx', mx + '%');
        el.style.setProperty('--my', my + '%');
        const dx = (e.clientX - r.left - r.width / 2) / r.width;
        const dy = (e.clientY - r.top - r.height / 2) / r.height;
        gsap.to(img, { scale: 1.04, x: dx * 8, y: dy * 8, duration: 0.35, ease: 'power2.out' });
      });
    });
  }


  // ═══════════════════════════════════════════════════════════════
  // LAYER 8: PIXI.JS IMAGE DISPLACEMENT
  // ═══════════════════════════════════════════════════════════════
  function initPixiDisplacement() {
    if (typeof PIXI === 'undefined' || Perf.tier !== 'cinema') return;

    // Generate noise displacement map programmatically
    function makeNoiseTexture(size) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const d = ctx.createImageData(size, size);
      for (let i = 0; i < d.data.length; i += 4) {
        const n = Math.random() * 255;
        d.data[i] = n; d.data[i+1] = n; d.data[i+2] = n; d.data[i+3] = 255;
      }
      ctx.putImageData(d, 0, 0);
      return c.toDataURL();
    }

    document.querySelectorAll('[data-displacement]').forEach(container => {
      const imgSrc = container.dataset.displacementSrc || container.querySelector('img')?.src;
      if (!imgSrc) return;

      const app = new PIXI.Application({
        width: container.offsetWidth,
        height: container.offsetHeight,
        backgroundAlpha: 0,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
      });
      container.appendChild(app.view || app.canvas);

      // Hide original img
      const origImg = container.querySelector('img');
      if (origImg) origImg.style.visibility = 'hidden';

      const noiseUrl = container.dataset.displacementMap || makeNoiseTexture(256);
      const dispSprite = PIXI.Sprite.from(noiseUrl);
      dispSprite.texture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
      const dispFilter = new PIXI.DisplacementFilter(dispSprite);
      dispFilter.scale.set(0);

      const mainSprite = PIXI.Sprite.from(imgSrc);
      mainSprite.width = container.offsetWidth;
      mainSprite.height = container.offsetHeight;

      app.stage.addChild(mainSprite);
      app.stage.addChild(dispSprite);
      mainSprite.filters = [dispFilter];

      let target = 0;
      container.addEventListener('mouseenter', () => target = 25);
      container.addEventListener('mouseleave', () => target = 0);
      container.addEventListener('mousemove', (e) => {
        const r = container.getBoundingClientRect();
        dispSprite.x = e.clientX - r.left;
        dispSprite.y = e.clientY - r.top;
      });

      app.ticker.add(() => {
        const cur = dispFilter.scale.x;
        dispFilter.scale.set(cur + (target - cur) * 0.05);
        dispSprite.rotation += 0.001;
      });
    });
  }


  // ═══════════════════════════════════════════════════════════════
  // LAYER 9: SVG LINE DRAWING ON SCROLL
  // ═══════════════════════════════════════════════════════════════
  function initSVGDraw() {
    document.querySelectorAll('[data-svg-draw]').forEach(svg => {
      const paths = svg.querySelectorAll('path,line,polyline,circle,polygon,rect');
      paths.forEach(p => {
        const len = p.getTotalLength ? p.getTotalLength() : 800;
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = len;
        p.style.fill = 'none';
      });
      ScrollTrigger.create({
        trigger: svg, start: 'top 78%', end: 'bottom 22%', scrub: 1,
        onUpdate: (self) => {
          paths.forEach(p => {
            const len = p.getTotalLength ? p.getTotalLength() : 800;
            p.style.strokeDashoffset = len * (1 - self.progress);
          });
        }
      });
    });
  }


  // ═══════════════════════════════════════════════════════════════
  // LAYER 10: LOTTIE INTEGRATION
  // ═══════════════════════════════════════════════════════════════
  function initLottie() {
    if (typeof lottie === 'undefined') return;
    document.querySelectorAll('[data-lottie]').forEach(el => {
      const anim = lottie.loadAnimation({
        container: el,
        renderer: 'svg',
        loop: el.dataset.lottieLoop === 'true',
        autoplay: false,
        path: el.dataset.lottie,
      });
      if (el.dataset.lottieScroll === 'true') {
        ScrollTrigger.create({
          trigger: el, start: 'top 80%', end: 'bottom 20%',
          onUpdate: (self) => anim.goToAndStop(Math.floor(self.progress * (anim.totalFrames - 1)), true)
        });
      } else {
        ScrollTrigger.create({
          trigger: el, start: 'top 78%',
          onEnter: () => anim.play(), once: true
        });
      }
    });
  }


  // ═══════════════════════════════════════════════════════════════
  // LAYER 11: CUSTOM CURSOR
  // ═══════════════════════════════════════════════════════════════
  function initCursor() {
    if (Perf.isMobile || Perf.reducedMotion) return;

    const dot = document.createElement('div');
    const ring = document.createElement('div');
    dot.className = 'cinema-cursor-dot';
    ring.className = 'cinema-cursor-ring';
    dot.style.cssText = 'position:fixed;width:6px;height:6px;border-radius:50%;background:var(--cinema-accent,#c9a96e);pointer-events:none;z-index:99998;top:0;left:0;mix-blend-mode:difference;transition:transform 0.1s';
    ring.style.cssText = 'position:fixed;width:36px;height:36px;border-radius:50%;border:1px solid var(--cinema-accent,#c9a96e);pointer-events:none;z-index:99997;top:0;left:0;mix-blend-mode:difference;transition:width 0.3s,height 0.3s,border-color 0.3s';
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    let mx = 0, my = 0, rx = 0, ry = 0;
    document.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });

    function tick() {
      requestAnimationFrame(tick);
      rx += (mx - rx) * 0.15;
      ry += (my - ry) * 0.15;
      dot.style.transform = `translate(${mx - 3}px, ${my - 3}px)`;
      ring.style.transform = `translate(${rx - 18}px, ${ry - 18}px)`;
    }
    tick();

    // Expand on interactives
    const interactives = 'a,button,[data-magnetic],[role="button"],[tabindex]';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(interactives)) {
        ring.style.width = '50px';
        ring.style.height = '50px';
        ring.style.transform = `translate(${rx - 25}px, ${ry - 25}px)`;
      }
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(interactives)) {
        ring.style.width = '36px';
        ring.style.height = '36px';
      }
    });

    // Hide default cursor
    document.documentElement.style.cursor = 'none';
    document.querySelectorAll('a,button,[data-magnetic]').forEach(el => el.style.cursor = 'none');
  }


  // ═══════════════════════════════════════════════════════════════
  // LAYER 12: AMBIENT OVERLAYS (grain + vignette)
  // ═══════════════════════════════════════════════════════════════
  function initOverlays() {
    if (Perf.tier === 'minimal') return;

    // Grain
    const grain = document.createElement('div');
    grain.className = 'cinema-grain';
    grain.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:99990;opacity:0.025;
      background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      background-size:128px;`;
    document.body.appendChild(grain);

    // Vignette
    const vig = document.createElement('div');
    vig.className = 'cinema-vignette';
    vig.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99989;box-shadow:inset 0 0 150px rgba(0,0,0,0.5)';
    document.body.appendChild(vig);
  }


  // ═══════════════════════════════════════════════════════════════
  // LAYER 13: SCROLL AUDIO
  // ═══════════════════════════════════════════════════════════════
  class ScrollAudio {
    constructor() {
      this.ctx = null;
      this.ready = false;
      const go = () => {
        if (this.ready) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.ready = true;
        this.ambient();
        document.removeEventListener('click', go);
      };
      document.addEventListener('click', go, { once: true });
    }

    ambient() {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = 'sine'; osc.frequency.value = 55;
      filter.type = 'lowpass'; filter.frequency.value = 180;
      gain.gain.value = 0.025;
      osc.connect(filter).connect(gain).connect(this.ctx.destination);
      osc.start();
      window.addEventListener('scroll', () => {
        const p = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        osc.frequency.value = 40 + p * 80;
        filter.frequency.value = 100 + p * 300;
      }, { passive: true });
    }

    tick() {
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.frequency.value = 700 + Math.random() * 500;
      o.type = 'sine';
      g.gain.setValueAtTime(0.04, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
      o.connect(g).connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + 0.06);
    }
  }


  // ═══════════════════════════════════════════════════════════════
  // LAYER 14: SCROLL PROGRESS CSS VARIABLE
  // ═══════════════════════════════════════════════════════════════
  function initScrollProgress() {
    // Global --scroll-progress (0 to 1)
    ScrollTrigger.create({
      trigger: document.body, start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => {
        document.documentElement.style.setProperty('--scroll-progress', self.progress.toFixed(4));
      }
    });

    // Progress bar
    if (document.querySelector('[data-progress-bar]') === null) {
      const bar = document.createElement('div');
      bar.dataset.progressBar = '';
      bar.style.cssText = `position:fixed;top:0;left:0;height:2px;z-index:99995;pointer-events:none;
        background:linear-gradient(90deg,var(--cinema-accent,#c9a96e),var(--cinema-accent2,#00e5ff));
        width:calc(var(--scroll-progress, 0) * 100%);transition:none;`;
      document.body.appendChild(bar);
    }
  }


  // ═══════════════════════════════════════════════════════════════
  // LAYER 15: STAGGERED REVEAL SECTIONS
  // ═══════════════════════════════════════════════════════════════
  function initReveals() {
    // Generic section reveals
    document.querySelectorAll('[data-reveal]').forEach(section => {
      const items = section.querySelectorAll('[data-reveal-item]');
      if (!items.length) return;
      gsap.from(items, {
        y: 50, opacity: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 82%', once: true }
      });
    });

    // Scale reveals
    document.querySelectorAll('[data-reveal="scale"]').forEach(el => {
      gsap.from(el, {
        scale: 0.85, opacity: 0, duration: 1, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }
      });
    });

    // Clip-path reveals on images
    document.querySelectorAll('[data-reveal="clip"]').forEach(el => {
      gsap.from(el, {
        clipPath: 'inset(50% 50% 50% 50%)', duration: 1.2, ease: 'power3.inOut',
        scrollTrigger: { trigger: el, start: 'top 78%', once: true }
      });
    });
  }


  // ═══════════════════════════════════════════════════════════════
  // MASTER BOOT SEQUENCE
  // ═══════════════════════════════════════════════════════════════
  function boot(config = {}) {
    // 0. Perf detection
    Perf.init();

    // Reduced motion — skip almost everything
    if (Perf.reducedMotion) {
      document.querySelectorAll('[data-text] *').forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    }

    // 1. Register GSAP plugins
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
    }

    // 2. Preloader (triggers cinema:ready on complete)
    if (config.skipPreloader) {
      window.dispatchEvent(new CustomEvent('cinema:ready'));
    } else {
      new Preloader({
        brandName: config.brandName || 'MACHINEMIND',
        accentColor: config.accentColor || '#c9a96e',
      });
    }

    // 3. Everything else waits for preloader
    window.addEventListener('cinema:ready', () => {
      // Smooth scroll
      const lenis = initSmoothScroll();

      // Text animations
      if (Perf.tier !== 'minimal') {
        initTextAnimations();
        new ScrollVelocity();
      }

      // Interactives
      initMagnetics();
      initMagneticImages();

      // Visual layers
      initOverlays();
      initCursor();
      initSVGDraw();
      initLottie();
      initReveals();
      initScrollProgress();

      // Heavy layers (cinema tier only)
      if (Perf.tier === 'cinema') {
        initPixiDisplacement();
      }

      // Sound (optional — only if element exists or config enables)
      if (config.sound && !Perf.reducedMotion) {
        const audio = new ScrollAudio();
        document.querySelectorAll('a,button,[data-magnetic]').forEach(el => {
          el.addEventListener('mouseenter', () => audio.tick());
        });
      }

      // Expose lenis globally for external control
      window.cinemaLenis = lenis;

      console.log(`%c[CINEMA ENGINE v2.0] Tier: ${Perf.tier} | Layers: active`, 'color:#c9a96e;font-weight:bold');
    }, { once: true });
  }


  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════
  window.CinemaEngine = {
    boot,
    Perf,
    Preloader,
    TextScramble,
    ScrollVelocity,
    ScrollAudio,
    // Manual inits (for lazy loading or dynamic content)
    initTextAnimations,
    initMagnetics,
    initMagneticImages,
    initPixiDisplacement,
    initSVGDraw,
    initLottie,
    initCursor,
    initReveals,
  };

  // AUTO-BOOT if data attribute present on body
  if (document.body?.dataset.cinemaAuto !== undefined) {
    document.addEventListener('DOMContentLoaded', () => {
      boot({
        brandName: document.body.dataset.cinemaBrand || 'MACHINEMIND',
        accentColor: document.body.dataset.cinemaAccent || '#c9a96e',
        sound: document.body.dataset.cinemaSound === 'true',
        skipPreloader: document.body.dataset.cinemaNopreloader !== undefined,
      });
    });
  }

})();
