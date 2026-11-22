// Daten laden und aufbereiten
export const CONTINENTS = {
  EU: { id: 'EU', name: 'Europa', color: '#5b8def', emoji: '🏰', bbox: [[-25, 34], [45, 71]] },
  AS: { id: 'AS', name: 'Asien', color: '#ef5f7a', emoji: '🐼', bbox: [[25, -11], [150, 62]] },
  AF: { id: 'AF', name: 'Afrika', color: '#f3a23a', emoji: '🦁', bbox: [[-19, -36], [53, 38]] },
  NA: { id: 'NA', name: 'Nordamerika', color: '#3fbf86', emoji: '🦅', bbox: [[-170, 6], [-50, 75]] },
  SA: { id: 'SA', name: 'Südamerika', color: '#a26cf0', emoji: '🦜', bbox: [[-83, -56], [-33, 13]] },
  OC: { id: 'OC', name: 'Ozeanien', color: '#eac42c', emoji: '🦘', bbox: [[110, -48], [180, 2]] },
  AN: { id: 'AN', name: 'Antarktis', color: '#dfeefa', emoji: '🐧', bbox: [[-180, -90], [180, -60]] },
};
// Ozeanien heisst bei Kindern oft "Australien"
CONTINENTS.OC.alias = 'Australien und Ozeanien';

export const OCEANS = {
  PAC: { id: 'PAC', name: 'Pazifischer Ozean', short: 'Pazifik', label: [-150, 5], emoji: '🐳' },
  ATL: { id: 'ATL', name: 'Atlantischer Ozean', short: 'Atlantik', label: [-35, 25], emoji: '⛵' },
  IND: { id: 'IND', name: 'Indischer Ozean', short: 'Indischer Ozean', label: [78, -20], emoji: '🐠' },
  ARC: { id: 'ARC', name: 'Arktischer Ozean', short: 'Nordpolarmeer', label: [0, 80], emoji: '🐻‍❄️' },
  SOU: { id: 'SOU', name: 'Südlicher Ozean', short: 'Südpolarmeer', label: [60, -62], emoji: '🧊' },
};

// Länder, die auf zwei Kontinenten liegen: Teilgebiet mit anderem Kontinent
export const SPLITS = [
  { id: 'RUS', continent: 'AS', test: ([lon]) => lon > 58 || lon < -160, boxes: [[[58, 30], [180, 89]], [[-180, 50], [-160, 89]]] },
  { id: 'FRA', continent: 'SA', test: ([lon]) => lon < -30 && lon > -70, boxes: [[[-60, 0], [-48, 9]]] },
];

export function continentAt(country, lonlat) {
  const s = SPLITS.find((x) => x.id === country.id);
  return s && lonlat && s.test(lonlat) ? s.continent : country.continent;
}

// Grobe Zuordnung eines Punkts im Meer zu einem Ozean (reicht fürs Spiel)
export function oceanAt(lon, lat) {
  if (lat > 66) return 'ARC';
  if (lat < -58) return 'SOU';
  if (lat < 30 && lon >= 20 && lon <= 100) return 'IND';
  if (lat < -10 && lon > 100 && lon <= 147) return 'IND';
  if (lat < 8) return lon > -68 && lon < 20 ? 'ATL' : 'PAC';
  if (lat < 30) {
    const edge = -78 - (lat - 8) * 1.9; // Pazifikküste Mittelamerikas
    return lon > edge && lon < 20 ? 'ATL' : lon >= 20 && lon < 45 ? 'IND' : 'PAC';
  }
  return lon > -100 && lon < 45 ? 'ATL' : 'PAC';
}

// Bekannte Länder, die auf "Leicht" immer dabei sind
const FAMOUS = new Set([
  'CHE', 'AUT', 'DEU', 'ITA', 'FRA', 'ESP', 'GBR', 'NLD', 'PRT', 'GRC', 'JPN', 'NZL', 'ISL', 'IRL', 'CUB',
  'KOR', 'ISR', 'DNK', 'BEL', 'JAM', 'PAN', 'CRI', 'GTM', 'HTI', 'FJI', 'CZE', 'HRV', 'SGP', 'NPL', 'LKA', 'URY',
]);

export const LEVELS = {
  easy: {
    id: 'easy', name: 'Leicht', emoji: '🐣', desc: 'Für Kinder ab 7', tries: 3, questions: 8, time: 0,
    pool: (c) => c.area >= 200000 || c.population >= 40e6 || FAMOUS.has(c.id),
    hintAfter: 2, oceans: false,
  },
  medium: {
    id: 'medium', name: 'Mittel', emoji: '🦊', desc: 'Für Profis', tries: 2, questions: 10, time: 0,
    pool: (c) => c.area >= 20000 || c.population >= 5e6 || FAMOUS.has(c.id),
    hintAfter: 99, oceans: true,
  },
  hard: {
    id: 'hard', name: 'Schwer', emoji: '🦅', desc: 'Für Erwachsene', tries: 1, questions: 15, time: 12,
    pool: () => true, hintAfter: 99, oceans: true,
  },
};

export async function loadData() {
  const [world, countries, land] = await Promise.all([
    fetch('data/world.json').then((r) => r.json()),
    fetch('data/countries.json').then((r) => r.json()),
    fetch('data/land-110m.json').then((r) => r.json()),
  ]);
  const features = topojson.feature(world, world.objects.countries).features.filter((f) => f.id);
  // Teilgebiete mit gleicher ID (z. B. Nordzypern -> Zypern) zusammenführen
  const merged = new Map();
  for (const f of features) {
    if (!merged.has(f.id)) merged.set(f.id, []);
    merged.get(f.id).push(f);
  }
  const geo = [];
  for (const [id, list] of merged) {
    if (!countries[id]) continue;
    if (list.length === 1) geo.push(list[0]);
    else {
      const mergedGeom = topojson.merge(world, world.objects.countries.geometries.filter((g) => g.id === id));
      geo.push({ type: 'Feature', id, properties: {}, geometry: mergedGeom });
    }
  }
  const landFeature = topojson.feature(land, land.objects.land);
  const continentMesh = {};
  for (const k of Object.keys(CONTINENTS)) {
    continentMesh[k] = topojson.merge(
      world,
      world.objects.countries.geometries.filter((g) => g.id && g.id !== 'RUS' && countries[g.id] && countries[g.id].continent === k)
    );
  }
  return { countries, features: geo, landFeature, continentMesh };
}
