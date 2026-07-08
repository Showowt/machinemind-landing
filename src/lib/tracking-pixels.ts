/**
 * Meta Pixel Tracking Events
 * Fire conversion events on lead capture, contact, and booking
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Track a lead submission event on Meta pixel
 */
export function trackLeadEvent(data: {
  email?: string;
  interest?: string;
  source?: string;
}) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Lead', {
      content_name: data.interest || 'general',
      content_category: 'lead_capture',
      value: 150,
      currency: 'USD',
    });
  }
}

/**
 * Track when someone clicks to book a call (high-intent action)
 */
export function trackContactEvent() {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Contact', {
      content_name: 'strategy_call',
    });
  }
}

/**
 * Track when someone clicks WhatsApp CTA
 */
export function trackWhatsAppClick() {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Contact', {
      content_name: 'whatsapp',
    });
  }
}
