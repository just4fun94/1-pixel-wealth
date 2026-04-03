// ─── Constants & Formatters ─────────────────────────────────────────
const MAX_SEGMENT_HEIGHT = 10_000_000; // px — safe under browser ~16.7M limit
const MAX_SAFE_HEIGHT = 33_000_000; // px — warn above this (browser rendering limit)
const RULER_TICK_PX = 160; // matches ruler-vert.svg background-size height
const COUNTER_SCROLL_OFFSET = 175; // px offset for wealth counter (accounts for header height)

const thousand = new Intl.NumberFormat('en-US');
const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatCompactMoney(n) {
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2).replace(/\.?0+$/, '') + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  return money.format(n);
}

function fmtPct(n) {
  if (n >= 10) return Math.round(n) + '%';
  if (n >= 1)  return n.toFixed(1) + '%';
  return n.toFixed(2) + '%';
}

// ─── Globals ────────────────────────────────────────────────────────
let currentBarWidth = 500;
let richestPersonWealthUsd = 813_000_000_000; // fallback — updated from billionaires.json
let allBillionairesTotalUsd = 19_100_000_000_000; // fallback — updated from billionaires.json
let richestName = 'the richest person';
let billionaireCount = 3372; // fallback — updated from billionaires.json
let story = null;
let pageOpenedAt = Date.now();

// Bar references (populated after data loads)
const bars = {};

// ─── Layout Computation ─────────────────────────────────────────────
function computeBarWidth() {
  const em = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Math.max(200, Math.floor(document.documentElement.clientWidth - 2 * em));
}

function applyDimensions(barWidth) {
  currentBarWidth = barWidth;
  const billionBarWidth = Math.min(barWidth, 1000);
  const billionH = Math.round(1e9 / (billionBarWidth * 1000));
  const richestH = Math.round(richestPersonWealthUsd / (barWidth * 1000));
  const allBillionairesH = Math.round(allBillionairesTotalUsd / (barWidth * 1000));

  // Warn if heights exceed safe browser rendering limits
  if (allBillionairesH > MAX_SAFE_HEIGHT) {
    console.warn('All-billionaires bar height (' + allBillionairesH + 'px) exceeds safe limit (' + MAX_SAFE_HEIGHT + 'px). Rendering may be unreliable.');
  }

  // Infobox margins as fractions of the richest bar height (scale-independent)
  const root = document.documentElement.style;
  root.setProperty('--bar-width', barWidth + 'px');
  root.setProperty('--bar-width-billion', billionBarWidth + 'px');
  root.setProperty('--billion-h', billionH + 'px');
  root.setProperty('--richest-h', richestH + 'px');
  root.setProperty('--all-billionaires-h', allBillionairesH + 'px');
  root.setProperty('--infobox-margin', Math.round(richestH * 0.0216) + 'px');
  root.setProperty('--infobox-first-margin', Math.round(richestH * 0.054) + 'px');
  root.setProperty('--infobox-half-margin', Math.round(richestH * 0.0144) + 'px');
  root.setProperty('--infobox-quarter-margin', Math.round(richestH * 0.0072) + 'px');
  root.setProperty('--infobox-close-margin', Math.round(richestH * 0.0018) + 'px');

  // Scale labels — each ruler tick is RULER_TICK_PX tall
  const scaleText = formatCompactMoney(RULER_TICK_PX * barWidth * 1000);
  const scaleEls = document.querySelectorAll('.scale-label');
  for (let i = 0; i < scaleEls.length; i++) { scaleEls[i].textContent = scaleText; }

  // Segment the all-billionaires bar if needed
  segmentBar('allBillionaires', allBillionairesH, barWidth);
}

// ─── Segmented Virtual Scroll ───────────────────────────────────────
function segmentBar(barId, totalHeight, barWidth) {
  const el = document.getElementById(barId);
  if (!el) return;

  // Remove old segment divs
  const oldSegs = el.querySelectorAll('.bar-segment');
  oldSegs.forEach(function(s) { s.remove(); });

  if (totalHeight <= MAX_SEGMENT_HEIGHT) {
    // Single bar — just set height
    el.style.height = totalHeight + 'px';
    bars[barId] = { el: el, totalHeight: totalHeight, segments: [{ el: el, start: 0, height: totalHeight }] };
    return;
  }

  // Multiple segments
  const segments = [];
  let remaining = totalHeight;
  let offset = 0;
  while (remaining > 0) {
    const h = Math.min(remaining, MAX_SEGMENT_HEIGHT);
    const seg = document.createElement('div');
    seg.className = 'bar-segment';
    seg.style.width = barWidth + 'px';
    seg.style.height = h + 'px';
    seg.style.backgroundColor = 'inherit';
    // Only the first segment gets the ruler background
    if (offset === 0) {
      seg.style.backgroundImage = "url('img/ruler-vert.svg')";
      seg.style.backgroundRepeat = 'repeat-y';
      seg.style.backgroundPosition = 'right 0';
      seg.style.backgroundSize = '30px 160px';
    }
    el.appendChild(seg);
    segments.push({ el: seg, start: offset, height: h });
    offset += h;
    remaining -= h;
  }

  // The main element's natural height = header + key + comparisons + segments
  // Don't override its height; segments provide the height
  bars[barId] = { el: el, totalHeight: totalHeight, segments: segments };
}

