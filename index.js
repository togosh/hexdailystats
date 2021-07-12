var DEBUG = false;
var CONFIG = require('./config.json');
const http = require('http');
require('isomorphic-fetch');
const express = require('express');
const path = require('path');

const { JSDOM } = require( "jsdom" );
const { window } = new JSDOM( "" );
const $ = require( "jquery" )( window );

const HEX_CONTRACT_ADDRESS = "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39";
const HEX_CONTRACT_CURRENTDAY = "0x5c9302c9";
const HEX_CONTRACT_GLOBALINFO = "0xf04b5fa0";

const UNISWAP_V2_HEXUSDC = "0xf6dcdce0ac3001b2f67f750bc64ea5beb37b5824";
const UNISWAP_V2_HEXETH = "0x55d5c232d921b9eaa6b37b5845e439acd04b4dba";

const UNISWAP_V3_HEXUSDC = "0x69d91b94f0aaf8e8a2586909fa77a5c2c89818d5";
const UNISWAP_V3_HEXETH = "0x9e0905249ceefffb9605e034b534544684a58be6";

var rowData = undefined;

const hostname = '127.0.0.1';
var httpPort = 80; 
if (DEBUG){ httpPort = 3000; }

const app = express();
const httpServer = http.createServer(app);

app.use(express.static(path.join(__dirname, 'public')));

app.get("/", function(req, res){ res.sendFile('/index.html', {root: __dirname}); });

httpServer.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);

  if (!getDataRunning){getData();}
});

var io = require('socket.io')(httpServer);

io.on('connection', (socket) => {
	console.log('SOCKET -- ************* CONNECTED: ' + socket.id + ' *************');
	if (rowData) {socket.emit("rowData", rowData)};
});

var getDataRunning = false;

async function getData() {
  
  getDataRunning = true;
  console.log("getData()");
  try {
  var currentDay = await getCurrentDay();
  var { totalHEX, stakedHEX } = await getGlobalInfo();
  
  var tshareRateHEX = await get_shareRateChange();
  var { dailyPayoutHEX, totalTshares } = await get_dailyDataUpdate();

  var averageStakeLength = await get_averageStakeLength();
  var penaltiesHEX = await get_dailyPenalties();

  var priceUV2 = await getUniswapV2HEXDailyPrice();
  var priceUV3 = await getUniswapV3HEXDailyPrice();

  var liquidityUV2_USDC = await getUniswapV2HEXUSDC();
  var liquidityUV2_ETH = await getUniswapV2HEXETH();

  var { liquidityUV3_USDC, liquidityUV3_ETH } = await getUniswapV3();

  console.log("Current Day      " + currentDay);
  console.log("Total HEX        " + totalHEX);
  console.log("Staked HEX       " + stakedHEX);
  console.log("Tshare Rate HEX  " + tshareRateHEX);
  console.log("Daily Payout     " + dailyPayoutHEX);
  console.log("Total Tshares    " + totalTshares);
  console.log("Avg Stake (Days) " + averageStakeLength);
  console.log("Total Penalties  " + penaltiesHEX);
  console.log("HEX Price UV2    " + priceUV2);
  console.log("HEX Price UV3    " + priceUV3);
  console.log("Liquid USDC UV2  " + liquidityUV2_USDC);
  console.log("Liquid ETH  UV2  " + liquidityUV2_ETH);
  console.log("Liquid USDC UV3  " + liquidityUV3_USDC);
  console.log("Liquid ETH  UV3  " + liquidityUV3_ETH);

  var printData = "" +
  "Current Day      " + currentDay + "\n" +
  "Total HEX        " + totalHEX + "\n" +
  "Staked HEX       " + stakedHEX + "\n" +
  "Tshare Rate HEX  " + tshareRateHEX + "\n" +
  "Daily Payout     " + dailyPayoutHEX + "\n" +
  "Total Tshares    " + totalTshares + "\n" +
  "Avg Stake Length " + averageStakeLength + "\n" +
  "Total Penalties  " + penaltiesHEX + "\n" +
  "HEX Price UV2    " + priceUV2 + "\n" +
  "HEX Price UV3    " + priceUV3 + "\n" +
  "Liquid USDC UV2  " + liquidityUV2_USDC + "\n" +
  "Liquid ETH  UV2  " + liquidityUV2_ETH + "\n" +
  "Liquid USDC UV3  " + liquidityUV3_USDC + "\n" +
  "Liquid ETH  UV3  " + liquidityUV3_ETH;

  var listData = [[currentDay, totalHEX, stakedHEX, tshareRateHEX, 
    dailyPayoutHEX, totalTshares, averageStakeLength, penaltiesHEX, 
    priceUV2, priceUV3, liquidityUV2_USDC, liquidityUV2_ETH,
    liquidityUV3_USDC, liquidityUV3_ETH]];

  if (rowData === undefined || rowData !== printData) {
    rowData = listData;
		console.log('SOCKET -- ****EMIT: rowData');
		io.emit("rowData", rowData);
	}

  getDataRunning = false;
  return printData;
  }catch (e){
    getDataRunning = false;
  }
}



