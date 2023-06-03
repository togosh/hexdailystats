const h = require('../Helpers/helpers');  
const log = h.log;
const sleep = h.sleep; 
const onlyUnique = h.onlyUnique;
const fetchRetry = h.fetchRetry;
const FETCH_SIZE = h.FETCH_SIZE;
const HEX_CONTRACT_ADDRESS = h.HEX_CONTRACT_ADDRESS;
const USDC_CONTRACT_ADDRESS = h.USDC_CONTRACT_ADDRESS;
const WETH_CONTRACT_ADDRESS = h.WETH_CONTRACT_ADDRESS;
const DAI_CONTRACT_ADDRESS = h.DAI_CONTRACT_ADDRESS;
const UNISWAP_V2_HEXUSDC = h.UNISWAP_V2_HEXUSDC;
const UNISWAP_V2_HEXETH = h.UNISWAP_V2_HEXETH;
const UNISWAP_V3_HEXUSDC = h.UNISWAP_V3_HEXUSDC;
const UNISWAP_V3_HEXETH = h.UNISWAP_V3_HEXETH;
const UNISWAP_V2_API = h.UNISWAP_V2_API;
const UNISWAP_V3_API = h.UNISWAP_V3_API;
const HEX_SUBGRAPH_API_ETHEREUM = h.HEX_SUBGRAPH_API_ETHEREUM;
const HEX_SUBGRAPH_API_PULSECHAIN = h.HEX_SUBGRAPH_API_PULSECHAIN;
const PULSEX_SUBGRAPH_API_PULSECHAIN = h.PULSEX_SUBGRAPH_API_PULSECHAIN;
const PULSECHAIN_HEXPLS = h.PULSECHAIN_HEXPLS;
const PULSECHAIN_HEXPLSX = h.PULSECHAIN_HEXPLSX;
const PULSECHAIN_HEXINC = h.PULSECHAIN_HEXINC;
const PULSECHAIN_HEXUSDC = h.PULSECHAIN_HEXUSDC;
const PULSECHAIN_HEXDAI = h.PULSECHAIN_HEXDAI;
const PULSECHAIN_CONTRACT_ADDRESS = h.PULSECHAIN_CONTRACT_ADDRESS;
const PULSEX_CONTRACT_ADDRESS = h.PULSEX_CONTRACT_ADDRESS;
const INC_CONTRACT_ADDRESS = h.INC_CONTRACT_ADDRESS;
const BLOCK_SUBGRAPH_API_ETHEREUM = h.BLOCK_SUBGRAPH_API_ETHEREUM
const BLOCK_SUBGRAPH_API_PULSECHAIN = h.BLOCK_SUBGRAPH_API_PULSECHAIN

const day2Epoch = 1575417600 + 86400;

