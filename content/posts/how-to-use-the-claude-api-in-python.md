---
title: "How to Use the Claude API in Python: A Beginner's Guide"
description: "Install the SDK, make your first request, stream replies, hold a conversation, call your own functions and handle errors, with Python code you can run."
date: "2026-10-09"
category: build
tags: ["Claude API", "Python", "Tutorial", "Claude"]
featured: true
---

Most "AI features" are not magic. They are an HTTP request with some text in it and a response with some text out. The Claude API is exactly that, with a few well-designed extras on top: system prompts, streaming, and the ability for the model to ask your code to run a function and report back.

This guide takes you from an empty folder to a small program that holds a conversation, streams its answer and calls a function of your own. Every snippet is plain Python with the official `anthropic` package, and each section builds on the one before it, so you can stop whenever you have what you need.

**What you need:** Python 3.9 or newer, a terminal, and an API key from the Claude Console. The API is billed per token, separate from any chat subscription, so check the current prices before you build anything that loops.

## Set up the project

Create a folder, a virtual environment and install the SDK:

```bash
mkdir claude-demo && cd claude-demo
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install anthropic
```

Next, give the SDK your key. The SDK reads it from the `ANTHROPIC_API_KEY` environment variable, which keeps it out of your source code:

```bash
export ANTHROPIC_API_KEY="your-key-here"     # Windows PowerShell: $env:ANTHROPIC_API_KEY="your-key-here"
```

> [!WARNING]
> Never paste an API key into a file you might commit, and never ship it in front-end code. If a key leaks, revoke it in the Console straight away and create a new one. A leaked key spends your money.

If you write a lot of boilerplate, an AI-assisted editor such as [Cursor](/go/cursor/) or [GitHub Copilot](/go/github-copilot/) will fill in most of the snippets below. Read what it writes anyway; you need to understand the request shape to debug it.

## Make your first request

Create `hello.py`:

```python title="hello.py"
import anthropic

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment

message = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Explain what an API is in two sentences."}
    ],
)

print(message.content[0].text)
```

Run it with `python hello.py`. You should see a short explanation printed in your terminal.

Three details are worth knowing now, because they cause most beginner errors:

- **`max_tokens` is required.** It caps the length of the reply. If the answer is cut off, raise it.
- **`messages` is a list.** Each item has a `role` (`user` or `assistant`) and `content`. Start with a `user` message.
- **`model` is a string ID.** IDs change as new models ship, so copy the current one from the models page in the official docs rather than from a blog post, including this one.

### Read the response properly

`message.content[0].text` works for simple cases, but the response has more in it. Print the object's useful fields:

```python
print(message.stop_reason)           # "end_turn", "max_tokens", "tool_use" or "stop_sequence"
print(message.usage.input_tokens)    # tokens you sent
print(message.usage.output_tokens)   # tokens Claude wrote
```

`content` is a list of blocks, not a single string. For plain text you get one text block. When Claude calls a tool you get a `tool_use` block too. Always check `stop_reason`: if it says `max_tokens`, the reply was truncated and your code should not treat it as finished.

## Choose a model

Anthropic offers models at different points on the speed, cost and capability curve. As a rule of thumb:

| If you need | Start with |
| --- | --- |
| Everyday coding, writing and analysis at a sensible price | A Sonnet-class model, such as `claude-sonnet-5-5` |
| Fast, cheap responses for classification, routing and extraction at volume | A Haiku-class model, such as `claude-haiku-5-5` |
| The hardest reasoning and long, multi-step work | An Opus-class model, such as `claude-opus-5-5` |

Start with the middle option, get your prompt working, then try the cheaper model on the same task. If the quality holds, you just cut your bill. Keep the model name in one constant so swapping it is a one-line change.

## Control the behaviour with a system prompt

The `system` parameter sets standing instructions that apply to the whole conversation: role, tone, format, and rules. Keep it separate from the user message.

```python title="system_prompt.py"
import anthropic

MODEL = "claude-sonnet-5-5"
client = anthropic.Anthropic()

message = client.messages.create(
    model=MODEL,
    max_tokens=500,
    system=(
        "You are a code reviewer. Reply with at most three bullet points. "
        "Name the file and line when you can. Do not rewrite the whole function."
    ),
    messages=[
        {
            "role": "user",
            "content": "Review this:\n\ndef avg(xs):\n    return sum(xs) / len(xs)",
        }
    ],
)
print(message.content[0].text)
```

