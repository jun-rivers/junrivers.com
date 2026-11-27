// Which tab of the EXP.CONTROL sheet to show.
// The published CSV doesn't carry the tab's name, so set the period here
// whenever you point the chart at a different tab (they change together).
const SHEET = {
    gid: '1921314508',
    period: '2026Q4-2027Q1'
};
const myCsv = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQqySoKDQNoFqxTKAh43KPaAP_IpuYkA2zUzA3xCiWpXl3EWi2HnJaMMXZF3xsLeW7OuV05hoSRix9r/pub?gid="
    + SHEET.gid + "&single=true&output=csv";

// ---- Modes and the sheet columns each one reads ------------------------
// If a column is renamed in the sheet, change it here only.
const MODES = {
    budget: {
        label: 'Budget',
        size: 'b-size',                 // segment size
        pct: 'budgetPercentage',        // share of parent
        target: 'budget (K HKD)',       // plan
        targetLabel: 'approved',
        actual: 'actual (K HKD)',       // spent so far
        overColor: '#E4572E'            // over budget = warning
    },
    revenue: {
        label: 'Revenue',
        size: 'r-size',
        pct: 'revPercentage',
        target: 'revenueTarget (K HKD)',
        targetLabel: 'target',
        actual: 'revenueActual (K HKD)',
        overColor: '#E0B000'            // above target = celebrate
    }
};
const urlMode = new URLSearchParams(window.location.search).get('mode');
let mode = MODES[urlMode] ? urlMode : 'budget';
let root = null;          // d3 hierarchy, kept so it can be re-sized on mode change
let currentFocus = null;  // the segment currently zoomed into

// ---- Helpers -------------------------------------------------------------
// Sheet numbers may arrive as "10,000" or blank.
const toNumber = v => {
    const n = parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
    return isNaN(n) ? null : n;
};
const fmt = n => (n == null ? '-' : d3.format(',')(Math.round(n)));
const ownSize = d => (d[mode] && d[mode].size) || 0;
// d3 adds a parent's own value to its children's total, so a parent row that
// also has a size would leave a gap after its children. Count a row's own size
// only when nothing underneath it has a size (i.e. leaves, or "unbroken-down" rows).
const subtreeSize = (d, memo) => {
    if (memo.has(d)) { return memo.get(d); }
    const kids = (d.children || []).reduce((a, c) => a + subtreeSize(c, memo), 0);
    const v = kids > 0 ? kids : ownSize(d);
    memo.set(d, v);
    return v;
};
let sizeMemo = new Map();
const sizeOf = d => {
    const kids = (d.children || []).reduce((a, c) => a + subtreeSize(c, sizeMemo), 0);
    return kids > 0 ? 0 : ownSize(d);
};
const pctOf = d => d.data[mode].pct;
const targetOf = d => d.data[mode].target;
const actualOf = d => (d.agg ? d.agg[mode] : null);   // own actual, or children's sum
const ratioOf = d => {
    const t = targetOf(d), a = actualOf(d);
    return (t && t > 0 && a != null) ? a / t : null;
};
// ---- Profitability (independent of Budget/Revenue view) -------------------
// Uses actuals when they exist, otherwise the plan (approved budget / revenue target).
const finOf = d => {
    const ra = d.agg ? d.agg.revenue : null, ca = d.agg ? d.agg.budget : null;
    const useActual = ra != null || ca != null;
    const rev = useActual ? (ra || 0) : (d.data.revenue.target || 0);
    const cost = useActual ? (ca || 0) : (d.data.budget.target || 0);
    return { rev: rev, cost: cost, basis: useActual ? 'actual' : 'plan' };
};
// Operating margin = (revenue - cost) / revenue; cost cover = revenue / cost.
const marginOf = f => (f.rev > 0 ? (f.rev - f.cost) / f.rev : null);
// Margin is only shown when BOTH actual revenue and actual cost exist for the row
// (its own or summed from children). Plan figures never produce a margin.
const hasActualMargin = d => !!(d.agg && d.agg.revenue != null && d.agg.budget != null);
const coverOf = f => (f.cost > 0 ? f.rev / f.cost : null);
// cashflow+ is automatic, but only judged on actuals: when a row (or its children)
// has an actual on either side and actual revenue exceeds actual cost.
// With no actuals at all, the sheet's own status is shown unchanged.
const statusOf = d => {
    const f = finOf(d);
    if (f.basis === 'actual' && f.rev > 0 && f.rev > f.cost) { return 'cashflow+'; }
    return d.data.status;
};
const colorOf = d => colors[statusOf(d)] || '#ccc';

