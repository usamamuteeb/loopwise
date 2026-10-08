---
title: "Web Scraping with Python and AI: Turn Pages Into Clean Data"
description: "Fetch pages politely, strip them to the text that matters, and have Claude return validated JSON. Includes robots.txt checks, caching and cost control."
date: "2026-10-09"
category: automate
tags: ["Web scraping", "Python", "Claude API", "Automation"]
---

Classic web scraping has one big weakness: it breaks the moment a site changes its HTML. You write a selector like `div.product > span.price`, it works for a month, then a redesign renames a class and your pipeline quietly returns nothing.

AI extraction flips the trade-off. Instead of telling the program *where* the data lives, you tell it *what* you want and let a language model find it in the page text. It is slower and costs a little per page, but it shrugs off most layout changes and handles messy, inconsistent pages that selectors struggle with.

In this guide you will build a small, polite scraper that checks `robots.txt`, caches what it downloads, asks Claude for structured JSON, validates the result and writes a CSV. It is deliberately short so you can read all of it, and every part is something you can swap out.

## Read this before you scrape anything

> [!WARNING]
> Scraping is not automatically allowed just because a page is public. Check the site's terms of service and `robots.txt`, prefer an official API or data feed when one exists, and never bypass logins, paywalls or bot protection. Don't collect personal data you have no right to hold. If you are unsure, ask the site owner. This guide is not legal advice.

Good scraper manners also keep you out of trouble technically:

- **Identify yourself** with a descriptive `User-Agent` that includes a way to contact you.
- **Slow down.** One request every couple of seconds is a polite default.
- **Cache everything** so you never download the same page twice while you develop.
- **Stop on errors.** A `403` or `429` is a request to back off, not a puzzle to defeat.

## When AI extraction is worth it (and when it isn't)

Use plain selectors when the page structure is stable and simple. They're fast, free and deterministic. Reach for AI when:

- The data is scattered across free text, such as a job posting or an event description.
- Many different sites carry the same kind of information in different layouts.
- The markup changes often and you are tired of fixing selectors.

A hybrid is often best: try the selectors first and fall back to AI only for pages where they return nothing.

<figure class="diagram">
<svg viewBox="0 24 720 92" role="img" aria-labelledby="d3t d3d">
<title id="d3t">Scraping pipeline</title>
<desc id="d3d">Five stages: fetch politely, clean the HTML to text, extract with Claude, validate, save to CSV.</desc>
<defs><marker id="arr3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
<g fill="none" stroke="currentColor" stroke-width="2">
<rect x="6" y="36" width="124" height="68" rx="10"/><rect x="152" y="36" width="124" height="68" rx="10"/><rect x="298" y="36" width="124" height="68" rx="10"/><rect x="444" y="36" width="124" height="68" rx="10"/><rect x="590" y="36" width="124" height="68" rx="10"/>
<path d="M131 70H150" marker-end="url(#arr3)"/><path d="M277 70H296" marker-end="url(#arr3)"/><path d="M423 70H442" marker-end="url(#arr3)"/><path d="M569 70H588" marker-end="url(#arr3)"/>
</g>
<g text-anchor="middle" font-size="14" font-weight="600">
<text x="68" y="66">Fetch</text><text x="68" y="86" font-weight="400" font-size="12">robots + cache</text>
<text x="214" y="66">Clean</text><text x="214" y="86" font-weight="400" font-size="12">HTML to text</text>
<text x="360" y="66">Extract</text><text x="360" y="86" font-weight="400" font-size="12">Claude, forced schema</text>
<text x="506" y="66">Validate</text><text x="506" y="86" font-weight="400" font-size="12">Pydantic</text>
<text x="652" y="66">Save</text><text x="652" y="86" font-weight="400" font-size="12">CSV</text>
</g>
</svg>
<figcaption>Each stage is a plain function, so you can test and replace them one at a time.</figcaption>
</figure>

## Set up

You need Python 3.9 or newer and four packages:

```bash
pip install requests beautifulsoup4 anthropic pydantic
export ANTHROPIC_API_KEY="your-key-here"
```

