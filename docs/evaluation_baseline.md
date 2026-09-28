# Experimental Baseline Definition

**CRITICAL RULE:** This baseline is FROZEN. It must not be changed after experimental results are observed. It represents the control group for future experimental evaluation.

## 1. Problem Being Evaluated
Municipal authorities receive numerous citizen complaints about infrastructure and public services. A critical challenge is accurately prioritizing these reports so that the most severe, real incidents are addressed first, while filtering out duplicates, stale reports, and low-priority issues.

## 2. Purpose of the Baseline
The purpose of this baseline is to establish a control methodology representing a "simple municipal workflow." It models how reports would be prioritized manually without the use of an intelligent verification system. By measuring the baseline's performance on a dataset, we can scientifically quantify the improvements (e.g., in precision, recall, and time-to-action) introduced by the proposed `VerificationEngine`.

## 3. Baseline Definition
The experimental baseline uses a simple **Severity + Recency** ranking approach. It acts as a naive queueing system for incoming complaints.

### 3.1 Input Fields Used
- **Severity**: The citizen-reported severity level (`Critical`, `High`, `Medium`, `Low`).
- **Timestamp**: The time the report was created/submitted.

### 3.2 Ranking Rules
All incoming citizen reports are ranked primarily by their reported severity in the following order:
1. Critical
2. High
3. Medium
4. Low

### 3.3 Tie-breaking Rule
If two or more reports share the exact same severity level, they are ranked chronologically by submission timestamp, with the **newer** report ranked first (LIFO - Last In, First Out).

### 3.4 Fields Deliberately Ignored
To ensure the baseline accurately represents a non-intelligent system, it strictly ignores the following intelligence fields:
- No confidence score
- No corroboration algorithms
- No duplicate detection or clustering
- No conflicting-evidence handling
- No external/multimedia evidence analysis
- No responder verification or decision data
- No freshness penalty (stale states)
- No verification status tracking
- No `VerificationEngine` priority calculation

## 4. Limitations of the Baseline
- **Vulnerability to Manipulation**: The baseline blindly trusts the citizen's self-reported severity, making it susceptible to exaggeration or spam.
- **Redundancy**: Duplicate reports for the same incident are treated as completely independent issues, cluttering the queue.
- **No Degradation**: Reports remain in the queue indefinitely without being penalized for staleness, even if the issue has likely been resolved or is no longer relevant.
- **No Ground Truth Integration**: It cannot incorporate physical evidence or responder verification to validate claims.

## 5. Comparison Methodology
The evaluation will compare the Baseline Method against the Proposed System (`VerificationEngine`) using the **SAME SIMULATED DATASET**.

```text
       SAME SIMULATED DATASET
                 |
                 +----------------------+
                 |                      |
                 v                      v
          BASELINE METHOD       PROPOSED SYSTEM
          Severity + Recency    VerificationEngine
                 |                      |
                 +----------+-----------+
                            |
                            v
                     Metric Comparison
```

## 6. Recommended Future Evaluation Metrics
The following metrics are defined to be measured during the experiment:
- **Precision@10**: The percentage of the top 10 ranked reports that are true high-priority incidents.
- **Precision@20**: The percentage of the top 20 ranked reports that are true high-priority incidents.
- **Recall**: Recall of true high-priority incidents among the prioritized queue.
- **Ranking Position**: The average ranking position of verified high-priority incidents.
- **Time-to-Surface**: The simulated time taken to surface high-priority verified reports to decision-makers.

## 7. Experimental Status
- **Baseline definition**: COMPLETE
- **Dataset**: NOT YET CREATED
- **Target**: NOT YET DEFINED
- **Experiment**: NOT YET RUN
- **Results**: NOT YET AVAILABLE
- **Error analysis**: NOT YET AVAILABLE
