var DEBUG = false;
var CONFIG = require('./config.json');
const http = require('http');
require('es6-promise').polyfill();


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


const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const schedule = require('node-schedule');
var cors = require('cors');

const { JSDOM } = require( "jsdom" );
const { window } = new JSDOM( "" );
const $ = require( "jquery" )( window );

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

const HEX_CONTRACT_ADDRESS = "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39";
const HEX_CONTRACT_CURRENTDAY = "0x5c9302c9";
const HEX_CONTRACT_GLOBALINFO = "0xf04b5fa0";

const HEX_PRICE_ALLTIMELOW = 0.00005645;

const UNISWAP_V2_HEXUSDC = "0xf6dcdce0ac3001b2f67f750bc64ea5beb37b5824";
const UNISWAP_V2_HEXETH = "0x55d5c232d921b9eaa6b37b5845e439acd04b4dba";

const UNISWAP_V3_HEXUSDC = "0x69d91b94f0aaf8e8a2586909fa77a5c2c89818d5";
const UNISWAP_V3_HEXETH = "0x9e0905249ceefffb9605e034b534544684a58be6";

const FETCH_SIZE = 1048576;

var rowData = undefined;
var rowDataObjects = undefined;
var getDataRunning = false;
var getRowDataRunning = false;
var connections = {};
var hexPrice = '';
var currentDayGlobal = 0;
var getStakeStartHistorical = false;
var getStakeStartGAHistorical = false;
var getStakeStartsCountHistorical = false;
var getLiveDataRUNNING = false;
var liveData = undefined;
var currencyRates = undefined;
var getCurrencyDataRunning = false;
var getAndSet_currentGlobalDay_Running = false;

var hostname = CONFIG.hostname;
if (DEBUG){ hostname = '127.0.0.1'; }

var httpPort = 80; 
if (DEBUG){ httpPort = 3000; }
const httpsPort = 443;

var httpsOptions = undefined;
if(!DEBUG){ httpsOptions = {
	cert: fs.readFileSync(CONFIG.https.cert),
	ca: fs.readFileSync(CONFIG.https.ca),
	key: fs.readFileSync(CONFIG.https.key)
};}

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

const app = express();

const getAndSet_currentGlobalDayThrottled = throttle(getAndSet_currentGlobalDay, 30000);

app.use(function(req, res, next) {
	try {
	if (!DEBUG && req.path === "/" && req.ip){
		connections[req.ip] = Date.now();

		const connection = new Connection({ 
			created: Date.now(),
			ipaddress: req.ip
		});

		connection.save(function (err) {
			if (err) return log(err);
		});
	}
	} catch (error) {
		log('APP ----- Connection ' + error);
	}

  if (!getAndSet_currentGlobalDay_Running && !getDataRunning && !getLiveDataRUNNING) { getAndSet_currentGlobalDayThrottled() }
  //if (!getRowDataRunning){ getRowData(); }

	next();
});

async function getAndSet_currentGlobalDay(){
  getAndSet_currentGlobalDay_Running = true;
  try {
    var currentDay = await getCurrentDay() + 1;
    log("currentDay: " + currentDay);

    if (currentDay != currentDayGlobal && currentDay > currentDayGlobal) {
      currentDayGlobal = currentDay;
      io.emit("currentDay", currentDayGlobal);
    } 
  } catch (error){
    log("ERROR: " + "getAndSet_currentGlobalDay()");
    console.log(error);
  } finally {
    getAndSet_currentGlobalDay_Running = false;
  }
  await sleep(1000);
}

const httpServer = http.createServer(app);
var httpsServer = undefined;
if(!DEBUG){ httpsServer = https.createServer(httpsOptions, app);}

if(!DEBUG){ app.use((req, res, next) => 
{
  if(req.protocol === 'http') { 
    res.redirect(301, 'https://' + hostname); 
  }
  next(); 
}); }

app.use(express.static(path.join(__dirname, 'public')));

app.get("/", function(req, res){ res.sendFile('/index.html', {root: __dirname}); });

app.get("/" + CONFIG.urls.grabdata, function (req, res) {
  grabData();
  res.send(new Date().toISOString() + ' - Grab Data!');
});

app.get('/fulldata', cors(), function (req, res) {
  res.send(JSON.parse(JSON.stringify(rowDataObjects)))
});

app.get('/livedata', cors(), function (req, res) {
  if (liveData) { res.send(JSON.parse(JSON.stringify(liveData))); } else {res.status(404).send({ error: "liveData not populated yet" });};
});

async function grabData() {
  if (!getRowDataRunning){ getRowData(); }
  if (!getLiveDataRUNNING){ await runLiveData(); }
  if (!getCurrencyDataRunning){ getCurrencyData(); };
  if (!getDataRunning){ getDailyData(); }
}

httpServer.listen(httpPort, hostname, () => { log(`Server running at http://${hostname}:${httpPort}/`);});
if(!DEBUG){ httpsServer.listen(httpsPort, hostname, () => { log('listening on *:' + httpsPort); }); }

var io = undefined;
if(DEBUG){ io = require('socket.io')(httpServer);
} else { io = require('socket.io')(httpsServer, {secure: true}); }

io.on('connection', (socket) => {
	log('SOCKET -- ************* CONNECTED: ' + socket.id + ' *************');
	if (rowData){ socket.emit("rowData", rowData); };
  //if (!getDataRunning){ getDailyData(); }
  //if (!getRowDataRunning){ getRowData(); }
  socket.emit("hexPrice", hexPrice);
  socket.emit("currentDay", currentDayGlobal);
  socket.emit("liveData", liveData);
  socket.emit("currencyRates", currencyRates);

  socket.on("sendLatestData", (arg) => { // delete later
    if (rowData && arg && Number.isInteger(arg)) {
      log("sendLatestData TRY - User: " + arg + " - Server: " + rowData[0][0]);
      if (rowData[0][0] > arg) {
        log("sendLatestData - SUCCESS");
        socket.emit("rowData", rowData);
      }
    }
  });

  //createAllRows();
  //update_shiftRowsDown();
  //copyColumns();

  //////////////////////////////////////////////////////////////////
  // Create New Row

  //createRow(623);
  //create_dailyUpdates();
  //create_totalTshareChanges();
  //get_shareRateChangeByDay(623);
  //create_tshareRateHEXIncreases();
  //create_uniswapV2HEXPrice();
  //create_uniswapV3HEXPrice();
  //createUV2UV3Liquidity();
  //create_uniswapV2V3CombinedHEXPrice();
  //create_priceChangeUV2UV3s();
  //create_tshareRateUSDs();
  //create_roiMultiplierFromATLs();

  //create_stakeStartsHistorical();
  //create_stakeStartGAsHistorical();
  //create_stakedSupplyGAChanges();
  //update_stakedSupplyWithGA();
  //create_stakedSupplyChanges();
  //create_currentStakerCountChanges();
  //create_tshareMarketCaps();
  //create_totalValueLockeds();
  //create_actualAPYRates();
  //create_stakeEnds_stakeGoodAccountings_Historical();

  //create_numberOfHolders();
  //create_numberOfHoldersChanges();
  //create_circulatingSupplys();
  //create_totalHEXs();
  //create_stakedHEXPercents();
  //create_marketCaps();
  //create_circulatingSupplyChanges();
  //create_dailyMintedInflationTotals();
  //create_totalStakerCountChanges();
  //create_currentHoldersChanges();
  
  //if (!getStakeStartsCountHistorical){create_stakeStartsCountHistorical();}
});

async function getCurrencyData() {
  log("getCurrencyData() - START");
  getCurrencyDataRunning = true;
  try {
    var rates = await getCurrencyRates();
    if (rates) {
      currencyRates = rates;
      log('SOCKET -- ****EMIT: currencyRates');
      io.emit("currencyRates", currencyRates);
    }
  } catch (error) {
    log("getCurrencyData() - ERROR: " + error);
  } finally {
    getCurrencyDataRunning = false;
  }
}

