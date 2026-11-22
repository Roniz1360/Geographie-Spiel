// Sprachliche Hilfen und Lerntexte

// Ländernamen mit Artikel ("Wo ist die Schweiz?")
const ARTICLE = {
  CHE: 'die', TUR: 'die', USA: 'die', NLD: 'die', MNG: 'die', SVK: 'die', UKR: 'die', PHL: 'die', MDV: 'die',
  SYC: 'die', COM: 'die', BHS: 'die', CIV: 'die', DOM: 'die', CAF: 'die', ARE: 'die', MHL: 'die',
  SLB: 'die', VAT: 'der', IRN: 'der', IRQ: 'der', SDN: 'der', SSD: 'der', TCD: 'der', YEM: 'der',
  LBN: 'der', COG: 'der', COD: 'die', NER: 'der', OMN: 'der', SEN: 'der',
};

// Schönere Namen für Fragen
const QUIZ_NAME = {
  USA: 'USA',
  GBR: 'Großbritannien',
  COD: 'Demokratische Republik Kongo',
  COG: 'Kongo (Republik)',
  CAF: 'Zentralafrikanische Republik',
  CZE: 'Tschechien',
  ARE: 'Vereinigten Arabischen Emirate',
  DOM: 'Dominikanische Republik',
  CIV: 'Elfenbeinküste (Côte d’Ivoire)',
};

const PLURAL = new Set(['USA', 'NLD', 'PHL', 'MDV', 'SYC', 'COM', 'BHS', 'ARE', 'MHL', 'SLB']);
export const whereIs = (c) => `${PLURAL.has(c.id) ? 'Wo sind' : 'Wo ist'} ${withArticle(c)}?`;

export function withArticle(c) {
  const name = QUIZ_NAME[c.id] || c.name;
  const a = ARTICLE[c.id];
  return a ? `${a} ${name}` : name;
}

export function continentQuestion(cont) {
  return cont.id === 'AN' ? 'die Antarktis' : cont.id === 'OC' ? 'Australien und Ozeanien' : cont.name;
}

export const OCEAN_Q = {
  PAC: 'der Pazifik', ATL: 'der Atlantik', IND: 'der Indische Ozean', ARC: 'das Nordpolarmeer', SOU: 'das Südpolarmeer',
};

export const PRAISE = ['Super! 🎉', 'Toll gemacht! ⭐', 'Richtig! 👏', 'Spitze! 🚀', 'Klasse! 🌟', 'Bravo! 🥳', 'Genau! 💪', 'Wow! 🤩'];
export const SOFT_MISS = ['Fast!', 'Knapp daneben!', 'Nicht ganz!', 'Probier nochmal!', 'Hmm, nein.'];

export const CONTINENT_FACTS = {
  EU: ['Europa ist der zweitkleinste Kontinent.', 'Hier gibt es sehr viele Länder auf wenig Platz.', 'Der Vatikan, das kleinste Land der Welt, liegt in Europa.'],
  AS: ['Asien ist der größte Kontinent der Welt.', 'Hier leben mehr als die Hälfte aller Menschen.', 'Der Mount Everest, der höchste Berg der Erde, steht in Asien.'],
  AF: ['Afrika hat die meisten Länder – über 50!', 'Hier liegt die Sahara, die größte heiße Wüste.', 'Der Nil ist einer der längsten Flüsse der Welt.'],
  NA: ['Zu Nordamerika gehören auch Mittelamerika und die Karibik.', 'Grönland ist die größte Insel der Welt.', 'Kanada ist das zweitgrößte Land der Erde.'],
  SA: ['Im Amazonas-Regenwald leben unzählige Tiere.', 'Die Anden sind die längste Bergkette der Welt.', 'Brasilien ist das größte Land Südamerikas.'],
  OC: ['Australien ist Land und Kontinent zugleich.', 'Ozeanien besteht aus tausenden Inseln.', 'Kängurus und Koalas gibt es nur hier.'],
  AN: ['Die Antarktis ist der kälteste Ort der Erde.', 'Hier wohnt niemand fest – nur Forscher.', 'Pinguine fühlen sich hier wohl.'],
};

export const OCEAN_FACTS = {
  PAC: ['Der Pazifik ist der größte und tiefste Ozean.', 'Er ist größer als alle Kontinente zusammen.'],
  ATL: ['Der Atlantik liegt zwischen Amerika und Europa/Afrika.', 'Er ist der zweitgrößte Ozean.'],
  IND: ['Der Indische Ozean ist der wärmste Ozean.', 'Er liegt zwischen Afrika, Asien und Australien.'],
  ARC: ['Das Nordpolarmeer ist der kleinste Ozean.', 'Es ist oft mit Eis bedeckt – hier leben Eisbären.'],
  SOU: ['Das Südpolarmeer umgibt die Antarktis.', 'Hier schwimmen riesige Eisberge.'],
};

// Richtung von einem Punkt zu einem Ziel (für Tipps)
export function direction(from, to) {
  let dLon = to[0] - from[0];
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  const dLat = to[1] - from[1];
  const v = Math.abs(dLat) > Math.max(2.5, Math.abs(dLon) * 0.45) ? (dLat > 0 ? 'N' : 'S') : '';
  const h = Math.abs(dLon) > Math.max(2.5, Math.abs(dLat) * 0.45) ? (dLon > 0 ? 'O' : 'W') : '';
  const map = {
    N: ['Norden', '⬆️'], S: ['Süden', '⬇️'], O: ['Osten', '➡️'], W: ['Westen', '⬅️'],
    NO: ['Nordosten', '↗️'], NW: ['Nordwesten', '↖️'], SO: ['Südosten', '↘️'], SW: ['Südwesten', '↙️'],
  };
  const k = v + h;
  return map[k] ? `Weiter nach ${map[k][0]} ${map[k][1]}` : 'Ganz nah! 🔎';
}
