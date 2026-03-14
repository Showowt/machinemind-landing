'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type Lang = 'en' | 'es' | 'fr' | 'pt'

const t = {
  en: {
    badge: 'Early Access',
    eyebrow: 'Real-Time Voice Translation',
    h1_1: 'She speaks Spanish.',
    h1_2: 'You hear ',
    h1_accent: 'English.',
    sub: 'The only app that translates voice messages, video calls, and face-to-face conversations. Instantly. Built for everyone who refuses to let language kill connection.',
    namePlaceholder: 'Your name',
    phonePlaceholder: '+57 300 123 4567',
    whatsappHint: "We'll notify you via WhatsApp when it's your turn",
    emailPlaceholder: 'Email (optional)',
    submitBtn: 'Join Waitlist',
    submitting: 'Joining...',
    formNote: 'First <strong>500</strong> get lifetime free access. No card required.',
    errorWhatsappOrEmail: 'Enter your WhatsApp number or email',
    errorNoCountryCode: 'Include your country code (e.g. +1, +57, +55, +33)',
    errorInvalidPhone: 'Phone must be 10-15 digits with country code (e.g. +57 300 123 4567)',
    errorDuplicate: "You're already on the waitlist!",
    errorGeneric: 'Something went wrong. Try again.',
    errorConnection: 'Connection error. Try again.',
    successPos: 'Your position on the waitlist',
    successMsg: 'You are in. We will reach out when it is your turn.',
    shareX: 'Share on X',
    shareWA: 'WhatsApp',
    copyLink: 'Copy Link',
    copied: 'Copied',
    counterWaitlist: 'On The Waitlist',
    counterSpots: 'Free Spots Left',
    counterModes: 'Translation Modes',
    scrollFade: 'You matched with someone <accent>incredible</accent>. She sent a voice message. Two minutes of Spanish you cannot understand. You open Google Translate. You type. She waits. The moment <accent>dies</accent>. VoxLink makes that moment <accent>live</accent>.',
    featLabel: 'Three Modes',
    featTitle: 'Every conversation covered.',
    feat1Title: 'VoxNote',
    feat1Desc: 'Translate WhatsApp voice messages instantly. She sends audio in Spanish. You read it in English. Reply back translated. No more copy-paste.',
    feat2Title: 'Video Call',
    feat2Desc: 'Live translated video calls with real-time subtitles. She speaks her language. You see yours. Like having a translator on every call.',
    feat3Title: 'Face-to-Face',
    feat3Desc: 'On a date. At dinner. Place one phone between you. Both speak naturally. Both see the translation live. The barrier disappears.',
    proofQuote: '"I kept getting voice messages from my date and had <em>no idea</em> what she was saying. VoxLink changed everything."',
    proofWho: '— American expat, Medellin',
    ctaLabel: 'The Waitlist Is Open',
    ctaTitle: 'Stop losing connections to language.',
    ctaBtn: 'Get Early Access',
  },
  es: {
    badge: 'Acceso Anticipado',
    eyebrow: 'Traduccion de Voz en Tiempo Real',
    h1_1: 'Ella habla espanol.',
    h1_2: 'Tu escuchas en ',
    h1_accent: 'ingles.',
    sub: 'La unica app que traduce mensajes de voz, videollamadas y conversaciones cara a cara. Al instante. Para todos los que se niegan a dejar que el idioma mate la conexion.',
    namePlaceholder: 'Tu nombre',
    phonePlaceholder: '+57 300 123 4567',
    whatsappHint: 'Te notificaremos por WhatsApp cuando sea tu turno',
    emailPlaceholder: 'Correo electronico (opcional)',
    submitBtn: 'Unirme',
    submitting: 'Registrando...',
    formNote: 'Los primeros <strong>500</strong> obtienen acceso gratis de por vida. Sin tarjeta.',
    errorWhatsappOrEmail: 'Ingresa tu numero de WhatsApp o correo',
    errorNoCountryCode: 'Incluye tu codigo de pais (ej. +1, +57, +55, +33)',
    errorInvalidPhone: 'El numero debe tener 10-15 digitos con codigo de pais (ej. +57 300 123 4567)',
    errorDuplicate: 'Ya estas en la lista de espera!',
    errorGeneric: 'Algo salio mal. Intenta de nuevo.',
    errorConnection: 'Error de conexion. Intenta de nuevo.',
    successPos: 'Tu posicion en la lista de espera',
    successMsg: 'Estas dentro. Te contactaremos cuando sea tu turno.',
    shareX: 'Compartir en X',
    shareWA: 'WhatsApp',
    copyLink: 'Copiar enlace',
    copied: 'Copiado',
    counterWaitlist: 'En la Lista',
    counterSpots: 'Lugares Gratis',
    counterModes: 'Modos de Traduccion',
    scrollFade: 'Hiciste match con alguien <accent>increible</accent>. Ella envio un mensaje de voz. Dos minutos de espanol que no entiendes. Abres Google Translate. Escribes. Ella espera. El momento <accent>muere</accent>. VoxLink hace que ese momento <accent>viva</accent>.',
    featLabel: 'Tres Modos',
    featTitle: 'Cada conversacion cubierta.',
    feat1Title: 'VoxNote',
    feat1Desc: 'Traduce mensajes de voz de WhatsApp al instante. Ella envia audio en espanol. Tu lo lees en ingles. Responde traducido. Sin mas copiar y pegar.',
    feat2Title: 'Videollamada',
    feat2Desc: 'Videollamadas traducidas en vivo con subtitulos en tiempo real. Ella habla su idioma. Tu ves el tuyo. Como tener un traductor en cada llamada.',
    feat3Title: 'Cara a Cara',
    feat3Desc: 'En una cita. En la cena. Pon un telefono entre los dos. Ambos hablan naturalmente. Ambos ven la traduccion en vivo. La barrera desaparece.',
    proofQuote: '"Seguia recibiendo mensajes de voz de mi cita y <em>no tenia idea</em> de lo que decia. VoxLink lo cambio todo."',
    proofWho: '— Expatriado americano, Medellin',
    ctaLabel: 'La Lista Esta Abierta',
    ctaTitle: 'Deja de perder conexiones por el idioma.',
    ctaBtn: 'Obtener Acceso',
  },
  fr: {
    badge: 'Acces Anticipe',
    eyebrow: 'Traduction Vocale en Temps Reel',
    h1_1: 'Elle parle espagnol.',
    h1_2: 'Vous entendez en ',
    h1_accent: 'anglais.',
    sub: "La seule application qui traduit les messages vocaux, les appels video et les conversations en personne. Instantanement. Pour tous ceux qui refusent de laisser la langue tuer la connexion.",
    namePlaceholder: 'Votre nom',
    phonePlaceholder: '+33 6 12 34 56 78',
    whatsappHint: 'Nous vous notifierons par WhatsApp quand ce sera votre tour',
    emailPlaceholder: 'Email (optionnel)',
    submitBtn: 'Rejoindre',
    submitting: 'Inscription...',
    formNote: 'Les <strong>500</strong> premiers obtiennent un acces gratuit a vie. Sans carte.',
    errorWhatsappOrEmail: 'Entrez votre numero WhatsApp ou email',
    errorNoCountryCode: 'Incluez votre code pays (ex. +1, +57, +55, +33)',
    errorInvalidPhone: 'Le numero doit avoir 10-15 chiffres avec code pays (ex. +33 6 12 34 56 78)',
    errorDuplicate: "Vous etes deja sur la liste d'attente !",
    errorGeneric: "Quelque chose s'est mal passe. Reessayez.",
    errorConnection: 'Erreur de connexion. Reessayez.',
    successPos: "Votre position sur la liste d'attente",
    successMsg: 'Vous y etes. Nous vous contacterons quand ce sera votre tour.',
    shareX: 'Partager sur X',
    shareWA: 'WhatsApp',
    copyLink: 'Copier le lien',
    copied: 'Copie',
    counterWaitlist: "Sur la Liste d'Attente",
    counterSpots: 'Places Gratuites',
    counterModes: 'Modes de Traduction',
    scrollFade: "Vous avez matche avec quelqu'un d'<accent>incroyable</accent>. Elle a envoye un message vocal. Deux minutes d'espagnol que vous ne comprenez pas. Vous ouvrez Google Translate. Vous tapez. Elle attend. Le moment <accent>meurt</accent>. VoxLink fait <accent>vivre</accent> ce moment.",
    featLabel: 'Trois Modes',
    featTitle: 'Chaque conversation couverte.',
    feat1Title: 'VoxNote',
    feat1Desc: "Traduisez les messages vocaux WhatsApp instantanement. Elle envoie un audio en espagnol. Vous le lisez en anglais. Repondez traduit. Plus de copier-coller.",
    feat2Title: 'Appel Video',
    feat2Desc: "Appels video traduits en direct avec sous-titres en temps reel. Elle parle sa langue. Vous voyez la votre. Comme avoir un traducteur a chaque appel.",
    feat3Title: 'Face-a-Face',
    feat3Desc: "A un rendez-vous. Au diner. Placez un telephone entre vous. Chacun parle naturellement. Chacun voit la traduction en direct. La barriere disparait.",
    proofQuote: '"Je recevais des messages vocaux de mon rendez-vous et je <em>n\'avais aucune idee</em> de ce qu\'elle disait. VoxLink a tout change."',
    proofWho: '— Expatrie americain, Medellin',
    ctaLabel: "La Liste d'Attente Est Ouverte",
    ctaTitle: 'Arretez de perdre des connexions a cause de la langue.',
    ctaBtn: 'Obtenir un Acces',
  },
  pt: {
    badge: 'Acesso Antecipado',
    eyebrow: 'Traducao de Voz em Tempo Real',
    h1_1: 'Ela fala espanhol.',
    h1_2: 'Voce ouve em ',
    h1_accent: 'ingles.',
    sub: 'O unico aplicativo que traduz mensagens de voz, chamadas de video e conversas presenciais. Instantaneamente. Para todos que se recusam a deixar o idioma matar a conexao.',
    namePlaceholder: 'Seu nome',
    phonePlaceholder: '+55 11 91234 5678',
    whatsappHint: 'Notificaremos voce pelo WhatsApp quando for sua vez',
    emailPlaceholder: 'Email (opcional)',
    submitBtn: 'Entrar na Lista',
    submitting: 'Registrando...',
    formNote: 'Os primeiros <strong>500</strong> ganham acesso vitalicio gratuito. Sem cartao.',
    errorWhatsappOrEmail: 'Insira seu numero do WhatsApp ou email',
    errorNoCountryCode: 'Inclua o codigo do pais (ex. +1, +57, +55, +33)',
    errorInvalidPhone: 'O numero deve ter 10-15 digitos com codigo do pais (ex. +55 11 91234 5678)',
    errorDuplicate: 'Voce ja esta na lista de espera!',
    errorGeneric: 'Algo deu errado. Tente novamente.',
    errorConnection: 'Erro de conexao. Tente novamente.',
    successPos: 'Sua posicao na lista de espera',
    successMsg: 'Voce esta dentro. Entraremos em contato quando for sua vez.',
    shareX: 'Compartilhar no X',
    shareWA: 'WhatsApp',
    copyLink: 'Copiar link',
    copied: 'Copiado',
    counterWaitlist: 'Na Lista de Espera',
    counterSpots: 'Vagas Gratis',
    counterModes: 'Modos de Traducao',
    scrollFade: 'Voce deu match com alguem <accent>incrivel</accent>. Ela enviou uma mensagem de voz. Dois minutos de espanhol que voce nao entende. Voce abre o Google Translate. Digita. Ela espera. O momento <accent>morre</accent>. O VoxLink faz esse momento <accent>viver</accent>.',
    featLabel: 'Tres Modos',
    featTitle: 'Cada conversa coberta.',
    feat1Title: 'VoxNote',
    feat1Desc: 'Traduza mensagens de voz do WhatsApp instantaneamente. Ela envia audio em espanhol. Voce le em ingles. Responda traduzido. Sem mais copiar e colar.',
    feat2Title: 'Chamada de Video',
    feat2Desc: 'Chamadas de video traduzidas ao vivo com legendas em tempo real. Ela fala seu idioma. Voce ve o seu. Como ter um tradutor em cada chamada.',
    feat3Title: 'Presencial',
    feat3Desc: 'Em um encontro. No jantar. Coloque um celular entre voces. Ambos falam naturalmente. Ambos veem a traducao ao vivo. A barreira desaparece.',
    proofQuote: '"Eu ficava recebendo mensagens de voz do meu encontro e <em>nao fazia ideia</em> do que ela estava dizendo. O VoxLink mudou tudo."',
    proofWho: '— Expatriado americano, Medellin',
    ctaLabel: 'A Lista de Espera Esta Aberta',
    ctaTitle: 'Pare de perder conexoes pelo idioma.',
    ctaBtn: 'Obter Acesso',
  },
}

