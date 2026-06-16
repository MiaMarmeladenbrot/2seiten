"""
Builds books.json from episodes.json and manually extracted book mentions.

The extractions were produced interactively by Claude (Claude Code, May 2026)
from the RSS descriptions. Per episode:
- topic of the episode
- list of discussed books with title, author, recommender, role

recommended_by values: "Christine" | "Mona" | "beide"
role values:
  - Hauptempfehlung  -> the central book discussion of the episode
  - Zusatzempfehlung -> further books recommended in this episode
                         (e.g. anniversary specials)
"""

from __future__ import annotations

import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
EPISODES_FILE = DATA_DIR / "episodes.json"
OUT_FILE = DATA_DIR / "books.json"


# Extractions per episode, identified by GUID.
# Format: GUID -> {topic, books: [(title, author, recommended_by, role)]}
EXTRACTIONS: dict[str, dict] = {
    # 1
    "/4708b4f7c712f51813bd284f68710f55": {
        "topic": "Einhundert",
        "books": [
            ("Lügen über meine Mutter", "Daniela Dröscher", "beide", "Hauptempfehlung"),
            ("Herkunft", "Saša Stanišić", "beide", "Hauptempfehlung"),
            ("Dann schlaf auch du", "Leila Slimani", "beide", "Hauptempfehlung"),
            ("Die Anomalie", "Hervé Le Tellier", "beide", "Hauptempfehlung"),
            ("Männer", "Johanna Adroján", "beide", "Hauptempfehlung"),
            ("Mein Freund Rilke", "Melanie Garanin", "beide", "Hauptempfehlung"),
        ],
    },
    # 2
    "/e6933085227a08eb53582b0e8fed6669": {
        "topic": "Mode",
        "books": [
            ("Let's talk about feelings", "Leif Randt", "Mona", "Hauptempfehlung"),
            ("Einatmen. Ausatmen", "Maxim Leo", "Christine", "Hauptempfehlung"),
        ],
    },
    # 3
    "/7c12349b6f6a954d2119251110d507ec": {
        "topic": "Kraft",
        "books": [
            ("Es ist hell und draußen dreht sich die Welt", "Dita Zipfel", "Christine", "Hauptempfehlung"),
            ("Eine Hymne an das Leben", "Gisèle Pelicot", "Mona", "Hauptempfehlung"),
        ],
    },
    # 4
    "/0c444295d808f50686c3b3cbe51311da": {
        "topic": "Spaß",
        "books": [
            ("Wir Freitagsmänner", "Hans-Gerd Raeth", "Christine", "Hauptempfehlung"),
            ("Das Leben ist eins der Härtesten", "Giulia Becker", "Mona", "Hauptempfehlung"),
        ],
    },
    # 5
    "/0e5202985b55a50096bc845af1302ee0": {
        "topic": "Namen",
        "books": [
            ("Die Namen", "Florence Knapp", "Mona", "Hauptempfehlung"),
            ("Frankie", "Jochen Gutsch", "Christine", "Hauptempfehlung"),
        ],
    },
    # 6
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20260224_01be4a38.mp3": {
        "topic": "Chancen",
        "books": [
            ("Wenn die Kraniche nach Süden ziehen", "Lisa Ridzén", "Christine", "Hauptempfehlung"),
            ("Im Leben nebenan", "Anne Sauer", "Mona", "Hauptempfehlung"),
        ],
    },
    # 7
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20260210_42e7d94d.mp3": {
        "topic": "Orientierung",
        "books": [
            ("Monstergott", "Caroline Schmitt", "Mona", "Hauptempfehlung"),
            ("Der Held vom Bahnhof Friedrichstraße", "Maxim Leo", "Christine", "Hauptempfehlung"),
        ],
    },
    # 8
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20260127_e09f8bb7.mp3": {
        "topic": "Luft",
        "books": [
            ("Die Wolkengucker", "Kristina Fritz", "Mona", "Hauptempfehlung"),
            ("Der letzte Sommer der Tauben", "Abbas Khider", "Christine", "Hauptempfehlung"),
        ],
    },
    # 9
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20260113_ad4eedeb.mp3": {
        "topic": "Essen",
        "books": [
            ("Ein Tisch am Fenster", "Vincent Moissonnier", "Christine", "Hauptempfehlung"),
            ("Kochen im falschen Jahrhundert", "Teresa Präauer", "Mona", "Hauptempfehlung"),
        ],
    },
    # 10
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20251230_0e8cf570.mp3": {
        "topic": "Erinnerung",
        "books": [
            ("Schlupfwinkel", "Friedrich Ani", "Christine", "Hauptempfehlung"),
            ("Die Ausweichschule", "Kaleb Erdmann", "Mona", "Hauptempfehlung"),
        ],
    },
    # 11
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20251216_7d7f4a09.mp3": {
        "topic": "Druck",
        "books": [
            ("Nur für Mitglieder", "Thorsten Nagelschmidt", "Mona", "Hauptempfehlung"),
            ("Vielleicht ist die Liebe so", "Katja Früh", "Christine", "Hauptempfehlung"),
        ],
    },
    # 12
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20251202_95e9a81b.mp3": {
        "topic": "Feiern",
        "books": [
            ("Das kleine Haus am Sonnenhang", "Alex Capus", "Christine", "Hauptempfehlung"),
            ("Wedding People", "Alison Espach", "Mona", "Hauptempfehlung"),
        ],
    },
    # 13
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20251118_47d2cad7.mp3": {
        "topic": "Fehler",
        "books": [
            ("Geordnete Verhältnisse", "Lana Lux", "Mona", "Hauptempfehlung"),
            ("1000 letzte Dates", "Anna Dushime", "Christine", "Hauptempfehlung"),
        ],
    },
    # 14
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20251104_b98d5e04.mp3": {
        "topic": "Ungerechtigkeit",
        "books": [
            ("Fallers große Liebe", "Thommie Bayer", "Christine", "Hauptempfehlung"),
            ("Tigermilch", "Stefanie de Velasco", "Mona", "Hauptempfehlung"),
        ],
    },
    # 15
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20251021_ca340b05.mp3": {
        "topic": "Herbst",
        "books": [
            ("Tage im warmen Licht", "Kristina Pfister", "Mona", "Hauptempfehlung"),
            ("Nach Mattias", "Peter Zantingh", "Christine", "Hauptempfehlung"),
        ],
    },
    # 16
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20251007_e777d6db.mp3": {
        "topic": "Bewunderung",
        "books": [
            ("Familiensache", "Claire Lynch", "Christine", "Hauptempfehlung"),
            ("Gym", "Verena Keßler", "Mona", "Hauptempfehlung"),
        ],
    },
    # 17
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250923_5984ab93.mp3": {
        "topic": "Therapie",
        "books": [
            ("Marianengraben", "Jasmin Schreiber", "Mona", "Hauptempfehlung"),
            ("Auf gefährlich sanfte Art", "Antoine Laurain", "Christine", "Hauptempfehlung"),
        ],
    },
    # 18
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250909_9eb8d0f5.mp3": {
        "topic": "Spiele",
        "books": [
            ("Alle meine Wünsche", "Grégoire Delacourt", "Christine", "Hauptempfehlung"),
            ("Die Falle", "Melanie Raabe", "Mona", "Hauptempfehlung"),
        ],
    },
    # 19
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250826_c35b0cef.mp3": {
        "topic": "Großeltern",
        "books": [
            ("Der Geschmack von Apfelkernen", "Katharina Hagena", "Christine", "Hauptempfehlung"),
            ("Nonna", "Thomas de Padova", "Mona", "Hauptempfehlung"),
        ],
    },
    # 20
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250812_e7a213ce.mp3": {
        "topic": "Nacht",
        "books": [
            ("Nachts", "Mercedes Lauenstein", "Mona", "Hauptempfehlung"),
            ("Die Karte meiner Träume", "Reif Larsen", "Christine", "Hauptempfehlung"),
        ],
    },
    # 21
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250729_5c4ea7aa.mp3": {
        "topic": "Sommer",
        "books": [
            ("Damals im Sommer", "Florian Gottschick", "Mona", "Hauptempfehlung"),
            ("Ein Ende und ein Anfang", "Oliver Hilmes", "Christine", "Hauptempfehlung"),
        ],
    },
    # 22
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250715_7cf9f10f.mp3": {
        "topic": "Schmerz",
        "books": [
            ("Drei Meter Dreißig", "Jaqueline Scheiber", "Mona", "Hauptempfehlung"),
            ("Vergiss mich", "Alex Schulman", "Christine", "Hauptempfehlung"),
        ],
    },
    # 23
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250701_cdc316cf.mp3": {
        "topic": "Fantasie",
        "books": [
            ("Mr. Parnassus Heim für magisch Begabte", "T.J. Klune", "Mona", "Hauptempfehlung"),
            ("Der Bademeister ohne Himmel", "Petra Pellini", "Christine", "Hauptempfehlung"),
        ],
    },
    # 24
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250617_67e909f8.mp3": {
        "topic": "Zeit",
        "books": [
            ("Uhren gibt es nicht mehr", "André Heller", "Christine", "Hauptempfehlung"),
            ("Das Ministerium der Zeit", "Kaliane Bradley", "Mona", "Hauptempfehlung"),
        ],
    },
    # 25
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250603_3367ed54.mp3": {
        "topic": "Eitelkeit",
        "books": [
            ("Das Palais muss brennen", "Mercedes Spannagel", "Mona", "Hauptempfehlung"),
            ("Montauk", "Max Frisch", "Christine", "Hauptempfehlung"),
        ],
    },
    # 26
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250520_66821add.mp3": {
        "topic": "Ehe",
        "books": [
            ("Die anhaltende Suche nach Glück", "Géraldine Dalban-Moreynas", "Christine", "Hauptempfehlung"),
            ("Die Ehefrau", "Meg Wolitzer", "Mona", "Hauptempfehlung"),
        ],
    },
    # 27
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250506_00637769.mp3": {
        "topic": "Reue",
        "books": [
            ("Nackt über Berlin", "Axel Ranisch", "Mona", "Hauptempfehlung"),
            ("Peggy", "Rebecca Godfrey & Leslie Jamison", "Christine", "Hauptempfehlung"),
        ],
    },
    # 28
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250422_56ffbf70.mp3": {
        "topic": "Frühling",
        "books": [
            ("Sonnenhang", "Kathrin Weßling", "Mona", "Hauptempfehlung"),
            ("Kirschblüten: Hanami", "Doris Dörrie", "Christine", "Hauptempfehlung"),
        ],
    },
    # 29
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250408_5a81da49.mp3": {
        "topic": "Versuchung",
        "books": [
            ("Die Partie seines Lebens", "Walter Tevis", "Christine", "Hauptempfehlung"),
            ("Dschungel", "Friedemann Karig", "Mona", "Hauptempfehlung"),
        ],
    },
    # 30
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250325_6426f065.mp3": {
        "topic": "Streit",
        "books": [
            ("Schwindel", "Hengameh Yaghoobifarah", "Mona", "Hauptempfehlung"),
            ("Noch mal von vorne", "Dana von Suffrin", "Christine", "Hauptempfehlung"),
        ],
    },
    # 31
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250311_9cdd986d.mp3": {
        "topic": "Träume",
        "books": [
            ("Sieben Tage Sommer", "Thommie Bayer", "Christine", "Hauptempfehlung"),
            ("Zwei vernünftige Erwachsene, die sich mal nackt gesehen haben", "Anika Decker", "Mona", "Hauptempfehlung"),
        ],
    },
    # 32
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250225_dd457cbc.mp3": {
        "topic": "Hoffnung",
        "books": [
            ("Mitternachtsschwimmer", "Roisin Maguire", "Mona", "Hauptempfehlung"),
            ("Ostende", "Volker Weidermann", "Christine", "Hauptempfehlung"),
        ],
    },
    # 33
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250211_7ad316a2.mp3": {
        "topic": "Grenzen",
        "books": [
            ("23 Uhr 12", "Adeline Dieudonné", "Christine", "Hauptempfehlung"),
            ("Über den Fluss", "Theresa Pleitner", "Mona", "Hauptempfehlung"),
        ],
    },
    # 34
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250128_d479c754.mp3": {
        "topic": "Winter",
        "books": [
            ("Das Eisschloss", "Tarjei Vesaas", "Mona", "Hauptempfehlung"),
            ("Die Eismacher", "Ernest van der Kwast", "Christine", "Hauptempfehlung"),
        ],
    },
    # 35
    "/zwei_seiten__der_podcast_ber_bcher__wdr_20250114_573ece61.mp3": {
        "topic": "Umzug",
        "books": [
            ("Alles wie immer", "Shirley Jackson", "Christine", "Hauptempfehlung"),
            ("Okaye Tage", "Jenny Mustard", "Mona", "Hauptempfehlung"),
        ],
    },
    # 36
    "7ce5873800341dfddf4294813d049b4b": {
        "topic": "Weihnachten",
        "books": [
            ("Der alte Mann und der Bär", "Janosch", "Mona", "Hauptempfehlung"),
            ("Verflixte Festtage", "Kati Hertzsch", "Christine", "Hauptempfehlung"),
        ],
    },
    # 37
    "520b31328f04dca7d3daedaecf8a4113": {
        "topic": "Rituale",
        "books": [
            ("Barbara stirbt nicht", "Alina Bronsky", "Christine", "Hauptempfehlung"),
            ("Issa", "Mirrianne Mahn", "Mona", "Hauptempfehlung"),
        ],
    },
    # 38
    "5fc62d7bbf4817faf1b2f0825656f7e7": {
        "topic": "Ordnung",
        "books": [
            ("Weltalltage", "Paula Fürstenberg", "Mona", "Hauptempfehlung"),
            ("Man kann auch in die Höhe fallen", "Joachim Meyerhoff", "Christine", "Hauptempfehlung"),
        ],
    },
    # 39
    "3db2e68471e27c5a812a19e1457a847d": {
        "topic": "Prüfungen",
        "books": [
            ("Institut für gute Mütter", "Jessamine Chan", "Mona", "Hauptempfehlung"),
            ("Munk", "Jan Weiler", "Christine", "Hauptempfehlung"),
        ],
    },
    # 40
    "ed5d9504d835a3ab9d6b40826c01f80d": {
        "topic": "Wehmut",
        "books": [
            ("Bevor wir uns vergessen", "Éliette Abécassis", "Christine", "Hauptempfehlung"),
            ("Nur vom Weltraum aus ist die Erde blau", "Björn Stephan", "Mona", "Hauptempfehlung"),
        ],
    },
    # 41
    "f57f3f9e175e802afe8ad2d029d3fb6a": {
        "topic": "Macht",
        "books": [
            ("Die schönste Version", "Ruth-Maria Thomas", "Mona", "Hauptempfehlung"),
            ("Die Himmelsrichtungen", "Jo Lendle", "Christine", "Hauptempfehlung"),
        ],
    },
    # 42
    "2672c92e2c99921c1a561f2e0388cb6b": {
        "topic": "Vertrauen",
        "books": [
            ("Das größere Wunder", "Thomas Glavinic", "Mona", "Hauptempfehlung"),
            ("Kleine Monster", "Jessica Lind", "Christine", "Hauptempfehlung"),
        ],
    },
    # 43
    "dbbb10a7d41537537a6fe074b075785a": {
        "topic": "Wunder",
        "books": [
            ("Wunder", "R.J. Palacio", "Christine", "Hauptempfehlung"),
            ("Draußen feiern die Leute", "Sven Pfizenmaier", "Mona", "Hauptempfehlung"),
        ],
    },
    # 44
    "cd3822b1b2452dc318abe1d61c20369e": {
        "topic": "Humor",
        "books": [
            ("Funny Girl", "Anthony McCarten", "Mona", "Hauptempfehlung"),
            ("Schrei mich bitte nicht so an!", "Miriam Wurster", "Christine", "Hauptempfehlung"),
        ],
    },
    # 45
    "7d4d690fafc7409586ea14a3d557406c": {
        "topic": "Verbrechen",
        "books": [
            ("Müll", "Wolf Haas", "Christine", "Hauptempfehlung"),
            ("Nullzeit", "Juli Zeh", "Mona", "Hauptempfehlung"),
        ],
    },
    # 46
    "0da4ac4c3860394203c19789caedda55": {
        "topic": "Stimme",
        "books": [
            ("Vox", "Nicholson Baker", "Christine", "Hauptempfehlung"),
            ("Vox", "Christina Dalcher", "Mona", "Hauptempfehlung"),
        ],
    },
    # 47
    "fa8c453e0ba756c8d10bfcca22f13379": {
        "topic": "Entscheidungen",
        "books": [
            ("Das Shaolin Prinzip", "Bernhard Moestl", "Mona", "Hauptempfehlung"),
            ("Bleib", "Adeline Dieudonné", "Christine", "Hauptempfehlung"),
        ],
    },
    # 48
    "a96f19a69ca15fe0082dbd5ed6186357": {
        "topic": "Märchen",
        "books": [
            ("Nathalie küsst", "David Foenkinos", "Christine", "Hauptempfehlung"),
            ("Power", "Verena Güntner", "Mona", "Hauptempfehlung"),
        ],
    },
    # 49
    "7ad05647aa5022c5a19ef27abc3c6af3": {
        "topic": "Reisen",
        "books": [
            ("Nächsten Sommer", "Edgar Rai", "Mona", "Hauptempfehlung"),
            ("Gebrauchsanweisung fürs Zugreisen", "Jaroslav Rudiš", "Christine", "Hauptempfehlung"),
        ],
    },
    # 50
    "dff0790b6e8aaa7b9d9bddb6d11f7eb7": {
        "topic": "Jubiläum",
        "books": [
            ("Léon und Louise", "Alex Capus", "beide", "Hauptempfehlung"),
            ("Trennungsroman", "Anna Brüggemann", "beide", "Hauptempfehlung"),
            ("Supergute Tage", "Mark Haddon", "beide", "Hauptempfehlung"),
            ("Der Club", "Takis Würger", "beide", "Hauptempfehlung"),
            ("Der Papierpalast", "Miranda Cowley Heller", "beide", "Hauptempfehlung"),
            ("City of Girls", "Elizabeth Gilbert", "beide", "Hauptempfehlung"),
        ],
    },
    # 51
    "b422e918996aded6f718dd277a0d6412": {
        "topic": "Pause",
        "books": [
            ("Das Geräusch einer Schnecke beim Essen", "Elisabeth Tova Bailey", "Christine", "Hauptempfehlung"),
            ("60 Tage liegen", "Dennis Freischlad", "Mona", "Hauptempfehlung"),
        ],
    },
    # 52
    "b55cf11f59911008663c2e72015c4d4f": {
        "topic": "Veränderung",
        "books": [
            ("Hawaii", "Cihan Acar", "Mona", "Hauptempfehlung"),
            ("Wir werden jung sein", "Maxim Leo", "Christine", "Hauptempfehlung"),
        ],
    },
    # 53
    "732534990db57d53ce81d3eab40dde7c": {
        "topic": "Scham",
        "books": [
            ("Seltsame Blüten", "Donal Ryan", "Christine", "Hauptempfehlung"),
            ("Scham", "Inès Bayard", "Mona", "Hauptempfehlung"),
        ],
    },
    # 54
    "9f9d97b965f23f353ae3c5641955e8f4": {
        "topic": "Scheitern",
        "books": [
            ("Die Kobra von Kreuzberg", "Michel Decar", "Mona", "Hauptempfehlung"),
            ("So, und jetzt kommst du", "Arno Frank", "Christine", "Hauptempfehlung"),
        ],
    },
    # 55
    "42257030b1d287705d62252f7af78263": {
        "topic": "Musik",
        "books": [
            ("Der letzte Satz", "Robert Seethaler", "Christine", "Hauptempfehlung"),
            ("Augustblau", "Deborah Levy", "Mona", "Hauptempfehlung"),
        ],
    },
    # 56
    "d746618d2e15db97d7d0fc148c12c8fb": {
        "topic": "Schule",
        "books": [
            ("Wie ich fälschte, log und Gutes tat", "Thomas Klupp", "Mona", "Hauptempfehlung"),
            ("Abifeier", "Eric Nil", "Christine", "Hauptempfehlung"),
        ],
    },
    # 57
    "ef68ebbcd21a77acb906ba25e4dd1dc1": {
        "topic": "Trauer",
        "books": [
            ("In einen Stern", "Puk Qvortrup", "Christine", "Hauptempfehlung"),
            ("Kurt", "Sarah Kuttner", "Mona", "Hauptempfehlung"),
        ],
    },
    # 58
    "23c6b32f627838e720ee57df9885f4ed": {
        "topic": "Schlaf",
        "books": [
            ("Schlafes Bruder", "Robert Schneider", "Christine", "Hauptempfehlung"),
            ("Mein Jahr der Ruhe und Entspannung", "Ottessa Moshfegh", "Mona", "Hauptempfehlung"),
        ],
    },
    # 59
    "12f27daf9278f27519525c3e83953960": {
        "topic": "Sehnsucht",
        "books": [
            ("Alle sieben Wellen", "Daniel Glattauer", "Christine", "Hauptempfehlung"),
            ("Beschreibung einer Krabbenwanderung", "Karosh Taha", "Mona", "Hauptempfehlung"),
        ],
    },
    # 60
    "4b903e1fec661df83c1f24219661659d": {
        "topic": "Familie",
        "books": [
            ("Dschinns", "Fatma Aydemir", "Mona", "Hauptempfehlung"),
            ("Der größte Spaß, den wir je hatten", "Claire Lombardo", "Christine", "Hauptempfehlung"),
        ],
    },
    # 61
    "735c9dc1308b1b7a575dd43c30e4888a": {
        "topic": "Schuld",
        "books": [
            ("Sommer wie Winter", "Judith Taschler", "Christine", "Hauptempfehlung"),
            ("Der Mauersegler", "Jasmin Schreiber", "Mona", "Hauptempfehlung"),
        ],
    },
    # 62
    "dd17aed1e9521b454f5021e566a7d9c8": {
        "topic": "Narben",
        "books": [
            ("Miroloi", "Karen Köhler", "Mona", "Hauptempfehlung"),
            ("Die Unvollkommenheit der Liebe", "Elizabeth Strout", "Christine", "Hauptempfehlung"),
        ],
    },
    # 63 — Q&A-Folge, keine Bücher
    "6f1c2578d8370d3503471c7b3e463a35": {
        "topic": "Fragen (Pt. 2)",
        "books": [],
    },
    # 64
    "295e4305e2cc54838a99dddee1fa110d": {
        "topic": "Wut",
        "books": [
            ("Schlichte Wut", "Davide Longo", "Christine", "Hauptempfehlung"),
            ("Die Wut, die bleibt", "Mareike Fallwickl", "Mona", "Hauptempfehlung"),
        ],
    },
    # 65
    "8fc9446c369e50cfb6b0bf9548de757e": {
        "topic": "Zufall",
        "books": [
            ("Soweit der Fluss uns trägt", "Shelley Read", "Mona", "Hauptempfehlung"),
            ("Schnell leben", "Brigitte Giraud", "Christine", "Hauptempfehlung"),
        ],
    },
    # 66
    "78226c6953e625a40246c05af7440590": {
        "topic": "Vergessen",
        "books": [
            ("Ich bleibe hier", "Marco Balzano", "Christine", "Hauptempfehlung"),
            ("All right. Good Night", "Helgard Haug", "Mona", "Hauptempfehlung"),
        ],
    },
    # 67
    "2ecc3a3b987732e48220cf897a53e828": {
        "topic": "Untreue",
        "books": [
            ("All das zu verlieren", "Leila Slimani", "Mona", "Hauptempfehlung"),
            ("Verbrenn all meine Briefe", "Alex Schulman", "Christine", "Hauptempfehlung"),
        ],
    },
    # 68
    "8a83292e14369a9b370ddc14d3017407": {
        "topic": "Väter",
        "books": [
            ("Hast du uns endlich gefunden", "Edgar Selge", "Christine", "Hauptempfehlung"),
            ("Pandatage", "James Gould-Bourn", "Mona", "Hauptempfehlung"),
        ],
    },
    # 69
    "f41869ae47da4d3d0c198b6fe4f29630": {
        "topic": "Alkohol",
        "books": [
            ("Nüchtern", "Daniel Schreiber", "Mona", "Hauptempfehlung"),
            ("Eierlikörtage", "Hendrik Groen", "Christine", "Hauptempfehlung"),
        ],
    },
    # 70
    "ad0f2c02b56f5d26a3733da031212684": {
        "topic": "Neustart",
        "books": [
            ("Mir geht's gut, wenn nicht heute dann morgen", "Dirk Stermann", "Christine", "Hauptempfehlung"),
            ("Kleine Probleme", "Nele Pollatschek", "Mona", "Hauptempfehlung"),
        ],
    },
    # 71
    "dc6e32916e9ae6ca948033c99103a2b9": {
        "topic": "Dreißig",
        "books": [
            ("Drei Wünsche", "Laura Karasek", "Mona", "Hauptempfehlung"),
            ("Bei euch ist es immer so unheimlich still", "Alena Schröder", "Christine", "Hauptempfehlung"),
        ],
    },
    # 72
    "0d127c0b3322f829cb3a221ea5bf9d44": {
        "topic": "Gewohnheit",
        "books": [
            ("Der Erdspiegel", "Andrea Maria Schenkel", "Christine", "Hauptempfehlung"),
            ("Leonard und Paul", "Rónán Hession", "Mona", "Hauptempfehlung"),
        ],
    },
    # 73
    "e14fc5a17763cbddeae03d2962566fe6": {
        "topic": "Geschenke",
        "books": [
            ("Schweig!", "Judith Merchant", "Mona", "Hauptempfehlung"),
            ("Nicht von dieser Welt", "Michael Ebert", "Christine", "Hauptempfehlung"),
        ],
    },
    # 74
    "5f85fa7bf4052bf4f4dbb6238e5a31f8": {
        "topic": "Kunst",
        "books": [
            ("Sein oder nicht sein", "Klaus Pohl", "Christine", "Hauptempfehlung"),
            ("Zauber der Stille", "Florian Illies", "Mona", "Hauptempfehlung"),
        ],
    },
    # 75
    "a25cab65359e7eee79e5f7f689f59b70": {
        "topic": "Wünsche",
        "books": [
            ("Die Perfektionen", "Vincenzo Latronico", "Mona", "Hauptempfehlung"),
            ("Die Frau, die nicht alterte", "Grégoire Delacourt", "Christine", "Hauptempfehlung"),
        ],
    },
    # 76
    "ed94fc4a23cbed176951ca289eda976d": {
        "topic": "Tiere",
        "books": [
            ("Sirius", "Jonathan Crown", "Christine", "Hauptempfehlung"),
            ("Das Glück ist grau", "Christopher McDougall", "Mona", "Hauptempfehlung"),
        ],
    },
    # 77
    "2d0f34541bb6b4a0390ecfd68a6e0b06": {
        "topic": "Nachbarn",
        "books": [
            ("Der Hausmann", "Wlada Kolosowa", "Mona", "Hauptempfehlung"),
            ("Über uns", "Eshkol Nevo", "Christine", "Hauptempfehlung"),
        ],
    },
    # 78
    "75df17507089376dc6b37a0c511f1ffa": {
        "topic": "Mut",
        "books": [
            ("Nils. Von Tod und Wut. Und von Mut", "Melanie Garanin", "Christine", "Hauptempfehlung"),
            ("Wie man unsterblich wird", "Sally Nicholls", "Mona", "Hauptempfehlung"),
        ],
    },
    # 79
    "08eb5bc5bb5751d8d62e4214baeec514": {
        "topic": "Männlichkeit",
        "books": [
            ("Toxic Man", "Frédéric Schwilden", "Mona", "Hauptempfehlung"),
            ("Gruber geht", "Doris Knecht", "Christine", "Hauptempfehlung"),
        ],
    },
    # 80
    "ec8dcd6d8c4d1b8fbe86a53f0a919866": {
        "topic": "Kälte",
        "books": [
            ("Das finstere Tal", "Thomas Willmann", "Christine", "Hauptempfehlung"),
            ("Herz auf Eis", "Isabelle Autissier", "Mona", "Hauptempfehlung"),
        ],
    },
    # 81
    "4b9139e568fdf8682413abed81aaa820": {
        "topic": "Lust",
        "books": [
            ("Tage in Cape May", "Chip Cheek", "Mona", "Hauptempfehlung"),
            ("Kleine Kratzer", "Jane Campbell", "Christine", "Hauptempfehlung"),
        ],
    },
    # 82 — Q&A-Folge, keine Bücher
    "85b87a1c1858e3d34f1302ed5b04d4b5": {
        "topic": "Fragen",
        "books": [],
    },
    # 83
    "2049c2e9d6177a67720aa6874a964e8b": {
        "topic": "Endlichkeit",
        "books": [
            ("Und dann steht einer auf und öffnet das Fenster", "Susann Pásztor", "Christine", "Hauptempfehlung"),
            ("Fremde Federn", "Alina Lindermuth", "Mona", "Hauptempfehlung"),
        ],
    },
    # 84
    "b9b6d78d1dab5d654920166adc7f8a7b": {
        "topic": "Sport",
        "books": [
            ("Wovon ich rede, wenn ich vom Laufen rede", "Haruki Murakami", "Mona", "Hauptempfehlung"),
            ("1933 war ein schlimmes Jahr", "John Fante", "Christine", "Hauptempfehlung"),
        ],
    },
    # 85
    "f6feb8505c8f89bf77f557d105fe3041": {
        "topic": "Geheimnis",
        "books": [
            ("Gittersee", "Charlotte Gneuß", "Christine", "Hauptempfehlung"),
            ("Im Wasser sind wir schwerelos", "Tomasz Jedrowski", "Mona", "Hauptempfehlung"),
        ],
    },
    # 86
    "f29d2fdd4d2897c05771e838f5eb7dad": {
        "topic": "Genuss",
        "books": [
            ("Zusammen sind wir wundervoll", "Marina Kirschner", "Mona", "Hauptempfehlung"),
            ("Der Geschmack der Sehnsucht", "Kim Thúy", "Christine", "Hauptempfehlung"),
        ],
    },
    # 87
    "e45c3ec05069f7d683c8de9c1ed53a4e": {
        "topic": "Natur",
        "books": [
            ("Ein Stadtmensch im Wald", "H.D. Walden", "Christine", "Hauptempfehlung"),
            ("An der Grasnarbe", "Mirjam Wittig", "Mona", "Hauptempfehlung"),
        ],
    },
    # 88
    "cbc58416a9fdec875cf6d651cf7d42d4": {
        "topic": "Geschwister",
        "books": [
            ("Worauf wir hoffen", "Fatima Farheen Mirza", "Mona", "Hauptempfehlung"),
            ("Brüderchen", "Clara Dupont-Monod", "Christine", "Hauptempfehlung"),
        ],
    },
    # 89
    "0c32dda845a295d0dea968ff25fdb81d": {
        "topic": "Angst",
        "books": [
            ("Königin außer Dienst", "Martine Bijl", "Christine", "Hauptempfehlung"),
            ("Kukolka", "Lana Lux", "Mona", "Hauptempfehlung"),
        ],
    },
    # 90
    "22f1738232e17d1d2a2b41379b225dc0": {
        "topic": "Reichtum",
        "books": [
            ("So reich wie der König", "Abigail Assor", "Mona", "Hauptempfehlung"),
            ("Melody", "Martin Suter", "Christine", "Hauptempfehlung"),
        ],
    },
    # 91
    "be5f2f84e14d7ea7ae02d046a283c958": {
        "topic": "Zuhause",
        "books": [
            ("Das dritte Licht", "Claire Keegan", "Christine", "Hauptempfehlung"),
            ("Novecento", "Alessandro Baricco", "Mona", "Hauptempfehlung"),
        ],
    },
    # 92
    "0ebeefbc068f99dbdb91a94fcf40a544": {
        "topic": "Einsamkeit",
        "books": [
            ("Hitzewelle", "Fabienne Maris", "Mona", "Hauptempfehlung"),
            ("Die Einsamkeit der Primzahlen", "Paolo Giordano", "Christine", "Hauptempfehlung"),
        ],
    },
    # 93
    "7e1dd784eaa4cf75ac9bcbaba6eda034": {
        "topic": "Körper",
        "books": [
            ("An Liebe stirbst du nicht", "Géraldine Dalban-Moreynas", "Christine", "Hauptempfehlung"),
            ("Die Kriegerin", "Helene Bukowski", "Mona", "Hauptempfehlung"),
        ],
    },
    # 94
    "5f33ee73d5d16ba6b4a11be7565e0927": {
        "topic": "Mütter",
        "books": [
            ("Auszeit", "Hannah Lühmann", "Mona", "Hauptempfehlung"),
            ("Eine Frau am Telefon", "Carole Fives", "Christine", "Hauptempfehlung"),
        ],
    },
    # 95
    "3a774f7052fb0d3597bebe9956fad907": {
        "topic": "Dunkelheit",
        "books": [
            ("Arbeit", "Thorsten Nagelschmidt", "Mona", "Hauptempfehlung"),
            ("Bis ich wieder atmen konnte", "Lorenzo Amurri", "Christine", "Hauptempfehlung"),
        ],
    },
    # 96
    "97a74e063d41526f69805573b18f4ee1": {
        "topic": "Freundschaft",
        "books": [
            ("Bell und Harry", "Jane Gardam", "Christine", "Hauptempfehlung"),
            ("Dunkelgrün fast schwarz", "Mareike Fallwickl", "Mona", "Hauptempfehlung"),
        ],
    },
    # 97
    "b8b6a97894f50d34cf5c55faab43ec87": {
        "topic": "Lügen",
        "books": [
            ("Super, und dir?", "Kathrin Weßling", "Mona", "Hauptempfehlung"),
            ("Lempi, das heißt Liebe", "Minna Rytisalo", "Christine", "Hauptempfehlung"),
        ],
    },
    # 98
    "5c94b1ccb8e5973668df3aad4438c173": {
        "topic": "Ferne",
        "books": [
            ("Die vier Jahreszeiten des Sommers", "Grégoire Delacourt", "Christine", "Hauptempfehlung"),
            ("Über die See", "Mariette Navarro", "Mona", "Hauptempfehlung"),
        ],
    },
    # 99
    "f2e5b2250755b10d040376953eba5eb9": {
        "topic": "Liebeskummer",
        "books": [
            ("Haha Heartbreak", "Olivia Kuderewski", "Mona", "Hauptempfehlung"),
            ("Cindy liebt mich nicht", "Juan Moreno & Jochen-Martin Gutsch", "Christine", "Hauptempfehlung"),
        ],
    },
    # 100
    "a02bd04c5521b4973e7419cb94b02df4": {
        "topic": "Anfänge",
        "books": [
            ("Fünf Viertelstunden bis zum Meer", "Ernest van der Kwast", "Christine", "Hauptempfehlung"),
            ("Sommernachtserwachen", "Meg Rosoff", "Mona", "Hauptempfehlung"),
        ],
    },
    # 101 — Trailer, keine Bücher
    "eaeac8fb604f84a92b1846eab5d617cd": {
        "topic": "Trailer",
        "books": [],
    },
}


