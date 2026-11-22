// Automatischer Test: spielt jede Spielart einmal durch (braucht Playwright + laufenden Server).
// Aufruf: npm start  (in einem zweiten Fenster)  und dann  npm test
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL = process.env.URL || 'http://localhost:8080/';
const shots = process.env.SHOTS || '';
const b = await chromium.launch();
let failed = 0;

async function clickTarget(p, wrongFirst) {
  return p.evaluate((wrongFirst) => {
    const g = window.__weltentdecker;
    const t = g.state.quiz.current;
    const fire = (el, x, y) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
    const svg = document.querySelector('#map');
    const centerOf = (el) => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; };
    if (wrongFirst) {
      const other = [...document.querySelectorAll('.country')].find((e) => e.dataset.id !== t.id && e.dataset.id !== 'RUS' && !e.classList.contains('dim'));
      fire(other, ...centerOf(other));
      return 'wrong';
    }
    if (t.kind === 'ocean') {
      const [lon, lat] = { PAC: [-150, 5], ATL: [-35, 25], IND: [78, -20], ARC: [0, 84], SOU: [60, -62] }[t.id];
      const [x, y] = g.map.projection([lon, lat]);
      const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
      const s = pt.matrixTransform(g.map.g.node().getScreenCTM());
      fire(svg, s.x, s.y);
      return t.id;
    }
    let id = t.id;
    if (t.kind === 'continent') id = Object.values(g.state.quiz && window.__weltentdecker.map.data.countries).find((c) => c.continent === t.id && c.id !== 'RUS' && c.id !== 'FRA' && document.querySelector(`.country[data-id="${c.id}"]`)).id;
    const el = document.querySelector(`.country[data-id="${id}"]`);
    const ll = g.map.centroid(id);
    const [x, y] = g.map.projection(ll);
    const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
    const s = pt.matrixTransform(g.map.g.node().getScreenCTM());
    fire(el, s.x, s.y);
    return id;
  }, wrongFirst);
}

for (const vp of [{ width: 1280, height: 800, name: 'desktop' }, { width: 390, height: 844, name: 'phone' }]) {
  for (const level of ['easy', 'medium', 'hard']) {
    for (const mode of ['continents', 'countries', 'capitals', 'flags']) {
      const p = await b.newPage({ viewport: vp });
      const errs = [];
      p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(URL);
      await p.waitForSelector('.level');
      await p.click(`.level:nth-child(${{ easy: 1, medium: 2, hard: 3 }[level]})`);
      const idx = { continents: 2, countries: 3, capitals: 4, flags: 5 }[mode];
      await p.click(`.mode:nth-child(${idx})`);
      if (mode !== 'continents') await p.click('.cont:last-child'); // ganze Welt
      await p.waitForTimeout(300);
      let n = 0;
      while (await p.isVisible('#hud')) {
        await clickTarget(p, n === 1 && level !== 'hard');
        if (n === 1 && level !== 'hard') { await p.waitForTimeout(100); await clickTarget(p, false); }
        await p.waitForSelector('#card-actions .btn.primary', { timeout: 4000 });
        if (shots && n === 1) await p.screenshot({ path: `${shots}/${vp.name}-${level}-${mode}-card.png` });
        await p.click('#card-actions .btn.primary');
        n++;
        if (n > 20) break;
      }
      await p.waitForSelector('#screen-result:not(.hidden)');
      await p.waitForTimeout(1500);
      const score = await p.textContent('#res-score');
      if (shots && level === 'easy') await p.screenshot({ path: `${shots}/${vp.name}-${mode}-result.png` });
      const ok = errs.length === 0 && n > 0;
      if (!ok) failed++;
      console.log(`${ok ? '✓' : '✗'} ${vp.name} ${level} ${mode}: ${n} Fragen, ${score}${errs.length ? ' FEHLER: ' + errs.join(' | ') : ''}`);
      await p.close();
    }
  }
}
await b.close();
process.exit(failed ? 1 : 0);
