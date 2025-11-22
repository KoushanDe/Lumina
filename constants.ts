
import { Level, EntityType } from './types';

export const GRAVITY = 0.6;
export const FRICTION = 0.85;
export const MOVE_SPEED = 0.9; 
export const JUMP_FORCE = -12; 
export const MAX_SPEED = 8; 

// Colors
export const COLOR_PLAYER = '#00ffff'; // Cyan
export const COLOR_PLAYER_GLOW = '#0088ff';
export const COLOR_GOAL = '#ff00ff'; // Pink (Female)
export const COLOR_GOAL_GLOW = '#ff0088';
export const COLOR_NPC = '#ff00ff'; // Decoy Pink Ball

// Mystical Portal Colors (Indigo/Violet)
export const COLOR_PORTAL = '#6366f1'; // Indigo 500
export const COLOR_PORTAL_GLOW = '#8b5cf6'; // Violet 500

export const COLOR_HAZARD = '#ff3333';
export const COLOR_HAZARD_GLOW = '#aa0000';
export const COLOR_MONSTER = '#ff0000';
export const COLOR_PLATFORM = '#333333';
export const COLOR_PLATFORM_GLOW = '#111111';
export const COLOR_SIGN = '#ffff00'; // Yellow indicators

const createId = () => Math.random().toString(36).substring(7);

// Helper to make walls/platforms
const wall = (x: number, y: number, w: number, h: number, id?: string): any => ({
  id: id || createId(),
  type: EntityType.PLATFORM,
  pos: { x, y },
  size: { x: w, y: h },
  color: COLOR_PLATFORM,
  glowColor: COLOR_PLATFORM_GLOW
});

const hazard = (x: number, y: number, w: number, h: number): any => ({
  id: createId(),
  type: EntityType.HAZARD,
  pos: { x, y },
  size: { x: w, y: h },
  color: COLOR_HAZARD,
  glowColor: COLOR_HAZARD_GLOW
});

const monster = (x: number, y: number, patrolRange: number): any => ({
  id: createId(),
  type: EntityType.MONSTER,
  pos: { x, y },
  initialPos: { x, y },
  size: { x: 24, y: 24 }, // Slightly larger than player
  color: COLOR_MONSTER,
  glowColor: '#ff0000',
  properties: { range: patrolRange, speed: 0.05 + Math.random() * 0.05 }
});

const sign = (x: number, y: number, direction: 'right' | 'up' | 'left' | 'jump'): any => ({
  id: createId(),
  type: EntityType.SIGN,
  pos: { x, y },
  size: { x: 40, y: 40 },
  color: COLOR_SIGN,
  properties: { direction }
});

const npc = (x: number, y: number, id?: string): any => ({
  id: id || createId(),
  type: EntityType.NPC,
  pos: { x, y },
  size: { x: 12, y: 12 }, // Same size as goal ball
  color: COLOR_NPC,
  glowColor: COLOR_GOAL_GLOW
});

