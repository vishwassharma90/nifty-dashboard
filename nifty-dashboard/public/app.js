// ===== Nifty 50 Dashboard App =====

let priceChart = null;
let intradayChart = null;
let previousPrice = null;
let refreshInterval = null;

function getCurrentSymbol() {
  const select = document.getElementById('symbol-select');
  return select ? select.value : '^NSEI';
}

// ===== Utility Functions =====
function formatNumber(num, decimals = 2) {
  if (num == null || isNaN(num)) return '--';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatVolume(num) {
  if (num == null || isNaN(num)) return '--';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e7) return (num / 1e7).toFixed(2) + 'Cr';
  if (num >= 1e5) return (num / 1e5).toFixed(2) + 'L';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}

// ===== Technical Indicators Math =====
function calculateSMA(data, period) {
  if (!data || data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(data, period) {
  if (!data || data.length < period) return null;
  const k = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i < data.length; i++) {
    ema = (data[i] * k) + (ema * (1 - k));
  }
  return ema;
}

function calculateRSI(data, period = 14) {
  if (!data || data.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    let diff = data[i] - data[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < data.length; i++) {
    let diff = data[i] - data[i - 1];
    avgGain = (avgGain * (period - 1) + (diff >= 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }
  return avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
}

function calculateMACD(data) {
  if (!data || data.length < 26) return { macdLine: null, signalLine: null };
  const ema12 = [];
  const ema26 = [];
  let e12 = data[0], e26 = data[0];
  const k12 = 2/13, k26 = 2/27;
  for (let i = 1; i < data.length; i++) {
    e12 = (data[i] - e12) * k12 + e12;
    e26 = (data[i] - e26) * k26 + e26;
    ema12.push(e12); ema26.push(e26);
  }
  const macdLineArr = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calculateEMA(macdLineArr, 9);
  return { macdLine: macdLineArr[macdLineArr.length - 1], signalLine };
}

function isMarketOpen() {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay();
  const hours = ist.getHours();
  const minutes = ist.getMinutes();
  const time = hours * 60 + minutes;

  // Market open: Mon-Fri, 9:15 AM - 3:30 PM IST
  if (day === 0 || day === 6) return false;
  return time >= 555 && time <= 930;
}

function updateMarketStatus() {
  const statusEl = document.getElementById('market-status');
  const statusText = statusEl.querySelector('.status-text');
  
  const symbol = getCurrentSymbol();
  if (!symbol.includes('.NS') && symbol !== '^NSEI' && symbol !== '^BSESN') {
    statusEl.style.display = 'none';
    return;
  }
  statusEl.style.display = 'flex';
  
  const open = isMarketOpen();

  if (open) {
    statusEl.classList.remove('closed');
    statusText.textContent = 'Market Open';
  } else {
    statusEl.classList.add('closed');
    statusText.textContent = 'Market Closed';
  }
}

function updateLastUpdated() {
  const el = document.getElementById('last-updated');
  const now = new Date();
  el.textContent = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

// ===== Chart Configuration =====
function getChartGradient(ctx, colorStart, colorEnd) {
  const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
  gradient.addColorStop(0, colorStart);
  gradient.addColorStop(1, colorEnd);
  return gradient;
}

function createPriceChart(labels, data, currencySymbol = '₹') {
  const canvas = document.getElementById('price-chart');
  const ctx = canvas.getContext('2d');

  const firstPrice = data[0];
  const lastPrice = data[data.length - 1];
  const isPositive = lastPrice >= firstPrice;

  const lineColor = isPositive ? '#10b981' : '#f43f5e';
  const fillStart = isPositive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)';
  const fillEnd = 'rgba(0, 0, 0, 0)';

  // Get the selected asset name for the label
  const select = document.getElementById('symbol-select');
  const assetName = select ? select.options[select.selectedIndex].text : 'Price';

  if (priceChart) {
    priceChart.destroy();
  }

  priceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: assetName,
        data: data,
        borderColor: lineColor,
        borderWidth: 2,
        fill: true,
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return fillStart;
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, fillStart);
          gradient.addColorStop(1, fillEnd);
          return gradient;
        },
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: lineColor,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 18, 30, 0.95)',
          titleColor: '#94a3b8',
          bodyColor: '#f1f5f9',
          borderColor: 'rgba(99, 102, 241, 0.2)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { family: "'Inter', sans-serif", size: 11, weight: '500' },
          bodyFont: { family: "'JetBrains Mono', monospace", size: 13, weight: '600' },
          displayColors: false,
          callbacks: {
            title: (items) => {
              const date = new Date(items[0].label);
              return date.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              });
            },
            label: (item) => `${currencySymbol} ${formatNumber(item.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            tooltipFormat: 'PP',
          },
          grid: {
            color: 'rgba(99, 102, 241, 0.04)',
            drawBorder: false,
          },
          ticks: {
            color: '#64748b',
            font: { family: "'Inter', sans-serif", size: 11 },
            maxTicksLimit: 10,
            maxRotation: 0,
          },
          border: { display: false }
        },
        y: {
          position: 'right',
          grid: {
            color: 'rgba(99, 102, 241, 0.04)',
            drawBorder: false,
          },
          ticks: {
            color: '#64748b',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: (v) => formatNumber(v, 0),
            maxTicksLimit: 8,
          },
          border: { display: false }
        }
      },
      animation: {
        duration: 800,
        easing: 'easeOutQuart',
      }
    }
  });
}

function createIntradayChart(labels, data) {
  const canvas = document.getElementById('intraday-chart');
  const ctx = canvas.getContext('2d');

  if (data.length === 0) return;

  const firstPrice = data[0];
  const lastPrice = data[data.length - 1];
  const isPositive = lastPrice >= firstPrice;

  const lineColor = isPositive ? '#10b981' : '#f43f5e';
  const fillStart = isPositive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)';

  if (intradayChart) {
    intradayChart.destroy();
  }

  intradayChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Price',
        data: data,
        borderColor: lineColor,
        borderWidth: 1.5,
        fill: true,
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return fillStart;
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, fillStart);
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          return gradient;
        },
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: lineColor,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 18, 30, 0.95)',
          titleColor: '#94a3b8',
          bodyColor: '#f1f5f9',
          borderColor: 'rgba(99, 102, 241, 0.2)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { family: "'Inter', sans-serif", size: 11 },
          bodyFont: { family: "'JetBrains Mono', monospace", size: 13, weight: '600' },
          displayColors: false,
          callbacks: {
            title: (items) => {
              const date = new Date(items[0].label);
              return date.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              });
            },
            label: (item) => `₹ ${formatNumber(item.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'hour',
            displayFormats: { hour: 'hh:mm a' },
          },
          grid: { color: 'rgba(99, 102, 241, 0.04)', drawBorder: false },
          ticks: {
            color: '#64748b',
            font: { family: "'Inter', sans-serif", size: 11 },
            maxTicksLimit: 8,
            maxRotation: 0,
          },
          border: { display: false }
        },
        y: {
          position: 'right',
          grid: { color: 'rgba(99, 102, 241, 0.04)', drawBorder: false },
          ticks: {
            color: '#64748b',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: (v) => formatNumber(v, 0),
            maxTicksLimit: 6,
          },
          border: { display: false }
        }
      },
      animation: { duration: 600, easing: 'easeOutQuart' }
    }
  });
}

