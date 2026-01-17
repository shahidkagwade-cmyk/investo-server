import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

/* =========================
   USER WITHDRAW (POST)
========================= */
router.post("/", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: "No token" });

    const token = auth.replace("Bearer ", "");
    const payload = jwt.decode(token);
    const userId = payload?.sub;

    if (!userId) return res.status(401).json({ error: "Invalid token" });

    const { amount, network, wallet_address } = req.body;
    if (!amount || amount < 2) {
      return res.status(400).json({ error: "Minimum $2" });
    }

    const supabase = req.supabaseAdmin;

    const { data: profile } = await supabase
      .from("profiles")
      .select("withdrawable_balance")
      .eq("id", userId)
      .single();

    if (!profile || profile.withdrawable_balance < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    await supabase.from("withdrawals").insert({
      user_id: userId,
      amount,
      currency: "USDT",
      network,
      wallet_address,
      status: "pending",
    });

    await supabase
      .from("profiles")
      .update({
        withdrawable_balance: profile.withdrawable_balance - amount,
      })
      .eq("id", userId);

    res.json({ ok: true });
  } catch (err) {
    console.error("withdraw fatal:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   ADMIN – LIST WITHDRAWALS
========================= */
router.get("/admin/withdrawals", async (req, res) => {
  try {
    const { status } = req.query;
    const supabase = req.supabaseAdmin;

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
        profiles(email)
      `)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const withdrawals = data.map(w => ({
      ...w,
      email: w.profiles?.email || null,
    }));

    res.json({ withdrawals });
  } catch (err) {
    console.error("admin withdrawals error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   ADMIN – APPROVE
========================= */
router.post("/admin/withdrawals/approve", async (req, res) => {
  const { withdrawal_id } = req.body;
  const supabase = req.supabaseAdmin;

  await supabase
    .from("withdrawals")
    .update({ status: "approved" })
    .eq("id", withdrawal_id);

  res.json({ ok: true });
});

/* =========================
   ADMIN – REJECT
========================= */
router.post("/admin/withdrawals/reject", async (req, res) => {
  const { withdrawal_id } = req.body;
  const supabase = req.supabaseAdmin;

  await supabase
    .from("withdrawals")
    .update({ status: "rejected" })
    .eq("id", withdrawal_id);

  res.json({ ok: true });
});

export default router;
