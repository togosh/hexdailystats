const MongoDB = require('./Services/MongoDB'); 
const TheGraph = require('./Services/TheGraph'); 
const Coingecko = require('./Services/Coingecko'); 
const Twitter = require('./Services/Twitter'); 
const Etherscan = require('./Services/Etherscan'); 
const DailyStatHandler = require('./Handlers/DailyStatHandler');
const h = require('./Helpers/helpers'); 
const p = require('./Helpers/prices');

const fetchRetry = h.fetchRetry;
const FETCH_SIZE = h.FETCH_SIZE;
const sleep = h.sleep;
const log = h.log;
const CONFIG = h.CONFIG; 
var DEBUG = CONFIG.debug;


const TheGraph_ETHEREUM = new TheGraph(h.ETHEREUM);
const TheGraph_PULSECHAIN = new TheGraph(h.PULSECHAIN);

const MongoDB_ETHEREUM = new MongoDB(h.ETHEREUM);
const MongoDB_PULSECHAIN = new MongoDB(h.PULSECHAIN);

const DailyStatHandler_ETHEREUM = new DailyStatHandler(h.ETHEREUM);
const DailyStatHandler_PULSECHAIN = new DailyStatHandler(h.PULSECHAIN);


const http = require('http');
require('es6-promise').polyfill();
 
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const schedule = require('node-schedule');
var cron = require('node-cron');
var cors = require('cors');

const { JSDOM } = require( "jsdom" );
const { window } = new JSDOM( "" );
const $ = require( "jquery" )( window );


var hexPrice = '';
var connections = {};

var currentDayGlobal = 0;
var getAndSet_currentGlobalDay_Running = false;

var liveData = undefined;
var getLiveDataRUNNING = false;

var ethereumData = undefined;
var getEthereumDataRUNNING = false;

var currencyRates = undefined;
var getCurrencyDataRunning = false;


var DailyStatMaintenance_ETHEREUM = false;
var DailyStatMaintenance_PULSECHAIN = false;


var rowData = undefined;
var rowData_PULSECHAIN = undefined;

var rowDataObjects = undefined;
var rowDataObjects_PULSECHAIN = undefined;

var hexSiteData = undefined;


async function getRowData() {
  if (MongoDB_ETHEREUM && !MongoDB_ETHEREUM.getRowDataRunning){
    returnPackage = await MongoDB_ETHEREUM.getRowData(); 
    
    rowData = returnPackage.rowData;
    rowDataObjects = returnPackage.rowDataObjects;

    hexSiteData = await buildHexSiteData(rowDataObjects); 
    io.emit("rowData", rowData);
  }

  if (MongoDB_PULSECHAIN && !MongoDB_PULSECHAIN.getRowDataRunning){
    returnPackage_PULSECHAIN = await MongoDB_PULSECHAIN.getRowData(); 
    
    rowData_PULSECHAIN = returnPackage_PULSECHAIN.rowData;
    rowDataObjects_PULSECHAIN = returnPackage_PULSECHAIN.rowDataObjects;

    io.emit("rowData_PULSECHAIN", rowData_PULSECHAIN);
  }
}; getRowData();

const getAndSet_currentGlobalDayThrottled = throttle(getAndSet_currentGlobalDay, 30000);

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

app.use(function(req, res, next) {
	try {
	if (!DEBUG && req.path === "/" && req.ip){
		connections[req.ip] = Date.now();

		const connection = new MongoDB_ETHEREUM.connection({
			created: Date.now(),
			ipaddress: req.ip
		});

		MongoDB_ETHEREUM.connection.save(function (err) {
			if (err) return log(err);
		});
	}
	} catch (error) {
		log('APP ----- Connection ' + error);
	}

  if (!getAndSet_currentGlobalDay_Running && !DailyStatHandler_ETHEREUM.getDataRunning && !getLiveDataRUNNING) { getAndSet_currentGlobalDayThrottled() }
  //if (!getRowDataRunning){ getRowData(); }

	next();
});

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

