const MongoDb = require('../Services/MongoDB'); 
const TheGraph = require('../Services/TheGraph');  
const Twitter = require('../Services/Twitter');   
const h = require('../Helpers/helpers'); 

const CONFIG = h.CONFIG; 
const sleep = h.sleep;
const log = h.log;
const HEX_PRICE_ALLTIMELOW = 0.00005645;

let getDataRunning = false;
let currentDayGlobal = 0;
let DailyStat = MongoDb.DailyStat;
let currentDailyStat = undefined;

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

let get_tShareRateHEX = async (timestamp) => { 
  if(!currentDailyStat || !currentDailyStat.tshareRateHEX) {
    try { 
      let tshareRateHEX = await TheGraph.get_shareRateChangeByTimestamp(timestamp); await sleep(250); 
      tshareRateHEX = tshareRateHEX.tShareRateHEX;
      log("*** 005 - tshareRateHEX: " + tshareRateHEX);
      return tshareRateHEX;
    }
    catch (err) {
      log('getDailyData() ----- tshareRateHEX --- ' + err.toString() + " - " + err.stack );
      //Alert(); 
      return undefined;
    }
  }
  else return currentDailyStat.tshareRateHEX;
}

let get_priceUV2 = async (currentDay) => {
  if(!currentDailyStat || !currentDailyStat.priceUV2) {
    try {
      let priceUV2 = await TheGraph.getUniswapV2HEXDailyPrice(currentDay); await sleep(1000);
      log("*** 007 - priceUV2: " + priceUV2);
      return priceUV2;
    }
    catch (err) {
      log('getDailyData() ----- priceUV2 --- ' + err.toString() + " - " + err.stack );
      //Alert(); 
      return undefined;
    }
  }
  else return currentDailyStat.priceUV2;
}

let get_liquidityUV2USDC = async (currentDay) => {
  if(!currentDailyStat || (!currentDailyStat.liquidityUV2_HEXUSDC && !currentDailyStat.liquidityUV2_USDC)) {
    try { 
      let V2HEXUSDC_Polling = await TheGraph.getUniswapV2HEXUSDC_Polling(currentDay); await sleep(1000); 
      log("*** 009 - liquidityUV2_HEXUSDC: " + V2HEXUSDC_Polling.liquidityUV2_HEXUSDC + " - liquidityUV2_USDC: " + V2HEXUSDC_Polling.liquidityUV2_USDC);
      return V2HEXUSDC_Polling;
    }
    catch (err) {
      log('getDailyData() ----- liquidityUV2_HEXUSDC, liquidityUV2_USDC --- ' + err.toString() + " - " + err.stack );
      //Alert(); 
      return undefined;
    }
  }
  else return {liquidityUV2_HEXUSDC: currentDailyStat.liquidityUV2_HEXUSDC, liquidityUV2_USDC: currentDailyStat.liquidityUV2_USDC};
}

let get_liquidityUV2ETH = async (currentDay) => {
  if(!currentDailyStat || (!currentDailyStat.liquidityUV2_HEXETH && !currentDailyStat.liquidityUV2_ETH)) {
    try {
      let V2HEXETH = await TheGraph.getUniswapV2HEXETH(currentDay); await sleep(1000);
      log("*** 010 - liquidityUV2_HEXETH: " + V2HEXETH.liquidityUV2_HEXETH + " - liquidityUV2_ETH: " + V2HEXETH.liquidityUV2_ETH);
      return V2HEXETH;
    }
    catch (err) {
      log('getDailyData() ----- liquidityUV2_HEXETH, liquidityUV2_ETH --- ' + err.toString() + " - " + err.stack );
      //Alert(); 
      return undefined;
    }
  }
  else return {liquidityUV2_HEXETH: currentDailyStat.liquidityUV2_HEXETH, liquidityUV2_ETH: currentDailyStat.liquidityUV2_ETH};
}

