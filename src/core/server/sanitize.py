import re

_EMOJI_PATTERN = re.compile(
    "["
    "\U0001f300-\U0001faff"
    "\U00002600-\U000027bf"
    "\U0001f1e6-\U0001f1ff"
    "\U00002190-\U000021ff"
    "\U00002b00-\U00002bff"
    "\U0000fe00-\U0000fe0f"
    "\U0000200d"
    "]+",
    flags=re.UNICODE,
)


def sanitize_for_tts(text: str) -> str:
    """Strip emojis and markdown so the TTS engine never reads symbols aloud."""
    if not text:
        return ""

    text = _EMOJI_PATTERN.sub("", text)

    text = re.sub(r"```[\s\S]*?```", " ", text)
    text = text.replace("`", "")

    text = re.sub(r"[*_#>]", "", text)
    text = re.sub(r"^\s*[-•]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)

    text = text.replace("—", ", ").replace("–", ", ")
    text = text.replace("“", "").replace("”", "").replace("’", "'")

    text = re.sub(r"\s+", " ", text).strip()

    return text
