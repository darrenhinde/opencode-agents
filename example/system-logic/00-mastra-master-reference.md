## Mastra Master Reference

This document is a single, practical reference for building with Mastra: agents, workflows, streaming, structured outputs, RAG, evals, and the new Network concepts. It favors concrete, type-safe patterns with Zod, shows end-to-end flows, and highlights operational practices so nothing is left to assumption.

Where APIs evolve, verify against the official docs and examples:
- Website: `https://mastra.ai/`
- GitHub: `https://github.com/mastra-ai/mastra`

### Table of contents
- Setup and project scaffolding
- Conventions for this repo (naming, structure)
- Core concepts (models/providers, agents, tools, workflows, memory, storage, observability)
- Configuration and dependency injection (DI)
- Logging and tracing
- Streaming (token streaming and workflow/run event streaming)
- Structured outputs (schemas with Zod, validated steps and tools)
- RAG (ingestion, chunking, embeddings, vector stores, query tools, agentic RAG)
- Evals (model-graded, rule-based; CI integration)
- Workflows (graph semantics, branching, human-in-the-loop)
- Testing and maintenance (unit, integration, mocking)
- Network (remote tools/agents, service boundaries, security)
- Best practices (performance, safety, cost, ops)
- Intern onboarding checklist
- References

---

## Setup and project scaffolding

Install and scaffold a new Mastra project.

```bash
npm create mastra@latest
cd your-project
npm install
```

Add provider keys to `.env` (only the ones you use):

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...
AZURE_OPENAI_API_KEY=...
COHERE_API_KEY=...

# Optional vector DBs
DATABASE_URL=postgres://user:pass@host:5432/db  # for pgvector
PINECONE_API_KEY=...
QDRANT_URL=...
QDRANT_API_KEY=...
WEAVIATE_URL=...
WEAVIATE_API_KEY=...
```

Recommended repo structure (kebab-case for dirs/files):

```
src/
  agents/
    chef-agent.ts
  tools/
    vector-query-tool.ts
  workflows/
    blog-workflow.ts
  rag/
    ingest.ts
    embed.ts
    stores/
      pgvector.ts
  evals/
    answer-relevancy.ts
  server/
    routes/
      sse-stream.ts
  lib/
    prompts/
    schemas/
```

---

## Conventions for this repo (naming, structure)

- Use PascalCase for components, type definitions, and interfaces.
- Use kebab-case for directories and file names (e.g., `tools/vector-query-tool.ts`).
- Use camelCase for variables, functions, methods, hooks, and props.
- Prefix event handlers with `handle` (e.g., `handleSubmit`).
- Prefix booleans with verbs like `is`, `has`, `can`.
- Keep modules small and single-purpose; group by domain (agents, tools, workflows, rag, evals).
- Store prompts and schemas under `src/lib/` to reuse across agents, tools, and steps.
- Export registries so discoverability stays high:

```ts
// src/lib/registries.ts
export const agents = { /* chefAgent, qaAgent */ };
export const tools = { /* vectorQueryTool, fetchWeatherTool */ };
export const workflows = { /* dataWorkflow, branchingWorkflow */ };
```

---

## Core concepts

### Models and providers
Mastra standardizes access to model providers via the AI SDK ecosystem. Import only what you need and keep it injectable.

```ts
import { openai } from "@ai-sdk/openai";
// Example usage: openai("gpt-4o-mini")
```

Keep model choice configurable (env-driven) for portability and cost control.

### Agents
Agents encapsulate instructions, model config, memory, and available tools. They can also run within workflows.

```ts
import { Agent } from "@mastra/core";
import { openai } from "@ai-sdk/openai";

export const chefAgent = new Agent({
  name: "Chef Agent",
  instructions: "You are Michel, a practical home chef who gives specific, step-by-step cooking advice.",
  model: openai("gpt-4o-mini"),
  // memory: { ... }   // optional long/short-term memory strategies
  // tools: [vectorQueryTool, webSearchTool],
});
```

### Tools
Tools are type-safe functions the agent/workflow can call. Always define schemas to ensure safe inputs/outputs.

```ts
import { createTool } from "@mastra/core";
import { z } from "zod";

