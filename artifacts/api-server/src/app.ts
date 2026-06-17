import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ─── CORS ────────────────────────────────────────────────────────────────────
// Allow the Replit dev proxy domain and localhost origins.
// In production, restrict to the configured CORS_ORIGIN env var.
const allowedOrigins = (() => {
  const origins: (string | RegExp)[] = [];
  if (process.env.CORS_ORIGIN) {
    origins.push(process.env.CORS_ORIGIN);
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    // Allow the Replit-proxied dev domain (e.g. https://<repl>.replit.dev)
    origins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  }
  if (process.env.NODE_ENV !== "production") {
    // Allow localhost on any port during development
    origins.push(/^https?:\/\/localhost(:\d+)?$/);
    origins.push(/^https?:\/\/127\.0\.0\.1(:\d+)?$/);
  }
  return origins;
})();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Session ─────────────────────────────────────────────────────────────────
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET environment variable is required in production");
}

app.use(
  session({
    secret: sessionSecret ?? "shiroscans-dev-secret-do-not-use-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api", router);

export default app;