// ─── Scroll Counter ─────────────────────────────────────────────────
function updateWealthCounters() {
  const scrollTop = window.scrollY || window.pageYOffset || 0;
  const vh = window.innerHeight;

  updateBarCounter('richest', richestPersonWealthUsd, scrollTop, vh);
  updateBarCounter('allBillionaires', allBillionairesTotalUsd, scrollTop, vh);
}

function updateBarCounter(barId, maxWealth, scrollTop, vh) {
  const el = document.getElementById(barId);
  const counterEl = document.getElementById(barId + '-counter');
  if (!el || !counterEl) return;

  const barTop = el.offsetTop;
  const barBot = barTop + el.offsetHeight;

  // Only show counter when bar is in view
  if (scrollTop + vh < barTop + 200 || scrollTop > barBot) {
    counterEl.textContent = '';
    return;
  }

  // For the richest bar, only show counter once "just-kidding" element is in view
  if (barId === 'richest') {
    const jk = document.querySelector('.comparison-just-kidding');
    if (jk) {
      const jkTop = jk.offsetTop;
      if (scrollTop + vh < jkTop) {
        counterEl.textContent = '';
        return;
      }
    }
  }

  const wealth = Math.max(0, (scrollTop - barTop + COUNTER_SCROLL_OFFSET) * (currentBarWidth * 1000));
  counterEl.textContent = (wealth < maxWealth) ? money.format(wealth) : money.format(maxWealth);
}

// ─── Data Loading ───────────────────────────────────────────────────
function loadData() {
  const billionairePromise = fetch('data/billionaires.json')
    .then(function(r) {
      if (r.ok) return r.json();
      return fetch('../data/billionaires.json').then(function(r2) {
        if (r2.ok) return r2.json();
        throw new Error('billionaires.json not found');
      });
    });

  const storyPromise = fetch('data/story.json')
    .then(function(r) {
      if (r.ok) return r.json();
      return fetch('../data/story.json').then(function(r2) {
        if (r2.ok) return r2.json();
        throw new Error('story.json not found');
      });
    });

  Promise.all([billionairePromise, storyPromise])
    .then(function(results) {
      applyData(results[0], results[1]);
    })
    .catch(function(e) { console.warn('Could not load data:', e); });
}

function applyData(billionaireData, storyData) {
  story = storyData;
  richestPersonWealthUsd = Number(billionaireData.people[0].wealthUsd);
  richestName = billionaireData.people[0].name;

  // Use all-billionaires total if available, else fallback to top-200
  if (billionaireData.allBillionairesTotalUsd) {
    allBillionairesTotalUsd = Number(billionaireData.allBillionairesTotalUsd);
    billionaireCount = Number(billionaireData.allBillionairesCount || billionaireCount);
  } else {
    allBillionairesTotalUsd = Number(billionaireData.totalWealthUsd);
    billionaireCount = Number(billionaireData.count);
  }

  applyDimensions(computeBarWidth());

  // Update titles
  const richestTitle = document.getElementById('richest-title');
  if (richestTitle) richestTitle.textContent = money.format(richestPersonWealthUsd) + ' (wealth of ' + richestName + ')';

  const allTitle = document.getElementById('allBillionaires-title');
  if (allTitle) allTitle.textContent = 'All the world\u2019s ' + thousand.format(billionaireCount) + ' billionaires (' + formatCompactMoney(allBillionairesTotalUsd) + ')';

  // Source attribution
  const sourceEl = document.getElementById('data-source');
  if (sourceEl) {
    const d = new Date(billionaireData.fetchedAt);
    const dateStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    sourceEl.innerHTML = 'Wealth data: <a href="' + billionaireData.sourceUrl + '" target="_blank" rel="noopener noreferrer">' + billionaireData.source + '</a> &mdash; last updated ' + dateStr;
  }

  // Render story comparisons
  renderComparisons();

  // Start death ticker
  if (story.deathTicker && story.deathTicker.enabled) {
    startDeathTicker(story.deathTicker);
  }
}

