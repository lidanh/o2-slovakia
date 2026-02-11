# Overview

The goal of this Proof of Concept is to deliver an AI‑driven voice training solution that realistically simulates customer conversations and leadership scenarios for our frontline agents and team leaders. We want to understand how well your technology handles:
- Natural Slovak speech
- Real‑time interactive dialogue
- Variable difficulty and customer behavior
- Clear and actionable feedback
- Meaningful analytics for individuals, teams, and the organization

Wonderful will handle the voice processing and the agent, but your goal is to build the UI for this training system, including the metrics and stuff like that, that will integrate with Wonderful agent eventually.

The PoC will focus on building a voice‑based training platform that allows frontline agents and team leaders to practice real scenarios in a safe, repeatable environment. 
Included in scope:
- A fully functional web application (standalone PoC platform)
- AI voice persona in Slovak
- Two predefined training scenarios
- Three difficulty levels for each scenario
- Real‑time evaluation and feedback
- User profiles with transcripts and results
- Admin dashboard for trainers
- Analytics + export options (Excel / Power BI)


# Components

## Agent configuration
allows me to set agent id (for wonderful) and access token (for wonderful).

## Scenarios manager

allows me to create, edit and delete scenarios. For each scenario I will provide a high level prompt that will define the scenario, and for each scenario I will be able to define different difficulty level and the prompts for each difficulty level.

Example scenarios (should be predefined in the system):

- **Internet Upsell (Frontline)**- After successfully resolving the customer’s primary request, the agent should transition the conversation to an internet‑related offer in a natural and value‑focused way.

- **1-on-1 Feedback: Insufficient Performance (Team Leader → Agent)**- A simulated performance conversation where the team leader addresses performance issues. Focus on structured feedback, empathy, and constructive guidance.

Example difficulty level:

Each scenario must include three difficulty levels:
- **Beginner:** Cooperative persona, simple objections, slower pace
- **Intermediate:** Balanced reactions, moderate objections
- **Advanced:** Demanding persona, time pressure, challenging objections, occasional emotional tension

The difficulty level determines how reactive, complex, and resistant the AI is.

## User profiles

Allows me to create teams, and users under each team.

Also, allows me to create users (full name, email, phone number), delete users, edit their details, trigger a call by assigning scenario and difficulty level to a user, and then it will call to the users's number through Twilio and attach Wonderful agent to the call (I will provide an explanation how to do it).

Each user profile should include (you can get it from Wonderful platform- I will provide an API documentation):
- History of completed trainings- needed to be implemented in this system.
- Scores per scenario and attempt- needed to be implemented in this system.
- Performance trend over time (graph) - needed to be implemented in this system.
- Full transcripts- from Wonderful platform
- Audio recordings- from Wonderful platform

Also I want to be able to export users data in csv/xlsx format, including their metrics (total completed trainings, etc.)

## Analytics

### User-Level Analytics
- Total number of completed trainings
- Score progression
- Breakdown by scenario and difficulty
- Strengths and improvement areas
- Post‑session survey responses

### Team-Level Analytics
- Comparison of team members
- Participation rates and training frequency
- Average performance and trends (graph)
- Scenario usage distribution

### Organization-Level Analytics
- Total training volume
- Average score across the company
- Time spent in training
- Comparison with previous periods (week/month/half‑year)
- Heatmaps (performance and usage patterns)
- Leaderboards (average score, improvement rate, training frequency, stars earned, etc.)


## Real‑Time Feedback & Scoring

After each session, users should receive clear feedback that helps them improve, including:
- Score from 0–100
- Star rating (1–5)
- Breakdown by criteria (e.g., needs discovery, objection handling, clarity, tone, active listening)
- Specific suggestions for improvement
- References to moments in the conversation (transcript highlights)
- Final evaluation criteria will be provided by O2 during the PoC.

You can use the call transcription from Wonderful API and then send it to an LLM to prepare this feedback.


## Server API endpoints

When Wonderful agent is getting a call, it will make an API call to fetch the relevant scenario attached to the phone number. As far as I know we can only use the user's phone number to correlate between the live agent and this training platform, so the agent will call to an API in this app, given a phone number it should fetch the "active" scenario+difficulty level, returning the full prompt to the agent.

Also, we need another API that the agent will call every time the user replies, and it should adjust the agent's tone of voice, charactaristics, etc. along the call, we need to make some research and understand how to progress the call and what to return in each step. The agent can send the recent (or entire) call transcription until that point if it helps to determine how the agent should behave now, given the call transcription.

# UI design, look & feel, tech

The application is a NextJS application, but you're free to determine how to deploy it- either Vercel, Render, Supabase, etc.
Components library- use AntD components, enterprise SaaS software looking, very clean and professional.
Use O2 Slovakia color pallette-  https://www.o2.sk/

- International Klein Blue- #0112AA
- Polar- #E5F2FA
- Outer Space- #33383B
- White- #FFFFFF

Use gradients when it's needed.