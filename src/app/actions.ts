"use server";

import { getSupabaseAdmin } from "@/lib/supabase";

export interface LeadInput {
  email: string;
  auditedUrl: string;
  overallScore: number | null;
}

export type LeadResult = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitLead(input: LeadInput): Promise<LeadResult> {
  const email = (input?.email ?? "").trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("leads").insert({
      email,
      audited_url: input.auditedUrl ?? null,
      overall_score:
        typeof input.overallScore === "number" ? input.overallScore : null,
    });

    if (error) {
      console.error("Supabase insert error:", error.message);
      return {
        ok: false,
        error: "We couldn't save your request. Please try again.",
      };
    }

    return { ok: true };
  } catch (err) {
    console.error("submitLead failed:", err);
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
    };
  }
}
