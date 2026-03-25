import Phaser from 'phaser';
import { Player } from './Player';
import { CoinManager } from './CoinManager';

export class CombatResolver {
    private readonly explosionEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    private score = 0;

    constructor(
        private scene: Phaser.Scene,
        private player: Player,
        private coinManager: CoinManager
    ) {
        this.explosionEmitter = this.scene.add.particles(0, 0, 'bullet', {
            speed: { min: 50, max: 150 },
            scale: { start: 1, end: 0 },
            tint: [0xff0000, 0xffa500, 0xffff00],
            lifespan: 500,
            gravityY: 0,
            emitting: false
        });
    }

    hitEnemy(
        bullet: Phaser.GameObjects.GameObject,
        enemy: Phaser.GameObjects.GameObject
    ): void {
        const b = bullet as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
        const e = enemy as Phaser.GameObjects.Sprite;
        b.setActive(false);
        b.setVisible(false);
        b.body.setVelocity(0, 0);

        this.explosionEmitter.explode(15, e.x, e.y);
        this.coinManager.spawn(e.x, e.y);
        e.destroy();

        this.score += 10;
        this.scene.game.events.emit('score-changed', this.score);
        this.scene.sound.play('enemyDestroyed');
        this.scene.cameras.main.flash(80, 200, 200, 200, true);
    }

    hitPlayer(
        _player: Phaser.GameObjects.GameObject,
        enemy: Phaser.GameObjects.GameObject
    ): void {
        const e = enemy as Phaser.GameObjects.Sprite;
        this.explosionEmitter.explode(15, e.x, e.y);
        e.destroy();

        this.scene.sound.play('playerDamage');

        this.scene.cameras.main.flash(200, 255, 0, 0);
        this.scene.cameras.main.shake(200, 0.01);

        this.player.health -= 10;
        this.scene.game.events.emit('health-changed', this.player.health);

        if (this.player.health <= 0) {
            this.player.stopEffects();
            this.scene.physics.pause();
            this.player.setTint(0xff0000);
            this.player.setVisible(false);

            this.explosionEmitter.explode(100, this.player.x, this.player.y);

            this.scene.cameras.main.shake(500, 0.05);
            this.scene.cameras.main.flash(500, 255, 255, 255);

            this.scene.sound.stopAll();
            this.scene.game.events.emit('game-over');

            this.scene.sound.play('playerDeath');
        }
    }
}
