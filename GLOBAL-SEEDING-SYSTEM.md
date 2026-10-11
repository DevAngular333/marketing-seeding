# Global Seeding System — operating contract

This document translates the 04/10/2026 and 07/10/2026 Zalo discussions with
Jang Trịnh into an executable marketing system.

## What Jang requested

The operative requirements in that conversation were:

- run AI-assisted seeding across relevant Facebook groups without burst/spam behavior;
- build a dashboard;
- track interaction and reaction;
- let AI prepare replies;
- derive replies/content from the product repository and retain the grounding
  source paths used for each AI reply;
- give every post a status;
- package the workflow as a tool;
- after Facebook validation, test Threads, Reddit, Product Hunt and Indie Hackers.
- add LinkedIn as a required branch and email only for consent-based audiences;
- turn one verified product into an AI-grounded story, channel variants and a
  draft-only schedule while tracking evidence and confidence end to end.

The implementation lives in this project's [README](./README.md).

## Meaning for the R19 course product

R19 is the proof artifact, not the complete course. The campaign tests whether
people want to learn the workflow that produced it:

1. converting a brief into a Blender execution plan;
2. controlling Blender through Python/headless runs;
3. producing and validating animation frames;
4. iterating from evidence instead of accepting the first render;
5. packaging that process into a reusable agentic workflow.

The primary call to action is a learning-interest question, not a false sale.
Responses determine which module deserves priority before pricing or launch.

## Safety and account health

“Do not get the account blocked” is implemented as compliance and cadence
control, never as restriction evasion:

- only relevant targets with reviewed rules enter the queue;
- every external post and reply requires human approval;
- per-account daily caps and minimum intervals prevent burst posting;
- exact duplicate content is blocked for seven days;
- each publication/reply needs postcondition evidence before it is treated as
  published/sent;
- failures and uncertain submissions are not silently retried.
- mutation APIs are loopback-only and require one of two role-scoped bearer
  tokens generated under `.agentic\marketing-seeding`; neither token is stored
  in Git, and protected ACLs restrict both files to the process identity, file
  owner, SYSTEM and local Administrators;
- grounded replies retain the canonical in-repository path, SHA-256 and byte
  length of every source file actually read.

The state file follows an enforced single-writer model. The server or a mutating
CLI process must acquire `state.json.writer.lock`; a second writer is rejected,
with stale locks recovered only when the recorded process no longer exists.
While the dashboard is running, all mutations go through its authenticated local
API. Read-only health, dashboard, status and export operations may run concurrently.

`GET /health`, `GET /api/dashboard`, `GET /api/flow-graph` and static assets are
the unauthenticated loopback read surface. Raw `GET /api/state` requires the
operator token because it contains complete campaign and conversation records.

## Daily loop

```text
Review target rules
  -> tailor content to channel
  -> approve one post
  -> publish through guarded browser execution
  -> verify permalink/playback
  -> capture metrics at 1h/24h/72h
  -> AI drafts replies
  -> approve and send selected replies
  -> update course hypothesis from evidence
```

## Dashboard-assisted browser flow

The Vietnamese dashboard is the persistent operator surface for a machine that
runs continuously. It refreshes every 60 seconds, shows a traffic pulse and next
action for each published post, and keeps metric checkpoints, interactions,
grounded reply drafts and audit history together.

After a local operator token is connected for the current browser session, the
dashboard can approve a draft, queue it, copy its channel-specific content and
open the allowlisted target in a new Chrome tab. The final platform submit remains
an explicit human action. The operator then records a specific permalink plus
verification evidence and captures traffic snapshots at 1h/24h/72h. This avoids
re-discovering targets and copy on every run without turning the system into an
unattended credential scraper or spam bot.

