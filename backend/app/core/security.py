import re
import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

# Control characters filter (preserve newlines, tabs, and normal UTF-8 Indian script chars)
CONTROL_CHAR_REGEX = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

# Explicit Prompt Injection & Jailbreak Attack Patterns
INJECTION_PATTERNS = [
    # System instruction override
    re.compile(r"\bignore\s+(all\s+)?(previous|above|prior)\s+(instructions|directions|prompts|rules)", re.IGNORECASE),
    re.compile(r"\b(disregard|forget)\s+(all\s+)?(previous|above|prior|earlier)\s+(instructions|prompts|rules|context)", re.IGNORECASE),
    re.compile(r"\breset\s+(all\s+)?(instructions|prompts|system\s+directives)", re.IGNORECASE),

    # System prompt exfiltration
    re.compile(r"\b(show|reveal|print|tell|display|output|leak|share|dump)\s+(me\s+)?(your\s+|the\s+)?(system\s+prompt|initial\s+prompt|system\s+instructions|base\s+prompt|raw\s+prompt)", re.IGNORECASE),
    re.compile(r"\bwhat\s+(is|are)\s+your\s+(exact\s+)?(system\s+prompt|system\s+instructions|instructions\s+above)", re.IGNORECASE),
    re.compile(r"\brepeat\s+(the\s+)?(text\s+above|system\s+prompt|instructions\s+verbatim)", re.IGNORECASE),

    # Secrets, credentials & environment leaks
    re.compile(r"\b(reveal|show|print|leak|expose|give|tell)\s+(me\s+)?(your\s+|the\s+)?(api[_\-\s]?key|credentials|secret|mongodb[_\-\s]?uri|jwt[_\-\s]?secret|password|env\b|environment\s+variables)", re.IGNORECASE),
    re.compile(r"\b(what\s+is\s+the\s+api[_\-\s]?key|give\s+me\s+the\s+password)", re.IGNORECASE),

    # Persona & Jailbreak exploits (DAN, developer mode)
    re.compile(r"\byou\s+are\s+now\s+(in\s+)?(developer\s+mode|dan\s+mode|god\s+mode|jailbreak|unrestricted)", re.IGNORECASE),
    re.compile(r"\b(jailbreak|bypass\s+all\s+restrictions|act\s+as\s+an\s+unfiltered\s+ai)", re.IGNORECASE),
    re.compile(r"\b(pretend|act)\s+like\s+you\s+have\s+no\s+(rules|guidelines|morals|ethics|filters)", re.IGNORECASE),

    # Malicious script / payload execution
    re.compile(r"<\s*script[^>]*>", re.IGNORECASE),
    re.compile(r"javascript\s*:\s*", re.IGNORECASE),
    re.compile(r"\b(os\.system|subprocess\.Popen|eval\s*\(|exec\s*\()", re.IGNORECASE),
]

SAFE_INJECTION_RESPONSE = (
    "I am WeatherGPT, an AI assistant dedicated solely to weather, climate, and agro-meteorological advisories. "
    "I cannot fulfill requests to reveal system instructions, alter internal configurations, or execute non-weather commands. "
    "How can I assist you with today's weather forecast?"
)


def sanitize_text(text: str, max_length: int = 1000) -> str:
    """
    Sanitizes user input text:
    - Removes null bytes and harmful control characters.
    - Strips leading/trailing whitespace.
    - Truncates to max_length.
    """
    if not text:
        return ""
    # Strip null bytes and non-printable control chars
    clean = CONTROL_CHAR_REGEX.sub("", text)
    clean = clean.strip()
    return clean[:max_length]


def check_prompt_injection(text: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Evaluates input text against known prompt-injection and instruction-override heuristics.
    
    Returns:
        (is_safe: bool, reason: Optional[str], safe_response: Optional[str])
        - If is_safe is True: input is legitimate, proceed with normal processing.
        - If is_safe is False: input contains suspicious injection pattern, return safe_response.
    """
    if not text:
        return True, None, None

    cleaned = text.strip()

    # Check injection regexes
    for pattern in INJECTION_PATTERNS:
        match = pattern.search(cleaned)
        if match:
            matched_phrase = match.group(0)
            logger.warning(
                f"Prompt injection attempt detected and blocked: '{matched_phrase}'"
            )
            return False, f"Prompt injection pattern: '{matched_phrase}'", SAFE_INJECTION_RESPONSE

    return True, None, None
