#!/usr/bin/env python3
"""Fernanda — Manual de Conversión Elite (MachineMind). Generates branded PDF to ~/Downloads."""
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether,
)
from reportlab.lib.styles import ParagraphStyle

# ---------- Brand ----------
VOID = HexColor("#000000")
SURFACE = HexColor("#0d0d0d")
ELEVATED = HexColor("#141414")
GOLD = HexColor("#C9A84C")
GOLD_BRIGHT = HexColor("#F5D47A")
WHITE = HexColor("#FFFFFF")
SOFT = HexColor("#D8D8D8")
MUTED = HexColor("#8A8A8A")
BORDER = HexColor("#2a2a2a")

pdfmetrics.registerFont(TTFont("Georgia", "/System/Library/Fonts/Supplemental/Georgia.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-Bold", "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-Italic", "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"))

OUT = os.path.expanduser("~/Downloads/Fernanda-Manual-de-Conversion-MachineMind.pdf")
W, H = letter
M = 0.85 * inch

# ---------- Styles ----------
def st(name, **kw):
    base = dict(fontName="Helvetica", fontSize=10.5, leading=15.5, textColor=SOFT)
    base.update(kw)
    return ParagraphStyle(name, **base)

s_kicker   = st("kicker", fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=GOLD, spaceAfter=6)
s_h1       = st("h1", fontName="Georgia-Bold", fontSize=23, leading=27, textColor=WHITE, spaceAfter=10)
s_h2       = st("h2", fontName="Georgia-Bold", fontSize=14, leading=18, textColor=GOLD_BRIGHT, spaceBefore=14, spaceAfter=6)
s_body     = st("body", spaceAfter=7)
s_body_w   = st("bodyw", textColor=WHITE, spaceAfter=7)
s_lead     = st("lead", fontName="Georgia-Italic", fontSize=12.5, leading=18, textColor=WHITE, spaceAfter=10)
s_bullet   = st("bullet", leftIndent=16, bulletIndent=2, spaceAfter=5,
                bulletFontName="Helvetica-Bold", bulletFontSize=9, bulletColor=GOLD)
s_num      = st("num", leftIndent=26, bulletIndent=2, spaceAfter=6,
                bulletFontName="Helvetica-Bold", bulletFontSize=9.5, bulletColor=GOLD)
s_script   = st("script", fontName="Helvetica", fontSize=10, leading=15, textColor=WHITE)
s_script_l = st("scriptl", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=GOLD)
s_small    = st("small", fontSize=8.5, leading=12, textColor=MUTED)
s_center   = st("center", alignment=TA_CENTER)

def gold(t): return f'<font color="#F5D47A"><b>{t}</b></font>'
def wht(t): return f'<font color="#FFFFFF"><b>{t}</b></font>'

def script_box(label, text):
    """Elevated card with gold left border, for scripts/quotes."""
    inner = [Paragraph(label, s_script_l), Spacer(1, 3), Paragraph(text, s_script)]
    t = Table([[inner]], colWidths=[W - 2 * M - 8])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ELEVATED),
        ("LINEBEFORE", (0, 0), (0, -1), 2.2, GOLD),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    return t

def rule(width=0.55 * inch, thick=2.2, color=GOLD, space_after=12):
    t = Table([[""]], colWidths=[width], rowHeights=[thick])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), color)]))
    t.hAlign = "LEFT"
    return [t, Spacer(1, space_after)]

def section_head(num, title):
    els = [Paragraph(f"SECCIÓN {num}", s_kicker), Paragraph(title, s_h1)]
    els += rule()
    return els

# ---------- Page background ----------
def bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(VOID)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    # top hairline + footer
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(M, H - 0.55 * inch, W - M, H - 0.55 * inch)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(M, H - 0.48 * inch, "MACHINEMIND  ·  MANUAL DE CONVERSIÓN")
    canvas.drawRightString(W - M, H - 0.48 * inch, "CONFIDENCIAL — USO INTERNO")
    canvas.setFillColor(GOLD)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawRightString(W - M, 0.42 * inch, f"{doc.page:02d}")
    canvas.restoreState()

def bg_cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(VOID)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    canvas.restoreState()

doc = BaseDocTemplate(OUT, pagesize=letter,
                      leftMargin=M, rightMargin=M, topMargin=0.95 * inch, bottomMargin=0.75 * inch,
                      title="Manual de Conversión — Fernanda", author="MachineMind")
