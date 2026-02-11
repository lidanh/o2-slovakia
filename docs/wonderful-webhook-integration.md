# Wonderful Call-Complete Webhook Integration

## Endpoint

```
POST /api/webhooks/wonderful/call-complete
```

## When to Call

Trigger this webhook when a phone call finishes. The system will:
1. Find the corresponding training session
2. Fetch the call transcript from the Wonderful Communication API
3. Generate AI feedback (score, breakdown, suggestions, highlights)
4. Update the training session and mark the assignment as completed

## Request

**Content-Type:** `application/json`

**Payload:**

| Field              | Type   | Required | Description                                      |
|--------------------|--------|----------|--------------------------------------------------|
| `communication_id` | string | Yes      | The Wonderful communication ID for the call      |
| `session_id`       | string | Yes      | UUID of the training session for this call        |

**Example:**

```json
{
  "communication_id": "comm_abc123def456",
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

## Responses

### 200 OK — Feedback generated

```json
{
  "success": true
}
```

### 200 OK — Feedback already exists

```json
{
  "success": true,
  "message": "Feedback already exists"
}
```

### 400 Bad Request — Invalid payload

```json
{
  "success": false,
  "error": "Invalid request body"
}
```

### 404 Not Found — No matching session

```json
{
  "success": false,
  "error": "Training session not found"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Internal server error"
}
```

## Session Lookup Logic

The endpoint looks up the training session directly by `session_id`. No fallback strategy is needed.

## Idempotency

The endpoint is safe to call multiple times. If feedback has already been generated for the session, it returns `200` with `"Feedback already exists"` and does not regenerate.

## Example curl

```bash
curl -X POST https://your-domain.com/api/webhooks/wonderful/call-complete \
  -H "Content-Type: application/json" \
  -d '{
    "communication_id": "comm_abc123def456",
    "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }'
```
