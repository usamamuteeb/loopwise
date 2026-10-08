---
title: "Claude Tool Use Explained With Three Real Python Examples"
description: "Build one reusable tool-use loop, then use it for an order lookup, a read-only SQL assistant and a calendar tool that asks a human before it acts."
date: "2026-10-09"
category: build
tags: ["Claude API", "Tool use", "Python", "Tutorial"]
---

A language model on its own can only produce text. Tool use is how you let it *do* things: look up an order, query a database, add a calendar entry. The idea is simple and often explained badly, so here is the whole thing in two sentences. You describe your functions to the model. When it decides one is needed, it replies with the function's name and arguments instead of an answer, your code runs the function, and you hand back the result so the model can finish.

The model never runs anything itself. **Your program stays in control**, and that is the single most important fact for building safe tools. This guide builds one small, reusable loop and then uses it three times: a simple lookup, a database assistant that can only read, and an action that needs a human to say yes. If you haven't made your first API call yet, start with the [Claude API beginner's guide](/blog/how-to-use-the-claude-api-in-python/).

## How the loop works

<figure class="diagram">
<svg viewBox="0 20 720 190" role="img" aria-labelledby="tl1t tl1d">
<title id="tl1t">Tool use loop</title>
<desc id="tl1d">Your code sends the question and tool descriptions. Claude answers with a tool call or a final answer. Your code runs the tool and returns the result, then the loop repeats until Claude gives a final answer.</desc>
<defs><marker id="tla" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
<g fill="none" stroke="currentColor" stroke-width="2">
<rect x="10" y="50" width="190" height="70" rx="10"/>
<rect x="265" y="50" width="190" height="70" rx="10"/>
<rect x="520" y="50" width="190" height="70" rx="10"/>
<rect x="150" y="150" width="420" height="44" rx="10" stroke-dasharray="6 5"/>
<path d="M202 85H263" marker-end="url(#tla)"/>
<path d="M457 85H518" marker-end="url(#tla)"/>
<path d="M360 122V148" marker-end="url(#tla)"/>
<path d="M148 172H105V122" marker-end="url(#tla)"/>
</g>
<g text-anchor="middle" font-size="15" font-weight="600">
<text x="105" y="80">Your code</text><text x="105" y="100" font-weight="400" font-size="13">question + tool list</text>
<text x="360" y="80">Claude</text><text x="360" y="100" font-weight="400" font-size="13">stop_reason</text>
<text x="615" y="80">Final answer</text><text x="615" y="100" font-weight="400" font-size="13">end_turn</text>
<text x="360" y="177" font-weight="400" font-size="13">Run the function, send back tool_result</text>
<text x="372" y="141" font-weight="400" font-size="13" text-anchor="start">tool_use</text>
</g>
</svg>
<figcaption>Claude asks, your code decides what runs, and the loop repeats until Claude replies with text.</figcaption>
</figure>

Three details make the loop work:

- A tool call arrives as a `tool_use` block with an `id`, a `name` and an `input` dictionary. The response's `stop_reason` is `"tool_use"`.
- You reply with a `tool_result` block that carries the *same id*. If something goes wrong, set `"is_error": True` so the model knows the call failed and can adjust.
- A single response can contain **several** `tool_use` blocks (parallel calls). Answer all of them in one user message.

## The reusable loop

Everything in this article sits on top of this one function. Save it as `tool_loop.py`. Use the current model name from the vendor's models page in place of the one shown.

```python title="tool_loop.py"
import json

import anthropic

MODEL = "claude-sonnet-5-5"
client = anthropic.Anthropic()


def run_with_tools(user_text, tools, handlers, system=None, max_rounds=6):
    """Send a question, run any tools Claude asks for, and return its final text answer."""
    messages = [{"role": "user", "content": user_text}]
    extra = {"system": system} if system else {}

    for _ in range(max_rounds):
        response = client.messages.create(
            model=MODEL, max_tokens=1024, tools=tools, messages=messages, **extra
        )

        if response.stop_reason != "tool_use":
            return "".join(b.text for b in response.content if b.type == "text")

        messages.append({"role": "assistant", "content": response.content})
        results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            try:
                handler = handlers[block.name]          # unknown tool name -> KeyError
                output = handler(**block.input)          # bad arguments -> TypeError
                content, is_error = json.dumps(output, default=str), False
            except Exception as err:                     # tell the model, don't crash
                content, is_error = f"{type(err).__name__}: {err}", True
            results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": content,
                **({"is_error": True} if is_error else {}),
            })
        messages.append({"role": "user", "content": results})

    raise RuntimeError(f"No final answer after {max_rounds} rounds")
```

Three choices in there are deliberate and worth copying:

1. **`max_rounds`** stops a confused model from looping forever and running up your bill.
2. **Errors become results.** When a handler fails, the model sees `ValueError: No order with ID B2000` and can apologise, retry with a corrected argument, or ask the user. Crashing helps nobody.
3. **Every `tool_use` gets a `tool_result`.** Skip one and the API rejects the next request.

