const MongoDb = require('./Services/MongoDB'); 
const TheGraph = require('./Services/TheGraph'); 
const Coingecko = require('./Services/Coingecko'); 
const Twitter = require('./Services/Twitter'); 
const Etherscan = require('./Services/Etherscan'); 
const h = require('./Helpers/helpers'); 

const fetchRetry = h.fetchRetry;
const FETCH_SIZE = h.FETCH_SIZE;
const sleep = h.sleep;
const log = h.log;
const CONFIG = h.CONFIG; 
var DEBUG = CONFIG.debug;

const http = require('http');
require('es6-promise').polyfill();
 
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const schedule = require('node-schedule');
var cors = require('cors');

const { JSDOM } = require( "jsdom" );
const { window } = new JSDOM( "" );
const $ = require( "jquery" )( window );

var getRowData = async () => {
  returnPackage = await MongoDb.getRowData(); 
  
  rowData = returnPackage.rowData;
  rowDataObjects = returnPackage.rowDataObjects;

  hexSiteData = await buildHexSiteData(rowDataObjects); 
  io.emit("rowData", rowData);
}
  
const HEX_PRICE_ALLTIMELOW = 0.00005645;

var rowData = undefined;
var rowDataObjects = undefined;
var getDataRunning = false;
var getRowDataRunning = false;
var connections = {};
var hexPrice = '';
var currentDayGlobal = 0;
var getLiveDataRUNNING = false;
var liveData = undefined;
var currencyRates = undefined;
var getCurrencyDataRunning = false;
var getAndSet_currentGlobalDay_Running = false;
var hexSiteData = undefined;
var getEthereumDataRUNNING = false;
var ethereumData = undefined;
var DailyStat = MongoDb.DailyStat;
var Connection = MongoDb.Connection;

let getMongoData = async () => { 
  getRowDataPackage = await MongoDb.getRowData();
  rowData = getRowDataPackage.rowData;
  rowDataObjects = getRowDataPackage.rowDataObjects;
}; getMongoData();
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
    var currentDay = await Etherscan.getCurrentDay() + 1;
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
  if (rowDataObjects) { res.send(JSON.parse(JSON.stringify(rowDataObjects))); } else {res.status(404).send({ error: "fullData not populated yet" });};
});

app.get('/livedata', cors(), function (req, res) {
  if (liveData) { res.send(JSON.parse(JSON.stringify(liveData))); } else {res.status(404).send({ error: "liveData not populated yet" });};
});

app.get('/hexsite', cors(), function (req, res) {
  if (hexSiteData) {
    try {
      res.send(JSON.parse(JSON.stringify(hexSiteData)));
    } catch (error) {
      log("/hexsite");
      log(error);
    }
  } 
  else {res.status(404).send({ error: "hexsite not populated yet" });};
});

async function buildHexSiteData(rowDataObjects){
  if (rowDataObjects) { 
    try {
      var highestTshareRateUSD = Math.max.apply(Math, rowDataObjects.map(function(a) { return a.tshareRateUSD; }))

      var prices = rowDataObjects.map(a => a.priceUV2UV3).reverse();

      var pricesBitcoin = await Coingecko.getPriceHistory_Bitcoin(currentDayGlobal); await sleep(500);
      var pricesEthereum = await Coingecko.getPriceHistory_Ethereum(currentDayGlobal); await sleep(500);
      var pricesGold = await Coingecko.getPriceHistory_Gold(currentDayGlobal); await sleep(500);

      var priceHistory = {
        btc: pricesBitcoin,
        eth: pricesEthereum,
        gold: pricesGold
      }

      var priceATH = await Coingecko.getPriceAllTimeHigh(); //await sleep(300);

      var json = {
        averageStakeLength: rowDataObjects[0].averageStakeLength,
        numberOfHolders: rowDataObjects[0].numberOfHolders,
        numberOfHoldersChange: rowDataObjects[0].numberOfHoldersChange,
        currentStakerCount: rowDataObjects[0].currentStakerCount,
        currentStakerCountChange: rowDataObjects[0].currentStakerCountChange,
        totalValueLocked: rowDataObjects[0].totalValueLocked,

        stakedHEX: liveData ? liveData.stakedHEX : rowDataObjects[0].stakedHEX,
        circulatingHEX: liveData ? liveData.circulatingHEX : rowDataObjects[0].circulatingHEX,

        tshareRateUSD_Highest: highestTshareRateUSD,

        priceATH: priceATH,

        priceUV2UV3_Array: prices,
        priceHistory: priceHistory,
      }

      return json;
    } catch (error) {
      log("buildHexSiteData()");
      log(error);
    }
  } else {
    log("buildHexSiteData() - rowDataObjects not ready");
  }
}

