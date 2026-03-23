/**
 * Void Wake - Minimal Playable MVP
 * A simple Vampire Survivors-style space shooter in Phaser 3.
 */

class MainScene extends Phaser.Scene {
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
        this.fireRate = 500; // ms
        this.spawnRate = 1000; // ms
    }

    preload() {
        this.load.audio('playerDamage', 'assets/playerDamage.wav');
        this.load.audio('playerDeath', 'assets/playerDeath.wav');
        this.load.audio('enemyDestroyed', 'assets/enemyDestroyed.wav');
        this.load.audio('pickupCoin', 'assets/pickupCoin.wav');
        this.load.audio('thrusterRumble', 'assets/thrusterRumble.wav');
    }

    create() {
        // Create textures for player, bullet, and enemy
        this.createTextures();

        // Setup Player
        this.player = this.physics.add.sprite(400, 300, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.setRotation(-Math.PI / 2); // Start pointing up
        this.player.setDamping(true);
        this.player.setDrag(0.99); // Slight friction
        this.player.setMaxVelocity(400);

        // Setup Groups
        this.bullets = this.physics.add.group({
            defaultKey: 'bullet',
            maxSize: 50
        });

        this.enemies = this.physics.add.group();
        this.coins = this.physics.add.group();

        // Input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D');
        this.qeKeys = this.input.keyboard.addKeys('Q,E');

        // UI
        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#fff' });
        this.healthText = this.add.text(16, 48, 'Health: 100', { fontSize: '24px', fill: '#fff' });
        this.coinText = this.add.text(16, 80, 'Coins: 0', { fontSize: '24px', fill: '#fff' });

        // Particle Emitter for Explosions
        this.explosionEmitter = this.add.particles(0, 0, 'bullet', {
            speed: { min: 50, max: 150 },
            scale: { start: 1, end: 0 },
            tint: [0xff0000, 0xffa500, 0xffff00], // Red, Orange, Yellow
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

        // Timers
        this.time.addEvent({
            delay: this.spawnRate,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        // Collisions
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
        // Player: Green Triangle (pointing Right)
        let graphics = this.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0x00ff00, 1);
        graphics.fillTriangle(0, 0, 0, 32, 32, 16);
        graphics.generateTexture('player', 32, 32);

        // Enemy: Red Square
        graphics.clear();
        graphics.fillStyle(0xff0000, 1);
        graphics.fillRect(0, 0, 24, 24);
        graphics.generateTexture('enemy', 24, 24);

        // Bullet: White Circle
        graphics.clear();
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('bullet', 8, 8);

        // Coin: Yellow Circle
        graphics.clear();
        graphics.fillStyle(0xffff00, 1);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('coin', 8, 8);

        // Thruster: layered flare (bright core + soft falloff)
        graphics.clear();
        graphics.fillStyle(0xffffff, 0.22);
        graphics.fillCircle(10, 10, 10);
        graphics.fillStyle(0xffffff, 0.5);
        graphics.fillCircle(10, 10, 6);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(10, 10, 3);
        graphics.generateTexture('thruster', 20, 20);

        // Wide soft blob for outer ion plume
        graphics.clear();
        graphics.fillStyle(0xaaccff, 0.2);
        graphics.fillCircle(14, 14, 14);
        graphics.fillStyle(0xffffff, 0.35);
        graphics.fillCircle(14, 14, 8);
        graphics.generateTexture('thrusterHalo', 28, 28);
    }

    update(time) {
        if (this.health <= 0) return;

        // Player Movement
        this.handlePlayerMovement();

        // Auto Firing
        if (time > this.lastFired) {
            this.fireBullet();
            this.lastFired = time + this.fireRate;
        }

        // Enemy Movement (Follow player)
        this.enemies.getChildren().forEach(enemy => {
            this.physics.moveToObject(enemy, this.player, 100);
        });

        // Coin Magnet Logic
        const magnetRange = 100;
        const baseMagnetSpeed = 100;

        this.coins.getChildren().forEach(coin => {
            const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, coin.x, coin.y);
            if (distance < magnetRange) {
                // Calculation: normalized distance from 0 (at magnetRange) to 1 (at player)
                const proximity = 1 - (distance / magnetRange);
                // Accelerated speed: base speed plus an extra boost that grows quadratically
                const speed = baseMagnetSpeed + (proximity * proximity * 600);
                this.physics.moveToObject(coin, this.player, speed);
            } else {
                // Stop the coin if it's no longer in range (and was moving)
                if (coin.body.velocity.x !== 0 || coin.body.velocity.y !== 0) {
                    coin.body.setVelocity(0, 0);
                }
            }
        });

        // Cleanup bullets that leave the screen
        this.bullets.getChildren().forEach(bullet => {
            if (bullet.y < 0 || bullet.y > 600 || bullet.x < 0 || bullet.x > 800) {
                bullet.setActive(false);
                bullet.setVisible(false);
            }
        });
    }

    handlePlayerMovement() {
        const thrust = 300;
        const r = this.player.rotation;

        // Handle Rotation
        if (this.cursors.left.isDown || this.wasd.A.isDown) {
            this.player.setAngularVelocity(-150);
        } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
            this.player.setAngularVelocity(150);
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

    fireBullet() {
        // Spawn bullet slightly in front of the player based on rotation
        const offset = 20;
        const spawnX = this.player.x + Math.cos(this.player.rotation) * offset;
        const spawnY = this.player.y + Math.sin(this.player.rotation) * offset;
        
        let bullet = this.bullets.get(spawnX, spawnY);

        if (bullet) {
            bullet.setActive(true);
            bullet.setVisible(true);
            
            const bulletSpeed = 500;
            // Fire in the direction the player is currently facing
            const vx = Math.cos(this.player.rotation) * bulletSpeed;
            const vy = Math.sin(this.player.rotation) * bulletSpeed;
            
            bullet.body.setVelocity(vx, vy);
        }
    }

    spawnEnemy() {
        // Spawn enemy at random edge of screen
        let x, y;
        if (Math.random() > 0.5) {
            x = Math.random() > 0.5 ? 0 : 800;
            y = Math.random() * 600;
        } else {
            x = Math.random() * 800;
            y = Math.random() > 0.5 ? 0 : 600;
        }

        let enemy = this.enemies.create(x, y, 'enemy');
        enemy.setCollideWorldBounds(true);
    }

    spawnCoin(x, y) {
        let coin = this.coins.create(x, y, 'coin');
        // Simple scale effect or physics properties could be added here
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

        // Play damage sound
        this.sound.play('playerDamage');

        // Screen effects: Flash and Shake
        this.cameras.main.flash(200, 255, 0, 0); // Red flash
        this.cameras.main.shake(200, 0.01);      // Subtle shake

        this.health -= 10;
        this.healthText.setText('Health: ' + this.health);

        if (this.health <= 0) {
            this.thrusterEmitter.emitting = false;
            this.thrusterHaloEmitter.emitting = false;
            if (this.thrusterRumble && this.thrusterRumble.isPlaying) {
                this.thrusterRumble.stop();
            }
            this.physics.pause();
            this.player.setTint(0xff0000);
            this.player.setVisible(false);
            
            // Big particle explosion for player death
            this.explosionEmitter.explode(100, this.player.x, this.player.y);
            
            // More intense camera effects on death
            this.cameras.main.shake(500, 0.05);
            this.cameras.main.flash(500, 255, 255, 255); // White flash for death

            this.add.text(400, 300, 'GAME OVER', { fontSize: '64px', fill: '#fff' }).setOrigin(0.5);
            this.sound.play('playerDeath');
        }
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 800,
    height: 600,
    audio: {
        disableWebAudio: false
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: MainScene
};

const game = new Phaser.Game(config);