let get_liquidityUV3 = async (blockNumber) => {
  if(!currentDailyStat || (!currentDailyStat.liquidityUV3_HEX && !currentDailyStat.liquidityUV3_USDC && !currentDailyStat.liquidityUV3_ETH)) {
    try {
      let V3Historical = await TheGraph.getUniswapV3Historical(blockNumber); await sleep(500);
      log("*** 011 - liquidityUV3_HEX: " + V3Historical.liquidityUV3_HEX + " - liquidityUV3_USDC: " + V3Historical.liquidityUV3_USDC + " - liquidityUV3_ETH: " + V3Historical.liquidityUV3_ETH);
      return V3Historical;
    }
    catch (err) {
      log('getDailyData() ----- liquidityUV3_HEX, liquidityUV3_USDC, liquidityUV3_ETH --- ' + err.toString() + " - " + err.stack );
      //Alert(); 
      return undefined;
    }
  }
  else return {liquidityUV3_HEX: currentDailyStat.liquidityUV3_HEX, liquidityUV3_USDC: currentDailyStat.liquidityUV3_USDC, liquidityUV3_ETH: currentDailyStat.liquidityUV3_ETH};
}

let get_numberOfHolders = async (blockNumber) => {
  if(!currentDailyStat || !currentDailyStat.numberOfHolders) { 
    try {
      numberOfHolders = await TheGraph.get_numberOfHolders(blockNumber); 
      log("*** 012 - numberOfHolders: " + numberOfHolders); 
      return numberOfHolders;
    }
    catch (err) {
      log('getDailyData() ----- numberOfHolders --- ' + err.toString() + " - " + err.stack );
      //Alert(); 
      return undefined;
    }
  }
  else return currentDailyStat.numberOfHolders;
}

let get_averageStakeLengthCurrentStakerCount = async (blockNumber) => {
  if(!currentDailyStat || (!currentDailyStat.averageStakeLength && !currentDailyStat.currentStakerCount)) { 
    try {
      let ssd = await get_stakeStartData(blockNumber);
      log("*** 013 - averageStakeLength: " + ssd.averageStakeLength + " - currentStakerCount: " + ssd.currentStakerCount);
      return ssd;
    } 
    catch (err) {
      log('getDailyData() ----- averageStakeLength, currentStakerCount --- ' + err.toString() + " - " + err.stack );
      //Alert(); 
      return undefined;
    }
  }
  else return {averageStakeLength: currentDailyStat.averageStakeLength, currentStakerCount: currentDailyStat.currentStakerCount};
}

let get_stakedHEXGA = async (blockNumber) => {
  if(!currentDailyStat || !currentDailyStat.stakedHEXGA) {  
    try {
      stakedHEXGA = await get_stakeStartGADataHistorical(blockNumber); 
      log("*** 016 - stakedHEXGA: " + stakedHEXGA.stakedHEXGA);
      return stakedHEXGA.stakedHEXGA;
    }
    catch (err){
      log('getDailyData() ----- stakedHEXGA --- ' + err.toString() + " - " + err.stack );
      //Alert(); 
      return undefined;
    }
  }
  else return currentDailyStat.stakedHEXGA;
}


let get_currentHolders = async (blockNumber) => {
  if(!currentDailyStat || !currentDailyStat.currentHolders) {   
    try {
      currentHolders = await get_tokenHoldersData_Historical(blockNumber);
      currentHolders = currentHolders.currentHolders;
      log("*** 017 - currentHolders: " + currentHolders);
      return currentHolders;
    }
    catch (err){
      log('getDailyData() ----- currentHolders --- ' + err.toString() + " - " + err.stack );
      //Alert(); 
      return undefined;
    }
  }
  else return currentDailyStat.currentHolders;
}
 
let get_totalStakerCount = async (blockNumber) => {
  if(!currentDailyStat || !currentDailyStat.totalStakerCount) {    
    try {
      totalStakerCount = await get_stakeStartsCountHistorical(blockNumber);
      log("*** 018 - totalStakerCount: " + totalStakerCount);
      return totalStakerCount;
    }
    catch (err){
      log('getDailyData() ----- totalStakerCount --- ' + err.toString() + " - " + err.stack );
      //Alert(); 
      return undefined;
    }
  }
  else return currentDailyStat.totalStakerCount;
}

