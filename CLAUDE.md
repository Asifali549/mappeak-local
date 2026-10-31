# MapPeak Local: project notes (read this first in any new chat)

Also read `STATUS.md` (current leads and next steps). Update it at the end of each working day.
**This repo is public: never write client emails, phone numbers or other contact details in any file here.** Contacts live only in the tool's Client Follow-up list.

Owner: Muhammad Asif Raza (Google account name "Asif Ali"), Jampur, Rajanpur, Punjab, Pakistan.
Business: **MapPeak Local**, fixes Google Business Profiles (and Apple Maps listings) for local businesses.
Gmail: mappeak.local@gmail.com. Business WhatsApp: +923038567928 (WhatsApp Business, Jazz number).
Site: https://asifali549.github.io/mappeak-local/ (GitHub Pages, this repo). No paid domain yet.

## How to talk to the owner
- Reply in **Urdu script**. Start every reply by restating his question in Urdu (his voice input sometimes arrives in Hindi or Gurmukhi script, which he cannot read).
- Keep common English tech words in English, written in Urdu letters in chat (سیٹنگ، سیو، سینڈ، کلائنٹ، پروفائل). In the tool's UI, use the English words themselves.
- Never mix Latin-script words inside an Urdu sentence (word order scrambles on his phone). Anything he must copy (links, names, search words, English drafts) goes in its own code block.
- Button and menu names in step-by-step instructions: exactly as they appear on screen, in English.
- **Ask permission before building or changing any tool.** Explain the plan, wait for yes.
- Give one straight, consistent direction. Do not keep switching plans.
- Act as an advisor: proactively suggest improvements.

## Files in this repo
- `index.html`: MapPeak Local one-page website.
- `finder.html`: **Map Lead Finder**, the main tool (single file, ~2000 lines, Urdu RTL UI). Installed as an app (PWA) on his phone.
- `finder.webmanifest`, `sw.js` (network-first service worker), `icons/`, `logo.png`, `favicon.png`.
- `fixdaam.html`: page for his own village shop "Fix Daam".
- Commits: `git -c user.name="Asif Ali" -c user.email="asif20pr@gmail.com" commit`. GitHub Pages takes 2 to 5 minutes to show a new version; the phone app may need closing and reopening.

