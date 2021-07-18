var DEBUG = false;
var CONFIG = require('./config.json');
const http = require('http');
require('isomorphic-fetch');
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const schedule = require('node-schedule');

const { JSDOM } = require( "jsdom" );
const { window } = new JSDOM( "" );
const $ = require( "jquery" )( window );

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

const HEX_CONTRACT_ADDRESS = "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39";
const HEX_CONTRACT_CURRENTDAY = "0x5c9302c9";
const HEX_CONTRACT_GLOBALINFO = "0xf04b5fa0";

const UNISWAP_V2_HEXUSDC = "0xf6dcdce0ac3001b2f67f750bc64ea5beb37b5824";
const UNISWAP_V2_HEXETH = "0x55d5c232d921b9eaa6b37b5845e439acd04b4dba";

const UNISWAP_V3_HEXUSDC = "0x69d91b94f0aaf8e8a2586909fa77a5c2c89818d5";
const UNISWAP_V3_HEXETH = "0x9e0905249ceefffb9605e034b534544684a58be6";

var rowData = undefined;
var getDataRunning = false;
var getRowDataRunning = false;
var connections = {};

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

httpServer.listen(httpPort, hostname, () => { log(`Server running at http://${hostname}:${httpPort}/`);});
if(!DEBUG){ httpsServer.listen(httpsPort, hostname, () => { log('listening on *:' + httpsPort); }); }

var io = undefined;
if(DEBUG){ io = require('socket.io')(httpServer);
} else { io = require('socket.io')(httpsServer, {secure: true}); }

io.on('connection', (socket) => {
	log('SOCKET -- ************* CONNECTED: ' + socket.id + ' *************');
	if (rowData){ socket.emit("rowData", rowData); };
  if (!getDataRunning){ getDailyData(); }
  if (!getRowDataRunning){ getRowData(); }
});

const rule = new schedule.RecurrenceRule();
rule.hour = 0;
rule.minute = 2;
rule.tz = 'Etc/UTC';

const job = schedule.scheduleJob(rule, function(){
  log('**** DAILY DATA TIMER!');
  if (!getDataRunning){ getDailyData(); }
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

  tshareRateHEX:      { type: Number, required: true },
  dailyPayoutHEX:     { type: Number, required: true },
  totalTshares:       { type: Number, required: true },
  averageStakeLength: { type: Number, required: true },
  penaltiesHEX:       { type: Number, required: true },

  priceUV2:           { type: Number, required: true },
  priceUV3:           { type: Number, required: true },

  liquidityUV2_USDC:  { type: Number, required: true },
  liquidityUV2_ETH:   { type: Number, required: true },
  liquidityUV3_USDC:  { type: Number, required: true },
  liquidityUV3_ETH:   { type: Number, required: true },

  // CALCULATED DATA
  tshareRateIncrease: { type: Number, required: true },
  tshareRateUSD:      { type: Number, required: true },

  totalTsharesChange: { type: Number, required: true },
  payoutPerTshareHEX: { type: Number, required: true },
  actualAPYRate:      { type: Number, required: true },

  stakedSupplyChange:       { type: Number, required: true },
  circulatingSupplyChange:  { type: Number, required: true },

  stakedHEXPercent:         { type: Number, required: true },
  stakedHEXPercentChange:   { type: Number, required: true },

  priceUV2UV3:          { type: Number, required: true },
  priceChangeUV2:       { type: Number, required: true },
  priceChangeUV3:       { type: Number, required: true },
  priceChangeUV2UV3:    { type: Number, required: true },

  liquidityUV2UV3_USDC: { type: Number, required: true },
  liquidityUV2UV3_ETH:  { type: Number, required: true },
  liquidityUV2UV3_HEX:  { type: Number, required: true },

  numberOfHolders:        { type: Number, required: true },
  numberOfHoldersChange:  { type: Number, required: true },

  dailyMintedInflationTotal:  { type: Number, required: true },

  totalHEX: { type: Number, required: true },
});

