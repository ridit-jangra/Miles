import re
from typing import Literal

Answer = Literal["yes", "no", "unclear"]

YES = {"yes", "yep", "yeah", "yup", "sure", "ok", "okay"}
NO = {"no", "nope", "nah", "nvm", "don't", "dont", "not", "never", "stop", "cancel"}
UNCLEAR = {"wait", "maybe", "but", "however", "actually"}

YES_PHRASES = {("go", "ahead"), ("do", "it")}
UNCLEAR_PHRASES = {("hold", "on"), ("not", "sure")}

NEGATORS = {"not", "don't", "dont", "never"}

MAX_WORDS = 8

def match_phrase(words: list[str], i: int, phrases: set[tuple[str, ...]]) -> int:
    for phrase in phrases:
        if tuple(words[i : i + len(phrase)]) == phrase:
            return len(phrase)
    return 0


def parse_answer(line: str) -> Answer:
    words = re.findall(r"[a-z']+", line.lower())
    if len(words) > MAX_WORDS:
        return "unclear"

    result: Answer = "unclear"
    i = 0
    while i < len(words):
        word = words[i]

        if size := match_phrase(words, i, UNCLEAR_PHRASES):
            result = "unclear"
        elif size := match_phrase(words, i, YES_PHRASES):
            negated = bool(NEGATORS & set(words[max(0, i - 2) : i]))
            result = "no" if negated else "yes"
        elif word in YES:
            negated = bool(NEGATORS & set(words[max(0, i - 2) : i]))
            result = "no" if negated else "yes"
            size = 1
        elif word in NO:
            result = "no"
            size = 1
        elif word in UNCLEAR:
            result = "unclear"
            size = 1
        else:
            size = 1

        i += size
    return result
