<template>
  <div>
    <b-table responsive class="tcenter" :sort-compare="mySortCompare" :fields="fields" :items="items" :per-page="perPage" :current-page="currentPage"></b-table>
    <b-pagination
        v-model="currentPage"
        :total-rows="rows"
        :per-page="perPage"
        aria-controls="my-table"
        page-class="customPage"
        >
    </b-pagination>
  </div>
</template>

<script> 
    const format = (num, decimals) => num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,      
        maximumFractionDigits: decimals,
    }); 

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
 
  export default {
    data() {
      return {
        socket: null
        ,fields: [
          {
            key: 'Day',
            sortable: true 
            ,thClass:"align-middle"
          }
          ,{
            key: 'Date',
            sortable: true
            ,thClass:"align-middle"
          }
          ,{
            key: 'Price_(USD)', 
            sortable: true 
            ,thClass:"align-middle"
          }
          ,{
            key: 'Price_Change_%_(USD)',
            sortable: true 
            ,thClass:"align-middle"
          }
          ,{
            key: 'ROI Multiplier from All Time Low',
            sortable: true,
            tdClass: 'green'
            ,thClass: 'green align-middle'
          },{
            key: 'Payout Per T-Share (HEX)',
            sortable: true,
            tdClass: 'pink'
            ,thClass: 'pink align-middle'
          },{
            key: 'T-Share Price (USD)',
            sortable: true,
            tdClass: 'pink'
            ,thClass: 'pink align-middle'
          },{
            key: 'T-Share Rate (HEX)',
            sortable: true,
            tdClass: 'pink'
            ,thClass: 'pink align-middle'
          },{
            key: 'Increase in  T-Share Rate (HEX)',
            sortable: true,
            tdClass: 'darkBlue'
            ,thClass: 'darkBlue align-middle'
          },{
            key: 'Avg Stake Length (Years)',
            sortable: true,
            tdClass: 'purple'
            ,thClass: 'purple align-middle'
          },{
            key: 'APY Rate (Yield + EES Penalties)',
            sortable: true,
            tdClass: 'purple'
            ,thClass: 'purple align-middle'
          },{
            key: 'Liquidity Pool (HEX)',
            sortable: true
            ,thClass:"align-middle" 
          },{
            key: 'Liquidity Pool (USDC)',
            sortable: true
            ,thClass:"align-middle" 
          },{
            key: 'Liquidity Pool (ETH)',
            sortable: true
            ,thClass:"align-middle" 
          },{
            key: 'Total Value Locked (USD)',
            sortable: true,
            tdClass: 'green'
            ,thClass: 'green align-middle'
          },{
            key: 'Market Cap (USD)',
            sortable: true
            ,thClass:"align-middle" 
          },{
            key: 'T-Share Market Cap (USD)',
            sortable: true,
            tdClass: 'pink'
            ,thClass: 'pink align-middle'
          },{
            key: 'T-Shares (SHARES)',
            sortable: true
            ,thClass:"align-middle" 
          },{
            key: 'Change in T-Shares (SHARES)',
            sortable: true,
            tdClass: 'darkBlue'
            ,thClass: 'darkBlue align-middle'
          },{
            key: 'Total Supply (HEX)',
            sortable: true
            ,thClass:"align-middle" 
          },{
            key: 'Minted Inflation (HEX)',
            sortable: true,
            tdClass: 'green'
            ,thClass: 'green align-middle'
          },{
            key: 'Circulating Supply (HEX)',
            sortable: true
            ,thClass:"align-middle" 
          },{
            key: 'Change in Circulating Supply (HEX)',
            sortable: true,
            tdClass: 'darkBlue'
            ,thClass: 'darkBlue align-middle'
          },{
            key: 'Staked Supply (HEX)',
            sortable: true
            ,thClass:"align-middle" 
          },{
            key: 'Change in Staked Supply (HEX)',
            sortable: true,
            tdClass: 'darkBlue'
            ,thClass: 'darkBlue align-middle'
          },{
            key: 'Staked Supply GA (HEX)',
            sortable: true
            ,thClass:"align-middle"
          },{
            key: 'Change in Staked Supply GA (HEX)',
            sortable: true,
            tdClass: 'darkBlue'
            ,thClass: 'darkBlue align-middle'
          },{
            key: 'Staked % of Coins',
            sortable: true
            ,thClass:"align-middle" 
          },{
            key: 'Payout (HEX)',
            sortable: true
            ,thClass:"align-middle" 
          },{
            key: 'Penalties (HEX)',
            sortable: true
            ,thClass:"align-middle" 
          },{
            key: 'Total Holders',
            sortable: true
            ,thClass:"align-middle" 
          },{
            key: 'Change in Total Holders',
            sortable: true,
            tdClass: 'darkBlue'
            ,thClass: 'darkBlue align-middle'
          },{
            key: 'Current Stakers',
            sortable: true,
            tdClass: 'purple'
            ,thClass: 'purple align-middle'
          },{
            key: 'Change in Current Stakers',
            sortable: true,
            tdClass: 'darkBlue'
            ,thClass: 'darkBlue align-middle'
          },{
            key: 'Total Stakers',
            sortable: true,
            tdClass: 'purple'
            ,thClass: 'purple align-middle'
          },{
            key: 'Change in Total Stakers',
            sortable: true,
            tdClass: 'darkBlue'
            ,thClass: 'darkBlue align-middle'
          },{
            key: 'Current Holders',
            sortable: true,
            tdClass: 'purple'
            ,thClass: 'purple align-middle'
          },{
            key: 'Change in Current Holders',
            sortable: true,
            tdClass: 'darkBlue'
            ,thClass: 'darkBlue align-middle'
          }
        ]
        ,items: [] 
        ,perPage: 25,
        currentPage: 1,
      }
    }
    ,methods: {
        mySortCompare(a, b, key) {
          try { 
            if(key === "Date"){
              var d1 = new Date(a[key]).getTime();
              var d2 = new Date(b[key]).getTime(); 
              return d1 - d2;
            }
            else{
              let compareA = Number(a[key].replace(/(?!-)\D/g,''));
              let compareB = Number(b[key].replace(/(?!-)\D/g,''));
              return compareA - compareB;
            }
           
          } 
          catch {
            return a[key] - b[key];
          }
        }
    }
    ,computed: {
      rows() {
        return this.items.length
      }
    }
    ,created: function () {
       if(this.items.length === 0) this.$socket.emit('needRowData')
    }
    ,beforeMount(){
         this.$socket.on('rowData', (data) => {

                let convertedData = [];
 
                data.forEach(item => {
                    let p = { 
                        Day: item[0]
                        ,get Date() {
                            var date = new Date(item[1]);
                            date.setDate(date.getDate() - 1);
                            var month = date.getUTCMonth() + 1;
                            return (month.toString().length > 1 ? month : "0" + month) + "/" + date.getUTCDate() + "/" + date.getUTCFullYear().toString().substr(-2);
                            
                        }
                        ,get "Price_(USD)"() {
                                return format(item[2], 5); 
                            } 
                        ,get "Price_Change_%_(USD)"(){ 
                            return format(item[3], 1) + "%"; 
                        } 
                        ,get "ROI Multiplier from All Time Low"() {
                            return format(item[4], 0) + "x"; 
                        } 
                        ,get "Payout Per T-Share (HEX)"(){
                            return format(item[5], 3);
                        }
                        ,get "T-Share Price (USD)"(){
                             return format(item[6], 0);
                        } 
                        ,get "T-Share Rate (HEX)"(){
                             return format(item[7], 1);
                        }
                        ,get "Increase in  T-Share Rate (HEX)"(){
                             return format(item[8], 1);
                        }   
                        ,get "Avg Stake Length (Years)"(){
                             return format(item[9], 2);
                        }
                        ,get "APY Rate (Yield + EES Penalties)"(){
                             return format(item[10], 2) + "%";
                        }
                        ,get "Liquidity Pool (HEX)"(){
                             return format(item[11], 0);
                        } 
                        ,get "Liquidity Pool (USDC)"(){
                             return format(item[12], 0);
                        } 
                        ,get "Liquidity Pool (ETH)"(){
                             return format(item[13], 0);
                        } 
                        ,get "Total Value Locked (USD)"(){
                            let { amount, symbol } = nFormatter(item[14], 2)
                            return "$" + format(Number(amount), 2) + symbol;
                        }
                        ,get "Market Cap (USD)"(){
                            let { amount, symbol } = nFormatter(item[15], 2)
                            return "$" + format(Number(amount), 2) + symbol;
                        }
                        ,get "T-Share Market Cap (USD)"(){
                            let { amount, symbol } = nFormatter(item[16], 2)
                            return "$" + format(Number(amount), 2) + symbol;
                        }
                        ,get "T-Shares (SHARES)"(){
                            return format(item[17], 0);
                        }
                        ,get "Change in T-Shares (SHARES)"(){
                            return format(item[18], 0);
                        }
                        ,get "Total Supply (HEX)"(){
                            return format(item[19], 0);
                        } 
                        ,get "Minted Inflation (HEX)"(){
                            return format(item[20], 0);
                        }
                        ,get "Circulating Supply (HEX)"(){
                            return format(item[21], 0);
                        } 
                        ,get "Change in Circulating Supply (HEX)"(){
                            return format(item[22], 0);
                        } 
                        ,get "Staked Supply (HEX)"(){
                            return format(item[23], 0);
                        }  
                        ,get "Change in Staked Supply (HEX)"(){
                            return format(item[24], 0);
                        }  
                        ,get "Staked Supply GA (HEX)"(){
                            return format(item[25], 0);
                        } 
                        ,get "Change in Staked Supply GA (HEX)"(){
                            return format(item[26], 0);
                        } 
                        ,get "Staked % of Coins"(){
                            return format(item[27], 2) + "%";
                        } 
                        ,get "Payout (HEX)"(){
                            return format(item[28], 0);
                        } 
                        ,get "Penalties (HEX)"(){
                            return format(item[29], 0);
                        } 
                        ,get "Total Holders"(){
                            return format(item[30], 0);
                        } 
                        ,get "Change in Total Holders"(){
                            return format(item[31], 0);
                        } 
                        ,get "Current Stakers"(){
                            return format(item[32], 0);
                        }  
                        ,get "Change in Current Stakers"(){
                            return format(item[33], 0);
                        }  
                        ,get "Total Stakers"(){
                            return format(item[34], 0);
                        } 
                        ,get "Change in Total Stakers"(){
                            return format(item[35], 0);
                        } 
                        ,get "Current Holders"(){
                            return format(item[36], 0);
                        } 
                        ,get "Change in Current Holders"(){
                            return format(item[37], 0);
                        } 
                    };
                    convertedData.push(p);
                });

                this.items = convertedData;
                this.$set(this.items, convertedData);
        }); 
    } 
  }
  
</script>
 
<style> 
    .purple {
        background-color: #843fff4d !important
    }
    thead .purple {
        background-color: #4d00ded9 !important;
    }
    .darkBlue {
        background-color:#4666FF4d !important;
    }
    thead .darkBlue {
        background-color: #0800609c !important;
    }
    .green {
        background-color: #00B0694d !important;
    }
    thead .green {
        background-color: #11ffa0c9 !important;
    }
    .pink {
        background-color: #f907ff52 !important;
    }

    thead .pink {
        background-color: #ff01ffab !important;
    }
    .customPage.page-item.active .page-link {
        background-color: white !important;
        border-color: white !important;
        color:black !important;
    }
    span.page-link {
        background-color: black !important;
    }
    button.page-link{
        background-color: black !important;
    }
    .tcenter {
      text-align: center !important;
  }
</style>