import Phaser from 'phaser';
import { ThrusterEffect } from './ThrusterEffect';
import { RcsEffect } from './RcsEffect';
import { ShipCommand } from './InputMapper';

const DEFAULT_MAX_SPEED = 220;

export class Player extends Phaser.Physics.Arcade.Sprite {
    declare body: Phaser.Physics.Arcade.Body;
    health: number;

    private thruster: ThrusterEffect;
    private rcs: RcsEffect;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'player');

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(true);
        this.setRotation(-Math.PI / 2);
        this.setDamping(true);
        this.setDrag(0.99);
        this.setMaxVelocity(DEFAULT_MAX_SPEED, DEFAULT_MAX_SPEED);

        this.thruster = new ThrusterEffect(scene);
        this.rcs = new RcsEffect(scene);

        this.health = 100;
    }

    update(command: ShipCommand) {
        this.setAngularVelocity(command.angularVelocity);
        this.setAcceleration(command.acceleration.x, command.acceleration.y);

        this.thruster.update(this.x, this.y, command.acceleration);
        this.rcs.update(
            this.x,
            this.y,
            this.rotation,
            command.isRotatingLeft,
            command.isRotatingRight
        );

        this.clampVelocity();
    }

    stopEffects(): void {
        this.thruster.stop();
        this.rcs.stop();
    }

    private clampVelocity(): void {
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
}