const depthOpacity = d => {
    const w = d.data.workcode;
    return w ? 1 - ((w.match(/-/g) || []).length) / 9 : 1;
};
const titleText = d => {
    const r = ratioOf(d);
    return d.data.name + ' | ' + (pctOf(d) || '-') + '% of ' + (d.data.parentcode || 'EXP.')
        + ' | ' + MODES[mode].label + ' actual / ' + MODES[mode].targetLabel + ': '
        + fmt(actualOf(d)) + ' / ' + fmt(targetOf(d)) + ' K HKD'
        + (r == null ? '' : ' (' + Math.round(r * 100) + '%)')
        + (function() { const m = hasActualMargin(d) ? marginOf(finOf(d)) : null; return m == null ? '' : ' | margin ' + (m >= 0 ? '+' : '') + Math.round(m * 100) + '%'; })();
};

// ---- Layout --------------------------------------------------------------
let width, height, maxRadius;
const measure = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    maxRadius = (Math.min(width, height) / 2) - 5;
};
measure();

const x = d3.scaleLinear()
    .range([0, 2 * Math.PI])
    .clamp(true);

const y = d3.scaleSqrt()
    .range([maxRadius * .1, maxRadius]);

const colors = {
    "idea": "#9E9EFE",
    "developing": "#F2ACA4",
    "operating": "#323232",
    "cashflow+": "#002FA7",
};

const partition = d3.partition();

const arc = d3.arc()
    .startAngle(d => x(d.x0))
    .endAngle(d => x(d.x1))
    .innerRadius(d => Math.max(0, y(d.y0)))
    .outerRadius(d => Math.max(0, y(d.y1)));

// Actual-vs-target band along the outer edge of each segment.
// g = { x0, x1, y0, y1, frac } where frac is the share of the band to fill.
const bandWidth = g => Math.min(5, Math.max(0, (y(g.y1) - y(g.y0)) * 0.18));
const bandArc = d3.arc()
    .startAngle(g => x(g.x0))
    .endAngle(g => x(g.x0 + (g.x1 - g.x0) * g.frac))
    .innerRadius(g => Math.max(0, y(g.y1) - 1 - bandWidth(g)))
    .outerRadius(g => Math.max(0, y(g.y1) - 1));

const trackGeom = d => ({ x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1, frac: targetOf(d) > 0 ? 1 : 0 });
const progressGeom = d => {
    const r = ratioOf(d);
    return { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1, frac: r == null ? 0 : Math.min(r, 1) };
};
const progressColor = d => (ratioOf(d) > 1 ? MODES[mode].overColor : '#fff');

const middleArcLine = d => {
    const halfPi = Math.PI / 2;
    const angles = [x(d.x0) - halfPi, x(d.x1) - halfPi];
    const r = Math.max(0, (y(d.y0) + y(d.y1)) / 2);

    const middleAngle = (angles[1] + angles[0]) / 2;
    const invertDirection = middleAngle > 0 && middleAngle < Math.PI; // On lower quadrants write text ccw
    if (invertDirection) { angles.reverse(); }

    const path = d3.path();
    path.arc(0, 0, r, angles[0], angles[1], invertDirection);
    return path.toString();
};

const textFits = d => {
    const CHAR_SPACE = 6;

    const deltaAngle = x(d.x1) - x(d.x0);
    const r = Math.max(0, (y(d.y0) + y(d.y1)) / 2);
    const perimeter = r * deltaAngle;

    return d.data.name.length * CHAR_SPACE < perimeter;
};

document.title = 'The EXP. Flywheel · ' + SHEET.period;

