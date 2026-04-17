# WrapSnap — Project Spec & Status

**Live URL:** https://wrapsnap.advertisingvehicles.com  
**Date:** 2026-04-17

---

## What Is WrapSnap?

WrapSnap is a SaaS tool for Advertising Vehicles Account Executives (AEs). It lets clients photograph their vehicle using a guided mobile flow, then uses Claude AI vision to estimate square footage for vinyl wrap quotes — without an in-person measurement.

---

## Current Status

Core flow is **complete and live**. Microsoft SSO working. Two-path dashboard (Scan a Vehicle / Invite a Client). Photo upload to Supabase confirmed working. Smart 3-layer Claude prompt with two-marker fiducial validation built. Annotated image output with canvas overlay is implemented (shows colored boxes per vinyl zone with download button).

**Waiting on:**
- Physical fiducial cards (needed for real-world accuracy testing)
- WrapSnap logo file
- Twilio A2P 10DLC registration (needed for SMS to reach all carriers)

---

## User Flow

### AE (Account Executive)
1. Signs in via Microsoft SSO (Azure AD)
2. Dashboard offers two paths:
   - **Invite a Client** — enter client name, phone, vehicle description, link expiry → Twilio SMS sends scan URL + PIN
   - **Scan a Vehicle** — AE scans themselves (bypasses PIN via `?ae=1`)
3. Session detail page shows: scan link, PIN reveal, panel photos, estimate results

### Client
1. Receives SMS with link + 6-digit PIN
2. Enters PIN on mobile browser (no app required)
3. Reads instructions (place fiducial cards, step back, take photo)
4. Captures 4 panels: Driver Side, Passenger Side, Front, Rear
5. Reviews and submits
6. Estimate is generated, AE is notified

---

## Completed Features

### Authentication
- Microsoft SSO via Azure AD (NextAuth)
- Server-side session validation on all AE routes

### AE Dashboard (Two-Path)
- "Invite a Client" card → `POST /api/sessions` → SMS via Twilio
- "Scan a Vehicle" card → inline vehicle description form → redirects AE to scan flow with `?ae=1` bypass
- Recent sessions list with status badges

### Session Management
- OTP session creation: cryptographically secure 6-char token + 6-digit PIN (bcrypt hashed)
- Configurable expiry: 24 / 48 / 72 hours
- Session states: `pending` → `active` → `complete` | `expired`
- Vehicle description field on session (passed to estimate context)
- Twilio SMS delivers scan link + PIN; SMS failure is non-fatal (207 response, session still created)

### Client Scan Flow (5 States)
- **PIN Entry** — 6-digit input with paste support and backspace handling
- **Instructions** — 3-step onboarding screen (place fiducial cards, step back, take photo)
- **Photo Capture** — panel-by-panel camera capture with live preview, rejection feedback, skip option
- **Submission** — photo review grid with submit button and loading state
- **Complete** — success confirmation with checkmark animation

### AE Self-Scan Bypass
- `?ae=1` query param skips PIN entry entirely
- Enabled from session detail "Scan this vehicle" button and from dashboard ScanButton

### Photo Upload & Validation
- Uploads to Supabase Storage bucket `vehicle-photos` as `{session_id}/{panel_slug}.jpg`
- **Claude Haiku 4.5** validates each photo before accepting:
  - Vehicle must be visible
  - Exactly 2 fiducial reference cards required per photo (12" diameter circles)
  - Rejects: no vehicle, no fiducial, one fiducial, too close, too dark, too blurry, bad angle
  - Returns friendly rejection message shown to client with retake option

### Smart 3-Layer Claude Prompt Architecture
1. **Layer 1 — Photo Validation** (Haiku 4.5 per-photo, fast and cheap)
2. **Layer 2 — Estimation** (Sonnet 4.6, all panels, structured JSON output)
3. **Layer 3 — (planned)** Post-processing / confidence review pass

### AI Estimation Engine
- **Model:** `claude-sonnet-4-6`
- **Prompt:** VinylSizer — 5-step estimation process:
  1. Validate photo (2 fiducial cards required)
  2. Dual-card pixel calibration with perspective correction
  3. Vinyl zone detection: `printed_wrap`, `cut_vinyl`, `review`
  4. Square footage calculation with bleed (+1.5" printed, +0.5" cut vinyl)
  5. Bounding box output per zone (x_pct, y_pct, width_pct, height_pct)
- Returns: vehicle type, per-panel breakdown, totals (best/low/high sqft), confidence, bounding boxes
- Stored in `estimates` table; session marked `complete` on success

### Session Detail Page
- Signed photo URLs (1-hour expiry)
- **Annotated photo overlay** — canvas draws colored boxes on panel photos using Claude's bounding box output:
  - Blue = printed wrap
  - Red = cut vinyl
  - Yellow = review needed
- Download button per panel saves annotated JPEG
- Per-panel estimate breakdown with sqft ranges
- Vehicle type, total sqft, confidence badge, confidence note

### Database Schema (Supabase)
- `sessions` — token, PIN hash, client info, vehicle description, status, expiry
- `uploads` — panel name, storage path, session FK
- `estimates` — vehicle type, panels JSONB, sqft totals, confidence, raw Claude response

---

## Fiducial Reference Cards

Each photo requires **two** 12" diameter circular reference cards placed flat on the vehicle surface — one near the front edge of the panel, one near the rear edge. The AI uses the two cards for:
- Scale calibration (pixels-per-inch)
- Perspective correction (near card vs far card diameter difference)

Physical cards are on order. Until they arrive, real-world accuracy testing is blocked.

---

## Next Priorities

1. **Twilio A2P 10DLC registration** — required for SMS to reliably reach all carriers in the US. Currently blocked on business registration.

2. **WrapSnap logo integration** — logo file not yet received. Placeholder icon in header/branding.

3. **Real vehicle accuracy testing** — waiting on fiducial cards. Will compare AI estimates to manual tape measurements.

4. **Annotated image refinement** — once real photos are tested, tune bounding box accuracy and bleed visualization.

5. **Email fallback** — if Twilio A2P is delayed, add email delivery as alternative to SMS.

6. **PDF export** — generate a formatted estimate PDF from session detail for client-facing quotes.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| Auth | NextAuth + Azure AD |
| Database | Supabase (Postgres) |
| Storage | Supabase Storage |
| AI | Anthropic Claude (Haiku 4.5 + Sonnet 4.6) |
| SMS | Twilio |
| Styling | Tailwind CSS v4 |
| Hosting | Vercel |

---

## Environment Variables Required

```
NEXTAUTH_SECRET
NEXTAUTH_URL
AZURE_AD_CLIENT_ID
AZURE_AD_CLIENT_SECRET
AZURE_AD_TENANT_ID
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
```
