import express from "express";
import cors from "cors";
import withdrawRoutes from "./withdrawRoutes.js";
import adminWithdrawRoutes from "./routes/adminWithdrawRoutes.js";
import supabaseAdmin from "./supabaseAdmin.js";
import adminBonusRoutes from "./routes/adminBonusRoutes.js";
import adminDepositRoutes from "./routes/adminDepositRoutes.js";
import adminDailyClaimRoutes from "./routes/adminDailyClaimRoutes.js";
import adminUsersRoutes from "./routes/adminUsersRoutes.js";
import claimDailyRoutes from "./routes/claimDailyRoutes.js";


const app = express();

const allowedOrigins = [
  "https://investo-smart-growth-main.vercel.app",
  "https://investo-admin-panel-iota.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS blocked"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-secret"],
  })
);

app.options("*", cors());
app.use(express.json());

app.use((req, _res, next) => {
  req.supabaseAdmin = supabaseAdmin;
  next();
});

/* USER withdraw */
app.use("/withdraw", withdrawRoutes);

/* ADMIN withdraw */
app.use("/admin/withdrawals", adminWithdrawRoutes);
app.use("/admin/bonus", adminBonusRoutes);
app.use("/admin/deposits", adminDepositRoutes);
app.use("/admin/daily-claim", adminDailyClaimRoutes);
app.use("/admin", adminUsersRoutes);
/* USER daily claim */
app.use("/claim-daily", claimDailyRoutes);

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "investo-server" });
});

export default app;
