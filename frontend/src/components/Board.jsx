// frontend/src/components/Board.jsx (「本場」完全表示版)
import React, { useState, useEffect } from 'react';
import Hand from './Hand';

const Tile25D = ({ tile, isRotated, isFaceDown, style }) => {
  const baseWidth = isRotated ? 32 : 24;
  const baseHeight = isRotated ? 24 : 32;
  const thicknessShadow = isRotated
    ? '0px 0.5px 0px #ccc, 0px 1px 0px #c0c0c0, 1px 3px 5px rgba(0,0,0,0.6)'
    : '0.5px 0.5px 0px #ccc, 1px 1px 0px #c0c0c0, 1.5px 1.5px 0px #b0b0b0, 2px 4px 6px rgba(0,0,0,0.6)';

  return (
    <div style={{
      width: `${baseWidth}px`, height: `${baseHeight}px`, position: 'relative', flexShrink: 0,
      background: isFaceDown ? 'linear-gradient(135deg, #1b824c 0%, #113f25 100%)' : `white url(/images/${tile}.png) no-repeat center/cover`,
      border: '1px solid #999', borderRadius: '3px', boxShadow: thicknessShadow, 
      transform: isRotated ? 'rotate(-90deg)' : 'none', transformOrigin: 'center center', ...style
    }} />
  );
};

