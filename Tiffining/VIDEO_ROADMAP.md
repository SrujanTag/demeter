# Demeter: End-to-End Testing & Video Recording Roadmap

> **Platform:** Demeter (formerly Tiffining) — Intelligent Meal & Tiffin Kitchen Management Platform  
> **Repository:** [`https://github.com/loveyadav1015/demeter`](https://github.com/loveyadav1015/demeter)  
> **Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, MongoDB Atlas (ACID Transactions), Better-Auth, NVIDIA NIM (Gemma 2 27B + Nemotron 70B), Baileys WhatsApp Web Multi-Device Socket.

---

## 1. Executive Presentation Narrative (The 30-Second Hook)

When recording your video, anchor your narrative around this core principle:
* **The Problem:** 15–100 subscriber home tiffin kitchens lose money, food, and customer trust due to unstructured, colloquial messages (*"Bhaiyya kal 2 tiffin bhej dena"*, *"out of station till Monday"*), paper diaries, and end-of-month billing chaos.
* **The Anti-Pattern Demeter Avoids:** We **NEVER** let an LLM execute database writes, invent meal counts, or guess dates directly.
* **The Demeter Architecture:**
  1. **Models Propose:** Two-stage NVIDIA NIM pipeline extracts candidate operations with highlighted evidence spans.
  2. **Humans Approve:** Kitchen owner reviews an instant cryptographic Before-and-After diff with 1-click approval.
  3. **Deterministic Math Calculates:** Packing numbers, cutoff rules, and invoices are 100% pure TypeScript functions backed by MongoDB ACID transactions.
  4. **Baseline Invariance:** Temporary overrides never destroy a customer's recurring weekly meal subscription.

---

## 2. Phase 1: Pre-Recording Checklist (5 Minutes Setup)

Execute these checks once before starting your screen recording software (Loom, OBS, or QuickTime):

| Step | Action | Command / URL | Expected Output |
| :--- | :--- | :--- | :--- |
| **1.1 Server Health** | Check liveness & readiness | `curl -s http://localhost:3000/api/health/live` | `{"ok":true}` |
| **1.2 WhatsApp Socket** | Verify Baileys background socket | `curl -s http://localhost:3000/api/dev/whatsapp/resume` | `status: "connected"`, `phoneNumber: "917310037100"` |
| **1.3 Session Token** | Generate fresh owner cookie | `node --env-file-if-exists=.env --conditions=react-server --import tsx scripts/generate-session.ts` | Saves `.demo-cookie` |
| **1.4 NVIDIA NIM Health** | Run live contract test | `node --env-file-if-exists=.env --conditions=react-server --import tsx scripts/ai-live.ts --allow-provider-spend` | `Synthetic NVIDIA NIM extraction and verification contracts verified; 1 review candidates.` |
| **1.5 Clean Screen Setup** | Browser window setup | Open [http://localhost:3000](http://localhost:3000) in Chrome | 100% zoom, bookmarks hidden (`Cmd+Shift+B`) |
| **1.6 Terminal Setup** | Terminal window setup | Clean split terminal window in `Tiffining` directory | Large clear font (16pt+) |

---

## 3. Phase 2: Complete End-to-End Testing Verification

Before recording, run this 3-step verification suite in your terminal to prove zero regression:

### Test 2.1: TypeScript & Static Typegen
```bash
npx next typegen && npx tsc --noEmit --incremental false
```
* **Verification:** Exits with code `0`, outputting `✓ Types generated successfully`.

### Test 2.2: Live NVIDIA NIM AI Pipeline
```bash
node --env-file-if-exists=.env --conditions=react-server --import tsx scripts/ai-live.ts --allow-provider-spend
```
* **Verification:** Confirms `nvidia/nemotron-3.5-bolt-e4b` model response with structured JSON schema and provenance audit file saved in `.private/ai-live-*.json`.

### Test 2.3: Full Backend Lifecycle Smoke Test
```bash
node --env-file-if-exists=.env --import tsx scripts/smoke-backend.ts --cookie-file .demo-cookie --write-demo
```
* **Verification:** Exercises the entire lifecycle:
  `Liveness passed` → `Authenticated owner read passed` → `createCustomer` → `importSources` → `createProposal` → `previewProposal` → `approveProposal` → `idempotency replay` → `getDay` → `finalizeSheet` → `getSheet`.
  Output: `API write-demo passed: source → review → approval → same-key retry → exact day → immutable sheet. Fictional records were retained.`

---

## 4. Phase 3: Video Recording Storyboard & Screenplay (5-Minute Target)

### 🎬 Scene 1: The Hook & Introduction (0:00 – 0:45)
* **Visual on Screen:** Landing page at [http://localhost:3000](http://localhost:3000) showing the clean Demeter interface.
* **Camera / Cursor Action:** Smoothly scroll past the hero value proposition: *"Hot lunches on time. Zero missed messages. Honest monthly bills."*
* **Spoken Script (English):**
  > "Hi everyone, this is Demeter — an intelligent kitchen management platform purpose-built for independent home tiffin and meal services.
  > 
  > Home tiffin services operate on fine margins and high trust. Every morning, kitchens are bombarded with chaotic WhatsApp messages in colloquial language: 'Bhaiyya kal khana mat bhejna', 'send 2 tiffins on Monday', or voice notes.
  > 
  > Today, owners manage this in paper diaries or Excel sheets. A single missed message means wasted cooked food or a disappointed customer, and end-of-the-month billing takes hours of painful chat scrolling.
  > 
  > Demeter solves this with a strict architecture: **AI models propose, humans approve, and deterministic code calculates**."

---

### 🎬 Scene 2: 1-Click Sign-In & Kitchen Overview Board (0:45 – 1:30)
* **Visual on Screen:** Sign-in screen → Dashboard Overview.
* **Action:**
  1. Click the green button: **"⚡ 1-Click Demo Owner Sign-In"** (instant access via Better-Auth signed session).
  2. Land on `/dashboard`.
  3. Highlight the 4 real-time operational metrics across the top:
     - **Approved meals count**
     - **Active customers count**
     - **Needs review badge**
     - **Planning status**
  4. Point to the **WhatsApp Status Pill**: *`● WhatsApp Connected · +91 7310037100`*.
* **Spoken Script:**
  > "Let's log in to our kitchen workspace. Demeter uses Better-Auth with cryptographically signed sessions.
  > 
  > Here is our daily kitchen planning board. Notice the top metrics: approved meals, active regular subscribers, items needing review, and planning cutoff rules.
  > 
  > Crucially, look at the WhatsApp indicator in the header: Demeter is connected directly to the kitchen's WhatsApp phone number via a live Baileys background socket."

---

### 🎬 Scene 3: Real-Time WhatsApp & NVIDIA NIM AI Extraction (1:30 – 2:45)
* **Visual on Screen:** Top navigation → Click **"+ Add message"** (or receive real message).
* **Action:**
  1. Click **"+ Add message"** in the top action bar.
  2. In the modal, paste this exact customer request:
     ```text
     Bhaiyya Monday ko 2 tiffin bhej dena please
     ```
  3. Select customer: **`HH (Mom)`** (or leave unassigned).
  4. Click **"Add to review"**.
  5. The message instantly appears under **"02 / INCOMING REQUESTS — Fresh off the phone"** as Item #01.
  6. Click **"Draft with AI"**.
  7. In the AI Consent Dialog, click **"I consent, analyze"**.
  8. Point to the live pulse indicator: *“Analyzing message with Gemma & JEV…”*.
  9. A success toast appears: *“AI draft ready! Opening for review…”*.
* **Spoken Script:**
  > "Now, let's look at how incoming orders are handled. When a customer sends a WhatsApp text or voice note, it appears under 'Fresh off the phone'.
  > 
  > When I click 'Draft with AI', Demeter triggers our two-stage NVIDIA NIM pipeline:
  > In Stage 1, the model extracts the operational intent — recognizing that 'Monday' resolves to November 2nd, the meal count is 2, and isolates the exact character evidence span.
  > In Stage 2, the verification stage checks intent clarity and outputs confidence scores.
  > 
  > Notice that AI is strictly confined to drafting — it cannot alter database baselines without human consent."

---

### 🎬 Scene 4: The Review Desk ("Your call, chef") & Before/After Diff (2:45 – 3:45)
* **Visual on Screen:** Click **"Review ticket"** on Ticket `#01`.
* **Action:**
  1. Under **"03 / CHANGE TICKETS — Your call, chef."**, show Ticket `#01`:
     - Badge: *All order details verified. Ready for immediate approval.*
     - Description: `2 meals · 2026-11-02`
  2. Click **"Review ticket"**.
  3. The Proposal Workspace modal opens:
     - Show the **Original Message** box with highlighted evidence spans (`"Monday ko 2 tiffin"`).
     - Point out the **Before vs. After Diff**: `Before: 0 meals` → `After: 2 meals`.
     - Point out the **Kitchen Total Impact**: Moves from `6` to `8` meals.
     - Mention the **Preview Hash**: Cryptographic state guarantee.
  4. Click **"Approve"**.
* **Spoken Script:**
  > "Under 'Your call, chef', the kitchen owner reviews the ticket.
  > 
  > In this before-and-after review modal, we see total transparency:
  > The original WhatsApp message is permanently preserved. The calendar diff shows exactly what changes for Monday: 0 meals becoming 2 meals.
  > 
  > And every review carries a cryptographic preview hash — if another staff member or message updates the state in the background, Demeter detects the conflict and prevents accidental overwrites.
  > 
  > I click 'Approve', and an atomic MongoDB transaction commits this change as an override while keeping the customer's permanent subscription baseline safe."

---

### 🎬 Scene 5: Finalizing the Immutable Packing Sheet & Ramesh Mode (3:45 – 4:30)
* **Visual on Screen:** Daily Kitchen Board → Finalize Sheet modal → Ramesh Mode tab.
* **Action:**
  1. Switch back to the **"Kitchen"** (Overview) tab.
  2. Point out the updated metric: Approved meals updated immediately.
  3. Click **"Finalize sheet"**.
  4. Check the safety checkbox: *"I understand that later approved changes require a visible amendment"* → Click **"Finalize sheet"**.
  5. Show the board transition to **`REV-1 (Frozen)`**.
  6. In the top navigation bar, click **"Ramesh Mode"**.
  7. Show the delivery stop checklist grouped by building and route.
* **Spoken Script:**
  > "At the kitchen's 10:00 AM cutoff time, the cooking and packing count must freeze.
  > 
  > Clicking 'Finalize sheet' locks the plan into an immutable `REV-1` packing document. Any subsequent changes require an explicit amendment flag, so cooks never pack the wrong number of boxes.
  > 
  > Once packed, we switch to **Ramesh Mode**, named after our delivery partner. Delivery drivers don't need confusing spreadsheets — Ramesh Mode delivers an ultra-clean, building-by-building delivery checklist with addresses, customer notes, and call shortcuts."

---

### 🎬 Scene 6: Automated Bill Book & Conclusion (4:30 – 5:00)
* **Visual on Screen:** Click **"Bill book"** tab → Final pitch.
* **Action:**
  1. Click the **"Bill book"** tab.
  2. Show the customer billing table:
     - Customer name, active days count, rate per meal, agreed balance, and one-click statement export.
  3. Bring up the GitHub repo page: [`loveyadav1015/demeter`](https://github.com/loveyadav1015/demeter).
* **Spoken Script:**
  > "Finally, the **Bill book**. On the 1st of every month, instead of manually scrolling through 30 days of WhatsApp chats to count who ate on which day, Demeter automatically compiles itemized statements directly from the approved meal ledger.
  > 
  > By pairing NVIDIA NIM AI intelligence with transactional rigor, Demeter gives local food entrepreneurs the superpower to scale without operational chaos.
  > 
  > Demeter is 100% open source, fully documented with OpenAPI specs, and available at `github.com/loveyadav1015/demeter`. Thank you!"

---

## 5. Phase 4: Fallback & Emergency Recovery Playbook

If anything unexpected happens during your screen recording:

| Scenario on Camera | What to Do | Instant Recovery Command |
| :--- | :--- | :--- |
| **Server was stopped or offline** | Restart the daemon immediately | `cd Tiffining && npx next dev` |
| **Logged out of dashboard** | Click 1-Click Dev Sign-In or hit URL | Open `http://localhost:3000/api/dev/login` in browser |
| **WhatsApp socket disconnected** | Trigger automatic session resume | `curl -s http://localhost:3000/api/dev/whatsapp/resume` |
| **Want to reset clean demo data** | Re-seed demo records | `cd Tiffining && node --env-file-if-exists=.env --conditions=react-server --import tsx scripts/seed-demo.ts --confirm` |
| **Want an instant review proposal** | Run simulated WhatsApp reprocess | `curl -s -X POST http://localhost:3000/api/dev/whatsapp/reprocess -H "Content-Type: application/json" -d '{"text":"Bhaiyya Monday ko 2 tiffin bhej dena please","from":"919026581007","profileName":"Mom"}'` |

---

## 6. Phase 5: Submission Checklist

- [x] Full Git branch `main` is clean and pushed to [`https://github.com/loveyadav1015/demeter`](https://github.com/loveyadav1015/demeter).
- [x] Backend tests, typechecks, and AI contracts verified with exit code `0`.
- [x] Video recorded following the 6 scenes above (3 to 5 minutes duration).
- [x] Video uploaded to YouTube (Unlisted or Public) or Loom.
- [x] Video link added to project submission and README.

