<template>
    <div style="padding:20px 60px 20px">
        <b-row class="pt-2" style="background-color: #10172d;" >
            <b-col>
                <h2 class="tcenter">LIVE DATA</h2>
                <b-table ref="table" responsive borderless :fields="fields" :items="items" :small="true"></b-table>
            </b-col> 
        </b-row> 
        <b-row class="mt-4 pt-2" style="background-color: #10172d;" >
            <b-col>
                <h2 class="tcenter">ETHEREUM</h2>
                <b-table ref="table" responsive borderless :fields="fieldsEth" :items="itemsEth" :small="true"></b-table>
            </b-col> 
     </b-row> 
  </div>
</template>

<script>  
    const format = (num, decimals) => Number(num).toLocaleString('en-US', {
        minimumFractionDigits: decimals,      
        maximumFractionDigits: decimals,
    }); 
    function nFormatter(num, digits) {
            let returnStr = "";
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

                 
                let amount = (num / item.value).toFixed(digits).replace(rx, "$1")
                let symbol = item.symbol
                
                returnStr = amount + symbol;
                return returnStr;
            } catch {
                return returnStr;
            }
    }
    let mergeItem = (items, newItem) => {
        items.forEach(i => {
            if(newItem.name == i.name){
                i.value = newItem.value;  
            } 
        }); 
    }
  export default {
    data() {
        return { 
            items: []
            ,fields: [
                {
                    key: 'name' 
                    ,label: ''
                    ,tdClass: 'tleft' 
                } 
                ,{
                    key: 'value' 
                    ,label: ''
                    ,tdClass: 'tright' 
                } 
            ]
            ,itemsEth: []
            ,fieldsEth: [
                {
                    key: 'name' 
                    ,label: ''
                    ,tdClass: 'tleft' 
                } 
                ,{
                    key: 'value' 
                    ,label: ''
                    ,tdClass: 'tright' 
                } 
            ]
        }
    } 
    // ,created: function () { 
    //     this.$socket.emit('needHexPrice');
    // }
    ,beforeMount(){ 
        let vm = this;
        vm.items = [
            { name: "HEX Price", value: 0}
            ,{ name: "T-Share Price", value: 0}
            ,{ name: "T-Share Rate", value: 0}
            ,{ name: "Payout per T-Share", value: 0}
            ,{ name: "Penalties", value: 0}
            ,{ name: "Liquidity HEX", value: 0}
            ,{ name: "Liquidity USDC", value: 0}
            ,{ name: "Liquidity ETH", value: 0}
        ]; 
        vm.itemsEth = [
            { name: "ETH Price", value: 0}
            ,{ name: "ERC20 Transfer", value: 0}
            ,{ name: "Uniswap Swap", value: 0}
            ,{ name: "Add Liquidity", value: 0}
            ,{ name: "Gas Price", value: 0}
        ]; 
        vm.$socket.on('hexPrice', (hexPrice) => {
            let obj =  { name: "HEX Price", value: format(hexPrice, 3) + " USD"};
            mergeItem(vm.items, obj);     
        });

        this.$socket.on('liveData', (liveData) => {
            let obj =  { name: "T-Share Price", value: format(liveData.tsharePrice, 0) + " USD"};
            mergeItem(vm.items, obj);  
            obj =  { name: "T-Share Rate", value: format(liveData.tshareRateHEX, 0) + " HEX"};
            mergeItem(vm.items, obj);  
            obj =  { name: "Payout per T-Share", value: format(liveData.payoutPerTshare, 3) + " HEX"};
            mergeItem(vm.items, obj);   
            obj =  { name: "Penalties", value: nFormatter(liveData.penaltiesHEX, 1) + " HEX" } //{ amount, symbol }
            mergeItem(vm.items, obj); 
            obj =  { name: "Liquidity HEX", value: nFormatter(liveData.liquidityHEX, 1) + " HEX"};
            mergeItem(vm.items, obj); 
            obj =  { name: "Liquidity USDC", value: nFormatter(liveData.liquidityUSDC, 1) + " USD"};
            mergeItem(vm.items, obj);    
            obj =  { name: "Liquidity ETH", value: nFormatter(liveData.liquidityETH, 1) + " ETH"};
            mergeItem(vm.items, obj);    
        });  
        // this.$socket.on('currencyRates', (currencyRates) => {
        //     
        // });   
        this.$socket.on('ethereumData', (ethereumData) => { 
            let obj = { name: "ETH Price", value: format(ethereumData.price, 0) + " USD"};
            mergeItem(vm.itemsEth, obj);  
            obj = { name: "ERC20 Transfer", value: format(ethereumData.erc20transfer, 0) + " USD"};
            mergeItem(vm.itemsEth, obj); 
            obj = { name: "Uniswap Swap", value: format(ethereumData.uniswapSwap, 0) + " USD"};
            mergeItem(vm.itemsEth, obj); 
            obj = { name: "Add Liquidity", value: format(ethereumData.addLiquidity, 0) + " USD"};
            mergeItem(vm.itemsEth, obj); 
            obj = { name: "Gas Price", value: format(ethereumData.gwei, 0) + " GWEI"};
            mergeItem(vm.itemsEth, obj);    
        });

    } 
    ,methods: {
        pingServer() { 
            this.socket.emit('my message', 'Hello t here from Vue.');
        }
      }
  }
  
</script>
 
<style> 
  .tcenter {
      text-align: center !important;
  }
  .tleft {
      text-align: left !important;
  }
  .tright {
      text-align: right !important;
  }
</style>