let get_dailyPayoutHexTotalTshares = async (currentDay) => {
  if(!currentDailyStat || (!currentDailyStat.dailyPayoutHEX && !currentDailyStat.totalTshares)) {     
    try {
      let ddup = await get_dailyDataUpdatePolling(currentDay); await sleep(500); 
      log("*** 019 - dailyPayoutHEX: " + ddup.dailyPayoutHEX + " - totalTshares: " + ddup.totalTshares);
      return ddup;
    }
    catch (err){
      log('getDailyData() ----- dailyPayoutHEX, totalTshares --- ' + err.toString() + " - " + err.stack );
      //Alert(); 
      return undefined;
    }
  }
  else return {dailyPayoutHEX: currentDailyStat.dailyPayoutHEX, totalTshares: currentDailyStat.totalTshares};
}

async function getDailyData(day) {
  return new Promise(async (resolve) => {
    getDataRunning = true;
    log("getDailyData() --- START ****************");
    try {
      await sleep(5000);
      var currentDay = day;
      var newDay = currentDay + 1;
      log("*** 001 *** - currentDay: " + currentDay);

      if (newDay != currentDayGlobal && newDay > currentDayGlobal) {
        currentDayGlobal = newDay;
      }
      
      currentDailyStat = await DailyStat.findOne({currentDay: { $eq: currentDay }});

      // Get Previous Row of Data
      var previousDay = (currentDay - 1);
      var previousDailyStat = await DailyStat.findOne({currentDay: { $eq: previousDay }});
      log("*** 004 - previousDay: " + previousDay);

      let globalInfo = undefined; 
      let circulatingHEX = undefined;
      let stakedHEX = undefined;
      let blockNumber = undefined;
      let timestamp = undefined;

      // Core Data  
      try { 
        globalInfo = await TheGraph.get_globalInfoByDay(currentDay + 1); await sleep(250); 
        circulatingHEX = parseInt(globalInfo[0].totalHeartsinCirculation) / 100000000;
        stakedHEX = parseInt(globalInfo[0].lockedHeartsTotal) / 100000000;
        blockNumber = parseInt(globalInfo[0].blocknumber);
        timestamp = parseInt(globalInfo[0].timestamp);
        log("*** 006 - circulatingHEX: " + circulatingHEX + " - stakedHEX: " + stakedHEX); 
      }
      catch (err) {
        log('getDailyData() ----- globalInfo --- ' + err.toString() + " - " + err.stack + " - currentDay: " + currentDay );
        //Alert();
        return;
      }

      let tshareRateHEX = await get_tShareRateHEX(timestamp);

      let priceUV2 = await get_priceUV2(currentDay);
      
      var priceUV3 = priceUV2; //await getUniswapV3HEXDailyPrice(); await sleep(1000); 

      var {liquidityUV2_HEXUSDC, liquidityUV2_USDC} = await get_liquidityUV2USDC(currentDay);
      
      var {liquidityUV2_HEXETH, liquidityUV2_ETH} = await get_liquidityUV2ETH(currentDay);
       
      var {liquidityUV3_HEX, liquidityUV3_USDC, liquidityUV3_ETH} = await get_liquidityUV3(blockNumber);
      
      let numberOfHolders = await get_numberOfHolders(blockNumber);
       
      var {averageStakeLength, currentStakerCount} = await get_averageStakeLengthCurrentStakerCount(blockNumber); 
       
      var stakedHEXGA = await get_stakedHEXGA(blockNumber);
       
      var currentHolders = await get_currentHolders(blockNumber);
  
      var totalStakerCount = await get_totalStakerCount(blockNumber);
      
      var {dailyPayoutHEX, totalTshares} = await get_dailyPayoutHexTotalTshares(currentDay); 
      
      // Calculated Values  
      let numberOfHoldersChange = undefined;
      if (numberOfHolders && previousDailyStat.numberOfHolders) {
        numberOfHoldersChange = (numberOfHolders - previousDailyStat.numberOfHolders);
      }

      var currentStakerCountChange = undefined;
      if (currentStakerCount && previousDailyStat.currentStakerCount) {
        currentStakerCountChange = (currentStakerCount - getNum(previousDailyStat.currentStakerCount));
      }

      var currentHoldersChange = undefined;
      if (currentHolders && previousDailyStat.currentHolders) {
        currentHoldersChange = (currentHolders - previousDailyStat.currentHolders);
      }

      var totalStakerCountChange = undefined;
      if (totalStakerCount && previousDailyStat.totalStakerCount){
        totalStakerCountChange = getNum(totalStakerCount) - getNum(previousDailyStat.totalStakerCount); 
      }

      var penaltiesHEX = undefined;
      if (dailyPayoutHEX) {
        penaltiesHEX = (dailyPayoutHEX - ((circulatingHEX + stakedHEX) * 10000 / 100448995)) * 2; 
      }
      
      var totalTsharesChange      = undefined;
      if (totalTshares && previousDailyStat.totalTshares) {
        totalTsharesChange = (totalTshares - previousDailyStat.totalTshares);
      }

      var payoutPerTshareHEX      = undefined;
      if (dailyPayoutHEX && totalTshares) {
        payoutPerTshareHEX = dailyPayoutHEX / totalTshares;
      }
 
      var actualAPYRate           = undefined;
      if (dailyPayoutHEX){
        actualAPYRate = parseFloat(((dailyPayoutHEX / stakedHEX) * 365.25 * 100).toFixed(2));
      }

      var stakedHEXGAChange       = undefined; 
      if (stakedHEXGA && previousDailyStat.stakedHEXGA){
        stakedHEXGAChange = (stakedHEXGA - previousDailyStat.stakedHEXGA)
      }

      var liquidityUV2UV3_HEX     = undefined;
      if(liquidityUV2_HEXUSDC && liquidityUV2_HEXETH  && liquidityUV3_HEX){
        liquidityUV2UV3_HEX = parseInt(liquidityUV2_HEXUSDC + liquidityUV2_HEXETH + liquidityUV3_HEX); //parseFloat((liquidityUV2_HEXUSDC + liquidityUV2_HEXETH + liquidityUV3_HEX).toFixed(4));
      }

      var liquidityUV2UV3_USDC    = undefined;
      if(liquidityUV2_USDC && liquidityUV3_USDC){
        liquidityUV2UV3_USDC = parseInt(liquidityUV2_USDC + liquidityUV3_USDC); //parseFloat((liquidityUV2_USDC + liquidityUV3_USDC).toFixed(4));
      }

      var liquidityUV2UV3_ETH     = undefined;
      if(liquidityUV2_ETH && liquidityUV3_ETH){
        liquidityUV2UV3_ETH = parseInt(liquidityUV2_ETH + liquidityUV3_ETH); //parseFloat((liquidityUV2_ETH + liquidityUV3_ETH).toFixed(4));

      }

      var priceChangeUV2          = undefined;
      if (priceUV2 && previousDailyStat.priceUV2){
        priceChangeUV2 = parseFloat((priceUV2 - previousDailyStat.priceUV2).toFixed(4));
      }

      var priceChangeUV3          = undefined;
      if (priceUV3 && previousDailyStat.priceUV3){
        priceChangeUV3 = parseFloat((priceUV3 - previousDailyStat.priceUV3).toFixed(4));
      }

      var priceUV2UV3             = undefined;
      if(priceUV2 && priceUV3 && liquidityUV2_USDC && liquidityUV2UV3_USDC && liquidityUV3_USDC){
        priceUV2UV3 = parseFloat(((priceUV2 * (liquidityUV2_USDC / liquidityUV2UV3_USDC)) + (priceUV3 * (liquidityUV3_USDC / liquidityUV2UV3_USDC))).toFixed(8));
      }
      var priceChangeUV2UV3       = undefined;
      if (priceUV2UV3 && previousDailyStat.priceUV2UV3) {
        priceChangeUV2UV3 = parseFloat((((priceUV2UV3 / previousDailyStat.priceUV2UV3) - 1) * 100).toFixed(8));
      }

      var tshareRateIncrease      = undefined;
      if (tshareRateHEX && previousDailyStat.tshareRateHEX){
        tshareRateIncrease = (parseFloat(tshareRateHEX) - previousDailyStat.tshareRateHEX);
      }

      var tshareRateUSD           = undefined;
      if (tshareRateHEX && priceUV2UV3){
        tshareRateUSD = parseFloat((parseFloat(tshareRateHEX) * priceUV2UV3).toFixed(4));
      }
 
      var stakedSupplyChange      = (stakedHEX - previousDailyStat.stakedHEX);
      var circulatingSupplyChange = (circulatingHEX - previousDailyStat.circulatingHEX);
      var stakedHEXPercent        = parseFloat(((stakedHEX / (stakedHEX + circulatingHEX)) * 100).toFixed(2));
      var stakedHEXPercentChange  = parseFloat((stakedHEXPercent - previousDailyStat.stakedHEXPercent).toFixed(2)); 
      var date                    = new Date(timestamp * 1000); 
      var dailyMintedInflationTotal = (circulatingHEX + stakedHEX) - (previousDailyStat.circulatingHEX + previousDailyStat.stakedHEX); 
      var totalHEX = (circulatingHEX + stakedHEX);

      var marketCap = undefined;
      if (priceUV2UV3){
        marketCap = (priceUV2UV3 * circulatingHEX);
      }
      var tshareMarketCap = (tshareRateUSD * totalTshares);
      var tshareMarketCapToMarketCapRatio = parseFloat((tshareMarketCap / marketCap).toFixed(4));

      var roiMultiplierFromATL = undefined;
      if(priceUV2UV3) {
        roiMultiplierFromATL = (priceUV2UV3 / HEX_PRICE_ALLTIMELOW);
      }
      var totalValueLocked = undefined;
      if (priceUV2UV3) {
        totalValueLocked = (priceUV2UV3 * stakedHEX);
      }

      // Create Full Object, Set Calculated Values
      try {
        const dailyStat = new DailyStat({ 

          // CORE DATA
          date:               date,
          currentDay:         currentDay,
          circulatingHEX:     circulatingHEX,
          stakedHEX:          stakedHEX,
          stakedHEXGA:        stakedHEXGA,

          tshareRateHEX:      tshareRateHEX,
          dailyPayoutHEX:     dailyPayoutHEX,
          totalTshares:       totalTshares,
          averageStakeLength: averageStakeLength,
          penaltiesHEX:       penaltiesHEX,

          priceUV2:           priceUV2,
          priceUV3:           priceUV3,

          liquidityUV2_USDC:  liquidityUV2_USDC,
          liquidityUV2_ETH:   liquidityUV2_ETH,

          liquidityUV2_HEXUSDC: liquidityUV2_HEXUSDC,
          liquidityUV2_HEXETH:  liquidityUV2_HEXETH,

          liquidityUV3_HEX:     liquidityUV3_HEX,
          liquidityUV3_USDC:    liquidityUV3_USDC,
          liquidityUV3_ETH:     liquidityUV3_ETH,


          // CALCULATED DATA
          tshareRateIncrease:       tshareRateIncrease,
          tshareRateUSD:            tshareRateUSD,

          totalTsharesChange:       totalTsharesChange,
          payoutPerTshareHEX:       payoutPerTshareHEX,
          actualAPYRate:            actualAPYRate,

          stakedSupplyChange:       stakedSupplyChange,
          circulatingSupplyChange:  circulatingSupplyChange,
          stakedHEXGAChange:        stakedHEXGAChange,

          stakedHEXPercent:         stakedHEXPercent,
          stakedHEXPercentChange:   stakedHEXPercentChange,

          priceUV2UV3:              priceUV2UV3,
          priceChangeUV2:           priceChangeUV2,
          priceChangeUV3:           priceChangeUV3,
          priceChangeUV2UV3:        priceChangeUV2UV3,

          liquidityUV2UV3_USDC:     liquidityUV2UV3_USDC,
          liquidityUV2UV3_ETH:      liquidityUV2UV3_ETH,
          liquidityUV2UV3_HEX:      liquidityUV2UV3_HEX,

          numberOfHolders:          numberOfHolders,
          numberOfHoldersChange:    numberOfHoldersChange,
          currentHolders:           currentHolders,
          currentHoldersChange:     currentHoldersChange,

          dailyMintedInflationTotal: dailyMintedInflationTotal,
          totalHEX: totalHEX,

          marketCap:                        marketCap,
          tshareMarketCap:                  tshareMarketCap,
          tshareMarketCapToMarketCapRatio:  tshareMarketCapToMarketCapRatio,
          roiMultiplierFromATL:             roiMultiplierFromATL,

          currentStakerCount:        currentStakerCount,
          currentStakerCountChange:  currentStakerCountChange,
          totalStakerCount:         totalStakerCount,
          totalStakerCountChange:   totalStakerCountChange,

          totalValueLocked:         totalValueLocked,
        });

        log("*** 100 - PRINT ************");
        log(dailyStat);


        if(currentDailyStat) await DailyStat.deleteOne({currentDay: { $eq: currentDay }});

        dailyStat.save(async function (err) {
          if (err) log(err); 
          else{
            if (CONFIG.twitter.enabled && currentDayGlobal == newDay) {
              Twitter.tweet(dailyStat); await sleep(30000);
              Twitter.tweetBshare(dailyStat);
            }
          }
          resolve(true);
        }); 
      } catch (err) {
        log('getDailyData() ----- SAVE --- ' + err.toString() + " - " + err.stack);
      }

    } catch (err) {
      log('getDailyData() ----- ERROR ---' + err.toString() + " - " + err.stack);
    } finally { 
      getDataRunning = false;
      currentDailyStat = undefined;
    }
  });
}
  

