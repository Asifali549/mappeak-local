# MapPeak leads routine (runs inside the owner's main chat)

From 8 Nov 2026 the twice-daily leads search runs **inside the main chat**, not as a separate scheduled task.
A reminder message ("MapPeak leads run: morning/evening") arrives in the main chat at ~9:40 and ~17:40 Pakistan time.
When it arrives, Claude does the steps below in that chat. The old scheduled task "MapPeak Daily Leads"
(trig_01PcHmkbGz92emrKAitgmBno) is paused, not deleted; re-enable it if this chain ever breaks.

## Each run
1. **Keep the chain alive first.** List this session's pending one-shot reminders (list_triggers, recurring=false).
   Make sure the next 4 runs (9:40 and 17:40 PKT, Asia/Karachi) are scheduled with send_later; add only the missing ones.
   Message text: `MapPeak leads run: <morning|evening> <date>. Follow LEADS_ROUTINE.md in the mappeak-local repo.`
2. **Time window:** morning = last ~16 hours, evening = last ~9 hours.
3. **Sources** (public pages only, politely, never log in, never bypass a block; skip a source that refuses):
   - Google Business Profile Community https://support.google.com/business/threads?hl=en (main source). Render threads with Playwright
     (`/tmp/claude-0/r/rend.js` and `list.js` if present; otherwise chromium.launch(), networkidle, document.body.innerText).
   - Google Maps Community https://support.google.com/maps/threads?hl=en (owners with their own listing problem only).
   - Reddit RSS (www.reddit.com, not old.): r/GoogleMyBusiness/new/.rss, r/smallbusiness search "google business profile" sort=new, r/localseo/new/.rss.
     curl -sL -A "Mozilla/5.0 MapPeakReader/1.0"; 20 s between requests; on 403/429 wait 120 s, max 3 tries; no .json.
     From 13 Nov 2026 Reddit RSS is shut: skip it and ask him in one Urdu line to open https://www.reddit.com/r/GoogleMyBusiness/new/ himself.
   - Shopify Community search.json (queries: google business profile, google reviews, google listing suspended, google maps listing), owners only.
   - Local Search Forum https://localsearchforum.com/ (newest GBP threads).
   - Apple Communities: paused.
4. **Lead rules** (check every thread right before including it):
   - Owner or manager of a real business with a money-losing problem (suspension, hijack, reviews vanishing, duplicate/fake listing, verification stuck, wrong info).
   - SKIP if any Diamond/Platinum/Gold Product Expert replied; if a Silver PE is still talking with the owner; if other replies already cover our points.
   - SKIP agencies/marketers, students, one-liners, spam, suspicious posts, black-hat requests, India-based posts.
   - Never contradict a Product Expert. Prefer high-income countries and posts naming the business/city/website.
5. **Per lead** (Urdu, best first, full detail; he wants each lead complete):
   - problem in 2 lines, country, source, why good, number of replies;
   - code blocks: post link, business name + city, poster's display name;
   - public reply in the post's language (Google: lightly structured; Reddit: casual), 4-8 sentences, answers what the owner is stuck on,
     no links, no prices, no self-promotion, no reinstatement promises, nothing about reviews incentives/gating;
   - contact: WebSearch/WebFetch for the business email (current business only; never a customer quote form). If none, Google Maps search words;
   - private message: subject + body (email) or WhatsApp text; greet by first name, mention the community, do NOT say we replied there,
     free look, "Would that be helpful?". Email: no signature (Gmail adds his). WhatsApp: sign "Asif, MapPeak Local";
   - channel and time: US/CA/UK/EU/AU/NZ/East Asia = email from the Gmail app with Schedule send; Arab countries and PK = WhatsApp.
     Arrive ~9 AM their time (daylight saving for today), never on their weekend (Saudi/Egypt: Fri-Sat). DE/AT/CH: public reply only.
   - non-English draft: one Urdu line saying what it means.
6. **Also each run:** check Gmail (mappeak.local) for client replies and for "Help Communities" notices of replies on his posts; mention them first.
7. **End of report:** one-time Urdu reminders (add to Client Follow-up; tap the forum counter; 3-5 minutes between replies; check the first reply
   in an incognito tab; Reddit max 2-3 comments, 10+ minutes apart), then the list of skipped threads with reasons.
   No copy block is needed any more (the report is already in the main chat).
8. If no good lead: one short Urdu line saying so (plus any Gmail news).
9. Reply format rules from CLAUDE.md apply (Urdu script, restate nothing, no Latin words inside Urdu sentences, copyable items in code blocks).
   Never post, comment, email or message anyone; drafts only.
