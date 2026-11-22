// Interaktive Weltkarte (SVG + D3)
import { CONTINENTS, SPLITS } from './data.js';

const MARKER_MIN = 9; // Länder kleiner als so viele Pixel bekommen einen Antipp-Kreis

export class WorldMap {
  constructor(svgEl, data, handlers) {
    this.svg = d3.select(svgEl);
    this.data = data;
    this.h = handlers;
    this.k = 1;
    this.padding = { top: 90, right: 0, bottom: 0, left: 0 };
    this.byId = new Map(data.features.map((f) => [f.id, f]));
    this.main = new Map(data.features.map((f) => [f.id, mainPolygon(f)]));

    this.svg.selectAll('*').remove();
    const defs = this.svg.append('defs');
    const grad = defs.append('radialGradient').attr('id', 'sea-glow').attr('cx', '50%').attr('cy', '40%').attr('r', '70%');
    grad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(255,255,255,.18)');
    grad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(255,255,255,0)');

    this.g = this.svg.append('g').attr('class', 'world');
    this.gSphere = this.g.append('path').attr('class', 'sphere-outline');
    this.gGrat = this.g.append('path').attr('class', 'graticule');
    this.gWaves = this.g.append('g').attr('class', 'waves');
    this.gShadow = this.g.append('path').attr('class', 'land-shadow');
    this.gCountries = this.g.append('g');
    this.gSplit = this.g.append('g').style('pointer-events', 'none');
    this.gOutlines = this.g.append('g');
    this.gMarkers = this.g.append('g');
    this.gLabels = this.g.append('g');
    this.gFx = this.g.append('g');

    this.paths = this.gCountries
      .selectAll('path')
      .data(data.features, (d) => d.id)
      .join('path')
      .attr('class', 'country')
      .attr('data-id', (d) => d.id)
      .on('click', (ev, d) => this._countryClick(ev, d.id))
      .on('mouseenter', function () { this.classList.add('hover'); })
      .on('mouseleave', function () { this.classList.remove('hover'); });

    this.zoom = d3
      .zoom()
      .scaleExtent([1, 60])
      .clickDistance(8)
      .tapDistance(14)
      .on('zoom', (ev) => this._onZoom(ev.transform));
    this.svg.call(this.zoom).on('dblclick.zoom', null);
    this.svg.on('click', (ev) => {
      if (ev.target.closest && ev.target.closest('.country, .marker')) return;
      const [x, y] = d3.pointer(ev, this.g.node());
      const ll = this.projection.invert([x, y]);
      if (ll && this.h.onOcean) this.h.onOcean(ll, ev);
    });

    this.resize();
    window.addEventListener('resize', () => {
      clearTimeout(this._rt);
      this._rt = setTimeout(() => this.resize(true), 150);
    });
  }

  resize(keepView = false) {
    const el = this.svg.node();
    this.w = el.clientWidth || window.innerWidth;
    this.hgt = el.clientHeight || window.innerHeight;
    this.svg.attr('viewBox', `0 0 ${this.w} ${this.hgt}`);
    this.projection = d3.geoNaturalEarth1().fitExtent(
      [[10, Math.min(80, this.hgt * 0.12)], [this.w - 10, this.hgt - 10]],
      { type: 'Sphere' }
    );
    this.path = d3.geoPath(this.projection);
    this.gSphere.attr('d', this.path({ type: 'Sphere' }));
    this.gGrat.attr('d', this.path(d3.geoGraticule10()));
    this.gShadow.attr('d', this.path(this.data.landFeature)).attr('transform', 'translate(1.5,2.5)');
    this.paths.attr('d', (d) => this.path(d));
    this._drawSplits();
    this._drawWaves();
    this._buildMarkers();
    this.zoom.translateExtent([[-this.w, -this.hgt], [this.w * 2, this.hgt * 2]]);
    this.zoom.extent([[0, 0], [this.w, this.hgt]]);
    if (this.outlineIds) this.setOutlines(this.outlineIds);
    this._redrawLabels();
    if (keepView && this.lastView) this.lastView(0);
    else this._onZoom(d3.zoomTransform(this.svg.node()));
  }

