import Phaser from 'phaser';
import { PLAYER } from '../config';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private keys: {
    left: Phaser.Input.Keyboard.Key[];
    right: Phaser.Input.Keyboard.Key[];
    jump: Phaser.Input.Keyboard.Key[];
  };
  private lastGroundedAt = 0;
  private jumpPressedAt = -Infinity;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);

    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: [kb.addKey(K.LEFT), kb.addKey(K.A)],
      right: [kb.addKey(K.RIGHT), kb.addKey(K.D)],
      jump: [kb.addKey(K.UP), kb.addKey(K.W), kb.addKey(K.SPACE)],
    };
  }

  update(time: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const down = (keys: Phaser.Input.Keyboard.Key[]) => keys.some((k) => k.isDown);
    const justDown = (keys: Phaser.Input.Keyboard.Key[]) =>
      keys.some((k) => Phaser.Input.Keyboard.JustDown(k));

    // Horizontal
    const dir = (down(this.keys.right) ? 1 : 0) - (down(this.keys.left) ? 1 : 0);
    this.setVelocityX(dir * PLAYER.speed);
    if (dir !== 0) this.setFlipX(dir < 0);

    // Springen mit Coyote-Time und Jump-Buffer
    if (body.blocked.down) this.lastGroundedAt = time;
    if (justDown(this.keys.jump)) this.jumpPressedAt = time;

    const canJump = time - this.lastGroundedAt <= PLAYER.coyoteTimeMs;
    const wantsJump = time - this.jumpPressedAt <= PLAYER.jumpBufferMs;
    if (canJump && wantsJump) {
      this.setVelocityY(-PLAYER.jumpVelocity);
      this.lastGroundedAt = -Infinity;
      this.jumpPressedAt = -Infinity;
    }

    // Variable Sprunghöhe: Taste loslassen = kürzerer Sprung
    if (!down(this.keys.jump) && body.velocity.y < 0) {
      this.setVelocityY(body.velocity.y * 0.85);
    }
  }
}
