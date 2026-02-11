# POST /api/wonderful/scenario

Looks up the active training session by OTP or phone number and returns the scenario configuration for the AI agent role-play.

## Authentication

Requires the `X-API-Key` header set to the server's `AGENT_API_KEY`.

## Request

`Content-Type: application/json`

The body must contain one of the following fields:

- `otp` (string) - 6-digit one-time password provided by the trainee. This is the preferred lookup method.
- `phone` (string) - Trainee's phone number in E.164 format (e.g. `+421901234567`).

Example with OTP:

```json
{ "otp": "385271" }
```

Example with phone:

```json
{ "phone": "+421901234567" }
```

## Response (200 OK)

```json
{
  "session_id": "uuid",
  "user_id": "uuid",
  "scenario_id": "uuid",
  "prompt": "Full scenario prompt including difficulty-level prompt if set",
  "resistance_level": 50,
  "emotional_intensity": 50,
  "cooperation": 50,
  "scenario_name": "Reklamacia faktury",
  "difficulty_name": "Stredna"
}
```

- `session_id` - UUID of the training session.
- `user_id` - UUID of the trainee.
- `scenario_id` - UUID of the scenario.
- `prompt` - The full system prompt for the AI agent. If a difficulty level is configured, its prompt is appended after the scenario prompt.
- `resistance_level` - 0 to 100. How resistant the simulated customer should be. Defaults to 50.
- `emotional_intensity` - 0 to 100. Emotional intensity of the simulated customer. Defaults to 50.
- `cooperation` - 0 to 100. How cooperative the simulated customer should be. Defaults to 50.
- `scenario_name` - Human-readable name of the scenario.
- `difficulty_name` - Name of the difficulty level, or "Default" if none is set.

## Errors

- **400** - Neither `otp` nor `phone` was provided in the request body.
- **401** - Missing or invalid `X-API-Key` header.
- **404** - No active training session found for the given OTP or phone number. The OTP may have expired or the session may have already completed.
- **500** - Unexpected server error.

## Example

```bash
curl -X POST http://localhost:5050/api/wonderful/scenario \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"otp": "385271"}'
```
