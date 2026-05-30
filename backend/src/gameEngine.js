// backend/src/gameEngine.js (送信漏れ完全解決・最終決定版)
const e = require('express');
const Riichi = require('riichi');

class GameEngine {
  constructor() {
    this.players = [];    
    this.spectators = []; 
    this.status = 'WAITING';
    
    this.scores = { 0: 25000, 1: 25000, 2: 25000, 3: 25000 }; 
    this.winds = { 0: '東', 1: '南', 2: '西', 3: '北' };      
    this.bakaze = '東';  
    this.kyoku = 1;      
    this.honba = 0;      
    this.kyoutaku = 0;   
    this.oya = 0;        
    
    this.wall = [];
    this.rinshanWall = []; 
    this.hands = { 0: [], 1: [], 2: [], 3: [] };
    this.melds = { 0: [], 1: [], 2: [], 3: [] }; 
    this.discards = { 0: [], 1: [], 2: [], 3: [] }; 
    this.currentTurn = 0; 
    this.doraIndicators = [];
    
    this.pendingActions = []; 
    this.lastDiscard = null;
    this.riichiDeclared = { 0: false, 1: false, 2: false, 3: false };
    this.pendingRiichi = { 0: false, 1: false, 2: false, 3: false };
    this.endResult = null; 
    this.nextRenchanFlag = false; 
    this.turnExpiryTime = 0;
  }

  isWinningHandParams(baseHand, melds, extraTile = '') {
    const combined = [...baseHand];
    if (extraTile) combined.push(extraTile);

    const counts = {};
    combined.forEach(t => { if(t) counts[t] = (counts[t] || 0) + 1; });

    let exactPairs = 0;
    Object.values(counts).forEach(c => { if (c === 2) exactPairs++; });
    if (exactPairs === 7) return true; 

    const yaochu = ['m1','m9','p1','p9','s1','s9','z1','z2','z3','z4','z5','z6','z7'];
    let hasAll = true;
    let hasPair = false;
    yaochu.forEach(y => {
      if (!counts[y]) hasAll = false;
      else if (counts[y] >= 2) hasPair = true;
    });
    if (hasAll && hasPair) return true; 

    let setsNeeded = 4 - melds.length;

    const check = (c_counts, sets, pairs) => {
      if (sets === 0 && pairs === 0) return true;
      let tile = Object.keys(c_counts).find(k => c_counts[k] > 0);
      if (!tile) return false;

      if (pairs > 0 && c_counts[tile] >= 2) {
        c_counts[tile] -= 2;
        if (check(c_counts, sets, pairs - 1)) return true;
        c_counts[tile] += 2;
      }
      if (sets > 0 && c_counts[tile] >= 3) {
        c_counts[tile] -= 3;
        if (check(c_counts, sets - 1, pairs)) return true;
        c_counts[tile] += 3;
      }
      if (sets > 0 && tile[0] !== 'z') {
        let num = parseInt(tile[1]);
        let t2 = tile[0] + (num + 1);
        let t3 = tile[0] + (num + 2);
        if (c_counts[t2] > 0 && c_counts[t3] > 0) {
          c_counts[tile]--; c_counts[t2]--; c_counts[t3]--;
          if (check(c_counts, sets - 1, pairs)) return true;
          c_counts[tile]++; c_counts[t2]++; c_counts[t3]++;
        }
      }
      return false;
    };
    return check(counts, setsNeeded, 1);
  }

  isWinningHand(seat, extraTile = '') {
    return this.isWinningHandParams(this.hands[seat], this.melds[seat], extraTile);
  }

