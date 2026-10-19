# Product intelligence evidence audit — DESIGN:OS Studio

**Audit date:** 2026-10-19 (Asia/Ho_Chi_Minh)  
**Evidence class:** `LOCAL_REAL` read-only repository inspection; no browser, platform, campaign, or canonical-state mutation.  
**Reference repository:** `/Users/nam/Documents/System-Agentic_AI/references/design-os-studio`  
**Reference commit:** `97a1628c561c27121181a4758cd8262eb6edf66c` (`fix(ci): prevent parallel temp-dir collision in designos-mcp session test on macOS ARM64 & save brv handoff`)

## Scope and method

Inspected the reference repository's README, domain context, workspace manifest, privacy/security policy, changelog, machine-readable `llms.txt`, deterministic self-check script, launch/video assets, and the marketing-seeding product-intelligence implementation (`src/product-intelligence.mjs`, `src/product-intelligence-runtime.mjs`, `src/product-repository-inspection.mjs`). No credentials, cookies, tokens, or session material were read or recorded. The existing repository-inspection helper was run with an explicit small allowlist; it read six files and skipped `README.md` because it exceeds the helper's 64 KiB limit.

## Deterministic inspection record

The marketing-seeding inspection helper returned:

- `inspectionHash`: `81a73b7a0bae17cc52e49277652dc6ed13fc73bb910d7f0d75acfb7e86976e08`
- total bytes inspected: `13,921`
- records: `Cargo.toml`, `CHANGELOG.md`, `CONTEXT.md`, `llms.txt`, `PRIVACY.md`, `SECURITY.md`
- skipped: `README.md` (`file_too_large`), `docs/README.md` (`missing`)

Selected SHA-256 file identities:

| File | SHA-256 |
|---|---|
| `README.md` | `a166ffaebf1afddf190cd2d4005013a955b28401ed585e3b61aeb6f7a353de7b` |
| `Cargo.toml` | `a1f9c40b8285494aaf9b732f02cd84a27e1d68461a2622fb9c27ba54b8cdaaad` |
| `scripts/self_check.py` | `94b376828653769efa77666ec485870921b4f526cab43760eb3add6515ea8aeb` |
| `PRIVACY.md` | `9b3b09f6dc05fdb3a3137dd2efd5178162023bc8312b551f7095d3b9af05c01d` |
| `SECURITY.md` | `ef0ebfae595bb8e88980b9526d952b6da3a9a52f8e3cffc602aabb824a61cc04` |
| `docs/videos/01-designos-studio-launch-hero.mp4` | `1e4be0d765363e505afdcc8232d432a50a6b09cb4c995c5df0b9d2ab52128dd2` |
| `docs/videos/designos-studio-launch-preview.gif` | `6a43f702f370daaaa35d42c4d51c9744880a5dd445ae5214452ab58aa3c47ca0` |

The reference working tree was clean when inspected. The repository's `python3 scripts/self_check.py` completed successfully (`ok: design-os-studio self-check passed`). `cargo` is not installed on this host (`command not found`), so `cargo test --workspace --locked` was not runnable here; README/changelog test counts are documentation claims, not fresh local execution evidence.

## Product understanding

### WHAT IS IT? — evidence-backed, repository-described

A native Rust/wgpu/tiny-skia interface design studio with a Figma `.fig` v106 binary read/write engine, an embedded local CLI/PTY agent surface, an 11-stage spec reader, multi-target Dev Mode code generation, and a local stdio MCP server.

Evidence: `README.md` lines 3, 5, 43, 644; `Cargo.toml` lists the 11-crate workspace; `CONTEXT.md` describes the Studio Agent Runtime and MCP/PTY boundary; `llms.txt` repeats the product definition. This establishes the declared product shape, not independent performance or parity proof.

### WHAT PROBLEM DOES IT SOLVE? — evidence-backed as stated problem framing

The repository frames the problem as browser/Electron design tools struggling with very large design files and cloud/proprietary workflows, while AI coding agents lack direct canvas write-back and local spec verification. It positions a local-first native workflow with binary `.fig` handling, agent-assisted canvas changes, spec checks, and visual QA.

Evidence: `README.md` “Why this exists” section and comparison table; `README.md` quickstart and practical loop; `CONTEXT.md` Studio Agent Runtime/Figma AI Action Bridge definitions. The competitive claims about other products are repository assertions and have not been independently benchmarked in this audit.

### WHY DOES IT SOLVE IT BETTER? — partially evidence-backed; superiority claims quarantined

Evidence-backed mechanisms include a Rust workspace, `wgpu`/`tiny-skia` dependencies, deterministic self-check/zero-fake-UI source gate, native `.fig` and screenshot/diff commands described in docs, and checked-in visual/video artifacts. The following quantitative or comparative claims remain **unverified here**: `1.48–1.63s` or `1.54s` load time, `0.0%` idle CPU, `-96.5%` disk reduction, `387/387` or `487/487` parity, `100/100` interactions, `856` tests, and superiority versus Figma/Penpot/Pencil. They are documented in README/llms/docs but no fresh cargo benchmark/test run was possible because `cargo` is unavailable.

