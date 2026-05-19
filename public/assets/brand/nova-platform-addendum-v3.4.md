# NOVA GAMING NETWORK — Addendum Prompt
**Version:** 3.4 — Official Logo Integration & Motion Design
**Appends:** All previous prompts (v3.0, v3.1, v3.2, v3.3)
**Date:** 2026-05-15

---

## CONTEXT

The official Nova Gaming logo has been provided and processed.
Four logo asset variants are available in /public/assets/brand/:

```
nova_logo_full_transparent.png  — N mark + "NOVA GAMING" wordmark, transparent bg
nova_logo_nmark.png             — N mark only, transparent bg, use as icon
nova_favicon_64.png             — 64×64 N mark, for browser favicon
nova_wordmark_only.png          — "NOVA GAMING" text only, transparent bg
```

CRITICAL — Logo Integrity Rules:
- The N mark shape must NEVER be altered, redrawn, stretched, or recreated
- Always use the provided PNG assets — do not attempt to replicate the
  N mark in CSS, SVG, or canvas
- Colour of the N mark is fixed at its original #6CB604 Nova Green
- Do not apply filters, hue shifts, or colour overlays to the N mark
- Transparent background versions must be used on all dark surfaces
- The black-background original must NOT be used anywhere on the website

---

## ADD-18 — LOGO ASSET PLACEMENT (ALL PAGES)

### 18.1 Public Navbar (/stats)
```
Left side of navbar:
  [nova_logo_nmark.png at 32×32px]  [NOVA GAMING NETWORK in Orbitron 900 #6CB604]

Layout: flex row, align-items center, gap 10px
N mark: display as <img> tag, width 32, height 32
Wordmark text: Orbitron 900, font-size 14px, letter-spacing 2px, color #6CB604
Do NOT use the full logo PNG here — use N mark icon + CSS text wordmark
```

### 18.2 Authenticated Sidebar
```
Top of sidebar (collapsed and expanded states):
  Expanded:  [N mark 28px]  [NOVA GAMING — Orbitron 900, 12px, #6CB604]
  Collapsed: [N mark 28px only — centered]

N mark: nova_logo_nmark.png
Wordmark: CSS text — "NOVA GAMING" Orbitron 900
```

### 18.3 Login Page (/ngn-access)
```
Centered above login card:
  nova_logo_full_transparent.png at 120×120px
  (shows N mark + NOVA GAMING wordmark from the PNG)

Below logo:
  "NETWORK" in Orbitron 900, 11px, #6CB60488, letter-spacing 6px
  (extends the brand name without altering the logo file)
```

### 18.4 GFX Templates (Canvas)
```
All 10 GFX templates include the N mark watermark:

Position: bottom-right corner OR top-left (per template spec)
Asset: nova_logo_nmark.png
Size on 1920×1080: 48×48px
Size on 1080×1080: 40×40px
Opacity: 0.6 (subtle watermark, not distracting)

Load the PNG into canvas using:
  const logoImg = new Image();
  logoImg.src = '/assets/brand/nova_logo_nmark.png';
  await new Promise(resolve => logoImg.onload = resolve);
  ctx.globalAlpha = 0.6;
  ctx.drawImage(logoImg, x, y, 48, 48);
  ctx.globalAlpha = 1.0;

Full logo (nova_logo_full_transparent.png) used on:
  T09 Announcement Card — centered, prominent (opacity 1.0, 80×80px)
  T02 Player of the Match — top center (opacity 0.8, 56×56px)
```

### 18.5 Favicon
```
<link rel="icon" type="image/png" href="/assets/brand/nova_favicon_64.png">
Browser tab title: "Nova Gaming Network"
```

### 18.6 404 Page
```
N mark centered, 64×64px, opacity 0.4 (ghost treatment)
No wordmark on 404 — just the subtle icon mark
```

---

## ADD-19 — MOTION & ANIMATION DESIGN

