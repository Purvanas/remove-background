"use strict";

const express = require("express");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4100);
const HOST = process.env.HOST || "127.0.0.1";
const REMBG_BIN = process.env.REMBG_BIN || "rembg";
const MAX_IMAGE_BYTES = Number(process.env.MAX_IMAGE_BYTES || 50 * 1024 * 1024);
const MAX_JOBS = Math.max(1, Number(process.env.MAX_JOBS || 1));
const PROCESS_TIMEOUT_MS = Number(process.env.PROCESS_TIMEOUT_MS || 120_000);
const ERRORS_TOKEN = process.env.ERRORS_TOKEN || "";
const TMP = process.env.REMBG_TMP_DIR || os.tmpdir();
const RUNTIME_DIR = process.env.REMBG_RUNTIME_DIR || __dirname;
const ERRORS_FILE = path.join(RUNTIME_DIR, "errors.json");

let activeJobs = 0;
let errorLogs = [];
if (fs.existsSync(ERRORS_FILE)) {
  try { errorLogs = JSON.parse(fs.readFileSync(ERRORS_FILE, "utf-8")); } catch { /* invalid log is ignored */ }
}

function logError(type, error, extra) {
  const entry = { time: new Date().toISOString(), type, error: String(error || "Unknown error").slice(0, 500), ...extra };
  errorLogs.push(entry);
  if (errorLogs.length > 500) errorLogs = errorLogs.slice(-500);
  try { fs.writeFileSync(ERRORS_FILE, JSON.stringify(errorLogs, null, 2)); } catch { /* logging must not break requests */ }
}

function safeUnlink(file) { fs.unlink(file, () => {}); }

function isSupportedImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  const ascii = buffer.subarray(0, 12).toString("ascii");
  return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    || (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    || ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a")
    || (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP")
    || ascii.startsWith("BM")
    || buffer.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00]))
    || buffer.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]));
}

function hasErrorsToken(req) {
  if (!ERRORS_TOKEN) return false;
  const authorization = req.headers.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) return false;
  const expected = Buffer.from(ERRORS_TOKEN);
  const received = Buffer.from(authorization.slice(7));
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "32kb" }));
  app.use(express.static(path.join(__dirname, "public")));
  app.use("/api/remove-bg", express.raw({ type: "image/*", limit: MAX_IMAGE_BYTES }));

  app.post("/api/remove-bg", (req, res) => {
    if (!req.body?.length) return res.status(400).json({ error: "Aucune image reçue" });
    if (!isSupportedImage(req.body)) return res.status(415).json({ error: "Format d’image non pris en charge" });
    if (activeJobs >= MAX_JOBS) return res.status(503).json({ error: "Le traitement est occupé. Réessaie dans un instant." });

    const id = crypto.randomBytes(12).toString("hex");
    const inputPath = path.join(TMP, `rembg-in-${id}`);
    const outputPath = path.join(TMP, `rembg-out-${id}.png`);
    fs.writeFileSync(inputPath, req.body, { flag: "wx" });
    activeJobs += 1;
    let settled = false;
    let stderr = "";
    const proc = spawn(REMBG_BIN, ["i", inputPath, outputPath], { stdio: ["ignore", "ignore", "pipe"] });
    const timer = setTimeout(() => proc.kill("SIGKILL"), PROCESS_TIMEOUT_MS);
    const finish = () => {
      if (settled) return false;
      settled = true;
      clearTimeout(timer);
      activeJobs = Math.max(0, activeJobs - 1);
      safeUnlink(inputPath);
      return true;
    };

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    proc.once("error", (err) => {
      if (!finish()) return;
      safeUnlink(outputPath);
      logError("remove-bg-spawn", err.message);
      if (!res.headersSent && !res.destroyed) res.status(503).json({ error: "Le moteur de détourage est indisponible" });
    });
    proc.once("close", (code, signal) => {
      if (!finish()) return;
      if (code !== 0 || !fs.existsSync(outputPath)) {
        safeUnlink(outputPath);
        logError("remove-bg", stderr || `exit ${code ?? signal}`);
        if (!res.headersSent && !res.destroyed) {
          const timedOut = signal === "SIGKILL";
          res.status(timedOut ? 504 : 500).json({ error: timedOut ? "Le traitement a dépassé le délai autorisé" : "Échec du détourage" });
        }
        return;
      }
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store");
      const stream = fs.createReadStream(outputPath);
      stream.once("error", (err) => {
        logError("remove-bg-output", err.message);
        if (!res.headersSent) res.status(500).json({ error: "Résultat illisible" });
        else res.destroy(err);
      });
      res.once("finish", () => safeUnlink(outputPath));
      res.once("close", () => safeUnlink(outputPath));
      stream.pipe(res);
    });
    res.once("close", () => { if (!res.writableEnded && !settled) proc.kill("SIGKILL"); });
  });

  app.post("/api/report-bug", (req, res) => {
    const { error, comment, userAgent } = req.body || {};
    logError("user-report", error || "No error", {
      comment: String(comment || "").slice(0, 500),
      userAgent: String(userAgent || req.headers["user-agent"] || "").slice(0, 500),
      ip: req.ip,
    });
    res.json({ ok: true });
  });
  app.get("/api/errors", (req, res) => {
    if (!hasErrorsToken(req)) return res.status(404).json({ error: "Not found" });
    res.json(errorLogs.slice(-100).reverse());
  });
  app.use((req, res) => res.status(404).json({ error: "Not found" }));
  app.use((err, req, res, next) => {
    if (err?.type === "entity.too.large") return res.status(413).json({ error: "Image trop volumineuse" });
    console.error("[ERROR]", err.message);
    res.status(500).json({ error: "Erreur interne du serveur" });
  });
  return app;
}

if (require.main === module) {
  createApp().listen(PORT, HOST, () => console.log(`Remove Background running on http://${HOST}:${PORT}`));
}

module.exports = { createApp, isSupportedImage };
