import Phaser from 'phaser';
import { Player } from './Player';

export class CoinManager {
    readonly group: Phaser.Physics.Arcade.Group;
    private readonly magnetRange: number;
    private readonly baseMagnetSpeed: number;
    private coinCount = 0;

    constructor(
        private scene: Phaser.Scene,
        private player: Player,
        { magnetRange = 100, baseMagnetSpeed = 100 } = {}
    ) {
        this.magnetRange = magnetRange;
        this.baseMagnetSpeed = baseMagnetSpeed;
        this.group = this.scene.physics.add.group();
    }

    spawn(x: number, y: number): void {
        this.group.create(x, y, 'coin');
    }

    collect(
        _player: Phaser.GameObjects.GameObject,
        coin: Phaser.GameObjects.GameObject
    ): void {
        coin.destroy();
        this.coinCount += 1;
        this.scene.game.events.emit('coin-collected', this.coinCount);
        this.scene.sound.play('pickupCoin');
    }

    updateMagnet(): void {
        this.group.getChildren().forEach((obj) => {
            const coin = obj as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
            const distance = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                coin.x,
                coin.y
            );
            if (distance < this.magnetRange) {
                const proximity = 1 - distance / this.magnetRange;
                const speed = this.baseMagnetSpeed + proximity * proximity * 600;
                this.scene.physics.moveToObject(coin, this.player, speed);
            } else {
                if (coin.body.velocity.x !== 0 || coin.body.velocity.y !== 0) {
                    coin.body.setVelocity(0, 0);
                }
            }
        });
    }
}
