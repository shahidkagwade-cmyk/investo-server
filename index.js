import express from "express";
import cors from "cors";

import withdrawRoutes from "./withdrawRoutes.js";
import supabaseAdmin from "./supabaseAdmin.js";

const app = express();

/* ================= SAFE CORS CONFIG ================= */

const allowedOrigins = [
  "https://investo-smart-growth-main.vercel.app",   // User App
  "https://investo-admin-panel-iota.vercel.app",    // Admin Panel
  "http://localhost:5173",                          // Local dev
  "http://localhost:3000",                          // Local dev
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow server-to-server, curl, postman
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS blocked"), false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-admin-secret",
    ],
    credentials: false,
    optionsSuccessStatus: 200,
  })
);

// Preflight always OK
app.options("*", cors());

/* ================= MIDDLEWARES ================= */

app.use(express.json());

app.use((req, _res, next) => {
  req.supabaseAdmin = supabaseAdmin;
  next();
});

/* ================= ROUTES ================= */

app.use("/withdraw", withdrawRoutes);

/* ================= EXPORT ================= */

export default app;
