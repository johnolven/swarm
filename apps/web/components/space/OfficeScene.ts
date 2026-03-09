import * as Phaser from 'phaser';
import { UserPresence } from './types';

interface SocketLike {
  emit: (event: string, data: any) => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
}

const TILE_SIZE = 16;
const SCALE = 2;
const SCALED_TILE = TILE_SIZE * SCALE;

// Cute RPG sprite sheet: 384x96 = 16 cols × 4 rows of 24x24 frames
// Layout: 4 skin variants × 4 walk frames per row, 4 direction rows (down, left, right, up)
const CHAR_FRAME_W = 24;
const CHAR_FRAME_H = 24;
const CHAR_COLS = 16;

// Map dimensions in tiles (matches office-map.png: 512x544 = 32x34 tiles)
const MAP_COLS = 32;
const MAP_ROWS = 34;

interface ZoneData {
  id: string;
  label: string;
  color: string;
  rect: Phaser.Geom.Rectangle;
  graphics?: Phaser.GameObjects.Rectangle;
  labelText?: Phaser.GameObjects.Text;
}

interface CharSprite {
  sprite: Phaser.GameObjects.Sprite;
  nameText: Phaser.GameObjects.Text;
  stateIcon: Phaser.GameObjects.Text;
  container: Phaser.GameObjects.Container;
}

export class OfficeScene extends Phaser.Scene {
  private socket: SocketLike | null = null;
  private teamId = '';
  private playerChar: CharSprite | null = null;
  private otherChars = new Map<string, CharSprite>();
  private userId = '';
  private userName = '';
  private userType: 'agent' | 'user' = 'user';
  private lastDirection: 'up' | 'down' | 'left' | 'right' = 'down';
  private lastSentX = -1;
  private lastSentY = -1;
  private onPresenceUpdate?: (users: UserPresence[]) => void;
  private onChatMessage?: (msg: any) => void;
  private onZoneChange?: (zone: { id: string; label: string } | null) => void;
  private onReady?: () => void;
  private presences: UserPresence[] = [];
  private collisionGrid: number[] = [];
  private zones: ZoneData[] = [];
  private currentZone: ZoneData | null = null;
  private moveTimeout = 0;
  private mockAgents: Array<{
    id: string;
    name: string;
    tileX: number;
    tileY: number;
    direction: 'up' | 'down' | 'left' | 'right';
    char: CharSprite | null;
    lastMoveTime: number;
    moveInterval: number;
    spriteKey: string;
  }> = [];
  // Native keyboard tracking (bypasses Phaser keyboard plugin issues)
  private keysDown = new Set<string>();
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;
  // Track tile position directly instead of deriving from pixel position
  private tileX = 0;
  private tileY = 0;
  private isMoving = false;
  private characterId = 1;

  constructor() {
    super({ key: 'OfficeScene' });
  }

  /** Set scene data before Phaser starts it (avoids init timing issues) */
  configure(data: {
    socket: SocketLike;
    teamId: string;
    userId: string;
    userName: string;
    userType: 'agent' | 'user';
    characterId?: number;
    onPresenceUpdate: (users: UserPresence[]) => void;
    onChatMessage: (msg: any) => void;
    onZoneChange: (zone: { id: string; label: string } | null) => void;
    onReady?: () => void;
  }) {
    this.socket = data.socket;
    this.teamId = data.teamId;
    this.userId = data.userId;
    this.userName = data.userName;
    this.userType = data.userType;
    this.characterId = data.characterId || 1;
    this.onPresenceUpdate = data.onPresenceUpdate;
    this.onChatMessage = data.onChatMessage;
    this.onZoneChange = data.onZoneChange;
    this.onReady = data.onReady;
  }