async function get_tokenHoldersData_Historical(blockNumber){
  var $lastNumeralIndex = 0;
  var circulatingSum = 0;
  var uniqueAddressList = [];
  var uniqueAddressCount = 0;

  while (true) {
    var data = undefined;
    var retrieveCount = 0;
    while (true) {
      try {
        data = await TheGraph.get_tokenHolders_Historical(blockNumber, $lastNumeralIndex);
        break;
      } catch (error) {
        log("get_tokenHoldersData_Historical() ----- ERROR - Trying again -" + retrieveCount);
        retrieveCount += 1;
        await sleep(1000 * retrieveCount);

        if (retrieveCount > 3){
          throw error;
        }
      }
    }
    if (data.count <= 0) { break; }
    circulatingSum += data.circulatingHEX;
    uniqueAddressList = uniqueAddressList.concat(data.uniqueAddresses);
    $lastNumeralIndex = data.lastNumeralIndex;
    log("get_tokenHoldersData_Historical() --- " + $lastNumeralIndex);

    await sleep(300);
  }

  uniqueAddressCount = (new Set(uniqueAddressList)).size;

  return {
    circulatingSupply: circulatingSum,
    currentHolders: uniqueAddressCount,
  }   
}
  
async function get_stakeStartGADataHistorical(blockNumber){
  var $lastStakeId = 0;
  //var stakedDaysSum = 0;
  //var stakedCount = 0;
  //var uniqueAddressList = [];
  var stakedHEXGASum = 0;

  while (true) {
      var data = await TheGraph.get_stakeStartGAsHistorical($lastStakeId, blockNumber);
      if (data.count <= 0) { break; }
      //stakedCount += data.count;
      //stakedDaysSum += data.stakedDaysSum;
      $lastStakeId = data.lastStakeId;
      //uniqueAddressList = uniqueAddressList.concat(data.uniqueAddresses);
      stakedHEXGASum += data.stakedHEXGA;

      log("get_stakeStartGADataHistorical() --- " + $lastStakeId);
      await sleep(250);
  }

  //var averageStakeLength = 0.0;
  //var averageStakeLengthYears = 0.0;

  //if (stakedCount && stakedDaysSum ) {
  //  averageStakeLength = stakedDaysSum/stakedCount;
  //  averageStakeLengthYears = averageStakeLength / 365.0;
  //} 

  //uniqueAddressCount = uniqueAddressList.filter(onlyUnique).length;

  return {
      //averageStakeLength: parseFloat(averageStakeLengthYears.toFixed(2)),
      //uniqueStakerCount: uniqueAddressCount,
      stakedHEXGA: stakedHEXGASum
  }
}

