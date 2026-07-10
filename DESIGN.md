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
│                         MCP Server                              │
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
|`(:Paper)`|`id, title, abstract, published, full_text`|A research paper|
|`(:Author)`|`name`|A paper author|
|`(:Chunk)`|`text, section, chunk_index, embedding`|A searchable text chunk|
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

Generate an embedding for every chunk using OpenAI's embedding model. Store embeddings directly on `(:Chunk)` nodes. Create Neo4j vector index on `(:Chunk).embedding`.

The References section is **not chunked** — it is only used for citation extraction in Phase 3.

### Phase 6 — MCP Server

Expose the Neo4j graph as an MCP server with typed tools. The AI assistant calls these tools autonomously during a conversation to retrieve and traverse the knowledge graph.

---

## Project Structure

```
GraphScholar/
│
├── src/
│   │
│   ├── ingestion/
│   │   ├── arxiv.ts          # Fetch paper metadata from ArXiv API
│   │   ├── pdf.ts            # Download PDF, extract text, split sections
│   │   ├── citations.ts      # Parse references, resolve to ArXiv IDs
│   │   ├── concepts.ts       # LLM extraction of concepts from abstracts
│   │   ├── chunker.ts        # Section → chunks logic (400 word threshold)
│   │   └── embedder.ts       # Generate embeddings via OpenAI
│   │
│   ├── graph/
│   │   ├── driver.ts         # Neo4j connection and session management
│   │   ├── schema.ts         # Create indexes and constraints on startup
│   │   ├── nodes.ts          # Create/upsert Paper, Author, Concept, Chunk nodes
│   │   └── relationships.ts  # Create WROTE, CITES, HAS_CHUNK, etc.
│   │
│   ├── mcp/
│   │   ├── server.ts         # MCP server entry point
│   │   └── tools/
│   │       ├── vectorSearch.ts      # Semantic search on Chunk nodes
│   │       ├── getPaper.ts          # Paper + all its relationships
│   │       ├── getCitationChain.ts  # Multi-hop citation traversal
│   │       ├── getConceptPapers.ts  # All papers for a given concept
│   │       └── getAuthorPapers.ts   # All papers by an author
│   │
│   ├── pipeline.ts           # Orchestrates full ingestion for a paper ID
│   └── seed.ts               # Entry point: ingest a list of seed paper IDs
│
├── .env.example
├── docker-compose.yml        # Neo4j instance
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
|Graph DB|Neo4j|Native graph traversal + built-in vector index|
|Embeddings|OpenAI `text-embedding-3-small`|Best quality/cost ratio|
|LLM (concept extraction)|OpenAI `gpt-4o-mini`|Cheap, fast, great at structured output|
|PDF extraction|`pdfjs-dist`|Pure JS, no system dependencies|
|MCP SDK|`@modelcontextprotocol/sdk`|Official MCP server implementation|
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

# OpenAI (embeddings + concept extraction)
OPENAI_API_KEY=your_openai_key

# Ingestion settings
CHUNK_WORD_LIMIT=400          # sections above this get split into multiple chunks
CHUNK_OVERLAP_WORDS=40        # overlap between chunks to preserve context
EMBEDDING_MODEL=text-embedding-3-small
CONCEPT_MODEL=gpt-4o-mini
MAX_CITATION_DEPTH=2          # how many hops to follow citations automatically
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker Desktop
- OpenAI API key

### 1. Clone and install

```bash
git clone https://github.com/iikareem/GraphScholar
cd GraphScholar
npm install
```

### 2. Start Neo4j

```bash
docker-compose up -d
# Neo4j browser available at http://localhost:7474
# Default login: neo4j / your_password
```

### 3. Configure environment

```bash
cp .env.example .env
# Fill in your OpenAI API key and Neo4j password
```

### 4. Initialize the graph schema

```bash
npm run schema
# Creates vector index, constraints, and indexes in Neo4j
```

### 5. Ingest seed papers

```bash
npm run seed
# Ingests the default seed list of ~20 Graph RAG / RAG papers
# Takes 5-10 minutes depending on PDF sizes
```

Or ingest a specific paper by ArXiv ID:

```bash
npm run ingest 2310.11511
```

### 6. Start the MCP server

```bash
npm run mcp
# MCP server running on stdio, ready for Claude Desktop or Cursor
```

### 7. Connect to Claude Desktop

Add this to your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "graph-scholar": {
      "command": "node",
      "args": ["/absolute/path/to/GraphScholar/dist/mcp/server.js"]
    }
  }
}
```

Restart Claude Desktop. You should now see the tools available.

---

## Seed Papers (Default)

The default seed list covers the Graph RAG ecosystem so the knowledge graph is self-referential from the start:

|Paper|ArXiv ID|Why included|
|---|---|---|
|Graph RAG (Microsoft)|2310.11511|The core paper this project is about|
|Naive RAG / Advanced RAG survey|2312.10997|RAG foundations|
|Attention Is All You Need|1706.03762|Foundational — appears in most citations|
|RAG for Knowledge-Intensive NLP|2005.11401|Original RAG paper|
|LlamaIndex Knowledge Graph RAG|—|Key framework|
|HippoRAG|2405.14831|Competing graph RAG approach|
|KGRAG|2310.01061|Knowledge graph + RAG|
|LightRAG|2410.05779|Alternative graph RAG implementation|

Adding more papers is one command. The citation graph grows automatically — ingesting one paper will discover and partially ingest the papers it cites.

---

## Roadmap

- [x] ArXiv metadata ingestion
- [x] PDF extraction and section splitting
- [x] Citation graph construction
- [x] LLM concept extraction
- [x] Chunking and embedding pipeline
- [x] Neo4j graph schema and vector index
- [x] MCP server with core tools
- [ ] Incremental ingestion (skip already-ingested papers)
- [ ] Web UI to visualize the graph
- [ ] Support for PDF upload (not just ArXiv)
- [ ] Concept deduplication (merge similar concept nodes)

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