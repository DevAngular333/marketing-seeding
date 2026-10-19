# Marketing Seeding System — Implemented Architecture

Verified from source, tests, configuration, read-only runtime inspection, and Git history on 2026-10-19 at integration HEAD `139f09c` plus the reviewed working tree. This document describes the current implementation and labels future work separately.

## Runtime topology

```text
Operator / automation token
          |
          v
Local Node HTTP server (loopback:4318)
          |
          +--> SeedingService ------------------------------+
          |       |                                          |
          |       +--> campaign / post / artifact services   |
          |       +--> guards and authorization              |
          |       +--> product intelligence handoff*         |
          |       +--> discovery persistence*                 |
          |       +--> product factory runtime*               |
          |       +--> metrics / interactions / replies       |
          |       +--> dashboard projection                   |
          |                                                      |
          +--> JsonStore (state.json, schema 8)                 |
          |       atomic replace + writer lease + audit log     |
          |                                                      |
          +--> campaign queue scheduler (30 s)                  |
          +--> traffic collector scheduler (disabled in runtime)|
          +--> fixture worker (disabled in runtime)             |
          +--> JEV execution loop (opt-in environment flags)   |
                         |
                         v
                JevExecutionWorker
                         |
                         +--> readiness provider registry
                         +--> platform adapter registry
                         +--> execution lease / grant / window
                         |
                         v
                  LinkedInAdapter
                         |
                         +--> BrowserInteractionTransport
                         |       +--> ORCA accessibility transport
                         |       +--> ORCA pointer transport (tested alternative)
                         |
                         +--> LinkedIn verifier (DOM/feed/profile surfaces)
                         |
                         v
                    OrcaCliClient
                         |
                         v
                 ORCA browser profile/session
                         |
                         v
                 LinkedIn website
```

`*` denotes capabilities implemented on the integration branch and locally tested. The canonical service currently running on port 4318 is an older build and has not been mutated or redeployed.

## Layer responsibilities

| Layer | Input | Output/state | Dependency | Readiness |
|---|---|---|---|---|
| HTTP server | Authenticated local HTTP requests | JSON API responses, dashboard, health | Node, loopback, bearer token files | Working local runtime |
| SeedingService | Campaign, target, artifact, post, authorization and evidence requests | Mutated canonical state or read-only projection | JsonStore, policy/guard modules | Working locally; new integration seams not deployed |
| JsonStore | JSON state file | Schema 8 state, revision, audit event, writer lease | Local filesystem | Working and restart-safe at file level |
| Campaign governance | Campaign scope, account/profile, target, content, visibility, quota, cadence | Queue decision, exact execution controls | Existing authorization/window/grant contracts | Local verified |
| JEV worker | Exact execution request | Lease, readiness refresh, adapter receipt, reconciliation | Adapter/readiness registries, environment flags | Local verified; live unproven |
| LinkedIn readiness | ORCA profile and existing session | Bound identity/feed/composer readiness | ORCA CLI and LinkedIn session | Local contract and synthetic tests |
| LinkedIn adapter | Exact request and bound account/profile | Pre-submit evidence, one click, activation/acceptance evidence, verifier result | ORCA, DOM expressions, verifier | Code and synthetic tests; real publication unverified |
| Browser transport | Resolved control, validation callback | Transport receipt | ORCA CLI client | Local fixture/contract tested; irreversible live certification absent |
| Product intelligence | Caller-supplied evidence and claims | Hash-linked product understanding and handoff | Existing campaign state | Local verified; automated research absent |
| Product factory | Campaign repository | Fail-closed staged syntax probe, optional artifact hashes and campaign-owned run lineage | Allowlisted local binaries | Local verified; not a persistent media factory or arbitrary build runner |
| Discovery | Caller-supplied public observations | Normalized, deduplicated, policy-classified opportunities | Campaign state | Local verified; crawler absent |
| Dashboard | Read-only service projection | Mission Control views, flow graph, health and evidence | HTTP API, existing frontend | Working local; strategy/NBA views absent |
| Metrics/engagement | Published post, provider response, screenshot or operator evidence | Metric snapshots, interactions, grounded reply drafts | Official APIs or browser/manual evidence | Partial; canonical runtime has no metric snapshots |

## State ownership

`JsonStore` is the source of truth for campaign and execution state. The server is the single writer while running. The dashboard and flow graph are projections. Adapters do not own campaign state; they return normalized receipts to the JEV/service boundary. Product intelligence, repository inspection metadata, discovery and bounded product-factory run lineage are campaign-owned on the integration branch. Factory runs are capped at 24 entries per campaign and are external-side-effect free.

## External execution sequence

```text
campaign authorization
  -> eligibility / quota / cadence / duplicate / kill epoch
  -> one-time execution window
  -> execution-scoped live grant
  -> unique execution lease
  -> fresh readiness
  -> exact request
  -> pre-submit evidence
  -> durable SUBMIT_SENT_INTENT
  -> one browser input
  -> COMMAND_COMPLETED transport receipt
  -> semantic control activation evidence
  -> platform acceptance evidence
  -> independent LinkedIn publication discovery
  -> normalized VERIFIED receipt
  -> canonical PUBLISHED / CONFIRMED
```

Any uncertainty after the durable intent is represented as `SUBMIT_RESULT_UNKNOWN`; it is quarantined and not blindly redispatched.

## Current runtime boundary

The inspected canonical runtime is schema 8, revision 194, SHA-256 `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`. It has seven active campaigns but no active campaign authorization, window, grant or execution lease. It has four immutable UNKNOWN submissions and zero published posts. Traffic, control-cycle, discovery, browser-tracking and fixture timers are disabled. Therefore this topology is an implementation map, not proof that the real website path has completed.

## Core/domain boundary

```text
SYSTEM_AGENTIC_AI Core (frozen)
  provider-neutral orchestration and shared handoff contracts

marketing-seeding domain runtime
  campaign state, product intelligence, discovery, strategy inputs,
  content drafts, account/profile bindings, channel adapters,
  publication verification, metrics, engagement, learning and dashboard

JEV / ORCA / official platform APIs
  external execution substrate
```

The current repository does not contain a live upstream System-Agentic handoff. The versioned local product-intelligence handoff is a domain contract that can be used as a future integration seam.
