import express from "express";
import cors from "cors";
import withdrawRoutes from "./withdrawRoutes.js";
import supabaseAdmin from "./supabaseAdmin.js";

const app = express();

/* ================= SAFE CORS ================= */
const allowedOrigins = [
  "https://investo-smart-growth-main.vercel.app", // USER APP
  "https://investo-admin-panel-iota.vercel.app"   // ADMIN PANEL
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS blocked"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-secret"],
    credentials: true
  })
);

app.options("*", cors());
app.use(express.json());

/* ================= SUPABASE ADMIN ================= */
app.use((req, _res, next) => {
  req.supabaseAdmin = supabaseAdmin;
  next();
});

/* ================= ROUTES ================= */
app.use("/withdraw", withdrawRoutes);

/* ================= HEALTH CHECK ================= */
app.get("/", (_req, res) => {
  res.json({ ok: true, service: "investo-server" });
});

export default app;
