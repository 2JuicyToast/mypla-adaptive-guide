"""Safe, user-facing error categories for task parsing."""


class TaskParsingError(Exception):
    """Base class for expected task-parsing failures."""


class AIConfigurationError(TaskParsingError):
    """The configured task-parsing provider cannot be used."""


class AIProviderUnavailableError(TaskParsingError):
    """The configured provider failed or could not be reached."""


class AIRateLimitedError(AIProviderUnavailableError):
    """The configured provider rejected a request because of rate limits."""


class InvalidTaskDraftError(TaskParsingError):
    """The provider response did not validate as a MyPLA task draft."""