const richest = document.getElementById('richest');
const richest_counter = document.getElementById('richest-counter');
const richestCounterStart = document.getElementById('richest-counter-start');

const top200 = document.getElementById('top200');
const top200_counter = document.getElementById('top200-counter');
const top200_counter_start = document.getElementById('top200-counter-start');

const sixtyPercent = document.getElementById('sixty-percent');
const sixtyPercentIndicator = document.getElementById('sixty-percent-indicator');
let sixtyPercentScrollPercentage = 0.0;
const babies = document.getElementById('babies-wrapper');
const baby_counter = document.getElementById('baby-counter');

const thousand = new Intl.NumberFormat('en-US')
const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

let richestPersonWealthUsd = 139000000000;
let top200WealthUsd        = 5920000000000;
let currentBarWidth        = 500;

function computeBarWidth() {
  // clientWidth excludes the scrollbar, giving the true usable content width
  const em = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Math.max(200, Math.floor(document.documentElement.clientWidth - 2 * em));
}

function applyDimensions(barWidth) {
  currentBarWidth = barWidth;
  // The $1B bar is capped at 1000px wide so it never becomes wider than tall
  const billionBarWidth = Math.min(barWidth, 1000);
  const billionH = Math.round(1e9 / (billionBarWidth * 1000));
  const richestH = Math.round(richestPersonWealthUsd / (barWidth * 1000));
  const top200H  = Math.round(top200WealthUsd        / (barWidth * 1000));
  const scale    = richestH / 278000; // proportional to original Bezos bar
  const root     = document.documentElement.style;
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
  const scaleText = formatCompactMoney(160 * barWidth * 1000);
  const scaleEls = document.querySelectorAll('.scale-label');
  for (let i = 0; i < scaleEls.length; i++) { scaleEls[i].textContent = scaleText; }
  // update 'every 10 pixels' text
  const pixelsEl = document.getElementById('pixels-value-text');
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
  const richestName = data.people[0].name;

  // recompute all heights for current bar width
  applyDimensions(computeBarWidth());

  // Update section titles
  const richestTitle = document.getElementById('richest-title');
  if (richestTitle) richestTitle.textContent = money.format(richestPersonWealthUsd) + ' (wealth of ' + richestName + ')';

  const top200Title = document.getElementById('top200-title');
  if (top200Title) top200Title.textContent = '200 richest people worldwide (' + formatCompactMoney(top200WealthUsd) + ')';

  // Update richest-person intro blurb
  const richestIntro = document.getElementById('richest-intro-text');
  if (richestIntro) richestIntro.textContent = richestName + '\u2019s wealth is quite literally unimaginable.';

  // Update chemo comparison text
  const chemoText = document.getElementById('richest-chemo-text');
  if (chemoText) {
    const dailyWealth = Math.round(richestPersonWealthUsd / 365);
    chemoText.textContent = richestName + ' earns approximately ' + formatCompactMoney(dailyWealth) + ' per day.';
  }

  // Update top-200 intro
  const top200Intro = document.getElementById('top200-intro-text');
  if (top200Intro) top200Intro.textContent = 'The wealth of the richest person may seem staggering, but it is a drop in the ocean compared to the combined wealth of the 200 richest people worldwide. Together they own ' + formatCompactMoney(top200WealthUsd) + '.';

  // Source attribution
  const sourceEl = document.getElementById('data-source');
  if (sourceEl) {
    const d = new Date(data.fetchedAt);
    const dateStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    sourceEl.innerHTML = 'Wealth data: <a href="' + data.sourceUrl + '" target="_blank" rel="noopener noreferrer">' + data.source + '</a> &mdash; last updated ' + dateStr;
  }

  // Update pie chart percentages and related text — all values relative to top200WealthUsd
  updateTop200Percentages();
}

// Fixed real-world program costs (USD)
const COST_TESTING    = 100e9;           // $100B  – COVID testing
const COST_MALARIA    = 100e9;           // $100B  – malaria eradication
const COST_STIMULUS   = 128e6 * 1200;   // $153.6B – $1,200 per US household
const COST_POVERTY    = 170e9;           // $170B  – lift Americans out of poverty
const COST_TAX_REFUND = 200e9;          // $200B  – refund 2018 taxes < $80K
const COST_CLEAN_WATER= 240e9;          // $240B  – clean water for all
const COST_10K        = 128e6 * 10000;  // $1.28T – $10K per US household

function fmtPct(n) {
  if (n >= 10) return Math.round(n) + '%';
  if (n >= 1)  return n.toFixed(1) + '%';
  return n.toFixed(2) + '%';
}

