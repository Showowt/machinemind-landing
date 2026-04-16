import QRCode from "qrcode";

export type QRStyle = "classic" | "luxury" | "framed" | "minimal";

export interface QRColors {
  dark: string;
  light: string;
  accent: string;
}

export interface QROptions {
  slug: string;
  baseUrl?: string;
  style?: QRStyle;
  colors?: QRColors;
  logo?: string;
  cta?: string;
  subtitle?: string;
  centerText?: string;
  size?: number;
}

const DEFAULT_BASE = "https://machinemindconsulting.com";
const DEFAULT_COLORS: QRColors = {
  dark: "#000000",
  light: "#FFFFFF",
  accent: "#c9a96e",
};

export function qrTargetUrl(slug: string, baseUrl: string = DEFAULT_BASE) {
  const clean = baseUrl.replace(/\/+$/, "");
  return `${clean}/q/${slug}`;
}

interface QRModuleData {
  data: Uint8Array;
  size: number;
}

async function getQRModules(text: string): Promise<QRModuleData> {
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  return {
    data: new Uint8Array(qr.modules.data),
    size: qr.modules.size,
  };
}

function renderModules(
  modules: QRModuleData,
  options: {
    dark: string;
    light: string;
    x: number;
    y: number;
    moduleSize: number;
    hideCenter?: boolean;
    centerRadius?: number;
  },
): string {
  const { data, size } = modules;
  const { dark, light, x, y, moduleSize, hideCenter, centerRadius = 0 } = options;
  const totalSize = size * moduleSize;
  const cx = size / 2;
  const cy = size / 2;

  const bg = `<rect x="${x}" y="${y}" width="${totalSize}" height="${totalSize}" fill="${light}"/>`;
  let mods = "";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const bit = data[row * size + col];
      if (!bit) continue;
      if (hideCenter) {
        const dx = col - cx + 0.5;
        const dy = row - cy + 0.5;
        if (Math.sqrt(dx * dx + dy * dy) < centerRadius) continue;
      }
      const px = x + col * moduleSize;
      const py = y + row * moduleSize;
      mods += `<rect x="${px}" y="${py}" width="${moduleSize}" height="${moduleSize}" fill="${dark}"/>`;
    }
  }
  return bg + mods;
}

export async function generateQRSVG(options: QROptions): Promise<string> {
  const {
    slug,
    baseUrl = DEFAULT_BASE,
    style = "classic",
    colors = DEFAULT_COLORS,
    centerText,
    cta,
    subtitle,
    size = 1200,
  } = options;

  const url = qrTargetUrl(slug, baseUrl);
  const modules = await getQRModules(url);
  const c = { ...DEFAULT_COLORS, ...colors };

  switch (style) {
    case "minimal":
      return renderMinimal(modules, url, c, size);
    case "luxury":
      return renderLuxury(modules, url, c, size, centerText);
    case "framed":
      return renderFramed(modules, url, c, size, cta, subtitle, centerText);
    case "classic":
    default:
      return renderClassic(modules, url, c, size);
  }
}

