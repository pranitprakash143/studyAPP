import json, os
from datetime import datetime
from pathlib import Path
from wiki.wiki_compiler import _update_index, _save_index, _load_index, _render_wiki_page, _slugify, WIKI_DIR

WIKI_DIR.mkdir(parents=True, exist_ok=True)
index = _load_index()

mock_data = [
    {
        "title": "Ancient History Overview",
        "subject": "History",
        "slug": "ancient-history-overview",
        "tags": ["ancient", "intro"],
        "connections": [{"topic": "Maurya Empire", "relationship": "followed by"}],
        "key_facts": ["Ancient history covers the earliest periods.", "Includes IVC, Vedic period, etc."],
        "summary": "A brief overview of ancient history.",
        "quick_revision": ["IVC -> Vedic -> Mahajanapadas -> Mauryas"]
    },
    {
        "title": "Maurya Empire",
        "subject": "History",
        "slug": "maurya-empire",
        "tags": ["ancient", "empire"],
        "connections": [{"topic": "Ancient History Overview", "relationship": "part of"}],
        "key_facts": ["Founded by Chandragupta Maurya.", "Ashoka the Great was a famous ruler.", "Dhamma policy was introduced by Ashoka."],
        "summary": "The Maurya Empire was a geographically extensive historical power in ancient India.",
        "quick_revision": ["Chandragupta -> Bindusara -> Ashoka"]
    }
]

for p in mock_data:
    subj_dir = WIKI_DIR / _slugify(p["subject"])
    subj_dir.mkdir(parents=True, exist_ok=True)
    
    meta = {
        "title": p["title"],
        "subject": p["subject"],
        "tags": p["tags"],
        "related": [c["topic"] for c in p["connections"]],
        "sources": ["mock_data.pdf"]
    }
    
    content = _render_wiki_page(meta, p)
    (subj_dir / f"{p['slug']}.md").write_text(content, encoding="utf-8")
    
    index = _update_index(
        index,
        subject=p["subject"],
        title=p["title"],
        slug=p["slug"],
        tags=p["tags"],
        connections=p["connections"],
        sources=["mock_data.pdf"]
    )

_save_index(index)
print("Mock wiki pages created successfully!")
