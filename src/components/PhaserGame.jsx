import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from '../game/config';

export default function PhaserGame() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const [showGameOver, setShowGameOver] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const config = createGameConfig(containerRef.current);
    const game = new Phaser.Game(config);
    gameRef.current = game;

    game.events.on('game-over', () => {
      setShowGameOver(true);
    });

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  const handleTryAgain = () => {
    const game = gameRef.current;
    if (!game) return;
    setShowGameOver(false);
    const scene = game.scene.getScene('MainScene');
    if (scene) {
      scene.sound.stopAll();
      scene.scene.restart();
    }
  };

  return (
    <div ref={containerRef} id="game-container">
      {showGameOver && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            gap: '24px',
            background: 'rgba(0, 0, 0, 0.5)',
          }}
        >
          <div style={{ fontSize: '64px', color: '#fff', fontWeight: 'bold' }}>
            GAME OVER
          </div>
          <button
            onClick={handleTryAgain}
            style={{
              fontSize: '28px',
              padding: '10px 32px',
              cursor: 'pointer',
              background: '#444',
              color: '#fff',
              border: '2px solid #888',
              borderRadius: '8px',
            }}
            onMouseEnter={(e) => (e.target.style.background = '#666')}
            onMouseLeave={(e) => (e.target.style.background = '#444')}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
