[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$Schedule = '30 23 * * *',
    [string]$Workspace = 'D:\build-agentic-AI'
)

$ErrorActionPreference = 'Stop'
$AutomationName = 'Browser verified traffic tracking'
$AgenticRoot = if ([string]::IsNullOrWhiteSpace($env:AGENTIC_ROOT)) { 'D:\build-agentic-AI' } else { $env:AGENTIC_ROOT }
$RuntimeRoot = if ([string]::IsNullOrWhiteSpace($env:SEEDING_DATA_DIR)) { Join-Path $AgenticRoot '.agentic\marketing-seeding' } else { $env:SEEDING_DATA_DIR }
$ReceiptFile = Join-Path $RuntimeRoot 'browser-automation.json'
$EvidenceRoot = Join-Path $RuntimeRoot 'evidence'
$AclScript = Join-Path $PSScriptRoot 'scripts\Set-PrivateRuntimeAcl.ps1'
$Orca = (Get-Command orca -ErrorAction Stop).Source

if (-not (Test-Path -LiteralPath $Workspace -PathType Container)) {
    throw "Automation workspace does not exist: $Workspace"
}

$prompt = @'
Monitor traffic for Jang Global Seeding posts through the already signed-in Chrome window, without platform APIs. Before acting, read D:\build-agentic-AI\AGENTS.md and the complete computer-use skill. The local dashboard is http://127.0.0.1:4318. Read /api/dashboard immediately before the run and build a fresh checklist from every post whose server state is status=published and whose publicationUrl is non-empty; never reuse yesterday's checklist, and include posts published since the previous checkpoint. An approved but unpublished post is out of scope. Write observations only with the automation token at D:\build-agentic-AI\.agentic\marketing-seeding\automation-token. Never print, log, screenshot, or write the token into source.

For every in-scope post, use Computer Use with the real Chrome window, wait for the page to stabilize, and verify the URL and post content. Route the read-only check by platform: for Facebook Page/profile content, first open https://www.facebook.com/professional_dashboard/ and use Professional Dashboard > Insights > Content to locate the matching published post by its permalink/content, then open that post's detail view and read the per-post counters; for Facebook Group posts, use the stored group permalink directly because Professional Dashboard does not represent every group post; for LinkedIn, open the post's View analytics/Post analytics panel when available; for Threads, open Insights or the post's visible analytics details when available; for Reddit, open See More Insights on the authored post when available. Never confuse a page-level aggregate/date-range card with the individual post being tracked: match the post URL/content and record the exact scope shown. Inspect every metric column as a fixed six-field checklist: impressions/views, reactions/likes, comments/replies, shares/reposts, clicks, and leads. For each of the six fields, explicitly classify it as measured, unknown (not visible/ambiguous), or unsupported (the platform does not expose it); never omit a field from the coverage map and never infer a missing field as zero. Send only counters that are clearly visible. Save the Computer Use screenshot under D:\build-agentic-AI\.agentic\marketing-seeding\evidence with a unique post/run name and compute SHA-256 from that copied file. POST /api/posts/{postId}/browser-observations with observedUrl, observedAt, evidence, screenshotPath, screenshotSha256, coverage, and exactly the visible metrics. The server records collector health/evidence on every check but does not append a metric snapshot when values and coverage match the previous snapshot; any value or coverage change must create a new snapshot. If a login wall, CAPTCHA, removed post, ambiguous layout, or unverifiable permalink/counter blocks observation, POST status=unknown with a reason and a complete six-field coverage map; do not bypass the block.

Inspect visible new comments/replies only when each item exposes a stable platform external identity or another deduplication-safe key that can be supplied as externalId. POST such items to /api/posts/{postId}/interactions with that externalId; recording is idempotent by post plus externalId. Skip interactions without a stable key. Do not draft a reply and do not send a reply.

Each in-scope post must have exactly one new collector observation in the run, even when its metrics are unchanged. Before finishing, GET /api/dashboard and verify browserCoverage: observed equals totalPublished and missing equals zero. Also verify that every new observation has all six coverage keys: impressions, reactions, comments, shares, clicks, and leads. If coverage is incomplete or any field map is incomplete, continue with missing posts/fields; if runtime or usage limits prevent completion, report PARTIAL/UNVERIFIED explicitly and never treat terminal completion as success.

This collector is strictly read-only on every platform. Never click Like, Reaction, Comment, Reply, Share, Repost, Follow, Join, Submit, Publish, or Send. Never enter a password, change a profile or setting, solve a CAPTCHA, use DevTools to obtain cookies/tokens, or extract session/local storage. Never publish a post or draft/send a response. Report verified/unknown counts and local evidence at the end, and never claim a metric that was not directly visible.
'@

$list = (& $Orca automations list --json | Out-String | ConvertFrom-Json)
$automation = @($list.result.automations) | Where-Object { $_.name -eq $AutomationName } | Select-Object -First 1
$workspaceSelector = 'path:' + ($Workspace -replace '\\', '/')
if (-not $automation) {
    if (-not $PSCmdlet.ShouldProcess($AutomationName, "Create browser traffic automation: $Schedule")) { return }
    $created = (& $Orca automations create --name $AutomationName --trigger $Schedule --timezone 'Asia/Saigon' --prompt $prompt --provider codex --workspace $workspaceSelector --fresh-session --enabled --json | Out-String | ConvertFrom-Json)
    if (-not $created.ok) { throw 'Orca did not create the browser traffic automation' }
    $automation = $created.result.automation
} elseif ($PSCmdlet.ShouldProcess($AutomationName, "Update browser traffic automation: $Schedule")) {
    $edited = (& $Orca automations edit $automation.id --trigger $Schedule --timezone 'Asia/Saigon' --prompt $prompt --provider codex --workspace $workspaceSelector --fresh-session --enabled --json | Out-String | ConvertFrom-Json)
    if (-not $edited.ok) { throw 'Orca did not update the browser traffic automation' }
    $automation = $edited.result.automation
}

New-Item -ItemType Directory -Path $RuntimeRoot -Force | Out-Null
New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
$nextRunAt = if ($automation.nextRunAt) { [DateTimeOffset]::FromUnixTimeMilliseconds([long]$automation.nextRunAt).ToString('o') } else { $null }
[pscustomobject]@{
    id = $automation.id
    name = $automation.name
    enabled = [bool]$automation.enabled
    timezone = $automation.timezone
    rrule = $automation.rrule
    nextRunAt = $nextRunAt
    workspaceId = $automation.workspaceId
    mode = 'browser_verified'
    installedAt = [DateTimeOffset]::Now.ToString('o')
} | ConvertTo-Json | ForEach-Object {
    [IO.File]::WriteAllText($ReceiptFile, $_, (New-Object Text.UTF8Encoding($false)))
}
& $AclScript -Path $ReceiptFile
& $AclScript -Path $EvidenceRoot

Write-Output "Browser traffic automation ready: $($automation.id) (daily 23:30 Asia/Saigon; next run $nextRunAt)"
