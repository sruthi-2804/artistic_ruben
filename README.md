# artistic_ruben

A WhatsApp chatbot for [Artistic Ruban's](https://artisticrubans.com/), an art school
with a studio in Adyar, Chennai. Built directly on Meta's WhatsApp Cloud API — no
Twilio, no third-party WhatsApp platform, no per-message markup beyond Meta's own
pricing.

The code lives in **[`artschool-whatsapp-bot/`](artschool-whatsapp-bot/)**, which has
its own README covering Meta app setup, deployment, and how to swap the sample data for
the school's real data. This file is the overview.

## What it does

Two audiences talk to the same WhatsApp number:

- **Prospective students** browse courses with schedules and photos, then book a trial
  class — pick a course, pick an open slot, give a name, get a confirmation.
- **Enrolled students**, recognised by the phone number they message from, check their
  class timetable and any pending fees.
- **Either** can ask for a human. That logs an alert, pings every staff number on
  WhatsApp, and then mutes the bot on that thread so it doesn't talk over the staff
  member — until the user types `menu`.

Seeded with the school's five real courses (Tanjore Painting, Emerging Artist, Skilled
Artist, Versatile Artist, Master Artist), with real descriptions, schedules and images
taken from the site.

## How it works

Node.js + Express, SQLite via `better-sqlite3`, four dependencies total.

```
Meta Cloud API ──POST /webhook──→ Express ──→ state machine ──→ SQLite
                                      │
                 ←──POST /messages────┘
```

- **Inbound:** `GET /webhook` answers Meta's verification challenge; `POST /webhook`
  acknowledges with 200 *before* doing any work, then handles text, button replies and
  list replies.
- **State:** an explicit state machine keyed by phone number, persisted in a
  `conversations` table — so a conversation survives a restart. States cover the main
  menu, course browsing, the three booking steps, and the student menu.
- **Outbound:** text, button menus and images by public URL, through the Cloud API's
  `/messages` endpoint.
- **Data:** eight tables — courses, trial slots, bookings, students, class schedule,
  fee reminders, conversations, staff alerts. The schema is applied on every boot and is
  idempotent.

**There is no LLM and no natural-language understanding here.** Input is buttons,
numbered list choices, and a few reset keywords. That is a deliberate fit to the
problem: the questions a school gets are a short, closed set, and a menu answers them
more reliably and at zero marginal cost. Worth being clear about, since "WhatsApp bot"
now tends to imply a model behind it.

Design constraints visible in the code: WhatsApp allows a maximum of three reply
buttons, so the main menu is split across two screens; button titles are truncated to
20 characters; and a business may only reply freely within 24 hours of the user's last
message, which is why there is no proactive fee reminder — that needs a pre-approved
message template.

## Status

A working prototype, delivered complete and parked. All four flows work end to end;
nothing is stubbed. What it would need before going live:

- **Real fees.** The site publishes none, so every course currently says "Contact us
  for current fees".
- **The real student roster.** One demo student is seeded so the student flow is
  demoable; a bulk import doesn't exist yet.
- **Fresh trial slot dates.** The seeded ones are placeholders and are now in the past.
- **Webhook signature verification.** `X-Hub-Signature-256` is never checked, so anyone
  who learns the URL can post fake inbound messages. This is the one gap I'd close
  first.
- **A booking transaction.** The capacity check, the booking insert and the counter
  increment aren't atomic, so concurrent bookings on the last seat can miscount.
- An admin view — staff currently have to read the SQLite file directly.
- Automated tests. `test-flow.js` exercises the whole conversation with the send
  functions stubbed to the console, but it has no assertions, and it writes to the real
  database.

## Running it

```bash
cd artschool-whatsapp-bot
npm install
cp .env.example .env    # fill in your Meta credentials
npm run seed
npm run dev             # :3000
node test-flow.js       # exercise the flows without a WhatsApp connection
```

Expose the dev server with `ngrok http 3000` to point Meta's webhook at it. Full setup
and deployment instructions are in
[`artschool-whatsapp-bot/README.md`](artschool-whatsapp-bot/README.md).

Not currently deployed. Because the database is a SQLite file, any host needs a
persistent volume or it resets on every deploy.
