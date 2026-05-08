---
name: Build account book feature
overview: Implement the Account Book pipeline as a staged workflow that transforms matched signal companies into enriched, scored, outreach-ready prospect dossiers synced to HubSpot.
todos:
  - id: define-accountbook-schema
    content: Define canonical AccountBookRow schema, evidence model, and stage status contract
    status: pending
  - id: build-stage-orchestrator
    content: Implement sequential 4-pass orchestrator with idempotent run tracking and resume support
    status: pending
  - id: add-enrichment-waterfall
    content: Implement provider adapters and fallback chain for company/contact/email enrichment
    status: pending
  - id: implement-scoring-routing
    content: Add scoring engine, multipliers, score bands, and routing rules with unit tests
    status: pending
  - id: add-reasoning-and-crm-sync
    content: Generate reasoning narratives and sync qualified/routed outcomes to HubSpot with QA gates
    status: pending
isProject: false
---

# Account Book Feature Plan

## Scope
Build the Account Book as a 4-pass pipeline (signal-matched input -> company enrichment -> contact discovery -> contact enrichment), then score and narrate each prospect for downstream outreach.

## Data Contract (first)
Define a canonical `AccountBookRow` schema and persistable lifecycle statuses.

- Core identifiers: `company_id`, `domain`, `contact_id`, `source_run_id`.
- Enrichment fields: firmographics, HRIS tech stack, funding/headcount context.
- Contact fields: role/seniority, email + verification status, LinkedIn URL.
- Decision fields: `icp_fit_score`, `signal_strength_score`, `final_score`, `score_band`, `routing`, `reasoning`.
- Evidence fields: normalized signal evidence snippets + timestamps + provenance.

Use the docs as source of truth:
- [/Users/prashant/Desktop/M360/code/gtm_engine/gtm_seq_pipeline.txt](/Users/prashant/Desktop/M360/code/gtm_engine/gtm_seq_pipeline.txt)
- [/Users/prashant/Desktop/M360/code/gtm_engine/account_book.txt](/Users/prashant/Desktop/M360/code/gtm_engine/account_book.txt)

## Implementation Phases

1. **Phase A - Pipeline skeleton and staging**
   - Create stage modules/interfaces for `signalMatching -> companyEnrichment -> contactDiscovery -> contactEnrichment`.
   - Add idempotent run tracking (`run_id`, per-stage status, retry markers).
   - Store intermediate outputs so failures resume from last successful stage.

2. **Phase B - Enrichment waterfall adapters**
   - Provider abstraction with priority order:
     - Company enrichment: Bitscale primary, Apollo fallback, optional PDL fallback.
     - Contact/email: Apollo/Lusha/Sales Navigator discovery, then Prospeo -> Hunter -> NeverBounce verification.
   - Implement coverage/fallback rules and provider-level error handling/rate-limit backoff.

3. **Phase C - Scoring engine**
   - Implement weighted model:
     - ICP Fit = 40%
     - Signal Strength = 60% (weights from doc).
   - Add multipliers/adjustments:
     - Public pain +10, new exec (<90d) +7, HRIS switch (<6m) +8, already in HubSpot pipeline -15 and route to AE.
   - Assign score bands:
     - 85-100 urgent (<24h), 70-84 standard sequence, 55-69 nurture, <55 monitor/re-score.

4. **Phase D - Reasoning generation + QA gates**
   - Add LLM reasoning generator for 2-3 sentence narrative (why this company, why now, why this person).
   - Add guardrails: no empty evidence, no unverified email for outreach-eligible rows, dedupe against HubSpot pipeline.
   - Add deterministic formatting checks and fallback prompt retry.

5. **Phase E - CRM write-back + ops visibility**
   - HubSpot sync for qualified rows + routing metadata.
   - Add run metrics dashboard/log summary: coverage %, fallback usage, score distribution, per-prospect cost estimate.

## Suggested Execution Order in This Repo

- First pass: wire schema + stage orchestration + mock providers (fast end-to-end path).
- Second pass: replace mocks with real provider adapters and API keys.
- Third pass: tune scoring thresholds and prompt quality using a small labeled sample.
- Fourth pass: enable production scheduling (n8n/cron) and HubSpot write-back.

## Validation Strategy

- Unit tests: scoring math, multiplier logic, score bands, routing decisions.
- Integration tests: provider fallback chain behavior and partial-failure recovery.
- Golden tests: reasoning output quality on fixed sample accounts.
- Acceptance target: 80-120 qualified prospects/month with >=95% reachable-contact coverage.

## Prompting Strategy Recommendation

Use **pieces**, not one giant prompt.

- Single large prompt is good for vision/alignment.
- Build should be split into small implementation prompts, each ending with a runnable/checkpoint state.
- Recommended slices:
  1) data schema + stage interfaces
  2) enrichment adapters + fallback logic
  3) scoring engine + tests
  4) reasoning generation + QA checks
  5) HubSpot sync + observability

This keeps reviewable diffs, easier debugging, and lower risk of cross-file regressions.