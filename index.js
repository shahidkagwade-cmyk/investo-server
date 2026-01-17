import express from "express";
import cors from "cors";
import withdrawRoutes from "./withdrawRoutes.js";
import supabaseAdmin from "./supabaseAdmin.js";

const app = express();

/* ================= CORS (SAFE & FINAL) ================= */
app.use(
  cors({
    origin: [
      "https://investo-smart-growth-main.vercel.app",
      "https://investo-admin-panel-iota.vercel.app",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-secret"],
  })
);

app.options("*", cors());
app.use(express.json());

/* ================= SUPABASE ADMIN INJECT ================= */
app.use((req, _res, next) => {
  req.supabaseAdmin = supabaseAdmin;
  next();
});

/* ================= ROUTES ================= */
app.use("/withdraw", withdrawRoutes);

/* ================= VERCEL HANDLER ================= */
export default function handler(req, res) {
  return app(req, res);
}
