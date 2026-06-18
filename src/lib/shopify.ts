// Types and helpers for extracting structured data from a Shopify product .json endpoint.

export interface ExtractedProduct {
  title: string;
  description: string; // body_html stripped to plain text
  vendor: string;
  productType: string;
  tags: string[];
  variants: {
    count: number;
    priceRange: { min: number; max: number } | null;
  };
  images: {
    count: number;
  };
  options: { name: string; values: string[] }[];
  sourceUrl: string; // the .json URL we fetched
}

/**
 * Normalize a user-supplied product URL into its Shopify `.json` endpoint.
 * Throws an Error with a user-friendly message if the URL is not a valid
 * Shopify product URL.
 */
export function normalizeToProductJsonUrl(input: string): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    throw new Error("Please enter a product URL.");
  }

  // Allow users to paste a URL without a protocol.
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }

  // Strip trailing slashes from the path.
  let pathname = url.pathname.replace(/\/+$/, "");

  // Must point at a specific product, e.g. /products/some-handle
  // (optionally nested under a collection: /collections/x/products/some-handle)
  if (!/\/products\/[^/]+/.test(pathname)) {
    throw new Error(
      "This isn't a Shopify product URL. It should contain /products/<product-name>."
    );
  }

  if (!pathname.endsWith(".json")) {
    pathname += ".json";
  }

  // Drop query string and hash — keep only origin + clean path.
  return `${url.origin}${pathname}`;
}

/** Strip HTML tags and decode a handful of common entities to plain text. */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n")
    .replace(/<\/\s*li\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "") // remove all remaining tags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface ShopifyVariant {
  price?: string | number | null;
}

interface ShopifyImage {
  src?: string;
}

interface ShopifyOption {
  name?: string;
  values?: string[];
}

interface ShopifyProduct {
  title?: string;
  body_html?: string | null;
  vendor?: string;
  product_type?: string;
  tags?: string | string[];
  variants?: ShopifyVariant[];
  images?: ShopifyImage[];
  options?: ShopifyOption[];
}

/** Map the raw Shopify product payload into our clean structured object. */
export function extractProduct(
  raw: unknown,
  sourceUrl: string
): ExtractedProduct {
  const product = (raw as { product?: ShopifyProduct })?.product;
  if (!product || typeof product !== "object") {
    throw new Error(
      "The response didn't contain Shopify product data. The store may be password-protected or not a Shopify store."
    );
  }

  // Tags can be a comma-separated string or an array depending on the API.
  let tags: string[] = [];
  if (Array.isArray(product.tags)) {
    tags = product.tags.map((t) => String(t).trim()).filter(Boolean);
  } else if (typeof product.tags === "string") {
    tags = product.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const prices = variants
    .map((v) => Number(v.price))
    .filter((n) => Number.isFinite(n));
  const priceRange =
    prices.length > 0
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : null;

  const images = Array.isArray(product.images) ? product.images : [];

  const options = (Array.isArray(product.options) ? product.options : [])
    .map((o) => ({
      name: String(o?.name ?? "").trim(),
      values: Array.isArray(o?.values)
        ? o.values.map((v) => String(v).trim()).filter(Boolean)
        : [],
    }))
    .filter((o) => o.name);

  return {
    title: product.title ?? "",
    description: htmlToPlainText(product.body_html),
    vendor: product.vendor ?? "",
    productType: product.product_type ?? "",
    tags,
    variants: {
      count: variants.length,
      priceRange,
    },
    images: {
      count: images.length,
    },
    options,
    sourceUrl,
  };
}
