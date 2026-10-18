import type { Metadata } from "next";

/**
 * /activate is a per-client activation + payment flow, not a landing page:
 * it is noindexed here and disallowed in robots.ts so it never surfaces in
 * search next to the public pricing story.
 */
export const metadata: Metadata = {
  title: "Activate Your System | MachineMind",
  description: "Client activation and payment confirmation for MachineMind systems.",
  robots: { index: false, follow: false },
};

export default function ActivateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