module.exports = class TheGraph {
  constructor(network) {
    this.network = network;
    if (network == h.ETHEREUM){
      this.hexAPI = HEX_SUBGRAPH_API_ETHEREUM;
      this.blockAPI = BLOCK_SUBGRAPH_API_ETHEREUM;
    } else if (network == h.PULSECHAIN){
      this.hexAPI = HEX_SUBGRAPH_API_PULSECHAIN;
      this.blockAPI = BLOCK_SUBGRAPH_API_PULSECHAIN;
    } else {
      console.log("ERROR: TheGraph does not support this network: " + network);
    }
  }

  async get_GraphData(query){
    let call = await fetchRetry(this.hexAPI, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify
      ({ 
        query: query
      })
    });
  
    let response = await call.json();
    return response.data;
  }

  ////////////////////////////////
  // STAKES

  async get_latestStakeStartId(blockNumber) {
    let query = `
    query {
      stakeStarts(
        first: 1, 
        orderBy: stakeId, 
        orderDirection: desc,
        block: {number: ` + blockNumber + `},
      ) {
        stakeId
      }
    }`; 
    let data = await this.get_GraphData(query); 
    return data['stakeStarts'];
  }

  async get_stakeStartsCountHistoricalBlock($lastStakeId, blockNumber){
    return await fetchRetry(this.hexAPI, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          stakeStarts(first: 1000, orderBy: stakeId, 
            block: {number: ` + blockNumber + `},
            where: { 
              stakeId_gt: "` + $lastStakeId + `"
            }
          ) {
            stakeId
            stakerAddr
          }
        }` 
      }),
    })
    .then(res => res.json())
    .then(res => {
      try {
      var stakeCount = Object.keys(res.data.stakeStarts).length;
      if (stakeCount <= 0) {
        return {  
          count: 0,
          lastStakeId: lastStakeId,
          uniqueAddresses: []
        };
      }
  
      var lastStakeId = res.data.stakeStarts[(stakeCount - 1)].stakeId;
      var uniqueAddresses = res.data.stakeStarts.map(a => a.stakerAddr).filter(onlyUnique);
  
      var data = {  
        count: stakeCount, 
        lastStakeId: lastStakeId,
        uniqueAddresses: uniqueAddresses,
      };
  
      return data;
      } catch (error){
        console.log("ERROR  - get_stakeStartsCountHistoricalBlock() - " + error.message);
        return {  
          count: 0,
          lastStakeId: lastStakeId,
          uniqueAddresses: [],
        };
      }
    });
  }

  async get_stakeStartGAsHistorical($lastStakeId, blockNumber){
    return await fetchRetry(this.hexAPI, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          stakeStarts(first: 1000, orderBy: stakeId, 
            block: {number: ` + blockNumber + `},
            where: { 
              stakeId_gt: "` + $lastStakeId + `",
              stakeEnd: null, 
              stakeGoodAccounting_not: null 
            }
          ) {
            stakeId
            stakedDays
            stakerAddr
            stakedHearts
          }
        }` 
      }),
    })
    .then(res => res.json())
    .then(res => {
      try {
        var stakeCount = Object.keys(res.data.stakeStarts).length;
    
        if (stakeCount <= 0) {
          return {  
            count: 0
          };
        } 
        else {
          var stakeStartsReduced = res.data.stakeStarts.reduce(function(previousValue, currentValue) {
            return {
              stakedHearts: parseInt(previousValue.stakedHearts, 10) + parseInt(currentValue.stakedHearts, 10),
            }
          });
    
          var lastStakeId = res.data.stakeStarts[(stakeCount - 1)].stakeId;

          var data = {  
            lastStakeId: lastStakeId,
            stakedHEXGA: stakeStartsReduced.stakedHearts / 100000000,
          };
    
          return data;
        }
      } catch (error){
        console.log("ERROR - get_stakeStartGAsHistorical() - " + error.message);
        return {  
          count: 0
        };
      }
    });
  }

  async get_stakeStartsHistorical($lastStakeId, blockNumber){
    return await fetchRetry(this.hexAPI, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          stakeStarts(first: 1000, orderBy: stakeId, 
            block: {number: ` + blockNumber + `},
            where: { 
              stakeId_gt: "` + $lastStakeId + `",
              stakeEnd: null, 
              stakeGoodAccounting: null 
            }
          ) {
            stakeId
            stakedDays
            stakerAddr
            stakedHearts
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
            stakedHearts: parseInt(previousValue.stakedHearts, 10) + parseInt(currentValue.stakedHearts, 10),
          }
        });
    
        var weightedAverageSum = 0.0;
        for (let i = 0; i < res.data.stakeStarts.length; i++) {
          weightedAverageSum += res.data.stakeStarts[i].stakedDays * (res.data.stakeStarts[i].stakedHearts / 100000000.0);
        }
    
        var lastStakeId = res.data.stakeStarts[(stakeCount - 1)].stakeId;
    
        var uniqueAddresses = res.data.stakeStarts.map(a => a.stakerAddr).filter(onlyUnique);
    
        var data = {  
          count: stakeCount, 
          stakedDaysSum: stakeStartsReduced.stakedDays,
          lastStakeId: lastStakeId,
          uniqueAddresses: uniqueAddresses,
          stakedHEX: stakeStartsReduced.stakedHearts / 100000000,
          weightedAverageSum: weightedAverageSum,
        };
    
        return data;
      }
    });
  }

  async get_stakeEnds_Historical(blockNumber, $lastStakeId, unixTimestamp, unixTimestampEnd){
    return await fetchRetry(this.hexAPI, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          stakeEnds(first: 1000, orderBy: stakeId, 
            block: {number: ` + blockNumber + `},
            where: { 
              stakeId_gt: "` + $lastStakeId + `",
              timestamp_gte: ` + unixTimestamp + `,
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
      }
    });
  }

  async get_stakeGoodAccountings_Historical(blockNumber, $lastStakeId, unixTimestamp, unixTimestampEnd){
    return await fetchRetry(this.hexAPI, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          stakeGoodAccountings(first: 1000, orderBy: stakeId, 
            block: {number: ` + blockNumber + `},
            where: { 
              stakeId_gt: "` + $lastStakeId + `",
              timestamp_gte: ` + unixTimestamp + `,
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
      }
    });
  }

  async get_stakeStarts($lastStakeId, blockNumber){
    return await fetchRetry(this.hexAPI, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          stakeStarts(first: 1000, orderBy: stakeId,  
            block: {number: ` + blockNumber + `},
            where: { 
              stakeId_gt: "` + $lastStakeId + `",
              stakeEnd: null, 
              stakeGoodAccounting: null 
            }
          ) {
            stakeId
            stakedDays
            stakerAddr
            stakedHearts
          }
        }` 
      }),
    })
    .then(res => res.json())
    .then(res => {
      try {
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
              stakedHearts: parseInt(previousValue.stakedHearts, 10) + parseInt(currentValue.stakedHearts, 10),
            }
          });
    
          var weightedAverageSum = 0.0;
          for (let i = 0; i < res.data.stakeStarts.length; i++) {
            weightedAverageSum += res.data.stakeStarts[i].stakedDays * (res.data.stakeStarts[i].stakedHearts / 100000000.0);
          }
    
          var lastStakeId = res.data.stakeStarts[(stakeCount - 1)].stakeId;
    
          var uniqueAddresses = res.data.stakeStarts.map(a => a.stakerAddr).filter(onlyUnique);
    
          var data = {  
            count: stakeCount, 
            stakedDaysSum: stakeStartsReduced.stakedDays,
            lastStakeId: lastStakeId,
            uniqueAddresses: uniqueAddresses,
            stakedHEX: stakeStartsReduced.stakedHearts / 100000000,
            weightedAverageSum: weightedAverageSum,
          };
    
          return data;
        }
      } catch (error){
        console.log("ERROR - get_stakeStartGAsHistorical() - " + error.message);
        return {  
          count: 0
        };
      }
    });
  }

  async get_stakeEnds($lastStakeId, unixTimestamp, unixTimestampEnd){
    return await fetchRetry(this.hexAPI, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          stakeEnds(first: 1000, orderBy: stakeId, 
            where: { 
              stakeId_gt: "` + $lastStakeId + `",
              timestamp_gte: ` + unixTimestamp + `,
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

  async get_stakeGoodAccountings($lastStakeId, unixTimestamp, unixTimestampEnd){
    return await fetchRetry(this.hexAPI, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          stakeGoodAccountings(first: 1000, orderBy: stakeId, 
            where: { 
              stakeId_gt: "` + $lastStakeId + `",
              timestamp_gte: ` + unixTimestamp + `,
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

  ////////////////////////////////
  // TOKENHOLDERS
  
  async get_numberOfHolders(blockNumber){
    let query = `
       query {
         tokenHolders( 
           first: 1, 
           block: {number: ` + blockNumber + `},
           orderDirection: desc, 
           orderBy: numeralIndex
         ) {
           numeralIndex
         }
       }`; 
     let data = await this.get_GraphData(query);
     console.log("data");
     console.log(data);
     console.log("data.tokenHolders[0]");
     console.log(data.tokenHolders[0]);
     var numberOfHolders = parseInt(data.tokenHolders[0].numeralIndex);
     console.log("numberOfHolders");
     console.log(numberOfHolders);
     return numberOfHolders;
  }

  async get_tokenHolders_Historical(blockNumber, $lastNumeralIndex){
    return await fetchRetry(this.hexAPI, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          tokenHolders(first: 1000, orderBy: numeralIndex, 
            block: {number: ` + blockNumber + `},
            where: { 
              numeralIndex_gt: "` + $lastNumeralIndex + `",
              tokenBalance_gt: 0
            }
          ) {
            numeralIndex
            tokenBalance
            holderAddress
          }
        }` 
      }),
    })
    .then(res => res.json())
    .then(res => {
      var tokenHolders = Object.keys(res.data.tokenHolders).length;
  
      if (tokenHolders <= 0) {
        return {  
          count: 0
        };
      } 
      else {
        var tokenHoldersReduced = res.data.tokenHolders.reduce(function(previousValue, currentValue) {
          return {
            tokenBalance: parseInt(previousValue.tokenBalance, 10) + parseInt(currentValue.tokenBalance, 10),
          }
        });
    
        var uniqueAddresses = res.data.tokenHolders.map(a => a.holderAddress).filter(onlyUnique);
    
        var lastNumeralIndex = res.data.tokenHolders[(tokenHolders - 1)].numeralIndex;
    
        var data = {  
          count: tokenHolders, 
          circulatingHEX: tokenHoldersReduced.tokenBalance / 100000000,
          uniqueAddresses: uniqueAddresses,
          lastNumeralIndex: lastNumeralIndex
        };
    
        return data;
      }
    });
  }

  async get_numberOfHolders_Historical(blockNumber){
    return await fetchRetry(this.hexAPI, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          tokenHolders(
            block: {number: ` + blockNumber + `},
            first: 1, 
            orderDirection: desc, 
            orderBy: numeralIndex
          ) {
            numeralIndex
          }
        }` 
      }),
    })
    .then(res => res.json())
    .then(res => {
      try {
        var numberOfHolders = parseInt(res.data.tokenHolders[0].numeralIndex);
        return numberOfHolders;
      } catch (error) {
        return 0;
      }
    });
  }

  ////////////////////////////////
  // SHARERATE

  async get_shareRateChangeByTimestamp(timestamp){
    log("get_shareRateChangeByTimestamp() --- timestamp " + timestamp);
    return await fetchRetry(this.hexAPI, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          shareRateChanges(
            first: 1, 
            orderDirection: desc, 
            orderBy: timestamp,
            where: { 
              timestamp_lt: ` + timestamp + `,
            } 
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
      log(res);
      log(Object.keys(res.data.shareRateChanges).length);
      if (Object.keys(res.data.shareRateChanges).length <= 0) {
        return {
          tShareRateHEX: 0
        }
      }
  
      var tShareRateHEX = res.data.shareRateChanges[0].tShareRateHex;
      log(tShareRateHEX);
  
      return {
        tShareRateHEX: tShareRateHEX
      }
    });
  }

  async get_shareRateChange(){
    return await fetchRetry(this.hexAPI, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          shareRateChanges(
            first: 1, 
            orderDirection: desc, 
            orderBy: timestamp
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

  ////////////////////////////////
  // DAILYDATA

  async get_dailyDataUpdate(currentDay){
    log("get_dailyDataUpdate");
    return await fetchRetry(this.hexAPI, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          dailyDataUpdates(
            first: 1, 
            orderDirection: desc, 
            orderBy: timestamp,
            where: { 
              endDay_lte: ` + currentDay + `,
            } 
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
      if (Object.keys(res.data.dailyDataUpdates).length <= 0){
        log("get_dailyDataUpdate - Data Missing -  Day #: " + currentDay);
  
        return {
          success: false
        };
      }
  
      var payout = res.data.dailyDataUpdates[0].payout;
      payout = payout.substring(0, payout.length - 8) + "." + payout.substring(payout.length - 8);
  
      var totalTshares = res.data.dailyDataUpdates[0].shares;
      if (totalTshares == 0) {
        totalTshares = "0";
      } else {
        totalTshares = totalTshares.substring(0, totalTshares.length - 12) + "." + totalTshares.substring(totalTshares.length - 12);
      }
  
      return {
        dailyPayoutHEX: parseFloat(payout),
        totalTshares: parseFloat(totalTshares),
        success: true
      }
    });
  }

  async get_latestDay(){
    let query = `
       query {
        dailyDataUpdates(
          first: 1,
          orderBy: endDay,
          orderDirection: desc
          ) {
            endDay 
          }
       }`; 
     let data = await this.get_GraphData(query);
     var latestDay = parseInt(data.dailyDataUpdates[0].endDay);
     return latestDay;
  }

  ////////////////////////////////
  // GLOBALINFO

  async get_globalInfoByDay(day) {
    let query = `
        query {
          globalInfos(
          first: 1,
          orderBy: timestamp,
          orderDirection: asc,
          where: { 
            hexDay: ` + day + `,
          } 
          ) {
            totalHeartsinCirculation
            ,lockedHeartsTotal
            ,blocknumber
            ,timestamp
          }
        }`; 
    let data = await this.get_GraphData(query); 
    return data['globalInfos'];
  }
  
  async get_globalInfo() {
    let query = `
        query {
          globalInfos(
          first: 1,
          orderBy: timestamp,
          orderDirection: desc,
          ) {
            totalHeartsinCirculation
            ,lockedHeartsTotal
            ,stakeSharesTotal
            ,stakePenaltyTotal
            ,blocknumber
            ,timestamp
          }
        }`; 
    try {
      let data = await this.get_GraphData(query); 
      return data['globalInfos'];
    } catch (e) {
      console.log("ERROR: get_globalInfo() - " + e)
      return {
        totalHeartsinCirculation: 0
        ,lockedHeartsTotal: 0
        ,stakeSharesTotal: 0
        ,stakePenaltyTotal: 0
        ,blocknumber: 0
        ,timestamp: 0
      }
    }
  }

  ////////////////////////////////
  // BLOCKS

  async getEthereumBlock(day){
    var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
  
    return await fetchRetry(this.blockAPI, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          blocks(
            first: 1, 
            orderBy: timestamp, 
            orderDirection: asc, 
            where: {
              timestamp_gt: ` + startTime + `
            }
          ){
            id
            number
            timestamp
          }
        }` 
      }),
    })
    .then(res => res.json())
    .then(res => {
      var block = res.data.blocks[0];
      return block.number;
    });
  }

  ////////////////////////////////
  // UNISWAP

  async getUniswapV1PriceAndLiquidityHistorical(timestamp){
    return await fetchRetry(h.UNISWAP_V1_API, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          exchangeHistoricalDatas(
            first: 1,
            where: { 
              exchangeAddress: "0x05cde89ccfa0ada8c88d5a23caaa79ef129e7883",
              timestamp_gt: ` + timestamp + `
            }, 
            orderBy: timestamp, 
            orderDirection: asc
          ) {
            type
            timestamp
            ethBalance
            tokenBalance
            tokenPriceUSD
          }
        }` 
      }),
    })
    .then(res => res.json())
    .then(res => {
      try {
      var data = res.data.exchangeHistoricalDatas[0];
      return {
        tokenPriceUSD: parseFloat(data.tokenPriceUSD),
        tokenBalance: parseFloat(data.tokenBalance),
        ethBalance: parseFloat(data.ethBalance)
      }
      } catch (error) {
        log(error);
        return {
          tokenPriceUSD: 0.0,
          tokenBalance: 0.0,
          ethBalance: 0.0
        }
      }
    });
  }

  async getUniswapV2HEXDailyPriceHistorical(dateEpoch){
    return await fetchRetry(UNISWAP_V2_API, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          tokenDayDatas (
            first: 1, 
            orderBy: date, 
            orderDirection: desc, 
            where: { 
              token: "` + HEX_CONTRACT_ADDRESS + `",
              date: ` + dateEpoch + `,
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
      try {
      var tokenDayData = res.data.tokenDayDatas[0];
      return parseFloat(parseFloat(tokenDayData.priceUSD).toFixed(8));
      } catch (error) {
        return 0.0;
      }
    });
  }

  async getUniswapV3HEXDailyPriceHistorical(dateEpoch){
    return await fetchRetry(UNISWAP_V3_API, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          tokenDayDatas (
            first: 1, 
            orderBy: date, 
            orderDirection: desc, 
            where: { 
              token: "` + HEX_CONTRACT_ADDRESS + `",
              date: ` + dateEpoch + `,
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
      try {
      var tokenDayData = res.data.tokenDayDatas[0];
      return parseFloat(parseFloat(tokenDayData.priceUSD).toFixed(8));
      } catch (error) {
        return 0.0;
      }
    });
  }

  async getUniswapV2() {
    return await fetchRetry(UNISWAP_V2_API, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
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

  async getUniswapV2HEXETH(day){
    var startTime = day2Epoch + ((day - 2) * 86400);
    var endTime = startTime - 86400;
    let where = "";
    
    if (day != undefined ){
      where = `
          date_lt: ` + startTime + `,
          date_gte: ` + endTime + `,
        `
    }

    return await fetchRetry(UNISWAP_V2_API, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          pairDayDatas (
            orderBy: id, orderDirection: desc, first: 1,
            where: {pairAddress: "` + UNISWAP_V2_HEXETH + `",
            ` + where + `  
          }){
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
      try {
      var pairDayData = res.data.pairDayDatas[0];
  
      return {
        liquidityUV2_HEXETH: parseInt(pairDayData.reserve0),
        liquidityUV2_ETH: parseInt(pairDayData.reserve1),
      }
    } catch (error){
      return {
        liquidityUV2_HEXETH: 0,
        liquidityUV2_ETH: 0,
      }
    }
    });
  }

  async getUniswapV2HEXETHHistorical(dateEpoch){
    console.log("getUniswapV2HEXETHHistorical() - START");
    return await fetchRetry(UNISWAP_V2_API, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          pairDayDatas (
            orderBy: id, orderDirection: desc, first: 1,
            where: {
              pairAddress: "` + UNISWAP_V2_HEXETH + `",
              date: ` + dateEpoch + `
          }){
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
      try {
        var pairDayData = res.data.pairDayDatas[0];
  
        return {
          liquidityUV2_HEXETH: parseInt(pairDayData.reserve0),
          liquidityUV2_ETH: parseInt(pairDayData.reserve1),
        }
      } catch (error) {
        return {
          liquidityUV2_HEXETH: 0.0,
          liquidityUV2_ETH: 0.0
        }
      }
    });
  }

  async getUniswapV2HEXUSDC_Polling(day){
    var count = 0;
    while (true){
      var { liquidityUV2_HEXUSDC, liquidityUV2_USDC } = await this.getUniswapV2HEXUSDC(day); await sleep(1000);
      if ( liquidityUV2_HEXUSDC != 0 && liquidityUV2_USDC != 0){
        break;
      }
      count += 1;
      if (count > 3) {
        break;
      }
      log("getUniswapV2HEXUSDC_Polling() --- RETRY " + count);
      await sleep(1000);
    }
    return { liquidityUV2_HEXUSDC, liquidityUV2_USDC };
  }

  async getUniswapV2HEXUSDC(day){
    var startTime = day2Epoch + ((day - 2) * 86400);
    var endTime = startTime - 86400;
    let where = "";
    
    if (day != undefined ){
      where = `
          date_lt: ` + startTime + `,
          date_gte: ` + endTime + `,
        `
    }

    return await fetchRetry(UNISWAP_V2_API, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          pairDayDatas (
            orderBy: id, orderDirection: desc, first: 1,
            where: {pairAddress: "` + UNISWAP_V2_HEXUSDC + `",
            ` + where + ` 
          }){
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
      try {
        var pairDayData = res.data.pairDayDatas[0];
  
        return {
          liquidityUV2_HEXUSDC: parseInt(pairDayData.reserve0),
          liquidityUV2_USDC: parseInt(pairDayData.reserve1),
        }   
      } catch (error){
        log("getUniswapV2HEXUSDC() --- ERROR --- " + error.toString() + " --- " + error.stack);
        log(res);
        log(JSON.stringify(res));
        return {
          liquidityUV2_HEXUSDC: 0,
          liquidityUV2_USDC: 0,
        }
      }     
    });
  }

  async getUniswapV2HEXUSDCHistorical(dateEpoch){
    return await fetchRetry(UNISWAP_V2_API, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          pairDayDatas (
            orderBy: date, orderDirection: desc, first: 1,
            where: {
              pairAddress: "` + UNISWAP_V2_HEXUSDC + `",
              date: ` + dateEpoch + `
          }){
           token0 {
             symbol
           }
            token1 {
              symbol
            }
            pairAddress
            reserve0
            reserve1
            date
          }
        }` 
      }),
    })
    .then(res => res.json())
    .then(res => {
      try {
      var pairDayData = res.data.pairDayDatas[0];
  
      return {
        liquidityUV2_HEXUSDC: parseInt(pairDayData.reserve0),
        liquidityUV2_USDC: parseInt(pairDayData.reserve1),
      }
    } catch (error) {
      return {
        liquidityUV2_HEXUSDC: 0.0,
        liquidityUV2_USDC: 0.0
      }
    }
    });
  }

  async getUniswapV2HEXDailyPrice(day){
    var startTime = day2Epoch + ((day - 2) * 86400);
    var endTime = startTime - 86400;
    let where = "";
    
    if (day != undefined ){
      where = `
          date_lt: ` + (startTime)+ `,
          date_gte: ` + endTime + `,
        `
    }

    return await fetchRetry(UNISWAP_V2_API, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          tokenDayDatas (
            first: 1, 
            orderBy: date, 
            orderDirection: desc, 
            where: { 
              token: "` + HEX_CONTRACT_ADDRESS + `",
              ` + where + `
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
      return parseFloat(parseFloat(tokenDayData.priceUSD).toFixed(8));
    });
  }

  async getUniswapV3HEXDailyPrice(day){
    var startTime = day2Epoch + ((day - 2) * 86400);
    var endTime = startTime - 86400;
    let where = "";
    
    if (day != undefined ){
      where = `
          date_lt: ` + (startTime)+ `,
          date_gte: ` + endTime + `,
        `
    }

    return await fetchRetry(UNISWAP_V3_API, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          tokenDayDatas (
            first: 1, 
            orderBy: date, 
            orderDirection: desc, 
            where: { 
              token: "` + HEX_CONTRACT_ADDRESS + `",
              ` + where + `
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
      return parseFloat(parseFloat(tokenDayData.priceUSD).toFixed(8));
    });
  }

  async getUniswapV3Pools() {
    return await fetchRetry(UNISWAP_V3_API, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
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

  async getUniswapV3Historical(blockNumber) {
    return await fetchRetry(UNISWAP_V3_API, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          pools (
            orderBy: totalValueLockedUSD, orderDirection: desc,
            block: {number: ` + blockNumber + `},
            where: {
              token0: "` + HEX_CONTRACT_ADDRESS + `",
              token1_in: [
                "` + USDC_CONTRACT_ADDRESS + `",
                "` + WETH_CONTRACT_ADDRESS + `"
              ]
            }
          ){
            id
            feeTier
            token0 { name }
            token1 { name }
            liquidity
            volumeToken0
            volumeToken1
            totalValueLockedToken0
            totalValueLockedToken1
            volumeUSD
          }
        }` 
      }),
    })
    .then(res => res.json())
    .then(res => {
      try {
        var liquidityUV3_USDC = 0;
        var liquidityUV3_ETH = 0;
        var liquidityUV3_HEX = 0;
        for(var i = 0; i < res.data.pools.length; i++) {
          var current = res.data.pools[i];

          //const id = current.id
          const token0Name = current.token0.name;
          const token1Name = current.token1.name;

          var tvlToken0 = current.totalValueLockedToken0;
          var tvlToken1 = current.totalValueLockedToken1;

          if (blockNumber >= 14317965) { // ~March 4th 2022 ~Day 824?
            const feePercent = parseFloat(current.feeTier) / 10000 / 100;
            const tvlAdjust0 = current.volumeToken0 ? (parseFloat(current.volumeToken0) * feePercent) / 2 : 0;
            const tvlAdjust1 = current.volumeToken1 ? (parseFloat(current.volumeToken1) * feePercent) / 2 : 0;
            tvlToken0 = current ? parseFloat(current.totalValueLockedToken0) - tvlAdjust0 : 0;
            tvlToken1 = current ? parseFloat(current.totalValueLockedToken1) - tvlAdjust1 : 0;
          }

          if (token0Name == "HEX" && token1Name == "USD Coin") {
            liquidityUV3_HEX += parseInt(tvlToken0);
            liquidityUV3_USDC += parseInt(tvlToken1);
          } 
          
          if (token0Name == "HEX" && token1Name == "Wrapped Ether") {
            liquidityUV3_HEX += parseInt(tvlToken0);
            liquidityUV3_ETH += parseInt(tvlToken1);
          }
        }
    
        return {
          liquidityUV3_HEX: liquidityUV3_HEX,
          liquidityUV3_USDC: liquidityUV3_USDC,
          liquidityUV3_ETH: liquidityUV3_ETH,
        }
      } catch (error){
        return {
          liquidityUV3_HEX: 0,
          liquidityUV3_USDC: 0,
          liquidityUV3_ETH: 0
        }
      }
    });
  }

  async getUniswapV3() {
    return await fetchRetry(UNISWAP_V3_API, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          pools (
            orderBy: totalValueLockedUSD, orderDirection: desc,
            where: {
              token0: "` + HEX_CONTRACT_ADDRESS + `",
              token1_in: [
                "` + USDC_CONTRACT_ADDRESS + `",
                "` + WETH_CONTRACT_ADDRESS + `",
                "` + DAI_CONTRACT_ADDRESS + `"
              ]
            }
          ){
            id
            feeTier
            token0 { name }
            token1 { name }
            liquidity
            volumeToken0
            volumeToken1
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
      var liquidityUV3_HEX = 0;
      var liquidityUV3_DAI = 0;
  
      if (res && res.data && res.data.pools) {
        for(var i = 0; i < res.data.pools.length; i++) {
          var current = res.data.pools[i];

          //const id = current.id
          const token0Name = current.token0.name;
          const token1Name = current.token1.name;
          
          const feePercent = parseFloat(current.feeTier) / 10000 / 100;
          const tvlAdjust0 = current.volumeToken0 ? (parseFloat(current.volumeToken0) * feePercent) / 2 : 0;
          const tvlAdjust1 = current.volumeToken1 ? (parseFloat(current.volumeToken1) * feePercent) / 2 : 0;
          const tvlToken0 = current ? parseFloat(current.totalValueLockedToken0) - tvlAdjust0 : 0;
          const tvlToken1 = current ? parseFloat(current.totalValueLockedToken1) - tvlAdjust1 : 0;
    
          if (token0Name == "HEX" && token1Name == "USD Coin") {
            liquidityUV3_HEX += parseInt(tvlToken0);
            liquidityUV3_USDC += parseInt(tvlToken1);
          } 
          
          if (token0Name == "HEX" && token1Name == "Wrapped Ether") {
            liquidityUV3_HEX += parseInt(tvlToken0);
            liquidityUV3_ETH += parseInt(tvlToken1);
          }

          if (token0Name == "HEX" && token1Name == "Dai Stablecoin") {
            liquidityUV3_HEX += parseInt(tvlToken0);
            liquidityUV3_DAI += parseInt(tvlToken1);
          }
        }
    
        return {
          liquidityUV3_HEX: liquidityUV3_HEX,
          liquidityUV3_USDC: liquidityUV3_USDC,
          liquidityUV3_ETH: liquidityUV3_ETH,
          liquidityUV3_DAI: liquidityUV3_DAI
        }
      } else {
        return {
          liquidityUV3_HEX: 0,
          liquidityUV3_USDC: 0,
          liquidityUV3_ETH: 0,
          liquidityUV3_DAI: 0
        }
      }
    });
  }

  //////////////////////////////////////////////////////////////////////////
  // PULSEX

  async getPulseXPairs(){
    var totalHEX = 0;
    var totalPLS = 0;
    var totalPLSX = 0;
    var totalINC = 0;
    var totalUSDC = 0;
    var totalDAI = 0;

    var liquidity_HEXPLS = await getPulseXPair(PULSECHAIN_HEXPLS); await sleep(500);
    var liquidity_HEXPLSX = await getPulseXPair(PULSECHAIN_HEXPLSX); await sleep(500);
    var liquidity_HEXINC = await getPulseXPair(PULSECHAIN_HEXINC); await sleep(500);
    var liquidity_HEXUSDC = 0; //await getPulseXPair(PULSECHAIN_HEXUSDC); await sleep(500);
    var liquidity_HEXDAI = await getPulseXPair(PULSECHAIN_HEXDAI); await sleep(500);

    totalHEX += liquidity_HEXPLS.HEX + 
                liquidity_HEXPLSX.HEX + 
                liquidity_HEXINC.HEX +
                //liquidity_HEXUSDC.HEX +
                liquidity_HEXDAI.HEX;

    totalPLS += liquidity_HEXPLS.OTHER;
    totalPLSX += liquidity_HEXPLSX.OTHER;
    totalINC += liquidity_HEXINC.OTHER;
    totalUSDC = 0; // += liquidity_HEXUSDC.OTHER;
    totalDAI += liquidity_HEXDAI.OTHER;

    return {
      HEX: totalHEX,
      PLS: totalPLS,
      PLSX: totalPLSX,
      INC: totalINC,
      USDC: totalUSDC,
      DAI: totalDAI
    }
  }

  async getPulseXPair(pairAddress){
    return await fetchRetry(PULSEX_SUBGRAPH_API_PULSECHAIN, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          pairDayDatas (
            orderBy: id, orderDirection: desc,
            where: { pairAddress: "` + pairAddress + `"
          }){
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
      try {
        var pairDayData = res.data.pairDayDatas[0];
    
        return {
          HEX: parseInt(pairDayData.reserve0),
          OTHER: parseInt(pairDayData.reserve1),
        }
      } catch (error){
        return {
          HEX: 0,
          OTHER: 0,
        }
      }
    });
  }

  async getPulseXPairPriceAndLiquidity(pairAddress, day=undefined){
    //var blockParam = "";
    //if(blocknumber){
    //  blockParam = `block: {number: ` + blocknumber + `},`
    //}

    var orderDirection = "desc";
    var dateParam = "";
    if (day){
      var startTime = day2Epoch + ((day - 2) * 86400)  - 86400;
      console.log("startTime - " + startTime);
      dateParam = `hourStartUnix_gte: ` + startTime + `,`;
      orderDirection = "asc";
    }

    return await fetchRetry(PULSEX_SUBGRAPH_API_PULSECHAIN, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
      query {
        pairHourDatas (
          first: 1,
          orderBy: hourStartUnix,
          orderDirection: ` + orderDirection + `,`
          + //blockParam +
          `where: {pair_in: [
            "` + pairAddress + `",
          ]` + dateParam +
          `})
        {
          hourStartUnix
          pair {
            id
            token0 {
              id
            }
            token1 {
              id
            }
            reserve0
            reserve1
            token0Price
            token1Price
          }
        }
      }` 
      }),
    })
    .then(res => res.json())
    .then(res => {
      try {
        var parHourData = res.data.pairHourDatas[0];
        return parHourData.pair;
        //return parseFloat(parseFloat(tokenDayData.priceUSD).toFixed(8));
      } catch (e){
        return undefined;
      }
    });
  }

  async getPulseXPrice(token, day=undefined){
    var CONTRACT = HEX_CONTRACT_ADDRESS;
    switch (token){
      case "HEX": CONTRACT = HEX_CONTRACT_ADDRESS; break;
      case "PULSECHAIN": CONTRACT = PULSECHAIN_CONTRACT_ADDRESS; break;
      case "PULSEX": CONTRACT = PULSEX_CONTRACT_ADDRESS; break;
      case "INC": CONTRACT = INC_CONTRACT_ADDRESS; break;
      case "EHEX": CONTRACT = EHEX_CONTRACT_ADDRESS; break;
      case "DAI": CONTRACT = DAI_CONTRACT_ADDRESS; break;
      case "USDC": CONTRACT = USDC_CONTRACT_ADDRESS; break;
      default: console.log("Error: No tokens specified"); return 0;
    }

    var dateParam = "";
    if (day){
      var startTime = day2Epoch + ((day - 2) * 86400)  - 86400;
      console.log("startTime - " + startTime);
      dateParam = `date: ` + startTime + `,`;
    }
    return await fetchRetry(PULSEX_SUBGRAPH_API_PULSECHAIN, {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          tokenDayDatas (
            first: 1, 
            orderBy: date, 
            orderDirection: desc, 
            where: { 
              token: "` + CONTRACT + `",
              ` + dateParam + `
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
      try {
        var tokenDayData = res.data.tokenDayDatas[0];
        return parseFloat(parseFloat(tokenDayData.priceUSD).toFixed(8));
      } catch (e){
        return 0;
      }
    });
  }

}
