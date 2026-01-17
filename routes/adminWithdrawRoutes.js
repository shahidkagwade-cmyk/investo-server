import express from "express";

const router = express.Router();

/* ================= ADMIN AUTH ================= */
router.use((req, res, next) => {
  const secret = req.headers["x-admin-secret"];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

/* ================= LIST WITHDRAWALS ================= */
router.get("/list", async (req, res) => {
  try {
    const status = req.query.status;
    const supabase = req.supabaseAdmin;

    let query = supabase
      .from("withdrawals")
      .select(
        `
        id,
        user_id,
        amount,
        currency,
        network,
        wallet_address,
        status,
        created_at,
        profiles ( email )
      `
      )
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ withdrawals: data || [] });
  } catch (e) {
    console.error("LIST ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= APPROVE (CUT BALANCE) ================= */
router.post("/approve", async (req, res) => {
  try {
    const { withdrawal_id } = req.body;
    const supabase = req.supabaseAdmin;

    const { data: wd, error } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("id", withdrawal_id)
      .single();

    if (error || !wd || wd.status !== "pending") {
      return res.status(400).json({ error: "Invalid withdrawal" });
    }

    /* 1️⃣ GET PROFILE */
    const { data: profile } = await supabase
      .from("profiles")
      .select("withdrawable_balance")
      .eq("id", wd.user_id)
      .single();

    if (!profile) {
      return res.status(400).json({ error: "Profile not found" });
    }

    const newBalance =
      Number(profile.withdrawable_balance) - Number(wd.amount);

    if (newBalance < 0) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    /* 2️⃣ UPDATE BALANCE */
    await supabase
      .from("profiles")
      .update({ withdrawable_balance: newBalance })
      .eq("id", wd.user_id);

    /* 3️⃣ MARK APPROVED */
    await supabase
      .from("withdrawals")
      .update({
        status: "approved",
        processed_at: new Date().toISOString(),
      })
      .eq("id", withdrawal_id);

    res.json({ ok: true });
  } catch (e) {
    console.error("APPROVE ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= REJECT (REFUND BALANCE) ================= */
router.post("/reject", async (req, res) => {
  try {
    const { withdrawal_id } = req.body;
    const supabase = req.supabaseAdmin;

    const { data: wd } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("id", withdrawal_id)
      .single();

    if (!wd || wd.status !== "pending") {
      return res.status(400).json({ error: "Invalid withdrawal" });
    }

    /* 1️⃣ REFUND BALANCE */
    const { data: profile } = await supabase
      .from("profiles")
      .select("withdrawable_balance")
      .eq("id", wd.user_id)
      .single();

    const newBalance =
      Number(profile.withdrawable_balance) + Number(wd.amount);

    await supabase
      .from("profiles")
      .update({ withdrawable_balance: newBalance })
      .eq("id", wd.user_id);

    /* 2️⃣ MARK REJECTED */
    await supabase
      .from("withdrawals")
      .update({
        status: "rejected",
        processed_at: new Date().toISOString(),
      })
      .eq("id", withdrawal_id);

    res.json({ ok: true });
  } catch (e) {
    console.error("REJECT ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
