import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Pagination } from "@/shared/components/Pagination";
import { usePagination } from "@/shared/utils/usePagination";
import { listEvaluationCriteria } from "@/features/admin/api/evaluationCriteriaApi";
import type { EvaluationCriterion, InterviewQueueApplication, PanelEvaluation } from "@/features/admin/types";
import { getMyQueue } from "../api/panelEvaluationsApi";
import { InterviewRow } from "../components/InterviewRow";
import { CriteriaReferencePanel } from "../components/CriteriaReferencePanel";
import { ScoreSummaryPanel } from "../components/ScoreSummaryPanel";

export function MyInterviewsPage() {
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [queue, setQueue] = useState<InterviewQueueApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pagination = usePagination(queue, 10);

  useEffect(() => {
    Promise.all([listEvaluationCriteria(), getMyQueue()])
      .then(([loadedCriteria, loadedQueue]) => {
        setCriteria(loadedCriteria);
        setQueue(loadedQueue);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load your interview queue"))
      .finally(() => setLoading(false));
  }, []);

  function handleSubmitted(applicationId: string, evaluation: PanelEvaluation) {
    setQueue((prev) =>
      prev.map((app) => (app.id === applicationId ? { ...app, panelEvaluations: [evaluation] } : app)),
    );
  }

  if (loading) return <LoadingBlock label="Loading your interview queue..." />;

  return (
    <div>
      <h1>My Interviews</h1>
      <p>Applicants for interview boards you&apos;re assigned to. Score every criterion before saving.</p>
      <ErrorBanner message={error} />

      {criteria.length === 0 && (
        <p>No evaluation criteria have been set up yet. Check back once an admin adds the interview rubric.</p>
      )}

      {criteria.length > 0 && (
        <>
          <CriteriaReferencePanel criteria={criteria} />
          <ScoreSummaryPanel criteria={criteria} queue={queue} />
        </>
      )}

      {criteria.length > 0 && queue.length === 0 && <p>No applicants are currently in the interview stage for your assigned postings.</p>}

      {criteria.length > 0 && queue.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Job posting</th>
                <th>Submitted</th>
                <th>PQE score</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((application) => (
                <InterviewRow
                  key={application.id}
                  application={application}
                  criteria={criteria}
                  onSubmitted={handleSubmitted}
                />
              ))}
            </tbody>
          </table>
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={10}
            onPageChange={pagination.setPage}
          />
        </div>
      )}
    </div>
  );
}