const langLabels: Record<Lang, string> = { en: 'EN', es: 'ES', fr: 'FR', pt: 'PT' }
const MAX_FREE = 500

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = reject
    document.head.appendChild(s)
  })
}

export default function VoxLinkWaitlist() {
  const [lang, setLang] = useState<Lang>('en')
  const [fading, setFading] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [totalSignups, setTotalSignups] = useState(0)
  const [spotsLeft, setSpotsLeft] = useState(MAX_FREE)
  const [submitted, setSubmitted] = useState(false)
  const [position, setPosition] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [booted, setBooted] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const scrollFadeRef = useRef<HTMLDivElement>(null)
  const sfInitRef = useRef(false)

  const s = t[lang]

  useEffect(() => {
    const bl = navigator.language.slice(0, 2).toLowerCase()
    if (bl in t) setLang(bl as Lang)
    fetchCount()
    boot()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-init scroll-fade when language changes (it uses innerHTML, not React)
  useEffect(() => {
    if (!booted) return
    const timer = setTimeout(() => initScrollFade(), 150)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, booted])

  const switchLang = useCallback((newLang: Lang) => {
    if (newLang === lang || fading) return
    setFading(true)
    setTimeout(() => {
      setLang(newLang)
      setError('')
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setFading(false))
      })
    }, 250)
  }, [lang, fading])

  async function fetchCount() {
    try {
      const { count } = await supabase
        .from('voxlink_waitlist')
        .select('*', { count: 'exact', head: true })
      const c = count ?? 0
      setTotalSignups(c)
      setSpotsLeft(Math.max(0, MAX_FREE - c))
    } catch { /* silent */ }
  }

  async function boot() {
    const w = window as any
    try {
      // Stage 1: Load GSAP first (others depend on it for ticker)
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js')
      // Stage 2: Parallel — ScrollTrigger, Lenis, Three, SplitType
      await Promise.all([
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js'),
        loadScript('https://unpkg.com/lenis@1.1.18/dist/lenis.min.js'),
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'),
        loadScript('https://unpkg.com/split-type@0.3.4/umd/index.min.js'),
      ])
      w.gsap?.registerPlugin?.(w.ScrollTrigger)

      // Fast preloader
      runPreloader(() => {
        initLenis()
        initCursor()
        initProgressBar()
        initHeroSphere()
        initScrollFade()
        initIntersectionReveals()
        initMagnetic()
        setBooted(true)
      })
    } catch (e) {
      console.warn('Boot:', e)
      const pre = document.getElementById('vx-pre')
      if (pre) pre.style.display = 'none'
      setBooted(true)
    }
  }

  function runPreloader(onDone: () => void) {
    const w = window as any
    const g = w.gsap
    const pre = document.getElementById('vx-pre')
    const ct = document.getElementById('vx-prect')
    const bar = document.getElementById('vx-prbar')
    if (!pre || !ct || !bar || !g) { if (pre) pre.style.display = 'none'; onDone(); return }

    let v = 0
    const iv = setInterval(() => {
      v += Math.floor(Math.random() * 12) + 4
      if (v >= 100) { v = 100; clearInterval(iv); exit() }
      ct.textContent = String(v)
      bar.style.width = v + '%'
    }, 30)

    function exit() {
      setTimeout(() => {
        g.to(pre, {
          clipPath: 'inset(50% 0 50% 0)', duration: 0.6, ease: 'power3.inOut',
          onComplete: () => { pre!.style.display = 'none'; onDone() }
        })
      }, 200)
    }
  }

  function initLenis() {
    const w = window as any
    if (!w.Lenis || !w.gsap || !w.ScrollTrigger) return
    const wrapper = document.querySelector('.V') as HTMLElement
    if (!wrapper) return
    // Tell ScrollTrigger to use the .V wrapper as scroller
    w.ScrollTrigger.defaults({ scroller: wrapper })
    const lenis = new w.Lenis({ wrapper, content: wrapper.firstElementChild ? undefined : undefined, lerp: 0.07, smoothWheel: true })
    w.gsap.ticker.add((time: number) => lenis.raf(time * 1000))
    w.gsap.ticker.lagSmoothing(0)
    lenis.on('scroll', w.ScrollTrigger.update)
    // Store reference for scroll-to
    w.__vxLenis = lenis
  }

  function initCursor() {
    if (window.innerWidth <= 768) return
    const dot = document.getElementById('vx-cdot')
    const ring = document.getElementById('vx-cring')
    if (!dot || !ring) return
    const w = window as any
    let mx = 0, my = 0, dx = 0, dy = 0
    document.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY })
    w.gsap.ticker.add(() => {
      dx += (mx - dx) * 0.15; dy += (my - dy) * 0.15
      dot.style.left = mx + 'px'; dot.style.top = my + 'px'
      ring.style.left = dx + 'px'; ring.style.top = dy + 'px'
    })
    const addHover = () => {
      document.querySelectorAll('a,button,input,[data-magnetic]').forEach((el) => {
        el.addEventListener('mouseenter', () => ring.classList.add('exp'))
        el.addEventListener('mouseleave', () => ring.classList.remove('exp'))
      })
    }
    addHover()
    // Re-attach on DOM changes
    const obs = new MutationObserver(addHover)
    obs.observe(document.body, { childList: true, subtree: true })
  }

  function initProgressBar() {
    const w = window as any
    const bar = document.getElementById('vx-pbar')
    const wrapper = document.querySelector('.V') as HTMLElement
    if (!bar || !w.ScrollTrigger || !wrapper) return
    // Use the .cw content div as trigger since it has the full height
    const content = wrapper.querySelector('.cw') as HTMLElement
    if (!content) return
    w.ScrollTrigger.create({
      trigger: content, start: 'top top', end: 'bottom bottom',
      onUpdate: (self: any) => { bar.style.width = (self.progress * 100) + '%' }
    })
  }

  function initHeroSphere() {
    const w = window as any
    const THREE = w.THREE
    if (!THREE || !canvasRef.current) return
    const canvas = canvasRef.current
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.z = 4
    const mob = window.innerWidth <= 768
    const geo = new THREE.IcosahedronGeometry(1.5, mob ? 12 : 24)
    const mat = new THREE.MeshBasicMaterial({ color: 0xc9a96e, wireframe: true, transparent: true, opacity: 0.08 })
    const mesh = new THREE.Mesh(geo, mat)
    scene.add(mesh)
    const ig = new THREE.IcosahedronGeometry(0.8, 8)
    const im = new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true, transparent: true, opacity: 0.04 })
    const imesh = new THREE.Mesh(ig, im)
    scene.add(imesh)
    const orig = geo.attributes.position.array.slice()
    let mX = 0, mY = 0
    document.addEventListener('mousemove', (e) => {
      mX = (e.clientX / window.innerWidth - 0.5) * 2
      mY = (e.clientY / window.innerHeight - 0.5) * 2
    })
    function n3d(x: number, y: number, z: number) { return Math.sin(x*1.5+z)*Math.cos(y*1.5+x)*Math.sin(z*1.5+y) }
    function anim(ti: number) {
      requestAnimationFrame(anim)
      const tt = ti * 0.001
      const wrapper = document.querySelector('.V') as HTMLElement
      const sy = (wrapper?.scrollTop ?? window.scrollY) / window.innerHeight
      const p = geo.attributes.position.array
      for (let i = 0; i < p.length; i += 3) {
        const sc = 1 + n3d(orig[i]+tt*0.3, orig[i+1]+tt*0.3, orig[i+2]+tt*0.3) * 0.12
        p[i] = orig[i]*sc; p[i+1] = orig[i+1]*sc; p[i+2] = orig[i+2]*sc
      }
      geo.attributes.position.needsUpdate = true
      mesh.rotation.y = tt*0.08 + mX*0.3; mesh.rotation.x = tt*0.05 + mY*0.2; mesh.position.y = -sy*0.5
      imesh.rotation.y = -tt*0.12; imesh.rotation.x = -tt*0.08; imesh.position.y = -sy*0.5
      renderer.render(scene, camera)
    }
    anim(0)
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    })
  }

  function initScrollFade() {
    const w = window as any
    const el = scrollFadeRef.current
    if (!el || !w.SplitType || !w.ScrollTrigger) return
    // Kill old
    w.ScrollTrigger.getAll().forEach((st: any) => { if (st.vars?.id === 'sf') st.kill() })
    el.innerHTML = getScrollFadeHTML()
    const split = new w.SplitType(el, { types: 'words' })
    if (!split.words) return
    split.words.forEach((wd: HTMLElement) => { wd.style.opacity = '0.08'; wd.style.transition = 'opacity 0.3s' })
    w.ScrollTrigger.create({
      id: 'sf', trigger: el, start: 'top 72%', end: 'bottom 28%',
      onUpdate: (self: any) => {
        const idx = Math.floor(self.progress * split.words.length)
        split.words.forEach((wd: HTMLElement, i: number) => {
          wd.style.opacity = i <= idx ? '1' : '0.08'
        })
      }
    })
    sfInitRef.current = true
  }

  function initIntersectionReveals() {
    // Use IntersectionObserver instead of GSAP ScrollTrigger for reveal items
    // This avoids conflicts with language switching
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).classList.add('vis')
          obs.unobserve(entry.target)
        }
      })
    }, { threshold: 0.1 })
    document.querySelectorAll('.rv').forEach((el) => obs.observe(el))
  }

  function initMagnetic() {
    if (window.innerWidth <= 768) return
    const w = window as any
    if (!w.gsap) return
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const me = e as MouseEvent
        const r = (el as HTMLElement).getBoundingClientRect()
        w.gsap.to(el, { x: (me.clientX-(r.left+r.width/2))*0.3, y: (me.clientY-(r.top+r.height/2))*0.3, duration: 0.35, ease: 'power3.out' })
      })
      el.addEventListener('mouseleave', () => {
        w.gsap.to(el, { x: 0, y: 0, duration: 0.55, ease: 'elastic.out(1,0.4)' })
      })
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    let cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '')
    if (!cleanPhone && !email) { setError(s.errorWhatsappOrEmail); return }
    if (cleanPhone) {
      if (!cleanPhone.startsWith('+')) { setError(s.errorNoCountryCode); return }
      const digits = cleanPhone.slice(1).replace(/\D/g, '')
      if (digits.length < 10 || digits.length > 15) { setError(s.errorInvalidPhone); return }
      cleanPhone = '+' + digits
    }
    setLoading(true)
    try {
      let existing = null
      if (cleanPhone) { const { data } = await supabase.from('voxlink_waitlist').select('position').eq('phone', cleanPhone).maybeSingle(); existing = data }
      if (!existing && email) { const { data } = await supabase.from('voxlink_waitlist').select('position').eq('email', email.toLowerCase().trim()).maybeSingle(); existing = data }
      if (existing) { setPosition(existing.position); setSubmitted(true); setLoading(false); return }
      const { count } = await supabase.from('voxlink_waitlist').select('*', { count: 'exact', head: true })
      const np = (count ?? 0) + 1
      const { error: ie } = await supabase.from('voxlink_waitlist').insert({ name: name.trim() || null, phone: cleanPhone || null, email: email.toLowerCase().trim() || null, position: np, referrer: document.referrer || 'direct' })
      if (ie) { setError(ie.message.includes('duplicate') || ie.message.includes('unique') ? s.errorDuplicate : s.errorGeneric); setLoading(false); return }
      setPosition(np); setSubmitted(true); fetchCount()
    } catch { setError(s.errorConnection) }
    setLoading(false)
  }

  function shareX() {
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent("Just locked in my spot on the VoxLink waitlist.\n\nShe speaks Spanish. You hear English. Real-time voice translation.\n\nhttps://voxlink.app"), '_blank')
  }
  function shareWA() {
    window.open('https://wa.me/?text=' + encodeURIComponent("VoxLink — real-time voice translation. She speaks Spanish, you hear English. Free waitlist: https://voxlink.app"), '_blank')
  }
  function doCopy() { navigator.clipboard.writeText('https://voxlink.app'); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  function getScrollFadeHTML() {
    return s.scrollFade.replace(/<accent>(.*?)<\/accent>/g, '<span class="aw">$1</span>')
  }

  return (
    <>
      <style>{`
@import url('https://api.fontshare.com/v2/css?f[]=clash-display@200,300,400,500,600,700&f[]=satoshi@300,400,500,700,900&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');

.V{--bg:#06060a;--fg:#f0f0f3;--dim:rgba(240,240,243,0.3);--acc:#c9a96e;--acc2:#00e5ff;--gb:rgba(255,255,255,0.06);position:fixed;inset:0;background:var(--bg);color:var(--fg);font-family:'Satoshi',sans-serif;overflow-x:hidden;overflow-y:auto;z-index:9999;-webkit-font-smoothing:antialiased;cursor:none;-webkit-overflow-scrolling:touch}
.V,.V *{margin:0;padding:0;box-sizing:border-box}
.V ::selection{background:var(--acc);color:var(--bg)}

/* PRELOADER */
.V .pr{position:fixed;inset:0;z-index:99999;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;clip-path:inset(0 0 0 0)}
.V .pr-b{font-family:'Clash Display',sans-serif;font-size:14px;font-weight:500;letter-spacing:0.3em;text-transform:uppercase;color:var(--acc);margin-bottom:24px}
.V .pr-c{font-family:'Clash Display',sans-serif;font-size:clamp(48px,12vw,96px);font-weight:600;color:var(--fg);letter-spacing:-0.04em}
.V .pr-br{width:120px;height:1px;background:rgba(255,255,255,0.1);margin-top:32px;position:relative;overflow:hidden}
.V .pr-bf{position:absolute;left:0;top:0;width:0%;height:100%;background:linear-gradient(90deg,var(--acc),var(--acc2))}

/* CURSOR */
.V .cd{position:fixed;width:6px;height:6px;background:var(--acc);border-radius:50%;pointer-events:none;z-index:99998;mix-blend-mode:difference;transform:translate(-50%,-50%)}
.V .cr{position:fixed;width:36px;height:36px;border:1px solid var(--acc);border-radius:50%;pointer-events:none;z-index:99997;mix-blend-mode:difference;transform:translate(-50%,-50%);transition:width 0.3s,height 0.3s,border-color 0.3s}
.V .cr.exp{width:56px;height:56px;border-color:var(--acc2)}

/* OVERLAYS */
.V .grn{position:fixed;inset:0;pointer-events:none;z-index:99990;opacity:0.03}
.V .vig{position:fixed;inset:0;box-shadow:inset 0 0 200px rgba(0,0,0,0.6);pointer-events:none;z-index:99989}
.V .pb{position:fixed;top:0;left:0;height:2px;width:0%;background:linear-gradient(90deg,var(--acc),var(--acc2));z-index:99991;pointer-events:none}

/* NAV */
.V nav{position:fixed;top:0;left:0;right:0;padding:24px 40px;display:flex;justify-content:space-between;align-items:center;z-index:100;mix-blend-mode:difference}
.V .nl{font-family:'Clash Display',sans-serif;font-size:18px;font-weight:600;letter-spacing:-0.02em;color:var(--fg)}
.V .nl em{color:var(--acc);font-style:normal}
.V .nr{display:flex;align-items:center;gap:16px}
.V .ls{display:flex;gap:2px}
.V .lb{font-family:'Satoshi',sans-serif;font-size:10px;font-weight:500;letter-spacing:0.1em;padding:6px 12px;background:transparent;border:1px solid transparent;color:rgba(240,240,243,0.25);cursor:none;transition:all 0.25s}
.V .lb:hover{color:rgba(240,240,243,0.5)}
.V .lb.on{color:var(--acc);border-color:rgba(201,169,110,0.3)}
.V .nb{font-size:10px;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;color:var(--acc);padding:6px 16px;border:1px solid rgba(201,169,110,0.3)}

/* LANG TRANSITION — smooth blur crossfade */
.V .cw{transition:opacity 0.25s ease,filter 0.25s ease,transform 0.25s ease}
.V .cw.out{opacity:0;filter:blur(6px);transform:translateY(6px)}

/* HERO */
.V .hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;padding:0 24px;text-align:center;overflow:hidden}
.V .hcv{position:absolute;inset:0;z-index:0;opacity:0.35}
.V .hc{position:relative;z-index:1;max-width:800px;width:100%}
.V .he{font-size:9px;font-weight:500;letter-spacing:0.5em;text-transform:uppercase;color:var(--acc);margin-bottom:32px;opacity:0;animation:vu .8s .1s forwards}
.V .hero h1{font-family:'Clash Display',sans-serif;font-size:clamp(38px,7.5vw,84px);font-weight:600;line-height:1.05;letter-spacing:-0.04em;margin-bottom:28px;opacity:0;animation:vu .8s .2s forwards}
.V .hero h1 .aw{font-family:'Instrument Serif',serif;font-style:italic;color:var(--acc)}
.V .hs{font-size:clamp(14px,2.5vw,17px);color:var(--dim);line-height:1.7;max-width:540px;margin:0 auto 48px;opacity:0;animation:vu .8s .35s forwards}

/* FORM */
.V .fb{max-width:480px;width:100%;margin:0 auto;opacity:0;animation:vu .8s .5s forwards}
.V .ff{display:flex;flex-direction:column;border:1px solid rgba(201,169,110,0.25);margin-bottom:4px}
.V .ff input{padding:15px 20px;background:transparent;border:none;border-bottom:1px solid rgba(201,169,110,0.1);color:var(--fg);font-family:'Satoshi',sans-serif;font-size:14px;outline:none;transition:background 0.3s}
.V .ff input:last-of-type{border-bottom:none}
.V .ff input::placeholder{color:rgba(240,240,243,0.2)}
.V .ff input:focus{background:rgba(201,169,110,0.03)}
.V .wh{font-size:10px;color:rgba(240,240,243,0.15);padding:6px 20px 10px;display:flex;align-items:center;gap:6px;border-bottom:1px solid rgba(201,169,110,0.1)}
.V .wh svg{flex-shrink:0;opacity:0.5}
.V .sb{width:100%;padding:16px 32px;background:transparent;border:1px solid rgba(201,169,110,0.25);border-top:none;color:var(--acc);font-family:'Satoshi',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:none;position:relative;overflow:hidden;transition:color 0.4s}
.V .sb::before{content:'';position:absolute;inset:0;background:var(--acc);transform:translateY(100%);transition:transform 0.4s cubic-bezier(0.16,1,0.3,1)}
.V .sb:hover::before{transform:translateY(0)}
.V .sb:hover{color:var(--bg)}
.V .sb span{position:relative;z-index:1}
.V .sb:disabled{opacity:0.5}
.V .sb:disabled::before{display:none}
.V .fn{margin-top:16px;font-size:11px;color:rgba(240,240,243,0.15);letter-spacing:0.05em;text-align:center}
.V .fn strong{color:var(--acc)}
.V .fe{text-align:center;margin-top:10px;font-size:12px;color:#E53E3E}

/* SUCCESS */
.V .sx{text-align:center;max-width:480px;width:100%;margin:0 auto;animation:vu .6s forwards}
.V .sp{font-family:'Clash Display',sans-serif;font-size:clamp(48px,10vw,72px);font-weight:600;color:var(--acc);letter-spacing:-0.04em}
.V .sl{font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:var(--dim);margin-top:8px}
.V .sm{font-size:15px;color:var(--dim);margin-top:24px;line-height:1.6}
.V .sr{display:flex;gap:12px;justify-content:center;margin-top:32px}
.V .srb{padding:10px 20px;border:1px solid rgba(201,169,110,0.2);background:transparent;color:var(--dim);font-family:'Satoshi',sans-serif;font-size:12px;font-weight:500;cursor:none;transition:border-color 0.3s,color 0.3s;letter-spacing:0.05em}
.V .srb:hover{border-color:var(--acc);color:var(--acc)}

/* COUNTER */
.V .cs{display:flex;justify-content:center;gap:48px;padding:48px 24px;border-top:1px solid var(--gb);border-bottom:1px solid var(--gb)}
.V .ci{text-align:center}
.V .cn{font-family:'Clash Display',sans-serif;font-size:clamp(28px,5vw,40px);font-weight:600;color:var(--fg)}
.V .cl{font-size:9px;letter-spacing:0.25em;text-transform:uppercase;color:var(--dim);margin-top:8px}

/* SCROLL FADE */
.V .sft{font-family:'Clash Display',sans-serif;font-size:clamp(24px,4vw,42px);font-weight:500;line-height:1.5;letter-spacing:-0.02em;max-width:800px;padding:160px 24px;margin:0 auto}
.V .sft .aw{color:var(--acc)}

/* SECTION */
.V .sec{padding:120px 24px;max-width:900px;margin:0 auto}
.V .sey{font-size:9px;font-weight:500;letter-spacing:0.5em;text-transform:uppercase;color:var(--acc);margin-bottom:24px}
.V .stt{font-family:'Clash Display',sans-serif;font-size:clamp(32px,5vw,56px);font-weight:600;letter-spacing:-0.03em;line-height:1.1;margin-bottom:24px}

/* FEATURES */
.V .fg{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--gb);margin-top:64px}
.V .fc{background:var(--bg);padding:48px 32px;position:relative;overflow:hidden}
.V .fc::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(201,169,110,0.04) 0%,transparent 70%);opacity:0;transition:opacity 0.6s}
.V .fc:hover::before{opacity:1}
.V .fcn{font-family:'Clash Display',sans-serif;font-size:11px;font-weight:500;color:var(--acc);letter-spacing:0.15em;margin-bottom:24px}
.V .fct{font-family:'Clash Display',sans-serif;font-size:22px;font-weight:600;margin-bottom:12px;letter-spacing:-0.02em}
.V .fcd{font-size:13px;color:var(--dim);line-height:1.7}

/* PROOF */
.V .pf{text-align:center;padding:120px 24px;max-width:600px;margin:0 auto}
.V .pq{font-family:'Instrument Serif',serif;font-style:italic;font-size:clamp(20px,4vw,28px);line-height:1.5;color:rgba(240,240,243,0.7)}
.V .pq em{color:var(--acc);font-style:normal}
.V .pw{font-size:12px;color:var(--dim);margin-top:24px;letter-spacing:0.1em}

/* FINAL CTA */
.V .cta{text-align:center;padding:160px 24px}
.V .cta .stt{margin-bottom:48px}

/* FOOTER */
.V .ft{padding:48px 24px;text-align:center;border-top:1px solid var(--gb)}
.V .ftb{font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:rgba(240,240,243,0.08)}

/* REVEAL ANIMATION — CSS only, no SplitType */
.V .rv{opacity:0;transform:translateY(40px);transition:opacity 0.8s cubic-bezier(0.16,1,0.3,1),transform 0.8s cubic-bezier(0.16,1,0.3,1)}
.V .rv.vis{opacity:1;transform:translateY(0)}
.V .rv.d1{transition-delay:0.1s}
.V .rv.d2{transition-delay:0.2s}
.V .rv.d3{transition-delay:0.3s}

@keyframes vu{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}

/* RESPONSIVE */
@media(max-width:768px){
  .V{cursor:auto}
  .V .cd,.V .cr{display:none}
  .V nav{padding:16px 20px}
  .V .nr{gap:8px}
  .V .lb{padding:5px 8px;font-size:9px}
  .V .nb{padding:4px 10px;font-size:9px;letter-spacing:0.1em}
  .V .fg{grid-template-columns:1fr}
  .V .cs{gap:24px;flex-wrap:wrap}
  .V .sr{flex-wrap:wrap}
  .V .hcv{opacity:0.15}
}
@media(prefers-reduced-motion:reduce){
  .V *,.V *::before,.V *::after{animation:none!important;transition:none!important}
  .V .pr{display:none}
  .V .rv{opacity:1;transform:none}
}
[data-magnetic]{display:inline-block}
      `}</style>

      <div className="V">
        {/* PRELOADER */}
        <div className="pr" id="vx-pre">
          <div className="pr-b">VoxLink</div>
          <div className="pr-c" id="vx-prect">0</div>
          <div className="pr-br"><div className="pr-bf" id="vx-prbar" /></div>
        </div>

        {/* CURSOR */}
        <div className="cd" id="vx-cdot" />
        <div className="cr" id="vx-cring" />

        {/* OVERLAYS */}
        <svg className="grn" width="100%" height="100%">
          <filter id="vg"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={4} stitchTiles="stitch"/></filter>
          <rect width="100%" height="100%" filter="url(#vg)"/>
        </svg>
        <div className="vig" />
        <div className="pb" id="vx-pbar" />

        {/* NAV */}
        <nav>
          <div className="nl" data-magnetic>Vox<em>Link</em></div>
          <div className="nr">
            <div className="ls">
              {(Object.keys(langLabels) as Lang[]).map((l) => (
                <button key={l} className={`lb${lang === l ? ' on' : ''}`} onClick={() => switchLang(l)}>{langLabels[l]}</button>
              ))}
            </div>
            <div className="nb">{s.badge}</div>
          </div>
        </nav>

        {/* CONTENT — blur crossfade on language switch */}
        <div className={`cw${fading ? ' out' : ''}`}>

          {/* HERO */}
          <section className="hero">
            <canvas ref={canvasRef} className="hcv" />
            <div className="hc">
              <div className="he">{s.eyebrow}</div>
              <h1>{s.h1_1}<br/>{s.h1_2}<span className="aw">{s.h1_accent}</span></h1>
              <p className="hs">{s.sub}</p>

              {!submitted ? (
                <div className="fb">
                  <form onSubmit={handleSubmit}>
                    <div className="ff">
                      <input type="text" placeholder={s.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                      <input ref={phoneRef} type="tel" placeholder={s.phonePlaceholder} value={phone} onChange={(e) => { let v = e.target.value.replace(/[^\d\s\-\+]/g, ''); if (v.indexOf('+')>0) v=v.replace(/\+/g,''); setPhone(v) }} autoComplete="tel" />
                      <div className="wh">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#25D366"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.963 7.963 0 01-4.104-1.136l-.296-.176-2.868.852.852-2.868-.176-.296A7.963 7.963 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z" fill="#25D366"/></svg>
                        {s.whatsappHint}
                      </div>
                      <input type="email" placeholder={s.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                    </div>
                    <button type="submit" className="sb" disabled={loading} data-magnetic><span>{loading ? s.submitting : s.submitBtn}</span></button>
                  </form>
                  <div className="fn" dangerouslySetInnerHTML={{ __html: s.formNote }} />
                  {error && <div className="fe">{error}</div>}
                </div>
              ) : (
                <div className="sx">
                  <div className="sp">#{position}</div>
                  <div className="sl">{s.successPos}</div>
                  <div className="sm">{s.successMsg}</div>
                  <div className="sr">
                    <button className="srb" data-magnetic onClick={shareX}>{s.shareX}</button>
                    <button className="srb" data-magnetic onClick={shareWA}>{s.shareWA}</button>
                    <button className="srb" data-magnetic onClick={doCopy}>{copied ? s.copied : s.copyLink}</button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* COUNTER */}
          <div className="cs rv">
            <div className="ci">
              <div className="cn">{totalSignups}</div>
              <div className="cl">{s.counterWaitlist}</div>
            </div>
            <div className="ci">
              <div className="cn">{spotsLeft}</div>
              <div className="cl">{s.counterSpots}</div>
            </div>
            <div className="ci">
              <div className="cn">3</div>
              <div className="cl">{s.counterModes}</div>
            </div>
          </div>

          {/* SCROLL FADE */}
          <div ref={scrollFadeRef} className="sft" dangerouslySetInnerHTML={{ __html: getScrollFadeHTML() }} />

          {/* FEATURES */}
          <section className="sec">
            <div className="sey rv">{s.featLabel}</div>
            <div className="stt rv">{s.featTitle}</div>
            <div className="fg">
              <div className="fc rv d1">
                <div className="fcn">01</div>
                <div className="fct">{s.feat1Title}</div>
                <div className="fcd">{s.feat1Desc}</div>
              </div>
              <div className="fc rv d2">
                <div className="fcn">02</div>
                <div className="fct">{s.feat2Title}</div>
                <div className="fcd">{s.feat2Desc}</div>
              </div>
              <div className="fc rv d3">
                <div className="fcn">03</div>
                <div className="fct">{s.feat3Title}</div>
                <div className="fcd">{s.feat3Desc}</div>
              </div>
            </div>
          </section>

          {/* PROOF */}
          <div className="pf rv">
            <div className="pq" dangerouslySetInnerHTML={{ __html: s.proofQuote }} />
            <div className="pw">{s.proofWho}</div>
          </div>

          {/* FINAL CTA */}
          <section className="cta">
            <div className="sey rv">{s.ctaLabel}</div>
            <div className="stt rv">{s.ctaTitle}</div>
            {!submitted && (
              <div className="fb rv" style={{ animation: 'none', opacity: 1 }}>
                <button className="sb" data-magnetic onClick={() => { const w = window as any; if (w.__vxLenis) { w.__vxLenis.scrollTo(0) } else { document.querySelector('.V')?.scrollTo({ top: 0, behavior: 'smooth' }) } setTimeout(() => phoneRef.current?.focus(), 600) }} style={{ border: '1px solid rgba(201,169,110,0.25)' }}>
                  <span>{s.ctaBtn}</span>
                </button>
              </div>
            )}
          </section>

          {/* FOOTER */}
          <footer className="ft">
            <div className="ftb">MACHINEMIND</div>
          </footer>
        </div>
      </div>
    </>
  )
}
