const MAIN_CURRENCY = "USD";
const ALTERNATE_CURRENCY = "BTC";
const API_KEY =
  "cfad04b13477365ab3bf82368f916db7609ed7b6bd1d641589854d63485c2df9";
const AGGREGATE_INDEX_TYPE = "5";
const ERROR_TYPE = "500";
const INVALID_SUB_MESSAGE = "INVALID_SUB";
const API_REST_URL = "https://min-api.cryptocompare.com/data/price?";

const tickersHandlers = new Map();

const socket = new WebSocket(
  `wss://streamer.cryptocompare.com/v2?api_key=${API_KEY}`
);

socket.addEventListener("message", (e) => {
  const {
    TYPE: type,
    FROMSYMBOL: fromCurrencyConvert,
    TOSYMBOL: toCurrencyConvert,
    PRICE: newPrice,
    PARAMETER: parameter,
    MESSAGE: message,
  } = JSON.parse(e.data);

  if (type === ERROR_TYPE && message === INVALID_SUB_MESSAGE) {
    const [, , fromCurrency, toCurrency] = parameter.split("~");

    if (toCurrency === ALTERNATE_CURRENCY) {
      tickersHandlers.delete(fromCurrency);
      return;
    }

    subscribeToTickerOnWebSocket(fromCurrency, ALTERNATE_CURRENCY);
    const updatedTicker = tickersHandlers.get(fromCurrency);
    tickersHandlers.set(fromCurrency, {
      callbacks: updatedTicker.callbacks || [],
      currency: ALTERNATE_CURRENCY,
    });
    return;
  }

  if (type !== AGGREGATE_INDEX_TYPE || !newPrice) {
    return;
  }

  const handlers = tickersHandlers.get(fromCurrencyConvert).callbacks || [];
  handlers.forEach((fn) => {
    if (toCurrencyConvert === ALTERNATE_CURRENCY) {
      fetch(`${API_REST_URL}fsym=${ALTERNATE_CURRENCY}&tsyms=${MAIN_CURRENCY}`)
        .then((response) => response.json())
        .then(({ USD }) => fn(newPrice * USD))
        .catch((error) => console.error(error));
    } else {
      fn(newPrice);
    }
  });
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

const subscribeToTickerOnWebSocket = (ticker, currency) => {
  const message = {
    action: "SubAdd",
    subs: [`${AGGREGATE_INDEX_TYPE}~CCCAGG~${ticker}~${currency}`],
  };

  sendToWebsocket(message);
};

const unsubscribeFromTickerOnWebSocket = (ticker, currency) => {
  const message = {
    action: "SubRemove",
    subs: [`${AGGREGATE_INDEX_TYPE}~CCCAGG~${ticker}~${currency}`],
  };

  sendToWebsocket(message);
};

export const subscribeToTicker = (ticker, cb) => {
  const subscribers = tickersHandlers.get(ticker) || [];
  tickersHandlers.set(ticker, {
    callbacks: [...subscribers, cb],
    currency: MAIN_CURRENCY,
  });
  subscribeToTickerOnWebSocket(ticker, MAIN_CURRENCY);
};

export const unsubscribeFromTicker = (ticker) => {
  const tickerToRemove = tickersHandlers.get(ticker);
  if (!tickerToRemove) {
    return;
  }
  unsubscribeFromTickerOnWebSocket(ticker, tickerToRemove.currency);
  tickersHandlers.delete(ticker);
};
