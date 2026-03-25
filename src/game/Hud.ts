import Phaser from 'phaser';

export class Hud {
    private scoreText!: Phaser.GameObjects.Text;
    private healthText!: Phaser.GameObjects.Text;
    private coinText!: Phaser.GameObjects.Text;
    private score = 0;
    private coinCount = 0;

    constructor(private scene: Phaser.Scene) {}

    setup(): void {
        const panelGraphics = this.scene.add.graphics().setScrollFactor(0);
        panelGraphics.fillStyle(0x000000, 1.0);
        panelGraphics.fillRect(0, 500, 800, 150);
        panelGraphics.setDepth(5);

        this.scoreText = this.scene.add
            .text(16, 520, 'Score: 0', { fontFamily: '"Orbitron Variable"', fontSize: '18px', color: '#fff' })
            .setScrollFactor(0)
            .setDepth(6);
        this.healthText = this.scene.add
            .text(16, 540, 'Health: 100', { fontFamily: '"Orbitron Variable"', fontSize: '18px', color: '#fff' })
            .setScrollFactor(0)
            .setDepth(6);
        this.coinText = this.scene.add
            .text(16, 560, 'Coins: 0', { fontFamily: '"Orbitron Variable"', fontSize: '18px', color: '#fff' })
            .setScrollFactor(0)
            .setDepth(6);
    }

    addScore(amount: number): void {
        this.score += amount;
        this.scoreText.setText('Score: ' + this.score);
    }

    setHealth(health: number): void {
        this.healthText.setText('Health: ' + health);
    }

    addCoin(): void {
        this.coinCount += 1;
        this.coinText.setText('Coins: ' + this.coinCount);
    }

    reset(): void {
        this.score = 0;
        this.coinCount = 0;
    }
}
