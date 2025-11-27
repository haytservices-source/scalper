// =====================
// BASIC CONFIG
// =====================

// 1) INSERT YOUR FREE API KEY HERE (e.g. from Alpha Vantage)
const PRICE_API_KEY = "IVDWGNEHUKZADO1X";

// Alpha Vantage FX API example for XAUUSD
// Note: Free tier is rate-limited; do NOT set interval too small.
const PRICE_API_URL = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=${PRICE_API_KEY}`;

// Optional news API placeholder (set to real URL with your key if you want)
const NEWS_API_URL = ""; // e.g. "https://your-news-api.com?symbol=XAUUSD&apikey=YOUR_KEY"

// Refresh interval in ms (5000 = 5 seconds)
const REFRESH_INTERVAL_MS = 5000;

// Indicator settings (you can tweak)
const EMA_FAST_PERIOD = 9;
const EMA_SLOW_PERIOD = 21;
const RSI_PERIOD = 14;
const VOL_LOOKBACK = 10; // last N ticks for volatility

// =====================
// STATE
// =====================

let priceHistory = []; // { time: Date, price: number }
let emaFast = null;
let emaSlow = null;

// =====================
// HELPER FUNCTIONS
// =====================

function formatTime(date) {
  return date.toLocaleTimeString("en-GB", { hour12: false });
}

function calculateEMA(prevEMA, price, period) {
  const k = 2 / (period + 1);
  if (prevEMA === null || isNaN(prevEMA)) {
    return price;
  }
  return price * k + prevEMA * (1 - k);
}

function computeRSI(prices, period) {
  if (prices.length < period + 1) return null;
  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function computeVolatility(prices, lookback) {
  if (prices.length < lookback) return null;
  const slice = prices.slice(-lookback);
  const high = Math.max(...slice);
  const low = Math.min(...slice);
  if (high === 0) return 0;
  return ((high - low) / high) * 100;
}

function compute1mChange(history) {
  if (history.length < 2) return null;
  const latest = history[history.length - 1];
  const cutoff = latest.time.getTime() - 60 * 1000;
  let earliest = history[0];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].time.getTime() <= cutoff) {
      earliest = history[i];
      break;
    }
  }
  if (!earliest || earliest.price === 0) return null;
  return ((latest.price - earliest.price) / earliest.price) * 100;
}

// =====================
// SIGNAL LOGIC
// =====================

function decideSignal() {
  const price = priceHistory.length ? priceHistory[priceHistory.length - 1].price : null;
  if (!price || !emaFast || !emaSlow) {
    return {
      signal: "WAIT",
      trend: "Collecting data…",
      reason: "Need more price history to build EMAs and RSI.",
      rsi: null,
      vol: null,
      change1m: null
    };
  }

  const prices = priceHistory.map(p => p.price);
  const rsi = computeRSI(prices, RSI_PERIOD);
  const vol = computeVolatility(prices, VOL_LOOKBACK);
  const change1m = compute1mChange(priceHistory);

  let signal = "WAIT";
  let trend = "";
  let reason = "";

  const upTrend = emaFast > emaSlow;
  const downTrend = emaFast < emaSlow;

  if (upTrend && rsi !== null && rsi > 40 && rsi < 70 && change1m !== null && change1m > 0) {
    signal = "BUY";
    trend = "Short-term bullish bias";
    reason =
      "Fast EMA above slow EMA, RSI in healthy zone, and 1-minute change positive. Possible scalp buy continuation.";
  } else if (
    downTrend &&
    rsi !== null &&
    rsi < 60 &&
    change1m !== null &&
    change1m < 0
  ) {
    signal = "SELL";
    trend = "Short-term bearish bias";
    reason =
      "Fast EMA below slow EMA, RSI not oversold, and 1-minute change negative. Possible scalp sell continuation.";
  } else {
    signal = "WAIT";
    trend = upTrend
      ? "Up bias but conditions not strong enough."
      : downTrend
      ? "Down bias but conditions not strong enough."
      : "No clear trend yet.";
    reason =
      "Indicators are mixed or conflicting. Waiting to avoid chasing random noise.";
  }

  return { signal, trend, reason, rsi, vol, change1m };
}

// =====================
// DOM UPDATES
// =====================

function updateUI(latestPrice) {
  const priceEl = document.getElementById("priceValue");
  const lastUpdatedEl = document.getElementById("lastUpdated");
  const emaFastEl = document.getElementById("emaFastValue");
  const emaSlowEl = document.getElementById("emaSlowValue");
  const rsiEl = document.getElementById("rsiValue");
  const volEl = document.getElementById("volatilityValue");
  const signalTextEl = document.getElementById("signalText");
  const trendTextEl = document.getElementById("trendText");
  const reasonEl = document.getElementById("signalReason");
  const change1mEl = document.getElementById("change1m");

  const now = new Date();

  priceEl.textContent = latestPrice ? latestPrice.toFixed(2) : "--";
  lastUpdatedEl.textContent = formatTime(now);

  const { signal, trend, reason, rsi, vol, change1m } = decideSignal();

  // Update signal label styles
  signalTextEl.classList.remove("signal-buy", "signal-sell", "signal-wait");
  if (signal === "BUY") signalTextEl.classList.add("signal-buy");
  else if (signal === "SELL") signalTextEl.classList.add("signal-sell");
  else signalTextEl.classList.add("signal-wait");

  signalTextEl.textContent = signal;
  trendTextEl.textContent = trend;
  reasonEl.textContent = reason;

  emaFastEl.textContent = emaFast ? emaFast.toFixed(2) : "--";
  emaSlowEl.textContent = emaSlow ? emaSlow.toFixed(2) : "--";
  rsiEl.textContent = rsi !== null ? rsi.toFixed(1) : "--";
  volEl.textContent = vol !== null ? vol.toFixed(2) + "%" : "--";

  // 1-minute change chip
  change1mEl.classList.remove("chip-up", "chip-down", "chip-neutral");
  let changeLabel = "1m: --";
  if (change1m !== null) {
    const val = change1m.toFixed(2);
    changeLabel = `1m: ${val}%`;
    if (change1m > 0) change1mEl.classList.add("chip-up");
    else if (change1m < 0) change1mEl.classList.add("chip-down");
    else change1mEl.classList.add("chip-neutral");
  } else {
    change1mEl.classList.add("chip-neutral");
  }
  change1mEl.textContent = changeLabel;

  addSignalToHistory(signal, latestPrice, now);
}

function addSignalToHistory(signal, price, time) {
  const historyList = document.getElementById("signalHistory");
  const empty = historyList.querySelector(".history-empty");
  if (empty) empty.remove();

  const li = document.createElement("li");
  li.className = "signal-history-item";

  const timeSpan = document.createElement("span");
  timeSpan.className = "history-time";
  timeSpan.textContent = formatTime(time);

  const signalSpan = document.createElement("span");
  signalSpan.className = "history-signal";
  if (signal === "BUY") signalSpan.classList.add("history-buy");
  else if (signal === "SELL") signalSpan.classList.add("history-sell");
  else signalSpan.classList.add("history-wait");

  signalSpan.textContent = `${signal} @ ${price ? price.toFixed(2) : "--"}`;

  li.appendChild(timeSpan);
  li.appendChild(signalSpan);
  historyList.insertBefore(li, historyList.firstChild);

  // Keep last 20
  while (historyList.children.length > 20) {
    historyList.removeChild(historyList.lastChild);
  }
}

// =====================
// API FETCHES
// =====================

async function fetchPrice() {
  if (!PRICE_API_KEY || PRICE_API_KEY === "YOUR_API_KEY_HERE") {
    console.warn("Set your PRICE_API_KEY in script.js to get live prices.");
    return;
  }

  try {
    const resp = await fetch(PRICE_API_URL);
    const data = await resp.json();

    // Alpha Vantage CURRENCY_EXCHANGE_RATE response shape:
    // { "Realtime Currency Exchange Rate": { "5. Exchange Rate": "xxxx" } }
    const rateObj = data["Realtime Currency Exchange Rate"];
    if (!rateObj) {
      console.warn("Unexpected price API response", data);
      return;
    }
    const price = parseFloat(rateObj["5. Exchange Rate"]);
    if (!price || isNaN(price)) return;

    const now = new Date();
    priceHistory.push({ time: now, price });

    // Limit history length
    if (priceHistory.length > 500) priceHistory.shift();

    // Update EMAs
    emaFast = calculateEMA(emaFast, price, EMA_FAST_PERIOD);
    emaSlow = calculateEMA(emaSlow, price, EMA_SLOW_PERIOD);

    updateUI(price);
  } catch (err) {
    console.error("Error fetching price:", err);
  }
}

// Optional news (you need to set NEWS_API_URL to a real endpoint)
async function fetchNews() {
  const newsListEl = document.getElementById("newsList");

  if (!NEWS_API_URL) {
    return; // silently skip if not set
  }

  try {
    const resp = await fetch(NEWS_API_URL);
    const data = await resp.json();

    // Expecting something like: data.articles = [{ title, url, source, publishedAt }]
    const articles = data.articles || [];
    newsListEl.innerHTML = "";

    if (!articles.length) {
      const li = document.createElement("li");
      li.className = "news-empty";
      li.textContent = "No news found.";
      newsListEl.appendChild(li);
      return;
    }

    articles.slice(0, 10).forEach(article => {
      const li = document.createElement("li");
      li.className = "news-item";

      const link = document.createElement("a");
      link.href = article.url || "#";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = article.title || "Untitled";

      const meta = document.createElement("div");
      meta.className = "news-meta";
      meta.textContent =
        (article.source && article.source.name ? article.source.name : "Source") +
        (article.publishedAt ? " • " + new Date(article.publishedAt).toLocaleString() : "");

      li.appendChild(link);
      li.appendChild(meta);
      newsListEl.appendChild(li);
    });
  } catch (err) {
    console.error("Error fetching news:", err);
  }
}

// =====================
// INIT
// =====================

function init() {
  // First fetch
  fetchPrice();
  fetchNews();

  // Set interval for price (scalping)
  setInterval(fetchPrice, REFRESH_INTERVAL_MS);

  // Refresh news less often (e.g. every 5 minutes)
  setInterval(fetchNews, 5 * 60 * 1000);
}

document.addEventListener("DOMContentLoaded", init);
