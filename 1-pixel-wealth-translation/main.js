var richest = document.getElementById('richest');
var richest_counter = document.getElementById('richest-counter');
var richestCounterStart = document.getElementById('richest-counter-start');

var top200 = document.getElementById('top200');
var top200_counter = document.getElementById('top200-counter');
var top200_counter_start = document.getElementById('top200-counter-start');

var sixtyPercent = document.getElementById('sixty-percent');
var sixtyPercentIndicator = document.getElementById('sixty-percent-indicator');
var sixtyPercentScrollPercentage = 0.0;
var babies = document.getElementById('babies-wrapper');
var baby_counter = document.getElementById('baby-counter');

var thousand = new Intl.NumberFormat('en-US')
var money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

var richestPersonWealthUsd = 139000000000;  // updated from data/billionaires.json
var top200WealthUsd        = 5920000000000; // updated from data/billionaires.json
var currentBarWidth        = 500;           // updated on load and resize

function computeBarWidth() {
  // clientWidth excludes the scrollbar, giving the true usable content width
  var em = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Math.max(200, Math.floor(document.documentElement.clientWidth - 2 * em));
}

function applyDimensions(barWidth) {
  currentBarWidth = barWidth;
  // The $1B bar is capped at 1000px wide so it never becomes wider than tall
  var billionBarWidth = Math.min(barWidth, 1000);
  var billionH = Math.round(1e9 / (billionBarWidth * 1000));
  var richestH = Math.round(richestPersonWealthUsd / (barWidth * 1000));
  var top200H  = Math.round(top200WealthUsd        / (barWidth * 1000));
  var scale    = richestH / 278000; // proportional to original Bezos bar
  var root     = document.documentElement.style;
  root.setProperty('--bar-width',              barWidth          + 'px');
  root.setProperty('--bar-width-billion',      billionBarWidth   + 'px');
  root.setProperty('--billion-h',              billionH   + 'px');
  root.setProperty('--richest-h',              richestH   + 'px');
  root.setProperty('--top200-h',               top200H    + 'px');
  root.setProperty('--infobox-margin',         Math.round(6000  * scale) + 'px');
  root.setProperty('--infobox-first-margin',   Math.round(15000 * scale) + 'px');
  root.setProperty('--infobox-half-margin',    Math.round(4000  * scale) + 'px');
  root.setProperty('--infobox-quarter-margin', Math.round(2000  * scale) + 'px');
  root.setProperty('--infobox-close-margin',   Math.round(500   * scale) + 'px');
  // update scale label: 160px tall × barWidth px wide × $1000/px² = scale value in $
  var scaleText = formatCompactMoney(160 * barWidth * 1000);
  var scaleEls = document.querySelectorAll('.scale-label');
  for (var i = 0; i < scaleEls.length; i++) { scaleEls[i].textContent = scaleText; }
  // update 'every 10 pixels' text
  var pixelsEl = document.getElementById('pixels-value-text');
  if (pixelsEl) {
    pixelsEl.textContent = 'Every 10 pixels you scroll is ' + formatCompactMoney(barWidth * 10000) + '.';
  }
}

function formatCompactMoney(n) {
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2).replace(/\.?0+$/, '') + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  return money.format(n);
}

