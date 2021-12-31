const h = require('../Helpers/helpers'); 
const CONFIG = h.CONFIG;
const HEX_CONTRACT_ADDRESS = h.HEX_CONTRACT_ADDRESS;
const HEX_CONTRACT_CURRENTDAY = h.HEX_CONTRACT_CURRENTDAY;
const HEX_CONTRACT_GLOBALINFO = h.HEX_CONTRACT_GLOBALINFO;
const FETCH_SIZE = h.FETCH_SIZE;
const fetchRetry = h.fetchRetry;

function chunkSubstr(str, size) {
  const numChunks = Math.ceil(str.length / size);
  const chunks = new Array(numChunks);

  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substr(o, size);
  }

  return chunks;
} 

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
  
      var penalties = parseInt(chunks[3], 16).toString(); 
      penalties = penalties.substring(0, penalties.length - 8) + "." + penalties.substring(penalties.length - 8);
      penalties = parseFloat(penalties) * 2.0;

      return {
        circulatingHEX: parseInt(circulatingSupply),
        stakedHEX: parseInt(lockedHEX),
        totalTshares: parseFloat(totalTshares),
        penaltiesHEX: penalties,
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
 