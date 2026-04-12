# Cinema Engine Builder

Build luxury cinematic websites with the MachineMind aesthetic. Dark void backgrounds, gold accents, GSAP animations, film grain overlays.

## Triggers
- "build a site"
- "landing page"
- "client demo"
- "website for"
- "create a page"

## Design System (Non-Negotiable)

### Colors
```css
--void: #06060a;
--surface: #0a0a0a;
--elevated: #111111;
--border: rgba(255,255,255,0.06);
--gold: #c9a96e;
--gold-bright: #d4af37;
--cyan: #00e5ff;
--white: #ffffff;
--muted: rgba(240,240,243,0.3);
```

### Typography
- **Headings:** Clash Display (fallback: system-ui)
- **Body:** Satoshi (fallback: Inter, system-ui)
- **Accents:** Instrument Serif italic

### BANNED Elements
- White backgrounds
- Inter/Roboto fonts
- Purple gradients
- Rounded shadow cards
- Emoji in professional copy
- Gray text on gray backgrounds

## Build Structure

```
/app
  page.tsx           → Main landing with CinemaHero
  layout.tsx         → Dark theme, fonts, metadata
/components
  /cinema
    CinemaHero.tsx   → Animated hero section
    CinemaPreloader.tsx → Logo reveal animation
    FilmGrain.tsx    → Noise overlay
    ScrollProgress.tsx → Gold progress bar
    GoldButton.tsx   → Animated CTA buttons
    TextReveal.tsx   → Word-by-word animation
```

## Required Elements

### 1. Preloader (800ms)
- Void black → Logo materializes from particles
- Fade to content

### 2. Hero Section
- Full viewport height
- Large display typography
- Subtle background animation (particles/gradient)
- Primary CTA with gold accent

### 3. Scroll Animations
- Elements enter: `translateY(40px) opacity(0)` → `translateY(0) opacity(1)`
- Duration: 600ms, stagger: 100ms
- Use GSAP ScrollTrigger

### 4. Cards
- Glass background: `rgba(255,255,255,0.02)`
- Glass border: `1px solid rgba(255,255,255,0.06)`
- Gold top-border on hover
- NO rounded corners
- NO drop shadows

### 5. Buttons
- 1px gold border
- Transparent background
- Fill slides up on hover
- Text color inverts on hover

### 6. Overlays
- Film grain: 3% opacity, pointer-events: none
- Vignette: radial gradient from transparent to #06060a
- Scroll progress: fixed gold bar at top

## GSAP Setup

```tsx
'use client'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Standard reveal animation
useEffect(() => {
  gsap.fromTo('.reveal-element',
    { y: 40, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration: 0.6,
      stagger: 0.1,
      scrollTrigger: {
        trigger: '.reveal-element',
        start: 'top 85%',
      }
    }
  )
}, [])
```

## Execution Protocol

1. **Scaffold** - Create file structure with all required components
2. **Hero First** - Build the hero section with full animation
3. **Sections** - Add remaining sections with scroll animations
4. **Overlays** - Apply film grain, vignette, progress bar
5. **Polish** - Responsive checks, performance audit
6. **Build** - Run `npm run build`, fix all errors
7. **Deploy** - Push to GitHub, verify Vercel deployment

## Quality Gates

Before marking complete:
- [ ] Background is #06060a everywhere
- [ ] No white backgrounds anywhere
- [ ] GSAP animations working
- [ ] Mobile responsive (test 375px, 768px, 1024px)
- [ ] Film grain overlay active
- [ ] Scroll progress bar visible
- [ ] All text readable (contrast check)
- [ ] `npm run build` passes with zero errors