async function get_stakeStartsCountHistorical(blockNumber){
  console.log("get_stakeStartsCountHistorical");
  try {  
      console.log("BlockNumber: " + blockNumber);
      var { uniqueStakerCount } = await getAll_stakeStartsCountHistorical(blockNumber);
      console.log("Staker Count: " + uniqueStakerCount);
      return uniqueStakerCount;
  } catch (error) {
    console.log("ERROR " + error.name + ': ' + error.message);
    return 0;
  }
}
  
async function getAll_stakeStartsCountHistorical(blockNumber){

  var $lastStakeId = 0;
  var uniqueAddressList = [];

  while (true) {
    var data = await TheGraph.get_stakeStartsCountHistoricalBlock($lastStakeId, blockNumber);
    if (data.count <= 0) { break; }
    $lastStakeId = data.lastStakeId;
    uniqueAddressList = uniqueAddressList.concat(data.uniqueAddresses);

    log("get_stakeStartsCountHistoricalBlock() --- " + $lastStakeId);
    await sleep(250);
  }
  var uniqueAddressCount = (new Set(uniqueAddressList)).size;

  return {
    uniqueStakerCount: uniqueAddressCount,
  }
}

async function get_dailyDataUpdatePolling(currentDay) {
  log("get_dailyDataUpdatePolling");

  var count = 0;
  while (true) {
    var { dailyPayoutHEX, totalTshares, success } = await TheGraph.get_dailyDataUpdate(currentDay);
    if (success) { 
      return {
        dailyPayoutHEX,
        totalTshares
      }; 
    }
    await sleep(30000);
    count += 1;
    if (count > 240) {
      return {
        dailyPayoutHEX: -1,
        totalTshares: -1
      };
    }
  }
}