function renderClassic(
  modules: QRModuleData,
  url: string,
  c: QRColors,
  size: number,
): string {
  const border = 4;
  const total = modules.size + border * 2;
  const moduleSize = size / total;
  const qrBody = renderModules(modules, {
    dark: c.dark,
    light: c.light,
    x: border * moduleSize,
    y: border * moduleSize,
    moduleSize,
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" data-qr-target="${url}">
<rect width="${size}" height="${size}" fill="${c.light}"/>
${qrBody}
</svg>`;
}

function renderMinimal(
  modules: QRModuleData,
  url: string,
  c: QRColors,
  size: number,
): string {
  const border = 2;
  const total = modules.size + border * 2;
  const moduleSize = size / total;
  const qrBody = renderModules(modules, {
    dark: c.dark,
    light: c.light,
    x: border * moduleSize,
    y: border * moduleSize,
    moduleSize,
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" data-qr-target="${url}">
${qrBody}
</svg>`;
}

function renderLuxury(
  modules: QRModuleData,
  url: string,
  c: QRColors,
  size: number,
  centerText = "MM",
): string {
  const border = 4;
  const total = modules.size + border * 2;
  const moduleSize = size / total;
  const qrX = border * moduleSize;
  const qrSize = modules.size * moduleSize;
  const centerRadius = modules.size * 0.09;
  const qrBody = renderModules(modules, {
    dark: c.dark,
    light: c.light,
    x: qrX,
    y: qrX,
    moduleSize,
    hideCenter: true,
    centerRadius,
  });
  const logoSize = qrSize * 0.18;
  const logoX = size / 2 - logoSize / 2;
  const logoY = size / 2 - logoSize / 2;
  const logoRadius = logoSize * 0.18;
  const haloSize = logoSize + qrSize * 0.02;
  const haloX = size / 2 - haloSize / 2;
  const haloY = size / 2 - haloSize / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" data-qr-target="${url}">
<rect width="${size}" height="${size}" fill="${c.light}"/>
${qrBody}
<circle cx="${size / 2}" cy="${size / 2}" r="${haloSize / 2}" fill="${c.light}"/>
<rect x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" rx="${logoRadius}" fill="${c.dark}"/>
<text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central"
  font-family="Georgia, 'Playfair Display', serif" font-weight="700"
  font-size="${logoSize * 0.55}" fill="${c.accent}">${escapeXml(centerText)}</text>
</svg>`;
}

function renderFramed(
  modules: QRModuleData,
  url: string,
  c: QRColors,
  size: number,
  cta = "SCAN FOR",
  subtitle = "MACHINEMIND",
  centerText = "MM",
): string {
  const topBand = Math.round(size * 0.14);
  const bottomBand = Math.round(size * 0.1);
  const pad = Math.round(size * 0.04);
  const qrArea = size;
  const totalH = topBand + qrArea + bottomBand;
  const plateSize = size - pad * 2;
  const plateX = pad;
  const plateY = topBand + pad;

  const border = 4;
  const total = modules.size + border * 2;
  const moduleSize = plateSize / total;
  const qrX = plateX + border * moduleSize;
  const qrY = plateY + border * moduleSize;
  const qrSize = modules.size * moduleSize;
  const centerRadius = modules.size * 0.09;
  const qrBody = renderModules(modules, {
    dark: c.dark,
    light: c.light,
    x: qrX,
    y: qrY,
    moduleSize,
    hideCenter: true,
    centerRadius,
  });
  const logoSize = qrSize * 0.18;
  const logoCX = plateX + plateSize / 2;
  const logoCY = plateY + plateSize / 2;
  const logoX = logoCX - logoSize / 2;
  const logoY = logoCY - logoSize / 2;
  const logoRadius = logoSize * 0.18;
  const haloSize = logoSize + qrSize * 0.02;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${totalH}" width="${size}" height="${totalH}" data-qr-target="${url}">
<rect width="${size}" height="${totalH}" fill="${c.dark}"/>
<text x="${size / 2}" y="${topBand * 0.4}" text-anchor="middle"
  font-family="system-ui, -apple-system, Arial" font-size="${topBand * 0.2}"
  font-weight="500" letter-spacing="3" fill="#FFFFFF">${escapeXml(cta)}</text>
<text x="${size / 2}" y="${topBand * 0.78}" text-anchor="middle"
  font-family="system-ui, -apple-system, Arial" font-size="${topBand * 0.38}"
  font-weight="900" letter-spacing="2" fill="${c.accent}">${escapeXml(subtitle)}</text>
<rect x="${plateX}" y="${plateY}" width="${plateSize}" height="${plateSize}"
  rx="${plateSize * 0.04}" fill="${c.light}"/>
${qrBody}
<circle cx="${logoCX}" cy="${logoCY}" r="${haloSize / 2}" fill="${c.light}"/>
<rect x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}"
  rx="${logoRadius}" fill="${c.dark}"/>
<text x="${logoCX}" y="${logoCY}" text-anchor="middle" dominant-baseline="central"
  font-family="Georgia, 'Playfair Display', serif" font-weight="700"
  font-size="${logoSize * 0.55}" fill="${c.accent}">${escapeXml(centerText)}</text>
<text x="${size / 2}" y="${topBand + qrArea + bottomBand * 0.65}" text-anchor="middle"
  font-family="system-ui, -apple-system, Arial" font-size="${bottomBand * 0.38}"
  font-weight="700" fill="${c.accent}">machinemindconsulting.com</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function generateQRPNG(
  options: QROptions,
): Promise<Buffer> {
  const url = qrTargetUrl(options.slug, options.baseUrl);
  const buf = await QRCode.toBuffer(url, {
    errorCorrectionLevel: "H",
    margin: 4,
    width: options.size ?? 1200,
    color: {
      dark: options.colors?.dark ?? "#000000",
      light: options.colors?.light ?? "#FFFFFF",
    },
  });
  return buf;
}

export function generateSlug(length = 6): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function generateGiftCode(prefix = "MM"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = prefix + "-";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