  getTenpaiWaits(seat) {
    const hand = this.hands[seat];
    const melds = this.melds[seat];
    const allTiles = ['m1','m2','m3','m4','m5','m6','m7','m8','m9','p1','p2','p3','p4','p5','p6','p7','p8','p9','s1','s2','s3','s4','s5','s6','s7','s8','s9','z1','z2','z3','z4','z5','z6','z7'];
    const waits = new Set();

    if (hand.length % 3 === 2) { 
        const uniqueHandTiles = [...new Set(hand)];
        for (let discardTile of uniqueHandTiles) {
            const testHand = [...hand];
            testHand.splice(testHand.indexOf(discardTile), 1);
            for (let waitTile of allTiles) {
                if (this.isWinningHandParams(testHand, melds, waitTile)) {
                    waits.add(waitTile); 
                }
            }
        }
    } else { 
        for (let waitTile of allTiles) {
            if (this.isWinningHandParams(hand, melds, waitTile)) {
                waits.add(waitTile);
            }
        }
    }
    return Array.from(waits);
  }

  cacheAllPlayersReadyState() {
    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[i];
      player.waitingTiles = this.getTenpaiWaits(player.seat);
      player.isReady = player.waitingTiles.length > 0;
      const myPastDiscards = this.discards[player.seat].map(d => d.tile);
      player.furiten = player.waitingTiles.some(wTile => myPastDiscards.includes(wTile));
    }
  }

  getSuitCounts(seat, extraTile = '') {
    const combined = [...this.hands[seat]];
    if (extraTile) combined.push(extraTile);
    this.melds[seat].forEach(meld => combined.push(...meld));
    const counts = { m: 0, p: 0, s: 0, z: 0 };
    combined.forEach(t => { if (t && t[0] && counts[t[0]] !== undefined) counts[t[0]]++; });
    return counts;
  }

  safeCalcRiichi(handStr) {
    try { return new Riichi(handStr).calc(); } catch (e) { return null; }
  }

  convertToRiichiStr(seat, extraTile = '') {
    const myHandTiles = [...this.hands[seat]];
    if (extraTile) myHandTiles.push(extraTile);

    const handTilesObj = { m: [], p: [], s: [], z: [] };
    myHandTiles.forEach(t => { if(t && t[0]) handTilesObj[t[0]].push(t[1]); });
    
    let riichiStr = '';
    ['m', 'p', 's', 'z'].forEach(suit => {
      if (handTilesObj[suit].length > 0) riichiStr += handTilesObj[suit].sort().join('') + suit;
    });

    this.melds[seat].forEach(meld => {
      const meldTilesObj = { m: [], p: [], s: [], z: [] };
      meld.forEach(t => { if(t && t[0]) meldTilesObj[t[0]].push(t[1]); });
      let meldStr = '';
      ['m', 'p', 's', 'z'].forEach(suit => {
        if (meldTilesObj[suit].length > 0) meldStr += meldTilesObj[suit].sort().join('') + suit;
      });
      if (meldStr) riichiStr += '+' + meldStr;
    });

    return riichiStr;
  }

  analyzeHandSpecs(seat, extraTile = '') {
    const combined = [...this.hands[seat]];
    if (extraTile) combined.push(extraTile);
    this.melds[seat].forEach(meld => combined.push(...meld));

    const suits = new Set();
    let hasZi = false;
    let hasYaochu = false;
    const counts = {};

    combined.forEach(t => {
      if (!t) return;
      counts[t] = (counts[t] || 0) + 1;
      const suit = t[0];
      const num = parseInt(t[1]);
      if (suit === 'z') { hasZi = true; hasYaochu = true; } 
      else { suits.add(suit); if (num === 1 || num === 9) hasYaochu = true; }
    });

    let yaku = [];
    let han = 0;
    let fu = 30;

    if (suits.size === 1) {
      if (!hasZi) { yaku.push('清一色'); han += 5; } 
      else { yaku.push('混一色'); han += 2; } 
    }

    let kotsuCount = this.melds[seat].length;
    let pairCount = 0;
    const handCounts = {};
    this.hands[seat].forEach(t => { if(t) handCounts[t] = (handCounts[t] || 0) + 1; });
    if (extraTile) handCounts[extraTile] = (handCounts[extraTile] || 0) + 1;
    
    Object.values(handCounts).forEach(c => { 
      if (c >= 3) kotsuCount++; 
      if (c === 2) pairCount++;
    });

    if (pairCount === 7) { yaku.push('七対子'); han += 2; fu = 25; }
    if (kotsuCount >= 4) { yaku.push('対々和'); han += 2; fu = 40; }
    if (!hasYaochu) { yaku.push('断幺九'); han += 1; }

    let ankouCount = 0;
    Object.values(handCounts).forEach(c => { if (c >= 3) ankouCount++; });
    if (ankouCount === 3) { yaku.push('三暗刻'); han += 2; }

    if ((counts['z5'] || 0) >= 3) { yaku.push('役牌'); han += 1; } 
    if ((counts['z6'] || 0) >= 3) { yaku.push('役牌'); han += 1; } 
    if ((counts['z7'] || 0) >= 3) { yaku.push('役牌'); han += 1; } 

    if (this.melds[seat].length === 0 && kotsuCount >= 4 && extraTile === '') {
      yaku = ['四暗刻'];
      if (suits.size === 1 && !hasZi) yaku.push('清一色');
      return { yaku, points: (seat === this.oya) ? 48000 : 32000, text: "役満", han: 13, fu: 40 };
    }

    if (yaku.length === 0) yaku.push('ドラ');

    let points = 2000;
    let text = "アガリ";
    if (han >= 13) { points = (seat === this.oya) ? 48000 : 32000; text = "役満"; han = 13; }
    else if (han >= 11) { points = (seat === this.oya) ? 36000 : 24000; text = "三倍満"; }
    else if (han >= 8) { points = (seat === this.oya) ? 24000 : 16000; text = "倍満"; }
    else if (han >= 6) { points = (seat === this.oya) ? 18000 : 12000; text = "跳満"; }
    else if (han >= 3) { points = (seat === this.oya) ? 12000 : 8000; text = "満貫"; }
    else { points = (seat === this.oya) ? 5800 : 3900; }

    return { yaku, points, text, han, fu };
  }


  joinRoom(id, name, requestedRole) {
    const existingPlayer = this.players.find(p => p.userId === userID);
    if (existingPlayer){
      existingPlayer.id = id;
      existingPlayer.name = name;
      return { role : 'player', seat:existingPlayer,seat};

    }
    const existingSpec = this.spectators.find(s => s.userId === userId);
    if(existingSpec){
      existingSpec.id = id;
      existingSpec.name = name;
      return {role : 'spectator', seat : null};
    }
    if (requestedRole === 'player' && this.players.length < 4 && this.status === 'WAITING'){
      const seat = this.players.length;
      this.players.push({ id, userId, seat, name, furiten: false, isReady: false, waitingTiles: []});
      return { role: 'player', seat: null};
    }
  }

  startGame() {
    this.status = 'PLAYING';
    this.currentTurn = this.oya; 
    this.updateWinds();          
    this.buildWall();
    this.dealTiles();
    this.doraIndicators.push(this.wall.pop()); 
    this.executeTurnStart();
  }

  updateWinds() {
    const windOrder = ['東', '南', '西', '北'];
    for (let i = 0; i < 4; i++) {
      const relativeSeat = (i - this.oya + 4) % 4;
      this.winds[i] = windOrder[relativeSeat];
    }
  }

  buildWall() {
    const suits = ['m', 'p', 's'];
    const wall = [];
    suits.forEach(suit => {
      for (let i = 1; i <= 9; i++) { for (let j = 0; j < 4; j++) wall.push(`${suit}${i}`); }
    });
    for (let i = 1; i <= 7; i++) { for (let j = 0; j < 4; j++) wall.push(`z${i}`); }
    this.wall = wall.sort(() => Math.random() - 0.5);
    this.rinshanWall = this.wall.splice(0, 4); 
  }

  dealTiles() {
    for (let i = 0; i < 4; i++) { this.hands[i] = this.wall.splice(0, 13).sort(); }
  }

  resetTimerTimestamp() {
    this.turnExpiryTime = Date.now() + 30000; 
  }

  executeTurnStart() {
    this.resetTimerTimestamp();
    
    if (this.wall.length <= 9) { 
      this.processExhaustiveDraw(); 
      return; 
    }

    const seat = this.currentTurn;
    const tile = this.wall.pop(); 
    this.hands[seat].push(tile); 
    this.lastDiscard = null;
    this.pendingActions = [];

    const isPhysicalWin = this.isWinningHand(seat);
    
    const counts = this.getSuitCounts(seat);
    let isLibraryWin = false;
    if (counts.m < 9 && counts.p < 9 && counts.s < 9) {
      const handStr = this.convertToRiichiStr(seat);
      const analysis = this.safeCalcRiichi(handStr);
      if (analysis && analysis.isAgari) isLibraryWin = true;
    }

    if (isPhysicalWin || isLibraryWin) { 
      this.pendingActions.push({ seat, type: 'TSUMO', tile, priority: 4, choice: null }); 
    }

    this.cacheAllPlayersReadyState();

    const isMenzen = this.melds[seat].length === 0;
    const playerObj = this.players.find(p => p.seat === seat);
    
    if (!this.riichiDeclared[seat] && isMenzen && this.scores[seat] >= 1000 && playerObj && !playerObj.furiten) {
      if (playerObj.isReady) { 
        this.pendingActions.push({ seat, type: 'RIICHI', tile: null, priority: 1, choice: null }); 
      }
    }
    
    if (!this.riichiDeclared[seat] && this.pendingActions.length === 0) {
      const tileCounts = {};
      this.hands[seat].forEach(t => tileCounts[t] = (tileCounts[t] || 0) + 1);
      Object.entries(tileCounts).forEach(([t, count]) => {
        if (count === 4) this.pendingActions.push({ seat, type: 'KAN', tile: t, priority: 2, choice: null });
      });
    }
    this.status = this.pendingActions.length > 0 ? 'PENDING_ACTION' : 'PLAYING';
  }

  processDiscard(seat, tileIndex) {
    if (tileIndex < 0 || tileIndex >= this.hands[seat].length) return;
    this.resetTimerTimestamp();

    const tile = this.hands[seat].splice(tileIndex, 1)[0];
    this.hands[seat].sort();
    this.lastDiscard = tile;
    this.pendingActions = [];

    let isRotated = false;
    if (this.pendingRiichi[seat]) {
      isRotated = true; 
      this.pendingRiichi[seat] = false; 
      this.riichiDeclared[seat] = true;
      this.scores[seat] -= 1000; 
      this.kyoutaku += 1;
    }
    this.discards[seat].push({ tile, rotated: isRotated });

    this.cacheAllPlayersReadyState();

    this.players.forEach(p => {
      if (p.seat === seat) return; 
      const otherSeat = p.seat;
      const isOtherPhysicalWin = this.isWinningHand(otherSeat, tile);

      if ((p.isReady && !p.furiten && p.waitingTiles && p.waitingTiles.includes(tile)) || isOtherPhysicalWin) {
        this.pendingActions.push({ seat: otherSeat, type: 'RON', tile, priority: 3, choice: null });
      }

      if (!this.riichiDeclared[otherSeat]) {
        const otherHand = this.hands[otherSeat];
        const sameTilesCount = otherHand.filter(t => t === tile).length;
        if (sameTilesCount >= 2) { this.pendingActions.push({ seat: otherSeat, type: 'PON', tile, priority: 2, choice: null }); }
        
        const isUpperSeat = (seat + 1) % 4 === otherSeat; 
        if (isUpperSeat && tile[0] !== 'z') {
          const suit = tile[0]; const num = parseInt(tile[1]); const hasTile = (n) => otherHand.includes(`${suit}${n}`);
          if (hasTile(num - 1) && hasTile(num + 1)) { this.pendingActions.push({ seat: otherSeat, type: 'CHI', tile, priority: 1, choice: null, combination: [`${suit}${num-1}`, `${suit}${num+1}`] }); }
          else if (hasTile(num - 2) && hasTile(num - 1)) { this.pendingActions.push({ seat: otherSeat, type: 'CHI', tile, priority: 1, choice: null, combination: [`${suit}${num-2}`, `${suit}${num-1}`] }); }
          else if (hasTile(num + 1) && hasTile(num + 2)) { this.pendingActions.push({ seat: otherSeat, type: 'CHI', tile, priority: 1, choice: null, combination: [`${suit}${num+1}`, `${suit}${num+2}`] }); }
        }
      }
    });

    if (this.pendingActions.length > 0) { 
      this.status = 'PENDING_ACTION'; 
    } else { 
      this.status = 'PLAYING'; 
      this.nextTurn(); 
    }
  }

  processKan(seat, tile) {
    this.hands[seat] = this.hands[seat].filter(t => t !== tile);
    this.melds[seat].push([tile, tile, tile, tile]);
    if (this.rinshanWall.length > 0) { this.hands[seat].push(this.rinshanWall.pop()); }
    if (this.wall.length > 0) { this.doraIndicators.push(this.wall.pop()); }
    this.hands[seat].sort(); this.status = 'PLAYING'; this.executeTurnStart(); 
  }

  nextTurn() { this.currentTurn = (this.currentTurn + 1) % 4; this.executeTurnStart(); }

  handleActionResponse(seat, actionParam) {
    if (this.status !== 'PENDING_ACTION') return;
    this.resetTimerTimestamp();

    let actionType = typeof actionParam === 'object' ? (actionParam.type === 'SKIP' ? 'PASS' : actionParam.type) : actionParam;

    if (this.lastDiscard === null && this.currentTurn === seat) {
      if (actionType === 'PASS') { this.status = 'PLAYING'; this.pendingActions = []; return; }
      if (actionType === 'RIICHI') { this.pendingRiichi[seat] = true; this.status = 'PLAYING'; this.pendingActions = []; return; }
      if (actionType === 'TSUMO') { this.processAgari(seat, null, true); this.pendingActions = []; return; }
      if (actionType === 'KAN') {
        const tileCounts = {}; this.hands[seat].forEach(t => tileCounts[t] = (tileCounts[t] || 0) + 1);
        const targetTile = Object.keys(tileCounts).find(t => tileCounts[t] === 4);
        if (targetTile) this.processKan(seat, targetTile);
        this.pendingActions = []; return;
      }
    } 

    const action = this.pendingActions.find(a => a.seat === seat);
    if (!action) return;

    if (actionType === 'PASS') {
      action.choice = 'PASS';
      const allPassed = this.pendingActions.every(a => a.choice === 'PASS');
      if (allPassed) { this.pendingActions = []; this.status = 'PLAYING'; this.nextTurn(); }
      return;
    }

    const tile = action.tile;
    this.pendingActions = []; 

    if (actionType === 'RON') { this.processAgari(seat, this.currentTurn, false); } 
    else if (actionType === 'PON') {
      let deletedCount = 0;
      this.hands[seat] = this.hands[seat].filter(t => { if (t === tile && deletedCount < 2) { deletedCount++; return false; } return true; });
      this.melds[seat].push([tile, tile, tile]); this.currentTurn = seat; this.status = 'PLAYING'; this.lastDiscard = null;
    } else if (actionType === 'CHI' && action.combination) {
      action.combination.forEach(cTile => { const idx = this.hands[seat].indexOf(cTile); if (idx !== -1) this.hands[seat].splice(idx, 1); });
      this.melds[seat].push([...action.combination, tile].sort()); this.currentTurn = seat; this.status = 'PLAYING'; this.lastDiscard = null;
    }
  }

  processExhaustiveDraw() {
    this.status = 'FINISHED';
    const tempaiPlayers = [];
    const notenPlayers = [];
    
    for (let i = 0; i < 4; i++) {
      const p = this.players.find(pl => pl.seat === i);
      if (p && p.isReady) tempaiPlayers.push(i);
      else notenPlayers.push(i);
    }

    if (tempaiPlayers.length === 1) { tempaiPlayers.forEach(p => this.scores[p] += 3000); notenPlayers.forEach(p => this.scores[p] -= 1000); }
    else if (tempaiPlayers.length === 2) { tempaiPlayers.forEach(p => this.scores[p] += 1500); notenPlayers.forEach(p => this.scores[p] -= 1500); }
    else if (tempaiPlayers.length === 3) { tempaiPlayers.forEach(p => this.scores[p] += 1000); notenPlayers.forEach(p => this.scores[p] -= 3000); }
    
    this.nextRenchanFlag = tempaiPlayers.includes(this.oya);
    this.endResult = { 
      winnerName: "流局", winnerWind: "荒", loserName: null, isTsumo: false, points: 0, yakuList: ["ノーテン罰符精算"], 
      rankName: this.nextRenchanFlag ? "親連荘" : "親移動", scores: { ...this.scores } 
    };
  }

  processAgari(winnerSeat, loserSeat, isTsumo) {
    this.status = 'FINISHED';
    const handStr = this.convertToRiichiStr(winnerSeat, isTsumo ? '' : this.lastDiscard);
    const counts = this.getSuitCounts(winnerSeat, isTsumo ? '' : this.lastDiscard);
    
    let totalPoints = 8000; 
    let yakuList = [];
    let rankName = "";

    if (counts.m < 9 && counts.p < 9 && counts.s < 9) {
      const calc = this.safeCalcRiichi(handStr);
      if (calc && calc.isAgari) {
        totalPoints = calc.ten || 8000;
        yakuList = calc.yaku ? Object.keys(calc.yaku) : ["役あり"];
        const textStr = calc.text ? calc.text.split(')')[0].replace('(', '') : "アガリ";
        rankName = `${textStr}（${calc.han || 1}翻 ${calc.fu || 30}符）`;
      }
    } else {
      const specs = this.analyzeHandSpecs(winnerSeat, isTsumo ? '' : this.lastDiscard);
      totalPoints = specs.points;
      yakuList = specs.yaku;
      rankName = `${specs.text}（${specs.han}翻 ${specs.fu}符）`;
    }

    let honbaPoints = this.honba * 300; 

    if (isTsumo) {
      if (winnerSeat === this.oya) {
        let childPay = Math.ceil((totalPoints / 3) / 100) * 100;
        let perChildHonba = this.honba * 100;
        this.players.forEach(p => {
          if (p.seat === winnerSeat) return;
          this.scores[p.seat] -= (childPay + perChildHonba);
          this.scores[winnerSeat] += (childPay + perChildHonba);
        });
      } else {
        let oyaPay = Math.ceil((totalPoints / 2) / 100) * 100;
        let childPay = Math.ceil((totalPoints / 4) / 100) * 100;
        let perPersonHonba = this.honba * 100;
        this.players.forEach(p => {
          if (p.seat === winnerSeat) return;
          let pay = (p.seat === this.oya) ? oyaPay : childPay;
          this.scores[p.seat] -= (pay + perPersonHonba);
          this.scores[winnerSeat] += (pay + perPersonHonba);
        });
      }
    } else {
      this.scores[loserSeat] -= (totalPoints + honbaPoints);
      this.scores[winnerSeat] += (totalPoints + honbaPoints);
    }
    
    this.scores[winnerSeat] += this.kyoutaku * 1000; 
    this.kyoutaku = 0;
    this.nextRenchanFlag = (winnerSeat === this.oya);

    this.endResult = {
      winnerName: this.players.find(p => p.seat === winnerSeat)?.name || "NPC",
      winnerWind: this.winds[winnerSeat],
      loserName: isTsumo ? null : this.players.find(p => p.seat === loserSeat)?.name || "NPC",
      isTsumo, points: totalPoints, yakuList, rankName, scores: { ...this.scores }
    };
  }

  advanceToNextKyoku() {
    this.status = 'PLAYING';
    this.oya = this.nextRenchanFlag ? this.oya : (this.oya + 1) % 4;
    this.honba = this.nextRenchanFlag ? this.honba + 1 : 0;
    if (!this.nextRenchanFlag) this.kyoku += 1;
    
    const hasTobi = Object.values(this.scores).some(s => s < 0);
    if (this.kyoku > 4 || hasTobi) { this.status = 'GAME_OVER'; return; }

    this.updateWinds(); 
    this.wall = [];
    this.rinshanWall = [];
    this.hands = { 0: [], 1: [], 2: [], 3: [] };
    this.melds = { 0: [], 1: [], 2: [], 3: [] };
    this.discards = { 0: [], 1: [], 2: [], 3: [] };
    this.currentTurn = this.oya; 
    this.doraIndicators = [];
    this.pendingActions = [];
    this.lastDiscard = null;
    this.riichiDeclared = { 0: false, 1: false, 2: false, 3: false };
    this.pendingRiichi = { 0: false, 1: false, 2: false, 3: false };
    this.endResult = null;

    this.players.forEach(p => {
      p.isReady = false;
      p.waitingTiles = [];
      p.furiten = false;
    });

    this.buildWall();
    this.dealTiles();
    this.doraIndicators.push(this.wall.pop());
    this.executeTurnStart();
  }

  getStateForClient(playerId) {
    const player = this.players.find(p => p.id === playerId);
    const isSpectator = !player || this.spectators.some(s => s.id === playerId);

    let myActions = [];
    if (player && this.status === 'PENDING_ACTION') {
      const playerActions = this.pendingActions.filter(a => a.seat === player.seat);
      myActions = playerActions.map(a => a.type);
      if (myActions.length > 0) myActions.push('PASS'); 
    }

    const seatNames = { 0: 'NPC', 1: 'NPC', 2: 'NPC', 3: 'NPC' };
    this.players.forEach(p => { seatNames[p.seat] = p.name; });

    return {
      status: this.status,
      bakaze: this.bakaze,
      kyoku: this.kyoku,
      honba: this.honba,
      kyoutaku: this.kyoutaku,
      doraIndicators: this.doraIndicators,
      wallCount: this.wall.length, 
      currentTurn: this.currentTurn,
      scores: this.scores,
      winds: this.winds,
      mySeat: player ? player.seat : -1,
      myActions: myActions, 
      turnExpiryTime: this.turnExpiryTime, 
      seatNames: seatNames,               
      myHand: isSpectator ? null : (player ? this.hands[player.seat] : []),
      allHands: isSpectator ? this.players.map(p => ({ seat: p.seat, hand: this.hands[p.seat] })) : null,
      myMelds: isSpectator ? [] : (player ? this.melds[player.seat] : []),
      discards: this.discards,
      others: [0, 1, 2, 3].map(seat => {
        const p = this.players.find(pl => pl.seat === seat);
        return { seat: seat, name: seatNames[seat], handCount: this.hands[seat] ? this.hands[seat].length : 0, melds: this.melds[seat] || [], isRiichi: this.riichiDeclared[seat] || false };
      }),
      role: isSpectator ? 'spectator' : 'player',
      playerCount: this.players.length,
      // 🚨🚨🚨 【超絶大反省】ここに計算結果の荷物を詰め忘れていました！！！
      endResult: this.endResult 
    };
  }
}

module.exports = GameEngine;