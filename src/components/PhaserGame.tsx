import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from '../game/config';
import HudOverlay from './HudOverlay';

export default function PhaserGame() {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const [showGameOver, setShowGameOver] = useState(false);
    const [score, setScore] = useState(0);
    const [health, setHealth] = useState(100);
    const [coins, setCoins] = useState(0);

    useEffect(() => {
        if (!containerRef.current) return;

        const config = createGameConfig(containerRef.current);
        const game = new Phaser.Game(config);
        gameRef.current = game;

        game.events.on('game-over', () => {
            setShowGameOver(true);
        });
        game.events.on('score-changed', (value: number) => setScore(value));
        game.events.on('health-changed', (value: number) => setHealth(value));
        game.events.on('coin-collected', (value: number) => setCoins(value));

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
        setScore(0);
        setHealth(100);
        setCoins(0);
        const scene = game.scene.getScene('MainScene');
        if (scene) {
            scene.sound.stopAll();
            scene.scene.restart();
        }
    };

    return (
        <div ref={containerRef} id="game-container">
            <HudOverlay score={score} health={health} coins={coins} />
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
                        background: 'rgba(0, 0, 0, 0.5)'
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
                            fontFamily: 'Orbitron Variable, sans-serif',
                        }}
                        onMouseEnter={(e) =>
                            ((e.target as HTMLButtonElement).style.background = '#666')
                        }
                        onMouseLeave={(e) =>
                            ((e.target as HTMLButtonElement).style.background = '#444')
                        }
                    >
                        Try Again
                    </button>
                </div>
            )}
        </div>
    );
}