export default function Board({ gameState, onDiscard }) {
  const { 
    myHand, mySeat, currentTurn, discards, doraIndicators, 
    scores, winds, bakaze, kyoutaku, others, myMelds, kyoku, role, allHands, wallCount, turnExpiryTime, seatNames, honba 
  } = gameState;

  const isMyTurn = mySeat === currentTurn;
  const isSpectator = role === 'spectator';

  const [localAnim, setLocalAnim] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    setLocalAnim(null);
  }, [gameState]);

  useEffect(() => {
    if (!turnExpiryTime) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.ceil((turnExpiryTime - Date.now()) / 1000));
      setTimeLeft(diff);
    }, 200);
    return () => clearInterval(interval);
  }, [turnExpiryTime]);

  const displayHand = localAnim ? myHand.filter((_, i) => i !== localAnim.index) : myHand;

  const getRelativePosition = (seat) => {
    const anchorSeat = isSpectator ? 0 : mySeat;
    const diff = (seat - anchorSeat + 4) % 4;
    if (diff === 0) return 'bottom'; 
    if (diff === 1) return 'right';  
    if (diff === 2) return 'top';    
    return 'left';                   
  };

  const renderRiichiStick = (position) => {
    const stickStyle = { position: 'absolute', width: '55px', height: '8px', backgroundColor: '#f5f5f5', borderRadius: '2px', border: '1px solid #ccc', display: 'flex', justifyContent: 'center', alignItems: 'center' };
    const positions = {
      bottom: { bottom: '-25px', left: '50%', transform: 'translateX(-50%)', ...stickStyle },
      top:    { top: '-25px', left: '50%', transform: 'translateX(-50%)', ...stickStyle },
      right:  { right: '-30px', top: '50%', transform: 'translateY(-50%) rotate(90deg)', ...stickStyle },
      left:   { left: '-30px', top: '50%', transform: 'translateY(-50%) rotate(90deg)', ...stickStyle }
    };
    return <div style={positions[position]}><div style={{ width: '4px', height: '4px', backgroundColor: 'red', borderRadius: '50%' }} /></div>;
  };

  const renderRealMeld = (melds, isMini = false) => {
    if (!melds || melds.length === 0) return null;
    return (
      <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end' }}>
        {melds.map((meld, gIdx) => (
          <div key={`meld-g-${gIdx}`} style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.4)', padding: '3px', borderRadius: '4px', border: '1px solid #ffd700', alignItems: 'flex-end' }}>
            {meld.map((tile, tIdx) => (
              <Tile25D key={`meld-t-${gIdx}-${tIdx}`} tile={tile} style={{ width: isMini ? '16px' : '18px', height: isMini ? '22px' : '26px' }} />
            ))}
          </div>
        ))}
      </div>
    );
  };

  const RiichiEffect = () => (
    <div style={{ position: 'absolute', top: '-10px', left: '-10px', width: 'calc(100% + 20px)', height: 'calc(100% + 20px)', background: 'linear-gradient(45deg, #e74c3c, #f39c12, #e74c3c)', backgroundSize: '400% 400%', borderRadius: '8px', zIndex: -1, filter: 'blur(8px)', animation: 'riichiFlame 1.5s ease infinite' }} />
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '800px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', perspective: '1200px', overflow: 'hidden', paddingTop: '20px' }}>
      
      {/* 3Dリアル麻雀卓マット */}
      <div style={{ position: 'relative', width: '740px', height: '740px', background: 'radial-gradient(circle, #0e3d1d 0%, #061f0e 100%)', borderRadius: '16px', border: '18px solid transparent', borderImage: 'linear-gradient(135deg, #2c1a0e, #614022, #2c1a0e) 1', boxShadow: '0 30px 70px rgba(0,0,0,0.9), 0 0 80px rgba(0,0,0,0.5) inset', transform: 'rotateX(42deg)', transformStyle: 'preserve-3d' }}>

        {/* 🎛️ 中央盤面 */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) translateZ(5px)', width: '180px', height: '180px', background: 'linear-gradient(135deg, #111, #222)', border: '3px solid #444', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.7), 0 0 15px rgba(255,255,255,0.05) inset', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 5 }}>
          
          {/* 💡 【大修正】ここに「〇本場」の表示を追加！これで連荘したことが完全に分かります！ */}
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffd700', textShadow: '0 0 6px #ffd700' }}>
            {bakaze}{kyoku || 1}局 {honba > 0 ? <span style={{fontSize: '14px', color: '#ffb300'}}>{honba}本場</span> : ''}
          </div>
          
          <div style={{ fontSize: '11px', color: '#00fbff', marginTop: '4px', fontWeight: 'bold' }}>
            🎴 残り: {wallCount !== undefined ? wallCount : 70} 枚
          </div>

          <div style={{ fontSize: '15px', marginTop: '6px', fontWeight: 'bold', color: timeLeft <= 5 ? '#ff4757' : '#2ecc71', background: 'rgba(0,0,0,0.5)', padding: '2px 14px', borderRadius: '12px', border: timeLeft <= 5 ? '1px solid #ff4757' : '1px solid #2ecc71', textShadow: timeLeft <= 5 ? '0 0 8px #ff4757' : '0 0 8px #2ecc71' }}>
            ⏱️ {timeLeft} 秒
          </div>
          
          <div style={{ fontSize: '10px', color: '#aaa', marginTop: '4px' }}>供託: 🪙{kyoutaku || 0}本</div>

          {/* ドラ表示 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px', fontSize: '11px', color: '#aaa' }}>
            {doraIndicators && doraIndicators.map((t, i) => (
              <Tile25D key={`dora-${i}`} tile={t} style={{ width: '15px', height: '20px' }} />
            ))}
          </div>

          {/* 四辺の方角ネオンランプ */}
          {others && [0,1,2,3].map(seat => {
            const pos = getRelativePosition(seat);
            const isTurn = currentTurn === seat; 
            const isPlayerRiichi = seat === mySeat ? gameState.isRiichi : others.find(o=>o.seat===seat)?.isRiichi;
            const baseStyle = { position: 'absolute', fontWeight: 'bold', fontSize: '14px', padding: '2px 5px', borderRadius: '3px' };
            const edgePositions = {
              bottom: { bottom: '6px', left: '50%', transform: 'translateX(-50%)', ...baseStyle },
              top:    { top: '6px', left: '50%', transform: 'translateX(-50%) rotate(180deg)', ...baseStyle },
              right:  { right: '6px', top: '50%', transform: 'translateY(-50%) rotate(-90deg)', ...baseStyle },
              left:   { left: '6px', top: '50%', transform: 'translateY(-50%) rotate(90deg)', ...baseStyle }
            };
            return (
              <div key={`lamp-${seat}`} style={{ ...edgePositions[pos], color: isTurn ? '#000' : '#555', background: isTurn ? 'linear-gradient(135deg, #ffd700, #ffa500)' : 'transparent', boxShadow: isTurn ? '0 0 12px #ffd700, 0 0 4px #ffd700 inset' : 'none' }}>
                {winds[seat]}
                {isPlayerRiichi && renderRiichiStick(pos)}
              </div>
            );
          })}
        </div>

        {/* 各プレイヤーの河 */}
        {Object.entries(discards).map(([seat, playerDiscards]) => {
          const pos = getRelativePosition(Number(seat));
          const styleMap = {
            bottom: { bottom: '165px', left: '50%', transform: 'translateX(-50%)' },
            top:    { top: '165px', left: '50%', transform: 'translateX(-50%) rotate(180deg)' },
            right:  { right: '165px', top: '50%', transform: 'translateY(-50%) rotate(-90deg)' },
            left:   { left: '165px', top: '50%', transform: 'translateY(-50%) rotate(90deg)' }
          };
          return (
            <div key={`discard-row-${seat}`} style={{ position: 'absolute', display: 'flex', flexWrap: 'wrap', width: '130px', gap: '4px 2px', justifyContent: 'center', zIndex: 3, transformStyle: 'preserve-3d', ...styleMap[pos] }}>
              {playerDiscards.map((d, i) => <Tile25D key={`dis-${seat}-${i}`} tile={d.tile} isRotated={d.rotated} style={{marginRight: d.rotated ? '4px' : '0'}} />)}
            </div>
          );
        })}

        {/* 👥 他家の配置 */}
        {others && others.map(p => {
          const pos = getRelativePosition(p.seat);
          if (!isSpectator && pos === 'bottom') return null; 
          if (isSpectator && pos === 'bottom') return null; 

          const layoutMap = {
            top:   { top: '35px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column-reverse', alignItems: 'center' },
            right: { right: '35px', top: '50%', transform: 'translateY(-50%) rotate(-90deg)', display: 'flex', flexDirection: 'column', alignItems: 'center' },
            left:  { left: '35px', top: '50%', transform: 'translateY(-50%) rotate(90deg)', display: 'flex', flexDirection: 'column', alignItems: 'center' }
          };
          const handData = isSpectator ? allHands?.find(h => h.seat === p.seat)?.hand : null;
          return (
            <div key={`opp-area-${p.seat}`} style={{ position: 'absolute', zIndex: 2, ...layoutMap[pos], gap: '8px', transformStyle: 'preserve-3d' }}>
              {p.isRiichi && <RiichiEffect />}
              <div style={{ backgroundColor: 'rgba(0,0,0,0.8)', padding: '3px 10px', borderRadius: '4px', border: '1px solid #555', color: '#fff', fontSize: '11px', textAlign: 'center', fontWeight: 'bold' }}>
                [{winds[p.seat]}] {p.name.substring(0,8)} : <strong style={{color: '#ffb300'}}>{scores[p.seat]}</strong>
              </div>
              <div style={{ display: 'flex', gap: '1px', backgroundColor: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '4px', transformStyle: 'preserve-3d' }}>
                {isSpectator && handData ? (
                  handData.map((tile, i) => <Tile25D key={`spec-${p.seat}-${i}`} tile={tile} style={{width: '18px', height: '26px'}} />)
                ) : (
                  Array(p.handCount).fill(0).map((_, i) => <Tile25D key={`down-${p.seat}-${i}`} isFaceDown={true} style={{width: '18px', height: '26px'}} />)
                )}
              </div>
              {renderRealMeld(p.melds, true)}
            </div>
          );
        })}

      </div>

      {/* 打牌時の手の演出 */}
      {localAnim && (
        <div style={{ position: 'absolute', left: `calc(50% - 160px + (${localAnim.index} * 46px))`, bottom: '120px', width: '42px', height: '60px', zIndex: 999999, animation: 'handDiscardMove 0.22s cubic-bezier(0.25, 1, 0.5, 1) forwards' }}>
          <Tile25D tile={localAnim.tile} style={{ width: '100%', height: '100%' }} />
          <svg width="70" height="120" viewBox="0 0 70 120" style={{ position: 'absolute', top: '-15px', left: '-14px', animation: 'handFade 0.22s ease forwards' }}>
            <path d="M15 110 Q 35 120, 55 110 L 50 35 C 50 20, 45 10, 35 12 C 25 10, 20 20, 20 35 Z" fill="rgba(245, 218, 193, 0.95)" stroke="#b59469" strokeWidth="2" />
          </svg>
        </div>
      )}

      {/* 👑 画面最前面：自分の操作手牌エリア */}
      <div style={{ position: 'absolute', bottom: '15px', left: '50%', transform: 'translateX(-50%)', zIndex: 99999, display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          {isSpectator ? (
            <div style={{ display: 'flex', gap: '4px', padding: '12px', background: 'rgba(0,0,0,0.6)', borderRadius: '12px', border: '1px solid #ffd700' }}>
              {allHands?.find(h => h.seat === 0)?.hand.map((tile, i) => <Tile25D key={`spectator-0-${i}`} tile={tile} style={{width: '44px', height: '62px'}} />)}
            </div>
          ) : (
            <Hand myHand={displayHand} onDiscard={(index) => {
              if (isMyTurn && !localAnim) {
                setLocalAnim({ index, tile: myHand[index] });
                onDiscard(index);
              }
            }} isMyTurn={isMyTurn} />
          )}
          
          <div style={{ backgroundColor: 'rgba(7, 21, 59, 0.9)', padding: '5px 24px', borderRadius: '20px', border: '2px solid #ffd700', color: '#fff', fontSize: '13px', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
            🧭 {isSpectator ? "東家(観戦中)" : seatNames?.[mySeat]} ({isSpectator ? "東" : winds[mySeat]}家): <span style={{ color: '#ffd700', fontSize: '16px' }}>{isSpectator ? scores[0] : scores[mySeat]}</span> 点
          </div>
        </div>

        {!isSpectator && myMelds && myMelds.length > 0 && (
          <div style={{ marginBottom: '35px', animation: 'fadeInUp 0.2s ease' }}>
            {renderRealMeld(myMelds, true)}
          </div>
        )}
      </div>

    </div>
  );
}