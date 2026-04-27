# Design

Visuelles System für Anna Dashboard. Light und Dark sind gleichwertig — beide werden parallel definiert.

## Aktuelle Iteration: v6 „Liquid Glass" (April 2026)

**Klare semantische Trennung erreicht:**
- **Board = Identität.** Lebt im Top-Bar-Akzent (2px Gradient-Strip + Board-Switch-Glow).
- **Status = Spaltenfarbe.** Board-übergreifend identisch — „Aktiv ist immer Aqua, Bestätigt ist immer Emerald".

### Status-Palette (Light)
- Ausstehend → Slate-Indigo `#6B7CB2`
- Aktiv → Aqua `#0FA9C9`
- Nacharbeiten → Amber `#F59E0B`
- Abgebrochen → Coral-Rose `#E85D75`
- Bestätigt → Emerald `#10B981`

### Status-Palette (Dark)
- Ausstehend → Soft Indigo
- Aktiv → Cyan
- Nacharbeiten → Honey
- Abgebrochen → Rose-Violet (Lila-Lean)
- Bestätigt → Mint

### Liquid Glass Cards
- `backdrop-filter: blur(20px) saturate(180%)` — frostet die Statusfarbe der Spalte ein
- Hairline-Border `rgb(255 255 255 / 0.55)` + Inset-Highlight oben
- Top-Gloss-Gradient via `::before` (subtle Glanzkante)
- 12px Radius
- Hover: stärkerer Backdrop-Blur durch Opacity-Bump (62% → 78%) + Lift +2px

### Top-Bar Board-Identität
- 2px Glow-Gradient-Strip oben über dem Header (Board-Identitätsfarbe)
- Aktiver Board-Switch-Tab: 2px Underline-Gradient + farbiger Box-Shadow-Halo

### Status-Spalten-Tile
- Gradient-Tray in Status-Farbe (12% top → transparent)
- Anker-Quadrat 30px in Status-Vollfarbe mit 14px Halo-Shadow
- 14px Radius

---

## Vorgänger-Iterationen (Archiv)

### v5 „Luminescence" (Board-driven Spalten)

**Wechsel von Atelier zu Luminescence.** Atelier war reif aber stumpf. v5 setzt auf leuchtende Jewel-Tones mit weichem Halo, papier-weiße Karten mit „lit from above"-Charakter. Premium-Materialqualität wie Linear-Plus oder Arc Browser.

### Board-Palette (Light)
- **Wartung** → Saffron `#F5A623` mit Goldglühen
- **Reklamation** → Coral-Rose `#E85D75` warm-aktiv
- **Neuinstallation** → Aqua `#0FA9C9` leuchtend kalt

### Board-Palette (Dark)
- **Wartung** → Honey-Glow mit warmem Halo
- **Reklamation** → Rose-Violet (Lila-Lean) mit Magenta-Glow
- **Neuinstallation** → Aqua-Cyan mit kühlem Halo

### Premium-Zutaten
1. **Glow-Halo** auf Anker-Quadraten (12–18px Blur, 30% Board-Farbe). Eigene `--board-X-glow` Tokens für Gradient-Highlight.
2. **Gradient-Tray-Bg** in Spalten (oben 10% Board-Tint → unten transparent). Tiefe ohne Aufdringlichkeit.
3. **Hairline-Inset-Highlight** auf Cards & Tiles (`box-shadow: 0 1px 0 inset rgba(255,255,255,.6)`) — „lit from above"-Effekt.
4. **Subtiler Surface-Gradient** auf Karten (top heller, unten leicht gesunken).
5. **Radien sanfter:** Cards 8px, Tiles 12px, Anker 7px.

### Architektur
- **Spalte** = Tray mit Light-Top-Glow + transparentem Bottom (papier-Materialgefühl)
- **Anker-Quadrat** = 30px, Linear-Gradient von Glow- zu Base-Farbe + 12px farbiger Box-Shadow-Halo
- **Karte** = subtle vertical-gradient Surface, Hairline-Inset-Highlight, Lift on Hover

