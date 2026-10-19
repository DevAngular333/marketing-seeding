# Next safe lane audit — 2026-10-19

## Scope

Read-only source audit at integration HEAD `1ef496e`. No source, canonical
state, browser, credentials, ORCA runtime, or external platform was touched.

## Recommended lane

### Mission Control conversation and engagement detail (read-only UI)

The API already exposes bounded `engagementContext` and
`conversationContinuity` projections from `src/service.mjs` using
`src/engagement-context.mjs` and `src/conversation-continuity.mjs`. The
Mission Control panel currently shows only aggregate candidate/conversation
counts in `ui/src/App.tsx` (`engagementCandidates` and
`conversationContinuity` around lines 1125–1129 and 1259–1265). It does not
show why a conversation is actionable, observed, or quarantined.

This is a concrete dependency-independent Product Definition of Done gap: the
dashboard must let an operator **observe and understand** contextual
engagement state without turning the dashboard into a per-reply approval or
send console.

## Exact implementation boundary

Primary file: `ui/src/App.tsx`.

Existing read-only data to render:

- `data.engagementContext.conversations[]`: `channel`, `text`, `authorLabel`,
  `capturedAt`, `status`, `reasonCodes`, `replyCount`, `sentReply`.
- `data.engagementContext.candidates[]`: bounded candidate refs and channel,
  with no raw identifiers.
- `data.conversationContinuity.conversations[]`: bounded turns, status,
  latest activity and truncation flags.

No server route, store schema, strategy, authority, reply transition, account
selection, browser transport, or provider call is required.

## Acceptance criteria

- Render at most 5 conversations and at most 5 actionable candidates.
- Show channel, bounded author/text, captured time, status, reply count, and
  explicit reason codes; show `QUARANTINED` and UNKNOWN reasons visibly.
- Show continuity latest activity/turn count and truncation without dumping raw
  external IDs or secret-like text.
- Use existing bounded text/date helpers; no links or action buttons are added.
- Empty and missing projections remain explicit as `UNKNOWN`/empty state.
- The section is clearly read-only/advisory and cannot approve, send, retry, or
  mutate a reply or execution.
- `cd ui && npm exec tsc -- --noEmit` and `cd ui && npm run build` pass;
  existing Node suite remains unchanged and passing.

## Safety assessment

**SAFE TO IMPLEMENT** as a narrow UI/read-model change. It reuses data already
projected and does not alter campaign authority, durable submit intent,
transport selection, UNKNOWN quarantine, or external side effects. It does not
unblock live LinkedIn publication; that remains gated by fresh exact external
authorization and irreversible transport/publication evidence.

## Explicitly out of scope

- Autonomous reply execution or approval bypass.
- New engagement adapter, verifier, crawler, account selector, or state store.
- Any mutation route or dashboard control.
