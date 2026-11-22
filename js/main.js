// Weltentdecker – Hauptprogramm
import { loadData, CONTINENTS, OCEANS, LEVELS, oceanAt, continentAt } from './data.js';
import { WorldMap, shade } from './map.js';
import { sound, speech } from './audio.js';
import { $, showCard, hideCard, toast, hideToast, showScreen, confetti, startGlobe, continentIcon, flagImg, capitalText } from './ui.js';
import { whereIs, continentQuestion, OCEAN_Q, PRAISE, SOFT_MISS, CONTINENT_FACTS, OCEAN_FACTS, direction } from './texts.js';

// ---------- Einstellungen (im Browser gespeichert) ----------
const STORE = 'weltentdecker.v1';
const store = (() => {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
})();
const settings = Object.assign({ level: 'easy', music: true, sfx: true, voice: true, home: 'CHE' }, store.settings || {});
const records = store.records || {};
function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ settings, records })); } catch { /* privat-Modus */ }
}

const MODES = [
  { id: 'explore', name: 'Entdecken', emoji: '🔭', desc: 'Tippe Länder an und lerne sie kennen', color: '#22b0c9' },
  { id: 'continents', name: 'Kontinente', emoji: '🌍', desc: 'Finde die Erdteile', color: '#ff8a3d', descHard: 'Kontinente & Ozeane finden' },
  { id: 'countries', name: 'Länder', emoji: '📍', desc: 'Wo liegt welches Land?', color: '#5b8def' },
  { id: 'capitals', name: 'Hauptstädte', emoji: '🏛️', desc: 'Welche Stadt gehört wohin?', color: '#a26cf0' },
  { id: 'flags', name: 'Flaggen', emoji: '🚩', desc: 'Welches Land hat diese Flagge?', color: '#ef5f7a' },
];

let data, map, globe;
let state = { mode: null };

// ---------- Start ----------
init().catch((e) => {
  console.error(e);
  $('#loading').textContent = 'Ups! Die Karte konnte nicht geladen werden. Bitte Seite neu laden.';
});

async function init() {
  data = await loadData();
  map = new WorldMap($('#map'), data, { onCountry, onOcean });
  paintDefault();
  buildHome();
  buildSearch();
  globe = startGlobe($('#globe'), data.landFeature);
  sound.sfxOn = settings.sfx;
  sound.musicOn = settings.music;
  speech.on = settings.voice;
  $('#loading').remove();
  window.__weltentdecker = { get state() { return state; }, map }; // für automatische Tests

  // Ton darf erst nach der ersten Berührung starten
  const unlock = () => sound.unlock();
  window.addEventListener('pointerdown', unlock, { once: false, passive: true });

  $('#btn-back').onclick = $('#btn-back2').onclick = () => { sound.click(); goHome(); };
  $('#btn-back3').onclick = () => { sound.click(); showScreen('screen-home'); };
  $('#btn-speak').onclick = () => { sound.click(); speakQuestion(true); };
  $('#card-close').onclick = () => { sound.click(); onCardClose(); };
  $('#zoom-in').onclick = () => map.zoomBy(1.6);
  $('#zoom-out').onclick = () => map.zoomBy(1 / 1.6);
  $('#zoom-home').onclick = () => { sound.whoosh(); regionView(); };
  $('#btn-random').onclick = () => {
    sound.click();
    const list = Object.values(data.countries).filter((c) => c.quiz);
    exploreSelect(list[(Math.random() * list.length) | 0].id);
  };
  $('#btn-again').onclick = () => { sound.click(); startQuiz(state.lastMode, state.lastRegion); };
  $('#btn-menu').onclick = () => { sound.click(); goHome(); };
}

function paintDefault() {
  map.setFill((id) => shade(CONTINENTS[data.countries[id].continent].color, id));
  map.setSplitFill((cont, id) => shade(CONTINENTS[cont].color, id + cont));
  map.setOutlines(null);
  map.hideMarkers(null);
}

