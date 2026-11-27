# CV Ready — WhatsApp CV builder (backend skeleton)

Node.js + TypeScript backend for a WhatsApp bot that walks job seekers through building a CV in their own language.

**What works today**
- WhatsApp Cloud API webhook (verification + signed message handling)
- Full conversation: **language → consent → personal details → education → experience → skills → references → review**
- Commands at any time: `DELETE` / `SUSA`, `EDIT` / `HLELA`, `RESTART` / `QALA`, `HELP` / `USIZO`
- English and isiZulu (other languages fall back to English and are recorded for later)
- Supabase (Postgres) for the CV data, Redis for the live conversation
- A terminal simulator so you can test without WhatsApp
- 23 automated tests

**Not built yet (next steps):** PDF generation, AI rewrite of experience, voice notes, WhatsApp Flows forms.

---

## How it fits together

```
 WhatsApp user
      │  "Hi"
      ▼
 Meta Cloud API ──POST /webhook──▶  server.ts        verify signature, reply 200 at once
                                       │
                                       ▼
                                   engine.ts         1. drop duplicates      (Redis  seen:<msgId>)
                                       │             2. lock this user       (Redis  lock:<waId>)
                                       │             3. load conversation    (Redis  sess:<waId>, else rebuild from Supabase)
                                       ▼
                                   machine.ts        4. PURE function: (session, input) → (new session, replies, effects)
                                       │
                                       ▼
                                   engine.ts         5. apply effects        (Supabase: consent, save section, delete)
                                       │             6. save session, send replies
                                       ▼
 Meta Cloud API ◀──POST /messages── client.ts
```

**Why Redis *and* Supabase?**
- **Redis** holds the *conversation*: which question we're on and half-typed answers. It's fast, and it expires on its own after 30 days of silence. It also gives us de-duplication (Meta re-sends webhooks) and a per-user lock (two quick messages are processed in order, not in parallel).
- **Supabase** holds the *CV*: each section is saved the moment it's finished. If Redis loses a session, the engine rebuilds it from Supabase, so nobody loses their CV.

**Why is the state machine pure?** `machine.ts` never talks to the network or a database. It returns *effects* (e.g. `saveSection: "skills"`) that the engine carries out. So the whole conversation can be tested in milliseconds (see `test/flow.test.ts`), and adding a channel later (USSD, web) only needs a new adapter.

### Project layout

```
src/
  index.ts                 starts everything (real Redis, Supabase, WhatsApp)
  config.ts                validates environment variables
  server.ts                Fastify: GET/POST /webhook, /health
  whatsapp/
    parse.ts               Meta webhook JSON → InboundMessage
    signature.ts           X-Hub-Signature-256 check
    client.ts              sends text / buttons / lists (enforces WhatsApp limits)
  bot/
    machine.ts             the state machine (all conversation logic)
    engine.ts              glue: dedupe, lock, load, step, effects, send
    i18n.ts                every message, in English + isiZulu, and the command words
    validate.ts            names, years, SA phone numbers, skills...
    summary.ts             the review text
    types.ts               State, Session, CvDraft, Outgoing, Effect
  store/
    session-store.ts       Redis (production) + memory (tests) session stores
    cv-repository.ts       interface for durable CV storage
    supabase-repository.ts Supabase implementation
    memory-repository.ts   in-memory implementation (tests, simulator)
  dev/chat.ts              terminal simulator
supabase/migrations/       database schema
test/                      vitest tests
```

### Conversation states

| Section | States | Notes |
|---|---|---|
| Start | `LANGUAGE` → `CONSENT` | List menu with 6 languages; consent buttons: agree / read more / no thanks |
| Details | `DETAILS_FIRST_NAME` → `SURNAME` → `AREA` → `EMAIL` | Phone number comes from WhatsApp itself. Email can be skipped |
| Education | `EDU_MATRIC` → `EDU_SCHOOL` → `EDU_YEAR` (or `EDU_HIGHEST_GRADE`) → `EDU_MORE` ⇄ `EDU_EXTRA_NAME` → `EDU_EXTRA_YEAR` | Up to 5 courses/certificates |
| Experience | `EXP_HAS` → `EXP_TITLE` → `EXP_PLACE` → `EXP_DATES` → `EXP_DESCRIPTION` → `EXP_MORE` (loop) | "No" skips it kindly. Up to 5 jobs |
| Skills | `SKILLS` | Comma-separated, cleaned and de-duplicated |
| References | `REF_ASK` → `REF_NAME` → `REF_PHONE` → `REF_RELATION` → `REF_MORE` (loop) | Or "on request". Up to 2 |
| After | `REVIEW`, `EDIT_MENU`, `DELETE_CONFIRM` | EDIT replaces one section, then returns to review |