// ─── Comparison Renderer ────────────────────────────────────────────
function renderComparisons() {
  if (!story || !story.comparisons) return;

  const richestContainer = document.getElementById('richest-comparisons');
  const allContainer = document.getElementById('allBillionaires-comparisons');

  const templateVars = {
    richestName: richestName,
    richestDailyIncome: formatCompactMoney(Math.round(richestPersonWealthUsd / 365)),
    scrollRate: formatCompactMoney(currentBarWidth * 10000),
    allBillionairesFormatted: formatCompactMoney(allBillionairesTotalUsd),
    billionaireCount: thousand.format(billionaireCount),
  };

  // Group comparisons by bar
  const groups = { richest: [], allBillionaires: [] };
  story.comparisons.forEach(function(c) {
    const barKey = c.bar || 'allBillionaires';
    if (groups[barKey]) groups[barKey].push(c);
  });

  if (richestContainer) renderGroup(groups.richest, richestContainer, richestPersonWealthUsd, templateVars);
  if (allContainer) renderGroup(groups.allBillionaires, allContainer, allBillionairesTotalUsd, templateVars);
}

function interpolate(text, vars) {
  return text.replace(/\{(\w+)\}/g, function(_, key) {
    return vars[key] !== undefined ? vars[key] : '{' + key + '}';
  });
}

function renderGroup(comparisons, container, totalWealth, vars) {
  const fragment = document.createDocumentFragment();

  comparisons.forEach(function(comp, idx) {
    const el = createComparisonElement(comp, totalWealth, vars, idx === 0);
    if (!el) return;

    // Store positionFraction as data attribute for resize recalculation
    if (typeof comp.positionFraction === 'number') {
      el.setAttribute('data-position-fraction', comp.positionFraction);
    }

    fragment.appendChild(el);
  });

  container.appendChild(fragment);
  updateComparisonPositions(container);
}

function updateComparisonPositions(container) {
  const barEl = container.closest('.wealth') || container.parentElement;
  const barH = barEl ? barEl.offsetHeight : 0;
  if (barH <= 0) return;

  const items = container.querySelectorAll('[data-position-fraction]');
  if (items.length === 0) return;

  // Collect fractions
  var fracs = [];
  for (var i = 0; i < items.length; i++) {
    fracs.push(parseFloat(items[i].getAttribute('data-position-fraction')) || 0);
  }

  // Set explicit heights based on gap to next comparison, then compute margins.
  // Use align-items: flex-start so sticky text appears at element top, not center.
  var lastBottom = 0;
  for (var i = 0; i < items.length; i++) {
    var targetPx = Math.round(fracs[i] * barH);
    var nextTargetPx = (i + 1 < fracs.length)
      ? Math.round(fracs[i + 1] * barH)
      : barH;
    var gapHeight = Math.max(window.innerHeight, nextTargetPx - targetPx);

    var diff = Math.max(0, targetPx - lastBottom);
    items[i].style.marginTop = diff + 'px';
    items[i].style.height = gapHeight + 'px';
    items[i].style.alignItems = 'flex-start';

    lastBottom = lastBottom + diff + gapHeight;
  }
}

function updateAllComparisonPositions() {
  const richestContainer = document.getElementById('richest-comparisons');
  const allContainer = document.getElementById('allBillionaires-comparisons');
  if (richestContainer) updateComparisonPositions(richestContainer);
  if (allContainer) updateComparisonPositions(allContainer);
}

function updateDynamicText() {
  var scrollRateEls = document.querySelectorAll('[data-dynamic="scrollRate"]');
  var newRate = formatCompactMoney(currentBarWidth * 10000);
  for (var i = 0; i < scrollRateEls.length; i++) {
    var titleEl = scrollRateEls[i].querySelector('.title');
    if (titleEl && story) {
      var comp = null;
      story.comparisons.forEach(function(c) { if (c.dynamic === 'scrollRate') comp = c; });
      if (comp) {
        titleEl.innerHTML = interpolate(comp.title, {
          richestName: richestName,
          scrollRate: newRate
        });
      }
    }
  }
}

