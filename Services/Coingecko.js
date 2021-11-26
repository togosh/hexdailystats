const h = require('../Helpers/helpers'); 
const fetchRetry = h.fetchRetry;
const FETCH_SIZE = h.FETCH_SIZE;
 
///////////////////////////////////////////////////
// COINGECKO PRICES

async function getPriceAllTimeHigh(){
    var url = "https://api.coingecko.com/api/v3/coins/hex";
    return await fetchRetry(url, {
      method: 'GET',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => res.json())
      .then(res => {
        var priceATH = res.market_data.ath.usd;
        return priceATH;
    });
  }
  
  async function getPriceHistory_Bitcoin(currentDayGlobal){
    var url = "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=" + currentDayGlobal + "&interval=daily";
    return await fetchRetry(url, {
      method: 'GET',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => res.json())
      .then(res => {
        var prices = res.prices.map(e => e[1]);
        return prices;
    });
  }
  
  async function getPriceHistory_Ethereum(currentDayGlobal){
    var url = "https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=" + currentDayGlobal + "&interval=daily";
    return await fetchRetry(url, {
      method: 'GET',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => res.json())
      .then(res => {
        var prices = res.prices.map(e => e[1]);
        return prices;
    });
  }
  
  async function getPriceHistory_Gold(currentDayGlobal){
    var url = "https://api.coingecko.com/api/v3/coins/pax-gold/market_chart?vs_currency=usd&days=" + currentDayGlobal + "&interval=daily";
    return await fetchRetry(url, {
      method: 'GET',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => res.json())
      .then(res => {
        var prices = res.prices.map(e => e[1]);
        return prices;
    });
  }
  
  module.exports = { 
    getPriceAllTimeHigh: async () => {
       return await getPriceAllTimeHigh();
    }
    ,getPriceHistory_Bitcoin: async (currentDayGlobal) => {
        return await getPriceHistory_Bitcoin(currentDayGlobal);
    }
    ,getPriceHistory_Ethereum: async (currentDayGlobal) => {
        return await getPriceHistory_Ethereum(currentDayGlobal);
    }
    ,getPriceHistory_Gold: async (currentDayGlobal) => {
        return await getPriceHistory_Gold(currentDayGlobal);
    }
 }