function applyBillionaireData(data) {
  richestPersonWealthUsd = Number(data.people[0].wealthUsd);
  top200WealthUsd        = Number(data.totalWealthUsd);
  var richestName = data.people[0].name;

  // recompute all heights for current bar width
  applyDimensions(computeBarWidth());

  // Update section titles
  var richestTitle = document.getElementById('richest-title');
  if (richestTitle) richestTitle.textContent = money.format(richestPersonWealthUsd) + ' (wealth of ' + richestName + ')';

  var top200Title = document.getElementById('top200-title');
  if (top200Title) top200Title.textContent = '200 richest people worldwide (' + formatCompactMoney(top200WealthUsd) + ')';

  // Update richest-person intro blurb
  var richestIntro = document.getElementById('richest-intro-text');
  if (richestIntro) richestIntro.textContent = richestName + '\u2019s wealth is quite literally unimaginable.';

  // Update chemo comparison text
  var chemoText = document.getElementById('richest-chemo-text');
  if (chemoText) {
    var dailyWealth = Math.round(richestPersonWealthUsd / 365);
    chemoText.textContent = richestName + ' earns approximately ' + formatCompactMoney(dailyWealth) + ' per day.';
  }

  // Update top-200 intro
  var top200Intro = document.getElementById('top200-intro-text');
  if (top200Intro) top200Intro.textContent = 'The wealth of the richest person may seem staggering, but it is a drop in the ocean compared to the combined wealth of the 200 richest people worldwide. Together they own ' + formatCompactMoney(top200WealthUsd) + '.';

  // Source attribution
  var sourceEl = document.getElementById('data-source');
  if (sourceEl) {
    var d = new Date(data.fetchedAt);
    var dateStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    sourceEl.innerHTML = 'Wealth data: <a href="' + data.sourceUrl + '" target="_blank" rel="noreferrer">' + data.source + '</a> &mdash; last updated ' + dateStr;
  }

  // Update pie chart percentages and related text — all values relative to top200WealthUsd
  updateTop200Percentages();
}

// Fixed real-world program costs (USD)
var COST_TESTING    = 100e9;           // $100B  – COVID testing
var COST_MALARIA    = 100e9;           // $100B  – malaria eradication
var COST_STIMULUS   = 128e6 * 1200;   // $153.6B – $1,200 per US household
var COST_POVERTY    = 170e9;           // $170B  – lift Americans out of poverty
var COST_TAX_REFUND = 200e9;          // $200B  – refund 2018 taxes < $80K
var COST_CLEAN_WATER= 240e9;          // $240B  – clean water for all
var COST_10K        = 128e6 * 10000;  // $1.28T – $10K per US household

function fmtPct(n) {
  if (n >= 10) return Math.round(n) + '%';
  if (n >= 1)  return n.toFixed(1) + '%';
  return n.toFixed(2) + '%';
}

function updateTop200Percentages() {
  var total = top200WealthUsd;
  var group = '200 richest people worldwide';

  function pct(cost) { return cost / total * 100; }

  var pTesting   = pct(COST_TESTING);
  var pMalaria   = pct(COST_MALARIA);
  var pStimulus  = pct(COST_STIMULUS);
  var pPoverty   = pct(COST_POVERTY);
  var pTaxRefund = pct(COST_TAX_REFUND);
  var pCleanWater= pct(COST_CLEAN_WATER);
  var p10K       = pct(COST_10K);
  var pAll       = pTesting + pMalaria + pStimulus + pPoverty + pTaxRefund + pCleanWater + p10K;

  // Helper: update a piechart element's label and SVG slice
  function setPie(id, p) {
    var el = document.getElementById(id);
    if (!el) return;
    var labelEl = el.querySelector('.label');
    if (labelEl) labelEl.textContent = fmtPct(p);
    var circle = el.querySelector('.piechart-inner');
    if (circle) circle.style.strokeDasharray = p + ' 100';
  }

  // Helper: update a "What could we do with X%?" heading
  function setHeading(id, p) {
    var el = document.getElementById(id);
    if (el) el.textContent = 'What could we do with ' + fmtPct(p) + ' of this money?';
  }

  // Helper: update an inline percentage span with group name
  function setInline(id, p) {
    var el = document.getElementById(id);
    if (el) el.textContent = fmtPct(p) + ' of the wealth of the ' + group;
  }

  setPie('piechart-testing',   pTesting);
  setPie('piechart-malaria',   pMalaria);
  setPie('piechart-stimulus',  pStimulus);
  setPie('piechart-poverty',   pPoverty);
  setPie('piechart-taxrefund', pTaxRefund);
  setPie('piechart-cleanwater',pCleanWater);
  setPie('piechart-tenk',      p10K);

  setHeading('heading-pct-small',     pTesting);   // covers testing + malaria (same cost)
  setHeading('heading-pct-medium',    Math.max(pStimulus, pPoverty));
  setHeading('heading-pct-taxrefund', pTaxRefund);
  setHeading('heading-pct-cleanwater',pCleanWater);
  setHeading('heading-pct-tenk',      p10K);
  setHeading('heading-pct-all',       pAll);

  setInline('inline-pct-testing',   pTesting);
  setInline('inline-pct-malaria',   pMalaria);
  setInline('inline-pct-poverty',   pPoverty);
  setInline('inline-pct-cleanwater',pCleanWater);
  setInline('inline-pct-tenk',      p10K);
}