if(!DEBUG){
const rule5 = new schedule.RecurrenceRule();
rule5.hour = 0;
rule5.minute = 5;
rule5.tz = 'Etc/UTC';

const job5 = schedule.scheduleJob(rule5, function(){
  log('**** DAILY DATA TIMER 5!');
  if (!getDataRunning){ getDailyData(); }
});

const rule20 = new schedule.RecurrenceRule();
rule20.hour = 0;
rule20.minute = 20;
rule20.tz = 'Etc/UTC';

const job20 = schedule.scheduleJob(rule20, function(){
  log('**** DAILY DATA TIMER 20!');
  if (!getDataRunning){ getDailyData(); }
});

const rule40 = new schedule.RecurrenceRule();
rule40.hour = 0;
rule40.minute = 40;
rule40.tz = 'Etc/UTC';

const job40 = schedule.scheduleJob(rule40, function(){
  log('**** DAILY DATA TIMER 40!');
  if (!getDataRunning){ getDailyData(); }
});
}


//if (CONFIG.price.enabled) {
//	var priceTimer = CONFIG.price.timer * 60 * 1000;
//	setInterval(function() {
//		updatePrice();
//	}, priceTimer); }

var jobLive = schedule.scheduleJob("*/1 * * * *", function() { 
  runLiveData();
});

const ruleCurrentDay = new schedule.RecurrenceRule();
ruleCurrentDay.hour = 0;
ruleCurrentDay.minute = 0;
ruleCurrentDay.second = 30;
ruleCurrentDay.tz = 'Etc/UTC';

const jobCurrentDay = schedule.scheduleJob(ruleCurrentDay, function(){
  log('**** DAILY DATA TIMER 30S!');
  if (!getAndSet_currentGlobalDay_Running) { getAndSet_currentGlobalDay(); }
});

var jobCurrencyRates = schedule.scheduleJob("0 */3 * * *", function() { 
  if (!getCurrencyDataRunning) { getCurrencyData(); };
});


//////////////////////
// DATABASE

var mongoDB = CONFIG.mongodb.connectionString;
mongoose.connect(mongoDB, {useNewUrlParser: true, useUnifiedTopology: true}).then(() => {
		log("Mongo Connected!");
});

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

var DailyStatSchema = new Schema({
  date:               { type: Date,   required: true },
  currentDay:         { type: Number, required: true },
  circulatingHEX:     { type: Number, required: true },
  stakedHEX:          { type: Number, required: true },
  stakedHEXGA:        { type: Number },

  tshareRateHEX:      { type: Number, required: true },
  dailyPayoutHEX:     { type: Number, required: true },
  totalTshares:       { type: Number, required: true },
  averageStakeLength: { type: Number, required: true },
  penaltiesHEX:       { type: Number, required: true },

  priceUV1:           { type: Number },
  priceUV2:           { type: Number, required: true },
  priceUV3:           { type: Number, required: true },

  liquidityUV1_HEX:   { type: Number },
  liquidityUV1_ETH:   { type: Number },

  liquidityUV2_USDC:  { type: Number, required: true },
  liquidityUV2_ETH:   { type: Number, required: true },

  liquidityUV2_HEXUSDC: { type: Number },
  liquidityUV2_HEXETH:  { type: Number },

  liquidityUV3_HEX:   { type: Number },
  liquidityUV3_USDC:  { type: Number },
  liquidityUV3_ETH:   { type: Number },

  // CALCULATED DATA
  tshareRateIncrease: { type: Number, required: true },
  tshareRateUSD:      { type: Number, required: true },

  totalTsharesChange: { type: Number, required: true },
  payoutPerTshareHEX: { type: Number, required: true },
  actualAPYRate:      { type: Number, required: true },

  stakedHEXGAChange:        { type: Number},
  stakedSupplyChange:       { type: Number, required: true },
  circulatingSupplyChange:  { type: Number, required: true },

  stakedHEXPercent:         { type: Number, required: true },
  stakedHEXPercentChange:   { type: Number},

  priceUV2UV3:          { type: Number, required: true },
  priceChangeUV2:       { type: Number, required: true },
  priceChangeUV3:       { type: Number, required: true },
  priceChangeUV2UV3:    { type: Number, required: true },

  liquidityUV2UV3_USDC: { type: Number, required: true },
  liquidityUV2UV3_ETH:  { type: Number, required: true },
  liquidityUV2UV3_HEX:  { type: Number, required: true },

  currentHolders:        { type: Number, },
  currentHoldersChange:  { type: Number, },
  numberOfHolders:        { type: Number, required: true },
  numberOfHoldersChange:  { type: Number, required: true },

  dailyMintedInflationTotal:  { type: Number, required: true },

  totalHEX: { type: Number, required: true },

  marketCap:                        { type: Number, required: true },
  tshareMarketCap:                  { type: Number, required: true },
  tshareMarketCapToMarketCapRatio:  { type: Number, required: true },

  roiMultiplierFromATL:             { type: Number, required: true },

  uniqueStakerCount:         { type: Number, select: false, },
  uniqueStakerCountChange:   { type: Number, select: false, },
  currentStakerCount:        { type: Number, },
  currentStakerCountChange:  { type: Number, },
  totalStakerCount:         { type: Number,},
  totalStakerCountChange:   { type: Number,},

  totalValueLocked:        { type: Number, required: true },
});

const DailyStat = mongoose.model('DailyStat', DailyStatSchema);

async function runLiveData() {
  try {
  await sleep(300);
  if (!getDataRunning && !getLiveDataRUNNING){
    var liveDataNew = await getLiveData();
    //console.log(liveDataNew);
    if (liveDataNew && (JSON.stringify(liveDataNew) !== JSON.stringify(liveData))){
      liveData = liveDataNew;
      io.emit("liveData", liveData);
      if (liveData.price) {
				hexPrice = liveData.price.toFixed(4);
				io.emit("hexPrice", hexPrice);
			}
    }
  }
  } catch (error){
    log("runLiveData() --- ERROR --- " + error.toString());
  } finally {
    getLiveDataRUNNING = false;
  }
}

async function getLiveData() {
  getLiveDataRUNNING = true;
  log("getLiveData()");
  try {
  if (!getDataRunning){
    var priceUV2 = await getUniswapV2HEXDailyPrice(); await sleep(1000);
    var priceUV3 = await getUniswapV3HEXDailyPrice(); await sleep(1000);
    
    var { liquidityUV2_HEXUSDC, liquidityUV2_USDC } = await getUniswapV2HEXUSDC_Polling(); await sleep(1000);
    var { liquidityUV2_HEXETH, liquidityUV2_ETH } = await getUniswapV2HEXETH(); await sleep(1000);
    
    var { liquidityUV3_HEX, liquidityUV3_USDC, liquidityUV3_ETH } = await getUniswapV3(); await sleep(1000);
    
    var liquidityUV2UV3_HEX = parseInt(liquidityUV2_HEXUSDC + liquidityUV2_HEXETH + liquidityUV3_HEX);
    var liquidityUV2UV3_USDC = parseInt(liquidityUV2_USDC + liquidityUV3_USDC);
    var liquidityUV2UV3_ETH  = parseInt(liquidityUV2_ETH + liquidityUV3_ETH);

    var priceUV2UV3 = parseFloat(((priceUV2 * (liquidityUV2_USDC / liquidityUV2UV3_USDC)) + 
    (priceUV3 * (liquidityUV3_USDC / liquidityUV2UV3_USDC))).toFixed(8));
    
    var tshareRateHEX = await get_shareRateChange(); await sleep(500);
    tshareRateHEX = parseFloat(tshareRateHEX);
    var tshareRateUSD = parseFloat((tshareRateHEX * priceUV2).toFixed(4));

    if (liquidityUV2_HEXUSDC == 0 || liquidityUV2_USDC == 0 || liquidityUV2_HEXETH == 0 || liquidityUV2_ETH == 0) {
      return undefined;
    }

    var penaltiesHEX = await get_dailyPenalties(false); await sleep(500);
    var { circulatingHEX, stakedHEX, totalTshares } = await getGlobalInfo(); await sleep(500);

    var payout = ((circulatingHEX + stakedHEX) * 10000 / 100448995) + (penaltiesHEX / 2.0);
    var payoutPerTshare = (payout / totalTshares);
    
    return {
      price: priceUV2UV3,
      tsharePrice: tshareRateUSD,
      tshareRateHEX: tshareRateHEX,
      liquidityHEX: liquidityUV2UV3_HEX,
      liquidityUSDC: liquidityUV2UV3_USDC,
      liquidityETH: liquidityUV2UV3_ETH,
      penaltiesHEX: penaltiesHEX,
      payoutPerTshare: payoutPerTshare,
    };
  }
  } catch (error){
    log("getLiveData() --- ERROR --- " + error.toString());
  } finally {
    getLiveDataRUNNING = false;
  }
}

