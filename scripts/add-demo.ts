#!/usr/bin/env npx tsx
/**
 * Add Demo Script
 *
 * Usage: npx tsx scripts/add-demo.ts <project-dir> <vercel-url>
 *
 * Example:
 *   npx tsx scripts/add-demo.ts dharma https://dharma-topaz.vercel.app
 *   npx tsx scripts/add-demo.ts demo-newclient https://demo-newclient.vercel.app
 *
 * This script will:
 * 1. Read the project's package.json for tech stack info
 * 2. Try to extract name/description from the project
 * 3. Add the project to projects-data.ts
 * 4. Commit and deploy automatically
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const BUILDS_DIR = "/Users/showowt/machinemind-builds";
const PROJECTS_FILE = path.join(
  BUILDS_DIR,
  "machinemind-landing/src/lib/projects-data.ts",
);

interface DemoConfig {
  slug: string;
  nameEs: string;
  nameEn: string;
  taglineEs: string;
  taglineEn: string;
  descriptionEs?: string;
  descriptionEn?: string;
  category: "demo" | "flagship" | "automation" | "enterprise";
  subcategory: string;
  techStack: string[];
  liveUrl: string;
  colorAccent: string;
  isActive: boolean;
  isFeatured: boolean;
}

// Color palette for demos
const COLORS = [
  "#00B4FF", // MachineMind Blue
  "#d4af37", // Gold
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#6366f1", // Indigo
];

function getRandomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function detectTechStack(projectDir: string): string[] {
  const stack: string[] = [];
  const pkgPath = path.join(projectDir, "package.json");

  if (!fs.existsSync(pkgPath)) {
    return ["Next.js 16", "Tailwind"];
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  // Framework
  if (deps.next) {
    const version = deps.next.replace(/[\^~]/g, "").split(".")[0];
    stack.push(`Next.js ${version}`);
  }

  // Database
  if (deps["@supabase/supabase-js"] || deps["@supabase/ssr"]) {
    stack.push("Supabase");
  }

  // Payments
  if (deps.stripe || deps["@stripe/stripe-js"]) {
    stack.push("Stripe");
  }
  if (deps.wompi) {
    stack.push("Wompi");
  }

  // State
  if (deps.zustand) {
    stack.push("Zustand");
  }

  // Animation
  if (deps["framer-motion"]) {
    stack.push("Framer Motion");
  }

  // AI
  if (deps["@anthropic-ai/sdk"] || deps.anthropic) {
    stack.push("Claude AI");
  }
  if (deps.openai) {
    stack.push("OpenAI");
  }

  // Styling (if Tailwind not in stack)
  if (deps.tailwindcss && !stack.includes("Tailwind")) {
    stack.push("Tailwind");
  }

  return stack.length > 0 ? stack : ["Next.js 16", "Tailwind"];
}

function detectSubcategory(projectDir: string, slug: string): string {
  const name = slug.toLowerCase();

  if (
    name.includes("hotel") ||
    name.includes("resort") ||
    name.includes("villa") ||
    name.includes("dharma") ||
    name.includes("beach")
  ) {
    return "hospitality";
  }
  if (
    name.includes("restaurant") ||
    name.includes("food") ||
    name.includes("cafe") ||
    name.includes("nikkei")
  ) {
    return "restaurant";
  }
  if (
    name.includes("tour") ||
    name.includes("travel") ||
    name.includes("transfer") ||
    name.includes("aero")
  ) {
    return "transport";
  }
  if (
    name.includes("club") ||
    name.includes("night") ||
    name.includes("party") ||
    name.includes("sound")
  ) {
    return "nightlife";
  }
  if (
    name.includes("concierge") ||
    name.includes("luxury") ||
    name.includes("vip")
  ) {
    return "concierge";
  }
  if (
    name.includes("spa") ||
    name.includes("wellness") ||
    name.includes("beauty")
  ) {
    return "wellness";
  }

  return "services";
}

function generateProjectEntry(config: DemoConfig): string {
  const techStackStr = config.techStack.map((t) => `"${t}"`).join(", ");

  let entry = `  {
    slug: "${config.slug}",
    nameEs: "${config.nameEs}",
    nameEn: "${config.nameEn}",
    taglineEs: "${config.taglineEs}",
    taglineEn: "${config.taglineEn}",`;

  if (config.descriptionEs) {
    entry += `
    descriptionEs: "${config.descriptionEs}",`;
  }
  if (config.descriptionEn) {
    entry += `
    descriptionEn: "${config.descriptionEn}",`;
  }

  entry += `
    category: "${config.category}",
    subcategory: "${config.subcategory}",
    techStack: [${techStackStr}],
    liveUrl: "${config.liveUrl}",
    colorAccent: "${config.colorAccent}",
    isActive: ${config.isActive},
    isFeatured: ${config.isFeatured},
  },`;

  return entry;
}

function addToProjectsFile(entry: string): void {
  let content = fs.readFileSync(PROJECTS_FILE, "utf-8");

  // Find the AUTOMATION PLATFORMS section marker
  const marker =
    "// ============================================\n  // AUTOMATION PLATFORMS";
  const insertPosition = content.indexOf(marker);

  if (insertPosition === -1) {
    console.error("Could not find insertion point in projects-data.ts");
    process.exit(1);
  }

  // Insert the new entry before the marker
  content =
    content.slice(0, insertPosition) +
    entry +
    "\n\n  " +
    content.slice(insertPosition);

  fs.writeFileSync(PROJECTS_FILE, content);
}

function formatSlugToName(slug: string): string {
  return slug
    .replace(/^demo-/, "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║              MachineMind Demo Adder                        ║
╚════════════════════════════════════════════════════════════╝

Usage: npx tsx scripts/add-demo.ts <project-folder> <vercel-url>

Example:
  npx tsx scripts/add-demo.ts dharma https://dharma-topaz.vercel.app
  npx tsx scripts/add-demo.ts demo-newclient https://demo-newclient.vercel.app

Options:
  --deploy    Auto-deploy after adding (default: false)
  --commit    Auto-commit changes (default: true)
`);
    process.exit(1);
  }

  const projectFolder = args[0];
  const vercelUrl = args[1];
  const shouldDeploy = args.includes("--deploy");
  const shouldCommit = !args.includes("--no-commit");

  const projectDir = path.join(BUILDS_DIR, projectFolder);

  if (!fs.existsSync(projectDir)) {
    console.error(`Project directory not found: ${projectDir}`);
    process.exit(1);
  }

  console.log(`\n📦 Adding demo: ${projectFolder}`);
  console.log(`🔗 URL: ${vercelUrl}`);

  // Detect tech stack
  const techStack = detectTechStack(projectDir);
  console.log(`🛠️  Tech stack: ${techStack.join(", ")}`);

  // Generate config
  const name = formatSlugToName(projectFolder);
  const subcategory = detectSubcategory(projectDir, projectFolder);

  const config: DemoConfig = {
    slug: projectFolder,
    nameEs: name,
    nameEn: name,
    taglineEs: `Demo de ${subcategory}`,
    taglineEn: `${subcategory.charAt(0).toUpperCase() + subcategory.slice(1)} demo`,
    category: "demo",
    subcategory,
    techStack,
    liveUrl: vercelUrl,
    colorAccent: getRandomColor(),
    isActive: true,
    isFeatured: false,
  };

  // Generate and add entry
  const entry = generateProjectEntry(config);
  addToProjectsFile(entry);
  console.log(`✅ Added to projects-data.ts`);

  // Commit changes
  if (shouldCommit) {
    console.log(`📝 Committing changes...`);
    execSync(
      `cd ${path.dirname(PROJECTS_FILE)} && cd ../.. && git add -A && git commit -m "Add ${name} demo to portfolio"`,
      {
        stdio: "inherit",
      },
    );
    execSync(
      `cd ${path.dirname(PROJECTS_FILE)} && cd ../.. && git push origin main`,
      {
        stdio: "inherit",
      },
    );
    console.log(`✅ Committed and pushed`);
  }

  // Deploy
  if (shouldDeploy) {
    console.log(`🚀 Deploying...`);
    execSync(
      `cd ${path.join(BUILDS_DIR, "machinemind-landing")} && vercel --prod --yes`,
      {
        stdio: "inherit",
      },
    );
    console.log(`✅ Deployed`);
  }

  console.log(`
╔════════════════════════════════════════════════════════════╗
║  ✅ Demo added successfully!                               ║
║                                                            ║
║  Name: ${name.padEnd(49)}║
║  URL:  ${vercelUrl.padEnd(49)}║
║                                                            ║
║  View at: https://machinemindconsulting.com/#portfolio     ║
╚════════════════════════════════════════════════════════════╝
`);
}

main().catch(console.error);
