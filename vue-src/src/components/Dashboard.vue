<template>
  <div>
    <Header @click="callAbout" @emit-result="callAbout"/> 
    <b-container fluid> 
      <b-row class="justify-content-md-center">
        <b-col md="auto">
            <b-row class="justify-content-md-center">
              <b-col md="auto">
                <b-img :src="require('../assets/images/hexdailystatsimage.jpg')" fluid alt="Responsive image"></b-img>
                <a href="https://t.me/HEXDailyStats" target="_blank"></a>
              </b-col>
            </b-row>
            <b-row class="justify-content-md-center">
              <b-col col class="d-none d-sm-block"></b-col>
              <b-col col sm="9">
                <div>
                  <LiveDataTable/> 
                </div> 
              </b-col>
              <b-col col class="d-none d-sm-block"></b-col>
            </b-row>
            <b-row>
              <b-col>
                <div v-if="showAbout">
                 <About/>
                </div>
              </b-col>
            </b-row>
        </b-col>  
      </b-row>
      <DailyStatTable /> 
    </b-container>
  </div>
</template>

<script>
import Header from './Header.vue' 
import DailyStatTable from './DailyStatTable.vue'
import LiveDataTable from './LiveDataTable.vue'
import About from './About.vue'

export default {
  name: 'Dashboard',
  components: {
    Header
    ,DailyStatTable
    ,LiveDataTable
    ,About
  }
  ,data() { 
    return { 
      showAbout: false
    }
  } 
  ,methods: {
    callAbout() {
       this.showAbout = !this.showAbout;
    }
  }
  ,mounted () { 
  }
}
</script>
