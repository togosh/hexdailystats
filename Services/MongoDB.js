const Etherscan = require('./Etherscan'); 
const TheGraph = require('../Services/TheGraph');  
const Coingecko = require('../Services/Coingecko'); 
const h = require('../Helpers/helpers'); 
const isEmpty = h.isEmpty;
const CONFIG = h.CONFIG; 
const log = h.log;
const sleep = h.sleep;
const mongoCollectionName = CONFIG.mongoCollectionName;
const day2Epoch = 1575417600 + 86400;
require('es6-promise').polyfill();

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

const TheGraph_ETHEREUM = new TheGraph(h.ETHEREUM);
const TheGraph_PULSECHAIN = new TheGraph(h.PULSECHAIN);

mongoose.connect(CONFIG.mongodb.connectionString, {useNewUrlParser: true, useUnifiedTopology: true}).then(() => {
  log("Mongo Connected!");
});

mongoose.connection.on('error', console.error.bind(console, 'MongoDB connection error:'));

////////////////////////////////
// SCHEMAS

var ConnectionSchema = new Schema({
	created: {
    type: Date, 
    required: true
  },
	ipaddress: {
    type: String, 
    required: true
  }
});
const Connection = mongoose.model('Connection', ConnectionSchema);

const DAILYSTAT_OBJECT_ETHEREUM = {
  date:                             { type: Date,   required: true },
  currentDay:                       { type: Number, required: true },
  circulatingHEX:                   { type: Number, required: true },
  stakedHEX:                        { type: Number, required: true },
  stakedHEXGA:                      { type: Number, default: null },

  tshareRateHEX:                    { type: Number, default: null },
  dailyPayoutHEX:                   { type: Number, default: null },
  totalTshares:                     { type: Number, default: null },
  averageStakeLength:               { type: Number, default: null },
  penaltiesHEX:                     { type: Number, default: null },

  priceUV1:                         { type: Number, default: null  },
  priceUV2:                         { type: Number, default: null },
  priceUV3:                         { type: Number, default: null },

  liquidityUV1_HEX:                 { type: Number, default: null  },
  liquidityUV1_ETH:                 { type: Number, default: null  },

  liquidityUV2_USDC:                { type: Number, default: null },
  liquidityUV2_ETH:                 { type: Number, default: null },

  liquidityUV2_HEXUSDC:             { type: Number, default: null },
  liquidityUV2_HEXETH:              { type: Number, default: null },

  liquidityUV3_HEX:                 { type: Number, default: null },
  liquidityUV3_USDC:                { type: Number, default: null },
  liquidityUV3_ETH:                 { type: Number, default: null },

  // CALCULATED DATA              
  tshareRateIncrease:               { type: Number, default: null },
  tshareRateUSD:                    { type: Number, default: null },

  totalTsharesChange:               { type: Number, default: null },
  payoutPerTshareHEX:               { type: Number, default: null },
  actualAPYRate:                    { type: Number, default: null },

  stakedHEXGAChange:                { type: Number, default: null },
  stakedSupplyChange:               { type: Number, default: null },
  circulatingSupplyChange:          { type: Number, default: null },

  stakedHEXPercent:                 { type: Number, default: null },
  stakedHEXPercentChange:           { type: Number, default: null },

  priceUV2UV3:                      { type: Number, default: null },
  priceChangeUV2:                   { type: Number, default: null },
  priceChangeUV3:                   { type: Number, default: null },
  priceChangeUV2UV3:                { type: Number, default: null },

  liquidityUV2UV3_USDC:             { type: Number, default: null },
  liquidityUV2UV3_ETH:              { type: Number, default: null },
  liquidityUV2UV3_HEX:              { type: Number, default: null },

  currentHolders:                   { type: Number, default: null },
  currentHoldersChange:             { type: Number, default: null },
  numberOfHolders:                  { type: Number, default: null },
  numberOfHoldersChange:            { type: Number, default: null },

  dailyMintedInflationTotal:        { type: Number, default: null },

  totalHEX:                         { type: Number, default: null },

  marketCap:                        { type: Number, default: null },
  tshareMarketCap:                  { type: Number, default: null },
  tshareMarketCapToMarketCapRatio:  { type: Number, default: null },

  roiMultiplierFromATL:             { type: Number, default: null },

  uniqueStakerCount:                { type: Number, select: false },
  uniqueStakerCountChange:          { type: Number, select: false },
  currentStakerCount:               { type: Number, default: null },
  currentStakerCountChange:         { type: Number, default: null },
  totalStakerCount:                 { type: Number, default: null },
  totalStakerCountChange:           { type: Number, default: null },
  
  totalValueLocked:                 { type: Number, default: null },

  priceBTC:                         { type: Number, default: null },
  priceETH:                         { type: Number, default: null },
}
var DailyStatSchema_ETHEREUM = new Schema(DAILYSTAT_OBJECT_ETHEREUM, {collection: mongoCollectionName });
const DailyStat_ETHEREUM = mongoose.model('DailyStat', DailyStatSchema_ETHEREUM);

const DAILYSTAT_OBJECT_PULSECHAIN = {

  ...DAILYSTAT_OBJECT_ETHEREUM,

  pricePulseX:                      { type: Number, default: null },
  priceChangePulseX:                { type: Number, default: null },

  pricePulseX_PLS:                  { type: Number, default: null },
  pricePulseX_PLSX:                 { type: Number, default: null },
  pricePulseX_INC:                  { type: Number, default: null },

  liquidityPulseX_HEXEHEX:          { type: Number, default: null },
  liquidityPulseX_EHEX:             { type: Number, default: null },

  liquidityPulseX_HEXPLS:           { type: Number, default: null },
  liquidityPulseX_PLS:              { type: Number, default: null },

  liquidityPulseX_HEX:              { type: Number, default: null },
}
var DailyStatSchema_PULSECHAIN = new Schema(DAILYSTAT_OBJECT_PULSECHAIN, { collection: mongoCollectionName });
const DailyStat_PULSECHAIN = mongoose.model('DailyStat_PULSECHAIN', DailyStatSchema_PULSECHAIN);

////////////////////////////////
// CLASS