async function grabData() {
  if (!getLiveDataRUNNING){ await runLiveData(); }
  if (!getCurrencyDataRunning){ getCurrencyData(); };
  if (!getRowDataRunning){ getRowData(); }
  if (!getDataRunning){ await getDailyData(); }
  if (!getEthereumDataRUNNING){ runEthereumData(); }
}

httpServer.listen(httpPort, hostname, () => { log(`Server running at http://${hostname}:${httpPort}/`);});
if(!DEBUG){ httpsServer.listen(httpsPort, hostname, () => { 
    log('listening on *:' + httpsPort); 
    grabData(); 
  });
}

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
  socket.emit("ethereumData", ethereumData);

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

//if (CONFIG.price.enabled) {
//	var priceTimer = CONFIG.price.timer * 60 * 1000;
//	setInterval(function() {
//		updatePrice();
//	}, priceTimer); }

var jobLive = schedule.scheduleJob("*/1 * * * *", function() { 
  getAllLiveData();
});

async function getAllLiveData(){
  await runLiveData();
  await runEthereumData();
}

var jobLive15 = schedule.scheduleJob("*/15 * * * *", function() { 
  getHexSiteData();
});

async function getHexSiteData(){
  if (rowDataObjects) { hexSiteData = await buildHexSiteData(rowDataObjects); }
}


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

async function runEthereumData() {
  try {
  await sleep(300);
  if (!getDataRunning && !getEthereumDataRUNNING){
    var ethereumDataNew = await getEthereumData();
    //console.log(ethereumDataNew);
    if (ethereumDataNew && (JSON.stringify(ethereumDataNew) !== JSON.stringify(ethereumData))){
      ethereumData = ethereumDataNew;
      io.emit("ethereumData", ethereumData);
    }
  }
  } catch (error){
    log("runEthereumData() --- ERROR --- " + error.toString());
  } finally {
    getEthereumDataRUNNING = false;
  }
}

async function getEthereumData() {
  getEthereumDataRUNNING = true;
  log("getEthereumData()");
  try {
  if (!getDataRunning){
    var price = await Etherscan.getEthereumPrice(); await sleep(2000);
    var {low, average, high} = await Etherscan.getGas(); await sleep(1000);
    
    return {
      price: price,
      erc20transfer: (average * 65000 / 1000000000 * price),
      uniswapSwap: (average * 200000 / 1000000000 * price),
      addLiquidity: (average * 175000 / 1000000000 * price),
    };
  }
  } catch (error){
    log("getEthereumData() --- ERROR --- " + error.toString());
  } finally {
    getEthereumDataRUNNING = false;
  }
}
 
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
    var priceUV2 = await TheGraph.getUniswapV2HEXDailyPrice(); await sleep(1000);
    //var priceUV3 = await getUniswapV3HEXDailyPrice(); await sleep(1000);
    
    var { liquidityUV2_HEXUSDC, liquidityUV2_USDC } = await TheGraph.getUniswapV2HEXUSDC_Polling(); await sleep(1000);
    var { liquidityUV2_HEXETH, liquidityUV2_ETH } = await TheGraph.getUniswapV2HEXETH(); await sleep(1000);
    
    var { liquidityUV3_HEX, liquidityUV3_USDC, liquidityUV3_ETH } = await TheGraph.getUniswapV3(); await sleep(1000);
    
    var liquidityUV2UV3_HEX = parseInt(liquidityUV2_HEXUSDC + liquidityUV2_HEXETH + liquidityUV3_HEX);
    var liquidityUV2UV3_USDC = parseInt(liquidityUV2_USDC + liquidityUV3_USDC);
    var liquidityUV2UV3_ETH  = parseInt(liquidityUV2_ETH + liquidityUV3_ETH);

    //var priceUV2UV3 = parseFloat(((priceUV2 * (liquidityUV2_USDC / liquidityUV2UV3_USDC)) + 
    //(priceUV3 * (liquidityUV3_USDC / liquidityUV2UV3_USDC))).toFixed(8));
    var priceUV2UV3 = priceUV2;
    
    var tshareRateHEX = await TheGraph.get_shareRateChange(); await sleep(500);
    tshareRateHEX = parseFloat(tshareRateHEX);
    var tshareRateUSD = parseFloat((tshareRateHEX * priceUV2).toFixed(4));

    if (liquidityUV2_HEXUSDC == 0 || liquidityUV2_USDC == 0 || liquidityUV2_HEXETH == 0 || liquidityUV2_ETH == 0) {
      return undefined;
    }

    var { circulatingHEX, stakedHEX, totalTshares, penaltiesHEX } = await Etherscan.getGlobalInfo(); await sleep(500);

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
      stakedHEX: stakedHEX,
      circulatingHEX: circulatingHEX
    };
  }
  } catch (error){
    log("getLiveData() --- ERROR --- " + error.toString());
  } finally {
    getLiveDataRUNNING = false;
  }
}
var cron = require('node-cron');
var DailyStatMaintenance = false;