// ---------- Startbildschirm ----------
function buildHome() {
  const lv = $('#levels');
  lv.innerHTML = '';
  for (const l of Object.values(LEVELS)) {
    const b = document.createElement('button');
    b.className = 'level' + (settings.level === l.id ? ' active' : '');
    b.innerHTML = `<span class="le">${l.emoji}</span><span class="ln">${l.name}</span><span class="ld">${l.desc}</span>`;
    b.onclick = () => {
      settings.level = l.id;
      save();
      sound.click();
      buildHome();
    };
    lv.appendChild(b);
  }
  const md = $('#modes');
  md.innerHTML = '';
  for (const m of MODES) {
    const b = document.createElement('button');
    b.className = 'mode';
    b.style.background = `linear-gradient(145deg, ${m.color}, ${d3.color(m.color).darker(0.7)})`;
    const best = bestRecord(m.id);
    const desc = settings.level !== 'easy' && m.descHard ? m.descHard : m.desc;
    b.innerHTML = `<span class="me">${m.emoji}</span><span class="mn">${m.name}</span><span class="md">${desc}</span>${best ? `<span class="mr">🏆 ${best}</span>` : ''}`;
    b.onclick = () => {
      sound.unlock();
      sound.click();
      if (m.id === 'explore') startExplore();
      else if (m.id === 'continents') startQuiz('continents', 'WORLD');
      else pickContinent(m);
    };
    md.appendChild(b);
  }
  const tg = (id, key, fn) => {
    const b = $(id);
    b.classList.toggle('off', !settings[key]);
    b.onclick = () => {
      settings[key] = !settings[key];
      save();
      fn(settings[key]);
      b.classList.toggle('off', !settings[key]);
      sound.unlock();
      sound.click();
    };
  };
  tg('#tg-music', 'music', (v) => sound.setMusic(v));
  tg('#tg-sfx', 'sfx', (v) => (sound.sfxOn = v));
  tg('#tg-voice', 'voice', (v) => { speech.on = v; if (v) speech.say('Ich lese dir die Fragen vor.'); else speech.stop(); });
  const hc = $('#home-country');
  hc.value = settings.home;
  hc.onchange = () => { settings.home = hc.value; save(); };
}

function bestRecord(modeId) {
  const vals = Object.entries(records).filter(([k]) => k.startsWith(modeId + '|') && k.endsWith('|' + settings.level)).map(([, v]) => v);
  return vals.length ? Math.max(...vals) : 0;
}

function goHome() {
  stopQuiz();
  speech.stop();
  state = { mode: null, lastMode: state.lastMode, lastRegion: state.lastRegion };
  hideCard();
  hideToast();
  $('#hud').classList.add('hidden');
  $('#explore-bar').classList.add('hidden');
  $('#zoom-ctrl').classList.add('hidden');
  map.clearMarks();
  map.clearLabels();
  paintDefault();
  map.zoomToWorld(0);
  buildHome();
  showScreen('screen-home');
  globe.start();
}

function hideScreens() {
  showScreen(null);
  globe.stop();
}

function pickContinent(mode) {
  $('#continent-title').textContent = `${mode.emoji} ${mode.name}: Wo möchtest du spielen?`;
  const grid = $('#continent-grid');
  grid.innerHTML = '';
  const level = LEVELS[settings.level];
  const items = [...Object.values(CONTINENTS).filter((c) => c.id !== 'AN'), { id: 'WORLD', name: 'Ganze Welt', color: '#2f80d1', emoji: '🌐' }];
  for (const c of items) {
    const n = poolFor(mode.id, c.id, level).length;
    const b = document.createElement('button');
    b.className = 'cont';
    b.style.background = `linear-gradient(145deg, ${c.color}, ${d3.color(c.color).darker(0.8)})`;
    const icon = c.id === 'WORLD' ? '<span style="font-size:56px;line-height:70px">🌐</span>' : continentIcon(data.continentMesh[c.id], c.id);
    const rec = records[`${mode.id}|${c.id}|${settings.level}`];
    b.innerHTML = `${icon}<span class="cn">${c.name}</span><span class="cc">${n} Länder${rec ? ` · 🏆 ${rec}` : ''}</span>`;
    b.onclick = () => { sound.click(); startQuiz(mode.id, c.id); };
    grid.appendChild(b);
  }
  showScreen('screen-continent');
}

