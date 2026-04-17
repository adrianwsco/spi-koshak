# спи, кошак

A cat that is tired of your excuses.

A nightly sleep accountability app for one specific person. At a fixed time, a notification arrives. If she opens it, a cat is waiting. The cat is not interested in her excuses. The conversation ends one way.

---

## Sprint 1 — Persona test

This is the persona validation build. It has **no database, no notifications, no memory between opens, no auth, no streak**. The whole point is: can the voice, tone, timing, and text of the cat feel right when you talk to it? Everything downstream gets built on top of that, so we validate it first.

**What this sprint includes:**

- Voice loop: tap mic → speak → Whisper transcribes → Claude responds → Onyx TTS speaks back
- Static placeholder cat SVG (replaced by Midjourney assets in Sprint 2)
- Three ways to end a session: (a) say "goodnight" / "I'm going to bed" — the cat notices, (b) tap the `i'm going to bed` button, (c) the cat decides the conversation is over
- JSON structured response from Claude with `state`, `text`, `complete` fields — parsed but not yet used for visual state changes

**What this sprint does not include:**

- Push notifications → Sprint 2
- Session persistence / Supabase → Sprint 2
- Night-to-night memory → Sprint 2 (see note below)
- Streak / tuna cans → Sprint 3
- Portal for Adrian → Sprint 3
- Cat state image swaps → Sprint 3 (needs real assets)
- Verification challenges → deferred, spec not finalised
- Friday/Saturday sleep mode → wired up with notifications in Sprint 2

**Memory note:** The current answer ("full history, Claude decides") gets expensive fast and has a second-order risk of the cat dredging up something N said six months ago. Proposed Sprint 2 pattern: last ~14 nights as one-line summaries + the current session's full conversation, architected for semantic retrieval later. Revisit before building.

---

## Setup

### 1. Install dependencies (none, actually)

No npm install needed. We use native `fetch`, global `FormData`, and global `Blob` — all present in Node 18+. Netlify's build detects `package.json` and uses Node 18+ by default.

### 2. Set environment variables in Netlify

Go to **Site configuration → Environment variables** and add:

```
ANTHROPIC_API_KEY    sk-ant-...
OPENAI_API_KEY       sk-...
```

These never touch the browser. Every API call goes through the functions in `netlify/functions/`.

### 3. Deploy

```bash
git init
git add .
git commit -m "spi-koshak sprint 1: persona loop"
git branch -M main
git remote add origin git@github.com:<you>/spi-koshak.git
git push -u origin main
```

Then in Netlify: **Add new site → Import from GitHub → select `spi-koshak` repo → Deploy**.

After first deploy completes, **redeploy once** so the functions pick up the env vars you added. (Netlify functions read env vars at build time of the function bundle, not at request time.)

### 4. Install to iPhone for testing

1. Open the Netlify URL in iOS Safari
2. Tap Share → Add to Home Screen
3. Open from home screen (not from Safari) — microphone permission works better from the installed PWA

---

## File map

```
index.html                        Main app — single-file PWA
manifest.json                     PWA install config
netlify.toml                      Build config
package.json                      Minimal — Node 18 target only
netlify/functions/claude.js       Anthropic proxy (system prompt embedded here)
netlify/functions/whisper.js      OpenAI Whisper transcription proxy
netlify/functions/tts.js          OpenAI TTS proxy (voice/speed configurable)
```

---

## Known Sprint 1 caveats

- **Cat art is a placeholder SVG.** Replace with the Midjourney assets when ready — swap the `<svg>` block in `index.html` for `<img src="/assets/cat_neutral.png">`.
- **TTS speed is 0.85 per spec.** You selected both 0.85 and 0.80 — shipping at 0.85 as the roadmap default; easy to drop to 0.80 once you've heard it in context. Voice and speed are parameters on the TTS request, not hardcoded in the proxy, so either side can tune.
- **No session log.** Conversations are client-side only. Close the app and everything is gone. That's intentional for Sprint 1 — less to debug while we're validating the persona.
- **iOS Safari first-tap required.** There's a "tap to enter" overlay before the cat speaks — iOS blocks autoplay audio until the user gestures first. The overlay solves that and also gives a small thematic entry moment.
- **Whisper language is pinned to English.** If you want Russian transcription for testing later, remove the `language: 'en'` parameter in `whisper.js`.

---

## Smoke test checklist

On first deploy, verify in this order:

1. Open site → entry screen appears with "Спи" centered, "tap to enter" below
2. Tap → cat glows softly, "waking" label shows, then cat speaks an opening line (Onyx voice, slow pace)
3. Tap mic → button turns ember red, "listening" label shows, pulsing ring
4. Speak a quick excuse ("I'm not tired yet") → tap mic again → transcription appears, cat thinks, cat responds
5. Continue 2-3 turns to check conversation coherence
6. Say "goodnight" or tap the `i'm going to bed` button → cat gives a final line, glow dims, controls disappear
7. Refresh page → fresh session

If any step fails, check Netlify function logs for the specific function called at that step.

---

## What Sprint 2 will add

When the persona feels right (or is adjusted until it does), Sprint 2 adds:

- Supabase: `sessions` and `push_subscriptions` tables with RLS
- Auth: Supabase email+password login
- Push notifications: Web Push + scheduled Netlify function firing at 8:30 PM, 9:55 PM, 10:15 PM Latvia time
- Session logging: every conversation written to `sessions` with state timestamps
- Memory: last 14 nights as summaries + current session full text, loaded into the system prompt as context
- Friday/Saturday: cat is sleeping, app is unresponsive

Everything in Sprint 1 is reused — no rewrites, only additions.
