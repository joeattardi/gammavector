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
        // No external assets for MVP; we'll use graphics to generate textures.
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

        // UI
        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#fff' });
        this.healthText = this.add.text(16, 48, 'Health: 100', { fontSize: '24px', fill: '#fff' });
        this.coinText = this.add.text(16, 80, 'Coins: 0', { fontSize: '24px', fill: '#fff' });

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
        graphics.fillCircle(8, 8, 8);
        graphics.generateTexture('coin', 16, 16);
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
        const rotationSpeed = 3; // Radians per second

        // Handle Rotation
        if (this.cursors.left.isDown || this.wasd.A.isDown) {
            this.player.setAngularVelocity(-150);
        } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
            this.player.setAngularVelocity(150);
        } else {
            this.player.setAngularVelocity(0);
        }

        // Handle Thrust
        if (this.cursors.up.isDown || this.wasd.W.isDown) {
            this.physics.velocityFromRotation(this.player.rotation, thrust, this.player.body.acceleration);
        } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
            this.physics.velocityFromRotation(this.player.rotation, -thrust, this.player.body.acceleration);
        } else {
            this.player.setAcceleration(0);
        }
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
    }

    hitEnemy(bullet, enemy) {
        bullet.setActive(false);
        bullet.setVisible(false);
        bullet.body.setVelocity(0, 0);
        
        this.spawnCoin(enemy.x, enemy.y);
        enemy.destroy();

        this.score += 10;
        this.scoreText.setText('Score: ' + this.score);
    }

    hitPlayer(player, enemy) {
        enemy.destroy();

        this.health -= 10;
        this.healthText.setText('Health: ' + this.health);

        if (this.health <= 0) {
            this.physics.pause();
            this.player.setTint(0xff0000);
            this.add.text(400, 300, 'GAME OVER', { fontSize: '64px', fill: '#fff' }).setOrigin(0.5);
        }
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 800,
    height: 600,
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