// ---------- Entdecken ----------
function startExplore() {
  hideScreens();
  state = { mode: 'explore', lastMode: state.lastMode, lastRegion: state.lastRegion };
  paintDefault();
  map.clearMarks();
  map.clearLabels();
  $('#explore-bar').classList.remove('hidden');
  $('#zoom-ctrl').classList.remove('hidden');
  $('#search').value = '';
  setPadding();
  map.zoomToWorld(600);
  toast('Tippe auf ein Land! 👆', '', 2600);
  speech.say('Tippe auf ein Land, um es kennenzulernen.');
}

function buildSearch() {
  const dl = $('#country-list');
  const list = Object.values(data.countries).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  dl.innerHTML = list.map((c) => `<option value="${c.name}">`).join('');
  const input = $('#search');
  const go = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) return;
    const hit = list.find((c) => c.name.toLowerCase() === q) || list.find((c) => c.name.toLowerCase().startsWith(q)) ||
      list.find((c) => c.capital.some((k) => k.toLowerCase() === q));
    if (hit) { exploreSelect(hit.id); input.blur(); }
    else toast('Nicht gefunden 🤔', 'bad');
  };
  input.addEventListener('change', go);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
}

function exploreSelect(id) {
  const c = data.countries[id];
  if (!c) return;
  map.clearMarks();
  map.clearLabels();
  map.mark(id, 'selected');
  map.labelCountry(id, c.name);
  showCard(c, {
    countries: data.countries,
    homeId: settings.home,
    actions: [{ label: '🔊 Vorlesen', fn: () => speakCountry(c, true) }],
    onNeighbor: (nid) => { sound.tap(); exploreSelect(nid); },
  });
  setPadding(true);
  map.zoomToCountry(id, 900);
  sound.whoosh();
  speakCountry(c);
}

function speakCountry(c, force = false) {
  if (!speech.on && !force) return;
  const was = speech.on;
  speech.on = true;
  const cap = c.capital.length ? ` Die Hauptstadt ist ${c.capital[0]}.` : '';
  speech.say(`${c.name}.${cap}`);
  speech.on = was;
}

// Platz für Kopfleiste und Steckbrief beim Zoomen freihalten
function setPadding(withCard = false) {
  const top = Math.max(
    $('#hud').classList.contains('hidden') ? 0 : $('#hud').getBoundingClientRect().bottom,
    $('#explore-bar').classList.contains('hidden') ? 0 : $('#explore-bar').getBoundingClientRect().bottom
  );
  const p = { top: top + 6, right: 0, bottom: 0, left: 0 };
  if (withCard) {
    const wide = innerWidth > 720 && innerWidth > innerHeight;
    if (wide) p.right = Math.min(380, innerWidth - 32) + 20;
    else p.bottom = innerHeight * 0.55;
  }
  map.padding = p;
}

function onCardClose() {
  hideCard();
  if (state.mode === 'explore') {
    map.clearMarks();
    map.clearLabels();
    setPadding();
  } else if (state.quiz && state.quiz.resolved) nextQuestion();
}

