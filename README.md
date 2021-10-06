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
{isTestData: {$eq: true}}
{channelId: {$eq: "AAAAAAAAAAAAAA"}}
```

=

Join Dev Chat  
https://t.me/HEXcryptoDEV  


