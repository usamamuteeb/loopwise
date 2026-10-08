/* Loopwise client script. No dependencies. Everything degrades gracefully without JS. */
(() => {
  "use strict";
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const root = document.documentElement;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  let cfg = {};
  try { cfg = JSON.parse($("#lw-config").textContent); } catch { /* ignore */ }

  // ---- Theme -------------------------------------------------------------
  $$("[data-theme-toggle]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const current = root.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = current === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      store.set("lw-theme", next);
    })
  );

  // ---- Mobile nav --------------------------------------------------------
  const navBtn = $("[data-nav-toggle]");
  const nav = $("#site-nav");
  if (navBtn && nav) {
    navBtn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      navBtn.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("open")) { nav.classList.remove("open"); navBtn.setAttribute("aria-expanded", "false"); navBtn.focus(); }
    });
  }

  // ---- Copy buttons ------------------------------------------------------
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { /* ignore */ }
      ta.remove();
      return ok;
    }
  }
  function flash(btn, label) {
    const old = btn.textContent;
    btn.textContent = label;
    setTimeout(() => { btn.textContent = old; }, 1600);
  }
  document.addEventListener("click", async (e) => {
    const copy = e.target.closest("[data-copy]");
    if (copy) {
      const code = $("pre", copy.closest("figure"));
      flash(copy, (await copyText(code ? code.innerText.replace(/\n$/, "") : "")) ? "Copied" : "Press Ctrl+C");
      return;
    }
    const link = e.target.closest("[data-copy-link]");
    if (link) flash(link, (await copyText(link.getAttribute("data-copy-link"))) ? "Link copied" : "Copy failed");

    const tool = e.target.closest("a[data-tool]");
    if (tool && typeof window.gtag === "function") window.gtag("event", "affiliate_click", { tool: tool.getAttribute("data-tool"), page: location.pathname });
  });

  // ---- Newsletter forms --------------------------------------------------
  $$("form[data-subscribe]").forEach((form) => {
    const status = $(".form-status", form);
    const btn = $("button[type=submit]", form);
    const say = (msg, kind) => { status.textContent = msg; status.className = `form-status ${kind || ""}`; };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      if (data.website) { say("Check your inbox to confirm.", "ok"); return; } // honeypot
      btn.disabled = true;
      say("Subscribing...");
      try {
        const res = await fetch(form.action, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ email: data.email, source: data.source }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          say(json.message || "Almost done. Check your inbox to confirm.", "ok");
          form.reset();
          if (json.redirect) location.assign(json.redirect);
        } else {
          say(json.error || "Something went wrong. Please try again in a minute.", "err");
        }
      } catch {
        say("Couldn't reach the server. Check your connection and try again.", "err");
      } finally {
        btn.disabled = false;
      }
    });
  });

  // ---- Search dialog -----------------------------------------------------
  const dialog = $("[data-search-dialog]");
  if (dialog && typeof dialog.showModal === "function") {
    const input = $("[data-search-input]", dialog);
    const list = $("[data-search-results]", dialog);
    let index = null;
    const load = async () => {
      if (index) return index;
      try { index = await (await fetch("/search-index.json")).json(); } catch { index = []; }
      return index;
    };
    const render = (items, q) => {
      list.textContent = "";
      if (!items.length) {
        const li = document.createElement("li");
        li.className = "none";
        li.textContent = q ? "Nothing found. Try a shorter or different keyword." : "";
        list.appendChild(li);
        return;
      }
      for (const it of items.slice(0, 8)) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = it.u;
        const s = document.createElement("strong"); s.textContent = it.t;
        const d = document.createElement("span"); d.textContent = it.d;
        a.append(s, d); li.appendChild(a); list.appendChild(li);
      }
    };
    const run = async () => {
      const q = input.value.trim().toLowerCase();
      const data = await load();
      if (!q) { render(data.slice(0, 5), ""); return; }
      const words = q.split(/\s+/);
      const scored = data
        .map((it) => {
          const t = it.t.toLowerCase(), k = (it.k || "").toLowerCase(), d = it.d.toLowerCase();
          let score = 0;
          for (const w of words) {
            const s = (t.includes(w) ? 3 : 0) + (k.includes(w) ? 2 : 0) + (d.includes(w) ? 1 : 0);
            if (!s) return null;
            score += s;
          }
          return { it, score };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.it);
      render(scored, q);
    };
    const open = () => { dialog.showModal(); input.value = ""; run(); input.focus(); };
    document.addEventListener("click", (e) => { if (e.target.closest("[data-search-open]")) open(); });
    document.addEventListener("keydown", (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if ((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) { e.preventDefault(); if (!dialog.open) open(); }
    });
    input.addEventListener("input", run);
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  } else {
    $$("[data-search-open]").forEach((b) => b.setAttribute("hidden", ""));
  }

  // ---- Blog filter -------------------------------------------------------
  const filter = $("[data-filter]");
  if (filter) {
    const rows = $$(".rows .row");
    const empty = $("[data-filter-empty]");
    const apply = () => {
      const words = filter.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let shown = 0;
      rows.forEach((r) => {
        const hay = r.getAttribute("data-search") || "";
        const ok = words.every((w) => hay.includes(w));
        r.hidden = !ok;
        if (ok) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    };
    const q = new URLSearchParams(location.search).get("q");
    if (q) { filter.value = q; apply(); }
    filter.addEventListener("input", apply);
  }

  // ---- Table of contents highlight --------------------------------------
  const tocLinks = $$(".toc a");
  if (tocLinks.length && "IntersectionObserver" in window) {
    const byId = new Map(tocLinks.map((a) => [a.getAttribute("href").slice(1), a]));
    const heads = $$(".prose h2[id], .prose h3[id]").filter((h) => byId.has(h.id));
    const set = (id) => tocLinks.forEach((a) => (a.getAttribute("href") === `#${id}` ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) set(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" }
    );
    heads.forEach((h) => io.observe(h));
  }

  // ---- Consent, analytics, ads ------------------------------------------
  const needsConsent = Boolean(cfg.ga4 || cfg.adsenseClient);
  const banner = $("[data-consent]");
  const reopen = $("[data-consent-open]");
  let loaded = false;

  function addScript(src, attrs = {}) {
    const s = document.createElement("script");
    s.src = src; s.async = true;
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    document.head.appendChild(s);
    return s;
  }
  function loadAnalytics() {
    if (!cfg.ga4) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", cfg.ga4, { anonymize_ip: true });
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.ga4)}`);
  }
  function loadAds() {
    if (!cfg.adsenseClient) return;
    const slots = $$(".ad[data-ad-slot]");
    addScript(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cfg.adsenseClient)}`, { crossorigin: "anonymous" });
    window.adsbygoogle = window.adsbygoogle || [];
    slots.forEach((box) => {
      const ins = document.createElement("ins");
      ins.className = "adsbygoogle";
      ins.style.display = "block";
      ins.setAttribute("data-ad-client", cfg.adsenseClient);
      ins.setAttribute("data-ad-slot", box.getAttribute("data-ad-slot"));
      ins.setAttribute("data-ad-format", "auto");
      ins.setAttribute("data-full-width-responsive", "true");
      box.appendChild(ins);
      try { window.adsbygoogle.push({}); } catch { /* ad blocker or policy error */ }
    });
  }
  function grant() {
    root.classList.add("consent-granted");
    if (loaded) return;
    loaded = true;
    loadAnalytics();
    loadAds();
  }

  if (needsConsent) {
    if (reopen) reopen.hidden = false;
    const choice = store.get("lw-consent");
    if (choice === "granted") grant();
    else if (choice !== "denied" && banner) banner.hidden = false;
    $("[data-consent-accept]")?.addEventListener("click", () => { store.set("lw-consent", "granted"); banner.hidden = true; grant(); });
    $("[data-consent-reject]")?.addEventListener("click", () => {
      const wasGranted = store.get("lw-consent") === "granted";
      store.set("lw-consent", "denied");
      banner.hidden = true;
      if (wasGranted) location.reload();
    });
    reopen?.addEventListener("click", () => { banner.hidden = false; $("[data-consent-accept]")?.focus(); });
  }

  // ---- Respect reduced motion for the SVG loop ---------------------------
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const svg = $(".loop-track");
    if (svg && typeof svg.pauseAnimations === "function") svg.pauseAnimations();
  }
})();
