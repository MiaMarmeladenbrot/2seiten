# Plan: Empfehlungssuche mit mpnet-base

> ⚠️ **VERALTET — nicht mehr maßgeblich.** Dieser Plan beschrieb einen Python-Weg
> mit Server (mpnet + FastAPI/Streamlit). Wir haben uns gegen ein Backend
> entschieden; die Suche läuft im Browser. Aktueller Plan: **`plan_browser_search.md`**.
> Dieses Dokument bleibt nur als Referenz/Historie erhalten.


## Phase 1 — Einrichtung (einmalig, ~30–60 Min)

**1.1 Was installiert wird**
- `pip install sentence-transformers numpy` ins bestehende venv
- Zieht im Hintergrund **PyTorch (CPU)** mit (~250 MB) plus ein paar kleine Libs
- Beim **ersten Skript-Lauf** lädt sich das Modell automatisch nach `~/.cache/huggingface/` (~500 MB, einmalig)
- **Gesamt-Footprint:** ~750 MB neu auf der Platte, davon nur ~1 MB im Projektordner selbst — der Rest liegt zentral im Cache und kann von anderen Projekten mitgenutzt werden

**1.2 `build_embeddings.py` (~80 Zeilen)**
- Liest `books.json`
- Baut pro Buch einen Indexier-Text wie:
  ```
  Thema: Reisen
  Buch: Nächsten Sommer von Edgar Rai
  Empfohlen von: Mona
  Folgen-Kontext: Während viele von euch ihre Sommerurlaube …
  ```
- Schickt alle 204 Texte einmal durchs Modell → bekommt 204 Vektoren à 768 Zahlen
- Schreibt `embeddings.npz` (~600 KB)
- **Laufzeit:** ~15–30 Sek auf deinem Mac

**1.3 `search.py` (~50 Zeilen)**
- Lädt Modell + `embeddings.npz`
- Nimmt eine Anfrage als String
- Verwandelt sie in einen Vektor → Kosinus-Ähnlichkeit zu allen 204 → sortiert
- Gibt Top-N zurück
- Aufruf: `.venv/bin/python search.py "Buch für Urlaub am Meer"` → Trefferliste

## Phase 2 — Wie du damit lebst

| Was | Wie oft | Aufwand |
|---|---|---|
| Suche | so oft du willst | <100 ms, offline, gratis |
| Neue Podcast-Folgen einpflegen | alle 2 Wochen | RSS neu ziehen, Buch ergänzen, Embeddings neu bauen — ~3 Min |
| Indexierungs-Logik tunen | bei Bedarf | Eine Funktion in `build_embeddings.py` ändern, neu laufen lassen |

Update-Workflow für eine neue Folge:
```
.venv/bin/python fetch_episodes.py        # RSS neu laden
# → in build_books_json.py: 1 neuen EXTRACTIONS-Eintrag ergänzen
.venv/bin/python build_books_json.py      # books.json updaten
.venv/bin/python build_embeddings.py      # re-indexieren
```

## Phase 3 — Was die Suche danach kann

| Anfrage | Was rauskommt |
|---|---|
| „Buch für Urlaub" | Bücher aus Folgen Sommer / Reisen / Ferne |
| „Etwas Lustiges" | Folgen Spaß / Humor / Märchen |
| „Buch über Trauer" | Folgen Trauer / Schmerz / Wehmut |
| „Ein Roman in Frankreich" | findet Bücher mit Frankreich-Setting in der Beschreibung |
| „Ich brauche Mut" | Folge Mut, Folge Kraft, Folge Hoffnung |
| „Etwas Ruhiges für müde Abende" | findet stimmungs-ähnliche Bücher — auch wenn niemand „ruhig" je geschrieben hat |

**Was zu diesem Zeitpunkt noch nicht geht:**
- Cover-Bilder → kommt mit Buch-API
- Begründungstext „Das passt, weil …" → kommt mit LLM-Reranker
- Filter wie „nur von Christine empfohlen" → trivial nachzurüsten, eine Zeile

