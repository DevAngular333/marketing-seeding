[CmdletBinding(SupportsShouldProcess)]
param(
    [ValidatePattern('^([01]\d|2[0-3]):[0-5]\d$')][string]$Time = '09:00',
    [string]$ProductRepo = 'D:\design-os-3d-blender'
)

$ErrorActionPreference = 'Stop'
$AutomationName = 'Daily Blender artifact and seeding drafts'
$AgenticRoot = if ([string]::IsNullOrWhiteSpace($env:AGENTIC_ROOT)) { 'D:\build-agentic-AI' } else { $env:AGENTIC_ROOT }
$RuntimeRoot = if ([string]::IsNullOrWhiteSpace($env:SEEDING_DATA_DIR)) { Join-Path $AgenticRoot '.agentic\marketing-seeding' } else { $env:SEEDING_DATA_DIR }
$ReceiptFile = Join-Path $RuntimeRoot 'daily-automation.json'
$Orca = (Get-Command orca -ErrorAction Stop).Source

if (-not (Test-Path -LiteralPath $ProductRepo -PathType Container)) {
    throw "Product repository does not exist: $ProductRepo"
}

$legacyPrompt = @'
Mỗi ngày tạo một artifact/video render-only mới trong D:\design-os-3d-blender và chuẩn bị bộ content organic seeding. Trước khi làm phải đọc đầy đủ AGENTS.md và .project-agent.md, tuân thủ Contract -> Plan -> Code -> Critic -> Execute -> Verify -> Verdict; mục đích đã được chủ sở hữu xác nhận là render-only. Motion contract mặc định cho preview hằng ngày: 24 fps, tối thiểu 96 trạng thái render khác nhau, chuyển động mượt ở tốc độ phát thực; video dài tối đa 8 giây, ưu tiên EEVEE/Workbench hoặc preview chi phí thấp và không chạy long render khi chưa có checkpoint theo AGENTS.md. Chỉ dùng Blender 5.2 tại C:\Program Files\Blender Foundation\Blender 5.2\blender.exe, asset native/local có provenance; không tải vendor asset hoặc gọi dịch vụ trả phí. Tạo build slug theo ngày, lưu state/receipt, kiểm tra sentinel AGENT_OK/AGENT_FAIL, decode video và ghi hash artifact; nếu thiếu điều kiện hoặc gate thì ghi BLOCKED/UNVERIFIED, không giả PASS. Sau khi artifact PASS, dùng API loopback http://127.0.0.1:4318 và token cục bộ D:\build-agentic-AI\.agentic\marketing-seeding\operator-token (không in/ghi token) để tạo hoặc cập nhật campaign cùng các content draft riêng cho Facebook Groups, Threads, Reddit, Product Hunt và Indie Hackers ở trạng thái draft/needs_review; không đánh dấu published nếu chưa có permalink và evidence. Không publish, không gửi reply, không login, không giải CAPTCHA, không join group, không lách trust gate/rate limit. Cuối run báo artifact path/hash, verdict, draft IDs, điểm cần người duyệt và lý do nếu bị chặn.
'@

$prompt = @'
Mỗi ngày tạo một artifact/video render-only mới trong D:\design-os-3d-blender và chuẩn bị campaign draft có bằng chứng. Trước khi làm phải đọc đầy đủ AGENTS.md và .project-agent.md, tuân thủ Contract -> Plan -> Code -> Critic -> Execute -> Verify -> Verdict; chỉ dùng Blender 5.2 và asset local/native có provenance, không gọi dịch vụ trả phí. Artifact phải decode được, có SHA-256, byte length, verification evidence và nằm trong productRepo.

Sau khi artifact PASS, dùng API loopback http://127.0.0.1:4318 cùng automation token giới hạn quyền tại D:\build-agentic-AI\.agentic\marketing-seeding\automation-token mà không in, log hoặc ghi token vào source. Token này chỉ được tạo draft/thu thập, không thể approve, publish hoặc đánh dấu sent. Đăng ký artifact, tạo story có grounding file/hash trong productRepo, rồi tạo bản nháp riêng cho Facebook Groups, Threads, Reddit, Product Hunt, Indie Hackers, LinkedIn và email opt-in. Nội dung phải tự nhiên nhưng trung thực, phù hợp policy từng kênh, nêu disclosure khi cần và không bịa claim. Email chỉ được chuẩn bị khi target có consentBasis, audienceSource và unsubscribeMechanism; thiếu thì ghi BLOCKED.

Mọi channel variant chỉ ở draft/needs_review. Không publish, không gửi reply/email, không login, không giải CAPTCHA, không join group, không mua/farm tài khoản, không lách trust gate/rate limit. Cuối run ghi schedule receipt và báo artifact path/hash, story/draft IDs, verdict, điểm cần người duyệt và lý do nếu bị chặn.
'@

$list = (& $Orca automations list --json | Out-String | ConvertFrom-Json)
$automation = @($list.result.automations) | Where-Object { $_.name -eq $AutomationName } | Select-Object -First 1
$workspaceSelector = 'path:' + ($ProductRepo -replace '\\', '/')
if (-not $automation) {
    if (-not $PSCmdlet.ShouldProcess($AutomationName, "Create daily Orca automation at $Time")) { return }
    $created = (& $Orca automations create --name $AutomationName --trigger daily --time $Time --prompt $prompt --provider codex --workspace $workspaceSelector --fresh-session --json | Out-String | ConvertFrom-Json)
    if (-not $created.ok) { throw "Orca did not create the daily automation" }
    $automation = $created.result.automation
} elseif ($PSCmdlet.ShouldProcess($AutomationName, "Update daily Orca automation contract at $Time")) {
    $edited = (& $Orca automations edit $automation.id --trigger daily --time $Time --prompt $prompt --provider codex --workspace $workspaceSelector --fresh-session --json | Out-String | ConvertFrom-Json)
    if (-not $edited.ok) { throw "Orca did not update the daily automation" }
    $automation = $edited.result.automation
}

New-Item -ItemType Directory -Path $RuntimeRoot -Force | Out-Null
$nextRunAt = if ($automation.nextRunAt) {
    [DateTimeOffset]::FromUnixTimeMilliseconds([long]$automation.nextRunAt).ToString('o')
} else { $null }
[pscustomobject]@{
    id = $automation.id
    name = $automation.name
    enabled = [bool]$automation.enabled
    timezone = $automation.timezone
    rrule = $automation.rrule
    nextRunAt = $nextRunAt
    workspaceId = $automation.workspaceId
    installedAt = [DateTimeOffset]::Now.ToString('o')
} | ConvertTo-Json | ForEach-Object {
    [IO.File]::WriteAllText($ReceiptFile, $_, (New-Object System.Text.UTF8Encoding($false)))
}

Write-Output "Daily Blender/seeding automation ready: $($automation.id) (next run $nextRunAt)"