## Example 1: a simple lookup

The first example is a lookup against a dictionary. It shows the full cycle, including a failure.

```python title="orders.py"
from tool_loop import run_with_tools

ORDERS = {
    "A1042": {"status": "shipped", "carrier": "DHL", "eta_days": 2},
    "A1043": {"status": "processing", "carrier": None, "eta_days": 5},
}

TOOLS = [{
    "name": "get_order_status",
    "description": (
        "Look up the shipping status of one customer order by its order ID "
        "(a letter followed by digits, such as A1042). Returns status, carrier and "
        "estimated days to delivery. Call it once per order."
    ),
    "input_schema": {
        "type": "object",
        "properties": {"order_id": {"type": "string", "description": "The order ID, e.g. A1042"}},
        "required": ["order_id"],
    },
}]


def get_order_status(order_id: str):
    order = ORDERS.get(order_id.strip().upper())
    if order is None:
        raise ValueError(f"No order with ID {order_id}")
    return order


answer = run_with_tools(
    "Where is order A1042, and what about B2000?",
    TOOLS,
    {"get_order_status": get_order_status},
    system="You are a support assistant. Only state facts returned by tools.",
)
print(answer)
```

Run it and watch what happens. The model asks for both orders in one go (parallel calls). One comes back with data, the other with an error, and the final answer explains both. You wrote no code to handle that, and the loop did the work.

### Write tool descriptions like instructions

The `description` is the most important field you write. The model decides *whether* and *how* to call a tool based almost entirely on it. A good description says what the tool does, what each argument looks like (with an example), what it returns, and when **not** to use it. "Gets order info" is a bad description. The one above tells the model the ID format and that it should call once per order.

## Example 2: a database assistant that can only read

Letting a model write SQL is powerful and risky. The safe pattern is to enforce read-only access in *code*, not in the prompt. A prompt that says "never delete anything" is a hope. A database connection that cannot delete is a fact.

SQLite makes this easy with a read-only connection plus an *authorizer*, a function that approves or denies every operation. This version builds a small demo database and allows only `SELECT`:

```python title="sql_assistant.py"
import os
import sqlite3

from tool_loop import run_with_tools

DB_PATH = "shop.db"
MAX_ROWS = 50


def make_demo_db():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript("""
        CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, country TEXT);
        CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER, total REAL, placed_on TEXT);
        INSERT INTO customers VALUES (1,'Ayesha','PK'),(2,'Ben','US'),(3,'Chloe','GB');
        INSERT INTO orders VALUES (1,1,120.0,'2026-09-01'),(2,1,80.5,'2026-09-15'),
                                  (3,2,45.0,'2026-09-20'),(4,3,300.0,'2026-10-01');
    """)
    conn.commit()
    conn.close()


def read_only_connection():
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)    # the file itself is read-only

    def authorizer(action, arg1, arg2, db_name, source):
        allowed = {sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ, sqlite3.SQLITE_FUNCTION}
        return sqlite3.SQLITE_OK if action in allowed else sqlite3.SQLITE_DENY

    conn.set_authorizer(authorizer)                                 # and so is every statement
    return conn


def schema_text():
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("SELECT sql FROM sqlite_master WHERE type = 'table'").fetchall()
    conn.close()
    return "\n".join(r[0] for r in rows)


def run_sql(query: str):
    conn = read_only_connection()
    try:
        cursor = conn.execute(query)                 # only one statement is allowed per call
        columns = [d[0] for d in cursor.description]
        rows = cursor.fetchmany(MAX_ROWS)
        return {"columns": columns, "rows": rows, "truncated": len(rows) == MAX_ROWS}
    finally:
        conn.close()


if __name__ == "__main__":
    make_demo_db()
    tools = [{
        "name": "run_sql",
        "description": (
            "Run one read-only SQLite SELECT query and return the rows (at most "
            f"{MAX_ROWS}). Database schema:\n{schema_text()}"
        ),
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "A single SELECT statement"}},
            "required": ["query"],
        },
    }]
    print(run_with_tools(
        "Which customer has spent the most in total, and how much?",
        tools,
        {"run_sql": run_sql},
        system="Answer using only query results. If a query fails, read the error and fix it.",
    ))
```

Why this is safer than it looks:

- **Two independent locks.** The file is opened read-only *and* the authorizer denies everything except reading. If one assumption fails, the other still holds.
- **One statement per call.** SQLite refuses to run several statements in a single `execute`, which blocks the classic "`SELECT 1; DROP TABLE x`" trick.
- **Capped output.** `MAX_ROWS` stops one careless query from stuffing thousands of rows (and tokens) into the conversation.
- **The schema is in the description,** so the model writes queries against real table and column names instead of guessing.
- **Errors loop back.** If the model writes bad SQL, the error message returns as a tool result and it corrects itself, which is exactly what you want.

Try asking it to "delete all orders". The authorizer refuses, the model sees the error, and it tells you it can't. That refusal came from your code, not from the model's good manners.

