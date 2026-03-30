/**
 * Viceroy Lead Scraper & Enrichment Pipeline
 *
 * Sources (all legal, public data):
 * 1. County property records (public assessor data)
 * 2. Apollo.io API (business/professional data enrichment)
 * 3. Hunter.io API (email finding from names + domains)
 * 4. Public business registrations
 * 5. LinkedIn public profiles (via Google search)
 *
 * This module provides the scraping infrastructure.
 * API keys required for enrichment services.
 */

export interface ViceroyLead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  assetCategory: string[];
  estimatedEquity: string;
  source: string;
  city: string;
  state: string;
  propertyAddress?: string;
  linkedinUrl?: string;
  company?: string;
  title?: string;
  alignmentScore: number;
  enrichmentStatus: "raw" | "partial" | "enriched";
  createdAt: string;
  notes: string;
}

export interface ScrapingConfig {
  apolloApiKey?: string;
  hunterApiKey?: string;
  minEquity: number;
  targetStates: string[];
  maxResults: number;
}

const DEFAULT_CONFIG: ScrapingConfig = {
  minEquity: 200000,
  targetStates: ["FL", "TX", "CA", "AZ", "NV", "CO", "GA", "NC", "SC", "TN"],
  maxResults: 500,
};

/**
 * Apollo.io People Search
 * Free tier: 50 credits/month
 * Finds professionals matching criteria with emails + phones
 */
export async function searchApollo(
  config: ScrapingConfig,
  filters: {
    titles?: string[];
    industries?: string[];
    locations?: string[];
    employeeCounts?: string[];
    keywords?: string[];
  },
): Promise<ViceroyLead[]> {
  if (!config.apolloApiKey) {
    console.log("[Viceroy] Apollo API key not configured");
    return [];
  }

  const leads: ViceroyLead[] = [];

  try {
    // Apollo People Search API
    const response = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": config.apolloApiKey,
      },
      body: JSON.stringify({
        per_page: Math.min(config.maxResults, 100),
        person_titles: filters.titles || [
          "Owner",
          "President",
          "CEO",
          "Founder",
          "Managing Member",
          "Principal",
          "Director",
          "Self Employed",
        ],
        person_locations: filters.locations || config.targetStates.map(s => `United States, ${s}`),
        q_keywords: filters.keywords?.join(" ") || "real estate investor property owner self directed",
        person_seniorities: ["owner", "founder", "c_suite", "director"],
      }),
    });

    if (!response.ok) {
      console.error("[Viceroy] Apollo error:", await response.text());
      return [];
    }

    const data = await response.json();
    const people = data.people || [];

    for (const person of people) {
      leads.push({
        id: `apollo_${person.id || Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        firstName: person.first_name || "",
        lastName: person.last_name || "",
        email: person.email || "",
        phone: person.phone_numbers?.[0]?.sanitized_number || "",
        assetCategory: inferAssetCategories(person),
        estimatedEquity: "Unknown",
        source: "apollo",
        city: person.city || "",
        state: person.state || "",
        company: person.organization?.name || "",
        title: person.title || "",
        linkedinUrl: person.linkedin_url || "",
        alignmentScore: scoreLeadAlignment(person),
        enrichmentStatus: person.email ? "enriched" : "partial",
        createdAt: new Date().toISOString(),
        notes: `Apollo: ${person.title || "N/A"} at ${person.organization?.name || "N/A"}`,
      });
    }
  } catch (error) {
    console.error("[Viceroy] Apollo search error:", error);
  }

  return leads;
}

/**
 * Hunter.io Email Finder
 * Free tier: 25 searches/month
 * Finds emails from name + domain
 */
export async function findEmailHunter(
  config: ScrapingConfig,
  firstName: string,
  lastName: string,
  domain?: string,
  company?: string,
): Promise<{ email: string; confidence: number } | null> {
  if (!config.hunterApiKey) {
    console.log("[Viceroy] Hunter API key not configured");
    return null;
  }

  try {
    const params = new URLSearchParams({
      api_key: config.hunterApiKey,
      first_name: firstName,
      last_name: lastName,
    });

    if (domain) params.set("domain", domain);
    if (company) params.set("company", company);

    const response = await fetch(
      `https://api.hunter.io/v2/email-finder?${params.toString()}`,
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.data?.email) {
      return {
        email: data.data.email,
        confidence: data.data.confidence || 0,
      };
    }
  } catch (error) {
    console.error("[Viceroy] Hunter error:", error);
  }

  return null;
}

/**
 * Property Records Search (Public Data)
 * Uses public county assessor APIs where available
 * Falls back to aggregator APIs
 */
