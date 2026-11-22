# Weltentdecker – Design

## Ziel
Geografie-Lernspiel im Browser für Kinder (7–9 Jahre), dank Schwierigkeitsgraden auch für Erwachsene.
Bedienung mit dem Finger (Tablet/Handy), läuft auch am PC.

## Entscheide
- **Technik (gewählt: Weg A):** statische Web-App, SVG-Karte mit D3 + TopoJSON, keine Build-Pipeline.
  Alle Daten liegen lokal im Projekt (offline spielbar). Verworfen: Spiel-Engine (Länderformen mühsam),
  Kachel-Karte à la Leaflet (nicht kindgerecht, braucht Internet).
- **Sprache:** Deutsch, Fragen können vorgelesen werden (Sprachausgabe des Browsers).
- **Sound:** komplett im Browser erzeugt (Web Audio): Tipp-, Richtig-, Falsch-Töne, Fanfare, Hintergrundmusik. Einzeln abschaltbar.

## Spielmodi
1. **Entdecken:** freie Karte, Land antippen → Steckbrief (Flagge, Hauptstadt, Bevölkerung, Fläche, Sprachen,
   Währung, höchster Berg, Nachbarn, kindgerechte Vergleiche mit der Schweiz).
2. **Kontinente finden:** „Wo ist Afrika?“ → auf der Weltkarte antippen.
3. **Länder finden:** Kontinent wählen (oder ganze Welt) → „Wo ist Frankreich?“ antippen.
4. **Hauptstädte:** „Bern ist die Hauptstadt von …?“ → Land antippen.
5. **Flaggen:** Flagge wird gezeigt → Land antippen.

## Schwierigkeit
| | Leicht 🐣 | Mittel 🦊 | Schwer 🦅 |
|---|---|---|---|
| Länder | bekannte/große | alle ausser Kleinstaaten | alle (196) |
| Versuche | 3 + Richtungs-Tipp, Ziel blinkt danach | 2 + Richtungs-Tipp | 1 |
| Zeit | keine | keine | 12 s pro Frage, Zeitbonus |
| Fragen/Runde | 8 | 10 | 15 |

Nach jeder Frage kurzer Steckbrief des gesuchten Landes (Lernen). Falscher Tipp zeigt den Namen des angetippten Landes.
Rundenende: 0–3 Sterne, Konfetti, Rekord pro Modus/Stufe (im Browser gespeichert).

## Nicht-Ziele (vorerst)
Spielerkonten, Mehrspieler, Server, andere Sprachen.

## Datenquellen
world-atlas (Natural Earth 1:50m), world-countries, Weltbank (Bevölkerung), Wikidata (deutsche Hauptstädte,
Sprachen, Währungen, Berge), flag-icons. Neu bauen mit `npm run build:data`.