Good system prompts are specific and testable. "Be helpful" does nothing. "Reply with at most three bullet points" is a rule you can check in the output.

You can also pass `temperature` (lower is more consistent, higher is more varied) and `stop_sequences` (strings that end the reply early). For extraction and classification, a low temperature is usually what you want.

## Hold a conversation

The API is stateless. Claude does not remember your last request, so to continue a conversation you send the whole history each time. Append each reply to a list and send the list again:

```python title="chat.py"
import anthropic

MODEL = "claude-sonnet-5-5"
client = anthropic.Anthropic()
history = []

print("Type 'quit' to exit.")
while True:
    user_text = input("\nYou: ").strip()
    if user_text.lower() in {"quit", "exit"}:
        break

    history.append({"role": "user", "content": user_text})
    reply = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system="You are a concise, friendly tutor.",
        messages=history,
    )
    answer = reply.content[0].text
    history.append({"role": "assistant", "content": answer})
    print(f"\nClaude: {answer}")
```

Because you resend everything, long chats get more expensive with every turn. Two habits keep this in check: trim or summarise old turns once the conversation is long, and watch `usage.input_tokens`, which grows as the history does.

## Stream the answer

For anything a person is waiting on, stream the reply so words appear as they are written instead of after a long pause:

```python title="stream.py"
import anthropic

client = anthropic.Anthropic()

with client.messages.stream(
    model="claude-sonnet-5-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Write a haiku about debugging."}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
print()
```

The `flush=True` matters in a terminal; without it Python may buffer the output and you lose the effect. In a web app you would forward each chunk to the browser instead of printing it.

## Let Claude call your functions

This is the feature that turns a chatbot into something useful. You describe a function to Claude as a tool. When it needs the function, it stops and returns a `tool_use` block with the arguments. Your code runs the function and sends the result back, and Claude writes the final answer using it.

<figure class="diagram">
<svg viewBox="0 44 720 184" role="img" aria-labelledby="d1t d1d">
<title id="d1t">Tool use loop</title>
<desc id="d1d">Your app sends messages to Claude. If Claude returns tool_use, your app runs the function and sends back a tool_result. Otherwise Claude returns the final answer.</desc>
<defs><marker id="arr1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
<g fill="none" stroke="currentColor" stroke-width="2">
<rect x="10" y="62" width="170" height="68" rx="10"/>
<rect x="275" y="62" width="170" height="68" rx="10"/>
<rect x="540" y="62" width="170" height="68" rx="10"/>
<rect x="215" y="170" width="290" height="46" rx="10" stroke-dasharray="6 5"/>
<path d="M182 96H272" marker-end="url(#arr1)"/>
<path d="M447 96H537" marker-end="url(#arr1)"/>
<path d="M360 132V168" marker-end="url(#arr1)"/>
<path d="M213 193H95V133" marker-end="url(#arr1)"/>
</g>
<g text-anchor="middle" font-size="15" font-weight="600">
<text x="95" y="92">Your app</text><text x="95" y="112" font-weight="400" font-size="13">sends messages + tools</text>
<text x="360" y="92">Claude</text><text x="360" y="112" font-weight="400" font-size="13">replies</text>
<text x="625" y="92">Final answer</text><text x="625" y="112" font-weight="400" font-size="13">stop_reason: end_turn</text>
<text x="360" y="198" font-weight="400" font-size="13">Run your function, send tool_result</text>
<text x="372" y="156" font-weight="400" font-size="13" text-anchor="start">tool_use</text>
<text x="490" y="86" font-weight="400" font-size="13">otherwise</text>
</g>
</svg>
<figcaption>The tool-use loop. Claude never runs your code; it asks, and your program decides what to run.</figcaption>
</figure>

Here is a complete example with a fake order lookup. Swap the function body for a real database call:

