# 00_LEDGER.md — MachineMind Landing

## Current Phase: PHASE 6 — SOFIA INTEGRATION COMPLETE
## Last Action: Full Sofia AI Psychological Sales System Deployed

## Decisions Made:
- Gold primary (#c9a96e), Cyan secondary (#00e5ff)
- Clash Display (headings), Satoshi (body), JetBrains Mono (mono)
- Lenis smooth scroll (lerp: 0.07, duration: 1.2)
- Cinema Engine data attributes: data-text, data-velocity, data-magnetic
- Cal.com booking link: https://cal.com/machine-mind/machinemind-strategy-session
- All CTAs link to Cal.com booking
- Sofia AI: 6 mental models, real-time scoring, WhatsApp notifications

## Stack:
- Next.js 16 + TypeScript + Tailwind v4
- Three.js (particle system)
- GSAP + ScrollTrigger
- Lenis smooth scroll
- Vercel deployment
- Claude API (Sofia AI)
- Supabase (conversation tracking)
- Twilio (WhatsApp notifications)

## Components Built:
### Cinema Engine
- /cinema/CinemaEngine.tsx — Text animations, velocity effects, magnetic
- /cinema/ThreeParticles.tsx — Wireframe icosahedron
- /cinema/CinemaComponents.tsx — Preloader, Hero, Cards, Buttons, Sections
- /cinema/Overlays.tsx — Film grain + vignette
- /cinema/AmbientAudio.tsx — Web Audio API
- /cinema/HorizontalScroll.tsx — GSAP ScrollTrigger gallery
- /cinema/GravityCollapse.tsx — Matter.js physics pitch

### Sofia AI System (NEW)
- /lib/sofia/mentalModels.ts — 6 hospitality personas (hustler, delegator, skeptic, visionary, traditionalist, desperate)
- /lib/sofia/scoring.ts — Real-time lead scoring (0-100), gate progression (1-3)
- /lib/sofia/notifications.ts — WhatsApp team alerts for hot leads
- /lib/sofia/index.ts — Module exports
- /components/sofia/SofiaChat.tsx — Chat widget with score display
- /api/sofia/route.ts — Full psychological prompt engineering

## Sofia Psychology Features:
1. **6 Mental Models** - Adapts tone/approach per persona type
2. **Real-Time Scoring** - Business type, pain level, urgency, budget, engagement
3. **3-Gate System** - Discovery → Qualification → Close
4. **Dynamic Prompts** - Claude system prompt adapts based on detected profile
5. **Team Notifications** - WhatsApp alerts for hot leads (score 75+)
6. **Bilingual** - Spanish/English throughout

## Live URLs:
- Production: https://machinemindconsulting.com
- GitHub: https://github.com/Showowt/machinemind-landing

## Environment Variables Required:
- ANTHROPIC_API_KEY (Sofia AI)
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_WHATSAPP_FROM
- PHILIP_PHONE (notification recipient)
- NOTIFY_PHONE (notification recipient)

## Next Session Starts With:
- Monitor Sofia conversations in Supabase
- A/B test opening messages
- Add more case studies to social proof
- Integrate with WhatsApp Business API for multi-channel

## Env Vars: ALL SET