## Phase 4 — Auswirkung auf die größere Idee (Webseite)

**Stand jetzt nach Embeddings:**
```
RSS  →  episodes.json  →  books.json  →  embeddings.npz
                                              ↓
                                          search.py (CLI)
```

**Sprung zur Webseite — drei Stufen, von schnell nach professionell:**

1. **Streamlit (≈ ½ Tag Arbeit)** — Python-Tool für super-schnelle Web-UIs. ~50 Zeilen Code = Eingabefeld + Trefferliste, läuft als Browser-Tab via `streamlit run app.py`. Lokal, nur du siehst es.
2. **FastAPI + simple HTML/JS-Seite (1–2 Tage)** — saubere Trennung Server/Frontend. Du kannst das später selbst designen.
3. **Hosting (zusätzlich)** — wenn andere drauf zugreifen sollen: Render/Railway/Hetzner ab ~5 €/Monat. Auf dem kleinsten Server passen Modell + RAM mit etwas Tuning rein.

**Was die Architektur stabil macht:**
- `books.json` ist und bleibt der Single Point of Truth — alles andere wird daraus gerechnet
- Modell- oder Such-Wechsel ändert nur eine Datei
- Buch-API später dazu → fließt einfach in den Indexier-Text mit ein, der Rest bleibt

## Phase 5 — Migrationen, falls du später wechseln willst

| Wohin | Aufwand | Was bleibt |
|---|---|---|
| Zu MiniLM (kleiner, schneller) | 1 Zeile + Re-Index | Alles |
| Zu OpenAI Cloud | ~20 Zeilen Code im Indexer/Searcher | Daten bleiben |
| LLM-Reranker dazunehmen | Neuer Schritt nach Top-10, ~30 Zeilen | Embeddings-Layer bleibt unverändert |
| Buch-API-Anreicherung dazu | Neues Skript, das `books.json` mit Cover/Genre erweitert | Embeddings einfach neu bauen |

Du machst dir mit mpnet **keine Tür zu**. Jede dieser Erweiterungen ist additiv.

## Phase 6 — Risiken / wo's hakelig werden könnte

- **Erstes Modell-Laden**: dauert beim allerersten Mal ~10 Sek (lädt von Disk in RAM). Danach instant, solange das Skript läuft. Bei Webseite: einmaliges Modell-Laden beim Server-Start, dann ist alles flott.
- **Suche bei Begriffen, die niemand je in Texten benutzt** (z. B. „Buch für Anfang-30-Krise"): mpnet versteht den Sinn ganz gut, aber wenn deine Folgen-Beschreibungen das Konzept nirgends abbilden, findest du nichts. Lösung wäre dann Buch-API mit Klappentexten zur Anreicherung.
- **Falls dein Mac eine alte CPU hat**: Indexierung dauert dann eher 60 Sek statt 30. Suche selbst bleibt schnell. Bei dir mit Apple-Silicon erwarte ich keine Probleme.

## Phase 7 — Was ich konkret tun würde, mit Ausstiegspunkten

1. **Schritt 1**: `pip install` laufen lassen — *Ausstiegspunkt*: du siehst, was installiert wurde
2. **Schritt 2**: `build_embeddings.py` schreiben und laufen lassen → Modell-Download passiert hier — *Ausstiegspunkt*: du siehst die `embeddings.npz` und das geladene Modell
3. **Schritt 3**: `search.py` schreiben und 5–10 Test-Anfragen durchspielen — *Ausstiegspunkt*: du beurteilst Qualität
4. **Schritt 4 (optional)**: Streamlit-Mini-UI für „echte" Bedienung im Browser

Bei jedem Schritt halte ich vor dem Ausführen kurz an, du kannst den Output anschauen, ja/nein/anders sagen.