export const fetchWeatherTool = createTool({
  id: "fetch-weather",
  description: "Fetch 24h forecast for a city.",
  inputSchema: z.object({ city: z.string().min(1) }),
  outputSchema: z.object({
    city: z.string(),
    forecast: z.array(z.object({ hour: z.number(), tempC: z.number() })),
  }),
  execute: async ({ inputData }) => {
    // Call your API here; sanitize inputs; add retries/timeouts as needed
    const res = await fetch(`https://api.example.com/forecast?city=${encodeURIComponent(inputData.city)}`);
    const data = await res.json();
    return { city: inputData.city, forecast: data.forecast };
  },
});
```

### Workflows
Workflows are durable, graph-based state machines built from steps. Each step has typed input/output and an `execute` function.

```ts
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const fetchDataStep = createStep({
  id: "fetch-data",
  description: "Fetch JSON from a URL",
  inputSchema: z.object({ url: z.string().url() }),
  outputSchema: z.object({ data: z.unknown() }),
  execute: async ({ inputData }) => {
    const res = await fetch(inputData.url);
    return { data: await res.json() };
  },
});

const transformStep = createStep({
  id: "transform",
  description: "Map raw data to normalized form",
  inputSchema: z.object({ data: z.unknown() }),
  outputSchema: z.object({ normalized: z.any() }),
  execute: async ({ inputData }) => {
    // Implement your transformation here
    return { normalized: inputData.data };
  },
});

export const dataWorkflow = createWorkflow({ id: "data-workflow" })
  .then(fetchDataStep)
  .then(transformStep)
  .commit();
```

Features you should leverage:
- Branching/merging (decider steps) for control flow
- Suspend/resume for human-in-the-loop
- Orchestrate agents inside workflows, or expose workflows as tools

### Memory
Use a memory strategy appropriate to your use case (e.g., short-term conversational memory, long-term retrieval memory). Keep memory explicit: size, retention, privacy, and PII handling.

### Storage
Persist workflow runs, step states, and artifacts in your app database. For vectors, use a vector store (see RAG below).

### Observability
Adopt structured logging and distributed tracing early. Ensure every step logs inputs/outputs (redact secrets) and duration. Emit traces around model calls, tool calls, and vector queries.

---

## Configuration and dependency injection (DI)

Keep configuration explicit and validated; pass heavy dependencies in from the edges.

```ts
// src/lib/env.ts
import { z } from "zod";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),
  MODEL_NAME: z.string().optional().default("gpt-4o-mini"),
});

export const env = envSchema.parse(process.env);
```

```ts
// src/lib/clients.ts
import { openai } from "@ai-sdk/openai";
import { env } from "./env";

export function getLLM(model = env.MODEL_NAME) {
  return openai(model);
}
```

Pass clients via execution context or closures rather than importing globally inside steps/tools to simplify testing.

---

## Logging and tracing

Centralize logging and redact sensitive data; include run/step correlation IDs.

```ts
// src/lib/logger.ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: { paths: ["req.headers.authorization", "context.secrets.*"], remove: true },
  transport: process.env.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
});
```

Use in steps/tools:

```ts
import { logger } from "../lib/logger";

