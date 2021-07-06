var CONFIG = require('./config.json');
const http = require('http');
require('isomorphic-fetch');

const HEX_CONTRACT_ADDRESS = "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39";
const HEX_CONTRACT_CURRENTDAY = "0x5c9302c9";
const HEX_CONTRACT_GLOBALINFO = "0xf04b5fa0";

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World');
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);

  //getCurrentDay();
  getGlobalInfo();

  //get_shareRateChange();
  //get_dailyDataUpdate();
  //get_averageStakeLength();
});

function get_shareRateChange(){
  fetch('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
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
  .then(res => console.log(res.data));
}
// tShareRateHEX === Tshare Rate (HEX)

function get_dailyDataUpdate(){
  fetch('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
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
  .then(res => console.log(res.data));
}
// payout === Daily Payout
// shares === Total Tshares

// === Average Stake Length
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

    console.log(count);
    count += 1;
    await sleep(500);
  }

  var averageStakeLength = stakedDaysSum/stakedCount;

  console.log("=== SUMMARY")
  console.log("Stake Count -------- " + stakedCount);
  console.log("Avg Stake (Days) --- " + averageStakeLength);
  console.log("Last Stake ID ------ " + $lastStakeId);
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
    console.log("currentDay: " + currentDay);
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
    console.log("globalInfo:");
    console.log(chunks);

    var circulatingSupply = parseInt(chunks[11], 16).toString();
    circulatingSupply = circulatingSupply.substring(0, circulatingSupply.length - 8);
    console.log("Total HEX:      " + circulatingSupply);

    var lockedHEX = parseInt(chunks[0], 16).toString();
    lockedHEX = lockedHEX.substring(0, lockedHEX.length - 8);
    console.log("Staked HEX:     " + lockedHEX);

    var percentStaked = ((lockedHEX / circulatingSupply) * 100);
    console.log("Percent Staked: " + percentStaked + "%");

    var stakePenaltyPool = parseInt(chunks[3], 16).toString();
    console.log(stakePenaltyPool);
    stakePenaltyPool = stakePenaltyPool.substring(0, stakePenaltyPool.length - 8);
    console.log("Stake Penalty:  " + stakePenaltyPool);
  });
}
