const h = require('../Helpers/helpers');
const CONFIG = h.CONFIG;
const DEBUG = CONFIG.debug;
const log = h.log;

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
	if (CONFIG.twitter.enabled && !DEBUG && dailyStat){ //&& !objectHasNullProperties(dailyStat)){
	try {
    console.log("tweet() ---- ENABLED");
  log("tweet() ---- OBJECT");
  log(dailyStat);
  log("!objectHasNullProperties(dailyStat) --- " + !objectHasNullProperties(dailyStat));
	var mediaId = ''; 
  var tweetStatus = "";

  tweetStatus += "Day " + dailyStat.currentDay + "\r\n";
	tweetStatus += "\r\n";

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
	if (CONFIG.twitter.enabled && !DEBUG && dailyStat){ //&& !objectHasNullProperties(dailyStat)){
	try {
    console.log("tweetBshare() ---- ENABLED");
	var mediaId = ''; 
  var tweetStatus = "";

  tweetStatus += "Day " + dailyStat.currentDay + "\r\n";
	tweetStatus += "\r\n";

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

function objectHasNullProperties(obj) {
  for (var key in obj) {
      if (obj[key] === null || obj[key] === undefined || obj[key] == "")
          return true;
  }
  return false;
}

module.exports = { 
    tweet: async (dailyStat) => {
       return await tweet(dailyStat);
    }
    ,tweetBshare: async (dailyStat) => {
        return await tweetBshare(dailyStat);
     }
 }
 