const start = Date.now();
logger.info({ stepId: "fetch-data", url: inputData.url }, "step:start");
try {
  const res = await fetch(inputData.url);
  const data = await res.json();
  logger.info({ stepId: "fetch-data", ms: Date.now() - start }, "step:end");
  return { data };
} catch (err) {
  logger.error({ stepId: "fetch-data", err }, "step:error");
  throw err;
}
```

Tracing: emit spans around model calls, vector queries, and remote tools (e.g., OpenTelemetry). Propagate `x-trace-id` across network boundaries and include it in logs.

---

## Streaming

Two common streaming modes:

1) Token streaming from the model to your UI
2) Event streaming of workflow/step progress to your UI

### Token streaming (model → client)

With the `ai` SDK models, stream tokens in your server route and forward to the browser (SSE or WebSocket). Example using SSE:

```ts
// server/routes/sse-stream.ts (Next.js route handler or any Node server)
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userPrompt = url.searchParams.get("q") || "";

  const stream = await streamText({
    model: openai("gpt-4o-mini"),
    prompt: userPrompt,
  });

  return new Response(stream.toAIStream(), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

### Workflow/run event streaming (steps → client)

Stream step lifecycle events to the UI so users see long-running progress. Pattern:

```ts
// Pseudo-API: subscribe to a run's events and forward via SSE/WebSocket
import { dataWorkflow } from "../workflows/data-workflow";

export async function startAndStream(req: Request) {
  const run = dataWorkflow.createRun();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      run.on("event", (evt) => {
        // evt: { stepId, status, startedAt, finishedAt, output? }
        controller.enqueue(encoder.encode(`event: step\ndata: ${JSON.stringify(evt)}\n\n`));
      });
    },
  });

  // Kick off execution
  await run.start({ inputData: { url: "https://api.example.com/data" } });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}
```

Notes:
- Persist run state so reconnects can resume
- Redact secrets before emitting events

---

## Structured outputs

Always make structure explicit with Zod. Validate at step and tool boundaries. Optionally, use model-side object generation when appropriate.

```ts
import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

// Step with strict input/output
export const summarizeStep = createStep({
  id: "summarize",
  inputSchema: z.object({ text: z.string().min(1) }),
  outputSchema: z.object({ title: z.string(), bullets: z.array(z.string()) }),
  execute: async ({ inputData, llm }) => {
    // Use your preferred prompt; keep outputs aligned to schema
    const title = `Summary of ${inputData.text.slice(0, 20)}...`;
    const bullets = ["Bullet 1", "Bullet 2"]; // Replace with LLM call if desired
    return { title, bullets };
  },
});
```

Model-driven object generation (optional pattern) using the `ai` SDK:

```ts
import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

const result = await generateObject({
  model: openai("gpt-4o-mini"),
  schema: z.object({ title: z.string(), bullets: z.array(z.string()) }),
  prompt: "Summarize the following text into a title and 3 bullet points...",
});

// result.object is guaranteed to match the schema
```

Guidelines:
- Keep schemas in `src/lib/schemas/` and import across steps/tools
- Fail fast when parsing invalid outputs; log and retry with guardrails

---

## RAG (Retrieval-Augmented Generation)

A minimal, production-ready RAG pipeline has five parts:
1) Ingestion (load + parse)
2) Chunking (strategy + overlap)
3) Embeddings (batching + rate limits)
4) Vector store (upsert + filter + index)
5) Query tool (embed query + search + rerank) used by an agent/workflow

### Ingestion and chunking

```ts
import { MDocument } from "@mastra/rag";

// From raw text; also support PDFs/HTML/Markdown via appropriate loaders
const doc = MDocument.fromText("Your document content here...");
const chunks = await doc.chunk({
  strategy: "recursive", // keep semantic boundaries
  size: 512,
  overlap: 50,
  separator: "\n",
});
```

### Embeddings

```ts
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

const { embeddings } = await embedMany({
  values: chunks.map((c) => c.text),
  model: openai.embedding("text-embedding-3-small"),
});
```

### Vector store (example: pgvector)

```ts
// src/rag/stores/pgvector.ts
import { PgVector } from "@mastra/pg";

export const pgVector = new PgVector(process.env.DATABASE_URL!);

export async function upsertEmbeddings(indexName: string, vectors: number[][], metadatas: unknown[]) {
  await pgVector.upsert({ indexName, vectors, metadatas });
}

export async function queryEmbeddings(indexName: string, queryVector: number[], topK = 5) {
  return pgVector.query({ indexName, queryVector, topK });
}
```

Stores commonly used with Mastra: pgvector (Postgres), Pinecone, Qdrant, Weaviate, MongoDB Vector. Choose based on latency, filtering, ops comfort, and cost. Keep a unified API in your app so stores are swappable.

### Vector query tool (agentic RAG)

