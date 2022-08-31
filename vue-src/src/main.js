import Vue from 'vue'
import App from './App.vue' 
import io from 'socket.io-client';
import { BootstrapVue, IconsPlugin } from 'bootstrap-vue' 
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css' 

Vue.use(BootstrapVue)
Vue.use(IconsPlugin)

let hostname = "http://127.0.0.1:3000/"; 
Vue.prototype.$socket = io(hostname);

new Vue({
  render: h => h(App),
}).$mount('#app')

Vue.use(BootstrapVue);
 
