const CURRENCY = "USD";
const API_KEY =
  "2f73fef0fc2a25f18717701526616cd9f76914f0b90374bef041d695a6322f40";

const tickersHandlers = new Map();
const socket = new WebSocket(
  `wss://streamer.cryptocompare.com/v2?api_key=${API_KEY}`
);

const AGGREGATE_INDEX = "5";

socket.addEventListener("message", (e) => {
  const {
    TYPE: type,
    FROMSYMBOL: currency,
    PRICE: newPrice,
  } = JSON.parse(e.data);
  if (type !== AGGREGATE_INDEX || !newPrice) {
    return;
  }

  const handlers = tickersHandlers.get(currency) || [];
  handlers.forEach((fn) => fn(newPrice));
});

const sendToWebsocket = (message) => {
  const signifiedMessage = JSON.stringify(message);

  if (socket.readyState === WebSocket.OPEN) {
    socket.send(signifiedMessage);
    return;
  }

  socket.addEventListener(
    "open",
    () => {
      socket.send(signifiedMessage);
    },
    { once: true }
  );
};

const subscribeToTickerOnWebSocket = (ticker) => {
  const message = {
    action: "SubAdd",
    subs: [`${AGGREGATE_INDEX}~CCCAGG~${ticker}~${CURRENCY}`],
  };

  sendToWebsocket(message);
};

const unsubscribeFromTickerOnWebSocket = (ticker) => {
  const message = {
    action: "SubRemove",
    subs: [`${AGGREGATE_INDEX}~CCCAGG~${ticker}~${CURRENCY}`],
  };

  sendToWebsocket(message);
};

export const subscribeToTicker = (ticker, cb) => {
  const subscribers = tickersHandlers.get(ticker) || [];
  tickersHandlers.set(ticker, [...subscribers, cb]);
  subscribeToTickerOnWebSocket(ticker);
};

export const unsubscribeFromTicker = (ticker) => {
  tickersHandlers.delete(ticker);
  unsubscribeFromTickerOnWebSocket(ticker);
};
