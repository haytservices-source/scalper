// =======================
// 1-SECOND LIVE PRICE USING TWELVEDATA WEBSOCKET
// =======================

// 🔑 Insert your real TwelveData API key
const API_KEY = "sk_0507bDb61A0Af2729CE5eaAa026f4937F909aD8ba673Db1a";

// WebSocket endpoint
const socket = new WebSocket(`wss://ws.twelvedata.com/v1/quotes/price?apikey=${API_KEY}`);

// Indicators state
let priceHistory = [];
let emaFast = null;
let emaSlow = null;

const EMA_FAST_PERIOD = 9;
const EMA_SLOW_PERIOD = 21;
const RSI_PERIOD = 14;

// =======================
// HELPER FUNCTIONS
// =======================
function calculateEMA(prevEMA, price, period) {
  const k = 2 / (period + 1);
  if (!prevEMA) return price;
  return price * k + prevEMA * (1 - k);
}

function computeRSI(prices, period) {
  if (prices.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function formatTime(date) {
  return date.toLocaleTimeString("en-GB", { hour12: false });
}

function generateSignal(price) {
  const prices = priceHistory.map(p => p.price);
  const rsi = computeRSI(prices, RSI_PERIOD);

  if (emaFast > emaSlow && rsi < 70) return "BUY";
  if (emaFast < emaSlow && rsi > 30) return "SELL";
  return "WAIT";
}

function updateUI(price) {
  document.getElementById("priceValue").textContent = price.toFixed(2);
  document.getElementById("lastUpdated").textContent = formatTime(new Date());
  document.getElementById("emaFastValue").textContent = emaFast.toFixed(2);
  document.getElementById("emaSlowValue").textContent = emaSlow.toFixed(2);

  const rsi = computeRSI(priceHistory.map(p => p.price), RSI_PERIOD);
  document.getElementById("rsiValue").textContent = rsi ? rsi.toFixed(1) : "--";

  const signal = generateSignal(price);

  const signalEl = document.getElementById("signalText");
  signalEl.textContent = signal;
  signalEl.className = "signal-tag signal-" + signal.toLowerCase();
}

// =======================
// WEBSOCKET LIVE STREAM
// =======================
socket.onopen = function () {
  console.log("WebSocket connected.");

  socket.send(
    JSON.stringify({
      action: "subscribe",
      params: {
        symbols: "XAU/USD"
      }
    })
  );
};

socket.onmessage = function (msg) {
  const data = JSON.parse(msg.data);

  if (!data.price) return;

  const price = parseFloat(data.price);

  priceHistory.push({ time: new Date(), price });
  if (priceHistory.length > 500) priceHistory.shift();

  emaFast = calculateEMA(emaFast, price, EMA_FAST_PERIOD);
  emaSlow = calculateEMA(emaSlow, price, EMA_SLOW_PERIOD);

  updateUI(price);
};

socket.onerror = function (err) {
  console.log("WebSocket error:", err);
};

socket.onclose = function () {
  console.log("WebSocket closed.");
};
