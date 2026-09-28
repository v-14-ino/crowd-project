# Stakeholder Validation

> **STATUS: PENDING — NOT YET VALIDATED**
>
> No genuine stakeholder validation sessions have been conducted. This document
> contains the complete interview/questionnaire template and the evaluation
> mechanism. Responses will be recorded here when real sessions occur.
>
> Per the project's no-fabrication policy, no responses, observations, or
> resulting design changes are invented below.

## Validation Mechanism

- **Participants**: Municipal operations staff (verification officers,
  coordinators, decision-makers) and citizen representatives.
- **Format**: Structured walkthrough of the dashboard (~30 min) followed by a
  questionnaire (~15 min).
- **Artifact**: A seeded demo instance (`POST /api/seed`) running on
  `http://localhost:3000`.
- **Recording**: Each session's responses are appended to the table below with
  the participant's role, date, and any resulting design changes.

## Questionnaire Template

### A. Usability

1. Were you able to identify the highest-priority incident within 30 seconds of
   opening the dashboard?
2. Was the confidence breakdown ("Explainable Confidence" section) clear enough
   to understand *why* an incident received its score?
3. Did the operational state badges (STALE, MISSING_LOCATION,
   CONFLICTING_EVIDENCE, etc.) clearly communicate what action is required?
4. Was the drill-down (clicking an incident) easy to discover and navigate?

### B. Decision Support

5. Does the priority ranking match your operational intuition for which
   incidents need attention first?
6. Is the responder verification workflow (Verify / Reject / Needs More Evidence)
   sufficient for your field process?
7. Does the bulk-action capability reduce your workload for batch operations?
8. Are the metrics (precision, recall, F1) meaningful for evaluating the
   system's accuracy?

### C. Completeness

9. Are all three municipal categories (Roads, Street Lighting, Waste) handled
   correctly?
10. Are the edge cases (duplicate spam, stale, missing location, conflicts,
    false alarms) handled in a way that matches real-world expectations?
11. Is anything missing that would prevent daily operational use?

### D. Trust

12. Do you trust the confidence scores enough to act on them without manual
    re-verification?
13. What would need to change for you to trust the system fully?

## Session Record

| Date | Participant role | Session lead | Outcome | Resulting design changes |
|------|------------------|--------------|---------|--------------------------|
| — | — | — | NOT YET CONDUCTED | None |

## How to Run a Validation Session

1. Seed the demo: `curl -X POST http://localhost:3000/api/seed`
2. Open `http://localhost:3000` in the Preview Panel.
3. Walk the participant through:
   - Dashboard → high-priority queue
   - Click an incident → drill-down → explainable confidence
   - Switch role to Officer → verify an incident
   - Metrics tab → baseline vs proposed
4. Administer the questionnaire.
5. Append responses to the Session Record table above.

## Current Validation Status

- [ ] NOT VALIDATED — no sessions conducted
- [ ] PARTIAL — some sessions, insufficient coverage
- [ ] VALIDATED — representative sample, design changes incorporated

**Evidence required to mark VALIDATED**: at least 3 sessions with municipal
operations staff, with responses recorded in the Session Record table and any
design changes tracked in `worklog.md`.
