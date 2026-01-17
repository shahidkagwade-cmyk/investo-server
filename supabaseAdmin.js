import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

/* ================= ENV CHECK ================= */
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("❌ Missing Supabase env vars");
}

/* ================= SUPABASE ADMIN CLIENT ================= */
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* =========================================================
   REFERRAL CODE GENERATOR
   Example: yofen6032 + 4831 → YOFEN60324831
========================================================= */
export function generateReferralCode(email) {
  const base = email
    .split("@")[0]
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10);

  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${base}${rand}`.toUpperCase();
}

/* =========================================================
   ENSURE REFERRAL CODE EXISTS FOR USER
   - If already exists → return
   - Else → generate + update profiles table
========================================================= */
export async function ensureReferralCode(userId, email) {
  if (!userId || !email) return null;

  // 1️⃣ Check existing referral code
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("referral_code")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("❌ Fetch profile error:", error.message);
    return null;
  }

  if (profile?.referral_code) {
    return profile.referral_code;
  }

  // 2️⃣ Generate new referral code
  const referralCode = generateReferralCode(email);

  // 3️⃣ Update profile
  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ referral_code: referralCode })
    .eq("user_id", userId);

  if (updateError) {
    console.error("❌ Update referral code error:", updateError.message);
    return null;
  }

  console.log("✅ Referral code generated:", referralCode);
  return referralCode;
}

/* ================= EXPORT DEFAULT ================= */
export default supabaseAdmin;
