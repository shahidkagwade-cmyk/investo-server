import express from "express";
import cors from "cors";

import withdrawRoutes from "./withdrawRoutes.js";
import supabaseAdmin from "./supabaseAdmin.js";

const app = express();

/* ================= CORS (FINAL SAFE VERSION) ================= */
const allowedOrigins = [
  "https://investo-smart-growth-main.vercel.app", // user app
  "https://investo-admin-panel-iota.vercel.app",  // admin panel
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow server-to-server & Vercel internal calls
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-secret"],
    credentials: true,
  })
);

app.options("*", cors());
/* ============================================================= */

app.use(express.json());

app.use((req, _res, next) => {
  req.supabaseAdmin = supabaseAdmin;
  next();
});

app.use("/withdraw", withdrawRoutes);

export default app;
