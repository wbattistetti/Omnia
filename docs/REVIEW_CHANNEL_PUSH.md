# Canale review — push e webhook

**Architettura:** [REVIEW_CHANNEL_BOLT_ARCHITECTURE.md](./REVIEW_CHANNEL_BOLT_ARCHITECTURE.md) · **Dev locale:** [REVIEW_PORTAL_LOCAL.md](./REVIEW_PORTAL_LOCAL.md) · **Handoff Bolt:** [REVIEW_CHANNEL_BOLT_HANDOFF.md](./REVIEW_CHANNEL_BOLT_HANDOFF.md)

## Omnia (Task Editor)

- **Check review** (ambra): compare solo se Customer o Internal hanno modifiche remote non importate.
- **Pubblica for review** (viola): pubblica snapshot per audience.
- **SSE**: `GET /api/projects/:pid/agent-tasks/:taskId/review-channel/events?token=...`
- **Poll**: ogni 20s mentre l’editor è aperto (backup).

## Portale esterno (Bolt)

Dopo ogni salvataggio review sul vostro DB, chiamate:

```http
POST /api/projects/{projectId}/agent-tasks/{taskInstanceId}/review-channel/notify
X-Review-Token: <stesso token di Omnia>
Content-Type: application/json

{
  "audience": "customer",
  "updatedAt": "2026-05-21T12:00:00.000Z",
  "contentHash": "<opzionale>",
  "source": "portal"
}
```

Omnia desktop riceve l’evento SSE e mostra **Check review** senza refresh manuale.

## Pubblica da Omnia

`PUT .../review-channel?audience=...` emette lo stesso evento SSE (utile se più client Omnia sono aperti).
