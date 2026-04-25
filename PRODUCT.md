# Product

## Register

product

## Users

Disposition und Innendienst von Sonilift GmbH (Bocholt). Primäre Nutzer:
- **Dispatcher / Innendienst** — koordinieren Wartungs-, Neuinstallations- und Reklamationstermine, telefonieren mit Kunden, pflegen Status nach. Sitzen meist mehrere Stunden am Tag im Tool, oft parallel zu Telefonaten.
- **Power-User / Admins** (Marvin, Nicole Poli) — überwachen Voice-AI Anna Weber, prüfen Statistiken, verwalten User und Settings.

Kontext: Büroarbeitsplatz, 24"+ Monitore, gelegentlich Homeoffice. Hohe Wiederholfrequenz — dieselben Aktionen viele Male am Tag (Status ändern, Karte öffnen, kommentieren). Oft parallel zu Praxedo, Make, Telefon.

Job to be done: schnellstmöglich erkennen, **welche Termine als nächstes Aufmerksamkeit brauchen**, was die Voice-AI bereits erledigt hat und wo manuell nachgehakt werden muss.

## Product Purpose

Disposition für Outbound-Kontakte rund um Wartungs- und Servicetermine. Anna Weber (ElevenLabs Voice AI) ruft Kunden an; Praxedo liefert Aufträge; das Dashboard ist die zentrale Schaltstelle, an der Menschen die Lücken schließen, die die KI nicht abdeckt.

Erfolg = Disposition arbeitet schneller mit weniger kognitiver Last als vorher; manuelle Anrufe und Excel-Listen werden überflüssig; neue Kollegen sind in unter einer Stunde produktiv.

## Brand Personality

**Modern. Klar. Souverän.** Optimistisch, ohne verspielt zu wirken. Premium-Tool-Feeling — wie Linear oder Raycast für ein Nischen-Geschäftsfeld.

Tonalität: ruhig, direkt, präzise. Microcopy auf Deutsch, locker aber respektvoll (Du-Form intern okay). Keine Emojis im UI. Positivität entsteht durch Geschwindigkeit, Präzision und Politur — nicht durch Illustrationen oder Maskottchen.

Emotionales Ziel: "Endlich ein Tool, das mitdenkt." Kollegen aus anderen Abteilungen sollen es sehen und neidisch werden.

## Anti-references

- **SAP / klassische ERP-UIs** — graue Tabellen, Dropdown-Wüsten, alles wirkt 1998.
- **Trello / bunte Kanban-Boards** — Chroma-Overload, Sticker-Optik, alles fühlt sich wie Spielzeug an.
- **Generische Bootstrap-Admin-Templates** — austauschbar, ohne Charakter.
- **Verspielter "Dashboard-Slop"** — Hero-Metriken im großen Gradient-Stil, identische Card-Grids mit Icon + Headline + Stat. Keine SaaS-Klischees.
- **Material-Design-Standardlook** — wirkt nach Google-Doku, nicht nach Premium-Werkzeug.

Was es **nicht** sein darf: kompliziert, überladen, "Profi-Tool für Profis"-Ästhetik mit zehn Toolbars. Auch nicht: zu cute, zu Consumer.

## Design Principles

1. **Geschwindigkeit ist das Feature.** Jeder Klick, jeder Hover, jeder State-Change muss sich sofort anfühlen. Wahrgenommene Performance schlägt jede Animation.
2. **Status auf einen Blick.** Die wichtigste Information — was braucht jetzt Aufmerksamkeit — ist immer ohne Scrollen, ohne Klick, ohne Lesen erkennbar.
3. **Dichte ohne Lärm.** Viele Informationen pro Bildschirm, aber typografische Hierarchie und Whitespace führen das Auge. Keine Karten-Grids als Default.
4. **Intuitiv genug für Tag 1.** Neue Kollegen verstehen Board, Karten und Aktionen ohne Schulung. Keine versteckten Menüs für Kernaktionen.
5. **Dark Mode gleichberechtigt.** Kein nachträglicher Layer — Light und Dark sind beide First-Class und gleichermaßen poliert.
6. **Detail-Politur als Differenzierung.** Mikro-Interaktionen, Empty States, Toast-Animationen, Tastatur-Shortcuts — der Eindruck "hier hat jemand sich Mühe gegeben" entsteht in den Kleinigkeiten.

## Accessibility & Inclusion

- WCAG 2.1 AA als Untergrenze (Kontrast in Light und Dark).
- Volle Tastatur-Navigation für alle Kernaktionen (Board, Karten, Modal, Bulk-Select).
- Reduced-Motion-Support: alle Animationen respektieren `prefers-reduced-motion`.
- Status nie nur über Farbe kommunizieren — immer Label oder Icon zusätzlich (Farbenblindheit).
- Schriftgrößen relativ (rem), Browser-Zoom bis 200% ohne Layout-Bruch.
