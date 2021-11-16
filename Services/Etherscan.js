var CONFIG = require('../config.json');
var DEBUG = CONFIG.debug;
const HEX_CONTRACT_ADDRESS = "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39";
const HEX_CONTRACT_CURRENTDAY = "0x5c9302c9";
const HEX_CONTRACT_GLOBALINFO = "0xf04b5fa0";
const FETCH_SIZE = 1048576;
function chunkSubstr(str, size) {
  const numChunks = Math.ceil(str.length / size);
  const chunks = new Array(numChunks);

  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substr(o, size);
  }

  return chunks;
}
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
//////////////////////////////////////
//// ETHERSCAN

async function getCurrentDay(){
    var etherScanURL = 
    "https://api.etherscan.io/api?" +
    "module=proxy&action=eth_call" +
    "&to=" + HEX_CONTRACT_ADDRESS +
    "&data=" + HEX_CONTRACT_CURRENTDAY +
    "&apikey=" + CONFIG.etherscan.apiKey;
  
    return await fetchRetry(etherScanURL, {
      method: 'GET',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' }
    })
    .then(res => res.json())
    .then(res => {
      var currentDay = parseInt(res.result, 16);
      return currentDay;
    });
  }
  
  async function getGlobalInfo(){
    var etherScanURL = 
    "https://api.etherscan.io/api?" +
    "module=proxy&action=eth_call" +
    "&to=" + HEX_CONTRACT_ADDRESS +
    "&data=" + HEX_CONTRACT_GLOBALINFO +
    "&apikey=" + CONFIG.etherscan.apiKey;
  
    return await fetchRetry(etherScanURL, {
      method: 'GET',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' }
    })
    .then(res => res.json())
    .then(res => {
      var chunks = chunkSubstr(res.result.substring(2), 64);
  
      var circulatingSupply = parseInt(chunks[11], 16).toString();
      circulatingSupply = circulatingSupply.substring(0, circulatingSupply.length - 8);
  
      var lockedHEX = parseInt(chunks[0], 16).toString();
      lockedHEX = lockedHEX.substring(0, lockedHEX.length - 8);
  
      var totalTshares = parseInt(chunks[5], 16).toString();
      totalTshares = totalTshares.substring(0, totalTshares.length - 12) + "." + totalTshares.substring(totalTshares.length - 12);
  
      return {
        circulatingHEX: parseInt(circulatingSupply),
        stakedHEX: parseInt(lockedHEX),
        totalTshares: parseFloat(totalTshares),
      };
    });
  }
  async function getEthereumPrice(){
    var url = "https://api.etherscan.io/api?module=stats&action=ethprice&apikey=" + CONFIG.etherscan.apiKey;
    return await fetchRetry(url, {
      method: 'GET',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => res.json())
      .then(res => {
            return Number(res.result.ethusd);
    });
  }
  
  async function getGas(){
    var url = "https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=" + CONFIG.etherscan.apiKey;
    return await fetchRetry(url, {
      method: 'GET',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => res.json())
      .then(res => {
      return {
          low: res.result.SafeGasPrice,
        average: res.result.ProposeGasPrice,
        high: res.result.FastGasPrice
      };
    });
  }
  module.exports = { 
    getCurrentDay: async () => {
       return await getCurrentDay();
    }
    ,getGlobalInfo: async () => {
        return await getGlobalInfo();
     }
     ,getEthereumPrice: async () => {
        return await getEthereumPrice();
     }
     ,getGas: async () => {
         return await getGas();
      }
 }
 