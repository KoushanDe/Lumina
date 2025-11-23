
import { Level, EntityType, Vector2 } from './types';

export const GRAVITY = 0.6;
export const FRICTION = 0.85;
export const MOVE_SPEED = 0.9; 
export const JUMP_FORCE = -12; 
export const MAX_SPEED = 8; 

// Colors
export const COLOR_PLAYER = '#00ffff'; // Cyan
export const COLOR_PLAYER_GLOW = '#0088ff';
export const COLOR_PLAYER_EVIL = '#4b0082'; // Indigo/Dark Purple for reversed controls
export const COLOR_PLAYER_EVIL_GLOW = '#800080';

export const COLOR_GOAL = '#ff00ff'; // Pink (Female)
export const COLOR_GOAL_GLOW = '#ff0088';
export const COLOR_NPC = '#ff00ff'; // Decoy Pink Ball

// Mystical Portal Colors (Indigo/Violet)
export const COLOR_PORTAL = '#6366f1'; // Indigo 500
export const COLOR_PORTAL_GLOW = '#8b5cf6'; // Violet 500

export const COLOR_HAZARD = '#ff3333';
export const COLOR_HAZARD_GLOW = '#aa0000';
export const COLOR_MONSTER = '#ff0000';
export const COLOR_SHOOTER = '#ff5500'; // Orange-Red
export const COLOR_PROJECTILE = '#ffff00'; // Yellow
export const COLOR_PLATFORM = '#333333';
export const COLOR_PLATFORM_GLOW = '#111111';
export const COLOR_MOVING_PLATFORM = '#444455';
export const COLOR_SIGN = '#ffff00'; // Yellow indicators
export const COLOR_SIGN_SUS = '#ffaa00'; // Suspicious
export const COLOR_CHECKPOINT = '#00ff88';
export const COLOR_CHECKPOINT_ACTIVE = '#ccffcc';
export const COLOR_PILL = '#ffd700'; // Gold
export const COLOR_PILL_PURPLE = '#a855f7'; // Purple 500
export const COLOR_EVIL_PILL = '#1a1a1a'; // Dark Gray/Black

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

const shooterMonster = (x: number, y: number): any => ({
  id: createId(),
  type: EntityType.SHOOTER,
  pos: { x, y },
  initialPos: { x, y },
  size: { x: 30, y: 30 },
  color: COLOR_SHOOTER,
  glowColor: '#ffaa00',
  properties: { cooldown: 0 }
});

