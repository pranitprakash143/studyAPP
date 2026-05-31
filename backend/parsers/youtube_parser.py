# ─────────────────────────────────────────────────────────────────────────────
# backend/parsers/youtube_parser.py
# Extract transcripts from YouTube URLs using youtube-transcript-api.
# ─────────────────────────────────────────────────────────────────────────────
import logging
import re

logger = logging.getLogger(__name__)


def _extract_video_id(url: str) -> str | None:
    """Extract the 11-character YouTube video ID from any YouTube URL format."""
    patterns = [
        r"(?:v=|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{11})",
        r"^([A-Za-z0-9_-]{11})$",  # bare video ID
    ]
    for pattern in patterns:
        m = re.search(pattern, url)
        if m:
            return m.group(1)
    return None


async def parse_youtube(url: str) -> tuple[str, str]:
    """
    Fetch and return the transcript of a YouTube video.

    Returns:
        (transcript_text, source_name) tuple
    """
    video_id = _extract_video_id(url)
    if not video_id:
        raise ValueError(f"Could not extract video ID from URL: {url}")

    source_name = f"YouTube_{video_id}"

    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound

        try:
            # Prefer English; fall back to auto-generated
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            try:
                transcript = transcript_list.find_manually_created_transcript(["en", "en-US", "en-GB"])
            except NoTranscriptFound:
                transcript = transcript_list.find_generated_transcript(["en", "en-US", "en-GB"])

            entries = transcript.fetch()
            # Join all segments with a space; segments are dicts with 'text', 'start', 'duration'
            text = " ".join(e.get("text", "") for e in entries).strip()

        except TranscriptsDisabled:
            raise ValueError("Transcripts are disabled for this video.")
        except NoTranscriptFound:
            raise ValueError("No English transcript found for this video.")

        logger.info(f"[YouTube Parser] Extracted {len(text)} chars from {video_id}")
        return text, source_name

    except ImportError:
        raise RuntimeError("youtube-transcript-api is not installed.")
