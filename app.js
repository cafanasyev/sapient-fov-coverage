/* Pickup-mounted rotary antenna — field_of_view vs coverage.
   Vanilla port of the original React/dc-runtime component: same math,
   same SVG output, same slider behaviour. No dependencies. */
(() => {
  'use strict';

  const DEFAULTS = {
    azimuth: 69, elevation: 10, fovH: 30, fovV: 30, rangeKm: 15,
    tiltLimit: 80, coverageRange: 15, panLimit: 180, coverageAzimuth: 69,
    coverageElevation: 0
  };
  const state = { ...DEFAULTS };

  const D = Math.PI / 180;
  const f = (n) => n.toFixed(2);
  const norm = (a) => ((a % 360) + 360) % 360;
  const signed = (d) => { const x = norm(d); return x > 180 ? x - 360 : x; };
  const clampAz = (A, center, halfPan) =>
    norm(center + Math.max(-halfPan, Math.min(halfPan, signed(A - center))));
  // elevation is a linear (non-wrapping) range, so the tilt sweep is a simple
  // clamp of the beam to the coverage centre ± tilt.
  const clampEl = (e, center, halfTilt) =>
    Math.max(center - halfTilt, Math.min(center + halfTilt, e));

  // Build an SVG element string. camelCase attribute names become kebab-case
  // (strokeWidth -> stroke-width); `key` is dropped. Mirrors React.createElement.
  function el(tag, attrs, inner) {
    let s = '<' + tag;
    for (const k in attrs) {
      if (k === 'key' || attrs[k] == null) continue;
      const name = k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
      s += ' ' + name + '="' + attrs[k] + '"';
    }
    s += '>';
    if (inner != null) s += Array.isArray(inner) ? inner.join('') : inner;
    return s + '</' + tag + '>';
  }

  const handlers = {
    setAzimuth: (v) => { state.azimuth = norm(state.coverageAzimuth + v); },
    setElevation: (v) => { state.elevation = clampEl(v, state.coverageElevation, state.tiltLimit); },
    setFovH: (v) => { state.fovH = v; },
    setFovV: (v) => { state.fovV = v; },
    setRangeKm: (v) => { state.rangeKm = Math.min(state.coverageRange, v / 1000); },
    setTiltLimit: (v) => { state.tiltLimit = v; state.elevation = clampEl(state.elevation, state.coverageElevation, v); },
    setCoverageRange: (v) => { const km = v / 1000; state.coverageRange = km; state.rangeKm = Math.min(km, state.rangeKm); },
    setPanLimit: (v) => { state.panLimit = v; state.azimuth = clampAz(state.azimuth, state.coverageAzimuth, v); },
    setCoverageAzimuth: (v) => { state.coverageAzimuth = v; state.azimuth = clampAz(state.azimuth, v, state.panLimit); },
    setCoverageElevation: (v) => { state.coverageElevation = v; state.elevation = clampEl(state.elevation, v, state.tiltLimit); },
    // coverage extents are driven by the mechanism: extent = 2 × limit + fov, so
    // dragging an extent solves back for the pan/tilt limit (rounded, clamped to
    // the mechanism's range) and re-applies the beam clamp.
    setHExt: (v) => { state.panLimit = Math.max(0, Math.min(180, Math.round((v - state.fovH) / 2))); state.azimuth = clampAz(state.azimuth, state.coverageAzimuth, state.panLimit); },
    setVExt: (v) => { state.tiltLimit = Math.max(10, Math.min(90, Math.round((v - state.fovV) / 2))); state.elevation = clampEl(state.elevation, state.coverageElevation, state.tiltLimit); }
  };

  function compute() {
    const az = state.azimuth, elv = state.elevation, fovH = state.fovH, fovV = state.fovV,
          rangeKm = state.rangeKm, tilt = state.tiltLimit, cov = state.coverageRange,
          pan = state.panLimit, covAz = state.coverageAzimuth, covEl = state.coverageElevation;

    const amber = '#C8761C', amberFill = 'rgba(224,138,43,0.22)',
          slate = '#9AA3B0', slateFill = 'rgba(140,150,165,0.13)',
          ink = '#5B6472', mono = "'IBM Plex Mono', monospace";

    const maxKm = 40;
    const scaleFov = Math.sqrt(rangeKm / maxKm);
    const scaleCov = Math.sqrt(cov / maxKm);

    // ---------- PLAN (azimuth, top-down) ----------
    const cx = 240, cy = 240, RPfov = 200 * scaleFov, RPcov = 200 * scaleCov;
    const pP = (a, r) => [cx + r * Math.sin(a * D), cy - r * Math.cos(a * D)];
    const w1 = pP(az - fovH / 2, RPfov), w2 = pP(az + fovH / 2, RPfov);
    const bs = pP(az, RPfov);
    const largeH = fovH > 180 ? 1 : 0;

    const arcR = 46;
    const n0 = [cx, cy - arcR];
    const an = [cx + arcR * Math.sin(az * D), cy - arcR * Math.cos(az * D)];
    const azTxt = [cx + (arcR + 15) * Math.sin(az / 2 * D), cy - (arcR + 15) * Math.cos(az / 2 * D)];
    const fovTxt = [cx + RPfov * 0.6 * Math.sin(az * D), cy - RPfov * 0.6 * Math.cos(az * D)];

    const hExtRaw = 2 * pan + fovH;
    const fullRot = hExtRaw >= 360;
    // coverage.horizontal_extent is the reported swath and may exceed 360°
    // (panning ±pan overlaps itself); keep the raw value, only the drawing wraps.
    const hExt = hExtRaw;
    const covHalf = fullRot ? 180 : (pan + fovH / 2);

    const refRings = [
      el('circle', { key: 'rr-mid', cx, cy, r: f(RPcov * 2 / 3), fill: 'none', stroke: '#E4E0D6', strokeWidth: 1 }),
      el('circle', { key: 'rr-in', cx, cy, r: f(RPcov / 3), fill: 'none', stroke: '#E4E0D6', strokeWidth: 1 })
    ];

    let coverageArea, covExtras = [];
    if (fullRot) {
      coverageArea = el('circle', { key: 'cov-area', cx, cy, r: f(RPcov), fill: slateFill, stroke: slate, strokeWidth: 1.2, strokeDasharray: '6 4' });
    } else {
      const cp1 = pP(covAz - covHalf, RPcov), cp2 = pP(covAz + covHalf, RPcov);
      const largeC = (2 * covHalf) > 180 ? 1 : 0;
      coverageArea = el('path', { key: 'cov-area', d: `M${cx},${cy} L${f(cp1[0])},${f(cp1[1])} A${RPcov},${RPcov} 0 ${largeC} 1 ${f(cp2[0])},${f(cp2[1])} Z`, fill: slateFill, stroke: slate, strokeWidth: 1.2, strokeDasharray: '6 4' });
    }
    // pan limits are only meaningful when the head can't rotate fully (pan < 180).
    // Draw them even when the beam coverage wraps to a full circle (fullRot).
    if (pan < 180) {
      const cl = pP(covAz, RPcov * 0.9);
      const pu = pP(covAz + pan, RPcov), pd = pP(covAz - pan, RPcov);
      covExtras = [
        el('line', { key: 'cen', x1: cx, y1: cy, x2: f(cl[0]), y2: f(cl[1]), stroke: slate, strokeWidth: 1, strokeDasharray: '2 4' }),
        el('line', { key: 'pu', x1: cx, y1: cy, x2: f(pu[0]), y2: f(pu[1]), stroke: ink, strokeWidth: 1, strokeDasharray: '3 3' }),
        el('line', { key: 'pd', x1: cx, y1: cy, x2: f(pd[0]), y2: f(pd[1]), stroke: ink, strokeWidth: 1, strokeDasharray: '3 3' }),
        el('text', { key: 'cenL', x: f(cl[0]), y: f(cl[1] - 5), fontFamily: mono, fontSize: 9.5, fill: '#6B7280', textAnchor: 'middle' }, 'home ' + covAz + '°')
      ];
    }

    const ringLbls = [
      el('text', { key: 'rl-out', x: f(cx + RPcov), y: 236, fontFamily: mono, fontSize: 10, fill: '#8A7A5E', textAnchor: 'end' }, Math.round(cov * 1000).toLocaleString() + ' m')
    ];

    const planDynamic = [
      coverageArea,
      ...refRings,
      ...covExtras,
      el('path', { key: 'wedge', d: `M${cx},${cy} L${f(w1[0])},${f(w1[1])} A${RPfov},${RPfov} 0 ${largeH} 1 ${f(w2[0])},${f(w2[1])} Z`, fill: amberFill, stroke: amber, strokeWidth: 1.5 }),
      el('line', { key: 'bore', x1: cx, y1: cy, x2: f(bs[0]), y2: f(bs[1]), stroke: amber, strokeWidth: 1.5, strokeDasharray: '5 4' }),
      el('path', { key: 'azarc', d: `M${n0[0]},${f(n0[1])} A${arcR},${arcR} 0 ${az > 180 ? 1 : 0} 1 ${f(an[0])},${f(an[1])}`, fill: 'none', stroke: ink, strokeWidth: 1 }),
      ...ringLbls,
      el('text', { key: 'aztxt', x: f(azTxt[0]), y: f(azTxt[1]), fontFamily: mono, fontSize: 11, fill: ink, textAnchor: 'middle' }, az + '°'),
      el('text', { key: 'fovtxt', x: f(fovTxt[0]), y: f(fovTxt[1]), fontFamily: mono, fontSize: 10.5, fill: amber, textAnchor: 'middle' }, fovH + '°')
    ].join('');

    // ---------- ELEVATION (tilt, side) ----------
    const px = 240, py = 240, REfov = 200 * scaleFov, REcov = 200 * scaleCov;
    const pE = (e, r) => [px + r * Math.cos(e * D), py - r * Math.sin(e * D)];
    // the whole tilt envelope pivots around the coverage centre elevation (covEl)
    const edgeUp = covEl + tilt + fovV / 2, edgeDn = covEl - tilt - fovV / 2;
    const cUp = pE(edgeUp, REcov), cDn = pE(edgeDn, REcov);
    const luP = pE(covEl + tilt, REcov), ldP = pE(covEl - tilt, REcov);
    const homeE = pE(covEl, REcov * 0.9);
    const b1 = pE(elv + fovV / 2, REfov), b2 = pE(elv - fovV / 2, REfov);
    const bsE = pE(elv, REfov);

    const eArcR = 40;
    const z0 = [px + eArcR, py];
    const ze = [px + eArcR * Math.cos(elv * D), py - eArcR * Math.sin(elv * D)];
    const eTxt = [px + (eArcR + 16) * Math.cos(elv / 2 * D), py - (eArcR + 16) * Math.sin(elv / 2 * D)];
    const beamTxt = [px + REfov * 0.58 * Math.cos(elv * D), py - REfov * 0.58 * Math.sin(elv * D)];
    const vExt = 2 * tilt + fovV;
    const hzEnd = px + REcov;
    const bTip = pE(elv, REfov);
    // at covEl≈0 the home ray sits on the horizon line, so its label would
    // collide with "horizon 0°" — only show it when the centre is off-horizon.
    const showHome = Math.abs(covEl) >= 1;
    const homeEls = showHome ? [
      el('line', { key: 'homeE', x1: px, y1: py, x2: f(homeE[0]), y2: f(homeE[1]), stroke: slate, strokeWidth: 1, strokeDasharray: '2 4' }),
      el('text', { key: 'homeEl', x: f(homeE[0] + 6), y: f(homeE[1] + (covEl >= 0 ? -4 : 12)), fontFamily: mono, fontSize: 9.5, fill: '#6B7280' }, 'home ' + covEl + '°')
    ] : [];

    const elevDynamic = [
      el('path', { key: 'cov', d: `M${px},${py} L${f(cUp[0])},${f(cUp[1])} A${REcov},${REcov} 0 ${(vExt > 180) ? 1 : 0} 1 ${f(cDn[0])},${f(cDn[1])} Z`, fill: slateFill, stroke: slate, strokeWidth: 1.2, strokeDasharray: '6 4' }),
      el('line', { key: 'lu', x1: px, y1: py, x2: f(luP[0]), y2: f(luP[1]), stroke: ink, strokeWidth: 1, strokeDasharray: '3 3' }),
      el('line', { key: 'ld', x1: px, y1: py, x2: f(ldP[0]), y2: f(ldP[1]), stroke: ink, strokeWidth: 1, strokeDasharray: '3 3' }),
      el('text', { key: 'lut', x: f(luP[0] + 6), y: f(luP[1] - 2), fontFamily: mono, fontSize: 10, fill: ink }, '+' + tilt + '° → ' + (covEl + tilt) + '°'),
      el('text', { key: 'ldt', x: f(ldP[0] + 6), y: f(ldP[1] + 10), fontFamily: mono, fontSize: 10, fill: ink }, '−' + tilt + '° → ' + (covEl - tilt) + '°'),
      ...homeEls,
      el('text', { key: 'vext', x: f(cUp[0] - 6), y: f(cUp[1] - 4), fontFamily: mono, fontSize: 11, fill: '#6B7280', textAnchor: 'end' }, 'v_extent ' + vExt + '° (' + edgeDn + '°…' + edgeUp + '°)'),
      el('path', { key: 'beam', d: `M${px},${py} L${f(b1[0])},${f(b1[1])} A${REfov},${REfov} 0 ${fovV > 180 ? 1 : 0} 1 ${f(b2[0])},${f(b2[1])} Z`, fill: amberFill, stroke: amber, strokeWidth: 1.5 }),
      el('line', { key: 'bore', x1: px, y1: py, x2: f(bsE[0]), y2: f(bsE[1]), stroke: amber, strokeWidth: 1.5, strokeDasharray: '5 4' }),
      el('path', { key: 'earc', d: `M${f(z0[0])},${f(z0[1])} A${eArcR},${eArcR} 0 0 ${elv >= 0 ? 0 : 1} ${f(ze[0])},${f(ze[1])}`, fill: 'none', stroke: ink, strokeWidth: 1 }),
      el('text', { key: 'etxt', x: f(eTxt[0]), y: f(eTxt[1]), fontFamily: mono, fontSize: 11, fill: ink }, elv + '°'),
      el('text', { key: 'btxt', x: f(beamTxt[0]), y: f(beamTxt[1]), fontFamily: mono, fontSize: 10.5, fill: amber }, fovV + '°'),
      el('line', { key: 'hz', x1: px, y1: py, x2: f(hzEnd), y2: py, stroke: '#5B6472', strokeWidth: 1, strokeDasharray: '4 4' }),
      el('text', { key: 'hz0', x: f(hzEnd + 7), y: py + 14, fontFamily: mono, fontSize: 10, fill: '#5B6472' }, 'horizon 0°'),
      el('line', { key: 'cvt', x1: f(hzEnd), y1: py - 6, x2: f(hzEnd), y2: py + 6, stroke: slate, strokeWidth: 1.4 }),
      el('text', { key: 'cvr', x: f(hzEnd + 7), y: py - 4, fontFamily: mono, fontSize: 10, fill: '#6B7280' }, (cov * 1000).toLocaleString() + ' m'),
      el('text', { key: 'fvr', x: f(bTip[0] - 5), y: f(bTip[1] - 5), fontFamily: mono, fontSize: 10, fill: amber, textAnchor: 'end' }, (rangeKm * 1000).toLocaleString() + ' m')
    ].join('');

    return {
      planDynamic, elevDynamic,
      // text read-outs
      azDeg: az + '°', elDeg: elv + '°', fovHDeg: fovH + '°', fovVDeg: fovV + '°', tiltDeg: tilt + '°',
      vExtDeg: vExt + '°',
      rangeKmLbl: rangeKm + ' km',
      rangeM: (rangeKm * 1000).toLocaleString() + ' m',
      covRangeKmLbl: cov + ' km',
      covRangeM: (cov * 1000).toLocaleString() + ' m',
      panDeg: pan + '°', covAzDeg: covAz + '°', covElDeg: covEl + '°',
      hExtDeg: hExt + '°',
      hExtFormula: '= 2 × pan ' + pan + '° + fov H ' + fovH + '°',
      vExtFormula: '= 2 × tilt ' + tilt + '° + fov V ' + fovV + '° @ el ' + covEl + '°',
      // slider bounds + values
      panNeg: -pan, panPos: pan, azOffset: signed(az - covAz),
      elMin: covEl - tilt, elMax: covEl + tilt, elevation: elv,
      fovH, fovV, rangeKm, fovRangeMax: cov,
      coverageAzimuth: covAz, coverageElevation: covEl, panLimit: pan, tiltLimit: tilt, coverageRange: cov,
      hExtNum: hExt, vExtNum: vExt,
      rangeMNum: rangeKm * 1000, covRangeMNum: cov * 1000, fovRangeMaxM: cov * 1000
    };
  }

  function render() {
    const v = compute();
    document.querySelectorAll('[data-text]').forEach((n) => { n.textContent = v[n.dataset.text]; });
    document.querySelectorAll('[data-svg]').forEach((n) => { n.innerHTML = v[n.dataset.svg]; });
    document.querySelectorAll('input[data-value]').forEach((inp) => {
      if (inp.dataset.min != null) inp.min = v[inp.dataset.min];
      if (inp.dataset.max != null) inp.max = v[inp.dataset.max];
      inp.value = v[inp.dataset.value];
    });
    if (window.__afterRender) window.__afterRender(state, v); // optional live-view hook (mockups only)
  }

  // Pull initial values from status_report.json (served alongside index.html).
  // Works over http/GitHub Pages; on file:// the browser blocks fetch, so we
  // silently keep the code defaults. pan/tilt limits are never in the report —
  // they stay code-driven (DEFAULTS.panLimit / DEFAULTS.tiltLimit).
  async function loadReport() {
    let j;
    try {
      const res = await fetch('status_report.json', { cache: 'no-store' });
      if (!res.ok) return;
      j = await res.json();
    } catch (_) { return; }

    const num = (x) => (typeof x === 'number' && isFinite(x)) ? x : undefined;
    const set = (k, x) => { const v = num(x); if (v !== undefined) state[k] = v; };
    const fov = j && j.field_of_view && j.field_of_view.range_bearing;
    const cov = j && j.coverage && j.coverage.range_bearing;

    if (fov) {
      set('azimuth', fov.azimuth);
      set('elevation', fov.elevation);
      set('fovH', fov.horizontal_extent);
      set('fovV', fov.vertical_extent);
      if (num(fov.range) !== undefined) state.rangeKm = fov.range / 1000; // report range is metres
    }
    if (cov) {
      set('coverageAzimuth', cov.azimuth);
      set('coverageElevation', cov.elevation);
      if (num(cov.range) !== undefined) state.coverageRange = cov.range / 1000;
    }

    // re-apply the model's invariants after loading external values
    state.coverageRange = Math.min(40, state.coverageRange);
    state.rangeKm = Math.min(state.coverageRange, state.rangeKm);
    state.elevation = clampEl(state.elevation, state.coverageElevation, state.tiltLimit);
    state.azimuth = clampAz(state.azimuth, state.coverageAzimuth, state.panLimit);
  }

  async function init() {
    await loadReport();
    document.querySelectorAll('input[data-on]').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        handlers[inp.dataset.on](Number(e.target.value));
        render();
      });
    });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
