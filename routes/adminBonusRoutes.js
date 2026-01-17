import express from "express";

const router = express.Router();

/* ===============================
   ADD BONUS (signup / referral)
   ADMIN MANUAL ONLY
================================ */
router.post("/add", async (req, res) => {
  const { user_id, bonus_type, amount, source_user_id } = req.body;

  if (!user_id || !bonus_type || !amount || Number(amount) <= 0) {
    return res.status(400).json({ ok: false, error: "Invalid input" });
  }

  if (!["signup", "referral"].includes(bonus_type)) {
    return res.status(400).json({ ok: false, error: "Invalid bonus type" });
  }

  try {
    const { error } = await req.supabaseAdmin
      .from("user_bonuses")
      .insert({
        user_id,
        bonus_type,
        amount: Number(amount),
        source_user_id:
          bonus_type === "referral" ? source_user_id || null : null,
      });

    if (error) throw error;

    res.json({ ok: true, message: "Bonus added successfully" });
  } catch (err) {
    console.error("ADD BONUS ERROR:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* ===============================
   LIST ALL BONUSES (ADMIN)
================================ */
router.get("/list", async (_req, res) => {
  try {
    const { data, error } = await req.supabaseAdmin
      .from("user_bonuses")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ ok: true, data });
  } catch (e) {
    console.error("LIST BONUS ERROR:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* ===============================
   GET AVAILABLE BONUS
================================ */
router.get("/available", async (req, res) => {
  try {
    const { user_id, bonus_type } = req.query;

    if (!user_id || !bonus_type) {
      return res.status(400).json({
        ok: false,
        error: "user_id and bonus_type required",
      });
    }

    const { data, error } = await req.supabaseAdmin
      .from("user_bonuses")
      .select("amount")
      .eq("user_id", user_id)
      .eq("bonus_type", bonus_type);

    if (error) throw error;

    const total = (data || []).reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    );

    res.json({ ok: true, available: total });
  } catch (e) {
    console.error("AVAILABLE BONUS ERROR:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* ===============================
   SEARCH USER BY EMAIL
================================ */
router.get("/user-by-email", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ ok: false, error: "Email required" });
    }

    const { data } =
      await req.supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    const user = data.users.find(
      (u) => u.email?.toLowerCase() === String(email).toLowerCase()
    );

    if (!user) {
      return res.json({ ok: false, error: "User not found" });
    }

    res.json({ ok: true, user_id: user.id, email: user.email });
  } catch (err) {
    console.error("USER SEARCH ERROR:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* =========================================
   CONVERT BONUS → WITHDRAWABLE BALANCE
   ✔ SAFE
   ✔ FIFO
   ✔ NO total_balance TOUCH
========================================= */
/* =========================================
   CONVERT BONUS → WITHDRAWABLE BALANCE
   ✔ SAFE
   ✔ FIFO
   ✔ profiles.id FIXED
========================================= */
router.post("/convert", async (req, res) => {
  const { user_id, bonus_type, amount } = req.body;
  const convertAmount = Number(amount);

  if (!user_id || !bonus_type || !convertAmount || convertAmount <= 0) {
    return res.status(400).json({ ok: false, error: "Invalid input" });
  }

  try {
    /* 1️⃣ Fetch bonuses (FIFO) */
    const { data: bonuses, error: bonusErr } = await req.supabaseAdmin
      .from("user_bonuses")
      .select("*")
      .eq("user_id", user_id)
      .eq("bonus_type", bonus_type)
      .order("created_at", { ascending: true });

    if (bonusErr || !bonuses || bonuses.length === 0) {
      return res.status(404).json({ ok: false, error: "Bonus not found" });
    }

    const totalBonus = bonuses.reduce(
      (sum, b) => sum + Number(b.amount || 0),
      0
    );

    if (convertAmount > totalBonus) {
      return res.status(400).json({
        ok: false,
        error: "Convert amount exceeds available bonus",
      });
    }

    /* 2️⃣ Fetch profile (✅ FIXED COLUMN) */
    const { data: profile, error: pErr } = await req.supabaseAdmin
      .from("profiles")
      .select("withdrawable_balance")
      .eq("id", user_id) // ✅ CORRECT
      .single();

    if (pErr || !profile) {
      console.error("PROFILE FETCH ERROR:", pErr);
      return res.status(404).json({ ok: false, error: "Profile not found" });
    }

    /* 3️⃣ Update withdrawable balance */
    const newBalance =
      Number(profile.withdrawable_balance || 0) + convertAmount;

    const { error: balErr } = await req.supabaseAdmin
      .from("profiles")
      .update({ withdrawable_balance: newBalance })
      .eq("id", user_id); // ✅ CORRECT

    if (balErr) {
      console.error("BALANCE UPDATE ERROR:", balErr);
      return res.status(500).json({ ok: false, error: "Balance update failed" });
    }

    /* 4️⃣ Reduce bonus FIFO */
    let remaining = convertAmount;

    for (const b of bonuses) {
      if (remaining <= 0) break;

      if (Number(b.amount) <= remaining) {
        await req.supabaseAdmin
          .from("user_bonuses")
          .delete()
          .eq("id", b.id);

        remaining -= Number(b.amount);
      } else {
        await req.supabaseAdmin
          .from("user_bonuses")
          .update({ amount: Number(b.amount) - remaining })
          .eq("id", b.id);

        remaining = 0;
      }
    }

    return res.json({
      ok: true,
      converted: convertAmount,
      remaining_bonus: totalBonus - convertAmount,
      withdrawable_balance: newBalance,
    });
  } catch (e) {
    console.error("CONVERT BONUS ERROR:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});


export default router;
