import json
from datetime import date, timedelta

import httpx
import pytest

from backend.services.ai_errors import (
    AIConfigurationError,
    AIProviderUnavailableError,
    AIRateLimitedError,
    IncompleteStructuredOutputError,
    InvalidTaskDraftError,
    MalformedStructuredOutputError,
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


def completion_response(content, *, finish_reason="stop"):
    return httpx.Response(
        200,
        json={
            "choices": [
                {
                    "message": {"content": content},
                    "finish_reason": finish_reason,
                }
            ]
        },
    )


def parse_structured_draft(user_text, draft):
    captured = {}

    def handler(request):
        captured["body"] = json.loads(request.content)
        return completion_response(json.dumps(draft))

    service = AIService(
        OpenRouterTaskParser(
            api_key="unit-test-key",
            http_client=mock_client(handler),
        )
    )
    return service.parse_task(user_text), captured


def next_weekday(weekday):
    today = date.today()
    return today + timedelta(days=(weekday - today.weekday()) % 7)


def test_openrouter_defaults_to_free_router_and_returns_a_strict_structured_draft(
    monkeypatch,
):
    monkeypatch.delenv("OPENROUTER_MODEL", raising=False)
    captured = {}

    def handler(request):
        captured["request"] = request
        captured["body"] = json.loads(request.content)
        return completion_response(json.dumps(SAMPLE_DRAFT))

    service = AIService(
        OpenRouterTaskParser(
            api_key="unit-test-key",
            http_client=mock_client(handler),
        )
    )
    result = service.parse_task(
        "Physics lab due October 8, 2026, about two hours, and important."
    )

    body = captured["body"]
    assert captured["request"].url == f"{OPENROUTER_BASE_URL}/chat/completions"
    assert captured["request"].headers["authorization"] == "Bearer unit-test-key"
    assert body["model"] == "openrouter/free"
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


def test_openrouter_model_environment_override_is_respected(monkeypatch):
    monkeypatch.setenv("OPENROUTER_MODEL", "example/custom-free-model")
    captured = {}

    def handler(request):
        captured["body"] = json.loads(request.content)
        return completion_response(json.dumps(SAMPLE_DRAFT))

    AIService(
        OpenRouterTaskParser(
            api_key="unit-test-key",
            http_client=mock_client(handler),
        )
    ).parse_task("A synthetic task.")

    assert captured["body"]["model"] == "example/custom-free-model"


def test_physics_lab_text_becomes_a_concise_normalized_draft():
    user_text = (
        "I have a physics lab due Thursday. It'll probably take me around two hours "
        "and it's pretty important."
    )
    draft_data = {
        **SAMPLE_DRAFT,
        "name": "Physics lab",
        "description": None,
        "dueDate": next_weekday(3).isoformat(),
        "estimatedMinutes": 120,
        "priority": "high",
        "category": "Lab",
    }

    result, captured = parse_structured_draft(user_text, draft_data)
    draft = result["draft"]
    body = captured["body"]
    schema = body["response_format"]["json_schema"]["schema"]

    assert draft.name == "Physics lab"
    assert draft.course == "Physics"
    assert draft.due_date == next_weekday(3)
    assert draft.estimated_minutes == 120
    assert draft.priority == "high"
    assert draft.category == "Lab"
    assert draft.description is None
    assert "2–8 words" in schema["properties"]["name"]["description"]
    assert "do not copy the full user input" in schema["properties"]["description"]["description"]
    assert "only when explicitly identified" in schema["properties"]["course"]["description"]
    assert "pretty important" in schema["properties"]["priority"]["description"]
    assert "next occurrence" in body["messages"][0]["content"]


def test_english_essay_text_becomes_a_reviewable_task_with_a_useful_first_action():
    user_text = (
        "I need to finish my English essay before Friday. It should take about an hour. "
        "I want to start by writing the introduction."
    )
    draft_data = {
        **SAMPLE_DRAFT,
        "name": "English essay",
        "description": None,
        "course": "English",
        "dueDate": next_weekday(4).isoformat(),
        "estimatedMinutes": 60,
        "priority": "medium",
        "category": "Essay",
        "actions": [
            {
                "label": "Write the introduction",
                "description": None,
                "estimatedMinutes": 20,
                "energyRequired": "medium",
                "parentActionId": None,
            }
        ],
    }

    result, _ = parse_structured_draft(user_text, draft_data)
    draft = result["draft"]

    assert draft.name == "English essay"
    assert draft.name != user_text
    assert draft.due_date == next_weekday(4)
    assert draft.estimated_minutes == 60
    assert draft.actions[0].label == "Write the introduction"
    assert len(draft.actions) == 1
    assert draft.description is None


def test_ambiguous_homework_text_does_not_invent_course_or_exact_deadline():
    user_text = "I have some homework for class sometime this week."
    draft_data = {
        **SAMPLE_DRAFT,
        "name": "Homework",
        "description": None,
        "course": None,
        "dueDate": None,
        "estimatedMinutes": 30,
        "priority": "medium",
        "energyRequired": "medium",
        "category": None,
        "actions": [],
    }

    result, _ = parse_structured_draft(user_text, draft_data)
    draft = result["draft"]

    assert draft.name == "Homework"
    assert draft.course is None
    assert draft.due_date is None
    assert draft.category is None
    assert draft.actions == []


def test_full_natural_language_input_is_normalized_instead_of_becoming_the_task_name():
    user_text = "I need to finish my physics lab by Thursday."
    copied_draft = {
        **SAMPLE_DRAFT,
        "name": user_text,
        "description": user_text,
        "course": "I need to study physics",
        "category": "I have a physics lab",
    }

    result, _ = parse_structured_draft(user_text, copied_draft)
    draft = result["draft"]

    assert draft.name == "Physics lab"
    assert draft.name != user_text
    assert draft.description is None
    assert draft.course is None
    assert draft.category is None


def test_invalid_model_fields_are_rejected_by_the_existing_pydantic_task_model(
    monkeypatch, caplog
):
    monkeypatch.setenv("MYPLA_AI_DIAGNOSTICS", "true")
    invalid_draft = {**SAMPLE_DRAFT, "priority": "urgent"}
    service = AIService(
        OpenRouterTaskParser(
            api_key="unit-test-key",
            http_client=mock_client(
                lambda _request: completion_response(json.dumps(invalid_draft))
            ),
        )
    )

    with caplog.at_level("INFO"):
        with pytest.raises(InvalidTaskDraftError, match="invalid task draft"):
            service.parse_task("A private synthetic task with a malformed priority.")

    assert "schema_validation_failed=true" in caplog.text
    assert "A private synthetic task" not in caplog.text
    assert "urgent" not in caplog.text


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


def test_malformed_model_json_is_rejected_without_returning_raw_provider_content(
    monkeypatch, caplog
):
    monkeypatch.setenv("MYPLA_AI_DIAGNOSTICS", "true")
    calls = 0

    def malformed(_request):
        nonlocal calls
        calls += 1
        return completion_response("{not json")

    service = AIService(
        OpenRouterTaskParser(
            api_key="unit-test-key",
            http_client=mock_client(malformed),
        )
    )

    with caplog.at_level("INFO"):
        with pytest.raises(MalformedStructuredOutputError) as raised:
            service.parse_task("A private synthetic task.")

    assert "not json" not in str(raised.value)
    assert "invalid task draft" in str(raised.value)
    assert calls == 1
    assert "json_decode_failed=true" in caplog.text
    assert "A private synthetic task" not in caplog.text
    assert "{not json" not in caplog.text


def test_empty_completion_retries_once_then_returns_safe_incomplete_error(
    monkeypatch, caplog
):
    monkeypatch.setenv("MYPLA_AI_DIAGNOSTICS", "true")
    calls = 0

    def empty(_request):
        nonlocal calls
        calls += 1
        return completion_response(None)

    service = AIService(
        OpenRouterTaskParser(
            api_key="unit-test-key",
            http_client=mock_client(empty),
        )
    )

    with caplog.at_level("INFO"):
        with pytest.raises(IncompleteStructuredOutputError, match="incomplete response"):
            service.parse_task("A synthetic empty-response task.")

    assert calls == 2
    assert "finish_reason=stop" in caplog.text
    assert "content_empty=true" in caplog.text
    assert "A synthetic empty-response task" not in caplog.text


def test_length_truncation_retries_once_with_the_same_strict_schema():
    calls = 0
    bodies = []

    def incomplete_then_valid(request):
        nonlocal calls
        calls += 1
        bodies.append(json.loads(request.content))
        if calls == 1:
            return completion_response('{"name":"Physics', finish_reason="length")
        return completion_response(json.dumps(SAMPLE_DRAFT))

    service = AIService(
        OpenRouterTaskParser(
            api_key="unit-test-key",
            http_client=mock_client(incomplete_then_valid),
        )
    )

    result = service.parse_task("A synthetic task.")

    assert result["draft"].name == "Physics lab"
    assert calls == 2
    assert bodies[0] == bodies[1]
    assert bodies[0]["response_format"]["type"] == "json_schema"
    assert bodies[0]["response_format"]["json_schema"]["strict"] is True
    assert bodies[0]["provider"] == {"require_parameters": True}


def test_failed_incomplete_retry_stops_after_one_retry():
    calls = 0

    def incomplete_twice(_request):
        nonlocal calls
        calls += 1
        return completion_response('{"name":"', finish_reason="length")

    service = AIService(
        OpenRouterTaskParser(
            api_key="unit-test-key",
            http_client=mock_client(incomplete_twice),
        )
    )

    with pytest.raises(IncompleteStructuredOutputError):
        service.parse_task("A synthetic task.")

    assert calls == 2


def test_retry_does_not_hide_a_provider_outage_or_retry_it_again():
    calls = 0

    def incomplete_then_unavailable(_request):
        nonlocal calls
        calls += 1
        if calls == 1:
            return completion_response('{"name":"', finish_reason="length")
        return httpx.Response(
            503,
            json={"error": {"message": "private upstream diagnostic"}},
        )

    service = AIService(
        OpenRouterTaskParser(
            api_key="unit-test-key",
            http_client=mock_client(incomplete_then_unavailable),
        )
    )

    with pytest.raises(AIProviderUnavailableError) as raised:
        service.parse_task("A synthetic task.")

    assert calls == 2
    assert "private upstream diagnostic" not in str(raised.value)
    assert "temporarily unavailable" in str(raised.value)


def test_opt_in_diagnostics_record_safe_model_and_http_metadata_only(
    monkeypatch, caplog
):
    monkeypatch.setenv("MYPLA_AI_DIAGNOSTICS", "true")
    monkeypatch.delenv("OPENROUTER_MODEL", raising=False)

    def unavailable(_request):
        return httpx.Response(
            503,
            json={"error": {"message": "private upstream diagnostic"}},
        )

    service = AIService(
        OpenRouterTaskParser(
            api_key="unit-test-key",
            http_client=mock_client(unavailable),
        )
    )

    with caplog.at_level("INFO"):
        with pytest.raises(AIProviderUnavailableError):
            service.parse_task("A private synthetic task.")

    assert "model=openrouter/free" in caplog.text
    assert "http_status=503" in caplog.text
    assert "private synthetic task" not in caplog.text
    assert "private upstream diagnostic" not in caplog.text


def test_provider_errors_become_safe_unavailable_errors_and_are_not_retried(
    monkeypatch, caplog
):
    monkeypatch.delenv("MYPLA_AI_DIAGNOSTICS", raising=False)
    calls = 0

    def unavailable(_request):
        nonlocal calls
        calls += 1
        return httpx.Response(
            503,
            json={"error": {"message": "upstream diagnostic text"}},
        )

    service = AIService(
        OpenRouterTaskParser(
            api_key="unit-test-key",
            http_client=mock_client(unavailable),
        )
    )

    with caplog.at_level("INFO"):
        with pytest.raises(AIProviderUnavailableError) as raised:
            service.parse_task("A synthetic task.")

    assert "upstream diagnostic text" not in str(raised.value)
    assert calls == 1
    assert not any(
        record.name == "backend.services.ai_diagnostics" for record in caplog.records
    )


def test_provider_rate_limit_has_a_distinct_safe_error_without_retry():
    calls = 0

    def rate_limited(_request):
        nonlocal calls
        calls += 1
        return httpx.Response(
            429,
            json={"error": {"message": "upstream rate-limit diagnostic"}},
        )

    service = AIService(
        OpenRouterTaskParser(
            api_key="unit-test-key",
            http_client=mock_client(rate_limited),
        )
    )

    with pytest.raises(AIRateLimitedError) as raised:
        service.parse_task("A synthetic task.")

    assert "upstream rate-limit diagnostic" not in str(raised.value)
    assert "rate limited" in str(raised.value)
    assert calls == 1


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