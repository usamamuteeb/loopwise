---
title: "How to Get Reliable JSON From an LLM (With Python Code)"
description: "Stop parsing broken JSON. Force a schema with tool use, validate with Pydantic, feed errors back for a retry, and measure how often your prompt really works."
date: "2026-10-09"
category: build
tags: ["Claude API", "Python", "Structured output", "Tutorial"]
---

Sooner or later every LLM project needs the model to return data a program can read, not a paragraph a person can read. You ask for JSON, it works in your first five tests, and you ship. Then a customer's input is a little odd and the model answers with "Sure! Here's the JSON you asked for:" followed by a code fence, or it quietly renames a field, or it returns `"total": "about 120"` where your code expects a number. Your parser throws, and your pipeline stops at 2 a.m.

The good news is that this is a solved engineering problem. You don't fix it with a cleverer prompt. You fix it with layers: make the model's output *shape* hard to get wrong, check it like you'd check any untrusted input, and give the model a chance to correct itself when it slips. This guide builds those layers one at a time in Python, using invoice extraction as the running example, and ends with a small test harness so you can measure reliability instead of guessing.

If you haven't used the API yet, read the [Claude API beginner's guide](/blog/how-to-use-the-claude-api-in-python/) first. This article assumes you can already make a request.

## Why "please reply in JSON" fails

A prompt is a request, not a contract. When you write "Reply only with valid JSON", the model is very likely to comply, but "very likely" is not "always", and at a few thousand calls a day the rare failures arrive daily. The common ones:

- **Extra prose around the JSON**, such as a friendly intro or a markdown code fence.
- **Wrong types**: a number returned as a string, a date in a format you didn't ask for.
- **Missing or renamed fields**, especially when the input doesn't contain the information.
- **Invented values** when the data is absent. The model fills the gap instead of leaving it empty.
- **Truncation**: the reply hits `max_tokens` halfway through an object, leaving broken JSON.

Each failure needs a different defence, which is why we use several layers.

## Layer 1: Make the shape part of the request

Instead of asking for JSON in text, describe the shape as a **tool** and require the model to call it. The model's reply then arrives as a structured object that already follows your schema, with no prose to strip and no fences to peel off.

```python
TOOL = {
    "name": "save_invoice",
    "description": "Save the fields extracted from an invoice.",
    "input_schema": {
        "type": "object",
        "properties": {
            "vendor": {"type": "string"},
            "total": {"type": "number", "description": "Grand total as a number, no currency symbol"},
            "currency": {"type": "string", "enum": ["USD", "EUR", "GBP", "PKR", "other"]},
        },
        "required": ["vendor", "total", "currency"],
    },
}

response = client.messages.create(
    model=MODEL,
    max_tokens=700,
    tools=[TOOL],
    tool_choice={"type": "tool", "name": "save_invoice"},   # the model must call this tool
    messages=[{"role": "user", "content": invoice_text}],
)
data = next(b for b in response.content if b.type == "tool_use").input
```

`tool_choice` is the important line. With `{"type": "tool", "name": ...}` the model has to respond by calling that tool, so you get a dictionary instead of free text. Note that the "tool" never runs. We use the tool mechanism purely as a way to get structured arguments back.

Two notes before you rely on this:

- Some features restrict `tool_choice`. For example, if you turn on extended thinking, forcing a specific tool may not be allowed. Check the current API docs for your model.
- Anthropic also offers a native structured-outputs feature that enforces a JSON schema directly. Its availability and syntax have changed over time, so check the docs; the validation layers below are worth keeping either way, because a schema only guarantees the *shape*, not the *truth*.

## Layer 2: Design a schema the model can follow

A good schema does a lot of the work that a long prompt would otherwise try to do:

- **Use `enum` for closed sets.** `"currency": {"enum": [...]}` is far safer than "use an ISO code".
- **Allow `null` for anything that might be missing.** If a field can't be empty, the model has to invent a value. Letting it say "not stated" is the cheapest way to stop made-up data.
- **Describe each field in plain language**, including the format: "Date as YYYY-MM-DD".
- **Keep it flat.** Deeply nested objects and long arrays of objects fail more often than a handful of top-level fields.
- **Mark `required` carefully.** Required means "the model must produce something", so only require what the input always contains.

Rather than hand-writing JSON Schema, define the data once as a Pydantic model and generate the schema from it. That gives you the tool definition *and* the validator from the same source, so they can never drift apart.

