import Phaser from 'phaser';
import { Player } from './Player';
import { buildShipCommand } from './InputMapper';
import { Starfield } from './Starfield';
import { createTextures } from './textures';
import { Radar } from './Radar';
import { Hud } from './Hud';
import { EnemySpawner } from './EnemySpawner';
import { Weapons } from './Weapons';

export default class MainScene extends Phaser.Scene {
    private player!: Player;
    private coins!: Phaser.Physics.Arcade.Group;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private keys!: Record<string, Phaser.Input.Keyboard.Key>;
    private starfield!: Starfield;
    private readonly worldRecenterThreshold = 12000;
    private explosionEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
    private radar!: Radar;
    private hud!: Hud;
    private spawner!: EnemySpawner;
    private weapons!: Weapons;

    constructor() {
        super('MainScene');
    }

    preload(): void {
        this.load.image('player', 'assets/playerShip.png');
        this.load.image('enemy', 'assets/enemyShip.png');
        this.load.audio('playerDamage', 'assets/playerDamage.wav');
        this.load.audio('playerDeath', 'assets/playerDeath.wav');
        this.load.audio('enemyDestroyed', 'assets/enemyDestroyed.wav');
        this.load.audio('pickupCoin', 'assets/pickupCoin.wav');
        this.load.audio('thrusterRumble', 'assets/thrusterRumble.wav');
        this.load.audio('laserShoot', 'assets/laserShoot.wav');
        this.load.audio('backgroundMusic', 'assets/Nebula_Stalker.mp3');
    }

    create(): void {
        createTextures(this);
        this.starfield = new Starfield(this);
        this.starfield.setup();

        this.sound.play('backgroundMusic', { loop: true, volume: 0.3 });

        this.physics.world.setBounds(-2e6, -2e6, 4e6, 4e6);
        this.physics.world.setBoundsCollision(false, false, false, false);

        this.player = new Player(this, 0, 0);

        this.weapons = new Weapons(this, this.player);
        this.spawner = new EnemySpawner(this, this.player);
        this.coins = this.physics.add.group();

        this.cursors = this.input.keyboard!.createCursorKeys();
        this.keys = this.input.keyboard?.addKeys('W,A,S,D,Q,E') as Record<
            string,
            Phaser.Input.Keyboard.Key
        >;

        this.hud = new Hud(this);
        this.hud.setup();

        this.radar = new Radar(this, 750, 550, 40, 2500);
        this.radar.setup();

        this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
        this.cameras.main.setRoundPixels(true);

        this.explosionEmitter = this.add.particles(0, 0, 'bullet', {
            speed: { min: 50, max: 150 },
            scale: { start: 1, end: 0 },
            tint: [0xff0000, 0xffa500, 0xffff00],
            lifespan: 500,
            gravityY: 0,
            emitting: false
        });

        this.physics.add.overlap(
            this.weapons.bullets,
            this.spawner.group,
            this.hitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            undefined,
            this
        );
        this.physics.add.overlap(
            this.player,
            this.spawner.group,
            this.hitPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            undefined,
            this
        );
        this.physics.add.overlap(
            this.player,
            this.coins,
            this.collectCoin as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            undefined,
            this
        );

        const resumeAudio = (): void => {
            const ctx = (this.sound as Phaser.Sound.WebAudioSoundManager).context;
            if (ctx && ctx.state === 'suspended') {
                ctx.resume();
            }
        };
        this.input.keyboard!.once('keydown', resumeAudio);
        this.input.once('pointerdown', resumeAudio);
    }

    update(time: number, delta: number): void {
        this.starfield.update(time, delta);

        if (this.player.health <= 0) {
            return;
        }

        const command = buildShipCommand(this.cursors, this.keys, this.player.rotation);
        this.player.update(command);

        this.maybeRecenterWorld();
        this.weapons.update(time);
        this.spawner.update();
        this.updateCoinMagnet();
        this.radar.update(
            this.player.x,
            this.player.y,
            this.spawner.group.getChildren(),
            this.coins.getChildren()
        );
    }

    private updateCoinMagnet(): void {
        const magnetRange = 100;
        const baseMagnetSpeed = 100;

        this.coins.getChildren().forEach((obj) => {
            const coin = obj as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
            const distance = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                coin.x,
                coin.y
            );
            if (distance < magnetRange) {
                const proximity = 1 - distance / magnetRange;
                const speed = baseMagnetSpeed + proximity * proximity * 600;
                this.physics.moveToObject(coin, this.player, speed);
            } else {
                if (coin.body.velocity.x !== 0 || coin.body.velocity.y !== 0) {
                    coin.body.setVelocity(0, 0);
                }
            }
        });
    }

    private maybeRecenterWorld(): void {
        const t = this.worldRecenterThreshold;
        if (Math.abs(this.player.x) < t && Math.abs(this.player.y) < t) {
            return;
        }
        const ox = this.player.x;
        const oy = this.player.y;
        this.player.setPosition(0, 0);
        this.spawner.group.getChildren().forEach((e) => {
            const sprite = e as Phaser.GameObjects.Sprite;
            sprite.setPosition(sprite.x - ox, sprite.y - oy);
        });
        this.coins.getChildren().forEach((c) => {
            const sprite = c as Phaser.GameObjects.Sprite;
            sprite.setPosition(sprite.x - ox, sprite.y - oy);
        });
        this.weapons.bullets.getChildren().forEach((b) => {
            const sprite = b as Phaser.GameObjects.Sprite;
            if (!sprite.active) return;
            sprite.setPosition(sprite.x - ox, sprite.y - oy);
        });
        this.starfield.recenter(ox, oy);
    }

    private spawnCoin(x: number, y: number): void {
        this.coins.create(x, y, 'coin');
    }

    private collectCoin(
        _player: Phaser.GameObjects.GameObject,
        coin: Phaser.GameObjects.GameObject
    ): void {
        coin.destroy();
        this.hud.addCoin();
        this.sound.play('pickupCoin');
    }

    private hitEnemy(
        bullet: Phaser.GameObjects.GameObject,
        enemy: Phaser.GameObjects.GameObject
    ): void {
        const b = bullet as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
        const e = enemy as Phaser.GameObjects.Sprite;
        b.setActive(false);
        b.setVisible(false);
        b.body.setVelocity(0, 0);

        this.explosionEmitter.explode(15, e.x, e.y);
        this.spawnCoin(e.x, e.y);
        e.destroy();

        this.hud.addScore(10);
        this.sound.play('enemyDestroyed');
        this.cameras.main.flash(80, 200, 200, 200, true);
    }

    private hitPlayer(
        _player: Phaser.GameObjects.GameObject,
        enemy: Phaser.GameObjects.GameObject
    ): void {
        const e = enemy as Phaser.GameObjects.Sprite;
        this.explosionEmitter.explode(15, e.x, e.y);
        e.destroy();

        this.sound.play('playerDamage');

        this.cameras.main.flash(200, 255, 0, 0);
        this.cameras.main.shake(200, 0.01);

        this.player.health -= 10;
        this.hud.setHealth(this.player.health);

        if (this.player.health <= 0) {
            this.player.stopEffects();
            this.physics.pause();
            this.player.setTint(0xff0000);
            this.player.setVisible(false);

            this.explosionEmitter.explode(100, this.player.x, this.player.y);

            this.cameras.main.shake(500, 0.05);
            this.cameras.main.flash(500, 255, 255, 255);

            this.sound.stopAll();
            this.game.events.emit('game-over');

            this.sound.play('playerDeath');
        }
    }
}
