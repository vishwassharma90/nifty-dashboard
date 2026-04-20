const express = require('express');
const path = require('path');
const https = require('https');
const http = require('http');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Simple Request Logger
app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) {
    console.log(`📡 [API REQUEST] ${new Date().toLocaleTimeString()} - ${req.url}`);
    // Disable caching for all API requests
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Proxy endpoint for Yahoo Finance API
app.get('/api/chart', (req, res) => {
  const { range, interval, symbol } = req.query;
  const targetSymbol = encodeURIComponent(symbol || '^NSEI'); // ^NSEI (Nifty 50)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${targetSymbol}?range=${range || '10y'}&interval=${interval || '1wk'}&includePrePost=false`;

  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    }
  };

  https.get(url, options, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      try {
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse response' });
      }
    });
  }).on('error', (err) => {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch data' });
  });
});

// Proxy for live quote
// Official library quote for live data
app.get('/api/quote', async (req, res) => {
  try {
    const { symbol } = req.query;
    const targetSymbol = symbol || '^NSEI';
    const result = await yahooFinance.quote(targetSymbol);
    res.json(result);
  } catch (error) {
    console.error('Quote API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch quote', details: error.message });
  }
});

// Fundamentals endpoint using yahoo-finance2
app.get('/api/fundamentals', async (req, res) => {
  try {
    const { symbol } = req.query;
    const targetSymbol = symbol || '^NSEI';
    const result = await yahooFinance.quoteSummary(targetSymbol, {
      modules: ['price', 'summaryDetail', 'defaultKeyStatistics']
    });
    res.json(result);
  } catch (error) {
    console.error('Fundamentals API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch fundamentals', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Nifty Dashboard running at http://localhost:${PORT}`);
});
