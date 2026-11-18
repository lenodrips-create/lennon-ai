# Kepler AI: Website Legal and Security Compliance Audit

- **Project:** Kepler AI (`lenodrips-create/lennon-ai`), branch `claude/trusting-cray-uc5xf2`
- **Audited by:** Claude (AI-assisted review) for Kepler Designs
- **Date:** 18 November 2026
- **Scope:** every file in the repository (`index.html`, `supabase/functions/lennon-chat/index.ts`, `README.md`, fonts, images, video), plus a read-only check of the live Supabase project's tables, access rules (RLS policies), security advisor and Edge Function settings.

> **This is not legal advice.** This audit finds technical and practical risks. It does not guarantee legal compliance and does not mean the site is safe from lawsuits. Items marked ⚖️ need review by a qualified lawyer. "Confirmed" means the audit saw the problem directly; "Potential" means a risk the audit could not settle from the evidence it had.

---

## 1. Executive summary

Kepler AI is a single-page AI chat site hosted on GitHub Pages. It uses Supabase for accounts and chat storage, and a Supabase Edge Function that forwards chats to Groq's AI models. It has no payments, newsletter, analytics, ads or tracking scripts.

**Strengths.** The Groq API key stays on the server and is not in the page or the repository. The `chats` and `profiles` tables let each user read and write only their own rows. All user and AI text is displayed with `textContent`, so no cross-site scripting (XSS) path was found. The Edge Function checks the browser origin and the user's sign-in token, and limits message count and length.

**Main problems before launch:**

1. **Confirmed:** a database table named `news` can be edited or emptied by anyone who signs in, including one-click guests.
2. **Confirmed:** the site had no privacy policy or terms, although it collects email addresses and chat content and sends chats to Groq. Drafts now exist, but they need the owner's facts and a lawyer's review.
3. **Confirmed:** the background video, logo and 20 avatar images have no recorded source or license.
4. **Confirmed config, potential impact:** with guest sign-ins on and no rate limit, anyone can run up Groq usage.
5. ⚖️ **Potential:** the AI is told to say it was "made by Lennon" and to avoid naming the model behind it. Meta's Llama licenses require visible "Built with Llama" attribution. The model names Titan and Janus are also used by other AI products.

The audit fixed 13 code-level issues (section 11). **Score: 54 / 100** after those fixes, up from an estimated 44 before them (section 12).

---

## 2. Critical issues (resolve before launch)

| # | Issue | Status | Where |
|---|---|---|---|
| C1 | `public.news` table: any authenticated user, **including anonymous guests**, can INSERT, UPDATE and DELETE every row (policies `Owners can add/edit/delete news` use `true`). Kepler AI does not use this table, so it may belong to another project. It is currently empty. | Confirmed, **not fixed** (database change; see §10) | Supabase project `zxvbimdxcrslvdpqqalf` |
| C2 | No privacy policy or terms of use, while the site collects emails, GitHub profile data and chat content and sends chats to Groq. | Confirmed. **Drafts added** (`privacy.html`, `terms.html`); they need completing and legal review ⚖️ | whole site |
| C3 | Background video `mountains.mp4` (4096×2160, 12 s, x264 encode, no source metadata), `brand/logo.png` and `avatars/1–20.webp` have no recorded source or license. Git history only shows they were added by AI-assisted commits. | Confirmed unknown provenance | `index.html:421`, `:481`, `:532`; `avatars/` |

## 3. High-priority issues

| # | Issue | Status | Where |
|---|---|---|---|
| H1 | No rate limiting on the chat function. Since guest (anonymous) sign-in is enabled, anyone can create accounts and spend the Groq quota or bill. | Confirmed config; impact potential | `supabase/functions/lennon-chat/index.ts:75`; `index.html:695` |
| H2 | Two CDN scripts loaded without Subresource Integrity. A compromised CDN file would run with full access to user sessions. | **Fixed:** pinned with `integrity` hashes. Supabase now loads its official prebuilt `supabase.js`, not jsDelivr's auto-minified copy. | `index.html:12–13` |
| H3 | ⚖️ The system prompt makes the AI claim it was "made by Lennon" and avoid naming the underlying model. Two of its engines are Meta Llama 3.1 / 3.3. Their community licenses require visible "Built with Llama" attribution for products that use them, and a copy of the license. | Potential. **Partly addressed:** attribution added on `credits.html`; the prompt is unchanged (owner decision) | `lennon-chat/index.ts:49–51` |
| H4 | No way for users to delete their account. "Clear all chats" removes chats but leaves the account and profile. Many privacy laws give a right to deletion. ⚖️ | Confirmed. Not fixed (needs a server function); privacy draft tells users to email | `index.html:598` |
| H5 | ⚖️ Trademark risk for the names "Kepler" (widely used, including other software and AI companies) and the model names "Titan" (Amazon Titan AI models) and "Janus" (DeepSeek Janus models). | Potential: needs a trademark clearance search | `index.html:845–848`, `lennon-chat/index.ts:26–29` |

