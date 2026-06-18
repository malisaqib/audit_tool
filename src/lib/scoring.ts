// Deterministic, rules-based scoring for an extracted Shopify product.
// No AI here — just heuristics over the structured data from lib/shopify.ts.

import type { ExtractedProduct } from "./shopify";

export interface CategoryScore {
  key: string;
  label: string;
  score: number; // 0–100
  weight: number; // contribution to the overall score
  issues: string[]; // concrete problems found (empty == looks good)
}

export interface AuditScore {
  overall: number; // 0–100, weighted average
  categories: CategoryScore[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Options that are just Shopify's placeholder for single-variant products. */
function realOptions(product: ExtractedProduct) {
  return product.options.filter((o) => {
    const isDefault =
      o.name.toLowerCase() === "title" &&
      o.values.length === 1 &&
      o.values[0].toLowerCase() === "default title";
    return !isDefault;
  });
}

// 1. TITLE QUALITY
function scoreTitle(p: ExtractedProduct): CategoryScore {
  const issues: string[] = [];
  let score = 100;
  const title = p.title ?? "";
  const len = title.length;

  if (len === 0) {
    issues.push("The product has no title.");
    score -= 80;
  } else if (len < 20) {
    issues.push(
      `Title is only ${len} characters — too short to describe the product or rank in search (aim for 40–70).`
    );
    score -= 40;
  } else if (len < 40) {
    issues.push(
      `Title is ${len} characters — a bit short. The 40–70 character range performs best in search.`
    );
    score -= 12;
  } else if (len > 70) {
    issues.push(
      `Title is ${len} characters — likely to be truncated in search and listings (aim for 40–70).`
    );
    score -= 20;
  }

  const letters = title.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 4) {
    if (title === title.toLowerCase()) {
      issues.push("Title is all lowercase — looks unpolished and hurts trust.");
      score -= 20;
    } else if (title === title.toUpperCase()) {
      issues.push(
        "Title is ALL CAPS — reads as shouting and can look like spam."
      );
      score -= 20;
    }
  }

  const vendor = (p.vendor ?? "").trim();
  if (vendor && !title.toLowerCase().includes(vendor.toLowerCase())) {
    issues.push(
      `Brand/vendor name ("${vendor}") doesn't appear in the title — adding it helps brand recognition and search.`
    );
    score -= 15;
  }

  return { key: "title", label: "Title Quality", score: clamp(score), weight: 0.15, issues };
}

// 2. DESCRIPTION QUALITY
function scoreDescription(p: ExtractedProduct): CategoryScore {
  const issues: string[] = [];
  let score = 100;
  const desc = p.description ?? "";
  const words = countWords(desc);

  if (words === 0) {
    issues.push("The product has no description.");
    score -= 80;
  } else if (words < 50) {
    issues.push(
      `Description is only ${words} words — too thin to answer buyer questions (aim for 100+).`
    );
    score -= 40;
  } else if (words < 100) {
    issues.push(
      `Description is ${words} words — acceptable, but more detail (100+ words) converts better.`
    );
    score -= 15;
  }

  if (words > 0 && !desc.includes("\n")) {
    issues.push(
      "Description is one unbroken block of text — break it into short paragraphs or bullets for scannability."
    );
    score -= 15;
  }

  // Very rough benefit-language heuristic.
  const benefitTerms =
    /\b(you|your|feel|enjoy|designed|perfect|comfort|comfortable|easy|effortless|save|benefit|love|experience|helps?|so you can|made for|crafted|premium|durable|soft|lightweight)\b/i;
  if (words >= 20 && !benefitTerms.test(desc)) {
    issues.push(
      "Description reads as feature/spec-only — add benefit-oriented language that speaks to the buyer (\"you\", \"so you can…\")."
    );
    score -= 15;
  }

  return {
    key: "description",
    label: "Description Quality",
    score: clamp(score),
    weight: 0.25,
    issues,
  };
}

// 3. MEDIA / IMAGES
function scoreMedia(p: ExtractedProduct): CategoryScore {
  const issues: string[] = [];
  let score = 100;
  const n = p.images.count;

  if (n === 0) {
    issues.push("No product images — shoppers won't buy what they can't see.");
    score -= 75;
  } else if (n === 1) {
    issues.push(
      "Only 1 image — a major conversion blocker. Add multiple angles, in-use, and detail shots."
    );
    score -= 50;
  } else if (n === 2) {
    issues.push(
      "Only 2 images — below the recommended minimum of 3. Add more angles and context."
    );
    score -= 25;
  } else if (n === 3) {
    issues.push("3 images is the bare minimum — 4+ (incl. lifestyle shots) converts better.");
    score -= 8;
  }
  // 4+ images: no penalty (rewarded by staying at 100).

  return { key: "media", label: "Media / Images", score: clamp(score), weight: 0.15, issues };
}

// 4. VARIANTS & SPECS
function scoreVariants(p: ExtractedProduct): CategoryScore {
  const issues: string[] = [];
  let score = 100;

  if (!p.productType || !p.productType.trim()) {
    issues.push(
      "Product type is missing — hurts categorization, filtering, and SEO."
    );
    score -= 25;
  }

  if (!p.tags || p.tags.length === 0) {
    issues.push(
      "No tags — poor discoverability in search, collections, and related products."
    );
    score -= 30;
  }

  if (p.variants.priceRange === null) {
    issues.push("No variant pricing found — buyers can't see what it costs.");
    score -= 20;
  }

  const opts = realOptions(p);
  if (opts.length > 0 && p.variants.count <= 1) {
    issues.push(
      `Options are defined (${opts
        .map((o) => o.name)
        .join(", ")}) but only ${p.variants.count} variant exists — variant setup looks incomplete.`
    );
    score -= 15;
  }

  return {
    key: "variants",
    label: "Variants & Specs",
    score: clamp(score),
    weight: 0.15,
    issues,
  };
}

// 5. TRUST SIGNALS (highest weight)
function scoreTrust(p: ExtractedProduct): CategoryScore {
  const issues: string[] = [];
  let score = 100;
  const text = `${p.description ?? ""} ${p.tags.join(" ")}`.toLowerCase();

  const signals: { test: RegExp; missing: string }[] = [
    {
      test: /\b(returns?|refunds?|money[- ]back)\b/,
      missing:
        "No return/refund language — reassure buyers they can send it back.",
    },
    {
      test: /\b(warrant(y|ies)|guarantee[d]?)\b/,
      missing:
        "No warranty/guarantee language — a guarantee lowers perceived risk.",
    },
    {
      test: /\b(shipping|free ship\w*|delivery|ships?\b|dispatch)\b/,
      missing:
        "No shipping/delivery info — buyers want to know cost and speed before buying.",
    },
    {
      test: /\b(authentic\w*|genuine|original|certified|official)\b/,
      missing:
        "No authenticity language — \"genuine\"/\"certified\" wording builds confidence.",
    },
  ];

  for (const s of signals) {
    if (!s.test.test(text)) {
      issues.push(s.missing);
      score -= 25;
    }
  }

  return { key: "trust", label: "Trust Signals", score: clamp(score), weight: 0.3, issues };
}

/** Run all five categories and compute the weighted overall score. */
export function scoreProduct(product: ExtractedProduct): AuditScore {
  const categories = [
    scoreTitle(product),
    scoreDescription(product),
    scoreMedia(product),
    scoreVariants(product),
    scoreTrust(product),
  ];

  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
  const overall = clamp(
    categories.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight
  );

  return { overall, categories };
}