frame = Frame(M, 0.75 * inch, W - 2 * M, H - 1.7 * inch, id="f")
frame_cover = Frame(M, 1 * inch, W - 2 * M, H - 2 * inch, id="fc")
doc.addPageTemplates([
    PageTemplate(id="cover", frames=[frame_cover], onPage=bg_cover),
    PageTemplate(id="page", frames=[frame], onPage=bg),
])

E = []  # story
from reportlab.platypus import NextPageTemplate

# ================= COVER =================
E.append(Spacer(1, 1.5 * inch))
E.append(Paragraph('<font color="#C9A84C">M A C H I N E M I N D</font>',
                   st("brand", fontName="Helvetica-Bold", fontSize=11, leading=14, alignment=TA_CENTER)))
E.append(Spacer(1, 26))
E.append(Paragraph("Manual de Conversión",
                   st("ct", fontName="Georgia-Bold", fontSize=38, leading=44, textColor=WHITE, alignment=TA_CENTER)))
E.append(Spacer(1, 10))
ct = Table([[""]], colWidths=[1.1 * inch], rowHeights=[2.5])
ct.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD)])); ct.hAlign = "CENTER"
E.append(ct)
E.append(Spacer(1, 16))
E.append(Paragraph("Del número recibido al cliente cerrado.",
                   st("cs", fontName="Georgia-Italic", fontSize=15, leading=20, textColor=GOLD_BRIGHT, alignment=TA_CENTER)))
E.append(Spacer(1, 1.4 * inch))
E.append(Paragraph('PARA <font color="#FFFFFF"><b>FERNANDA</b></font> — ESPECIALISTA DE CONVERSIÓN',
                   st("cf", fontName="Helvetica", fontSize=10, leading=14, textColor=MUTED, alignment=TA_CENTER)))
E.append(Spacer(1, 6))
E.append(Paragraph("WEB GRATIS  ·  EL SALVADOR + PANAMÁ",
                   st("cf2", fontName="Helvetica-Bold", fontSize=9, leading=13, textColor=GOLD, alignment=TA_CENTER)))
E.append(Spacer(1, 1.2 * inch))
E.append(Paragraph("Confidencial — uso interno · 2026",
                   st("cf3", fontName="Helvetica", fontSize=8, leading=11, textColor=MUTED, alignment=TA_CENTER)))
E.append(NextPageTemplate("page"))
E.append(PageBreak())

# ================= 1. LA MISIÓN =================
E += section_head(1, "Tu Misión")
E.append(Paragraph("Tu trabajo no es informar. Es convertir.", s_lead))
E.append(Paragraph(
    "Cada persona que deja su número ya dijo que sí a la idea. Tu trabajo es que "
    f"{wht('termine')}: que entregue sus fotos y datos, reciba su página, y luego escuche la oferta premium. "
    "Un lead que se enfría no es un lead perdido por precio — es un lead perdido por tiempo y fricción. "
    "Tú eliminas los dos.", s_body))
E.append(Paragraph("El pipeline — cada lead vive en una de estas 5 etapas", s_h2))
pipe = [
    ("1 · NUEVO", "Dejó su número (anuncio, Instagram o formulario web)."),
    ("2 · CONTACTADO", "Primera llamada + WhatsApp en menos de 5 minutos."),
    ("3 · RECOLECTANDO", "Fotos y datos en camino (checklist de la Sección 4)."),
    ("4 · ENTREGADO", "Su página está en línea y se la mostraste."),
    ("5 · UPGRADE", "Conversación del plan pago — solo después de entregar."),
]
rows = [[Paragraph(f'<font color="#F5D47A"><b>{a}</b></font>', s_script),
         Paragraph(b, s_script)] for a, b in pipe]
tp = Table(rows, colWidths=[1.85 * inch, W - 2 * M - 1.85 * inch])
tp.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
    ("LINEBELOW", (0, 0), (-1, -2), 0.5, BORDER),
    ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
    ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]))
E.append(tp)
E.append(Spacer(1, 8))
E.append(Paragraph(
    f"Regla de gestión: {wht('ningún lead pasa 24 horas en una etapa sin una próxima acción tuya')} "
    "(mensaje, llamada o recordatorio agendado). Registra cada lead y su etapa el mismo día en el tablero.", s_body))

