const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const socketHandlers = require('./socketHandlers'); // ※別ファイルに分けている場合

// ーーーー ユーザー様が書いた完璧な設定（ここ！） ーーーー
const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  },
  transports: ['websocket']
});
// ーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 💡 2. 真ん中：通信が来たときの処理（元からあるゲームのロジック）
const rooms = {}; // 部屋のデータを保持
io.on('connection', (socket) => {
  console.log('ユーザーが接続しました:', socket.id);
  socketHandlers(io, socket, rooms); 
});

// 🚨 3. 一番下：Renderから指定されたPORT番号で待ち受ける！（超重要）
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
