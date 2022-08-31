<template>
    <div>
        <b-container fluid> 
            <b-row class="justify-content-md-center p-1 pt-5"> 
                <h5>
                    <span style="padding-right:5px;" class="font-weight-bold">About:</span>Created to keep historical records of the HEX ecosystem, for research, education and analysis 
                </h5> 
            </b-row>
            <b-row class="justify-content-md-center p-1">
                <h5>
                    <span style="padding-right:5px;" class="font-weight-bold">The Team:</span> Ryan and Togosh met randomly in Las Vegas at the 1st HEX Meetup!  
                </h5>
            </b-row>
            <b-row class="justify-content-md-center p-1">
                <b-col md="auto">
                    <b-row class="pb-5 pt-5">
                        <b-col >
                            <b-img :src="require('../assets/images/ryan.webp')" fluid alt=""></b-img>
                            <p class="text-center">
                                Ryan - Analyst
                            </p>
                            <p class="text-center">
                                 <a href="https://twitter.com/RyanHEXLife" target="_blank">Twitter</a> |  <a href="https://www.youtube.com/channel/UCOG0DRACT4EGseHvJ11Q3oQ" target="_blank">Youtube</a>
                            </p>
                        </b-col>
                        <b-col>
                            <b-img :src="require('../assets/images/togosh.webp')" fluid alt=""></b-img>
                             <p class="text-center">
                                Togosh - Developer
                            </p>
                            <p class="text-center">
                                 <a href="https://twitter.com/togoshigekata" target="_blank">Twitter</a> |  <a href="https://github.com/togosh" target="_blank">Youtube</a>
                            </p>
                        </b-col>
                    </b-row>
                    <b-row class="pb-5">
                        <b-col>
                            <b-img :src="require('../assets/images/codeak.jpg')" fluid alt=""></b-img>
                             <p class="text-center">
                                Codeak - Developer
                            </p>
                            <p class="text-center">
                                 <a href="https://codeakk.medium.com/hex-development-data-a1b1822446fa" target="_blank">Medium</a> |  <a href="https://github.com/codeakk" target="_blank">Github</a>
                            </p>
                        </b-col> 
                        <b-col>
                            <b-img :src="require('../assets/images/jose.jpg')" fluid alt="Responsive image"></b-img>
                             <p class="text-center">
                                Jose - Analyst
                            </p>
                            <p class="text-center">
                                <a href="https://www.reddit.com/user/hex_crypto_bull/" target="_blank">Reddit</a>
                            </p>
                        </b-col>
                    </b-row>
                </b-col>  
            </b-row>

        </b-container>
        
        <!-- <div><div class="text" style="max-width: 620px"><b>About:</b> Created to keep historical records of the HEX ecosystem, for research, education and analysis</div>
            <div class="text" style="max-width: 620px">
            <b>The Team:</b> Ryan and Togo met randomly in Las Vegas at the 1st HEX Meetup!</div></div>
        <div style="display: flex; justify-content: center; flex-wrap: wrap;">
            <div style="padding: 20px 40px">
                <a href="https://twitter.com/RyanHEXLife"><img width="300" src="ryan.webp"></img></a>
                <div class="text">Ryan - HEX Analyst
                    <a href="https://twitter.com/RyanHEXLife">Twitter</a> | 
                    <a href="https://www.youtube.com/channel/UCOG0DRACT4EGseHvJ11Q3oQ">Youtube</a>
                </div>
            </div>

            <div style="padding: 20px 40px">
                <a href="https://twitter.com/togoshigekata"><img width="300" src="togosh.webp"></img></a>
                <div class="text">Togo - HEX Developer 
                    <a href="https://twitter.com/togoshigekata">Twitter</a> |
                    <a href="https://github.com/togosh">Github</a>
                </div>
            </div>
        </div> -->
 
    </div>
</template>

<script>
export default {
    name: 'About',
    components: { 
    },
    data() { 
    }   
}

</script>
<style>

</style>