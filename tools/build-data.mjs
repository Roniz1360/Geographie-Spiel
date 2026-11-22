// Baut data/countries.json und kopiert Flaggen + Karte.
// Quellen: world-countries (Namen, Fläche, Region, Nachbarn), Weltbank (Bevölkerung),
// Wikidata (Hauptstadt, Sprachen, Währung, höchster Berg – deutsch).
// Rohdaten werden in tools/.cache zwischengespeichert.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cache = path.join(root, 'tools/.cache');
fs.mkdirSync(cache, { recursive: true });

async function cached(name, url, opts = {}) {
  const f = path.join(cache, name);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const txt = await res.text();
  fs.writeFileSync(f, txt);
  return JSON.parse(txt);
}

const sparql = (name, q) =>
  cached(name, 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(q), {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'geographie-spiel-builder/1.0' },
  }).then((d) => {
    const m = {};
    for (const b of d.results.bindings) (m[b.iso.value] ??= []).push(b);
    return m;
  });

const world = require('world-countries');
const topo = require('world-atlas/countries-50m.json');

const wb = await cached(
  'population.json',
  'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=3000&date=2020:2025'
);
const pop = {};
for (const r of wb[1]) {
  if (r.value == null) continue;
  const cur = pop[r.countryiso3code];
  if (!cur || +r.date > cur.year) pop[r.countryiso3code] = { value: r.value, year: +r.date };
}
pop.UNK ??= pop.XKX; // Kosovo heisst bei der Weltbank XKX
// Von der Weltbank nicht erfasst (Quelle: nationale Statistikämter)
pop.TWN ??= { value: 23400000, year: 2024 };
pop.VAT ??= { value: 764, year: 2023 };

const label = 'rdfs:label ?l. FILTER(lang(?l)="de")';
const caps = await sparql('capitals.json', `SELECT ?iso ?l WHERE { ?c wdt:P298 ?iso; wdt:P36 ?x. ?x ${label} }`);
const langs = await sparql('languages.json', `SELECT ?iso ?l WHERE { ?c wdt:P298 ?iso; wdt:P37 ?x. ?x ${label} }`);
const curr = await sparql('currencies.json', `SELECT ?iso ?l WHERE { ?c wdt:P298 ?iso; wdt:P38 ?x. ?x ${label} }`);
const peaks = await sparql(
  'peaks.json',
  `SELECT ?iso ?l ?h WHERE { ?c wdt:P298 ?iso; wdt:P610 ?x. ?x ${label} OPTIONAL { ?x wdt:P2044 ?h } }`
);
const uniq = (a) => [...new Set(a)];
const vals = (m, k) => uniq((m[k] || []).map((b) => b.l.value));

// Wikidata kennt Kosovo unter XKX
for (const m of [caps, langs, curr, peaks]) m.UNK ??= m.XKX;

function continentOf(c) {
  if (c.region === 'Americas') return c.subregion === 'South America' ? 'SA' : 'NA';
  return { Africa: 'AF', Asia: 'AS', Europe: 'EU', Oceania: 'OC', Antarctic: 'AN' }[c.region] || 'OC';
}

// Länder, die im Quiz vorkommen (UNO-Mitglieder + einige allgemein bekannte)
const QUIZ_EXTRA = new Set(['UNK', 'TWN', 'PSE', 'VAT']);
const geoIds = new Set(topo.objects.countries.geometries.map((g) => g.id).filter(Boolean));
const nameToCca3 = { Kosovo: 'UNK', Somaliland: 'SOM', 'N. Cyprus': 'CYP' };

const byCca3 = Object.fromEntries(world.map((c) => [c.cca3, c]));
const out = {};
for (const c of world) {
  const onMap = geoIds.has(c.ccn3) || c.cca3 === 'UNK';
  if (!onMap) continue;
  const p = pop[c.cca3];
  const peakList = (peaks[c.cca3] || []).map((b) => ({ name: b.l.value, h: b.h ? Math.round(+b.h.value) : 0 }));
  peakList.sort((a, b) => b.h - a.h);
  const capital = c.cca3 === 'VAT' ? ['Vatikanstadt'] : vals(caps, c.cca3);
  out[c.cca3] = {
    id: c.cca3,
    iso2: c.cca2.toLowerCase(),
    ccn3: c.ccn3 || null,
    name: c.translations.deu?.common || c.name.common,
    official: c.translations.deu?.official || c.name.official,
    continent: continentOf(c),
    capital: capital.length ? capital : c.capital || [],
    population: p ? p.value : null,
    populationYear: p ? p.year : null,
    area: c.area,
    languages: vals(langs, c.cca3).filter((l) => !/Gebärdensprache/.test(l)),
    currencies: vals(curr, c.cca3),
    peak: peakList[0] && peakList[0].h > 0 ? peakList[0] : null,
    landlocked: !!c.landlocked,
    borders: (c.borders || []).filter((b) => byCca3[b]),
    latlng: c.latlng,
    quiz: !!(c.unMember || QUIZ_EXTRA.has(c.cca3)),
    sovereign: c.independent === true || c.cca3 === 'UNK',
  };
}

// Flaggen kopieren
const flagSrc = path.join(root, 'node_modules/flag-icons/flags/4x3');
const flagDst = path.join(root, 'flags');
fs.mkdirSync(flagDst, { recursive: true });
let flags = 0;
for (const c of Object.values(out)) {
  const f = path.join(flagSrc, c.iso2 + '.svg');
  if (fs.existsSync(f)) {
    fs.copyFileSync(f, path.join(flagDst, c.iso2 + '.svg'));
    flags++;
  } else c.iso2 = null;
}

// Karte: Geometrien ohne ID bekommen die cca3 über den Namen, sonst leere ID
for (const g of topo.objects.countries.geometries) {
  const c = world.find((w) => w.ccn3 && w.ccn3 === g.id);
  g.id = c ? c.cca3 : nameToCca3[g.properties.name] || null;
  g.properties = {};
}
fs.writeFileSync(path.join(root, 'data/world.json'), JSON.stringify(topo));
fs.writeFileSync(path.join(root, 'data/countries.json'), JSON.stringify(out));

const list = Object.values(out);
console.log(`${list.length} Länder, ${list.filter((c) => c.quiz).length} im Quiz, ${flags} Flaggen`);
const missing = list.filter((c) => c.quiz && (!c.population || !c.capital.length));
if (missing.length) console.log('Unvollständig:', missing.map((c) => c.id).join(', '));
