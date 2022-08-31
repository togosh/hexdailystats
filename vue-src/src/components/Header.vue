<template>
    <b-navbar toggleable="lg" type="dark" variant="dark">
    <b-navbar-brand href="#">Day {{currentDay}}</b-navbar-brand>

    <b-navbar-toggle target="nav-collapse"></b-navbar-toggle>

    <b-collapse id="nav-collapse" is-nav>
      <b-navbar-nav>
        <b-nav-item v-on:click="selectedAbout">About</b-nav-item>
        <b-nav-item href="https://www.hex.com/">Hex.com</b-nav-item>
        <b-nav-item href="https://twitter.com/HEXDailyStats">Twitter</b-nav-item>
        <b-nav-item href="https://t.me/HEXDailyStats">Telegram</b-nav-item>
      </b-navbar-nav>

      <!-- Right aligned nav items -->
      <!-- <b-navbar-nav class="ml-auto">
        <b-nav-form>
          <b-form-input size="sm" class="mr-sm-2" placeholder="Search"></b-form-input>
          <b-button size="sm" class="my-2 my-sm-0" type="submit">Search</b-button>
        </b-nav-form>

        <b-nav-item-dropdown text="Test" right>
          <b-dropdown-item href="#">test1</b-dropdown-item>
          <b-dropdown-item href="#">test2</b-dropdown-item>
          <b-dropdown-item href="#">test3</b-dropdown-item>
          <b-dropdown-item href="#">test4</b-dropdown-item>
        </b-nav-item-dropdown>
      </b-navbar-nav> -->
    </b-collapse>
  </b-navbar>
</template>
 
 <script>
 export default {
  name: 'Dashboard',
  components: { 
  },
  data() {
      return { 
          currentDay: 0
      }
  }  
  ,beforeMount(){ 
    let vm = this;
    this.$socket.on('currentDay', (currentDayGlobal) => { 
      vm.currentDay = currentDayGlobal;
    }); 
  }
  ,methods:{
    selectedAbout () {
      this.$emit("emit-result")
    }
  }
}

 </script>
 <style>
  
 </style>