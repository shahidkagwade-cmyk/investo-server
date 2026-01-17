import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: "No token" });

    const token = auth.replace("Bearer ", "");
    const payload = jwt.decode(token);

    const userId = payload?.sub;
    if (!userId) return res.status(401).json({ error: "Invalid token" });

    const { amount, network, wallet_address } = req.body;
    if (!amount || amount < 2)
      return res.status(400).json({ error: "Minimum $2" });

    const supabase = req.supabaseAdmin;

    /* GET BALANCE */
    const { data: profile } = await supabase
      .from("profiles")
      .select("withdrawable_balance")
      .eq("id", userId)
      .single();

    if (!profile || profile.withdrawable_balance < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    /* INSERT WITHDRAW */
    await supabase.from("withdrawals").insert({
      user_id: userId,
      amount,
      currency: "USDT",
      network,
      wallet_address,
      status: "pending",
    });

    /* CUT BALANCE */
    await supabase
      .from("profiles")
      .update({
        withdrawable_balance: profile.withdrawable_balance - amount,
      })
      .eq("id", userId);

    return res.json({ ok: true });
  } catch (err) {
    console.error("withdraw fatal:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
