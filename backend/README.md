# MUST Handbook Backend

FastAPI + FAISS + sentence-transformers RAG backend.

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The server auto-builds the FAISS index from the handbook on startup (~30s first time).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/search` | Semantic search — body: `{ "query": "...", "top_k": 6 }` |
| `POST` | `/summarize` | Summarise text — body: `{ "text": "..." }` |
| `GET` | `/sync-web` | Mock web-scraper sync |
| `GET` | `/health` | Health check |

## Handbook file path

The backend looks for the handbook at:
```
../../Downloads/handbook_content.txt
```
(relative to `backend/`), i.e. `~/Downloads/handbook_content.txt`.

Override with env var:
```bash
HANDBOOK_PATH=/path/to/handbook.txt uvicorn main:app --reload
```

## Adding a real LLM to /summarize

In `main.py`, replace `_local_summarize()` with:

```python
import anthropic

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

def _local_summarize(text: str) -> str:
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": f"Дараах ШУТИС гарын авлагын хэсгийг монгол хэлээр товчлон тайлбарла:\n\n{text}"
        }]
    )
    return message.content[0].text
```
