# Chia demo

A working proof of concept of Chia: a dog's complete health record, a 15-second daily check-in, early-warning signals, and an AI health assistant that advises and always points to a real vet.

## Run it (2 minutes)

You need Node.js 18 or newer. Nothing else.

```bash
cd demo
node server.js
```

Open http://localhost:3000. It starts in offline demo mode: everything works, and the assistant gives built-in answers based on the dog's record.

## Turn on the real AI (Claude)

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... node server.js
```

The badge at the top right changes to **AI: Claude (claude-opus-5-5)**. To try another model, set `CHIA_MODEL`, for example `CHIA_MODEL=claude-sonnet-5-5`. If the API call fails, the app falls back to the offline answers and logs why.

## Demo script (5 minutes for friends and AI people)

1. **Mochi** (Maltese, 2 years) opens with the status "Book a vet visit". Point at the signals: vomiting, reduced appetite and low energy over 3 days, a fatty BBQ meal noted 4 days ago, three blood values out of range (cPL, lipase, triglycerides), and a 6.5% weight drop in a month. None of these alone looks dramatic. Together they are the pattern Chia is built to catch.
2. **Overview** tab: weight chart and the 14-day habit grid. Hover a cell to see the day's notes.
3. **Ask Chia**: tap "What do the latest blood results mean?" The answer uses Mochi's own values, never diagnoses, and ends with "When to see a vet".
4. Type "she ate chocolate". The emergency screen (plain rules, not AI) puts an emergency banner on top before any AI answer.
5. **Daily check-in**: log appetite "none" and 2 vomits. The status turns red: "Contact a vet now".
6. **Records → Share with vet**: a one-page summary to print or save as PDF for the vet or the emergency clinic.
7. Switch to **Bear** (Golden Retriever, 7 years) to show a healthy dog: all green.
8. The research-sharing toggle on the profile is the seed of the data platform: opt-in, per dog.

Click **Reset demo data** to start again.

## How it works

```
public/            Web app (plain HTML, CSS, JavaScript; no build step)
server.js          Small Node.js server and JSON API; data stored in data/db.json
lib/seed.js        Sample dogs (dates are relative to today)
lib/insights.js    Early-warning rules: habits, weight trend, labs, vaccines
lib/assistant.js   Emergency screen → dog context → Claude (or offline answers)
```

**Safety design.** The parts that must never fail are plain code, not AI: the emergency keyword screen and the early-warning rules. The AI only explains and advises. Its system prompt forbids diagnosing, prescribing and dosing, requires answers grounded in the dog's record, and requires a "When to see a vet" line. The request also enables Anthropic's server-side fallback, so a declined request is retried on a recommended model.

**What is deliberately missing** (next steps for the real product): accounts and login, a real database and file storage, reading uploaded lab PDFs automatically, reminders, a native mobile app, vet review of the rules and prompt, and privacy/consent flows for the research dataset.

## API (for the technical audience)

| Method | Path | What it does |
|---|---|---|
| GET | `/api/status` | Assistant mode and model |
| GET | `/api/dogs` | List dogs with status |
| GET | `/api/dogs/:id` | Full record with signals |
| POST | `/api/dogs/:id/weights` | `{kg, date?}` |
| POST | `/api/dogs/:id/habits` | `{appetite, water, energy, stool, vomiting, walkMinutes, note}` |
| POST | `/api/dogs/:id/records` | `{type, title, date, text, file?: {name, data(base64)}}` |
| POST | `/api/dogs/:id/consent` | `{shareForResearch}` |
| POST | `/api/dogs/:id/screen` | `{text}` → `{emergency}` (rule-based emergency screen only, no AI) |
| POST | `/api/dogs/:id/assistant` | `{messages: [{role, content}]}` → `{text, mode, model, emergency}` |
| POST | `/api/reset` | Restore sample data |

All dogs, clinics, microchip numbers and lab values are made up. Reference ranges and thresholds are illustrative and need review by a vet before any real use.
