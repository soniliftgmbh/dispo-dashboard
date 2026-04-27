# Anna Dashboard — Disposition UI (Vercel + Supabase)

Kanban-basiertes Dashboard für die Disposition von Anna Weber Wartungs-Calls. Löst die frühere Google Apps Script Version ab.

**Status:** Aktiv (deployed auf Vercel)
**Stack:** Next.js 14, Supabase (PostgreSQL), Tailwind CSS, Vercel
**Vorgänger:** Archiviert unter `archives/restructured/2026-04-26/projects/anna-dashboard-legacy/`

## Inhalt dieses Ordners

- [SETUP.md](SETUP.md) — Schritt-für-Schritt Einrichtungsanleitung (Vercel, Supabase, Make-Webhooks)
- [PRODUCT.md](PRODUCT.md) — Produktbeschreibung, User, Design Principles
- [DESIGN.md](DESIGN.md) — Vollständiges Designsystem (Color Tokens, Typography, Components, Motion)
- `sql/` — Datenbankschema + Migrations
- `app/api/` — Next.js API-Routes (auth, entries, webhook, stats, logs, archive, admin)
- `lib/` — Datenbankverbindung, Auth, Typen, UI-Komponenten

## Verwandte Systeme

- **Anna Weber Agent** → [../anna-weber/](../anna-weber/)
- **Make.com** — Webhooks: `/api/webhook/make` (type: enrich / post_call)
- **Supabase** — Datenbank (Frankfurt, eu-central-1)
