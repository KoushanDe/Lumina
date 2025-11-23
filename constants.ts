
import { Level, EntityType, Vector2 } from './types';

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
export const COLOR_MOVING_PLATFORM = '#444455';
export const COLOR_SIGN = '#ffff00'; // Yellow indicators
export const COLOR_SIGN_SUS = '#ffaa00'; // Suspicious
export const COLOR_CHECKPOINT = '#00ff88';
export const COLOR_CHECKPOINT_ACTIVE = '#ccffcc';
export const COLOR_PILL = '#ffd700'; // Gold

const createId = () => Math.random().toString(36).substring(7);

// Helper to make entities
const wall = (x: number, y: number, w: number, h: number, id?: string): any => ({
  id: id || createId(),
  type: EntityType.PLATFORM,
  pos: { x, y },
  size: { x: w, y: h },
  color: COLOR_PLATFORM,
  glowColor: COLOR_PLATFORM_GLOW
});

const movingPlatform = (x: number, y: number, w: number, axis: 'x' | 'y', range: number, speed: number): any => ({
  id: createId(),
  type: EntityType.MOVING_PLATFORM,
  pos: { x, y },
  initialPos: { x, y },
  size: { x: w, y: 20 },
  color: COLOR_MOVING_PLATFORM,
  glowColor: '#666677',
  moveAxis: axis,
  moveRange: range,
  moveSpeed: speed
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
  size: { x: 24, y: 24 }, 
  color: COLOR_MONSTER,
  glowColor: '#ff0000',
  properties: { range: patrolRange, speed: 0.03 + Math.random() * 0.04 }
});

const sign = (x: number, y: number, direction: 'right' | 'up' | 'left' | 'jump' | 'sus'): any => ({
  id: createId(),
  type: EntityType.SIGN,
  pos: { x, y },
  size: { x: 40, y: 40 },
  color: direction === 'sus' ? COLOR_SIGN_SUS : COLOR_SIGN,
  properties: { direction }
});

const npc = (x: number, y: number, id?: string): any => ({
  id: id || createId(),
  type: EntityType.NPC,
  pos: { x, y },
  size: { x: 12, y: 12 },
  color: COLOR_NPC,
  glowColor: COLOR_GOAL_GLOW
});

const checkpoint = (x: number, y: number): any => ({
  id: createId(),
  type: EntityType.CHECKPOINT,
  pos: { x, y: y - 20 }, // Adjust visual height
  size: { x: 30, y: 60 },
  color: COLOR_CHECKPOINT,
  glowColor: '#00ff00'
});

const pill = (x: number, y: number, wisdom: string): any => ({
  id: createId(),
  type: EntityType.PILL,
  pos: { x, y },
  size: { x: 15, y: 15 },
  color: COLOR_PILL,
  glowColor: '#ffffff',
  wisdom
});

// --- Level Generators ---
interface LevelConfig {
  id: number;
  name: string;
  difficulty: number; // 1-10
  theme: 'normal' | 'void' | 'vertical' | 'forest' | 'dark';
}

const WISDOM_QUOTES = [
  "Darkness is merely the absence of your light.",
  "Every fall is a chance to learn how to rise.",
  "Patience is the bridge between intent and reality.",
  "Fear is a shadow; walk through it, and it vanishes.",
  "The journey matters more than the destination.",
  "Even the smallest spark can ignite the stars.",
  "Trust in your own glow.",
  "Silence speaks when words fail.",
  "Keep moving, for stillness is the only true death.",
  "Hope is the heartbeat of the soul.",
  "Your light is needed here.",
  "Breathe. The void is not empty.",
  "Courage is not the absence of fear, but action in spite of it.",
  "You are stronger than the shadows.",
  "Look up. The path is often above you.",
  "Rest if you must, but do not quit.",
  "The echo of your steps creates the path.",
  "Find beauty in the struggle.",
  "Connect with the world around you.",
  "Love is the final destination.",
  "A closed door is just a wall until you open it.",
  "Shadows only exist where there is light.",
  "Do not fear the unknown, for it is where you grow.",
  "Strength is found in the moments you want to give up.",
  "You are the author of your own story."
];

