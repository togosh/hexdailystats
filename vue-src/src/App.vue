<template >
  <div id="app">
    <Dashboard v-if="settings == true"/>
  </div>
</template>

<script> 
import Dashboard from './components/Dashboard.vue'

export default {
  name: 'App',
  components: {
    Dashboard
  },
  data() {
      return {
          settings: false
      }
  },
  mounted() {
    this.settings = true;
  },
  setup () {
    
  }
}
</script>

<style>
  @import './assets/styles/darkmode.css';
</style>