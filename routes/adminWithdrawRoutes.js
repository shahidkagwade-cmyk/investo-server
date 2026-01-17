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
router.post("/withdrawals/reject", async (req, res) => {
  try {
    const { withdrawal_id } = req.body;
    const supabase = req.supabaseAdmin;

    // 1️⃣ Fetch withdrawal
    const { data: withdrawal, error } = await supabase
      .from("withdrawals")
      .select("id, user_id, amount, status")
      .eq("id", withdrawal_id)
      .single();

    if (error || !withdrawal)
      return res.status(404).json({ error: "Withdrawal not found" });

    if (withdrawal.status !== "pending")
      return res.status(400).json({ error: "Already processed" });

    // 2️⃣ REFUND using SQL increment (SAFE)
    const { error: refundError } = await supabase.rpc(
      "increment_withdrawable_balance",
      {
        uid: withdrawal.user_id,
        amt: withdrawal.amount,
      }
    );

    if (refundError) {
      console.error("REFUND FAILED:", refundError);
      return res.status(500).json({ error: "Refund failed" });
    }

    // 3️⃣ Mark rejected
    await supabase
      .from("withdrawals")
      .update({ status: "rejected" })
      .eq("id", withdrawal_id);

    res.json({ ok: true });
  } catch (err) {
    console.error("REJECT ERROR:", err);
    res.status(500).json({ error: "Reject failed" });
  }
});


export default router;
