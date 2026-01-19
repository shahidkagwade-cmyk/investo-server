import express from "express";
const router = express.Router();

router.get("/users", async (req, res) => {
  try {
    const supabase = req.supabaseAdmin;

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, email, withdrawable_balance, daily_claim_enabled, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ users: data });
  } catch (err) {
    console.error("ADMIN USERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.post("/users/daily-claim", async (req, res) => {
  const { user_id, enabled } = req.body;
  const supabase = req.supabaseAdmin;

  await supabase
    .from("profiles")
    .update({ daily_claim_enabled: enabled })
    .eq("id", user_id);

  res.json({ success: true });
});

export default router;