const generateLevel = (config: LevelConfig): Level => {
  const entities: any[] = [];
  const width = 8000 + (config.id * 500); 
  const height = config.theme === 'vertical' ? 2500 : 1000;
  
  let cx = 0;
  let cy = config.theme === 'vertical' ? 2200 : 600;
  const groundY = cy + 100;

  // Start Platform
  entities.push(wall(cx, groundY, 500, 100));
  entities.push(sign(cx + 300, groundY - 50, 'right'));
  cx += 500;

  const numSegments = 25 + config.id * 2; 
  
  let checkpointsPlaced = 0;
  let difficultyAccumulator = 0;
  let wisdomPillsPlaced = 0;

  for (let i = 0; i < numSegments; i++) {
    const type = Math.random();
    const difficulty = config.difficulty * 0.1;

    // --- Smart Checkpoint Logic ---
    // Place checkpoint if we've accumulated enough "hardness" (gaps/monsters) and haven't hit limit
    if (difficultyAccumulator > 4 && checkpointsPlaced < 2) {
       entities.push(wall(cx, groundY, 400, 100));
       entities.push(checkpoint(cx + 200, groundY - 60));
       cx += 400;
       difficultyAccumulator = 0;
       checkpointsPlaced++;
       continue;
    }

    // --- Side Path for Wisdom Pill (EXCLUSIVE SEGMENT) ---
    if (wisdomPillsPlaced < 5 && Math.random() < 0.15) {
       const detourY = groundY - 250;
       
       // Safe Low Ground
       entities.push(wall(cx, groundY, 400, 100));
       
       // Floating Platforms above
       entities.push(wall(cx + 50, groundY - 100, 80, 20)); 
       entities.push(wall(cx + 150, detourY + 50, 80, 20)); 
       entities.push(wall(cx + 250, detourY, 100, 20)); 
       entities.push(pill(cx + 300, detourY - 30, WISDOM_QUOTES[Math.floor(Math.random() * WISDOM_QUOTES.length)]));
       
       wisdomPillsPlaced++;
       cx += 400; // Advance cx to reserve this space
       continue; // Skip other generation for this segment
    }

    // --- Easter Egg: Suspicious Arrow ---
    if (Math.random() < 0.05) {
      entities.push(sign(cx + 50, groundY - 150, 'sus'));
    }
    // --- Helpful Arrow ---
    if (Math.random() < 0.2) {
      entities.push(sign(cx + 20, groundY - 50, 'right'));
    }

    if (type < 0.3) {
      // GAP Logic
      // SAFETY CLAMP FOR EARLY LEVELS
      let gapBase = 100 + (config.id * 20); 
      if (gapBase > 200) gapBase = 200;
      
      let gapSize = gapBase + (Math.random() * 50);
      
      // Strict Cap for Level 1 & 2
      if (config.id === 1) gapSize = Math.min(gapSize, 140);
      if (config.id === 2) gapSize = Math.min(gapSize, 180);

      // Passability Check: Standard max jump ~240px horizontal.
      // If gap > 220, we MUST provide a moving platform OR reduce it.
      if (gapSize > 220) {
         if (config.id >= 3) {
           // Use Moving Platform
           const mpY = groundY + (Math.random() * 100 - 50);
           entities.push(movingPlatform(cx + 50, mpY, 120, 'x', gapSize - 100, 0.02));
           cx += gapSize + 120; 
         } else {
           // Reduce gap for early levels
           gapSize = 150 + Math.random() * 50;
           if (Math.random() > 0.5) entities.push(hazard(cx, groundY + 150, gapSize, 50));
           cx += gapSize;
         }
      } else {
         if (Math.random() > 0.5) entities.push(hazard(cx, groundY + 150, gapSize, 50));
         cx += gapSize;
      }

      difficultyAccumulator += 1;
      
      // Landing
      entities.push(wall(cx, groundY, 200, 100));
      cx += 200;
    } 
    else if (type < 0.6) {
      // PLATFORMING
      const h = 100 + Math.random() * 200;
      const w = 120;
      const yChange = (Math.random() - 0.5) * 180; // Reduced vertical variation for playability
      cy = Math.max(200, Math.min(height - 200, cy - yChange));
      
      if (config.id >= 3 && Math.random() < 0.2) {
        // Moving Vertical Platform
        entities.push(movingPlatform(cx, cy, w, 'y', 150, 0.03));
        difficultyAccumulator += 1.5;
      } else {
        entities.push(wall(cx, cy, w, 20));
      }
      
      if (Math.random() < difficulty) {
        entities.push(monster(cx + w/2, cy - 30, 60));
        difficultyAccumulator += 1;
      }
      
      cx += w + 100 + (Math.random() * 100); // Gap between platforms
    }
    else if (type < 0.85) {
      // COMBAT / PATROL SECTION
      const len = 700;
      entities.push(wall(cx, groundY, len, 100));
      entities.push(monster(cx + 200, groundY - 30, 150));
      if (config.id > 4) entities.push(monster(cx + 500, groundY - 60, 150));
      difficultyAccumulator += 2;
      cx += len;
    }
    else {
      // STAIRS / OBSTACLE
      entities.push(wall(cx, groundY - 100, 50, 300));
      entities.push(wall(cx + 100, groundY - 200, 100, 20));
      if (Math.random() < 0.5) entities.push(hazard(cx + 120, groundY - 220, 60, 20));
      difficultyAccumulator += 0.5;
      cx += 250;
    }
  }

  // Final Stretch
  entities.push(wall(cx, groundY, 800, 100));
  
  // Level 4 Special Logic (Decoy)
  if (config.id === 4) {
     entities.push(npc(cx - 600, groundY - 150, "decoy-npc"));
     entities.push(wall(cx - 650, groundY - 130, 100, 20, "decoy-platform"));
     // Low road for playability
     entities.push(wall(cx - 700, groundY, 500, 20)); 
  }

  return {
    id: config.id,
    name: config.name,
    width: cx + 500,
    height: height,
    startPos: { x: 100, y: config.theme === 'vertical' ? 2100 : 600 - 100 },
    goalPos: { x: cx + 400, y: groundY - 50 },
    entities: entities
  };
};

