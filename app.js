import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db/pool.js";
import authRouter from "./routes/auth.js";
import proposalsRouter from "./routes/proposals.js";
import adminRouter from "./routes/admin.js";
import { parseCookies } from "./middleware/cookies.js";
import { verifyRequestOrigin } from "./middleware/origin.js";
import { errorHandler, notFound } from "./middleware/errors.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const allowedOrigin = process.env.APP_ORIGIN
  ? new URL(process.env.APP_ORIGIN).origin
  : undefined;

app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: process.env.NODE_ENV === "production",
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
      },
    },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === allowedOrigin) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);
app.use(express.json({ limit: "64kb", type: "application/json" }));
app.use(parseCookies);
app.use(verifyRequestOrigin);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many account requests. Try again later." },
});

app.get("/api/health", async (request, response, next) => {
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Database health check failed", error.message);
    response.status(503).json({ status: "unavailable", database: "disconnected" });
  }
});

app.use("/api/auth/register", authLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/verify-admin-otp", authLimiter);
app.use("/api/auth/resend-verification", authLimiter);
app.use("/api/auth", authRouter);
app.use("/api/proposals", proposalsRouter);
app.use("/api/admin", adminRouter);

app.get("/", (request, response) => response.sendFile(path.join(root, "index.html")));
app.get("/verify-email", (request, response) =>
  response.sendFile(path.join(root, "verify-email.html")),
);
app.get("/portal", (request, response) => response.sendFile(path.join(root, "portal.html")));
app.get("/styles.css", (request, response) => response.sendFile(path.join(root, "styles.css")));
app.get("/script.js", (request, response) => response.sendFile(path.join(root, "script.js")));
app.get("/portal.css", (request, response) => response.sendFile(path.join(root, "portal.css")));
app.get("/portal.js", (request, response) => response.sendFile(path.join(root, "portal.js")));
app.get("/verify-email.css", (request, response) =>
  response.sendFile(path.join(root, "verify-email.css")),
);
app.get("/verify-email.js", (request, response) =>
  response.sendFile(path.join(root, "verify-email.js")),
);
app.use("/assets", express.static(path.join(root, "assets"), { dotfiles: "deny" }));

app.use(notFound);
app.use(errorHandler);

export default app;
