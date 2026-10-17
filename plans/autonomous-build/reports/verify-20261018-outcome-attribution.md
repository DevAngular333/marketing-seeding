# Independent verification — per-post outcome attribution

**Verdict: ACCEPT (bounded)**

## Scope

Read-only review of `src/outcome.mjs`, `test/outcome.test.mjs` and the
milestone acceptance contract. No files were modified by the reviewer.

## Findings

- Attribution is an additive projection in the existing outcome summary; no
  store, schema, state machine, router or execution seam was introduced.
- Links are explicit through post, target, receipt/request, attempt/uncertainty,
  metric, interaction/reply and post-linked conversion IDs.
- Status precedence is `UNKNOWN` > `VERIFIED` > `PARTIAL` > `UNOBSERVED`.
- VERIFIED requires complete target identity plus canonical confirmed
  publication evidence, content hash, URL and timestamp checks.
- Acceptance, command completion, permalink, metrics and post status alone
  remain PARTIAL.
- Campaign-only conversions remain in `unassignedConversionIds` and are never
  spread across posts.
- Metric selection and evidence ordering are deterministic and bounded; secret-
  like references are excluded.
- No authority, window, grant, lease, request, receipt, browser, provider,
  publication or UNKNOWN mutation was found.

## Verification

```text
node --test test/outcome.test.mjs test/control-cycle.test.mjs test/learning.test.mjs test/service.test.mjs
42 passed, 0 failed, 0 skipped

node --test test/*.test.mjs
388 total, 386 passed, 0 failed, 2 skipped

node --check src/outcome.mjs
git diff --check
```

Canonical runtime remained schema 8, revision 194, SHA-256
`5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`, with
four protected UNKNOWN executions unchanged.
