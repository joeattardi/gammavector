import Phaser from 'phaser';

function setEmitterAngle(
    emitter: Phaser.GameObjects.Particles.ParticleEmitter,
    min: number,
    max: number
): void {
    (emitter.ops.angle as { loadConfig(cfg: object): void }).loadConfig({
        angle: { min, max }
    });
}

export class ThrusterEffect {
    private haloEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    private coreEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    private rumble: Phaser.Sound.BaseSound;
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.haloEmitter = scene.add.particles(0, 0, 'thrusterHalo', {
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
        this.haloEmitter.setDepth(-2);

        this.coreEmitter = scene.add.particles(0, 0, 'thruster', {
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
        this.coreEmitter.setDepth(-1);

        this.rumble = scene.sound.add('thrusterRumble', {
            loop: true,
            volume: 2
        });
    }

    update(playerX: number, playerY: number, acceleration: { x: number; y: number }): void {
        const magSq = acceleration.x * acceleration.x + acceleration.y * acceleration.y;

        if (magSq < 1) {
            this.haloEmitter.emitting = false;
            this.coreEmitter.emitting = false;
            this.stopSound();
            return;
        }

        const mag = Math.sqrt(magSq);
        const nx = acceleration.x / mag;
        const ny = acceleration.y / mag;
        const offset = 14;
        const px = playerX - nx * offset;
        const py = playerY - ny * offset;

        const deg = Phaser.Math.RadToDeg(Math.atan2(-acceleration.y, -acceleration.x));

        this.haloEmitter.setPosition(px, py);
        setEmitterAngle(this.haloEmitter, deg - 38, deg + 38);
        this.haloEmitter.emitting = true;

        this.coreEmitter.setPosition(px, py);
        setEmitterAngle(this.coreEmitter, deg - 26, deg + 26);
        this.coreEmitter.emitting = true;

        this.startSound();
    }

    stop(): void {
        this.haloEmitter.emitting = false;
        this.coreEmitter.emitting = false;
        this.stopSound();
    }

    private startSound(): void {
        if (!this.rumble) return;
        const ctx = (this.scene.sound as Phaser.Sound.WebAudioSoundManager).context;
        if (ctx && ctx.state === 'suspended') {
            ctx.resume();
        }
        if (!this.rumble.isPlaying) {
            this.rumble.play();
        }
    }

    private stopSound(): void {
        if (this.rumble?.isPlaying) {
            this.rumble.stop();
        }
    }
}
