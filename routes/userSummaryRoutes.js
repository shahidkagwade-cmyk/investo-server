import express from "express";
import supabase from "../supabaseAdmin.js";

const router = express.Router();

/**
 * GET /api/user-summary
 * Header: Authorization: Bearer <token>
 */
router.get("/user-summary", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) {
      return res.status(401).json({ ok: false, error: "No auth header" });
    }

    const token = auth.replace("Bearer ", "");
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token);

    if (authErr || !user) {
      return res.status(401).json({ ok: false, error: "Invalid token" });
    }

    /* ================= PROFILE ================= */
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, referral_code")
      .eq("id", user.id)
      .single();

    if (pErr || !profile) {
      return res.status(404).json({ ok: false, error: "Profile not found" });
    }

    /* ================= REFERRAL COUNT ================= */
    const { count: referralCount, error: rErr } = await supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_user_id", user.id);

    if (rErr) throw rErr;

    /* ================= BONUSES (LOCKED SYSTEM) ================= */
    const { data: bonuses, error: bErr } = await supabase
      .from("user_bonuses")
      .select("bonus_type, amount")
      .eq("user_id", user.id);

    if (bErr) throw bErr;

    let referralBonus = 0;
    let signupBonus = 0;

    for (const b of bonuses || []) {
      if (b.bonus_type === "referral") {
        referralBonus += Number(b.amount || 0);
      }
      if (b.bonus_type === "signup") {
        signupBonus += Number(b.amount || 0);
      }
    }

    return res.json({
      ok: true,
      referral_code: profile.referral_code,
      referral_count: referralCount || 0,
      referral_bonus: referralBonus,
      signup_bonus: signupBonus,
      total_bonus: referralBonus + signupBonus,
    });
  } catch (e) {
    console.error("USER SUMMARY ERROR:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* ================= OPTIONAL APIs (KEEP SAFE) ================= */

// GET /api/referral-count?user_id=UUID
router.get("/referral-count", async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ ok: false, error: "user_id required" });
    }

    const { count, error } = await supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_user_id", user_id);

    if (error) throw error;

    res.json({ ok: true, total_referrals: count || 0 });
  } catch (e) {
    console.error("REFERRAL COUNT ERROR:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// GET /api/referral-list?user_id=UUID
router.get("/referral-list", async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ ok: false, error: "user_id required" });
    }

    const { data, error } = await supabase
      .from("referrals")
      .select("referred_user_id, created_at")
      .eq("referrer_user_id", user_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ ok: true, data });
  } catch (e) {
    console.error("REFERRAL LIST ERROR:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
