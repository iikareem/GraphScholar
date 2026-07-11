# GraphScholar — Learning Notes

A comprehensive study guide of what this project teaches: Graph RAG, Neo4j, embeddings, MCP, and the design patterns used to build it. Use this as a revision document—highlight what you want to retain.

---

## Table of Contents

1. [Big Picture](#1-big-picture)
2. [Naive RAG vs Graph RAG](#2-naive-rag-vs-graph-rag)
3. [System Architecture & Design Patterns](#3-system-architecture--design-patterns)
4. [The Knowledge Graph Model](#4-the-knowledge-graph-model)
5. [Ingestion Pipeline (Phases 1–5)](#5-ingestion-pipeline-phases-15)
6. [Chunking & Overlap](#6-chunking--overlap)
7. [Embeddings & Vectorization](#7-embeddings--vectorization)
8. [Distance / Similarity Metrics](#8-distance--similarity-metrics)
9. [Neo4j Vector Indexes](#9-neo4j-vector-indexes)
10. [MCP — Model Context Protocol](#10-mcp--model-context-protocol)
11. [stdio vs HTTP Transports](#11-stdio-vs-http-transports)
12. [Auth Concepts for MCP (Learning Path)](#12-auth-concepts-for-mcp-learning-path)
13. [Cypher & Graph Queries](#13-cypher--graph-queries)
14. [Tool Catalog Built in This Project](#14-tool-catalog-built-in-this-project)
15. [Operational Lessons](#15-operational-lessons)
16. [Glossary](#16-glossary)
17. [Self-Check Questions](#17-self-check-questions)

---

## 1. Big Picture

**GraphScholar** is an end-to-end system that:

1. **Ingests** research papers from ArXiv  
2. **Models** them as a graph in Neo4j (papers, authors, citations, concepts, chunks)  
3. **Embeds** text chunks for semantic search  
4. **Exposes** the graph to AI assistants via **MCP tools**

Core insight: research knowledge is relational. Citations, authorship, and “introduces vs uses a concept” are first-class edges—not buried inside blob text.

```
ArXiv → ingest → Neo4j graph + vectors → MCP tools → Cursor / Claude answers with structure
```

---

## 2. Naive RAG vs Graph RAG

### Naive RAG

```
question → embed → top-K similar chunks → stuff into LLM → answer
```

**Strengths:** simple, fast, good for FAQs.  
**Weaknesses on research papers:**

- Misses “what does this paper cite?”
- Misses author/concept pivots
- Chunks from unrelated papers can mix
- No hop through citation structure

### Graph RAG (what GraphScholar implements)

```
question
  → vector search on Chunk nodes          (semantic)
  → traverse Paper / Author / Concept     (structure)
  → follow CITES / INTRODUCES / USES / WROTE
  → assemble multi-hop context
  → LLM answers with grounded links
```

**Remember:** Graph RAG does **not** replace vector search—it **extends** it.

| Capability | Naive RAG | GraphScholar |
|---|---|---|
| Similar text | Yes | Yes (`vector_search`) |
| Citation chain | Hard | `CITES` + `get_citation_chain` |
| Author’s other papers | Hard | `WROTE` + `get_author_papers` |
| Concept membership | Keyword luck | `INTRODUCES` / `USES` |
| Section provenance | Maybe metadata | Chunk has `section` |

---

## 3. System Architecture & Design Patterns

### Layered architecture

| Layer | Responsibility | Examples |
|---|---|---|
| **Entry / orchestration** | Wire deps, run flows | `seed.ts`, `pipeline.ts`, `mcp/server.ts` |
| **Use case / adapter** | Protocol or phase logic | `ingestChunks`, MCP tool handlers |
| **Domain queries** | Read shaping | `mcp/queries/*` |
| **Data access** | Neo4j Cypher writes/reads | `repositories/*` |
| **Infrastructure** | Driver, env, AI client | `driver.ts`, `config/*`, `embedder.ts` |

### Patterns you practiced

**1. Pipeline / phase orchestration**  
`runPipeline` sequences phases; no business Cypher inside the orchestrator.

**2. Repository pattern**  
Repositories own Neo4j write (and can own reads). Upsert + link methods (`linkCites`, `linkHasChunk`). Shared by seed and (optionally) MCP.

**3. Adapter pattern (MCP tools)**  
Tool file = MCP contract (name, description, Zod schema) + thin handler. Heavy work lives in queries/repos/embedder.

**4. Shared context / DI-lite**  
`McpContext { session, repos }` created once, passed into tools—avoids globals.

**5. Factory**  
`createMcpServer(ctx)` builds server + registers tools for both stdio and HTTP.

**6. Stateless vs stateful HTTP**  
Stateless: new `McpServer` per `POST /mcp` (simple; good for per-request auth filtering).  
Stateful: session IDs reuse one server (more bookkeeping).

### Important distinction (queries vs repos)

- **Embedding + MCP formatting** = application/protocol logic (not “why Cypher left the repo”).  
- **Cypher** = data access (fits repository).  
- `mcp/queries/` was a pragmatic learning split; long-term, Neo4j reads can live in repositories too.

**Rule of thumb:**

```
Tool handler  → validate args, format MCP content blocks
Service step  → embedText(query)
Repository    → Cypher only
```

---

## 4. The Knowledge Graph Model

### Nodes

| Label | Role | Key properties |
|---|---|---|
| `Paper` | ArXiv paper | `id`, `title`, `abstract`, `pdfUrl`, dates |
| `Author` | Person | `name` |
| `Category` | ArXiv category | `name` (e.g. `cs.CL`) |
| `Concept` | Topic / method | `name`, `embedding` |
| `Chunk` | Searchable text slice | `id`, `section`, `text`, `chunkIndex`, `embedding` |

### Relationships

| Type | Pattern | Meaning |
|---|---|---|
| `WROTE` | Author → Paper | Authorship |
| `BELONGS_TO` | Paper → Category | Classification |
| `HAS_CHUNK` | Paper → Chunk | Text segment |
| `CITES` | Paper → Paper | Bibliography |
| `INTRODUCES` | Paper → Concept | Paper introduces idea |
| `USES` | Paper → Concept | Paper applies idea |
| `RELATED_TO` | Concept → Concept | Related ideas |

### Design choices worth remembering

- Abstract lives on `Paper` for display; searchable abstract is also a **Chunk** with `section: "abstract"`.  
- References section is **parsed for CITES**, not chunked for RAG.  
- Chunk IDs: `{paperId}:{section}:{chunkIndex}`.

---

## 5. Ingestion Pipeline (Phases 1–5)

| Phase | Input | Output |
|---|---|---|
| **1. Metadata** | ArXiv ID | Paper, Author, Category + `WROTE`, `BELONGS_TO` |
| **2. PDF** | `pdfUrl` | Sections (abstract … references) |
| **3. Citations** | References text | Cited papers + `CITES` |
| **4. Concepts** | Abstract (+ LLM) | Concept nodes + `INTRODUCES` / `USES` / `RELATED_TO` |
| **5. Chunks** | Sections | Chunk nodes + embeddings + `HAS_CHUNK` |

**Light mode:** skip LLM/embeddings (placeholders / category-as-concept)—good for low-RAM POCs; **not** good for real `vector_search`.

**MERGE / upsert:** re-running seed should not duplicate unique nodes (constraints on `id` / `name`).

---

## 6. Chunking & Overlap

### Why chunk?

Embedding models have context limits; retrieval needs passages, not whole papers.

### Rules used

- `CHUNK_WORD_LIMIT` (default 400)  
- `CHUNK_OVERLAP_WORDS` (default 40)  
- Sections ≤ limit → **one chunk**  
- Longer → paragraph-based split; next chunk starts with **last N words** of previous  
- Huge paragraphs → sliding word window  

### Overlap: why?

Without overlap, ideas on boundaries split across chunks; neither chunk retrieves well.  
Overlap = recall quality vs more embeddings/storage.

**Independent chunks** (`overlap = 0`): simpler, fewer vectors, more boundary risk.

---

## 7. Embeddings & Vectorization

### What is an embedding?

A **dense numeric vector** (e.g. 1024 floats) representing meaning of text. Similar meanings → vectors close in space.

```
"self-reflective retrieval"  →  [0.02, -0.11, …]  (1024 dims)
```

### Pipeline

1. Normalize text (whitespace)  
2. Call embedding model (OpenAI-compatible `/embeddings`)  
3. Validate length == `EMBEDDING_DIMENSIONS`  
4. Store on node property `embedding`  

### Critical ops lesson

**Index dimensions must match model output.**  
Example bug: Neo4j index at 1536, bge-m3 at 1024 → queries fail or are meaningless.  
Fix: drop/recreate vector indexes; re-embed if old vectors wrong size.

### Models in this project (example)

- Embedding: `bge-m3` @ **1024** dims via oMLX  
- Concepts: small instruct LLM for JSON extraction  

Same embedding model for **ingest** and **query** time (`vector_search` embeds the user query the same way).

---

## 8. Distance / Similarity Metrics

Vectors live in high-dimensional space. “Close” needs a metric.

### Cosine similarity (used in GraphScholar / Neo4j config)

\[
\cos(\theta) = \frac{A \cdot B}{\|A\|\|B\|}
\]

- Focuses on **direction**, less on magnitude  
- Range roughly \([-1, 1]\); for embeddings often \([0, 1]\) after normalization  
- Neo4j: `` `vector.similarity_function`: 'cosine' ``  

**Intuition:** two texts about “attention mechanisms” point the same way even if one vector is longer.

### Euclidean distance (L2)

\[
d(A,B) = \sqrt{\sum (A_i - B_i)^2}
\]

- Sensitive to magnitude  
- Common in some ANN libraries when vectors are normalized (then related to cosine)

### Dot product

\[
A \cdot B = \sum A_i B_i
\]

- If vectors are **L2-normalized**, dot product ≡ cosine  
- Fast; used in many GPU retrieval stacks  

### Comparison cheat sheet

| Metric | Good when | Watch out |
|---|---|---|
| **Cosine** | Text semantics, direction matters | Need consistent preprocessing |
| **Euclidean** | Absolute position in space | Scale of vectors matters |
| **Dot product** | Normalized embeddings, speed | Unnormalized → biased by length |

**Retrieval flow:**

```
embed(query) → vector index query (cosine) → top-K Chunk nodes + scores → join Paper metadata
```

Higher score (cosine) ≈ more similar.

---

## 9. Neo4j Vector Indexes

```cypher
CREATE VECTOR INDEX chunk_embeddings IF NOT EXISTS
FOR (c:Chunk) ON (c.embedding)
OPTIONS { indexConfig: {
  `vector.dimensions`: 1024,
  `vector.similarity_function`: 'cosine'
}}
```

Query pattern:

```cypher
CALL db.index.vector.queryNodes('chunk_embeddings', $limit, $queryEmbedding)
YIELD node, score
MATCH (p:Paper)-[:HAS_CHUNK]->(node)
RETURN node.text, p.title, score
```

Also: `concept_embeddings` on `Concept.embedding` (same dimension discipline).

---

## 10. MCP — Model Context Protocol

### What MCP is

A **protocol** for AI hosts (Cursor, Claude) to discover and call **tools** on a server—not a REST resource API.

Message format: **JSON-RPC 2.0**.

| Method | Purpose |
|---|---|
| `initialize` | Handshake |
| `tools/list` | Advertise tools + schemas |
| `tools/call` | Run a tool with arguments |

### Tool contract (four parts)

1. **name** — e.g. `get_paper`  
2. **description** — tells the **model** when to use it  
3. **inputSchema** — types / required fields (Zod → JSON Schema)  
4. **handler** — your code; return `{ content: [{ type: 'text', text: '...' }] }`  

Optional: `outputSchema` (we mostly returned JSON in text content blocks).

### Why Zod?

- Runtime validation before handler  
- TypeScript inference for args  
- SDK converts to JSON Schema for `tools/list`  

### Who picks the tool?

The **LLM** (via the host), using descriptions + schemas—not hard-coded URLs per tool.

### Critical stdio rule

**Never `console.log` in MCP stdio servers**—stdout is the JSON-RPC wire. Use **`console.error`** (stderr).

---

## 11. stdio vs HTTP Transports

| | **stdio** | **HTTP (Streamable)** |
|---|---|---|
| How it runs | Host **spawns** your process | You run a long-lived server |
| Wire | stdin / stdout pipes | `POST /mcp` with JSON-RPC body |
| Cursor config | `command` + `args` | `url` |
| Who starts server? | Cursor | You (`npm run mcp:http`) |
| Typical use | Local IDE | Shared / remote / always-on |

Same tools via shared factory `createMcpServer(ctx)`.

### Stateless HTTP (what we implemented)

Each `POST /mcp`:

1. Create `McpServer`  
2. `registerTools`  
3. Handle request  
4. Tear down  

**Shared across requests:** Neo4j driver/session/context.  
**New each request:** MCP server instance + tool registration (cheap).

### Why no `GET /mcp/tools`?

Tools are listed by JSON-RPC `tools/list` on **`POST /mcp`**, not a separate REST route.

### Stateful HTTP (concept)

`sessionIdGenerator: () => randomUUID()` → client sends session header → reuse one server. Cache is **sessions**, not a manual tool allow-list.

---

## 12. Auth Concepts for MCP (Learning Path)

stdio: trust = local machine / Cursor session. No Bearer on pipes.

HTTP: you can authenticate:

```
POST /auth/login  → access_token
POST /mcp         → Authorization: Bearer … on every call
```

**Per-request tool filtering** (fits stateless create-server-each-time):

```
validate token → user roles → register only allowed tools → handle
```

Still enforce inside handlers (defense in depth).

Streaming (SSE / Streamable HTTP) is **how responses are delivered**; auth is still **headers on the HTTP request**.

OAuth + refresh tokens: in the MCP **spec**; many GUI clients are still catching up—proxies exist as workarounds.

---

## 13. Cypher & Graph Queries

### Patterns you used

- `MERGE` for upserts  
- `OPTIONAL MATCH` for sparse relationships  
- Variable-length paths: `[:CITES*1..depth]` (depth inlined—Neo4j often can’t parameterize hop counts)  
- `collect(DISTINCT …)` for aggregating neighbors  
- `db.index.vector.queryNodes` for semantic search  

### Visualization lesson (Neo4j Browser)

Heavy `OPTIONAL MATCH` + cartesian products + `LIMIT` can hide `Chunk` nodes.  
**Fix:** match/collect chunks first (or query seed papers’ `HAS_CHUNK` directly) so chunks appear in screenshots.

---

## 14. Tool Catalog Built in This Project

| Tool | Job |
|---|---|
| `get_paper` | Paper + authors, categories, cites, concepts, chunkCount |
| `vector_search` | Embed query → chunk vector index → hits + scores |
| `get_citation_chain` | Outbound citation tree up to N hops |
| `get_concept_papers` | Papers that INTRODUCE or USE a concept |
| `get_author_papers` | Papers by author + concepts |

Agents can **chain** tools: search → get_paper → citation_chain.

---

## 15. Operational Lessons

1. Neo4j must be up before MCP.  
2. Seed before querying.  
3. Embedding dims: model ↔ `.env` ↔ vector index.  
4. Same embed model at ingest and query time.  
5. Light mode ≠ real semantic search.  
6. HTTP MCP: start `mcp:http` yourself; stdio: Cursor starts it.  
7. Absolute paths in MCP config if `cwd` is ignored.  
8. Load `.env` from project root (not only `process.cwd()`).  
9. PDF.js font warnings (`TT: undefined function`) are usually non-fatal.  
10. Don’t commit `.env` or machine-local `.cursor/mcp.json` secrets.

---

## 16. Glossary

| Term | Meaning |
|---|---|
| **RAG** | Retrieval-Augmented Generation |
| **Graph RAG** | RAG + graph traversal |
| **Embedding** | Dense vector for text meaning |
| **Vector index** | ANN structure for nearest neighbors |
| **Cosine similarity** | Angle-based similarity between vectors |
| **Chunk** | Passage of paper text stored for retrieval |
| **Overlap** | Shared words between adjacent chunks |
| **MCP** | Model Context Protocol |
| **JSON-RPC** | Request/response envelope (`method`, `params`, `id`) |
| **stdio transport** | MCP over process pipes |
| **Streamable HTTP** | MCP over HTTP POST |
| **MERGE** | Cypher create-if-missing / match |
| **CITES** | Paper→Paper citation edge |
| **oMLX** | Local OpenAI-compatible MLX server |

---

## 17. Self-Check Questions

Use these to test yourself:

1. Why isn’t cosine the same as Euclidean for unnormalized vectors?  
2. Why must ingest and query embeddings use the same model and dimensions?  
3. What breaks if you `console.log` in a stdio MCP server?  
4. Who decides which MCP tool to call—the server or the model?  
5. Why might Neo4j Browser hide Chunk nodes in a “dense” multi-OPTIONAL MATCH query?  
6. What is the difference between advertising tools (`tools/list`) and authorizing a call?  
7. When would you choose overlapping chunks vs independent chunks?  
8. Why does HTTP MCP require you to run the server, unlike stdio in Cursor?  
9. Where should Cypher live in a clean architecture—handler, query module, or repository?  
10. How does Graph RAG fix a failure mode of naive RAG on “what papers does X build on?”

---

## Suggested Highlight Pass

When you reread this file, highlight:

- [ ] Graph RAG vs naive RAG table  
- [ ] Cosine vs Euclidean vs dot product  
- [ ] Dimension mismatch ops lesson  
- [ ] MCP tool contract + Zod  
- [ ] stdio vs HTTP who-starts-the-server  
- [ ] Layered architecture / adapter vs repository  
- [ ] Chunk overlap rationale  
- [ ] Stateless per-request tool filtering for auth  

---

*Derived from building GraphScholar: ingestion → Neo4j → embeddings → MCP (stdio + HTTP). For product docs see `README.md` and `DESIGN.md`.*
