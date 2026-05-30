// frontend/src/App.jsx (流局カットイン・点数移動完全表示版)
import React, { useEffect, useState } from 'react';
import { socket } from './socket';
import Board from './components/Board';
import Actions from './components/Actions';

const YAKU_TRANSLATION = {
  'menzenchin tsumohou': '門前清自摸和（ツモ）', 'riichi': '立直（リーチ）', 'ippatsu': '一発（イッパツ）', 'pinfu': '平和（ピンフ）',
  'tanyao': '断幺九（タンヤオ）', 'iipeiko': '一盃口（イーペーコー）', 'yakuhai fanpai': '役牌（ヤクハイ）', 'bakaze': '場風（バカゼ）',
  'jikaze': '自風（ジカゼ）', 'rinshan kaihou': '嶺上開花（リンシャン）', 'chankan': '槍槓（チャンカン）', 'haitei raoyue': '海底撈月（ハイテイ）',
  'houtei raoyui': '河底撈魚（ホウテイ）', 'double riichi': 'ダブル立直（ダブリー）', 'sanshoku doujun': '三色同順（サンショク）',
  'ittsuu': '一気通貫（イッツー）', 'chanta': '混全帯幺九（チャンタ）', 'toitoi hou': '対々和（トイトイ）', 'sanankou': '三暗刻（サンアンコー）',
  'sankantsu': '三槓子（サンカンツ）', 'sanshoku doukou': '三色同刻（サンショクドウコウ）', 'honroutou': '混老頭（ホンロウトウ）', 'shounanyou': '小三元（ショウサンゲン）',
  'honitsu': '混一色（ホンイツ）', 'honiitsu': '混一色（ホンイツ）', "hon'iitsu": '混一色（ホンイツ）', 
  'junchan': '純全帯幺九（ジュンチャン）', 'ryanpeiko': '二盃口（リャンペーコー）', 
  'chinitsu': '清一色（チンイツ）', 'chiniitsu': '清一色（チンイツ）', "chin'iitsu": '清一色（チンイツ）',
  'chiitoitsu': '七対子（チートイツ）', 'daisangen': '大三元（ダイサンゲン）', 'suuankou': '四暗刻（スーアンコー）', 'suuankou tanki': '四暗刻単騎（スーアンコータンキ）',
  'tsuuiisou': '字一色（ツーイーソー）', 'ryuuiisou': '緑一色（リューイーソー）', 'chinroutou': '清老頭（チンロウトウ）', 'kokushimusou': '国士無双（コクシ）',
  'kokushimusou juuyanmen': '国士無双十三面待ち', 'shousuushii': '小四喜（ショウスーシー）', 'daisuushii': '大四喜（ダイスーシー）',
  'suukantsu': '四槓子（スーカンツ）', 'chuuren poutsou': '九蓮宝燈（チュウレン）', 'chuuren poutsou juuyanmen': '純正九蓮宝燈',
  'tenhou': '天和（テンホー）', 'chihou': '地和（チーホー）', 'nagashi满貫': '流し満貫（ナガシマンガン）', 'dora': 'ドラ', 'uradora': '裏ドラ', 'akadora': '赤ドラ'
};

