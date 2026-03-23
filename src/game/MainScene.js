import Phaser from 'phaser';

/**
 * Void Wake - Main Game Scene
 * A Vampire Survivors-style space shooter in Phaser 3.
 */
export default class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
        this.player = null;
        this.enemies = null;
        this.bullets = null;
        this.coins = null;
        this.cursors = null;
        this.score = 0;
        this.health = 100;
        this.scoreText = null;
        this.healthText = null;
        this.coinText = null;
        this.coinCount = 0;
        this.lastFired = 0;
        this.fireRate = 500;
        this.spawnRate = 1000;
        this.starfieldLayers = null;
        this.starfieldAmbientVx = 6;
        this.starfieldAmbientVy = -2.5;
        this.worldRecenterThreshold = 12000;
        this.maxEnemies = 220;
        this.enemyCullDistance = 3400;
        this.bulletMaxDistance = 1600;
        this.playerMaxSpeed = 220;
        this.enemyMaxSpeed = 200;
        this.radarRange = 2500;
        this.radarRadius = 40;
        this.radarGraphics = null;
        this.radarX = 750;
        this.radarY = 550;
    }

    preload() {
        this.load.image('player', 'assets/playerShip.png');
        this.load.image('enemy', 'assets/enemyShip.png');
        this.load.audio('playerDamage', 'assets/playerDamage.wav');
        this.load.audio('playerDeath', 'assets/playerDeath.wav');
        this.load.audio('enemyDestroyed', 'assets/enemyDestroyed.wav');
        this.load.audio('pickupCoin', 'assets/pickupCoin.wav');
        this.load.audio('thrusterRumble', 'assets/thrusterRumble.wav');
        this.load.audio('backgroundMusic', 'assets/Nebula_Stalker.mp3');
    }

    create() {
        this.score = 0;
        this.health = 100;
        this.coinCount = 0;
        this.lastFired = 0;

        this.createTextures();
        this.setupStarfield();

        this.sound.play('backgroundMusic', { loop: true, volume: 0.5 });

        this.physics.world.setBounds(-2e6, -2e6, 4e6, 4e6);
        this.physics.world.setBoundsCollision(false, false, false, false);

        this.player = this.physics.add.sprite(0, 0, 'player');
        this.player.setCollideWorldBounds(false);
        this.player.setRotation(-Math.PI / 2);
        this.player.setDamping(true);
        this.player.setDrag(0.99);
        this.player.setMaxVelocity(this.playerMaxSpeed, this.playerMaxSpeed);

        this.bullets = this.physics.add.group({
            defaultKey: 'bullet',
            maxSize: 50
        });

        this.enemies = this.physics.add.group();
        this.coins = this.physics.add.group();

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D');
        this.qeKeys = this.input.keyboard.addKeys('Q,E');

        this.scoreText = this.add.text(16, 520, 'Score: 0', { fontSize: '24px', fill: '#fff' }).setScrollFactor(0).setDepth(6);
        this.healthText = this.add.text(16, 540, 'Health: 100', { fontSize: '24px', fill: '#fff' }).setScrollFactor(0).setDepth(6);
        this.coinText = this.add.text(16, 560, 'Coins: 0', { fontSize: '24px', fill: '#fff' }).setScrollFactor(0).setDepth(6);

        this.panelGraphics = this.add.graphics().setScrollFactor(0);
        this.panelGraphics.fillStyle(0x000000, 1.0);
        this.panelGraphics.fillRect(0, 500, 800, 150);
        this.panelGraphics.setDepth(5);

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

        this.thrusterHaloEmitter = this.add.particles(0, 0, 'thrusterHalo', {
            lifespan: { min: 220, max: 380 },
            speed: { min: 35, max: 85 },
            scale: { start: 1.45, end: 0 },
            alpha: { start: 0.4, end: 0 },
            tint: [0xaa77ff, 0x55aaff, 0xff66cc, 0x66eeff],
            blendMode: 'ADD',
            frequency: 11,
            quantity: 3,
            gravityY: 0,
            emitting: false
        });
        this.thrusterHaloEmitter.setDepth(-2);

        this.thrusterEmitter = this.add.particles(0, 0, 'thruster', {
            lifespan: { min: 130, max: 240 },
            speed: { min: 100, max: 260 },
            scale: { start: 0.78, end: 0 },
            alpha: { start: 1, end: 0 },
            tint: [0xffffff, 0xccffff, 0xffee88, 0xff9944, 0xff5522],
            blendMode: 'ADD',
            frequency: 7,
            quantity: 4,
            gravityY: 0,
            emitting: false
        });
        this.thrusterEmitter.setDepth(-1);

        const makeRcsEmitter = () =>
            this.add.particles(0, 0, 'rcsPuff', {
                lifespan: { min: 95, max: 200 },
                speed: { min: 48, max: 145 },
                scale: { start: 1.05, end: 0 },
                alpha: { start: 0.78, end: 0 },
                tint: [0x77bbff, 0xaaefff, 0xffffff, 0xffddaa],
                blendMode: 'ADD',
                frequency: 9,
                quantity: 2,
                gravityY: 0,
                emitting: false
            });
        this.rcsPortEmitter = makeRcsEmitter();
        this.rcsStarboardEmitter = makeRcsEmitter();
        this.rcsPortEmitter.setDepth(-1);
        this.rcsStarboardEmitter.setDepth(-1);

        this.time.addEvent({
            delay: this.spawnRate,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        this.physics.add.overlap(this.bullets, this.enemies, this.hitEnemy, null, this);
        this.physics.add.overlap(this.player, this.enemies, this.hitPlayer, null, this);
        this.physics.add.overlap(this.player, this.coins, this.collectCoin, null, this);

        this.thrusterRumble = this.sound.add('thrusterRumble', {
            loop: true,
            volume: 0.82
        });

        const resumeAudio = () => {
            const ctx = this.sound.context;
            if (ctx && ctx.state === 'suspended') {
                ctx.resume();
            }
        };
        this.input.keyboard.once('keydown', resumeAudio);
        this.input.once('pointerdown', resumeAudio);
    }

    createTextures() {
        let graphics = this.make.graphics({ x: 0, y: 0, add: false });

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

    setupStarfield() {
        const W = this.scale.width;
        const H = this.scale.height;

        const sky = this.add.graphics();
        sky.fillGradientStyle(0x03050c, 0x050a18, 0x080c28, 0x10082a, 1);
        sky.fillRect(0, 0, W, H);
        sky.setDepth(-400);
        sky.setScrollFactor(0);

        const nebula = this.add.graphics();
        const mist = (cx, cy, r, color, a) => {
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
            { key: 'cosmicDust', count: 300, depth: -385, scaleMin: 0.2, scaleMax: 0.8, alphaMin: 0.05, alphaMax: 0.2, scrollFactor: 0.08, twinkle: 0 },
            { key: 'starPin', count: 400, depth: -380, scaleMin: 0.3, scaleMax: 1.2, alphaMin: 0.2, alphaMax: 0.8, scrollFactor: 0.12, twinkle: 0 },
            { key: 'starPin', count: 250, depth: -375, scaleMin: 0.4, scaleMax: 1.0, alphaMin: 0.3, alphaMax: 0.9, scrollFactor: 0.25, twinkle: 0.08 },
            { key: 'starSoft', count: 180, depth: -370, scaleMin: 0.35, scaleMax: 1.1, alphaMin: 0.35, alphaMax: 0.95, scrollFactor: 0.4, twinkle: 0.15 },
            { key: 'starGlow', count: 80, depth: -360, scaleMin: 0.4, scaleMax: 1.3, alphaMin: 0.4, alphaMax: 1, scrollFactor: 0.68, twinkle: 0.25 }
        ];

        const spreadX = W * 6;
        const spreadY = H * 6;

        this.starfieldLayers = layerDefs.map((def) => {
            const stars = [];
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
            return { stars };
        });
    }

    updateStarfield(time, delta) {
        if (!this.starfieldLayers) return;

        const dt = delta / 1000;
        const driftX = this.starfieldAmbientVx * dt * 0.14;
        const driftY = this.starfieldAmbientVy * dt * 0.14;

        const cam = this.cameras.main;
        const mid = cam.midPoint;
        const W = this.scale.width;
        const H = this.scale.height;
        const halfDiag = Math.sqrt((W * 0.5) ** 2 + (H * 0.5) ** 2);
        const recycleR = halfDiag + Math.max(W, H) * 0.62;
        const recycleR2 = recycleR * recycleR;
        const minSpawnR = halfDiag + 55;

        this.starfieldLayers.forEach((layer) => {
            layer.stars.forEach((star) => {
                star.img.x += driftX;
                star.img.y += driftY;

                const dx = star.img.x - mid.x;
                const dy = star.img.y - mid.y;
                if (dx * dx + dy * dy > recycleR2) {
                    const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
                    const d = Phaser.Math.FloatBetween(minSpawnR, recycleR * 0.94);
                    star.img.setPosition(mid.x + Math.cos(ang) * d, mid.y + Math.sin(ang) * d);
                }

                if (star.twinkle > 0) {
                    const pulse = Math.sin(time * 0.0028 + star.twinklePhase) * 0.5 + 0.5;
                    star.img.setAlpha(star.baseAlpha * (1 - star.twinkle + pulse * star.twinkle));
                }
            });
        });
    }

    update(time, delta) {
        this.updateStarfield(time, delta);
        if (this.health <= 0) return;

        this.handlePlayerMovement();
        this.clampPlayerSpeed();
        this.maybeRecenterWorld();

        if (time > this.lastFired) {
            this.fireBullet();
            this.lastFired = time + this.fireRate;
        }

        this.enemies.getChildren().forEach(enemy => {
            this.physics.moveToObject(enemy, this.player, this.enemyMaxSpeed);
        });

        this.cullDistantEnemies();

        const magnetRange = 100;
        const baseMagnetSpeed = 100;

        this.coins.getChildren().forEach(coin => {
            const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, coin.x, coin.y);
            if (distance < magnetRange) {
                const proximity = 1 - (distance / magnetRange);
                const speed = baseMagnetSpeed + (proximity * proximity * 600);
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
        this.bullets.getChildren().forEach(bullet => {
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

    maybeRecenterWorld() {
        const t = this.worldRecenterThreshold;
        if (Math.abs(this.player.x) < t && Math.abs(this.player.y) < t) {
            return;
        }
        const ox = this.player.x;
        const oy = this.player.y;
        this.player.setPosition(0, 0);
        this.enemies.getChildren().forEach((e) => {
            e.setPosition(e.x - ox, e.y - oy);
        });
        this.coins.getChildren().forEach((c) => {
            c.setPosition(c.x - ox, c.y - oy);
        });
        this.bullets.getChildren().forEach((b) => {
            if (!b.active) return;
            b.setPosition(b.x - ox, b.y - oy);
        });
        if (this.starfieldLayers) {
            this.starfieldLayers.forEach((layer) => {
                layer.stars.forEach((star) => {
                    star.img.x -= ox;
                    star.img.y -= oy;
                });
            });
        }
    }

    updateRadar() {
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
        this.radarGraphics.lineBetween(this.radarX - this.radarRadius, this.radarY, this.radarX + this.radarRadius, this.radarY);
        this.radarGraphics.lineBetween(this.radarX, this.radarY - this.radarRadius, this.radarX, this.radarY + this.radarRadius);

        const px = this.player.x;
        const py = this.player.y;
        const scale = this.radarRadius / this.radarRange;

        this.enemies.getChildren().forEach(enemy => {
            const dx = enemy.x - px;
            const dy = enemy.y - py;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= this.radarRange) {
                const radarX = this.radarX + dx * scale;
                const radarY = this.radarY + dy * scale;
                this.radarGraphics.fillStyle(0xff0000, 0.8);
                this.radarGraphics.fillCircle(radarX, radarY, 3);
            }
        });

        this.coins.getChildren().forEach(coin => {
            const dx = coin.x - px;
            const dy = coin.y - py;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= this.radarRange) {
                const radarX = this.radarX + dx * scale;
                const radarY = this.radarY + dy * scale;
                this.radarGraphics.fillStyle(0xffff00, 0.8);
                this.radarGraphics.fillCircle(radarX, radarY, 2);
            }
        });

        this.radarGraphics.fillStyle(0xffffff, 1);
        this.radarGraphics.fillCircle(this.radarX, this.radarY, 2);
    }

    cullDistantEnemies() {
        const px = this.player.x;
        const py = this.player.y;
        const d2 = this.enemyCullDistance * this.enemyCullDistance;
        this.enemies.getChildren().forEach((enemy) => {
            const dx = enemy.x - px;
            const dy = enemy.y - py;
            if (dx * dx + dy * dy > d2) {
                enemy.destroy();
            }
        });
    }

    clampPlayerSpeed() {
        if (!this.player || !this.player.body) return;
        const body = this.player.body;
        const vx = body.velocity.x;
        const vy = body.velocity.y;
        const m2 = vx * vx + vy * vy;
        const max = this.playerMaxSpeed;
        const max2 = max * max;
        if (m2 <= max2 || m2 < 1e-6) return;
        const inv = max / Math.sqrt(m2);
        body.setVelocity(vx * inv, vy * inv);
    }

    handlePlayerMovement() {
        const thrust = 300;
        const r = this.player.rotation;

        if (this.cursors.left.isDown || this.wasd.A.isDown) {
            this.player.setAngularVelocity(-220);
        } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
            this.player.setAngularVelocity(220);
        } else {
            this.player.setAngularVelocity(0);
        }

        let ax = 0;
        let ay = 0;

        if (this.cursors.up.isDown || this.wasd.W.isDown) {
            ax += Math.cos(r) * thrust;
            ay += Math.sin(r) * thrust;
        } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
            ax -= Math.cos(r) * thrust;
            ay -= Math.sin(r) * thrust;
        }

        if (this.qeKeys.Q.isDown) {
            ax += Math.cos(r - Math.PI / 2) * thrust;
            ay += Math.sin(r - Math.PI / 2) * thrust;
        }
        if (this.qeKeys.E.isDown) {
            ax += Math.cos(r + Math.PI / 2) * thrust;
            ay += Math.sin(r + Math.PI / 2) * thrust;
        }

        this.player.setAcceleration(ax, ay);
        this.updateThrusterVisual(ax, ay);
        this.updateThrusterSound(ax, ay);

        const rotatingLeft = this.cursors.left.isDown || this.wasd.A.isDown;
        const rotatingRight = this.cursors.right.isDown || this.wasd.D.isDown;
        this.updateManeuverThrusterVisual(rotatingLeft, rotatingRight);
    }

    updateThrusterSound(ax, ay) {
        const thrusting = ax * ax + ay * ay >= 1;
        if (!this.thrusterRumble) {
            return;
        }
        if (thrusting) {
            const ctx = this.sound.context;
            if (ctx && ctx.state === 'suspended') {
                ctx.resume();
            }
            if (!this.thrusterRumble.isPlaying) {
                this.thrusterRumble.play();
            }
        } else if (this.thrusterRumble.isPlaying) {
            this.thrusterRumble.stop();
        }
    }

    updateThrusterVisual(ax, ay) {
        const magSq = ax * ax + ay * ay;
        if (magSq < 1) {
            this.thrusterEmitter.emitting = false;
            this.thrusterHaloEmitter.emitting = false;
            return;
        }

        const mag = Math.sqrt(magSq);
        const nx = ax / mag;
        const ny = ay / mag;
        const offset = 14;
        const px = this.player.x - nx * offset;
        const py = this.player.y - ny * offset;

        const deg = Phaser.Math.RadToDeg(Math.atan2(-ay, -ax));

        this.thrusterHaloEmitter.setPosition(px, py);
        this.thrusterHaloEmitter.ops.angle.loadConfig({ angle: { min: deg - 38, max: deg + 38 } });
        this.thrusterHaloEmitter.emitting = true;

        this.thrusterEmitter.setPosition(px, py);
        this.thrusterEmitter.ops.angle.loadConfig({ angle: { min: deg - 26, max: deg + 26 } });
        this.thrusterEmitter.emitting = true;
    }

    updateManeuverThrusterVisual(rotatingLeft, rotatingRight) {
        const r = this.player.rotation;
        const d = 13;

        if (rotatingLeft) {
            const sx = -Math.sin(r);
            const sy = Math.cos(r);
            const deg = Phaser.Math.RadToDeg(Math.atan2(sy, sx));
            this.rcsStarboardEmitter.setPosition(this.player.x + sx * d, this.player.y + sy * d);
            this.rcsStarboardEmitter.ops.angle.loadConfig({ angle: { min: deg - 22, max: deg + 22 } });
            this.rcsStarboardEmitter.emitting = true;
            this.rcsPortEmitter.emitting = false;
        } else if (rotatingRight) {
            const sx = Math.sin(r);
            const sy = -Math.cos(r);
            const deg = Phaser.Math.RadToDeg(Math.atan2(sy, sx));
            this.rcsPortEmitter.setPosition(this.player.x + sx * d, this.player.y + sy * d);
            this.rcsPortEmitter.ops.angle.loadConfig({ angle: { min: deg - 22, max: deg + 22 } });
            this.rcsPortEmitter.emitting = true;
            this.rcsStarboardEmitter.emitting = false;
        } else {
            this.rcsPortEmitter.emitting = false;
            this.rcsStarboardEmitter.emitting = false;
        }
    }

    fireBullet() {
        const offset = 20;
        const spawnX = this.player.x + Math.cos(this.player.rotation) * offset;
        const spawnY = this.player.y + Math.sin(this.player.rotation) * offset;

        let bullet = this.bullets.get(spawnX, spawnY);

        if (bullet) {
            bullet.setActive(true);
            bullet.setVisible(true);

            const bulletSpeed = 500;
            const vx = Math.cos(this.player.rotation) * bulletSpeed;
            const vy = Math.sin(this.player.rotation) * bulletSpeed;

            bullet.body.setVelocity(vx, vy);
        }
    }

    spawnEnemy() {
        if (this.health <= 0 || !this.player) {
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

        const enemy = this.enemies.create(x, y, 'enemy');
        enemy.setCollideWorldBounds(false);
    }

    spawnCoin(x, y) {
        this.coins.create(x, y, 'coin');
    }

    collectCoin(player, coin) {
        coin.destroy();
        this.coinCount += 1;
        this.coinText.setText('Coins: ' + this.coinCount);
        this.sound.play('pickupCoin');
    }

    hitEnemy(bullet, enemy) {
        bullet.setActive(false);
        bullet.setVisible(false);
        bullet.body.setVelocity(0, 0);

        this.explosionEmitter.explode(15, enemy.x, enemy.y);
        this.spawnCoin(enemy.x, enemy.y);
        enemy.destroy();

        this.score += 10;
        this.scoreText.setText('Score: ' + this.score);

        this.sound.play('enemyDestroyed');
    }

    hitPlayer(player, enemy) {
        this.explosionEmitter.explode(15, enemy.x, enemy.y);
        enemy.destroy();

        this.sound.play('playerDamage');

        this.cameras.main.flash(200, 255, 0, 0);
        this.cameras.main.shake(200, 0.01);

        this.health -= 10;
        this.healthText.setText('Health: ' + this.health);

        if (this.health <= 0) {
            this.thrusterEmitter.emitting = false;
            this.thrusterHaloEmitter.emitting = false;
            this.rcsPortEmitter.emitting = false;
            this.rcsStarboardEmitter.emitting = false;
            if (this.thrusterRumble && this.thrusterRumble.isPlaying) {
                this.thrusterRumble.stop();
            }
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
