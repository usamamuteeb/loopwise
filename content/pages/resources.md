---
title: The AI automation starter kit
description: 25 everyday workflows worth automating, a simple way to pick your first one, and six copy-paste prompt templates to start with.
lede: Twenty-five workflows worth automating, how to choose your first one, and six prompts to copy.
updated: "2026-10-09"
cta: true
---

Most people don't lack AI tools. They lack a clear first thing to automate. This kit gives you a short list of workflows that repay the effort, a quick way to rank them, and prompt templates that work in any assistant.

## Pick your first automation in five minutes

Write down three tasks you repeat. Score each one from 1 to 5 on three questions:

1. **How often?** Daily is a 5, monthly is a 1.
2. **How long does one run take?** More than 30 minutes is a 5.
3. **What does a mistake cost?** Reverse it: a harmless mistake scores 5, a costly one scores 1.

Add the three scores. Automate the highest total first. The third question is the one people skip: start with work where a wrong answer is easy to catch, such as drafts you review, and leave anything that sends money or messages unsupervised until you trust the workflow.

## Twenty-five workflows worth automating

Each line reads as *trigger, then what the AI does*. Build them with a script, or with a visual tool such as [n8n](/go/n8n/), [Zapier](/go/zapier/) or [Make](/go/make/).

### Inbox and messages

1. A new support email arrives, then draft a reply from your help docs for a person to approve.
2. A long email thread stalls, then summarise it into decisions and open questions.
3. A meeting ends, then turn the transcript into action items with owners.
4. A form is submitted, then classify it as sales, support or spam and route it.
5. Every Friday, then draft a short status update from your week's tickets or commits.

### Documents and research

6. A PDF lands in a folder, then extract its key fields into a spreadsheet row.
7. A contract arrives, then list dates, amounts and unusual clauses for a human to check.
8. A topic is added to a list, then gather and summarise recent sources with links.
9. A long report is published, then write a one-page brief for people who won't read it.
10. A call recording is uploaded, then produce a searchable transcript and summary.

### Data and spreadsheets

11. A messy CSV is uploaded, then clean names, dates and categories and flag odd rows.
12. A new survey response arrives, then tag its theme and sentiment.
13. A competitor page changes, then summarise what changed.
14. A weekly export is ready, then write plain-English commentary on the numbers.
15. A receipt photo is added, then extract the vendor, date and amount.

### Code and operations

16. A pull request opens, then summarise the change and list likely risks.
17. An error spike appears in logs, then group similar errors and suggest causes.
18. A function has no docs, then draft docstrings for review.
19. A bug report arrives, then ask for the missing details automatically.
20. A release is tagged, then draft the changelog from merged pull requests.

### Content and marketing

21. A new article is published, then draft social posts in your voice for review.
22. A keyword list is updated, then cluster the terms by intent.
23. A webinar ends, then turn the transcript into a post outline.
24. A product update ships, then draft the announcement email.
25. A customer review arrives, then log themes and draft a thank-you.

> [!TIP]
> Put a human approval step in front of anything customers see. The easiest pattern is "AI drafts, person approves, system sends". It keeps most of the time saving and removes most of the risk.

## Six prompt templates

Replace anything in square brackets. These work in any assistant or API. The structure matters more than the exact words: say who the model is, what the input is, what a good output looks like and what to do when information is missing.

```text title="Summarise a thread"
You are an assistant helping a busy [role].
Summarise the email thread below as:
1. Decisions made
2. Open questions
3. Action items, each with an owner and due date if stated

If something is not stated, write "not stated" rather than guessing.

THREAD:
[paste thread]
```

```text title="Extract fields to JSON"
Extract these fields from the text below: [field list].
Return only valid JSON with exactly those keys.
Use null for any field the text does not clearly state. Do not guess.

TEXT:
[paste text]
```

```text title="Draft a reply for approval"
Draft a reply to the customer message below.
Use only the facts in the HELP DOCS section. If the answer isn't there, say you'll
check and ask one clarifying question. Tone: [friendly and concise].
Keep it under [120] words.

CUSTOMER MESSAGE:
[paste message]

HELP DOCS:
[paste relevant docs]
```

```text title="Classify and route"
Classify the message into exactly one category from this list: [categories].
Reply with the category name only, then a one-sentence reason on a new line.
If it fits none, reply "other".

MESSAGE:
[paste message]
```

```text title="Review code"
You are a careful senior engineer. Review the code below for bugs, unclear naming
and missing error handling. List at most five issues, most important first. For each,
give the line, the problem and a one-line fix. Do not rewrite the whole file.

CODE:
[paste code]
```

```text title="Turn notes into a brief"
Turn these rough notes into a one-page brief for [audience] with sections:
Context, What we decided, Why, Next steps. Keep it factual and under [300] words.
Flag any gaps where the notes contradict each other.

NOTES:
[paste notes]
```

## Make any of these safer

- **Test on ten real examples** before you trust a workflow, and keep the examples to re-run later.
- **Log inputs and outputs** so you can see what happened when something looks wrong.
- **Set spending limits** with your AI provider before you run anything in a loop.
- **Keep secrets out of prompts.** Don't paste passwords, keys or personal data you have no right to share.

New to the API side? Start with the [Claude API beginner's guide](/blog/how-to-use-the-claude-api-in-python/), then try [web scraping with Python and AI](/blog/web-scraping-with-python-and-ai/).
