# SportStack — Media Pack Master Checklist

Everything the sample pack contained, **plus** a new Animations section and recommended extras.

- Tick each box as it's produced.
- **✨ = new suggestion** (not in the sample pack).
- Most items ship as **both SVG** (vector, stays sharp at any size) **and PNG** (a flat image for places that can't use SVG).
- All wordmark text is exported as **outlines** (letters turned into shapes) so Poppins doesn't need to be installed anywhere.

---

## 01 — Logo
- [ ] Full-colour (SVG + PNG)
- [ ] Dark version
- [ ] White version
- [ ] Horizontal lockup (icon + wordmark)
- [ ] Stacked / vertical lockup
- [ ] Icon-only
- [ ] ✨ Mono (single-colour) — for stamps, print, embroidery
- [ ] ✨ Flat simplified mark — for tiny sizes / favicons

## 02 — Icons
**Favicon**
- [ ] favicon 16×16, 32×32, 48×48 (PNG)
- [ ] favicon.ico
- [ ] site.webmanifest
- [ ] browserconfig.xml

**UI feature icons (SVG + PNG)**
- [ ] clubs, fixtures, ladder, lineup, notifications, players, results, settings, stats, teams
- [ ] ✨ umpiring, ✨ Player MVP Voting, ✨ Umpire Match Voting, ✨ venues, ✨ divisions, ✨ requests/approvals, ✨ formations

## 03 — App Icons
- [ ] Full size set: 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 192, 256, 512, 1024 (PNG)
- [ ] app-icon-master.svg
- [ ] Mockups: on phone, on tablet, on desktop
- [ ] ✨ Android adaptive icon (separate foreground + background layers)
- [ ] ✨ Maskable icon (safe-zone version for PWA/Android)
- [ ] ✨ Monochrome icon (for Android themed icons)

## 04 — Website
- [ ] Header logo + white header logo (600×160)
- [ ] Footer logo
- [ ] Sidebar logo + collapsed sidebar icon
- [ ] Hero banner (+ 1920×1080)
- [ ] Loading logo + loading screen
- [ ] Social preview 1200×630 (the image shown when a link is shared)
- [ ] Dashboard mockup + login-screen mockup
- [ ] ✨ 404 / error illustration
- [ ] ✨ Empty dashboard state
- [ ] ✨ Email header/footer banner (to match your Resend emails)
- [ ] ✨ Maintenance / "be right back" page

## 05 — Social Media
**Templates — each in Landscape 1200×630, Square 1080×1080, Story 1080×1920**
- [ ] club announcement
- [ ] final score
- [ ] grand final
- [ ] ladder update
- [ ] player milestone
- [ ] player of the match
- [ ] registration open
- [ ] round fixtures
- [ ] team selection
- [ ] training update
- [ ] ✨ Player MVP Voting open
- [ ] ✨ fixture reminder ("this weekend")
- [ ] ✨ welcome new member
- [ ] ✨ sponsor thank-you

**Profiles & banners**
- [ ] Facebook cover 1640×924, Facebook post 1200×630
- [ ] Instagram post 1080×1080, Instagram story 1080×1920
- [ ] LinkedIn banner 1584×396
- [ ] X/Twitter banner 1500×500
- [ ] Social banners 1500×500 and 1920×640
- [ ] Profile icons 512×512 and 1024×1024

## 06 — Advertising
- [ ] Launch promo: landscape, square, story
- [ ] App-store style promo
- [ ] Flyer A4 (print), Poster A3 (print)
- [ ] Sponsor card template
- [ ] Web ad banners: 728×90, 300×250, 970×250
- [ ] ✨ 160×600 skyscraper ad
- [ ] ✨ One-page pitch sheet for associations
- [ ] ✨ QR-code "join / sign-up" card

## 07 — UI Assets
- [ ] Status badges (SVG + PNG): draw, final, live, loss, upcoming, win
- [ ] ✨ Extra badges: postponed, forfeit, bye
- [ ] Buttons: primary, secondary, icon-only
- [ ] Cards: fixture, player, stat, team
- [ ] Empty states: fixtures, players, teams
- [ ] background-pattern.svg
- [ ] loading-spinner.svg
- [ ] loading-stack-animation-frames 01–12

## 08 — Brand Guide
- [ ] Brand guide PDF
- [ ] Colour palette sheet
- [ ] Typography sheet
- [ ] Logo do's & don'ts
- [ ] Logo spacing guide
- [ ] Example usage board
- [ ] Brand board (single overview image)
- [ ] ✨ Icon usage / scaling guide
- [ ] ✨ Accessibility & colour-contrast notes

## 09 — Source Files
- [ ] Colour tokens (JSON) + colours (TXT)
- [ ] Export settings
- [ ] Pitch geometry (JSON) + pitch markings master (SVG)
- [ ] Logo master (SVG) + **icon master (SVG)** — the 3D stack
- [ ] Figma / Illustrator import notes
- [ ] README + file list
- [ ] ✨ Font solution: self-hosted Poppins files + outlined-text master

## 10 — ✨ Animations (new)
Short, looping motion for the app and website. Delivered in a few formats so they work anywhere:
*GIF = simple animated image · Lottie = a tiny animation file that plays smoothly in web/app · animated SVG = motion built into the vector itself.*

- [ ] Loading stack spinner — animated SVG + GIF + Lottie (cards cycling / pulsing)
- [ ] Keep the existing 12-frame PNG sequence as a fallback
- [ ] ✨ Splash "deal the stack" intro (cards fan out then stack, on app launch)
- [ ] ✨ Card-flip micro-interaction (discipline card reveal)
- [ ] ✨ Success / celebration burst (win recorded, MVP announced)
- [ ] ✨ Skeleton loaders (greyed placeholders while fixtures/players load)
- [ ] ✨ Subtle animated favicon (optional)

---

### Notes
- **Formats:** SVG for anything on-screen; PNG for fallbacks and print previews; ICO for the favicon; PDF for the brand guide; JSON for tokens, geometry and Lottie.
- **Font:** self-host Poppins on the site; outline the text in all image exports.
- **Master source of truth:** `sportstack-icon-master.svg` (the 3D stack) drives every icon/app-icon/favicon so they stay consistent.