async function getRowData() {
  getRowDataRunning = true;
  try {
    var dailyStats = [];
    var dailyStats = await DailyStat.find();
    dailyStats = dailyStats.sort((a, b) => (a.currentDay < b.currentDay) ? 1 : -1);

    var rowDataNew = [];
    for (var ds of dailyStats){
      var row = [
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
      ];
      rowDataNew.push(row);
    }

    if (rowData === undefined || !(JSON.stringify(rowData) === JSON.stringify(rowDataNew))){ //!arraysEqual(rowData, rowDataNew)) {
      rowData = rowDataNew;
      rowDataObjects = dailyStats;
      log('SOCKET -- ****EMIT: rowData');
      io.emit("rowData", rowData);
    }

  } catch (err) {
    log('getRowData() ----- ' + err);
  } finally {
    getRowDataRunning = false;
  }
}

async function getDailyData() {
  
  getDataRunning = true;
  log("getDailyData() --- START ****************");
  try {
  await sleep(5000);
  var currentDay = await getCurrentDay();
  var newDay = currentDay + 1;
  log("*** 001 *** - currentDay: " + currentDay);

  if (newDay != currentDayGlobal && newDay > currentDayGlobal) {
    currentDayGlobal = newDay;
    io.emit("currentDay", currentDayGlobal);
  }

  // Check if Current Row of Data already exists
  var currentDailyStat = await DailyStat.findOne({currentDay: { $eq: currentDay }});
  if (!isEmpty(currentDailyStat)) {
    log('getDailyData() --- WARNING - Current Daily Stat already set - Day#: ' + currentDay);
    return;
  }
  log("*** 002 - currentDay row doesnt exist!");

  var blockNumber = await getEthereumBlock(currentDay);  await sleep(250);
  log("*** 003 - blockNumber: " + blockNumber);

  // Get Previous Row of Data
  var previousDay = (currentDay - 1);
  var previousDailyStat = await DailyStat.findOne({currentDay: { $eq: previousDay }});
  log("*** 004 - previousDay: " + previousDay);

  // Core Live
  var tshareRateHEX = await get_shareRateChange(); await sleep(250);
  log("*** 005 - tshareRateHEX: " + tshareRateHEX);

  var { circulatingHEX, stakedHEX } = await getGlobalInfo(); await sleep(250);
  log("*** 006 - circulatingHEX: " + circulatingHEX + " - stakedHEX: " + stakedHEX);

  var priceUV2 = await getUniswapV2HEXDailyPrice(); await sleep(1000);
  log("*** 007 - priceUV2: " + priceUV2);
  var priceUV3 = await getUniswapV3HEXDailyPrice(); await sleep(1000);
  log("*** 008 - priceUV3: " + priceUV3);

  var { liquidityUV2_HEXUSDC, liquidityUV2_USDC } = await getUniswapV2HEXUSDC_Polling(); await sleep(1000);
  log("*** 009 - liquidityUV2_HEXUSDC: " + liquidityUV2_HEXUSDC + " - liquidityUV2_USDC: " + liquidityUV2_USDC);
  var { liquidityUV2_HEXETH, liquidityUV2_ETH } = await getUniswapV2HEXETH(); await sleep(1000);
  log("*** 010 - liquidityUV2_HEXETH: " + liquidityUV2_HEXETH + " - liquidityUV2_ETH: " + liquidityUV2_ETH);
  var { liquidityUV3_HEX, liquidityUV3_USDC, liquidityUV3_ETH } = await getUniswapV3(); await sleep(500);
  log("*** 011 - liquidityUV3_HEX: " + liquidityUV3_HEX + " - liquidityUV3_USDC: " + liquidityUV3_USDC + " - liquidityUV3_ETH: " + liquidityUV3_ETH);

  var numberOfHolders = await get_numberOfHolders();
  var numberOfHoldersChange = (numberOfHolders - previousDailyStat.numberOfHolders);
  log("*** 012 - numberOfHolders: " + numberOfHolders + " - numberOfHoldersChange: " + numberOfHoldersChange);

  var { averageStakeLength, currentStakerCount } = await get_stakeStartData();
  var currentStakerCountChange = (currentStakerCount - getNum(previousDailyStat.currentStakerCount));
  log("*** 013 - averageStakeLength: " + averageStakeLength + " - currentStakerCount: " + currentStakerCount);

  // Core Historical
  var penaltiesHEX = await get_dailyPenalties(); await sleep(500);
  log("*** 014 - penaltiesHEX: " + penaltiesHEX);

  var { dailyPayoutHEX, totalTshares } = await get_dailyDataUpdatePolling(currentDay); await sleep(500);
  log("*** 015 - dailyPayoutHEX: " + dailyPayoutHEX + " - totalTshares: " + totalTshares);

  var { stakedHEXGA } = await get_stakeStartGADataHistorical(blockNumber);
  log("*** 016 - stakedHEXGA: " + stakedHEXGA);

  var currentHolders = await get_currentHolders(blockNumber);
  var currentHoldersChange = (currentHolders - previousDailyStat.currentHolders);
  log("*** 017 - currentHolders: " + currentHolders);

  var totalStakerCount = await get_stakeStartsCountHistorical(currentDay);
  var totalStakerCountChange = (getNum(totalStakerCount) - getNum(previousDailyStat.totalStakerCount))
  log("*** 018 - totalStakerCount: " + totalStakerCount + " - totalStakerCountChange: " + totalStakerCountChange);


  // Calculated Values
  var totalTsharesChange      = (totalTshares - previousDailyStat.totalTshares);
  var payoutPerTshareHEX      = (dailyPayoutHEX / totalTshares);
  var actualAPYRate           = parseFloat(((dailyPayoutHEX / stakedHEX) * 365.25 * 100).toFixed(2));

  var stakedSupplyChange      = (stakedHEX - previousDailyStat.stakedHEX);
  var stakedHEXGAChange       = (stakedHEXGA - previousDailyStat.stakedHEXGA)
  var circulatingSupplyChange = (circulatingHEX - previousDailyStat.circulatingHEX);

  var stakedHEXPercent        = parseFloat(((stakedHEX / (stakedHEX + circulatingHEX)) * 100).toFixed(2));
  var stakedHEXPercentChange  = parseFloat((stakedHEXPercent - previousDailyStat.stakedHEXPercent).toFixed(2));

  var liquidityUV2UV3_HEX     = parseInt(liquidityUV2_HEXUSDC + liquidityUV2_HEXETH + liquidityUV3_HEX); //parseFloat((liquidityUV2_HEXUSDC + liquidityUV2_HEXETH + liquidityUV3_HEX).toFixed(4));
  var liquidityUV2UV3_USDC    = parseInt(liquidityUV2_USDC + liquidityUV3_USDC); //parseFloat((liquidityUV2_USDC + liquidityUV3_USDC).toFixed(4));
  var liquidityUV2UV3_ETH     = parseInt(liquidityUV2_ETH + liquidityUV3_ETH); //parseFloat((liquidityUV2_ETH + liquidityUV3_ETH).toFixed(4));

  var priceChangeUV2          = parseFloat((priceUV2 - previousDailyStat.priceUV2).toFixed(4));
  var priceChangeUV3          = parseFloat((priceUV3 - previousDailyStat.priceUV3).toFixed(4));

  var priceUV2UV3             = parseFloat(((priceUV2 * (liquidityUV2_USDC / liquidityUV2UV3_USDC)) + (priceUV3 * (liquidityUV3_USDC / liquidityUV2UV3_USDC))).toFixed(8));
  var priceChangeUV2UV3       = parseFloat((((priceUV2UV3 / previousDailyStat.priceUV2UV3) - 1) * 100).toFixed(8));

  var tshareRateIncrease      = (tshareRateHEX - previousDailyStat.tshareRateHEX);
  var tshareRateUSD           = parseFloat((tshareRateHEX * priceUV2UV3).toFixed(4));

  var date                    = new Date();

  var dailyMintedInflationTotal = (circulatingHEX + stakedHEX) - (previousDailyStat.circulatingHEX + previousDailyStat.stakedHEX);

  var totalHEX = (circulatingHEX + stakedHEX);

  var marketCap = (priceUV2UV3 * circulatingHEX);
  var tshareMarketCap = (tshareRateUSD * totalTshares);
  var tshareMarketCapToMarketCapRatio = parseFloat((tshareMarketCap / marketCap).toFixed(4));

  var roiMultiplierFromATL = (priceUV2UV3 / HEX_PRICE_ALLTIMELOW);

  var totalValueLocked = (priceUV2UV3 * stakedHEX);

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

    // Check if Current Row of Data already exists Again
    var currentDailyStat2 = await DailyStat.findOne({currentDay: { $eq: currentDay }});
    if (!isEmpty(currentDailyStat2)) {
      log('getDailyData() --- WARNING - Current Daily Stat already set Again - Day#: ' + currentDay);
      return;
    }

    dailyStat.save(function (err) {
      if (err) return log(err);
    });

    if (!getRowDataRunning){ getRowData(); }

    if (CONFIG.twitter.enabled) {
      tweet(dailyStat); await sleep(30000);
      tweetBshare(dailyStat);
    }
  } catch (err) {
    log('getDailyData() ----- SAVE --- ' + err.toString() + " - " + err.stack);
  }

  } catch (err) {
    log('getDailyData() ----- ERROR ---' + err.toString() + " - " + err.stack);
  } finally {
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

function log(message){
	console.log(new Date().toISOString() + ", " + message);
}

function isEmpty(obj) {
	for(var prop in obj) {
			if(obj.hasOwnProperty(prop))
					return false;
	}

	return true;
}

function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

function getNum(val) {
  if (isNaN(val)) {
    return 0;
  }
  return val;
}

const objectsEqual = (o1, o2) =>
    Object.keys(o1).length === Object.keys(o2).length 
        && Object.keys(o1).every(p => o1[p] === o2[p]);

const arraysEqual = (a1, a2) => 
   a1.length === a2.length && a1.every((o, idx) => objectsEqual(o, a2[idx]));

function nFormatter(num, digits) {
  try {
      const lookup = [
          { value: 1, symbol: "" },
          { value: 1e3, symbol: "k" },
          { value: 1e6, symbol: "M" },
          { value: 1e9, symbol: "B" },
          { value: 1e12, symbol: "T" }
      ];
      const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
      var item = lookup.slice().reverse().find(function(item) {
          return num >= item.value;
      });

      return { 
          amount: (num / item.value).toFixed(digits).replace(rx, "$1"),
          symbol: item.symbol
      }
  } catch {
      return {
          amount: 0,
          symbol: ''
      };
  }
}

function throttle (callback, limit) {
  var wait = false;                  // Initially, we're not waiting
  return function () {               // We return a throttled function
      if (!wait) {                   // If we're not waiting
          callback.call();           // Execute users function
          wait = true;               // Prevent future invocations
          setTimeout(function () {   // After a period of time
              wait = false;          // And allow future invocations
          }, limit);
      }
  }
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

    return {
      circulatingHEX: parseInt(circulatingSupply),
      stakedHEX: parseInt(lockedHEX),
      totalTshares: parseFloat(totalTshares),
    };
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

async function get_currentHolders(blockNumber) {
  try {
    var { circulatingSupply, currentHolders } = await get_tokenHoldersData_Historical(blockNumber);
    if (currentHolders) { return currentHolders; }
  } catch (error) {
    log(error);
  }
  return 0;
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

async function get_dailyDataUpdatePolling(currentDay) {
  log("get_dailyDataUpdatePolling");

  var count = 0;
  while (true) {
    var { dailyPayoutHEX, totalTshares, success } = await get_dailyDataUpdate(currentDay);
    if (success) { 
      return {
        dailyPayoutHEX,
        totalTshares
      }; 
    }
    await sleep(30000);
    count += 1;
    if (count > 50) {
      return {
        dailyPayoutHEX: -1,
        totalTshares: -1
      };
    }
  }
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

async function get_stakeStartData(){

  var $lastStakeId = 0;
  var stakedDaysSum = 0;
  var stakedCount = 0;
  var stakedHEXSum = 0;
  var weightedAverageSum = 0;

  var count = 0;

  var uniqueAddressList = [];

  while (true) {
    var data = await get_stakeStarts($lastStakeId);
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
    penaltiesSum += parseInt(data.penalty);
    $lastStakeId = data.lastStakeId;

    count += 1;
    await sleep(100);
  }

  var $lastStakeId = 0;

  while (true) {
    var data = await get_stakeGoodAccountings($lastStakeId, unixTimestamp, unixTimestampEnd);
    if (data.count <= 0) { break; }
    stakeCount += data.count;
    penaltiesSum += parseInt(data.penalty);
    $lastStakeId = data.lastStakeId;
    
    count += 1;
    await sleep(100);
  }

  var penaltyString = parseInt(penaltiesSum, 10).toString();
  penaltiesSum = penaltyString.substring(0, penaltyString.length - 8);

  if (isNaN(parseFloat(penaltiesSum))) {
    return 0.0;
  }

  return parseFloat(penaltiesSum);
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


/////////////////////////////////////////////
//// UNISWAP

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
  });
}




/////////////////////////////////////////////
// PRICE

/*
var priceUrl = "https://api.nomics.com/v1/currencies/ticker?key=" + CONFIG.price.nomicsKey + "&ids=HEX";

async function updatePrice(){
	try {
		const resp = await fetch(priceUrl);
		const data = await resp.json();

		if (data && data.length >= 1) {
			var hexData = data[0];
			if (hexData && hexData.price) {
				hexPrice = parseFloat(hexData.price).toFixed(4).toString();
				io.emit("hexPrice", hexPrice);
			}
		}
	} catch (err) {
		log("PRICE --- ERROR - updatePrice() - " + err + "\n" + err.stack);
	}
}
*/




////////////////////////////////////////////////
// ETHEREUM

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



////////////////////////////////////////////////
// HISTORICAL

async function createRow(day){
  var previousDate = new Date();
  var dateOffset = (24*60*60*1000) * 1;

  var rowFind = await DailyStat.findOne({currentDay: { $eq: day - 1}});

  if (!isEmpty(rowFind)) {
    previousDate.setTime(previousDate.getTime() + dateOffset);

    var newRow = new DailyStat({ 
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
    });

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

async function createAllRows(){
  var currentDay = await getCurrentDay();
  var previousDate = new Date();
  var dateOffset = (24*60*60*1000) * 1;

  for (var day = 597; day >= 594; day--) {
    var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});

    if (isEmpty(rowFind)) {
      previousDate.setTime(previousDate.getTime() - dateOffset);

      var newRow = new DailyStat({ 
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
      });

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

    //await sleep(500);
  }
}

async function create_dailyUpdates(){
  log("create_dailyUpdates");
  //var day = 618;
  //var { dailyPayoutHEX, totalTshares, success } = await get_dailyDataUpdate(day);
  //log(dailyPayoutHEX);
  //log(totalTshares);
  //log((dailyPayoutHEX / totalTshares));
  //return;

  try {
  for (var day = 191; day <= 617; day++) {
    var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});
    if (!isEmpty(rowFind)) {
      var { dailyPayoutHEX, totalTshares, success } = await get_dailyDataUpdate(day);
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
  log("ERROR");
  log(error);
}
}

async function create_totalTshareChanges(){
  for (var day = 3; day < 593; day++) {
    var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});
    var rowFind2 = await DailyStat.findOne({currentDay: { $eq: day + 1}});
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

async function create_tshareRateHEXs(){
  log("create_tshareRateHEXs");
  //var { tShareRateHEX } = await get_shareRateChangeByDay(619 - 1);
  //log("CREATE_tshareRateHEX - TEST: " + tShareRateHEX + " ------ " + day);
  //return;
  try {
    var previousValue = 0;
    for (var day = 594; day <= 617; day++) {
      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});
      if (!isEmpty(rowFind)) {
        var { tShareRateHEX } = await get_shareRateChangeByDay(day);

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

async function create_tshareRateHEXIncreases(){
  log("create_tshareRateHEXIncreases");
  try { for (var day = 1; day <= 619; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});
      var rowFind2 = await DailyStat.findOne({currentDay: { $eq: day + 1}});

      if (!isEmpty(rowFind) && !isEmpty(rowFind2)){
        var tshareRateIncrease = parseFloat((rowFind2.tshareRateHEX - rowFind.tshareRateHEX).toFixed(3));
        rowFind2.tshareRateIncrease = tshareRateIncrease;

        log("CREATE_tshareRateIncrease - SAVE: " + tshareRateIncrease + " ------ " + day);
        rowFind2.save(function (err) { if (err) return log("CREATE_tshareRateIncrease - SAVE ERROR: " + err); });
      } else { log("CREATE_tshareRateIncrease- MISSING DAY: " + day); }

      await sleep(100);
    } } catch (error) { log("ERROR"); log(error); }
}

async function update_shiftRowsDown(){
  log("update_shiftRowsDown");
  try {
    var dateOffset = (24*60*60*1000) * 1;

    for (var day = 595; day <= 595; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});

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

async function create_uniswapV2HEXPrice(){
  log("create_uniswapV2HEXPrice");
  //var day = 2;
  //var startTime = day2Epoch + ((day - 2) * 86400)  - 86400;
  //log("startTime - " + startTime);
  //var priceUV2 = await getUniswapV2HEXDailyPriceHistorical(startTime);
  //log("create_uniswapV2HEXPrice - TEST: " + priceUV2 + " ------ " + day + " " + startTime);
  //return;
  try {
    for (var day = 282; day <= 282; day++) {  // Starts on Day 167
      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});
      if (!isEmpty(rowFind)) {
        var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
        var priceUV2 = await getUniswapV2HEXDailyPriceHistorical(startTime);

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

async function create_uniswapV3HEXPrice(){
  log("create_uniswapV3HEXPrice");
  //var day = 596;
  //var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
  //log("startTime - " + startTime);
  //var priceUV3 = await getUniswapV3HEXDailyPriceHistorical(startTime);
  //log("create_uniswapV3HEXPrice - TEST: " + priceUV3 + " ------ " + day + " " + startTime);
  //return;
  try {
    for (var day = 526; day <= 530; day++) {  // Starts on Day 522
      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});
      if (!isEmpty(rowFind)) {
        var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
        var priceUV3 = await getUniswapV3HEXDailyPriceHistorical(startTime);

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

async function createUV2UV3Liquidity(){
  log("createUV2UV3Liquidity");

  //var day = 597;
  //var blockNumber = await getEthereumBlock(day)
  //log("blockNumber - " + blockNumber);
  //var { liquidityUV3_HEX, liquidityUV3_USDC, liquidityUV3_ETH } = await getUniswapV3Historical(blockNumber);
  //log("createUV2UV3Liquidity - " + liquidityUV3_HEX + " liquidityUV3_USDC - " + liquidityUV3_USDC + " liquidityUV3_ETH - " + liquidityUV3_ETH);

  //var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
  //log("startTime - " + startTime);
  //var { liquidityUV2_HEXUSDC, liquidityUV2_USDC } = await getUniswapV2HEXUSDCHistorical(startTime);
  //var { liquidityUV2_HEXETH, liquidityUV2_ETH } = await getUniswapV2HEXETHHistorical(startTime);
  //log("createUV2UV3Liquidity - SAVE: " + startTime.toString() + " - HEXUSDC " + liquidityUV2_HEXUSDC  + " - USDC " + liquidityUV2_USDC + " ------ " + day);
  //log("createUV2UV3Liquidity - SAVE: " + startTime.toString() + " - HEXETH " + liquidityUV2_HEXETH  + " - ETH " + liquidityUV2_ETH + " ------ " + day);

  //log("COMBINED - HEX - " + (liquidityUV3_HEX + liquidityUV2_HEXUSDC + liquidityUV2_HEXETH) + " USDC - " + (liquidityUV3_USDC + liquidityUV2_USDC) + " ETH - " + (liquidityUV3_ETH + liquidityUV2_ETH));
  //return;
  try {
    for (var day = 314; day <= 314; day++) {  // Starts on Day 167 End 595
      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});
      if (!isEmpty(rowFind)) {
        // UV2
        var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
        
        var { liquidityUV2_HEXUSDC, liquidityUV2_USDC } = await getUniswapV2HEXUSDCHistorical(startTime);
        sleep(700);
        var { liquidityUV2_HEXETH, liquidityUV2_ETH } = await getUniswapV2HEXETHHistorical(startTime);
        sleep(300);

        rowFind.liquidityUV2_HEXUSDC = liquidityUV2_HEXUSDC;
        rowFind.liquidityUV2_USDC = liquidityUV2_USDC;
        rowFind.liquidityUV2_HEXETH = liquidityUV2_HEXETH;
        rowFind.liquidityUV2_ETH = liquidityUV2_ETH;

        // UV3
        var blockNumber = await getEthereumBlock(day)

        var { liquidityUV3_HEX, liquidityUV3_USDC, liquidityUV3_ETH } = await getUniswapV3Historical(blockNumber);

        rowFind.liquidityUV3_HEX = liquidityUV3_HEX;
        rowFind.liquidityUV3_USDC = liquidityUV3_USDC;
        rowFind.liquidityUV3_ETH = liquidityUV3_ETH;

        // Calculated
        rowFind.liquidityUV2UV3_HEX = (liquidityUV2_HEXUSDC + liquidityUV2_HEXETH + liquidityUV3_HEX);
        rowFind.liquidityUV2UV3_USDC = (liquidityUV2_USDC + liquidityUV3_USDC);
        rowFind.liquidityUV2UV3_ETH = (liquidityUV2_ETH + liquidityUV3_ETH);

        log("COMBINED - HEX - " + (rowFind.liquidityUV2UV3_HEX) + " USDC - " + (rowFind.liquidityUV2UV3_USDC) + " ETH - " + (rowFind.liquidityUV2UV3_ETH));
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

async function create_uniswapV2V3CombinedHEXPrice(){
  log("create_uniswapV2V3CombinedHEXPrice");
  //var day = 2;
  //var startTime = day2Epoch + ((day - 2) * 86400)  - 86400;
  //log("startTime - " + startTime);
  //var priceUV2 = await getUniswapV2HEXDailyPriceHistorical(startTime);
  //log("create_uniswapV2HEXPrice - TEST: " + priceUV2 + " ------ " + day + " " + startTime);
  //return;
  try {
    for (var day = 282; day <= 282; day++) {  // Starts on Day 167
      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});
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

async function create_priceChangeUV2UV3s(){
  log("create_priceChangeUV2UV3s");
  try {
    for (var day = 166; day <= 167; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});
      sleep(100);
      var rowFind2 = await DailyStat.findOne({currentDay: { $eq: day + 1}});

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

async function create_tshareRateUSDs(){
  log("create_tshareRateUSDs");
  try {
    for (var day = 14; day <= 167; day++) { //167
      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});
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

async function create_roiMultiplierFromATLs(){
  log("create_roiMultiplierFromATLs");
  try {
    for (var day = 14; day <= 167; day++) { //167
      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});
      if (!isEmpty(rowFind)) {

        if (rowFind.priceUV2UV3) {
          rowFind.roiMultiplierFromATL = (rowFind.priceUV2UV3 / HEX_PRICE_ALLTIMELOW);
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

async function create_uniswapV1PriceAndLiquidityHistorical(){
  log("create_uniswapV1PriceAndLiquidityHistorical");
  //var day = 596;
  //var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
  //log("startTime - " + startTime);
  //var priceUV3 = await getUniswapV3HEXDailyPriceHistorical(startTime);
  //log("create_uniswapV3HEXPrice - TEST: " + priceUV3 + " ------ " + day + " " + startTime);
  //return;
  try {
    for (var day = 167; day <= 300; day++) {  // Starts on Day 522 14 167
      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});
      if (!isEmpty(rowFind)) {
        var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
        var { tokenPriceUSD, tokenBalance, ethBalance } = await getUniswapV1PriceAndLiquidityHistorical(startTime);

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

/////////////////////////////////////////////////////////////

async function create_stakeStartsHistorical(){
  getStakeStartHistorical = true;
  log("create_stakeStartsHistorical");
  //var day = 596;
  //var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
  //log("startTime - " + startTime);
  //var priceUV3 = await getUniswapV3HEXDailyPriceHistorical(startTime);
  //log("create_uniswapV3HEXPrice - TEST: " + priceUV3 + " ------ " + day + " " + startTime);
  //return;
  
    for (var day = 1; day <= 643; day++) {
      try {
        var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});
        if (!isEmpty(rowFind)) {
          var blockNumber = await getEthereumBlock(day)
          var { averageStakeLength, uniqueStakerCount, stakedHEX } = await get_stakeStartDataHistorical(blockNumber);

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

async function get_stakeStartDataHistorical(blockNumber){

  var $lastStakeId = 0;
  var stakedDaysSum = 0;
  var stakedCount = 0;
  var uniqueAddressList = [];
  var stakedHEXSum = 0;
  var weightedAverageSum = 0;

  while (true) {
    var data = await get_stakeStartsHistorical($lastStakeId, blockNumber);
    if (data.count <= 0) { break; }
    stakedCount += data.count;
    stakedDaysSum += data.stakedDaysSum;
    $lastStakeId = data.lastStakeId;
    uniqueAddressList = uniqueAddressList.concat(data.uniqueAddresses);
    stakedHEXSum += data.stakedHEX;
    weightedAverageSum += data.weightedAverageSum;

    log($lastStakeId);
    await sleep(250);
  }

  var averageStakeLength = 0.0;
  var averageStakeLengthYears = 0.0;

  if (stakedCount && stakedDaysSum ) {
    averageStakeLength = stakedDaysSum/stakedCount;
    averageStakeLengthYears = averageStakeLength / 365.0;
  } 

  var averageStakeLengthWeighted = 0.0;
  var averageStakeLengthWeightedYears = 0.0

  if (stakedCount && weightedAverageSum && stakedHEXSum) {
    averageStakeLengthWeighted = weightedAverageSum / stakedHEXSum;
    averageStakeLengthWeightedYears = averageStakeLengthWeighted / 365.0;
  }

  uniqueAddressCount = (new Set(uniqueAddressList)).size;

  return {
    averageStakeLength: averageStakeLengthWeightedYears, //parseFloat(averageStakeLengthYears.toFixed(2)),
    uniqueStakerCount: uniqueAddressCount,
    stakedHEX: stakedHEXSum,
  }
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

async function create_stakedSupplyChanges(){
  log("create_stakedSupplyChanges");
  try { for (var day = 1; day <= 595; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}}); sleep(100);
      var rowFind2 = await DailyStat.findOne({currentDay: { $eq: day + 1}});

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
    } } catch (error) { log("ERROR"); log(error); }
}

async function create_currentStakerCountChanges(){
  log("create_currentStakerCountChanges");
  try { for (var day = 1; day <= 595; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}}); sleep(100);
      var rowFind2 = await DailyStat.findOne({currentDay: { $eq: day + 1}});

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
    } } catch (error) { log("ERROR"); log(error); }
}

async function create_tshareMarketCaps(){
  log("create_tshareMarketCaps");
  try { for (var day = 13; day <= 595; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});

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
    } } catch (error) { log("ERROR"); log(error); }
}

async function create_totalValueLockeds(){
  log("create_totalValueLockeds");
  try { for (var day = 40; day <= 595; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});

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
    } } catch (error) { log("ERROR"); log(error); }
}

async function create_actualAPYRates(){
  log("create_actualAPYRates");
  try { for (var day = 1; day <= 595; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});

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
    } } catch (error) { log("ERROR"); log(error); }
}

/////////////////////////////////////////

async function create_stakeEnds_stakeGoodAccountings_Historical(){
  getStakeStartHistorical = true;
  log("create_stakeEnds_stakeGoodAccountings_Historical");
    for (var day = 596; day <= 596; day++) {
      try {
        var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});
        if (!isEmpty(rowFind)) {
          
          var penaltiesHEX = await get_dailyPenalties_Historical(day);

          rowFind.penaltiesHEX = penaltiesHEX;

          log("create_stakeEnds_stakeGoodAccountings_Historical - SAVE: " + " - " + penaltiesHEX + " ------ " + day);
          rowFind.save(function (err) { if (err) return log("create_stakeEnds_stakeGoodAccountings_Historical - SAVE ERROR: " + err);});
        } else { log("create_stakeEnds_stakeGoodAccountings_Historical - MISSING DAY: " + day);  }
      
        await sleep(100);

      } catch (error) {log("ERROR"); log(error);
        sleep(1000);
        day--;
      }
    }

    getStakeStartHistorical = false;
}

async function get_dailyPenalties_Historical(day){

  var $lastStakeId = 0; 
  var penaltiesSum = 0;
  var stakeCount = 0;
  var count = 0;

  var startTime = day2Epoch + ((day - 2) * 86400) - 86400;
  var endTime = startTime + 86400;

  //var start = new Date();
  //start.setUTCHours(0, 0, 0, 0);
  //if (yesterday) { start.setDate(start.getDate()-1); }
  //var unixTimestamp = (start.valueOf() / 1000);
  //console.log(start);

  //var end = new Date();
  //end.setUTCHours(23, 59, 59, 999);
  //if (yesterday) { end.setDate(end.getDate()-1); }
  //var unixTimestampEnd = (end.valueOf() / 1000);
  //console.log(end);

  var blockNumber = await getEthereumBlock(day + 1);
  //log("blockNumber - " + blockNumber + " startTime - " + startTime + " endTime - " + endTime);

  while (true) {
    var data = await get_stakeEnds_Historical(blockNumber, $lastStakeId, startTime, endTime);
    if (data.count <= 0) { break; }
    stakeCount += data.count;
    penaltiesSum += parseInt(data.penalty);
    $lastStakeId = data.lastStakeId;

    //log("get_stakeEnds_Historical");
    count += 1;
    await sleep(100);
  }

  var $lastStakeId = 0;

  while (true) {
    var data = await get_stakeGoodAccountings_Historical(blockNumber, $lastStakeId, startTime, endTime);
    if (data.count <= 0) { break; }
    stakeCount += data.count;
    penaltiesSum += parseInt(data.penalty);
    $lastStakeId = data.lastStakeId;
    
    //log("get_stakeGoodAccountings_Historical");
    count += 1;
    await sleep(100);
  }

  if (penaltiesSum > 0) {
    var penaltyString = parseInt(penaltiesSum, 10).toString();
    penaltiesSum = penaltyString.substring(0, penaltyString.length - 8);
    return parseFloat(penaltiesSum);
  }

  return penaltiesSum;
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

//////////////////////////////////////////////

async function create_numberOfHolders(){
  log("create_numberOfHolders");
  try { for (var day = 591; day <= 595; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});

      if (!isEmpty(rowFind)){
        var blockNumber = await getEthereumBlock(day + 1);
        sleep(100);
        var numberOfHolders = await get_numberOfHolders_Historical(blockNumber);
        if (numberOfHolders) {
          rowFind.numberOfHolders = numberOfHolders;
        } else {
          rowFind.numberOfHolders = 0;
        }

        log("create_numberOfHolders - SAVE: " + rowFind.numberOfHolders + " ------ " + day);
        rowFind.save(function (err) { if (err) return log("create_numberOfHolders - SAVE ERROR: " + err);});
      } else { log("create_numberOfHolders- MISSING DAY: " + day); }
      
      await sleep(200);
    } } catch (error) { log("ERROR"); log(error); }
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

async function create_numberOfHoldersChanges(){
  log("create_numberOfHoldersChanges");
  try { for (var day = 2; day <= 595; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}}); sleep(100);
      var rowFind2 = await DailyStat.findOne({currentDay: { $eq: day + 1}});

      if (!isEmpty(rowFind) && !isEmpty(rowFind2)){
        if (rowFind.numberOfHolders && rowFind2.numberOfHolders) {
          rowFind2.numberOfHoldersChange = rowFind2.numberOfHolders - getNum(rowFind.numberOfHolders);
        } else if (!rowFind.numberOfHolders && rowFind2.numberOfHolders) {
          rowFind2.numberOfHoldersChange = rowFind2.numberOfHolders;
        }else {
          rowFind2.numberOfHoldersChange = 0.0;
        }

        log("create_numberOfHoldersChanges - SAVE: " + rowFind2.numberOfHoldersChange + " ------ " + day);
        rowFind2.save(function (err) { if (err) return log("create_numberOfHoldersChanges - SAVE ERROR: " + err);});
      } else { log("create_numberOfHoldersChanges- MISSING DAY: " + day); }
      
      await sleep(100);
    } } catch (error) { log("ERROR"); log(error); }
}

async function create_currentHoldersChanges(){
  log("create_currentHoldersChanges");
  try { for (var day = 1; day <= 652; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}}); sleep(100);
      var rowFind2 = await DailyStat.findOne({currentDay: { $eq: day + 1}});

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
    } } catch (error) { log("ERROR"); log(error); }
}


//////////////////////////////////////////////

async function create_circulatingSupplys(){
  log("create_circulatingSupplys");
  for (var day = 1; day <= 595; day++) {
    try { 
      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});

      if (!isEmpty(rowFind)){
        var blockNumber = await getEthereumBlock(day);
        await sleep(300);
        var { circulatingSupply, currentHolders } = await get_tokenHoldersData_Historical(blockNumber);
        if (circulatingSupply) { rowFind.circulatingHEX = circulatingSupply; } else { rowFind.circulatingHEX = 0; }
        if (currentHolders) { rowFind.currentHolders = currentHolders; } else { rowFind.currentHolders = 0; }

        log("create_circulatingSupplys - SAVE: " + rowFind.circulatingHEX + " -- " + rowFind.currentHolders + " ------ " + day);
        rowFind.save(function (err) { if (err) return log("create_circulatingSupplys - SAVE ERROR: " + err);});
      } else { log("create_circulatingSupplys- MISSING DAY: " + day); }
      
      await sleep(500);
    } catch (error) { log("ERROR"); log(error); await sleep(30000); day--; }
  }
}

