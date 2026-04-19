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
    const response = await fetch(`/api/chart?range=${range}&interval=${interval}&symbol=${encodeURIComponent(symbol)}`);
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

async function fetchLivePrice() {
  try {
    const symbol = getCurrentSymbol();
    const response = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`);
    const data = await response.json();

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      console.error('No live data');
      return;
    }

    const result = data.chart.result[0];
    const meta = result.meta;
    const quotes = result.indicators ? result.indicators.quote[0] : {};
    const timestamps = result.timestamp || [];

    const currentPrice = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose || meta.previousClose;
    const change = currentPrice - previousClose;
    const changePct = (change / previousClose * 100);

    // Determine currency symbol based on asset
    const currency = meta.currency || 'INR';
    const currencySymbol = currency === 'USD' ? '$' : currency === 'INR' ? '₹' : currency + ' ';

    // Update current price with flash animation
    const priceEl = document.getElementById('current-price');
    if (previousPrice !== null && currentPrice !== previousPrice) {
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

    // Always update stats from meta (available for all symbols)
    let dayHigh = meta.regularMarketDayHigh;
    let dayLow = meta.regularMarketDayLow;
    let dayOpen = meta.regularMarketOpen;
    let totalVolume = meta.regularMarketVolume;

    // If intraday data is available, compute more accurate values from it
    const hasIntradayData = timestamps.length > 0 && quotes && quotes.high;
    if (hasIntradayData) {
      const highs = (quotes.high || []).filter(v => v != null);
      const lows = (quotes.low || []).filter(v => v != null);
      const opens = (quotes.open || []).filter(v => v != null);
      const volumes = (quotes.volume || []).filter(v => v != null);

      if (highs.length > 0) dayHigh = Math.max(...highs);
      if (lows.length > 0) dayLow = Math.min(...lows);
      if (opens.length > 0) dayOpen = opens[0];
      if (volumes.length > 0) totalVolume = volumes.reduce((a, b) => a + b, 0);
    }

    // Update detail cards (always, not just when intraday data exists)
    document.getElementById('price-open').textContent = dayOpen != null ? formatNumber(dayOpen) : '--';
    document.getElementById('price-high').textContent = dayHigh != null ? formatNumber(dayHigh) : '--';
    document.getElementById('price-low').textContent = dayLow != null ? formatNumber(dayLow) : '--';
    document.getElementById('price-prev-close').textContent = formatNumber(previousClose);

    document.getElementById('week52-high').textContent = meta.fiftyTwoWeekHigh != null
      ? `${currencySymbol}${formatNumber(meta.fiftyTwoWeekHigh)}` : '--';
    document.getElementById('week52-low').textContent = meta.fiftyTwoWeekLow != null
      ? `${currencySymbol}${formatNumber(meta.fiftyTwoWeekLow)}` : '--';
    document.getElementById('volume').textContent = totalVolume != null ? formatVolume(totalVolume) : '--';
    document.getElementById('day-range').textContent = (dayLow != null && dayHigh != null)
      ? `${formatNumber(dayLow, 0)} - ${formatNumber(dayHigh, 0)}` : '--';

    // Update intraday chart (only if data exists)
    if (hasIntradayData && quotes.close) {
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
    } else {
      // No intraday data — clear the intraday chart
      if (intradayChart) {
        intradayChart.destroy();
        intradayChart = null;
      }
      // Show a message in the intraday section
      const intradayCanvas = document.getElementById('intraday-chart');
      const ctx = intradayCanvas.getContext('2d');
      ctx.clearRect(0, 0, intradayCanvas.width, intradayCanvas.height);
    }

    updateLastUpdated();

  } catch (error) {
    console.error('Error fetching live data:', error);
  }
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
        fetchLivePrice()
      ]);
    });
  }
}

// ===== Initialize =====
async function init() {
  updateMarketStatus();
  initEventListeners();

  // Fetch initial data
  await Promise.all([
    fetchHistoricalData('10y', '1wk'),
    fetchLivePrice()
  ]);

  // Auto-refresh every 15 seconds
  refreshInterval = setInterval(() => {
    fetchLivePrice();
    updateMarketStatus();
  }, 15000);

  // Update market status every minute
  setInterval(updateMarketStatus, 60000);
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
