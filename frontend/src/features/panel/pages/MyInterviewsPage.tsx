import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Pagination } from "@/shared/components/Pagination";
import { usePagination } from "@/shared/utils/usePagination";
import { listCategories } from "@/features/admin/api/categoriesApi";
import type { Category, InterviewQueueApplication, PanelEvaluation } from "@/features/admin/types";
import { getMyQueue } from "../api/panelEvaluationsApi";
import { InterviewRow } from "../components/InterviewRow";
import { CriteriaReferencePanel } from "../components/CriteriaReferencePanel";
import { ScoreSummaryPanel } from "../components/ScoreSummaryPanel";

export function MyInterviewsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [queue, setQueue] = useState<InterviewQueueApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pagination = usePagination(queue, 10);

  useEffect(() => {
    Promise.all([listCategories(), getMyQueue()])
      .then(([loadedCategories, loadedQueue]) => {
        setCategories(loadedCategories);
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

  // Categories with zero scorable criteria (a freshly-added category an
  // admin hasn't finished configuring yet) contribute nothing to score -
  // gate on there being at least one actual criterion/question, not just a
  // category shell existing.
  const hasScorableCriteria = categories.some((category) => category.criteria.length > 0);

  return (
    <div>
      <h1>My Interviews</h1>
      <p>Applicants for interview boards you&apos;re assigned to. Score every criterion/question before saving.</p>
      <ErrorBanner message={error} />

      {!hasScorableCriteria && (
        <p>No categories have been set up yet. Check back once an admin adds the interview rubric.</p>
      )}

      {hasScorableCriteria && (
        <>
          <CriteriaReferencePanel categories={categories} />
          <ScoreSummaryPanel categories={categories} queue={queue} />
        </>
      )}

      {hasScorableCriteria && queue.length === 0 && <p>No applicants are currently in the interview stage for your assigned postings.</p>}

      {hasScorableCriteria && queue.length > 0 && (
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
                  categories={categories}
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
