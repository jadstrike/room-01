param([string]$JobId)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$key = $env:MOTH_API_KEY
if (!$key) {
  $line = Get-Content -LiteralPath (Join-Path $root '.env.moth.local') | Where-Object { $_ -match '^MOTH_API_KEY=' } | Select-Object -First 1
  $key = ($line -split '=', 2)[1].Trim()
}
if (!$key) { throw 'Set MOTH_API_KEY or put it in .env.moth.local.' }
$headers = @{ Authorization = "Bearer $key" }
$api = 'https://api.mothquantum.com/api/v1'
$output = Join-Path $root 'docs/quantum-house'
New-Item -ItemType Directory -Force -Path $output | Out-Null
# Logical room order: kitchen, living room, bedroom, basement. No Room 01.
$body = @{ params = @{
  level_data = @{
    name = 'House four-room integration test'
    grid_size = @{ rows = 2; cols = 2 }; num_qubits = 4
    coupling_map = @(@(0, 1), @(1, 3), @(3, 2))
    initial_states = @{ '0' = @{ radiating = $true }; '1' = @{ radiating = $false }; '2' = @{ radiating = $false }; '3' = @{ radiating = $false } }
  }
  mode = 'emu'; shots = 4096; steps = 3; fraction = 1.0 / 3; k = 3; top_n = 16
} }
if (!$JobId) {
  $json = $body | ConvertTo-Json -Depth 12
  [IO.File]::WriteAllText((Join-Path $output 'request.json'), $json)
  # Never retry submission automatically: a lost response may still consume credits.
  $job = Invoke-RestMethod -Method Post -Uri "$api/engines/labyrinth-v1/process" -Headers $headers -ContentType 'application/json' -Body $json -TimeoutSec 40
  $JobId = $job.job_id
  if (!$JobId) { throw 'Submission returned no job id.' }
  [IO.File]::WriteAllText((Join-Path $output 'job.json'), ($job | ConvertTo-Json -Depth 8))
  Write-Output "Submitted house simulator job: $JobId"
}
if ($JobId -notmatch '^[A-Za-z0-9_-]+$') { throw 'Invalid job id.' }
$deadline = (Get-Date).AddSeconds(330)
$previous = ''
do {
  $status = Invoke-RestMethod -Uri "$api/jobs/$JobId/status" -Headers $headers -TimeoutSec 30
  if ($status.status -ne $previous) { Write-Output "Status: $($status.status)"; $previous = $status.status }
  if ($status.status -in @('completed', 'failed', 'cancelled')) { break }
  Start-Sleep -Seconds 3
} while ((Get-Date) -lt $deadline)
[IO.File]::WriteAllText((Join-Path $output 'status.json'), ($status | ConvertTo-Json -Depth 20))
if ($status.status -ne 'completed') { throw "Job $JobId ended or timed out with status $($status.status). Resume with -JobId; do not submit again blindly." }
$result = Invoke-RestMethod -Uri "$api/jobs/$JobId/result" -Headers $headers -TimeoutSec 30
[IO.File]::WriteAllText((Join-Path $output 'result.json'), ($result | ConvertTo-Json -Depth 60))
Write-Output 'Saved house result to docs/quantum-house/result.json'