Continuous collection primarily uses an Orca Computer Use automation against the
already logged-in Chrome window. It opens only stored publication permalinks,
reads counters visibly rendered in the page and binds each snapshot to evidence
text plus a screenshot stored under the private runtime evidence directory. The
server reads the file and verifies its SHA-256 hash before accepting the
observation. It does not extract cookies, tokens or
session storage and never clicks reaction/comment/share/follow/join/publish/send.
Login walls, CAPTCHA, removed posts and ambiguous layouts remain `UNKNOWN`.
The collector checks every visible impressions/views, reactions,
comments/replies, shares/reposts, clicks and leads field. It keeps run evidence
without duplicating an unchanged metric snapshot, appends a snapshot when value
or coverage changes, and records visible interactions only with a stable
external ID. Interaction writes are idempotent per post and external ID; no
reply is drafted or sent automatically.
The dashboard computes a daily `browserCoverage` postcondition across every
post whose status is `published` and which has a `publicationUrl`. Approved but
unpublished posts are excluded, and an agent terminal ending or a scheduler row
marked completed does not count as success when observations are missing.

Official adapters remain optional for Threads, permissioned Facebook posts,
Reddit and Product Hunt. The official collector is disabled by default and can
be enabled with `SEEDING_TRAFFIC_POLL_MINUTES` when credentials and permission
are intentionally provisioned. Email always requires explicit consent and
unsubscribe metadata and is excluded from browser sending.

Daily product production is packaged by
`Install-DailyBlenderSeedingAutomation.ps1`. At 09:00 local
time an Orca automation asks `design-os-3d-blender` to create and verify one
new render-only video, then creates separate channel-specific drafts in the
dashboard. Publishing and replies remain human-approved external actions; this
daily production run is separate from the 23:30 read-only browser collector,
installed by `Install-BrowserTrafficAutomation.ps1`.

Campaigns may carry an optional landing page and a durable keyword portfolio.
The keyword engine records the latest impressions, clicks, leads, rank and CTR
for each phrase so operators can promote a theme over weeks instead of rediscovering
targets each run. The visual language follows familiar Ads Manager dashboards,
but the implementation is an organic seeding toolkit only. It has no billing,
paid-campaign creation, bid mutation or spend endpoint.

Conversion events require a stable source/event ID, timestamp, integer value in
minor units and consent basis; duplicates are rejected. Browser observations use
the scoped automation token and require an exact permalink plus a real,
hash-verified screenshot inside the private runtime evidence directory.
Optional official traffic polls use `SEEDING_TRAFFIC_POLL_MINUTES` (minimum 15),
bounded retries and persisted cadence.

## Recovery and elapsed verification

`marketing-seeding\Start-SeedingDashboard-Supervisor.ps1` restarts the local
service after a failed health check. `Install-SeedingDashboard-Autostart.ps1`
registers that supervisor for the current Windows user at logon without embedding
the bearer token. The test suite performs concurrent load and verifies state after
a fixture process restart. `pnpm.cmd soak` supplies a read-only multi-day harness;
only an actually elapsed run and a physical reboot can provide production evidence
for those two conditions.

## Commands

```powershell
cd D:\build-agentic-AI
.\Invoke-Agentic.cmd -Action seeding-init
.\Invoke-Agentic.cmd -Action seeding-test
.\Invoke-Agentic.cmd -Action seeding-start
.\Invoke-Agentic.cmd -Action seeding-status
.\Invoke-Agentic.cmd -Action seeding-autostart
.\Invoke-Agentic.cmd -Action seeding-soak
& D:\project-all\marketing-seeding\Install-DailyBlenderSeedingAutomation.ps1 -Time '09:00'
```

Dashboard: `http://127.0.0.1:4318`.

For a human-authorized local API call, read the operator token from
`.agentic\marketing-seeding\operator-token` into a process variable and send it
as `Authorization: Bearer <token>`. Do not paste it into commands that will be
committed, documentation, logs or chat. Draft-only automation reads the separate
`automation-token`; the server denies it approval, publish and sent transitions.