## Layer 3: Validate like it's untrusted input

Even with a forced schema, check what comes back. Types can be right and values still wrong. Pydantic handles the types, and a small function can handle the facts:

```python
from typing import Literal, Optional
from pydantic import BaseModel, Field


class Invoice(BaseModel):
    vendor: str = Field(min_length=1, description="Name of the company that issued the invoice")
    invoice_number: Optional[str] = Field(default=None, description="Invoice number, or null if not shown")
    currency: Literal["USD", "EUR", "GBP", "PKR", "other"]
    total: float = Field(ge=0, description="Grand total as a number, no currency symbol")
    due_date: Optional[str] = Field(
        default=None,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="Due date as YYYY-MM-DD, or null if not shown",
    )
    items: list[str] = Field(description="Short description of each line item")
```

Pydantic rejects a `total` that isn't a number, a `currency` outside your list and a `due_date` in the wrong format. For the facts, add a *grounding check*: values that must come from the source text should actually appear in it.

```python
def check_grounding(invoice: Invoice, source_text: str) -> None:
    haystack = source_text.lower()
    if invoice.vendor.lower() not in haystack:
        raise ValueError(f"vendor '{invoice.vendor}' does not appear in the invoice text")
    if f"{invoice.total:.2f}" not in source_text.replace(",", ""):
        raise ValueError(f"total {invoice.total:.2f} does not appear in the invoice text")
```

This is deliberately blunt, and that's the point. A model that invents a plausible total will fail a check that simply looks for the number in the source.

## Layer 4: Let the model fix its own mistakes

When validation fails, don't throw the whole result away. Tell the model exactly what was wrong and ask it to try again. Models are good at correcting a specific, named error. In the tool-use protocol you do this by answering the tool call with a `tool_result` marked as an error:

```python
messages.append({"role": "assistant", "content": response.content})
messages.append({
    "role": "user",
    "content": [{
        "type": "tool_result",
        "tool_use_id": call.id,
        "is_error": True,
        "content": f"Validation failed: {err}. Call save_invoice again with corrected values.",
    }],
})
```

Two attempts at most is a good default, and three is the ceiling. If the model hasn't got it right after a couple of specific corrections, the input is probably the problem, and more retries just cost money.

## Putting it together

Here is the complete module. Replace the model name with the current one from the vendor's models page:

```python title="reliable_extract.py"
from typing import Literal, Optional

import anthropic
from pydantic import BaseModel, Field

MODEL = "claude-haiku-5-5"   # a small model is usually enough for extraction
client = anthropic.Anthropic()

SYSTEM = (
    "You extract invoice data. Use null for anything the text does not clearly state. "
    "Never guess or calculate values that are not written in the text."
)


class Invoice(BaseModel):
    vendor: str = Field(min_length=1, description="Name of the company that issued the invoice")
    invoice_number: Optional[str] = Field(default=None, description="Invoice number, or null if not shown")
    currency: Literal["USD", "EUR", "GBP", "PKR", "other"]
    total: float = Field(ge=0, description="Grand total as a number, no currency symbol")
    due_date: Optional[str] = Field(
        default=None,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="Due date as YYYY-MM-DD, or null if not shown",
    )
    items: list[str] = Field(description="Short description of each line item")


TOOL = {
    "name": "save_invoice",
    "description": "Save the fields extracted from an invoice.",
    "input_schema": Invoice.model_json_schema(),
}


class ExtractionError(Exception):
    pass


def check_grounding(invoice: Invoice, source_text: str) -> None:
    if invoice.vendor.lower() not in source_text.lower():
        raise ValueError(f"vendor '{invoice.vendor}' does not appear in the invoice text")
    if f"{invoice.total:.2f}" not in source_text.replace(",", ""):
        raise ValueError(f"total {invoice.total:.2f} does not appear in the invoice text")


def extract_invoice(text: str, max_attempts: int = 3) -> tuple[Invoice, int]:
    """Return (invoice, attempts_used). Raise ExtractionError if it never validates."""
    messages = [{"role": "user", "content": f"INVOICE TEXT:\n{text}"}]
    last_error = "no attempts made"

    for attempt in range(1, max_attempts + 1):
        response = client.messages.create(
            model=MODEL,
            max_tokens=700,
            system=SYSTEM,
            tools=[TOOL],
            tool_choice={"type": "tool", "name": TOOL["name"]},
            messages=messages,
        )
        if response.stop_reason == "max_tokens":
            raise ExtractionError("reply was cut off; raise max_tokens or shorten the input")

        call = next((b for b in response.content if b.type == "tool_use"), None)
        if call is None:
            raise ExtractionError("the model did not call the tool")

        try:
            invoice = Invoice.model_validate(call.input)
            check_grounding(invoice, text)
            return invoice, attempt
        except ValueError as err:   # pydantic's ValidationError is a ValueError
            last_error = str(err)
            messages.append({"role": "assistant", "content": response.content})
            messages.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": call.id,
                    "is_error": True,
                    "content": (
                        f"Validation failed: {err}. Call save_invoice again with corrected values. "
                        "Use null when the text does not say."
                    ),
                }],
            })

    raise ExtractionError(f"still invalid after {max_attempts} attempts: {last_error}")
```