  // Teil eines Landes in anderer Farbe (z. B. asiatisches Russland)
  _drawSplits() {
    const defs = this.svg.select('defs');
    defs.selectAll('clipPath.split').remove();
    this.gSplit.selectAll('*').remove();
    if (!this.splitFill) return;
    for (const sp of SPLITS) {
      const f = this.byId.get(sp.id);
      if (!f) continue;
      const polys = sp.boxes.map(([[x0, y0], [x1, y1]]) => {
        const ring = [];
        for (let y = y0; y <= y1; y += 2) ring.push([x0, y]);
        for (let x = x0; x <= x1; x += 2) ring.push([x, y1]);
        for (let y = y1; y >= y0; y -= 2) ring.push([x1, y]);
        for (let x = x1; x >= x0; x -= 2) ring.push([x, y0]);
        ring.push(ring[0]);
        return [ring];
      });
      const cid = 'clip-' + sp.id;
      defs.append('clipPath').attr('class', 'split').attr('id', cid)
        .append('path').attr('d', this.path({ type: 'MultiPolygon', coordinates: polys }));
      this.gSplit.append('path').attr('class', 'country split-' + sp.id)
        .attr('d', this.path(f)).attr('clip-path', `url(#${cid})`)
        .style('fill', this.splitFill(sp.continent, sp.id));
    }
  }

  setSplitFill(fn) {
    this.splitFill = fn;
    this._drawSplits();
  }

  _drawWaves() {
    // kleine Wellen als Dekoration im Meer
    const spots = [[-150, 20], [-130, -25], [-40, 35], [-25, -15], [70, -25], [95, -40], [-165, -45], [160, 25], [-60, -45], [10, -35], [175, -20]];
    this.gWaves.selectAll('path').data(spots).join('path').attr('d', ([lon, lat]) => {
      const p = this.projection([lon, lat]);
      const s = this.projection.scale() / 160;
      const x = p[0], y = p[1];
      return `M${x - 9 * s},${y} q${3 * s},${-4 * s} ${6 * s},0 t${6 * s},0 t${6 * s},0`;
    });
  }

