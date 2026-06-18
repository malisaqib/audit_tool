"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 via-background to-background">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-16 sm:py-24">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
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
                type="button"
                className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 active:bg-brand-800"
              >
                Audit my listing
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              We analyze your title, description, images, and trust signals to
              score conversion readiness.
            </p>
          </div>
        </section>

        {/* Results area (placeholder) */}
        <section className="mt-10 w-full">
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
        </section>

        <footer className="mt-16 text-center text-xs text-slate-400">
          Store Readiness Audit — turn browsers into buyers.
        </footer>
      </div>
    </main>
  );
}