// ===== Data Fetching =====
async function fetchHistoricalData(range = '10y', interval = '1wk') {
  const loadingEl = document.getElementById('chart-loading');
  loadingEl.classList.remove('hidden');

  try {
    const symbol = getCurrentSymbol();
    const response = await fetch(`/api/chart?range=${range}&interval=${interval}&symbol=${encodeURIComponent(symbol)}&t=${Date.now()}`);
    const data = await response.json();

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error('No data returned');
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    const closes = quotes.close;

    const labels = [];
    const prices = [];

    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] != null) {
        labels.push(new Date(timestamps[i] * 1000));
        prices.push(closes[i]);
      }
    }

    // Determine currency from result meta
    const chartMeta = result.meta || {};
    const chartCurrency = chartMeta.currency || 'INR';
    const chartCurrencySymbol = chartCurrency === 'USD' ? '$' : chartCurrency === 'INR' ? '₹' : chartCurrency + ' ';

    createPriceChart(labels, prices, chartCurrencySymbol);

    // Update chart footer stats
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const periodReturn = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(2);
    const periodHigh = Math.max(...prices);
    const periodLow = Math.min(...prices);

    const returnEl = document.getElementById('period-return');
    returnEl.textContent = `${periodReturn >= 0 ? '+' : ''}${periodReturn}%`;
    returnEl.style.color = periodReturn >= 0 ? '#10b981' : '#f43f5e';

    document.getElementById('period-high').textContent = `${chartCurrencySymbol}${formatNumber(periodHigh)}`;
    document.getElementById('period-low').textContent = `${chartCurrencySymbol}${formatNumber(periodLow)}`;
    document.getElementById('data-points').textContent = prices.length.toLocaleString();

  } catch (error) {
    console.error('Error fetching historical data:', error);
  } finally {
    loadingEl.classList.add('hidden');
  }
}