// Fetch billionaires.json — tries local first, then parent dir (for /de/ page)
(function loadBillionaireData() {
  fetch('data/billionaires.json')
    .then(function(r) {
      if (r.ok) return r.json();
      return fetch('../data/billionaires.json').then(function(r2) {
        if (r2.ok) return r2.json();
        throw new Error('billionaires.json not found');
      });
    })
    .then(applyBillionaireData)
    .catch(function(e) { console.warn('Could not load billionaire data:', e); });
}());

// Apply dimensions on load and on every resize
applyDimensions(computeBarWidth());
window.addEventListener('resize', function() { applyDimensions(computeBarWidth()); });

//todo: also work for 400 richest
window.addEventListener('scroll', function(){
  update_wealth_counter();
});

function generate_sixty_percent() {
  for (var i = 0; i < 100; i++) {
    var node = document.createElement("div");
    node.classList = "people";
    if (i === 0) {
      node.classList += " first";
    }
    document.getElementById("sixty-percent").appendChild(node);
  }
}
generate_sixty_percent();

sixtyPercent.addEventListener('scroll', function(){
  let newScroll = ((sixtyPercent.scrollTop / sixtyPercent.scrollHeight) * 60).toFixed(1);
  if (sixtyPercentScrollPercentage !== newScroll) {
    sixtyPercentScrollPercentage = newScroll;
    sixtyPercentIndicator.innerHTML = newScroll + '%';
  }
})
babies.addEventListener('scroll', function(){
  let is_mobile = window.innerWidth <= 450;
  let bg_size = (is_mobile) ? 68 : 160;
  baby_counter.innerHTML = thousand.format(Math.floor(babies.scrollTop / bg_size * 5));
})

//Todo: stop executing once scrolled past
function update_wealth_counter() {
  var scrollTop = window.scrollY || window.pageYOffset || 0;
  if (richest_viewable()) {
    if (richest_counter_viewable()) {
      let wealth = (scrollTop - richest.offsetTop + 175) * (currentBarWidth * 1000);
      richest_counter.innerHTML = (wealth < richestPersonWealthUsd) ? money.format(wealth) : money.format(richestPersonWealthUsd);
    }
    else {
      richest_counter.innerHTML = '';
    }
  }
  else if (top200_viewable()) {
    if (top200_counter_viewable()) {
      let wealth = (scrollTop - top200.offsetTop + 175) * (currentBarWidth * 1000);
      top200_counter.innerHTML = (wealth < top200WealthUsd) ? money.format(wealth) : money.format(top200WealthUsd);
    }
    else {
      top200_counter.innerHTML = '';
    }
  }
  function richest_viewable() {
    return scrollTop < richest.offsetTop + richest.offsetHeight + 100;
  }
  function richest_counter_viewable() {
    return richestCounterStart.offsetTop - scrollTop < (window.innerHeight);
  }
  function top200_viewable() {
    return scrollTop < top200.offsetTop + top200.offsetHeight + 100;
  }
  function top200_counter_viewable() {
    return top200_counter_start.offsetTop - scrollTop < (window.innerHeight);
  }
}
function toggleZoom() {
  document.getElementById('line-chart').classList.toggle('zoom');
}
