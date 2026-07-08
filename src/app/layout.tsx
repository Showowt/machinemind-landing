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
  openGraph: {
    title: "MachineMind | AI Automation Consultancy",
    description: "We build AI systems that think.",
    type: "website",
    locale: "en_US",
    siteName: "MachineMind",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MachineMind - AI Automation Consultancy",
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
        {children}
      </body>
    </html>
  );
}