All animations must follow these rules:
- Subtle and purposeful — enhances professionalism, never distracts
- Never loop aggressively on content pages (users are reading data)
- Use CSS animations where possible (GPU-accelerated, no JS jank)
- Respect prefers-reduced-motion media query — disable all animations
  if user has reduced motion enabled:
  ```css
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
  }
  ```

---

### 19.1 Public Page Hero — Logo Entrance Animation

When /stats page loads, the Nova Gaming logo in the hero section
animates in once on page load. Does NOT loop.

```css
/* N mark entrance — draw up from below with fade */
@keyframes logoEntrance {
  0%   { opacity: 0; transform: translateY(20px) scale(0.92); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.hero-logo {
  animation: logoEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* Wordmark fades in 200ms after logo */
.hero-wordmark {
  animation: logoEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards;
  opacity: 0;
}
```

---

### 19.2 Navbar N Mark — Idle Pulse Glow

The N mark in the navbar has a very slow, subtle glow pulse.
Continuous but extremely low-intensity — barely perceptible.
Gives the logo a "live" energy without being distracting.

```css
@keyframes logoPulse {
  0%   { filter: drop-shadow(0 0 0px #6CB60400); }
  50%  { filter: drop-shadow(0 0 6px #6CB60455); }
  100% { filter: drop-shadow(0 0 0px #6CB60400); }
}

.navbar-logo {
  animation: logoPulse 4s ease-in-out infinite;
}
```

---

### 19.3 Login Page — Logo Load Animation

On /ngn-access, the logo animates in before the form appears.
Creates a premium feel on entry.

```css
@keyframes loginLogoIn {
  0%   { opacity: 0; transform: scale(0.85); filter: blur(4px); }
  100% { opacity: 1; transform: scale(1);    filter: blur(0px); }
}

@keyframes loginFormIn {
  0%   { opacity: 0; transform: translateY(16px); }
  100% { opacity: 1; transform: translateY(0); }
}

.login-logo {
  animation: loginLogoIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.login-card {
  animation: loginFormIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards;
  opacity: 0;
}
```

---

### 19.4 Sidebar N Mark — Hover State

When a user hovers over the N mark in the sidebar,
it brightens slightly with a quick glow flash.

```css
.sidebar-logo {
  transition: filter 0.3s ease;
}

.sidebar-logo:hover {
  filter: drop-shadow(0 0 8px #6CB60488) brightness(1.15);
  cursor: default;
}
```

---

### 19.5 Dashboard & Stats Cards — Entrance Animation

Stats cards and leaderboard rows animate in on page load
with a staggered fade-up. Each card/row enters 60ms after
the previous one.

