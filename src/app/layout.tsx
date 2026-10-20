import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://machinemindconsulting.com"),
  title: "MachineMind | AI Automation Consultancy",
  description:
    "We build AI systems that think. Automation infrastructure for hospitality, real estate, and private capital. 47+ deployments. 24/7 active.",
  keywords: [
    "AI automation",
    "automation consultancy",
    "hospitality tech",
    "WhatsApp AI",
    "Sofia AI",
    "Cinema Engine",
    "Cartagena",
    "Colombia",
  ],
  authors: [{ name: "MachineMind" }],
  creator: "MachineMind",
  // Google Search Console ownership. Required before Play Console will let the
  // developer account convert from Personal to Organization — the "Change account
  // type" control stays disabled until this domain is verified. Do not remove: Google
  // re-checks periodically and un-verifies the property if the tag disappears.
  // Belt and braces, public/googlee662c3ff93afd708.html carries the file method too.
  verification: {
    google: "HTD6CMluyKm15iNW_VeW2yVWUvryVYR8rOMi_msqr70",
  },
  openGraph: {
    title: "MachineMind | AI Automation Consultancy",
    description: "We build AI systems that think.",
    type: "website",
    locale: "en_US",
    siteName: "MachineMind",
    images: [
      {
        // Filename carries the brand revision on purpose: Facebook, WhatsApp
        // and LinkedIn cache a preview image by URL and will keep serving a
        // stale card for weeks. A new path is the only reliable cache bust.
        url: "/og-image-brand.png",
        width: 1200,
        height: 630,
        alt: "MachineMind Consulting",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MachineMind | AI Automation Consultancy",
    description: "We build AI systems that think.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
};

/**
 * Structured data — lets search and AI answer engines state what MachineMind
 * is, where it operates and how to reach it, instead of inferring it from
 * animated hero copy. Every claim here is already public on the page.
 */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ProfessionalService",
      "@id": "https://machinemindconsulting.com/#organization",
      name: "MachineMind Consulting",
      alternateName: "MachineMind",
      url: "https://machinemindconsulting.com",
      logo: "https://machinemindconsulting.com/logo-stacked.png",
      image: "https://machinemindconsulting.com/og-image-brand.png",
      description:
        "AI automation consultancy building autonomous intelligence infrastructure — WhatsApp AI concierges, cinematic web platforms, and full-stack software for hospitality, real estate, and private capital.",
      founder: { "@type": "Person", name: "Phil McGill" },
      email: "Phil@machinemindconsulting.com",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Cartagena",
        addressCountry: "CO",
      },
      areaServed: [
        { "@type": "Country", name: "Colombia" },
        { "@type": "Country", name: "El Salvador" },
        { "@type": "Country", name: "Panamá" },
        { "@type": "Country", name: "United States" },
      ],
      knowsLanguage: ["es", "en"],
      sameAs: [
        "https://www.linkedin.com/company/machinemindconsulting",
        "https://x.com/machinemindai",
        "https://instagram.com/machinemindconsulting",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://machinemindconsulting.com/#website",
      url: "https://machinemindconsulting.com",
      name: "MachineMind",
      inLanguage: ["en", "es"],
      publisher: { "@id": "https://machinemindconsulting.com/#organization" },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <meta name="theme-color" content="#06060a" />
        {/* Font loading via link tags — most reliable cross-browser method */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://api.fontshare.com/v2/css?f[]=clash-display@200,300,400,500,600,700&display=swap" rel="stylesheet" />
        <link href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

        {/* Meta Pixel — ID: 1335865971435206 */}
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '1335865971435206');
          fbq('track', 'PageView');
        `}</Script>
        <noscript>
          <img height="1" width="1" style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=1335865971435206&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
      </head>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
        {children}
      </body>
    </html>
  );
}
