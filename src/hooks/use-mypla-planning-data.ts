import { useCallback, useEffect, useState } from "react";

import { getAssumptions, getProposals, type ApiAssumption } from "@/lib/mypla-api";
import type { AssumptionCheck, Proposal } from "@/lib/mpla-types";

function toAssumptionCheck(item: ApiAssumption): AssumptionCheck {
  return {
    id: item.id,
    question: item.statement,
    context: item.topic.replaceAll("_", " "),
    ...(item.relatedTaskId ? { relatedTaskId: item.relatedTaskId } : {}),
  };
}

export function useMyPlaPlanningData() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [assumptions, setAssumptions] = useState<AssumptionCheck[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [latestProposals, latestAssumptions] = await Promise.all([
        getProposals(),
        getAssumptions(),
      ]);
      setProposals(latestProposals.filter((proposal) => proposal.status === "pending"));
      setAssumptions(latestAssumptions.map(toAssumptionCheck));
      setError(null);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Planning suggestions could not be loaded.";
      setError(message);
      throw cause;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  return { proposals, assumptions, error, loading, refresh };
}
