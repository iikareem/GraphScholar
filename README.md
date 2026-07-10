# GraphScholar

**A Graph RAG knowledge base for research papers — built on Neo4j and exposed to AI assistants via MCP.**

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Neo4j](https://img.shields.io/badge/Neo4j-018BFF?logo=neo4j&logoColor=white)](https://neo4j.com)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-555)](https://modelcontextprotocol.io)

GraphScholar ingests papers from ArXiv, builds a knowledge graph of authors, citations, concepts, and embedded text chunks, then lets Claude, Cursor, or any MCP client query that graph instead of relying on flat keyword or vector search alone.

> For deep architecture notes, ingestion phases, and schema details, see [DESIGN.md](./DESIGN.md).

---

## Table of Contents

- [The Problem with Plain RAG on Research Papers](#the-problem-with-plain-rag-on-research-papers)
- [What Is Graph RAG?](#what-is-graph-rag)
- [What GraphScholar Does](#what-graphscholar-does)
- [How It Works](#how-it-works)
- [Quick Start](#quick-start)
- [Graph Schema](#graph-schema)
- [MCP Tools](#mcp-tools)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Roadmap](#roadmap)
- [License](#license)

---

## The Problem with Plain RAG on Research Papers

Most RAG tutorials treat documents as isolated text blobs in a vector database. That works for FAQs and internal docs. It breaks down for **research literature**, where meaning lives in relationships:

| What you need | What naive RAG gives you |
|---|---|
| "What papers does Graph RAG build on?" | Chunks that *mention* citations, maybe out of context |
| "Who else has written about knowledge graphs **and** LLMs?" | Semantic similarity on paragraphs — misses author overlap |
| "What method did the most-cited paper in this cluster use?" | No way to rank or traverse citation structure |
| "Is this claim grounded in the paper itself or a reference?" | Retrieved chunks may come from the wrong section or paper |

**Concrete failure mode:** You ask about "retrieval-augmented generation with knowledge graphs." Vector search returns paragraphs from three different papers. None of them explain how those papers cite each other, which author introduced which idea, or which paper is foundational vs. a follow-up survey. The LLM fills gaps with plausible-sounding guesses.

Research is not a bag of paragraphs. It is a **graph**: papers cite papers, authors write papers, papers introduce and reuse concepts, and sections carry different kinds of evidence (abstract vs. methodology vs. references).

---

## What Is Graph RAG?

**Graph RAG** combines vector search with **structured graph traversal** so retrieval can follow relationships, not just cosine similarity.

### Naive RAG

```
User question
    → embed query
    → find top-K similar text chunks
    → stuff chunks into LLM prompt
    → answer
```

Fast, simple, and blind to structure.

### Graph RAG (the idea GraphScholar implements)

```
User question
    → vector search on (:Chunk) nodes          ← semantic match on paper text
    → traverse to (:Paper), (:Author), (:Concept)
    → follow [:CITES], [:INTRODUCES], [:USES], [:WROTE]
    → assemble multi-hop context
    → LLM answers with grounded, connected evidence
```

**Why this matters in practice:**

1. **Citation chains** — A paper you retrieved may cite a foundational work that does not share wording with your query but is one hop away in the graph. Graph traversal surfaces it; pure vector search often misses it.

2. **Concept routing** — Papers are linked to extracted concepts (`INTRODUCES`, `USES`). You can find everything related to "graph neural networks" as a concept, not just paragraphs that happen to contain those words.

3. **Provenance** — Chunks are tied to a paper, section, and index. The model can distinguish abstract claims from methodology details.

4. **Author and category context** — You can pivot from one paper to everything else an author wrote, or everything in an ArXiv category, without re-embedding the whole corpus.

Graph RAG does not replace vector search — it **extends** it. GraphScholar stores embeddings on `(:Chunk)` and `(:Concept)` nodes in Neo4j and uses the graph for everything vector search alone cannot see.

---

## What GraphScholar Does

GraphScholar is an end-to-end TypeScript pipeline that:

1. **Fetches** paper metadata from the ArXiv API
2. **Downloads PDFs** and splits them into academic sections (abstract, introduction, methodology, results, conclusion, references)
3. **Builds a citation graph** by parsing references and resolving them to ArXiv IDs
4. **Extracts concepts** from abstracts with an LLM (or a lightweight category-based fallback)
5. **Chunks and embeds** section text, storing vectors on Neo4j nodes
6. **Exposes the graph** as an [MCP](https://modelcontextprotocol.io/) server so AI assistants query it as a native tool

The default seed corpus focuses on the RAG / Graph RAG research line (Self-RAG, RAG surveys, Attention, original RAG, HippoRAG). Ingesting one paper can discover cited papers and grow the graph automatically.

### Example questions an MCP-connected assistant can answer well

- *"What ArXiv papers does Self-RAG cite, and what concepts does it introduce?"*
- *"Summarize the methodology chunks for paper `2310.11511`."*
- *"Which concepts does HippoRAG use vs. introduce?"*
- *"What categories and authors are associated with the RAG survey paper?"*

The assistant calls MCP tools, reads structured graph results, and reasons over them — instead of hallucinating from training data alone.

---

## How It Works

```
 ArXiv API ──► metadata ──► Paper, Author, Category nodes
      │
      ▼
 ArXiv PDF ──► text extract ──► section split ──► chunk ──► embed ──► Chunk nodes
      │                              │
      │                              └── references parse ──► CITES edges
      │
      └── abstract ──► LLM concept extraction ──► Concept nodes + INTRODUCES / USES

                              Neo4j
                                │
                                ▼
                         MCP Server (stdio)
                                │
                                ▼
                    Claude Desktop / Cursor / any MCP client
```

### Ingestion pipeline (per paper)

| Phase | What happens |
|---|---|
| **1. Metadata** | Fetch title, abstract, authors, categories, dates from ArXiv. Create `Paper`, `Author`, `Category` nodes. |
| **2. PDF** | Download PDF, extract text, split into sections. References are kept for citation parsing only — not chunked. |
| **3. Citations** | Parse the references section, resolve titles/IDs to ArXiv, create `CITES` edges (and stub `Paper` nodes for cited works). |
| **4. Concepts** | LLM extracts introduced/used/related concepts from the abstract, or light mode maps ArXiv categories to concepts. |
| **5. Chunks** | Sections under 400 words → one chunk; longer sections → overlapping paragraph windows. Each chunk gets an embedding. |
| **6. MCP** | Tools query the live graph for assistants at conversation time. |

Run the full pipeline for all seed papers:

```bash
npm run seed
```

Add more papers by editing `src/config/papers.ts` and re-running seed.

---

## Quick Start

### Prerequisites

- **Node.js 20+**
- **Docker** (for local Neo4j)
- **An OpenAI-compatible API** for embeddings + concept extraction — [oMLX](https://github.com/ml-explore/mlx) on Apple Silicon is the default in `.env.example`, or point `OPENAI_BASE_URL` at OpenAI

### 1. Clone and install

```bash
git clone https://github.com/iikareem/GraphScholar.git
cd GraphScholar
npm install
```

### 2. Start Neo4j

```bash
docker compose up -d
```

Neo4j Browser: [http://localhost:7474](http://localhost:7474) — login with `neo4j` and the password from your `.env`.

### 3. Configure environment

```bash
cp .env.example .env
```

**Full pipeline** — set your embedding/LLM endpoint and models:

```bash
OPENAI_BASE_URL=http://localhost:8000/v1   # oMLX or OpenAI
OPENAI_API_KEY=your_key
CONCEPT_MODEL=mlx-community/Llama-3.2-1B-Instruct-4bit
EMBEDDING_MODEL=mlx-community/bge-m3-mlx-8bit
EMBEDDING_DIMENSIONS=1024
NEO4J_PASSWORD=your_password
```

**Light mode (no LLM, no embeddings)** — useful for testing graph structure on limited RAM:

```bash
INGESTION_LIGHT_MODE=true
```

Light mode uses ArXiv categories as stand-in concepts and skips embedding generation.

### 4. Initialize schema

```bash
npm run schema
```

Creates uniqueness constraints, btree indexes, and vector indexes on `Chunk.embedding` and `Concept.embedding`.

### 5. Ingest papers

```bash
npm run seed
```

Ingests the default paper list in `src/config/papers.ts`. Expect several minutes per paper (PDF download, citation resolution, API calls).

### 6. Start the MCP server

```bash
npm run mcp
```

The server speaks MCP over **stdio**. Logs go to stderr; do not wrap it in a tool that captures stdout.

### 7. Connect to Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "graph-scholar": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/GraphScholar/src/mcp/server.ts"],
      "env": {
        "NEO4J_URI": "bolt://localhost:7687",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_PASSWORD": "your_password"
      }
    }
  }
}
```

Restart Claude Desktop. The `get_paper` tool should appear in the tools list.

### Default seed papers

| ArXiv ID | Paper |
|---|---|
| `2310.11511` | Self-RAG |
| `2312.10997` | Advanced RAG survey |
| `1706.03762` | Attention Is All You Need |
| `2005.11401` | Retrieval-Augmented Generation for Knowledge-Intensive NLP |
| `2405.14831` | HippoRAG |

---

## Graph Schema

### Nodes

| Label | Key properties | Role |
|---|---|---|
| `Paper` | `id`, `title`, `abstract`, `published`, `pdfUrl` | One ArXiv paper |
| `Author` | `name` | Paper author |
| `Category` | `name` | ArXiv category (e.g. `cs.CL`) |
| `Concept` | `name`, `embedding` | Topic or method extracted from literature |
| `Chunk` | `id`, `text`, `section`, `chunkIndex`, `embedding` | Searchable slice of paper text |

### Relationships

| Type | Pattern | Meaning |
|---|---|---|
| `WROTE` | `Author → Paper` | Authorship |
| `BELONGS_TO` | `Paper → Category` | ArXiv classification |
| `HAS_CHUNK` | `Paper → Chunk` | Text segment belonging to a paper |
| `CITES` | `Paper → Paper` | Bibliographic citation |
| `INTRODUCES` | `Paper → Concept` | Paper introduces this idea |
| `USES` | `Paper → Concept` | Paper applies this method/concept |
| `RELATED_TO` | `Concept → Concept` | Related ideas (LLM-extracted) |

---

## MCP Tools

| Tool | Status | Description |
|---|---|---|
| `get_paper` | **Available** | Paper metadata plus authors, categories, cited IDs, concepts, and chunk count |
| `vector_search` | Scaffolded | Semantic search over chunk embeddings |
| `get_citation_chain` | Scaffolded | Multi-hop citation traversal |
| `get_concept_papers` | Scaffolded | Papers that introduce or use a concept |
| `get_author_papers` | Scaffolded | All papers by an author |

### `get_paper`

```json
{ "paper_id": "2310.11511" }
```

Returns:

```json
{
  "id": "2310.11511",
  "title": "...",
  "abstract": "...",
  "authors": ["..."],
  "categories": ["cs.CL"],
  "citedPaperIds": ["..."],
  "introduces": ["..."],
  "uses": ["..."],
  "chunkCount": 42
}
```

Additional tools are implemented under `src/mcp/tools/` and will be registered in `registerTools.ts` as the server matures. See [DESIGN.md](./DESIGN.md) for the full intended tool surface.

---

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `NEO4J_URI` | `bolt://localhost:7687` | Neo4j Bolt endpoint |
| `NEO4J_USERNAME` | `neo4j` | Database user |
| `NEO4J_PASSWORD` | — | Database password |
| `INGESTION_LIGHT_MODE` | `false` | Skip LLM/embeddings; use categories as concepts |
| `OPENAI_BASE_URL` | `http://localhost:8000/v1` | OpenAI-compatible API base |
| `OPENAI_API_KEY` | — | API key for embedding/LLM server |
| `CONCEPT_MODEL` | — | Model for concept extraction |
| `EMBEDDING_MODEL` | — | Model for text embeddings |
| `EMBEDDING_DIMENSIONS` | `1024` | Vector size (must match model + Neo4j index) |
| `CHUNK_WORD_LIMIT` | `400` | Max words per chunk before splitting |
| `CHUNK_OVERLAP_WORDS` | `40` | Overlap between consecutive chunks |
| `MAX_CITATION_DEPTH` | `2` | Citation follow depth during ingestion |

---

## Project Structure

```
GraphScholar/
├── src/
│   ├── ingestion/          # ArXiv fetch, PDF parse, citations, concepts, chunks
│   ├── graph/
│   │   ├── model/          # Node/relationship TypeScript types
│   │   ├── repositories/   # Neo4j persistence layer
│   │   ├── driver.ts
│   │   └── schema.ts       # Constraints, indexes, vector indexes
│   ├── mcp/
│   │   ├── server.ts       # MCP entry point (stdio)
│   │   ├── tools/          # MCP tool handlers
│   │   └── queries/        # Cypher query helpers
│   ├── config/             # Env, AI models, seed paper IDs
│   ├── pipeline.ts         # Orchestrates ingestion per paper
│   └── seed.ts             # Batch ingest from config
├── docker-compose.yml      # Local Neo4j 5
├── DESIGN.md               # Detailed architecture & design doc
└── .env.example
```

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript | End-to-end types from ingestion to MCP responses |
| Graph DB | Neo4j 5 | Native graph queries + built-in vector indexes |
| Protocol | MCP (`@modelcontextprotocol/sdk`) | Standard tool interface for Claude, Cursor, etc. |
| PDF | `pdfjs-dist` | Pure JS extraction, no system deps |
| ArXiv | ArXiv API + `fast-xml-parser` | Metadata and PDF sources |
| Embeddings / LLM | OpenAI-compatible API (oMLX default) | Local or cloud; swap models via env |
| Runtime | Node.js 20+ | Native fetch, ESM, `tsx` for dev scripts |

---

## Roadmap

- [x] ArXiv metadata ingestion
- [x] PDF extraction and section splitting
- [x] Citation graph construction
- [x] LLM concept extraction (+ light mode fallback)
- [x] Chunking and embedding pipeline
- [x] Neo4j schema with vector indexes
- [x] MCP server with `get_paper`
- [ ] Register remaining MCP tools (`vector_search`, `get_citation_chain`, …)
- [ ] Incremental ingestion (skip already-ingested papers)
- [ ] Single-paper CLI ingest command
- [ ] Web UI for graph visualization
- [ ] PDF upload support (non-ArXiv sources)
- [ ] Concept deduplication across similar names

---

## Why This Project Exists

Most RAG demos stop at "put PDFs in Pinecone." GraphScholar shows what changes when you model research as a **knowledge graph**:

- Citations become traversable edges, not footnotes buried in chunk text
- Concepts become first-class nodes you can query across papers
- Embeddings live on structured nodes with paper/section metadata
- AI assistants access the graph through MCP as a proper tool, not a one-off script

It is a reference implementation you can run locally, extend with your own paper corpus, and connect to any MCP client.

---

## License

MIT
