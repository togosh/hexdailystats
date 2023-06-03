const MongoDB = require('../Services/MongoDB'); 
const TheGraph = require('../Services/TheGraph');  
const Coingecko = require('../Services/Coingecko'); 
const Twitter = require('../Services/Twitter');   
const h = require('../Helpers/helpers'); 

const CONFIG = h.CONFIG; 
const sleep = h.sleep;
const log = h.log;

const HEX_PRICE_ALLTIMELOW = 0.00005645;

const TheGraph_ETHEREUM = new TheGraph(h.ETHEREUM);
const TheGraph_PULSECHAIN = new TheGraph(h.PULSECHAIN);

const MongoDB_ETHEREUM = new MongoDB(h.ETHEREUM);
const MongoDB_PULSECHAIN = new MongoDB(h.PULSECHAIN);

let currentDayGlobal = 0;


module.exports = class DailyStatHandler {
  constructor(network) {
    this.network = network;
    this.currentDailyStat = undefined;
    this.getDataRunning = false;

    if (network == h.ETHEREUM){
      this.graph = TheGraph_ETHEREUM;
      this.mongoDB = MongoDB_ETHEREUM;
    } else if (network == h.PULSECHAIN){
      this.graph = TheGraph_PULSECHAIN;
      this.mongoDB = MongoDB_PULSECHAIN;
    } else {
      console.log("ERROR: DailyStatHandler does not support this network: " + network);
    }
  }

  async getDailyData(day) {
    return new Promise(async (resolve) => {
      this.getDataRunning = true;
      log("getDailyData() --- START **************** - getDataRunning SET TRUE: " + this.getDataRunning);
      try {
        await sleep(5000);
        var currentDay = day;
        var newDay = currentDay + 1;
        log("*** 001 *** - currentDay: " + currentDay);
  
        if (newDay != currentDayGlobal && newDay > currentDayGlobal) {
          currentDayGlobal = newDay;
        }
        
        this.currentDailyStat = await this.mongoDB.dailyStat.findOne({currentDay: { $eq: currentDay }});
  
        // Get Previous Row of Data
        var previousDay = (currentDay - 1);
        var previousDailyStat = await this.mongoDB.dailyStat.findOne({currentDay: { $eq: previousDay }});
        log("*** 004 - previousDay: " + previousDay);
  
        let globalInfo = undefined; 
        let circulatingHEX = undefined;
        let stakedHEX = undefined;
        let blockNumber = undefined;
        let timestamp = undefined;
  
        // Core Data  
        try { 
          globalInfo = await this.graph.get_globalInfoByDay(currentDay + 1); await sleep(250); 
          console.log("globalInfo: ");
          console.log(globalInfo);
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
  
        let tshareRateHEX = await this.get_tShareRateHEX(timestamp);
  
        //let priceUV2 = await this.get_priceUV2(currentDay);
        
        var priceUV3 = await this.get_priceUV3(currentDay); await sleep(1000); 
        let priceUV2 = priceUV3;
  
        //var {liquidityUV2_HEXUSDC, liquidityUV2_USDC} = await this.get_liquidityUV2USDC(currentDay);
        var liquidityUV2_HEXUSDC = 0.1;
        var liquidityUV2_USDC = 0.1;
        
        //var {liquidityUV2_HEXETH, liquidityUV2_ETH} = await this.get_liquidityUV2ETH(currentDay);
        var liquidityUV2_HEXETH = 0.1;
        var liquidityUV2_ETH = 0.1;
         
        var {liquidityUV3_HEX, liquidityUV3_USDC, liquidityUV3_ETH} = await this.get_liquidityUV3(blockNumber);
        
        var numberOfHolders = await this.get_numberOfHolders(blockNumber);
         
        var {averageStakeLength, currentStakerCount} = await this.get_averageStakeLengthCurrentStakerCount(blockNumber); 
         
        var stakedHEXGA = await this.get_stakedHEXGA(blockNumber);
         
        var currentHolders = await this.get_currentHolders(blockNumber);
    
        var totalStakerCount = await this.get_totalStakerCount(blockNumber);
        
        var {dailyPayoutHEX, totalTshares} = await this.get_dailyPayoutHexTotalTshares(currentDay); 


        var {pricePulseX, pricePulseX_PLS, pricePulseX_PLSX, pricePulseX_INC,
          liquidityPulseX_HEXEHEX, liquidityPulseX_EHEX, 
          liquidityPulseX_HEXPLS, liquidityPulseX_PLS, 
          liquidityPulseX_HEX
        } = await this.get_priceAndLiquidityPulseX(currentDay);
        

        ///////////////////////////////////////////////////
        // Calculated Values  
        var numberOfHoldersChange = undefined;
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
  
        var liquidityUV2UV3_HEX     = 0;
        if(liquidityUV2_HEXUSDC && liquidityUV2_HEXETH  && liquidityUV3_HEX){
          liquidityUV2UV3_HEX = parseInt(liquidityUV2_HEXUSDC + liquidityUV2_HEXETH + liquidityUV3_HEX); //parseFloat((liquidityUV2_HEXUSDC + liquidityUV2_HEXETH + liquidityUV3_HEX).toFixed(4));
        }
  
        var liquidityUV2UV3_USDC    = 0;
        if(liquidityUV2_USDC && liquidityUV3_USDC){
          liquidityUV2UV3_USDC = parseInt(liquidityUV2_USDC + liquidityUV3_USDC); //parseFloat((liquidityUV2_USDC + liquidityUV3_USDC).toFixed(4));
        }
  
        var liquidityUV2UV3_ETH     = 0;
        if(liquidityUV2_ETH && liquidityUV3_ETH){
          liquidityUV2UV3_ETH = parseInt(liquidityUV2_ETH + liquidityUV3_ETH); //parseFloat((liquidityUV2_ETH + liquidityUV3_ETH).toFixed(4));
        }
  
        var priceChangeUV2          = 0;
        if (priceUV2 && previousDailyStat.priceUV2){
          priceChangeUV2 = parseFloat((priceUV2 - previousDailyStat.priceUV2).toFixed(4));
        } else {
          priceChangeUV2 = 0;
        }
  
        var priceChangeUV3          = 0;
        if (priceUV3 && previousDailyStat.priceUV3){
          priceChangeUV3 = parseFloat((priceUV3 - previousDailyStat.priceUV3).toFixed(4));
        }
  
        var priceUV2UV3             = 0;
        if(priceUV2 && priceUV3 && liquidityUV2_USDC && liquidityUV2UV3_USDC && liquidityUV3_USDC){
          priceUV2UV3 = parseFloat(((priceUV2 * (liquidityUV2_USDC / liquidityUV2UV3_USDC)) + (priceUV3 * (liquidityUV3_USDC / liquidityUV2UV3_USDC))).toFixed(8));
        } else if (priceUV3 && liquidityUV2UV3_USDC && liquidityUV3_USDC) {
          priceUV2UV3 = priceUV3;
        }

        var priceChangeUV2UV3       = 0;
        if (priceUV2UV3 && previousDailyStat.priceUV2UV3) {
          priceChangeUV2UV3 = parseFloat((((priceUV2UV3 / previousDailyStat.priceUV2UV3) - 1) * 100).toFixed(8));
        }

        var priceChangePulseX       = 0;
        if (pricePulseX && previousDailyStat.pricePulseX) {
          priceChangePulseX = parseFloat((((pricePulseX / previousDailyStat.pricePulseX) - 1) * 100).toFixed(8));
        } else if (pricePulseX) { 
          priceChangePulseX = 100; 
        }
  
        var tshareRateIncrease      = 0;
        if (tshareRateHEX && previousDailyStat.tshareRateHEX){
          tshareRateIncrease = (parseFloat(tshareRateHEX) - previousDailyStat.tshareRateHEX);
        }
  
        var tshareRateUSD           = 0;
        if (tshareRateHEX && priceUV2UV3){
          tshareRateUSD = parseFloat((parseFloat(tshareRateHEX) * priceUV2UV3).toFixed(4));
        } else if (tshareRateHEX && pricePulseX) {
          tshareRateUSD = parseFloat((parseFloat(tshareRateHEX) * pricePulseX).toFixed(4));
        }
   
        var stakedSupplyChange      = (stakedHEX - previousDailyStat.stakedHEX);
        var circulatingSupplyChange = (circulatingHEX - previousDailyStat.circulatingHEX);
        var stakedHEXPercent        = parseFloat(((stakedHEX / (stakedHEX + circulatingHEX)) * 100).toFixed(2));
        var stakedHEXPercentChange  = parseFloat((stakedHEXPercent - previousDailyStat.stakedHEXPercent).toFixed(2)); 
        var date                    = new Date(timestamp * 1000); 
        var dailyMintedInflationTotal = (circulatingHEX + stakedHEX) - (previousDailyStat.circulatingHEX + previousDailyStat.stakedHEX); 
        var totalHEX = (circulatingHEX + stakedHEX);
  
        var marketCap = 0;
        if (priceUV2UV3){
          marketCap = (priceUV2UV3 * circulatingHEX);
        } else if (pricePulseX) {
          marketCap = (pricePulseX * circulatingHEX);
        }
        var tshareMarketCap = (tshareRateUSD * totalTshares);
        var tshareMarketCapToMarketCapRatio = 0;
        if (tshareMarketCap && marketCap){
          tshareMarketCapToMarketCapRatio = parseFloat((tshareMarketCap / marketCap).toFixed(4));
        }
  
        var roiMultiplierFromATL = 0;
        if(this.network == h.ETHEREUM && priceUV2UV3) {
          roiMultiplierFromATL = (priceUV2UV3 / HEX_PRICE_ALLTIMELOW);
        } else if (this.network == h.PULSECHAIN && pricePulseX) {
          roiMultiplierFromATL = 0; //(pricePulseX / HEX_PRICE_ALLTIMELOW);
        }
        
        var totalValueLocked = 0;
        if (priceUV2UV3) {
          totalValueLocked = (priceUV2UV3 * stakedHEX);
        } else if (pricePulseX) {
          totalValueLocked = (pricePulseX * stakedHEX);
        }
  
        var priceBTC = 0;
        var priceETH = 0;
        try {
          //var pricesBTC = await Coingecko.getPriceHistory_Bitcoin(1); await sleep(1000);
          //var pricesETH = await Coingecko.getPriceHistory_Ethereum(1); await sleep(1000);
          //priceBTC = pricesBTC[0];
          //priceETH = pricesETH[0];

          var startTime = 1575417600 + ((currentDay - 2) * 86400) + 86400;
          startTime = startTime * 1000;

          var pricesBTC = await Coingecko.getPriceHistory_BitcoinWithTime(currentDay); await sleep(500);
          pricesBTC = pricesBTC.filter(p => (p.length == 2 && p[0] == startTime));
          if (pricesBTC.length == 1){
            priceBTC = pricesBTC[0][1];
          }
          var pricesETH = await Coingecko.getPriceHistory_EthereumWithTime(currentDay); await sleep(500);
          pricesETH = pricesETH.filter(p => (p.length == 2 && p[0] == startTime));
          if (pricesETH.length == 1){
            priceETH = priceETH[0][1];
          }
        } catch (e) { log(e); }
        
  
        ///////////////////////////////////////////////////////////////////
        // Create Full Object, Set Calculated Values
        try {
           let dailyStatPackage = {
  
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
  
            priceBTC: priceBTC,
            priceETH: priceETH,
          };

          if (this.network == h.PULSECHAIN){
            dailyStatPackage.pricePulseX = pricePulseX;
            dailyStatPackage.priceChangePulseX = priceChangePulseX;

            dailyStatPackage.pricePulseX_PLS = pricePulseX_PLS;
            dailyStatPackage.pricePulseX_PLSX = pricePulseX_PLSX;
            dailyStatPackage.pricePulseX_INC = pricePulseX_INC;

            dailyStatPackage.liquidityPulseX_HEXEHEX = liquidityPulseX_HEXEHEX;
            dailyStatPackage.liquidityPulseX_EHEX = liquidityPulseX_EHEX;

            dailyStatPackage.liquidityPulseX_HEXPLS = liquidityPulseX_HEXPLS;
            dailyStatPackage.liquidityPulseX_PLS = liquidityPulseX_PLS;

            dailyStatPackage.liquidityPulseX_HEX = liquidityPulseX_HEX;
          }
  
          const dailyStat = new this.mongoDB.dailyStat(dailyStatPackage);
  
          log("*** 100 - PRINT ************");
          log(dailyStat);
  
  
          if(this.currentDailyStat) await this.mongoDB.dailyStat.deleteOne({currentDay: { $eq: currentDay }});
  
          dailyStat.save(async function (err) {
            if (err) log(err); 
            else{
              if (CONFIG.twitter.enabled && currentDayGlobal == newDay && this.network == h.ETHEREUM) {
                //Twitter.tweet(dailyStatPackage); await sleep(30000); ////////////// TODO setup Twitter constructor
                //Twitter.tweetBshare(dailyStatPackage);
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
        this.getDataRunning = false;
        log("getDailyData() --- END **************** - getDataRunning SET FALSE: " + this.getDataRunning);
        this.currentDailyStat = undefined;
      }
    });
  }

  async get_tShareRateHEX(timestamp){ 
    if(!this.currentDailyStat || !this.currentDailyStat.tshareRateHEX) {
      try { 
        var tshareRateHEX = await this.graph.get_shareRateChangeByTimestamp(timestamp); await sleep(250); 
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
    else return this.currentDailyStat.tshareRateHEX;
  }

  async get_priceUV2(currentDay){
    if(this.network != h.ETHEREUM){ return 0; }
    if(!this.currentDailyStat || !this.currentDailyStat.priceUV2) {
      try {
        var priceUV2 = await this.graph.getUniswapV2HEXDailyPrice(currentDay); await sleep(1000);
        log("*** 007 - priceUV2: " + priceUV2);
        return priceUV2;
      }
      catch (err) {
        log('getDailyData() ----- priceUV2 --- ' + err.toString() + " - " + err.stack );
        //Alert(); 
        return undefined;
      }
    }
    else return this.currentDailyStat.priceUV2;
  }

  async get_priceUV3(currentDay){
    if(this.network != h.ETHEREUM){ return 0; }
    if(!this.currentDailyStat || !this.currentDailyStat.priceUV3) {
      try {
        var priceUV3 = await this.graph.getUniswapV3HEXDailyPrice(currentDay); await sleep(1000);
        log("*** 007a - priceUV3: " + priceUV3);
        return priceUV3;
      }
      catch (err) {
        log('getDailyData() ----- priceUV3 --- ' + err.toString() + " - " + err.stack );
        //Alert(); 
        return undefined;
      }
    }
    else return this.currentDailyStat.priceUV3;
  }

  async get_liquidityUV2USDC(currentDay){
    if(this.network != h.ETHEREUM){ return {
      liquidityUV2_HEXUSDC: 0, 
      liquidityUV2_USDC: 0
    }}
    if(!this.currentDailyStat || (!this.currentDailyStat.liquidityUV2_HEXUSDC && !this.currentDailyStat.liquidityUV2_USDC)) {
      try { 
        var V2HEXUSDC_Polling = await this.graph.getUniswapV2HEXUSDC_Polling(currentDay); await sleep(1000); 
        log("*** 009 - liquidityUV2_HEXUSDC: " + V2HEXUSDC_Polling.liquidityUV2_HEXUSDC + " - liquidityUV2_USDC: " + V2HEXUSDC_Polling.liquidityUV2_USDC);
        return V2HEXUSDC_Polling;
      }
      catch (err) {
        log('getDailyData() ----- liquidityUV2_HEXUSDC, liquidityUV2_USDC --- ' + err.toString() + " - " + err.stack );
        //Alert(); 
        return undefined;
      }
    }
    else return {
      liquidityUV2_HEXUSDC: this.currentDailyStat.liquidityUV2_HEXUSDC, 
      liquidityUV2_USDC: this.currentDailyStat.liquidityUV2_USDC
    };
  }

  async get_liquidityUV2ETH(currentDay){
    if(this.network != h.ETHEREUM){ return {
      liquidityUV2_HEXETH: 0, 
      liquidityUV2_ETH: 0
    }}
    if(!this.currentDailyStat || (!this.currentDailyStat.liquidityUV2_HEXETH && !this.currentDailyStat.liquidityUV2_ETH)) {
      try {
        let V2HEXETH = await this.graph.getUniswapV2HEXETH(currentDay); await sleep(1000);
        log("*** 010 - liquidityUV2_HEXETH: " + V2HEXETH.liquidityUV2_HEXETH + " - liquidityUV2_ETH: " + V2HEXETH.liquidityUV2_ETH);
        return V2HEXETH;
      }
      catch (err) {
        log('getDailyData() ----- liquidityUV2_HEXETH, liquidityUV2_ETH --- ' + err.toString() + " - " + err.stack );
        //Alert(); 
        return undefined;
      }
    }
    else return {
      liquidityUV2_HEXETH: this.currentDailyStat.liquidityUV2_HEXETH, 
      liquidityUV2_ETH: this.currentDailyStat.liquidityUV2_ETH
    };
  }

  async get_liquidityUV3(blockNumber){
    if(this.network != h.ETHEREUM){ return {
      liquidityUV3_HEX: 0, 
      liquidityUV3_USDC: 0,
      liquidityUV3_ETH: 0
    }}
    if(!this.currentDailyStat || (!this.currentDailyStat.liquidityUV3_HEX && !this.currentDailyStat.liquidityUV3_USDC && !this.currentDailyStat.liquidityUV3_ETH)) {
      try {
        var V3Historical = await this.graph.getUniswapV3Historical(blockNumber); await sleep(500);
        log("*** 011 - liquidityUV3_HEX: " + V3Historical.liquidityUV3_HEX + " - liquidityUV3_USDC: " + V3Historical.liquidityUV3_USDC + " - liquidityUV3_ETH: " + V3Historical.liquidityUV3_ETH);
        return V3Historical;
      }
      catch (err) {
        log('getDailyData() ----- liquidityUV3_HEX, liquidityUV3_USDC, liquidityUV3_ETH --- ' + err.toString() + " - " + err.stack );
        //Alert(); 
        return undefined;
      }
    }
    else return {
      liquidityUV3_HEX: this.currentDailyStat.liquidityUV3_HEX, 
      liquidityUV3_USDC: this.currentDailyStat.liquidityUV3_USDC, 
      liquidityUV3_ETH: this.currentDailyStat.liquidityUV3_ETH};
  }

  async get_numberOfHolders(blockNumber){
    console.log("get_numberOfHolders");

    if(!this.currentDailyStat || !this.currentDailyStat.numberOfHolders) { 
      try {
        var numberOfHolders = await this.graph.get_numberOfHolders(blockNumber); 
        log("*** 012 - numberOfHolders: " + numberOfHolders); 
        return numberOfHolders;
      }
      catch (err) {
        log('getDailyData() ----- numberOfHolders --- ' + err.toString() + " - " + err.stack );
        //Alert(); 
        return undefined;
      }
    }
    else return this.currentDailyStat.numberOfHolders;
  }

  async get_averageStakeLengthCurrentStakerCount(blockNumber){
    if(!this.currentDailyStat || (!this.currentDailyStat.averageStakeLength && !this.currentDailyStat.currentStakerCount)) { 
      try {
        var ssd = await this.get_stakeStartData(blockNumber);
        log("*** 013 - averageStakeLength: " + ssd.averageStakeLength + " - currentStakerCount: " + ssd.currentStakerCount);
        return ssd;
      } 
      catch (err) {
        log('getDailyData() ----- averageStakeLength, currentStakerCount --- ' + err.toString() + " - " + err.stack );
        //Alert(); 
        return undefined;
      }
    }
    else return {
      averageStakeLength: this.currentDailyStat.averageStakeLength, 
      currentStakerCount: this.currentDailyStat.currentStakerCount
    };
  }

  async get_stakedHEXGA(blockNumber){
    if(!this.currentDailyStat || !this.currentDailyStat.stakedHEXGA) {  
      try {
        var stakedHEXGA = await this.get_stakeStartGADataHistorical(blockNumber); 
        log("*** 016 - stakedHEXGA: " + stakedHEXGA.stakedHEXGA);
        return stakedHEXGA.stakedHEXGA;
      }
      catch (err){
        log('getDailyData() ----- stakedHEXGA --- ' + err.toString() + " - " + err.stack );
        //Alert(); 
        return undefined;
      }
    }
    else return this.currentDailyStat.stakedHEXGA;
  }

  async get_currentHolders(blockNumber){
    if(!this.currentDailyStat || !this.currentDailyStat.currentHolders) {   
      try {
        var currentHolders = await this.get_tokenHoldersData_Historical(blockNumber);
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
    else return this.currentDailyStat.currentHolders;
  }

  async get_totalStakerCount(blockNumber){
    if(!this.currentDailyStat || !this.currentDailyStat.totalStakerCount) {    
      try {
        var totalStakerCount = await this.get_stakeStartsCountHistorical(blockNumber);
        log("*** 018 - totalStakerCount: " + totalStakerCount);
        return totalStakerCount;
      }
      catch (err){
        log('getDailyData() ----- totalStakerCount --- ' + err.toString() + " - " + err.stack );
        //Alert(); 
        return undefined;
      }
    }
    else return this.currentDailyStat.totalStakerCount;
  }

  async get_dailyPayoutHexTotalTshares(currentDay){
    if(!this.currentDailyStat || (!this.currentDailyStat.dailyPayoutHEX && !this.currentDailyStat.totalTshares)) {     
      try {
        var ddup = await this.get_dailyDataUpdatePolling(currentDay); await sleep(500); 
        log("*** 019 - dailyPayoutHEX: " + ddup.dailyPayoutHEX + " - totalTshares: " + ddup.totalTshares);
        return ddup;
      }
      catch (err){
        log('getDailyData() ----- dailyPayoutHEX, totalTshares --- ' + err.toString() + " - " + err.stack );
        //Alert(); 
        return undefined;
      }
    }
    else return {
      dailyPayoutHEX: this.currentDailyStat.dailyPayoutHEX, 
      totalTshares: this.currentDailyStat.totalTshares};
  }

  async get_tokenHoldersData_Historical(blockNumber){
    var $lastNumeralIndex = 0;
    var circulatingSum = 0;
    var uniqueAddressList = [];
    var uniqueAddressCount = 0;
  
    while (true) {
      var data = undefined;
      var retrieveCount = 0;
      while (true) {
        try {
          data = await this.graph.get_tokenHolders_Historical(blockNumber, $lastNumeralIndex);
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

  async get_stakeStartGADataHistorical(blockNumber){
    var $lastStakeId = 0;
    //var stakedDaysSum = 0;
    //var stakedCount = 0;
    //var uniqueAddressList = [];
    var stakedHEXGASum = 0;
  
    while (true) {
        var data = await this.graph.get_stakeStartGAsHistorical($lastStakeId, blockNumber);
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

  async get_stakeStartsCountHistorical(blockNumber){
    console.log("get_stakeStartsCountHistorical");
    try {  
        console.log("BlockNumber: " + blockNumber);
        var { uniqueStakerCount } = await this.getAll_stakeStartsCountHistorical(blockNumber);
        console.log("Staker Count: " + uniqueStakerCount);
        return uniqueStakerCount;
    } catch (error) {
      console.log("ERROR " + error.name + ': ' + error.message);
      return 0;
    }
  }

  async getAll_stakeStartsCountHistorical(blockNumber){

    var $lastStakeId = 0;
    var uniqueAddressList = [];
  
    while (true) {
      var data = await this.graph.get_stakeStartsCountHistoricalBlock($lastStakeId, blockNumber);
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

  async get_dailyDataUpdatePolling(currentDay) {
    log("get_dailyDataUpdatePolling");
  
    var count = 0;
    while (true) {
      var { dailyPayoutHEX, totalTshares, success } = await this.graph.get_dailyDataUpdate(currentDay);
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

  async get_stakeStartData(blockNumber){

    var $lastStakeId = 0;
    var stakedDaysSum = 0;
    var stakedCount = 0;
    var stakedHEXSum = 0;
    var weightedAverageSum = 0;
  
    var count = 0;
  
    var uniqueAddressList = [];
  
    while (true) {
      var data = await this.graph.get_stakeStarts($lastStakeId, blockNumber);
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
  
    var uniqueAddressCount = (new Set(uniqueAddressList)).size;
  
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

  /////////////////////////
  // PULSEX

  async get_priceAndLiquidityPulseX(day){
    if(this.network != h.PULSECHAIN){ return {
      pricePulseX: 0, 
      pricePulseX_PLS: 0,
      pricePulseX_PLSX: 0,
      pricePulseX_INC: 0,
      liquidityPulseX_HEXEHEX: 0,
      liquidityPulseX_EHEX: 0,
      liquidityPulseX_HEXPLS: 0,
      liquidityPulseX_PLS: 0,
      liquidityPulseX_HEX: 0,
    }}
    if(!this.currentDailyStat || (!this.currentDailyStat.liquidityUV3_HEX && !this.currentDailyStat.liquidityUV3_USDC && !this.currentDailyStat.liquidityUV3_ETH)) {
      try {

        var pricePulseX_HEX = await TheGraph_PULSECHAIN.getPulseXPrice("HEX", day); await sleep(500);
        var pricePulseX_PLS = await TheGraph_PULSECHAIN.getPulseXPrice("PULSECHAIN", day); await sleep(500);
        var pricePulseX_PLSX = await TheGraph_PULSECHAIN.getPulseXPrice("PULSEX", day); await sleep(500);
        var pricePulseX_INC = await TheGraph_PULSECHAIN.getPulseXPrice("INC", day); await sleep(500);
        //var pricePulseX_EHEX = await TheGraph_PULSECHAIN.getPulseXPrice("EHEX", day);

        //var PLSpair = await TheGraph_PULSECHAIN.getPulseXPairPriceAndLiquidity(h.PULSECHAIN_WPLSDAI, blockNumber); await sleep(1000);
        //var pricePulseX_PLS = 0; 
        //if (PLSpair && PLSpair.token1Price){ 
        //  pricePulseX_PLS = PLSpair.token1Price; 
        //}

        var HEXpair = await TheGraph_PULSECHAIN.getPulseXPairPriceAndLiquidity(h.PULSECHAIN_HEXPLS, day); await sleep(1000);
        //var pricePulseX = 0; 
        //if (HEXpair && HEXpair.token1Price){ 
        //  pricePulseX = ((HEXpair.token1Price) * pricePulseX_PLS);
        //}

        var EHEXpair = await TheGraph_PULSECHAIN.getPulseXPairPriceAndLiquidity(h.PULSECHAIN_HEXEHEX, day); await sleep(1000);
        //var pricePulseX_EHEX = 0; 
        //if (EHEXpair && EHEXpair.token0Price){
        //  pricePulseX_EHEX = ((EHEXpair.token0Price) * pricePulseX);
        //}

        //var PLSXpair = await TheGraph_PULSECHAIN.getPulseXPairPriceAndLiquidity(h.PULSECHAIN_WPLSPLSX, blockNumber); await sleep(1000);
        //var pricePulseX_PLSX = 0; 
        //if (PLSXpair && PLSXpair.token1Price){ 
        //  pricePulseX_PLSX = ((PLSXpair.token1Price) * pricePulseX_PLS);
        //}
        
        //var INCpair = await TheGraph_PULSECHAIN.getPulseXPairPriceAndLiquidity(h.PULSECHAIN_WPLSINC, blockNumber); await sleep(1000);
        //var pricePulseX_INC = 0; 
        //if (INCpair && INCpair.token1Price){ 
        //  pricePulseX_INC = ((INCpair.token1Price) * pricePulseX_PLS);
        //}

        var liquidityPulseX_HEXEHEX = 0;
        var liquidityPulseX_EHEX = 0;
        if (EHEXpair && EHEXpair.reserve0 && EHEXpair.reserve1){ 
          liquidityPulseX_HEXEHEX = EHEXpair.reserve0;
          liquidityPulseX_EHEX = EHEXpair.reserve1;
        }
        var liquidityPulseX_HEXPLS = 0;
        var liquidityPulseX_PLS = 0;
        if (HEXpair && HEXpair.reserve0 && HEXpair.reserve1){ 
          liquidityPulseX_HEXPLS = HEXpair.reserve0;
          liquidityPulseX_PLS = HEXpair.reserve1;
        }
        var liquidityPulseX_HEX = 0;
        if (HEXpair && HEXpair.reserve0 && EHEXpair && EHEXpair.reserve0){ 
          liquidityPulseX_HEX = (Number(HEXpair.reserve0) + Number(EHEXpair.reserve0));
        }

        var returnPackage = {
          pricePulseX: pricePulseX_HEX, 
          pricePulseX_PLS: pricePulseX_PLS,
          pricePulseX_PLSX: pricePulseX_PLSX,
          pricePulseX_INC: pricePulseX_INC,
          liquidityPulseX_HEXEHEX: liquidityPulseX_HEXEHEX,
          liquidityPulseX_EHEX: liquidityPulseX_EHEX,
          liquidityPulseX_HEXPLS: liquidityPulseX_HEXPLS,
          liquidityPulseX_PLS: liquidityPulseX_PLS,
          liquidityPulseX_HEX: liquidityPulseX_HEX,
        };

        log("*** 011a - " + returnPackage);
        
        return returnPackage;
      }
      catch (err) {
        log('get_priceAndLiquidityPulseX() --- ' + err.toString() + " - " + err.stack );
        //Alert(); 
        return undefined;
      }
    }
    else return {
      pricePulseX: this.currentDailyStat.pricePulseX, 
      pricePulseX_PLS: this.currentDailyStat.pricePulseX_PLS, 
      pricePulseX_PLSX: this.currentDailyStat.pricePulseX_PLSX,
      pricePulseX_INC: this.currentDailyStat.pricePulseX_INC,
      liquidityPulseX_HEXEHEX: this.currentDailyStat.liquidityPulseX_HEXEHEX,
      liquidityPulseX_EHEX: this.currentDailyStat.liquidityPulseX_EHEX,
      liquidityPulseX_HEXPLS: this.currentDailyStat.liquidityPulseX_HEXPLS,
      liquidityPulseX_PLS: this.currentDailyStat.liquidityPulseX_PLS,
      liquidityPulseX_HEX: this.currentDailyStat.liquidityPulseX_HEX,
    }
  }
}

///////////////////////////////////////////////////
// HELPER

function getNum(val) {
  if (isNaN(val)) {
    return 0;
  }
  return val;
}