//////////////////////////////////////
//// HELPER 

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

  return await fetch(etherScanURL, {
    method: 'GET',
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

  return await fetch(etherScanURL, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(res => res.json())
  .then(res => {
    var chunks = chunkSubstr(res.result.substring(2), 64);

    var circulatingSupply = parseInt(chunks[11], 16).toString();
    circulatingSupply = circulatingSupply.substring(0, circulatingSupply.length - 8);

    var lockedHEX = parseInt(chunks[0], 16).toString();
    lockedHEX = lockedHEX.substring(0, lockedHEX.length - 8);

    //var percentStaked = ((lockedHEX / circulatingSupply) * 100);

    return {
      totalHEX: circulatingSupply,
      stakedHEX: lockedHEX
    };
  });
}

async function get_shareRateChange(){
  return await fetch('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      query {
        shareRateChanges(
          first: 1, 
          orderDirection: desc, 
          orderBy: stakeId
        ) {
          shareRate
          tShareRateHearts
          tShareRateHex
        }
      }` 
    }),
  })
  .then(res => res.json())
  .then(res => {

    var tShareRateHEX = res.data.shareRateChanges[0].tShareRateHex;

    return tShareRateHEX;
  });
}

async function get_dailyDataUpdate(){
  return await fetch('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      query {
        dailyDataUpdates(
          first: 1, 
          orderDirection: desc, 
          orderBy: timestamp 
        ) {
          id
          payout
          shares
          payoutPerTShare
          endDay
        }
      }` 
    }),
  })
  .then(res => res.json())
  .then(res => {

    var payout = res.data.dailyDataUpdates[0].payout;
    payout = payout.substring(0, payout.length - 8);

    var totalTshares = res.data.dailyDataUpdates[0].shares;
    totalTshares = totalTshares.substring(0, totalTshares.length - 12);

    return {
      dailyPayoutHEX: payout,
      totalTshares: totalTshares
    }
  });
}

async function get_averageStakeLength(){

  var $lastStakeId = 0;
  var stakedDaysSum = 0;
  var stakedCount = 0;

  var count = 0;

  while (true) {
    var data = await get_stakeStarts($lastStakeId);
    if (data.count <= 0) { break; }
    stakedCount += data.count;
    stakedDaysSum += data.stakedDaysSum;
    $lastStakeId = data.lastStakeId;

    count += 1;
    await sleep(100);
  }

  var averageStakeLength = stakedDaysSum/stakedCount;
  var averageStakeLengthYears = averageStakeLength / 365.0;

  return parseFloat(averageStakeLengthYears.toFixed(4));
}

