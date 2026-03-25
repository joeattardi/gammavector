import './HudOverlay.css';

interface HudOverlayProps {
    score: number;
    health: number;
    coins: number;
}

export default function HudOverlay({ score, health, coins }: HudOverlayProps) {
    return (
        <div className="hud-overlay">
            <span className="hud-item">Score: {score}</span>
            <span className="hud-item">Health: {health}</span>
            <span className="hud-item">Coins: {coins}</span>
        </div>
    );
}
