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

function createRcsEmitter(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
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

export class RcsEffect {
    private portEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    private starboardEmitter: Phaser.GameObjects.Particles.ParticleEmitter;

    constructor(scene: Phaser.Scene) {
        this.portEmitter = createRcsEmitter(scene);
        this.starboardEmitter = createRcsEmitter(scene);
    }

    update(
        playerX: number,
        playerY: number,
        rotation: number,
        isRotatingLeft: boolean,
        isRotatingRight: boolean
    ): void {
        const d = 13;

        if (isRotatingLeft) {
            const sx = -Math.sin(rotation);
            const sy = Math.cos(rotation);
            const deg = Phaser.Math.RadToDeg(Math.atan2(sy, sx));
            this.starboardEmitter.setPosition(playerX + sx * d, playerY + sy * d);
            setEmitterAngle(this.starboardEmitter, deg - 22, deg + 22);
            this.starboardEmitter.emitting = true;
        } else {
            this.starboardEmitter.emitting = false;
        }

        if (isRotatingRight) {
            const sx = Math.sin(rotation);
            const sy = -Math.cos(rotation);
            const deg = Phaser.Math.RadToDeg(Math.atan2(sy, sx));
            this.portEmitter.setPosition(playerX + sx * d, playerY + sy * d);
            setEmitterAngle(this.portEmitter, deg - 22, deg + 22);
            this.portEmitter.emitting = true;
        } else {
            this.portEmitter.emitting = false;
        }
    }

    stop(): void {
        this.portEmitter.emitting = false;
        this.starboardEmitter.emitting = false;
    }
}
