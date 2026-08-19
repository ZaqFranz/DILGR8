import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/shared/api/apiClient";
import { Spinner } from "@/shared/components/Spinner";
import { listJobPostings } from "@/features/job-postings/api/jobPostingsApi";
import type { JobPosting } from "@/features/job-postings/types";
import { Reveal } from "../components/Reveal";

// Mirrors ApplicationStageTracker's STAGE_ORDER - the pipeline actually
// implemented, not the more abstract domain-spec phase list (which has a
// separate "Deliberation" phase that isn't a tracked status; see
// docs/project-memory.md's Known Limitations). Blurbs describe what an
// applicant experiences at each stage, not internal admin mechanics.
const PIPELINE = [
  {
    label: "Application",
    blurb:
      "Register once, build your profile (education, eligibility, documents), then submit an Application Letter to any open posting.",
  },
  {
    label: "Sifting",
    blurb: "Your profile is checked against that posting's qualification standards. Pass, and you move to the exam.",
  },
  {
    label: "Pre-Qualifying Examination",
    blurb: "Qualified applicants sit the PQE in scheduled batches. Your score is recorded straight to your application.",
  },
  {
    label: "Evaluation of Applicants",
    blurb: "An interview panel scores you against a fixed rubric — never a single evaluator deciding alone.",
  },
  {
    label: "Compliance to Requirements",
    blurb: "Upload the CSC-mandated documentary checklist. Each item is reviewed and verified one by one.",
  },
  {
    label: "Oath-Taking",
    blurb: "Once every requirement is verified, your oath-taking is scheduled — the final step before you're hired.",
  },
];

const FAQS = [
  {
    q: "How do I apply?",
    a: "Register for an account, complete your applicant profile, then apply to any open posting with an Application Letter addressed to that vacancy.",
  },
  {
    q: "Can I track my application after I submit it?",
    a: "Yes — My Applications shows a live stage tracker for every application you submit, from Submitted through Hired.",
  },
  {
    q: "What if I don't qualify at Sifting or the interview?",
    a: "You'll be notified by email with the reason. A rejection at any stage comes with an explanation, not just a status change.",
  },
  {
    q: "Do I need to redo my profile for every posting?",
    a: "No — your profile and documents are set up once at registration and reused for every posting you apply to. Only the Application Letter is submitted per posting.",
  },
  {
    q: "Is my information secure?",
    a: "Your account is protected by a password policy requiring a mix of character types, and your documents are only visible to the DILG staff actually assigned to your application.",
  },
];