## 4. Medium-priority issues

| # | Issue | Status | Where |
|---|---|---|---|
| M1 | Supabase "leaked password protection" is off; the minimum password was 6 characters. | Client minimum **raised to 8**. The Supabase setting must also be changed (§10). | `index.html:714` |
| M2 | Error messages told the public about internal setup ("the Groq key was rejected, check the GROQ_API_KEY secret"). | **Fixed:** generic message to users, detail kept in server logs | `lennon-chat/index.ts:98–100`, `:149–151` |
| M3 | The function passed the client's message objects to Groq unchanged, so extra fields could be forwarded. | **Fixed:** only `role` and `content` are forwarded | `lennon-chat/index.ts:123` |
| M4 | The `chats.messages` column has no size limit. A user can write very large rows directly through the database API, bypassing the site's 4,000-character limit. | Confirmed. Not fixed (database change; §10) | Supabase `public.chats` |
| M5 | Keyboard access: the attach-file button could not be reached by keyboard (`display:none` input); the closed phone drawer stayed in tab order; the sign-in screen was not marked as a dialog. | **Fixed** | `index.html:143`, `:478`, `:1114` |
| M6 | Pop-up menus (Tools, model, user menu) use `role="menu"` but have no arrow-key navigation, and focus doesn't move into them. | Confirmed, **not fixed** | `index.html:454–462`, `:546` |
| M7 | Background video autoplays and loops with no way to pause it (WCAG 2.2.2). | **Fixed:** pause button, and the video starts paused for people who prefer reduced motion | `index.html:385`, `:1100–1110` |
| M8 | Low contrast: grey text #9ca3af (2.5:1), the "Kepler AI" label #E88654 (2.6:1) and sign-in links #a78bfa (2.7:1) failed WCAG AA 4.5:1. | **Fixed:** #6b7280 (4.8:1), #c2410c (5.2:1), #C35120 (4.7:1). The brand accent is unchanged elsewhere. | `index.html:42`, `:103`, `:346` |
| M9 | Footer text sits directly on a moving video, so its contrast varies frame to frame. It relies on a text shadow. | Potential, not fixed | `index.html:467–468` |
| M10 | Commits describe the user menu as "modeled on the user-dropdown component" and the sign-in screen as matching a component's "animate-element". Copy such as "continue your journey with us" is template text. The source component and its license are unknown. | Potential | `index.html:478–524`, `:546–604` |
| M11 | ⚖️ The About text mentions homework help, which suggests young users, but the site sets no minimum age. Laws such as COPPA (US) apply to under-13s. | Potential | `index.html:1080` |
| M12 | Icons come at runtime from the Iconify API (`api.iconify.design`): a third-party request on every visit and an outside dependency. The Solar icon set is listed by Iconify as CC BY 4.0, which requires attribution. | Attribution **added** to `credits.html`. The runtime dependency remains. | `index.html:12`, `:546–604` |

## 5. Low-priority issues

| # | Issue | Status |
|---|---|---|
| L1 | Footer typo "Built my lennon". | **Fixed** → "Built by Lennon" (`index.html:467`) |
| L2 | "Clear all chats" ignored database errors and showed chats as cleared anyway. | **Fixed** (`index.html:1085–1086`) |
| L3 | Files up to 12 KB could be attached, but messages are capped at 4,000 characters, so most files could never be sent. | **Fixed:** the check now matches the real limit (`index.html:915`) |
| L4 | The About text said all chats are saved to your account, which is wrong for guests. Added "I can make mistakes". | **Fixed** (`index.html:1080`) |
| L5 | Two `<h1>` elements in the page (`:425`, `:482`); "Reset password" is a link (`href="#"`) that acts as a button (`:506`). | Not fixed |
| L6 | "What's new?" links to the GitHub commit history. That exposes development history, and the link breaks if the repository is private. | Not fixed (`index.html:588`) |
| L7 | GitHub Pages can't send security headers (CSP, `frame-ancestors`, `X-Content-Type-Options`). | Not fixed. See §10 |
| L8 | "Smartest" / "Fastest" labels compare only Kepler's own models. Low risk, but "Smartest" is unqualified. | Not fixed (`index.html:848`) |
| L9 | IBM Plex Serif has the Reserved Font Name "Plex". If these `.woff2` files were converted or subset by someone other than IBM, the OFL may require renaming the font. | Potential: confirm the files are IBM's official builds |
| L10 | The publishable Supabase key is hardcoded in the page and as a fallback in the function. Publishable keys are designed to be public. | No action needed; noted for completeness |