const DailyStat = mongoose.model('DailyStat', DailyStatSchema);

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
        ds.tshareRateHEX, ds.tshareRateIncrease, ds.tshareRateUSD,
        ds.totalTshares, ds.totalTsharesChange,
        ds.payoutPerTshareHEX, ds.actualAPYRate,
        ds.stakedHEXPercent, ds.stakedHEXPercentChange, ds.averageStakeLength,
        ds.penaltiesHEX, ds.priceUV2UV3, ds.priceChangeUV2UV3,
        ds.liquidityUV2UV3_HEX, ds.liquidityUV2UV3_USDC, ds.liquidityUV2UV3_ETH,
        ds.totalHEX, ds.dailyMintedInflationTotal,
        ds.circulatingHEX, ds.circulatingSupplyChange,
        ds.stakedHEX, ds.stakedSupplyChange,
        ds.dailyPayoutHEX,
        ds.numberOfHolders, ds.numberOfHoldersChange
      ];
      rowDataNew.push(row);
    }

    if (rowData === undefined || rowData !== rowDataNew) {
      rowData = rowDataNew;
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
  console.log("getDailyData()");
  try {

  var numberOfHolders = await get_numberOfHolders();

  var currentDay = await getCurrentDay() - 1;

  // Check if Current Row of Data already exists
  var currentDailyStat = await DailyStat.findOne({currentDay: { $eq: currentDay }});
  if (!isEmpty(currentDailyStat)) {
    log('WARNING - Current Daily Stat already set - Day#: ' + currentDay);
    return;
  }

  // Get Previous Row of Data
  var previousDay = (currentDay - 1);
  var previousDailyStat = await DailyStat.findOne({currentDay: { $eq: previousDay }});

  // Get Core Data
  var numberOfHolders = await get_numberOfHolders();
  var numberOfHoldersChange = (numberOfHolders - previousDailyStat.numberOfHolders);

  var { circulatingHEX, stakedHEX } = await getGlobalInfo();
  
  var tshareRateHEX = await get_shareRateChange();
  var { dailyPayoutHEX, totalTshares } = await get_dailyDataUpdate();

  var averageStakeLength = await get_averageStakeLength();
  var penaltiesHEX = await get_dailyPenalties();

  var priceUV2 = await getUniswapV2HEXDailyPrice();
  var priceUV3 = await getUniswapV3HEXDailyPrice();

  var { liquidityUV2_HEXUSDC, liquidityUV2_USDC } = await getUniswapV2HEXUSDC();
  var { liquidityUV2_HEXETH, liquidityUV2_ETH } = await getUniswapV2HEXETH();

  var { liquidityUV3_HEX, liquidityUV3_USDC, liquidityUV3_ETH } = await getUniswapV3();

  // Calculated Values
  var totalTsharesChange      = (totalTshares - previousDailyStat.totalTshares);
  var payoutPerTshareHEX      = parseFloat((dailyPayoutHEX / totalTshares).toFixed(8));
  var actualAPYRate           = parseFloat(((dailyPayoutHEX / stakedHEX) * 365.25 * 100).toFixed(4));

  var stakedSupplyChange      = (stakedHEX - previousDailyStat.stakedHEX);
  var circulatingSupplyChange = (circulatingHEX - previousDailyStat.circulatingHEX);

  var stakedHEXPercent        = parseFloat(((stakedHEX / (stakedHEX + circulatingHEX)) * 100).toFixed(4));
  var stakedHEXPercentChange  = parseFloat((stakedHEXPercent - previousDailyStat.stakedHEXPercent).toFixed(4));

  var liquidityUV2UV3_HEX     = parseFloat((liquidityUV2_HEXUSDC + liquidityUV2_HEXETH + liquidityUV3_HEX).toFixed(4));
  var liquidityUV2UV3_USDC    = parseFloat((liquidityUV2_USDC + liquidityUV3_USDC).toFixed(4));
  var liquidityUV2UV3_ETH     = parseFloat((liquidityUV2_ETH + liquidityUV3_ETH).toFixed(4));

  var priceChangeUV2          = parseFloat((priceUV2 - previousDailyStat.priceUV2).toFixed(4));
  var priceChangeUV3          = parseFloat((priceUV3 - previousDailyStat.priceUV3).toFixed(4));

  var priceUV2UV3             = parseFloat(((priceUV2 * (liquidityUV2_USDC / liquidityUV2UV3_USDC)) + (priceUV3 * (liquidityUV3_USDC / liquidityUV2UV3_USDC))).toFixed(8));
  var priceChangeUV2UV3       = parseFloat((priceUV2UV3 / (previousDailyStat.priceUV2UV3 - 1)).toFixed(8));

  var tshareRateIncrease      = parseFloat((tshareRateHEX - previousDailyStat.tshareRateHEX).toFixed(4));
  var tshareRateUSD           = parseFloat((tshareRateHEX * priceUV2UV3).toFixed(4));

  var date                    = new Date();

  var dailyMintedInflationTotal = (circulatingHEX + stakedHEX) - (previousDailyStat.circulatingHEX + previousDailyStat.stakedHEX);

  var totalHEX = (circulatingHEX + stakedHEX);

  // Create Full Object, Set Calculated Values
  try {
    const dailyStat = new DailyStat({ 

      // CORE DATA
      date:               date,
      currentDay:         currentDay,
      circulatingHEX:     circulatingHEX,
      stakedHEX:          stakedHEX,

      tshareRateHEX:      tshareRateHEX,
      dailyPayoutHEX:     dailyPayoutHEX,
      totalTshares:       totalTshares,
      averageStakeLength: averageStakeLength,
      penaltiesHEX:       penaltiesHEX,

      priceUV2:           priceUV2,
      priceUV3:           priceUV3,

      liquidityUV2_USDC:  liquidityUV2_USDC,
      liquidityUV2_ETH:   liquidityUV2_ETH,
      liquidityUV3_USDC:  liquidityUV3_USDC,
      liquidityUV3_ETH:   liquidityUV3_ETH,

      // CALCULATED DATA
      tshareRateIncrease:       tshareRateIncrease,
      tshareRateUSD:            tshareRateUSD,

      totalTsharesChange:       totalTsharesChange,
      payoutPerTshareHEX:       payoutPerTshareHEX,
      actualAPYRate:            actualAPYRate,

      stakedSupplyChange:       stakedSupplyChange,
      circulatingSupplyChange:  circulatingSupplyChange,

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

      dailyMintedInflationTotal: dailyMintedInflationTotal,
      totalHEX: totalHEX
    });

    dailyStat.save(function (err) {
      if (err) return log(err);
    });
  } catch (err) {
    log('getDailyData() ----- SAVE --- ' + err);
  }

  } catch (err) {
    log('getDailyData() ----- ' + err);
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

  return await fetch(etherScanURL, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(res => res.json())
  .then(res => {
    var chunks = chunkSubstr(res.result.substring(2), 64);

    var circulatingSupply = parseInt(chunks[11], 16).toString();
    circulatingSupply = circulatingSupply.substring(0, circulatingSupply.length - 8);

    var lockedHEX = parseInt(chunks[0], 16).toString();
    lockedHEX = lockedHEX.substring(0, lockedHEX.length - 8);

    return {
      circulatingHEX: parseInt(circulatingSupply),
      stakedHEX: parseInt(lockedHEX)
    };
  });
}

async function get_numberOfHolders(){
  return await fetch('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
    method: 'POST',
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

async function get_shareRateChange(){
  return await fetch('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
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
  .then(res => {

    var tShareRateHEX = res.data.shareRateChanges[0].tShareRateHex;

    return parseFloat(parseFloat(tShareRateHEX).toFixed(4));
  });
}

async function get_dailyDataUpdate(){
  return await fetch('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
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
  .then(res => {

    var payout = res.data.dailyDataUpdates[0].payout;
    payout = payout.substring(0, payout.length - 8);

    var totalTshares = res.data.dailyDataUpdates[0].shares;
    totalTshares = totalTshares.substring(0, totalTshares.length - 12);

    return {
      dailyPayoutHEX: parseInt(payout),
      totalTshares: parseInt(totalTshares)
    }
  });
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

    count += 1;
    await sleep(100);
  }

  var averageStakeLength = stakedDaysSum/stakedCount;
  var averageStakeLengthYears = averageStakeLength / 365.0;

  return parseFloat(averageStakeLengthYears.toFixed(4));
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
    penaltiesSum += data.penalty;
    $lastStakeId = data.lastStakeId;

    count += 1;
    await sleep(100);
  }

  var $lastStakeId = 0;

  while (true) {
    var data = await get_stakeGoodAccountings($lastStakeId, unixTimestamp, unixTimestampEnd);
    if (data.count <= 0) { break; }
    stakeCount += data.count;
    penaltiesSum += data.penalty;
    $lastStakeId = data.lastStakeId;
    
    count += 1;
    await sleep(100);
  }

  var penaltyString = parseInt(penaltiesSum, 10).toString();
  penaltiesSum = penaltyString.substring(0, penaltyString.length - 8);

  return parseFloat(penaltiesSum);
}

async function get_stakeEnds($lastStakeId, unixTimestamp, unixTimestampEnd){
  return await fetch('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      query {
        stakeEnds(first: 1000, orderBy: stakeId, 
          where: { 
            stakeId_gt: "` + $lastStakeId + `",
            timestamp_gt: ` + unixTimestamp + `,
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
  return await fetch('https://api.thegraph.com/subgraphs/name/codeakk/hex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      query {
        stakeGoodAccountings(first: 1000, orderBy: stakeId, 
          where: { 
            stakeId_gt: "` + $lastStakeId + `",
            timestamp_gt: ` + unixTimestamp + `,
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
  return await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
    method: 'POST',
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
  return await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
    method: 'POST',
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
    var pairDayData = res.data.pairDayDatas[0];

    return {
      liquidityUV2_HEXETH: parseFloat(parseFloat(pairDayData.reserve0).toFixed(4)),
      liquidityUV2_ETH: parseFloat(parseFloat(pairDayData.reserve1).toFixed(4))
    }
  });
}

async function getUniswapV2HEXUSDC(){
  return await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
    method: 'POST',
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
    var pairDayData = res.data.pairDayDatas[0];

    return {
      liquidityUV2_HEXUSDC: parseFloat(parseFloat(pairDayData.reserve0).toFixed(4)),
      liquidityUV2_USDC: parseFloat(parseFloat(pairDayData.reserve1).toFixed(4))
    }
  });
}

async function getUniswapV2HEXDailyPrice(){
  return await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
    method: 'POST',
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
  return await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3', {
    method: 'POST',
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
  return await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3', {
    method: 'POST',
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

async function getUniswapV3() {
  //var pools = await getUniswapV3Pools();
  //await sleep(200);
  var pools = [ 
    UNISWAP_V3_HEXUSDC,
    UNISWAP_V3_HEXETH
  ]

  if (pools == undefined) {return;}

  return await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3', {
    method: 'POST',
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
      liquidityUV3_HEX: parseFloat(parseFloat(liquidityUV3_HEX).toFixed(4)),
      liquidityUV3_USDC: parseFloat(parseFloat(liquidityUV3_USDC).toFixed(4)),
      liquidityUV3_ETH: parseFloat(parseFloat(liquidityUV3_ETH).toFixed(4))
    }
  });
}
