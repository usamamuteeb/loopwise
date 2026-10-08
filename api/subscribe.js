// Vercel serverless function: POST /api/subscribe
import { subscribe, errorPage } from "./_subscribe-core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const wantsJson = (req.headers["content-type"] || "").includes("application/json");
  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};

  // Honeypot: real visitors never fill this hidden field. Pretend success so bots learn nothing.
  if (body.website) return wantsJson ? res.status(200).json({ ok: true, message: "Check your inbox to confirm." }) : redirect(res, "/thanks/");

  const result = await subscribe({ email: body.email, source: body.source });

  if (wantsJson) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(result.status).json(result.body);
  }
  if (result.status === 200) return redirect(res, "/thanks/");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(result.status).send(errorPage(result.body.error));
}

function redirect(res, to) {
  res.setHeader("Location", to);
  return res.status(303).end();
}

function safeParse(text) {
  try { return JSON.parse(text); } catch { return Object.fromEntries(new URLSearchParams(text)); }
}
