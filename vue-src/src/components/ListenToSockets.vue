<template>
  <div>
    <p v-if="isConnected">We're connected to the server!</p>
    <p>Message from server: "{{socketMessage}}"</p>
    <button @click="pingServer()">Ping Server</button>
  </div>
</template>

<script>
//importing the socket.io we installed
import io from 'socket.io-client';


export default { 
 
  data() {
    return {
        socket: io(),
        isConnected: false,
        socketMessage: ''
    }
  },

  sockets: {
    connect() {
      // Fired when the socket connects.
      this.isConnected = true;
    },

    disconnect() {
      this.isConnected = false;
    },

    // Fired when the server sends something on the "messageChannel" channel.
    messageChannel(data) {
      this.socketMessage = data
    }
  },

  methods: {
    pingServer() { 
        this.socket = io("http://127.0.0.1:3000/");  
        
        this.socket.on('my broadcast', (data) => {
            this.socketMessage = data;
        });

        this.socket.emit('my message', 'Hello there from Vue.');
  
    }
  }
}
</script>