const evilPill = (x: number, y: number): any => ({
  id: createId(),
  type: EntityType.EVIL_PILL,
  pos: { x, y },
  initialPos: { x, y },
  velocity: { x: 0, y: 0 },
  size: { x: 18, y: 18 },
  color: COLOR_EVIL_PILL,
  glowColor: '#ff0000',
  properties: { active: false } // starts inactive until close
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

const mirageNpc = (x: number, y: number): any => ({
  id: createId(),
  type: EntityType.MIRAGE_NPC,
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

const pill = (x: number, y: number, wisdom: string, isPurple = false): any => ({
  id: createId(),
  type: EntityType.PILL,
  pos: { x, y },
  size: { x: 15, y: 15 },
  color: isPurple ? COLOR_PILL_PURPLE : COLOR_PILL,
  glowColor: isPurple ? '#d8b4fe' : '#ffffff',
  wisdom,
  properties: { isPurple }
});

// --- Level Generators ---
interface LevelConfig {
  id: number;
  name: string;
  difficulty: number; // 1-10
  theme: 'normal' | 'void' | 'vertical' | 'forest' | 'dark';
}

export const WISDOM_QUOTES = [
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
  let miragePlaced = false;
  let purplePillPlaced = false;
  let evilPillPlaced = false;

  const hasEvilPill = [3, 5, 8, 9, 10].includes(config.id);

  for (let i = 0; i < numSegments; i++) {
    const type = Math.random();
    const difficulty = config.difficulty * 0.1;

    // --- Smart Checkpoint Logic ---
    const distRatio = cx / width;
    let shouldPlaceCheckpoint = false;

    // 1st Checkpoint: > 30% progress
    if (checkpointsPlaced === 0 && distRatio > 0.3) {
        if (difficultyAccumulator > 3 || distRatio > 0.45) shouldPlaceCheckpoint = true;
    }
    // 2nd Checkpoint: > 60% progress
    else if (checkpointsPlaced === 1 && distRatio > 0.6) {
        if (difficultyAccumulator > 3 || distRatio > 0.75) shouldPlaceCheckpoint = true;
    }

    if (shouldPlaceCheckpoint && checkpointsPlaced < 2) {
       entities.push(wall(cx, groundY, 400, 100));
       entities.push(checkpoint(cx + 200, groundY - 60));
       cx += 400; 
       difficultyAccumulator = 0;
       checkpointsPlaced++;
       continue; 
    }

    // --- Level 7 Special Event: Mirage Pink Ball ---
    if (config.id === 7 && !miragePlaced && distRatio > 0.5) {
       entities.push(wall(cx, groundY, 400, 100));
       entities.push(mirageNpc(cx + 200, groundY - 50));
       miragePlaced = true;
       cx += 400;
       continue;
    }

    // --- Level 7 Special Event: Purple Wisdom Pill ---
    if (config.id === 7 && miragePlaced && !purplePillPlaced && distRatio > 0.85) {
       entities.push(wall(cx, groundY, 400, 100));
       entities.push(pill(cx + 200, groundY - 100, "Hope is not a dream, but a way of making dreams become reality.", true));
       purplePillPlaced = true;
       cx += 400;
       continue;
    }

    // --- Evil Pill Spawn ---
    if (hasEvilPill && !evilPillPlaced && distRatio > 0.4 && distRatio < 0.6) {
       const platformWidth = 1200; // Increased to 1200 for safety
       entities.push(wall(cx, groundY, platformWidth, 100));
       entities.push(evilPill(cx + 500, groundY - 100)); // Spawn in middle
       entities.push(sign(cx + 100, groundY - 50, 'sus')); // Warning sign
       evilPillPlaced = true;
       cx += platformWidth;
       continue;
    }

    // --- Side Path for Wisdom Pill ---
    if (wisdomPillsPlaced < 5 && Math.random() < 0.15) {
       const detourY = groundY - 250;
       entities.push(wall(cx, groundY, 400, 100));
       entities.push(wall(cx + 50, groundY - 100, 80, 20)); 
       entities.push(wall(cx + 150, detourY + 50, 80, 20)); 
       entities.push(wall(cx + 250, detourY, 100, 20)); 
       entities.push(pill(cx + 300, detourY - 30, WISDOM_QUOTES[Math.floor(Math.random() * WISDOM_QUOTES.length)]));
       wisdomPillsPlaced++;
       cx += 400; 
       continue; 
    }

    // --- Easter Egg: Suspicious Arrow ---
    if (Math.random() < 0.05) entities.push(sign(cx + 50, groundY - 150, 'sus'));
    // --- Helpful Arrow ---
    if (Math.random() < 0.2) entities.push(sign(cx + 20, groundY - 50, 'right'));

    if (type < 0.3) {
      // GAP Logic
      let gapBase = 100 + (config.id * 20); 
      if (gapBase > 200) gapBase = 200;
      let gapSize = gapBase + (Math.random() * 50);
      if (config.id === 1) gapSize = Math.min(gapSize, 110); // FIX: Reduced max gap for Level 1 from 140 to 110
      if (config.id === 2) gapSize = Math.min(gapSize, 180);

      if (gapSize > 220) {
         if (config.id >= 3) {
           const mpY = groundY + (Math.random() * 100 - 50);
           entities.push(movingPlatform(cx + 50, mpY, 120, 'x', gapSize - 100, 0.02));
           cx += gapSize + 120; 
         } else {
           gapSize = 150 + Math.random() * 50;
           if (Math.random() > 0.5) entities.push(hazard(cx, groundY + 150, gapSize, 50));
           cx += gapSize;
         }
      } else {
         if (Math.random() > 0.5) entities.push(hazard(cx, groundY + 150, gapSize, 50));
         cx += gapSize;
      }
      difficultyAccumulator += 1;
      // IMPOSSIBLE JUMP FIX: Increased platform width from 200 to 400 after gaps/hazards
      entities.push(wall(cx, groundY, 400, 100));
      cx += 400;
    } 
    else if (type < 0.6) {
      // PLATFORMING
      const h = 100 + Math.random() * 200;
      let w = 120;
      // FIX: Wider platforms for Level 1 to prevent slipping
      if (config.id === 1) w = 200;

      let yChange = (Math.random() - 0.5) * 180; 
      // FIX: Flatter terrain for Level 1
      if (config.id === 1) yChange = (Math.random() - 0.5) * 60;

      cy = Math.max(200, Math.min(height - 200, cy - yChange));
      
      if (config.id >= 3 && Math.random() < 0.2) {
        entities.push(movingPlatform(cx, cy, w, 'y', 150, 0.03));
        difficultyAccumulator += 1.5;
      } else {
        entities.push(wall(cx, cy, w, 20));
      }
      
      // Rare Shooter Monster - Increased rarity to Medium (0.1 -> 0.25)
      if (config.id >= 4 && Math.random() < 0.25) {
         entities.push(shooterMonster(cx + w/2 - 15, cy - 40));
         difficultyAccumulator += 2;
      } else if (Math.random() < difficulty) {
        entities.push(monster(cx + w/2, cy - 30, 60));
        difficultyAccumulator += 1;
      }
      
      // Calculate gap to next platform
      let distToNext = 100 + (Math.random() * 100);
      // FIX: Smaller jumps for Level 1
      if (config.id === 1) distToNext = 50 + (Math.random() * 50);

      cx += w + distToNext; 
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
     const decoyX = cx - 300;
     const decoyY = groundY - 150;
     entities.push(npc(decoyX, decoyY, "decoy-npc"));
     entities.push(wall(decoyX - 50, decoyY + 20, 100, 20, "decoy-platform"));
     // Cage walls
     entities.push(wall(decoyX - 60, decoyY - 30, 10, 50)); // Left bar
     entities.push(wall(decoyX + 50, decoyY - 30, 10, 50)); // Right bar
     
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

const generateUnionLevel = (): Level => {
  const width = 12000;
  const height = 1500;
  const entities: any[] = [];
  
  // SECTION 1: THE START (0-2000)
  entities.push(wall(0, 1200, 1000, 200));
  entities.push(sign(500, 1100, 'right'));
  entities.push(wall(1200, 1100, 200, 20));
  entities.push(movingPlatform(1500, 1100, 150, 'y', 200, 0.02));
  entities.push(wall(1800, 900, 200, 20));
  entities.push(pill(1850, 850, "We are almost there."));
  entities.push(checkpoint(1900, 840));

  // SECTION 2: THE VOID WALK (2000-5000)
  entities.push(wall(2200, 1200, 500, 20));
  entities.push(monster(2450, 1170, 150));
  
  entities.push(movingPlatform(2900, 1200, 120, 'x', 300, 0.03));
  
  entities.push(wall(3400, 1100, 400, 20));
  entities.push(hazard(3600, 1100, 50, 20));
  entities.push(pill(3600, 1050, "Keep your light burning."));

  // Evil Pill Section - Added safer platform
  entities.push(wall(4000, 1000, 800, 20)); // Long platform for evil pill fight
  entities.push(evilPill(4200, 950));
  
  entities.push(wall(4900, 800, 400, 20));
  entities.push(checkpoint(5100, 740));

  // SECTION 3: THE ASCENSION (5000-8000)
  entities.push(wall(5400, 1200, 300, 20)); // Low safety
  entities.push(movingPlatform(5800, 1000, 120, 'y', 300, 0.02));
  entities.push(movingPlatform(6100, 800, 120, 'y', 300, 0.03));
  entities.push(movingPlatform(6400, 600, 120, 'y', 300, 0.02));
  
  entities.push(wall(6700, 600, 400, 20));
  entities.push(shooterMonster(6900, 570)); // Shooter here
  entities.push(pill(6900, 500, "Rise above the fear."));

  entities.push(wall(7300, 800, 200, 20));
  entities.push(wall(7700, 1000, 400, 20));
  entities.push(checkpoint(7900, 940));

  // SECTION 4: THE GAUNTLET (8000-10500)
  entities.push(movingPlatform(8300, 1000, 100, 'x', 150, 0.05));
  entities.push(movingPlatform(8600, 1000, 100, 'x', 150, 0.05));
  entities.push(movingPlatform(8900, 1000, 100, 'x', 150, 0.05));
  
  entities.push(wall(9200, 1000, 600, 20));
  entities.push(monster(9300, 970, 100));
  entities.push(monster(9600, 970, 100));
  entities.push(pill(9500, 900, "The end is just a new beginning."));
  
  // FIX: Clearer platforming section instead of confusing hazard setup
  entities.push(wall(10000, 900, 200, 20));
  // Removed confusing hazard(10150...), replaced with a clear void jump
  entities.push(wall(10400, 800, 400, 20)); 
  entities.push(checkpoint(10600, 740));

  // SECTION 5: THE FINAL BRIDGE (10500-12000)
  entities.push(wall(10800, 800, 1400, 200)); 
  entities.push(pill(11200, 750, "Love is the final destination."));
  entities.push(sign(11400, 750, 'right'));
  entities.push(sign(11600, 750, 'right'));
  entities.push(sign(11800, 750, 'right'));

  return {
    id: 10,
    name: "Union",
    width: 12000,
    height: 1500,
    startPos: { x: 100, y: 1100 },
    goalPos: { x: 11800, y: 750 },
    entities: entities
  };
};

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
  generateUnionLevel()
];
