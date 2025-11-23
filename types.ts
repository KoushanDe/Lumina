
export enum EntityType {
  PLAYER = 'PLAYER',
  GOAL = 'GOAL',
  PLATFORM = 'PLATFORM',
  MOVING_PLATFORM = 'MOVING_PLATFORM',
  HAZARD = 'HAZARD',
  PARTICLE = 'PARTICLE',
  SIGN = 'SIGN',
  MONSTER = 'MONSTER',
  SHOOTER = 'SHOOTER',
  PROJECTILE = 'PROJECTILE',
  NPC = 'NPC',
  MIRAGE_NPC = 'MIRAGE_NPC',
  CHECKPOINT = 'CHECKPOINT',
  PILL = 'PILL',
  EVIL_PILL = 'EVIL_PILL'
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  type: EntityType;
  pos: Vector2;
  initialPos?: Vector2; // For patrolling monsters or moving platforms
  size: Vector2; // Width/Height for rects, Radius/Radius for circles
  velocity?: Vector2;
  color: string;
  glowColor?: string;
  properties?: Record<string, any>; // e.g., direction for signs, range for monsters
  wisdom?: string; // For pills
  
  // Moving Platform Props
  moveAxis?: 'x' | 'y';
  moveRange?: number;
  moveSpeed?: number;
}

export interface Level {
  id: number;
  name: string;
  width: number;
  height: number;
  startPos: Vector2;
  goalPos: Vector2;
  entities: Entity[];
  backgroundHint?: string;
}

export enum GameStatus {
  AUTH = 'AUTH', // New status for Login Screen
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  RESPAWNING = 'RESPAWNING',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'spark' | 'flower' | 'bird';
}

export type ControlScheme = 'keyboard' | 'touch';

export interface GameSettings {
  musicVolume: number; // 0.0 to 1.0
  sfxVolume: number;   // 0.0 to 1.0
  haptics: boolean;
  controlScheme: ControlScheme;
  health?: number;
}

export interface TutorialState {
  moveLeft: boolean;
  moveRight: boolean;
  jump: boolean;
  hazardShown: boolean;
  monsterShown: boolean;
  evilPillShown: boolean; // New tutorial state
}

export interface CheckpointData {
  levelId: number;
  pos: Vector2;
  health: number;
  collectedPillIds: string[];
  triggeredEvilPillIds: string[];
  triggeredMirageId: string | null;
}

// Persistence System
export interface PlayerProfile {
  id: string;
  maxReachedLevel: number;
  currentCheckpoint?: CheckpointData | null; // Save in-level progress
  settings: GameSettings;
  created: number;
  lastPlayed: number;
}

export interface PlayerDatabase {
  [playerId: string]: PlayerProfile;
}