```python title="tools.py"
import json
import anthropic

MODEL = "claude-sonnet-5-5"
client = anthropic.Anthropic()

tools = [
    {
        "name": "get_order_status",
        "description": "Look up the shipping status of a customer order by its order ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "order_id": {"type": "string", "description": "The order ID, e.g. A1042"}
            },
            "required": ["order_id"],
        },
    }
]


def get_order_status(order_id: str) -> dict:
    # Replace with a real lookup. This is a stand-in.
    return {"order_id": order_id, "status": "shipped", "eta_days": 2}


messages = [{"role": "user", "content": "Where is order A1042?"}]

response = client.messages.create(model=MODEL, max_tokens=1024, tools=tools, messages=messages)

if response.stop_reason == "tool_use":
    call = next(block for block in response.content if block.type == "tool_use")
    result = get_order_status(**call.input)

    messages.append({"role": "assistant", "content": response.content})
    messages.append(
        {
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "tool_use_id": call.id,
                    "content": json.dumps(result),
                }
            ],
        }
    )
    response = client.messages.create(model=MODEL, max_tokens=1024, tools=tools, messages=messages)

print(response.content[0].text)
```

Notice that you append Claude's full `response.content` as the assistant turn, then answer with a `tool_result` that carries the matching `tool_use_id`. Getting that ID wrong is the most common reason a tool call fails.

> [!TIP]
> In real projects, put the call in a loop: keep calling the API while `stop_reason == "tool_use"`, run each requested tool, and stop when Claude returns a normal answer. Cap the number of rounds so a confused model can't loop forever on your bill.

## Handle errors and rate limits

Networks fail and APIs push back when you send too much too fast. The SDK already retries connection errors, rate limits and server errors a couple of times with backoff, and you can change that when you create the client:

```python title="safe_call.py"
import anthropic

client = anthropic.Anthropic(max_retries=4, timeout=60.0)


def ask(prompt: str) -> str:
    try:
        reply = client.messages.create(
            model="claude-sonnet-5-5",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        if reply.stop_reason == "max_tokens":
            return reply.content[0].text + "\n[truncated]"
        return reply.content[0].text
    except anthropic.RateLimitError:
        return "We're sending requests too quickly. Please try again in a moment."
    except anthropic.APIConnectionError:
        return "Couldn't reach the API. Check your connection."
    except anthropic.APIStatusError as err:
        return f"The API returned an error ({err.status_code})."
```

Catch the specific errors first and the general `APIStatusError` last. Log the status code and the request details on your side; show the user a calm, plain message instead of a stack trace.

## Keep costs under control

Cost is tokens in plus tokens out, multiplied by the model's price. You control more of it than you might think:

1. **Pick the smallest model that passes your test.** This is usually the biggest single saving.
2. **Set a sensible `max_tokens`.** It's a ceiling on output you pay for.
3. **Send less.** Trim the history, cut boilerplate from prompts and don't paste whole files when a function will do.
4. **Cache repeated context.** If every request starts with the same long instructions or document, prompt caching lets you reuse it at a reduced rate. See the docs for how to mark cacheable blocks.
5. **Batch the non-urgent work.** If a job can wait, the batch interface is cheaper than real-time calls.
6. **Log usage.** Print `usage.input_tokens` and `usage.output_tokens` for every call while you develop, so a surprise never arrives as an invoice.

## Common mistakes

- **Hard-coding the key.** Use an environment variable or your host's secret store.
- **Ignoring `stop_reason`.** A truncated or tool-requesting reply is not a finished answer.
- **Expecting memory.** If it isn't in `messages`, Claude can't see it.
- **Asking for JSON and trusting it blindly.** Parse with `json.loads` inside a `try` block and validate the fields you need; models occasionally add a stray sentence.
- **Writing one giant prompt.** Split big jobs into steps. Each step is easier to test, cheaper to retry and simpler to fix.

## Where to go next

You now have the core loop that almost every Claude-powered app uses: send messages, read `stop_reason`, run tools when asked, and handle failure. From here:

- Pull structured data out of web pages with the approach in [web scraping with Python and AI](/blog/web-scraping-with-python-and-ai/).
- Not sure Claude is the right model for your job? Read [ChatGPT vs Claude: how to choose for your own work](/blog/chatgpt-vs-claude-how-to-choose/).
- Read the official [API documentation](https://docs.claude.com) for the current model list, rate limits and the full tool-use reference.

If you want one tested workflow like this in your inbox each week, the form below is the way to get it.