async function get_tokenHoldersData_Historical(blockNumber){
  var $lastNumeralIndex = 0;
  var circulatingSum = 0;
  var count = 0;
  var uniqueAddressList = [];
  var uniqueAddressCount = 0;

  while (true) {
    var data = undefined;
    var retrieveCount = 0;
    while (true) {
      try {
        data = await get_tokenHolders_Historical(blockNumber, $lastNumeralIndex);
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

//////////////////////////////////////////////

async function create_totalHEXs(){
  log("create_totalHEXs");
  try { for (var day = 1; day <= 595; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});

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
    } } catch (error) { log("ERROR"); log(error); }
}

async function create_stakedHEXPercents(){
  log("create_stakedHEXPercents");
  try { for (var day = 1; day <= 595; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});

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
    } } catch (error) { log("ERROR"); log(error); }
}

async function create_marketCaps(){
  log("create_marketCaps");
  try { for (var day = 1; day <= 595; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});

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
    } } catch (error) { log("ERROR"); log(error); }
}

async function create_circulatingSupplyChanges(){
  log("create_circulatingSupplyChanges");
  try { for (var day = 1; day <= 595; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}}); sleep(100);
      var rowFind2 = await DailyStat.findOne({currentDay: { $eq: day + 1}});

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
    } } catch (error) { log("ERROR"); log(error); }
}

