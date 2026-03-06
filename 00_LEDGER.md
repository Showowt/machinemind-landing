# 00_LEDGER.md — MachineMind Landing

## Current Phase: PHASE 5 — POLISH
## Last Action: Added Cinema Engine TSX Component Library

## Decisions Made:
- Gold primary (#c9a96e), Cyan secondary (#00e5ff)
- Clash Display (headings), Satoshi (body), JetBrains Mono (mono)
- Lenis smooth scroll (lerp: 0.07, duration: 1.2)
- Cinema Engine data attributes: data-text, data-velocity, data-magnetic
- Cal.com booking link: https://cal.com/machine-mind/machinemind-strategy-session
- All CTAs link to Cal.com booking

## Stack:
- Next.js 16 + TypeScript + Tailwind v4
- Three.js (particle system)
- GSAP + ScrollTrigger
- Lenis smooth scroll
- Vercel deployment

## Components Built:
- /cinema/CinemaEngine.tsx — Text animations, velocity effects, magnetic
- /cinema/ThreeParticles.tsx — Wireframe icosahedron
- /cinema/CinemaComponents.tsx — Preloader, Hero, Cards, Buttons, Sections
- /cinema/Overlays.tsx — Film grain + vignette
- /cinema/AmbientAudio.tsx — Web Audio API
- /cinema/HorizontalScroll.tsx — GSAP ScrollTrigger gallery

## Live URLs:
- Production: https://machinemindconsulting.com
- GitHub: https://github.com/Showowt/machinemind-landing

## Next Session Starts With:
- Test Cinema Components on live page
- Add testimonials section using TestimonialCard
- Verify smooth scroll performance on mobile

## Env Vars: ALL SET
