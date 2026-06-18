// AI rewrite layer (Groq + Llama 3.3 70B). Server-side only — reads
// GROQ_API_KEY from the environment and never ships it to the client.

import Groq from "groq-sdk";
import type { ExtractedProduct } from "./shopify";
import type { AuditScore } from "./scoring";

const MODEL = "llama-3.3-70b-versatile";

export interface SuggestedFaq {
  question: string;
  answer: string;
  needs_seller_input: boolean;
}

export interface TrustSnippet {
  label: string; // e.g. "Returns", "Shipping", "Authenticity"
  text: string;
}

export interface ProductFixes {
  improved_title: string;
  description_bullets: string[];
  suggested_faqs: SuggestedFaq[];
  trust_snippets: TrustSnippet[];
}

const SYSTEM_PROMPT = `You are a Shopify conversion copywriter. You rewrite product listings to convert better.

CRITICAL GROUNDING RULES — follow exactly:
- Base every rewrite ONLY on the product data provided by the user.
- NEVER invent specs, materials, dimensions, ingredients, features, or claims that are not present in the original data.
- If important information is missing, do NOT fabricate it. Instead, explicitly tell the seller to add it (e.g. "[Add material here]" or note it needs seller input).
- Keep the brand/vendor and product identity faithful to the source.

OUTPUT RULES:
- Respond with ONE valid JSON object and nothing else. No markdown, no code fences, no preamble, no commentary.
- The JSON must match this exact shape:
{
  "improved_title": string,                 // 40-70 characters, includes the brand/vendor, grounded in the real product
  "description_bullets": string[],          // 4-6 benefit-oriented bullets rewritten from the existing description; no invented features
  "suggested_faqs": [                        // 3-4 items
    { "question": string, "answer": string, "needs_seller_input": boolean }
  ],
  "trust_snippets": [                        // ready-to-paste copy for returns, shipping, authenticity
    { "label": string, "text": string }
  ]
}

For suggested_faqs: set "needs_seller_input" to true whenever the answer depends on information not present in the product data (sizing, shipping times, warranty terms, etc.), and write the answer as guidance/placeholder rather than a fabricated fact.
For trust_snippets: where store-specific details are unknown, write clearly generic, editable copy with bracketed placeholders like [30 days] or [your store name].`;

function buildUserPrompt(product: ExtractedProduct, score: AuditScore): string {
  const issues = score.categories
    .filter((c) => c.issues.length > 0)
    .map((c) => `- ${c.label} (score ${c.score}): ${c.issues.join(" ")}`)
    .join("\n");

  const productData = {
    title: product.title,
    description: product.description,
    vendor: product.vendor,
    product_type: product.productType,
    tags: product.tags,
    options: product.options,
    variant_count: product.variants.count,
    price_range: product.variants.priceRange,
    image_count: product.images.count,
  };

  return `Here is the ACTUAL product data (your only source of truth):

${JSON.stringify(productData, null, 2)}

Issues our audit found (use these to prioritize your fixes):
${issues || "- None flagged, but still improve clarity and conversion."}

Generate the fixes as the JSON object described in the system prompt. Remember: do not invent anything not present above.`;
}

/** Remove ```json ... ``` fences or stray prose around a JSON object. */
function extractJson(raw: string): string {
  let s = raw.trim();
  // Strip code fences if present.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // Fall back to the outermost { ... } if there's surrounding text.
  if (!s.startsWith("{")) {
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      s = s.slice(first, last + 1);
    }
  }
  return s;
}

/** Coerce the parsed object into a safe, well-typed ProductFixes. */
function normalizeFixes(parsed: unknown): ProductFixes {
  const obj = (parsed ?? {}) as Record<string, unknown>;

  const improved_title =
    typeof obj.improved_title === "string" ? obj.improved_title.trim() : "";

  const description_bullets = Array.isArray(obj.description_bullets)
    ? obj.description_bullets.map((b) => String(b).trim()).filter(Boolean)
    : [];

  const suggested_faqs = Array.isArray(obj.suggested_faqs)
    ? obj.suggested_faqs.map((f) => {
        const item = (f ?? {}) as Record<string, unknown>;
        return {
          question: String(item.question ?? "").trim(),
          answer: String(item.answer ?? "").trim(),
          needs_seller_input: Boolean(item.needs_seller_input),
        };
      }).filter((f) => f.question)
    : [];

  const trust_snippets = Array.isArray(obj.trust_snippets)
    ? obj.trust_snippets.map((t) => {
        const item = (t ?? {}) as Record<string, unknown>;
        return {
          label: String(item.label ?? "").trim(),
          text: String(item.text ?? "").trim(),
        };
      }).filter((t) => t.text)
    : [];

  return { improved_title, description_bullets, suggested_faqs, trust_snippets };
}

/**
 * Generate concrete, grounded fixes for a product using Groq.
 * Throws an Error with a friendly message if the key is missing or the
 * model output can't be parsed.
 */
export async function generateFixes(
  product: ExtractedProduct,
  score: AuditScore
): Promise<ProductFixes> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI rewrites are not configured. Add GROQ_API_KEY to .env.local and restart the dev server."
    );
  }

  const groq = new Groq({ apiKey });

  const completion = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(product, score) },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  if (!content.trim()) {
    throw new Error("The AI returned an empty response. Please try again.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(content));
  } catch {
    throw new Error("The AI returned data we couldn't parse. Please try again.");
  }

  return normalizeFixes(parsed);
}
