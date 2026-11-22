// Oberfläche: Steckbrief, Meldungen, Konfetti, Globus
import { CONTINENTS } from './data.js';

export const $ = (s) => document.querySelector(s);
const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Zahlen kindgerecht ----------
export function fmtPeople(n, locale) {
  if (n == null) return 'unbekannt';
  if (n >= 1e9) return `${(n / 1e9).toLocaleString(locale, { maximumFractionDigits: 2 })} Milliarden`;
  if (n >= 1e6) return `${(n / 1e6).toLocaleString(locale, { maximumFractionDigits: n >= 1e8 ? 0 : 1 })} Millionen`;
  return Math.round(n).toLocaleString(locale);
}

function times(r) {
  if (r < 1.3) return null;
  if (r < 1.75) return 'eineinhalbmal';
  if (r < 2.5) return 'doppelt';
  if (r < 3.5) return 'dreimal';
  if (r < 10) return `${Math.round(r)}-mal`;
  if (r < 100) return `${Math.round(r / 5) * 5}-mal`;
  return `${Math.round(r / 50) * 50}-mal`;
}

function compare(value, homeValue, hn, what) {
  if (!value || !homeValue) return '';
  const r = value / homeValue;
  const people = what === 'people';
  if (r >= 1.3) return people ? `Etwa ${times(r)} so viele Menschen wie ${hn.in}.` : `Etwa ${times(r)} so groß wie ${hn.nom}.`;
  if (r <= 1 / 1.3) {
    const t = times(1 / r);
    return people ? `${capFirst(hn.in)} leben etwa ${t} so viele Menschen.` : `${capFirst(hn.nom)} ist etwa ${t} so groß.`;
  }
  return people ? `Ungefähr so viele wie ${hn.in}.` : `Ungefähr so groß wie ${hn.nom}.`;
}

export const HOME_NAMES = {
  CHE: { nom: 'die Schweiz', in: 'in der Schweiz', locale: 'de-CH' },
  DEU: { nom: 'Deutschland', in: 'in Deutschland', locale: 'de-DE' },
  AUT: { nom: 'Österreich', in: 'in Österreich', locale: 'de-AT' },
  LIE: { nom: 'Liechtenstein', in: 'in Liechtenstein', locale: 'de-CH' },
  LUX: { nom: 'Luxemburg', in: 'in Luxemburg', locale: 'de-DE' },
};

export function flagImg(c, cls = '') {
  return c.iso2 ? `<img class="${cls}" src="flags/${c.iso2}.svg" alt="Flagge von ${esc(c.name)}" draggable="false" />` : '';
}

export function capitalText(c) {
  if (!c.capital || !c.capital.length) return 'keine';
  return c.capital.slice(0, 3).join(', ');
}

// ---------- Steckbrief ----------
export function showCard(c, { countries, homeId, result = null, actions = [], onNeighbor = null }) {
  const home = countries[homeId];
  const hn = HOME_NAMES[homeId];
  const loc = hn.locale;
  const cont = CONTINENTS[c.continent];
  const isHome = c.id === homeId;

  const facts = [];
  facts.push(['🏛️', 'Hauptstadt', esc(capitalText(c))]);
  facts.push([
    '👨‍👩‍👧',
    'Einwohner',
    `${fmtPeople(c.population, loc)} Menschen`,
    isHome ? 'Das ist dein Land! 🏠' : compare(c.population, home.population, hn, 'people'),
  ]);
  const ratio = c.area / home.area;
  const big = 84;
  const sc = Math.sqrt(Math.min(ratio, 1)) * big, sh = Math.sqrt(Math.min(1 / ratio, 1)) * big;
  const bar = isHome ? '' : `<div class="size-bar">
      <div><div class="sq" style="width:${Math.max(3, sc)}px;height:${Math.max(3, sc)}px"></div><small>${esc(c.name)}</small></div>
      <div><div class="sq home" style="width:${Math.max(3, sh)}px;height:${Math.max(3, sh)}px"></div><small>${esc(home.name)}</small></div>
    </div>`;
  facts.push([
    '📏',
    'Fläche',
    `${Math.round(c.area).toLocaleString(loc)} km²`,
    (isHome ? '' : compare(c.area, home.area, hn, 'area')) + bar,
  ]);
  if (c.languages.length) {
    const l = c.languages.slice(0, 4).join(', ') + (c.languages.length > 4 ? ` und ${c.languages.length - 4} weitere` : '');
    facts.push(['🗣️', c.languages.length > 1 ? 'Sprachen' : 'Sprache', esc(l)]);
  }
  if (c.currencies.length) facts.push(['💰', 'Geld', esc(c.currencies.slice(0, 2).join(', '))]);
  if (c.peak) facts.push(['⛰️', 'Höchster Berg', `${esc(c.peak.name)}`, c.peak.h ? `${c.peak.h.toLocaleString(loc)} Meter hoch` : '']);
  const nb = c.borders.map((b) => countries[b]).filter(Boolean);
  let geo;
  if (c.landlocked) geo = ['🏞️', 'Lage', 'Kein Meer', 'Dieses Land hat keine Küste.'];
  else if (!nb.length) geo = ['🏝️', 'Lage', 'Insel-Land', 'Rundherum ist Wasser.'];
  else geo = ['🌊', 'Lage', 'Am Meer', 'Dieses Land hat eine Küste.'];
  facts.push(geo);
  if (nb.length) {
    const chips = nb.map((n) => `<button class="chip" data-id="${n.id}">${esc(n.name)}</button>`).join('');
    facts.push(['🤝', `${nb.length} ${nb.length === 1 ? 'Nachbarland' : 'Nachbarländer'}`, '', `<div class="chips">${chips}</div>`]);
  }

  const headColor = cont.id === 'AN' ? '#6aa8d8' : cont.color;
  const res = result
    ? `<div class="card-result ${result.ok ? 'good' : 'bad'}">${esc(result.text)}</div>`
    : '';
  $('#card-body').innerHTML = `
    <div class="card-head" style="background:linear-gradient(135deg, ${headColor}, ${d3.color(headColor).darker(0.6)})">
      ${flagImg(c)}
      <div>
        <div class="cname">${esc(c.name)}</div>
        ${c.official && c.official !== c.name ? `<div class="cofficial">${esc(c.official)}</div>` : ''}
        <span class="cbadge">${cont.emoji} ${esc(cont.name)}${c.sovereign ? '' : ' · Gebiet'}</span>
      </div>
    </div>
    ${res}
    <div class="facts">
      ${facts.map(([i, l, v, extra]) => `
        <div class="fact"><div class="fi">${i}</div><div>
          <div class="fl">${l}</div>${v ? `<div class="fv">${v}</div>` : ''}${extra ? `<div class="fc">${extra}</div>` : ''}
        </div></div>`).join('')}
    </div>`;
  $('#card-body').scrollTop = 0;
  const act = $('#card-actions');
  act.innerHTML = '';
  for (const a of actions) {
    const b = document.createElement('button');
    b.className = 'btn' + (a.primary ? ' primary' : '');
    b.textContent = a.label;
    b.onclick = a.fn;
    act.appendChild(b);
  }
  $('#card-body').querySelectorAll('.chip').forEach((b) => {
    b.onclick = () => onNeighbor && onNeighbor(b.dataset.id);
  });
  const card = $('#card');
  card.classList.remove('hidden');
  document.body.classList.add('card-open');
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = '';
}