---

## 6. Copyright and licensing report

| Asset / dependency | Purpose | License | Commercial use | Attribution | Verification needed |
|---|---|---|---|---|---|
| `mountains.mp4` | Background video | **Unknown** | Unknown | Unknown | **Yes: find the source and license, or replace it** |
| `brand/logo.png`, icons | Kepler logo | **Unknown** (presumed original) | Unknown | — | **Yes: confirm who made it and that Kepler Designs or the client owns it** |
| `avatars/1–20.webp` | Profile pictures | **Unknown** | Unknown | Unknown | **Yes** |
| IBM Plex Serif (`fonts/`) | Main typeface | SIL OFL 1.1, license file included | Yes | Keep license with the fonts | Confirm files are unmodified official builds (L9) |
| Ubuntu (`fonts/`) | User-menu typeface | Ubuntu Font Licence 1.0, license file included | Yes | Keep license with the fonts | No |
| supabase-js 2.45.4 (jsDelivr) | Auth and database client | MIT (checked in package) | Yes | Keep notice (now on credits page) | No |
| iconify-icon 2.1.0 (jsDelivr) | Icon web component | MIT (checked in package) | Yes | Keep notice | No |
| Solar icons (via Iconify API) | Menu icons | CC BY 4.0 as listed by Iconify | Yes | **Required**, now on credits page | Confirm the listing |
| Inline SVG icons (eye, paperclip, arrows) | Interface icons | Appear to be from Lucide (ISC) | Yes | Notice, now on credits page | Confirm |
| GitHub mark | "Continue with GitHub" button | GitHub trademark | Allowed for sign-in buttons under GitHub's logo rules | — | Low |
| Groq API | Runs the AI models | Groq commercial terms | **Check Groq's terms for your plan** ⚖️ | — | **Yes** |
| gpt-oss-120b / 20b | AI models | Apache 2.0 | Yes | — | No |
| Llama 3.1 8B, Llama 3.3 70B | AI models | Llama Community Licenses + Acceptable Use Policy | Yes, under conditions | **"Built with Llama"**, now on credits page | ⚖️ Yes |
| Supabase | Hosting, auth, database | Supabase terms of service | Yes (plan-dependent) | — | Check the free-plan limits for client use |
| GitHub Pages | Static hosting | GitHub terms | Not intended to be the main host for a commercial business or online service ⚖️ | — | **Yes**: consider another host for a commercial launch |
| UI layout / copy from a "user-dropdown" and sign-in component | User menu, sign-in screen | **Unknown** | Unknown | Unknown | **Yes** (M10) |

**AI-generated content.** Most of the code was written with AI assistance (see `Co-Authored-By` lines in git history). The audit found no copied third-party code beyond what is listed above. AI-generated material is **not** automatically free of copyright, and in some countries it may not be protectable by the client either ⚖️.

## 7. Security report

| Area | Finding |
|---|---|
| Exposed secrets | **None found.** The Groq key is a Supabase secret. The only key in the page is the publishable Supabase key, which is designed to be public. |
| Authentication | Supabase Auth (email/password, GitHub OAuth, anonymous guests). The function verifies the user token by calling `/auth/v1/user` (`verify_jwt` is off on purpose). Password minimum raised to 8 in the page; leaked-password protection is off (M1). |
| Authorization (RLS) | `chats` and `profiles`: users can access only their own rows. Good. `news`: open to every signed-in user (**C1**). |
| XSS | No sink found. Messages use `textContent`; `innerHTML` is used only with fixed strings or escaped model names. |
| SQL injection | Not applicable. All queries go through Supabase's PostgREST client, with no raw SQL in the app. |
| CSRF | Low risk. Requests use a bearer token from storage, not cookies. |
| CORS | Origin allowlist (`lennon-chat/index.ts:4–8`). Correct. CORS is not access control; the token check is. |
| Input validation | Server: role, type, count (≤30) and length (≤4,000) checks; now also strips extra fields (M3). Database: no size limit on `chats.messages` (M4). |
| File uploads | Read in the browser as text only; never uploaded as a file. The limit now matches the message limit (L3). |
| Rate limiting / abuse | **None** (H1). |
| Third-party scripts | Now pinned with SRI (H2). The Iconify API still serves icon data at runtime (M12). |
| Security headers | Not possible on GitHub Pages (L7). |
| Dependencies | No `package.json`. The two CDN libraries are pinned to exact versions. supabase-js 2.45.4 is over a year old; update it and its SRI hash on a schedule. |