> [!WARNING]
> For a real production database, use a dedicated database user that has read-only permissions on only the tables you intend to expose, and consider pointing it at a replica. Never reuse an admin connection.

## Example 3: an action that needs a human to say yes

Reading is low risk. Writing, sending and deleting are not. For anything with side effects, the handler itself should stop and ask a person before it acts. Here a calendar tool shows the proposed event and waits for a yes:

```python title="calendar_tool.py"
import json
from datetime import datetime

from tool_loop import run_with_tools

TOOLS = [{
    "name": "add_calendar_event",
    "description": (
        "Propose a calendar event. The user is shown the details and must approve before it "
        "is saved, so a result of 'declined_by_user' means they said no. Start time must be "
        "ISO 8601, e.g. 2026-10-14T15:00."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "start": {"type": "string", "description": "ISO 8601 local time, e.g. 2026-10-14T15:00"},
            "duration_minutes": {"type": "integer", "minimum": 5, "maximum": 480},
        },
        "required": ["title", "start", "duration_minutes"],
    },
}]


def add_calendar_event(title: str, start: str, duration_minutes: int):
    start_dt = datetime.fromisoformat(start)         # a bad format raises, and the model is told why
    print(f"\nProposed event: {title}")
    print(f"  {start_dt:%A %d %B %Y at %H:%M} for {duration_minutes} minutes")
    if input("Add this to your calendar? [y/N] ").strip().lower() != "y":
        return {"status": "declined_by_user"}
    with open("events.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps({"title": title, "start": start, "minutes": duration_minutes}) + "\n")
    return {"status": "created"}


if __name__ == "__main__":
    today = datetime.now().strftime("%A %Y-%m-%d")
    print(run_with_tools(
        "Put a 45 minute planning meeting on my calendar next Tuesday at 3pm.",
        TOOLS,
        {"add_calendar_event": add_calendar_event},
        system=f"Today is {today}. Resolve relative dates yourself before calling the tool.",
    ))
```

The approval prompt sits **inside the handler**, so no wording of the conversation can skip it. That is the rule to remember for any tool that changes something: confirmation belongs in code, never in the prompt. Swap the file write for a real calendar API, and the safety design stays the same.

## Choosing when the model must use a tool

The `tool_choice` parameter controls how much freedom the model has:

| Setting | What it does | Use it when |
| --- | --- | --- |
| `{"type": "auto"}` | The model decides whether to call a tool (the default) | Normal assistants |
| `{"type": "any"}` | It must call *some* tool | You always want an action, not chat |
| `{"type": "tool", "name": "x"}` | It must call that specific tool | Structured extraction (see [reliable JSON](/blog/reliable-json-from-an-llm/)) |
| `{"type": "none"}` | Tools are off for this request | You want a plain text reply |

Some features, such as extended thinking, limit which options are allowed, so check the current docs for your model.

## Safety rules for every tool you build

1. **Least privilege.** Give each tool the minimum access it needs. A read-only tool can't be talked into a write.
2. **Validate arguments in code.** The model's arguments are untrusted input, just like a web form. Check types, ranges and allowed values.
3. **Confirm side effects with a human** inside the handler, and make destructive actions the hardest to trigger.
4. **Cap what comes back.** Limit rows, characters and files so one call can't flood the conversation or your bill.
5. **Treat tool results as untrusted text.** If a tool returns a web page or an email, that content can contain instructions aimed at the model. Never give a model that reads untrusted text a tool that can send, delete or spend without a human check.
6. **Limit rounds and log everything.** Keep `max_rounds` low and log every call with its arguments so you can see what happened.

## Debugging checklist

- **API error about a missing `tool_result`:** every `tool_use` id in the last assistant message needs a matching `tool_result` in the next user message.
- **The model never calls your tool:** improve the description, add an example, or use `tool_choice` to require it.
- **Wrong arguments:** tighten the schema with `enum`, `minimum` and `maximum`, and describe each field's format.
- **Loops that don't end:** lower `max_rounds` and check that your error messages tell the model what to change.
- **Huge token bills:** cap outputs, trim history, and use a smaller model for simple lookups.

## Frequently asked questions

**Does Claude run my code?**
No. It only returns the name and arguments. Your program decides whether and how to run anything.

**Can the model call several tools at once?**
Yes. One response can contain several `tool_use` blocks. Return all the results together in one user message, as the loop above does.

**How many tools can I give it?**
Fewer is better. Every tool description costs tokens and adds a choice to get wrong. Start with the ones you need and add more only when a test shows a gap.

**Is tool use the same as an agent?**
An agent is basically this loop with more tools, more rounds and more planning around it. Master the loop first and you understand the core of every agent framework.

## Where to go next

You now have a loop you can drop into any project and three patterns: a plain lookup, a locked-down data tool and a human-approved action. A natural next step is to apply the approval pattern to something people actually dread, such as the inbox. See [how to draft email replies with AI without letting it send anything](/blog/ai-email-draft-replies-with-approval/).
