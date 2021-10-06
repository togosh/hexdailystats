# hexdailystats

Website --- https://HEXDailyStats.com   
Telegram -- https://t.me/HEXDailyStats  

Twitter ----- https://twitter.com/HEXDailyStats  
Twitter ----- https://twitter.com/HEXDailyBot  

Purpose:   
To provide historical records of the hex ecosystem in daily snapshots throughout time.   
These records can be used for research and educational purposes.  

JSON API:  
https://gist.github.com/togosh/5ff8a9a51740f30c96b3ee013e44b798  

Data Sources:  
https://api.thegraph.com/subgraphs/name/codeakk/hex  
https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2  
https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3  
https://etherscan.io/token/0x2b591e99afe9f32eaa6214f7b7629768c40eeb39#readContract    

Documentation:  
https://codeakk.medium.com/hex-development-data-a1b1822446fa  
https://togosh.medium.com/hex-developer-guide-3b018a943a55  

=

Core Data:
- CurrentDay
- Staked and Circulating Supply
- Tshare Rate
- Total Tshares
- Average Stake Length
- Daily Payout
- Daily Penalties
- Uniswap V2 & V3, USDC & WETH pair liquidity
- Stakes and Holders

=  

How to Run:

1. Install Node  
https://nodejs.org/en/download/  

2. Request Etherscan API Key    
https://etherscan.io/apis 

3. Clone Code & Install Packages     
```
git clone https://github.com/togosh/hexdailystats.git
cd hexdailystats
npm install
```

4. Setup Config   
- Rename "config-default.json" to "config.json"
- Replace Etherescan API Key
- NOTE: urls.grabdata is url that manually runs daily data grabbing   

5. Create MongoDB Atlas Database and Install Compass   
https://www.mongodb.com/cloud/atlas      
https://www.mongodb.com/products/compass      

6. Start Server:  
```
node index.js
```

7. Stop Server   
`CTRL + C` or `sudo killall nodejs`   

8. Stop Server, Update it, and then Start it in a Forever Loop   
```
chmod +x update.sh
./update.sh
```

9. Setup Reboot  
```
chmod +x start.sh
sudo crontab -e
@reboot /home/hexdailystats/start.sh
```

10. Watch Log   
```
forever logs
tail -f /root/.forever/AAAA.log
```

=  

Mongo Compass - Filter Examples  
```
{currentDay: {$eq: 650}}
```

=

Join Dev Chat  
https://t.me/HEXcryptoDEV  

=

CRITICAL

- scaling issue (can only get 1,000 data objects from TheGraph at a time, if community 10x's may take 1.5 hours to get all stake and holder data)

- drifted data (Day 595+ data is drifted 5+ minutes past 00:00:00 UTC, historical functions exist need to switch and fix historical)

NEXT

- pulsechain (pHEX data table)   
https://t.me/PulseDev

- BTC and ETH prices   
https://min-api.cryptocompare.com/documentation?key=Historical&cat=dataHistoday


INTERESTING

- reverse penalties wall of shame

1. check for one 5555 day stake, easy

2. check for > 90% HEX staked, (sum staked / (balance + sum staked)) > 0.90

3. check for < 10% of HEX sold, (sum historical sold / (balance + sum staked)) < 0.10

ISSUE --- When HEX is sold, does that mean they are leaving the wallet? How do you know when someone sends HEX out to a 2nd address, they wont just sell it there? Assuming no chain analysis, HEX leaving is the same as it selling? Dont want to penalize people for moving HEX around, but not sure theres any other way

Can chase the move say zero to 1 or two levels and find a list of known contracts. Uni/1inch etc.

---- how to get full transaction history?

Web3js - Loop through all blocks   
https://ethereum.stackexchange.com/questions/25389/getting-transaction-history-for-a-particular-account/25460#25460   
https://github.com/ChainSafe/web3.js/issues/580#issuecomment-348282246   

Etherscan API   
https://github.com/elimu-ai/webapp/issues/1345#issuecomment-905477932   
https://docs.etherscan.io/api-endpoints/accounts#get-a-list-of-normal-transactions-by-address   

Infura API   
https://github.com/elimu-ai/webapp/issues/1345#issuecomment-905899453   

Pricings   
https://infura.io/pricing   
https://etherscan.io/apis#pricingSection   

4. restaking principal, does 2 and 3 pretty much cover this? as time goes on to continue satisfying 2 and 3 you have no choice but to restake? :)

Would have to find a same size or greater than principal stake started within some threshold (week/month) of endstake. 


POTENTIAL

- payout per tshare USD

- bshare columns (bshare price, bshare rate, increase in bshare rate, payout per bshare)

- percent change in payout per tshare

- average payout per tshare

- new stakes   
https://www.reddit.com/r/HEXcrypto/comments/plhx3b/locked_usd_grew_by_978_during_first_9_days_of/

- staked % of coins minus origin address

- bleeding stakes (Count, Avg days late, Avg percent, Total HEX, USD Value)

- staker leagues share and usd requirements

- amount USD to 2x, 10x price

- percent down from All Time High
