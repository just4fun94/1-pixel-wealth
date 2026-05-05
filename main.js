// ─── Constants & Formatters ─────────────────────────────────────────
const MAX_SEGMENT_HEIGHT = 10_000_000;
const RULER_TICK_PX = 160;
const COUNTER_SCROLL_OFFSET = 175;
const DOLLARS_PER_PIXEL = 1000;
const SCROLL_RATE_PX = 10;
const BAR_VISIBILITY_OFFSET_PX = 200;
const MAX_SQUARE_WIDTH_FRACTION = 0.8;
const MIN_RECT_HEIGHT_FOR_INNER_TEXT = 60;
const MIN_RECT_WIDTH_FOR_INNER_TEXT = 150;
const MIN_COMPARISON_GAP_VH = 1.5;
const MIN_COMPARISON_CONTENT_PADDING_PX = 64;
const MAX_BAR_SEGMENTS = 100;
const FETCH_TIMEOUT_MS = 15_000;
const TICKER_UPDATE_MS = 1000;
const WEALTH_COUNTER_ANNUAL_USD = 500_000_000_000;
const WEALTH_COUNTER_PER_SECOND = WEALTH_COUNTER_ANNUAL_USD / (365.25 * 24 * 3600);

function getActiveLocale() {
  var lang = window.i18n_data && window.i18n_data.code;
  if (lang === 'de') return 'de-DE';
  return 'en-US';
}