function createComparisonElement(comp, totalWealth, vars, isFirst) {
  const wrapper = document.createElement('div');
  const durationClass = getDurationClass(comp.scrollDuration || 1.0);
  wrapper.className = 'infobox ' + durationClass + ' comparison-' + comp.id;

  if (isFirst && comp.bar === 'richest') {
    wrapper.classList.add('first');
  }

  switch (comp.type) {
    case 'text':
      wrapper.classList.add('text-infobox');
      if (comp.dynamic) wrapper.setAttribute('data-dynamic', comp.dynamic);
      wrapper.innerHTML = '<div class="title">' + interpolate(comp.title, vars) + '</div>';
      break;

    case 'square':
      wrapper.classList.add('text-infobox');
      const maxSide = currentBarWidth * 0.8;
      const side = Math.min(Math.sqrt(comp.amountUsd / 1000), maxSide);
      wrapper.innerHTML =
        '<div class="title-square-wrapper">' +
          '<div class="title">' + interpolate(comp.title, vars) + '</div>' +
          '<div class="square" style="width:' + side.toFixed(1) + 'px;height:' + side.toFixed(1) + 'px;background-color:' + (comp.squareColor || '#2196F3') + ';margin:0 auto"></div>' +
        '</div>';
      break;

    case 'cause':
      wrapper.classList.add('text-infobox', 'cause-infobox');
      const pct = (comp.costUsd / totalWealth) * 100;
      const pctStr = fmtPct(pct);

      // Pocket change computation
      const medianIncome = (story.meta && story.meta.medianHouseholdIncomeUsd) || 65000;
      const ratio = comp.costUsd / totalWealth;
      const pocketAmount = money.format(Math.round(ratio * medianIncome));

      let html = '<div class="cause-card">';

      // Pie chart
      html += '<div class="cause-pie">' +
        '<svg class="piechart-outer" viewBox="0 0 32 32">' +
          '<circle class="piechart-inner" r="16" cx="16" cy="16" style="stroke-dasharray:' + pct.toFixed(2) + ' 100"/>' +
        '</svg>' +
        '<span class="pie-label">' + pctStr + '</span>' +
      '</div>';

      // Content
      html += '<div class="cause-content">' +
        '<h3 class="cause-title">' + comp.title + '</h3>' +
        '<div class="cause-cost">' + formatCompactMoney(comp.costUsd) + ' — ' + pctStr + ' of all billionaire wealth</div>' +
        '<p class="cause-desc">' + comp.description + '</p>';

      // Death stat
      if (comp.deathsPerYear) {
        const perDay = Math.round(comp.deathsPerYear / 365);
        html += '<div class="cause-deaths">' +
          '<strong>' + thousand.format(perDay) + '</strong> ' + (comp.deathLabel || 'deaths') + ' per day — ' +
          '<strong>' + thousand.format(comp.deathsPerYear) + '</strong> per year' +
        '</div>';
      }

      // Pocket change
      if (comp.pocketChange) {
        html += '<div class="pocket-change">' +
          interpolate(comp.pocketChange.median, Object.assign({}, vars, { amount: pocketAmount })) +
        '</div>';
      }

      // Source
      if (comp.sourceUrl) {
        html += '<div class="cause-source">Source: <a href="' + comp.sourceUrl + '" target="_blank" rel="noopener noreferrer">' + (comp.sourceName || 'Link') + '</a></div>';
      }

      html += '</div></div>';
      wrapper.innerHTML = html;
      break;

    case 'summary':
      wrapper.classList.add('text-infobox', 'summary-infobox');
      const ids = comp.includeIds || [];
      let totalCost = 0;
      const items = [];
      if (story.comparisons) {
        story.comparisons.forEach(function(c) {
          if (ids.indexOf(c.id) !== -1 && c.costUsd) {
            totalCost += c.costUsd;
            items.push({ title: c.title, cost: c.costUsd });
          }
        });
      }
      const summaryPct = (totalCost / totalWealth) * 100;
      let shtml = '<div class="summary-card">';
      shtml += '<h3 class="cause-title">' + comp.title + '</h3>';
      shtml += '<p class="cause-desc">' + comp.description + '</p>';

      // Side-by-side bar chart
      shtml += '<div class="side-by-side-chart">';
      items.forEach(function(item) {
        const widthPct = Math.max(1, (item.cost / totalCost) * 100);
        shtml += '<div class="bar-row">' +
          '<span class="bar-label">' + item.title + '</span>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + widthPct.toFixed(1) + '%"></div></div>' +
          '<span class="bar-amount">' + formatCompactMoney(item.cost) + '</span>' +
        '</div>';
      });
      shtml += '</div>';

      shtml += '<div class="summary-total">' +
        '<strong>Total: ' + formatCompactMoney(totalCost) + '</strong> — ' + fmtPct(summaryPct) + ' of all billionaire wealth' +
      '</div>';

      // Pie chart for combined
      shtml += '<div class="cause-pie summary-pie">' +
        '<svg class="piechart-outer" viewBox="0 0 32 32">' +
          '<circle class="piechart-inner" r="16" cx="16" cy="16" style="stroke-dasharray:' + summaryPct.toFixed(2) + ' 100"/>' +
        '</svg>' +
        '<span class="pie-label">' + fmtPct(summaryPct) + '</span>' +
      '</div>';

      shtml += '</div>';
      wrapper.innerHTML = shtml;
      break;

    default:
      wrapper.classList.add('text-infobox');
      wrapper.innerHTML = '<div class="title">' + interpolate(comp.title || '', vars) + '</div>';
  }

  return wrapper;
}

