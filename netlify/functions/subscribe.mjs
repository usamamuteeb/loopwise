// Netlify function: POST /api/subscribe  (path set below, no redirect rule needed)
import { subscribe, errorPage } from "../../api/_subscribe-core.js";

export const config = { path: "/api/subscribe" };

export default async (request) => {
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { Allow: "POST", "content-type": "application/json" } });

  const wantsJson = (request.headers.get("content-type") || "").includes("application/json");
  let body = {};
  try {
    body = wantsJson ? await request.json() : Object.fromEntries(await request.formData());
  } catch { /* fall through with empty body */ }

  if (body.website) {
    return wantsJson ? Response.json({ ok: true, message: "Check your inbox to confirm." }) : new Response(null, { status: 303, headers: { Location: "/thanks/" } });
  }

  const result = await subscribe({ email: body.email, source: body.source }, process.env);
  if (wantsJson) return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  if (result.status === 200) return new Response(null, { status: 303, headers: { Location: "/thanks/" } });
  return new Response(errorPage(result.body.error), { status: result.status, headers: { "content-type": "text/html; charset=utf-8" } });
};
