import re
from collections import Counter
import string

class HeuristicStructureExtractor:
    """
    A robust, zero-LLM local heuristic and algorithmic extractor that replaces
    the AI structure analysis in the StudyApp ingestion pipeline.
    It matches the exact output format and IngestionState schema.
    """

    # 1. Document Type Heuristics
    DOC_TYPE_KEYWORDS = {
        "textbook_chapter": ["chapter", "principles", "exercises", "introduction to", "theories", "foundation"],
        "lecture_notes": ["lecture", "slides", "professor", "class notes", "week", "semester", "syllabus"],
        "exam_paper": ["exam", "question", "quiz", "midterm", "final", "multiple choice", "points", "marks"],
        "research_paper": ["abstract", "introduction", "methodology", "results", "discussion", "conclusion", "references", "journal", "cite"],
        "article": ["published", "reporter", "news", "author", "editorial", "opinion"]
    }

    # Stopwords list for Key Theme Extraction
    STOPWORDS = {
        "the", "a", "an", "and", "or", "but", "if", "because", "as", "what", "how", "why",
        "of", "at", "by", "for", "with", "about", "against", "between", "into", "through",
        "during", "before", "after", "above", "below", "to", "from", "up", "down", "in", "out",
        "on", "off", "over", "under", "again", "further", "then", "once", "here", "there",
        "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most",
        "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than",
        "too", "very", "s", "t", "can", "will", "just", "don", "should", "now", "is", "was",
        "are", "were", "be", "been", "being", "have", "has", "had", "having", "do", "does",
        "did", "doing", "would", "could", "should", "them", "their", "theirs", "themselves",
        "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself",
        "they", "we", "us", "our", "ours", "ourselves", "you", "your", "yours", "yourself",
        "yourselves", "i", "me", "my", "myself", "this", "that", "these", "those"
    }

    @classmethod
    def classify_document_type(cls, text: str) -> str:
        """Classifies document type by scanning the first 4000 characters for keywords."""
        sample = text[:4000].lower()
        scores = {k: 0 for k in cls.DOC_TYPE_KEYWORDS.keys()}
        
        for doc_type, keywords in cls.DOC_TYPE_KEYWORDS.items():
            for kw in keywords:
                # Count keyword matches using word boundaries
                matches = len(re.findall(rf"\b{re.escape(kw)}\b", sample))
                scores[doc_type] += matches
        
        max_score = max(scores.values())
        if max_score > 0:
            best_types = [k for k, v in scores.items() if v == max_score]
            return best_types[0]
        return "textbook_chapter"  # default fallback

    @classmethod
    def extract_chapters_and_subtopics(cls, text: str) -> list[dict]:
        """
        Parses the text line by line to build a nested hierarchy of chapters and subtopics
        with accurate character offsets.
        """
        lines = text.split("\n")
        chapters = []
        current_chapter = None
        current_subtopic = None
        
        # Regex patterns for chapters (Level 1)
        chapter_patterns = [
            re.compile(r"^(?:#{1,2})\s+(.+)"),                  # Markdown H1 or H2
            re.compile(r"^[A-Z][A-Z\s]{4,60}$"),                # ALL CAPS lines
            re.compile(r"^\d+[\.\)]\s+[A-Z].{4,80}$"),          # Numbered headings (e.g. 1. Introduction)
            re.compile(r"^(?:Chapter|Section|Part|Module)\s+\d+[\.\-\:]?\s*(.*)", re.IGNORECASE)
        ]
        
        # Regex patterns for subtopics (Level 2)
        subtopic_patterns = [
            re.compile(r"^(?:###)\s+(.+)"),                     # Markdown H3
            re.compile(r"^\d+\.\d+\s+([A-Z].{4,80})$")         # Sub-numbered heading (e.g. 1.1 First Section)
        ]

        char_offset = 0
        for line in lines:
            stripped = line.strip()
            line_len = len(line) + 1 # account for \n
            
            if not stripped:
                char_offset += line_len
                continue

            # Check if this is a Chapter heading (Level 1)
            is_chapter = False
            chapter_title = ""
            for pattern in chapter_patterns:
                m = pattern.match(stripped)
                if m:
                    is_chapter = True
                    chapter_title = m.group(1).strip() if m.lastindex else stripped
                    # Clean markdown and whitespace
                    chapter_title = re.sub(r"[#*`_]", "", chapter_title).strip()
                    break

            if is_chapter and len(chapter_title) > 2:
                # Close the previous subtopic if active
                if current_subtopic:
                    current_subtopic["end"] = char_offset
                    current_subtopic = None
                
                # Close the previous chapter if active
                if current_chapter:
                    current_chapter["end"] = char_offset
                    chapters.append(current_chapter)
                
                current_chapter = {
                    "title": chapter_title,
                    "start": char_offset,
                    "end": char_offset, # to be closed later
                    "subtopics": []
                }
                char_offset += line_len
                continue

            # Check if this is a Subtopic heading (Level 2)
            is_subtopic = False
            subtopic_title = ""
            for pattern in subtopic_patterns:
                m = pattern.match(stripped)
                if m:
                    is_subtopic = True
                    subtopic_title = m.group(1).strip()
                    subtopic_title = re.sub(r"[#*`_]", "", subtopic_title).strip()
                    break

            if is_subtopic and len(subtopic_title) > 2:
                # Ensure we have an active chapter (auto-create one if none exists)
                if not current_chapter:
                    current_chapter = {
                        "title": "Introduction",
                        "start": 0,
                        "end": char_offset,
                        "subtopics": []
                    }
                
                # Close the previous subtopic if active
                if current_subtopic:
                    current_subtopic["end"] = char_offset
                
                current_subtopic = {
                    "title": subtopic_title,
                    "start": char_offset,
                    "end": char_offset # to be closed later
                }
                current_chapter["subtopics"].append(current_subtopic)
                char_offset += line_len
                continue

            char_offset += line_len

        # Finalize the last nodes
        doc_len = len(text)
        if current_subtopic:
            current_subtopic["end"] = doc_len
        if current_chapter:
            current_chapter["end"] = doc_len
            chapters.append(current_chapter)

        # Fallback if no structure was detected
        if not chapters:
            chapters = [
                {
                    "title": "Full Document",
                    "start": 0,
                    "end": doc_len,
                    "subtopics": []
                }
            ]
            
        return chapters

    @classmethod
    def extract_key_themes(cls, text: str) -> list[str]:
        """
        Extracts key themes by tokenizing, filtering stopwords, and locating high-frequency
        noun-phrases or bi-gram terms.
        """
        # Quick tokenization
        words = re.findall(r"\b[a-zA-Z]{3,20}\b", text.lower())
        filtered_words = [w for w in words if w not in cls.STOPWORDS]
        
        # Unigram counts
        word_counts = Counter(filtered_words)
        
        # Bigram counts (captures phrases like "machine learning")
        bigrams = []
        for i in range(len(filtered_words) - 1):
            bigrams.append(f"{filtered_words[i]} {filtered_words[i+1]}")
        bigram_counts = Counter(bigrams)
        
        # Combine top candidates (prioritizing high-frequency bigrams)
        candidates = []
        for bg, count in bigram_counts.most_common(10):
            if count >= 2:
                candidates.append(bg.title())
                
        for wg, count in word_counts.most_common(15):
            # Avoid adding unigrams that are already part of added bigrams
            if not any(wg in cand.lower() for cand in candidates):
                candidates.append(wg.title())
                
        # Return top 3 to 8 unique themes
        seen = set()
        themes = []
        for c in candidates:
            if c not in seen:
                seen.add(c)
                themes.append(c)
            if len(themes) >= 6:
                break
                
        # Safety fallback
        if not themes:
            themes = ["Overview"]
            
        return themes

    @classmethod
    def extract_glossary(cls, text: str) -> list[str]:
        """
        Extracts key technical terms by looking for bolded text or specific definition patterns
        (e.g., "Term: ...", "Term is defined as...").
        """
        terms = []
        
        # Pattern 1: Bold text followed by a colon or "is/refers to" (Common in Markdown notes)
        bold_patterns = [
            re.compile(r"\*\*([^*]{3,40})\*\*\s*:\s*"),
            re.compile(r"\*\*([^*]{3,40})\*\*\s+(?:is|refers to|means|defines)\b")
        ]
        
        for pattern in bold_patterns:
            matches = pattern.findall(text)
            for m in matches:
                clean_term = m.strip().strip(string.punctuation)
                if len(clean_term) > 2 and clean_term.lower() not in cls.STOPWORDS:
                    terms.append(clean_term)

        # Pattern 2: Sentences starting with Capitalized Terms followed by "is defined as" or "refers to"
        definition_patterns = [
            re.compile(r"\b([A-Z][a-zA-Z\s]{2,30})\s+(?:is defined as|refers to|is a term for)\b")
        ]
        for pattern in definition_patterns:
            matches = pattern.findall(text)
            for m in matches:
                clean_term = m.strip().strip(string.punctuation)
                if len(clean_term) > 2 and clean_term.lower() not in cls.STOPWORDS:
                    terms.append(clean_term)
                    
        # Filter duplicates while maintaining order
        seen = set()
        unique_terms = []
        for t in terms:
            t_title = t.title()
            if t_title not in seen:
                seen.add(t_title)
                unique_terms.append(t_title)
                
        # Limit to 5-15 terms
        final_terms = unique_terms[:15]
        
        # Fallback if no specific definitions detected: pick most frequent long capitalized words
        if len(final_terms) < 5:
            cap_words = re.findall(r"\b([A-Z][a-z]{4,15})\b", text)
            filtered_caps = [w for w in cap_words if w.lower() not in cls.STOPWORDS]
            cap_counts = Counter(filtered_caps)
            for w, count in cap_counts.most_common(15):
                w_title = w.title()
                if w_title not in seen:
                    seen.add(w_title)
                    final_terms.append(w_title)
                if len(final_terms) >= 10:
                    break
                    
        return final_terms

    @classmethod
    def extract_structure(cls, text: str) -> dict:
        """
        Runs the full heuristic analysis suite and returns a structural map matching the
        required JSON output format.
        """
        chapters = cls.extract_chapters_and_subtopics(text)
        doc_type = cls.classify_document_type(text)
        key_themes = cls.extract_key_themes(text)
        glossary = cls.extract_glossary(text)
        
        return {
            "chapters": chapters,
            "document_type": doc_type,
            "key_themes": key_themes,
            "glossary_terms": glossary
        }
