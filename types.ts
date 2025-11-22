
export enum EntityType {
  PLAYER = 'PLAYER',
  GOAL = 'GOAL',
  PLATFORM = 'PLATFORM',
  HAZARD = 'HAZARD',
  PARTICLE = 'PARTICLE',
  SIGN = 'SIGN',
  MONSTER = 'MONSTER',
  NPC = 'NPC'
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  type: EntityType;
  pos: Vector2;
  initialPos?: Vector2; // For patrolling monsters to know origin
  size: Vector2; // Width/Height for rects, Radius/Radius for circles
  velocity?: Vector2;
  color: string;
  glowColor?: string;
  properties?: Record<string, any>; // e.g., direction for signs, range for monsters
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
  MENU = 'MENU',
  PLAYING = 'PLAYING',
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
}
