# Kepler AI: what was added and how to edit it

This guide explains each thing added during the compliance audit (18 November 2026) and how to change it yourself.

**How to edit any file:** on GitHub, open the file, click the pencil icon (✏️ "Edit this file"), make your change, then click **Commit changes**. GitHub Pages updates the live site from `main` within a minute or two. To find a line quickly, press `Ctrl+F` (`Cmd+F` on Mac) in the editor and search for the text shown below.

---

## 1. Privacy, Terms and Credits pages

**Files:** `privacy.html`, `terms.html`, `credits.html`

**What they are:** draft legal pages. The footer and the sign-in screen link to them.

- **Privacy** says what data the site collects (emails, GitHub sign-in info, chats) and where it goes (Supabase, Groq, GitHub Pages, jsDelivr, Iconify). It also says the site sets no cookies or tracking.
- **Terms** covers the AI's mistakes, accounts, acceptable use and availability.
- **Credits** lists the licenses for fonts, icons, code libraries and AI models, including the "Built with Llama" credit that Meta's license requires.

### Filling in the placeholders

Each unfinished part is wrapped like this:

```html
<span class="todo">[contact email]</span>
```

It shows on the page as yellow highlighted text. To fill one in, replace the **whole thing**, tags included, with your text:

```html
hello@keplerdesigns.com
```

Search for `class="todo"` to find every placeholder. They need:

| Placeholder | In | What to put |
|---|---|---|
| `[date of approval]` | privacy, terms | The date the page is finalised, e.g. `18 December 2026` |
| `[legal name ...]` | privacy, terms | Your legal name or registered business name |
| `[contact email]` | privacy (2×), terms | The email people should use about privacy or their account |
| Groq privacy link | privacy | A link to Groq's current privacy policy, after you've read it |
| Legal basis, transfers, rights list | privacy | **Ask a lawyer.** Only needed if you serve people in the UK or EU |
| Retention period | privacy | How long you keep inactive and guest accounts, e.g. "deleted after 12 months of no use" |
| Minimum age | privacy, terms | The youngest age allowed (e.g. 13), decided with a lawyer |
| Use-policy links | terms | Links to Groq's and the AI models' acceptable use policies |
| Rights in AI replies, warranty, governing law | terms | **Ask a lawyer** |

### Removing the yellow "Draft" box

When a page is final, delete this whole block near the top of the page (it starts with `<div class="draft"`):

```html
<div class="draft" role="note"><strong>Draft for review.</strong> ... </div>
```

### Adding a credit (e.g. once you know where the video came from)

In `credits.html`, add a new `<li>` line inside the right list:

```html
<li><strong>Background video</strong> by [creator name], from [website]. Licensed under [license name].</li>
```

### Changing how the pages look

All three pages share one stylesheet: `assets/legal.css`. For example, to change the link colour, edit `a{color:#1d4ed8}`.

### Hiding the legal links until the pages are ready

In `index.html`, search for `class="legal"` (footer) and `auth-legal` (sign-in screen) and delete those lines. Put them back once the pages are final.

---

## 2. Background video pause button

**File:** `index.html`

**What it is:** the small round button at the bottom-right corner that pauses and plays the mountain video. It is needed because accessibility rules say moving backgrounds must be pausable. If someone's device is set to "reduce motion", the video now starts paused.

- **Look:** search for `.vid-toggle{`. `right:` and `bottom:` set its position, `width:34px;height:34px` its size, and `background:rgba(0,0,0,.35)` its colour (black at 35% see-through).
- **Behaviour:** search for `Background video: pause button`.

---

## 3. Colours

**File:** `index.html` (inside the `<style>` section near the top)

| What | Search for | Current |
|---|---|---|
| Login screen links, ticked checkbox, focus outline | `C35120` | `#C35120` (your orange) |
| Login email/password box glow when clicked | `195,81,32` | the same orange as RGB, written `rgba(195,81,32,.7)` |
| "Kepler AI" label above each reply | `c2410c` | `#c2410c` (darker orange, easy to read) |
| Grey hint text (placeholders, menu descriptions) | `--muted:#6b7280` | `#6b7280` |