# ================= 2. REGLA DE ORO =================
E.append(PageBreak())
E += section_head(2, "La Regla de Oro: 5 Minutos")
E.append(Paragraph(
    "Llamar en los primeros 5 minutos multiplica hasta "
    f"{gold('100 veces')} la probabilidad de conectar comparado con esperar media hora. "
    "En el minuto que envió su número, el lead está con el teléfono en la mano, pensando en su negocio, "
    "caliente. Cada minuto que pasa, vuelve a su vida y tú te conviertes en un desconocido.", s_body))
E.append(Paragraph("La secuencia exacta", s_h2))
for i, t in enumerate([
    f"{wht('Llama primero.')} Una llamada dice “esto es real y es ahora”. Un mensaje dice “cuando puedas”.",
    f"Si no contesta: {wht('WhatsApp inmediato')} con el guion de la Sección 3.",
    f"Si tampoco responde: {wht('nota de voz')} corta y cálida (la voz genera confianza en LATAM — úsala).",
    f"Después de 2 mensajes sin respuesta: {wht('alto total')}. Nunca un tercer mensaje seguido. Reentra en 2–3 días con valor nuevo, no con insistencia.",
], 1):
    E.append(Paragraph(t, s_num, bulletText=f'{i}.'))
E.append(Spacer(1, 6))
E.append(script_box("MENTALIDAD",
    "La velocidad es tu ventaja injusta. Nadie más en El Salvador ni Panamá llama en 5 minutos. "
    "Cuando tú llamas de una vez, el lead siente que le cayó un equipo profesional encima — antes de ver una sola página."))

# ================= 3. PRIMER CONTACTO =================
E.append(PageBreak())
E += section_head(3, "Primer Contacto: Guiones")
E.append(Paragraph("La llamada (30–60 segundos de estructura)", s_h2))
E.append(script_box("GUION DE LLAMADA",
    "“Hola, ¿hablo con [nombre]? Le saluda Fernanda, de MachineMind — nos acaba de escribir por lo de su "
    "página web gratis para [negocio].<br/><br/>"
    "Le llamo de una vez porque su espacio ya quedó reservado y quiero dejarle todo listo hoy mismo. "
    "Solo necesito unos datos y sus mejores fotos — se los pido por WhatsApp y usted me los manda cuando pueda hoy. "
    "¿Le parece?”"))
E.append(Spacer(1, 4))
E.append(Paragraph(
    f"Estructura: contexto instantáneo (quién eres y por qué llamas) → {wht('velocidad + reserva')} "
    "(su espacio ya está apartado) → una sola petición pequeña → confirmación. "
    "Termina SIEMPRE con el próximo paso concreto y una hora.", s_body))
E.append(Paragraph("Si no contesta: WhatsApp inmediato", s_h2))
E.append(script_box("GUION DE WHATSAPP",
    "“Hola [nombre], soy Fernanda, de MachineMind. Recibimos su solicitud de la página web gratis para "
    "[negocio] — ¡felicidades! Su espacio queda reservado por 48 horas.<br/><br/>"
    "Para dejarla lista solo necesito unas fotos y unos datos. ¿Los vemos por aquí de una vez?”"))
E.append(Spacer(1, 4))
E.append(Paragraph("Las 3 leyes de todo mensaje", s_h2))
for t in [
    f"{wht('Una pregunta por mensaje.')} Dos preguntas = cero respuestas. Jamás interrogatorio.",
    f"{wht('Responde en el idioma del lead.')} Español por defecto; si escribe en inglés, inglés.",
    f"{wht('Propón UNA opción y pide confirmación en el mismo mensaje.')} “¿Lo dejamos listo mañana a las 3?” — nunca “¿qué día le convendría?”",
]:
    E.append(Paragraph(t, s_bullet, bulletText='•'))

# ================= 4. CHECKLIST =================
E.append(PageBreak())
E += section_head(4, "Checklist de Recolección")
E.append(Paragraph(
    "Todo se recolecta por WhatsApp. Pide en 2–3 tandas, nunca la lista completa de golpe. "
    f"Cada envío del cliente es un {wht('micro-compromiso')}: cuando ya mandó sus fotos, ya es tuyo.", s_body))
