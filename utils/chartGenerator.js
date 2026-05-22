const QuickChart = require('quickchart-js');

/**
 * Generate a candlestick-style chart using QuickChart API.
 * QuickChart doesn't support true candlestick natively so we simulate it
 * with a bar chart showing high/low ranges and open/close bodies.
 */
async function generateCandlestickChart(asset) {
  const history = asset.priceHistory.slice(-30);
  if (history.length < 2) return null;

  const labels = history.map((_, i) => `${i + 1}`);
  const closes = history.map((h) => h.close);
  const opens = history.map((h) => h.open);
  const highs = history.map((h) => h.high);
  const lows = history.map((h) => h.low);

  const bullColor = 'rgba(0, 210, 110, 0.9)';
  const bearColor = 'rgba(255, 65, 65, 0.9)';
  const colors = history.map((h) => (h.close >= h.open ? bullColor : bearColor));

  const chart = new QuickChart();
  chart.setWidth(800).setHeight(400).setBackgroundColor('#1a1a2e');

  chart.setConfig({
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'High-Low',
          data: history.map((h) => [h.low, h.high]),
          backgroundColor: colors.map((c) => c.replace('0.9', '0.3')),
          borderColor: colors,
          borderWidth: 1,
          barPercentage: 0.2,
        },
        {
          label: 'Open-Close',
          data: history.map((h) => [Math.min(h.open, h.close), Math.max(h.open, h.close)]),
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1,
          barPercentage: 0.6,
        },
      ],
    },
    options: {
      legend: { display: false },
      title: {
        display: true,
        text: `${asset.symbol} — Candlestick Chart`,
        fontColor: '#e0e0e0',
        fontSize: 16,
      },
      scales: {
        xAxes: [{ ticks: { fontColor: '#aaa' }, gridLines: { color: 'rgba(255,255,255,0.05)' } }],
        yAxes: [{ ticks: { fontColor: '#aaa', callback: (v) => `$${Number(v).toLocaleString()}` }, gridLines: { color: 'rgba(255,255,255,0.08)' } }],
      },
    },
  });

  const url = chart.getUrl();
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Generate a mountain (area) chart using QuickChart API.
 */
async function generateMountainChart(asset) {
  const history = asset.priceHistory.slice(-60);
  if (history.length < 2) return null;

  const closes = history.map((h) => h.close);
  const labels = history.map((_, i) => `${i + 1}`);
  const isUp = closes[closes.length - 1] >= closes[0];
  const lineColor = isUp ? 'rgb(0, 210, 110)' : 'rgb(255, 65, 65)';
  const fillColor = isUp ? 'rgba(0, 210, 110, 0.15)' : 'rgba(255, 65, 65, 0.15)';

  const chart = new QuickChart();
  chart.setWidth(800).setHeight(400).setBackgroundColor('#1a1a2e');

  chart.setConfig({
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: asset.name,
          data: closes,
          borderColor: lineColor,
          backgroundColor: fillColor,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2.5,
        },
      ],
    },
    options: {
      legend: { display: false },
      title: {
        display: true,
        text: `${asset.symbol} — ${asset.name} Price`,
        fontColor: '#e0e0e0',
        fontSize: 16,
      },
      scales: {
        xAxes: [{ ticks: { fontColor: '#aaa', maxTicksLimit: 8 }, gridLines: { color: 'rgba(255,255,255,0.05)' } }],
        yAxes: [{ ticks: { fontColor: '#aaa', callback: (v) => `$${Number(v).toLocaleString()}` }, gridLines: { color: 'rgba(255,255,255,0.08)' } }],
      },
    },
  });

  const url = chart.getUrl();
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

module.exports = { generateCandlestickChart, generateMountainChart };