export async function searchPropertyRecords(
  config: ScrapingConfig,
  county?: string,
  state?: string,
): Promise<ViceroyLead[]> {
  const leads: ViceroyLead[] = [];

  // Property data aggregator APIs (ATTOM, CoreLogic, Zillow)
  // These require API keys — structure ready for integration
  console.log("[Viceroy] Property records search — configure ATTOM or similar API key for live data");

  // For now, generate the proper API call structure
  // ATTOM Data Solutions API (property data)
  const attomKey = process.env.ATTOM_API_KEY;
  if (attomKey && state) {
    try {
      const params = new URLSearchParams({
        postalcode: "", // Would need ZIP codes
        minAssdTtlValue: config.minEquity.toString(),
        propertytype: "SFR", // Single family residential
        pagesize: "50",
      });

      const response = await fetch(
        `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/snapshot?${params.toString()}`,
        {
          headers: {
            Accept: "application/json",
            apikey: attomKey,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        const properties = data.property || [];

        for (const prop of properties) {
          const owner = prop.owner || {};
          if (owner.owner1?.last && (prop.assessment?.assessed?.assdTtlValue || 0) >= config.minEquity) {
            leads.push({
              id: `attom_${prop.identifier?.attomId || Date.now()}`,
              firstName: owner.owner1.first || "",
              lastName: owner.owner1.last || "",
              email: "", // Need enrichment
              phone: "", // Need enrichment
              assetCategory: ["real_estate"],
              estimatedEquity: `$${(prop.assessment?.assessed?.assdTtlValue || 0).toLocaleString()}`,
              source: "attom_property",
              city: prop.address?.locality || "",
              state: prop.address?.countrySubd || state,
              propertyAddress: `${prop.address?.line1 || ""}, ${prop.address?.locality || ""}, ${prop.address?.countrySubd || ""}`,
              alignmentScore: 60, // Real estate owners score well
              enrichmentStatus: "raw",
              createdAt: new Date().toISOString(),
              notes: `Property value: $${(prop.assessment?.assessed?.assdTtlValue || 0).toLocaleString()}`,
            });
          }
        }
      }
    } catch (error) {
      console.error("[Viceroy] ATTOM error:", error);
    }
  }

  return leads;
}

/**
 * Google Custom Search for LinkedIn profiles
 * Free tier: 100 queries/day
 * Finds self-directed IRA holders, real estate investors, etc.
 */
export async function searchGoogleForProfiles(
  query: string,
  config: ScrapingConfig,
): Promise<Array<{ name: string; url: string; snippet: string }>> {
  const googleKey = process.env.GOOGLE_CSE_KEY;
  const googleCx = process.env.GOOGLE_CSE_ID;

  if (!googleKey || !googleCx) {
    console.log("[Viceroy] Google CSE not configured");
    return [];
  }

  try {
    const params = new URLSearchParams({
      key: googleKey,
      cx: googleCx,
      q: query,
      num: "10",
    });

    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?${params.toString()}`,
    );

    if (!response.ok) return [];

    const data = await response.json();
    return (data.items || []).map((item: { title: string; link: string; snippet: string }) => ({
      name: item.title.replace(" - LinkedIn", "").replace(" | LinkedIn", ""),
      url: item.link,
      snippet: item.snippet || "",
    }));
  } catch (error) {
    console.error("[Viceroy] Google CSE error:", error);
    return [];
  }
}

/**
 * Full enrichment pipeline
 * Takes raw leads and enriches with email + phone
 */
export async function enrichLeads(
  leads: ViceroyLead[],
  config: ScrapingConfig,
): Promise<ViceroyLead[]> {
  const enriched: ViceroyLead[] = [];

  for (const lead of leads) {
    if (lead.enrichmentStatus === "enriched") {
      enriched.push(lead);
      continue;
    }

    // Try Hunter.io for email
    if (!lead.email && lead.firstName && lead.lastName) {
      const hunterResult = await findEmailHunter(
        config,
        lead.firstName,
        lead.lastName,
        undefined,
        lead.company,
      );
      if (hunterResult && hunterResult.confidence > 50) {
        lead.email = hunterResult.email;
      }
    }

    // Try Apollo for additional data
    if ((!lead.email || !lead.phone) && config.apolloApiKey) {
      const apolloResults = await searchApollo(config, {
        keywords: [`${lead.firstName} ${lead.lastName}`],
        locations: lead.state ? [`United States, ${lead.state}`] : undefined,
      });

      const match = apolloResults.find(
        (r) =>
          r.firstName.toLowerCase() === lead.firstName.toLowerCase() &&
          r.lastName.toLowerCase() === lead.lastName.toLowerCase(),
      );

      if (match) {
        if (!lead.email && match.email) lead.email = match.email;
        if (!lead.phone && match.phone) lead.phone = match.phone;
        if (!lead.linkedinUrl && match.linkedinUrl) lead.linkedinUrl = match.linkedinUrl;
        if (!lead.company && match.company) lead.company = match.company;
        if (!lead.title && match.title) lead.title = match.title;
      }
    }

    // Update enrichment status
    if (lead.email && lead.phone) {
      lead.enrichmentStatus = "enriched";
    } else if (lead.email || lead.phone) {
      lead.enrichmentStatus = "partial";
    }

    enriched.push(lead);
  }

  return enriched;
}

/**
 * Convert leads to CSV
 */
export function leadsToCSV(leads: ViceroyLead[]): string {
  const headers = [
    "ID",
    "First Name",
    "Last Name",
    "Email",
    "Phone",
    "Asset Categories",
    "Estimated Equity",
    "Source",
    "City",
    "State",
    "Property Address",
    "LinkedIn",
    "Company",
    "Title",
    "Alignment Score",
    "Enrichment Status",
    "Created At",
    "Notes",
  ];

  const rows = leads.map((l) => [
    l.id,
    l.firstName,
    l.lastName,
    l.email,
    l.phone,
    l.assetCategory.join("; "),
    l.estimatedEquity,
    l.source,
    l.city,
    l.state,
    l.propertyAddress || "",
    l.linkedinUrl || "",
    l.company || "",
    l.title || "",
    l.alignmentScore.toString(),
    l.enrichmentStatus,
    l.createdAt,
    l.notes,
  ]);

  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  return [
    headers.join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ].join("\n");
}

// === HELPER FUNCTIONS ===

function inferAssetCategories(person: Record<string, unknown>): string[] {
  const categories: string[] = [];
  const title = ((person.title as string) || "").toLowerCase();
  const industry = ((person.organization as Record<string, unknown>)?.industry as string || "").toLowerCase();

  if (title.match(/real estate|property|realty|landlord/) || industry.match(/real estate/)) {
    categories.push("real_estate");
  }
  if (title.match(/investor|capital|fund|asset|wealth/)) {
    categories.push("capital");
  }
  if (title.match(/self.?employed|owner|founder|entrepreneur/)) {
    categories.push("business_owner");
  }
  if (industry.match(/crypto|blockchain|digital/)) {
    categories.push("crypto");
  }

  return categories.length > 0 ? categories : ["general"];
}

function scoreLeadAlignment(person: Record<string, unknown>): number {
  let score = 30; // Base score for being found in search
  const title = ((person.title as string) || "").toLowerCase();

  // High-value titles
  if (title.match(/owner|founder|ceo|president|managing/)) score += 20;
  if (title.match(/investor|capital|wealth|asset/)) score += 25;
  if (title.match(/real estate|property/)) score += 20;
  if (title.match(/self.?employed|independent|consultant/)) score += 15;

  // Has direct contact info
  if (person.email) score += 5;
  if ((person.phone_numbers as unknown[])?.length > 0) score += 5;

  return Math.min(100, score);
}

/**
 * Pre-built search queries for each target asset category
 */
export const SEARCH_QUERIES = {
  realEstate: [
    'site:linkedin.com "real estate investor" "self employed" -recruiter -agent',
    'site:linkedin.com "property owner" "real estate" owner founder -agent -broker',
    'site:linkedin.com "rental property" owner investor -agent -realtor',
    'site:linkedin.com "real estate portfolio" owner managing -agent',
  ],
  selfDirectedIRA: [
    'site:linkedin.com "self directed IRA" investor owner',
    'site:linkedin.com "SDIRA" "real estate" investor',
    'site:linkedin.com "self directed retirement" investor owner',
    '"self directed IRA" "real estate" investor community forum',
  ],
  crypto: [
    'site:linkedin.com "crypto investor" "self employed" owner',
    'site:linkedin.com "bitcoin" investor owner founder -exchange -analyst',
    'site:linkedin.com "digital assets" investor owner capital',
    'site:linkedin.com "cryptocurrency" investor "self directed"',
  ],
  businessOwners: [
    'site:linkedin.com "business owner" "real estate" investor',
    'site:linkedin.com "serial entrepreneur" investor capital',
    'site:linkedin.com "managing member" LLC investor owner',
    'site:linkedin.com "private investor" owner founder capital',
  ],
  highNetWorth: [
    'site:linkedin.com "private equity" "family office" principal',
    'site:linkedin.com "wealth management" "self directed" independent',
    'site:linkedin.com "accredited investor" owner founder',
    'site:linkedin.com "angel investor" owner entrepreneur capital',
  ],
};