chk = [
    ("01", "Nombre del negocio y a qué se dedica"),
    ("02", "WhatsApp del negocio (el número que atiende clientes)"),
    ("03", "Instagram (y Facebook si tiene)"),
    ("04", "Sus 10 mejores fotos — máximo 12. Pide “sus 10 mejores”, nunca “todas las que tenga”"),
    ("05", "Logo (si tiene — si no, no es problema y se lo dices)"),
    ("06", "Servicios o productos con precios"),
    ("07", "Horario y ubicación (pin de Google Maps)"),
    ("08", "Una frase: ¿qué hace diferente a su negocio?"),
    ("09", "Colores de su marca (si tiene preferencia)"),
]
rows = [[Paragraph(f'<font color="#C9A84C"><b>{n}</b></font>', s_script), Paragraph(t, s_script)] for n, t in chk]
tc = Table(rows, colWidths=[0.55 * inch, W - 2 * M - 0.55 * inch])
tc.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
    ("LINEBELOW", (0, 0), (-1, -2), 0.5, BORDER),
    ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
    ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]))
E.append(tc)
E.append(Spacer(1, 10))
E.append(Paragraph("El cierre del checklist", s_h2))
E.append(script_box("GUION — CHECKLIST COMPLETO",
    "“¡Perfecto, ya tengo todo!  Su página queda lista el [día]. Apenas esté en línea le mando el enlace por aquí. "
    "Prepárese, que le va a encantar.”"))
E.append(Spacer(1, 4))
E.append(Paragraph(
    f"{wht('Nunca prometas una fecha de entrega sin confirmarla con Phil primero.')} "
    "Una promesa rota mata más ventas que un precio alto.", s_body))

# ================= 5. ARSENAL PSICOLÓGICO =================
E.append(PageBreak())
E += section_head(5, "El Arsenal Psicológico")
E.append(Paragraph("Siete palancas. Úsalas todas, todos los días.", s_lead))
arsenal = [
    ("VELOCIDAD", "La atención es perecedera. El que llega primero con competencia profesional, gana. Tus primeros 5 minutos valen más que cualquier guion."),
    ("RECIPROCIDAD", "Entregamos primero, pedimos después. Una página gratis, hermosa y rápida crea una deuda emocional — cuando llegue la oferta premium, el cliente ya quiere decir que sí."),
    ("MICRO-COMPROMISOS", "Cada pequeño sí (fotos, logo, horario) profundiza su inversión. La gente termina lo que empezó. Por eso pides en tandas: cada tanda es un sí más."),
    ("AVERSIÓN A LA PÉRDIDA", "Perder duele el doble de lo que gusta ganar. “Su espacio queda reservado 48 horas” mueve más que cualquier descuento. Úsalo en el primer contacto y en el seguimiento."),
    ("PRUEBA SOCIAL", "Nombra negocios reales entregados esta semana: “acabamos de entregar la de [negocio real]”. Lo específico convence; lo general suena a venta."),
    ("LENGUAJE DE ASUNCIÓN", "“Cuando su página esté lista…” — nunca “si decide hacerla…”. En tu boca, la página ya existe. El cliente solo la está recogiendo."),
    ("ESPEJO Y ETIQUETA", "Repite sus últimas 3 palabras en tono de pregunta y se abre solo. Etiqueta su emoción: “Parece que le preocupa que esto le quite tiempo…”. Sentirse escuchado desarma más que cualquier argumento."),
]
for i, (t, b) in enumerate(arsenal, 1):
    E.append(KeepTogether([
        Paragraph(f'<font color="#C9A84C"><b>{i:02d}</b></font>&nbsp;&nbsp;<font color="#F5D47A"><b>{t}</b></font>',
                  st(f"a{i}", fontName="Helvetica-Bold", fontSize=11, leading=14, spaceBefore=10, spaceAfter=3)),
        Paragraph(b, s_body),
    ]))
E.append(Spacer(1, 6))
E.append(script_box("LA REGLA MAESTRA — UNA SOLA OPCIÓN",
    "Nunca des menús. Una hora, un próximo paso, una pregunta. El cerebro cansado no elige entre opciones — "
    "confirma la que le pusiste enfrente."))