  preload() {
    this.load.image('office-bg', '/space/maps/office-map.png');
    const charId = String(this.characterId).padStart(3, '0');
    this.load.spritesheet('player-char', `/space/sprites/characters/Character_${charId}.png`, {
      frameWidth: CHAR_FRAME_W,
      frameHeight: CHAR_FRAME_H,
    });
    // Load mock agent sprites (random, excluding player's character)
    const available = Array.from({ length: 41 }, (_, i) => i + 1).filter(id => id !== this.characterId);
    for (let i = 0; i < 2; i++) {
      const pick = available.splice(Math.floor(Math.random() * available.length), 1)[0];
      const mockId = String(pick).padStart(3, '0');
      this.load.spritesheet(`mock-agent-${i}`, `/space/sprites/characters/Character_${mockId}.png`, {
        frameWidth: CHAR_FRAME_W,
        frameHeight: CHAR_FRAME_H,
      });
    }
  }

  create() {
    // Place office background image scaled 2x
    const bg = this.add.image(0, 0, 'office-bg');
    bg.setOrigin(0, 0);
    bg.setScale(SCALE);
    bg.setDepth(0);

    // Build collision grid
    this.buildCollisionGrid();

    // Define zones (rooms visible in the office design)
    this.defineZones();

    // Create character animations for 24x24 spritesheet (16 cols × 4 rows)
    this.createPlayerAnimations();

    // Setup keyboard using native DOM events (more reliable than Phaser's keyboard plugin)
    const emoteMap: Record<string, string> = {
      '1': '\u{1F44B}', '2': '\u{1F44D}', '3': '\u{2753}', '4': '\u{1F4A1}', '5': '\u{1F389}',
    };
    this.keydownHandler = (e: KeyboardEvent) => {
      // Skip when typing in input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const key = e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        e.preventDefault();
        this.keysDown.add(key);
      }
      if (emoteMap[key]) this.sendEmote(emoteMap[key]);
    };
    this.keyupHandler = (e: KeyboardEvent) => {
      this.keysDown.delete(e.key);
    };
    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);

    // Setup socket listeners
    this.setupSocketListeners();

    // Join the space
    this.socket?.emit('space:join', { teamId: this.teamId });

    // Camera setup - world is the scaled map size
    const worldW = MAP_COLS * SCALED_TILE;
    const worldH = MAP_ROWS * SCALED_TILE;
    this.cameras.main.setBounds(0, 0, worldW, worldH);

    this.onReady?.();
  }

  private createPlayerAnimations() {
    // Sprite sheet: 16 cols × 4 rows of 24x24 frames
    // Row 0: down, Row 1: left (unused, we flip right), Row 2: right, Row 3: up
    // Each row: 4 skin variants × 4 walk frames. Variant 0 = cols 0-3.
    // "left" reuses "right" frames with flipX
    const key = 'player-char';
    const dirs = [
      { key: 'down', row: 0 },
      { key: 'right', row: 2 },
      { key: 'up', row: 3 },
    ];

    for (const dir of dirs) {
      const base = dir.row * CHAR_COLS;
      if (!this.anims.exists(`walk-${dir.key}`)) {
        this.anims.create({
          key: `walk-${dir.key}`,
          frames: this.anims.generateFrameNumbers(key, {
            frames: [base, base + 1, base + 2, base + 3],
          }),
          frameRate: 8,
          repeat: -1,
        });
      }
      if (!this.anims.exists(`idle-${dir.key}`)) {
        this.anims.create({
          key: `idle-${dir.key}`,
          frames: [{ key, frame: base }],
          frameRate: 1,
        });
      }
    }
    // "left" animations = same as "right" (flipX handled in update)
    if (!this.anims.exists('walk-left')) {
      const rightBase = 2 * CHAR_COLS;
      this.anims.create({
        key: 'walk-left',
        frames: this.anims.generateFrameNumbers(key, {
          frames: [rightBase, rightBase + 1, rightBase + 2, rightBase + 3],
        }),
        frameRate: 8,
        repeat: -1,
      });
    }
    if (!this.anims.exists('idle-left')) {
      this.anims.create({
        key: 'idle-left',
        frames: [{ key, frame: 2 * CHAR_COLS }],
        frameRate: 1,
      });
    }
  }

  private createMockAnimations(spriteKey: string) {
    const dirs = [
      { key: 'down', row: 0 },
      { key: 'right', row: 2 },
      { key: 'up', row: 3 },
    ];
    for (const dir of dirs) {
      const base = dir.row * CHAR_COLS;
      if (!this.anims.exists(`${spriteKey}-walk-${dir.key}`)) {
        this.anims.create({
          key: `${spriteKey}-walk-${dir.key}`,
          frames: this.anims.generateFrameNumbers(spriteKey, {
            frames: [base, base + 1, base + 2, base + 3],
          }),
          frameRate: 8,
          repeat: -1,
        });
      }
      if (!this.anims.exists(`${spriteKey}-idle-${dir.key}`)) {
        this.anims.create({
          key: `${spriteKey}-idle-${dir.key}`,
          frames: [{ key: spriteKey, frame: base }],
          frameRate: 1,
        });
      }
    }
    // "left" = same frames as "right" (flipX handled in updateMockAgents)
    const rightBase = 2 * CHAR_COLS;
    if (!this.anims.exists(`${spriteKey}-walk-left`)) {
      this.anims.create({
        key: `${spriteKey}-walk-left`,
        frames: this.anims.generateFrameNumbers(spriteKey, {
          frames: [rightBase, rightBase + 1, rightBase + 2, rightBase + 3],
        }),
        frameRate: 8,
        repeat: -1,
      });
    }
    if (!this.anims.exists(`${spriteKey}-idle-left`)) {
      this.anims.create({
        key: `${spriteKey}-idle-left`,
        frames: [{ key: spriteKey, frame: rightBase }],
        frameRate: 1,
      });
    }
  }

  private spawnMockAgents() {
    const mockData = [
      { id: 'mock-alpha', name: 'AgentAlpha', spriteKey: 'mock-agent-0', startX: 5, startY: 7 },
      { id: 'mock-beta', name: 'AgentBeta', spriteKey: 'mock-agent-1', startX: 25, startY: 12 },
    ];

    for (const data of mockData) {
      this.createMockAnimations(data.spriteKey);

      const px = data.startX * SCALED_TILE + SCALED_TILE / 2;
      const py = data.startY * SCALED_TILE + SCALED_TILE / 2;

      const CHAR_SCALE = 6;
      const sprite = this.add.sprite(0, 0, data.spriteKey, 0);
      sprite.setScale(CHAR_SCALE);
      sprite.play(`${data.spriteKey}-idle-down`);

      const charHalf = (CHAR_FRAME_H * CHAR_SCALE) / 2;
      const nameText = this.add.text(0, -charHalf - 6, data.name, {
        fontSize: '9px',
        color: '#8b5cf6',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        backgroundColor: '#000000aa',
        padding: { x: 3, y: 1 },
      }).setOrigin(0.5);

      const stateIcon = this.add.text(charHalf + 2, -charHalf, '\u{1F916}', { fontSize: '12px' }).setOrigin(0);

      const container = this.add.container(px, py, [sprite, nameText, stateIcon]);
      container.setDepth(5);

      const charSprite: CharSprite = { sprite, nameText, stateIcon, container };

      // Register in otherChars to prevent duplicates from sync events
      this.otherChars.set(data.id, charSprite);

      this.mockAgents.push({
        id: data.id,
        name: data.name,
        tileX: data.startX,
        tileY: data.startY,
        direction: 'down',
        char: charSprite,
        lastMoveTime: 0,
        moveInterval: 800 + Math.random() * 1200, // 800-2000ms between moves
        spriteKey: data.spriteKey,
      });

      // Add to presences so they show in the presence list
      this.presences.push({
        id: data.id,
        type: 'agent',
        name: data.name,
        x: data.startX,
        y: data.startY,
        direction: 'down',
        state: 'idle',
        current_zone: null,
        current_task_id: null,
        connected_at: Date.now(),
        last_move_at: Date.now(),
        socket_id: 'mock',
        avatar: { sprite: data.spriteKey, color: '#8b5cf6' },
      });
    }
    this.onPresenceUpdate?.([...this.presences]);
  }

  private updateMockAgents(time: number) {
    const directions: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];
    const deltas: Record<string, { dx: number; dy: number }> = {
      up: { dx: 0, dy: -1 },
      down: { dx: 0, dy: 1 },
      left: { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 },
    };

    for (const agent of this.mockAgents) {
      if (!agent.char) continue;
      if (time - agent.lastMoveTime < agent.moveInterval) continue;

      agent.lastMoveTime = time;

      // 30% chance to stay idle (looks more natural)
      if (Math.random() < 0.3) continue;

      // 70% chance to keep same direction, 30% to pick new one
      const dir = Math.random() < 0.7 ? agent.direction : directions[Math.floor(Math.random() * 4)];
      const { dx, dy } = deltas[dir];
      const newX = agent.tileX + dx;
      const newY = agent.tileY + dy;

      if (this.canMoveTo(newX, newY)) {
        agent.tileX = newX;
        agent.tileY = newY;
        agent.direction = dir;

        agent.char.sprite.setFlipX(dir === 'left');
        agent.char.sprite.play(`${agent.spriteKey}-walk-${dir}`, true);

        const targetPx = newX * SCALED_TILE + SCALED_TILE / 2;
        const targetPy = newY * SCALED_TILE + SCALED_TILE / 2;

        this.tweens.add({
          targets: agent.char.container,
          x: targetPx,
          y: targetPy,
          duration: 200,
          ease: 'Linear',
          onComplete: () => {
            agent.char?.sprite.play(`${agent.spriteKey}-idle-${dir}`, true);
          },
        });

        // Update presence
        const p = this.presences.find(u => u.id === agent.id);
        if (p) { p.x = newX; p.y = newY; p.direction = dir; }
      } else {
        // Hit a wall, pick a new random direction
        agent.direction = directions[Math.floor(Math.random() * 4)];
      }
    }
  }

  private buildCollisionGrid() {
    // Initialize all tiles as blocked (1)
    this.collisionGrid = new Array(MAP_COLS * MAP_ROWS).fill(1);

    // Define walkable rectangular areas (0 = walkable)
    // Format: [startCol, startRow, endCol, endRow]
    const walkableAreas: number[][] = [
      // === TOP SECTION: Open office ===
      // Main horizontal corridor top (between top equipment and first desk row)
      [1, 3, 30, 4],
      // Walkways between cubicle rows
      [1, 7, 30, 8],
      [1, 11, 30, 12],
      [1, 15, 30, 16],
      // Left vertical corridor (connecting horizontal walkways)
      [1, 1, 3, 18],
      // Right vertical corridor
      [28, 1, 30, 18],
      // Center vertical aisle
      [14, 1, 17, 19],
      // Small walkways around desks
      [4, 3, 13, 4],
      [18, 3, 27, 4],

      // === TRANSITION AREA (rows 17-20) ===
      [1, 17, 30, 20],

      // === BOTTOM-LEFT: Meeting/Break room ===
      [1, 21, 12, 33],

      // === BOTTOM-CENTER: Lobby/Reception ===
      [13, 21, 22, 33],

      // === BOTTOM-RIGHT: Private offices ===
      [23, 21, 30, 25],
      [23, 26, 30, 29],
      [23, 30, 30, 33],

      // Doorways between bottom rooms
      [12, 24, 14, 26],
      [21, 24, 24, 26],
      [12, 29, 14, 31],
      [21, 29, 24, 31],
    ];

    for (const [sc, sr, ec, er] of walkableAreas) {
      for (let r = sr; r <= er && r < MAP_ROWS; r++) {
        for (let c = sc; c <= ec && c < MAP_COLS; c++) {
          this.collisionGrid[r * MAP_COLS + c] = 0;
        }
      }
    }

    // Block specific furniture spots inside walkable areas
    const blockedSpots: number[][] = [
      // Meeting room furniture
      [5, 27, 6, 28],
      [9, 23, 10, 24],
      // Lobby desk/reception (small block, not the whole area)
      [17, 24, 18, 25],
      // Private office desks
      [26, 22, 27, 23],
      [26, 27, 27, 28],
      [26, 31, 27, 32],
    ];

    for (const [sc, sr, ec, er] of blockedSpots) {
      for (let r = sr; r <= er && r < MAP_ROWS; r++) {
        for (let c = sc; c <= ec && c < MAP_COLS; c++) {
          this.collisionGrid[r * MAP_COLS + c] = 1;
        }
      }
    }
  }

  private defineZones() {
    const zoneDefs = [
      {
        id: 'open-office',
        label: 'Open Office',
        color: '#6366f1',
        x: 1, y: 1, w: 30, h: 18,
      },
      {
        id: 'meeting-room',
        label: 'Meeting Room',
        color: '#059669',
        x: 1, y: 21, w: 12, h: 13,
      },
      {
        id: 'lobby',
        label: 'Lobby',
        color: '#d97706',
        x: 13, y: 21, w: 10, h: 13,
      },
      {
        id: 'private-office-1',
        label: 'Office A',
        color: '#dc2626',
        x: 23, y: 21, w: 8, h: 6,
      },
      {
        id: 'private-office-2',
        label: 'Office B',
        color: '#7c3aed',
        x: 23, y: 27, w: 8, h: 7,
      },
    ];

    for (const z of zoneDefs) {
      const sx = z.x * SCALED_TILE;
      const sy = z.y * SCALED_TILE;
      const sw = z.w * SCALED_TILE;
      const sh = z.h * SCALED_TILE;

      const hexColor = parseInt(z.color.replace('#', ''), 16);
      const graphics = this.add.rectangle(sx + sw / 2, sy + sh / 2, sw, sh, hexColor, 0.06);
      graphics.setStrokeStyle(1, hexColor, 0.2);
      graphics.setDepth(1);

      const labelText = this.add.text(sx + 6, sy + 4, z.label, {
        fontSize: '10px',
        color: z.color,
        fontFamily: 'monospace',
        fontStyle: 'bold',
      });
      labelText.setDepth(1);
      labelText.setAlpha(0.7);

      this.zones.push({
        id: z.id,
        label: z.label,
        color: z.color,
        rect: new Phaser.Geom.Rectangle(sx, sy, sw, sh),
        graphics,
        labelText,
      });
    }
  }

  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('space:presence:sync', ({ users }: { users: UserPresence[] }) => {
      this.presences = users;
      this.onPresenceUpdate?.(users);

      for (const user of users) {
        if (user.id === this.userId) {
          if (!this.playerChar) {
            this.playerChar = this.createCharacter(user);
            this.tileX = user.x;
            this.tileY = user.y;
            this.cameras.main.startFollow(this.playerChar.container, true, 0.1, 0.1);
            // Spawn mock agents after player is created
            this.spawnMockAgents();
          }
        } else if (!this.otherChars.has(user.id)) {
          this.otherChars.set(user.id, this.createCharacter(user));
        }
      }
    });

    this.socket.on('space:user:joined', ({ user }: { user: UserPresence }) => {
      this.presences.push(user);
      this.onPresenceUpdate?.([...this.presences]);
      if (user.id !== this.userId && !this.otherChars.has(user.id)) {
        this.otherChars.set(user.id, this.createCharacter(user));
      }
    });

    this.socket.on('space:user:left', ({ userId }: { userId: string }) => {
      this.presences = this.presences.filter(p => p.id !== userId);
      this.onPresenceUpdate?.([...this.presences]);
      const char = this.otherChars.get(userId);
      if (char) {
        char.container.destroy();
        this.otherChars.delete(userId);
      }
    });

    this.socket.on(
      'space:user:moved',
      ({ userId, x, y, direction }: { userId: string; x: number; y: number; direction: string }) => {
        const char = this.otherChars.get(userId);
        if (char) {
          char.sprite.setFlipX(direction === 'left');
          char.sprite.play(`walk-${direction}`, true);
          this.tweens.add({
            targets: char.container,
            x: x * SCALED_TILE + SCALED_TILE / 2,
            y: y * SCALED_TILE + SCALED_TILE / 2,
            duration: 150,
            ease: 'Linear',
            onComplete: () => {
              char.sprite.play(`idle-${direction}`, true);
            },
          });
        }
        const p = this.presences.find(u => u.id === userId);
        if (p) { p.x = x; p.y = y; }
      }
    );

    this.socket.on(
      'space:user:state',
      ({ userId, state }: { userId: string; state: string }) => {
        const p = this.presences.find(u => u.id === userId);
        if (p) {
          p.state = state as UserPresence['state'];
          this.onPresenceUpdate?.([...this.presences]);
        }
        const char = this.otherChars.get(userId);
        if (char) this.updateStateIcon(char, state);
      }
    );

    this.socket.on('space:chat:message', ({ message }: { message: unknown }) => {
      this.onChatMessage?.(message);
    });

    this.socket.on('space:emote', ({ userId, emote }: { userId: string; emote: string }) => {
      const char = userId === this.userId ? this.playerChar : this.otherChars.get(userId);
      if (char) this.showEmote(char, emote);
    });

    this.socket.on(
      'space:zone:update',
      ({ zoneId, users }: { zoneId: string; users: string[] }) => {
        const zone = this.zones.find(z => z.id === zoneId);
        if (zone?.graphics) {
          const intensity = Math.min(0.2, 0.06 + users.length * 0.03);
          zone.graphics.setFillStyle(parseInt(zone.color.replace('#', ''), 16), intensity);
        }
      }
    );
  }

  private createCharacter(user: UserPresence): CharSprite {
    const px = user.x * SCALED_TILE + SCALED_TILE / 2;
    const py = user.y * SCALED_TILE + SCALED_TILE / 2;

    const CHAR_SCALE = 6;
    const sprite = this.add.sprite(0, 0, 'player-char', 0);
    sprite.setScale(CHAR_SCALE);

    // Play idle animation facing down
    sprite.play('idle-down');

    const charHalf = (CHAR_FRAME_H * CHAR_SCALE) / 2;
    const nameColor = user.type === 'agent' ? '#8b5cf6' : '#3b82f6';
    const nameText = this.add.text(0, -charHalf - 6, user.name, {
      fontSize: '9px',
      color: nameColor,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      backgroundColor: '#000000aa',
      padding: { x: 3, y: 1 },
    }).setOrigin(0.5);

    const stateIcon = this.add.text(
      charHalf + 2, -charHalf, '', { fontSize: '12px' }
    ).setOrigin(0);

    const container = this.add.container(px, py, [sprite, nameText, stateIcon]);
    container.setDepth(user.id === this.userId ? 10 : 5);

    return { sprite, nameText, stateIcon, container };
  }

  private updateStateIcon(char: CharSprite, state: string) {
    const icons: Record<string, string> = {
      working: '\u{1F4BB}',
      chatting: '\u{1F4AC}',
      afk: '\u{1F4A4}',
      idle: '',
      walking: '',
    };
    char.stateIcon.setText(icons[state] || '');
  }

  private sendEmote(emote: string) {
    this.socket?.emit('space:emote', { teamId: this.teamId, emote });
    if (this.playerChar) this.showEmote(this.playerChar, emote);
  }

  private showEmote(char: CharSprite, emote: string) {
    const emoteText = this.add
      .text(char.container.x, char.container.y - 40, emote, { fontSize: '22px' })
      .setOrigin(0.5)
      .setDepth(20);

    this.tweens.add({
      targets: emoteText,
      y: emoteText.y - 30,
      alpha: 0,
      duration: 1800,
      ease: 'Cubic.easeOut',
      onComplete: () => emoteText.destroy(),
    });
  }

  private checkZone(pixelX: number, pixelY: number) {
    let foundZone: ZoneData | null = null;
    for (const zone of this.zones) {
      if (zone.rect.contains(pixelX, pixelY)) {
        foundZone = zone;
        break;
      }
    }

    if (foundZone?.id !== this.currentZone?.id) {
      if (this.currentZone) {
        this.socket?.emit('space:zone:exit', { teamId: this.teamId });
      }

      this.currentZone = foundZone;
      if (foundZone) {
        this.tweens.add({
          targets: foundZone.graphics,
          fillAlpha: 0.15,
          duration: 300,
          yoyo: true,
          repeat: 1,
          onComplete: () => foundZone.graphics?.setFillStyle(
            parseInt(foundZone.color.replace('#', ''), 16), 0.06
          ),
        });
        this.socket?.emit('space:zone:enter', {
          teamId: this.teamId,
          zoneId: foundZone.id,
        });
      }

      this.onZoneChange?.(
        foundZone ? { id: foundZone.id, label: foundZone.label } : null
      );
    }
  }

  private canMoveTo(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileX >= MAP_COLS) return false;
    if (tileY < 0 || tileY >= MAP_ROWS) return false;
    return this.collisionGrid[tileY * MAP_COLS + tileX] === 0;
  }

  update(time: number) {
    // Always update mock agents, even before player is ready
    this.updateMockAgents(time);

    if (!this.playerChar) return;

    // Don't process input while a move tween is running
    if (this.isMoving) return;

    if (time - this.moveTimeout < 125) return;

    let newX = this.tileX;
    let newY = this.tileY;
    let direction = this.lastDirection;
    let moved = false;

    if (this.keysDown.has('ArrowLeft')) {
      newX--; direction = 'left'; moved = true;
    } else if (this.keysDown.has('ArrowRight')) {
      newX++; direction = 'right'; moved = true;
    } else if (this.keysDown.has('ArrowUp')) {
      newY--; direction = 'up'; moved = true;
    } else if (this.keysDown.has('ArrowDown')) {
      newY++; direction = 'down'; moved = true;
    }

    if (moved && this.canMoveTo(newX, newY)) {
      this.moveTimeout = time;
      this.lastDirection = direction;
      this.isMoving = true;
      this.tileX = newX;
      this.tileY = newY;

      this.playerChar.sprite.setFlipX(direction === 'left');
      this.playerChar.sprite.play(`walk-${direction}`, true);

      const targetPx = newX * SCALED_TILE + SCALED_TILE / 2;
      const targetPy = newY * SCALED_TILE + SCALED_TILE / 2;

      this.tweens.add({
        targets: this.playerChar.container,
        x: targetPx,
        y: targetPy,
        duration: 120,
        ease: 'Linear',
        onComplete: () => {
          this.isMoving = false;
          this.playerChar?.sprite.play(`idle-${direction}`, true);
        },
      });

      this.checkZone(targetPx, targetPy);

      if (newX !== this.lastSentX || newY !== this.lastSentY) {
        this.lastSentX = newX;
        this.lastSentY = newY;
        this.socket?.emit('space:move', {
          teamId: this.teamId,
          x: newX,
          y: newY,
          direction,
        });
      }
    } else if (!moved) {
      // Player stopped moving - ensure idle animation
      const idleKey = `idle-${this.lastDirection}`;
      if (this.playerChar.sprite.anims.currentAnim?.key !== idleKey) {
        this.playerChar.sprite.play(idleKey, true);
      }
    }
  }

  shutdown() {
    // Remove native keyboard listeners
    if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
    if (this.keyupHandler) window.removeEventListener('keyup', this.keyupHandler);
    this.keysDown.clear();
    // Clean up mock agents
    for (const agent of this.mockAgents) {
      agent.char?.container.destroy();
    }
    this.mockAgents = [];

    this.socket?.emit('space:leave', { teamId: this.teamId });
    this.socket?.off('space:presence:sync');
    this.socket?.off('space:user:joined');
    this.socket?.off('space:user:left');
    this.socket?.off('space:user:moved');
    this.socket?.off('space:user:state');
    this.socket?.off('space:chat:message');
    this.socket?.off('space:emote');
    this.socket?.off('space:zone:update');
  }
}