cron.schedule('30 * * * * *', async () => {
  log('**** DAILY DATA TIMER 30!');
  
  if (!getDataRunning && !DailyStatMaintenance){ 
    DailyStatMaintenance = true;
    try{
      let latestDay = await TheGraph.get_latestDay(); 
      let latestDailyData = await DailyStat.find().sort({currentDay:-1});
      let latestDailyDataCurrentDay = latestDailyData[0].currentDay; 

      if(latestDay != latestDailyDataCurrentDay) {
        for (let i = latestDailyDataCurrentDay; i <= latestDay; i++) { 
          await getDailyData(i);  
        }
      }
      
    }
    catch (err) {
      log('DAILY DATA TIMER() ----- ERROR ---' + err.toString() + " - " + err.stack);
    } finally { 
      DailyStatMaintenance = false;
    }
  }
});

cron.schedule('* * 3 * * *', async () => {
  let latestDay = await TheGraph.get_latestDay();
  for(let i = 1; i <= latestDay; i++){
    let present = await DailyStat.find({currentDay: i}).limit(1);
    if(isEmpty(present)){
      await getDailyData(i);  
    }
  }
});

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
        io.emit("currentDay", currentDayGlobal);
      }
      //currentDay = currentDay + 1;
      // Check if Current Row of Data already exists
      var currentDailyStat = await DailyStat.findOne({currentDay: { $eq: currentDay }});
      if (!isEmpty(currentDailyStat)) {
        log('getDailyData() --- WARNING - Current Daily Stat already set - Day#: ' + currentDay);
        return;
      }
      log("*** 002 - currentDay row doesnt exist!");

      //var blockNumber = await TheGraph.getEthereumBlock(currentDay);  await sleep(250);
      //log("*** 003 - blockNumber: " + blockNumber);

      // Get Previous Row of Data
      var previousDay = (currentDay - 1);
      var previousDailyStat = await DailyStat.findOne({currentDay: { $eq: previousDay }});
      log("*** 004 - previousDay: " + previousDay);

      var globalInfo = await TheGraph.get_globalInfoByDay(currentDay + 1); await sleep(250);

      let circulatingHEX = parseInt(globalInfo[0].totalHeartsinCirculation) / 100000000;
      let stakedHEX = parseInt(globalInfo[0].lockedHeartsTotal) / 100000000;
      let blocknumber = parseInt(globalInfo[0].blocknumber);
      let timestamp = parseInt(globalInfo[0].timestamp);

      // Core Live
      var tshareRateHEX = await TheGraph.get_shareRateChangeByTimestamp(timestamp); await sleep(250);
      tshareRateHEX = tshareRateHEX.tShareRateHEX;
      log("*** 005 - tshareRateHEX: " + tshareRateHEX);
      
      // var { circulatingHEX, stakedHEX } = await Etherscan.getGlobalInfo(); await sleep(250);
      log("*** 006 - circulatingHEX: " + circulatingHEX + " - stakedHEX: " + stakedHEX);

      var priceUV2 = await TheGraph.getUniswapV2HEXDailyPrice(currentDay); await sleep(1000);
      log("*** 007 - priceUV2: " + priceUV2);
      var priceUV3 = priceUV2; //await getUniswapV3HEXDailyPrice(); await sleep(1000);
      log("*** 008 - priceUV3: " + priceUV3);

      var { liquidityUV2_HEXUSDC, liquidityUV2_USDC } = await TheGraph.getUniswapV2HEXUSDC_Polling(currentDay); await sleep(1000);
      log("*** 009 - liquidityUV2_HEXUSDC: " + liquidityUV2_HEXUSDC + " - liquidityUV2_USDC: " + liquidityUV2_USDC);
      var { liquidityUV2_HEXETH, liquidityUV2_ETH } = await TheGraph.getUniswapV2HEXETH(currentDay); await sleep(1000);
      log("*** 010 - liquidityUV2_HEXETH: " + liquidityUV2_HEXETH + " - liquidityUV2_ETH: " + liquidityUV2_ETH);
      var { liquidityUV3_HEX, liquidityUV3_USDC, liquidityUV3_ETH } = await TheGraph.getUniswapV3Historical(blocknumber); await sleep(500);
      log("*** 011 - liquidityUV3_HEX: " + liquidityUV3_HEX + " - liquidityUV3_USDC: " + liquidityUV3_USDC + " - liquidityUV3_ETH: " + liquidityUV3_ETH);

      var numberOfHolders = await TheGraph.get_numberOfHolders(blocknumber);
      var numberOfHoldersChange = (numberOfHolders - previousDailyStat.numberOfHolders);
      log("*** 012 - numberOfHolders: " + numberOfHolders + " - numberOfHoldersChange: " + numberOfHoldersChange);

      var { averageStakeLength, currentStakerCount } = await get_stakeStartData(blocknumber);
      var currentStakerCountChange = (currentStakerCount - getNum(previousDailyStat.currentStakerCount));
      log("*** 013 - averageStakeLength: " + averageStakeLength + " - currentStakerCount: " + currentStakerCount);

      // Core Historical
      //var penaltiesHEX = await get_dailyPenalties(); await sleep(500);
      //log("*** 014 - penaltiesHEX: " + penaltiesHEX);

      var { stakedHEXGA } = await get_stakeStartGADataHistorical(blocknumber);
      log("*** 016 - stakedHEXGA: " + stakedHEXGA);

      var currentHolders = await get_currentHolders(blocknumber);
      var currentHoldersChange = (currentHolders - previousDailyStat.currentHolders);
      log("*** 017 - currentHolders: " + currentHolders);

      var totalStakerCount = await get_stakeStartsCountHistorical(blocknumber);
      var totalStakerCountChange = (getNum(totalStakerCount) - getNum(previousDailyStat.totalStakerCount))
      log("*** 018 - totalStakerCount: " + totalStakerCount + " - totalStakerCountChange: " + totalStakerCountChange);

      var { dailyPayoutHEX, totalTshares } = await get_dailyDataUpdatePolling(currentDay); await sleep(500);
      log("*** 019 - dailyPayoutHEX: " + dailyPayoutHEX + " - totalTshares: " + totalTshares);


      // Calculated Values
      var penaltiesHEX = (dailyPayoutHEX - ((circulatingHEX + stakedHEX) * 10000 / 100448995)) * 2;
      log("*** 020 - penaltiesHEX: " + penaltiesHEX);

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

      var tshareRateIncrease      = (parseFloat(tshareRateHEX) - previousDailyStat.tshareRateHEX);
      var tshareRateUSD           = parseFloat((parseFloat(tshareRateHEX) * priceUV2UV3).toFixed(4));

      var date                    = new Date(timestamp * 1000);

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
          Twitter.tweet(dailyStat); await sleep(30000);
          Twitter.tweetBshare(dailyStat);
        }
      } catch (err) {
        log('getDailyData() ----- SAVE --- ' + err.toString() + " - " + err.stack);
      }

    } catch (err) {
      log('getDailyData() ----- ERROR ---' + err.toString() + " - " + err.stack);
    } finally { 
      getDataRunning = false;
    }
    resolve(true);
  });
}