async function get_stakeStarts($lastStakeId){
  return await fetch('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      query {
        stakeStarts(first: 1000, orderBy: stakeId, 
          where: { 
            stakeId_gt: "` + $lastStakeId + `",
            stakeEnd: null, 
            stakeGoodAccounting: null 
          }
        ) {
          stakeId
          stakedDays
        }
      }` 
    }),
  })
  .then(res => res.json())
  .then(res => {
    var stakeCount = Object.keys(res.data.stakeStarts).length;

    if (stakeCount <= 0) {
      return {  
        count: 0
      };
    } 
    else {
    var stakeStartsReduced = res.data.stakeStarts.reduce(function(previousValue, currentValue) {
      return {
        stakedDays: parseInt(previousValue.stakedDays, 10) + parseInt(currentValue.stakedDays, 10),
      }
    });

    var lastStakeId = res.data.stakeStarts[(stakeCount - 1)].stakeId;

    var data = {  
      count: stakeCount, 
      stakedDaysSum: stakeStartsReduced.stakedDays,
      lastStakeId: lastStakeId
    };

    return data;
  }});
}

async function get_dailyPenalties(yesterday = true){

  var $lastStakeId = 0;
  var penaltiesSum = 0;
  var stakeCount = 0;
  var count = 0;

  var start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  if (yesterday) { start.setDate(start.getDate()-1); }
  var unixTimestamp = (start.valueOf() / 1000);
  //console.log(start);

  var end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  if (yesterday) { end.setDate(end.getDate()-1); }
  var unixTimestampEnd = (end.valueOf() / 1000);
  //console.log(end);

  while (true) {
    var data = await get_stakeEnds($lastStakeId, unixTimestamp, unixTimestampEnd);
    if (data.count <= 0) { break; }
    stakeCount += data.count;
    penaltiesSum += data.penalty;
    $lastStakeId = data.lastStakeId;

    count += 1;
    await sleep(100);
  }

  var $lastStakeId = 0;

  while (true) {
    var data = await get_stakeGoodAccountings($lastStakeId, unixTimestamp, unixTimestampEnd);
    if (data.count <= 0) { break; }
    stakeCount += data.count;
    penaltiesSum += data.penalty;
    $lastStakeId = data.lastStakeId;
    
    count += 1;
    await sleep(100);
  }

  var penaltyString = parseInt(penaltiesSum, 10).toString();
  penaltiesSum = penaltyString.substring(0, penaltyString.length - 8);

  return penaltiesSum;
}

async function get_stakeEnds($lastStakeId, unixTimestamp, unixTimestampEnd){
  return await fetch('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      query {
        stakeEnds(first: 1000, orderBy: stakeId, 
          where: { 
            stakeId_gt: "` + $lastStakeId + `",
            timestamp_gt: ` + unixTimestamp + `,
            timestamp_lt: ` + unixTimestampEnd + `,
            penalty_gt: 0
          }
        ) {
          stakeId
          penalty
        }
      }` 
    }),
  })
  .then(res => res.json())
  .then(res => {
    var stakeCount = Object.keys(res.data.stakeEnds).length;

    if (stakeCount <= 0) {
      return {  
        count: 0
      };
    } 
    else {
    var dataReduced = res.data.stakeEnds.reduce(function(previousValue, currentValue) {
      return {
        penalty: parseInt(previousValue.penalty, 10) + parseInt(currentValue.penalty, 10),
      }
    });

    var lastStakeId = res.data.stakeEnds[(stakeCount - 1)].stakeId;

    var data = {  
      count: stakeCount, 
      penalty: dataReduced.penalty,
      lastStakeId: lastStakeId
    };

    return data;
  }});
}

async function get_stakeGoodAccountings($lastStakeId, unixTimestamp, unixTimestampEnd){
  return await fetch('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      query {
        stakeGoodAccountings(first: 1000, orderBy: stakeId, 
          where: { 
            stakeId_gt: "` + $lastStakeId + `",
            timestamp_gt: ` + unixTimestamp + `,
            timestamp_lt: ` + unixTimestampEnd + `,
            penalty_gt: 0
          }
        ) {
          stakeId
          penalty
        }
      }` 
    }),
  })
  .then(res => res.json())
  .then(res => {
    var stakeCount = Object.keys(res.data.stakeGoodAccountings).length;

    if (stakeCount <= 0) {
      return {  
        count: 0
      };
    } 
    else {
    var dataReduced = res.data.stakeGoodAccountings.reduce(function(previousValue, currentValue) {
      return {
        penalty: parseInt(previousValue.penalty, 10) + parseInt(currentValue.penalty, 10),
      }
    });

    var lastStakeId = res.data.stakeGoodAccountings[(stakeCount - 1)].stakeId;

    var data = {  
      count: stakeCount, 
      penalty: dataReduced.penalty,
      lastStakeId: lastStakeId
    };

    return data;
  }});
}


/////////////////////////////////////////////
//// UNISWAP

async function getUniswapV2() {
  return await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      query {
        tokenDayDatas (
          first: 1
          orderBy: date, 
          orderDirection: desc,
          where: {
            token: "` + HEX_CONTRACT_ADDRESS + `"
          }
        ) {
          priceUSD
          totalLiquidityToken
          totalLiquidityUSD
          totalLiquidityETH
          mostLiquidPairs { id }
        }
      }` 
    }),
  })
  .then(res => res.json())
  .then(res => console.log(res.data));
}

