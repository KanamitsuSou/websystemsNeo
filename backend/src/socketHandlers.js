// backend/src/socketHandlers.js (rooms未定義エラー完全解決版)
const GameEngine = require('./gameEngine');

const activeTimers = {};

module.exports = (io, socket, rooms) => {
  
  socket.on('join_room', ({ roomId, userName, requestedRole, userId }) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = new GameEngine();
    const game = rooms[roomId];

    const { role, seat } = game.joinRoom(socket.id, userName, requestedRole || 'player',userId);
    console.log(`[${role}] ${userName} が部屋 ${roomId} に入室。`);

    if (game.players.length === 4 && game.status === 'WAITING') {
      game.startGame();
      // 💡 修正: rooms をちゃんと関数に渡す！
      startServerTurnTimer(io, rooms, roomId, game);
    }
    broadcastState(io, roomId, game);
  });

  socket.on('cheat_exhaustive_draw', ({ roomId }) => {
    const game = rooms[roomId];
    if (!game) return;
    game.forceExhaustiveDraw();
    checkAndEnforceAutoNextRound(io, rooms, roomId, game);
  });

  socket.on('cheat_win_hand', ({ roomId }) => {
    const game = rooms[roomId];
    if (!game) return;
    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;
    game.forceSetupCheatHand(player.seat);
    checkAndEnforceAutoNextRound(io, rooms, roomId, game);
  });

  socket.on('discard_tile', ({ roomId, tileIndex }) => {
    const game = rooms[roomId];
    if (!game || (game.status !== 'PLAYING' && game.status !== 'PENDING_ACTION')) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    if (game.status === 'PENDING_ACTION') {
      const nextSeat = (game.currentTurn + 4) % 4; 
      if (player.seat === nextSeat) {
        game.pendingActions = [];
        game.status = 'PLAYING';
        game.currentTurn = nextSeat;
      } else {
        return;
      }
    }

    game.processDiscard(game.currentTurn, tileIndex);
    checkAndEnforceAutoNextRound(io, rooms, roomId, game);
  });

  socket.on('take_action', ({ roomId, action }) => {
    const game = rooms[roomId];
    if (!game || (game.status !== 'PLAYING' && game.status !== 'PENDING_ACTION')) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    const exactActionType = typeof action === 'object' ? action.type : action;

    if (exactActionType && exactActionType !== 'SKIP' && exactActionType !== 'PASS') {
      io.to(roomId).emit('action_effect', {
        seat: player.seat,
        actionType: exactActionType,
        playerName: player.name
      });
    }

    game.handleActionResponse(player.seat, action);
    checkAndEnforceAutoNextRound(io, rooms, roomId, game);
  });

  socket.on('next_round', ({ roomId }) => {
    const game = rooms[roomId];
    if (!game || game.status !== 'FINISHED') return;
    game.advanceToNextKyoku();
    startServerTurnTimer(io, rooms, roomId, game);
    broadcastState(io, roomId, game);
  });

  socket.on('reset_game', ({ roomId }) => {
    if (rooms[roomId]) delete rooms[roomId];
    if (activeTimers[roomId]) {
      clearInterval(activeTimers[roomId]);
      delete activeTimers[roomId];
    }
    io.to(roomId).emit('room_reset_enforced');
  });
};

// 💡 修正: 引数に「rooms」を追加し、内部で rooms[roomId] を安全に参照できるように大手術！
function checkAndEnforceAutoNextRound(io, rooms, roomId, game) {
  if (game.status === 'FINISHED') {
    if (activeTimers[roomId]) clearInterval(activeTimers[roomId]);
    if (game.nextRoundTimeout) clearTimeout(game.nextRoundTimeout);

    console.log(`[BROADCAST] 決着！精算画面を全員に送信します。8秒後に次局へ進みます。`);
    broadcastState(io, roomId, game);

    game.nextRoundTimeout = setTimeout(() => {
      // 🚨 今回のエラー原因はここでした。引数に rooms を追加したことで100%解決！
      if (rooms && rooms[roomId] && rooms[roomId].status === 'FINISHED') {
        rooms[roomId].advanceToNextKyoku();
        startServerTurnTimer(io, rooms, roomId, rooms[roomId]);
        broadcastState(io, roomId, rooms[roomId]);
      }
    }, 8000); 
  } else {
    startServerTurnTimer(io, rooms, roomId, game);
    broadcastState(io, roomId, game);
  }
}

// 💡 修正: ここも引数に「rooms」を追加し、内部の呼び出しリレーが途切れないようにする！
function startServerTurnTimer(io, rooms, roomId, game) {
  if (activeTimers[roomId]) clearInterval(activeTimers[roomId]);

  activeTimers[roomId] = setInterval(() => {
    if (game.status === 'FINISHED' || game.status === 'GAME_OVER' || game.status === 'WAITING') {
      clearInterval(activeTimers[roomId]);
      return;
    }

    if (Date.now() >= game.turnExpiryTime) {
      if (game.status === 'PENDING_ACTION') {
        game.pendingActions.forEach(a => {
          if (a.choice === null) game.handleActionResponse(a.seat, 'PASS');
        });
      } else if (game.status === 'PLAYING') {
        const seat = game.currentTurn;
        const lastIndex = game.hands[seat].length - 1;
        game.processDiscard(seat, lastIndex);
      }
      checkAndEnforceAutoNextRound(io, rooms, roomId, game);
    }
  }, 1000);
}

function broadcastState(io, roomId, game) {
  game.players.forEach(p => { io.to(p.id).emit('game_state', game.getStateForClient(p.id)); });
  game.spectators.forEach(s => { io.to(s.id).emit('game_state', game.getStateForClient(s.id)); });
}