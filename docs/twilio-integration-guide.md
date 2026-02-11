# Twilio + Wonderful Agent Integration Guide

A standalone guide for triggering outbound calls via Twilio and connecting them to a Wonderful AI agent. Covers initiating the call, handing off to the AI agent, and tracking call status via Twilio callbacks.

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Prerequisites](#2-prerequisites)
3. [Wonderful Agent Setup](#3-wonderful-agent-setup)
4. [Triggering an Outbound Call](#4-triggering-an-outbound-call)
5. [How the Connection Works (The `url` Parameter)](#5-how-the-connection-works-the-url-parameter)
6. [Handling Twilio Status Callbacks](#6-handling-twilio-status-callbacks)
7. [Complete Working Example](#7-complete-working-example)
8. [Configuration Reference](#8-configuration-reference)

---

## 1. Overview & Architecture

This integration lets you:

1. **Trigger an outbound call** from your server via the Twilio API
2. **Hand the call off to a Wonderful AI agent** that conducts the conversation
3. **Track call status** via Twilio callbacks (did the contact answer? how long was the call?)

### Call Flow

```
                          ┌──────────────────┐
                          │   Your Server    │
                          │                  │
                          │  POST /dial      │
                          │  POST /status    │
                          └──┬────▲──────────┘
                             │    │
              1. Create Call │    │ 3. Status callbacks
                (REST API)   │    │    (POST from Twilio)
                             │    │
                          ┌──▼────┴──────────┐
                          │     Twilio       │
                          │                  │
                          │ - Places call    │
                          │ - Status events  │
                          └──────┬───────────┘
                                 │
                  2. Call answered│  Twilio POSTs to `url`
                                 │
                          ┌──────▼───────────┐
                          │   Wonderful      │
                          │   AI Agent       │
                          │                  │
                          │ - Returns TwiML  │
                          │ - Conducts call  │
                          └──────────────────┘
```

**Key insight:** The `url` parameter in `twilio.calls.create()` is the bridge between Twilio and Wonderful. When someone answers, Twilio POSTs to that URL. Wonderful returns TwiML that takes over the audio stream and conducts the conversation. Your server never handles voice audio directly — Twilio and Wonderful manage that between themselves.

---

## 2. Prerequisites

### Twilio

- A Twilio account ([sign up](https://www.twilio.com/try-twilio))
- A Twilio phone number with Voice capability
- Your **Account SID** and **Auth Token** (found in the [Twilio Console](https://console.twilio.com/))

### Wonderful

- A Wonderful account with an AI agent configured
- The agent's **TwiML webhook URL** (the URL Twilio calls when someone answers)

### Node.js

- Node.js 18+ installed
- The `twilio` and `express` npm packages:

```bash
npm install twilio express
```

---

## 3. Wonderful Agent Setup

### 3.1 Create an Agent

In the Wonderful dashboard:

1. Create a new AI agent (or select an existing one)
2. Configure the agent's persona, instructions, and conversation goals

### 3.2 Obtain the TwiML Webhook URL

Wonderful provides a TwiML webhook URL for each agent. This URL is what you pass as the `url` parameter when creating a Twilio call. It looks something like:

```
https://app.wonderful.ai/agent/<agent-id>/twiml
```

When Twilio connects a call and POSTs to this URL, Wonderful returns TwiML instructions that stream audio to the AI agent, enabling it to have a real-time voice conversation.

---

## 4. Triggering an Outbound Call

### Minimal Example

```js
const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const call = await client.calls.create({
  from: "+15551234567",                                 // Your Twilio number
  to: "+15559876543",                                   // Contact to call
  url: "https://app.wonderful.ai/agent/<agent-id>/twiml", // Wonderful TwiML URL
  statusCallback: "https://your-server.com/twilio-status", // Your status webhook
  statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
  statusCallbackMethod: "POST",
  timeout: 30,                                          // Ring for 30 seconds
});

console.log("Call SID:", call.sid);
```

### Parameters Explained

| Parameter | Description |
|-----------|-------------|
| `from` | Your Twilio phone number (E.164 format, e.g. `+15551234567`) |
| `to` | The phone number to call (E.164 format) |
| `url` | Wonderful's TwiML webhook URL — this is where Twilio POSTs when the call is answered |
| `statusCallback` | Your server's URL for receiving call status events from Twilio |
| `statusCallbackEvent` | Which events to receive: `initiated`, `ringing`, `answered`, `completed` |
| `statusCallbackMethod` | HTTP method for status callbacks (always `POST`) |
| `timeout` | How many seconds to let the phone ring before giving up (default: 60) |

### Full Working Example with Error Handling

```js
const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function dialContact(toNumber, fromNumber, agentTwimlUrl, statusCallbackUrl) {
  try {
    const call = await client.calls.create({
      from: fromNumber,
      to: toNumber,
      url: agentTwimlUrl,
      statusCallback: statusCallbackUrl,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
      timeout: 30,
    });

    console.log(`Call initiated: ${call.sid}`);
    return { success: true, callSid: call.sid };
  } catch (error) {
    console.error(`Failed to dial ${toNumber}:`, error.message);
    return { success: false, error: error.message };
  }
}
```

---

## 5. How the Connection Works (The `url` Parameter)

Understanding the `url` parameter is key to this entire integration.

### What happens step by step:

1. **You call `client.calls.create()`** — Twilio places the outbound call
2. **The phone rings** — Twilio sends `initiated` and `ringing` status events to your `statusCallback`
3. **Someone answers** — Twilio HTTP POSTs to the `url` (Wonderful's TwiML webhook)
4. **Wonderful returns TwiML** — This TwiML contains instructions (like `<Connect><Stream>`) that stream the call audio to Wonderful's AI agent
5. **The AI agent converses** — Wonderful processes speech-to-text, generates responses, and streams audio back through Twilio
6. **The call ends** — Twilio sends a `completed` status event to your `statusCallback`

### Important: Your server never handles voice

Your server's role is purely orchestration:
- **Before the call:** Decide who to call and trigger it
- **During the call:** Receive status updates from Twilio (optional)
- **After the call:** Use the final Twilio status callback to know how the call ended

The actual voice conversation is handled entirely between Twilio's media infrastructure and Wonderful's AI agent.

---

## 6. Handling Twilio Status Callbacks

Twilio sends HTTP POST requests to your `statusCallback` URL as the call progresses. The body is **form-encoded** (not JSON).

### Status Flow

```
initiated → ringing → answered → completed
                  └→ no-answer
                  └→ busy
                  └→ failed
                  └→ canceled
```

### Key Callback Fields

| Field | Description | Example |
|-------|-------------|---------|
| `CallSid` | Unique call identifier | `CA1234567890abcdef` |
| `CallStatus` | Current call status | `completed` |
| `CallDuration` | Duration in seconds (only on `completed`) | `45` |
| `From` | Caller phone number | `+15551234567` |
| `To` | Called phone number | `+15559876543` |
| `Direction` | Call direction | `outbound-api` |
| `ErrorCode` | Twilio error code (if failed) | `31205` |
| `ErrorMessage` | Twilio error message (if failed) | `Caller is invalid` |

### Status Mapping

Map Twilio's status strings to your internal statuses:

```js
const TWILIO_STATUS_MAP = {
  queued: "pending",
  initiated: "pending",
  ringing: "in_progress",
  "in-progress": "in_progress",
  answered: "answered",
  completed: "completed",
  failed: "failed",
  busy: "busy",
  "no-answer": "no_answer",
  canceled: "failed",
};
```

### Express.js Webhook Handler

```js
const express = require("express");
const app = express();

// Twilio sends form-encoded POST data
app.use(express.urlencoded({ extended: false }));

app.post("/twilio-status", (req, res) => {
  const {
    CallSid,
    CallStatus,
    CallDuration,
    From,
    To,
    Direction,
    ErrorCode,
    ErrorMessage,
  } = req.body;

  console.log(`Call ${CallSid}: ${CallStatus}`);

  // Map to your internal status
  const mappedStatus = TWILIO_STATUS_MAP[CallStatus] || "failed";

  // Build metadata from callback fields
  const metadata = {};
  if (CallDuration) metadata.duration = parseInt(CallDuration, 10);
  if (From) metadata.from = From;
  if (To) metadata.to = To;
  if (Direction) metadata.direction = Direction;
  if (ErrorCode) metadata.errorCode = ErrorCode;
  if (ErrorMessage) metadata.errorMessage = ErrorMessage;

  // TODO: Persist mappedStatus and metadata to your database

  // Twilio expects a 200 response with empty TwiML
  res.type("text/xml").send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
});
```

> **Note:** Twilio expects a TwiML response (XML) from status callback endpoints, even though you typically return an empty `<Response></Response>`. Always return a 200 status code.

---

## 7. Complete Working Example

A full Express.js application with both endpoints wired together.

```js
const express = require("express");
const twilio = require("twilio");

const app = express();
app.use(express.urlencoded({ extended: false })); // For Twilio form-encoded POSTs
app.use(express.json());

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;           // e.g. +15551234567
const WONDERFUL_TWIML_URL = process.env.WONDERFUL_TWIML_URL;         // e.g. https://app.wonderful.ai/agent/<id>/twiml
const STATUS_CALLBACK_URL = process.env.STATUS_CALLBACK_URL;         // e.g. https://your-server.com/twilio-status

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

const TWILIO_STATUS_MAP = {
  queued: "pending",
  initiated: "pending",
  ringing: "in_progress",
  "in-progress": "in_progress",
  answered: "answered",
  completed: "completed",
  failed: "failed",
  busy: "busy",
  "no-answer": "no_answer",
  canceled: "failed",
};

// ---------------------------------------------------------------------------
// 1. POST /dial — Trigger an outbound call
// ---------------------------------------------------------------------------

app.post("/dial", async (req, res) => {
  const { to } = req.body; // E.164 phone number

  if (!to) {
    return res.status(400).json({ error: "Missing 'to' phone number" });
  }

  try {
    const call = await twilioClient.calls.create({
      from: TWILIO_FROM_NUMBER,
      to,
      url: WONDERFUL_TWIML_URL,
      statusCallback: STATUS_CALLBACK_URL,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
      timeout: 30,
    });

    console.log(`Call initiated: ${call.sid} → ${to}`);
    res.json({ success: true, callSid: call.sid });
  } catch (error) {
    console.error("Failed to initiate call:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 2. POST /twilio-status — Receive Twilio status callbacks
// ---------------------------------------------------------------------------

app.post("/twilio-status", (req, res) => {
  const {
    CallSid,
    CallStatus,
    CallDuration,
    From,
    To,
    Direction,
    ErrorCode,
    ErrorMessage,
  } = req.body;

  if (!CallSid || !CallStatus) {
    return res.type("text/xml").send(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
    );
  }

  const mappedStatus = TWILIO_STATUS_MAP[CallStatus] || "failed";
  console.log(`[${CallSid}] Status: ${CallStatus} → ${mappedStatus}`);

  // Build metadata from callback fields
  const metadata = {};
  if (CallDuration) metadata.duration = parseInt(CallDuration, 10);
  if (From) metadata.from = From;
  if (To) metadata.to = To;
  if (Direction) metadata.direction = Direction;
  if (ErrorCode) metadata.errorCode = ErrorCode;
  if (ErrorMessage) metadata.errorMessage = ErrorMessage;

  // TODO: Update call record in your database with mappedStatus and metadata

  res.type("text/xml").send(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
  );
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Running the Example

```bash
# Set environment variables
export TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export TWILIO_AUTH_TOKEN="your_auth_token"
export TWILIO_FROM_NUMBER="+15551234567"
export WONDERFUL_TWIML_URL="https://app.wonderful.ai/agent/<agent-id>/twiml"
export STATUS_CALLBACK_URL="https://your-server.com/twilio-status"

# Install dependencies
npm install express twilio

# Start the server
node server.js

# Trigger a test call
curl -X POST http://localhost:3000/dial \
  -H "Content-Type: application/json" \
  -d '{"to": "+15559876543"}'
```

> **Note:** Twilio needs to reach your server over the public internet for status callbacks. Use a tool like [ngrok](https://ngrok.com/) during development: `ngrok http 3000`.

---

## 8. Configuration Reference

### Twilio `calls.create()` Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `from` | Yes | Your Twilio phone number (E.164) |
| `to` | Yes | Destination phone number (E.164) |
| `url` | Yes | Wonderful's TwiML webhook URL |
| `statusCallback` | Recommended | Your URL for receiving call status events |
| `statusCallbackEvent` | Recommended | Array: `["initiated", "ringing", "answered", "completed"]` |
| `statusCallbackMethod` | Recommended | `"POST"` |
| `timeout` | Optional | Ring timeout in seconds (default: 60) |
| `callerId` | Optional | Override caller ID display (must be a verified number) |

### Wonderful Configuration Checklist

- [ ] Agent created and configured with conversation instructions
- [ ] TwiML webhook URL obtained from agent settings

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_FROM_NUMBER` | Your Twilio phone number | `+15551234567` |
| `WONDERFUL_TWIML_URL` | Wonderful agent TwiML webhook URL | `https://app.wonderful.ai/agent/<id>/twiml` |
| `STATUS_CALLBACK_URL` | Public URL of your Twilio status endpoint | `https://your-server.com/twilio-status` |
| `PORT` | Server port | `3000` |