// ---------- Quiz ----------
function poolFor(mode, region, level) {
  let list = Object.values(data.countries).filter((c) => c.quiz && c.continent !== 'AN' && map.byId.has(c.id));
  if (region !== 'WORLD') list = list.filter((c) => c.continent === region);
  list = list.filter(level.pool);
  if (mode === 'capitals') {
    list = list.filter((c) => c.capital.length && !c.capital.some((k) => k.toLowerCase().includes(c.name.toLowerCase().slice(0, 5))));
  }
  if (mode === 'flags') list = list.filter((c) => c.iso2);
  return list;
}

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function startQuiz(mode, region) {
  stopQuiz();
  hideScreens();
  hideCard();
  map.clearMarks();
  map.clearLabels();
  const level = LEVELS[settings.level];
  state = { mode, region, lastMode: mode, lastRegion: region };

  let targets;
  if (mode === 'continents') {
    targets = shuffle(Object.keys(CONTINENTS)).map((id) => ({ kind: 'continent', id }));
    if (level.oceans) targets = shuffle([...targets, ...Object.keys(OCEANS).map((id) => ({ kind: 'ocean', id }))]);
  } else {
    targets = shuffle(poolFor(mode, region, level)).slice(0, level.questions).map((c) => ({ kind: 'country', id: c.id }));
  }

  state.quiz = { mode, region, level, targets, index: -1, score: 0, results: [], resolved: false, done: new Set() };

  // Kartenfarben je nach Modus
  map.hideMarkers(null, mode === 'continents');
  if (mode === 'continents') {
    if (level.id === 'easy') {
      map.setFill((id) => CONTINENTS[data.countries[id].continent].color);
      map.setSplitFill((cont) => CONTINENTS[cont].color);
      map.setOutlines(Object.keys(CONTINENTS));
    } else {
      map.setFill(() => '#e9e2cf');
      map.setSplitFill(null);
      map.setOutlines(level.id === 'medium' ? Object.keys(CONTINENTS) : null);
    }
  } else {
    const inRegion = (id) => region === 'WORLD' || data.countries[id].continent === region;
    map.setFill(
      (id) => (inRegion(id) ? shade(CONTINENTS[data.countries[id].continent].color, id) : '#e4dccb'),
      (id) => !inRegion(id)
    );
    map.setSplitFill(null);
    map.setOutlines(null);
    // Antipp-Kreise nur für Länder der Region
    map.hideMarkers(new Set(Object.keys(data.countries).filter((id) => !inRegion(id))));
  }

  $('#hud').classList.remove('hidden');
  $('#zoom-ctrl').classList.remove('hidden');
  $('#timer').classList.toggle('hidden', !level.time);
  regionView(0);
  nextQuestion();
}

function regionView(duration = 900) {
  setPadding();
  const r = state.region;
  if (!r || r === 'WORLD' || state.mode === 'continents' || state.mode === 'explore') map.zoomToWorld(duration);
  else map.zoomToContinent(r, duration);
}

function stopQuiz() {
  if (state.quiz) clearInterval(state.quiz.timer);
}

function nextQuestion() {
  const q = state.quiz;
  clearInterval(q.timer);
  hideCard();
  hideToast();
  map.clearMarks();
  map.clearLabels();
  for (const id of q.done) map.mark(id, 'correct-keep');
  q.index++;
  if (q.index >= q.targets.length) return finishQuiz();
  q.resolved = false;
  q.misses = 0;
  q.triesLeft = q.level.tries;
  const t = q.targets[q.index];
  q.current = t;
  renderQuestion(t);
  regionView(q.index === 0 ? 0 : 700);
  updateStats();
  speakQuestion();

  if (q.level.time) {
    const total = q.level.time * 1000;
    q.start = performance.now();
    const bar = $('#timer-bar');
    let lastSec = q.level.time;
    q.timer = setInterval(() => {
      const left = Math.max(0, total - (performance.now() - q.start));
      bar.style.width = (left / total) * 100 + '%';
      bar.style.backgroundPosition = `${(left / total) * 100}% 0`;
      const sec = Math.ceil(left / 1000);
      if (sec !== lastSec && sec <= 3 && sec > 0) sound.tick(true);
      lastSec = sec;
      if (left <= 0) {
        clearInterval(q.timer);
        toast('⏰ Die Zeit ist um!', 'bad');
        reveal();
      }
    }, 50);
  }
}

function questionText(t) {
  const q = state.quiz;
  if (t.kind === 'continent') return { label: 'Kontinent finden', text: `Wo ist ${continentQuestion(CONTINENTS[t.id])}?` };
  if (t.kind === 'ocean') {
    const o = OCEAN_Q[t.id];
    return { label: 'Ozean finden', text: `Wo ist ${o}?` };
  }
  const c = data.countries[t.id];
  if (q.mode === 'capitals') return { label: 'Hauptstadt', text: `In welchem Land liegt ${c.capital[0]}?` };
  if (q.mode === 'flags') return { label: 'Flagge', text: 'Zu welchem Land gehört diese Flagge?' };
  return { label: 'Land finden', text: whereIs(c) };
}

