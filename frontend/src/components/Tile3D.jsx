import React from 'react';

export default function Tile3D({ tile, style, isRotated, isFaceDown }) {
  const baseWidth = isRotated ? 30 : 22;
  const baseHeight = isRotated ? 22 : 30;

  // 💡 40度の傾きに対して最も自然に立体的に立体を際立たせるドロップシャドウ
  const tileShadow = '0px 3px 6px rgba(0,0,0,0.6), inset 0px 1px 0px rgba(255,255,255,0.2)';

  return (
    <div
      style={{
        width: `${baseWidth}px`,
        height: `${baseHeight}px`,
        position: 'relative',
        boxSizing: 'border-box',
        // 💡 裏面なら雀魂風の鮮やかなイエローオレンジ、表面なら美麗な白牌
        background: isFaceDown 
          ? 'linear-gradient(135deg, #f1c40f 0%, #e67e22 100%)' 
          : 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
        backgroundImage: isFaceDown ? 'none' : `url(/images/${tile}.png)`,
        backgroundSize: 'cover',
        borderRadius: '2px',
        border: isFaceDown ? '1px solid #d35400' : '1px solid #ccc',
        boxShadow: tileShadow,
        transform: isRotated ? 'rotate(-90deg)' : 'none',
        ...style,
      }}
    />
  );
}