function getDurationClass(multiplier) {
  if (multiplier >= 2.0) return 'infobox-first-margin';
  if (multiplier >= 1.5) return 'infobox-duration-long';
  if (multiplier >= 1.0) return 'infobox-duration-medium';
  if (multiplier >= 0.5) return 'infobox-duration-short';
  return 'infobox-close';
}

// ─── Death Ticker ───────────────────────────────────────────────────
function startDeathTicker(config) {
  const tickerEl = document.getElementById('death-ticker');
  const countsEl = document.getElementById('death-ticker-counts');
  if (!tickerEl || !countsEl) return;

  const sources = config.sources || [];
  if (sources.length === 0) return;

  // Compute per-second rates
  const rates = sources.map(function(s) {
    return {
      label: s.label,
      perSecond: s.perYear / (365.25 * 24 * 3600),
    };
  });

  // Compute total per-second rate
  var totalPerSecond = 0;
  rates.forEach(function(r) { totalPerSecond += r.perSecond; });

  // Keep ticker hidden until user scrolls to the first cause comparison
  var tickerVisible = false;

  function checkVisibility() {
    if (tickerVisible) return;
    // Find the first cause-type comparison in the DOM
    var causeEl = document.querySelector('.cause-infobox');
    if (!causeEl) return;
    var scrollTop = window.scrollY || window.pageYOffset || 0;
    var vh = window.innerHeight;
    if (scrollTop + vh >= causeEl.offsetTop) {
      tickerEl.hidden = false;
      tickerVisible = true;
    }
  }

  window.addEventListener('scroll', function() {
    if (!tickerVisible) checkVisibility();
  });

  function update() {
    var elapsed = (Date.now() - pageOpenedAt) / 1000;
    var html = '';
    rates.forEach(function(r) {
      var count = Math.floor(r.perSecond * elapsed);
      html += '<div class="ticker-row"><span class="ticker-count">' +
        thousand.format(count) + '</span> <span class="ticker-label">' +
        r.label + '</span></div>';
    });
    // Total row — sum the individual floored counts so the total always matches
    var totalCount = 0;
    rates.forEach(function(r) { totalCount += Math.floor(r.perSecond * elapsed); });
    html += '<div class="ticker-row ticker-total"><span class="ticker-count">' +
      thousand.format(totalCount) + '</span> <span class="ticker-label">total preventable deaths</span></div>';
    countsEl.innerHTML = html;
  }

  update();
  setInterval(update, 1000);
}

// ─── Init ───────────────────────────────────────────────────────────
applyDimensions(computeBarWidth());
window.addEventListener('resize', function() {
  var scrollTop = window.scrollY || window.pageYOffset || 0;

  // Track position relative to whichever bar is in view
  var anchor = null;
  var richestEl = document.getElementById('richest');
  var allEl = document.getElementById('allBillionaires');

  if (richestEl && scrollTop >= richestEl.offsetTop && scrollTop < richestEl.offsetTop + richestEl.offsetHeight) {
    anchor = { id: 'richest', frac: (scrollTop - richestEl.offsetTop) / richestEl.offsetHeight };
  } else if (allEl && scrollTop >= allEl.offsetTop && scrollTop < allEl.offsetTop + allEl.offsetHeight) {
    anchor = { id: 'allBillionaires', frac: (scrollTop - allEl.offsetTop) / allEl.offsetHeight };
  }

  applyDimensions(computeBarWidth());
  updateAllComparisonPositions();
  updateDynamicText();

  // Restore scroll to same relative position within the bar
  if (anchor) {
    var el = document.getElementById(anchor.id);
    if (el) {
      window.scrollTo(0, el.offsetTop + anchor.frac * el.offsetHeight);
    }
  }
});

let scrollRafScheduled = false;
window.addEventListener('scroll', function() {
  if (!scrollRafScheduled) {
    scrollRafScheduled = true;
    requestAnimationFrame(function() {
      updateWealthCounters();
      scrollRafScheduled = false;
    });
  }
});

loadData();