## 8. Privacy report

**What the site actually collects and where it goes:**

| Data | Collected when | Stored / sent to |
|---|---|---|
| Email, password (hashed by Supabase) | Email sign-up | Supabase Auth (US East) |
| GitHub name, username, email, avatar URL | "Continue with GitHub" | Supabase Auth |
| Anonymous user ID | "Skip for now" | Supabase Auth |
| Display name, status, theme | Menu settings | `public.profiles` |
| Chat titles and messages, including attached file text | Every message | `public.chats` (kept until the user clears them); last 30 messages sent to **Groq** on every send |
| IP address and browser details | Every visit | GitHub Pages, jsDelivr, Iconify API, Supabase, Groq (server side) |
| Session token, "keep me signed in", model and effort choice | Use of the site | Browser localStorage (no cookies) |

**Discrepancies:** before this audit there was **no privacy policy at all**, so none of the above was disclosed. The About text wrongly said guest chats are saved to an account (fixed). Missing pieces the owner must supply: legal name and contact, retention periods, minimum age, Groq's data retention terms, and the legal basis and transfer safeguards for UK/EU users ⚖️. The drafts make no promises the site doesn't keep, and every unknown is marked as a placeholder.

**Not present:** analytics, advertising, tracking pixels, newsletter, contact form, payments.

## 9. Accessibility report

**Fixed:** keyboard access to file attach; drawer hidden from keyboard and screen readers when closed on phones; sign-in screen marked as a modal dialog; three contrast failures; video pause control and reduced-motion support; legal links have visible underlines.

**Still open:**
- Menus have no arrow-key support and focus doesn't move into them (M6). Either add roving focus with arrow keys and focus return, or drop `role="menu"` and use plain button lists.
- Footer text contrast over the video (M9). Add a subtle dark backdrop behind the footer.
- Two `<h1>`s; "Reset password" should be a `<button>` (L5).
- The composer turns off the textarea's focus outline (`.ph:focus-visible{outline:none}`). The caret still shows focus, but a ring on the card (`.card:focus-within`) would be clearer.
- Not tested with a real screen reader. Do a manual pass with VoiceOver and NVDA before launch.

**Good:** `lang="en"`; zoom isn't blocked; buttons have accessible names; form fields have labels; chat log uses `aria-live="polite"`; reduced-motion styles exist; layout works at 390 px width.

## 10. Legal documentation report and recommended fixes

**Which legal pages this site needs:**

| Page | Needed? | Why | Status |
|---|---|---|---|
| Privacy Policy | **Yes** | Accounts, emails, chat content, third-party AI processor | Draft: `privacy.html` ⚖️ |
| Terms of Use | **Yes** | User accounts, AI output, acceptable use (model licenses require passing their use policies on) | Draft: `terms.html` ⚖️ |
| AI disclaimer | **Yes** | AI answers can be wrong | Included in Terms and in the About text |
| Credits / licenses | **Yes** | CC BY icons, Llama attribution, font licenses | Draft: `credits.html` |
| Cookie policy / banner | **No** | The site sets no cookies and uses only localStorage needed for it to work. Covered in the privacy policy. | Not needed |
| Accessibility statement | Optional | Good practice | Not created |
| Refund / shipping policy | **No** | No payments or goods | Not needed |

**Recommended fixes, step by step** (not applied; they change live services or need owner decisions):

1. **C1: lock down `news`.** If no live project uses it, drop it. Otherwise, limit writes to named admins. For example, in the Supabase SQL editor:
   ```sql
   drop policy "Owners can add news" on public.news;
   drop policy "Owners can edit news" on public.news;
   drop policy "Owners can delete news" on public.news;
   -- then add write policies limited to specific admin user IDs, or manage news only from the dashboard
   ```