New to the API? The [Claude API beginner's guide](/blog/how-to-use-the-claude-api-in-python/) covers keys, requests and errors in detail.

## Step 1: Fetch politely

This part has nothing to do with AI, and it is where most scrapers go wrong. We check `robots.txt` before every new domain, wait between requests, set a clear `User-Agent`, and store each page on disk so a re-run costs nothing.

```python title="fetch.py"
import hashlib
import pathlib
import time
from urllib import robotparser
from urllib.parse import urlparse

import requests

USER_AGENT = "MyResearchBot/1.0 (contact: you@example.com)"
DELAY_SECONDS = 2
CACHE = pathlib.Path(".cache")
CACHE.mkdir(exist_ok=True)

_robots = {}


def allowed(url: str) -> bool:
    parts = urlparse(url)
    base = f"{parts.scheme}://{parts.netloc}"
    if base not in _robots:
        rp = robotparser.RobotFileParser()
        rp.set_url(f"{base}/robots.txt")
        try:
            rp.read()
        except Exception:
            return False  # can't confirm permission, so don't fetch
        _robots[base] = rp
    return _robots[base].can_fetch(USER_AGENT, url)


def fetch(url: str) -> str:
    cached = CACHE / f"{hashlib.sha256(url.encode()).hexdigest()[:16]}.html"
    if cached.exists():
        return cached.read_text(encoding="utf-8")
    if not allowed(url):
        raise PermissionError(f"robots.txt does not allow fetching {url}")
    time.sleep(DELAY_SECONDS)
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=20)
    response.raise_for_status()
    cached.write_text(response.text, encoding="utf-8")
    return response.text
```

Set `USER_AGENT` to something that really identifies you. Pretending to be a normal browser is exactly the behaviour site owners object to.

## Step 2: Shrink the page to the text that matters

Raw HTML is mostly noise: scripts, styles, menus, tracking pixels. You pay for every token you send, so strip the page down first. BeautifulSoup does this in a few lines:

```python title="clean.py"
from bs4 import BeautifulSoup

NOISE = ["script", "style", "nav", "footer", "header", "aside", "form", "noscript", "svg"]


def page_text(html: str, limit: int = 12000) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(NOISE):
        tag.decompose()
    text = soup.get_text("\n", strip=True)
    return text[:limit]   # hard cap keeps cost predictable
```

The `limit` is a blunt but effective cost control. If the data you want sits at the bottom of long pages, raise it, or select the main content container first with a selector and pass only that.

## Step 3: Ask Claude for structured data

You could ask for JSON in the prompt and parse whatever comes back, but there is a more reliable way: define a **tool** whose input schema is the shape you want, and force Claude to call it. The reply then arrives as a Python dictionary that already matches your schema.

```python title="extract.py"
import anthropic

MODEL = "claude-haiku-5-5"   # a small, fast model is usually enough for extraction
client = anthropic.Anthropic()

TOOL = {
    "name": "save_product",
    "description": "Save the product details found on the page.",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "price": {"type": ["number", "null"], "description": "Numeric price, or null if not shown"},
            "currency": {"type": ["string", "null"], "description": "ISO code such as USD, or null"},
            "in_stock": {"type": ["boolean", "null"]},
            "summary": {"type": "string", "description": "One factual sentence, no marketing language"},
        },
        "required": ["name", "summary"],
    },
}


def extract(text: str, url: str):
    response = client.messages.create(
        model=MODEL,
        max_tokens=800,
        system=(
            "Extract product details from the page text. "
            "Use null for anything the page does not clearly state. Never guess."
        ),
        tools=[TOOL],
        tool_choice={"type": "tool", "name": "save_product"},
        messages=[{"role": "user", "content": f"URL: {url}\n\nPAGE TEXT:\n{text}"}],
    )
    call = next(block for block in response.content if block.type == "tool_use")
    return call.input, response.usage
```

Two things make this robust. The system prompt gives the model permission to say "null" instead of inventing a value, which cuts down on made-up data. And `tool_choice` forces the structured reply, so you don't have to coax or repair free text.

## Step 4: Validate before you trust

A model can follow your schema and still be wrong. Validate types, then check the values against the source text where you can. Pydantic handles the first part:

```python title="validate.py"
from typing import Optional

from pydantic import BaseModel, ValidationError


class Product(BaseModel):
    name: str
    price: Optional[float] = None
    currency: Optional[str] = None
    in_stock: Optional[bool] = None
    summary: str


def validate(data: dict, source_text: str):
    try:
        product = Product.model_validate(data)
    except ValidationError as err:
        raise ValueError(f"Schema check failed: {err}") from err

    # Cheap sanity check: a price the page never mentions is a red flag.
    if product.price is not None and str(int(product.price)) not in source_text:
        raise ValueError(f"Price {product.price} not found in page text; check by hand")
    return product
```

That last check is crude on purpose. It catches the classic failure where the model returns a plausible but absent number. Rows that fail go into a "review" list instead of your dataset.

## Step 5: Put it together

Now a short script ties the stages into a loop, writes a CSV, and prints what the run cost in tokens so there are no surprises:

```python title="run.py"
import csv

from clean import page_text
from extract import extract
from fetch import fetch
from validate import validate

URLS = [
    "https://example.com/products/1",
    "https://example.com/products/2",
]

good, review = [], []
tokens_in = tokens_out = 0

for url in URLS:
    try:
        text = page_text(fetch(url))
        data, usage = extract(text, url)
        tokens_in += usage.input_tokens
        tokens_out += usage.output_tokens
        product = validate(data, text)
        good.append({"url": url, **product.model_dump()})
    except Exception as err:   # keep going; one bad page shouldn't stop the batch
        review.append({"url": url, "problem": str(err)})

if good:
    with open("products.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=good[0].keys())
        writer.writeheader()
        writer.writerows(good)

print(f"{len(good)} saved, {len(review)} need review")
print(f"Tokens used: {tokens_in} in, {tokens_out} out")
for item in review:
    print("REVIEW:", item["url"], "-", item["problem"])
```

Replace the example URLs with pages you are allowed to fetch. Because the fetcher caches to disk, you can tweak the prompt and re-run as often as you like while only paying for the model calls.

## Keeping the bill small

Extraction is the cheapest kind of AI work to optimise, because the output is small and the task is narrow:

1. **Use a small model.** Start with a Haiku-class model and move up only if accuracy needs it.
2. **Trim the input.** Pass the main content container, not the entire page.
3. **Cache both stages.** You already cache the HTML; also cache the extraction result keyed by a hash of the cleaned text.
4. **Skip what hasn't changed.** Compare a hash of the page text with the last run and only re-extract when it differs.
5. **Batch when you can wait.** For large overnight jobs, a batch interface is cheaper than real-time requests.

## Troubleshooting

| Problem | What it usually means | What to do |
| --- | --- | --- |
| `403` or `429` errors | The site is refusing or rate-limiting you | Slow down, check the terms and look for an official API. Don't try to evade blocks |
| Page text is nearly empty | The content is built by JavaScript after load | Look for an official feed or API. Only if the terms allow it, use a headless browser |
| Wrong or invented values | The model guessed | Keep the "use null, never guess" rule and the source-text check; tighten the schema descriptions |
| Costs creeping up | Pages are long or you re-run everything | Lower `limit`, narrow the container, cache results |
| Works on one site, fails on another | Different layouts hide the data differently | Add one or two example pages to the prompt as guidance |

## Run it on a schedule

A scraper is most useful when it runs without you. You can schedule `run.py` with cron on a server or with a scheduled GitHub Actions workflow. If you'd rather click than code, a visual workflow tool such as [n8n](/go/n8n/) can run a Python script or call the Claude API on a timer, and send the results to a sheet or an email. Whichever you choose, send yourself a short report after each run listing how many rows were saved and how many need review.

## Where to go from here

You now have a reusable pattern: fetch, clean, extract against a schema, validate, store. The same skeleton works for job listings, event pages, recipes, documentation changelogs and price tracking; you only change the schema and the prompt. Each new use case is a good candidate for the weekly workflow we send out, so [subscribe](/newsletter/) if you want the next one.