const thousand = new Intl.NumberFormat(getActiveLocale());
const money = new Intl.NumberFormat(getActiveLocale(), {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatCompactMoney(n) {
  var lang = window.i18n_data && window.i18n_data.code;
  if (lang === 'de') {
    if (n >= 1e12) return (n / 1e12).toFixed(2).replace(/\.?0+$/, '').replace('.', ',') + ' Bio. $';
    if (n >= 1e9)  return (n / 1e9).toFixed(1).replace(/\.0$/, '').replace('.', ',') + ' Mrd. $';
    if (n >= 1e6)  return (n / 1e6).toFixed(1).replace(/\.0$/, '').replace('.', ',') + ' Mio. $';
    return money.format(n);
  }
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
let richestPersonWealthUsd = 839_000_000_000;
let allBillionairesTotalUsd = 20_100_000_000_000;
let richestName = 'the richest person';
let billionaireCount = 3428;
let story = null;
let pageOpenedAt = Date.now();
let tickerIntervalId = null;
let scrollRateComp = null;
let _detectedMaxScrollHeight = null;

// ─── Capping state ──────────────────────────────────────────────────
let isCapped = false;
let cappedFraction = 1;
let pctReached = 100;
let prevCappedFraction = 1;

// ─── Helpers ────────────────────────────────────────────────────────
function getStableVh() {
  return document.documentElement.clientHeight || window.innerHeight;
}

function interpolate(text, vars) {
  return text.replace(/\{(\w+)\}/g, function(_, key) {
    return vars[key] !== undefined ? vars[key] : '{' + key + '}';
  });
}

function detectMaxScrollHeight() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:99999999px;visibility:hidden;pointer-events:none;';
  document.body.appendChild(probe);
  const actualMax = document.documentElement.scrollHeight;
  document.body.removeChild(probe);
  return actualMax;
}

function getMaxSafeAllBillionairesH(barWidth) {
  if (_detectedMaxScrollHeight === null) {
    _detectedMaxScrollHeight = detectMaxScrollHeight();
  }
  const richestH = Math.round(richestPersonWealthUsd / (barWidth * DOLLARS_PER_PIXEL));
  const otherContentH = 10000;
  return Math.max(0, _detectedMaxScrollHeight - richestH - otherContentH);
}

// ─── i18n Helpers ───────────────────────────────────────────────────
function t(key, fallback) {
  if (window.i18n_data && window.i18n_data.strings && key) {
    var val = window.i18n_data.strings[key];
    if (val !== undefined) return val;
  }
  return fallback;
}

function tUI(key, fallback) {
  return t('i18n-ui-' + key, fallback);
}

function localizeComp(comp) {
  var c = {};
  for (var k in comp) { if (comp.hasOwnProperty(k)) c[k] = comp[k]; }
  var base = comp.i18nKey;
  if (base) {
    c.title = t(base, c.title);
    c.description = t(base + '-desc', c.description);
    c.deathLabel = t(base + '-death-label', c.deathLabel);
    c.sourceName = t(base + '-source-name', c.sourceName);
    c.imageAlt = t(base + '-image-alt', c.imageAlt);
    c.tickerDescription = t(base + '-ticker-desc', c.tickerDescription);
  }
  return c;
}

// ─── Layout Computation ─────────────────────────────────────────────
function computeBarWidth() {
  const em = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Math.max(200, Math.floor(document.documentElement.clientWidth - 2 * em));
}

function applyDimensions(barWidth) {
  currentBarWidth = barWidth;
  const billionBarWidth = Math.min(barWidth, 1000);
  const billionH = Math.round(1e9 / (billionBarWidth * DOLLARS_PER_PIXEL));
  const richestH = Math.round(richestPersonWealthUsd / (barWidth * DOLLARS_PER_PIXEL));

  // Calculate logical height, then cap if needed
  const logicalAllBillionairesH = Math.round(allBillionairesTotalUsd / (barWidth * DOLLARS_PER_PIXEL));
  const maxSafeH = getMaxSafeAllBillionairesH(barWidth);
  let allBillionairesH;

  if (logicalAllBillionairesH > maxSafeH) {
    allBillionairesH = maxSafeH;
    isCapped = true;
    cappedFraction = maxSafeH / logicalAllBillionairesH;
    pctReached = cappedFraction * 100;
  } else {
    allBillionairesH = logicalAllBillionairesH;
    isCapped = false;
    cappedFraction = 1;
    pctReached = 100;
  }

  const root = document.documentElement.style;
  root.setProperty('--bar-width', barWidth + 'px');
  root.setProperty('--bar-width-billion', billionBarWidth + 'px');
  root.setProperty('--billion-h', billionH + 'px');
  root.setProperty('--richest-h', richestH + 'px');
  root.setProperty('--all-billionaires-h', allBillionairesH + 'px');

  const scaleText = formatCompactMoney(RULER_TICK_PX * barWidth * DOLLARS_PER_PIXEL);
  const scaleEls = document.querySelectorAll('.scale-label');
  for (let i = 0; i < scaleEls.length; i++) { scaleEls[i].textContent = scaleText; }

  segmentBar('allBillionaires', allBillionairesH, barWidth);
}

// ─── Segmented Virtual Scroll ───────────────────────────────────────
function segmentBar(barId, totalHeight, barWidth) {
  const el = document.getElementById(barId);
  if (!el) return;

  el.querySelectorAll('.bar-segment').forEach(function(s) { s.remove(); });

  if (totalHeight <= MAX_SEGMENT_HEIGHT) {
    el.style.height = totalHeight + 'px';
    return;
  }

  let remaining = totalHeight;
  let iterations = 0;
  while (remaining > 0 && iterations < MAX_BAR_SEGMENTS) {
    iterations++;
    const h = Math.min(remaining, MAX_SEGMENT_HEIGHT);
    const seg = document.createElement('div');
    seg.className = 'bar-segment';
    seg.style.width = barWidth + 'px';
    seg.style.height = h + 'px';
    seg.style.backgroundColor = 'inherit';
    if (iterations === 1) {
      seg.style.backgroundImage = "url('img/ruler-vert.svg')";
      seg.style.backgroundRepeat = 'repeat-y';
      seg.style.backgroundPosition = 'right 0';
      seg.style.backgroundSize = '30px 160px';
    }
    el.appendChild(seg);
    remaining -= h;
  }
}

// ─── Scroll Counter ─────────────────────────────────────────────────
function updateWealthCounters() {
  const scrollTop = window.scrollY || window.pageYOffset || 0;
  const vh = getStableVh();
  updateBarCounter('richest', richestPersonWealthUsd, scrollTop, vh);
  updateBarCounter('allBillionaires', allBillionairesTotalUsd, scrollTop, vh);
}

function updateBarCounter(barId, maxWealth, scrollTop, vh) {
  const el = document.getElementById(barId);
  const counterEl = document.getElementById(barId + '-counter');
  if (!el || !counterEl) return;

  const barTop = el.offsetTop;
  const barBot = barTop + el.offsetHeight;

  if (scrollTop + vh < barTop + BAR_VISIBILITY_OFFSET_PX || scrollTop > barBot) {
    counterEl.textContent = '';
    return;
  }

  if (barId === 'richest') {
    const jk = document.querySelector('.comparison-just-kidding');
    if (jk && scrollTop + vh < jk.offsetTop) {
      counterEl.textContent = '';
      return;
    }
  }

  const wealth = Math.max(0, (scrollTop - barTop + COUNTER_SCROLL_OFFSET) * (currentBarWidth * DOLLARS_PER_PIXEL));
  counterEl.textContent = (wealth < maxWealth) ? money.format(wealth) : money.format(maxWealth);
}

// ─── Wealth Counter (time-based, Musk earnings since page open) ─────
function updateWealthCounter() {
  const el = document.getElementById('wealth-counter');
  if (!el) return;
  const elapsed = (Date.now() - pageOpenedAt) / 1000;
  el.textContent = money.format(Math.floor(WEALTH_COUNTER_PER_SECOND * elapsed));
}

// ─── Data Loading ───────────────────────────────────────────────────
function fetchWithFallback(path) {
  const opts = { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) };
  return fetch(path, opts).then(function(r) {
    if (r.ok) return r.json();
    return fetch('../' + path, opts).then(function(r2) {
      if (!r2.ok) throw new Error(path + ' not found');
      return r2.json();
    });
  });
}

function loadData() {
  Promise.all([
    fetchWithFallback('data/billionaires.json'),
    fetchWithFallback('data/story.json'),
  ])
    .then(function(results) { applyData(results[0], results[1]); })
    .catch(function(e) { console.warn('Could not load data:', e); });
}

function applyData(billionaireData, storyData) {
  if (!billionaireData || !Array.isArray(billionaireData.people) || billionaireData.people.length === 0) {
    throw new Error('Invalid billionaire data: expected object with non-empty people array');
  }
  if (!storyData || !Array.isArray(storyData.comparisons)) {
    throw new Error('Invalid story data: expected object with comparisons array');
  }

  story = storyData;
  richestPersonWealthUsd = Number(billionaireData.people[0].wealthUsd);
  richestName = billionaireData.people[0].name;

  if (billionaireData.allBillionairesTotalUsd) {
    allBillionairesTotalUsd = Number(billionaireData.allBillionairesTotalUsd);
    billionaireCount = Number(billionaireData.allBillionairesCount || billionaireCount);
  } else {
    allBillionairesTotalUsd = Number(billionaireData.totalWealthUsd);
    billionaireCount = Number(billionaireData.count);
  }

  // Cache dynamic text lookup once
  scrollRateComp = story.comparisons.find(function(c) { return c.dynamic === 'scrollRate'; }) || null;

  applyDimensions(computeBarWidth());

  const richestTitle = document.getElementById('richest-title');
  if (richestTitle) {
    richestTitle.textContent = interpolate(
      tUI('richest-title', '{amount} (wealth of {name})'),
      { amount: money.format(richestPersonWealthUsd), name: richestName }
    );
  }

  const allTitle = document.getElementById('allBillionaires-title');
  if (allTitle) {
    allTitle.textContent = interpolate(
      tUI('all-billionaires-title', 'All the world\u2019s {count} billionaires ({amount})'),
      { count: thousand.format(billionaireCount), amount: formatCompactMoney(allBillionairesTotalUsd) }
    );
  }

  renderComparisons();

  // Re-layout after fonts are fully loaded (prevents mismeasured content on mobile)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function() {
      updateRectSizes();
      updateAllComparisonPositions();
    });
  }

  if (story.deathTicker && story.deathTicker.enabled) {
    startDeathTicker(story.deathTicker);
  } else {
    setInterval(updateWealthCounter, TICKER_UPDATE_MS);
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
    scrollRate: formatCompactMoney(currentBarWidth * DOLLARS_PER_PIXEL * SCROLL_RATE_PX),
    allBillionairesFormatted: formatCompactMoney(allBillionairesTotalUsd),
    billionaireCount: thousand.format(billionaireCount),
  };

  const groups = { richest: [], allBillionaires: [] };
  story.comparisons.forEach(function(c) {
    const barKey = c.bar || 'allBillionaires';
    if (groups[barKey]) groups[barKey].push(c);
  });

  // For the allBillionaires bar: filter, remap, and add cap message if needed
  const allComps = prepareAllBillionairesComparisons(groups.allBillionaires);

  if (richestContainer) {
    richestContainer.innerHTML = '';
    renderGroup(groups.richest, richestContainer, richestPersonWealthUsd, templateVars);
  }
  if (allContainer) {
    allContainer.innerHTML = '';
    renderGroup(allComps, allContainer, allBillionairesTotalUsd, templateVars);
  }
}