export default function App() {
  const [gameState, setGameState] = useState(null);
  const [roomId, setRoomId] = useState('sys-metrics-test'); 
  const [useId] = useState(()=> {
    let id = localStorage.getItem('mahjong_user_id');
    if (!id) {
      id = `ID_${Math.random().toString(36).substr(2,9)}`;
      localStorage.setItem('mahjong_user_id',id);
    }
    return id;
  })
  const [userName, setUserName] = useState(()=> localStorage.getItem('mahjong_use_name') || `User${Math.floor(Math.random()*900 + 100)}`)
  const [joined, setJoined] = useState(false);
  const [activeEffect, setActiveEffect] = useState(null);
  const [danmakuList, setDanmakuList] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [autoNextSec, setAutoNextSec] = useState(8);



  useEffect(() => {
    socket.connect();
    
    socket.on('game_state', (state) => {
      setGameState(prevState => {
        // 💡 状態が変わってFINISHEDになった瞬間、流局ならカットインをぶち込む
        if (state.status === 'FINISHED' && (!prevState || prevState.status !== 'FINISHED')) {
          setAutoNextSec(8);
          if (state.endResult && state.endResult.winnerName === '流局') {
            setActiveEffect({ text: '流局', name: '', type: 'RYUUKYOKU' });
            setTimeout(() => setActiveEffect(null), 1500);
          }
        }
        return state;
      });
    });
    
    socket.on('room_reset_enforced', () => {
      setJoined(false);
      setGameState(null);
    });

    socket.on('action_effect', ({ actionType, playerName }) => {
      const actionMap = { 'PON': 'ポン', 'CHI': 'チー', 'KAN': 'カン', 'TSUMO': 'ツモ', 'RON': 'ロン' };
      if (!actionMap[actionType]) return;
      setActiveEffect({ text: actionMap[actionType], name: playerName, type: actionType });
      setTimeout(() => setActiveEffect(null), 1400);
    });

    socket.on('receive_spectator_comment', ({ name, msg, id }) => {
      const randomTop = Math.floor(Math.random() * 50 + 15); 
      const newComment = { id, text: `【観戦】${name}: ${msg}`, top: `${randomTop}%` };
      setDanmakuList(prev => [...prev, newComment]);
      setTimeout(() => {
        setDanmakuList(prev => prev.filter(c => c.id !== id));
      }, 5000);
    });

    return () => { 
      socket.off('game_state'); 
      socket.off('room_reset_enforced'); 
      socket.off('action_effect');
      socket.off('receive_spectator_comment');
      socket.disconnect(); 
    };
  }, []);

  useEffect(() => {
    if (!gameState || gameState.status !== 'FINISHED') return;
    const timer = setInterval(() => {
      setAutoNextSec(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState?.status]);

  const handleJoin = (mode) => {
    localStorage.setItem('mahjong_user_name', userName);
    socket.emit('join_room', {roomId, userName, requstedRole: mode, userId});
    setJoined(true)
  };

  const sendComment = (e) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    socket.emit('send_spectator_comment', { roomId, msg: commentInput, senderName: userName });
    setCommentInput('');
  };

  const handleDiscard = (tileIndex) => {
    socket.emit('discard_tile', { roomId, tileIndex });
  };

  const handleResetGame = () => {
    if (window.confirm("対戦環境を完全に停止し、全員を初期状態に戻しますか？")) {
      socket.emit('reset_game', { roomId });
    }
  };

  if (!joined) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
        <h1>📊 Internal System Metrics Dashboard</h1>
        <div style={{ display: 'inline-block', padding: '30px', border: '1px solid #ccc', borderRadius: '10px', backgroundColor: '#1c1c1c', color: 'white' }}>
          <input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="User ID" style={{ padding: '10px', fontSize: '16px', display: 'block', margin: '10px auto', width: '250px' }} />
          <input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Environment ID" style={{ padding: '10px', fontSize: '16px', display: 'block', margin: '10px auto', width: '250px' }} />
          <div style={{ display: 'flex', gap: '15px', marginTop: '20px', justifyContent: 'center' }}>
            <button onClick={() => handleJoin('player')} style={{ padding: '12px 25px', fontSize: '16px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>🎮 対戦モードで入室</button>
            <button onClick={() => handleJoin('spectator')} style={{ padding: '12px 25px', fontSize: '16px', backgroundColor: '#2980b9', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>👁️ 観戦モードで入室</button>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState || gameState.status === 'WAITING') {
    const currentCount = gameState?.playerCount || 0;
    return (
      <div style={{ textAlign: 'center', marginTop: '120px', color: 'white', fontFamily: 'sans-serif' }}>
        <h2>Connecting to cluster env... Please wait.</h2>
        <div style={{ marginTop: '20px', padding: '20px', display: 'inline-block', background: 'rgba(0,0,0,0.5)', borderRadius: '10px', border: '1px solid #ffd700' }}>
          <h3 style={{ margin: 0, color: '#ffd700' }}>🀄 対戦待機ロビー</h3>
          <p style={{ fontSize: '18px', margin: '10px 0 0 0' }}>現在の参加プレイヤー: <strong style={{fontSize: '24px', color: '#00fbff'}}>{currentCount}</strong> / 4 人</p>
          <p style={{ fontSize: '14px', color: '#aaa', margin: '5px 0 0 0' }}>💡 あと <strong style={{color: '#ff4757'}}>{4 - currentCount}人</strong> 参加すれば全自動で開局します。</p>
        </div>
      </div>
    );
  }

  const isSpectator = gameState.role === 'spectator';
  const showResult = gameState.status === 'FINISHED' || gameState.status === 'GAME_OVER';
  const isExhaustiveDraw = gameState.endResult?.winnerName === "流局";

  return (
    <div style={{ padding: '20px', backgroundColor: '#093318', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Yuji+Boku&display=swap');
        @keyframes danmakuFlow { 0% { transform: translateX(100vw); } 100% { transform: translateX(-100%); } }
        @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; color: #ffb300; } }
      `}</style>

      

      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 999999 }}>
        {danmakuList.map(comment => (
          <div key={comment.id} style={{ position: 'absolute', top: comment.top, whiteSpace: 'nowrap', fontSize: '28px', fontWeight: 'bold', color: '#00fbff', textShadow: '2px 2px 4px #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000', animation: 'danmakuFlow 4.5s linear forwards', fontFamily: 'sans-serif' }}>
            {comment.text}
          </div>
        ))}
      </div>

      {activeEffect && (
        <div style={{ position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 9999999, pointerEvents: 'none', background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.7), transparent)' }}>
          <div style={{ fontFamily: "'Yuji Boku', serif", fontSize: '140px', fontWeight: '900', color: '#ffd700', textShadow: '0 0 15px #ff1e27, 0 0 30px #b30006, 4px 10px 20px rgba(0,0,0,0.9)', letterSpacing: '15px', transform: 'scale(0.1) rotate(-15deg)', opacity: 0, animation: 'chineseCutIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
            {activeEffect.text}
          </div>
          {activeEffect.name && (
            <div style={{ fontSize: '15px', color: '#ffb300', marginTop: '15px', fontWeight: 'bold', letterSpacing: '2px', backgroundColor: 'rgba(15, 15, 15, 0.85)', padding: '6px 30px', borderRadius: '30px', border: '2px solid #b30006', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', animation: 'fadeInUp 0.3s ease 0.15s forwards', opacity: 0 }}>
              ⚡ 宣言者: {activeEffect.name}
            </div>
          )}
        </div>
      )}

      {isSpectator && (
        <form onSubmit={sendComment} style={{ position: 'fixed', bottom: '15px', right: '20px', zIndex: 99999999, display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.8)', padding: '8px 15px', borderRadius: '25px', border: '1px solid #00fbff' }}>
          <input value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder="観戦席からリアクションを送信..." style={{ border: 'none', background: 'transparent', color: 'white', outline: 'none', width: '220px', fontSize: '14px' }} />
          <button type="submit" style={{ background: '#00fbff', color: 'black', border: 'none', padding: '4px 14px', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>送信</button>
        </form>
      )}

      <button onClick={handleResetGame} style={{ position: 'absolute', top: '20px', right: '20px', padding: '8px 16px', fontSize: '13px', backgroundColor: 'rgba(192, 41, 43, 0.2)', color: '#ff9ff3', border: '1px solid rgba(192, 41, 43, 0.6)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', zIndex: 99999, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(192, 41, 43, 0.8)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(192, 41, 43, 0.2)'}>
        ⚠️ ゲームを終了する
      </button>

      <Board gameState={gameState} onDiscard={handleDiscard} />
      {!isSpectator && <Actions gameState={gameState} socket={socket} roomId={roomId} />}

      {/* ーーー 🀄 精算ポップアップ（誰が払ったか表示搭載！） ーーー */}
      {showResult && gameState.endResult && (
        <div style={{ position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ width: '550px', backgroundColor: '#1c1c1c', border: '3px solid #ffd700', borderRadius: '15px', padding: '3px', color: 'white', textAlign: 'center', boxShadow: '0 0 30px #ffd700' }}>
            <div style={{ backgroundColor: gameState.status === 'GAME_OVER' ? '#7f8c8d' : (isExhaustiveDraw ? '#2c3e50' : '#d35400'), padding: '15px', borderRadius: '12px 12px 0 0' }}>
              <h2 style={{ margin: 0, fontSize: '28px' }}>
                {gameState.status === 'GAME_OVER' ? '【対戦結果発表】' : 
                 isExhaustiveDraw ? '【 荒牌流局（リュウキョク） 】' : `${gameState.endResult.winnerWind}家 ${gameState.endResult.isTsumo ? 'ツモアガリ' : 'ロンアガリ'}!!`}
              </h2>
            </div>
            
            <div style={{ padding: '20px' }}>

              {/* 💡 【大目玉】誰から誰へ点数が移ったのかを超わかりやすく表示！ */}
              <div style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #444' }}>
                {isExhaustiveDraw ? (
                  <div style={{ color: '#aaa', fontSize: '15px' }}>テンパイ者とノーテン者間で罰符の精算が行われました</div>
                ) : gameState.endResult.isTsumo ? (
                  <div style={{ color: '#2ecc71', fontSize: '18px', fontWeight: 'bold' }}>
                    【ツモ】 各家 ➡️ {gameState.endResult.winnerName} <span style={{fontSize: '14px', color: '#fff'}}>(合計 {gameState.endResult.points}点の支払い)</span>
                  </div>
                ) : (
                  <div style={{ color: '#e74c3c', fontSize: '18px', fontWeight: 'bold' }}>
                    【ロン】 {gameState.endResult.loserName} ➡️ {gameState.endResult.winnerName} <span style={{fontSize: '14px', color: '#fff'}}>({gameState.endResult.points}点の支払い)</span>
                  </div>
                )}
              </div>

              <h4 style={{ color: '#aaa', margin: '0 0 10px 0' }}>◆ リザルト詳細 ◆</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
                {gameState.endResult.yakuList.map(yaku => {
                  const translatedYaku = YAKU_TRANSLATION[yaku] || yaku;
                  return (
                    <span key={yaku} style={{ backgroundColor: '#aa2224', color: '#ffd700', padding: '6px 14px', borderRadius: '4px', border: '1px solid #ffd700', fontSize: '15px', fontWeight: 'bold', textShadow: '1px 1px 2px #000' }}>
                      {translatedYaku}
                    </span>
                  );
                })}
              </div>
              
              {gameState.status !== 'GAME_OVER' && (
                <h2 style={{ color: '#ffd700', margin: '10px 0' }}>
                  {isExhaustiveDraw ? '0' : gameState.endResult.points} 点 <span style={{ fontSize: '18px', color: '#fff' }}>({gameState.endResult.rankName})</span>
                </h2>
              )}
              
              <hr style={{ border: '0', borderTop: '1px solid #444', margin: '20px 0' }} />
              <h4 style={{ margin: '0 0 10px 0' }}>現在の総得点</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '16px', textAlign: 'left', padding: '0 40px' }}>
                {Object.entries(gameState.endResult.scores).map(([seat, score]) => (
                  <div key={seat}>🀄 {gameState.winds[seat]}家: <strong style={{ color: score >= 25000 ? '#2ecc71' : '#e74c3c' }}>{score}</strong> 点</div>
                ))}
              </div>

              {gameState.status === 'GAME_OVER' ? (
                <button onClick={handleResetGame} style={{ marginTop: '30px', padding: '10px 30px', fontSize: '16px', backgroundColor: '#c0392b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>対戦を完全に終了してロビーへ</button>
              ) : (
                <div style={{ marginTop: '30px', fontSize: '15px', fontWeight: 'bold', animation: 'pulse 1.2s infinite', color: '#ffd700' }}>
                  ⏳ あと <strong style={{fontSize: '20px', color: '#00fbff'}}>{autoNextSec}</strong> 秒後に次局へ移行します...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}