2. **C3: assets.** Record the source and license of the video, logo and avatars in `credits.html`. Replace any that can't be verified with assets you made or with clearly licensed stock, keeping the license receipt.
3. **H1: rate limiting.** Add a per-user limit in the Edge Function, for example a `usage` table counted per user per hour, refusing with 429 above a threshold. Consider stricter limits for anonymous users, turning on CAPTCHA for sign-ups and guest sign-in in Supabase Auth, and a spend limit on the Groq account.
4. **H3: AI identity.** Change the system prompt (`lennon-chat/index.ts:49–51`) to something accurate, such as "I'm Kepler {name}, a chat assistant built by Lennon at Kepler Designs on open-source models served by Groq." Keep the "Built with Llama" credit while Llama models are in use ⚖️.
5. **H4: account deletion.** Add a `delete-account` Edge Function that verifies the token and deletes the user's data and auth user with the service-role key. Add a "Delete account" item with a confirmation step.
6. **H5: trademarks.** Run a trademark search on "Kepler AI", and consider renaming the Titan and Janus models ⚖️.
7. **M1:** Supabase → Authentication → set the minimum password length to 8 and turn on leaked-password protection.
8. **M4:** `alter table public.chats add constraint chats_size check (pg_column_size(messages) < 500000);` (choose the limit).
9. **Hosting:** before a commercial launch, consider a host that allows business use and custom headers (Netlify, Vercel, Cloudflare Pages). Add a Content-Security-Policy, `frame-ancestors 'none'` and `X-Content-Type-Options: nosniff`.
10. **Complete and publish the drafts:** fill every bracketed placeholder, have a lawyer review them ⚖️, then remove the yellow "Draft" boxes.

## 11. Changes made in this audit

All changes keep the existing look and features.

- `index.html`: SRI on both CDN scripts; contrast fixes; keyboard-reachable file attach; inert closed drawer; `role="dialog"` on sign-in; video pause button and reduced-motion pause; 8-character password minimum; file-length check; accurate About text with an AI-mistakes note; "Clear all chats" error handling; footer typo; Privacy, Terms and Credits links in the footer and on the sign-in screen.
- `supabase/functions/lennon-chat/index.ts`: forwards only `role` and `content` to Groq; generic public error messages. Deployed to Supabase on 18 November 2026 (version 13, together with Kepler Code).
- New: `privacy.html`, `terms.html`, `credits.html`, `assets/legal.css`.
- `README.md`: documents the legal pages, redeploy step and SRI.

Not changed on purpose: database policies, Supabase Auth settings, the AI's identity prompt, model names, and all images and video. These need the owner's decision.

## 12. Compliance score: 54 / 100

| Category | Weight | Score | Reasoning |
|---|---|---|---|
| Copyright and IP | 20 | 9 | Fonts and libraries are fine. Video, logo, avatars and template-derived UI are unverified; name conflicts. |
| Security | 20 | 12 | Strong key handling, RLS and XSS hygiene. The open `news` table, no rate limiting and weak password settings cost points. |
| Privacy | 15 | 7 | No tracking, which is good. Policy is only a draft, there's no account deletion, and Groq retention isn't disclosed. |
| Accessibility | 15 | 10 | Main failures fixed; menu keyboard support and contrast over video remain. |
| Legal documentation | 10 | 3 | Correct pages identified, but they're drafts with placeholders that need legal review. |
| Third-party licensing | 10 | 7 | Licenses identified and attribution added; Groq terms and GitHub Pages commercial use unverified. |
| Business claims | 10 | 6 | No fake testimonials, pricing or certifications. The AI's "made by Lennon" identity and implied in-house model line-up are misleading. |
| **Total** | **100** | **54** | Before the fixes in §11: about 44. |

Each category was scored by subtracting points for confirmed issues (more) and potential risks (less), then crediting fixes. **A higher score would not mean the site is legally compliant or safe from lawsuits.** It only reflects what this review could check.

## 13. Delivery and ownership checklist

Before handing a site like this to a client, confirm:

- [ ] The client owns or has a license for every image, video, logo and font (written record kept).
- [ ] Accounts for Supabase, Groq, GitHub and the domain are in the **client's** name, or the handover plan is written down.
- [ ] Secrets (`GROQ_API_KEY`) are set in the client's own Supabase project, not the agency's.
- [ ] The allowed-origins list in the function matches the client's real domain.
- [ ] The privacy policy and terms are completed and reviewed by the client's lawyer.
- [ ] This audit is re-run after any major change.