## What finder.html does
- **Settings**: Google Places API (New) key, Gemini key, ChatGPT key (optional), his email/WhatsApp/website/name/address, Gmail signature checkbox, Sync link (his Google Apps Script) that merges data between phone and PC, and a **Personal Link** (`finder.html#s=...`) that restores missing keys on a new device.
- **Search**: countries US, PK, GB, AU, IE, AE, SA, plus "دوسرا ملک" (any country typed by name; ~40 countries in the WORLD table get their language, Arab countries go to WhatsApp + Arabic, DE/AT/CH flagged "no cold sales email"). Non-English countries get a "<language> میں ترجمہ" button that opens Google Translate with the email. WhatsApp numbers use Google's international number, so they work for any country. Trade + towns search with filters (max rating, max reviews, min reviews, target count, per-run and daily search limits, urgent-only, website-only).
- **Name search**: finds one business by name, then runs a second search for the same trade in the same city to pick a real competitor. When Google's category is generic ("Services"), it takes the trade word from the name (e.g. "solar") and keeps only same-trade results. Costs 2 searches.
- **Issue checks** per business (few reviews, low rating, no website, no recent reviews, unanswered reviews, no posts, Facebook inactive, claim problems...), urgent issues flagged, manual yes/no questions for things the API cannot see.
- **Messages**: English email for US/UK/AU/IE with each country's legal notes; Urdu WhatsApp for Pakistan; Arabic WhatsApp for Gulf.
- **Picture report** (canvas PNG) in Urdu, English or Arabic: header, three tiles (issues; competitor's reviews when no urgent issue; rating), strength bar (word, not a harsh score), competitor bar chart with a gap sentence, issues grouped (fix first / important / quick wins, max 7), contact box, compliance footer.
- **Ad-tag detection** (added 29 Oct 2026): the PageSpeed test's `network-requests` list is scanned for Google Ads tags (AW- ids, googleadservices conversion, viewthroughconversion, Floodlight) and the Meta pixel (fbevents.js, facebook.com/tr). Green "💰" badges; these leads sort first (manual FB-ads yes > Google tag > Meta tag). A tag means the owner has paid for ads, not that ads run today. "گوگل اشتہار دیکھیں" button opens Google Ads Transparency Center by domain. Not live-tested from Claude's sandbox (PageSpeed blocked there); check on the phone. Paid ad-data APIs (e.g. SerpApi, sued by Google Dec 2025) are avoided.
- **Keyless AI check**: opens Gemini/ChatGPT with a ready question (free Gemini API quota runs out after one search).
- **Suspended Listing Monitor**: remembers searched businesses, flags ones that disappear.
- **Today card**: follow-ups due, reminders, outreach messages (target 5/day), forum replies (target 3/day), sync-failure warning, Auto Leads report checkboxes, monthly clients and earnings.
- **Client Follow-up**: stages waiting / followed / replied / quoted / won / lost, manual add form (only name required; he prefers just name + contact + country + source), CSV export. Duplicate guard: typing a name or contact already in the list shows a red warning and asks before adding (work sometimes happens in other chats, so the tool is the one record).
- Fixes 30 Oct: manual add has a first-contact date and counts today's emails in the daily 5; reminders skip the lead's weekend (SA Fri/Sat, PK Sun, others Sat/Sun); duplicate guard matches distinctive words, not trade words; sync: newest change wins for clients (bring-back survives), search results from two devices are merged, a change during a sync is resent; earnings accept "USD 50", "$50", "Rs 5000"; country rules show Pakistan send times computed for today's date (handles clock changes); text report shows strength word, not /100; more countries and sources in the manual form. Known limits: EU/UK cookie banners hide ad tags; monitor can't see 'permanently closed' and may flag a changed Place ID.
- Fixes 31 Oct: manual first-contact date may be up to 7 days ahead (scheduled emails) and can be changed on a reminder card ("تاریخ بدلیں", adjusts today's count); reminder cards show the contact, a Gmail button to find the first email, and the reminder text is a Reply (no subject; greets the person in brackets, e.g. "InfoTank (Avery Sellers)" -> "Hi Avery,"); forum-only leads (no contact) get no reminder; daily sent/forum counters are per device in synced mp_days and add up; "forget seen" uses mp_seenEpoch so it sticks across devices; hidden names can be removed (newest list wins); name-search businesses join the suspension monitor; tool email subject is "Quick question about <name> on Google Maps".
- Security 31 Oct: Sync lock (Settings "Sync پاس ورڈ", device-only mp_syncPass, never synced): every synced value is sealed client-side with AES-GCM (PBKDF2 150k, salt = sync URL, key name as AAD) as "enc1:..."; with a password set, unsealed or tampered cloud values are rejected; a device without the password (or with a wrong one) never overwrites a locked cloud. No Apps Script change needed. Personal link now carries the sync password, asks for confirmation, accepts only script.google.com/macros/s/.../exec links and clears itself from the address bar. Website links only http(s); CSV cells starting with = + - @ get a leading quote. Reminders on the lead's weekend show "<day> کو بھیجیں" with the send time for that day; Reddit handles count as forum-only. Remaining by design: anything on the asifali549.github.io origin can read localStorage (never host other people's code there); key referrer restriction can be spoofed outside browsers (use API quotas + budget alert).
- Today card also shows a weekly backup reminder (download the client list) when this device hasn't exported it for 7 days.
- Work rule: do all lead work in ONE main chat; before any email, search Gmail for the company name to avoid sending twice.
- Storage: localStorage keys start with `mp_` (mp_leads, mp_follow, mp_watch, mp_apiKey, mp_syncUrl, ...).

## Definition of done for ANY tool change (Claude does this unasked; the owner expects it as his teacher)
1. A test for the change itself, added to `tests/` (fake Google services only; never touch his real key, Sync or site).
2. The whole suite passes: `node tests/run_all.js` (needs Node + Playwright Chromium; starts its own local server). Tests that depend on the day use a fixed clock.
3. A bug hunt of the changed code (edge cases: weekends, time zones, two devices, empty fields, old saved data).
4. A security look: untrusted text (business names, forum data, synced data) must never become code, links must be http(s), secrets never leave the device unsealed.
5. Tell him how to check it on his phone (close and reopen the app; what he should see).
Rollback: every change is a git commit; to undo, revert that commit and push (GitHub Pages updates in 2 to 5 minutes).
Tool is FROZEN from 31 Oct 2026: no new features unless he asks; fix bugs only. Focus is finding paying clients.

## How clients are found (current routine)
- Scheduled task **"MapPeak Daily Leads"** runs at ~9:40 and ~17:40 Pakistan time. It reads Reddit (r/GoogleMyBusiness, r/smallbusiness, r/localseo), the Google Business Profile Community, Google Maps Community, Apple Communities, Shopify Community and Local Search Forum, and sends him drafts only (never posts). The report ends with one code block he copies to Claude in one tap.
- Each run is a separate chat; he pastes the report (links) into the main chat. Claude then reads every thread in full (Playwright render; plain curl returns no post text) before finalising replies.
- His forum display name: **"Asif MapPeak Local"**. Reddit: u/MapPeakLocal (new account, DMs blocked, max 2 to 3 comments per run).
- Order: public forum reply first (helpful, no links, no prices, no self-promotion), then a short private email that offers a free look. Mention the forum reply in the email ONLY after Claude has checked (logged-out render) that the reply is publicly visible; new-account replies are sometimes held by the filter (Greece thread, 30 Oct).
- Skip threads with any Diamond/Platinum/Gold Product Expert reply, threads where a Silver PE is still talking with the owner, and threads where other replies already cover our points (rule added to the leads task 30 Oct). Never contradict a Product Expert.
- US/UK/Europe/Australia: **email only** from the Gmail app, never cold WhatsApp. Gulf and Pakistan: WhatsApp is fine. Schedule so it arrives ~9 AM in their time zone.
- Never send sales messages through a business's customer quote/estimate form.
- Skip: agencies posting for clients, threads a Gold/Platinum Product Expert is already handling, suspicious posts, India-based posts.
- A suspended profile does not show on Google Maps; a similar name may be a different business.

## Pricing (launch price for first 10 clients, never say "we are new")
- Free profile check + picture report.
- Profile fix: $49 (regular $99) / 199 SAR / 5,000 PKR.
- Review problems + review QR system: $39 / 149 SAR / 3,000 PKR.
- Lost or hijacked profile recovery: $79 / 299 SAR / 6,000 PKR.
- Suspension appeal: $49 to prepare + $50 only if reinstated (never promise reinstatement).
- Monthly care: $59/month.
- Small jobs: payment after the work. He shows each client to Claude, who quotes the market rate and MapPeak's price for that case.
- "Profile fix done" means: complete profile (category, description, services, hours, photos), replies to old reviews, review QR card, first 2 to 3 posts, Facebook/WhatsApp link. Reviews come from customers; never promise rating gains. Timeline 3 to 5 days after he is added as **Manager** (never ask for passwords).

## Rules that must not be broken
- No fake reviews, no review incentives, no review gating, never claim another business's listing.
- Forum: never advertise. Product Experts programme: joining is optional later; it bans promoting services on the forums.
- Direction agreed: MapPeak Local only for ~3 months (from late October 2026). Check points: end of November (replies?), end of December (a paying client?), end of January (decide). Plan B if it fails: white-label work for Western agencies; Plan C: Etsy.