async function get_stakeStartData(blockNumber){

  var $lastStakeId = 0;
  var stakedDaysSum = 0;
  var stakedCount = 0;
  var stakedHEXSum = 0;
  var weightedAverageSum = 0;

  var count = 0;

  var uniqueAddressList = [];

  while (true) {
    var data = await TheGraph.get_stakeStarts($lastStakeId, blockNumber);
    if (data.count <= 0) { break; }
    stakedCount += data.count;
    stakedDaysSum += data.stakedDaysSum;
    $lastStakeId = data.lastStakeId;
    uniqueAddressList = uniqueAddressList.concat(data.uniqueAddresses);
    stakedHEXSum += data.stakedHEX;
    weightedAverageSum += data.weightedAverageSum;

    log("get_stakeStartData() --- " + $lastStakeId)
    count += 1;
    await sleep(100);
  }

  var averageStakeLength = stakedDaysSum/stakedCount;
  var averageStakeLengthYears = averageStakeLength / 365.0;

  uniqueAddressCount = (new Set(uniqueAddressList)).size;

  var averageStakeLengthWeighted = 0.0;
  var averageStakeLengthWeightedYears = 0.0

  if (stakedCount && weightedAverageSum && stakedHEXSum) {
    averageStakeLengthWeighted = weightedAverageSum / stakedHEXSum;
    averageStakeLengthWeightedYears = averageStakeLengthWeighted / 365.0;
  }

  return {
    averageStakeLength: averageStakeLengthWeightedYears, //parseFloat(averageStakeLengthYears.toFixed(2)),
    currentStakerCount: uniqueAddressCount,
  }
}

module.exports = { 
  getDataRunning: getDataRunning
  ,currentDayGlobal: currentDayGlobal
  ,getDailyData: async (day) => {
    return await getDailyData(day);
  }
}