function renderQuestion(t) {
  const { label, text } = questionText(t);
  $('#q-label').textContent = label;
  $('#q-text').textContent = text;
  const flag = $('#q-flag');
  if (state.quiz.mode === 'flags') {
    flag.innerHTML = flagImg(data.countries[t.id]);
    flag.classList.remove('hidden');
  } else flag.classList.add('hidden');
  const qb = $('#question');
  qb.classList.remove('bump');
  void qb.offsetWidth;
  qb.classList.add('bump');
}

function speakQuestion(force = false) {
  const q = state.quiz;
  if (!q || !q.current) return;
  const { text } = questionText(q.current);
  const clean = text.replace(/\(.*?\)/g, '').replace(/\s+\?/, '?');
  if (force) {
    const was = speech.on;
    speech.on = true;
    speech.say(clean);
    speech.on = was;
  } else speech.say(clean);
}

function updateStats() {
  const q = state.quiz;
  $('#st-progress').textContent = `${Math.min(q.index + 1, q.targets.length)}/${q.targets.length}`;
  $('#st-score').textContent = `⭐ ${q.score}`;
  const h = q.level.tries;
  $('#st-hearts').textContent = '❤️'.repeat(q.triesLeft) + '🤍'.repeat(Math.max(0, h - q.triesLeft));
}

function targetLonLat(t) {
  if (t.kind === 'ocean') return OCEANS[t.id].label;
  if (t.kind === 'continent') {
    const b = CONTINENTS[t.id].bbox;
    return [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];
  }
  return map.centroid(t.id);
}

function targetName(t) {
  if (t.kind === 'continent') return CONTINENTS[t.id].name;
  if (t.kind === 'ocean') return OCEANS[t.id].name;
  return data.countries[t.id].name;
}

// ---------- Antippen ----------
function onCountry(id, ll) {
  sound.unlock();
  if (state.mode === 'explore') {
    sound.tap();
    map.ring(ll);
    exploreSelect(id);
    return;
  }
  const q = state.quiz;
  if (!q || q.resolved) return;
  map.ring(ll);
  const t = q.current;
  const c = data.countries[id];
  let ok = false;
  if (t.kind === 'country') ok = id === t.id;
  else if (t.kind === 'continent') ok = continentAt(c, ll) === t.id;
  else ok = false;
  if (ok) return answerRight(id);
  let what;
  if (t.kind === 'ocean') what = `Das ist Land: ${c.name}.`;
  else if (t.kind === 'continent') what = `Das ist ${CONTINENTS[continentAt(c, ll)].name}.`;
  else what = `Das ist ${c.name}.`;
  answerWrong(id, ll, what);
}

function onOcean(ll) {
  sound.unlock();
  const ocean = oceanAt(ll[0], ll[1]);
  if (state.mode === 'explore') {
    sound.water();
    map.ring(ll, '#bff');
    map.clearLabels();
    map.clearMarks();
    hideCard();
    const o = OCEANS[ocean];
    map.label(o.name, o.label, { cls: 'ocean', size: 20 });
    toast(`${o.emoji} ${o.name}`, '', 2400);
    speech.say(o.name);
    return;
  }
  const q = state.quiz;
  if (!q || q.resolved) return;
  map.ring(ll, '#bff');
  const t = q.current;
  if (t.kind === 'ocean') {
    if (ocean === t.id) return answerRight(null, ll);
    return answerWrong(null, ll, `Das ist ${OCEAN_Q[ocean]}.`.replace(/^Das ist (der|das)/, (m, a) => `Das ist ${a}`));
  }
  sound.water();
  toast('Das ist Wasser 🌊 – tippe auf Land!', '', 1800);
}

