const h = require('../Helpers/helpers');  
const log = h.log;
const sleep = h.sleep; 
const onlyUnique = h.onlyUnique;
const fetchRetry = h.fetchRetry;
const FETCH_SIZE = h.FETCH_SIZE;
const HEX_CONTRACT_ADDRESS = h.HEX_CONTRACT_ADDRESS;
const UNISWAP_V2_HEXUSDC = h.UNISWAP_V2_HEXUSDC;
const UNISWAP_V2_HEXETH = h.UNISWAP_V2_HEXETH;
const UNISWAP_V3_HEXUSDC = h.UNISWAP_V3_HEXUSDC;
const UNISWAP_V3_HEXETH = h.UNISWAP_V3_HEXETH;

async function get_stakeStartsCountHistoricalBlock($lastStakeId, blockNumber){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
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
  async function get_stakeStartGAsHistorical($lastStakeId, blockNumber){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
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
      try{
      var stakeCount = Object.keys(res.data.stakeStarts).length;
  
      if (stakeCount <= 0) {
        return {  
          count: 0
        };
      } 
      else {
        var stakeStartsReduced = res.data.stakeStarts.reduce(function(previousValue, currentValue) {
          return {
            //stakedDays: parseInt(previousValue.stakedDays, 10) + parseInt(currentValue.stakedDays, 10),
            stakedHearts: parseInt(previousValue.stakedHearts, 10) + parseInt(currentValue.stakedHearts, 10),
          }
        });
  
        var lastStakeId = res.data.stakeStarts[(stakeCount - 1)].stakeId;
  
        //var uniqueAddresses = res.data.stakeStarts.map(a => a.stakerAddr).filter(onlyUnique);
  
        var data = {  
          //count: stakeCount, 
          //stakedDaysSum: stakeStartsReduced.stakedDays,
          lastStakeId: lastStakeId,
          //uniqueAddresses: uniqueAddresses,
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
    }
    );
  }
  async function get_tokenHolders_Historical(blockNumber, $lastNumeralIndex){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
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
    //.then(res => console.log(res))
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
    }});
  }

  
async function get_numberOfHolders_Historical(blockNumber){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
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

  
async function get_stakeGoodAccountings_Historical(blockNumber, $lastStakeId, unixTimestamp, unixTimestampEnd){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
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
    }});
  }
  
async function get_stakeEnds_Historical(blockNumber, $lastStakeId, unixTimestamp, unixTimestampEnd){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
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
    }});
  }

  
async function get_stakeStartsHistorical($lastStakeId, blockNumber){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
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
    }});
  }

  
