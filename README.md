# hexdailystats

Website --- https://HEXDailyStats.com   
Telegram -- https://t.me/HEXDailyStats  
Twitter ----- https://twitter.com/HEXDailyStats  

Purpose:   
To provide historical records of the hex ecosystem in daily snapshots throughout time.   
These records can be used for research and educational purposes.  

Data Sources:  
https://api.thegraph.com/subgraphs/name/codeakk/hex  
https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2  
https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3  
https://etherscan.io/apis  

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

=  

How to Run:

A. Install Node  
https://nodejs.org/en/download/  

B. Request Etherscan API Key    
https://etherscan.io/apis 

C. Clone Code & Install Packages     
```
git clone https://github.com/togoshige/hexdailystats.git
cd hexdailystats
npm install
```

D. Setup Config   
- Rename "config-default.json" to "config.json"
- Replace Etherescan API Key

E. Start Server:  
```
node index.js
```

=  

HEXCryptoDev Chat  
https://t.me/HEXcryptoDEV  

HEX Dev   
https://hex.com/dev/   

HEX Community   
https://github.com/HexCommunity   

HEX REST APIs (Firebun)  
https://github.com/HexCommunity/HEX-APIs  

Subgraph (Codeak)  
https://codeakk.medium.com/hex-development-data-a1b1822446fa  

=  

Etherscan API  
https://etherscan.io/token/0x2b591e99afe9f32eaa6214f7b7629768c40eeb39#readContract  
https://etherscan.io/apis  
https://api.etherscan.io/apis  

eth_call  
https://etherscan.io/apis#proxy  

Keccak-256  
https://emn178.github.io/online-tools/keccak_256.htm  

data= First 8 charachters of the Keccak of the function signature  

Examples:  
currentDay() = 5c9302c9  
globalInfo() = f04b5fa0  

https://api.etherscan.io/api?module=proxy&action=eth_call&to=0x2b591e99afe9f32eaa6214f7b7629768c40eeb39&data=0x5c9302c9&apikey=XXX  

===  

Hexicans.info Contract Guide  
https://hexicans.info/documentation/contract-guide/#Functions  

HEX Contract in Laymans Terms (Kyle)  
https://docs.google.com/document/d/1P0ZDaBQx4ghkdX5IUwZb1n8ThvYf7i22MSt9Gm00JRU/edit#heading=h.fiw08inegua0  

Coinfabrik Economics Audit (page 5)  
https://hex.com/docs/HEX%20Economics%20Audit%20by%20CoinFabrik.pdf  

BasicUtilities (Kyle)  
https://gist.github.com/kbahr/f0eb6724e518c5616e8aff4b110cb8bc#file-basicutilities-js  

Nomics Price API  
https://api.nomics.com/v1/currencies/ticker?key=XXX&ids=HEX  

===  

https://staker.app/   
https://hex.vision/  
https://apphex.win/charts/  
https://hexgraphs.com/  

