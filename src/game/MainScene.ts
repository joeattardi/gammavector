import Phaser from 'phaser';
import { Player } from './Player';
import { buildShipCommand } from './InputMapper';
import { Starfield } from './Starfield';
import { createTextures } from './textures';
import { Radar } from './Radar';
import { EnemySpawner } from './EnemySpawner';
import { Weapons } from './Weapons';
import { CoinManager } from './CoinManager';
import { CombatResolver } from './CombatResolver';
import { loadAssets } from './AssetManifest';

export default class MainScene extends Phaser.Scene {
    private player!: Player;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private keys!: Record<string, Phaser.Input.Keyboard.Key>;
    private starfield!: Starfield;
    private readonly worldRecenterThreshold = 12000;
    private radar!: Radar;
    private spawner!: EnemySpawner;
    private weapons!: Weapons;
    private coinManager!: CoinManager;
    private combat!: CombatResolver;

    constructor() {
        super('MainScene');
    }

    preload(): void {
        loadAssets(this);
    }

    create(): void {
        createTextures(this);
        this.starfield = new Starfield(this);
        this.starfield.setup();

        this.sound.play('backgroundMusic', { loop: true, volume: 0.3 });

        this.physics.world.setBounds(-2e6, -2e6, 4e6, 4e6);
        this.physics.world.setBoundsCollision(false, false, false, false);

        this.player = new Player(this, 0, 0);

        this.weapons = new Weapons(this, this.player);
        this.spawner = new EnemySpawner(this, this.player);

        this.coinManager = new CoinManager(this, this.player);
        this.combat = new CombatResolver(this, this.player, this.coinManager);

        this.cursors = this.input.keyboard!.createCursorKeys();
        this.keys = this.input.keyboard?.addKeys('W,A,S,D,Q,E') as Record<
            string,
            Phaser.Input.Keyboard.Key
        >;

        this.radar = new Radar(this, 752, 602, 40, 2500);
        this.radar.setup();

        this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
        this.cameras.main.setRoundPixels(true);

        this.physics.add.overlap(
            this.weapons.bullets,
            this.spawner.group,
            this.combat.hitEnemy.bind(this.combat) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            undefined,
            this
        );
        this.physics.add.overlap(
            this.player,
            this.spawner.group,
            this.combat.hitPlayer.bind(this.combat) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            undefined,
            this
        );
        this.physics.add.overlap(
            this.player,
            this.coinManager.group,
            this.coinManager.collect.bind(this.coinManager) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
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

    update(time: number, delta: number): void {
        this.starfield.update(time, delta);

        if (this.player.health <= 0) {
            return;
        }

        const command = buildShipCommand(this.cursors, this.keys, this.player.rotation);
        this.player.update(command);

        this.maybeRecenterWorld();
        this.weapons.update(time);
        this.spawner.update();
        this.coinManager.updateMagnet();
        this.radar.update(
            this.player.x,
            this.player.y,
            this.spawner.group.getChildren(),
            this.coinManager.group.getChildren()
        );
    }

    private maybeRecenterWorld(): void {
        const t = this.worldRecenterThreshold;
        if (Math.abs(this.player.x) < t && Math.abs(this.player.y) < t) {
            return;
        }
        const ox = this.player.x;
        const oy = this.player.y;
        this.player.setPosition(0, 0);
        this.spawner.group.getChildren().forEach((e) => {
            const sprite = e as Phaser.GameObjects.Sprite;
            sprite.setPosition(sprite.x - ox, sprite.y - oy);
        });
        this.coinManager.group.getChildren().forEach((c) => {
            const sprite = c as Phaser.GameObjects.Sprite;
            sprite.setPosition(sprite.x - ox, sprite.y - oy);
        });
        this.weapons.bullets.getChildren().forEach((b) => {
            const sprite = b as Phaser.GameObjects.Sprite;
            if (!sprite.active) return;
            sprite.setPosition(sprite.x - ox, sprite.y - oy);
        });
        this.starfield.recenter(ox, oy);
    }
}
