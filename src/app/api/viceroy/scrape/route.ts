import { NextResponse } from "next/server";
import {
  searchApollo,
  searchPropertyRecords,
  searchGoogleForProfiles,
  enrichLeads,
  leadsToCSV,
  SEARCH_QUERIES,
  type ScrapingConfig,
  type ViceroyLead,
} from "@/lib/viceroy/leadScraper";

/**
 * POST /api/viceroy/scrape — Run full lead scraping pipeline
 *
 * Body:
 *   categories: string[] — which target categories to scrape
 *   states: string[] — target states
 *   enrich: boolean — run enrichment pipeline
 *   maxPerCategory: number — max leads per category
 *
 * Returns CSV or JSON based on Accept header
 */
export async function POST(request: Request) {
  // Auth
  const authKey = request.headers.get("x-viceroy-key");
  if (process.env.VICEROY_API_KEY && authKey !== process.env.VICEROY_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      categories = ["realEstate", "selfDirectedIRA", "businessOwners", "crypto", "highNetWorth"],
      states = ["FL", "TX", "CA", "AZ", "NV", "CO", "GA", "NC", "SC", "TN"],
      enrich = true,
      maxPerCategory = 100,
    } = body;

    const config: ScrapingConfig = {
      apolloApiKey: process.env.APOLLO_API_KEY,
      hunterApiKey: process.env.HUNTER_API_KEY,
      minEquity: 200000,
      targetStates: states,
      maxResults: maxPerCategory,
    };

    let allLeads: ViceroyLead[] = [];
    const results: Record<string, number> = {};

    // === SCRAPE EACH CATEGORY ===
    for (const category of categories) {
      console.log(`[Viceroy Scrape] Processing category: ${category}`);

      // Apollo search
      if (config.apolloApiKey) {
        const titles = getCategoryTitles(category);
        const keywords = getCategoryKeywords(category);

        const apolloLeads = await searchApollo(config, {
          titles,
          keywords,
          locations: states.map((s: string) => `United States, ${s}`),
        });
        allLeads.push(...apolloLeads);
        results[`apollo_${category}`] = apolloLeads.length;
      }

      // Google CSE search
      const queries = SEARCH_QUERIES[category as keyof typeof SEARCH_QUERIES];
      if (queries && process.env.GOOGLE_CSE_KEY) {
        for (const query of queries.slice(0, 2)) {
          const profiles = await searchGoogleForProfiles(query, config);
          for (const profile of profiles) {
            const nameParts = profile.name.split(" ");
            allLeads.push({
              id: `goog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              firstName: nameParts[0] || "",
              lastName: nameParts.slice(1).join(" ") || "",
              email: "",
              phone: "",
              assetCategory: [category],
              estimatedEquity: "Unknown",
              source: "google_linkedin",
              city: "",
              state: "",
              linkedinUrl: profile.url.includes("linkedin.com") ? profile.url : "",
              alignmentScore: 40,
              enrichmentStatus: "raw",
              createdAt: new Date().toISOString(),
              notes: profile.snippet.slice(0, 200),
            });
          }
        }
        results[`google_${category}`] = allLeads.filter(
          (l) => l.source === "google_linkedin" && l.assetCategory.includes(category),
        ).length;
      }

      // Property records (only for real estate category)
      if (category === "realEstate") {
        for (const state of states.slice(0, 3)) {
          const propertyLeads = await searchPropertyRecords(config, undefined, state);
          allLeads.push(...propertyLeads);
          results[`property_${state}`] = propertyLeads.length;
        }
      }
    }

    // === ENRICH ===
    if (enrich && allLeads.length > 0) {
      console.log(`[Viceroy Scrape] Enriching ${allLeads.length} leads...`);
      allLeads = await enrichLeads(allLeads, config);
    }

    // === DEDUPLICATE ===
    const seen = new Map<string, ViceroyLead>();
    for (const lead of allLeads) {
      const key = `${lead.firstName.toLowerCase()}_${lead.lastName.toLowerCase()}_${lead.email.toLowerCase() || lead.linkedinUrl || lead.id}`;
      if (!seen.has(key) || (lead.enrichmentStatus === "enriched" && seen.get(key)!.enrichmentStatus !== "enriched")) {
        seen.set(key, lead);
      }
    }
    allLeads = Array.from(seen.values());

    // === SORT ===
    allLeads.sort((a, b) => b.alignmentScore - a.alignmentScore);

    console.log(`[Viceroy Scrape] Complete. ${allLeads.length} unique leads.`);

    // === RESPOND ===
    const wantsCsv = request.headers.get("accept")?.includes("text/csv");

    if (wantsCsv) {
      const csv = leadsToCSV(allLeads);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="viceroy-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      leads: allLeads,
      meta: {
        total: allLeads.length,
        enriched: allLeads.filter((l) => l.enrichmentStatus === "enriched").length,
        partial: allLeads.filter((l) => l.enrichmentStatus === "partial").length,
        raw: allLeads.filter((l) => l.enrichmentStatus === "raw").length,
        byCategory: results,
        aligned: allLeads.filter((l) => l.alignmentScore >= 65).length,
        probable: allLeads.filter((l) => l.alignmentScore >= 40 && l.alignmentScore < 65).length,
        states,
        categories,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[Viceroy Scrape] Error:", error);
    return NextResponse.json(
      { error: "Scraping pipeline failed", details: String(error) },
      { status: 500 },
    );
  }
}

function getCategoryTitles(category: string): string[] {
  const map: Record<string, string[]> = {
    realEstate: [
      "Real Estate Investor",
      "Property Owner",
      "Real Estate Developer",
      "Landlord",
      "Property Manager",
      "Real Estate Entrepreneur",
    ],
    selfDirectedIRA: [
      "Self Employed",
      "Independent Investor",
      "Retirement Planning",
      "Financial Independence",
    ],
    crypto: [
      "Crypto Investor",
      "Blockchain",
      "Digital Asset",
      "DeFi",
      "Web3 Investor",
    ],
    businessOwners: [
      "Owner",
      "Founder",
      "CEO",
      "President",
      "Managing Member",
      "Principal",
      "Self Employed",
    ],
    highNetWorth: [
      "Private Investor",
      "Angel Investor",
      "Family Office",
      "Private Equity",
      "Venture Capital",
      "Wealth Management",
    ],
  };
  return map[category] || map.businessOwners;
}

function getCategoryKeywords(category: string): string[] {
  const map: Record<string, string[]> = {
    realEstate: ["real estate", "property", "equity", "rental", "investor"],
    selfDirectedIRA: ["self directed IRA", "SDIRA", "retirement", "self managed"],
    crypto: ["cryptocurrency", "bitcoin", "blockchain", "digital assets"],
    businessOwners: ["business owner", "entrepreneur", "self employed"],
    highNetWorth: ["private investor", "accredited", "family office", "angel"],
  };
  return map[category] || map.businessOwners;
}