# ================= 6. OBJECIONES =================
E.append(PageBreak())
E += section_head(6, "Manejo de Objeciones")
objs = [
    ("“¿Gratis de verdad? ¿Cuál es el truco?”",
     "Honestidad total, sin dudar: “La construcción es 100% gratis y su página está en línea gratis los "
     "primeros 30 días. Después son solo $19 al mes si quiere mantenerla — sin contrato, la cancela cuando quiera.” "
     "La honestidad aquí compra confianza para todo lo demás."),
    ("“Ya tengo Instagram / ya tengo página.”",
     "“Perfecto — la página no compite con su Instagram, lo convierte. Instagram atrae; la página cierra: "
     "precios claros, botón directo a su WhatsApp y aparece en Google. Y es gratis — ¿qué pierde?”"),
    ("“No tengo tiempo ahora.”",
     "Encoge la petición: “Solo necesito que me reenvíe 10 fotos por aquí. Yo hago absolutamente todo lo demás. "
     "Son dos minutos.” Nadie dice no a dos minutos."),
    ("“Lo consulto con mi socio / mi esposa.”",
     "Nunca pelees — controla el seguimiento: “Claro que sí. Le dejo el espacio reservado hasta mañana a las [hora] "
     "y a esa hora le escribo. ¿Le parece?” Tú decides cuándo vuelve la conversación."),
    ("“¿Quiénes son? ¿Esto es del gobierno?”",
     "“Somos MachineMind, una empresa privada de tecnología. Trabajamos con negocios en El Salvador y Panamá.” "
     "NUNCA digas “programa del gobierno” ni insinúes patrocinio oficial."),
    ("Silencio después de mostrar interés.",
     "Mensaje 2 con aversión a la pérdida: “Hola [nombre], le guardo su espacio hasta mañana a las [hora] — "
     "después se lo paso al siguiente negocio en lista. ¿Seguimos?” Si no responde: ALTO. "
     "Jamás un tercer mensaje. Reentra en 2–3 días con algo nuevo (“ya vi sus fotos de Instagram, le armé una propuesta…”)."),
]
for i, (q, a) in enumerate(objs, 1):
    E.append(KeepTogether([
        Paragraph(f'<font color="#C9A84C"><b>{i:02d}</b></font>&nbsp;&nbsp;<font color="#FFFFFF"><b>{q}</b></font>',
                  st(f"o{i}", fontName="Helvetica-Bold", fontSize=11, leading=15, spaceBefore=11, spaceAfter=3)),
        Paragraph(a, s_body),
    ]))

# ================= 7. ESCALERA DE INGRESOS =================
E.append(PageBreak())
E += section_head(7, "La Escalera de Ingresos")
E.append(Paragraph(
    f"{wht('El modelo — se dice desde el día uno, con total claridad:')} la construcción es gratis y la página "
    "está en línea gratis los primeros 30 días desde la entrega. Después, $19/mes para mantenerla — sin contrato, "
    "cancela cuando quiera. Decirlo temprano no espanta: elimina para siempre la objeción del “truco”.", s_body))
E.append(Paragraph("El momento de oro: justo después de entregar", s_h2))
E.append(Paragraph(
    "Cuando el cliente está feliz viendo su página (pico de reciprocidad), pides tres cosas, en este orden:", s_body))
oro = [
    ("1 · LA HISTORIA", "“Solo le pido una cosa: compártala en su historia de Instagram o Facebook etiquetando a "
     "@machinemindconsulting.” Es la condición del regalo — y cada historia es publicidad y prueba social gratis."),
    ("2 · EL REFERIDO", "“¿A quién conoce que le urja una página? Por cada negocio que nos refiera y active, "
     "usted gana un mes gratis.” Pide el referido SIEMPRE — es el momento de máxima gratitud."),
    ("3 · EL UPGRADE", "Solo si aplica a su tipo de negocio. Recomienda UN solo escalón de la escalera — nunca el menú completo."),
]
rows = [[Paragraph(f'<font color="#F5D47A"><b>{a}</b></font>', s_script), Paragraph(b, s_script)] for a, b in oro]
to = Table(rows, colWidths=[1.35 * inch, W - 2 * M - 1.35 * inch])
to.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
    ("LINEBELOW", (0, 0), (-1, -2), 0.5, BORDER),
    ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
    ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]))