```ts
// src/tools/vector-query-tool.ts
import { createTool } from "@mastra/core";
import { z } from "zod";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { queryEmbeddings } from "../rag/stores/pgvector";

export const vectorQueryTool = createTool({
  id: "vector_query",
  description: "Search relevant chunks from the knowledge base.",
  inputSchema: z.object({ query: z.string(), topK: z.number().int().min(1).max(20).default(5) }),
  outputSchema: z.object({
    results: z.array(
      z.object({ id: z.string().optional(), score: z.number(), text: z.string(), metadata: z.record(z.any()).optional() })
    ),
  }),
  execute: async ({ inputData }) => {
    const { embedding } = await embed({ model: openai.embedding("text-embedding-3-small"), value: inputData.query });
    const raw = await queryEmbeddings("kb-embeddings", embedding, inputData.topK);
    const results = raw.map((r: any) => ({ id: r.id, score: r.score, text: r.text, metadata: r.metadata }));
    return { results };
  },
});
```

### Agent that uses the RAG tool

```ts
import { Agent } from "@mastra/core";
import { openai } from "@ai-sdk/openai";
import { vectorQueryTool } from "../tools/vector-query-tool";

export const qaAgent = new Agent({
  name: "KB QA Agent",
  instructions: "Answer strictly using provided context. If unsure, say you don’t know and suggest next steps.",
  model: openai("gpt-4o-mini"),
  tools: [vectorQueryTool],
});
```

Reranking (optional): add a re-ranker model (or an LLM judging prompt) to improve top-K ordering before final answer generation.

---

## Evals

Evals keep quality measurable during development and CI. Use both rule-based and model-graded checks. Keep datasets versioned.

Recommended approach:
- Define metrics: answer relevancy, context recall, faithfulness, structure validity, toxicity, latency, cost
- Build small eval workflows that take (query, reference, output, context) and return numeric scores with rationales
- Run ad hoc locally during development; run in CI on pull requests with thresholds

Example: a lightweight, model-graded relevancy evaluator step:

```ts
import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export const answerRelevancyEval = createStep({
  id: "answer-relevancy-eval",
  inputSchema: z.object({ question: z.string(), answer: z.string() }),
  outputSchema: z.object({ score: z.number().min(0).max(1), rationale: z.string() }),
  execute: async ({ inputData }) => {
    const prompt = `Rate from 0 to 1 how directly the ANSWER addresses the QUESTION. Provide a brief rationale.\nQUESTION: ${inputData.question}\nANSWER: ${inputData.answer}`;
    const { text } = await generateText({ model: openai("gpt-4o-mini"), prompt });
    // Parse your score and rationale from text (or generate structured JSON via generateObject)
    const match = text.match(/score\s*[:=]\s*(0(\.\d+)?|1(\.0+)?)/i);
    const score = match ? Math.min(1, Math.max(0, Number(match[0].split(/[:=]/)[1]))) : 0;
    return { score, rationale: text };
  },
});
```

Operational tips:
- Store eval results with run metadata (model, prompt revision, dataset version)
- Visualize score trends; fail CI when scores regress beyond thresholds

---

## Workflows (advanced semantics)

Use decider steps for branching and error policy for retries/timeouts. Keep steps small and composable.

```ts
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const decidePath = createStep({
  id: "decide-path",
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ route: z.enum(["A", "B"]) }),
  execute: async ({ inputData }) => ({ route: inputData.value > 0 ? "A" : "B" }),
});

const pathA = createStep({ id: "path-A", inputSchema: z.object({}), outputSchema: z.object({ done: z.literal(true) }), execute: async () => ({ done: true }) });
const pathB = createStep({ id: "path-B", inputSchema: z.object({}), outputSchema: z.object({ done: z.literal(true) }), execute: async () => ({ done: true }) });

export const branchingWorkflow = createWorkflow({ id: "branching" })
  .then(decidePath)
  .after(decidePath)
    .step(pathA)
    .step(pathB)
  .commit();
```

Human-in-the-loop: pause after a step, persist state, await approval/input, then resume. Ensure idempotent steps and durable state to safely retry.

---

## Network (new)

Network refers to composing agents/workflows/tools across service boundaries (process, machine, org). Treat tools as your stable interface and call them over the network with strong typing and auth.

Patterns that map cleanly to Mastra today:
- Expose tools behind HTTP/GraphQL endpoints; call them from `createTool` executors
- Use signed requests, scopes, and rate limits; never pass raw keys to the client
- Maintain a registry (service discovery) mapping tool IDs to network locations; version tool contracts via schemas
- Emit tracing headers across boundaries for end-to-end observability