function prepareAllBillionairesComparisons(comparisons) {
  if (!isCapped) return comparisons;

  // Filter out comparisons beyond the capped portion
  const visible = comparisons.filter(function(c) {
    return c.positionFraction <= cappedFraction;
  });

  // Remap fractions to capped bar coordinates
  const remapped = visible.map(function(c) {
    const copy = {};
    for (const key in c) {
      if (c.hasOwnProperty(key)) copy[key] = c[key];
    }
    copy.positionFraction = c.positionFraction / cappedFraction;
    return copy;
  });

  // Add the "browser broke" message near the bottom
  const remainingWealth = allBillionairesTotalUsd * (1 - cappedFraction);
  const brokeMessage = {
    id: 'browser-broke',
    bar: 'allBillionaires',
    type: 'text',
    positionFraction: 0.95,
    title: interpolate(
      tUI('browser-broke',
        '<strong>Even your browser can\'t handle this much money!</strong><br><br>' +
        'You\'ve scrolled through ~<strong>{pctReached}</strong> ' +
        'of their wealth and your device has reached its limit.' +
        'The remaining <strong>{pctRemaining}</strong> \u2014 about <strong>' +
        '{remainingFormatted}</strong> \u2014 simply can\'t be displayed.<br><br>' +
        '{totalFormatted}, a number too large for your browser to show. But not too large for {billionaireCount} billionaires to own!'
      ),
      {
        pctReached: fmtPct(pctReached),
        pctRemaining: fmtPct(100 - pctReached),
        remainingFormatted: formatCompactMoney(remainingWealth),
        totalFormatted: formatCompactMoney(allBillionairesTotalUsd),
        billionaireCount: thousand.format(billionaireCount)
      }
    )
  };
  remapped.push(brokeMessage);

  return remapped;
}