app.get('/fulldatapulsechain', cors(), function (req, res) {
  if (rowDataObjects_PULSECHAIN) { res.send(JSON.parse(JSON.stringify(rowDataObjects_PULSECHAIN))); } else {res.status(404).send({ error: "fullDataPulseChain not populated yet" });};
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
  await getAndSet_currentGlobalDay();

  if (!getLiveDataRUNNING){ await runLiveData(); }
  if (!getEthereumDataRUNNING){ await runEthereumData(); }
  //if (!getCurrencyDataRunning){ getCurrencyData(); };
  getRowData();
  //if (!DailyStatHandler_ETHEREUM.getDataRunning){ await DailyStatHandler_ETHEREUM.getDailyData(); }
  //if (!DailyStatHandler_PULSECHAIN.getDataRunning){ await DailyStatHandler_PULSECHAIN.getDailyData(); }
  await getBitcoinCSV();
  await getEthereumCSV();
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
	if (rowData){ socket.emit("rowData", rowData); }; //rowData.slice(0, 49)); };
  if (rowData_PULSECHAIN) { socket.emit("rowData_PULSECHAIN", rowData_PULSECHAIN); }
  //if (DailyStatHandler_ETHEREUM.getDataRunning){ await DailyStatHandler_ETHEREUM.getDailyData(); }
  //if (DailyStatHandler_PULSECHAIN.getDataRunning){ await DailyStatHandler_PULSECHAIN.getDailyData(); }
  //getRowData();
  socket.emit("hexPrice", hexPrice);
  socket.emit("currentDay", currentDayGlobal);
  socket.emit("liveData", liveData);
  socket.emit("currencyRates", currencyRates);
  socket.emit("ethereumData", ethereumData);

  //MongoDB_PULSECHAIN.create_roiMultiplierFromATLs();

  /*
  socket.on("sendLatestData", () => {
    if (rowData) { 
        log("sendLatestData - SUCCESS");
        socket.emit("entireRowData", rowData);
    }
  }); 
  */
  socket.on("needRowData", () => {
    socket.emit('rowData', rowData.slice(0, 49)); 
  });
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
  if (!getEthereumDataRUNNING){
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
  if (!DailyStatHandler_ETHEREUM.getDataRunning){
    var price = await Etherscan.getEthereumPrice(); await sleep(2000);
    var {low, average, high} = await Etherscan.getGas(); await sleep(1000);
    
    return {
      price: price,
      erc20transfer: (average * 65000 / 1000000000 * price),
      uniswapSwap: (average * 200000 / 1000000000 * price),
      addLiquidity: (average * 175000 / 1000000000 * price),
      gwei: average,
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
  if (!DailyStatHandler_ETHEREUM.getDataRunning && !DailyStatHandler_PULSECHAIN.getDataRunning && !getLiveDataRUNNING){
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
  if (!DailyStatHandler_ETHEREUM.getDataRunning && !DailyStatHandler_PULSECHAIN.getDataRunning){
    ///////////////////////////////// ETHEREUM NETWORK
    //var priceUV2 = await TheGraph_ETHEREUM.getUniswapV2HEXDailyPrice(); await sleep(1000);
    var priceUV3 = await TheGraph_ETHEREUM.getUniswapV3HEXDailyPrice(); await sleep(1000);
    var priceUV2 = priceUV3;
    
    //var { liquidityUV2_HEXUSDC, liquidityUV2_USDC } = await TheGraph_ETHEREUM.getUniswapV2HEXUSDC_Polling(); await sleep(1000);
    //var { liquidityUV2_HEXETH, liquidityUV2_ETH } = await TheGraph_ETHEREUM.getUniswapV2HEXETH(); await sleep(1000);
    var liquidityUV2_HEXUSDC = 0;
    var liquidityUV2_USDC = 0;
    var liquidityUV2_HEXETH = 0;
    var liquidityUV2_ETH = 0;
    
    var { liquidityUV3_HEX, liquidityUV3_USDC, liquidityUV3_ETH, liquidityUV3_DAI } = await TheGraph_ETHEREUM.getUniswapV3(); await sleep(1000);
    
    var liquidityUV2UV3_HEX = parseInt(liquidityUV2_HEXUSDC + liquidityUV2_HEXETH + liquidityUV3_HEX);
    var liquidityUV2UV3_USDC = parseInt(liquidityUV2_USDC + liquidityUV3_USDC);
    var liquidityUV2UV3_ETH  = parseInt(liquidityUV2_ETH + liquidityUV3_ETH);
    var liquidityUV2UV3_DAI = parseInt(liquidityUV3_DAI);

    //var priceUV2UV3 = parseFloat(((priceUV2 * (liquidityUV2_USDC / liquidityUV2UV3_USDC)) + 
    //(priceUV3 * (liquidityUV3_USDC / liquidityUV2UV3_USDC))).toFixed(8));
    var priceUV2UV3 = priceUV3;
    
    var tshareRateHEX = await TheGraph_ETHEREUM.get_shareRateChange(); await sleep(500);
    tshareRateHEX = parseFloat(tshareRateHEX);
    var tshareRateUSD = parseFloat((tshareRateHEX * priceUV2UV3).toFixed(4));

    if (liquidityUV2_HEXUSDC == 0 || liquidityUV2_USDC == 0 || liquidityUV2_HEXETH == 0 || liquidityUV2_ETH == 0) {
      //return undefined;
    }

    var { circulatingHEX, stakedHEX, totalTshares, penaltiesHEX } = await Etherscan.getGlobalInfo(); await sleep(500);

    var payout = ((circulatingHEX + stakedHEX) * 10000 / 100448995) + (penaltiesHEX / 2.0);
    var payoutPerTshare = (payout / totalTshares);

    /////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////// PULSECHAIN NETWORK

    var PLSpair = await TheGraph_PULSECHAIN.getPulseXPairPriceAndLiquidity(h.PULSECHAIN_WPLSDAI); await sleep(1000);
    var pricePLS_PulseX_Pulsechain = 0; 
    if (PLSpair && PLSpair.token1Price){ 
      pricePLS_PulseX_Pulsechain = PLSpair.token1Price; 
    }

    var HEXpair = await TheGraph_PULSECHAIN.getPulseXPairPriceAndLiquidity(h.PULSECHAIN_HEXPLS); await sleep(1000);
    var priceHEX_PulseX_Pulsechain = 0; 
    if (HEXpair && HEXpair.token1Price){ 
      priceHEX_PulseX_Pulsechain = HEXpair.token1Price * pricePLS_PulseX_Pulsechain;
    }

    var EHEXpair = await TheGraph_PULSECHAIN.getPulseXPairPriceAndLiquidity(h.PULSECHAIN_HEXEHEX); await sleep(1000);
    //var priceEHEX_PulseX_Pulsechain = EHEXpair.token0Price * priceHEX_PulseX_Pulsechain;

    var PLSXpair = await TheGraph_PULSECHAIN.getPulseXPairPriceAndLiquidity(h.PULSECHAIN_WPLSPLSX); await sleep(1000);
    var pricePLSX_PulseX_Pulsechain = 0; 
    if (PLSXpair && PLSXpair.token1Price){ 
      pricePLSX_PulseX_Pulsechain = PLSXpair.token1Price * pricePLS_PulseX_Pulsechain;
    }
    
    var INCpair = await TheGraph_PULSECHAIN.getPulseXPairPriceAndLiquidity(h.PULSECHAIN_WPLSINC); await sleep(1000);
    var priceINC_PulseX_Pulsechain = 0; 
    if (INCpair && PLSXpair.token1Price){ 
      priceINC_PulseX_Pulsechain = INCpair.token1Price * pricePLS_PulseX_Pulsechain;
    }
    
    var liquidityHEX_Pulsechain = 0;
    if (HEXpair && EHEXpair){
      liquidityHEX_Pulsechain = (Number(HEXpair.reserve0) + Number(EHEXpair.reserve0))
    }
    var liquidityPLS_Pulsechain = 0;
    if (HEXpair){
      liquidityPLS_Pulsechain = HEXpair.reserve1;
    }
    var liquidityEHEX_Pulsechain = 0;
    if (EHEXpair){
      liquidityEHEX_Pulsechain = EHEXpair.reserve1;
    }

    var tshareRateHEX_Pulsechain = await TheGraph_PULSECHAIN.get_shareRateChange(); await sleep(500);
    tshareRateHEX_Pulsechain = parseFloat(tshareRateHEX_Pulsechain);
    var tshareRateUSD_Pulsechain = parseFloat((tshareRateHEX_Pulsechain * priceHEX_PulseX_Pulsechain).toFixed(4));

    var globalInfo = await TheGraph_PULSECHAIN.get_globalInfo(); await sleep(500);
    //console.log("globalInfo");
    //console.log(globalInfo);

    var circulatingHEX_Pulsechain = globalInfo[0].totalHeartsinCirculation / 100000000;
    var stakedHEX_Pulsechain = globalInfo[0].lockedHeartsTotal / 100000000;
    var totalTshares_Pulsechain = globalInfo[0].stakeSharesTotal / 1000000000000;
    var penaltiesHEX_Pulsechain = globalInfo[0].stakePenaltyTotal / 100000000;

    var payout_Pulsechain = ((circulatingHEX_Pulsechain + stakedHEX_Pulsechain) * 10000 / 100448995) + (penaltiesHEX_Pulsechain / 2.0);
    var payoutPerTshare_Pulsechain = (payout_Pulsechain / totalTshares_Pulsechain);

    var {rapid, fast} = await Etherscan.getGas_Pulsechain(); await sleep(1000);
    
    var erc20transfer_Pulsechain = (fast / 20000 / 1000000000 * pricePLS_PulseX_Pulsechain);
    var pulseXSwap_Pulsechain = (fast / 4650 / 1000000000  * pricePLS_PulseX_Pulsechain);
    var addLiquidity_Pulsechain = (fast / 3600 / 1000000000  * pricePLS_PulseX_Pulsechain);
    var beat = (fast / 1000000000);

    
    return {
      price: priceUV2UV3,
      tsharePrice: tshareRateUSD,
      tshareRateHEX: tshareRateHEX,
      liquidityHEX: liquidityUV2UV3_HEX,
      liquidityUSDC: liquidityUV2UV3_USDC,
      liquidityETH: liquidityUV2UV3_ETH,
      liquidityDAI: liquidityUV2UV3_DAI,
      penaltiesHEX: penaltiesHEX,
      payoutPerTshare: payoutPerTshare,
      stakedHEX: stakedHEX,
      circulatingHEX: circulatingHEX,

      price_Pulsechain: priceHEX_PulseX_Pulsechain,
      tsharePrice_Pulsechain: tshareRateUSD_Pulsechain,
      tshareRateHEX_Pulsechain: tshareRateHEX_Pulsechain,

      liquidityHEX_Pulsechain: liquidityHEX_Pulsechain,
      liquidityPLS_Pulsechain: liquidityPLS_Pulsechain,
      liquidityEHEX_Pulsechain: liquidityEHEX_Pulsechain,

      penaltiesHEX_Pulsechain: penaltiesHEX_Pulsechain,
      payoutPerTshare_Pulsechain: payoutPerTshare_Pulsechain,
      stakedHEX_Pulsechain: stakedHEX_Pulsechain,
      circulatingHEX_Pulsechain: circulatingHEX_Pulsechain,

      pricePLS_Pulsechain: pricePLS_PulseX_Pulsechain,
      pricePLSX_Pulsechain: pricePLSX_PulseX_Pulsechain,
      priceINC_Pulsechain: priceINC_PulseX_Pulsechain,

      erc20transfer_Pulsechain: erc20transfer_Pulsechain,
      pulseXSwap_Pulsechain: pulseXSwap_Pulsechain,
      addLiquidity_Pulsechain: addLiquidity_Pulsechain,
      beat: beat,
    };
  }
  } catch (error){
    log("getLiveData() --- ERROR --- " + error.toString());
  } finally {
    getLiveDataRUNNING = false;
  }
}

let test = async () => {
  //await MongoDb_ETHEREUM.updateOneColumn(756, "tshareRateHEX", null);
  //var test = await MongoDb_ETHEREUM.dailyStat.find({currentDay:null});
  //var test2 = test;
}; test();

cron.schedule('10 */6 * * *', async () => {
  await getBitcoinCSV();
  await getEthereumCSV(); 
});

async function getEthereumCSV(){
  try {
    log("getEthereumCSV()")

    var pricesETH = await Coingecko.getPriceHistory_EthereumWithTime((3000 + currentDayGlobal)); await sleep(500);
    pricesETH = pricesETH.slice(0, -1);

    var pricesETHList = [];
    var count = 1;
    pricesETH.forEach(row => {
        var date = new Date(Number(row[0]));
        date.setUTCHours(0, 0, 0, 0);
        var dateString = date.getUTCFullYear() + "-" + h.minTwoDigits(date.getUTCMonth() + 1) + "-" + h.minTwoDigits(date.getUTCDate());

        var newRow = {
          Day:        count,
          Date:       dateString,
          Price:      Number(row[1]),
        }
        pricesETHList.push(newRow);
        count+=1;
      });

    var pricesETHCSV = h.convertCSV(pricesETHList);

    fs.writeFileSync('./public/pricesETH.csv', pricesETHCSV);
  } catch (e) { log(e); }
}

async function getBitcoinCSV(){
  try {
    log("getBitcoinCSV()")

    var prices_start = p.PRICES_BTC_START;
    var days = (currentDayGlobal - 1237);

    var pricesList = [];
    var count = 1;
    prices_start.every(row => {
        var date = new Date(row[0]);
        date.setUTCHours(0, 0, 0, 0);
        var dateString = date.getUTCFullYear() + "-" + h.minTwoDigits(date.getUTCMonth() + 1) + "-" + h.minTwoDigits(date.getUTCDate());

        var newRow = {
          Day:        count,
          DayLaunch:	(count + 274),
          Date:       dateString,
          Price:      Number(row[1]),
        }
        pricesList.push(newRow);
        count+=1;

        return true;
    });

    var prices_end = await Coingecko.getPriceHistory_BitcoinWithTime(days); await sleep(500);
    prices_end = prices_end.slice(0, -1);

    prices_end.every(row => {
      var date = new Date(Number(row[0]));
      date.setUTCHours(0, 0, 0, 0);
      var dateString = date.getUTCFullYear() + "-" + h.minTwoDigits(date.getUTCMonth() + 1) + "-" + h.minTwoDigits(date.getUTCDate());

      var newRow = {
        Day:        count,
        DayLaunch:	(count + 274),
        Date:       dateString,
        Price:      Number(row[1]),
      }
      pricesList.push(newRow);
      count+=1;

      return true;
  });

    var pricesCSV = h.convertCSV(pricesList);

    fs.writeFileSync('./public/pricesBTC.csv', pricesCSV);
  } catch (e) { log(e); }
}


cron.schedule('15 * * * * *', async () => {
  log("**** DAILY DATA MAINTENANCE TIMER! -- getDataRunning: " + DailyStatHandler_ETHEREUM.getDataRunning + " --- DailyStatMaintenance_ETHEREUM: " + DailyStatMaintenance_ETHEREUM + " -- ETHEREUM");
  if (!DailyStatHandler_ETHEREUM.getDataRunning && !DailyStatMaintenance_ETHEREUM){ 
    try{
      let daysBackToCheck = 4;
      let latestDay = await TheGraph_ETHEREUM.get_latestDay(); 
      let latestDailyData = await MongoDB_ETHEREUM.dailyStat.find().limit(daysBackToCheck).sort({currentDay:-1});
      //console.log("latestDay: " +latestDay + " latestDailyData: " + latestDailyData);
      let latestDailyDataCurrentDay = latestDailyData[0].currentDay;  
      let dailyDataCurrentDayStart = latestDailyData[latestDailyData.length-1].currentDay; 
      //console.log("latestDailyDataCurrentDay: " +latestDailyDataCurrentDay + " dailyDataCurrentDayStart: " + dailyDataCurrentDayStart);
      
      for (let i = dailyDataCurrentDayStart; i <= latestDailyDataCurrentDay; i++) {  
        let ds = await MongoDB_ETHEREUM.dailyStat.find({currentDay:i});  
        //console.log("ds: " + ds);
        for(var key in ds[0]){
          if(key != '$op' && ds[0][key] === null && key != "priceUV1" && key != "liquidityUV1_HEX" && key != "liquidityUV1_ETH"){
            console.log("key: " + key + " value: " + ds[0][key]);
            DailyStatMaintenance_ETHEREUM = true;
            log("**** DAILY DATA -- getDailyData() -- DailyStatMaintenance SET TRUE: " + DailyStatMaintenance_ETHEREUM + " -- ETHEREUM");
            await DailyStatHandler_ETHEREUM.getDailyData(i);  
            getRowData();
            io.emit("currentDay", currentDayGlobal);
            break;
          }
        } 
      }

      if(latestDay > latestDailyDataCurrentDay) {
        DailyStatMaintenance_ETHEREUM = true;
        log("**** DAILY DATA -- getDailyData() 2 -- DailyStatMaintenance SET TRUE: " + DailyStatMaintenance_ETHEREUM) + " -- ETHEREUM";
        for (let i = latestDailyDataCurrentDay + 1; i <= latestDay; i++) { 
          await DailyStatHandler_ETHEREUM.getDailyData(i);  
          getRowData();
          io.emit("currentDay", currentDayGlobal);
        }
      } 
    }
    catch (err) {
      log('DAILY DATA MAINTENANCE TIMER () ----- ERROR ---' + err.toString() + " - " + err.stack + " -- ETHEREUM");
    } finally { 
      DailyStatMaintenance_ETHEREUM = false;
      log("**** DAILY DATA -- DailyStatMaintenance SET FALSE: " + DailyStatMaintenance_ETHEREUM + " -- ETHEREUM");
    } 
  }
});

cron.schedule('* * 3 * * *', async () => {
  let latestDay = await TheGraph_ETHEREUM.get_latestDay();
  for(let i = 1; i <= latestDay; i++){
    let present = await MongoDB_ETHEREUM.find({currentDay: i}).limit(1);
    if(isEmpty(present)){
      await DailyStatHandler_ETHEREUM.getDailyData(i);  
    }
  }
});



cron.schedule('45 * * * * *', async () => {
  log("**** DAILY DATA MAINTENANCE TIMER! -- getDataRunning: " + DailyStatHandler_PULSECHAIN.getDataRunning + " -- PULSECHAIN");
  if (!DailyStatHandler_PULSECHAIN.getDataRunning && !DailyStatMaintenance_PULSECHAIN){ 
    try{
      let daysBackToCheck = 4;
      let latestDay = await TheGraph_PULSECHAIN.get_latestDay(); 
      let latestDailyData = await MongoDB_PULSECHAIN.dailyStat.find().limit(daysBackToCheck).sort({currentDay:-1});
      //console.log("latestDay: " +latestDay + " latestDailyData: " + latestDailyData);
      let latestDailyDataCurrentDay = latestDailyData[0].currentDay;
      let dailyDataCurrentDayStart = latestDailyData[latestDailyData.length-1].currentDay;
      //console.log("latestDailyDataCurrentDay: " +latestDailyDataCurrentDay + " dailyDataCurrentDayStart: " + dailyDataCurrentDayStart);
      
      for (let i = dailyDataCurrentDayStart; i <= latestDailyDataCurrentDay; i++) {  
        let ds = await MongoDB_PULSECHAIN.dailyStat.find({currentDay:i});  
        for(var key in ds[0]){
          if(key != '$op' && ds[0][key] === null && key != "priceUV1" && key != "liquidityUV1_HEX" && key != "liquidityUV1_ETH"){
            //console.log("key: " + key + " value: " + ds[0][key]);
            DailyStatMaintenance_PULSECHAIN = true;
            log("**** DAILY DATA -- getDailyData() -- DailyStatMaintenance SET TRUE: " + DailyStatMaintenance_PULSECHAIN) + " -- PULSECHAIN";
            await DailyStatHandler_PULSECHAIN.getDailyData(i);  
            getRowData();
            io.emit("currentDay", currentDayGlobal);
            break;
          }
        } 
      }


      if(latestDay > latestDailyDataCurrentDay) {
        DailyStatMaintenance_PULSECHAIN = true;
        log("**** DAILY DATA -- getDailyData() 2 -- DailyStatMaintenance SET TRUE: " + DailyStatMaintenance_PULSECHAIN + " -- PULSECHAIN");
        for (let i = latestDailyDataCurrentDay + 1; i <= latestDay; i++) { 
          await DailyStatHandler_PULSECHAIN.getDailyData(i);  
          getRowData();
          io.emit("currentDay", currentDayGlobal);
        }
      } 
    }
    catch (err) {
      log('DAILY DATA MAINTENANCE TIMER () ----- ERROR ---' + err.toString() + " - " + err.stack) + " -- PULSECHAIN";
    } finally { 
      DailyStatMaintenance_PULSECHAIN = false;
      log("**** DAILY DATA -- DailyStatMaintenance SET FALSE: " + DailyStatMaintenance_PULSECHAIN + " -- PULSECHAIN");
    } 
  }
});


cron.schedule('* 1 3 * * *', async () => {
  let latestDay = await TheGraph_PULSECHAIN.get_latestDay();
  for(let i = 1; i <= latestDay; i++){
    let present = await MongoDB_PULSECHAIN.find({currentDay: i}).limit(1);
    if(isEmpty(present)){
      await DailyStatHandler_PULSECHAIN.getDailyData(i);  
    }
  }
});



//////////////////////////////////////
//// HELPER 

function isEmpty(obj) {
	for(var prop in obj) {
			if(obj.hasOwnProperty(prop))
					return false;
	}

	return true;
}
  
const objectsEqual = (o1, o2) =>
    Object.keys(o1).length === Object.keys(o2).length 
        && Object.keys(o1).every(p => o1[p] === o2[p]);

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