Typed answers that match a button ("yes", "Yebo", or "1") are accepted, since some people type instead of tapping.

---

## Run it locally (no WhatsApp needed)

```bash
npm install
npm test          # 23 tests
npm run chat      # talk to the bot in your terminal
```

In the simulator, type a number to tap a button. `/voice` sends a fake voice note, `/state` shows the session, `/db` shows what was saved.

---

## Connect it to WhatsApp (test number)

### 1. Supabase
1. Create a project at supabase.com.
2. Open **SQL Editor**, paste `supabase/migrations/20261125000000_init.sql` and run it.
   (Or with the CLI: `supabase link --project-ref <ref>` then `supabase db push`.)
3. From **Project settings → API**, copy the **Project URL** and the **service_role** key into `.env`.
   The service-role key bypasses security rules: keep it on the server only, never in a front end or in git.

### 2. Redis
```bash
docker compose up -d      # Redis on localhost:6379
```
For hosting later, any managed Redis works (e.g. Upstash, Redis Cloud). Set `REDIS_URL`.

### 3. Meta app + test number
1. Go to developers.facebook.com → **My Apps → Create app** → choose the **Business** type, then add the **WhatsApp** product.
2. Open **WhatsApp → API Setup**. Meta gives you a **test phone number** and a **temporary access token** (valid 24 hours).
3. Under **To**, add your own phone number and confirm it with the code Meta sends. The test number can only message numbers on this list (up to 5).
4. Copy into `.env`:
   - `WHATSAPP_TOKEN`: the temporary token
   - `WHATSAPP_PHONE_NUMBER_ID`: shown under the test number (not the phone number itself)
   - `WHATSAPP_APP_SECRET`: **App settings → Basic → App secret**
   - `WHATSAPP_VERIFY_TOKEN`: any long random string you make up

### 4. Start the server and expose it
```bash
cp .env.example .env      # then fill it in
npm run dev               # http://localhost:3000
```
Meta needs a public HTTPS URL. In a second terminal:
```bash
npx cloudflared tunnel --url http://localhost:3000     # or: ngrok http 3000
```

### 5. Register the webhook
1. **WhatsApp → Configuration → Webhook → Edit**
2. Callback URL: `https://<your-tunnel-url>/webhook`
3. Verify token: the same `WHATSAPP_VERIFY_TOKEN` as in `.env` → **Verify and save**
4. Under **Webhook fields**, subscribe to **messages**.

### 6. Say hi
Send "Hi" from your phone to the test number. You should get the language menu.

### Before real users
- **Permanent token:** the test token expires every 24 hours. Create a **System user** in Meta Business settings and generate a token with `whatsapp_business_messaging` and `whatsapp_business_management` permissions.
- **Your own number + business verification:** needed to message the public.
- **isiZulu review:** have a first-language speaker check every string in `src/bot/i18n.ts`.
- **POPIA:** register an Information Officer, and check where your Supabase project is hosted (data leaving South Africa needs to be covered in your privacy notice).

---

## Costs to keep in mind
Every message the bot sends is billed by Meta after the monthly free allowance (see Meta's pricing page for the current South African rate). The bot already tries to keep message counts low:
- prompts and hints are combined where possible
- the review summary isn't re-sent for every "thanks"

Later, WhatsApp Flows (in-chat forms) can collect the personal details in one message instead of four.

## Where the next features plug in
- **PDF CV:** add an effect after `completed` in `engine.ts`: render HTML → PDF, upload it to the Cloud API media endpoint, and send it as a `document` message (add a `document` variant to `Outgoing`).
- **AI rewrite:** after `EXP_DESCRIPTION`, call the model in the engine (not the machine, which must stay pure), store the result in `experiences.description_polished`, and show it with "Looks good / Change it" buttons (add an `EXP_CONFIRM` state).
- **Voice notes:** download the audio via the media URL in the webhook, transcribe it, and feed the text back in as a normal text input.
