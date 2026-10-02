import json

import httpx
import pytest

from backend.services.ai_errors import (
    AIConfigurationError,
    AIProviderUnavailableError,
    AIRateLimitedError,
    InvalidTaskDraftError,
)
from backend.services.ai_service import AIService
from backend.services.openrouter_task_parser import (
    DEFAULT_OPENROUTER_MODEL,
    OPENROUTER_BASE_URL,
    OpenRouterTaskParser,
)

SAMPLE_DRAFT = {
    "name": "Physics lab",
    "description": "Complete the lab write-up.",
    "course": "Physics",
    "dueDate": "2026-10-08",
    "estimatedMinutes": 120,
    "priority": "high",
    "energyRequired": "medium",
    "category": "Lab",
    "actions": [
        {
            "label": "Review the lab instructions",
            "description": None,
            "estimatedMinutes": 15,
            "energyRequired": "low",
            "parentActionId": None,
        }
    ],
}


def mock_client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def completion_response(content):
    return httpx.Response(
        200,
        json={"choices": [{"message": {"content": content}}]},
    )


def test_openrouter_returns_a_strict_structured_draft_using_only_task_text():
    captured = {}

    def handler(request):
        captured["request"] = request
        captured["body"] = json.loads(request.content)
        return completion_response(json.dumps(SAMPLE_DRAFT))

    service = AIService(
        OpenRouterTaskParser(
            api_key="unit-test-key",
            model=DEFAULT_OPENROUTER_MODEL,
            http_client=mock_client(handler),
        )
    )
    result = service.parse_task(
        "Physics lab due October 8, 2026, about two hours, and important."
    )

    body = captured["body"]
    assert captured["request"].url == f"{OPENROUTER_BASE_URL}/chat/completions"
    assert captured["request"].headers["authorization"] == "Bearer unit-test-key"
    assert body["model"] == DEFAULT_OPENROUTER_MODEL
    assert body["provider"] == {"require_parameters": True}
    assert body["reasoning"] == {"effort": "minimal", "exclude": True}
    assert body["max_tokens"] == 4096
    assert body["response_format"]["type"] == "json_schema"
    assert body["response_format"]["json_schema"]["strict"] is True
    assert body["response_format"]["json_schema"]["schema"]["additionalProperties"] is False
    assert body["response_format"]["json_schema"]["schema"]["properties"]["actions"]["maxItems"] == 1
    assert len(body["messages"]) == 2
    assert body["messages"][0]["role"] == "system"
    assert body["messages"][-1] == {
        "role": "user",
        "content": "Physics lab due October 8, 2026, about two hours, and important.",
    }
    assert result["provider"] == "openrouter"
    assert result["draft"].name == "Physics lab"
    assert result["draft"].due_date.isoformat() == "2026-10-08"
    assert result["draft"].actions[0].label == "Review the lab instructions"


def test_invalid_model_fields_are_rejected_by_the_existing_pydantic_task_model():
    invalid_draft = {**SAMPLE_DRAFT, "priority": "urgent"}
    service = AIService(
        OpenRouterTaskParser(
            api_key="unit-test-key",
            http_client=mock_client(
                lambda _request: completion_response(json.dumps(invalid_draft))
            ),
        )
    )

    with pytest.raises(InvalidTaskDraftError, match="could not validate"):
        service.parse_task("A synthetic task with a malformed priority.")


def test_ambiguous_task_text_can_return_null_optional_details_without_inventing_them():
    ambiguous_draft = {
        **SAMPLE_DRAFT,
        "course": None,
        "dueDate": None,
        "category": None,
        "actions": [],
        "priority": "medium",
    }
    service = AIService(
        OpenRouterTaskParser(
            api_key="unit-test-key",
            http_client=mock_client(
                lambda _request: completion_response(json.dumps(ambiguous_draft))
            ),
        )
    )

    result = service.parse_task("Work on something for class soon.")

    assert result["draft"].course is None
    assert result["draft"].due_date is None
    assert result["draft"].category is None
    assert result["draft"].actions == []


def test_malformed_model_json_is_rejected_without_returning_raw_provider_content():
    service = AIService(
        OpenRouterTaskParser(
            api_key="unit-test-key",
            http_client=mock_client(lambda _request: completion_response("{not json")),
        )
    )

    with pytest.raises(AIProviderUnavailableError) as raised:
        service.parse_task("A synthetic task.")

    assert "not json" not in str(raised.value)


def test_provider_errors_become_safe_unavailable_errors():
    service = AIService(
        OpenRouterTaskParser(
            api_key="unit-test-key",
            http_client=mock_client(
                lambda _request: httpx.Response(
                    503,
                    json={"error": {"message": "upstream diagnostic text"}},
                )
            ),
        )
    )

    with pytest.raises(AIProviderUnavailableError) as raised:
        service.parse_task("A synthetic task.")

    assert "upstream diagnostic text" not in str(raised.value)


def test_provider_rate_limit_has_a_distinct_safe_error():
    service = AIService(
        OpenRouterTaskParser(
            api_key="unit-test-key",
            http_client=mock_client(
                lambda _request: httpx.Response(
                    429,
                    json={"error": {"message": "upstream rate-limit diagnostic"}},
                )
            ),
        )
    )

    with pytest.raises(AIRateLimitedError) as raised:
        service.parse_task("A synthetic task.")

    assert "upstream rate-limit diagnostic" not in str(raised.value)
    assert "rate limited" in str(raised.value)


def test_missing_openrouter_key_fails_before_making_a_request(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    requests = []
    parser = OpenRouterTaskParser(
        http_client=mock_client(
            lambda request: requests.append(request)
            or completion_response(json.dumps(SAMPLE_DRAFT))
        )
    )

    with pytest.raises(AIConfigurationError):
        AIService(parser).parse_task("A synthetic task.")

    assert requests == []