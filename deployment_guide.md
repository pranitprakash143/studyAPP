# StudyApp Deployment Guide
*Research on cost-optimized cloud deployment for Next.js, FastAPI, LangGraph, and ChromaDB.*

## Architecture Challenges

Deploying this specific stack involves two major constraints that rule out standard "$0 Serverless" models:

1. **Background AI Tasks:** The backend utilizes `FastAPI BackgroundTasks` to run long-running LangGraph ingestions (parsing PDFs, summarizing, compiling wiki pages). Serverless function providers (Vercel Functions, AWS Lambda, standard Cloud Run) freeze CPU execution the moment the HTTP response is sent, which would instantly kill our ingestion jobs.
2. **ChromaDB Storage:** ChromaDB is fundamentally a disk-based vector database (DuckDB/Parquet under the hood). Most free-tier hosting (like Render Free or Heroku Free) provide *ephemeral* file systems, meaning the vector database would be completely wiped every time the server restarts.

## Evaluated Platforms

### 1. Frontend (Next.js 15)
- **Vercel (Hobby Tier)**: **Recommended.** $0/month. Best native Next.js support, edge caching, and zero-config deployment.
- **Firebase App Hosting**: Improving, but Next.js SSR edge cases can be tricky.
- **AWS Amplify**: Heavier configuration, less forgiving free tier for compute.

### 2. Backend (FastAPI + LangGraph)
- **Railway (Hobby Plan)**: **Recommended.** Flat $5/month limit. Provides persistent Docker environments that don't sleep. Background tasks will run safely.
- **Render (Free Tier)**: $0/month. Sleeps after 15 minutes of inactivity (30-60s cold starts). Ephemeral disk. Background tasks risk being killed on sleep.
- **Vercel Functions/AWS Lambda**: Not viable due to background task freezing and 10s-60s hard timeouts.

### 3. Vector Database (ChromaDB)
- **Railway Volume**: **Recommended.** If hosting the backend on Railway, we can deploy ChromaDB as a second service on the same account with a persistent volume attached. Costs are bundled into the $5/month.
- **Pinecone (Serverless Free)**: $0/month for 1 index. Excellent alternative, but requires refactoring our `chroma_store.py` to use Pinecone instead.
- **Supabase (pgvector)**: $0/month. Excellent, but requires migrating to PostgreSQL and `pgvector` queries.

---

## Final Unified Architectures

### Option A: The "$5/mo No-Headaches" Stack (Highly Recommended)
Keeps the exact current codebase without refactoring databases.
- **Frontend:** Vercel ($0)
- **Backend:** Railway - FastAPI Docker container ($5/mo)
- **Database:** Railway - ChromaDB container with Persistent Volume (shares the $5/mo limit)
- **Pros:** Native Next.js performance, zero cold starts, safe background processing for LangGraph.

### Option B: The "$0/mo Bootstrapper" Stack
Requires refactoring to avoid ephemeral disk loss.
- **Frontend:** Vercel ($0)
- **Backend:** Render Free Tier ($0) 
- **Database:** Pinecone Serverless Free Tier ($0)
- **Pros:** Completely free.
- **Cons:** 30-60 second cold starts for the backend; background tasks may get killed if the app goes idle. MUST refactor ChromaDB code.
