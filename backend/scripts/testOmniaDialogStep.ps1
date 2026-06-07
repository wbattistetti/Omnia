# Test manuale Fase 1 - omnia_dialog_step via Express proxy (:3100 -> VB :5000).
# Uso: .\backend\scripts\testOmniaDialogStep.ps1 -ProjectId proj_xxx -AgentTaskId <taskId>
param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$AgentTaskId,
  [string]$BaseUrl = "http://localhost:3100",
  [string]$ConversationId = "test-manuale-omnia-dialog"
)

$uri = "$BaseUrl/api/runtime/omnia-dialog-step/$ProjectId/$AgentTaskId"

function Invoke-DialogStep($updates) {
  $body = @{ conversationId = $ConversationId; updates = $updates } | ConvertTo-Json -Depth 5
  Write-Host "`n>>> POST $uri" -ForegroundColor Cyan
  Write-Host $body
  $resp = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body $body
  $resp | ConvertTo-Json -Depth 6
  return $resp
}

Write-Host "Turno 1 - bootstrap (updates vuoti)" -ForegroundColor Yellow
$r1 = Invoke-DialogStep @{}

Write-Host "`nTurno 2 - esempio slot (modifica specialita se presente in allowedValues)" -ForegroundColor Yellow
if ($r1.allowedValues -and $r1.allowedValues.Count -gt 0) {
  $first = $r1.allowedValues[0]
  $col = if ($r1.nextColumnId) { $r1.nextColumnId } else { "specialita" }
  Invoke-DialogStep @{ $col = $first } | Out-Null
} else {
  Write-Host "Nessun allowedValues nel turno 1 - inserisci manualmente gli updates successivi." -ForegroundColor DarkYellow
}

Write-Host "`nFatto. Controlla status/say/useCaseId/useCaseKind in ogni risposta." -ForegroundColor Green