//////////////////////////////////////
//// HELPER 

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

const objectsEqual = (o1, o2) =>
    Object.keys(o1).length === Object.keys(o2).length 
        && Object.keys(o1).every(p => o1[p] === o2[p]);

const arraysEqual = (a1, a2) => 
   a1.length === a2.length && a1.every((o, idx) => objectsEqual(o, a2[idx]));

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

async function get_currentHolders(blockNumber) {
  try {
    var { circulatingSupply, currentHolders } = await get_tokenHoldersData_Historical(blockNumber);
    if (currentHolders) { return currentHolders; }
  } catch (error) {
    log(error);
  }
  return 0;
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
    var data = await TheGraph.get_stakeEnds($lastStakeId, unixTimestamp, unixTimestampEnd);
    if (data.count <= 0) { break; }
    stakeCount += data.count;
    penaltiesSum += parseInt(data.penalty);
    $lastStakeId = data.lastStakeId;

    count += 1;
    await sleep(100);
  }

  var $lastStakeId = 0;

  while (true) {
    var data = await TheGraph.get_stakeGoodAccountings($lastStakeId, unixTimestamp, unixTimestampEnd);
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

async function get_stakeStartDataHistorical(blockNumber){

  var $lastStakeId = 0;
  var stakedDaysSum = 0;
  var stakedCount = 0;
  var uniqueAddressList = [];
  var stakedHEXSum = 0;
  var weightedAverageSum = 0;

  while (true) {
    var data = await TheGraph.get_stakeStartsHistorical($lastStakeId, blockNumber);
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

  var blockNumber = await TheGraph.getEthereumBlock(day + 1);
  //log("blockNumber - " + blockNumber + " startTime - " + startTime + " endTime - " + endTime);

  while (true) {
    var data = await TheGraph.get_stakeEnds_Historical(blockNumber, $lastStakeId, startTime, endTime);
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
    var data = await TheGraph.get_stakeGoodAccountings_Historical(blockNumber, $lastStakeId, startTime, endTime);
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

//////////////////////////////////////////////

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

//////////////////////////////////////////////

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

async function get_stakeStartsCountHistorical(blocknumber){
  console.log("get_stakeStartsCountHistorical");
      try {  
          console.log("BlockNumber: " + blocknumber);
          var { uniqueStakerCount } = await getAll_stakeStartsCountHistorical(blocknumber);
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