// Manually configuring the themes
export const LEVELS: Level[] = [
  generateLevel({ id: 1, name: "The Awakening", difficulty: 1, theme: 'normal' }),
  generateLevel({ id: 2, name: "Echoes of Light", difficulty: 2, theme: 'normal' }),
  generateLevel({ id: 3, name: "Whispering Shadows", difficulty: 3, theme: 'forest' }),
  generateLevel({ id: 4, name: "The Mirage", difficulty: 4, theme: 'dark' }),
  generateLevel({ id: 5, name: "Crimson Drift", difficulty: 5, theme: 'vertical' }),
  generateLevel({ id: 6, name: "Abyssal Peaks", difficulty: 6, theme: 'void' }),
  generateLevel({ id: 7, name: "Fragmented Hope", difficulty: 7, theme: 'vertical' }),
  generateLevel({ id: 8, name: "The Silent Storm", difficulty: 8, theme: 'dark' }),
  generateLevel({ id: 9, name: "Ascension's Edge", difficulty: 9, theme: 'normal' }),
  // Level 10 Union
  {
    id: 10,
    name: "Union",
    width: 3000,
    height: 1000,
    startPos: { x: 100, y: 800 },
    goalPos: { x: 2800, y: 750 },
    entities: [
       wall(0, 900, 3000, 100),
       checkpoint(500, 800),
       movingPlatform(800, 700, 150, 'y', 100, 0.02),
       pill(900, 600, "Love is the final destination."),
       wall(1200, 600, 150, 20),
       monster(1300, 580, 50),
       checkpoint(1600, 800),
       wall(1800, 700, 100, 20),
       pill(2200, 600, "Together, we shine brighter."),
       wall(2750, 800, 200, 20), // Goal platform
    ]
  }
];
