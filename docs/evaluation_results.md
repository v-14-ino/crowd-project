# Experimental Evaluation Results

## Methodology
The evaluation was run using a simulated dataset containing 30 incidents, which include:
- Normal true high-priority incidents (Corroborated, verified, good evidence)
- Normal low/medium-priority incidents
- 5 Edge/Fault Cases:
  1. Conflicting reports (Citizen states critical, but conflicting evidence present)
  2. Stale report (Critical severity, but 5 days old)
  3. Duplicate spam (10 Critical reports from same location/time)
  4. Responder rejection (Critical severity, but rejected by official responder)
  5. Missing location (Critical severity, but missing coordinates and unverified)

## Summary of Targets and Results

| Metric | Target | Baseline Result | Proposed System Result | Target Met? |
|--------|--------|-----------------|------------------------|-------------|
| **Precision@10** | ≥ 80% | 60.0% | 90.0% | Yes |
| **Precision@20** | ≥ 75% | 50.0% | 50.0% | No |
| **High-Priority Recall** | ≥ 80% | 100.0% | 100.0% | Yes |
| **Ranking Quality (Mean Rank)** | - | 8.2 | 5.6 | - |
| **Ranking Quality (Median Rank)** | - | 9.0 | 6.0 | - |
| **Time to Surface (Total)** | ≤ 2.0s | N/A | 0.0037s | Yes |
| **Explainability** | 100% | N/A | 100% | Yes |

## Error Analysis & Edge Case Handling

**Baseline Limitations Observed:**
The baseline (Severity + Recency) over-ranked edge cases simply because they carried a "Critical" severity label. It could not detect stale reports, deduplicate spam, or lower priority based on responder rejection or missing locations. 

**Proposed System Edge Case Handling:**
The proposed `VerificationEngine` correctly identified and penalized edge cases:
- **Duplicate Spam:** Identified duplicate reports and prevented artificial priority inflation.
- **Responder Rejection:** Instantly forced confidence to 0 and rejected the false alarm.
- **Stale Reports:** Applied a freshness penalty, dropping priority.
- **Conflicting/Missing Data:** Safely marked incidents as 'Conflicted' or penalized them for missing location data, preventing them from dominating the top queue spaces.

## Status

- **Baseline:** COMPLETE
- **Targets:** COMPLETE
- **Validation dataset:** CREATED (In-memory simulation)
- **Ground truth:** CREATED
- **Experiment:** RUN
- **Results:** AVAILABLE
- **Error analysis:** AVAILABLE
- **Stakeholder validation:** PENDING