function daysUntil(dateString: string): number {
  const ms = new Date(dateString).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

const POSITIONS_PAGE_SIZE = 10;

export function LandingPage() {
  const [postings, setPostings] = useState<JobPosting[] | null>(null);
  const [postingsError, setPostingsError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [visiblePositionsCount, setVisiblePositionsCount] = useState(POSITIONS_PAGE_SIZE);
  const [activeStage, setActiveStage] = useState(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  useEffect(() => {
    listJobPostings("OPEN")
      .then(setPostings)
      .catch((err) => setPostingsError(err instanceof ApiError ? err.message : "Failed to load open positions"));
  }, []);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Link to="/" className="brand">
          <img className="brand-mark" src="/dilg-logo.webp" alt="" aria-hidden="true" />
          DILGR8RSP
        </Link>
        <nav>
          <Link to="/login">Log in</Link>
          <Link to="/register" className="button accent">
            Register
          </Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-inner">
          <img className="landing-hero-logo" src="/dilg-logo.webp" alt="DILG logo" />
          <p className="landing-eyebrow">Department of the Interior and Local Government</p>
          <h1>Your next role at the DILG starts here</h1>
          <p className="landing-lede">
            Register once, apply to any open posting, and track every stage of your application &mdash; sifting,
            examination, interview, compliance, oath-taking &mdash; from one account.
          </p>
          <div className="landing-cta-row">
            <Link to="/register" className="button accent">
              Register to apply
            </Link>
            <a
              className="button ghost"
              href="#open-positions"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("open-positions")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Browse open positions
            </a>
          </div>
        </div>
      </section>

      <section className="landing-section" id="open-positions">
        <Reveal>
          <h2>Open positions</h2>
          <p className="muted">
            {postings === null
              ? "Loading current openings…"
              : postings.length > 0
                ? `${postings.length} position${postings.length === 1 ? "" : "s"} currently accepting applications.`
                : "No positions are open right now — register so you're ready to apply the moment one posts."}
          </p>
        </Reveal>

        {postings === null && (
          <div className="landing-positions-loading">
            <Spinner size="sm" />
          </div>
        )}

        {postingsError && <p className="field-warning">{postingsError}</p>}

        {postings !== null && postings.length > 0 && (
          <div className="landing-positions-list">
            {postings.slice(0, visiblePositionsCount).map((posting) => {
              const expanded = expandedIds.has(posting.id);
              const remaining = daysUntil(posting.closingAt);
              return (
                <Reveal key={posting.id} className="landing-position-card">
                  <button
                    type="button"
                    className="landing-position-header"
                    aria-expanded={expanded}
                    onClick={() => toggleExpanded(posting.id)}
                  >
                    <div>
                      <h3>{posting.title}</h3>
                      <div className="landing-position-meta">
                        <span>SG {posting.salaryGrade}</span>
                        <span>{posting.monthlySalary}</span>
                        <span>{posting.placeOfAssignment}</span>
                        {remaining >= 0 && remaining <= 3 && (
                          <span className="landing-position-closing">
                            Closes {remaining === 0 ? "today" : `in ${remaining}d`}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`landing-position-caret${expanded ? " landing-position-caret--open" : ""}`} aria-hidden="true">
                      &#9662;
                    </span>
                  </button>
                  <div className={`landing-position-collapse${expanded ? " landing-position-collapse--open" : ""}`}>
                    <div className="landing-position-body">
                      <p>{posting.description}</p>
                      <dl className="posting-meta">
                        <dt>No. of vacant position/s</dt>
                        <dd>{posting.numberOfVacantPositions}</dd>
                        <dt>Education</dt>
                        <dd>{posting.qualificationEducation}</dd>
                        <dt>Training</dt>
                        <dd>{posting.qualificationTraining}</dd>
                        <dt>Experience</dt>
                        <dd>{posting.qualificationExperience}</dd>
                        <dt>Eligibility</dt>
                        <dd>{posting.qualificationEligibility}</dd>
                        <dt>Applications close</dt>
                        <dd>{new Date(posting.closingAt).toLocaleString()}</dd>
                      </dl>
                      <Link to="/register" className="button accent">
                        Register to apply
                      </Link>
                    </div>
                  </div>
                </Reveal>
              );
            })}
            {postings.length > visiblePositionsCount && (
              <button
                type="button"
                className="button secondary landing-positions-more"
                onClick={() => setVisiblePositionsCount((count) => count + POSITIONS_PAGE_SIZE)}
              >
                More ({postings.length - visiblePositionsCount} remaining)
              </button>
            )}
          </div>
        )}
      </section>

      <section className="landing-section landing-section--alt">
        <Reveal>
          <h2>One pipeline, start to finish</h2>
          <p className="muted">Select a stage to see what it means for you.</p>
          <div className="landing-pipeline">
            {PIPELINE.map((stage, i) => (
              <button
                key={stage.label}
                type="button"
                className={`landing-pipeline-tab${i === activeStage ? " landing-pipeline-tab--active" : ""}`}
                onClick={() => setActiveStage(i)}
                aria-pressed={i === activeStage}
              >
                <span className="landing-pipeline-num">{i + 1}</span>
                <span>{stage.label}</span>
              </button>
            ))}
          </div>
          <div className="landing-pipeline-detail" key={activeStage}>
            <p>{PIPELINE[activeStage].blurb}</p>
          </div>
        </Reveal>
      </section>

      <section className="landing-section">
        <Reveal>
          <h2>Frequently asked questions</h2>
          <div className="landing-faq">
            {FAQS.map((item, i) => {
              const open = openFaqIndex === i;
              return (
                <div className={`landing-faq-item${open ? " landing-faq-item--open" : ""}`} key={item.q}>
                  <button
                    type="button"
                    className="landing-faq-question"
                    aria-expanded={open}
                    onClick={() => setOpenFaqIndex(open ? null : i)}
                  >
                    <span>{item.q}</span>
                    <span className="landing-faq-caret" aria-hidden="true">
                      {open ? "−" : "+"}
                    </span>
                  </button>
                  {open && <p className="landing-faq-answer">{item.a}</p>}
                </div>
              );
            })}
          </div>
        </Reveal>
      </section>

      <footer className="landing-footer">
        <h2>Ready to get started?</h2>
        <div className="landing-cta-row">
          <Link to="/register" className="button accent">
            Register as an applicant
          </Link>
          <Link to="/login" className="button secondary">
            Already registered? Log in
          </Link>
        </div>
      </footer>
    </div>
  );
}
