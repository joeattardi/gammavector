import Phaser from 'phaser';

export interface ShipCommand {
    acceleration: { x: number; y: number };
    angularVelocity: number;
    isRotatingLeft: boolean;
    isRotatingRight: boolean;
}

const THRUST = 300;
const ANGULAR_SPEED = 220;

export function buildShipCommand(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    keys: Record<string, Phaser.Input.Keyboard.Key>,
    rotation: number
): ShipCommand {
    const isRotatingLeft = cursors.left.isDown || keys.A.isDown;
    const isRotatingRight = cursors.right.isDown || keys.D.isDown;

    let angularVelocity = 0;
    if (isRotatingLeft && !isRotatingRight) angularVelocity = -ANGULAR_SPEED;
    else if (isRotatingRight && !isRotatingLeft) angularVelocity = ANGULAR_SPEED;

    const acceleration = { x: 0, y: 0 };

    if (cursors.up.isDown || keys.W.isDown) {
        acceleration.x += Math.cos(rotation) * THRUST;
        acceleration.y += Math.sin(rotation) * THRUST;
    } else if (cursors.down.isDown || keys.S.isDown) {
        acceleration.x -= Math.cos(rotation) * THRUST;
        acceleration.y -= Math.sin(rotation) * THRUST;
    }

    if (keys.Q.isDown) {
        acceleration.x += Math.cos(rotation - Math.PI / 2) * THRUST;
        acceleration.y += Math.sin(rotation - Math.PI / 2) * THRUST;
    }

    if (keys.E.isDown) {
        acceleration.x += Math.cos(rotation + Math.PI / 2) * THRUST;
        acceleration.y += Math.sin(rotation + Math.PI / 2) * THRUST;
    }

    return { acceleration, angularVelocity, isRotatingLeft, isRotatingRight };
}