Use it like this:

```python
invoice, attempts = extract_invoice("ACME Supplies Ltd\nInvoice INV-2041\nTotal due: $1,250.00 by 2026-11-30")
print(invoice.model_dump())
print(f"validated on attempt {attempts}")
```

Notice what the function never does: it never returns unvalidated data. It either returns a checked `Invoice` or raises `ExtractionError`, so the rest of your code can trust whatever it receives.

## Measure it, don't guess

"It seems to work" is how bad pipelines get shipped. Build a tiny test set from real inputs, run it repeatedly, and count. This harness reports how often extraction succeeds and how often it needed a retry:

```python title="measure.py"
from reliable_extract import ExtractionError, extract_invoice

SAMPLES = [
    ("ACME Supplies Ltd\nInvoice INV-2041\nTotal due: $1,250.00 by 2026-11-30", 1250.00),
    ("Northwind Traders\nTotal: EUR 89.90", 89.90),
    ("Bright Lamps, no invoice number shown. Amount payable GBP 410.00", 410.00),
]
RUNS = 5

first_try = retried = failed = wrong = 0
for text, expected_total in SAMPLES:
    for _ in range(RUNS):
        try:
            invoice, attempts = extract_invoice(text)
        except ExtractionError:
            failed += 1
            continue
        if abs(invoice.total - expected_total) > 0.005:
            wrong += 1
        elif attempts == 1:
            first_try += 1
        else:
            retried += 1

n = len(SAMPLES) * RUNS
print(f"{n} runs: {first_try} right first try, {retried} fixed by retry, {failed} failed, {wrong} wrong total")
```

Track two numbers over time. The *retry rate* tells you how often the prompt and schema are weak, and the *wrong rate* tells you how often validation is not strict enough to catch a mistake. Use a dozen or more real, messy examples, not just clean ones, and re-run the set whenever you change the prompt, the schema or the model.

## Common mistakes

- **Parsing free text with regular expressions.** If you find yourself stripping code fences, switch to tool use instead.
- **Making every field required.** The model will invent values to satisfy you. Allow `null`.
- **Retrying blindly.** A retry without the error message just repeats the mistake. Always say what was wrong.
- **Trusting a valid shape.** `{"total": 99999}` is valid JSON. Check values against the source.
- **Ignoring `stop_reason`.** A `max_tokens` stop means the output is incomplete. Treat it as a failure, not as data.
- **Skipping the test set.** You can't tell whether a prompt change helped without numbers.

## Frequently asked questions

**Do I still need validation if I use a native structured-outputs feature?**
Yes. Schema enforcement guarantees the structure but not that the values are true. Keep the grounding checks.

**Which model should I use for extraction?**
Start with the smallest model in the family and move up only if your test set shows it can't reach the accuracy you need. Extraction is usually a task where small models do well.

**What if the model keeps failing on certain inputs?**
Look at those inputs. Often the text is genuinely ambiguous or missing the field, and the right fix is to allow `null` and handle the gap in your own code, not to push the model harder.

**How do I handle long documents?**
Split them into sections, extract from each and merge the results. Smaller inputs are cheaper and give fewer wrong answers than one giant prompt.

## Where to go next

You now have a pattern you can reuse for any extraction task: define the data once, force the shape, validate against the source, retry with specific feedback and measure. To put it to work on web pages, see [web scraping with Python and AI](/blog/web-scraping-with-python-and-ai/), and to let the model call your own functions beyond extraction, read [Claude tool use explained with three real examples](/blog/claude-tool-use-examples/).
