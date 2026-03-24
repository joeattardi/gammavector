import Phaser from 'phaser';

const DEFAULT_MAX_SPEED = 220;

export class Player extends Phaser.Physics.Arcade.Sprite {
    declare body: Phaser.Physics.Arcade.Body;
    health: number;

    private thrusterHaloEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
    private thrusterEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
    private thrusterRumble!: Phaser.Sound.BaseSound;

    private rcsPortEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
    private rcsStarboardEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'player');

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(true);
        this.setRotation(-Math.PI / 2);
        this.setDamping(true);
        this.setDrag(0.99);
        this.setMaxVelocity(DEFAULT_MAX_SPEED, DEFAULT_MAX_SPEED);

        this.initializeThrusterEmitters();

        this.thrusterRumble = scene.sound.add('thrusterRumble', {
            loop: true,
            volume: 2
        });

        this.health = 1000;
    }

    update(
        cursors: Phaser.Types.Input.Keyboard.CursorKeys,
        keys: Record<string, Phaser.Input.Keyboard.Key>
    ) {
        this.updateMovement(cursors, keys);

        const velocityX = this.body.velocity.x;
        const velocityY = this.body.velocity.y;

        const m2 = velocityX * velocityX + velocityY * velocityY;
        const max = DEFAULT_MAX_SPEED;
        const max2 = max * max;

        if (m2 <= max2 || m2 < 1e-6) {
            return;
        }

        const inv = max / Math.sqrt(m2);
        this.body.setVelocity(velocityX * inv, velocityY * inv);
    }

    private initializeThrusterEmitters() {
        this.thrusterHaloEmitter = this.scene.add.particles(0, 0, 'thrusterHalo', {
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

        this.thrusterEmitter = this.scene.add.particles(0, 0, 'thruster', {
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

        this.rcsPortEmitter = createRcsEmitter(this.scene);
        this.rcsStarboardEmitter = createRcsEmitter(this.scene);
    }

    private updateMovement(
        cursors: Phaser.Types.Input.Keyboard.CursorKeys,
        keys: Record<string, Phaser.Input.Keyboard.Key>
    ): void {
        const thrust = 300;

        const isRotatingLeft = cursors.left.isDown || keys.A.isDown;
        const isRotatingRight = cursors.right.isDown || keys.D.isDown;

        if (isRotatingLeft && isRotatingRight) {
            this.setAngularVelocity(0);
        } else if (isRotatingLeft) {
            this.setAngularVelocity(-220);
        } else if (isRotatingRight) {
            this.setAngularVelocity(220);
        } else {
            this.setAngularVelocity(0);
        }

        let acceleration = { x: 0, y: 0 };

        if (cursors.up.isDown || keys.W.isDown) {
            acceleration.x += Math.cos(this.rotation) * thrust;
            acceleration.y += Math.sin(this.rotation) * thrust;
        } else if (cursors.down.isDown || keys.S.isDown) {
            acceleration.x -= Math.cos(this.rotation) * thrust;
            acceleration.y -= Math.sin(this.rotation) * thrust;
        }

        if (keys.Q.isDown) {
            acceleration.x += Math.cos(this.rotation - Math.PI / 2) * thrust;
            acceleration.y += Math.sin(this.rotation - Math.PI / 2) * thrust;
        }

        if (keys.E.isDown) {
            acceleration.x += Math.cos(this.rotation + Math.PI / 2) * thrust;
            acceleration.y += Math.sin(this.rotation + Math.PI / 2) * thrust;
        }

        this.setAcceleration(acceleration.x, acceleration.y);
        this.updateThrusterVisual(acceleration);
        this.updateThrusterSound(acceleration);

        this.updateRcsVisual(isRotatingLeft, isRotatingRight);
    }

    private updateThrusterVisual(acceleration: { x: number; y: number }): void {
        const magSq = acceleration.x * acceleration.x + acceleration.y * acceleration.y;
        if (magSq < 1) {
            this.thrusterEmitter.emitting = false;
            this.thrusterHaloEmitter.emitting = false;
            return;
        }

        const mag = Math.sqrt(magSq);
        const nx = acceleration.x / mag;
        const ny = acceleration.y / mag;
        const offset = 14;
        const px = this.x - nx * offset;
        const py = this.y - ny * offset;

        const deg = Phaser.Math.RadToDeg(Math.atan2(-acceleration.y, -acceleration.x));

        this.thrusterHaloEmitter.setPosition(px, py);
        (this.thrusterHaloEmitter.ops.angle as { loadConfig(cfg: object): void }).loadConfig({
            angle: { min: deg - 38, max: deg + 38 }
        });
        this.thrusterHaloEmitter.emitting = true;

        this.thrusterEmitter.setPosition(px, py);
        (this.thrusterEmitter.ops.angle as { loadConfig(cfg: object): void }).loadConfig({
            angle: { min: deg - 26, max: deg + 26 }
        });
        this.thrusterEmitter.emitting = true;
    }

    private updateRcsVisual(isRotatingLeft: boolean, isRotatingRight: boolean) {
        const r = this.rotation;
        const d = 13;

        if (isRotatingLeft) {
            const sx = -Math.sin(r);
            const sy = Math.cos(r);
            const deg = Phaser.Math.RadToDeg(Math.atan2(sy, sx));
            this.rcsStarboardEmitter.setPosition(this.x + sx * d, this.y + sy * d);
            (this.rcsStarboardEmitter.ops.angle as { loadConfig(cfg: object): void }).loadConfig({
                angle: { min: deg - 22, max: deg + 22 }
            });
            this.rcsStarboardEmitter.emitting = true;
        } else {
            this.rcsStarboardEmitter.emitting = false;
        }

        if (isRotatingRight) {
            const sx = Math.sin(r);
            const sy = -Math.cos(r);
            const deg = Phaser.Math.RadToDeg(Math.atan2(sy, sx));
            this.rcsPortEmitter.setPosition(this.x + sx * d, this.y + sy * d);
            (this.rcsPortEmitter.ops.angle as { loadConfig(cfg: object): void }).loadConfig({
                angle: { min: deg - 22, max: deg + 22 }
            });
            this.rcsPortEmitter.emitting = true;
        } else {
            this.rcsPortEmitter.emitting = false;
        }
    }

    private updateThrusterSound(acceleration: { x: number; y: number }): void {
        const thrusting = acceleration.x * acceleration.x + acceleration.y * acceleration.y >= 1;
        if (!this.thrusterRumble) {
            return;
        }
        if (thrusting) {
            const ctx = (this.scene.sound as Phaser.Sound.WebAudioSoundManager).context;
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
}

function createRcsEmitter(scene: Phaser.Scene) {
    const emitter = scene.add.particles(0, 0, 'rcsPuff', {
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

    emitter.setDepth(-1);

    return emitter;
}
