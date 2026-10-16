import Phaser from 'phaser';
import { GAME_HEIGHT, TILE } from '../config';
import { LEVEL_1 } from '../levels/level1';
import { Player } from '../objects/Player';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private score = 0;

  constructor() {
    super('Game');
  }

  create(): void {
    this.score = 0;
    const rows = LEVEL_1;
    const worldW = rows[0].length * TILE;
    const worldH = rows.length * TILE;
    this.physics.world.setBounds(0, 0, worldW, worldH + TILE * 4);

    const ground = this.physics.add.staticGroup();
    const coins = this.physics.add.staticGroup();
    let spawn = { x: TILE * 2, y: TILE * 2 };
    let goalPos: { x: number; y: number } | undefined;

    rows.forEach((row, ty) => {
      [...row].forEach((ch, tx) => {
        const x = tx * TILE + TILE / 2;
        const y = ty * TILE + TILE / 2;
        if (ch === '#') ground.create(x, y, 'ground');
        else if (ch === 'o') coins.create(x, y, 'coin');
        else if (ch === 'P') spawn = { x, y };
        else if (ch === 'G') goalPos = { x, y };
      });
    });

    this.player = new Player(this, spawn.x, spawn.y);
    this.physics.add.collider(this.player, ground);
    this.physics.add.overlap(this.player, coins, (_p, coin) => {
      (coin as Phaser.Physics.Arcade.Sprite).disableBody(true, true);
      this.score += 1;
      this.events.emit('score', this.score);
    });

    if (goalPos) {
      const goal = this.physics.add.staticImage(goalPos.x, goalPos.y - 32, 'goal');
      this.physics.add.overlap(this.player, goal, () => this.win());
    }

    this.cameras.main.setBounds(0, 0, worldW, Math.max(worldH, GAME_HEIGHT));
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.scene.launch('UI');
  }

  update(time: number): void {
    this.player.update(time);
    // Runtergefallen? -> Neustart
    if (this.player.y > this.physics.world.bounds.height - TILE) this.restart();
  }

  private win(): void {
    this.physics.pause();
    this.events.emit('win', this.score);
    this.time.delayedCall(2000, () => this.restart());
  }

  private restart(): void {
    this.scene.stop('UI');
    this.scene.restart();
  }
}