Example: a tool that calls a remote service (conceptually “network tool”):

```ts
import { createTool } from "@mastra/core";
import { z } from "zod";

export const remoteInvoiceTool = createTool({
  id: "remote-invoice:create",
  description: "Create an invoice in the Accounting Service.",
  inputSchema: z.object({ customerId: z.string(), amountCents: z.number().int().positive() }),
  outputSchema: z.object({ invoiceId: z.string(), status: z.enum(["created", "queued"]) }),
  execute: async ({ inputData, context }) => {
    const res = await fetch(`${process.env.ACCOUNTING_BASE_URL}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${context.secrets.ACCOUNTING_TOKEN}` },
      body: JSON.stringify(inputData),
    });
    if (!res.ok) throw new Error(`Remote error ${res.status}`);
    return res.json();
  },
});
```

Security and governance:
- Validate all inputs with Zod; reject on schema mismatch
- Sign/verify requests (JWT or mTLS); enforce least-privilege scopes per tool
- Log and trace every remote call with correlation IDs

As first-class “Network” capabilities mature in Mastra, prefer official registries, permissioning, and remote tool invocation APIs when available. Until then, the pattern above keeps contracts explicit and safe.

---

## Testing and maintenance (unit, integration, mocking)

Testing pyramid for Mastra apps:
- Unit tests: functions, tools, and steps with mocked dependencies
- Integration tests: workflows end-to-end with test doubles for external HTTP
- Contract tests: schemas for tools and steps validated with sample payloads

Recommended setup (Vitest):

```ts
// src/tools/__tests__/vector-query-tool.test.ts
import { describe, it, expect, vi } from "vitest";
import { vectorQueryTool } from "../vector-query-tool";

vi.mock("../../rag/stores/pgvector", () => ({
  queryEmbeddings: vi.fn(async () => [{ id: "1", score: 0.9, text: "chunk", metadata: { source: "test" } }]),
}));

describe("vectorQueryTool", () => {
  it("returns results from vector store", async () => {
    const out = await vectorQueryTool.execute({ inputData: { query: "hello", topK: 3 } } as any);
    expect(out.results.length).toBeGreaterThan(0);
  });
});
```

HTTP recording: use `nock` or `msw` for deterministic tests. Keep fixtures in `test/fixtures/` and sanitize secrets.

Maintenance:
- Encapsulate provider-specific code in `lib/clients.ts`
- Keep schemas and prompts centralized; version prompts when changed
- Document each agent/tool/workflow with a brief README near the module

---

## Best practices

- Type safety first: every boundary uses Zod; no `any` types
- Keep steps/tools small, pure where possible; avoid hidden state
- Centralize model/provider selection (env) and log model, temperature, maxTokens per call
- RAG: benchmark retrieval; filter by metadata; consider reranking; keep chunking domain-aware
- Streaming: back-pressure and timeouts; redact PII in events
- Evals: store scores and rationales; fail CI on regressions; regularly refresh datasets
- Observability: structured logs, traces around LLM/tool/vector calls
- Cost: track tokens per feature; set budgets/alerts
- Security: sanitize inputs, never expose secrets to clients, rate-limit tools
- Testing: unit-test steps/tools; integration-test workflows; record/replay external HTTP

---

## Intern onboarding checklist

- Read `plan/00-mastra-master-reference.md` end-to-end
- Set up `.env` with only the keys you need; never commit secrets
- Run a local example: start the SSE route and test streaming
- Add a new tool: implement input/output schema, logging, and a unit test
- Add a small workflow: 2–3 steps with a decider; include an integration test
- Build a tiny RAG dataset: ingest 1–2 docs, upsert embeddings, and query via the tool
- Add one eval: model-graded relevancy; wire into a CI job with a basic threshold
- Confirm logs show correlation IDs and durations for steps and model calls

## References

- Mastra site: `https://mastra.ai/`
- Mastra GitHub: `https://github.com/mastra-ai/mastra`
- AI SDK (models, streaming, object generation): `https://sdk.vercel.ai/`
- Vector DBs: pgvector, Pinecone, Qdrant, Weaviate, MongoDB Vector (see vendors for exact client APIs)


