/**
 * UTM Parameter Tracking
 * Captures and persists UTM params from ad traffic (Meta, TikTok, Instagram)
 */

export interface UTMParams {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  landing_page: string | null;
  device: string | null;
}

const UTM_STORAGE_KEY = 'mm_utm';

/**
 * Extract UTM params from current URL and persist to sessionStorage.
 * Call this once on page load.
 */
export function captureUTMParams(): UTMParams {
  if (typeof window === 'undefined') {
    return emptyUTM();
  }

  // Check if we already have stored params (first-touch attribution)
  const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as UTMParams;
    } catch {
      // Corrupted — recapture
    }
  }

  const params = new URLSearchParams(window.location.search);

  const utm: UTMParams = {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_content: params.get('utm_content'),
    utm_term: params.get('utm_term'),
    referrer: document.referrer || null,
    landing_page: window.location.pathname,
    device: getDeviceType(),
  };

  // Only store if there's at least one UTM param or a referrer
  if (utm.utm_source || utm.referrer) {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  }

  return utm;
}

/**
 * Get stored UTM params (call from anywhere after initial capture)
 */
export function getStoredUTM(): UTMParams {
  if (typeof window === 'undefined') return emptyUTM();

  const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as UTMParams;
    } catch {
      return emptyUTM();
    }
  }

  return captureUTMParams();
}

function getDeviceType(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return 'mobile';
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  return 'desktop';
}

function emptyUTM(): UTMParams {
  return {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    referrer: null,
    landing_page: null,
    device: null,
  };
}
