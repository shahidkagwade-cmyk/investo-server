import express from "express";
import supabase from "../supabaseAdmin.js";

console.log("🔥 adminDepositRoutes.js LOADED (FINAL VERSION)");

const router = express.Router();

/**
 * POST /admin/deposits/confirm-deposit
 * BODY: { deposit_id }
 */
router.post("/confirm-deposit", async (req, res) => {
  console.log("🔥 CONFIRM DEPOSIT HIT", req.body);

  try {
    const { deposit_id } = req.body;

    if (!deposit_id) {
      return res.status(400).json({
        ok: false,
        error: "deposit_id required",
      });
    }

    /* 1️⃣ FETCH DEPOSIT */
    const { data: deposit, error: dErr } = await supabase
      .from("deposits")
      .select("*")
      .eq("id", deposit_id)
      .single();

    if (dErr || !deposit) {
      console.error("❌ DEPOSIT FETCH ERROR:", dErr);
      return res.status(404).json({
        ok: false,
        error: "Deposit not found",
      });
    }

    if (deposit.status !== "pending") {
      return res.status(400).json({
        ok: false,
        error: "Deposit already processed",
      });
    }

    /* 2️⃣ CONFIRM DEPOSIT (STATUS ONLY) */
    const { error: updErr } = await supabase
      .from("deposits")
      .update({ status: "confirmed" })
      .eq("id", deposit.id);

    if (updErr) {
      console.error("❌ DEPOSIT UPDATE FAILED:", updErr);
      return res.status(500).json({
        ok: false,
        error: "Deposit update failed",
      });
    }

    /* 3️⃣ CREATE USER PLAN (IF PLAN EXISTS) */
    if (deposit.plan_id) {
      const { data: plan, error: planErr } = await supabase
        .from("investment_plans")
        .select("daily_income")
        .eq("id", deposit.plan_id)
        .single();

      if (planErr || !plan) {
        console.error("❌ PLAN FETCH ERROR:", planErr);
        return res.status(400).json({
          ok: false,
          error: "Invalid investment plan",
        });
      }

      const { error: upErr } = await supabase
        .from("user_plans")
        .insert({
          user_id: deposit.user_id,
          plan_id: deposit.plan_id,
          deposit_id: deposit.id,  
          amount: deposit.amount,
          daily_income: plan.daily_income,
          status: "active",
          next_income_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });

      if (upErr) {
        console.error("❌ USER PLAN INSERT FAILED:", upErr);
        return res.status(500).json({
          ok: false,
          error: "User plan creation failed",
        });
      }
    }

    /* 4️⃣ SUCCESS */
    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ CONFIRM DEPOSIT ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
});

export default router;
