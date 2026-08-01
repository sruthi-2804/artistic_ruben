# Art School WhatsApp Bot

A WhatsApp chatbot for an art school, built directly on Meta's **WhatsApp Cloud API**
(no third-party WhatsApp platform, no per-message markup beyond Meta's own pricing).

It handles:

- **Admissions & course info** — lists courses, fees, schedules
- **Trial class booking** — pick a course, pick an open slot, confirm with a name
- **Enrolled-student support** — timetable lookup and pending-fee lookup by phone number
- **Human handoff** — "talk to a staff member" flags the chat and pings staff on WhatsApp

It's seeded with **real course data pulled from [artisticrubans.com](https://artisticrubans.com/)**
(`src/db/seed.js`): Tanjore Painting, Emerging Artist, Skilled Artist, Versatile Artist,
and Master Artist, with real descriptions, schedules, and course images. Two things are
still placeholders and need real input from the school: **fees** (not published anywhere
on the site — every course currently says "Contact us for current fees") and the
**enrolled-student list** (one demo student is seeded so the "My classes / fees" flow is
demoable). See section 4 below.

## How it works

- Node.js + Express server that receives WhatsApp messages via a webhook
- SQLite database (`better-sqlite3`) for courses, bookings, students, fees, and each
  user's conversation state (a simple state machine — see `src/flows/index.js`)
- Sends replies (text + button menus) back out through the Cloud API's `/messages` endpoint

```
src/
  db/          schema.sql, connection, seed script
  flows/       conversation state machine (the actual bot logic)
  routes/      Express webhook (GET verify, POST receive)
  utils/       WhatsApp Cloud API send helper
  index.js     server entrypoint
test-flow.js   local smoke test — runs the flows without hitting WhatsApp
```

## 1. One-time setup with Meta

You said the school already has a WhatsApp Business number/account — here's how to wire
this bot to it. If anything below is already done, skip it.

1. Go to [developers.facebook.com](https://developers.facebook.com) → create an app →
   add the **WhatsApp** product.
2. Under **WhatsApp → API Setup** you'll find:
   - A **temporary access token** (24h, fine for testing) — for production, generate a
     **permanent token** via a System User in Meta Business Settings.
   - The **Phone Number ID** for the school's WhatsApp number.
   - The **WhatsApp Business Account ID**.
3. Copy `.env.example` to `.env` and fill in:
   - `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`
   - `WHATSAPP_VERIFY_TOKEN` — make up any random string; you'll enter the same value
     in Meta's webhook config in step 5.
   - `STAFF_NOTIFY_NUMBERS` — the WhatsApp number(s) that should get pinged when someone
     asks for a human (comma-separated, digits only, country code, no `+`).
4. Deploy the bot (step 2 below) so you have a public HTTPS URL.
5. Back in the Meta app dashboard → **WhatsApp → Configuration → Webhook**:
   - Callback URL: `https://<your-deployed-url>/webhook`
   - Verify token: the same `WHATSAPP_VERIFY_TOKEN` from your `.env`
   - Subscribe to the **messages** field.

Note: WhatsApp only lets a business *reply freely* within 24 hours of the user's last
message ("customer service window"). To message someone first (e.g. a fee reminder out
of the blue), you need a pre-approved **message template** — that's a small follow-up
piece of work once the core bot is live, not included in this prototype.

## 2. Deploy (recommended: Railway)

Railway is a good fit here because it gives you a persistent disk (needed for the
SQLite file) and a free/cheap tier, with almost no config.

1. Push this folder to a GitHub repo.
2. On [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
3. Add a **Volume**, mount it at `/data`, and set `DATABASE_PATH=/data/artschool.db` in
   the Railway environment variables (so the database survives restarts/redeploys).
4. Add the rest of the `.env` variables in Railway's **Variables** tab.
5. Railway gives you a public URL automatically (`Settings → Networking → Generate
   Domain`) — that's the URL to use for the webhook in step 5 above.
6. Set the **Start Command** to `npm start` (should be auto-detected).
7. After first deploy, run the seed once via Railway's shell/console:
   `npm run seed` — or better, edit `src/db/seed.js` with the school's real data first.

(Render works the same way if you'd rather use that — just make sure to attach a
persistent disk there too, or the SQLite file will reset on every deploy.)

## 3. Run locally (for development)

```bash
npm install
cp .env.example .env   # fill in your values
npm run seed            # sample courses/slots/students — edit seed.js for real data first
npm run dev              # starts the server with auto-reload on :3000
```

To test the conversation logic without a real WhatsApp connection:

```bash
node test-flow.js
```

To test the webhook itself locally, expose your dev server with a tunnel (e.g.
`ngrok http 3000`) and point Meta's webhook config at the ngrok URL temporarily.

## 4. Replacing the sample data with the real school data

Everything the bot says comes from the database, seeded in `src/db/seed.js`. Before
going live:

- Edit the `courses`, `slots`, and `schedule` arrays with the real course list, fees,
  and class times.
- Either bulk-import enrolled students (phone + name + course) into the `students`
  table, or write a small import script from whatever spreadsheet/system the school
  already uses.
- Add real fee-due records to `fee_reminders` (or wire up a script that inserts these
  monthly from the school's billing process).
- Delete the demo student/fee row.
- Delete the existing `.db` file and re-run `npm run seed` (or write a one-off
  migration script if the bot is already live with real bookings).

## 5. Extending it

Natural next additions, not included yet:

- **Automated fee-reminder pushes** using a WhatsApp message template (for messaging
  outside the 24h window) + a daily cron job.
- **Admin view** for staff to see bookings/handoff requests without opening the
  database directly (a simple authenticated page, or a Slack/email digest).
- **Multi-language support** — the bot text all lives in `src/flows/index.js`, so it's
  straightforward to branch by detected language.
- **Media messages** (share a studio photo, a course brochure PDF) via the Cloud API's
  media endpoints.
