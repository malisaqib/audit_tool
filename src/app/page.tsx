"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ExtractedProduct } from "@/lib/shopify";
import type { AuditScore, CategoryScore } from "@/lib/scoring";
import type { ProductFixes } from "@/lib/ai";
import { submitLead } from "./actions";

interface AuditResponse {
  product: ExtractedProduct;
  score: AuditScore;
  fixes: ProductFixes | null;
  fixesError: string | null;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// Map a 0–100 score to a color band.
function band(score: number) {
  if (score >= 80)
    return {
      label: "Good",
      text: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      bar: "bg-emerald-500",
      ring: "text-emerald-500",
    };
  if (score >= 50)
    return {
      label: "Needs work",
      text: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200",
      bar: "bg-amber-500",
      ring: "text-amber-500",
    };
  return {
    label: "Poor",
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    bar: "bg-red-500",
    ring: "text-red-500",
  };
}

function ScoreRing({ score }: { score: number }) {
  const b = band(score);
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} className="stroke-slate-200" strokeWidth="10" fill="none" />
        <circle
          cx="60"
          cy="60"
          r={r}
          className={`${b.ring} transition-all duration-700`}
          strokeWidth="10"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold ${b.text}`}>{score}</span>
        <span className="text-xs font-medium text-slate-400">/ 100</span>
      </div>
    </div>
  );
}

function CategoryCard({ cat }: { cat: CategoryScore }) {
  const b = band(cat.score);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{cat.label}</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${b.bg} ${b.text}`}>
          {cat.score}
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${b.bar}`} style={{ width: `${cat.score}%` }} />
      </div>
      {cat.issues.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {cat.issues.map((issue, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-600">
              <span className="mt-0.5 shrink-0 text-amber-500">▲</span>
              <span>{issue}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-600">
          <span>✓</span> No issues found.
        </p>
      )}
    </div>
  );
}

function LeadCTA({
  auditedUrl,
  overallScore,
}: {
  auditedUrl: string;
  overallScore: number | null;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setError(null);

    const res = await submitLead({ email, auditedUrl, overallScore });
    if (res.ok) {
      setStatus("success");
    } else {
      setError(res.error);
      setStatus("idle");
    }
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-8 text-white shadow-lg">
      {status === "success" ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl">
            ✓
          </div>
          <h2 className="text-2xl font-bold">Thanks — I&apos;ll be in touch.</h2>
          <p className="max-w-md text-brand-100">
            I&apos;ll review your listing and reply within 24 hours with your
            full audit &amp; quote.
          </p>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-bold">
            Want these fixes implemented on your store?
          </h2>
          <p className="mt-2 max-w-xl text-brand-100">
            I can rewrite and deploy these improvements across your top
            listings.
          </p>
          <form
            onSubmit={handleSubmit}
            className="mt-5 flex flex-col gap-3 sm:flex-row"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourstore.com"
              className="w-full flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-brand-200 outline-none transition focus:border-white/60 focus:bg-white/20 focus:ring-2 focus:ring-white/30"
            />
            <button
              type="submit"
              disabled={status === "submitting" || !email.trim()}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-white px-6 py-3 font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-white/60 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {status === "submitting" ? "Sending…" : "Get my full audit & quote"}
            </button>
          </form>
          {error && (
            <p className="mt-3 text-sm font-medium text-amber-200">{error}</p>
          )}
        </>
      )}
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AuditResponse | null>(null);

  // Render the interactive UI only after mount. This keeps the server HTML and
  // the first client render identical (an empty shell), so browser extensions
  // that mutate the DOM (e.g. antivirus injecting attributes on <div>s) can't
  // cause a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleAudit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json?.error ?? "Something went wrong. Please try again.");
      } else {
        setData(json as AuditResponse);
      }
    } catch {
      setError("Network error — could not reach the audit service.");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    // Minimal shell (no inner <div>s) so SSR and first client render match.
    return (
      <main className="min-h-screen bg-gradient-to-b from-brand-50 via-background to-background" />
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 via-background to-background">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-16 sm:py-24">
        {/* Header */}
        <header className="flex flex-col items-center text-center">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-4 py-1.5 text-sm font-medium text-brand-700 shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-brand-500" />
            Shopify listing audit
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Store Readiness Audit
          </h1>
          <p className="mt-4 max-w-xl text-balance text-lg text-slate-600">
            Find out why your Shopify listing isn&apos;t converting — and get
            the fixes.
          </p>
        </header>

        {/* Input card */}
        <section className="mt-12 w-full">
          <form
            onSubmit={handleAudit}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8"
          >
            <label
              htmlFor="product-url"
              className="block text-sm font-medium text-slate-700"
            >
              Shopify product URL
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input
                id="product-url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourstore.com/products/your-product"
                className="w-full flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-200"
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 active:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && (
                  <svg
                    className="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
                    />
                  </svg>
                )}
                {loading ? "Auditing…" : "Audit my listing"}
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              We analyze your title, description, images, and trust signals to
              score conversion readiness.
            </p>
          </form>
        </section>

        {/* Results area */}
        <section className="mt-10 w-full">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-center">
              <p className="font-medium text-red-700">{error}</p>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Overall score hero */}
              <div
                className={`flex flex-col items-center gap-6 rounded-2xl border bg-white p-6 shadow-sm sm:flex-row sm:p-8 ${
                  band(data.score.overall).border
                }`}
              >
                <ScoreRing score={data.score.overall} />
                <div className="text-center sm:text-left">
                  <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
                    Overall readiness
                  </p>
                  <p
                    className={`mt-1 text-2xl font-bold ${
                      band(data.score.overall).text
                    }`}
                  >
                    {band(data.score.overall).label}
                  </p>
                  <p className="mt-2 max-w-md text-sm text-slate-600">
                    {data.product.title || "Untitled product"}
                  </p>
                  <a
                    href={data.product.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block break-all text-xs text-brand-600 hover:underline"
                  >
                    {data.product.sourceUrl}
                  </a>
                </div>
              </div>

              {/* Per-category cards */}
              <div className="grid gap-4 sm:grid-cols-2">
                {data.score.categories.map((cat) => (
                  <CategoryCard key={cat.key} cat={cat} />
                ))}
              </div>

              {/* Recommended AI fixes */}
              {data.fixesError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5">
                  <p className="font-medium text-amber-800">
                    Scores are ready, but AI fixes couldn&apos;t be generated.
                  </p>
                  <p className="mt-1 text-sm text-amber-700">{data.fixesError}</p>
                </div>
              ) : data.fixes ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">
                      Recommended Fixes
                    </h2>
                    <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                      AI-generated
                    </span>
                  </div>

                  {/* Improved title */}
                  {data.fixes.improved_title && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                          Improved title
                        </h3>
                        <CopyButton text={data.fixes.improved_title} />
                      </div>
                      <p className="mt-2 text-lg font-medium text-slate-800">
                        {data.fixes.improved_title}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {data.fixes.improved_title.length} characters
                      </p>
                    </div>
                  )}

                  {/* Description bullets */}
                  {data.fixes.description_bullets.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                          Description bullets
                        </h3>
                        <CopyButton
                          text={data.fixes.description_bullets
                            .map((b) => `• ${b}`)
                            .join("\n")}
                        />
                      </div>
                      <ul className="mt-3 space-y-2">
                        {data.fixes.description_bullets.map((b, i) => (
                          <li key={i} className="flex gap-2 text-sm text-slate-700">
                            <span className="mt-1 shrink-0 text-brand-500">•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Suggested FAQs */}
                  {data.fixes.suggested_faqs.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                        Suggested FAQs
                      </h3>
                      <div className="mt-3 space-y-4">
                        {data.fixes.suggested_faqs.map((f, i) => (
                          <div key={i}>
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-medium text-slate-800">
                                {f.question}
                              </p>
                              <CopyButton text={`${f.question}\n${f.answer}`} />
                            </div>
                            <p className="mt-1 text-sm text-slate-600">{f.answer}</p>
                            {f.needs_seller_input && (
                              <span className="mt-1 inline-block rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                Needs seller input
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trust snippets */}
                  {data.fixes.trust_snippets.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                        Trust snippets
                      </h3>
                      <div className="mt-3 space-y-3">
                        {data.fixes.trust_snippets.map((t, i) => (
                          <div
                            key={i}
                            className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                                {t.label}
                              </p>
                              <CopyButton text={t.text} />
                            </div>
                            <p className="mt-1 text-sm text-slate-700">{t.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Lead-capture CTA */}
              <LeadCTA
                auditedUrl={data.product.sourceUrl}
                overallScore={data.score.overall}
              />

              {/* Raw extracted data (collapsible, for verification) */}
              <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-slate-600">
                  View raw extracted data
                </summary>
                <pre className="overflow-x-auto border-t border-slate-100 px-5 py-4 text-left font-mono text-xs leading-relaxed text-slate-800">
                  {JSON.stringify(data.product, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/50 px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                  stroke="currentColor"
                  className="h-6 w-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                  />
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-800">
                Your audit results will appear here
              </h2>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Paste a product URL above and run an audit to see your quality
                score and AI-generated fixes.
              </p>
            </div>
          )}
        </section>

        <footer className="mt-16 text-center text-xs text-slate-400">
          Store Readiness Audit — turn browsers into buyers.
        </footer>
      </div>
    </main>
  );
}
