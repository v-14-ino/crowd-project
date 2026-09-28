# Experimental Evaluation Targets

**CRITICAL METHODOLOGY:** All targets below are defined and FROZEN before the experiment is run. These targets must not be changed after observing experimental results. 

## 1. Objective and Comparison Methodology

The proposed `VerificationEngine` will be evaluated against the frozen baseline (Severity + Recency, documented in `docs/evaluation_baseline.md`) using the exact **same simulated dataset**.

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

For every metric, the final evaluation report must contain:
- Target
- Baseline result
- Proposed system result
- Improvement/difference
- Whether the target was met
- Error analysis

---

## 2. Measurable Targets

### TARGET 1 — Precision@10
**Definition:** Among the 10 highest-ranked incidents surfaced by the system, measure the percentage that are actually labeled as high-priority according to the experiment's ground truth.
**Target:** The proposed system should achieve at least **80% Precision@10**.

### TARGET 2 — Precision@20
**Definition:** Among the 20 highest-ranked incidents surfaced by the system, measure the percentage that are actually high-priority according to the ground truth.
**Target:** The proposed system should achieve at least **75% Precision@20**.

### TARGET 3 — High-Priority Recall
**Definition:** Of all incidents labeled as high-priority in the ground truth, measure the percentage successfully surfaced within the evaluation ranking.
**Target:** The proposed system should achieve at least **80% recall** of high-priority incidents within the evaluated ranking window.

### TARGET 4 — Ranking Quality
**Definition:** Measure where ground-truth high-priority incidents appear in the ranked queue.
At minimum record:
- Mean rank of high-priority incidents
- Median rank
- Number of high-priority incidents appearing in the Top 10
- Number appearing in the Top 20

**Target:** The proposed system should place a clear **majority of true high-priority incidents within the Top 20**.

### TARGET 5 — Time to Surface
**Definition:** Measure the time between the creation/ingestion of a simulated report and its appearance in the officer priority queue after verification processing.
Measure:
- Mean processing/surface time
- Median processing/surface time
- Maximum observed time

**Target:** For the local prototype, the proposed system should surface newly processed high-priority reports within **2 seconds** under the controlled evaluation environment.
*Note: This is a prototype software processing latency target, NOT a claim about real-world municipal response/dispatch time.*

### TARGET 6 — Explainability
**Definition:** Verify that every evaluated high-priority incident has an understandable explanation showing the important factors contributing to its confidence/priority (even though this is not a statistical accuracy metric).
**Target:** **100% of evaluated incidents** should expose a human-readable explanation or explicit reason/state.

### TARGET 7 — Edge/Fault Handling
**Definition:** The final experiment must include at least three edge/failure scenarios (e.g., Duplicate reports, Conflicting reports, Missing location, Stale report, Responder rejection, or Missing evidence).
**Target:** The system must produce an **explicit state** rather than silently treating invalid/missing/conflicting information as normal verified evidence.

---

## 3. Limitations
- **Prototype Scope:** These are prototype evaluation targets designed for local testing.
- **Dataset Dependency:** Results heavily depend on the quality and representativeness of the simulated dataset.
- **Not Real-World Proof:** The experiment measures logical ranking capability and processing speed, but does not prove real-world municipal operational performance.
- **Local Latency:** The 2-second target measures local software processing and surfacing latency only.
- **Ground Truth Dependency:** Ground truth quality directly affects the validity of the Precision and Recall measurements.

---

## 4. Current Status

- **Baseline:** COMPLETE
- **Targets:** COMPLETE
- **Validation dataset:** NOT YET CREATED
- **Ground truth:** NOT YET CREATED
- **Experiment:** NOT YET RUN
- **Results:** NOT YET AVAILABLE
- **Error analysis:** NOT YET AVAILABLE
- **Stakeholder validation:** NOT YET PERFORMED
