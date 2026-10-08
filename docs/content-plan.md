# Content plan: 30 articles

Three launch articles are written (marked done). The rest are ideas ordered by how well they fit the site's categories and how clearly they match a search. Target keywords are starting hypotheses: check each one in Google Search Console and a keyword tool before you commit, and favour specific "how do I..." phrases over broad head terms while the site is new.

Rules that keep every article AdSense-safe and genuinely useful: 1,500+ words, original code or a reproducible setup, a "what goes wrong" section, 2-3 internal links, and an honest "who should skip this" line wherever a tool is recommended.

## Build (API tutorials and code)

| # | Working title | Target phrase | Notes |
| --- | --- | --- | --- |
| 1 | How to Use the Claude API in Python | claude api python tutorial | **Done** |
| 2 | Build a Chatbot With the Claude API and Streamlit | build a chatbot with claude | Reuse the chat loop from #1 |
| 3 | Claude Tool Use Explained With 3 Real Examples | claude tool use example | Weather, SQL lookup, calendar |
| 4 | How to Get Reliable JSON From an LLM | llm structured output json | Compare tool-forcing vs prompt-only |
| 5 | Claude API Rate Limits and Retries Explained | claude api rate limit error | Backoff code, queueing |
| 6 | Prompt Caching: Cut Your API Bill on Repeated Context | prompt caching claude | Before/after token counts |
| 7 | Build a Document Q&A Tool Without a Vector Database | document question answering python | Long-context approach vs RAG |
| 8 | Streaming LLM Responses to a Web Page (FastAPI + JavaScript) | stream llm response fastapi | |

## Compare

| # | Working title | Target phrase | Notes |
| --- | --- | --- | --- |
| 9 | ChatGPT vs Claude: How to Choose for Your Own Work | chatgpt vs claude | **Done** |
| 10 | Cursor vs GitHub Copilot: Which Fits Your Workflow? | cursor vs copilot | Test on the same refactor |
| 11 | n8n vs Zapier vs Make for AI Workflows | n8n vs zapier | Same workflow built three ways, with cost per 1,000 runs |
| 12 | Best AI Tools for Coding: How to Pick Without Wasting a Month | best ai tools for coding | Link to tool profiles |
| 13 | Perplexity vs a Chat Assistant for Research | perplexity vs chatgpt | Source-checking test |
| 14 | Claude Model Sizes: When to Use the Small, Medium and Large Model | claude haiku vs sonnet | Quality/cost on 5 tasks |
| 15 | Self-Hosting n8n: Is It Worth It? | self host n8n | Real monthly cost |
| 16 | Free AI APIs and Free Tiers: What You Can Actually Build | free ai api | Keep updated; mark date |

## Automate

| # | Working title | Target phrase | Notes |
| --- | --- | --- | --- |
| 17 | Web Scraping With Python and AI | web scraping python ai | **Done** |
| 18 | Automate Your Inbox: Draft Replies With AI and Human Approval | automate email with ai | Approval-step pattern |
| 19 | Turn Meeting Transcripts Into Action Items Automatically | meeting notes ai automation | |
| 20 | Build an AI Price Tracker for Any Website | price tracker python | Builds on #17 |
| 21 | Automate Invoice and Receipt Data Entry | extract data from invoices ai | |
| 22 | Schedule Python Scripts: cron, GitHub Actions and n8n Compared | schedule python script | |
| 23 | Build a Daily Digest of Any RSS Feed With AI Summaries | rss summary python | Pairs with newsletter idea |
| 24 | Automate Social Posts From Your Blog Safely | automate social media posts | Human approval again |

## Ship (case studies)

| # | Working title | Target phrase | Notes |
| --- | --- | --- | --- |
| 25 | I Automated Support Triage: Setup, Cost and What Broke | ai support ticket triage | Only publish real numbers |
| 26 | How This Site Builds Its Newsletter Workflow | newsletter automation | Meta-case study |
| 27 | A Month of Running an AI Workflow: Cost Breakdown | ai automation cost | Real token and hosting spend |
| 28 | When Not to Use AI: Five Automations Better Done With a Script | when not to use ai | Trust builder |
| 29 | Evaluating an LLM Workflow: A Simple Test Harness | evaluate llm app | Extends the bake-off script |
| 30 | AI Automation Mistakes That Cost Real Money | ai automation mistakes | Rate limits, loops, leaked keys |

## Publishing rhythm

Aim for two solid articles a week rather than daily thin ones. Recommended cadence: one tutorial (Build/Automate) plus one comparison or case study. Refresh the oldest comparison every quarter and bump its `updated` date; that is often the cheapest traffic gain available.
