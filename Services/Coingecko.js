
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
  
  async function getPriceHistory_Bitcoin(){
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
  
  async function getPriceHistory_Ethereum(){
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
  
  async function getPriceHistory_Gold(){
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
    ,getPriceHistory_Bitcoin: async () => {
        return await getPriceHistory_Bitcoin();
    }
    ,getPriceHistory_Ethereum: async () => {
        return await getPriceHistory_Ethereum();
    }
    ,getPriceHistory_Gold: async () => {
        return await getPriceHistory_Gold();
    }
 }