**Weg von:** Erdigen Pigmenten, flatten Trays, hart abgegrenzten Anker-Quadraten.
**Hin zu:** Leuchtenden Kristallen, weichem Halo, materieller Tiefe.

---

## Theme

**Dual: Light + Dark, system-default mit manuellem Toggle.**

Szene Light: Dispatcher um 9:30 morgens im Bocholter Büro, Tageslicht durchs Fenster, parallel Telefonat.
Szene Dark: Dispatcher abends im Homeoffice, gedimmtes Licht, drei Stunden konzentrierte Nacharbeit.

Beide Modi sind warm-neutral getönt (leichter Brand-Hue im Neutral). Kein reines Schwarz, kein reines Weiß.

## Color Strategy (v3, sharper)

**Drei Ebenen** tragen das System:
1. **Primary Blue (`#154f9e`)** — CTAs, Fokus, Brand
2. **Lime Accent (`#95c11e`)** — Wordmark-Punkt, Success, Highlight
3. **Board-Identitäten** — pro Auftragstyp eine eigene Farbe, bewusst eingesetzt auf Spaltenheadern, Board-Switcher und Sidebar-Rail:
   - **Wartung** → Coral `oklch(0.66 0.18 28)` (~#e0644b)
   - **Reklamation** → Magenta `oklch(0.58 0.21 350)` (~#c83283)
   - **Neuinstallation** → Teal `oklch(0.58 0.13 195)` (~#1d9994)

Status-Farben sind semantisch und satter geworden (Blau/Amber/Rot/Grün). Im Dark Mode bekommen Status warme Akzente: `aktiv` = Lila, `bestaetigt` = Dunkelgrün, `primary` = tiefer Royal-Blau.

**Sharper edges:** Cards/Buttons/Inputs auf 4px Radius, Modals auf 6px, Pills bleiben 6px. Border-Standard auf Cards/Inputs erhöht auf 1.5px. Spaltenheader bekommen 3px Color-Bar in der Board-Identitätsfarbe.

**(Legacy aus v2):** Zwei Brand-Farben tragen das System:
- **Blau (Primary)** — primäre Aktionen, Fokusring, Active-State, interaktive Elemente. Gibt Souveränität und ist universell als "klickbar" lesbar.
- **Lime (Accent)** — Brand-Mark, Success-States, positive Highlights, Pro-Hovers. Maximal 5–8% der Fläche.

Neutrals tragen 80% der Fläche. Status-Farben (amber/rot/grün) bleiben funktional und nur an Status-Surfaces. Keine bunten Karten.

## Color Tokens (OKLCH)

Brand-Blau Hue ≈ 258, Brand-Lime Hue ≈ 115. Neutrals werden leicht Richtung Blau getönt (Chroma 0.005–0.012, Hue 258).

### Brand — Blau (Primary)
```
--primary-base:   oklch(0.39 0.16 258)  /* #154f9e – source */
--primary-hover:  oklch(0.34 0.17 258)
--primary-press:  oklch(0.30 0.17 258)
--primary-fg:     oklch(0.99 0.005 258) /* text on primary */
--primary-soft:   oklch(0.95 0.04 258)  /* light tint bg */
--primary-soft-dk:oklch(0.26 0.08 258)  /* dark tint bg */
--primary-ring:   oklch(0.39 0.16 258 / 0.30)
```

### Brand — Lime (Accent)
```
--accent-base:    oklch(0.78 0.18 115)  /* #95c11e */
--accent-hover:   oklch(0.72 0.19 115)
--accent-fg:      oklch(0.18 0.02 115)
--accent-soft:    oklch(0.96 0.04 115)
--accent-soft-dk: oklch(0.28 0.08 115)
```

### Light Mode Neutrals
```
--bg-base:       oklch(0.99 0.005 115)  /* nicht #fff – warmtönig */
--bg-subtle:     oklch(0.975 0.006 115) /* board background */
--bg-elevated:   oklch(1.00 0.003 115)  /* cards on subtle */
--bg-sunken:     oklch(0.96 0.007 115)  /* inputs, code */
--border:        oklch(0.92 0.008 115)
--border-strong: oklch(0.85 0.010 115)
--text:          oklch(0.20 0.015 115)  /* nicht #000 */
--text-muted:    oklch(0.45 0.012 115)
--text-faint:    oklch(0.60 0.010 115)
```

### Dark Mode Neutrals
```
--bg-base:       oklch(0.16 0.008 115)  /* nicht #000 */
--bg-subtle:     oklch(0.19 0.008 115)
--bg-elevated:   oklch(0.22 0.008 115)
--bg-sunken:     oklch(0.13 0.008 115)
--border:        oklch(0.28 0.010 115)
--border-strong: oklch(0.36 0.012 115)
--text:          oklch(0.96 0.005 115)  /* nicht #fff */
--text-muted:    oklch(0.72 0.008 115)
--text-faint:    oklch(0.55 0.008 115)
```

### Status (semantic — gleich in Light/Dark, mit angepasster Helligkeit)
```
--status-pending:   oklch(0.62 0.015 258)   /* neutral cool */
--status-active:    oklch(0.55 0.17  258)   /* primary blue tint */
--status-rework:    oklch(0.72 0.16   75)   /* amber */
--status-cancelled: oklch(0.60 0.18   28)   /* red, gedämpft */
--status-confirmed: oklch(0.68 0.16  155)   /* green, vs accent-lime */
```

Status-Farben werden nur auf Status-Pillen, Column-Headern und kritischen Card-States verwendet. Nicht als Hintergrund ganzer Karten — sonst wird's zu Trello.

## Typography

**Font Stack:**
- UI/Body: `Inter Variable` (axes: weight 100–900, optical size)
- Numerals/Tabular: `Inter Variable` mit `font-feature-settings: "tnum"` für alle Counter, Zähler, Zeiten
- Mono (für IDs, Codes): `JetBrains Mono` oder System-Mono

**Scale (rem-basiert, 1.25 ratio):**
```
text-xs:   0.75rem  / line 1.5    /* meta, timestamps */
text-sm:   0.875rem / line 1.5    /* body, card content */
text-base: 1rem     / line 1.55   /* selten – hauptsächlich Modal-Body */
text-lg:   1.125rem / line 1.4    /* card title bei Modal */
text-xl:   1.375rem / line 1.3    /* page title */
text-2xl:  1.75rem  / line 1.2    /* settings/dashboard headline */
```

**Weights:** 400 (body), 500 (label/strong body), 600 (headline). Keine 700 außer in seltenen Akzenten.

**Letter-spacing:** -0.01em ab text-lg aufwärts (engerer Look).

## Layout & Spacing

**Spacing-Skala** (Tailwind-kompatibel, 4-px-Grid):
`0, 1 (4px), 2 (8px), 3 (12px), 4 (16px), 5 (20px), 6 (24px), 8 (32px), 10 (40px), 12 (48px), 16 (64px)`

**Rhythmus, nicht Uniformität.** Karten innen 12px vertikal / 14px horizontal. Spalten innen 8px. Page-Padding 24px desktop, 16px mobile.

**Container-Strategie:** Kein Max-Width-Container für das Board — es nutzt die volle Breite, Spalten skalieren mit. Modals und Settings-Pages sind containerized auf max 720px (Lesbarkeit).

**Radii:**
```
--radius-sm: 6px   /* badges, pills, inputs */
--radius-md: 10px  /* cards, buttons */
--radius-lg: 14px  /* modal, panels */
--radius-xl: 20px  /* sidebar sections */
```

Keine pill-runden Ecken außer bei tatsächlichen Pills (Status-Tags).

## Elevation

Sehr zurückhaltend. Schatten werden nur für floating layers verwendet (Modal, Toast, Dropdown, Drag-Preview). Karten ruhen auf Border, nicht auf Schatten.

```
--shadow-sm: 0 1px 2px oklch(0 0 0 / 0.04)         /* subtle hover */
--shadow-md: 0 4px 12px oklch(0 0 0 / 0.06),
             0 2px 4px oklch(0 0 0 / 0.04)         /* dropdowns */
--shadow-lg: 0 12px 32px oklch(0 0 0 / 0.10),
             0 4px 12px oklch(0 0 0 / 0.06)        /* modal */
```

Im Dark Mode werden Schatten zusätzlich mit minimalem Highlight oben kombiniert (`inset 0 1px 0 oklch(1 0 0 / 0.04)`), damit floating layers sich abheben.

## Components

### Card (Board-Eintrag)
- bg-elevated, 1px border, 10px radius, 12/14 padding
- Hover: border-strong + shadow-sm + 1px translate-y (subtil)
- Status wird **links als 3px Color-Strip nicht erlaubt** (Bann!) → stattdessen: Status-Pille oben rechts + Spalten-Header trägt Farbe
- Kundenname als text-sm/500 (nicht bold), Termin als text-xs/muted darunter
- Action-Icons rechts, nur on hover sichtbar (oder always-on bei Touch)

### Column Header
- Spalten-Titel + Count, darunter 2px Color-Bar in Status-Farbe
- Sticky beim Scroll

### Button
- Primary: brand-base bg, brand-fg text, kein Shadow, hover = brand-hover
- Secondary: transparent, border, hover = bg-subtle
- Ghost: kein border, hover = bg-subtle
- Destructive: status-cancelled, sparsam
- Größen: sm (28px), md (32px), lg (40px)
- Focus: 2px ring brand-base, 2px offset

### Input / Select
- bg-sunken, 1px border, 10px radius, 36px Höhe
- Focus: border-brand + 2px ring brand mit 30% alpha
- Kein floating label — sichtbares Label oben

### Modal
- bg-elevated, 14px radius, max-width 720px (oder 920px für Eintrag-Detail), shadow-lg
- Backdrop: bg-base mit 60% alpha + 6px backdrop-blur (sparsam, nicht Glassmorphism als Default)
- Slide-up + fade in, 180ms ease-out-expo

### Toast
- Bottom-right gestapelt, bg-elevated + shadow-lg, 10px radius
- Status-Farben links als 6px Indicator-Dot (nicht als Side-Stripe!)
- Auto-dismiss 4s, hover pausiert

### Sidebar (Stats / Filter)
- bg-subtle, 320px desktop, collapsible auf Mobile
- Sektionen mit text-xs/uppercase/tracking-wide Header, text-faint

### Empty State
- Zentriert, kleines Icon (Material Round, 48px, text-faint)
- Headline text-lg, Beschreibung text-sm/muted, optional Action-Button
- **Keine Illustrationen mit Charakteren.** Stattdessen abstraktes Icon oder gar nichts.

## Motion

**Curves:**
- Standard: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quart)
- Schnell: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo)
- Reduced-motion: alle Transitions auf `0.01ms`

**Durations:**
- Hover/State: 120ms
- Modal/Dropdown: 180ms
- Toast slide: 240ms
- Page transitions: keine

**Erlaubt:** opacity, transform (translate, scale), filter, color-Übergänge.
**Verboten:** animierte width/height/padding/margin (Layout-Properties).

## Iconography

Material Icons Round (bereits eingebunden) bleibt — passt zur ruhigen Sprache. Größen 16/20/24px. Strichstärke konsistent. Keine Emoji-Icons im UI (das Bell-Emoji im Logo wird durch ein echtes Icon ersetzt).

## Brand Mark

Reduktion: kleines Wordmark "anna" in einer eigenen Custom-Logotype (Inter Display SemiBold, Lime-Akzent auf "a"-Schwanz oder ähnliches Detail). Kein Bell-Emoji mehr.
