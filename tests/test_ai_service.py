import json
from datetime import date, timedelta

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