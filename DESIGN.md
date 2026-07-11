# GraphScholar — Design & Architecture

> Detailed technical design doc. For the GitHub-facing overview, quick start, and problem framing, see [README.md](./README.md).

> Graph RAG knowledge base for research papers — Neo4j graph + vector search, exposed via MCP for AI assistants.

---

## What Is This?

**GraphScholar** ingests academic papers, builds a rich knowledge graph in Neo4j, and exposes it as an MCP (Model Context Protocol) server. An AI assistant (Claude, Cursor, etc.) can then use this server to answer questions that go far beyond keyword search — navigating citations, concepts, and author relationships intelligently.

Instead of asking "show me papers about RAG" and getting a flat list, you can ask:

- _"What foundational papers does the Graph RAG paper build on, and what concepts do they share?"_
- _"Which authors have written about both knowledge graphs and LLMs?"_
- _"What methods did the most-cited papers in this dataset use?"_

The AI navigates the graph to answer — not just matching keywords.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Data Ingestion                           │
│                                                                 │
│  ArXiv API ──▶ Metadata    ──▶ Paper, Author, Category nodes   │
│                                                                 │
│  ArXiv PDF ──▶ Text Extract                                     │
│                    │                                            │
│                    ├──▶ Section Split ──▶ Chunking              │
│                    │                        │                   │
│                    │                        ▼                   │
│                    │                   Embeddings ──▶ Chunk nodes│
│                    │                                            │
│                    ├──▶ Reference Parse ──▶ CITES edges         │
│                    │                                            │
│                    └──▶ LLM Extraction ──▶ Concept nodes        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Neo4j Graph                            │
│                                                                 │
│  (:Author)──WROTE──▶(:Paper)──HAS_CHUNK──▶(:Chunk{embedding})  │
│                          │                                      │
│                          ├──CITES──▶(:Paper)                   │
│                          ├──INTRODUCES──▶(:Concept)            │
│                          ├──USES──▶(:Concept)                  │
│                          └──BELONGS_TO──▶(:Category)           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Server (stdio / HTTP)                    │
│                                                                 │
│  vector_search(query)        → relevant chunks by similarity    │
│  get_paper(id)               → paper + all its relationships    │
│  get_citation_chain(id)      → papers this paper cites         │
│  get_concept_papers(concept) → all papers about a concept      │
│  get_author_papers(name)     → all papers by an author         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    Claude / Cursor / Any MCP Client
```

---

## Graph Schema

### Nodes

|Node|Properties|Description|
|---|---|---|
|`(:Paper)`|`id, version, title, abstract, published, updated, pdfUrl`|A research paper|
|`(:Author)`|`name`|A paper author|
|`(:Category)`|`name`|ArXiv category|
|`(:Chunk)`|`id, text, section, chunkIndex, embedding, page?`|A searchable text chunk|
|`(:Concept)`|`name, embedding`|An extracted topic or method|
|`(:Concept)`|`name`|A topic, method, or idea extracted from papers|
|`(:Category)`|`name`|ArXiv category (cs.AI, cs.IR, etc.)|

### Relationships

|Relationship|From → To|Description|
|---|---|---|
|`WROTE`|Author → Paper|Author wrote this paper|
|`HAS_CHUNK`|Paper → Chunk|Paper contains this text chunk|
|`CITES`|Paper → Paper|Paper references another paper|
|`INTRODUCES`|Paper → Concept|Paper introduces this concept|
|`USES`|Paper → Concept|Paper uses this method/concept|
|`BELONGS_TO`|Paper → Category|Paper belongs to this ArXiv category|
|`RELATED_TO`|Concept → Concept|Two concepts are related|

---

## How Graph RAG Works Here

**Basic RAG** (what most apps do):

```
User query → vector search → top-K chunks → LLM → answer
```

**Graph RAG** (what this project does):

```
User query
    │
    ▼
Vector search on (:Chunk) nodes          ← semantic similarity
    │
    ▼
Traverse up to (:Paper) nodes            ← who wrote this?
    │
    ▼
Traverse out to relationships:
    ├── (:Paper)-[:CITES]→(:Paper)        ← what does it build on?
    ├── (:Paper)-[:INTRODUCES]→(:Concept) ← what concepts does it introduce?
    └── (:Author)-[:WROTE]→(:Paper)       ← what else did this author write?
    │
    ▼
