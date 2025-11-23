
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EntityType, GameStatus, Level, Particle, Vector2, GameSettings, Entity } from '../types';
import { 
  GRAVITY, FRICTION, MOVE_SPEED, MAX_SPEED, JUMP_FORCE, LEVELS, 
  COLOR_PLAYER, COLOR_PLAYER_GLOW, COLOR_PLAYER_EVIL, COLOR_PLAYER_EVIL_GLOW,
  COLOR_GOAL, COLOR_GOAL_GLOW, COLOR_PORTAL, COLOR_PORTAL_GLOW, 
  COLOR_SIGN, COLOR_CHECKPOINT, COLOR_CHECKPOINT_ACTIVE, COLOR_PILL, COLOR_NPC,
  COLOR_SHOOTER, COLOR_PROJECTILE, COLOR_EVIL_PILL
} from '../constants';

interface GameCanvasProps {
  status: GameStatus;
  currentLevelId: number;
  settings: GameSettings;
  initialHealth: number;
  onLevelComplete: () => void;
  onGameOver: () => void;
  onGameWon: () => void;
  onPlaySound: (type: 'jump' | 'die' | 'portal' | 'victory' | 'checkpoint' | 'pill' | 'respawn' | 'sad' | 'hopeful_pill' | 'panic') => void;
  onUpdateMood: (distanceToGoal: number, distanceToMonster: number) => void;
  onHealthChange: (health: number) => void;
  onShowWisdom: (wisdom: string) => void;
  onCheckpointSave: () => void;
  onChaosStart: (active: boolean) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ 
  status, 
  currentLevelId, 
  settings,
  initialHealth,
  onLevelComplete, 
  onGameOver, 
  onGameWon,
  onPlaySound,
  onUpdateMood,
  onHealthChange,
  onShowWisdom,
  onCheckpointSave,
  onChaosStart
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  
  // Input State
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [touchInput, setTouchInput] = useState({ left: false, right: false, jump: false });

  // Game State Refs
  const playerPos = useRef<Vector2>({ x: 0, y: 0 });
  const playerVel = useRef<Vector2>({ x: 0, y: 0 });
  const cameraPos = useRef<Vector2>({ x: 0, y: 0 });
  const jumpCount = useRef<number>(0);
  const wasJumpPressed = useRef<boolean>(false);
  const airTime = useRef<number>(0); 
  const respawnTimer = useRef<number>(0);
  const deathCause = useRef<'void' | 'hazard'>('hazard');
  
  // Mechanics Refs
  const health = useRef<number>(1.0);
  const healthDrainActive = useRef<boolean>(false); // New: For gradual depletion on fatal hits
  const checkpointHealth = useRef<number>(1.0);
  const invulnerableFrames = useRef<number>(0);
  const lastCheckpointPos = useRef<Vector2>({ x: 0, y: 0 });
  const activeCheckpointId = useRef<string | null>(null);
  
  // Persistence
  const collectedPillIds = useRef<Set<string>>(new Set());
  const checkpointCollectedPills = useRef<Set<string>>(new Set());
  const triggeredMirageId = useRef<string | null>(null);
  const mirageFadeAlpha = useRef<number>(1.0); // Track mirage fade
  
  // Evil Pill Persistence
  const triggeredEvilPillIds = useRef<Set<string>>(new Set());
  const checkpointTriggeredEvilPills = useRef<Set<string>>(new Set());

  // Evil Pill & Chaos
  const reversedControlsTimer = useRef<number>(0);
  const chaosActive = useRef<boolean>(false);

  // Level 4 Decoy Physics
  const decoyVelocity = useRef<number>(0);
  const decoyWisdomTriggered = useRef<boolean>(false);

  // Projectiles
  const projectiles = useRef<Entity[]>([]);

  const particles = useRef<Particle[]>([]);
  const levelRef = useRef<Level>(JSON.parse(JSON.stringify(LEVELS[0]))); 
  
  const eyeOffset = useRef<Vector2>({ x: 0, y: 0 });
  const portalRotation = useRef<number>(0);
  const globalTime = useRef<number>(0);
  const victoryAnimStart = useRef<number>(0);

