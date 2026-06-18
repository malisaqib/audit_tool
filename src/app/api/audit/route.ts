import { NextRequest, NextResponse } from "next/server";
import {
  extractProduct,
  normalizeToProductJsonUrl,
} from "@/lib/shopify";
import { scoreProduct } from "@/lib/scoring";
import { generateFixes } from "@/lib/ai";

// Always run this fresh — product data shouldn't be cached.
export const dynamic = "force-dynamic";

const USER_AGENT =
  "StoreReadinessAudit/1.0 (+https://github.com/malisaqib/audit_tool)";

export async function POST(req: NextRequest) {
  let url: string;
  try {
    const body = await req.json();
    url = body?.url;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body. Expected JSON with a 'url' field." },
      { status: 400 }
    );
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: "Please provide a product 'url' in the request body." },
      { status: 400 }
    );
  }

  // 1. Normalize to the .json endpoint (throws a friendly error if invalid).
  let jsonUrl: string;
  try {
    jsonUrl = normalizeToProductJsonUrl(url);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid URL." },
      { status: 400 }
    );
  }

  // 2. Fetch the product JSON.
  let res: Response;
  try {
    res = await fetch(jsonUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      redirect: "follow",
      cache: "no-store",
      // Guard against a hung request.
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? "The store took too long to respond. Please try again."
        : "Could not reach that store. Check the URL and try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!res.ok) {
    const hint =
      res.status === 404
        ? "Product not found (404). Double-check the product URL."
        : `The store returned an error (HTTP ${res.status}).`;
    return NextResponse.json({ error: hint }, { status: 502 });
  }

  // 3. Parse JSON. Password-protected or non-Shopify stores often return HTML.
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "The store didn't return product JSON. It may be password-protected or not a Shopify store.",
      },
      { status: 502 }
    );
  }

  // 4. Extract the structured fields.
  try {
    const product = extractProduct(raw, jsonUrl);
    const score = scoreProduct(product);

    // 5. Generate AI fixes. Keep this non-fatal: if the model call fails,
    //    still return the (deterministic) scores with a fixesError note.
    let fixes = null;
    let fixesError: string | null = null;
    try {
      fixes = await generateFixes(product, score);
    } catch (err) {
      fixesError =
        err instanceof Error ? err.message : "Failed to generate AI fixes.";
    }

    return NextResponse.json({ product, score, fixes, fixesError });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to parse the product data.",
      },
      { status: 422 }
    );
  }
}