Rich combined context → LLM → grounded answer
```

The graph traversal finds relevant information the vector search alone would miss — like a foundational paper that isn't semantically similar to the query but is 2 hops away in the citation graph.

---

## Data Pipeline (Ingestion Flow)

### Phase 1 — Fetch Metadata

Fetch paper metadata from the ArXiv API (title, authors, abstract, categories, published date). Create `(:Paper)`, `(:Author)`, `(:Category)` nodes and `WROTE`, `BELONGS_TO` relationships. No PDF needed for this phase.

### Phase 2 — Download and Extract PDFs

Download PDFs for each paper. Extract raw text using a PDF parser. Split the text into sections based on academic paper structure (Abstract → Introduction → Methodology → Results → Conclusion → References).

### Phase 3 — Build Citation Graph

Parse the References section of each paper. Extract cited paper titles and search ArXiv to find their IDs. Create `(:Paper)` nodes for cited papers and `CITES` relationships. This grows the graph automatically — cited papers can then be ingested themselves.

### Phase 4 — Extract Concepts (LLM)

Send each paper's abstract to an LLM with a prompt that returns structured JSON: which concepts this paper introduces, which methods it uses, and related concepts. Create `(:Concept)` nodes and `INTRODUCES`, `USES`, `RELATED_TO` relationships.

### Phase 5 — Chunk and Embed

For each section of each paper:

- If the section is under 400 words → create 1 `(:Chunk)` node
- If the section is over 400 words → split into paragraph chunks with overlap, each chunk gets a `chunk_index`

Generate an embedding for every chunk via an OpenAI-compatible embedding API (default: local oMLX / bge-m3). Store embeddings on `(:Chunk)` nodes. Create a Neo4j vector index on `(:Chunk).embedding`.

The References section is **not chunked** — it is only used for citation extraction in Phase 3.

### Phase 6 — MCP Server

Expose the Neo4j graph as an MCP server with typed tools. The AI assistant calls these tools during a conversation to retrieve and traverse the knowledge graph.

Two transports share the same tool registration (`createApp.ts`):

| Transport | Entry | Use |
|---|---|---|
| **stdio** | `npm run mcp` → `src/mcp/server.ts` | Cursor / Claude spawn the process |
| **HTTP** | `npm run mcp:http` → `src/mcp/httpServer.ts` | Streamable HTTP at `POST /mcp` |

---

## Project Structure

```
GraphScholar/
├── src/
│   ├── ingestion/
│   │   ├── arxiv.ts          # Fetch paper metadata from ArXiv API
│   │   ├── pdf.ts            # Download PDF, extract text, split sections
│   │   ├── citations.ts      # Parse references, resolve to ArXiv IDs
│   │   ├── concepts.ts       # LLM / light-mode concept extraction
│   │   ├── chunker.ts        # Section → chunks (word limit + overlap)
│   │   ├── chunks.ts         # Embed + persist Chunk nodes
│   │   └── embedder.ts       # OpenAI-compatible embeddings
│   ├── graph/
│   │   ├── model/            # Labels, node/relationship types, schema
│   │   ├── repositories/     # Neo4j persistence
│   │   ├── driver.ts
│   │   └── schema.ts
│   ├── mcp/
│   │   ├── server.ts         # stdio entry
│   │   ├── httpServer.ts     # Streamable HTTP entry
│   │   ├── createApp.ts      # Shared McpServer + registerTools
│   │   ├── registerTools.ts
│   │   ├── context.ts
│   │   ├── tools/            # MCP tool adapters
│   │   └── queries/          # Cypher read helpers
│   ├── config/               # env, AI, papers, ingestion settings
│   ├── pipeline.ts
│   └── seed.ts
├── docs/                     # Excalidraw data-model diagram
├── .env.example
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── README.md
└── DESIGN.md
```

---

## MCP Tools (What the AI Can Call)

### `vector_search`

Finds the most semantically similar chunks to a natural language query.

```
Input:  { query: string, limit?: number }
Output: Array of { chunk_text, section, paper_title, paper_id, similarity_score }
```

### `get_paper`

Returns full details of a paper and all its graph relationships.

```
Input:  { paper_id: string }
Output: { title, abstract, authors, categories, concepts, citations, chunks }
```

### `get_citation_chain`

Traverses the citation graph up to N hops from a paper.

```
Input:  { paper_id: string, depth?: number }
Output: Tree of papers and what they cite
```

### `get_concept_papers`

Returns all papers that introduce or use a given concept.

```
Input:  { concept: string }
Output: Array of papers with their relationship to the concept (INTRODUCES or USES)
```

### `get_author_papers`

Returns all papers in the graph by a given author.

```
Input:  { author_name: string }
Output: Array of papers with title, date, and concepts
```

---

## Tech Stack

|Layer|Technology|Why|
|---|---|---|
|Language|TypeScript|Type safety across the full pipeline|
|Graph DB|Neo4j 5|Native graph traversal + built-in vector indexes|
|Embeddings / LLM|OpenAI-compatible API (oMLX default)|Local or cloud; swap models via env|
|PDF extraction|`pdfjs-dist`|Pure JS, no system dependencies|
|MCP SDK|`@modelcontextprotocol/sdk`|stdio + Streamable HTTP|
|Neo4j driver|`neo4j-driver`|Official Neo4j TypeScript driver|
|Runtime|Node.js 20+|LTS, native fetch, good TS support|
|Local DB|Docker (Neo4j image)|Zero setup for local development|

---

## Environment Variables

```bash
# .env

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password