module.exports = class MongoDB {
  constructor(network) {
    this.network = network;
    this.connection = Connection;
    this.getRowDataRunning = false;
    this.rowData = undefined;

    if (network == h.ETHEREUM){
      this.dailyStat = DailyStat_ETHEREUM;
      this.graph = TheGraph_ETHEREUM;
    } else if (network == h.PULSECHAIN){
      this.dailyStat = DailyStat_PULSECHAIN;
      this.graph = TheGraph_PULSECHAIN;
    } else {
      console.log("ERROR: MongoDB does not support this network: " + network);
    }
  }

  async getRowData() {
    this.getRowDataRunning = true;
    let returnPackage = {
      rowData: null
      ,rowDataObjects: null
    };
    try {
      var dailyStats = [];
      var dailyStats = await this.dailyStat.find();
      dailyStats = dailyStats.sort((a, b) => (a.currentDay < b.currentDay) ? 1 : -1);
  
      var rowDataNew = [];
      for (var ds of dailyStats){
        var row = [];
        if (this.network == h.ETHEREUM){
          row = [
            ds.currentDay, ds.date, 
            ds.priceUV2UV3, ds.priceChangeUV2UV3, ds.roiMultiplierFromATL,
            ds.payoutPerTshareHEX, ds.tshareRateUSD, ds.tshareRateHEX, ds.tshareRateIncrease,
            ds.averageStakeLength, ds.actualAPYRate,
            ds.liquidityUV2UV3_HEX, ds.liquidityUV2UV3_USDC, ds.liquidityUV2UV3_ETH,
            ds.totalValueLocked, ds.marketCap, ds.tshareMarketCap,
            ds.totalTshares, ds.totalTsharesChange,
            ds.totalHEX, ds.dailyMintedInflationTotal,
            ds.circulatingHEX, ds.circulatingSupplyChange,
            ds.stakedHEX, ds.stakedSupplyChange, ds.stakedHEXGA, ds.stakedHEXGAChange, ds.stakedHEXPercent,
            ds.dailyPayoutHEX, ds.penaltiesHEX,
            ds.numberOfHolders, ds.numberOfHoldersChange,
            ds.currentStakerCount, ds.currentStakerCountChange,
            ds.totalStakerCount, ds.totalStakerCountChange,
            ds.currentHolders, ds.currentHoldersChange,
            ds.priceBTC, ds.priceETH
          ];
        } else if (this.network == h.PULSECHAIN){
          row = [
            ds.currentDay, ds.date, 
            ds.pricePulseX, ds.priceChangePulseX, ds.roiMultiplierFromATL,
            ds.payoutPerTshareHEX, ds.tshareRateUSD, ds.tshareRateHEX, ds.tshareRateIncrease,
            ds.averageStakeLength, ds.actualAPYRate,
            ds.liquidityPulseX_HEX, ds.liquidityPulseX_EHEX, ds.liquidityPulseX_PLS,
            ds.totalValueLocked, ds.marketCap, ds.tshareMarketCap,
            ds.totalTshares, ds.totalTsharesChange,
            ds.totalHEX, ds.dailyMintedInflationTotal,
            ds.circulatingHEX, ds.circulatingSupplyChange,
            ds.stakedHEX, ds.stakedSupplyChange, ds.stakedHEXGA, ds.stakedHEXGAChange, ds.stakedHEXPercent,
            ds.dailyPayoutHEX, ds.penaltiesHEX,
            ds.numberOfHolders, ds.numberOfHoldersChange,
            ds.currentStakerCount, ds.currentStakerCountChange,
            ds.totalStakerCount, ds.totalStakerCountChange,
            ds.currentHolders, ds.currentHoldersChange,
            ds.priceBTC, ds.priceETH,
            ds.pricePulseX_PLS ?? 0, ds.pricePulseX_PLSX ?? 0, ds.pricePulseX_INC ?? 0
          ];
          //console.log("row");
          //console.log(row);
        }

        rowDataNew.push(row);
      }
  
      if (this.rowData === undefined || !(JSON.stringify(this.rowData) === JSON.stringify(rowDataNew))){ //!arraysEqual(rowData, rowDataNew)) {
        returnPackage.rowData = rowDataNew;
        returnPackage.rowDataObjects = dailyStats;
        //rowData = rowDataNew;
        //rowDataObjects = dailyStats;
        //hexSiteData = await buildHexSiteData(rowDataObjects);
        //log('SOCKET -- ****EMIT: rowData');
        //io.emit("rowData", rowData);
      }
  
    } catch (err) {
      log('getRowData() --- network: ' + this.network + " --- ERROR: " + err);
    } finally {
      this.getRowDataRunning = false;
      return returnPackage;
    }
  }

  async createRow(day){
    var previousDate = new Date();
    var dateOffset = (24*60*60*1000) * 1;
  
    var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day - 1}});
  
    if (!isEmpty(rowFind)) {
      previousDate.setTime(previousDate.getTime() + dateOffset);
  
      var newRow = new this.dailyStat({ 
        date:               previousDate,
        currentDay:         day,
        circulatingHEX:     0,
        stakedHEX:          0,
  
        tshareRateHEX:      0,
        dailyPayoutHEX:     0,
        totalTshares:       0,
        averageStakeLength: 0,
        penaltiesHEX:       0,
  
        priceUV2:           0,
        priceUV3:           0,
  
        liquidityUV2_USDC:  0,
        liquidityUV2_ETH:   0,
        liquidityUV3_USDC:  0,
        liquidityUV3_ETH:   0,
  
        // CALCULATED DATA
        tshareRateIncrease: 0,
        tshareRateUSD:      0,
  
        totalTsharesChange: 0,
        payoutPerTshareHEX: 0,
        actualAPYRate:      0,
  
        stakedSupplyChange:       0,
        circulatingSupplyChange:  0,
  
        stakedHEXPercent:         0,
        stakedHEXPercentChange:   0,
  
        priceUV2UV3:          0,
        priceChangeUV2:       0,
        priceChangeUV3:       0,
        priceChangeUV2UV3:    0,
  
        liquidityUV2UV3_USDC: 0,
        liquidityUV2UV3_ETH:  0,
        liquidityUV2UV3_HEX:  0,
  
        numberOfHolders:        0,
        numberOfHoldersChange:  0,
        currentHolders:         0,
        currentHoldersChange:   0,
  
        dailyMintedInflationTotal:  0,
  
        totalHEX: 0,
  
        marketCap:                        0,
        tshareMarketCap:                  0,
        tshareMarketCapToMarketCapRatio:  0,
  
        roiMultiplierFromATL:             0,
  
        currentStakerCount:        0,
        currentStakerCountChange:  0,
  
        totalValueLocked:        0,
  
        priceBTC: 0,
        priceETH: 0,
      });

      if (this.network == h.PULSECHAIN){
        newRow.pricePulseX              = 0;
        newRow.priceChangePulseX        = 0;
        newRow.pricePulseX_PLS          = 0;
        newRow.pricePulseX_PLSX         = 0;
        newRow.pricePulseX_INC          = 0;
        newRow.liquidityPulseX_HEXEHEX  = 0;
        newRow.liquidityPulseX_EHEX     = 0;
        newRow.liquidityPulseX_HEXPLS   = 0;
        newRow.liquidityPulseX_PLS      = 0;
        newRow.liquidityPulseX_HEX      = 0;
      }
  
      //await sleep(500);
  
      log("CREATEROWS - SAVE: " + " network: " + this.network + " --- " + newRow.date + " - " + day);
      newRow.save(function (err) {
        if (err) return log("CREATEROWS - SAVE ERROR: " + " network: " + this.network + " --- " + err);
      });
  
    } else {
      console.log("row Found! ------ " + day + " network: " + this.network)
      console.log("rowFind.date - " + rowFind.date + " network: " + this.network);
      previousDate = new Date(rowFind.date);
    }
  }

  async createAllRows(){
    //var currentDay = await Etherscan.getCurrentDay();
    var previousDate = new Date();
    var dateOffset = (24*60*60*1000) * 1;
  
    for (var day = 597; day >= 594; day--) {
      var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
  
      if (isEmpty(rowFind)) {
        previousDate.setTime(previousDate.getTime() - dateOffset);
  
        var newRow = new this.dailyStat({ 
          date:               previousDate,
          currentDay:         day,
          circulatingHEX:     0,
          stakedHEX:          0,
  
          tshareRateHEX:      0,
          dailyPayoutHEX:     0,
          totalTshares:       0,
          averageStakeLength: 0,
          penaltiesHEX:       0,
  
          priceUV2:           0,
          priceUV3:           0,
  
          liquidityUV2_USDC:  0,
          liquidityUV2_ETH:   0,
          liquidityUV3_USDC:  0,
          liquidityUV3_ETH:   0,
  
          // CALCULATED DATA
          tshareRateIncrease: 0,
          tshareRateUSD:      0,
  
          totalTsharesChange: 0,
          payoutPerTshareHEX: 0,
          actualAPYRate:      0,
  
          stakedSupplyChange:       0,
          circulatingSupplyChange:  0,
  
          stakedHEXPercent:         0,
          stakedHEXPercentChange:   0,
  
          priceUV2UV3:          0,
          priceChangeUV2:       0,
          priceChangeUV3:       0,
          priceChangeUV2UV3:    0,
  
          liquidityUV2UV3_USDC: 0,
          liquidityUV2UV3_ETH:  0,
          liquidityUV2UV3_HEX:  0,
  
          numberOfHolders:        0,
          numberOfHoldersChange:  0,
          currentHolders:         0,
          currentHoldersChange:   0,
  
          dailyMintedInflationTotal:  0,
  
          totalHEX: 0,
  
          marketCap:                        0,
          tshareMarketCap:                  0,
          tshareMarketCapToMarketCapRatio:  0,
  
          roiMultiplierFromATL:             0,
  
          currentStakerCount:        0,
          currentStakerCountChange:  0,
  
          totalValueLocked:        0,
  
          priceBTC: 0,
          priceETH: 0,
        });

        if (this.network == h.PULSECHAIN){
          newRow.pricePulseX              = 0;
          newRow.priceChangePulseX        = 0;
          newRow.pricePulseX_PLS          = 0;
          newRow.pricePulseX_PLSX         = 0;
          newRow.pricePulseX_INC          = 0;
          newRow.liquidityPulseX_HEXEHEX  = 0;
          newRow.liquidityPulseX_EHEX     = 0;
          newRow.liquidityPulseX_HEXPLS   = 0;
          newRow.liquidityPulseX_PLS      = 0;
          newRow.liquidityPulseX_HEX      = 0;
        }
  
        //await sleep(500);
  
        log("CREATEROWS - SAVE: " + newRow.date + " - " + day);
        newRow.save(function (err) {
          if (err) return log("CREATEROWS - SAVE ERROR: " + err);
        });
  
      } else {
        console.log("row Found! ------ " + day)
        console.log("rowFind.date - " + rowFind.date);
        previousDate = new Date(rowFind.date);
      }
    }
  }

  async create_dailyUpdates(){
    log("create_dailyUpdates" + " network: " + this.network);
    //var day = 618;
    //var { dailyPayoutHEX, totalTshares, success } = await this.graph.get_dailyDataUpdate(day);
    //log(dailyPayoutHEX);
    //log(totalTshares);
    //log((dailyPayoutHEX / totalTshares));
    //return;
  
    try {
      for (var day = 191; day <= 617; day++) {
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
        if (!isEmpty(rowFind)) {
          var { dailyPayoutHEX, totalTshares, success } = await this.graph.get_dailyDataUpdate(day);
          //log(dailyPayoutHEX + " - " + totalTshares + " - " + success);
          if (success) { 
  
            rowFind.dailyPayoutHEX = dailyPayoutHEX;
            rowFind.totalTshares = totalTshares
  
            if ( totalTshares == 0 ) {
              rowFind.payoutPerTshareHEX = 0.0;
            } else {
              rowFind.payoutPerTshareHEX = (dailyPayoutHEX / totalTshares);
            }
  
            log("CREATEDAILY - SAVE: " + rowFind.dailyPayoutHEX + " - " + rowFind.totalTshares + " - " + rowFind.payoutPerTshareHEX + " ------ " + day);
            rowFind.save(function (err) {
              if (err) return log("CREATEDAILY - SAVE ERROR: " + err);
            });
          } else {
            log("CREATEDAILY - MISSING DATA DAY: " + day); 
          }
        } else {
          log("CREATEDAILY - MISSING DAY: " + day); 
        }
        
        await sleep(50);
      }
    } catch (error) {
      log("create_dailyUpdates() - ERROR:");
      log(error);
    }
  }

  async create_totalTshareChanges(){
    console.log("create_totalTshareChanges()" + " network: " + this.network)
    for (var day = 3; day < 593; day++) {
      var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
      var rowFind2 = await this.dailyStat.findOne({currentDay: { $eq: day + 1}});
      if (!isEmpty(rowFind) && !isEmpty(rowFind2)){
        var totalTsharesChange = (rowFind2.totalTshares - rowFind.totalTshares);
        rowFind2.totalTsharesChange = totalTsharesChange;
  
        log("CREATETSHARECHANGE - SAVE: " + totalTsharesChange + " - " + (day + 1));
        rowFind2.save(function (err) {
          if (err) return log("CREATETSHARECHANGE - SAVE ERROR: " + err);
        });
      }
    }  
  }

  async create_tshareRateHEXIncreases(){
    log("create_tshareRateHEXIncreases" + " network: " + this.network);
    try { for (var day = 1; day <= 619; day++) {
  
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
        var rowFind2 = await this.dailyStat.findOne({currentDay: { $eq: day + 1}});
  
        if (!isEmpty(rowFind) && !isEmpty(rowFind2)){
          var tshareRateIncrease = parseFloat((rowFind2.tshareRateHEX - rowFind.tshareRateHEX).toFixed(3));
          rowFind2.tshareRateIncrease = tshareRateIncrease;
  
          log("CREATE_tshareRateIncrease - SAVE: " + tshareRateIncrease + " ------ " + day);
          rowFind2.save(function (err) { if (err) return log("CREATE_tshareRateIncrease - SAVE ERROR: " + err); });
        } else { log("CREATE_tshareRateIncrease- MISSING DAY: " + day); }
  
        await sleep(100);
      } } catch (error) { log("ERROR"); log(error); }
  }

  async update_shiftRowsDown(){
    log("update_shiftRowsDown" + " network: " + this.network);
    try {
      var dateOffset = (24*60*60*1000) * 1;
  
      for (var day = 595; day <= 595; day++) {
  
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
  
        if (!isEmpty(rowFind)){
  
          rowFind.currentDay = (day - 1);
  
          var rowDate = new Date(rowFind.date)
          rowDate.setTime(rowDate.getTime() - dateOffset);
  
          rowFind.date = rowDate;
  
          log("update_shiftRowsDown - SAVE:  ------ " + day);
          rowFind.save(function (err) {
            if (err) return log("update_shiftRowsDown - SAVE ERROR: " + err);
          });
  
        } else {
          log("update_shiftRowsDown - MISSING DAY: " + day); 
        }
        
        //await sleep(10000);
      }
    } catch (error) {
      log("ERROR");
      log(error);
    }
  }

  async create_tshareRateHEXs(){
    log("create_tshareRateHEXs" + " network: " + this.network);
    //var { tShareRateHEX } = await this.graph.get_shareRateChangeByDay(619 - 1);
    //log("CREATE_tshareRateHEX - TEST: " + tShareRateHEX + " ------ " + day);
    //return;
    try {
      var previousValue = 0;
      for (var day = 594; day <= 617; day++) {
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
        if (!isEmpty(rowFind)) {
          var { tShareRateHEX } = await this.graph.get_shareRateChangeByDay(day);
  
          if (!tShareRateHEX) {
            tShareRateHEX = previousValue;
          }
          previousValue = tShareRateHEX;
  
          rowFind.tshareRateHEX = tShareRateHEX;
  
          log("CREATE_tshareRateHEX - SAVE: " + tShareRateHEX + " ------ " + day);
          rowFind.save(function (err) {
            if (err) return log("CREATE_tshareRateHEX - SAVE ERROR: " + err);
          });
  
        } else {
          log("CREATE_tshareRateHEX - MISSING DAY: " + day); 
        }
        
        //await sleep(10000);
      }
    } catch (error) {
      log("ERROR");
      log(error);
    }
  }

  async create_uniswapV2HEXPrice(){
    log("create_uniswapV2HEXPrice" + " network: " + this.network);
    //var day = 2;
    //var startTime = day2Epoch + ((day - 2) * 86400)  - 86400;
    //log("startTime - " + startTime);
    //var priceUV2 = await this.graph.getUniswapV2HEXDailyPriceHistorical(startTime);
    //log("create_uniswapV2HEXPrice - TEST: " + priceUV2 + " ------ " + day + " " + startTime);
    //return;
    try {
      for (var day = 282; day <= 282; day++) {  // Starts on Day 167
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
        if (!isEmpty(rowFind)) {
          var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
          var priceUV2 = await this.graph.getUniswapV2HEXDailyPriceHistorical(startTime);
  
          rowFind.priceUV2 = priceUV2;
  
          log("create_uniswapV2HEXPrice - SAVE: " + startTime.toString() + " - " + priceUV2 + " ------ " + day);
          rowFind.save(function (err) {
            if (err) return log("create_uniswapV2HEXPrice - SAVE ERROR: " + err);
          });
  
        } else {
          log("create_uniswapV2HEXPrice - MISSING DAY: " + day); 
        }
        
        await sleep(200);
      }
    } catch (error) {
      log("ERROR");
      log(error);
    }
  }

  async create_uniswapV3HEXPrice(){
    log("create_uniswapV3HEXPrice" + " network: " + this.network);
    //var day = 596;
    //var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
    //log("startTime - " + startTime);
    //var priceUV3 = await this.graph.getUniswapV3HEXDailyPriceHistorical(startTime);
    //log("create_uniswapV3HEXPrice - TEST: " + priceUV3 + " ------ " + day + " " + startTime);
    //return;
    try {
      for (var day = 526; day <= 530; day++) {  // Starts on Day 522
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
        if (!isEmpty(rowFind)) {
          var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
          var priceUV3 = await this.graph.getUniswapV3HEXDailyPriceHistorical(startTime);
  
          rowFind.priceUV3 = priceUV3;
  
          log("create_uniswapV3HEXPrice - SAVE: " + startTime.toString() + " - " + priceUV3 + " ------ " + day);
          rowFind.save(function (err) {
            if (err) return log("create_uniswapV3HEXPrice - SAVE ERROR: " + err);
          });
  
        } else {
          log("create_uniswapV3HEXPrice - MISSING DAY: " + day); 
        }
        
        await sleep(1000);
      }
    } catch (error) {
      log("ERROR");
      log(error);
    }
  }

  async createUV2UV3Liquidity(){
    log("createUV2UV3Liquidity" + " network: " + this.network);
  
    //var day = 597;
    //var blockNumber = await this.graph.getEthereumBlock(day)
    //log("blockNumber - " + blockNumber);
    //var { liquidityUV3_HEX, liquidityUV3_USDC, liquidityUV3_ETH } = await this.graph.getUniswapV3Historical(blockNumber);
    //log("createUV2UV3Liquidity - " + liquidityUV3_HEX + " liquidityUV3_USDC - " + liquidityUV3_USDC + " liquidityUV3_ETH - " + liquidityUV3_ETH);
  
    //var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
    //log("startTime - " + startTime);
    //var { liquidityUV2_HEXUSDC, liquidityUV2_USDC } = await this.graph.getUniswapV2HEXUSDCHistorical(startTime);
    //var { liquidityUV2_HEXETH, liquidityUV2_ETH } = await this.graph.getUniswapV2HEXETHHistorical(startTime);
    //log("createUV2UV3Liquidity - SAVE: " + startTime.toString() + " - HEXUSDC " + liquidityUV2_HEXUSDC  + " - USDC " + liquidityUV2_USDC + " ------ " + day);
    //log("createUV2UV3Liquidity - SAVE: " + startTime.toString() + " - HEXETH " + liquidityUV2_HEXETH  + " - ETH " + liquidityUV2_ETH + " ------ " + day);
  
    //log("COMBINED - HEX - " + (liquidityUV3_HEX + liquidityUV2_HEXUSDC + liquidityUV2_HEXETH) + " USDC - " + (liquidityUV3_USDC + liquidityUV2_USDC) + " ETH - " + (liquidityUV3_ETH + liquidityUV2_ETH));
    //return;
    try {
      for (var day = 740; day <= 801; day++) {  // Starts on Day 167 End 595
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
        if (!isEmpty(rowFind)) {
          // UV2
          var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
          
          var { liquidityUV2_HEXUSDC, liquidityUV2_USDC } = await this.graph.getUniswapV2HEXUSDCHistorical(startTime);
          sleep(700);
          var { liquidityUV2_HEXETH, liquidityUV2_ETH } = await this.graph.getUniswapV2HEXETHHistorical(startTime);
          sleep(300);
  
          rowFind.liquidityUV2_HEXUSDC = liquidityUV2_HEXUSDC;
          rowFind.liquidityUV2_USDC = liquidityUV2_USDC;
          rowFind.liquidityUV2_HEXETH = liquidityUV2_HEXETH;
          rowFind.liquidityUV2_ETH = liquidityUV2_ETH;
  
          // UV3
          var blockNumber = await this.graph.getEthereumBlock(day)
  
          var { liquidityUV3_HEX, liquidityUV3_USDC, liquidityUV3_ETH } = await this.graph.getUniswapV3Historical(blockNumber);
  
          rowFind.liquidityUV3_HEX = liquidityUV3_HEX;
          rowFind.liquidityUV3_USDC = liquidityUV3_USDC;
          rowFind.liquidityUV3_ETH = liquidityUV3_ETH;
  
          // Calculated
          rowFind.liquidityUV2UV3_HEX = (liquidityUV2_HEXUSDC + liquidityUV2_HEXETH + liquidityUV3_HEX);
          rowFind.liquidityUV2UV3_USDC = (liquidityUV2_USDC + liquidityUV3_USDC);
          rowFind.liquidityUV2UV3_ETH = (liquidityUV2_ETH + liquidityUV3_ETH);
  
          log("DAY: " + day + " COMBINED - HEX - " + (rowFind.liquidityUV2UV3_HEX) + " USDC - " + (rowFind.liquidityUV2UV3_USDC) + " ETH - " + (rowFind.liquidityUV2UV3_ETH));
          rowFind.save(function (err) {
            if (err) return log("createUV2UV3Liquidity - SAVE ERROR: " + err);
          });
  
        } else {
          log("createUV2UV3Liquidity - MISSING DAY: " + day); 
        }
        
        await sleep(300);
      }
    } catch (error) {
      log("ERROR");
      log(error);
    }
  }

  async create_uniswapV2V3CombinedHEXPrice(){
    log("create_uniswapV2V3CombinedHEXPrice" + " network: " + this.network);
    //var day = 2;
    //var startTime = day2Epoch + ((day - 2) * 86400)  - 86400;
    //log("startTime - " + startTime);
    //var priceUV2 = await this.graph.getUniswapV2HEXDailyPriceHistorical(startTime);
    //log("create_uniswapV2HEXPrice - TEST: " + priceUV2 + " ------ " + day + " " + startTime);
    //return;
    try {
      for (var day = 282; day <= 282; day++) {  // Starts on Day 167
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
        if (!isEmpty(rowFind)) {
  
          if (!rowFind.priceUV3 && !rowFind.priceUV2){
            console.log("BOTH ZERO - 0 --- " + day)
            rowFind.priceUV2UV3 = 0;
          } else if (!rowFind.priceUV3 && rowFind.priceUV2) {
            console.log("ONLY UV2 - " + rowFind.priceUV2 + " --- " + day)
            rowFind.priceUV2UV3 = rowFind.priceUV2;
          } else if (rowFind.priceUV3 && !rowFind.priceUV2) {
            console.log("ONLY UV3 - " + rowFind.priceUV3 + " --- " + day)
            rowFind.priceUV2UV3 = rowFind.priceUV3;
          } else { // BOTH NON-ZERO
  
            //if ( liquidityUV2_USDC > 9000000) {
            //  rowFind.priceUV2UV3 = parseFloat((
            //    (rowFind.priceUV2 * (rowFind.liquidityUV2_USDC / rowFind.liquidityUV2UV3_USDC)) 
            //    + 
            //    (rowFind.priceUV3 * (rowFind.liquidityUV3_USDC / rowFind.liquidityUV2UV3_USDC))
            //  ).toFixed(8));
            //}
  
            // I need price of Ethereum to weigh it in USD terms with USDC and Ethereum together
  
            rowFind.priceUV2UV3 = ((rowFind.priceUV2 + rowFind.priceUV3) / 2.0);
          }
  
          log("create_uniswapV2V3CombinedHEXPrice - SAVE: " + rowFind.priceUV2UV3 + " ------ " + day);
          rowFind.save(function (err) {
            if (err) return log("create_uniswapV2V3CombinedHEXPrice - SAVE ERROR: " + err);
          });
  
        } else {
          log("create_uniswapV2V3CombinedHEXPrice - MISSING DAY: " + day); 
        }
        
        await sleep(500);
      }
    } catch (error) {
      log("ERROR");
      log(error);
    }
  }

  async create_priceChangeUV2UV3s(){
    log("create_priceChangeUV2UV3s" + " network: " + this.network);
    try {
      for (var day = 166; day <= 167; day++) {
  
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
        sleep(100);
        var rowFind2 = await this.dailyStat.findOne({currentDay: { $eq: day + 1}});
  
        if (!isEmpty(rowFind) && !isEmpty(rowFind2)){
          if (!rowFind.priceUV2UV3 || !rowFind2.priceUV2UV3) {
            rowFind2.priceChangeUV2UV3 = 0.0
          } else {
            rowFind2.priceChangeUV2UV3 = parseFloat((((rowFind2.priceUV2UV3 / rowFind.priceUV2UV3) - 1) * 100).toFixed(8));
          }
  
          log("create_priceChangeUV2UV3s - SAVE: " + rowFind2.priceChangeUV2UV3 + " ------ " + day);
          rowFind2.save(function (err) {
            if (err) return log("create_priceChangeUV2UV3s - SAVE ERROR: " + err);
          });
  
        } else {
          log("create_priceChangeUV2UV3s- MISSING DAY: " + day); 
        }
        
        await sleep(100);
      }
    } catch (error) {
      log("ERROR");
      log(error);
    }
  }
  
  async create_tshareRateUSDs(){
    log("create_tshareRateUSDs" + " network: " + this.network);
    try {
      for (var day = 14; day <= 167; day++) { //167
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
        if (!isEmpty(rowFind)) {
  
          if (rowFind.tshareRateHEX && rowFind.priceUV2UV3) {
            rowFind.tshareRateUSD = parseFloat((rowFind.tshareRateHEX * rowFind.priceUV2UV3).toFixed(4));
          } else {
            rowFind.tshareRateUSD = 0.0;
          }
  
          log("create_tshareRateUSDs - SAVE: " + rowFind.tshareRateUSD + " ------ " + day);
          rowFind.save(function (err) {
            if (err) return log("create_tshareRateUSDs - SAVE ERROR: " + err);
          });
  
        } else {
          log("create_tshareRateUSDs - MISSING DAY: " + day); 
        }
        
        await sleep(200);
      }
    } catch (error) {
      log("ERROR");
      log(error);
    }
  }

  async create_roiMultiplierFromATLs(){
    log("create_roiMultiplierFromATLs" + " network: " + this.network);
    try {
      for (var day = 1; day <= 1278; day++) { //167
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
        if (!isEmpty(rowFind)) {
  
          if (this.network == h.ETHEREUM && rowFind.priceUV2UV3) {
            rowFind.roiMultiplierFromATL = (rowFind.priceUV2UV3 / HEX_PRICE_ALLTIMELOW);
          } else if (this.network == h.PULSECHAIN){
            rowFind.roiMultiplierFromATL = 0.0;
          } else {
            rowFind.roiMultiplierFromATL = 0.0;
          }
  
          log("create_roiMultiplierFromATLs - SAVE: " + rowFind.roiMultiplierFromATL + " ------ " + day);
          rowFind.save(function (err) {
            if (err) return log("create_roiMultiplierFromATLs - SAVE ERROR: " + err);
          });
  
        } else {
          log("create_roiMultiplierFromATLs - MISSING DAY: " + day); 
        }
        
        await sleep(200);
      }
    } catch (error) {
      log("ERROR");
      log(error);
    }
  }

  async create_uniswapV1PriceAndLiquidityHistorical(){
    log("create_uniswapV1PriceAndLiquidityHistorical" + " network: " + this.network);
    //var day = 596;
    //var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
    //log("startTime - " + startTime);
    //var priceUV3 = await this.graph.getUniswapV3HEXDailyPriceHistorical(startTime);
    //log("create_uniswapV3HEXPrice - TEST: " + priceUV3 + " ------ " + day + " " + startTime);
    //return;
    try {
      for (var day = 167; day <= 300; day++) {  // Starts on Day 522 14 167
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
        if (!isEmpty(rowFind)) {
          var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
          var { tokenPriceUSD, tokenBalance, ethBalance } = await this.graph.getUniswapV1PriceAndLiquidityHistorical(startTime);
  
          //rowFind.priceUV1 = tokenPriceUSD;
          //rowFind.priceUV2UV3 = tokenPriceUSD
          rowFind.liquidityUV1_HEX = tokenBalance;
          rowFind.liquidityUV1_ETH = ethBalance;
  
          rowFind.liquidityUV2UV3_HEX = rowFind.liquidityUV2UV3_HEX + tokenBalance;
          rowFind.liquidityUV2UV3_ETH = rowFind.liquidityUV2UV3_ETH + ethBalance;
  
          log("create_uniswapV1PriceAndLiquidityHistorical - SAVE: " + startTime.toString() + " - " + tokenPriceUSD + " - " + tokenBalance + " - " + ethBalance + " ------ " + day);
          
          rowFind.save(function (err) {
            if (err) return log("create_uniswapV1PriceAndLiquidityHistorical - SAVE ERROR: " + err);
          });
  
        } else {
          log("create_uniswapV1PriceAndLiquidityHistorical - MISSING DAY: " + day); 
        }
        
        await sleep(300);
      }
    } catch (error) {
      log("ERROR");
      log(error);
    }
  }

  async create_stakeStartsHistorical(){
    getStakeStartHistorical = true;
    log("create_stakeStartsHistorical" + " network: " + this.network);
    //var day = 596;
    //var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
    //log("startTime - " + startTime);
    //var priceUV3 = await this.graph.getUniswapV3HEXDailyPriceHistorical(startTime);
    //log("create_uniswapV3HEXPrice - TEST: " + priceUV3 + " ------ " + day + " " + startTime);
    //return;
    
    for (var day = 1; day <= 643; day++) {
      try {
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
        if (!isEmpty(rowFind)) {
          var blockNumber = await this.graph.getEthereumBlock(day)
          var { averageStakeLength, uniqueStakerCount, stakedHEX } = await this.graph.get_stakeStartDataHistorical(blockNumber);

          rowFind.averageStakeLength = averageStakeLength;
          rowFind.currentStakerCount = uniqueStakerCount;
          rowFind.stakedHEX = stakedHEX

          log("create_stakeStartsHistorical - SAVE: " + blockNumber + " - " + averageStakeLength + " - " + uniqueStakerCount + " - " + stakedHEX + " ------ " + day);
          rowFind.save(function (err) { if (err) return log("create_stakeStartsHistorical - SAVE ERROR: " + err); });

        } else { log("create_stakeStartsHistorical - MISSING DAY: " + day);  }
      
        await sleep(250);

      } catch (error) {
        log("ERROR");
        log(error);
        sleep(1000);
        day--;
      }
    }

    getStakeStartHistorical = false;
  }

  async create_stakedSupplyChanges(){
    log("create_stakedSupplyChanges" + " network: " + this.network);
    try { 
      for (var day = 1; day <= 595; day++) {

        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}}); sleep(100);
        var rowFind2 = await this.dailyStat.findOne({currentDay: { $eq: day + 1}});
  
        if (!isEmpty(rowFind) && !isEmpty(rowFind2)){
          if (rowFind.stakedHEX && rowFind2.stakedHEX) {
            rowFind2.stakedSupplyChange = rowFind2.stakedHEX - rowFind.stakedHEX;
          } else if (!rowFind.stakedHEX && rowFind2.stakedHEX) {
            rowFind2.stakedSupplyChange = rowFind2.stakedHEX;
          } else {
            rowFind2.stakedSupplyChange = 0.0;
          }
  
          log("create_stakedSupplyChanges - SAVE: " + rowFind2.stakedSupplyChange + " ------ " + day);
          rowFind2.save(function (err) { if (err) return log("create_stakedSupplyChanges - SAVE ERROR: " + err);});
        } else { log("create_stakedSupplyChanges- MISSING DAY: " + day); }
        
        await sleep(100);
      } 
    } catch (error) { log("ERROR"); log(error); }
  }

  async create_currentStakerCountChanges(){
    log("create_currentStakerCountChanges" + " network: " + this.network);
    try { 
      for (var day = 1; day <= 595; day++) {
  
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}}); sleep(100);
        var rowFind2 = await this.dailyStat.findOne({currentDay: { $eq: day + 1}});
  
        if (!isEmpty(rowFind) && !isEmpty(rowFind2)){
          if (rowFind.currentStakerCount && rowFind2.currentStakerCount) {
            rowFind2.currentStakerCountChange = rowFind2.currentStakerCount - getNum(rowFind.currentStakerCount);
          } else if (!rowFind.currentStakerCount && rowFind2.currentStakerCount) {
            rowFind2.currentStakerCountChange = rowFind2.currentStakerCount;
          }else {
            rowFind2.currentStakerCountChange = 0.0;
          }
  
          log("create_currentStakerCountChanges - SAVE: " + rowFind2.currentStakerCountChange + " ------ " + day);
          rowFind2.save(function (err) { if (err) return log("create_currentStakerCountChanges - SAVE ERROR: " + err);});
        } else { log("create_currentStakerCountChanges- MISSING DAY: " + day); }
        
        await sleep(100);
      } 
    } catch (error) { log("ERROR"); log(error); }
  }

  async create_tshareMarketCaps(){
    log("create_tshareMarketCaps" + " network: " + this.network);
    try { 
      for (var day = 13; day <= 595; day++) {
  
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
  
        if (!isEmpty(rowFind)){
          if (rowFind.tshareRateUSD && rowFind.totalTshares) {
            rowFind.tshareMarketCap = (rowFind.tshareRateUSD * rowFind.totalTshares);
          } else {
            rowFind.tshareMarketCap = 0.0;
          }
  
          log("create_tshareMarketCaps - SAVE: " + rowFind.tshareMarketCap + " ------ " + day);
          rowFind.save(function (err) { if (err) return log("create_tshareMarketCaps - SAVE ERROR: " + err);});
        } else { log("create_tshareMarketCaps- MISSING DAY: " + day); }
        
        await sleep(100);
      } 
    } catch (error) { log("ERROR"); log(error); }
  }

  async create_totalValueLockeds(){
    log("create_totalValueLockeds" + " network: " + this.network);
    try { 
      for (var day = 40; day <= 595; day++) {
  
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
  
        if (!isEmpty(rowFind)){
          if (rowFind.priceUV2UV3 && rowFind.stakedHEX) {
            rowFind.totalValueLocked = (rowFind.priceUV2UV3 * rowFind.stakedHEX);
          } else {
            rowFind.totalValueLocked = 0.0;
          }
  
          log("create_totalValueLockeds - SAVE: " + rowFind.totalValueLocked + " ------ " + day);
          rowFind.save(function (err) { if (err) return log("create_totalValueLockeds - SAVE ERROR: " + err);});
        } else { log("create_totalValueLockeds- MISSING DAY: " + day); }
        
        await sleep(100);
      } 
    } catch (error) { log("ERROR"); log(error); }
  }

  async create_actualAPYRates(){
    log("create_actualAPYRates" + " network: " + this.network);
    try { 
      for (var day = 1; day <= 595; day++) {
  
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
  
        if (!isEmpty(rowFind)){
          if (rowFind.dailyPayoutHEX && rowFind.stakedHEX) {
            rowFind.actualAPYRate = parseFloat(((rowFind.dailyPayoutHEX / rowFind.stakedHEX) * 365.25 * 100).toFixed(2));
          } else {
            rowFind.actualAPYRate = 0.0;
          }
  
          log("create_actualAPYRates - SAVE: " + rowFind.actualAPYRate + " ------ " + day);
          rowFind.save(function (err) { if (err) return log("create_actualAPYRates - SAVE ERROR: " + err);});
        } else { log("create_actualAPYRates- MISSING DAY: " + day); }
        
        await sleep(100);
      } 
    } catch (error) { log("ERROR"); log(error); }
  }

  async create_penalties_Historical(){
    log("create_penalties_Historical" + " network: " + this.network);
    for (var day = 1; day <= 722; day++) {
      try {
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
        if (!isEmpty(rowFind)) {
          
          //var penaltiesHEX = await this.graph.get_dailyPenalties_Historical(day);
          var penaltiesHEX = h.getNum((rowFind.dailyPayoutHEX - ((rowFind.circulatingHEX + rowFind.stakedHEX) * 10000 / 100448995)) * 2);
  
          rowFind.penaltiesHEX = penaltiesHEX;
  
          log("create_penalties_Historical - SAVE: " + " - " + penaltiesHEX + " ------ " + day);
          rowFind.save(function (err) { if (err) return log("create_penalties_Historical - SAVE ERROR: " + err);});
        } else { log("create_penalties_Historical - MISSING DAY: " + day);  }
      
        await sleep(100);
  
      } catch (error) {
        log("ERROR"); log(error);
        sleep(1000);
        day--;
      }
    }
  }

  async create_numberOfHolders(){
    log("create_numberOfHolders" + " network: " + this.network);
    try { 
      for (var day = 944; day <= 974; day++) {  // 944 - 974
  
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
  
        if (!isEmpty(rowFind)){
          var blockNumber = await this.graph.getEthereumBlock(day + 1);
          sleep(100);
          var numberOfHolders = await this.graph.get_numberOfHolders_Historical(blockNumber);
          if (numberOfHolders) {
            rowFind.numberOfHolders = numberOfHolders;
          } else {
            rowFind.numberOfHolders = 0;
          }
  
          log("create_numberOfHolders - SAVE: " + rowFind.numberOfHolders + " ------ " + day);
          rowFind.save(function (err) { if (err) return log("create_numberOfHolders - SAVE ERROR: " + err);});
        } else { log("create_numberOfHolders- MISSING DAY: " + day); }
        
        await sleep(200);
      } 
    } catch (error) { log("ERROR"); log(error); }
  }

  async create_numberOfHoldersChanges(){
    log("create_numberOfHoldersChanges" + " network: " + this.network);
    try { 
      for (var day = 973; day <= 974; day++) { //943 974
  
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}}); sleep(100);
        var rowFind2 = await this.dailyStat.findOne({currentDay: { $eq: day + 1}});
  
        if (!isEmpty(rowFind) && !isEmpty(rowFind2)){
          if (rowFind.numberOfHolders && rowFind2.numberOfHolders) {
            rowFind2.numberOfHoldersChange = rowFind2.numberOfHolders - h.getNum(rowFind.numberOfHolders);
          } else if (!rowFind.numberOfHolders && rowFind2.numberOfHolders) {
            rowFind2.numberOfHoldersChange = rowFind2.numberOfHolders;
          }else {
            rowFind2.numberOfHoldersChange = 0.0;
          }
  
          log("create_numberOfHoldersChanges - SAVE: " + rowFind2.numberOfHoldersChange + " ------ " + day);
          rowFind2.save(function (err) { if (err) return log("create_numberOfHoldersChanges - SAVE ERROR: " + err);});
        } else { log("create_numberOfHoldersChanges- MISSING DAY: " + day); }
        
        await sleep(100);
      } 
    } catch (error) { log("ERROR"); log(error); }
  }

  async create_currentHoldersChanges(){
    log("create_currentHoldersChanges" + " network: " + this.network);
    try { 
      for (var day = 1; day <= 652; day++) {
  
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}}); sleep(100);
        var rowFind2 = await this.dailyStat.findOne({currentDay: { $eq: day + 1}});
  
        if (!isEmpty(rowFind) && !isEmpty(rowFind2)){
          if (rowFind.currentHolders && rowFind2.currentHolders) {
            rowFind2.currentHoldersChange = rowFind2.currentHolders - getNum(rowFind.currentHolders);
          } else if (!rowFind.currentHolders && rowFind2.currentHolders) {
            rowFind2.currentHoldersChange = rowFind2.currentHolders;
          }else {
            rowFind2.currentHoldersChange = 0.0;
          }
  
          log("create_currentHoldersChanges - SAVE: " + rowFind2.currentHoldersChange + " ------ " + (day + 1));
          rowFind2.save(function (err) { if (err) return log("create_currentHoldersChanges - SAVE ERROR: " + err);});
        } else { log("create_currentHoldersChanges- MISSING DAY: " + day); }
        
        await sleep(100);
      }
    } catch (error) { log("ERROR"); log(error); }
  }

  async create_circulatingSupplys(){
    log("create_circulatingSupplys" + " network: " + this.network);
    for (var day = 1; day <= 595; day++) {
      try { 
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
  
        if (!isEmpty(rowFind)){
          var blockNumber = await this.graph.getEthereumBlock(day);
          await sleep(300);
          var { circulatingSupply, currentHolders } = await this.graph.get_tokenHoldersData_Historical(blockNumber);
          if (circulatingSupply) { rowFind.circulatingHEX = circulatingSupply; } else { rowFind.circulatingHEX = 0; }
          if (currentHolders) { rowFind.currentHolders = currentHolders; } else { rowFind.currentHolders = 0; }
  
          log("create_circulatingSupplys - SAVE: " + rowFind.circulatingHEX + " -- " + rowFind.currentHolders + " ------ " + day);
          rowFind.save(function (err) { if (err) return log("create_circulatingSupplys - SAVE ERROR: " + err);});
        } else { log("create_circulatingSupplys- MISSING DAY: " + day); }
        
        await sleep(500);
      } catch (error) { log("ERROR"); log(error); await sleep(30000); day--; }
    }
  }

  async create_totalHEXs(){
    log("create_totalHEXs" + " network: " + this.network);
    try { 
      for (var day = 1; day <= 595; day++) {

        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
  
        if (!isEmpty(rowFind)){
          if (rowFind.circulatingHEX && rowFind.stakedHEX) {
            rowFind.totalHEX = rowFind.circulatingHEX + rowFind.stakedHEX;
          } else {
            continue;
          }
  
          log("create_totalHEXs - SAVE: " + rowFind.totalHEX + " ------ " + day);
          rowFind.save(function (err) { if (err) return log("create_totalHEXs - SAVE ERROR: " + err);});
        } else { log("create_totalHEXs- MISSING DAY: " + day); }
        
        await sleep(100);
      } 
    } catch (error) { log("ERROR"); log(error); }
  }

  async create_stakedHEXPercents(){
    log("create_stakedHEXPercents" + " network: " + this.network);
    try { 
      for (var day = 1; day <= 595; day++) {
  
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
  
        if (!isEmpty(rowFind)){
          if (rowFind.circulatingHEX && rowFind.stakedHEX) {
            rowFind.stakedHEXPercent = (rowFind.stakedHEX / (rowFind.stakedHEX + rowFind.circulatingHEX) * 100);
          } else {
            continue;
          }
  
          log("create_stakedHEXPercents - SAVE: " + rowFind.stakedHEXPercent + " ------ " + day);
          rowFind.save(function (err) { if (err) return log("create_stakedHEXPercents - SAVE ERROR: " + err);});
        } else { log("create_stakedHEXPercents- MISSING DAY: " + day); }
        
        await sleep(100);
      } 
    } catch (error) { log("ERROR"); log(error); }
  }

  async create_marketCaps(){
    log("create_marketCaps" + " network: " + this.network);
    try { 
      for (var day = 1; day <= 595; day++) {
  
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
  
        if (!isEmpty(rowFind)){
          if (rowFind.priceUV2UV3 && rowFind.circulatingHEX) {
            rowFind.marketCap = (rowFind.priceUV2UV3 * rowFind.circulatingHEX);
          } else {
            continue;
          }
  
          log("create_marketCaps - SAVE: " + rowFind.marketCap + " ------ " + day);
          rowFind.save(function (err) { if (err) return log("create_marketCaps - SAVE ERROR: " + err);});
        } else { log("create_marketCaps- MISSING DAY: " + day); }
        
        await sleep(100);
      } 
    } catch (error) { log("ERROR"); log(error); }
  }

  async create_circulatingSupplyChanges(){
    log("create_circulatingSupplyChanges" + " network: " + this.network);
    try { 
      for (var day = 1; day <= 595; day++) {
  
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}}); sleep(100);
        var rowFind2 = await this.dailyStat.findOne({currentDay: { $eq: day + 1}});
  
        if (!isEmpty(rowFind) && !isEmpty(rowFind2)){
          if (rowFind.circulatingHEX && rowFind2.circulatingHEX) {
            rowFind2.circulatingSupplyChange = rowFind2.circulatingHEX - getNum(rowFind.circulatingHEX);
          } else if (!rowFind.circulatingHEX && rowFind2.circulatingHEX) {
            rowFind2.circulatingSupplyChange = rowFind2.circulatingHEX;
          }else {
            rowFind2.circulatingSupplyChange = 0.0;
          }
  
          log("create_circulatingSupplyChanges - SAVE: " + rowFind2.circulatingSupplyChange + " ------ " + day);
          rowFind2.save(function (err) { if (err) return log("create_circulatingSupplyChanges - SAVE ERROR: " + err);});
        } else { log("create_circulatingSupplyChanges- MISSING DAY: " + day); }
        
        await sleep(100);
      } 
    } catch (error) { log("ERROR"); log(error); }
  }

  async create_dailyMintedInflationTotals(){
    log("create_dailyMintedInflationTotals" + " network: " + this.network);
    try { 
      for (var day = 1; day <= 595; day++) {
  
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}}); sleep(100);
        var rowFind2 = await this.dailyStat.findOne({currentDay: { $eq: day + 1}});
  
        if (!isEmpty(rowFind) && !isEmpty(rowFind2)){
          if (rowFind2.circulatingHEX && rowFind2.stakedHEX) {
            rowFind2.dailyMintedInflationTotal = (rowFind2.circulatingHEX + rowFind2.stakedHEX) - (getNum(rowFind.circulatingHEX) + getNum(rowFind.stakedHEX));
          }else {
            rowFind2.dailyMintedInflationTotal = 0.0;
          }
  
          log("create_dailyMintedInflationTotals - SAVE: " + rowFind2.dailyMintedInflationTotal + " ------ " + day);
          rowFind2.save(function (err) { if (err) return log("create_dailyMintedInflationTotals - SAVE ERROR: " + err);});
        } else { log("create_dailyMintedInflationTotals- MISSING DAY: " + day); }
        
        await sleep(100);
      } 
    } catch (error) { log("ERROR"); log(error); }
  }

  async update_shiftCirculatingSupply(){
    log("update_shiftCirculatingSupply" + " network: " + this.network);
    try {
      var dateOffset = (24*60*60*1000) * 1;
  
      for (var day = 594; day > 1; day--) {
  
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
        var rowFind2 = await this.dailyStat.findOne({currentDay: { $eq: day + 1}});
  
        if (!isEmpty(rowFind) && !isEmpty(rowFind2)){
  
          if (rowFind.circulatingHEX) {
            rowFind2.circulatingHEX = rowFind.circulatingHEX;
          } else {
            rowFind2.circulatingHEX = 0.0;
          }
  
          log("update_shiftCirculatingSupply - SAVE:  ------ " + rowFind2.circulatingHEX + " - Day: " + (day + 1));
          rowFind2.save(function (err) { if (err) return log("update_shiftCirculatingSupply - SAVE ERROR: " + err);});
  
        } else {
          log("update_shiftCirculatingSupply - MISSING DAY: " + day); 
        }
        
        await sleep(100);
      }
    } catch (error) {
      log("ERROR");
      log(error);
    }
  }

  async create_stakeStartGAsHistorical(){
    getStakeStartGAHistorical = true;
    log("create_stakeStartGAsHistorical" + " network: " + this.network);
    for (var day = 623; day <= 623; day++) {  
      try {
          var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
          if (!isEmpty(rowFind)) {
            var blockNumber = await this.graph.getEthereumBlock(day)
            var { stakedHEXGA } = await this.graph.get_stakeStartGADataHistorical(blockNumber);
  
            rowFind.stakedHEXGA = stakedHEXGA;
  
            log("create_stakeStartGAsHistorical - SAVE: " + blockNumber + " - " + stakedHEXGA + " ------ " + day);
            rowFind.save(function (err) { if (err) return log("create_stakeStartGAsHistorical - SAVE ERROR: " + err); });
          } else { log("create_stakeStartGAsHistorical - MISSING DAY: " + day);  }
          await sleep(250);
        } catch (error) { log("ERROR"); log(error);
          sleep(3000); day--;
        }
      }
      getStakeStartGAHistorical = false;
  }

  async create_stakedSupplyGAChanges(){
    log("create_stakedSupplyGAChanges" + " network: " + this.network);
    try { 
      for (var day = 1; day <= 621; day++) {
  
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}}); sleep(100);
        var rowFind2 = await this.dailyStat.findOne({currentDay: { $eq: day + 1}});
  
        if (!isEmpty(rowFind) && !isEmpty(rowFind2)){
          if (rowFind.stakedHEXGA && rowFind2.stakedHEXGA) {
            rowFind2.stakedHEXGAChange = rowFind2.stakedHEXGA - getNum(rowFind.stakedHEXGA);
          } else if (!rowFind.stakedHEXGA && rowFind2.stakedHEXGA) {
            rowFind2.stakedHEXGAChange = rowFind2.stakedHEXGA;
          }else {
            rowFind2.stakedHEXGAChange = 0.0; 
          }
  
          log("create_stakedSupplyGAChanges - SAVE: " + rowFind2.stakedHEXGAChange + " ------ " + day);
          rowFind2.save(function (err) { if (err) return log("create_stakedSupplyGAChanges - SAVE ERROR: " + err);});
        } else { log("create_stakedSupplyGAChanges- MISSING DAY: " + day); }
        
        await sleep(100);
      } 
    } catch (error) { log("ERROR"); log(error); }
  }

  async update_stakedSupplyWithGA(){
    log("update_stakedSupplyWithGA" + " network: " + this.network);
    try { 
      for (var day = 12; day <= 595; day++) {
  
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}}); sleep(100);
  
        if (!isEmpty(rowFind)){
          if (rowFind.stakedHEX && rowFind.stakedHEXGA) {
            rowFind.stakedHEX = rowFind.stakedHEX + rowFind.stakedHEXGA;
          } else if (!rowFind.stakedHEX && rowFind.stakedHEXGA) {
            rowFind.stakedHEX = rowFind.stakedHEXGA;
          }
  
          log("update_stakedSupplyWithGA - SAVE: " + rowFind.stakedHEX + " ------ " + day);
          rowFind.save(function (err) { if (err) return log("update_stakedSupplyWithGA - SAVE ERROR: " + err);});
        } else { log("update_stakedSupplyWithGA- MISSING DAY: " + day); }
        
        await sleep(100);
      } 
    } catch (error) { log("ERROR"); log(error); }
  }

  async create_stakeStartsCountHistorical(){
    getStakeStartsCountHistorical= true;
    log("create_stakeStartsCountHistorical" + " network: " + this.network);
    for (var day = 515; day <= 619; day++) {  
      try {
          var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
          if (!isEmpty(rowFind)) {
            var blockNumber = await this.graph.getEthereumBlock(day)
            var { uniqueStakerCount } = await this.graph.getAll_stakeStartsCountHistorical(blockNumber);
  
            rowFind.totalStakerCount = uniqueStakerCount;
  
            log("create_stakeStartsCountHistorical - SAVE: " + blockNumber + " - " + uniqueStakerCount + " ------ " + day);
            rowFind.save(function (err) { if (err) return log("create_stakeStartsCountHistorical - SAVE ERROR: " + err); });
          } else { log("create_stakeStartsCountHistorical - MISSING DAY: " + day);  }
          await sleep(250);
        } catch (error) { log("ERROR"); log(error);
          sleep(3000); day--;
        }
      }
      getStakeStartsCountHistorical = false;
  }

  async create_totalStakerCountChanges(){
    log("create_totalStakerCountChanges" + " network: " + this.network);
    try { 
      for (var day = 1; day <= 625; day++) {
  
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}}); sleep(100);
        var rowFind2 = await this.dailyStat.findOne({currentDay: { $eq: day + 1}});
  
        if (!isEmpty(rowFind) && !isEmpty(rowFind2)){
          if (rowFind.totalStakerCount && rowFind2.totalStakerCount) {
            rowFind2.totalStakerCountChange = rowFind2.totalStakerCount - getNum(rowFind.totalStakerCount);
          } else if (!rowFind.totalStakerCount && rowFind2.totalStakerCount) {
            rowFind2.totalStakerCountChange = rowFind2.totalStakerCount;
          }else {
            rowFind2.totalStakerCountChange = 0.0;
          }
  
          log("create_totalStakerCountChanges - SAVE: " + rowFind2.totalStakerCountChange + " ------ " + day);
          rowFind2.save(function (err) { if (err) return log("create_totalStakerCountChanges - SAVE ERROR: " + err);});
        } else { log("create_totalStakerCountChanges- MISSING DAY: " + day); }
        
        await sleep(100);
      } 
    } catch (error) { log("ERROR"); log(error); }
  }

  async create_priceBTC(){
    log("create_priceBTC" + " network: " + this.network);
    var dayEnd = 1279;
    try {
      var pricesBTC = await Coingecko.getPriceHistory_BitcoinWithTime(dayEnd); await sleep(500);
      log("pricesBTC length: " + pricesBTC.length);
      log(pricesBTC.slice(-5));
  
      for (var day = 1279; day <= dayEnd; day++) {
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
        if (!isEmpty(rowFind)) {

          var startTime = 1575417600 + ((day - 2) * 86400) + 86400;
          startTime = startTime * 1000;

          var priceBTC = 0;
          var pricesFiltered = pricesBTC.filter(p => (p.length == 2 && 
            ((p[0] == startTime) || (p[0] > (startTime - (3600000 * 12)) && p[0] < (startTime + (3600000 * 1))))));
          if (pricesFiltered.length == 1){
            priceBTC = pricesFiltered[0][1];
          }

          rowFind.priceBTC = priceBTC; //pricesBTC[(day - 1)];
  
          log("create_priceBTC - SAVE: " + priceBTC + " ------ " + day); //pricesBTC[(day - 1)] + " ------ " + day);
          rowFind.save(function (err) {
            if (err) return log("create_priceBTC - SAVE ERROR: " + err);
          });
  
        } else {
          log("create_priceBTC - MISSING DAY: " + day); 
        }
        
        await sleep(200);
      }
    } catch (error) {
      log("ERROR");
      log(error);
    }
  }

  async create_priceETH(){
    log("create_priceETH" + " network: " + this.network);
    var dayEnd = 1279;
    try {
      var pricesETH = await Coingecko.getPriceHistory_EthereumWithTime(dayEnd); await sleep(500);
      log("pricesETH length: " + pricesETH.length);
      log(pricesETH.slice(-5));
  
      for (var day = 1279; day <= dayEnd; day++) {
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
        if (!isEmpty(rowFind)) {

          var startTime = 1575417600 + ((day - 2) * 86400) + 86400;
          startTime = startTime * 1000;
          console.log("startTime")
          console.log(startTime)

          var priceETH = 0;
          var pricesFiltered = pricesETH.filter(p => (p.length == 2 && 
            ((p[0] == startTime) || (p[0] > (startTime - (3600000 * 12)) && p[0] < (startTime + (3600000 * 1))))));
          if (pricesFiltered.length >= 1){
            priceETH = pricesFiltered[0][1];
          }

          rowFind.priceETH = priceETH; //pricesETH[(day - 1)];
  
          log("create_priceETH - SAVE: " + priceETH + " ------ " + day); //pricesETH[(day - 1)] + " ------ " + day);
          rowFind.save(function (err) {
            if (err) return log("create_priceETH - SAVE ERROR: " + err);
          });
  
        } else {
          log("create_priceETH - MISSING DAY: " + day); 
        }
        
        await sleep(200);
      }
    } catch (error) {
      log("ERROR");
      log(error);
    }
  }

  async create_pulseXLiquidity(){
    log("create_pulseXLiquidity" + " network: " + this.network);

    try {
      for (var day = 1255; day <= 1279; day++) {  // 1279
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}});
        if (!isEmpty(rowFind)) {
          //var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
          var HEXpair = await TheGraph_PULSECHAIN.getPulseXPairLiquidity(h.PULSECHAIN_HEXPLS, day); await sleep(1000);
          var EHEXpair = await TheGraph_PULSECHAIN.getPulseXPairLiquidity(h.PULSECHAIN_HEXEHEX, day); await sleep(1000);

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
          } else if (HEXpair && HEXpair.reserve0) {
            liquidityPulseX_HEX = Number(HEXpair.reserve0);
          } else if (EHEXpair && EHEXpair.reserve0) {
            liquidityPulseX_HEX = Number(EHEXpair.reserve0);
          }

          rowFind.liquidityPulseX_HEXEHEX = liquidityPulseX_HEXEHEX;
          rowFind.liquidityPulseX_EHEX = liquidityPulseX_EHEX;
          rowFind.liquidityPulseX_HEXPLS = liquidityPulseX_HEXPLS;
          rowFind.liquidityPulseX_PLS = liquidityPulseX_PLS;
          rowFind.liquidityPulseX_HEX = liquidityPulseX_HEX;

          console.log(HEXpair);
          console.log(EHEXpair);
  
          log("create_pulseXLiquidity - SAVE: " + day);
          rowFind.save(function (err) {
            if (err) return log("create_pulseXLiquidity - SAVE ERROR: " + err);
          });
  
        } else {
          log("create_pulseXLiquidity - MISSING DAY: " + day); 
        }
        
        await sleep(1000);
      }
    } catch (error) {
      log("ERROR");
      log(error);
    }
  }

  async copyColumns(){
    log("copyColumns" + " network: " + this.network);
    try { 
      for (var day = 1; day <= 647; day++) {
        var rowFind = await this.dailyStat.findOne({currentDay: { $eq: day}}); sleep(100);
  
        if (!isEmpty(rowFind)){
          if (rowFind.uniqueStakerCount && rowFind.uniqueStakerCountChange) {
            rowFind.currentStakerCount = rowFind.uniqueStakerCount;
            rowFind.currentStakerCountChange = rowFind.uniqueStakerCountChange;
          } else {
            rowFind.currentStakerCount = 0;
            rowFind.currentStakerCountChange = 0
          }
  
          log("copyColumns - SAVE: " + rowFind.currentStakerCount + " - " + rowFind.currentStakerCountChange + " ------ " + day);
          rowFind.save(function (err) { if (err) return log("copyColumns - SAVE ERROR: " + err);});  
        } else { log("copyColumns- MISSING DAY: " + day); }
        
        await sleep(100);
      } 
    } catch (error) { log("ERROR"); log(error); }
  }

  async updateOneColumn(day, column, value){
    await this.dailyStat.updateOne(
      {currentDay: day},
      {[column]:value}
    )
  }

}