async function create_dailyMintedInflationTotals(){
  log("create_dailyMintedInflationTotals");
  try { for (var day = 1; day <= 595; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}}); sleep(100);
      var rowFind2 = await DailyStat.findOne({currentDay: { $eq: day + 1}});

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
    } } catch (error) { log("ERROR"); log(error); }
}

/////////////////////////////////////////////////

async function update_shiftCirculatingSupply(){
  log("update_shiftCirculatingSupply");
  try {
    var dateOffset = (24*60*60*1000) * 1;

    for (var day = 594; day > 1; day--) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});
      var rowFind2 = await DailyStat.findOne({currentDay: { $eq: day + 1}});

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

/////////////////////////////////////////////////
// StakeStarts GoodAccounting (GA)

async function create_stakeStartGAsHistorical(){
  getStakeStartGAHistorical = true;
  log("create_stakeStartGAsHistorical");
  for (var day = 623; day <= 623; day++) {  try {
        var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});
        if (!isEmpty(rowFind)) {
          var blockNumber = await getEthereumBlock(day)
          var { stakedHEXGA } = await get_stakeStartGADataHistorical(blockNumber);

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

async function get_stakeStartGADataHistorical(blockNumber){
  var $lastStakeId = 0;
  //var stakedDaysSum = 0;
  //var stakedCount = 0;
  //var uniqueAddressList = [];
  var stakedHEXGASum = 0;

  while (true) {
    var data = await get_stakeStartGAsHistorical($lastStakeId, blockNumber);
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

// stakedHEXGAChange
async function create_stakedSupplyGAChanges(){
  log("create_stakedSupplyGAChanges");
  try { for (var day = 1; day <= 621; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}}); sleep(100);
      var rowFind2 = await DailyStat.findOne({currentDay: { $eq: day + 1}});

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
    } } catch (error) { log("ERROR"); log(error); }
}

async function update_stakedSupplyWithGA(){
  log("update_stakedSupplyWithGA");
  try { for (var day = 12; day <= 595; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}}); sleep(100);

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
    } } catch (error) { log("ERROR"); log(error); }
}

