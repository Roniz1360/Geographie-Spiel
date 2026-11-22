# 🌍 Weltentdecker

Ein Geografie-Lernspiel im Browser – für Kinder ab 7 Jahren und, dank drei Schwierigkeitsstufen, auch für Erwachsene.
Funktioniert mit Finger (Tablet, Handy) und Maus (PC).

## Spielarten
| | |
|---|---|
| 🔭 **Entdecken** | Land antippen → Steckbrief mit Flagge, Hauptstadt, Einwohnern, Fläche, Sprachen, Geld, höchstem Berg und Nachbarländern. Mit Suche und Zufalls-Würfel. Meer antippen zeigt den Ozean. |
| 🌍 **Kontinente** | „Wo ist Afrika?“ – auf der Karte antippen. Ab *Mittel* auch Ozeane. |
| 📍 **Länder** | „Wo ist Frankreich?“ – Kontinent oder ganze Welt wählen. |
| 🏛️ **Hauptstädte** | „In welchem Land liegt Bern?“ |
| 🚩 **Flaggen** | Flagge ansehen, Land antippen. |

## Schwierigkeitsstufen
| | 🐣 Leicht | 🦊 Mittel | 🦅 Schwer |
|---|---|---|---|
| Länder | bekannte und große | fast alle | alle 196 |
| Versuche | 3, mit Richtungs-Tipp, danach blinkt das Ziel | 2, mit Richtungs-Tipp | 1, Abstand in km |
| Zeit | ohne | ohne | 12 Sekunden, Zeitbonus |
| Fragen | 8 | 10 | 15 |

Nach jeder Antwort erscheint der Steckbrief des Landes – so lernt man nebenbei.
Am Ende gibt es bis zu 3 Sterne, Konfetti und einen Rekord pro Spielart.

Weitere Funktionen: Fragen vorlesen (🗣), Hintergrundmusik (🎵), Töne (🔔), Vergleiche mit dem eigenen Land
(Schweiz, Deutschland, Österreich, Liechtenstein, Luxemburg). Alle Klänge werden im Browser erzeugt.

## Starten
Es braucht nur einen einfachen Webserver (direkt per Doppelklick geht es wegen der Browser-Sicherheit nicht):

```bash
npm start            # startet http://localhost:8080
```

Ohne Node.js geht auch: `python3 -m http.server 8080`

Online stellen: Den ganzen Ordner auf einen beliebigen Webspace kopieren, z. B. GitHub Pages
(Einstellungen → Pages → Branch wählen). Es gibt keinen Build-Schritt.

## Für Entwickler
- `index.html`, `css/style.css`, `js/*.js` – das Spiel (ohne Framework, nur D3 für die Karte)
  - `map.js` Karte, Zoom, Antippen · `main.js` Spielablauf · `audio.js` Klänge & Vorlesen
  - `ui.js` Steckbrief, Konfetti, Globus · `data.js` Kontinente, Ozeane, Stufen · `texts.js` Texte
- `data/` – Kartendaten und Länderinfos (fertig erzeugt)
- `npm run build:data` – Länderdaten neu erzeugen (holt Bevölkerung von der Weltbank und deutsche Namen von Wikidata)
- `npm test` – spielt alle Spielarten automatisch durch (Server muss laufen, braucht Playwright)

## Quellen & Lizenzen
- Karte: [Natural Earth](https://www.naturalearthdata.com/) über [world-atlas](https://github.com/topojson/world-atlas) (gemeinfrei / ISC)
- Länderinfos: [world-countries](https://github.com/mledoze/countries) (ODbL), [Weltbank](https://data.worldbank.org/) (CC BY 4.0), [Wikidata](https://www.wikidata.org/) (CC0)
- Flaggen: [flag-icons](https://github.com/lipis/flag-icons) (MIT)
- [D3](https://d3js.org/) und [topojson-client](https://github.com/topojson/topojson-client) (ISC)
