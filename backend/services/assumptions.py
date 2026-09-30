"""Record user feedback without turning uncertain assumptions into facts."""

from fastapi import HTTPException

from backend.database.repository import MemoryRepository, SupabaseRepository
from backend.models import Assumption, AssumptionAnswer, AssumptionResponse, utc_now

Repository = MemoryRepository | SupabaseRepository


class AssumptionService:
    def __init__(self, repository: Repository, user_id: str):
        self.repository = repository
        self.user_id = user_id

    def respond(self, assumption_id: str, response: AssumptionResponse) -> Assumption:
        assumption = self.repository.get_assumption(self.user_id, assumption_id)
        if not assumption:
            raise HTTPException(status_code=404, detail="Assumption not found.")
        if response.correction and response.correction.strip():
            assumption.user_correction = response.correction.strip()
            assumption.statement = response.correction.strip()
            assumption.confidence = "confirmed"
        elif response.answer == AssumptionAnswer.YES:
            assumption.confidence = "confirmed"
        elif response.answer == AssumptionAnswer.NO:
            assumption.confidence = "observed"
        else:
            assumption.confidence = "suggested"
        assumption.updated_at = utc_now()
        return self.repository.save_assumption(assumption)