////////////////////////////////////////////////

async function create_stakeStartsCountHistorical(){
  getStakeStartsCountHistorical= true;
  log("create_stakeStartsCountHistorical");
  for (var day = 515; day <= 619; day++) {  try { // 515 - 619
        var rowFind = await DailyStat.findOne({currentDay: { $eq: day}});
        if (!isEmpty(rowFind)) {
          var blockNumber = await getEthereumBlock(day)
          var { uniqueStakerCount } = await getAll_stakeStartsCountHistorical(blockNumber);

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


async function get_stakeStartsCountHistorical(day){
  console.log("get_stakeStartsCountHistorical");
      try {
      		console.log("Day: " + day);
          var blockNumber = await getEthereumBlock(day);
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
    var data = await get_stakeStartsCountHistoricalBlock($lastStakeId, blockNumber);
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

async function create_totalStakerCountChanges(){
  log("create_totalStakerCountChanges");
  try { for (var day = 1; day <= 625; day++) {

      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}}); sleep(100);
      var rowFind2 = await DailyStat.findOne({currentDay: { $eq: day + 1}});

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
    } } catch (error) { log("ERROR"); log(error); }
}




////////////////////////////////////////////
// Copy Columns

async function copyColumns(){
  log("copyColumns");
  try { for (var day = 1; day <= 647; day++) {
      var rowFind = await DailyStat.findOne({currentDay: { $eq: day}}); sleep(100);

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
    } } catch (error) { log("ERROR"); log(error); }
}


///////////////////////////////////////////////////
// CURRENCY RATES

async function getCurrencyRates(){
  var url = "http://api.exchangeratesapi.io/v1/latest?access_key=" + CONFIG.exchangerates.key + "&format=1"; // + "&base=" + base; // Paid Plan
  return await fetchRetry(url, {
    method: 'GET',
    highWaterMark: FETCH_SIZE,
    headers: { 'Content-Type': 'application/json' }
  })
  .then(res => res.json())
  .then(res => {
    if (res && res.success && res.rates) {
      return res.rates;
    }
    return undefined;
  });
}

///////////////////////////////////////////////////
// TWITTER

/* 
ds.currentDay, ds.date, 
2 ds.priceUV2UV3, ds.priceChangeUV2UV3, ds.roiMultiplierFromATL,
5 ds.payoutPerTshareHEX, ds.tshareRateUSD, ds.tshareRateHEX, ds.tshareRateIncrease,
9 ds.averageStakeLength, ds.actualAPYRate,
11 ds.liquidityUV2UV3_HEX, ds.liquidityUV2UV3_USDC, ds.liquidityUV2UV3_ETH,
14 ds.totalValueLocked, ds.marketCap, ds.tshareMarketCap,
17 ds.totalTshares, ds.totalTsharesChange,
19 ds.totalHEX, ds.dailyMintedInflationTotal,
21 ds.circulatingHEX, ds.circulatingSupplyChange,
23 ds.stakedHEX, ds.stakedSupplyChange, ds.stakedHEXGA, ds.stakedHEXGAChange, ds.stakedHEXPercent,
28 ds.dailyPayoutHEX, ds.penaltiesHEX,
30 ds.numberOfHolders, ds.numberOfHoldersChange,
32 ds.currentStakerCount, ds.currentStakerCountChange,
34 ds.totalStakerCount, ds.totalStakerCountChange,
36 ds.currentHolders, ds.currentHoldersChange
*/

const twitterAPI = require('twitter-api-client');

var twitterClient = undefined;
if (CONFIG.twitter.enabled){
twitterClient = new twitterAPI.TwitterClient({
	apiKey: CONFIG.twitter.apiKey,
	apiSecret: CONFIG.twitter.apiSecret,
  accessToken: CONFIG.twitter.accessToken,
  accessTokenSecret: CONFIG.twitter.accessTokenSecret,
});}

async function tweet(dailyStat){
  console.log("tweet()");
	if (CONFIG.twitter.enabled && !DEBUG && dailyStat){
	try {
    console.log("tweet() ---- ENABLED");
	var mediaId = ''; 
  var tweetStatus = "";

  //tweetStatus += "Day " + dailyStat.currentDay + "\r\n";
	//tweetStatus += "\r\n";

  tweetStatus += "HEX Price - $" + Number(dailyStat.priceUV2UV3).toLocaleString(undefined,{minimumFractionDigits:3, maximumFractionDigits:3}) + "\r\n";
  //tweetStatus += "ROI - " + Number(dailyStat.roiMultiplierFromATL).toLocaleString(undefined,{minimumFractionDigits:0, maximumFractionDigits:0}) + "x\r\n";
  tweetStatus += "\r\n";

  tweetStatus += "Tshare Price - $" + Number(dailyStat.tshareRateUSD).toLocaleString(undefined,{minimumFractionDigits:0, maximumFractionDigits:0}) + "\r\n";
  tweetStatus += "Tshare Rate - " + Number(dailyStat.tshareRateHEX).toLocaleString(undefined,{minimumFractionDigits:0, maximumFractionDigits:0}) + " HEX\r\n";
  tweetStatus += "Payout Per Tshare - " + Number(dailyStat.payoutPerTshareHEX).toLocaleString(undefined,{minimumFractionDigits:3, maximumFractionDigits:3}) + " HEX\r\n";
  tweetStatus += "\r\n";

  tweetStatus += "Avg Stake Length - " + Number(dailyStat.averageStakeLength).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}) + " yrs\r\n";
  //tweetStatus += "APY Rate - " + Number(dailyStat.actualAPYRate).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}) + "%\r\n";
  tweetStatus += "\r\n";

  var {amount, symbol} = nFormatter(dailyStat.liquidityUV2UV3_HEX, 1);
  tweetStatus += "HEX Liquidity - " + Number(amount).toLocaleString(undefined) + symbol + "\r\n";
  var liquidityUSDCFormatted = nFormatter(dailyStat.liquidityUV2UV3_USDC, 1);
  tweetStatus += "USDC Liquidity - " + Number(liquidityUSDCFormatted.amount).toLocaleString(undefined) + liquidityUSDCFormatted.symbol + "\r\n";
  tweetStatus += "\r\n";

  tweetStatus += "Current Holders - " + Number(dailyStat.currentHolders).toLocaleString(undefined) + " (+" + Number(dailyStat.currentHoldersChange).toLocaleString(undefined) + ")" + "\r\n";
  tweetStatus += "Current Stakers - " + Number(dailyStat.currentStakerCount).toLocaleString(undefined) + " (+" + Number(dailyStat.currentStakerCountChange).toLocaleString(undefined) + ")" + "\r\n";
  //tweetStatus += "Total Holders - " + Number(dailyStat.numberOfHolders).toLocaleString(undefined) + " (+" + Number(dailyStat.numberOfHoldersChange).toLocaleString(undefined) + ")" + "\r\n";
  //tweetStatus += "Total Stakers - " + Number(dailyStat.totalStakerCount).toLocaleString(undefined) + " (+" + Number(dailyStat.totalStakerCountChange).toLocaleString(undefined) + ")" + "\r\n";
  tweetStatus += "\r\n";

  tweetStatus += "#HEX $HEX #Tshare";

  console.log("tweetStats ----------");
  console.log(tweetStatus);
	// https://developer.twitter.com/en/docs/twitter-api/v1/tweets/post-and-engage/api-reference/post-statuses-update
	const data = await twitterClient.tweets.statusesUpdate({ 
		status: tweetStatus,
		media_ids: mediaId
	});
	log('TWITTER - TWEET'); // + JSON.stringify(data));
  return;

	} catch (err){
		log('TWITTER - ERROR: ');
    console.log(err);
	}
	}

	return '';
}

async function tweetBshare(dailyStat){
  console.log("tweetBshare()");
	if (CONFIG.twitter.enabled && !DEBUG && dailyStat){
	try {
    console.log("tweetBshare() ---- ENABLED");
	var mediaId = ''; 
  var tweetStatus = "";

  //tweetStatus += "Day " + dailyStat.currentDay + "\r\n";
	//tweetStatus += "\r\n";

  tweetStatus += "HEX Price - $" + Number(dailyStat.priceUV2UV3).toLocaleString(undefined,{minimumFractionDigits:3, maximumFractionDigits:3}) + "\r\n";
  //tweetStatus += "ROI - " + Number(dailyStat.roiMultiplierFromATL).toLocaleString(undefined,{minimumFractionDigits:0, maximumFractionDigits:0}) + "x\r\n";
  tweetStatus += "\r\n";

  //tweetStatus += "Tshare Price - $" + Number(dailyStat.tshareRateUSD).toLocaleString(undefined,{minimumFractionDigits:0, maximumFractionDigits:0}) + "\r\n";
  //tweetStatus += "Payout Per Tshare - " + Number(dailyStat.payoutPerTshareHEX).toLocaleString(undefined,{minimumFractionDigits:3, maximumFractionDigits:3}) + "\r\n";
  //tweetStatus += "\r\n";
  tweetStatus += "Bshare Price - $" + Number(dailyStat.tshareRateUSD / 1000.0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}) + "\r\n";
  tweetStatus += "Bshare Rate - " + Number(dailyStat.tshareRateHEX  / 1000.0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}) + " HEX\r\n";
  tweetStatus += "Payout Per Bshare - " + Number(dailyStat.payoutPerTshareHEX  / 1000.0).toLocaleString(undefined,{minimumFractionDigits:5, maximumFractionDigits:5}) + " HEX\r\n";
  tweetStatus += "\r\n";

  //tweetStatus += "Avg Stake Length - " + Number(dailyStat.averageStakeLength).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}) + " yrs\r\n";
  //tweetStatus += "APY Rate - " + Number(dailyStat.actualAPYRate).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}) + "%\r\n";
  //tweetStatus += "\r\n";

  //var {amount, symbol} = nFormatter(dailyStat.liquidityUV2UV3_HEX, 1);
  //tweetStatus += "HEX Liquidity - " + Number(amount).toLocaleString(undefined) + symbol + "\r\n";
  //var liquidityUSDCFormatted = nFormatter(dailyStat.liquidityUV2UV3_USDC, 1);
  //tweetStatus += "USDC Liquidity - " + Number(liquidityUSDCFormatted.amount).toLocaleString(undefined) + liquidityUSDCFormatted.symbol + "\r\n";
  //tweetStatus += "\r\n";

  tweetStatus += "Current Holders - " + Number(dailyStat.currentHolders).toLocaleString(undefined) + " (+" + Number(dailyStat.currentHoldersChange).toLocaleString(undefined) + ")" + "\r\n";
  tweetStatus += "Current Stakers - " + Number(dailyStat.currentStakerCount).toLocaleString(undefined) + " (+" + Number(dailyStat.currentStakerCountChange).toLocaleString(undefined) + ")" + "\r\n";
  //tweetStatus += "Total Holders - " + Number(dailyStat.numberOfHolders).toLocaleString(undefined) + " (+" + Number(dailyStat.numberOfHoldersChange).toLocaleString(undefined) + ")" + "\r\n";
  //tweetStatus += "Total Stakers - " + Number(dailyStat.totalStakerCount).toLocaleString(undefined) + " (+" + Number(dailyStat.totalStakerCountChange).toLocaleString(undefined) + ")" + "\r\n";
  tweetStatus += "\r\n";

  tweetStatus += "#HEX $HEX #Bshare";

  console.log("tweetBshare - tweetStatus ----------");
  console.log(tweetStatus);
	// https://developer.twitter.com/en/docs/twitter-api/v1/tweets/post-and-engage/api-reference/post-statuses-update
	const data = await twitterClient.tweets.statusesUpdate({ 
		status: tweetStatus,
		media_ids: mediaId
	});
	log('TWITTER - tweetBshare - TWEET'); // + JSON.stringify(data));
  return;

	} catch (err){
		log('TWITTER - tweetBshare - ERROR: ');
    console.log(err);
	}
	}

	return '';
}