async function getUniswapV2HEXETH(){
  return await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      query {
        pairDayDatas (
          orderBy: id, orderDirection: desc, first: 1,
          where: {pairAddress: "` + UNISWAP_V2_HEXETH + `"}){
         token0 {
           symbol
         }
          token1 {
            symbol
          }
          pairAddress
          reserve0
          reserve1
        }
      }` 
    }),
  })
  .then(res => res.json())
  .then(res => {
    var pairDayData = res.data.pairDayDatas[0];
    return parseFloat(pairDayData.reserve1).toFixed(4);
  });
}

async function getUniswapV2HEXUSDC(){
  return await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      query {
        pairDayDatas (
          orderBy: id, orderDirection: desc, first: 1,
          where: {pairAddress: "` + UNISWAP_V2_HEXUSDC + `"}){
         token0 {
           symbol
         }
          token1 {
            symbol
          }
          pairAddress
          reserve0
          reserve1
        }
      }` 
    }),
  })
  .then(res => res.json())
  .then(res => {
    var pairDayData = res.data.pairDayDatas[0];
    return parseFloat(pairDayData.reserve1).toFixed(4);
  });
}

async function getUniswapV2HEXDailyPrice(){
  return await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      query {
        tokenDayDatas (
          first: 1, 
          orderBy: date, 
          orderDirection: desc, 
          where: { 
            token: "` + HEX_CONTRACT_ADDRESS + `"
          }) 
            { 
              date
              token { symbol }
              priceUSD 
            }
      }` 
    }),
  })
  .then(res => res.json())
  .then(res => {
    var tokenDayData = res.data.tokenDayDatas[0];
    return parseFloat(tokenDayData.priceUSD).toFixed(8);
  });
}

async function getUniswapV3HEXDailyPrice(){
  return await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      query {
        tokenDayDatas (
          first: 1, 
          orderBy: date, 
          orderDirection: desc, 
          where: { 
            token: "` + HEX_CONTRACT_ADDRESS + `"
          }) 
            { 
              date
              token { symbol }
              priceUSD 
            }
      }` 
    }),
  })
  .then(res => res.json())
  .then(res => {
    var tokenDayData = res.data.tokenDayDatas[0];
    return parseFloat(tokenDayData.priceUSD).toFixed(8);
  });
}

async function getUniswapV3Pools() {
  return await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      query {
        token (id: "` + HEX_CONTRACT_ADDRESS + `") {
          id
          symbol
          name
          whitelistPools {
            id
          }
        }
      }` 
    }),
  })
  .then(res => res.json())
  .then(res => {
    pools = res.data.token.whitelistPools.map(function (obj) {
      return obj.id;
    });

    return pools;
  });
}

async function getUniswapV3() {
  //var pools = await getUniswapV3Pools();
  //await sleep(200);
  var pools = [ 
    UNISWAP_V3_HEXUSDC,
    UNISWAP_V3_HEXETH
  ]

  if (pools == undefined) {return;}

  return await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      query {
        pools (
          orderBy: volumeUSD, orderDirection: desc,
          where: {id_in: ` + JSON.stringify(pools) + `}
        ){
          id
          token0 { name }
          token1 { name }
          liquidity
          totalValueLockedToken0
          totalValueLockedToken1
          volumeUSD
        }
      }` 
    }),
  })
  .then(res => res.json())
  .then(res => {
    var liquidityUV3_USDC = 0;
    var liquidityUV3_ETH = 0;
    for(var i = 0; i < res.data.pools.length; i++) {
      var token0Name = res.data.pools[i].token0.name;
      var token1Name = res.data.pools[i].token1.name;
      var token0TVL = res.data.pools[i].totalValueLockedToken0;
      var token1TVL = res.data.pools[i].totalValueLockedToken1;

      if (token0Name == "HEX" && token1Name == "USD Coin") {
        liquidityUV3_USDC = token1TVL;
      } 
      
      if (token0Name == "HEX" && token1Name == "Wrapped Ether") {
        liquidityUV3_ETH = token1TVL;
      }
    }

    return {
      liquidityUV3_USDC: parseFloat(liquidityUV3_USDC).toFixed(4),
      liquidityUV3_ETH: parseFloat(liquidityUV3_ETH).toFixed(4)
    }
  });
}