# AI — oMLX or any OpenAI-compatible server
# INGESTION_LIGHT_MODE=true  → skip LLM/embeddings (POC)
INGESTION_LIGHT_MODE=false
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_API_KEY=your_omlx_api_key
CONCEPT_MODEL=mlx-community/Llama-3.2-1B-Instruct-4bit
EMBEDDING_MODEL=mlx-community/bge-m3-mlx-8bit
EMBEDDING_DIMENSIONS=1024

# Ingestion
CHUNK_WORD_LIMIT=400
CHUNK_OVERLAP_WORDS=40
MAX_CITATION_DEPTH=2

# MCP HTTP (npm run mcp:http)
MCP_HTTP_HOST=127.0.0.1
MCP_HTTP_PORT=3000
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker Desktop
- OpenAI-compatible API for embeddings/concepts (oMLX or OpenAI), or `INGESTION_LIGHT_MODE=true`

### 1. Clone and install

```bash
git clone https://github.com/iikareem/GraphScholar
cd GraphScholar
npm install
```

### 2. Start Neo4j

```bash
docker compose up -d
# Neo4j browser: http://localhost:7474
```

### 3. Configure environment

```bash
cp .env.example .env
# Set NEO4J_PASSWORD and AI models / OPENAI_BASE_URL as needed
```

### 4. Initialize the graph schema

```bash
npm run schema
```

### 5. Ingest seed papers

```bash
npm run seed
# Papers listed in src/config/papers.ts
```

### 6. Start the MCP server

**stdio:**

```bash
npm run mcp
```

**HTTP:**

```bash
npm run mcp:http
# POST http://127.0.0.1:3000/mcp
```

### 7. Connect Cursor / Claude Desktop

stdio example:

```json
{
  "mcpServers": {
    "graph-scholar": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/GraphScholar/src/mcp/server.ts"]
    }
  }
}
```

HTTP example (server must already be running):

```json
{
  "mcpServers": {
    "graph-scholar": {
      "url": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

---

## Seed Papers (Default)

Configured in `src/config/papers.ts`:

|Paper|ArXiv ID|Why included|
|---|---|---|
|Self-RAG|2310.11511|Reflection / retrieval control|
|Advanced RAG survey|2312.10997|RAG foundations|
|Attention Is All You Need|1706.03762|Foundational transformer paper|
|RAG for Knowledge-Intensive NLP|2005.11401|Original RAG paper|
|HippoRAG|2405.14831|Graph-oriented RAG approach|

Add more ArXiv IDs to `PAPER_IDS` and re-run `npm run seed`. Citation resolution can discover additional papers as stubs with `CITES` edges.

---

## Status

This design is implemented end-to-end for the intended scope:

- [x] ArXiv metadata ingestion
- [x] PDF extraction and section splitting
- [x] Citation graph construction
- [x] LLM concept extraction (+ light mode fallback)
- [x] Chunking and embedding pipeline
- [x] Neo4j graph schema and vector indexes
- [x] MCP tools: `get_paper`, `vector_search`, `get_citation_chain`, `get_concept_papers`, `get_author_papers`
- [x] Dual MCP transports (stdio + Streamable HTTP)

---

## Why This Project

Most RAG tutorials store documents in a flat vector database and call it done. This project demonstrates a production-quality approach:

- **Graph modeling** — data is structured as a real knowledge graph, not a collection of text blobs
- **Multi-hop reasoning** — the AI can traverse citations and concept relationships, not just find similar text
- **MCP integration** — the knowledge base is exposed as a first-class AI tool, not just a search endpoint
- **Full TypeScript pipeline** — end to end type safety from ingestion to MCP tool response types

---

## License

MIT