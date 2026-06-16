# Plan: Semantische Suche im Browser (transformers.js)

> **Hinweis:** Dieser Plan ersetzt `plan_embeddings.md`. Der alte Plan beschrieb
> einen Python-Weg mit Server (mpnet + FastAPI/Streamlit). Wir haben uns bewusst
> **gegen ein Backend** entschieden: Die Suche läuft komplett im Browser,
> `plan_embeddings.md` gilt damit als **veraltet**.

## Die Grundidee in einem Satz

Wir verwandeln jedes Buch **einmalig beim Bauen der Seite** in einen Zahlen-Vektor
(„Embedding") und legen diese Vektoren als kleine Datei in die App. Im Browser wird
dann nur noch die **Suchanfrage** des Nutzers live in einen Vektor verwandelt und mit
allen Buch-Vektoren verglichen. Kein Server, keine API, keine laufenden Kosten.

## Warum diese Aufteilung (das ist der wichtigste Punkt)

Embeddings rechnen ist die teure Arbeit. Wir trennen sie in zwei Hälften:

| Wann                                         | Was passiert                         | Wo                         | Kosten     |
| -------------------------------------------- | ------------------------------------ | -------------------------- | ---------- |
| **Beim Bauen** (du, einmal pro Daten-Update) | 204 Bücher → 204 Vektoren            | Node-Skript auf deinem Mac | ~10–20 Sek |
| **Beim Suchen** (jeder Besucher, live)       | 1 Suchanfrage → 1 Vektor + Vergleich | Browser des Besuchers      | <50 ms     |

Die Buch-Vektoren ändern sich nur, wenn neue Folgen dazukommen — also rechnen wir sie
vor und liefern sie fertig aus. Der Browser muss nie 204 Bücher durchrechnen, nur die
eine Anfrage. Das hält die Seite schnell.

## Das Modell

- **`Xenova/paraphrase-multilingual-MiniLM-L12-v2`** — multilingual, versteht Deutsch gut.
- Ausgabe: 384 Zahlen pro Text (kleiner & schneller als mpnets 768).
- Quantisiert ca. **30–50 MB**, lädt der Browser **einmal** beim ersten Suchen und
  cached es danach (Service-Worker / Browser-Cache). Beim zweiten Besuch sofort da.
- Dasselbe Modell wird in **beiden** Hälften benutzt (Build-Skript & Browser) — sonst
  passen die Vektoren nicht zusammen.

## Wo die Suchanfrage zu einem Vektor wird (bewusste Wahl)

Die Buch-Vektoren werden immer beim Bauen vorgerechnet (s.o.) — das steht fest. Offen
ist nur, **wo die Suchanfrage** des Nutzers live embeddet wird. Wir wählen **Weg A**:

- **Weg A (dieser Plan): im Browser** via transformers.js. 100% statisch, kein Key,
  gratis hostbar. Einziger Preis: ~30–50 MB Modell-Download beim allerersten Suchen
  (danach gecached, lazy geladen).
- **Weg B (Ausweg, falls A zu träge): winzige Embedding-Funktion.** Nur die Anfrage
  geht an eine Mini-Funktion/API (z.B. HF Inference oder OpenAI `text-embedding-3-small`)
  — kein Download, <300 ms, oft bessere Qualität. Das ist **nicht** der verworfene
  mpnet+FastAPI-Server (der das ganze Modell hostet), sondern nur ein Textschnipsel →
  Vektor, meist im Gratis-Kontingent.

**Warum A für jetzt:** kleines Publikum, strikt backend-/keyfrei, gratis. **Warum der
Wechsel zu B später trivial ist:** Er betrifft nur die eine Funktion `embedQuery()` in
`embeddings.ts` — die Buch-Vektoren bleiben statisch vorgerechnet, der Rest der App
unverändert. Wir machen uns also keine Tür zu.

## Phase 1 — Was installiert wird

```
cd web
pnpm add @huggingface/transformers
```

- Eine einzige neue Abhängigkeit. Sie funktioniert sowohl in Node (fürs Build-Skript)
  als auch im Browser.
- Das Modell selbst wird **nicht** ins Git eingecheckt — es lädt sich beim ersten Lauf
  automatisch in einen lokalen Cache (genau wie im alten Python-Plan, nur hier über npm).

## Phase 2 — Build-Skript: Buch-Vektoren vorrechnen

**Datei:** `web/scripts/build_embeddings.mjs` (~60 Zeilen)

- Liest `data/books.json` (der Single Point of Truth bleibt unverändert).
- Baut pro Buch einen kurzen Indexier-Text — genau wie im alten Plan, z.B.:
  ```
  Thema: Reisen
  Buch: Nächsten Sommer von Edgar Rai
  Empfohlen von: Mona
  Folge: Während viele von euch ihre Sommerurlaube …
  ```
- Schickt alle 204 Texte durchs Modell → 204 Vektoren.
- Schreibt **`web/src/data/embeddings.json`** (~600 KB): pro Buch ein Eintrag mit
  einem Schlüssel (Titel|Autor) und seinen 384 Zahlen.
- Aufruf: `node scripts/build_embeddings.mjs`
- Wird Teil des Update-Workflows (s.u.).

> Hinweis zur Größe: 600 KB JSON ist okay. Falls es später stört, kann man auf ein
> kompaktes Binärformat umstellen — das ist eine reine Optimierung, keine Architektur-
> Änderung.

## Phase 3 — Browser-Suche anschließen

**Hier ändert sich erfreulich wenig.** Der Code in `web/src/lib/search.ts` ist schon
genau dafür vorbereitet — die jetzige `MOOD_KEYWORDS`-Stichwort-Map ist nur ein
Platzhalter, und die Aufrufer (`unifiedSearch`, `applyFilters`) bleiben **unverändert**.

**Neue Datei:** `web/src/lib/embeddings.ts` (~50 Zeilen)

- Lädt das Modell im Browser (lazy: erst wenn der Nutzer wirklich sucht).
- Lädt `embeddings.json`.
- Funktion `semanticSearch(query, books)`:
  - verwandelt die Anfrage in einen Vektor,
  - rechnet Kosinus-Ähnlichkeit zu allen 204 Buch-Vektoren,
  - sortiert, gibt sortierte Buch-Liste zurück.

**Änderung in `search.ts`:**

- `moodSearch(...)` wird durch `semanticSearch(...)` ersetzt.
- `unifiedSearch` (exakte Titel-/Autor-Treffer zuerst, dann semantisch, dedupliziert)
  und `applyFilters` (Filter nach Empfehler/Thema/Jahr) bleiben **1:1 wie sie sind**.

Damit greift die semantische Suche an genau der Stelle, die heute schon dafür
vorgesehen ist.

## Phase 4 — Ladeverhalten / UX

Ein Detail, das wir bedenken müssen: Die Suche wird **asynchron**. Heute ist sie
synchron (Stichwort-Map ist sofort da), künftig muss erst das Modell laden.

- **Erster Suchklick:** kurz „Suche wird vorbereitet …" anzeigen, während das Modell
  (einmalig) lädt. Danach ist es im Cache und alle weiteren Suchen sind instant.
- **Solange das Modell lädt:** als Übergang kann die alte Stichwort-Map weiterlaufen,
  damit nie eine leere Seite dasteht. (Optional, aber nutzerfreundlich.)
- Kleine Anpassung in `App.tsx`: `results` wird über einen Effekt/State statt direkt
  per `useMemo` berechnet, weil die Suche jetzt ein Versprechen (Promise) zurückgibt.

## Phase 5 — Update-Workflow (wenn neue Folgen kommen)

```
.venv/bin/python scripts/fetch_episodes.py     # RSS neu laden
# → in build_books_json.py: neuen EXTRACTIONS-Eintrag ergänzen
.venv/bin/python scripts/build_books_json.py   # books.json updaten
cd web && node scripts/build_embeddings.mjs     # Buch-Vektoren neu bauen
```

Danach `git commit` + deploy (statisches Hosting baut die Seite neu). Fertig.

## Phase 6 — Risiken / wo's hakelig werden könnte

- **Modell-Download im Browser (~30–50 MB):** Nur beim allerersten Suchen, danach
  gecached. Für eine Fan-Seite vertretbar. Wer nur stöbert/filtert, lädt das Modell
  gar nicht erst (lazy load).
- **Vektoren müssen zum Modell passen:** Build-Skript und Browser **müssen dasselbe
  Modell** nutzen. Wenn wir das Modell wechseln, müssen die `embeddings.json` neu
  gebaut werden — sonst kommt Unsinn raus. (Im Skript & in `embeddings.ts` als
  Konstante an einer Stelle definieren.)
- **Anfragen zu Begriffen, die in keiner Folgen-Beschreibung vorkommen:** Das Modell
  versteht den Sinn, aber wenn die Daten ein Konzept nirgends abbilden, gibt's wenig
  Treffer. Lösung später: Buch-API mit Klappentexten zur Anreicherung des Indexier-
  Texts (fließt einfach in Phase 2 mit ein, Rest bleibt).
- **Bundle-Größe:** `embeddings.json` (~600 KB) kommt zum Download dazu. Unkritisch,
  notfalls Binärformat (s. Phase 2).

## Phase 7 — Konkrete Schritte, mit Ausstiegspunkten

1. **Schritt 1:** `pnpm add @huggingface/transformers` — _Ausstieg:_ du siehst, was dazukam.
2. **Schritt 2:** `build_embeddings.mjs` schreiben & laufen lassen → erzeugt
   `embeddings.json` — _Ausstieg:_ Datei da, Größe & Inhalt prüfbar.
3. **Schritt 3:** `embeddings.ts` schreiben + `search.ts` umstellen (Map → semantisch)
   — _Ausstieg:_ lokal `pnpm dev`, 5–10 Test-Anfragen, du beurteilst die Qualität.
4. **Schritt 4:** Lade-/UX-Feinschliff in `App.tsx` (Ladehinweis, Fallback) —
   _Ausstieg:_ fühlt sich rund an.
5. **Schritt 5 (optional):** Deploy als statische Seite (GitHub Pages o.ä.).

Bei jedem Schritt halte ich vor dem Ausführen kurz an — du schaust den Output an und
sagst ja / nein / anders.

## Was bleibt stabil (gegen späteres Umentscheiden)

- `data/books.json` bleibt Single Point of Truth — alles wird daraus gerechnet.
- Modellwechsel = eine Konstante ändern + `embeddings.json` neu bauen.
- LLM-Reranker oder Begründungstexte („passt, weil …") später: additiver Schritt nach
  den Top-Treffern, ändert die Embedding-Schicht nicht.
- Falls doch mal ein Backend gewünscht ist (z.B. größeres Modell): Die Suchlogik wandert
  hinter eine Funktion, der Rest der App bleibt — kein Neuanfang.

```

```
