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
 * GET /api/viceroy/leads — Fetch and export leads as CSV
 * Query params:
 *   source: "apollo" | "property" | "google" | "all"
 *   category: "realEstate" | "selfDirectedIRA" | "crypto" | "businessOwners" | "highNetWorth"
 *   state: state code (e.g., "FL")
 *   format: "csv" | "json"
 *   enrich: "true" | "false"
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source") || "apollo";
  const category = searchParams.get("category") || "businessOwners";
  const state = searchParams.get("state") || "";
  const format = searchParams.get("format") || "csv";
  const shouldEnrich = searchParams.get("enrich") === "true";

  // Auth check — simple API key for now
  const authKey = request.headers.get("x-viceroy-key");
  if (authKey !== process.env.VICEROY_API_KEY && process.env.VICEROY_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config: ScrapingConfig = {
    apolloApiKey: process.env.APOLLO_API_KEY,
    hunterApiKey: process.env.HUNTER_API_KEY,
    minEquity: 200000,
    targetStates: state ? [state] : ["FL", "TX", "CA", "AZ", "NV", "CO", "GA", "NC"],
    maxResults: 500,
  };

  let leads: ViceroyLead[] = [];

  try {
    // === SOURCE: APOLLO ===
    if (source === "apollo" || source === "all") {
      console.log("[Viceroy] Searching Apollo...");
      const apolloLeads = await searchApollo(config, {
        keywords: getKeywordsForCategory(category),
        locations: state ? [`United States, ${state}`] : undefined,
      });
      leads.push(...apolloLeads);
      console.log(`[Viceroy] Apollo: ${apolloLeads.length} leads`);
    }

    // === SOURCE: PROPERTY RECORDS ===
    if (source === "property" || source === "all") {
      console.log("[Viceroy] Searching property records...");
      const propertyLeads = await searchPropertyRecords(config, undefined, state || undefined);
      leads.push(...propertyLeads);
      console.log(`[Viceroy] Property: ${propertyLeads.length} leads`);
    }

    // === SOURCE: GOOGLE CSE ===
    if (source === "google" || source === "all") {
      console.log("[Viceroy] Searching Google CSE...");
      const queries = SEARCH_QUERIES[category as keyof typeof SEARCH_QUERIES] || SEARCH_QUERIES.businessOwners;

      for (const query of queries.slice(0, 2)) { // Limit to 2 queries to conserve quota
        const profiles = await searchGoogleForProfiles(query, config);
        for (const profile of profiles) {
          const nameParts = profile.name.split(" ");
          leads.push({
            id: `google_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            firstName: nameParts[0] || "",
            lastName: nameParts.slice(1).join(" ") || "",
            email: "",
            phone: "",
            assetCategory: [category],
            estimatedEquity: "Unknown",
            source: "google_cse",
            city: "",
            state: state || "",
            linkedinUrl: profile.url.includes("linkedin.com") ? profile.url : "",
            alignmentScore: 40,
            enrichmentStatus: "raw",
            createdAt: new Date().toISOString(),
            notes: profile.snippet.slice(0, 200),
          });
        }
      }
      console.log(`[Viceroy] Google: ${leads.filter(l => l.source === "google_cse").length} leads`);
    }

    // === ENRICHMENT ===
    if (shouldEnrich && leads.length > 0) {
      console.log(`[Viceroy] Enriching ${leads.length} leads...`);
      leads = await enrichLeads(leads, config);
      console.log(`[Viceroy] Enriched: ${leads.filter(l => l.enrichmentStatus === "enriched").length} fully enriched`);
    }

    // === DEDUPLICATE ===
    leads = deduplicateLeads(leads);

    // === SORT BY ALIGNMENT SCORE ===
    leads.sort((a, b) => b.alignmentScore - a.alignmentScore);

    console.log(`[Viceroy] Total leads: ${leads.length}`);

    // === FORMAT RESPONSE ===
    if (format === "csv") {
      const csv = leadsToCSV(leads);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="viceroy-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      leads,
      meta: {
        total: leads.length,
        enriched: leads.filter((l) => l.enrichmentStatus === "enriched").length,
        partial: leads.filter((l) => l.enrichmentStatus === "partial").length,
        raw: leads.filter((l) => l.enrichmentStatus === "raw").length,
        sources: [...new Set(leads.map((l) => l.source))],
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[Viceroy] Lead generation error:", error);
    return NextResponse.json(
      { error: "Lead generation failed", details: String(error) },
      { status: 500 },
    );
  }
}

/**
 * POST /api/viceroy/leads — Save assessment form submissions
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      assetCategories,
      estimatedEquity,
      objectives,
      decisionAuthority,
      timeframe,
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "First name, last name, and email are required" },
        { status: 400 },
      );
    }

    // Calculate alignment from form data
    let alignmentScore = 30; // Base for completing the form

    // Asset category scoring
    if (assetCategories?.includes("real_estate")) alignmentScore += 15;
    if (assetCategories?.includes("cd_accounts")) alignmentScore += 12;
    if (assetCategories?.includes("cash_reserves")) alignmentScore += 10;
    if (assetCategories?.includes("401k")) alignmentScore += 12;
    if (assetCategories?.includes("sdira")) alignmentScore += 18;
    if (assetCategories?.includes("crypto")) alignmentScore += 12;

    // Decision authority
    if (decisionAuthority === "sole") alignmentScore += 15;
    else if (decisionAuthority === "primary") alignmentScore += 10;
    else if (decisionAuthority === "shared") alignmentScore += 5;

    // Equity level
    if (estimatedEquity === "1m_plus") alignmentScore += 15;
    else if (estimatedEquity === "500k_1m") alignmentScore += 12;
    else if (estimatedEquity === "200k_500k") alignmentScore += 10;

    alignmentScore = Math.min(100, alignmentScore);

    const lead: ViceroyLead = {
      id: `assess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      firstName,
      lastName,
      email,
      phone: phone || "",
      assetCategory: assetCategories || [],
      estimatedEquity: estimatedEquity || "Unknown",
      source: "assessment_form",
      city: "",
      state: "",
      alignmentScore,
      enrichmentStatus: email && phone ? "enriched" : "partial",
      createdAt: new Date().toISOString(),
      notes: `Objectives: ${objectives || "N/A"} | Timeframe: ${timeframe || "N/A"} | Authority: ${decisionAuthority || "N/A"}`,
    };

    // Store in Supabase if configured
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createServiceClient } = await import("@/lib/supabase/server");
      const supabase = createServiceClient();

      await supabase.from("viceroy_leads").insert({
        first_name: lead.firstName,
        last_name: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        asset_categories: lead.assetCategory,
        estimated_equity: lead.estimatedEquity,
        alignment_score: lead.alignmentScore,
        source: lead.source,
        objectives,
        decision_authority: decisionAuthority,
        timeframe,
        status: alignmentScore >= 65 ? "qualified" : "pending",
      });
    }

    // Determine quality label
    let quality: string;
    if (alignmentScore >= 65) quality = "aligned";
    else if (alignmentScore >= 40) quality = "probable";
    else quality = "exploring";

    return NextResponse.json({
      success: true,
      lead,
      quality,
      alignmentScore,
      message:
        alignmentScore >= 65
          ? "Strong structural alignment detected. A representative will be in touch within 24 hours."
          : "Thank you for your interest. We'll review your assessment and follow up if there's alignment.",
    });
  } catch (error) {
    console.error("[Viceroy] Assessment submission error:", error);
    return NextResponse.json(
      { error: "Submission failed" },
      { status: 500 },
    );
  }
}

// === HELPERS ===

function getKeywordsForCategory(category: string): string[] {
  const categoryKeywords: Record<string, string[]> = {
    realEstate: ["real estate investor", "property owner", "real estate equity", "rental properties"],
    selfDirectedIRA: ["self directed IRA", "SDIRA", "self directed retirement"],
    crypto: ["crypto investor", "bitcoin", "digital assets", "cryptocurrency"],
    businessOwners: ["business owner", "entrepreneur", "founder", "self employed"],
    highNetWorth: ["private investor", "family office", "accredited investor", "angel investor"],
  };
  return categoryKeywords[category] || categoryKeywords.businessOwners;
}

function deduplicateLeads(leads: ViceroyLead[]): ViceroyLead[] {
  const seen = new Map<string, ViceroyLead>();

  for (const lead of leads) {
    const key = `${lead.firstName.toLowerCase()}_${lead.lastName.toLowerCase()}_${lead.email.toLowerCase()}`;

    if (seen.has(key)) {
      const existing = seen.get(key)!;
      // Keep the more enriched version
      if (
        (lead.enrichmentStatus === "enriched" && existing.enrichmentStatus !== "enriched") ||
        lead.alignmentScore > existing.alignmentScore
      ) {
        seen.set(key, lead);
      }
    } else {
      seen.set(key, lead);
    }
  }

  return Array.from(seen.values());
}