To change a colour, replace the code with your own hex value. Very light colours on white become hard to read, so check them in a contrast checker (search "WebAIM contrast checker") and aim for at least **4.5:1**.

---

## 4. Footer and legal links

**File:** `index.html`, search for `Built by Lennon`

```html
<p class="by">Your friendly AI, powered by Groq. Built by Lennon, Kepler Designs</p>
<nav class="legal" aria-label="Legal"><a href="privacy.html">Privacy</a>...</nav>
```

Edit the words between `>` and `<`. To add a link, copy one `<a href="...">...</a>` and change the address and the text.

---

## 5. Sign-in and chat rules

All in `index.html`:

| Rule | Search for | How to change |
|---|---|---|
| Minimum password length (8) | `password.length < 8` | Change both `8`s on that line. Also set the same number in Supabase → Authentication → Providers → Email → minimum password length. |
| Max message length (4,000 characters) | `text.length > 4000` | Also change `MAX_CHARS` in the chat function (section 7), or long messages will be refused there. |
| Attached file limit | `That file is too long` | The file's text has to fit within the 4,000-character message limit. |
| "About Kepler AI" text | `I'm Kepler AI, a friendly assistant` | Edit the sentence inside the quotes. Keep the straight quote marks `"` at each end. |
| "Smartest" / "Fastest" labels | `const PILLS` | Change the words in quotes, or remove an entry. |

---

## 6. Security pins on outside code (SRI)

**File:** `index.html`, lines 12–13

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"
        integrity="sha384-..." crossorigin="anonymous"></script>
```

The `integrity` value is a fingerprint of the exact file. If the CDN ever serves a changed or tampered file, the browser refuses to run it. That protects your users' sign-ins.

**Editing rule:** if you change a version number (for example `2.45.4` → a newer one), you **must** update the `integrity` value as well, or that script won't load and the site will break. To get the new value:

1. Go to `https://www.srihash.org`.
2. Paste the new script URL and click **Hash!**.
3. Copy the `integrity="sha384-..."` value it gives you into the tag.

If you're unsure, leave the versions as they are; they work.

---

## 7. Chat function changes

**File:** `supabase/functions/lennon-chat/index.ts`

Two changes were made:

1. **Only the message text and role are sent to Groq.** Search for `Forward only role and text`. This stops someone sending hidden extra instructions through the site's server.
2. **Error messages are generic.** Visitors now see "Kepler AI is not available right now". The real reason (e.g. the Groq key is missing or wrong) goes to the function's logs: Supabase dashboard → Edge Functions → `lennon-chat` → **Logs**.

**Important:** editing this file on GitHub does **not** change the live function. After any edit you must redeploy it:

- **Dashboard:** Supabase → Edge Functions → `lennon-chat` → open the code editor → paste in the new file contents → **Deploy**.
- **Command line** (if you have the Supabase CLI):
  ```bash
  supabase functions deploy lennon-chat --no-verify-jwt
  ```

The audit changes and Kepler Code were deployed on 18 November 2026 (function version 13).

**The AI's name and identity** are set in the same file. Search for `You are Kepler`. The audit report recommends rewording it so the AI doesn't claim it built itself (see the report, section 10, step 4).

---

## 8. Kepler Code (coding mode with live preview)

**What it is:** the **Chat / Code switch** at the top of the sidebar turns on Kepler Code. It builds websites, apps and games in HTML, CSS and JavaScript. When a reply contains a page, a card appears in the chat and a **preview panel** opens on the right. The panel has:

- **Preview / Code** tabs (the running page, or its source)
- **Reload**, **Copy**, **Download** (saves an `.html` file), **Full screen** and **Close** buttons
- a left edge you can drag (or focus and use ← →) to resize it; the width is remembered

On phones the panel fills the screen. Each chat remembers which mode it started in. **Recents only lists chats of the current mode**, so switching to Code shows your code projects and switching back shows your chats. Switching modes in the middle of a chat starts a new one.

**Safety:** previews run in a sandboxed frame (`sandbox="allow-scripts allow-modals allow-forms allow-popups"`, **without** `allow-same-origin`). Code the AI writes can't read your site, its storage or anyone's sign-in. Don't add `allow-same-origin` to that frame.

**Where to edit:**

