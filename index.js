import express from "express";
import cors from "cors";
import withdrawRoutes from "./withdrawRoutes.js";
import supabaseAdmin from "./supabaseAdmin.js";

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

app.use("/withdraw", withdrawRoutes);

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "investo-server" });
});

export default app;
