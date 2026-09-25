/**
 * Human-readable form of a WhatsApp number stored as bare digits
 * (e.g. MM_WHATSAPP "17862570284" → "+1 (786) 257-0284").
 * NANP numbers get the (area) prefix-line layout; anything else is "+digits".
 */
export function formatWhatsAppDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return `+${d}`;
}

/** wa.me deep link with an optional prefilled message. */
export function whatsAppHref(digits: string, text?: string): string {
  const d = digits.replace(/\D/g, "");
  return text ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : `https://wa.me/${d}`;
}