async function getEthereumBlock(day){
    var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
  
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks', {
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
  
  const day2Epoch = 1575417600 + 86400;
  
  async function get_shareRateChangeByDay(day){
    var startTime = day2Epoch + ((day - 2) * 86400);
    var endTime = startTime + 86400;
    log("get_shareRateChangeByDay() --- startTime " + startTime + " endTime " + endTime + " day --- " + day);
  
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
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
              timestamp_gte: ` + startTime + `,
              timestamp_lt: ` + endTime + `,
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
  
  
  
  
  async function getUniswapV2HEXDailyPriceHistorical(dateEpoch){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
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
  
  async function getUniswapV3HEXDailyPriceHistorical(dateEpoch){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3', {
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
  
  
  async function getUniswapV1PriceAndLiquidityHistorical(timestamp){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/graphprotocol/uniswap', {
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
  
async function getUniswapV2() {
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
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
  
  async function getUniswapV2HEXETH(){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
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
      try {
      var pairDayData = res.data.pairDayDatas[0];
  
      return {
        liquidityUV2_HEXETH: parseInt(pairDayData.reserve0), //parseFloat(parseFloat(pairDayData.reserve0).toFixed(4)),
        liquidityUV2_ETH: parseInt(pairDayData.reserve1), //parseFloat(parseFloat(pairDayData.reserve1).toFixed(4))
      }
    } catch (error){
      return {
        liquidityUV2_HEXETH: 0,
        liquidityUV2_ETH: 0,
      }
    }
    });
  }
  
  async function getUniswapV2HEXETHHistorical(dateEpoch){
    console.log("getUniswapV2HEXETHHistorical() - START");
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
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
          liquidityUV2_HEXETH: parseInt(pairDayData.reserve0), //parseFloat(parseFloat(pairDayData.reserve0).toFixed(4)),
          liquidityUV2_ETH: parseInt(pairDayData.reserve1), //parseFloat(parseFloat(pairDayData.reserve1).toFixed(4))
        }
      } catch (error) {
        return {
          liquidityUV2_HEXETH: 0.0,
          liquidityUV2_ETH: 0.0
        }
      }
    });
  }
  
  async function getUniswapV2HEXUSDC_Polling(){
    var count = 0;
    while (true){
      var { liquidityUV2_HEXUSDC, liquidityUV2_USDC } = await getUniswapV2HEXUSDC(); await sleep(1000);
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
  
  async function getUniswapV2HEXUSDC(){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
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
      try {
        var pairDayData = res.data.pairDayDatas[0];
  
        return {
          liquidityUV2_HEXUSDC: parseInt(pairDayData.reserve0), //parseFloat(parseFloat(pairDayData.reserve0).toFixed(4)),
          liquidityUV2_USDC: parseInt(pairDayData.reserve1), //parseFloat(parseFloat(pairDayData.reserve1).toFixed(4))
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
  
  async function getUniswapV2HEXUSDCHistorical(dateEpoch){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
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
        liquidityUV2_HEXUSDC: parseInt(pairDayData.reserve0), //parseFloat(parseFloat(pairDayData.reserve0).toFixed(4)),
        liquidityUV2_USDC: parseInt(pairDayData.reserve1), //parseFloat(parseFloat(pairDayData.reserve1).toFixed(4))
      }
    } catch (error) {
      return {
        liquidityUV2_HEXUSDC: 0.0,
        liquidityUV2_USDC: 0.0
      }
    }
    });
  }
  
  async function getUniswapV2HEXDailyPrice(){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
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
      return parseFloat(parseFloat(tokenDayData.priceUSD).toFixed(8));
    });
  }
  
  async function getUniswapV3HEXDailyPrice(){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3', {
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
      return parseFloat(parseFloat(tokenDayData.priceUSD).toFixed(8));
    });
  }
  
  async function getUniswapV3Pools() {
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3', {
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
  
  async function getUniswapV3Historical(blockNumber) {
    //var pools = await getUniswapV3Pools();
    //await sleep(200);
    var pools = [ 
      UNISWAP_V3_HEXUSDC,
      UNISWAP_V3_HEXETH
    ]
  
    if (pools == undefined) {return;}
  
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3', {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          pools (
            orderBy: volumeUSD, orderDirection: desc,
            block: {number: ` + blockNumber + `},
            where: {
              id_in: ` + JSON.stringify(pools) + `
            }
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
      try {
      var liquidityUV3_USDC = 0;
      var liquidityUV3_ETH = 0;
      var liquidityUV3_HEX = 0;
      for(var i = 0; i < res.data.pools.length; i++) {
        var token0Name = res.data.pools[i].token0.name;
        var token1Name = res.data.pools[i].token1.name;
        var token0TVL = res.data.pools[i].totalValueLockedToken0;
        var token1TVL = res.data.pools[i].totalValueLockedToken1;
  
        if (token0Name == "HEX" && token1Name == "USD Coin") {
          liquidityUV3_HEX += token0TVL;
          liquidityUV3_USDC = token1TVL;
        } 
        
        if (token0Name == "HEX" && token1Name == "Wrapped Ether") {
          liquidityUV3_HEX += token0TVL;
          liquidityUV3_ETH = token1TVL;
        }
      }
  
      return {
        liquidityUV3_HEX: parseInt(liquidityUV3_HEX), //parseFloat(parseFloat(liquidityUV3_HEX).toFixed(4)),
        liquidityUV3_USDC: parseInt(liquidityUV3_USDC), //parseFloat(parseFloat(liquidityUV3_USDC).toFixed(4)),
        liquidityUV3_ETH: parseInt(liquidityUV3_ETH), //parseFloat(parseFloat(liquidityUV3_ETH).toFixed(4))
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
  
  async function getUniswapV3() {
    //var pools = await getUniswapV3Pools();
    //await sleep(200);
    var pools = [ 
      UNISWAP_V3_HEXUSDC,
      UNISWAP_V3_HEXETH
    ]
  
    if (pools == undefined) {return;}
  
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3', {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
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
      var liquidityUV3_HEX = 0;
  
      if (res && res.data && res.data.pools) {
        for(var i = 0; i < res.data.pools.length; i++) {
          var token0Name = res.data.pools[i].token0.name;
          var token1Name = res.data.pools[i].token1.name;
          var token0TVL = res.data.pools[i].totalValueLockedToken0;
          var token1TVL = res.data.pools[i].totalValueLockedToken1;
    
          if (token0Name == "HEX" && token1Name == "USD Coin") {
            liquidityUV3_HEX += token0TVL;
            liquidityUV3_USDC = token1TVL;
          } 
          
          if (token0Name == "HEX" && token1Name == "Wrapped Ether") {
            liquidityUV3_HEX += token0TVL;
            liquidityUV3_ETH = token1TVL;
          }
        }
    
        return {
          liquidityUV3_HEX: parseInt(liquidityUV3_HEX), //parseFloat(parseFloat(liquidityUV3_HEX).toFixed(4)),
          liquidityUV3_USDC: parseInt(liquidityUV3_USDC), //parseFloat(parseFloat(liquidityUV3_USDC).toFixed(4)),
          liquidityUV3_ETH: parseInt(liquidityUV3_ETH), //parseFloat(parseFloat(liquidityUV3_ETH).toFixed(4))
        }
      } else {
        return {
          liquidityUV3_HEX: 0,
          liquidityUV3_USDC: 0,
          liquidityUV3_ETH: 0,
        }
      }
    });
  }

  async function get_stakeEnds($lastStakeId, unixTimestamp, unixTimestampEnd){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
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
  
  async function get_stakeGoodAccountings($lastStakeId, unixTimestamp, unixTimestampEnd){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
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

  
async function get_stakeStarts($lastStakeId){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
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

  async function get_dailyDataUpdate(currentDay){
    log("get_dailyDataUpdate");
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
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
              endDay: ` + currentDay + `,
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
  
async function get_shareRateChange(){
  return await fetchRetry('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
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

async function get_numberOfHolders(){
    return await fetchRetry('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
      method: 'POST',
      highWaterMark: FETCH_SIZE,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query {
          tokenHolders(
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
  
      var numberOfHolders = parseInt(res.data.tokenHolders[0].numeralIndex);
  
      return numberOfHolders;
    });
  }
  
module.exports = { 
    getUniswapV2HEXDailyPrice: async () => { 
        return await getUniswapV2HEXDailyPrice();
    }
    ,getUniswapV2HEXUSDC_Polling: async () => {
        return await getUniswapV2HEXUSDC_Polling();
    }
    ,getUniswapV2HEXETH: async () => {
        return await getUniswapV2HEXETH();
    }
    ,getUniswapV3: async () => {
        return await getUniswapV3();
    }
    ,getEthereumBlock: async (day) => {
        return await getEthereumBlock(day);
    }
    ,get_shareRateChange: async () => {
        return await get_shareRateChange();
    } 
    ,get_stakeStarts: async ($lastStakeId) => {
        return await get_stakeStarts($lastStakeId);
    }
    ,get_stakeEnds: async ($lastStakeId, unixTimestamp, unixTimestampEnd) => {
        return await get_stakeEnds($lastStakeId, unixTimestamp, unixTimestampEnd);
    }
    ,get_stakeGoodAccountings: async ($lastStakeId, unixTimestamp, unixTimestampEnd) => {
        return await get_stakeGoodAccountings($lastStakeId, unixTimestamp, unixTimestampEnd);
    }
    ,get_numberOfHolders: async () => {
        return await get_numberOfHolders();
    }
    ,get_dailyDataUpdate: async (currentDay) => {
        return await get_dailyDataUpdate(currentDay);
    }
    ,get_stakeStartGAsHistorical: async ($lastStakeId, blockNumber) => {
        return await get_stakeStartGAsHistorical($lastStakeId, blockNumber);
    }
    ,get_stakeStartsCountHistoricalBlock: async ($lastStakeId, blockNumber) => {
        return await get_stakeStartsCountHistoricalBlock($lastStakeId, blockNumber);
    }
    ,get_tokenHolders_Historical: async (blockNumber, $lastNumeralIndex) => {
        return await get_tokenHolders_Historical(blockNumber, $lastNumeralIndex);
    }
    ,get_stakeStartsHistorical: async ($lastStakeId, blockNumber) =>{
        return await get_stakeStartsHistorical($lastStakeId, blockNumber);
    }
    ,get_stakeEnds_Historical: async (blockNumber, $lastStakeId, unixTimestamp, unixTimestampEnd) => {
        return await get_stakeEnds_Historical(blockNumber, $lastStakeId, unixTimestamp, unixTimestampEnd);
    }
    ,get_stakeGoodAccountings_Historical: async (blockNumber, $lastStakeId, unixTimestamp, unixTimestampEnd) => {
        return await get_stakeGoodAccountings_Historical(blockNumber, $lastStakeId, unixTimestamp, unixTimestampEnd);
    }
 }
 