```css
@keyframes cardEntrance {
  0%   { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* Apply with JS — add class sequentially */
.stat-card {
  opacity: 0;
}

.stat-card.visible {
  animation: cardEntrance 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

```javascript
// Stagger cards on page load
document.querySelectorAll('.stat-card').forEach((card, i) => {
  setTimeout(() => card.classList.add('visible'), i * 60);
});
```

---

### 19.6 Leaderboard Row — Highlight Flash on Data Update

When the public /stats page auto-refreshes (every 60 seconds)
and new data arrives, rows that changed value flash briefly
in Nova green before settling.

```css
@keyframes rowUpdate {
  0%   { background: #6CB60420; }
  100% { background: transparent; }
}

.row-updated {
  animation: rowUpdate 1.2s ease-out forwards;
}
```

```javascript
// After data refresh, compare old vs new values
// Add .row-updated class to any row whose points/kills changed
```

---

### 19.7 GFX Export Button — Loading State Animation

When Admin clicks "EXPORT THIS TEMPLATE", the button shows
a loading state while canvas renders and blob is generated.

```css
@keyframes exportSpin {
  to { transform: rotate(360deg); }
}

.export-btn.loading .btn-icon {
  animation: exportSpin 0.8s linear infinite;
}

.export-btn.loading {
  opacity: 0.7;
  pointer-events: none;
}
```

Button text changes: "EXPORT" → "GENERATING..." → "DOWNLOAD READY"
Then resets after 3 seconds.

---

### 19.8 Nova Green Accent Line — Scan Animation (Hero Only)

On the public /stats hero section only, the 2px Nova green
top-border rule has a slow light-scan effect travelling
left to right. Loops continuously but very slowly.

```css
@keyframes scanLine {
  0%   { background-position: -100% 0; }
  100% { background-position: 200% 0; }
}

.hero-accent-line {
  height: 2px;
  background: linear-gradient(
    90deg,
    #6CB604 0%,
    #6CB604 40%,
    #ffffff88 50%,
    #6CB604 60%,
    #6CB604 100%
  );
  background-size: 200% 100%;
  animation: scanLine 3s linear infinite;
}
```

This gives the hero a subtle "active" energy.
Do NOT apply this scan to other accent lines across the site —
hero section only.

---

### 19.9 Page Transition

Between authenticated pages (dashboard → upload → gfx etc.),
apply a simple fade transition so navigation feels fluid:

```css
@keyframes pageFadeIn {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}

.page-content {
  animation: pageFadeIn 0.3s ease forwards;
}
```

Short and clean — 300ms, no movement, just opacity.

---

## ADD-20 — ANIMATION INVENTORY (FULL REFERENCE)

```
Location                  Animation            Duration   Loop
──────────────────────── ──────────────────── ───────── ──────
/stats hero logo          Entrance fade-up      0.8s      Once
/stats hero wordmark      Entrance fade-up      0.8s      Once (0.2s delay)
/stats hero accent line   Scan left-to-right    3s        Infinite
Navbar N mark             Pulse glow            4s        Infinite
/ngn-access logo          Scale + blur in       0.7s      Once
/ngn-access login card    Fade-up               0.6s      Once (0.4s delay)
Sidebar N mark (hover)    Glow flash            0.3s      On hover
Dashboard cards           Stagger fade-up       0.5s      Once (60ms stagger)
Stats rows (data update)  Green flash           1.2s      On data change
GFX export button         Spinner               0.8s      While loading
Page transitions          Opacity fade          0.3s      On route change
```

---

## ADD-21 — WHAT NOT TO ANIMATE

The following must remain static — no animation:
- ❌ Sidebar nav items (hover only = colour change, no motion)
- ❌ Data tables on dashboard (entrance only, no continuous animation)
- ❌ GFX canvas preview (static render, no animated preview)
- ❌ Upload zone (static, drag-state handled by border colour change only)
- ❌ Role badges
- ❌ Anything inside a modal or confirmation dialog
- ❌ The N mark on GFX exported images (static asset, no animation)

---

## ADD-22 — ASSET STORAGE & REFERENCE

Store all logo assets in:
```
/public/assets/brand/
  nova_logo_full_transparent.png   — 1024×1024, transparent bg
  nova_logo_nmark.png              — 574×615, transparent bg, N mark only
  nova_favicon_64.png              — 64×64, browser favicon
  nova_wordmark_only.png           — wordmark crop, transparent bg
```

Reference in CSS:
```css
:root {
  --logo-full:     url('/assets/brand/nova_logo_full_transparent.png');
  --logo-nmark:    url('/assets/brand/nova_logo_nmark.png');
  --logo-wordmark: url('/assets/brand/nova_wordmark_only.png');
}
```

Reference in HTML:
```html
<!-- Navbar -->
<img src="/assets/brand/nova_logo_nmark.png"
     alt="Nova Gaming Network"
     width="32" height="32"
     class="navbar-logo" />

<!-- Login page -->
<img src="/assets/brand/nova_logo_full_transparent.png"
     alt="Nova Gaming Network"
     width="120" height="120"
     class="login-logo" />

<!-- Favicon -->
<link rel="icon" type="image/png"
      href="/assets/brand/nova_favicon_64.png" />
```

---

*Addendum v3.4 — append after v3.0, v3.1, v3.2, v3.3*
*Nova Gaming Network — PlayerStatss Platform*
*Date: 2026-05-15*