  _buildMarkers() {
    const small = [];
    for (const f of this.data.features) {
      const b = this.path.bounds(this.main.get(f.id));
      const size = Math.max(b[1][0] - b[0][0], b[1][1] - b[0][1]);
      if (size < MARKER_MIN) {
        const c = this.projection(d3.geoCentroid(this.main.get(f.id)));
        const info = this.data.countries[f.id];
        if (c) small.push({ id: f.id, x: c[0], y: c[1], size, island: !info.borders.length });
      }
    }
    this.markers = this.gMarkers
      .selectAll('circle')
      .data(small, (d) => d.id)
      .join('circle')
      .attr('class', 'marker')
      .attr('data-id', (d) => d.id)
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y)
      .on('click', (ev, d) => this._countryClick(ev, d.id));
    this._updateMarkers();
  }

  _updateMarkers() {
    if (!this.markers) return;
    const k = this.k;
    this.markers
      .attr('r', 5.5 / k)
      .style('display', (d) => {
        if (this.markersOff || this.hiddenMarkers?.has(d.id)) return 'none';
        if (d.size * k > 8) return 'none'; // groß genug zum Antippen
        return d.island || k >= 2.5 ? null : 'none';
      });
  }

  _countryClick(ev, id) {
    ev.stopPropagation();
    const [x, y] = d3.pointer(ev, this.g.node());
    const ll = this.projection.invert([x, y]);
    this.h.onCountry && this.h.onCountry(id, ll, ev);
  }

  _onZoom(t) {
    this.k = t.k;
    this.g.attr('transform', t);
    this._updateMarkers();
    this.gLabels.selectAll('g.lbl').attr('transform', (d) => `translate(${d.x},${d.y}) scale(${1 / t.k})`);
    this.gFx.selectAll('g.fx').attr('transform', (d) => `translate(${d.x},${d.y}) scale(${1 / t.k})`);
  }

  // ---------- Darstellung ----------
  setFill(fn, dimFn = () => false) {
    this.fillFn = fn;
    this.paths.style('fill', (d) => fn(d.id)).classed('dim', (d) => dimFn(d.id));
    this.markers && this.markers.style('fill', (d) => fn(d.id)).classed('dim', (d) => dimFn(d.id));
  }

  setOutlines(ids) {
    this.outlineIds = ids;
    this.gOutlines
      .selectAll('path')
      .data(ids || [], (d) => d)
      .join('path')
      .attr('class', 'continent-outline')
      .attr('d', (id) => this.path(this.data.continentMesh[id]));
  }

  hideMarkers(set, all = false) {
    this.hiddenMarkers = set;
    this.markersOff = all;
    this._updateMarkers();
  }

  mark(id, cls, ms = 0) {
    const sel = this.paths.filter((d) => d.id === id);
    const msel = this.markers.filter((d) => d.id === id);
    sel.classed(cls, true).raise();
    this.gSplit.selectAll('.split-' + id).style('display', 'none');
    msel.classed(cls, true).raise();
    if (ms) setTimeout(() => { sel.classed(cls, false); msel.classed(cls, false); }, ms);
  }

  clearMarks() {
    for (const c of ['selected', 'correct', 'wrong', 'reveal', 'hint', 'correct-keep']) {
      this.paths.classed(c, false);
      this.markers.classed(c, false);
      this.gSplit.selectAll('path').classed(c, false);
    }
    this.gSplit.selectAll('path').style('display', null);
  }

  markMany(ids, cls, continent = null) {
    const s = new Set(ids);
    this.paths.classed(cls, (d) => s.has(d.id));
    this.markers.classed(cls, (d) => s.has(d.id));
    for (const sp of SPLITS) this.gSplit.selectAll('.split-' + sp.id).classed(cls, sp.continent === continent);
  }

  // Beschriftung bei einer geografischen Position
  label(text, lonlat, { cls = '', size = 18, id = null } = {}) {
    const p = this.projection(lonlat);
    if (!p) return;
    this.labels = this.labels || [];
    this.labels.push({ text, lonlat, cls, size, id });
    this._redrawLabels();
  }

  labelCountry(id, text) {
    const c = this.centroid(id);
    this.label(text, c, { id, size: 17 });
  }

  clearLabels() {
    this.labels = [];
    this._redrawLabels();
  }

  _redrawLabels() {
    const data = (this.labels || []).map((l) => {
      const p = this.projection(l.lonlat);
      return { ...l, x: p[0], y: p[1] };
    });
    const g = this.gLabels.selectAll('g.lbl').data(data).join((enter) => {
      const e = enter.append('g').attr('class', 'lbl');
      e.append('text');
      return e;
    });
    g.select('text')
      .attr('class', (d) => 'map-label ' + d.cls)
      .attr('font-size', (d) => d.size)
      .attr('dy', '0.35em')
      .text((d) => d.text);
    g.attr('transform', (d) => `translate(${d.x},${d.y}) scale(${1 / this.k})`);
  }

  // Kreis-Animation an der Antipp-Stelle
  ring(lonlat, color = '#fff') {
    const p = this.projection(lonlat);
    if (!p) return;
    const g = this.gFx.append('g').datum({ x: p[0], y: p[1] }).attr('class', 'fx')
      .attr('transform', `translate(${p[0]},${p[1]}) scale(${1 / this.k})`);
    g.append('circle').attr('class', 'tap-ring').attr('r', 4).style('stroke', color)
      .transition().duration(650).ease(d3.easeCubicOut).attr('r', 34).style('opacity', 0)
      .on('end', () => g.remove());
  }

  centroid(id) {
    const f = this.main.get(id);
    return f ? d3.geoCentroid(f) : [0, 0];
  }

  // ---------- Zoom ----------
  _fit(b, duration = 900, maxK = 12) {
    const p = this.padding;
    const aw = this.w - p.left - p.right - 24;
    const ah = this.hgt - p.top - p.bottom - 24;
    const dx = Math.max(b[1][0] - b[0][0], 1);
    const dy = Math.max(b[1][1] - b[0][1], 1);
    const k = Math.max(1, Math.min(maxK, 0.92 / Math.max(dx / aw, dy / ah)));
    const cx = (b[0][0] + b[1][0]) / 2;
    const cy = (b[0][1] + b[1][1]) / 2;
    const tx = p.left + 12 + aw / 2 - k * cx;
    const ty = p.top + 12 + ah / 2 - k * cy;
    const t = d3.zoomIdentity.translate(tx, ty).scale(k);
    const sel = duration ? this.svg.transition().duration(duration).ease(d3.easeCubicInOut) : this.svg;
    sel.call(this.zoom.transform, t);
  }

  zoomToBBox(bbox, duration) {
    this.lastView = (d) => this.zoomToBBox(bbox, d);
    this._fit(this._bboxBounds(bbox), duration);
  }

  zoomToContinent(id, duration) {
    this.zoomToBBox(CONTINENTS[id].bbox, duration);
  }

  zoomToWorld(duration = 900) {
    this.lastView = (d) => this.zoomToWorld(d);
    const sel = duration ? this.svg.transition().duration(duration).ease(d3.easeCubicInOut) : this.svg;
    sel.call(this.zoom.transform, d3.zoomIdentity);
  }

  // minSpan: kleinster sichtbarer Ausschnitt in Grad (für Kleinstaaten)
  zoomToCountry(id, duration = 900, { maxK = 40, minSpan = 8 } = {}) {
    const f = this.main.get(id);
    if (!f) return;
    this.lastView = (d) => this.zoomToCountry(id, d, { maxK, minSpan });
    minSpan = (this.projection.scale() * minSpan * Math.PI) / 180;
    let b = this.path.bounds(f);
    // sehr kleine Länder: etwas Umgebung zeigen
    const cx = (b[0][0] + b[1][0]) / 2, cy = (b[0][1] + b[1][1]) / 2;
    const half = Math.max(minSpan / 2, (b[1][0] - b[0][0]) / 2, (b[1][1] - b[0][1]) / 2) * 1.6;
    b = [[cx - half, cy - half], [cx + half, cy + half]];
    this._fit(b, duration, maxK);
  }

  zoomBy(f) {
    this.svg.transition().duration(300).call(this.zoom.scaleBy, f);
  }

  _bboxBounds([[x0, y0], [x1, y1]]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i <= 10; i++) {
      for (let j = 0; j <= 10; j++) {
        const p = this.projection([x0 + ((x1 - x0) * i) / 10, y0 + ((y1 - y0) * j) / 10]);
        if (!p) continue;
        minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
        minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
      }
    }
    return [[minX, minY], [maxX, maxY]];
  }
}

// Grösster Teil eines Landes (z. B. Festland statt Inseln)
function mainPolygon(f) {
  const g = f.geometry;
  if (!g || g.type !== 'MultiPolygon') return f;
  let best = null, bestA = -1;
  for (const coords of g.coordinates) {
    const p = { type: 'Polygon', coordinates: coords };
    const a = d3.geoArea(p);
    if (a > bestA) { bestA = a; best = p; }
  }
  return { type: 'Feature', id: f.id, geometry: best };
}

// Farbvarianten eines Kontinents, damit Nachbarländer unterscheidbar sind
export function shade(base, id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const c = d3.hsl(base);
  c.l = Math.max(0.35, Math.min(0.85, c.l + ((h % 7) - 3) * 0.045));
  c.s = Math.max(0.3, Math.min(1, c.s + (((h >> 3) % 5) - 2) * 0.06));
  return c.formatHex();
}
