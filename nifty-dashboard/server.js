const express = require('express');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

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
app.get('/api/quote', (req, res) => {
  const { symbol } = req.query;
  const targetSymbol = encodeURIComponent(symbol || '^NSEI');
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${targetSymbol}?range=1d&interval=1m&includePrePost=false`;

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

app.listen(PORT, () => {
  console.log(`🚀 Nifty Dashboard running at http://localhost:${PORT}`);
});