// Helpers for updateTop200Percentages — defined at module scope to avoid re-creation
function setPie(id, p) {
  const el = document.getElementById(id);
  if (!el) return;
  const labelEl = el.querySelector('.label');
  if (labelEl) labelEl.textContent = fmtPct(p);
  const circle = el.querySelector('.piechart-inner');
  if (circle) circle.style.strokeDasharray = p + ' 100';
}

function setHeading(id, p) {
  const el = document.getElementById(id);
  if (el) el.textContent = 'What could we do with ' + fmtPct(p) + ' of this money?';
}

function setInline(id, p, group) {
  const el = document.getElementById(id);
  if (el) el.textContent = fmtPct(p) + ' of the wealth of the ' + group;
}

function updateTop200Percentages() {
  const total = top200WealthUsd;
  const group = '200 richest people worldwide';

  const pct = (cost) => cost / total * 100;

  const pTesting   = pct(COST_TESTING);
  const pMalaria   = pct(COST_MALARIA);
  const pStimulus  = pct(COST_STIMULUS);
  const pPoverty   = pct(COST_POVERTY);
  const pTaxRefund = pct(COST_TAX_REFUND);
  const pCleanWater= pct(COST_CLEAN_WATER);
  const p10K       = pct(COST_10K);
  const pAll       = pTesting + pMalaria + pStimulus + pPoverty + pTaxRefund + pCleanWater + p10K;

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

  setInline('inline-pct-testing',   pTesting,    group);
  setInline('inline-pct-malaria',   pMalaria,    group);
  setInline('inline-pct-poverty',   pPoverty,    group);
  setInline('inline-pct-cleanwater',pCleanWater, group);
  setInline('inline-pct-tenk',      p10K,        group);
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

// Scroll handler throttled via requestAnimationFrame
let scrollRafScheduled = false;
window.addEventListener('scroll', function() {
  if (!scrollRafScheduled) {
    scrollRafScheduled = true;
    requestAnimationFrame(function() {
      update_wealth_counter();
      scrollRafScheduled = false;
    });
  }
});

function generate_sixty_percent() {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 100; i++) {
    const node = document.createElement("div");
    node.className = "people";
    if (i === 0) {
      node.className += " first";
    }
    fragment.appendChild(node);
  }
  document.getElementById("sixty-percent").appendChild(fragment);
}
generate_sixty_percent();

sixtyPercent.addEventListener('scroll', function() {
  const newScroll = ((sixtyPercent.scrollTop / sixtyPercent.scrollHeight) * 60).toFixed(1);
  if (sixtyPercentScrollPercentage !== newScroll) {
    sixtyPercentScrollPercentage = newScroll;
    sixtyPercentIndicator.textContent = newScroll + '%';
  }
});
babies.addEventListener('scroll', function() {
  const is_mobile = window.innerWidth <= 450;
  const bg_size = is_mobile ? 68 : 160;
  baby_counter.textContent = thousand.format(Math.floor(babies.scrollTop / bg_size * 5));
});

// Visibility helpers — defined at module scope to avoid re-creation on each scroll
function richest_viewable(scrollTop) {
  return scrollTop < richest.offsetTop + richest.offsetHeight + 100;
}
function richest_counter_viewable(scrollTop) {
  return richestCounterStart.offsetTop - scrollTop < window.innerHeight;
}
function top200_viewable(scrollTop) {
  return scrollTop < top200.offsetTop + top200.offsetHeight + 100;
}
function top200_counter_viewable(scrollTop) {
  return top200_counter_start.offsetTop - scrollTop < window.innerHeight;
}

function update_wealth_counter() {
  const scrollTop = window.scrollY || window.pageYOffset || 0;
  if (richest_viewable(scrollTop)) {
    if (richest_counter_viewable(scrollTop)) {
      const wealth = (scrollTop - richest.offsetTop + 175) * (currentBarWidth * 1000);
      richest_counter.textContent = (wealth < richestPersonWealthUsd) ? money.format(wealth) : money.format(richestPersonWealthUsd);
    } else {
      richest_counter.textContent = '';
    }
  } else if (top200_viewable(scrollTop)) {
    if (top200_counter_viewable(scrollTop)) {
      const wealth = (scrollTop - top200.offsetTop + 175) * (currentBarWidth * 1000);
      top200_counter.textContent = (wealth < top200WealthUsd) ? money.format(wealth) : money.format(top200WealthUsd);
    } else {
      top200_counter.textContent = '';
    }
  }
}

function toggleZoom() {
  document.getElementById('line-chart').classList.toggle('zoom');
}
