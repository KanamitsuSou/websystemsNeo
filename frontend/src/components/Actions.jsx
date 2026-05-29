// frontend/src/components/Actions.jsx (表示レイヤー絶対防御版)
import React from 'react';

export default function Actions({ gameState, socket, roomId }) {
  const { myActions } = gameState;

  // 自分が選べるアクションが何もなければ何も表示しない
  if (!myActions || myActions.length === 0) return null;

  const handleActionClick = (action) => {
    socket.emit('take_action', { roomId, action });
  };

  // 雀魂のボタン風のデザインカラーマップ
  const colorMap = {
    RON: '#e74c3c',   // 赤
    TSUMO: '#e67e22', // オレンジ
    RIICHI: '#f1c40f',// 黄色
    PON: '#2ecc71',   // 緑
    CHI: '#3498db',   // 青
    KAN: '#9b59b6',   // 紫
    PASS: '#7f8c8d'   // グレー
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '140px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '15px',
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      padding: '15px 25px',
      borderRadius: '30px',
      boxShadow: '0 0 25px rgba(255,215,0,0.6), 0 0 10px rgba(0,0,0,0.5)',
      border: '2px solid #ffd700',
      // 🔥 3D卓や手牌より絶対に手前に表示してクリックを死守する
      zIndex: 9999999 
    }}>
      {myActions.map((action) => (
        <button
          key={action}
          onClick={() => handleActionClick(action)}
          style={{
            backgroundColor: colorMap[action] || '#333',
            color: 'white',
            border: 'none',
            padding: '10px 25px',
            fontSize: '18px',
            fontWeight: 'bold',
            borderRadius: '5px',
            cursor: 'pointer',
            boxShadow: '0 3px 5px rgba(0,0,0,0.3)',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
            transition: 'transform 0.1s'
          }}
          onMouseOver={(e) => e.target.style.transform = 'scale(1.1)'}
          onMouseOut={(e) => e.target.style.transform = 'scale(1.0)'}
        >
          {action === 'RIICHI' ? 'リーチ' : 
           action === 'RON' ? 'ロン' : 
           action === 'TSUMO' ? 'ツモ' : 
           action === 'PON' ? 'ポン' : 
           action === 'CHI' ? 'チー' : 
           action === 'KAN' ? 'カン' : 'スキップ'}
        </button>
      ))}
    </div>
  );
}