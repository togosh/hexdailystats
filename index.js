const http = require('http');
require('isomorphic-fetch');

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World');
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);

  //get_shareRateChange();
  //get_dailyDataUpdate();
  get_averageStakeLength();

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
        }
      }` 
    }),
  })
  .then(res => res.json())
  .then(res => console.log(res.data));
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

    if (count > 3) { break; } else { count += 1; }
    await sleep(1000);
  }

  console.log("=== SUMMARY")
  console.log("Stake Count -------- " + stakedCount);
  console.log("Avg Stake (Days) --- " + stakedDaysSum/stakedCount);
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

    var stakeStartsReduced = res.data.stakeStarts.reduce(function(previousValue, currentValue) {
      return {
        stakedDays: parseInt(previousValue.stakedDays, 10) + parseInt(currentValue.stakedDays, 10),
      }
    });

    var lastStakeId = res.data.stakeStarts[(stakeCount - 1)].stakeId;

    var stakeData = {  
      count: stakeCount, 
      lastStakeId: lastStakeId, 
      stakedDaysSum: stakeStartsReduced.stakedDays 
    };

    return stakeData;
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