  // Init Level
  useEffect(() => {
    const baseLevel = LEVELS.find(l => l.id === currentLevelId) || LEVELS[0];
    const level = JSON.parse(JSON.stringify(baseLevel));
    
    levelRef.current = level;
    playerPos.current = { ...level.startPos };
    lastCheckpointPos.current = { ...level.startPos }; 
    
    const startHealth = Math.max(1.0, initialHealth);
    health.current = startHealth;
    checkpointHealth.current = startHealth; 
    healthDrainActive.current = false;
    
    playerVel.current = { x: 0, y: 0 };
    jumpCount.current = 0;
    particles.current = [];
    projectiles.current = [];
    invulnerableFrames.current = 0;
    activeCheckpointId.current = null;
    collectedPillIds.current = new Set();
    checkpointCollectedPills.current = new Set();
    triggeredEvilPillIds.current = new Set();
    checkpointTriggeredEvilPills.current = new Set();
    triggeredMirageId.current = null;
    mirageFadeAlpha.current = 1.0;
    reversedControlsTimer.current = 0;
    chaosActive.current = false;
    onChaosStart(false);
    deathCause.current = 'hazard';
    
    decoyVelocity.current = 0;
    decoyWisdomTriggered.current = false;

    onHealthChange(startHealth);

    cameraPos.current = {
      x: Math.max(0, level.startPos.x - 400),
      y: Math.max(0, level.startPos.y - 300)
    };
    victoryAnimStart.current = 0;
    
    const handleKeyDown = (e: KeyboardEvent) => setKeys(k => ({ ...k, [e.code]: true }));
    const handleKeyUp = (e: KeyboardEvent) => setKeys(k => ({ ...k, [e.code]: false }));
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []); 

  const triggerHaptic = (pattern: number | number[]) => {
    if (settings.haptics && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const spawnParticles = (x: number, y: number, color: string, count: number, type: 'spark' | 'flower' | 'bird' = 'spark') => {
    for (let i = 0; i < count; i++) {
      particles.current.push({
        x, y,
        vx: (Math.random() - 0.5) * (type === 'flower' ? 3 : (type === 'bird' ? 2 : 5)),
        vy: (Math.random() - 0.5) * (type === 'flower' ? 3 : (type === 'bird' ? 1 : 5)),
        life: 1.0,
        maxLife: 1.0,
        color,
        size: Math.random() * (type === 'flower' ? 8 : (type === 'bird' ? 4 : 2)) + 1,
        type
      });
    }
  };

  const takeDamage = useCallback((amount: number, sourceX?: number, cause: 'void' | 'hazard' | 'normal' = 'normal') => {
      if (status !== GameStatus.PLAYING) return;
      
      // If already draining, don't trigger damage again
      if (healthDrainActive.current) return;

      if (invulnerableFrames.current > 0 && cause !== 'void' && cause !== 'hazard') return;
      
      // LOGIC 1 & 2: Instant Kill / Health Drain
      if (cause === 'void' || cause === 'hazard') {
           // Start Health Drain Phase
           healthDrainActive.current = true;
           deathCause.current = cause;
           // We do NOT set health to 0 instantly. We let the update loop drain it.
           // Input will be locked in update()
           onPlaySound('die'); // Play sound once at start of drain
           triggerHaptic(300);
           return;
      } 
      
      // LOGIC 3, 4, 5: Standard Damage
      health.current -= amount;
      
      onHealthChange(health.current);
      onPlaySound('die');
      triggerHaptic(100);
      
      if (health.current <= 0) {
        // Died from standard damage (e.g. at 0.5 HP and hit monster)
        health.current = 0;
        deathCause.current = 'hazard';
        respawnTimer.current = 90; 
      } else {
        // Survived hit
        spawnParticles(playerPos.current.x, playerPos.current.y, '#ff0000', 20);
        invulnerableFrames.current = 120; // 2s invincibility
        playerVel.current.y = -8;
        if (sourceX !== undefined) {
          playerVel.current.x = (playerPos.current.x - sourceX) > 0 ? 10 : -10;
        }
      }
  }, [status, onHealthChange, onPlaySound, settings.haptics]);

  const update = useCallback(() => {
    if (status !== GameStatus.PLAYING && status !== GameStatus.VICTORY) return;
    
    globalTime.current += 0.02;
    if (invulnerableFrames.current > 0) invulnerableFrames.current--;

    // --- HEALTH DRAIN LOGIC ---
    if (healthDrainActive.current) {
        if (health.current > 0) {
            health.current -= (1/30); // ~2 HP/sec drain speed
            if (health.current < 0) health.current = 0;
            onHealthChange(health.current);
            
            if (deathCause.current === 'hazard') {
                playerVel.current.x = 0;
                playerVel.current.y = 0;
            } else {
                // Void
                playerVel.current.x *= 0.9;
                playerVel.current.y += GRAVITY; 
                playerPos.current.y += playerVel.current.y;
            }
        } else {
            // Drain complete, start actual death sequence
            healthDrainActive.current = false;
            respawnTimer.current = 90;
        }
        
        // Update particles and return (skip input/physics)
        for (let i = particles.current.length - 1; i >= 0; i--) {
            const p = particles.current[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.015;
            if (p.life <= 0) particles.current.splice(i, 1);
        }
        
        // Camera follow for void fall
        if (deathCause.current === 'void') {
           const canvasW = 800;
           const canvasH = 600;
           const targetCamY = playerPos.current.y - canvasH / 2;
           cameraPos.current.y += (targetCamY - cameraPos.current.y) * 0.1;
        }
        return;
    }

    // --- STANDARD DEATH/RESPAWN ---
    if (health.current <= 0 && !healthDrainActive.current) {
       // Stop chaos on death
       if (chaosActive.current) {
          chaosActive.current = false;
          reversedControlsTimer.current = 0;
          onChaosStart(false);
       }

       if (respawnTimer.current === 0) respawnTimer.current = 90;
       respawnTimer.current--;

       if (respawnTimer.current <= 0) {
          playerPos.current = { ...lastCheckpointPos.current };
          playerVel.current = { x: 0, y: 0 };
          health.current = checkpointHealth.current;
          
          // Persistence Restore
          collectedPillIds.current = new Set(checkpointCollectedPills.current);
          triggeredEvilPillIds.current = new Set(checkpointTriggeredEvilPills.current);

          // Reset Evil Pill positions if they are active (not in triggered set)
          levelRef.current.entities.forEach(ent => {
             if (ent.type === EntityType.EVIL_PILL && !triggeredEvilPillIds.current.has(ent.id)) {
                if (ent.initialPos) {
                   ent.pos = { ...ent.initialPos };
                   ent.velocity = { x: 0, y: 0 };
                   if (ent.properties) ent.properties.active = false; // Reset activation state
                }
             }
          });

          invulnerableFrames.current = 60;
          projectiles.current = []; // Clear projectiles
          onHealthChange(health.current);
          deathCause.current = 'hazard'; 
          healthDrainActive.current = false;
          
          const canvasW = 800;
          const canvasH = 600;
          cameraPos.current = {
               x: Math.max(0, playerPos.current.x - canvasW/2),
               y: Math.max(0, playerPos.current.y - canvasH/2)
          };
          onPlaySound('respawn');
       }

       for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.015;
        if (p.life <= 0) particles.current.splice(i, 1);
       }
       return; 
    }

    const level = levelRef.current;
    const pos = playerPos.current;
    const vel = playerVel.current;

    portalRotation.current += 0.02;

    // --- Reverse Controls / Chaos Logic ---
    if (reversedControlsTimer.current > 0) {
       reversedControlsTimer.current--;
       
       // Drunken Movement
       if (Math.random() < 0.1) vel.x += (Math.random() - 0.5) * 3;
       
       if (!chaosActive.current) {
         chaosActive.current = true;
         onChaosStart(true);
       }
       if (reversedControlsTimer.current <= 0) {
         chaosActive.current = false;
         onChaosStart(false);
       }
    }

    // --- Evil Pill Logic (Chaser) ---
    for (let i = level.entities.length - 1; i >= 0; i--) {
       const ent = level.entities[i];
       if (ent.type === EntityType.EVIL_PILL) {
          if (triggeredEvilPillIds.current.has(ent.id)) continue;

          if (!ent.velocity) ent.velocity = { x: 0, y: 0 };
          if (!ent.properties) ent.properties = { active: false };
          
          const distToPlayer = Math.sqrt(Math.pow(pos.x - ent.pos.x, 2) + Math.pow(pos.y - ent.pos.y, 2));
          
          // Activation: Only activate if very close (inside frame significantly) or already active
          // Canvas width is 800. Center to edge is 400. 
          if (!ent.properties.active && distToPlayer < 450) {
              ent.properties.active = true;
          }

          if (ent.properties.active) {
             const dx = pos.x - ent.pos.x;
             const dy = pos.y - ent.pos.y;
             
             // Independent Movement AI
             // Reduced max speed from 11 to 9.2 (Player is 8)
             const EVIL_SPEED = 9.2;
             const EVIL_ACCEL = 0.8;
             const wobble = Math.sin(globalTime.current * 15) * 0.5; // Organic wobble
             
             ent.velocity.x += (Math.sign(dx) * EVIL_ACCEL) + wobble;
             ent.velocity.x *= 0.92; // Friction
             
             if (Math.abs(ent.velocity.x) > EVIL_SPEED) ent.velocity.x = Math.sign(ent.velocity.x) * EVIL_SPEED;
             
             ent.velocity.y += GRAVITY;
             
             // Intelligence: Check for gap ahead to avoid dumb falling
             // Look ahead slightly more than before to catch gaps at high speed
             const lookAheadX = ent.velocity.x > 0 ? ent.pos.x + ent.size.x + 60 : ent.pos.x - 60;
             const lookDownY = ent.pos.y + ent.size.y + 20;
             let groundAhead = false;
             
             // Check against walls for collision & intelligence
             let pillHitY = false;
             let pillHitX = false;
             const nextPX = ent.pos.x + ent.velocity.x;
             const nextPY = ent.pos.y + ent.velocity.y;
             
             for (const wall of level.entities) {
                 if (wall.type === EntityType.PLATFORM || wall.type === EntityType.MOVING_PLATFORM) {
                     // Intelligence Check
                     if (lookAheadX > wall.pos.x && lookAheadX < wall.pos.x + wall.size.x &&
                         lookDownY > wall.pos.y && lookDownY < wall.pos.y + wall.size.y) {
                         groundAhead = true;
                     }

                     // Collision Y
                     if (nextPX + ent.size.x > wall.pos.x && nextPX < wall.pos.x + wall.size.x &&
                         nextPY + ent.size.y > wall.pos.y && nextPY < wall.pos.y + wall.size.y) {
                         if (ent.velocity.y > 0 && ent.pos.y + ent.size.y <= wall.pos.y + 10) {
                             ent.pos.y = wall.pos.y - ent.size.y;
                             ent.velocity.y = 0;
                             pillHitY = true;
                         }
                     }
                     // Collision X
                     if (nextPX + ent.size.x > wall.pos.x && nextPX < wall.pos.x + wall.size.x &&
                         ent.pos.y + ent.size.y > wall.pos.y && ent.pos.y < wall.pos.y + wall.size.y) {
                            ent.velocity.x = 0;
                            pillHitX = true;
                     }
                 }
             }
             
             if (!pillHitX) ent.pos.x += ent.velocity.x;
             if (!pillHitY) ent.pos.y += ent.velocity.y;
             
             // AI Decisions
             if (pillHitY) { // On Ground
                 // 1. Hit Wall? Jump
                 if (pillHitX) ent.velocity.y = -14;
                 
                 // 2. Gap Ahead? Always jump to survive, independent of player
                 if (!groundAhead && Math.abs(ent.velocity.x) > 1) {
                     ent.velocity.y = -13; // Jump gap
                     ent.velocity.x += Math.sign(ent.velocity.x) * 4; // Boost over gap
                 }
                 
                 // 3. Player High Above? Chance to jump to reach
                 if (dy < -120 && Math.random() < 0.05) {
                     ent.velocity.y = -15;
                 }
             }
             
             // Void Death for Evil Pill - Mark as triggered so it's gone
             if (ent.pos.y > level.height + 200) {
                triggeredEvilPillIds.current.add(ent.id);
                continue;
             }
             
             // Collision with Player
             if (Math.abs(pos.x - ent.pos.x) < 20 && Math.abs(pos.y - ent.pos.y) < 20) {
                // Trigger Effect
                if (reversedControlsTimer.current <= 0) {
                    reversedControlsTimer.current = 1800; // 30 seconds at 60fps
                    onPlaySound('panic');
                    triggerHaptic([100, 50, 100, 50, 100]);
                    triggeredEvilPillIds.current.add(ent.id);
                    continue; 
                }
             }
          } else {
             // Not active, stay still
             ent.velocity = { x: 0, y: 0 };
          }
       }
    }

    // --- Shooter Monster Logic ---
    level.entities.forEach(ent => {
        if (ent.type === EntityType.SHOOTER) {
            const dist = Math.sqrt(Math.pow(pos.x - ent.pos.x, 2) + Math.pow(pos.y - ent.pos.y, 2));
            if (dist < 500) {
                if (!ent.properties) ent.properties = { cooldown: 0 };
                if (ent.properties.cooldown > 0) ent.properties.cooldown--;
                else {
                    // Shoot
                    const angle = Math.atan2((pos.y - 10) - ent.pos.y, pos.x - ent.pos.x);
                    const speed = 6;
                    const proj: Entity = {
                        id: Math.random().toString(),
                        type: EntityType.PROJECTILE,
                        pos: { x: ent.pos.x + 15, y: ent.pos.y + 15 },
                        size: { x: 8, y: 8 },
                        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
                        color: COLOR_PROJECTILE
                    };
                    projectiles.current.push(proj);
                    ent.properties.cooldown = 150; // 2.5s cooldown
                }
            }
        }
    });

    // --- Projectiles Logic ---
    for (let i = projectiles.current.length - 1; i >= 0; i--) {
        const p = projectiles.current[i];
        if (p.velocity) {
            p.pos.x += p.velocity.x;
            p.pos.y += p.velocity.y;
        }
        
        // Hit Player
        if (Math.abs(p.pos.x - pos.x) < 15 && Math.abs(p.pos.y - pos.y) < 15) {
            takeDamage(0.5, p.pos.x, 'normal');
            projectiles.current.splice(i, 1);
            continue;
        }

        // Hit Walls/Out of bounds
        let hitWall = false;
        if (p.pos.y > level.height + 100 || p.pos.y < -500) hitWall = true;
        
        for (const wall of level.entities) {
             if (wall.type === EntityType.PLATFORM && 
                 p.pos.x > wall.pos.x && p.pos.x < wall.pos.x + wall.size.x &&
                 p.pos.y > wall.pos.y && p.pos.y < wall.pos.y + wall.size.y) {
                 hitWall = true;
                 break;
             }
        }

        if (hitWall) projectiles.current.splice(i, 1);
    }


    // Moving Platform Logic
    level.entities.forEach(ent => {
      if (ent.type === EntityType.MOVING_PLATFORM && ent.initialPos) {
         const range = ent.moveRange || 100;
         const speed = ent.moveSpeed || 0.02;
         const offset = Math.sin(globalTime.current * speed * 50) * range;
         const prevX = ent.pos.x;
         const prevY = ent.pos.y;
         if (ent.moveAxis === 'y') ent.pos.y = ent.initialPos.y + offset;
         else ent.pos.x = ent.initialPos.x + offset;
         ent.velocity = { x: ent.pos.x - prevX, y: ent.pos.y - prevY };
      }
    });

    if (currentLevelId === 4 && status === GameStatus.PLAYING) {
      const npcEntity = level.entities.find(e => e.id === 'decoy-npc');
      if (npcEntity) {
        const distToNpc = Math.sqrt(Math.pow(pos.x - npcEntity.pos.x, 2) + Math.pow(pos.y - npcEntity.pos.y, 2));
        if (distToNpc < 400) { // Trigger earlier
           decoyVelocity.current += 0.2; // Acceleration
           npcEntity.pos.x += decoyVelocity.current;
           const plat = level.entities.find(e => e.id === 'decoy-platform');
           if (plat) plat.pos.x += decoyVelocity.current;
           
           // Wisdom Logic
           if (!decoyWisdomTriggered.current && npcEntity.pos.x > cameraPos.current.x + 900) {
               onShowWisdom("Some paths are not meant to be caught, but to lead us forward.");
               decoyWisdomTriggered.current = true;
           }
        }
      }
    }

    level.entities.forEach(ent => {
      if (ent.type === EntityType.MONSTER && ent.initialPos) {
        const range = ent.properties?.range || 50;
        const speed = ent.properties?.speed || 0.05;
        ent.pos.x = ent.initialPos.x + Math.sin(globalTime.current * speed * 20) * range;
      }
    });

    if (status === GameStatus.PLAYING) {
      // --- INPUT HANDLING WITH REVERSE LOGIC ---
      let leftInput = keys['ArrowLeft'] || keys['KeyA'] || touchInput.left;
      let rightInput = keys['ArrowRight'] || keys['KeyD'] || touchInput.right;
      let involuntaryMove = false;
      
      if (reversedControlsTimer.current > 0) {
          // If player tries to control, inputs are swapped
          const temp = leftInput;
          leftInput = rightInput;
          rightInput = temp;
          
          // If NO input is given, move backwards involuntarily
          if (!keys['ArrowLeft'] && !keys['KeyA'] && !touchInput.left && 
              !keys['ArrowRight'] && !keys['KeyD'] && !touchInput.right) {
              involuntaryMove = true;
          }
      }

      const jumpInput = keys['ArrowUp'] || keys['KeyW'] || keys['Space'] || touchInput.jump;

      if (invulnerableFrames.current < 100) { 
        if (involuntaryMove) {
            // Move left (backwards) slowly
            vel.x -= MOVE_SPEED * 0.5;
        } else {
            if (rightInput) vel.x += MOVE_SPEED;
            if (leftInput) vel.x -= MOVE_SPEED;
        }
      }

      if (jumpInput && !wasJumpPressed.current) {
        const canJump = airTime.current < 6; 
        if (canJump || jumpCount.current < 2) {
          if (!canJump && jumpCount.current === 0) jumpCount.current = 1;
          vel.y = JUMP_FORCE;
          jumpCount.current++;
          onPlaySound('jump');
          triggerHaptic(10);
          spawnParticles(pos.x, pos.y + 10, '#fff', 3);
        }
      }
      wasJumpPressed.current = !!jumpInput;

      vel.x *= FRICTION;
      vel.y += GRAVITY;
      if (Math.abs(vel.x) > MAX_SPEED) vel.x = Math.sign(vel.x) * MAX_SPEED;
      
      const nextX = pos.x + vel.x;
      const nextY = pos.y + vel.y;

      let hitX = false;
      let hitY = false;
      let minMonsterDist = 9999;

      for (const ent of level.entities) {
        const entW = ent.size?.x || 20;
        const entH = ent.size?.y || 20;

        if (ent.type === EntityType.PLATFORM || ent.type === EntityType.MOVING_PLATFORM) {
          if (nextX + 10 > ent.pos.x && nextX - 10 < ent.pos.x + entW &&
              pos.y + 10 > ent.pos.y && pos.y - 10 < ent.pos.y + entH) {
            vel.x = 0;
            hitX = true;
          }
        }
        
        // --- MONSTER COLLISIONS ---
        if (ent.type === EntityType.MONSTER) {
           const dist = Math.sqrt(Math.pow(pos.x - ent.pos.x, 2) + Math.pow(pos.y - ent.pos.y, 2));
           if (dist < minMonsterDist) minMonsterDist = dist;

           if (pos.x + 10 > ent.pos.x && pos.x - 10 < ent.pos.x + entW &&
               pos.y + 10 > ent.pos.y && pos.y - 10 < ent.pos.y + entH) {
               takeDamage(0.5, ent.pos.x + entW/2, 'normal');
           }
        }
        
        // --- SHOOTER COLLISIONS ---
        // Touching Shooter body is harmless (Logic 4)
        if (ent.type === EntityType.SHOOTER) {
           const dist = Math.sqrt(Math.pow(pos.x - ent.pos.x, 2) + Math.pow(pos.y - ent.pos.y, 2));
           if (dist < minMonsterDist) minMonsterDist = dist;
           // No damage on collision
        }

        // --- HAZARD COLLISIONS ---
        if (ent.type === EntityType.HAZARD) {
           if (pos.x + 10 > ent.pos.x && pos.x - 10 < ent.pos.x + entW &&
               pos.y + 10 > ent.pos.y && pos.y - 10 < ent.pos.y + entH) {
               takeDamage(0, undefined, 'hazard'); // 0 amount because hazard drains all
               return; 
           }
        }

        if (ent.type === EntityType.CHECKPOINT) {
           if (pos.x > ent.pos.x && pos.x < ent.pos.x + entW &&
               pos.y > ent.pos.y && pos.y < ent.pos.y + entH) {
               if (activeCheckpointId.current !== ent.id) {
                 lastCheckpointPos.current = { x: ent.pos.x + entW/2, y: ent.pos.y + entH/2 };
                 activeCheckpointId.current = ent.id;
                 checkpointHealth.current = health.current;
                 checkpointCollectedPills.current = new Set(collectedPillIds.current);
                 checkpointTriggeredEvilPills.current = new Set(triggeredEvilPillIds.current);
                 onCheckpointSave();
                 triggerHaptic(50);
                 onPlaySound('checkpoint'); 
                 spawnParticles(ent.pos.x + 15, ent.pos.y + 30, COLOR_CHECKPOINT_ACTIVE, 10);
               }
           }
        }
        if (ent.type === EntityType.PILL && !collectedPillIds.current.has(ent.id)) {
           if (pos.x + 10 > ent.pos.x && pos.x - 10 < ent.pos.x + entW &&
               pos.y + 10 > ent.pos.y && pos.y - 10 < ent.pos.y + entH) {
               collectedPillIds.current.add(ent.id);
               
               // Logic for Purple vs Gold Pill
               const isPurple = ent.properties?.isPurple;
               if (isPurple) {
                  health.current += 2.0;
                  onPlaySound('hopeful_pill');
                  onShowWisdom(ent.wisdom || "Hope found.");
                  spawnParticles(ent.pos.x, ent.pos.y, '#a855f7', 25, 'flower');
               } else {
                  health.current += 0.5; 
                  onPlaySound('pill');
                  if (ent.wisdom) onShowWisdom(ent.wisdom);
                  spawnParticles(ent.pos.x, ent.pos.y, '#ffd700', 15, 'flower');
               }
               onHealthChange(health.current);
               triggerHaptic([50, 50]);
           }
        }

        // --- Mirage NPC Logic (Level 7) ---
        if (ent.type === EntityType.MIRAGE_NPC && triggeredMirageId.current !== ent.id) {
            const dist = Math.sqrt(Math.pow(pos.x - ent.pos.x, 2) + Math.pow(pos.y - ent.pos.y, 2));
            if (dist < 40) {
                // Trigger event
                triggeredMirageId.current = ent.id;
                health.current -= 1.0; // Logic 5: Deplete 1.0 health
                onHealthChange(health.current);
                onPlaySound('sad');
                onShowWisdom("Sometimes, what we chase is only a reflection of our own longing.");
                spawnParticles(ent.pos.x, ent.pos.y, COLOR_NPC, 20, 'spark');
                
                // If this kills the player, trigger death
                if (health.current <= 0) {
                    health.current = 0;
                    deathCause.current = 'hazard';
                    respawnTimer.current = 90;
                }
            }
        }
      }
      if (!hitX) pos.x = nextX;

      for (const ent of level.entities) {
        if (ent.type === EntityType.PLATFORM || ent.type === EntityType.MOVING_PLATFORM) {
          const entW = ent.size?.x || 20;
          const entH = ent.size?.y || 20;
          if (pos.x + 10 > ent.pos.x && pos.x - 10 < ent.pos.x + entW &&
              nextY + 10 > ent.pos.y && nextY - 10 < ent.pos.y + entH) {
            if (vel.y > 0 && pos.y < ent.pos.y) {
               pos.y = ent.pos.y - 10;
               vel.y = 0;
               hitY = true;
               jumpCount.current = 0;
               airTime.current = 0;
               if (ent.type === EntityType.MOVING_PLATFORM && ent.velocity) {
                   pos.x += ent.velocity.x;
                   pos.y += ent.velocity.y;
               }
            } else if (vel.y < 0 && pos.y > ent.pos.y + entH) {
               pos.y = ent.pos.y + entH + 10;
               vel.y = 0;
               hitY = true;
            }
          }
        }
      }
      if (!hitY) {
        pos.y = nextY;
        airTime.current += 1;
      }

      const dx = pos.x - level.goalPos.x;
      const dy = pos.y - level.goalPos.y;
      const distToGoal = Math.sqrt(dx*dx + dy*dy);
      onUpdateMood(distToGoal, minMonsterDist);

      if (distToGoal < 30) {
        if (currentLevelId === LEVELS.length) {
           if (status !== GameStatus.VICTORY) {
             onPlaySound('victory');
             victoryAnimStart.current = Date.now();
             triggerHaptic([100, 50, 100, 50, 200]);
             onGameWon();
           }
        } else {
           onPlaySound('portal');
           triggerHaptic([50, 50, 50]);
           onLevelComplete();
        }
      }

      // Fix: Increase void threshold to allow vertical moving platforms to go lower without killing the player
      if (pos.y > level.height + 1000) {
        takeDamage(0, undefined, 'void'); // Void drains all
      }
      
      const targetEyeX = vel.x * 2;
      const targetEyeY = vel.y * 2;
      eyeOffset.current.x += (targetEyeX - eyeOffset.current.x) * 0.2;
      eyeOffset.current.y += (targetEyeY - eyeOffset.current.y) * 0.2;
    }

    const canvasW = 800;
    const canvasH = 600;
    const targetCamX = pos.x - canvasW / 2;
    const targetCamY = pos.y - canvasH / 2;
    
    cameraPos.current.x += (targetCamX - cameraPos.current.x) * 0.1;
    cameraPos.current.y += (targetCamY - cameraPos.current.y) * 0.1;
    cameraPos.current.x = Math.max(0, Math.min(cameraPos.current.x, level.width - canvasW));
    cameraPos.current.y = Math.max(0, Math.min(cameraPos.current.y, level.height - canvasH));

    for (let i = particles.current.length - 1; i >= 0; i--) {
      const p = particles.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.015;
      if (p.type === 'flower') {
         p.vy -= 0.02;
         p.vx += Math.sin(p.y * 0.1) * 0.05;
      }
      else if (p.type === 'bird') {
         p.x += Math.sin(globalTime.current) * 2;
         p.y += Math.cos(globalTime.current) * 0.5;
      }
      if (p.life <= 0) particles.current.splice(i, 1);
    }
    
    // Slow Mirage Fade
    if (triggeredMirageId.current) {
        mirageFadeAlpha.current -= 0.005; // Very slow fade
        if (mirageFadeAlpha.current < 0) mirageFadeAlpha.current = 0;
    }

    if (status === GameStatus.VICTORY && particles.current.length < 50 && Math.random() < 0.1) {
       const cx = cameraPos.current.x;
       const cy = cameraPos.current.y;
       spawnParticles(cx + Math.random() * 800, cy + Math.random() * 600, '#fff', 1, 'bird');
    }

  }, [status, keys, touchInput, onGameOver, onLevelComplete, onGameWon, settings.haptics, onUpdateMood, currentLevelId, onCheckpointSave, onPlaySound, takeDamage]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 600;

    ctx.save();
    let shakeX = 0;
    let shakeY = 0;
    
    // Shake on Void Death or Panic Mode
    if ((deathCause.current === 'void' && respawnTimer.current > 30 && respawnTimer.current < 60) || reversedControlsTimer.current > 0) {
        shakeX = (Math.random() - 0.5) * 5;
        shakeY = (Math.random() - 0.5) * 5;
    }
    ctx.translate(-(cameraPos.current.x + shakeX), -(cameraPos.current.y + shakeY));

    let bgGradient;
    if (status === GameStatus.VICTORY) {
       const duration = 20000; 
       const elapsed = Math.min((Date.now() - victoryAnimStart.current), duration);
       const t = elapsed / duration;
       const cx = cameraPos.current.x;
       const cy = cameraPos.current.y;
       
       // Fix: Draw huge background rect to avoid grey areas during camera shake/move
       // We center it on the camera and make it massive
       const bgX = cx - 2000; 
       const bgY = cy - 2000;
       const bgW = 4800;
       const bgH = 4600;

       bgGradient = ctx.createLinearGradient(cx, cy, cx, cy + 600);
       if (t < 0.3) {
          const subT = t / 0.3;
          bgGradient.addColorStop(0, `rgb(${subT * 30}, ${subT * 27}, ${subT * 75})`); 
          bgGradient.addColorStop(1, `rgb(${10 + subT * 182}, ${10 + subT * 28}, ${26 + subT * 185})`);
       } else if (t < 0.6) {
          const subT = (t - 0.3) / 0.3;
          bgGradient.addColorStop(0, `rgb(${30 + subT * 29}, ${27 + subT * 103}, ${75 + subT * 171})`);
          bgGradient.addColorStop(1, `rgb(${192 + subT * 60}, ${38 + subT * 173}, ${211 - subT * 134})`);
       } else {
          const subT = (t - 0.6) / 0.4;
          bgGradient.addColorStop(0, `rgb(${59 + subT * 37}, ${130 + subT * 35}, ${246 + subT * 4})`);
          bgGradient.addColorStop(1, `rgb(${252 - subT * 33}, ${211 + subT * 23}, ${77 + subT * 177})`);
       }
       ctx.fillStyle = bgGradient;
       ctx.fillRect(bgX, bgY, bgW, bgH); // Draw overdraw rect

       // ... Draw Sun, Clouds, Flowers ...
       if (t > 0.2) {
          const sunT = (t - 0.2) / 0.8;
          const sunY = cy + 500 - (sunT * 400); 
          ctx.fillStyle = 'rgba(255, 255, 200, 0.8)';
          ctx.shadowBlur = 50;
          ctx.shadowColor = 'orange';
          ctx.beginPath(); ctx.arc(cx + 600, sunY, 60, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
       }
       if (t > 0.4) {
          const cloudOpacity = (t - 0.4) / 0.6;
          ctx.fillStyle = `rgba(255, 255, 255, ${cloudOpacity * 0.6})`;
          const drawCloud = (cx: number, cy: number, s: number) => {
             ctx.beginPath(); ctx.arc(cx, cy, 30*s, 0, Math.PI * 2); ctx.arc(cx+20*s, cy-10*s, 35*s, 0, Math.PI*2); ctx.arc(cx+40*s, cy, 30*s, 0, Math.PI*2); ctx.fill();
          };
          drawCloud(cx + 100 + (globalTime.current*5)%800, cy + 100, 1);
          drawCloud(cx + 500 + (globalTime.current*3)%800, cy + 200, 0.8);
          drawCloud(cx + 300 + (globalTime.current*8)%800, cy + 50, 1.2);
       }
       if (t > 0.5) {
          const flowerOpacity = (t - 0.5) / 0.5;
          ctx.globalAlpha = flowerOpacity;
          for (let i = 0; i < 20; i++) {
             const fx = cx + (i * 45);
             const fy = levelRef.current.goalPos.y + 50; 
             ctx.fillStyle = i % 2 === 0 ? '#f472b6' : '#a78bfa'; 
             ctx.beginPath(); ctx.arc(fx, fy, 5, 0, Math.PI * 2); ctx.fill();
             ctx.fillStyle = 'green';
             ctx.fillRect(fx - 1, fy, 2, 20);
          }
          ctx.globalAlpha = 1.0;
       }

    } else {
       bgGradient = ctx.createLinearGradient(cameraPos.current.x, cameraPos.current.y, cameraPos.current.x, cameraPos.current.y + 600);
       if (levelRef.current.id >= LEVELS.length) {
          bgGradient.addColorStop(0, '#000000');
          bgGradient.addColorStop(1, '#0a0a1a');
       } else {
          bgGradient.addColorStop(0, '#050510');
          bgGradient.addColorStop(1, '#000000');
       }
       ctx.fillStyle = bgGradient;
       ctx.fillRect(cameraPos.current.x, cameraPos.current.y, 800, 600);

       ctx.fillStyle = '#ffffff';
       for (let i = 0; i < 50; i++) {
           const px = (i * 137) % 2000;
           const py = (i * 73) % 2000;
           const parallaxX = px - (cameraPos.current.x * 0.2);
           const parallaxY = py - (cameraPos.current.y * 0.2);
           const drawX = cameraPos.current.x + ((parallaxX % 800 + 800) % 800);
           const drawY = cameraPos.current.y + ((parallaxY % 600 + 600) % 600);
           ctx.globalAlpha = 0.3 + Math.sin(globalTime.current + i) * 0.2;
           ctx.fillRect(drawX, drawY, 2, 2);
       }
       ctx.globalAlpha = 1.0;
    }

    levelRef.current.entities.forEach(ent => {
      if (ent.type === EntityType.PLATFORM || ent.type === EntityType.MOVING_PLATFORM) {
        ctx.fillStyle = ent.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = ent.glowColor || '#000';
        ctx.fillRect(ent.pos.x, ent.pos.y, ent.size.x, ent.size.y);
        ctx.shadowBlur = 0;
      } 
      else if (ent.type === EntityType.HAZARD) {
        ctx.fillStyle = ent.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = ent.glowColor || '#f00';
        ctx.fillRect(ent.pos.x, ent.pos.y, ent.size.x, ent.size.y);
        ctx.shadowBlur = 0;
      }
      else if (ent.type === EntityType.MONSTER) {
        ctx.save();
        ctx.translate(ent.pos.x + 12, ent.pos.y + 12);
        ctx.rotate(globalTime.current * 2);
        ctx.fillStyle = ent.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = ent.glowColor || '#f00';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const r = i % 2 === 0 ? 12 : 6;
            ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      else if (ent.type === EntityType.SHOOTER) {
        ctx.save();
        ctx.translate(ent.pos.x + 15, ent.pos.y + 15);
        ctx.fillStyle = ent.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLOR_SHOOTER;
        ctx.beginPath();
        // Triangle shape for shooter
        ctx.moveTo(0, -15); ctx.lineTo(15, 15); ctx.lineTo(-15, 15);
        ctx.fill();
        ctx.restore();
      }
      else if (ent.type === EntityType.EVIL_PILL) {
        if (triggeredEvilPillIds.current.has(ent.id)) return; // Don't draw if triggered
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff0000';
        ctx.fillStyle = COLOR_EVIL_PILL;
        const glitchX = (Math.random() - 0.5) * 4;
        const glitchY = (Math.random() - 0.5) * 4;
        ctx.beginPath(); 
        ctx.arc(ent.pos.x + ent.size.x/2 + glitchX, ent.pos.y + ent.size.y/2 + glitchY, 9, 0, Math.PI * 2); 
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      else if (ent.type === EntityType.SIGN) {
        ctx.fillStyle = ent.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = ent.color;
        ctx.font = '20px Arial';
        const dir = ent.properties?.direction;
        let text = dir === 'sus' ? '→' : (dir === 'right' ? '→' : (dir === 'left' ? '←' : (dir === 'up' ? '↑' : '!')));
        ctx.fillText(text, ent.pos.x, ent.pos.y + 30);
        ctx.shadowBlur = 0;
      }
      else if (ent.type === EntityType.CHECKPOINT) {
        const isActive = activeCheckpointId.current === ent.id;
        ctx.shadowBlur = isActive ? 20 : 5;
        ctx.shadowColor = isActive ? COLOR_CHECKPOINT_ACTIVE : ent.color;
        ctx.fillStyle = isActive ? COLOR_CHECKPOINT_ACTIVE : ent.color;
        ctx.fillRect(ent.pos.x + 10, ent.pos.y, 10, ent.size.y);
        ctx.beginPath(); ctx.arc(ent.pos.x + 15, ent.pos.y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      else if (ent.type === EntityType.PILL && !collectedPillIds.current.has(ent.id)) {
        const floatY = Math.sin(globalTime.current * 3 + ent.pos.x) * 5;
        ctx.shadowBlur = 15;
        ctx.shadowColor = ent.glowColor || '#fff';
        ctx.fillStyle = ent.color;
        ctx.beginPath(); ctx.arc(ent.pos.x + ent.size.x/2, ent.pos.y + ent.size.y/2 + floatY, 6, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      else if (ent.type === EntityType.NPC) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = COLOR_GOAL_GLOW;
        ctx.fillStyle = COLOR_NPC;
        ctx.beginPath(); ctx.arc(ent.pos.x, ent.pos.y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      else if (ent.type === EntityType.MIRAGE_NPC) {
        if (triggeredMirageId.current !== ent.id || mirageFadeAlpha.current > 0.01) {
             // Draw Mirage NPC with Portal Effect
            ctx.globalAlpha = triggeredMirageId.current === ent.id ? mirageFadeAlpha.current : 1.0;
            ctx.shadowBlur = 30;
            ctx.shadowColor = COLOR_PORTAL_GLOW;
            ctx.strokeStyle = COLOR_PORTAL;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(ent.pos.x, ent.pos.y, 25, 0, Math.PI*2); ctx.stroke();
            
            ctx.shadowBlur = 20;
            ctx.shadowColor = COLOR_GOAL_GLOW;
            ctx.fillStyle = COLOR_NPC;
            // Pulse logic
            const pulse = triggeredMirageId.current === ent.id ? 0 : Math.sin(globalTime.current * 5) * 0.2;
            ctx.globalAlpha = triggeredMirageId.current === ent.id ? mirageFadeAlpha.current : 0.8 + pulse;
            ctx.beginPath(); ctx.arc(ent.pos.x, ent.pos.y, 12, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;
        }
      }
    });

    // Projectiles
    projectiles.current.forEach(p => {
        ctx.shadowBlur = 5;
        ctx.shadowColor = COLOR_PROJECTILE;
        ctx.fillStyle = COLOR_PROJECTILE;
        ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, 4, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Goal/Portal
    const goal = levelRef.current.goalPos;
    ctx.save();
    ctx.translate(goal.x, goal.y);
    ctx.rotate(portalRotation.current);
    if (currentLevelId === LEVELS.length) {
      if (status !== GameStatus.VICTORY) {
        ctx.rotate(-portalRotation.current); 
        ctx.shadowBlur = 30;
        ctx.shadowColor = COLOR_GOAL_GLOW;
        ctx.fillStyle = COLOR_GOAL;
        // FINAL LEVEL: Goal size same as player (10)
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(-3, -2, 2, 2); ctx.fillRect(1, -2, 2, 2);
      }
    } else {
      ctx.shadowBlur = 30;
      ctx.shadowColor = COLOR_PORTAL_GLOW;
      ctx.strokeStyle = COLOR_PORTAL;
      ctx.lineWidth = 4;
      ctx.strokeRect(-20, -20, 40, 40);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = '#a78bfa';
      ctx.strokeRect(-15, -15, 30, 30);
    }
    ctx.restore();

    particles.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    if (status !== GameStatus.VICTORY) {
      const p = playerPos.current;
      if (health.current <= 0 && respawnTimer.current > 0 && !healthDrainActive.current) {
         const progress = respawnTimer.current / 90;
         const size = 10 * progress;
         ctx.shadowBlur = 20 * progress;
         ctx.shadowColor = COLOR_PLAYER_GLOW;
         ctx.fillStyle = COLOR_PLAYER;
         ctx.globalAlpha = progress;
         ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
         ctx.globalAlpha = 1.0;
      } 
      else if (health.current > 0 || healthDrainActive.current) {
        if (invulnerableFrames.current <= 0 || Math.floor(globalTime.current * 10) % 2 !== 0) {
            // Player Color logic (Normal vs Evil)
            const isEvil = reversedControlsTimer.current > 0;
            ctx.shadowBlur = 20;
            ctx.shadowColor = isEvil ? COLOR_PLAYER_EVIL_GLOW : COLOR_PLAYER_GLOW;
            ctx.fillStyle = isEvil ? COLOR_PLAYER_EVIL : COLOR_PLAYER;
            
            const stretchX = 1 + (Math.abs(playerVel.current.x) / MAX_SPEED) * 0.2 - (Math.abs(playerVel.current.y) / 20) * 0.2;
            const stretchY = 1 + (Math.abs(playerVel.current.y) / 20) * 0.3 - (Math.abs(playerVel.current.x) / MAX_SPEED) * 0.1;
            ctx.beginPath(); ctx.ellipse(p.x, p.y, 10 * stretchX, 10 * stretchY, 0, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(p.x - 3 + eyeOffset.current.x, p.y - 2 + eyeOffset.current.y, 2.5, 0, Math.PI * 2);
            ctx.arc(p.x + 3 + eyeOffset.current.x, p.y - 2 + eyeOffset.current.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
      }
    } else {
       const cx = levelRef.current.goalPos.x;
       const cy = levelRef.current.goalPos.y - 50; 
       const t = (Date.now() - victoryAnimStart.current) / 1000;
       
       const spiralRadius = Math.max(0, 50 - t * 2); 
       const angle = t * 3;
       
       const p1x = cx + Math.cos(angle) * spiralRadius;
       const p1y = cy + Math.sin(angle) * spiralRadius;
       const p2x = cx + Math.cos(angle + Math.PI) * spiralRadius;
       const p2y = cy + Math.sin(angle + Math.PI) * spiralRadius;
       
       if (t < 20) {
        ctx.shadowBlur = 20 + t * 2;
        ctx.shadowColor = COLOR_PLAYER_GLOW;
        ctx.fillStyle = COLOR_PLAYER;
        ctx.beginPath(); ctx.arc(p1x, p1y, 10, 0, Math.PI * 2); ctx.fill();
        
        ctx.shadowColor = COLOR_GOAL_GLOW;
        ctx.fillStyle = COLOR_GOAL;
        ctx.beginPath(); ctx.arc(p2x, p2y, 10, 0, Math.PI * 2); ctx.fill();
        
        if (spiralRadius <= 5) {
             ctx.shadowBlur = 100;
             ctx.fillStyle = '#fff';
             ctx.beginPath(); ctx.arc(cx, cy, 5 + (t-15)*10, 0, Math.PI*2); ctx.fill();
        }
       }
    }
    ctx.restore();

    if (settings.controlScheme === 'touch' && status === GameStatus.PLAYING) {
      const drawBtn = (x: number, y: number, r: number, icon: any, active: boolean) => {
        ctx.fillStyle = active ? 'rgba(0, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)';
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'white'; ctx.font = '20px Arial'; ctx.fillText(icon, x - 7, y + 7);
      };
      drawBtn(100, 500, 40, '<', touchInput.left);
      drawBtn(220, 500, 40, '>', touchInput.right);
      drawBtn(700, 500, 50, '^', touchInput.jump);
    }
  }, [status, settings.controlScheme, touchInput, onUpdateMood, currentLevelId]);

  useEffect(() => {
    const loop = () => {
      update();
      draw();
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [update, draw]);

  const updateTouchState = (e: React.TouchEvent) => {
     if (settings.controlScheme !== 'touch') return;
     const rect = canvasRef.current?.getBoundingClientRect();
     if (!rect) return;
     let left = false, right = false, jump = false;
     for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        const x = (t.clientX - rect.left) * (800 / rect.width);
        const y = (t.clientY - rect.top) * (600 / rect.height);
        if (x < 160 && y > 400) left = true;
        if (x > 160 && x < 300 && y > 400) right = true;
        if (x > 600 && y > 400) jump = true;
     }
     setTouchInput({ left, right, jump });
  };

  return (
    <canvas 
      ref={canvasRef}
      className="w-full h-full bg-black touch-none"
      onTouchStart={updateTouchState}
      onTouchMove={updateTouchState}
      onTouchEnd={updateTouchState}
    />
  );
};