E.append(to)
E.append(Spacer(1, 10))
E.append(Paragraph("La escalera", s_h2))
plans = [
    [Paragraph('<font color="#F5D47A"><b>EN LÍNEA — $19/mes</b></font>', s_script),
     Paragraph("Su página viva después de los 30 días gratis. Sin contrato. “Menos de $1 al día.”", s_script)],
    [Paragraph('<font color="#F5D47A"><b>BOT DE RESERVAS — +$49/mes</b></font>', s_script),
     Paragraph("Sus clientes reservan solos por WhatsApp, 24/7. Para negocios de citas: clínicas, salones, restaurantes, tours.", s_script)],
    [Paragraph('<font color="#F5D47A"><b>ASISTENTE AI — $99–$199/mes</b></font>', s_script),
     Paragraph("Un asistente que responde, agenda y vende por él las 24 horas. Para el que quiere todo automatizado. "
               "Si muestra interés aquí, avísale a Phil — él cierra este nivel.", s_script)],
]
tpl = Table(plans, colWidths=[2.15 * inch, W - 2 * M - 2.15 * inch])
tpl.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), ELEVATED),
    ("LINEBELOW", (0, 0), (-1, -2), 0.5, BORDER),
    ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
    ("LINEBEFORE", (0, 0), (0, -1), 2.2, GOLD),
    ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ("LEFTPADDING", (0, 0), (-1, -1), 14), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]))
E.append(tpl)
E.append(Spacer(1, 10))
_venta = [Paragraph("Cómo se vende", s_h2)]
for t in [
    f"{wht('Ancla en resultado, no en precio:')} “un solo cliente nuevo al mes ya lo paga” / “$19 al mes es menos de $1 al día”.",
    f"{wht('Un escalón a la vez.')} El negocio de citas escucha del bot de reservas; el resto, solo del $19/mes. Nunca presentes toda la escalera de golpe.",
    f"Si dice que no: {wht('perfecto y sin presión')} — disfruta sus 30 días gratis. Vuelve cerca del día 25 con un dato real (“su página ya tuvo [X] visitas — ¿la dejamos en línea?”).",
]:
    _venta.append(Paragraph(t, s_bullet, bulletText='\u2022'))
E.append(KeepTogether(_venta))

# ================= 8. REGLAS + SCORECARD =================
E.append(PageBreak())
E += section_head(8, "Reglas de Hierro y Scorecard")
E.append(Paragraph("Las 10 reglas — no se negocian", s_h2))
rules_list = [
    "Contactar en menos de 5 minutos. Siempre llamar primero.",
    "Una pregunta por mensaje. Jamás interrogatorio.",
    "Nunca un tercer mensaje seguido a un lead en silencio.",
    "Proponer UNA opción y pedir confirmación en el mismo mensaje.",
    "Nunca prometer fecha de entrega sin confirmarla con Phil.",
    "WhatsApp y llamada. Nunca email.",
    "Responder en el idioma del lead.",
    "Registrar cada lead en el tablero y dejarle SIEMPRE su próximo seguimiento programado — ningún lead sin próxima acción.",
    "Máximo 12 fotos por negocio — pedir “sus 10 mejores”.",
    "La verdad siempre: es gratis de verdad, somos empresa privada.",
]
for i, t in enumerate(rules_list, 1):
    E.append(Paragraph(t, s_num, bulletText=f'{i:02d}'))
E.append(Spacer(1, 8))
E.append(Paragraph("Tu scorecard diario", s_h2))
sc = [
    ("Primer contacto", "Tiempo promedio desde que llega el número", "< 5 min"),
    ("Cobertura", "% de leads contactados el mismo día", "100%"),
    ("Recolección", "% de checklists completos en 24 horas", "70%+"),
    ("Entregas", "Páginas entregadas esta semana", "—"),
    ("Upgrades", "Planes pagos cerrados este mes", "—"),
]
rows = [[Paragraph('<font color="#F5D47A"><b>MÉTRICA</b></font>', s_script_l),
         Paragraph('<font color="#F5D47A"><b>QUÉ MIDE</b></font>', s_script_l),
         Paragraph('<font color="#F5D47A"><b>META</b></font>', s_script_l)]]
rows += [[Paragraph(f"<b>{a}</b>", s_script), Paragraph(b, s_script), Paragraph(c, s_script)] for a, b, c in sc]
ts = Table(rows, colWidths=[1.5 * inch, W - 2 * M - 2.6 * inch, 1.1 * inch])
ts.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), ELEVATED),
    ("BACKGROUND", (0, 1), (-1, -1), SURFACE),
    ("LINEBELOW", (0, 0), (-1, -2), 0.5, BORDER),
    ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
    ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]))
E.append(ts)
E.append(Spacer(1, 22))
E.append(Paragraph(
    '<font color="#F5D47A">La velocidad es tu ventaja. La honestidad es tu marca. El seguimiento es tu salario.</font>',
    st("close", fontName="Georgia-Italic", fontSize=14, leading=20, alignment=TA_CENTER)))

doc.build(E)
print(f"OK -> {OUT}")
