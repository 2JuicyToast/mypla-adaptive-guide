"""Opt-in, privacy-safe diagnostics for MyPLA task parsing."""

import logging
import os
import re
from typing import Any

logger = logging.getLogger(__name__)

_MODEL_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$")
_FINISH_REASONS = {"stop", "length", "content_filter", "tool_calls", "incomplete", "error"}


def log_ai_parse_metadata(
    selected_model: str,
    *,
    http_status: int | None = None,
    finish_reason: Any = None,
    content_empty: bool | None = None,
    json_decode_failed: bool | None = None,
    schema_validation_failed: bool | None = None,
) -> None:
    """Log allow-listed metadata only when development diagnostics are explicitly enabled."""
    if os.getenv("MYPLA_AI_DIAGNOSTICS", "").strip().lower() not in {"1", "true"}:
        return

    model = (
        selected_model
        if isinstance(selected_model, str) and _MODEL_NAME.fullmatch(selected_model)
        else "unrecognized"
    )
    fields = [f"model={model}"]
    if http_status is not None:
        fields.append(f"http_status={int(http_status)}")
    if finish_reason is not None:
        safe_reason = (
            finish_reason
            if isinstance(finish_reason, str) and finish_reason in _FINISH_REASONS
            else "other"
        )
        fields.append(f"finish_reason={safe_reason}")
    if content_empty is not None:
        fields.append(f"content_empty={str(content_empty).lower()}")
    if json_decode_failed is not None:
        fields.append(f"json_decode_failed={str(json_decode_failed).lower()}")
    if schema_validation_failed is not None:
        fields.append(f"schema_validation_failed={str(schema_validation_failed).lower()}")
    logger.info("MyPLA AI parse metadata %s", " ".join(fields))