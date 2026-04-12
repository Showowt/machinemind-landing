# Sofia Client Factory

One-shot client onboarding: Demo site + Sofia AI configuration + outreach message.

## Triggers
- "new client"
- "set up Sofia for [business]"
- "onboard [business]"
- "client factory"
- "new prospect"

## Input Requirements

Gather or infer:
1. **Business Name** - Official name
2. **Business Type** - Restaurant, hotel, villa, tour, event, etc.
3. **Location** - City, country
4. **Language** - Primary (usually Spanish for Colombia)
5. **Services** - What they offer
6. **Contact Hours** - When they're available

## Output Package

### 1. Demo Landing Page

Create a Cinema Engine site with:
- Hero section with business name
- Services/menu/rooms section
- WhatsApp CTA button
- Contact information
- Mobile optimized

File: `/demos/[business-slug]/page.tsx`

### 2. Sofia AI Configuration

Generate Supabase-ready configuration:

```typescript
interface SofiaConfig {
  business_id: string
  business_name: string
  business_type: 'restaurant' | 'hotel' | 'villa' | 'tour' | 'event' | 'other'
  location: string
  language: 'es' | 'en' | 'es-co'
  timezone: string
  whatsapp_number: string
  system_prompt: string
  greeting_message: string
  business_hours: {
    [day: string]: { open: string; close: string } | 'closed'
  }
  services: string[]
  faq: Array<{ question: string; answer: string }>
  escalation_keywords: string[]
  max_response_length: number
}
```

File: `/configs/sofia/[business-slug].json`

### 3. System Prompt Template

```
Eres Sofia, la asistente virtual de [BUSINESS_NAME].

IDENTIDAD:
- Nombre: Sofia
- Rol: Asistente de atención al cliente
- Personalidad: Amable, profesional, eficiente
- Idioma: Español colombiano (formal pero cálido)

INFORMACIÓN DEL NEGOCIO:
- Nombre: [BUSINESS_NAME]
- Tipo: [BUSINESS_TYPE]
- Ubicación: [LOCATION]
- Servicios: [SERVICES]
- Horario: [HOURS]

CAPACIDADES:
- Responder preguntas sobre servicios y precios
- Ayudar con reservaciones
- Proporcionar información de ubicación y contacto
- Escalar a un humano cuando sea necesario

REGLAS:
1. Siempre saluda con calidez
2. Respuestas concisas (máximo 3 oraciones)
3. Si no sabes algo, ofrece conectar con un humano
4. Nunca inventes información sobre precios o disponibilidad
5. Usa "usted" para formalidad, pero mantén tono amigable

ESCALACIÓN:
Transfiere a humano si el cliente menciona:
- Quejas o problemas graves
- Solicitudes especiales complejas
- Emergencias
- Insatisfacción repetida
```

### 4. Greeting Message

```
¡Hola! 👋 Bienvenido a [BUSINESS_NAME].

Soy Sofia, tu asistente virtual. Estoy aquí para ayudarte con:
• Información sobre nuestros servicios
• Reservaciones
• Preguntas frecuentes

¿En qué puedo ayudarte hoy?
```

### 5. Outreach Message (WhatsApp)

For sales team to send:

```
Hola [CONTACT_NAME],

Soy [SALES_REP] de MachineMind.

Creamos un demo personalizado para [BUSINESS_NAME] que muestra cómo Sofia AI puede automatizar sus reservaciones por WhatsApp 24/7.

🔗 Ver demo: [DEMO_URL]

Lo que incluye:
✅ Respuestas automáticas en segundos
✅ Reservaciones sin intervención manual
✅ Integración con su sistema actual
✅ Configuración en 48 horas

¿Le gustaría ver cómo funcionaría para [BUSINESS_NAME]?

Saludos,
[SALES_REP]
MachineMind
```

## Execution Protocol

1. **Extract Info** - Parse business details from input
2. **Generate Slug** - Create URL-safe business identifier
3. **Build Demo** - Create Cinema Engine landing page
4. **Configure Sofia** - Generate system prompt and config
5. **Create Outreach** - Write personalized sales message
6. **Output Package** - Deliver all assets

## File Structure

```
/demos
  /[business-slug]
    page.tsx        → Demo landing page

/configs
  /sofia
    [business-slug].json → Sofia configuration

/outreach
  [business-slug].md → Sales message template
```

## Quality Checks

- [ ] Demo page renders correctly
- [ ] System prompt is specific to business
- [ ] Greeting message includes business name
- [ ] Outreach message is personalized
- [ ] All Spanish text is grammatically correct
- [ ] WhatsApp number formatted correctly (+57...)
- [ ] Business hours in correct timezone

## ROI Calculator

Include in pitch:

```
Bookings perdidas/mes: ___
Valor promedio/reserva: $___
Pérdida mensual: $___

Con Sofia AI:
- Respuesta instantánea 24/7
- 0% llamadas perdidas
- Recuperación estimada: ____%

Inversión MachineMind: $490
ROI primer mes: ___x
```
