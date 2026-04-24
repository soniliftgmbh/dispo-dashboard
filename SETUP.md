# Anna Dashboard — Setup-Anleitung (Vercel + Supabase)

Folge dieser Anleitung Schritt für Schritt. Dauert insgesamt ca. 30–45 Minuten.

---

## Voraussetzungen

- Node.js 18+ installiert → `node -v` im Terminal prüfen
- Git installiert → `git -v` im Terminal prüfen
- GitHub-Account vorhanden
- Vercel-Account vorhanden (kostenlos reicht) → [vercel.com](https://vercel.com)
- Supabase-Account vorhanden (kostenlos reicht) → [supabase.com](https://supabase.com)

---

## Schritt 1 — Repository auf GitHub anlegen

```bash
cd /pfad/zum/projektordner/anna-dashboard-vercel

git init
git add .
git commit -m "Initial commit"
```

Dann auf GitHub ein neues **privates** Repository erstellen (z. B. `anna-dashboard`) und pushen:

```bash
git remote add origin https://github.com/soniliftgmbh/dispo-dashboard.git
git branch -M main
git push -u origin main
```

---

## Schritt 2 — Supabase-Projekt anlegen

1. Auf [supabase.com](https://supabase.com) einloggen → **New project**
2. Einstellungen:
   - **Name:** `anna-dashboard`
   - **Database Password:** Sicheres Passwort wählen und notieren
   - **Region:** `Frankfurt (eu-central-1)` ← wichtig für DSGVO
3. Auf **Create new project** klicken → ca. 1 Minute warten

---

## Schritt 3 — Datenbank-Schema einrichten

1. Im Supabase-Dashboard links auf **SQL Editor** klicken
2. Inhalt der Datei `sql/schema.sql` vollständig reinkopieren
3. Auf **Run** klicken

Wenn erfolgreich: In der linken Leiste unter **Table Editor** sind die Tabellen `users`, `entries`, `activity_log` sichtbar.

Der initiale Admin-User wird automatisch angelegt:
- **Benutzername:** `admin`
- **Passwort:** `admin123`
- Nach dem ersten Login sofort im Admin-Panel ändern.

---

## Schritt 4 — Datenbankverbindung notieren

Im Supabase-Dashboard → **Project Settings** → **Database**:

- Unter **Connection string** → Tab **URI** wählen
- Den Connection-String kopieren (sieht so aus):
  ```
postgresql://postgres.cjmcqkvhymyhnptkgagl:Sonilift2023!!@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
  ```
- `[PASSWORD]` durch das Passwort aus Schritt 2 ersetzen
- Am Ende `?pgbouncer=true` anhängen

Fertig, das ist dein `DATABASE_URL`.

---

## Schritt 5 — Vercel-Projekt anlegen

1. Auf [vercel.com/new](https://vercel.com/new) → **Import Git Repository**
2. Das GitHub-Repository `anna-dashboard` auswählen
3. Framework: **Next.js** (wird automatisch erkannt)
4. Noch **nicht** deployen — erst Umgebungsvariablen setzen (Schritt 6)

---

## Schritt 6 — Umgebungsvariablen in Vercel setzen

Im Vercel-Projekt → **Settings** → **Environment Variables**

Folgende Variablen anlegen (alle für `Production`, `Preview`, `Development`):

| Variable | Wert | Wo herbekommen |
|---|---|---|
| `DATABASE_URL` | `postgresql://...?pgbouncer=true` | Schritt 4 |
| `JWT_SECRET` | Zufälliger langer String (min. 32 Zeichen) | Generator unten |
| `WEBHOOK_SECRET` | Zufälliger String (min. 24 Zeichen) | Generator unten |
| `MAKE_ENRICHMENT_WEBHOOK` | URL des Make-Webhooks (Schritt 8) | Make.com |

**Zufällige Strings generieren** — im Terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Zwei Mal ausführen: einmal für `JWT_SECRET`, einmal für `WEBHOOK_SECRET`. Den `WEBHOOK_SECRET`-Wert notieren — wird in Schritt 8 für Make gebraucht.

---

## Schritt 7 — Deployen

Zurück im Vercel-Dashboard → **Deploy** klicken (oder passiert automatisch nach Schritt 5).

Nach dem Deploy ist das Dashboard erreichbar unter:
```
https://anna-dashboard-[hash].vercel.app
```

Erster Login: `admin` / `admin123` → sofort Passwort ändern.

---

## Schritt 8 — Make-Webhooks umstellen

Das Dashboard ersetzt ab jetzt Google Sheets als Datenziel. Make muss zwei Webhooks anpassen.

### Allgemein: Header für alle Make-Requests

In jedem HTTP-Modul, das ans Dashboard sendet, diesen Header hinzufügen:
```
Authorization: Bearer DEIN_WEBHOOK_SECRET
```
(Derselbe Wert wie `WEBHOOK_SECRET` aus Schritt 6)

---

### Webhook 1 — Praxedo-Anreicherung (`type: enrich`)

Make holt Kundendaten aus Praxedo und schickt sie ans Dashboard.

**URL:** `https://anna-dashboard-[hash].vercel.app/api/webhook/make`
**Methode:** POST
**Content-Type:** application/json

**Payload-Struktur:**
```json
{
  "type": "enrich",
  "praxedo_id": "{{praxedo_id}}",
  "kundenname": "{{kundenname}}",
  "telefon": "{{telefon}}",
  "email": "{{email}}",
  "termin": "{{termin_iso}}",
  "zeitraum": "{{zeitraum}}",
  "techniker": "{{techniker}}",
  "auftragstyp": "{{auftragstyp}}"
}
```

**Feldhinweise:**
- `praxedo_id` → die Praxedo Job-ID (Pflichtfeld)
- `termin` → ISO-String oder leer (`""`)
- `zeitraum` → z. B. `"08:00–10:00"` oder leer
- Alle anderen Felder → leer lassen, wenn nicht vorhanden

---

### Webhook 2 — Post-Call-Update (`type: post_call`)

ElevenLabs Post-Call Webhook → Make → Dashboard.

**URL:** `https://anna-dashboard-[hash].vercel.app/api/webhook/make`
**Methode:** POST
**Content-Type:** application/json

**Payload-Struktur:**
```json
{
  "type": "post_call",
  "praxedo_id": "{{praxedo_id}}",
  "status": "{{status}}",
  "note": "{{note}}",
  "recall": "{{recall_iso_oder_leer}}",
  "direction": "{{outbound}}",
  "wahlversuche": {{wahlversuche_zahl}},
  "letzter_wahlversuch": "{{iso_timestamp_oder_leer}}",
  "failure_reason": "{{failure_reason_oder_leer}}",
  "dispo_info": "{{dispo_info_oder_leer}}",
  "abbruchgrund": "{{abbruchgrund_oder_leer}}"
}
```

**Statuswerte (ElevenLabs → `status`-Feld):**
| ElevenLabs-Wert | Bedeutung |
|---|---|
| `confirmed` | Termin bestätigt |
| `alternative_proposed` | Alternativtermin vorgeschlagen |
| `declined` | Abgelehnt |
| `callback_requested` | Rückruf gewünscht |
| `no_data_found` | Keine Daten gefunden |

**Wenn Auftrag abgeschlossen/übergeben:**
- `dispo_info` → `"-"` (Bindestrich)
- Karte erscheint dann in der Kanban-Spalte "Übergeben"

**Wenn Rückruf gewünscht:**
- `recall` → ISO-Timestamp des Rückrufzeitpunkts (z. B. `"2026-04-25T10:00:00"`)
- `status` → `"callback_requested"`

---

## Schritt 9 — Custom Domain einrichten (optional)

Damit das Dashboard unter `dashboard.sonilift.de` erreichbar ist:

1. Im Vercel-Dashboard → **Settings** → **Domains**
2. `dashboard.sonilift.de` eingeben → **Add**
3. Vercel zeigt einen CNAME-Eintrag an:
   ```
   CNAME dashboard → cname.vercel-dns.com
   ```
4. Diesen Eintrag beim DNS-Provider von sonilift.de (vermutlich beim IT-Dienstleister) eintragen lassen
5. Nach Propagierung (bis zu 24h, meist schneller): Dashboard unter `dashboard.sonilift.de` erreichbar

Danach in Vercel unter **Environment Variables** die `MAKE_ENRICHMENT_WEBHOOK`-URL noch einmal prüfen — die Domain in den Make-Webhooks ggf. auf `dashboard.sonilift.de` aktualisieren.

---

## Schritt 10 — Erster Login & Benutzer anlegen

1. Dashboard öffnen → `admin` / `admin123`
2. Oben rechts auf das Zahnrad → **Admin-Panel**
3. Passwort für `admin` ändern
4. Neue Benutzer anlegen (z. B. für Kollegen)
   - Rolle `user`: sieht Kanban, kann Einträge bearbeiten
   - Rolle `admin`: zusätzlich Benutzerverwaltung + Logs

---

## Troubleshooting

**Deploy schlägt fehl (Build error):**
- `DATABASE_URL` prüfen — Verbindung zu Supabase möglich?
- In Vercel-Dashboard unter **Deployments** → **Build Logs** nachsehen

**Login funktioniert nicht:**
- `JWT_SECRET` gesetzt?
- In Supabase SQL Editor prüfen: `SELECT * FROM users;` → admin-User vorhanden?

**Karten erscheinen nicht im Kanban:**
- Make-Webhook feuert? In Vercel → **Functions** → **Logs** nachsehen
- `WEBHOOK_SECRET` in Make-Header und Vercel-Variable identisch?
- In Supabase: `SELECT * FROM entries LIMIT 10;` → Daten vorhanden?

**Webhooks landen mit 401:**
- Authorization-Header in Make prüfen: muss exakt `Bearer DEIN_SECRET` sein (kein Leerzeichen vorne/hinten)

---

## Übersicht: Welche Datei macht was?

| Datei | Zweck |
|---|---|
| `sql/schema.sql` | Datenbank-Tabellen + initialer Admin-User |
| `lib/db.ts` | PostgreSQL-Connection Pool |
| `lib/auth.ts` | JWT-Sessions (Login/Logout) |
| `lib/types.ts` | TypeScript-Typen + `deriveStatus()` |
| `middleware.ts` | Schützt alle Routen außer Login |
| `app/api/auth/login/route.ts` | Login-Endpoint |
| `app/api/entries/route.ts` | Einträge laden + neuen anlegen |
| `app/api/entries/[id]/route.ts` | Eintrag bearbeiten/abbrechen/archivieren |
| `app/api/webhook/make/route.ts` | Make-Webhooks empfangen |
| `app/api/stats/route.ts` | Statistiken für Sidebar |
| `app/api/logs/route.ts` | Activity-Log |
| `app/api/archive/route.ts` | Archivierte Einträge |
| `app/api/admin/users/route.ts` | Benutzerverwaltung |
| `app/dashboard/page.tsx` | Haupt-UI (Kanban-Board) |