async function fetchIntradayData() {
  try {
    const symbol = getCurrentSymbol();
    const response = await fetch(`/api/chart?range=1d&interval=1m&symbol=${encodeURIComponent(symbol)}&t=${Date.now()}`);
    const data = await response.json();

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) return;

    const result = data.chart.result[0];
    const quotes = result.indicators ? result.indicators.quote[0] : {};
    const timestamps = result.timestamp || [];

    const intradayLabels = [];
    const intradayPrices = [];

    for (let i = 0; i < timestamps.length; i++) {
      if (quotes.close[i] != null) {
        intradayLabels.push(new Date(timestamps[i] * 1000));
        intradayPrices.push(quotes.close[i]);
      }
    }

    if (intradayPrices.length > 0) {
      createIntradayChart(intradayLabels, intradayPrices);
    }
  } catch (error) {
    console.error('Error fetching intraday data:', error);
  }
}

async function fetchLivePrice() {
  try {
    const symbol = getCurrentSymbol();
    const response = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}&t=${Date.now()}`);
    const data = await response.json();

    if (!data || data.error) {
      console.error('No live snapshot data');
      return;
    }

    // New structure from yahoo-finance2.quote() is a flat object
    const currentPrice = data.regularMarketPrice;
    const previousClose = data.regularMarketPreviousClose || data.previousClose;
    const change = data.regularMarketChange || (currentPrice - previousClose);
    const changePct = data.regularMarketChangePercent || (change / previousClose * 100);

    // Determine currency symbol based on asset
    const currency = data.currency || 'INR';
    const currencySymbol = currency === 'USD' ? '$' : currency === 'INR' ? '₹' : currency + ' ';

    // Update current price with flash animation
    const priceEl = document.getElementById('current-price');
    
    // Precise comparison to catch sub-decimal changes
    const hasChanged = previousPrice !== null && 
                      Math.abs(currentPrice - previousPrice) > 0.0001; 

    if (hasChanged) {
      priceEl.classList.remove('price-flash-up', 'price-flash-down');
      void priceEl.offsetWidth; // Force reflow
      priceEl.classList.add(currentPrice > previousPrice ? 'price-flash-up' : 'price-flash-down');
    }
    previousPrice = currentPrice;

    priceEl.textContent = formatNumber(currentPrice);

    // Update currency label
    const currencyLabel = document.querySelector('.currency-label');
    if (currencyLabel) {
      currencyLabel.textContent = currencySymbol;
    }

    // Update change
    const changeWrapper = document.getElementById('price-change-wrapper');
    const changeIcon = document.getElementById('change-icon');
    const changeValue = document.getElementById('change-value');
    const changePctEl = document.getElementById('price-change-pct');

    changeWrapper.className = `price-change-wrapper ${change >= 0 ? 'positive' : 'negative'}`;
    changeIcon.textContent = change >= 0 ? '▲' : '▼';
    changeValue.textContent = `${Math.abs(change).toFixed(2)}`;
    changePctEl.textContent = `${change >= 0 ? '+' : ''}${changePct.toFixed(2)}%`;

    // Always update stats from the snapshot (standard fields)
    const dayHigh = data.regularMarketDayHigh;
    const dayLow = data.regularMarketDayLow;
    const dayOpen = data.regularMarketOpen;
    const totalVolume = data.regularMarketVolume;

    // Update detail cards
    document.getElementById('price-open').textContent = dayOpen != null ? formatNumber(dayOpen) : '--';
    document.getElementById('price-high').textContent = dayHigh != null ? formatNumber(dayHigh) : '--';
    document.getElementById('price-low').textContent = dayLow != null ? formatNumber(dayLow) : '--';
    document.getElementById('price-prev-close').textContent = formatNumber(previousClose);

    document.getElementById('week52-high').textContent = data.fiftyTwoWeekHigh != null
      ? `${currencySymbol}${formatNumber(data.fiftyTwoWeekHigh)}` : '--';
    document.getElementById('week52-low').textContent = data.fiftyTwoWeekLow != null
      ? `${currencySymbol}${formatNumber(data.fiftyTwoWeekLow)}` : '--';
    document.getElementById('volume').textContent = totalVolume != null ? formatVolume(totalVolume) : '--';
    document.getElementById('day-range').textContent = (dayLow != null && dayHigh != null)
      ? `${formatNumber(dayLow, 0)} - ${formatNumber(dayHigh, 0)}` : '--';

    // Clear the intraday chart if we are only doing snapshot updates
    // (A separate background task will refresh the intraday chart intermittently)
    if (intradayChart && !hasChanged) {
       // Only clear if absolutely necessary, but normally we just leave it as is
    }

    updateLastUpdated();

  } catch (error) {
    console.error('Error fetching live data:', error);
  }
}

// ===== Analytical Features =====
function updateRecommendation(currentPrice, rsi, macdLine, signalLine, sma50, sma200) {
  let score = 0;
  let breakdown = [];
  
  // RSI (1 pt)
  let rsiScore = 0;
  if (rsi != null) {
    if (rsi < 30) rsiScore = 1; else if (rsi > 70) rsiScore = -1;
    score += rsiScore;
    breakdown.push({ label: 'RSI (14)', val: rsi.toFixed(1), score: rsiScore });
  }

  // MACD (2 pts)
  let macdScore = 0;
  if (macdLine != null && signalLine != null) {
    macdScore = macdLine > signalLine ? 2 : -2;
    score += macdScore;
    breakdown.push({ label: 'MACD Momentum', val: macdLine > signalLine ? 'Bull' : 'Bear', score: macdScore });
  }

  // SMA 50 (1 pt)
  let sma50Score = 0;
  if (sma50 != null) {
    sma50Score = currentPrice > sma50 ? 1 : -1;
    score += sma50Score;
    breakdown.push({ label: 'Trend (SMA50)', val: currentPrice > sma50 ? 'Above' : 'Below', score: sma50Score });
  }

  // SMA Cross (2 pts)
  let crossScore = 0;
  if (sma50 != null && sma200 != null) {
    crossScore = sma50 > sma200 ? 2 : -2;
    score += crossScore;
    breakdown.push({ label: 'SMA Cross', val: sma50 > sma200 ? 'Golden' : 'Death', score: crossScore });
  }

  // Update Score Breakdown UI
  const sbItems = document.getElementById('sb-items');
  if (sbItems) {
    sbItems.innerHTML = breakdown.map(item => `
      <div class="sb-item">
        <span>${item.label}</span>
        <span class="sb-score ${item.score > 0 ? 'plus' : (item.score < 0 ? 'minus' : '')}">
          ${item.score > 0 ? '+' : ''}${item.score}
        </span>
      </div>
    `).join('');
  }

  // Update Recommendation Badge
  const badge = document.getElementById('recommendation-badge');
  const text = document.getElementById('recommendation-text');
  if (badge && text) {
    if (score >= 4) { badge.className = 'recommendation-badge strong-buy'; text.textContent = 'Strong Buy'; }
    else if (score >= 1) { badge.className = 'recommendation-badge buy'; text.textContent = 'Buy'; }
    else if (score <= -4) { badge.className = 'recommendation-badge strong-sell'; text.textContent = 'Strong Sell'; }
    else if (score <= -1) { badge.className = 'recommendation-badge sell'; text.textContent = 'Sell'; }
    else { badge.className = 'recommendation-badge neutral'; text.textContent = 'Hold'; }
  }

  // Update Technical Grids
  const updateEl = (id, val, badgeId, isBullish) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
    const b = document.getElementById(badgeId);
    if (b) {
      b.textContent = isBullish ? 'Bullish' : 'Bearish';
      b.className = `tech-badge ${isBullish ? 'bullish' : 'bearish'}`;
    }
  };

  if (rsi != null) updateEl('tech-rsi', rsi.toFixed(1), 'tech-rsi-badge', rsi < 50);
  if (macdLine != null) updateEl('tech-macd', macdLine.toFixed(1), 'tech-macd-badge', macdLine > signalLine);
  if (sma50 != null) document.getElementById('tech-sma50').textContent = formatNumber(sma50);
  if (sma200 != null) document.getElementById('tech-sma200').textContent = formatNumber(sma200);
}

async function fetchTechnicalIndicators() {
  try {
    const symbol = getCurrentSymbol();
    const res = await fetch(`/api/chart?range=1y&interval=1d&symbol=${encodeURIComponent(symbol)}`);
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const closes = result?.indicators?.quote?.[0]?.close?.filter(c => c != null) || [];
    
    // Add real-time price point
    const priceText = document.getElementById('current-price')?.textContent?.replace(/,/g, '');
    const livePrice = parseFloat(priceText);
    if (!isNaN(livePrice)) closes.push(livePrice);

    if (closes.length < 2) return;

    const currentPrice = closes[closes.length - 1];
    const rsi = calculateRSI(closes, 14);
    const sma50 = calculateSMA(closes, 50);
    const sma200 = calculateSMA(closes, 200);
    const { macdLine, signalLine } = calculateMACD(closes);

    updateRecommendation(currentPrice, rsi, macdLine, signalLine, sma50, sma200);
  } catch (err) { console.error('Failed to fetch indicators', err); }
}

async function fetchFundamentals() {
  try {
    const symbol = getCurrentSymbol();
    const res = await fetch(`/api/fundamentals?symbol=${encodeURIComponent(symbol)}&t=${Date.now()}`);
    const data = await res.json();
    const summary = data?.summaryDetail || {};
    const stats = data?.defaultKeyStatistics || {};

    const update = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val != null ? val : 'N/A';
    };

    update('fund-mktCap', summary.marketCap ? formatVolume(summary.marketCap) : (stats.enterpriseValue ? formatVolume(stats.enterpriseValue) : 'N/A'));
    
    // P/E Ratio Fallback: check trailingPE, then forwardPE in both summary and stats
    const pe = summary.trailingPE || summary.forwardPE || stats.forwardPE;
    update('fund-pe', pe ? pe.toFixed(2) : 'N/A');
    
    // EPS Fallback: check trailingEps then forwardEps
    const eps = stats.trailingEps || stats.forwardEps;
    update('fund-eps', eps ? eps.toFixed(2) : 'N/A');
    
    update('fund-divYield', summary.dividendYield ? (summary.dividendYield * 100).toFixed(2) + '%' : 'N/A');
  } catch (err) { console.error('Failed to fetch fundamentals', err); }
}

// ===== Event Listeners =====
function initEventListeners() {
  // Timeframe buttons
  const buttons = document.querySelectorAll('.tf-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const range = btn.dataset.range;
      const interval = btn.dataset.interval;
      fetchHistoricalData(range, interval);
    });
  });

  // Asset Dropdown
  const select = document.getElementById('symbol-select');
  if (select) {
    select.addEventListener('change', async () => {
      const option = select.options[select.selectedIndex];
      document.getElementById('main-title').textContent = option.dataset.title;
      document.getElementById('main-subtitle').textContent = option.dataset.subtitle;
      
      // Reset previous price to avoid confusing flash animation on asset change
      previousPrice = null;
      document.getElementById('current-price').textContent = '--';
      
      updateMarketStatus();
      
      // Find active timeframe
      const activeBtn = document.querySelector('.tf-btn.active');
      const range = activeBtn ? activeBtn.dataset.range : '10y';
      const interval = activeBtn ? activeBtn.dataset.interval : '1wk';
      
      // Fetch new data
      await Promise.all([
        fetchHistoricalData(range, interval),
        fetchLivePrice(),
        fetchIntradayData(),
        fetchTechnicalIndicators(),
        fetchFundamentals()
      ]);
    });
  }

  // Add click listener for score breakdown
  const badge = document.getElementById('recommendation-badge');
  const breakdown = document.getElementById('score-breakdown');
  if (badge && breakdown) {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      breakdown.classList.toggle('hidden');
    });
    document.addEventListener('click', () => breakdown.classList.add('hidden'));
  }
}

// ===== Initialize =====
async function init() {
  updateMarketStatus();
  initEventListeners();

  // Fetch initial data
  await Promise.all([
    fetchHistoricalData('10y', '1wk'),
    fetchLivePrice(),
    fetchIntradayData(),
    fetchTechnicalIndicators(),
    fetchFundamentals()
  ]);

  // Auto-refresh every 15 seconds (Price Only)
  refreshInterval = setInterval(() => {
    fetchLivePrice();
  }, 15000);

  // Update logic for analysis/status every 60 seconds
  setInterval(() => {
    updateMarketStatus();
    fetchTechnicalIndicators();
    fetchIntradayData();
  }, 60000);
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
