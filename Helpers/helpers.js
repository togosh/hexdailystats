var CONFIG = require('../config.json');
const FETCH_SIZE = 1048576;
const HEX_CONTRACT_ADDRESS = "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39";
const HEX_CONTRACT_CURRENTDAY = "0x5c9302c9";
const HEX_CONTRACT_GLOBALINFO = "0xf04b5fa0";

const USDC_CONTRACT_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH_CONTRACT_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const DAI_CONTRACT_ADDRESS = "0x6b175474e89094c44da98b954eedeac495271d0f";

const UNISWAP_V2_HEXUSDC = "0xf6dcdce0ac3001b2f67f750bc64ea5beb37b5824";
const UNISWAP_V2_HEXETH = "0x55d5c232d921b9eaa6b37b5845e439acd04b4dba";

const UNISWAP_V3_HEXUSDC = "0x69d91b94f0aaf8e8a2586909fa77a5c2c89818d5";
const UNISWAP_V3_HEXETH = "0x9e0905249ceefffb9605e034b534544684a58be6";

const HEX_SUBGRAPH_API_ETHEREUM = "https://api.thegraph.com/subgraphs/name/codeakk/hex";
//const HEX_SUBGRAPH_API_ETHEREUM = "https://gateway.thegraph.com/api/" + CONFIG.subgraph.apiKey + "/subgraphs/id/3gYSyeohaa7LtM9dw2q5w2ZuKXMFJrqZQTh2EjqKy5gp";

const log = (message) => {
    console.log(new Date().toISOString() + ", " + message);
}
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}
const onlyUnique = (value, index, self) => {
    return self.indexOf(value) === index;
}

function isEmpty(obj) {
	for(var prop in obj) {
			if(obj.hasOwnProperty(prop))
					return false;
	} 
	return true;
}

function getNum(val) {
  if (isNaN(val)) {
    return 0;
  }
  return val;
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

module.exports = { 
    log: log
    ,sleep: sleep
    ,onlyUnique: onlyUnique
    ,fetchRetry: fetchRetry
    ,isEmpty: isEmpty
    ,getNum: getNum
    ,CONFIG: CONFIG
    ,FETCH_SIZE: FETCH_SIZE
    ,HEX_CONTRACT_ADDRESS: HEX_CONTRACT_ADDRESS
    ,HEX_CONTRACT_CURRENTDAY: HEX_CONTRACT_CURRENTDAY
    ,HEX_CONTRACT_GLOBALINFO: HEX_CONTRACT_GLOBALINFO
    ,USDC_CONTRACT_ADDRESS: USDC_CONTRACT_ADDRESS
    ,WETH_CONTRACT_ADDRESS: WETH_CONTRACT_ADDRESS
    ,DAI_CONTRACT_ADDRESS: DAI_CONTRACT_ADDRESS
    ,UNISWAP_V2_HEXUSDC: UNISWAP_V2_HEXUSDC
    ,UNISWAP_V2_HEXETH: UNISWAP_V2_HEXETH
    ,UNISWAP_V3_HEXUSDC: UNISWAP_V3_HEXUSDC
    ,UNISWAP_V3_HEXETH: UNISWAP_V3_HEXETH
    ,HEX_SUBGRAPH_API_ETHEREUM: HEX_SUBGRAPH_API_ETHEREUM
 }