export function hideCard() {
  $('#card').classList.add('hidden');
  document.body.classList.remove('card-open');
}

// ---------- Kurze Meldung ----------
let toastT;
export function toast(text, kind = '', ms = 2200) {
  const t = $('#toast');
  t.textContent = text;
  t.className = kind;
  t.style.animation = 'none';
  void t.offsetWidth;
  t.style.animation = '';
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add('hidden'), ms);
}
export function hideToast() {
  $('#toast').classList.add('hidden');
}

// ---------- Bildschirme ----------
export function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
}

// ---------- Konfetti ----------
export function confetti(amount = 160) {
  const cv = $('#confetti');
  const ctx = cv.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = innerWidth * dpr;
  cv.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const colors = ['#ffd84d', '#ff7aa2', '#5b8def', '#3fbf86', '#ff9f5a', '#a26cf0', '#7ee8ff'];
  const parts = Array.from({ length: amount }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120,
    y: innerHeight * 0.45,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 16 - 6,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    w: 7 + Math.random() * 7,
    h: 4 + Math.random() * 5,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  let frame = 0;
  const step = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.38;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.cos(frame * 0.1 + p.r));
      ctx.restore();
    }
    if (frame++ < 200) requestAnimationFrame(step);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  step();
}

// ---------- Drehender Globus (Maskottchen) ----------
export function startGlobe(canvas, land) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const proj = d3.geoOrthographic().scale(size / 2 - 4).translate([size / 2, size / 2]).clipAngle(90).precision(0.6);
  const path = d3.geoPath(proj, ctx);
  const grat = d3.geoGraticule10();
  let rot = 20, running = true, last = 0;
  const draw = (t) => {
    if (!running) return;
    requestAnimationFrame(draw);
    if (t - last < 33) return;
    last = t;
    rot = (rot + 0.6) % 360;
    proj.rotate([rot, -18]);
    ctx.clearRect(0, 0, size, size);
    const g = ctx.createRadialGradient(size * 0.35, size * 0.3, size * 0.05, size / 2, size / 2, size / 2);
    g.addColorStop(0, '#9fe3ff');
    g.addColorStop(0.6, '#3aa0e8');
    g.addColorStop(1, '#2464b8');
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); path(grat); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); path(land); ctx.fillStyle = '#7ad36b'; ctx.fill();
    ctx.strokeStyle = '#4fa84a'; ctx.lineWidth = 1.5; ctx.stroke();
    const hl = ctx.createRadialGradient(size * 0.32, size * 0.28, 0, size * 0.32, size * 0.28, size * 0.5);
    hl.addColorStop(0, 'rgba(255,255,255,.35)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = hl; ctx.fill();
  };
  requestAnimationFrame(draw);
  return {
    stop: () => { running = false; },
    start: () => { if (!running) { running = true; requestAnimationFrame(draw); } },
  };
}

// Kleine Kontinent-Silhouette für Auswahlknöpfe
export function continentIcon(mesh, id) {
  const bbox = CONTINENTS[id].bbox;
  const p = d3.geoEquirectangular();
  if (id === 'AN') p.rotate([0, 0]);
  const feature = { type: 'Feature', geometry: mesh };
  const box = { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: [bbox[0], bbox[1], [bbox[0][0], bbox[1][1]], [bbox[1][0], bbox[0][1]]] } };
  p.fitExtent([[2, 2], [94, 68]], id === 'AN' ? feature : box);
  const path = d3.geoPath(p);
  return `<svg viewBox="0 0 96 70" aria-hidden="true"><path d="${path(feature)}" /></svg>`;
}