function answerRight(id, ll) {
  const q = state.quiz;
  q.resolved = true;
  clearInterval(q.timer);
  const t = q.current;
  const base = [100, 60, 30][Math.min(q.misses, 2)];
  let bonus = 0;
  if (q.level.time) bonus = Math.round(50 * Math.max(0, 1 - (performance.now() - q.start) / (q.level.time * 1000)));
  const pts = base + bonus;
  q.score += pts;
  q.results.push({ t, ok: true });
  sound.correct();
  const praise = PRAISE[(Math.random() * PRAISE.length) | 0];
  toast(`${praise} +${pts}`, 'good', 1600);
  highlightTarget(t, 'correct', ll);
  if (t.kind === 'country') q.done.add(t.id);
  updateStats();
  setTimeout(() => showAnswerCard(t, true, `Richtig! +${pts} Punkte`), 750);
}

function answerWrong(id, ll, what) {
  const q = state.quiz;
  q.misses++;
  q.triesLeft--;
  sound.wrong();
  if (id) map.mark(id, 'wrong', 900);
  updateStats();
  if (q.triesLeft <= 0) {
    toast(`${what}`, 'bad', 1800);
    return setTimeout(reveal, 500);
  }
  const target = targetLonLat(q.current);
  let tip = '';
  if (q.level.id === 'hard') {
    tip = `${Math.round(d3.geoDistance(ll, target) * 6371).toLocaleString('de-CH')} km daneben`;
  } else if (q.current.kind !== 'continent' || q.level.id === 'easy') tip = direction(ll, target);
  const lead = SOFT_MISS[(Math.random() * SOFT_MISS.length) | 0];
  toast(`${lead} ${what} ${tip}`, 'bad', 2600);
  speech.say(`${what} ${tip.replace(/[^\p{L}\p{N}\s.]/gu, '')}`);
  if (q.misses >= q.level.hintAfter) giveHint();
}

function giveHint() {
  const t = state.quiz.current;
  if (t.kind === 'country') {
    map.mark(t.id, 'hint');
    // auf Leicht: näher heranzoomen, damit kleine Länder sichtbar werden
    map.zoomToCountry(t.id, 900, { maxK: 4, minSpan: 40 });
  } else if (t.kind === 'continent') {
    map.markMany(Object.keys(data.countries).filter((id) => data.countries[id].continent === t.id), 'hint', t.id);
  }
}

function reveal() {
  const q = state.quiz;
  if (q.resolved) return;
  q.resolved = true;
  clearInterval(q.timer);
  q.results.push({ t: q.current, ok: false });
  sound.reveal();
  highlightTarget(q.current, 'reveal');
  updateStats();
  setTimeout(() => showAnswerCard(q.current, false, `Das war ${targetName(q.current)}.`), 900);
}

function highlightTarget(t, cls, ll) {
  if (t.kind === 'country') {
    map.mark(t.id, cls);
    map.labelCountry(t.id, data.countries[t.id].name);
  } else if (t.kind === 'continent') {
    map.markMany(Object.keys(data.countries).filter((id) => data.countries[id].continent === t.id), cls, t.id);
    map.label(CONTINENTS[t.id].name, targetLonLat(t), { size: 26 });
  } else {
    const o = OCEANS[t.id];
    map.label(o.name, o.label, { cls: 'ocean', size: 24 });
    if (ll) map.ring(ll, '#3fbf86');
  }
}

function showAnswerCard(t, ok, text) {
  const q = state.quiz;
  if (!q || q.current !== t) return;
  const actions = [{ label: q.index + 1 >= q.targets.length ? '🏁 Ergebnis' : 'Weiter ▶', primary: true, fn: () => { sound.click(); nextQuestion(); } }];
  if (t.kind === 'country') {
    const c = data.countries[t.id];
    setPadding(true);
    map.zoomToCountry(t.id, 900, { maxK: 12, minSpan: 14 });
    showCard(c, { countries: data.countries, homeId: settings.home, result: { ok, text }, actions });
    if (!ok) speech.say(`Das war ${c.name}.`);
  } else {
    showSimpleCard(t, ok, text, actions);
    if (!ok) speech.say(text);
  }
}