| What | File | Search for |
|---|---|---|
| How the AI behaves in code mode (rules, style, output format) | `supabase/functions/lennon-chat/index.ts` | `const codeSystem` |
| Reply length for code (bigger, so whole files fit) | same file | `const budget` |
| Heading and placeholder in code mode | `index.html` | `What should Kepler Code build?` |
| Quick-start prompts in the Tools menu | `index.html` | `const STARTERS` |
| Card and code-block look | `index.html` | `Kepler Code: reply cards` |
| Preview panel look, default width | `index.html` | `Kepler Code: preview panel` (`--pv-w`) |

After editing the function file, redeploy it (section 7). The `mode` column on the `chats` table (`chat` or `code`) stores each chat's mode.

## 9. Sidebar

**Layout (top to bottom):** logo with the current mode name (Chat or Code) and the **Chat / Code switch** at the top-right; **New**, **Search** and **More**; **Recents** (click to collapse; shows 15 chats, then **Show more**); and at the bottom your **account** (opens the account menu) with the **settings gear** on the right.

- **Recents** shows only the current mode's chats (Chat or Code).
- **Search** filters those chats by title and message text. Press Esc to close it.
- **More** has About, Get help, What's new, Privacy, Terms and Credits.
- **Settings (gear)** has Appearance (light or dark message box), Background video on or off, Default mode, and Account.
- Hovering a chat shows **…** with **Rename** and **Delete** (click Delete twice to confirm).

**Where to edit** (all in `index.html`):

| What | Search for |
|---|---|
| Sidebar colours (background, text, hover) | `--s-bg:#f7f7f5` (the `--s-` values on the same line) |
| Width | `width:calc(260px` in the `.side{` rule, and `276px` in `.frame{padding-left` (keep that 16px bigger) |
| Number of chats before "Show more" | `const SHOW = 15` |
| More menu items | `$('sideMoreBtn').onclick` |
| Settings menu items | `$('sideGear').onclick` |
| Pop-up menu look | `.s-pop{` |

## 10. Replies: thinking, typing and the action bar

- **Thinking:** while Kepler waits for the AI, the reply bubble shows a shimmering "Thinking" (or "Building" in Code mode) with three bouncing dots.
- **Typing:** the reply then types itself out, at least 250 characters per second. Long replies speed up so none takes more than about 6 seconds. People whose device is set to reduce motion see the reply appear at once. The reply is saved as soon as it arrives, before the animation finishes.
- **Action bar** under every Kepler reply:
  - **Copy** the reply.
  - **Rate** it Good or Bad. The rating is saved with the chat (as `feedback` on that message) and the icon turns orange.
  - **Read aloud** using the device's built-in voice; click again to stop.
  - **Share** opens the phone or computer's share sheet, or copies the text where that isn't available.
  - **More:** **Retry** (latest reply only; asks again and replaces it); **Copy code** and **Copy text without code** when the reply has code; **Open preview** and **Download page** when it built a page.

**Where to edit** (all in `index.html`):

| What | Search for |
|---|---|
| Typing speed | `const rate = Math.max(0.25, total / 6000)`: `0.25` is characters per millisecond (250/second); `6000` is the longest time in ms |
| "Thinking" / "Building" words | `'Building' : 'Thinking'` |
| Dot and caret colour | `.dots i{` and `.caret::after` (`#C35120`) |
| Action bar look | `.acts{` and `.act{` |
| Action buttons and More menu items | `function addActions` |
| Icons | `const ICONS` |

## 11. Audit report

**File:** `docs/compliance-audit-2026-11-18.md`

This is the full list of issues, what was fixed, what's left and the score. When you fix a remaining item, you can edit its "Status" cell (e.g. change `Not fixed` to `Fixed 20 Nov`). For a future client site, run the same audit and save it as a new file with that date.

### Still to do (from the report)

1. Lock down the `news` table in Supabase (SQL in the report, §10, step 1).
2. Record the sources of the video, logo and avatars, or replace them.
3. Add a message rate limit, so guests can't run up your Groq bill.
4. Add a "Delete account" option.
5. Supabase → Authentication: minimum password 8, turn on leaked-password protection.
6. Fill in the legal placeholders and have a lawyer review the pages.
