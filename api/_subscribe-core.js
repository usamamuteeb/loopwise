// Shared newsletter logic for the Vercel (api/subscribe.js) and Netlify (netlify/functions/subscribe.mjs) endpoints.
// Talks to Brevo's REST API with plain fetch, so there are no dependencies.
//
// Environment variables (set them in your host's dashboard, never in code):
//   BREVO_API_KEY          required  Brevo -> SMTP & API -> API keys
//   BREVO_LIST_ID          required  numeric ID of the contact list that receives subscribers
//   BREVO_DOI_TEMPLATE_ID  optional  ID of a Brevo double opt-in email template. If set, subscribers must confirm.
//   SITE_URL               optional  e.g. https://loopwise.dev (used for the confirmation redirect)

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export async function subscribe({ email, source } = {}, env = process.env) {
  const address = String(email || "").trim().toLowerCase();
  if (address.length > 254 || !EMAIL_RE.test(address)) {
    return { status: 400, body: { error: "Enter a valid email address." } };
  }

  const apiKey = env.BREVO_API_KEY;
  const listId = Number(env.BREVO_LIST_ID);
  if (!apiKey || !listId) {
    console.error("Newsletter not configured: set BREVO_API_KEY and BREVO_LIST_ID.");
    return { status: 503, body: { error: "The newsletter isn't connected yet. Please try again soon." } };
  }

  const templateId = Number(env.BREVO_DOI_TEMPLATE_ID);
  const siteUrl = (env.SITE_URL || "").replace(/\/+$/, "");
  const attributes = env.BREVO_SOURCE_ATTRIBUTE && source ? { [env.BREVO_SOURCE_ATTRIBUTE]: String(source).slice(0, 100) } : undefined;
  const headers = { "api-key": apiKey, "content-type": "application/json", accept: "application/json" };

  try {
    let response;
    if (templateId) {
      response = await fetch("https://api.brevo.com/v3/contacts/doubleOptinConfirmation", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: address,
          includeListIds: [listId],
          templateId,
          redirectionUrl: `${siteUrl || ""}/confirmed/`,
          ...(attributes ? { attributes } : {}),
        }),
      });
    } else {
      response = await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: address, listIds: [listId], updateEnabled: true, ...(attributes ? { attributes } : {}) }),
      });
    }

    if (response.ok) {
      return {
        status: 200,
        body: {
          ok: true,
          redirect: "/thanks/",
          message: templateId ? "Almost done. Check your inbox to confirm." : "You're subscribed. Thanks for joining.",
        },
      };
    }

    const detail = await response.json().catch(() => ({}));
    // An address that already exists is not an error for the visitor, and answering identically avoids leaking who is subscribed.
    if (response.status === 400 && /duplicate/i.test(detail.code || "")) {
      return { status: 200, body: { ok: true, redirect: "/thanks/", message: "You're on the list. Thanks!" } };
    }
    console.error("Brevo error", response.status, detail);
    return { status: 502, body: { error: "We couldn't save your subscription. Please try again in a minute." } };
  } catch (err) {
    console.error("Brevo request failed", err);
    return { status: 502, body: { error: "We couldn't reach the email service. Please try again in a minute." } };
  }
}

export const errorPage = (message) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Subscription problem</title><body style="font:18px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem"><h1>Subscription problem</h1><p>${String(message).replace(/[<>&]/g, "")}</p><p><a href="/newsletter/">Go back and try again</a></p></body>`;