function showSimpleCard(t, ok, text, actions) {
  const isC = t.kind === 'continent';
  const info = isC ? CONTINENTS[t.id] : OCEANS[t.id];
  const facts = (isC ? CONTINENT_FACTS : OCEAN_FACTS)[t.id];
  let extra = '';
  if (isC) {
    const list = Object.values(data.countries).filter((c) => c.continent === t.id && c.quiz);
    if (list.length) {
      const big = list.reduce((a, b) => (b.area > a.area ? b : a));
      const pop = list.reduce((a, b) => ((b.population || 0) > (a.population || 0) ? b : a));
      extra = `<div class="fact"><div class="fi">🗺️</div><div><div class="fl">Länder</div><div class="fv">${list.length}</div></div></div>
        <div class="fact"><div class="fi">📏</div><div><div class="fl">Größtes Land</div><div class="fv">${big.name}</div></div></div>
        <div class="fact"><div class="fi">👨‍👩‍👧</div><div><div class="fl">Meiste Einwohner</div><div class="fv">${pop.name}</div></div></div>`;
    }
  }
  const color = isC ? (t.id === 'AN' ? '#6aa8d8' : info.color) : '#2f80d1';
  $('#card-body').innerHTML = `
    <div class="card-head" style="background:linear-gradient(135deg, ${color}, ${d3.color(color).darker(0.6)})">
      <div style="font-size:52px;line-height:1">${info.emoji}</div>
      <div><div class="cname">${info.name}</div><span class="cbadge">${isC ? 'Kontinent' : 'Ozean'}</span></div>
    </div>
    <div class="card-result ${ok ? 'good' : 'bad'}">${text}</div>
    <div class="facts">${extra}${facts.map((f) => `<div class="fact"><div class="fi">💡</div><div><div class="fv" style="font-size:17px">${f}</div></div></div>`).join('')}</div>`;
  const act = $('#card-actions');
  act.innerHTML = '';
  for (const a of actions) {
    const b = document.createElement('button');
    b.className = 'btn' + (a.primary ? ' primary' : '');
    b.textContent = a.label;
    b.onclick = a.fn;
    act.appendChild(b);
  }
  $('#card').classList.remove('hidden');
  document.body.classList.add('card-open');
}

function finishQuiz() {
  const q = state.quiz;
  clearInterval(q.timer);
  $('#hud').classList.add('hidden');
  $('#zoom-ctrl').classList.add('hidden');
  hideCard();
  const max = q.targets.length * (100 + (q.level.time ? 50 : 0));
  const ratio = q.score / max;
  const stars = ratio >= (q.level.time ? 0.72 : 0.85) ? 3 : ratio >= 0.55 ? 2 : ratio >= 0.25 ? 1 : 0;
  const key = `${q.mode}|${q.region}|${q.level.id}`;
  const isRecord = q.score > (records[key] || 0);
  if (isRecord) { records[key] = q.score; save(); }

  $('#res-title').textContent = ['Weiter üben! 💪', 'Gut gemacht! 👍', 'Super gemacht! 🎉', 'Fantastisch! 🏆'][stars];
  $('#res-score').textContent = `${q.score} Punkte · ${q.results.filter((r) => r.ok).length} von ${q.targets.length} richtig`;
  $('#res-record').classList.toggle('hidden', !isRecord || q.score === 0);
  $('#res-list').innerHTML = q.results.map((r) => `<span class="${r.ok ? 'ok' : 'no'}">${r.ok ? '✓' : '✗'} ${targetName(r.t)}</span>`).join('');
  const st = $('#res-stars').children;
  for (const s of st) s.className = '';
  showScreen('screen-result');
  sound.fanfare(stars);
  [...st].forEach((s, i) => {
    setTimeout(() => {
      s.className = 'show' + (i < stars ? ' on' : '');
      if (i < stars) sound.star(i);
    }, 500 + i * 350);
  });
  if (stars >= 2) setTimeout(() => confetti(stars === 3 ? 220 : 120), 600);
  speech.say(`${$('#res-title').textContent.replace(/[^\p{L}\s!]/gu, '')} Du hast ${q.score} Punkte.`);
}
