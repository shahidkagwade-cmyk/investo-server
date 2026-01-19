import express from "express";
import supabase from "../supabaseAdmin.js";

const router = express.Router();

console.log("🔥 CLAIM DAILY ROUTE (OLD SYSTEM RESTORED) 🔥");

router.post("/claim-daily", async (req, res) => {
  try {
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

    /* ===== FETCH PLAN ===== */
    const { data: plan, error: planErr } = await supabase
      .from("user_plans")
      .select("id, daily_income, next_income_at")
      .eq("id", plan_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (planErr || !plan) {
      return res.status(404).json({ ok: false, error: "Plan not found" });
    }

    const now = new Date();

    /* ===== BLOCK ONLY IF TIMER EXISTS ===== */
    if (plan.next_income_at && new Date(plan.next_income_at) > now) {
      return res.status(400).json({
        ok: false,
        error: "Daily claim not allowed yet",
        next_claim_at: plan.next_income_at,
      });
    }

    const amount = Number(plan.daily_income);
    if (!amount || amount <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid income amount" });
    }

    /* ===== SET NEXT CLAIM (AFTER FIRST CLAIM) ===== */
    const next = new Date();
    next.setHours(next.getHours() + 24);

    await supabase
      .from("user_plans")
      .update({ next_income_at: next.toISOString() })
      .eq("id", plan.id);

    /* ===== ADD BALANCE ===== */
    const { data: profile } = await supabase
      .from("profiles")
      .select("withdrawable_balance")
      .eq("id", userId)
      .single();

    const newBalance =
      Number(profile?.withdrawable_balance || 0) + amount;

    await supabase
      .from("profiles")
      .update({ withdrawable_balance: newBalance })
      .eq("id", userId);

    /* ===== LEDGER ===== */
    await supabase.from("income_ledger").insert({
      user_id: userId,
      amount,
      type: "daily_claim",
      source: "plan",
      created_at: new Date().toISOString(),
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
