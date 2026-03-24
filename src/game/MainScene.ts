import Phaser from 'phaser';
import { Player } from './Player';
import { buildShipCommand } from './InputMapper';

interface StarEntry {
    img: Phaser.GameObjects.Image;
    baseAlpha: number;
    twinkle: number;
    twinklePhase: number;
}

interface StarfieldLayer {
    stars: StarEntry[];
    scrollFactor: number;
}

export default class MainScene extends Phaser.Scene {
    private player!: Player;
    private enemies!: Phaser.Physics.Arcade.Group;
    private bullets!: Phaser.Physics.Arcade.Group;
    private coins!: Phaser.Physics.Arcade.Group;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private keys!: Record<string, Phaser.Input.Keyboard.Key>;
    private score = 0;
    private scoreText!: Phaser.GameObjects.Text;
    private healthText!: Phaser.GameObjects.Text;
    private coinText!: Phaser.GameObjects.Text;
    private coinCount = 0;
    private lastFired = 0;
    private readonly fireRate = 500;
    private readonly spawnRate = 1000;
    private starfieldLayers: StarfieldLayer[] | null = null;
    private readonly starfieldAmbientVx = 6;
    private readonly starfieldAmbientVy = -2.5;
    private readonly worldRecenterThreshold = 12000;
    private readonly maxEnemies = 220;
    private readonly enemyCullDistance = 3400;
    private readonly bulletMaxDistance = 1600;
    private readonly enemyMaxSpeed = 200;
    private readonly radarRange = 2500;
    private readonly radarRadius = 40;
    private radarGraphics!: Phaser.GameObjects.Graphics;
    private readonly radarX = 750;
    private readonly radarY = 550;
    private explosionEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

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
        this.load.audio('backgroundMusic', 'assets/Nebula_Stalker.mp3');
    }

    create(): void {
        this.score = 0;
        this.coinCount = 0;
        this.lastFired = 0;

        this.createTextures();
        this.setupStarfield();

        this.sound.play('backgroundMusic', { loop: true, volume: 0.3 });

        this.physics.world.setBounds(-2e6, -2e6, 4e6, 4e6);
        this.physics.world.setBoundsCollision(false, false, false, false);

        this.player = new Player(this, 0, 0);

        this.bullets = this.physics.add.group({
            defaultKey: 'bullet',
            maxSize: 50
        });

        this.enemies = this.physics.add.group();
        this.coins = this.physics.add.group();

        this.cursors = this.input.keyboard!.createCursorKeys();
        this.keys = this.input.keyboard?.addKeys('W,A,S,D,Q,E') as Record<
            string,
            Phaser.Input.Keyboard.Key
        >;

        this.scoreText = this.add
            .text(16, 520, 'Score: 0', { fontSize: '24px', color: '#fff' })
            .setScrollFactor(0)
            .setDepth(6);
        this.healthText = this.add
            .text(16, 540, 'Health: 100', { fontSize: '24px', color: '#fff' })
            .setScrollFactor(0)
            .setDepth(6);
        this.coinText = this.add
            .text(16, 560, 'Coins: 0', { fontSize: '24px', color: '#fff' })
            .setScrollFactor(0)
            .setDepth(6);

        const panelGraphics = this.add.graphics().setScrollFactor(0);
        panelGraphics.fillStyle(0x000000, 1.0);
        panelGraphics.fillRect(0, 500, 800, 150);
        panelGraphics.setDepth(5);

        this.radarGraphics = this.add.graphics().setScrollFactor(0);
        this.radarGraphics.setDepth(10);

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

        this.time.addEvent({
            delay: this.spawnRate,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        this.physics.add.overlap(
            this.bullets,
            this.enemies,
            this.hitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            undefined,
            this
        );
        this.physics.add.overlap(
            this.player,
            this.enemies,
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

    private createTextures(): void {
        const graphics = this.make.graphics({ x: 0, y: 0 }, false);

        graphics.clear();
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('bullet', 8, 8);

        graphics.clear();
        graphics.fillStyle(0xffff00, 1);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('coin', 8, 8);

        graphics.clear();
        graphics.fillStyle(0xffffff, 0.22);
        graphics.fillCircle(10, 10, 10);
        graphics.fillStyle(0xffffff, 0.5);
        graphics.fillCircle(10, 10, 6);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(10, 10, 3);
        graphics.generateTexture('thruster', 20, 20);

        graphics.clear();
        graphics.fillStyle(0xaaccff, 0.2);
        graphics.fillCircle(14, 14, 14);
        graphics.fillStyle(0xffffff, 0.35);
        graphics.fillCircle(14, 14, 8);
        graphics.generateTexture('thrusterHalo', 28, 28);

        graphics.clear();
        graphics.fillStyle(0x88ccff, 0.42);
        graphics.fillCircle(5, 5, 5);
        graphics.fillStyle(0xffffff, 0.55);
        graphics.fillCircle(5, 5, 3);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(5, 5, 1.5);
        graphics.generateTexture('rcsPuff', 10, 10);

        graphics.clear();
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(1, 1, 0.75);
        graphics.generateTexture('starPin', 3, 3);

        graphics.clear();
        graphics.fillStyle(0xffffff, 0.35);
        graphics.fillCircle(4, 4, 3.5);
        graphics.fillStyle(0xffffff, 0.85);
        graphics.fillCircle(4, 4, 1.4);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(4, 4, 0.6);
        graphics.generateTexture('starSoft', 8, 8);

        graphics.clear();
        graphics.fillStyle(0xaaccff, 0.2);
        graphics.fillCircle(8, 8, 7);
        graphics.fillStyle(0xffffff, 0.45);
        graphics.fillCircle(8, 8, 3);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(8, 8, 1.1);
        graphics.generateTexture('starGlow', 16, 16);

        graphics.clear();
        graphics.fillStyle(0x888888, 0.15);
        graphics.fillCircle(2, 2, 2);
        graphics.fillStyle(0xaaaaaa, 0.25);
        graphics.fillCircle(2, 2, 1);
        graphics.generateTexture('cosmicDust', 4, 4);
    }

    private setupStarfield(): void {
        const W = this.scale.width;
        const H = this.scale.height;

        const sky = this.add.graphics();
        sky.fillGradientStyle(0x03050c, 0x050a18, 0x080c28, 0x10082a, 1);
        sky.fillRect(0, 0, W, H);
        sky.setDepth(-400);
        sky.setScrollFactor(0);

        const nebula = this.add.graphics();
        const mist = (cx: number, cy: number, r: number, color: number, a: number): void => {
            nebula.fillStyle(color, a);
            nebula.fillCircle(cx, cy, r);
        };
        mist(W * 0.18, H * 0.72, 220, 0x1a2a6e, 0.08);
        mist(W * 0.82, H * 0.22, 260, 0x3d1a5c, 0.07);
        mist(W * 0.55, H * 0.48, 180, 0x0d3d55, 0.06);
        mist(W * 0.08, H * 0.18, 140, 0x2244aa, 0.05);
        mist(W * 0.35, H * 0.85, 190, 0x2a1b3d, 0.04);
        mist(W * 0.75, H * 0.15, 160, 0x1a4a6e, 0.055);
        mist(W * 0.92, H * 0.78, 120, 0x4a2a5c, 0.045);
        nebula.setDepth(-390);
        nebula.setScrollFactor(0);

        const tints = [0xffffff, 0xdde8ff, 0xffeedd, 0xccd8ff, 0xaaccff, 0xffdddd];
        const layerDefs = [
            {
                key: 'cosmicDust',
                count: 300,
                depth: -385,
                scaleMin: 0.2,
                scaleMax: 0.8,
                alphaMin: 0.05,
                alphaMax: 0.2,
                scrollFactor: 0.08,
                twinkle: 0
            },
            {
                key: 'starPin',
                count: 400,
                depth: -380,
                scaleMin: 0.3,
                scaleMax: 1.2,
                alphaMin: 0.2,
                alphaMax: 0.8,
                scrollFactor: 0.12,
                twinkle: 0
            },
            {
                key: 'starPin',
                count: 250,
                depth: -375,
                scaleMin: 0.4,
                scaleMax: 1.0,
                alphaMin: 0.3,
                alphaMax: 0.9,
                scrollFactor: 0.25,
                twinkle: 0.08
            },
            {
                key: 'starSoft',
                count: 180,
                depth: -370,
                scaleMin: 0.35,
                scaleMax: 1.1,
                alphaMin: 0.35,
                alphaMax: 0.95,
                scrollFactor: 0.4,
                twinkle: 0.15
            },
            {
                key: 'starGlow',
                count: 80,
                depth: -360,
                scaleMin: 0.4,
                scaleMax: 1.3,
                alphaMin: 0.4,
                alphaMax: 1,
                scrollFactor: 0.68,
                twinkle: 0.25
            }
        ];

        const spreadX = W * 6;
        const spreadY = H * 6;

        this.starfieldLayers = layerDefs.map((def) => {
            const stars: StarEntry[] = [];
            for (let i = 0; i < def.count; i++) {
                const img = this.add.image(
                    Phaser.Math.FloatBetween(-spreadX * 0.5, spreadX * 0.5),
                    Phaser.Math.FloatBetween(-spreadY * 0.5, spreadY * 0.5),
                    def.key
                );
                const s = Phaser.Math.FloatBetween(def.scaleMin, def.scaleMax);
                img.setScale(s);
                const baseA = Phaser.Math.FloatBetween(def.alphaMin, def.alphaMax);
                img.setAlpha(baseA);
                img.setDepth(def.depth);
                img.setTint(Phaser.Utils.Array.GetRandom(tints));
                if (def.key === 'starGlow' || def.key === 'starSoft') {
                    img.setBlendMode(Phaser.BlendModes.ADD);
                } else if (def.key === 'cosmicDust') {
                    img.setBlendMode(Phaser.BlendModes.NORMAL);
                }
                img.setScrollFactor(def.scrollFactor, def.scrollFactor);
                stars.push({
                    img,
                    baseAlpha: baseA,
                    twinkle: def.twinkle,
                    twinklePhase: Phaser.Math.FloatBetween(0, Math.PI * 2)
                });
            }
            return { stars, scrollFactor: def.scrollFactor };
        });
    }

    private updateStarfield(time: number, delta: number): void {
        if (!this.starfieldLayers) return;

        const dt = delta / 1000;
        const driftX = this.starfieldAmbientVx * dt * 0.14;
        const driftY = this.starfieldAmbientVy * dt * 0.14;

        const cam = this.cameras.main;
        const W = this.scale.width;
        const H = this.scale.height;
        const halfDiag = Math.sqrt((W * 0.5) ** 2 + (H * 0.5) ** 2);
        const recycleR = halfDiag + Math.max(W, H) * 0.62;
        const recycleR2 = recycleR * recycleR;
        const minSpawnR = halfDiag + 55;

        this.starfieldLayers.forEach((layer) => {
            const sf = layer.scrollFactor;
            const centerX = cam.scrollX * sf + W * 0.5;
            const centerY = cam.scrollY * sf + H * 0.5;

            layer.stars.forEach((star) => {
                star.img.x += driftX;
                star.img.y += driftY;

                const dx = star.img.x - centerX;
                const dy = star.img.y - centerY;
                if (dx * dx + dy * dy > recycleR2) {
                    const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
                    const d = Phaser.Math.FloatBetween(minSpawnR, recycleR * 0.94);
                    star.img.setPosition(centerX + Math.cos(ang) * d, centerY + Math.sin(ang) * d);
                }

                if (star.twinkle > 0) {
                    const pulse = Math.sin(time * 0.0028 + star.twinklePhase) * 0.5 + 0.5;
                    star.img.setAlpha(star.baseAlpha * (1 - star.twinkle + pulse * star.twinkle));
                }
            });
        });
    }

    update(time: number, delta: number): void {
        this.updateStarfield(time, delta);

        if (this.player.health <= 0) {
            return;
        }

        const command = buildShipCommand(this.cursors, this.keys, this.player.rotation);
        this.player.update(command);

        this.maybeRecenterWorld();

        if (time > this.lastFired) {
            this.fireBullet();
            this.lastFired = time + this.fireRate;
        }

        this.enemies.getChildren().forEach((enemy) => {
            this.physics.moveToObject(enemy, this.player, this.enemyMaxSpeed);
        });

        this.cullDistantEnemies();

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

        const px = this.player.x;
        const py = this.player.y;
        const bd2 = this.bulletMaxDistance * this.bulletMaxDistance;
        this.bullets.getChildren().forEach((obj) => {
            const bullet = obj as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
            if (!bullet.active) return;
            const dx = bullet.x - px;
            const dy = bullet.y - py;
            if (dx * dx + dy * dy > bd2) {
                bullet.setActive(false);
                bullet.setVisible(false);
                bullet.body.setVelocity(0, 0);
            }
        });

        this.updateRadar();
    }

    private maybeRecenterWorld(): void {
        const t = this.worldRecenterThreshold;
        if (Math.abs(this.player.x) < t && Math.abs(this.player.y) < t) {
            return;
        }
        const ox = this.player.x;
        const oy = this.player.y;
        this.player.setPosition(0, 0);
        this.enemies.getChildren().forEach((e) => {
            const sprite = e as Phaser.GameObjects.Sprite;
            sprite.setPosition(sprite.x - ox, sprite.y - oy);
        });
        this.coins.getChildren().forEach((c) => {
            const sprite = c as Phaser.GameObjects.Sprite;
            sprite.setPosition(sprite.x - ox, sprite.y - oy);
        });
        this.bullets.getChildren().forEach((b) => {
            const sprite = b as Phaser.GameObjects.Sprite;
            if (!sprite.active) return;
            sprite.setPosition(sprite.x - ox, sprite.y - oy);
        });
        if (this.starfieldLayers) {
            this.starfieldLayers.forEach((layer) => {
                const sf = layer.scrollFactor;
                layer.stars.forEach((star) => {
                    star.img.x -= ox * sf;
                    star.img.y -= oy * sf;
                });
            });
        }
    }

    private updateRadar(): void {
        if (!this.radarGraphics) return;

        this.radarGraphics.clear();

        this.radarGraphics.fillStyle(0x000000, 0.5);
        this.radarGraphics.fillCircle(this.radarX, this.radarY, this.radarRadius);

        this.radarGraphics.lineStyle(2, 0xffffff, 0.8);
        this.radarGraphics.strokeCircle(this.radarX, this.radarY, this.radarRadius);

        this.radarGraphics.lineStyle(1, 0x444444, 0.5);
        this.radarGraphics.strokeCircle(this.radarX, this.radarY, this.radarRadius * 0.5);
        this.radarGraphics.strokeCircle(this.radarX, this.radarY, this.radarRadius * 0.25);

        this.radarGraphics.lineStyle(1, 0x666666, 0.3);
        this.radarGraphics.lineBetween(
            this.radarX - this.radarRadius,
            this.radarY,
            this.radarX + this.radarRadius,
            this.radarY
        );
        this.radarGraphics.lineBetween(
            this.radarX,
            this.radarY - this.radarRadius,
            this.radarX,
            this.radarY + this.radarRadius
        );

        const px = this.player.x;
        const py = this.player.y;
        const scale = this.radarRadius / this.radarRange;

        (this.enemies.getChildren() as Phaser.GameObjects.Sprite[]).forEach((enemy) => {
            const dx = enemy.x - px;
            const dy = enemy.y - py;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= this.radarRange) {
                const dotX = this.radarX + dx * scale;
                const dotY = this.radarY + dy * scale;
                this.radarGraphics.fillStyle(0xff0000, 0.8);
                this.radarGraphics.fillCircle(dotX, dotY, 3);
            }
        });

        (this.coins.getChildren() as Phaser.GameObjects.Sprite[]).forEach((coin) => {
            const dx = coin.x - px;
            const dy = coin.y - py;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= this.radarRange) {
                const dotX = this.radarX + dx * scale;
                const dotY = this.radarY + dy * scale;
                this.radarGraphics.fillStyle(0xffff00, 0.8);
                this.radarGraphics.fillCircle(dotX, dotY, 2);
            }
        });

        this.radarGraphics.fillStyle(0xffffff, 1);
        this.radarGraphics.fillCircle(this.radarX, this.radarY, 2);
    }

    private cullDistantEnemies(): void {
        const px = this.player.x;
        const py = this.player.y;
        const d2 = this.enemyCullDistance * this.enemyCullDistance;
        (this.enemies.getChildren() as Phaser.GameObjects.Sprite[]).forEach((enemy) => {
            const dx = enemy.x - px;
            const dy = enemy.y - py;
            if (dx * dx + dy * dy > d2) {
                enemy.destroy();
            }
        });
    }

    private fireBullet(): void {
        const offset = 20;
        const spawnX = this.player.x + Math.cos(this.player.rotation) * offset;
        const spawnY = this.player.y + Math.sin(this.player.rotation) * offset;

        const bullet = this.bullets.get(
            spawnX,
            spawnY
        ) as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null;

        if (bullet) {
            bullet.setActive(true);
            bullet.setVisible(true);

            const bulletSpeed = 500;
            const vx = Math.cos(this.player.rotation) * bulletSpeed;
            const vy = Math.sin(this.player.rotation) * bulletSpeed;

            bullet.body.setVelocity(vx, vy);
        }
    }

    private spawnEnemy(): void {
        if (this.player?.health <= 0) {
            return;
        }
        if (this.enemies.countActive(true) >= this.maxEnemies) {
            return;
        }

        const cam = this.cameras.main;
        const halfW = cam.width * 0.5;
        const halfH = cam.height * 0.5;
        const margin = 90;
        const minR = Math.sqrt(halfW * halfW + halfH * halfH) + margin;
        const maxR = minR + 520;

        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const dist = Phaser.Math.FloatBetween(minR, maxR);
        const x = this.player.x + Math.cos(angle) * dist;
        const y = this.player.y + Math.sin(angle) * dist;

        const enemy = this.enemies.create(
            x,
            y,
            'enemy'
        ) as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
        enemy.setCollideWorldBounds(false);
    }

    private spawnCoin(x: number, y: number): void {
        this.coins.create(x, y, 'coin');
    }

    private collectCoin(
        _player: Phaser.GameObjects.GameObject,
        coin: Phaser.GameObjects.GameObject
    ): void {
        coin.destroy();
        this.coinCount += 1;
        this.coinText.setText('Coins: ' + this.coinCount);
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

        this.score += 10;
        this.scoreText.setText('Score: ' + this.score);

        this.sound.play('enemyDestroyed');
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
        this.healthText.setText('Health: ' + this.player.health);

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
