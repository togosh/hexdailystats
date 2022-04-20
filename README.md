# hexdailystats

Website --- https://HEXDailyStats.com   
Telegram -- https://t.me/HEXDailyStats  

Twitter ----- https://twitter.com/HEXDailyStats  
Twitter ----- https://twitter.com/HEXDailyBot  

Purpose: To provide historical records of the HEX ecosystem in daily snapshots throughout time  

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

Dev Chat:   
https://t.me/HEXcryptoDEV  

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
https://github.com/nodesource/distributions#debinstall  

2. Request Etherscan API Key    
https://etherscan.io/apis 

3. Clone Code & Install Packages     
```
git clone https://github.com/togosh/hexdailystats.git
cd hexdailystats
npm install
```

3.a. Install Forever
```
sudo npm install forever -g
```

4. Setup Config   
- Rename "config-default.json" to "config.json"
- Replace Etherescan API Key
- NOTE: urls.grabdata is url to grab multiple sets of data   
--- all current row data from database   
--- live data   
--- currency rates   
--- new daily data row   

5. Create MongoDB Atlas Database and Install Compass   
https://www.mongodb.com/cloud/atlas      
https://www.mongodb.com/products/compass      

6. Start Server  
```
node index.js
```

6.a. Grab Data   
Replace URL below with what is set in config.json for urls.grabdata   
`localhost:3000/URL`   
Use this command to initialize the servers data after every start in debug mode   

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
@reboot sleep 10 && cd /home/hexdailystats/ && ./start.sh
```
NOTE: Add >> /home/testing.txt 2>&1 to end of command to pipe output to file

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

TODO LIST  
https://t.me/HEXDailyStats/2978

=

INTERESTING IDEA - Reverse Penalties Wall of Shame  
https://t.me/HEXDailyStats/1504

=

Join Dev Chat!  
https://t.me/HEXcryptoDEV  
