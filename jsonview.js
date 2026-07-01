/* Live status_report.json view — shared by the mockup variants.
   Rebuilds the report object from the app state on every render and
   flashes any leaf whose value changed. Read-only; never writes a file. */
(() => {
  'use strict';

  const STATIC = {
    system: 'SYSTEM_OK', info: 'INFO_NEW', mode: 'Default',
    node_location: {
      x: 33.688839, y: 47.888777, z: 4.0,
      x_error: 3.0e-4, y_error: 0.005, z_error: 5.0e-5,
      coordinate_system: 'LOCATION_COORDINATE_SYSTEM_LAT_LNG_DEG_M',
      datum: 'LOCATION_DATUM_WGS84_E'
    }
  };

  const PATHS = {
    setAzimuth: 'field_of_view.range_bearing.azimuth',
    setElevation: 'field_of_view.range_bearing.elevation',
    setFovH: 'field_of_view.range_bearing.horizontal_extent',
    setFovV: 'field_of_view.range_bearing.vertical_extent',
    setRangeKm: 'field_of_view.range_bearing.range',
    setCoverageAzimuth: 'coverage.range_bearing.azimuth',
    setCoverageRange: 'coverage.range_bearing.range',
    setPanLimit: 'pan limit — not in report',
    setTiltLimit: 'tilt limit — not in report'
  };
  const VALUE_PATHS = {
    hExtNum: 'coverage.range_bearing.horizontal_extent',
    vExtNum: 'coverage.range_bearing.vertical_extent'
  };

  function buildReport(s, v) {
    return {
      system: STATIC.system, info: STATIC.info, mode: STATIC.mode,
      node_location: STATIC.node_location,
      field_of_view: { range_bearing: {
        elevation: s.elevation,
        azimuth: s.azimuth,
        range: Math.round(s.rangeKm * 1000),
        horizontal_extent: s.fovH,
        vertical_extent: s.fovV,
        coordinate_system: 'RANGE_BEARING_COORDINATE_SYSTEM_DEGREES_M',
        datum: 'RANGE_BEARING_DATUM_TRUE'
      }},
      coverage: { range_bearing: {
        elevation: 0,
        azimuth: s.coverageAzimuth,
        range: Math.round(s.coverageRange * 1000),
        horizontal_extent: v.hExtNum,
        vertical_extent: v.vExtNum,
        coordinate_system: 'RANGE_BEARING_COORDINATE_SYSTEM_DEGREES_M',
        datum: 'RANGE_BEARING_DATUM_TRUE'
      }}
    };
  }

  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  function renderNode(node, path, indent) {
    const pad = '  '.repeat(indent);
    if (node && typeof node === 'object') {
      const keys = Object.keys(node);
      let out = '{\n';
      keys.forEach((k, i) => {
        const p = path ? path + '.' + k : k;
        const comma = i < keys.length - 1 ? ',' : '';
        out += pad + '  <span class="jv-key">"' + k + '"</span>: ' +
               renderNode(node[k], p, indent + 1) + comma + '\n';
      });
      return out + pad + '}';
    }
    const isStr = typeof node === 'string';
    const disp = isStr ? '"' + esc(node) + '"' : esc(node);
    return '<span class="jv-val ' + (isStr ? 'jv-str' : 'jv-num') +
           '" data-jpath="' + path + '">' + disp + '</span>';
  }

  const prev = {};
  function update(container, s, v) {
    if (!container) return;
    container.innerHTML = renderNode(buildReport(s, v), '', 0);
    container.querySelectorAll('.jv-val').forEach((el) => {
      const p = el.dataset.jpath, val = el.textContent;
      if (prev[p] !== undefined && prev[p] !== val) {
        el.classList.add('jv-flash');
        setTimeout(() => el.classList.remove('jv-flash'), 700);
      }
      prev[p] = val;
    });
  }

  function annotatePaths() {
    document.querySelectorAll('input[type=range]').forEach((inp) => {
      const path = PATHS[inp.dataset.on] || VALUE_PATHS[inp.dataset.value];
      if (!path) return;
      const tag = document.createElement('div');
      tag.className = 'jpath';
      tag.textContent = path;
      inp.parentNode.insertBefore(tag, inp);
    });
  }

  window.__jsonview = { update, annotatePaths };
})();
