# Requirements Specification: Municipality Crowd Verification System

## 1. Project Overview
The municipality receives crowd-sourced complaints regarding roads, lighting, and waste management. The core problem is that decision-makers (municipal officers) cannot verify and prioritize these reports quickly enough due to the high volume of incoming data and limited resources.

## 2. Objectives
- Quickly surface high-priority reports to enable rapid municipal response.
- Estimate confidence for incoming reports using report metadata, location data, time/freshness, corroborating evidence, and official responder verification.
- Explain automated decisions in plain text to non-technical users to build trust and aid human decision-making.

## 3. User Roles
- **Citizen**: Submits issue reports (including category, description, severity, and optional location). Tracks the status of their reports using the assigned Report ID.
- **Municipal Officer / Responder**: Logs into the dashboard to review incoming reports, assess automated priority and confidence scores, inspect corroborating evidence, and make official VERIFY / REJECT / ESCALATE decisions.

## 4. Functional Requirements
- **Citizen report submission**: Citizens can submit reports specifying category (Roads, Lighting, Waste), issue type, description, zone, coordinates, and citizen severity.
- **Report ID generation**: System auto-generates a unique tracking ID (e.g., `RPT-XXXXX`) upon submission.
- **Location capture / manual coordinates**: System accepts optional latitude/longitude pairs. If missing, it explicitly marks the location status as "Missing".
- **Report tracking**: Citizens can look up the status and automated evaluation of their report using their Report ID.
- **Officer authentication**: Municipal officers authenticate using JWT-based login credentials.
- **Officer dashboard**: A unified dashboard interface providing high-level KPIs, recent live reports feed, and a prioritized queue of incidents.
- **Search and filtering**: Officers can filter the incident queue by text search, status, and freshness.
- **Priority/confidence display**: The UI clearly visualizes the computed Priority (0-100, Low/Medium/High/Critical) and Confidence (0-100, Low/Medium/High) scores.
- **Freshness indicators**: Reports and incidents are evaluated for freshness (Fresh: ≤24h, Aging: 24h-72h, Stale: >72h) and displayed via color-coded badges.
- **Evidence management**: Authorized users can attach image files or simulated telemetry data as external evidence to incidents.
- **Corroborating sources**: System deduplicates similar citizen reports and accounts for independent corroborating reports to boost confidence.
- **Responder VERIFY / REJECT / ESCALATE workflow**: Officers can review the incident and submit human decisions (Verify, Reject, Escalate) with an explicit rationale.
- **Decision history**: A chronological log of human responder decisions and rationales is maintained per incident.
- **Citizen-facing status updates**: The citizen tracking view reflects both automated evaluation and official human verification status.
- **Explainability**: Automated scores (Confidence and Priority) include plain-language bullet points explaining exactly why the score was assigned (e.g., location penalty, corroboration boost, evidence boost).

## 5. Non-Functional Requirements
- **Usability**: Interface and scoring explanations must be intuitive for non-technical decision-makers.
- **Explainability**: Automated algorithms must be transparent, not black boxes.
- **Reliability**: The system must maintain data integrity when linking reports to incidents and evaluating constraints.
- **Low-cost infrastructure**: The system is designed to run efficiently on standard hardware without requiring heavy AI/ML compute infrastructure.
- **Security/authentication**: Officer access must be protected via secure authentication.
- **Performance/time-to-surface**: Incoming reports must be clustered and scored rapidly to surface critical issues in near real-time.
- **Maintainability**: The codebase should be structured into clear backend services and frontend components to allow for future iteration.

## 6. Data Requirements
The system processes and stores the following information:
- **citizen report**: The primary user input data.
- **category / issue type**: Categorization (e.g., Roads, Lighting, Waste).
- **location**: Latitude/longitude coordinates.
- **timestamp**: Time of report submission.
- **freshness**: Computed age of the report or evidence.
- **corroborating evidence**: Uploaded files or sensor metadata, including source type and source status (Quality).
- **responder decision**: Verification decision, rationale, responder name, and timestamp.
- **confidence**: Computed score (0-100) reflecting the trustworthiness of the incident.
- **priority**: Computed score (0-100) reflecting the urgency of the incident.
- **verification status**: Canonical state (e.g., Pending, Corroborated, Verified, Rejected, Conflicted, Unknown).

## 7. Operational and Failure Requirements
The system explicitly handles the following edge cases without silently hiding missing data:
- **stale reports**: Computed as "Stale" if older than 72 hours. Handled gracefully with a UI badge (`🔴 Stale`) and an automated priority penalty.
- **missing location**: Computed as "Missing" location status. The engine applies a confidence penalty, and the UI displays "Coords Missing" or "No GPS".
- **missing evidence**: Handled explicitly in the UI; if no evidence is attached, the system displays "Evidence: Not available".
- **conflicting reports/evidence**: The engine detects conflicts, applies a heavy penalty, sets status to `Conflicted`, and alerts officers in the UI.
- **rejected reports**: Human rejection overrides automated confidence to 0, sets status to `Rejected`, and updates the dashboard immediately.
- **missing/stale corroborating information**: Evidence parsing handles missing coordinates or timestamps gracefully (e.g., "Timestamp/Location: Unknown"). Old evidence is accurately labeled as "Stale".

## 8. Evaluation Requirements
The system's ranking and verification engine is designed to be evaluated against the following predefined metrics:
- **Precision@10**: Accuracy of the top 10 prioritized incidents.
- **Precision@20**: Accuracy of the top 20 prioritized incidents.
- **High-Priority Recall**: Ability to successfully identify and surface actual critical/high-priority incidents.
- **Ranking Quality**: The overall relevance ordering of the incident queue.
- **Time-to-Surface**: The latency between report submission and its appearance as a prioritized incident.
- **Explainability Coverage**: The percentage of scored incidents that provide comprehensive human-readable explanations.
- **Edge/Fault Handling**: The system's robustness against stale, missing, or conflicting data scenarios.

## 9. System Constraints and Assumptions
- This is a prototype system designed to validate the verification workflows and scoring logic.
- It utilizes simulated citizen reports, simulated corroborating telemetry data, and localized, low-cost infrastructure.
- Production deployment will require integration with real-world authentication providers, physical IoT sensors, and scalable cloud infrastructure. The prototype assumes these external integrations will conform to the schemas defined herein.

## 10. Traceability Matrix

| Problem Statement Requirement | System Feature | Evidence/Implementation | Status |
| :--- | :--- | :--- | :--- |
| Receive complaints (roads, lighting, waste) | Citizen report submission | `api/reports.py` (POST /api/reports), `ReportCreate` schema | Implemented |
| Cannot verify reports quickly enough | Automated Priority/Confidence scoring | `VerificationEngine.calculate_priority()`, `IncidentQueue.jsx` | Implemented |
| Surface high-priority reports | Prioritized Incident Queue | `IncidentQueue.jsx`, `IncidentOfficerSummary` | Implemented |
| Explain decisions to non-technical users | Engine Audit Explanations | `confidence_explanations`, `priority_explanations` | Implemented |
| Estimate confidence via time/freshness | Freshness Computation | `VerificationEngine.determine_freshness()` | Implemented |
| Estimate confidence via corroborating evidence | External Evidence Management | `api/evidence.py`, `EvidenceSection.jsx` | Implemented |
| Responder verification workflow | Responder Verification Section | `api/incidents.py` (POST /verification), `ResponderVerificationSection.jsx` | Implemented |
| Handle edge cases explicitly | Edge Case Handling (stale, missing location, conflicts) | `VerificationEngine`, UI Badges (Stale, Missing Coords, Conflicted) | Implemented |