### WHO NEEDS IT? — bounded inference from repository audience

The docs explicitly target interface designers, developers/design engineers, AI-assisted design teams, and operators of local/offline design workflows. This is a reasonable audience interpretation from README quickstart, Agentic PTY, Dev Mode and spec-reader sections. No customer/user research, adoption, or external audience evidence was inspected; do not present market demand or customer traction as proven.

## Claim classification

| Claim family | Status | Evidence and limitation |
|---|---|---|
| Native Rust workspace and crate decomposition | `EVIDENCE_BACKED` | `Cargo.toml` lists 11 workspace crates; source tree exists. Build was not run because `cargo` is absent. |
| Product identity/features (fig engine, PTY/MCP, spec reader, Dev Mode) | `EVIDENCE_BACKED_AS_IMPLEMENTED/DOCUMENTED` | README, CONTEXT, `llms.txt`, and crate manifests. Feature behavior is not all independently exercised in this audit. |
| Deterministic repository self-check | `LIVE_LOCAL_VERIFIED` | `python3 scripts/self_check.py` passed. It checks required files/manifests/images and invokes zero-fake-UI gate. |
| Launch visual artifacts | `LOCAL_ARTIFACT_PRESENT` | MP4/GIF/PNG assets are present; hashes recorded above. Presence does not prove capture provenance or product behavior. |
| 100/100 Figma interaction parity and 387/387 UI parity | `DOCUMENTED_UNVERIFIED` | README/changelog/docs state these values; no fresh Rust test run on this host. |
| 723,136 records / 112,474 nodes / 1.54s / 0.0% CPU | `DOCUMENTED_UNVERIFIED` | README/docs benchmark narrative; benchmark fixture/run not executed here. |
| Zero telemetry / local-first privacy | `DOCUMENTED_WITH_POLICY_EVIDENCE` | `PRIVACY.md` states policy; no network capture performed. |
| Agent CLI “zero extra API cost” | `DOCUMENTED_UNVERIFIED` | README/CONTEXT describe local CLI subscriptions; provider billing and runtime behavior not tested. |
| Security model | `DOCUMENTED` | `SECURITY.md` exists and was hashed/inspected within the bounded allowlist. No credential material was exposed. |

## Marketing-seeding runtime fit

The current marketing-seeding code is a deterministic, caller-supplied evidence/claim pipeline:

- `src/product-repository-inspection.mjs` performs bounded allowlisted file inspection, hashes records, and redacts secret-like content.
- `src/product-intelligence.mjs` normalizes/deduplicates evidence, links explicit claims, derives conservative field candidates, and quarantines unsupported claims.
- `src/product-intelligence-runtime.mjs` creates and validates a versioned handoff using a document hash and readiness state.
- `src/product-intelligence-projection.mjs` exposes a read-only readiness summary and marks unsupported/tampered/missing evidence as incomplete or blocked.

This is suitable for attaching a **local evidence package** to a campaign. It does not independently prove the reference product's marketing claims, run the Rust app, execute benchmarks, or verify the visual/video artifacts. Product intelligence should therefore be marked `INCOMPLETE` or `LOCAL_REAL` until an authorized artifact/build lane supplies fresh execution evidence and approved launch-copy hashes.

## Launch-content safety implications

The reference README contains many quantitative and comparative claims. For an autonomous LinkedIn launch, only claims explicitly approved by the campaign authority and linked to immutable evidence hashes should be used. The audit does **not** select or approve launch copy, target/account/profile, media, or publication authority. No exact campaign binding was created and no external side effect occurred.

## Remaining gaps / next safe action

1. Attach the exact approved Design OS Studio launch-copy bytes/hash (and media hash if applicable) to the fresh campaign authority; do not derive copy from README automatically.
2. If quantitative claims are desired, run the product's documented test/benchmark pipeline in an audited local lane with `cargo` available, persist only redacted evidence metadata, and link claims to those records.
3. Keep current product-intelligence handoff readiness `INCOMPLETE` until all mandatory fields and claim evidence are present and validated.
4. Preserve the external LinkedIn live-proof blocker: this audit does not establish account/profile/target authority or ORCA transport certification for irreversible submit.

## Conclusion

This reference repository provides substantial local product and artifact evidence for what DESIGN:OS Studio is, plus a passing deterministic self-check. It does not, by itself, authorize a campaign, establish a fresh approved launch post, or prove the quantitative/comparative claims used in marketing copy. The marketing-seeding runtime correctly treats repository text as caller-supplied evidence and requires explicit claim references; that safety boundary should remain in force.