export const LEVELS: Level[] = [
  {
    id: 1,
    name: "The Awakening",
    width: 1600,
    height: 800,
    startPos: { x: 100, y: 600 },
    goalPos: { x: 1500, y: 450 },
    entities: [
      wall(0, 700, 2000, 100), // Floor
      wall(0, 0, 20, 800), // Left wall
      wall(1580, 0, 20, 800), // Right wall
      
      sign(300, 600, 'right'),

      wall(400, 600, 100, 100), 
      wall(600, 500, 100, 200), 
      
      // First Monster
      monster(800, 660, 50),

      sign(750, 450, 'jump'),
      
      wall(900, 400, 200, 20), // Platform bridge
      hazard(900, 690, 200, 10), // Danger below bridge
      
      wall(1200, 500, 100, 20),
      hazard(1220, 480, 60, 20), // Hazard ON platform
      
      wall(1400, 500, 200, 20), // Goal platform
    ]
  },
  {
    id: 2,
    name: "Echoes of Light",
    width: 2000,
    height: 1000,
    startPos: { x: 50, y: 850 },
    goalPos: { x: 1800, y: 200 },
    entities: [
      // Start area
      wall(0, 900, 400, 100),
      sign(200, 800, 'right'),

      // The Void
      hazard(400, 950, 1600, 50), // Lava floor
      
      // Islands 
      wall(450, 800, 120, 20), 
      monster(510, 770, 30), // Patrolling monster

      wall(650, 750, 120, 20), 
      
      // Double Jump Section
      sign(680, 650, 'jump'),
      wall(850, 650, 50, 200), // Tall pillar
      
      // Moving forward
      wall(1000, 550, 120, 20),
      hazard(1050, 540, 20, 10), // Small spike

      wall(1200, 450, 120, 20),
      monster(1260, 420, 40),

      sign(1250, 350, 'up'),

      // Vertical Climb
      wall(1400, 300, 20, 600), // Vertical wall
      wall(1300, 300, 80, 20),
      wall(1500, 200, 100, 20),
      
      wall(1700, 250, 200, 20), // Goal Platform
    ]
  },
  {
    id: 3,
    name: "Whispering Shadows",
    width: 2400,
    height: 1200,
    startPos: { x: 100, y: 1000 },
    goalPos: { x: 2200, y: 150 },
    entities: [
      wall(0, 1100, 300, 100),
      hazard(300, 1150, 2100, 50), // Floor lava

      // Tree 1
      wall(400, 800, 50, 400),
      wall(350, 900, 50, 20), // Branch
      wall(450, 700, 50, 20), // Branch
      
      sign(500, 650, 'right'),

      // Floating debris
      wall(600, 600, 100, 20),
      monster(650, 570, 40),

      wall(800, 550, 100, 20),
      hazard(820, 530, 60, 20), // Spike on platform

      // The drop
      wall(1000, 700, 200, 20),
      sign(1100, 600, 'jump'),

      // Tree 2 (High)
      wall(1400, 400, 60, 800),
      wall(1300, 500, 80, 20),
      wall(1500, 300, 80, 20),
      
      monster(1540, 270, 30), // Guarding top branch

      // Final stretch
      wall(1700, 250, 80, 20),
      wall(1900, 200, 80, 20),
      wall(2100, 200, 200, 20), // Goal
    ]
  },
  {
    id: 4,
    name: "The Final Veil",
    width: 2400, 
    height: 800,
    startPos: { x: 100, y: 600 },
    goalPos: { x: 2200, y: 550 }, // Actual Goal is a portal far right
    entities: [
      wall(0, 700, 600, 100), // Start Floor
      
      // Trap / Decoy Setup
      // High Road (Trap)
      npc(900, 480, "decoy-npc"), 
      wall(850, 500, 100, 20, "decoy-platform"), // Platform under decoy (Will move)

      // Low Road (Safe Passage)
      wall(800, 700, 120, 20), // Bridge to next section
      
      // Course
      hazard(600, 780, 1800, 20), // Death floor
      
      wall(600, 700, 100, 20), // Step 1
      
      wall(1050, 600, 100, 20), // Step after gap (reachable from 800)
      
      monster(1100, 500, 50), // Flying monster

      wall(1250, 600, 100, 20),
      wall(1450, 650, 100, 20),
      wall(1650, 600, 100, 20),
      
      monster(1750, 550, 100),

      wall(1900, 600, 100, 20),
      
      // The Real Goal Platform
      wall(2100, 600, 150, 20), 

      sign(300, 600, 'right'),
    ]
  },
  {
    id: 5,
    name: "Union",
    width: 1400,
    height: 800,
    startPos: { x: 100, y: 600 },
    goalPos: { x: 1200, y: 550 },
    entities: [
      wall(0, 700, 1400, 100), // Simple floor
      wall(0, 0, 1400, 50, createId()), // Ceiling
      
      wall(400, 600, 100, 20),
      monster(500, 550, 30), // Patrolling air
      
      wall(700, 550, 100, 20),
      monster(800, 650, 50), // Ground guard
      
      wall(1150, 600, 100, 20), // Goal platform
    ]
  }
];