def main() -> None:
    episodes = json.loads(EPISODES_FILE.read_text(encoding="utf-8"))

    out_episodes = []
    missing = []
    book_count = 0

    for ep in episodes:
        guid = ep["guid"]
        extraction = EXTRACTIONS.get(guid)
        if extraction is None:
            missing.append((guid, ep["title"]))
            continue

        books = [
            {
                "title": title,
                "author": author,
                "recommended_by": recommended_by,
                "role": role,
            }
            for title, author, recommended_by, role in extraction["books"]
        ]
        book_count += len(books)

        out_episodes.append(
            {
                "guid": guid,
                "title": ep["title"],
                "published": ep["published"],
                "topic": extraction["topic"],
                "page_url": ep.get("page_url"),
                "audio_url": ep.get("audio_url"),
                "books": books,
            }
        )

    payload = {
        "metadata": {
            "podcast": "Zwei Seiten – Der Podcast über Bücher (WDR)",
            "extraction_method": (
                "manuell von Claude (Claude Code) aus den RSS-Feed-Beschreibungen "
                "extrahiert; nur die in der jeweiligen Folge tatsächlich besprochenen "
                "Bücher, keine 'Beim nächsten Mal'-Vorschauen."
            ),
            "role_legend": {
                "Hauptempfehlung": "zentrale Buchbesprechung der Folge",
                "Zusatzempfehlung": "weitere ausführlich empfohlene Bücher (Sonderfolgen)",
            },
            "recommender_legend": {
                "Christine": "Christine Westermann",
                "Mona": "Mona Ameziane",
                "beide": "von beiden gemeinsam empfohlen",
            },
            "total_episodes": len(out_episodes),
            "total_books": book_count,
        },
        "episodes": out_episodes,
    }

    OUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Written: {OUT_FILE}")
    print(f"  Episodes with data: {len(out_episodes)}")
    print(f"  Total books:        {book_count}")
    if missing:
        print(f"  Missing episodes:   {len(missing)}")
        for guid, title in missing:
            print(f"    - {guid}: {title}")


if __name__ == "__main__":
    main()