const svg = d3.select('body').append('svg')
    .style('width', '100vw')
    .style('height', '100vh')
    .attr("id", "pie")
    .attr('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`)
    .on('click', function() {
        focusOn(); // Reset to top-level
        hideInfo();
        if (window.location.hash) {
            history.pushState("", document.title, window.location.pathname + window.location.search);
        }
        try {
            if (window.parent !== window && window.parent.location.hash) {
                window.parent.history.pushState(
                    "",
                    window.parent.document.title,
                    window.parent.location.pathname + window.parent.location.search
                );
            }
        } catch (e) { /* parent on another domain */ }
    });

// ---- Load and draw -------------------------------------------------------
// ---- Loading / error status ----------------------------------------------
const setStatus = (msg, isError) => {
    d3.select('#status')
        .classed('error', !!isError)
        .style('display', msg ? null : 'none')
        .text(msg || '');
};
const loadedAt = () => {
    const now = new Date();
    return d3.timeFormat('%-d %b %Y, %H:%M')(now);
};

d3.csv(myCsv, function(error, data) {
    if (error || !data) {
        setStatus("Couldn't load the data. Check the sheet tab is still published, then refresh.", true);
        return;
    }
    if (!data.length) {
        setStatus('The sheet tab is empty.', true);
        return;
    }
    try {
        draw(data);
        setStatus('Data as of ' + loadedAt() + ' (Google may lag a few minutes)', false);
    } catch (e) {
        // e.g. a row whose parentId doesn't match any id
        setStatus("Couldn't build the chart: " + (e.message || e), true);
    }
});

function draw(data) {
    const tree = DataStructures.Tree.createFromFlatTable(data),
    simple = tree.toSimpleObject(function(objectToDecorate, originalNode) {
        objectToDecorate.dri = (originalNode.DRI || '').trim();
        Object.keys(MODES).forEach(m => {
            const c = MODES[m];
            objectToDecorate[m] = {
                size: toNumber(originalNode[c.size]) || 0,
                pct: originalNode[c.pct],
                target: toNumber(originalNode[c.target]),
                actual: toNumber(originalNode[c.actual])
            };
        });
        if (objectToDecorate.children && objectToDecorate.children.length == 0) {
            delete objectToDecorate.children;
        }
        return objectToDecorate;
    });

    root = d3.hierarchy(simple);

    // Actuals: use the row's own figure if filled, otherwise the sum of its children's.
    root.eachAfter(d => {
        d.agg = {};
        Object.keys(MODES).forEach(m => {
            const own = d.data[m].actual;
            if (own != null) { d.agg[m] = own; return; }
            const kids = (d.children || []).map(c => c.agg[m]).filter(v => v != null);
            d.agg[m] = kids.length ? kids.reduce((a, b) => a + b, 0) : null;
        });
    });

    sizeMemo = new Map();
    root.sum(sizeOf);
    currentFocus = root;

    const slice = svg.selectAll('g.slice')
        .data(partition(root).descendants());

    slice.exit().remove();

    const newSlice = slice.enter()
        .append('g').attr('class', 'slice')
        .on('click', function(d) {
            d3.event.stopPropagation();
            const id = d.data.workcode;
            history.pushState({ id: id }, "", "#" + id);
            focusOn(d);
            showInfo(d, this);  // so taps on phones show the panel too
        });

    newSlice.append('title')
        .text(titleText);

    newSlice.append('path')
        .attr('class', 'main-arc')
        .style('fill', colorOf)
        .style('opacity', depthOpacity)
        .attr('d', arc)
        .on('mouseover', function(d) { showInfo(d, this.parentNode); });

    newSlice.append('path')
        .attr('class', 'track-arc')
        .attr('d', d => bandArc(trackGeom(d)));

    newSlice.append('path')
        .attr('class', 'progress-arc')
        .style('fill', progressColor)
        .attr('d', d => bandArc(progressGeom(d)));

    newSlice.append('path')
        .attr('class', 'hidden-arc')
        .attr('id', (_, i) => `hiddenArc${i}`)
        .attr('d', middleArcLine);

    const text = newSlice.append('text')
        .attr('display', d => textFits(d) ? null : 'none')
        .style('fill', '#fff');

    // White contour
    text.append('textPath')
        .attr('startOffset', '50%')
        .attr('xlink:href', (_, i) => `#hiddenArc${i}`)
        .text(d => d.data.name)
        .style('fill', 'none')
        .style('stroke', '#666')
        .style('stroke-width', 2)
        .style('stroke-linejoin', 'round');

    text.append('textPath')
        .attr('startOffset', '50%')
        .attr('xlink:href', (_, i) => `#hiddenArc${i}`)
        .text(d => d.data.name);

    d3.select('#pie').on('mouseleave', hideInfo);
    d3.select('#period').text(SHEET.period);  // set here: the page's elements exist by now
    updateModeButtons();

    const id = window.location.hash.substring(1);
    if (id) {
        const d = findDataById(id);
        if (d) { focusOn(d); }
    }
}

// ---- Zoom ----------------------------------------------------------------
function focusOn(d = { x0: 0, x1: 1, y0: 0, y1: 1 }) {
    currentFocus = d.data ? d : root;

    const transition = svg.transition('zoom')
        .duration(750)
        .tween('scale', () => {
            const xd = d3.interpolate(x.domain(), [d.x0, d.x1]),
                yd = d3.interpolate(y.domain(), [d.y0, 1]);
            return t => { x.domain(xd(t)); y.domain(yd(t)); };
        });

    transition.selectAll('path.main-arc')
        .attrTween('d', d => () => arc(d));

    transition.selectAll('path.track-arc')
        .attrTween('d', d => () => bandArc(trackGeom(d)));

    transition.selectAll('path.progress-arc')
        .attrTween('d', d => () => bandArc(progressGeom(d)));

    transition.selectAll('path.hidden-arc')
        .attrTween('d', d => () => middleArcLine(d));

    transition.selectAll('text')
        .attrTween('display', d => () => textFits(d) ? null : 'none');

    moveStackToFront(d);

    function moveStackToFront(elD) {
        svg.selectAll('.slice').filter(d => d === elD)
            .each(function(d) {
                this.parentNode.appendChild(this);
                if (d.parent) { moveStackToFront(d.parent); }
            });
    }
}

// ---- Info panel and hover --------------------------------------------------
function showInfo(d, sliceEl) {
    const esc = v => String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const m = MODES[mode];
    const r = ratioOf(d);
    const row = (label, value, cls) =>
        '<dt>' + label + '</dt><dd' + (cls ? ' class="' + cls + '"' : '') + '>' + value + '</dd>';

    const actualText = fmt(actualOf(d))
        + (actualOf(d) == null ? '' : ' K HKD')
        + (r == null ? '' : ' <span class="pct">(' + Math.round(r * 100) + '%)</span>');
    const actualClass = r == null ? '' : (r > 1 ? (mode === 'budget' ? 'over' : 'ahead') : '');

    let rows = row('DRI', esc(d.data.dri) || '—', d.data.dri ? 'dri' : 'muted');
    if (d.parent) {
        rows += row(m.label + ' share', esc(pctOf(d) || '-') + '% of ' + esc(d.data.parentcode));
    }
    rows += row(m.targetLabel.charAt(0).toUpperCase() + m.targetLabel.slice(1), fmt(targetOf(d)) + ' K HKD')
          + row('Actual', actualText, actualClass);
    // Profitability: operating margin on actuals only, with revenue-to-cost cover in brackets.
    if (hasActualMargin(d)) {
        const f = finOf(d), mg = marginOf(f), cv = coverOf(f);
        let marginText, marginClass = '';
        if (f.rev <= 0) {
            marginText = 'no revenue';
            marginClass = 'over';
        } else {
            marginText = (mg >= 0 ? '+' : '') + Math.round(mg * 100) + '%'
                + (cv == null ? '' : ' <span class="pct">(' + cv.toFixed(2) + '× cost)</span>');
            marginClass = mg > 0 ? 'profit' : 'over';
        }
        rows += row('Margin', marginText, marginClass);
    }
    if (d.parent) {
        rows += row('Status', '<span class="dot" style="background:' + colorOf(d) + '"></span>'
            + esc(statusOf(d)));
    }

    const html =
          (d.parent ? '<div class="id">' + esc(d.data.workcode) + '</div>' : '')
        + '<dl class="facts">' + rows + '</dl>'
        + (d.data['one-liner'] ? '<p class="oneliner">' + esc(d.data['one-liner']) + '</p>' : '');

    d3.select('#title').text(d.data.name);
    d3.select('#detail').html(html);
    d3.select('#info').style('visibility', '');

    // Fade everything, then light up the hovered segment.
    svg.selectAll('path.main-arc, path.track-arc, path.progress-arc')
        .interrupt('fade')
        .style('opacity', 0.3);
    if (sliceEl) {
        d3.select(sliceEl).selectAll('path.main-arc, path.track-arc, path.progress-arc')
            .style('opacity', 1);
    }
}

function hideInfo() {
    d3.select('#info').style('visibility', 'hidden');

    // A named transition, so zoom and mode changes can't cancel it.
    svg.selectAll('path.main-arc')
        .transition('fade').duration(1000)
        .style('opacity', depthOpacity);
    svg.selectAll('path.track-arc, path.progress-arc')
        .transition('fade').duration(1000)
        .style('opacity', 1);
}

function findDataById(id) {
    const nodes = svg.selectAll('g.slice').data();
    return nodes.find(d => d.data.workcode === id);
}

window.addEventListener('popstate', function(event) {
    if (event.state && event.state.id) {
        const d = findDataById(event.state.id);
        if (d) { focusOn(d); }
    } else {
        focusOn();
    }
});

// ---- Mode switching --------------------------------------------------------
function setMode(newMode) {
    if (!MODES[newMode] || newMode === mode || !root) { return; }

    // Where every segment and band is now…
    const before = new Map();
    root.each(d => before.set(d, { x0: d.x0, x1: d.x1, p: progressGeom(d).frac, t: trackGeom(d).frac }));

    // …then re-size the tree for the new mode.
    mode = newMode;
    sizeMemo = new Map();
    root.sum(sizeOf);
    partition(root);

    const f = currentFocus || root;
    const xd = d3.interpolate(x.domain(), [f.x0, f.x1]);
    const between = d => {
        const b = before.get(d);
        const i = d3.interpolate(
            { x0: b.x0, x1: b.x1, p: b.p, t: b.t },
            { x0: d.x0, x1: d.x1, p: progressGeom(d).frac, t: trackGeom(d).frac });
        return t => {
            const v = i(t);
            return { x0: v.x0, x1: v.x1, y0: d.y0, y1: d.y1, p: v.p, t: v.t, data: d.data };
        };
    };

    const tr = svg.transition('zoom')
        .duration(750)
        .tween('scale', () => t => { x.domain(xd(t)); });

    tr.selectAll('path.main-arc')
        .attrTween('d', d => { const g = between(d); return t => arc(g(t)); });
    tr.selectAll('path.track-arc')
        .attrTween('d', d => { const g = between(d); return t => { const v = g(t); v.frac = v.t; return bandArc(v); }; });
    tr.selectAll('path.progress-arc')
        .attrTween('d', d => { const g = between(d); return t => { const v = g(t); v.frac = v.p; return bandArc(v); }; });
    tr.selectAll('path.hidden-arc')
        .attrTween('d', d => { const g = between(d); return t => middleArcLine(g(t)); });
    tr.selectAll('text')
        .attrTween('display', d => { const g = between(d); return t => textFits(g(t)) ? null : 'none'; });

    svg.selectAll('path.progress-arc').style('fill', progressColor);
    svg.selectAll('g.slice title').text(titleText);
    updateModeButtons();

    // Keep the mode in the address bar (?mode=revenue) without losing the #focus.
    const params = new URLSearchParams(window.location.search);
    params.set('mode', mode);
    history.replaceState(history.state, '', window.location.pathname + '?' + params.toString() + window.location.hash);
}

function updateModeButtons() {
    d3.selectAll('#modes button')
        .classed('active', function() { return this.getAttribute('data-mode') === mode; });
}

document.addEventListener('click', function(e) {
    const btn = e.target.closest && e.target.closest('#modes button');
    if (btn) { setMode(btn.getAttribute('data-mode')); }
});

// ---- Resize / rotate --------------------------------------------------------
let resizeTimer = null;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        measure();
        y.range([maxRadius * .1, maxRadius]);
        svg.attr('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`);
        svg.selectAll('path.main-arc').attr('d', arc);
        svg.selectAll('path.track-arc').attr('d', d => bandArc(trackGeom(d)));
        svg.selectAll('path.progress-arc').attr('d', d => bandArc(progressGeom(d)));
        svg.selectAll('path.hidden-arc').attr('d', middleArcLine);
        svg.selectAll('g.slice text').attr('display', d => textFits(d) ? null : 'none');
    }, 150);
});