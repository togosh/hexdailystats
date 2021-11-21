
///////////////////////////////////////////////////
// COINGECKO PRICES
const FETCH_SIZE = 1048576;
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
var fetchRetry = require('fetch-retry')(fetch, { 
    retryOn: async function(attempt, error, response) {
      if (attempt > 3) { return false; }
  
      if (error !== null) {
        log(`FETCH --- RETRY ${attempt + 1} --- ERROR --- ` + error.toString()); await sleep(500);
        return true;
    } 
  
      if (response.status >= 400) {
        log(`FETCH --- RETRY ${attempt + 1} --- STATUS --- ` + response.status); await sleep(500);
        return true;
      }
  
      try {
        var response2 = await response.clone().buffer();
        const json = JSON.parse(response2);
  
        if (json.errors && Object.keys(json.errors).length > 0) {
            if (json.errors[0].message) {
              log(`FETCH --- INTERNAL JSON ERROR --- ${attempt + 1} --- ` + json.errors[0].message); await sleep(500);
              return true;
            }
        }
        
        return false;
      } catch (error) {
        log(`FETCH --- RETRY ${attempt + 1} --- JSON ---` + error.toString()); await sleep(500);
        return true;
      }
    }
  });
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

  function log(message){
    console.log(new Date().toISOString() + ", " + message);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