function renderGroup(comparisons, container, totalWealth, vars) {
  const fragment = document.createDocumentFragment();

  comparisons.forEach(function(comp) {
    const el = createComparisonElement(comp, totalWealth, vars);
    if (!el) return;

    if (typeof comp.positionFraction === 'number') {
      el.setAttribute('data-position-fraction', comp.positionFraction);
    }
    fragment.appendChild(el);
  });

  container.appendChild(fragment);

  // Re-layout after async image loads
  const images = container.querySelectorAll('img');
  for (let i = 0; i < images.length; i++) {
    images[i].addEventListener('load', function() {
      updateComparisonPositions(container);
    }, { once: true });
  }

  updateComparisonPositions(container);
}

// ─── Comparison Positioning ─────────────────────────────────────────
function getComparisonContentHeightPx(itemEl) {
  const contentEl = itemEl.querySelector(
    '.cause-card, .summary-card, .comparison-image-wrapper, .comparison-rect-wrapper, .title'
  );
  if (!contentEl) return 0;
  const rect = contentEl.getBoundingClientRect();
  if (!rect || !Number.isFinite(rect.height)) return 0;
  return Math.max(0, Math.ceil(rect.height));
}

function updateComparisonPositions(container) {
  const barEl = container.closest('.wealth') || container.parentElement;
  const barH = barEl ? barEl.offsetHeight : 0;
  if (barH <= 0) return;

  const items = container.querySelectorAll('[data-position-fraction]');
  if (items.length === 0) return;

  const fracs = [];
  for (let i = 0; i < items.length; i++) {
    fracs.push(parseFloat(items[i].getAttribute('data-position-fraction')) || 0);
  }

  // Use offsetTop (layout-relative) instead of getBoundingClientRect (viewport-relative)
  const headerOffset = container.offsetTop - barEl.offsetTop;
  const stableVh = getStableVh();

  let lastBottom = headerOffset;
  for (let i = 0; i < items.length; i++) {
    const targetPx = Math.max(headerOffset, Math.round(fracs[i] * barH));
    const nextTargetPx = (i + 1 < fracs.length)
      ? Math.round(fracs[i + 1] * barH)
      : barH;
    const minGapPx = Math.round(stableVh * MIN_COMPARISON_GAP_VH);
    const contentHeightPx = getComparisonContentHeightPx(items[i]);
    const requiredHeightPx = contentHeightPx + MIN_COMPARISON_CONTENT_PADDING_PX;
    const targetHeightPx = Math.max(minGapPx, nextTargetPx - targetPx);
    const gapHeight = Math.max(requiredHeightPx, targetHeightPx);

    const topPx = Math.max(targetPx, lastBottom);
    const diff = Math.max(0, topPx - lastBottom);
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

// ─── Rect Sizing (squares) ──────────────────────────────────────────
function computeRectDimensions(amountUsd) {
  const areaPixels = amountUsd / DOLLARS_PER_PIXEL;
  const maxWidth = Math.min(currentBarWidth * MAX_SQUARE_WIDTH_FRACTION, window.innerWidth * 0.9);
  const side = Math.sqrt(areaPixels);
  if (side <= maxWidth) return { width: side, height: side };
  return { width: maxWidth, height: areaPixels / maxWidth };
}

function getRectSizeClass(dims) {
  if (dims.height < MIN_RECT_HEIGHT_FOR_INNER_TEXT || dims.width < MIN_RECT_WIDTH_FOR_INNER_TEXT) return 'small';
  if (dims.height > window.innerHeight || dims.width > window.innerWidth) return 'large';
  return 'medium';
}

function updateRectSizes() {
  const rects = document.querySelectorAll('.comparison-rect[data-amount-usd]');
  for (let i = 0; i < rects.length; i++) {
    const amountUsd = parseFloat(rects[i].getAttribute('data-amount-usd'));
    if (!amountUsd || amountUsd <= 0) continue;
    const dims = computeRectDimensions(amountUsd);
    rects[i].style.width = dims.width.toFixed(1) + 'px';
    rects[i].style.height = dims.height.toFixed(1) + 'px';

    const wrapper = rects[i].closest('.comparison-rect-wrapper');
    if (!wrapper) continue;
    const label = wrapper.querySelector('.comparison-rect-label');
    const sizeClass = getRectSizeClass(dims);
    wrapper.classList.remove('comparison-rect-large', 'comparison-rect-medium');

    if (sizeClass === 'small') {
      if (label && label.parentElement === rects[i]) {
        wrapper.insertBefore(label, rects[i]);
      }
    } else {
      if (label && label.parentElement !== rects[i]) {
        rects[i].appendChild(label);
      }
      if (sizeClass === 'large') wrapper.classList.add('comparison-rect-large');
      else wrapper.classList.add('comparison-rect-medium');
    }
  }
}

// ─── Dynamic Text Updates ───────────────────────────────────────────
function updateDynamicText() {
  if (!scrollRateComp) return;
  const els = document.querySelectorAll('[data-dynamic="scrollRate"]');
  const newRate = formatCompactMoney(currentBarWidth * DOLLARS_PER_PIXEL * SCROLL_RATE_PX);
  for (let i = 0; i < els.length; i++) {
    const titleEl = els[i].querySelector('.title');
    if (titleEl) {
      titleEl.innerHTML = interpolate(scrollRateComp.title, {
        richestName: richestName,
        scrollRate: newRate,
      });
    }
  }
}

// ─── Comparison Content Renderers ───────────────────────────────────
function renderTextContent(comp, vars) {
  return '<div class="title">' + interpolate(comp.title, vars) + '</div>';
}

function renderImageContent(comp, vars) {
  const alt = (comp.imageAlt || comp.title || '').replace(/"/g, '&quot;');
  let html = '<div class="comparison-image-wrapper">';
  if (comp.title) {
    html += '<div class="title">' + interpolate(comp.title, vars) + '</div>';
  }
  html += '<img class="comparison-image" src="' + comp.imageUrl + '" alt="' + alt + '">';
  html += '</div>';
  return html;
}

function renderSquareContent(comp, vars) {
  const titleHtml = interpolate(comp.title, vars);

  if (!comp.amountUsd || comp.amountUsd <= 0) {
    return '<div class="comparison-rect-wrapper"><span class="comparison-rect-label">' + titleHtml + '</span></div>';
  }

  const dims = computeRectDimensions(comp.amountUsd);
  const color = comp.squareColor || '#2196F3';
  const rectStyle = 'width:' + dims.width.toFixed(1) + 'px;height:' + dims.height.toFixed(1) + 'px;background-color:' + color;
  const sizeClass = getRectSizeClass(dims);

  if (sizeClass === 'large') {
    return '<div class="comparison-rect-wrapper comparison-rect-large">' +
      '<div class="comparison-rect" data-amount-usd="' + comp.amountUsd + '" style="' + rectStyle + '">' +
        '<span class="comparison-rect-label">' + titleHtml + '</span>' +
      '</div></div>';
  }
  if (sizeClass === 'medium') {
    return '<div class="comparison-rect-wrapper comparison-rect-medium">' +
      '<div class="comparison-rect" data-amount-usd="' + comp.amountUsd + '" style="' + rectStyle + '">' +
        '<span class="comparison-rect-label">' + titleHtml + '</span>' +
      '</div></div>';
  }
  return '<div class="comparison-rect-wrapper">' +
    '<span class="comparison-rect-label">' + titleHtml + '</span>' +
    '<div class="comparison-rect" data-amount-usd="' + comp.amountUsd + '" style="' + rectStyle + '"></div>' +
  '</div>';
}

function renderPieChartHtml(pct, pctStr) {
  return '<div class="cause-pie">' +
    '<svg class="piechart-outer" viewBox="0 0 32 32">' +
      '<circle class="piechart-inner" r="16" cx="16" cy="16" style="stroke-dasharray:' + pct.toFixed(2) + ' 100"/>' +
    '</svg>' +
    '<span class="pie-label">' + pctStr + '</span>' +
  '</div>';
}

function renderCauseContent(comp, totalWealth) {
  const pct = (comp.costUsd / totalWealth) * 100;
  const pctStr = fmtPct(pct);

  let html = '<div class="cause-card">';
  html += renderPieChartHtml(pct, pctStr);

  const costSuffix = comp.costPeriod === 'yearly'
    ? tUI('cost-yearly', '/year')
    : tUI('cost-total', ' total');
  const ofAllBillionaires = tUI('of-all-billionaire-wealth', 'of all billionaire wealth');

  html += '<div class="cause-content">' +
    '<h3 class="cause-title">' + comp.title + '</h3>' +
    '<div class="cause-cost">' + formatCompactMoney(comp.costUsd) + costSuffix + ' \u2014 ' + pctStr + ' ' + ofAllBillionaires + '</div>' +
    '<p class="cause-desc">' + comp.description + '</p>';

  if (comp.deathsPerYear) {
    const perDay = Math.round(comp.deathsPerYear / 365);
    const deathLabel = comp.deathLabel || tUI('deaths', 'deaths');
    html += '<div class="cause-deaths">' +
      '<strong>' + thousand.format(perDay) + '</strong> ' + deathLabel + ' ' + tUI('per-day', 'per day') + ' \u2014 ' +
      '<strong>' + thousand.format(comp.deathsPerYear) + '</strong> ' + tUI('per-year', 'per year') +
    '</div>';
  }

  if (comp.sourceUrl) {
    html += '<div class="cause-source">' + tUI('source', 'Source') + ': <a href="' + comp.sourceUrl + '" target="_blank" rel="noopener noreferrer">' + (comp.sourceName || 'Link') + '</a></div>';
  }

  html += '</div></div>';
  return html;
}

function renderBarChartHtml(items, totalCost) {
  let html = '<div class="side-by-side-chart">';
  items.forEach(function(item) {
    const widthPct = Math.max(1, (item.cost / totalCost) * 100);
    html += '<div class="bar-row">' +
      '<span class="bar-label">' + item.title + '</span>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + widthPct.toFixed(1) + '%"></div></div>' +
      '<span class="bar-amount">' + formatCompactMoney(item.cost) + '</span>' +
    '</div>';
  });
  html += '</div>';
  return html;
}

function renderSummaryContent(comp, totalWealth) {
  const ids = comp.includeIds || [];
  let totalCost = 0;
  const items = [];
  if (story.comparisons) {
    story.comparisons.forEach(function(c) {
      if (ids.indexOf(c.id) !== -1 && c.costUsd) {
        totalCost += c.costUsd;
        items.push({ title: t(c.i18nKey, c.title), cost: c.costUsd });
      }
    });
  }
  const summaryPct = (totalCost / totalWealth) * 100;
  const ofAllBillionaires = tUI('of-all-billionaire-wealth', 'of all billionaire wealth');

  let html = '<div class="summary-card">';
  html += '<h3 class="cause-title">' + comp.title + '</h3>';
  html += '<p class="cause-desc">' + comp.description + '</p>';
  html += renderBarChartHtml(items, totalCost);

  html += '<div class="summary-total">' +
    '<strong>' + tUI('total', 'Total') + ': ' + formatCompactMoney(totalCost) + '</strong> \u2014 ' + fmtPct(summaryPct) + ' ' + ofAllBillionaires +
  '</div>';

  html += '<div class="cause-pie summary-pie">' +
    '<svg class="piechart-outer" viewBox="0 0 32 32">' +
      '<circle class="piechart-inner" r="16" cx="16" cy="16" style="stroke-dasharray:' + summaryPct.toFixed(2) + ' 100"/>' +
    '</svg>' +
    '<span class="pie-label">' + fmtPct(summaryPct) + '</span>' +
  '</div>';

  html += '</div>';
  return html;
}

function createComparisonElement(comp, totalWealth, vars) {
  comp = localizeComp(comp);
  const wrapper = document.createElement('div');
  wrapper.className = 'infobox comparison-' + comp.id;

  switch (comp.type) {
    case 'text':
      wrapper.classList.add('text-infobox');
      if (comp.dynamic) wrapper.setAttribute('data-dynamic', comp.dynamic);
      wrapper.innerHTML = renderTextContent(comp, vars);
      break;
    case 'square':
      wrapper.classList.add('text-infobox');
      wrapper.innerHTML = renderSquareContent(comp, vars);
      break;
    case 'cause':
      wrapper.classList.add('text-infobox', 'cause-infobox');
      wrapper.innerHTML = renderCauseContent(comp, totalWealth);
      break;
    case 'summary':
      wrapper.classList.add('text-infobox', 'summary-infobox');
      wrapper.innerHTML = renderSummaryContent(comp, totalWealth);
      break;
    case 'image':
      wrapper.classList.add('text-infobox', 'image-infobox');
      wrapper.innerHTML = renderImageContent(comp, vars);
      break;
    default:
      wrapper.classList.add('text-infobox');
      wrapper.innerHTML = renderTextContent(comp, vars);
  }

  return wrapper;
}

// ─── Death Ticker ───────────────────────────────────────────────────
function getTickerItemLabel(comp) {
  const raw = comp.tickerDescription || comp.deathLabel || comp.title || '';
  return String(raw).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function startDeathTicker() {
  const tickerEl = document.getElementById('death-ticker');
  const countsEl = document.getElementById('death-ticker-counts');
  const closeBtn = document.getElementById('death-ticker-close');
  const reopenBtn = document.getElementById('death-ticker-reopen');
  if (!tickerEl || !countsEl || !closeBtn || !reopenBtn) return;

  var tickerLabel = tickerEl.querySelector('.death-ticker-label');
  if (tickerLabel) {
    tickerLabel.textContent = tUI('preventable-deaths-label', 'PREVENTABLE DEATHS SINCE YOU OPENED THIS PAGE:');
  }

  // Build groups from comparisons that have both deathsPerYear and tickerGroup
  const groups = {};
  const groupOrder = [];
  if (story && story.comparisons) {
    story.comparisons.forEach(function(c) {
      if (!c.deathsPerYear || !c.tickerGroup) return;
      var lc = localizeComp(c);  // ← localize here
      if (!groups[c.tickerGroup]) {
        groups[c.tickerGroup] = [];
        groupOrder.push(c.tickerGroup);
      }
      groups[c.tickerGroup].push({
        label: getTickerItemLabel(lc),
        perSecond: c.deathsPerYear / (365.25 * 24 * 3600),
      });
    });
  }

  if (groupOrder.length === 0) return;

  const groupCauseText = {};
  groupOrder.forEach(function(groupName) {
    groupCauseText[groupName] = '(' + groups[groupName].map(function(item) { return item.label; }).join(', ') + ')';
  });

  const firstGroupComp = story.comparisons.find(function(c) { return c.tickerGroup && c.deathsPerYear; });
  const triggerEl = firstGroupComp ? document.querySelector('.comparison-' + firstGroupComp.id) : null;

  function checkVisibility() {
    if (!triggerEl) return;
    const scrollTop = window.scrollY || window.pageYOffset || 0;
    if (tickerEl.dataset.minimized === 'true') {
      tickerEl.hidden = true;
      return;
    }
    tickerEl.hidden = !(scrollTop + getStableVh() > triggerEl.offsetTop);
  }

  window.addEventListener('scroll', checkVisibility);
  checkVisibility();

  function translateGroupName(name) {
    return t('i18n-ticker-group-' + name.toLowerCase().replace(/ /g, '-'), name);
  }

  function update() {
    const elapsed = (Date.now() - pageOpenedAt) / 1000;
    let grandTotal = 0;
    let html = '';

    groupOrder.forEach(function(groupName) {
      let groupTotal = 0;
      groups[groupName].forEach(function(r) {
        groupTotal += Math.floor(r.perSecond * elapsed);
      });
      grandTotal += groupTotal;
      html += '<div class="ticker-group">' +
        '<div class="ticker-row ticker-group-total">' +
          '<span class="ticker-count ticker-count-group">' + thousand.format(groupTotal) + '</span>' +
          '<span class="ticker-label ticker-label-group">' + translateGroupName(groupName) + '</span>' +
        '</div>' +
        '<div class="ticker-group-causes">' + groupCauseText[groupName] + '</div>' +
      '</div>';
    });

    html += '<div class="ticker-row ticker-total">' +
      '<span class="ticker-count">' + thousand.format(grandTotal) + '</span>' +
      '<span class="ticker-label">' + tUI('total-preventable-deaths', 'total preventable deaths') + '</span>' +
    '</div>';
    countsEl.innerHTML = html;
  }

  update();
  if (tickerIntervalId) clearInterval(tickerIntervalId);
  tickerIntervalId = setInterval(function() {
    update();
    updateWealthCounter();
  }, TICKER_UPDATE_MS);

  closeBtn.onclick = function() {
    tickerEl.dataset.minimized = 'true';
    tickerEl.hidden = true;
    reopenBtn.style.display = 'flex';
  };
  reopenBtn.onclick = function() {
    tickerEl.dataset.minimized = 'false';
    tickerEl.hidden = false;
    reopenBtn.style.display = 'none';
    checkVisibility();
  };
  reopenBtn.style.display = 'none';
}

// ─── Init ───────────────────────────────────────────────────────────
applyDimensions(computeBarWidth());

let resizeRafId = null;
window.addEventListener('resize', function() {
  if (resizeRafId) cancelAnimationFrame(resizeRafId);
  resizeRafId = requestAnimationFrame(function() {
    resizeRafId = null;
    const scrollTop = window.scrollY || window.pageYOffset || 0;

    let anchor = null;
    const richestEl = document.getElementById('richest');
    const allEl = document.getElementById('allBillionaires');

    if (richestEl && scrollTop >= richestEl.offsetTop && scrollTop < richestEl.offsetTop + richestEl.offsetHeight) {
      anchor = { id: 'richest', frac: (scrollTop - richestEl.offsetTop) / richestEl.offsetHeight };
    } else if (allEl && scrollTop >= allEl.offsetTop && scrollTop < allEl.offsetTop + allEl.offsetHeight) {
      anchor = { id: 'allBillionaires', frac: (scrollTop - allEl.offsetTop) / allEl.offsetHeight };
    }

    prevCappedFraction = cappedFraction;
    applyDimensions(computeBarWidth());
    updateRectSizes();
    updateDynamicText();

    // Re-render comparisons if capping state changed
    if (cappedFraction !== prevCappedFraction) {
      renderComparisons();
    } else {
      updateAllComparisonPositions();
    }

    if (anchor) {
      const el = document.getElementById(anchor.id);
      if (el) window.scrollTo(0, el.offsetTop + anchor.frac * el.offsetHeight);
    }
  });
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