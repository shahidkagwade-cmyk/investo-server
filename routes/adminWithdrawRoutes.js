import express from "express";

const router = express.Router();

/**
 * GET pending / approved / rejected withdrawals
 * /withdraw/admin/withdrawals?status=pending
 */
router.get("/withdrawals", async (req, res) => {
  try {
    const supabase = req.supabaseAdmin;
    const status = req.query.status;

    let query = supabase
      .from("withdrawals")
      .select(`
        id,
        amount,
        currency,
        network,
        wallet_address,
        status,
        created_at,
        profiles ( email )
      `)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const withdrawals = data.map(w => ({
      id: w.id,
      amount: w.amount,
      currency: w.currency,
      network: w.network,
      wallet_address: w.wallet_address,
      status: w.status,
      created_at: w.created_at,
      email: w.profiles?.email ?? null,
    }));

    res.json({ withdrawals });
  } catch (err) {
    console.error("ADMIN LIST ERROR:", err);
    res.status(500).json({ error: "Failed to fetch withdrawals" });
  }
});

/**
 * APPROVE withdrawal
 */
router.post("/withdrawals/approve", async (req, res) => {
  try {
    const { withdrawal_id } = req.body;
    const supabase = req.supabaseAdmin;

    await supabase
      .from("withdrawals")
      .update({ status: "approved" })
      .eq("id", withdrawal_id);

    res.json({ ok: true });
  } catch (err) {
    console.error("APPROVE ERROR:", err);
    res.status(500).json({ error: "Approve failed" });
  }
});

/**
 * ❗ REJECT withdrawal (WITH REFUND)
 */
// adminWithdrawRoutes.js
router.post("/withdrawals/reject", async (req, res) => {
  try {
    console.log("REJECT HIT BODY:", req.body);

    const { withdrawal_id } = req.body; // ✅ FIXED
    const supabase = req.supabaseAdmin;

    if (!withdrawal_id) {
      return res.status(400).json({ error: "withdrawal_id missing" });
    }

    const { data: withdrawal } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("id", withdrawal_id)
      .single();

    console.log("WITHDRAWAL:", withdrawal);

    if (!withdrawal || withdrawal.status !== "pending") {
      return res.status(400).json({ error: "Invalid withdrawal" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("withdrawable_balance")
      .eq("id", withdrawal.user_id)
      .single();

    console.log("PROFILE BEFORE:", profile.withdrawable_balance);

    const newBalance =
      Number(profile.withdrawable_balance) + Number(withdrawal.amount);

    await supabase
      .from("withdrawals")
      .update({ status: "rejected" })
      .eq("id", withdrawal_id);

    await supabase
      .from("profiles")
      .update({ withdrawable_balance: newBalance })
      .eq("id", withdrawal.user_id);

    console.log("PROFILE AFTER:", newBalance);

    res.json({ success: true, new_balance: newBalance });
  } catch (err) {
    console.error("REJECT ERROR:", err);
    res.status(500).json({ error: "Reject failed" });
  }
});



export default router;
