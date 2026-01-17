import express from "express";
import supabase from "../supabaseAdmin.js";

const router = express.Router();

/**
 * POST /api/claim-daily
 * Body: { plan_id }
 */
router.post("/claim-daily", async (req, res) => {
  try {
    /* ================= AUTH ================= */
    const auth = req.headers.authorization;
    if (!auth) {
      return res.status(401).json({ ok: false, error: "No auth token" });
    }

    const token = auth.replace("Bearer ", "");
    const { data: authData, error: authErr } =
      await supabase.auth.getUser(token);

    if (authErr || !authData?.user) {
      return res.status(401).json({ ok: false, error: "Invalid session" });
    }

    const userId = authData.user.id;
    const { plan_id } = req.body;

    if (!plan_id) {
      return res.status(400).json({ ok: false, error: "plan_id required" });
    }

    /* ================= FETCH PLAN ================= */
    const { data: plan, error: planErr } = await supabase
      .from("user_plans")
      .select("id, daily_income, next_income_at")
      .eq("id", plan_id)
      .eq("user_id", userId)
      .single();

    if (planErr || !plan) {
      return res.status(404).json({ ok: false, error: "Plan not found" });
    }

    const now = new Date();

    if (plan.next_income_at && new Date(plan.next_income_at) > now) {
      return res.status(400).json({
        ok: false,
        error: "Already claimed. Come back later.",
      });
    }

    const amount = Number(plan.daily_income);
    if (!amount || amount <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid income amount" });
    }

    /* ================= LOCK NEXT CLAIM ================= */
    const next = new Date();
    next.setDate(next.getDate() + 1);

    const { error: lockErr } = await supabase
      .from("user_plans")
      .update({ next_income_at: next.toISOString() })
      .eq("id", plan.id)
      .eq("user_id", userId);

    if (lockErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to lock claim",
      });
    }

    /* ================= ADD BALANCE ================= */
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("withdrawable_balance")
      .eq("id", userId)
      .single();

    if (profErr || !profile) {
      return res.status(500).json({
        ok: false,
        error: "Profile not found",
      });
    }

    const newBalance =
      Number(profile.withdrawable_balance || 0) + amount;

    const { error: balErr } = await supabase
      .from("profiles")
      .update({ withdrawable_balance: newBalance })
      .eq("id", userId);

    if (balErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to update balance",
      });
    }

    /* ================= LEDGER ================= */
    await supabase.from("income_ledger").insert({
      user_id: userId,
      amount,
      type: "daily_claim",
      source: "plan",
    });

    return res.json({
      ok: true,
      added: amount,
      new_balance: newBalance,
      next_claim_at: next.toISOString(),
    });
  } catch (e) {
    console.error("CLAIM DAILY ERROR:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
