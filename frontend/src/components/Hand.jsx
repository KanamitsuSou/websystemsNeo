import React from 'react';
import Tile3D from './Tile3D';

export default function Hand({ myHand, onDiscard, isMyTurn }) {
  if (!myHand) return null;

  return (
    <div style={{
      display: 'flex',
      gap: '6px',
      padding: '12px 16px',
      backgroundColor: isMyTurn ? 'rgba(255, 215, 0, 0.08)' : 'transparent', 
      borderRadius: '12px',
      border: isMyTurn ? '2px solid rgba(255, 215, 0, 0.5)' : '2px solid transparent',
      boxShadow: isMyTurn ? '0 0 20px rgba(255, 215, 0, 0.2) inset' : 'none',
      transition: 'all 0.3s ease',
      zIndex: 99999, 
      position: 'relative',
    }}>
      {myHand.map((tile, index) => (
        <div
          key={index}
          onClick={() => {
            if (isMyTurn) {
              onDiscard(index);
            }
          }}
          style={{
            position: 'relative',
            cursor: isMyTurn ? 'pointer' : 'not-allowed',
            transition: 'transform 0.05s ease, box-shadow 0.05s ease',
          }}
          onMouseEnter={(e) => {
            if (isMyTurn) {
              e.currentTarget.style.transform = 'translateY(-14px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(255, 215, 0, 0.7)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0px)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          onMouseDown={(e) => {
            if (isMyTurn) {
              e.currentTarget.style.transform = 'translateY(4px)';
            }
          }}
        >
          <Tile3D
            tile={tile}
            style={{
              width: '46px', 
              height: '66px',
              filter: isMyTurn ? 'none' : 'brightness(0.6) grayscale(0.3)',
              transition: 'filter 0.3s ease',
            }}
          />
        </div>
      ))}
    </div>
  );
}