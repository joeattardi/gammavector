import Phaser from 'phaser';

export interface ShipCommand {
    acceleration: { x: number; y: number };
    angularVelocity: number;
    isRotatingLeft: boolean;
    isRotatingRight: boolean;
}

interface AccelerationVector {
    x: number;
    y: number;
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
    if (isRotatingLeft && !isRotatingRight) {
        angularVelocity = -ANGULAR_SPEED;
    } else if (isRotatingRight && !isRotatingLeft) {
        angularVelocity = ANGULAR_SPEED;
    }

    const acceleration: AccelerationVector = { x: 0, y: 0 };

    if (cursors.up.isDown || keys.W.isDown) {
        applyAcceleration(acceleration, rotation, 1, THRUST);
    }

    if (cursors.down.isDown || keys.S.isDown) {
        applyAcceleration(acceleration, rotation, -1, THRUST);
    }

    if (keys.Q.isDown) {
        applyLateralAcceleration(acceleration, rotation, -1);
    }

    if (keys.E.isDown) {
        applyLateralAcceleration(acceleration, rotation, 1);
    }

    return { acceleration, angularVelocity, isRotatingLeft, isRotatingRight };
}

function applyAcceleration(
    acceleration: AccelerationVector,
    rotation: number,
    offset: number,
    thrust: number
) {
    acceleration.x += offset * (Math.cos(rotation) * thrust);
    acceleration.y += offset * (Math.sin(rotation) * thrust);
}

function applyLateralAcceleration(
    acceleration: AccelerationVector,
    rotation: number,
    offset: number
) {
    acceleration.x += Math.cos(rotation + (offset * Math.PI) / 2) * THRUST;
    acceleration.y += Math.sin(rotation + (offset * Math.PI) / 2) * THRUST;
}
