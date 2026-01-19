import express from "express";
const router = express.Router();

/**
 * ADMIN → Enable / Disable Daily Claim for User
 */
router.post("/toggle", async (req, res) => {
  try {
    const { userId, enabled } = req.body;

    if (!userId || typeof enabled !== "boolean") {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const supabase = req.supabaseAdmin;

    const { error } = await supabase
      .from("profiles")
      .update({ daily_claim_enabled: enabled })
      .eq("id", userId);

    if (error) throw error;

    res.json({ ok: true });
  } catch (err) {
    console.error("daily-claim toggle error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
