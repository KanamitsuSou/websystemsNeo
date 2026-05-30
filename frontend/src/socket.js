import { io } from 'socket.io-client';


const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://websystem1890908989-3.onrender.com';
export const socket = io(BACKEND_URL,{
  transports: ['websocket'] // 👈 フロント側にもこれを追加！（Pollingの挨拶をスキップさせる）
});