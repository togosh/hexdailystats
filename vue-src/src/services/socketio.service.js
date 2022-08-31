import { io } from 'socket.io-client';

class SocketioService {
  socket;
  constructor() {}

  setupSocketConnection() {
    this.socket = io("http://127.0.0.1:3000/");
    this.socket.emit('my message', 'Hello there from Vue.');
  }

}

export default new SocketioService();