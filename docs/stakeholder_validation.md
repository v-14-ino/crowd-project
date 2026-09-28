# Stakeholder Validation Protocol

This document outlines the validation protocol for the Municipality Crowd Verification system. The protocol is designed to validate the usability, explainability, and effectiveness of the system for both citizen and municipal officer roles.

## 1. Validation Tasks

The following 6 realistic validation tasks evaluate the core workflows of the application.

### Task 1: Citizen Report Submission
- **Task Objective**: Evaluate the ease of submitting a new issue report.
- **Expected User Action**: The participant acts as a citizen and navigates to the submission form, fills out details for a road, lighting, or waste issue (including description and severity), and submits the form.
- **Expected Successful Outcome**: The report is successfully submitted to the system, and a unique Report ID is displayed to the user.
- **Measurable Success Criterion**: The participant successfully submits the report without requiring technical assistance.

### Task 2: Citizen Report Tracking
- **Task Objective**: Evaluate the citizen's ability to track an existing report.
- **Expected User Action**: The participant uses the generated Report ID from Task 1 to search for their report status.
- **Expected Successful Outcome**: The system displays the report details, including the automated verification status and associated incident cluster.
- **Measurable Success Criterion**: The participant locates the correct report and can correctly identify its current status (e.g., "Pending" or "Awaiting Incident Assignment").

### Task 3: Officer Incident Prioritization
- **Task Objective**: Evaluate the dashboard's effectiveness in surfacing critical issues.
- **Expected User Action**: The participant acts as a municipal officer, logs into the dashboard, and identifies the highest-priority incident in the queue based on the Priority column.
- **Expected Successful Outcome**: The participant clicks "Inspect" on the incident with the highest Priority score (e.g., "Critical" or "High").
- **Measurable Success Criterion**: The participant successfully identifies and selects the correct top-priority incident within 30 seconds.

### Task 4: Officer Decision Explainability
- **Task Objective**: Evaluate the transparency of the automated scoring engine.
- **Expected User Action**: While inspecting the selected incident, the participant reads the Confidence and Priority scores and their corresponding "Engine Audit Explanations".
- **Expected Successful Outcome**: The participant can articulate *why* the incident received its specific scores based on the provided explanations (e.g., penalties for missing location, bonuses for corroboration).
- **Measurable Success Criterion**: The participant correctly summarizes at least two factors that influenced the incident's automated evaluation.

### Task 5: Officer Verification Workflow
- **Task Objective**: Evaluate the ease of reviewing evidence and submitting a human decision.
- **Expected User Action**: The participant checks the "Freshness" indicator and reviews any attached external evidence/telemetry. Based on this, they record a VERIFY, REJECT, or ESCALATE decision with a brief rationale.
- **Expected Successful Outcome**: The decision is successfully recorded in the "Decision History" and the incident's human status updates accordingly.
- **Measurable Success Criterion**: The participant successfully submits a decision with a rationale without encountering workflow errors.

### Task 6: Citizen Status Update Review
- **Task Objective**: Evaluate the end-to-end feedback loop for citizens.
- **Expected User Action**: The participant switches back to the citizen view and refreshes their Report ID tracking page to see the officer's decision.
- **Expected Successful Outcome**: The tracking page displays the updated human verification status (e.g., "Verified" or "Rejected").
- **Measurable Success Criterion**: The participant successfully identifies the new status resulting from the officer's action in Task 5.

## 2. Usage of Validation Results

The results collected from this validation protocol will be systematically analyzed to identify usability bottlenecks and gaps in explainability. Specifically, we will look for:
- Tasks with low completion rates or high completion times to target UI/UX improvements.
- Ambiguities in the "Engine Audit Explanations" that confuse non-technical users.
- Feedback regarding the intuitiveness of the evidence inspection and decision workflows to streamline officer operations.
Based on the findings, targeted iterative improvements will be scheduled for the frontend interface and backend explanation generation logic.

## 3. Collected Validation Results

**[Status: Pending Participant Validation]**

*Note: No real external participants have completed this validation protocol yet. Actual results, task completion metrics, and stakeholder feedback will be recorded in this section once formal user testing has been conducted.*
