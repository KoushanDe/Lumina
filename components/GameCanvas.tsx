
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EntityType, GameStatus, Level, Particle, Vector2, GameSettings } from '../types';
import { 
  GRAVITY, FRICTION, MOVE_SPEED, MAX_SPEED, JUMP_FORCE, LEVELS, 
  COLOR_PLAYER, COLOR_PLAYER_GLOW, COLOR_GOAL, COLOR_GOAL_GLOW, COLOR_PORTAL, COLOR_PORTAL_GLOW, 
  COLOR_SIGN, COLOR_SIGN_SUS, COLOR_MONSTER, COLOR_NPC, COLOR_CHECKPOINT, COLOR_CHECKPOINT_ACTIVE, COLOR_PILL, COLOR_MOVING_PLATFORM
} from '../constants';

interface GameCanvasProps {
  status: GameStatus;
  currentLevelId: number;
  settings: GameSettings;
  initialHealth: number;
  onLevelComplete: () => void;
  onGameOver: () => void;
  onGameWon: () => void;
  onPlaySound: (type: 'jump' | 'die' | 'portal' | 'victory' | 'checkpoint' | 'pill' | 'respawn') => void;
  onUpdateMood: (distanceToGoal: number, distanceToMonster: number) => void;
  onHealthChange: (health: number) => void;
  onShowWisdom: (wisdom: string) => void;
  onCheckpointSave: () => void;
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
  onCheckpointSave
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
  const checkpointHealth = useRef<number>(1.0);
  const invulnerableFrames = useRef<number>(0);
  const lastCheckpointPos = useRef<Vector2>({ x: 0, y: 0 });
  const activeCheckpointId = useRef<string | null>(null);
  const collectedPillIds = useRef<Set<string>>(new Set());

  const particles = useRef<Particle[]>([]);
  const levelRef = useRef<Level>(JSON.parse(JSON.stringify(LEVELS[0]))); 
  
  const eyeOffset = useRef<Vector2>({ x: 0, y: 0 });
  const portalRotation = useRef<number>(0);
  const globalTime = useRef<number>(0);
  const victoryAnimStart = useRef<number>(0);

  // Init Level (Runs once on mount due to key={levelId} in parent)
  useEffect(() => {
    const baseLevel = LEVELS.find(l => l.id === currentLevelId) || LEVELS[0];
    const level = JSON.parse(JSON.stringify(baseLevel));
    
    levelRef.current = level;
    playerPos.current = { ...level.startPos };
    lastCheckpointPos.current = { ...level.startPos }; 
    
    // Capture initial health correctly
    const startHealth = Math.max(1.0, initialHealth);
    health.current = startHealth;
    checkpointHealth.current = startHealth; 
    
    playerVel.current = { x: 0, y: 0 };
    jumpCount.current = 0;
    particles.current = [];
    invulnerableFrames.current = 0;
    activeCheckpointId.current = null;
    collectedPillIds.current = new Set();
    deathCause.current = 'hazard';
    
    // Sync initial health back to app state to be safe
    onHealthChange(startHealth);

    cameraPos.current = {
      x: Math.max(0, level.startPos.x - 400),
      y: Math.max(0, level.startPos.y - 300)
    };
    victoryAnimStart.current = 0;
    
    // Setup inputs
    const handleKeyDown = (e: KeyboardEvent) => setKeys(k => ({ ...k, [e.code]: true }));
    const handleKeyUp = (e: KeyboardEvent) => setKeys(k => ({ ...k, [e.code]: false }));
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []); // Empty dependency array = run once on mount

  const triggerHaptic = (pattern: number | number[]) => {
    if (settings.haptics && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const spawnParticles = (x: number, y: number, color: string, count: number, type: 'spark' | 'flower' = 'spark') => {
    for (let i = 0; i < count; i++) {
      particles.current.push({
        x, y,
        vx: (Math.random() - 0.5) * (type === 'flower' ? 3 : 5),
        vy: (Math.random() - 0.5) * (type === 'flower' ? 3 : 5),
        life: 1.0,
        maxLife: 1.0,
        color,
        size: Math.random() * (type === 'flower' ? 8 : 2) + 1,
        type
      });
    }
  };

  const update = useCallback(() => {
    if (status !== GameStatus.PLAYING && status !== GameStatus.VICTORY) return;
    
    globalTime.current += 0.02;
    if (invulnerableFrames.current > 0) invulnerableFrames.current--;

    // Handle internal "dead" state
    if (health.current <= 0) {
       if (respawnTimer.current === 0) respawnTimer.current = 90;
       respawnTimer.current--;

       if (respawnTimer.current <= 0) {
          // Respawn at Checkpoint
          playerPos.current = { ...lastCheckpointPos.current };
          playerVel.current = { x: 0, y: 0 };
          
          // RESTORE HEALTH TO CHECKPOINT VALUE
          health.current = checkpointHealth.current;
          
          invulnerableFrames.current = 60;
          onHealthChange(health.current);
          deathCause.current = 'hazard'; // Reset cause
          
          // Reset camera snap
          const canvasW = 800;
          const canvasH = 600;
          cameraPos.current = {
               x: Math.max(0, playerPos.current.x - canvasW/2),
               y: Math.max(0, playerPos.current.y - canvasH/2)
          };
          onPlaySound('respawn');
       }

       // Update particles even during death
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

    // --- Moving Platforms Logic ---
    level.entities.forEach(ent => {
      if (ent.type === EntityType.MOVING_PLATFORM && ent.initialPos) {
         const range = ent.moveRange || 100;
         const speed = ent.moveSpeed || 0.02;
         const offset = Math.sin(globalTime.current * speed * 50) * range;
         
         const prevX = ent.pos.x;
         const prevY = ent.pos.y;

         if (ent.moveAxis === 'y') {
            ent.pos.y = ent.initialPos.y + offset;
         } else {
            ent.pos.x = ent.initialPos.x + offset;
         }
         ent.velocity = { x: ent.pos.x - prevX, y: ent.pos.y - prevY };
      }
    });

    // --- Level 4 Decoy ---
    if (currentLevelId === 4 && status === GameStatus.PLAYING) {
      const npcEntity = level.entities.find(e => e.id === 'decoy-npc');
      if (npcEntity) {
        const distToNpc = Math.sqrt(Math.pow(pos.x - npcEntity.pos.x, 2) + Math.pow(pos.y - npcEntity.pos.y, 2));
        if (distToNpc < 200) {
           const vanishX = level.width - 100;
           npcEntity.pos.x += (vanishX - npcEntity.pos.x) * 0.1;
           const plat = level.entities.find(e => e.id === 'decoy-platform');
           if (plat) plat.pos.x += (vanishX - 75 - plat.pos.x) * 0.1;
        }
      }
    }

    // --- Monster Patrol ---
    level.entities.forEach(ent => {
      if (ent.type === EntityType.MONSTER && ent.initialPos) {
        const range = ent.properties?.range || 50;
        const speed = ent.properties?.speed || 0.05;
        ent.pos.x = ent.initialPos.x + Math.sin(globalTime.current * speed * 20) * range;
      }
    });

    // --- Physics ---
    if (status === GameStatus.PLAYING) {
      const leftInput = keys['ArrowLeft'] || keys['KeyA'] || touchInput.left;
      const rightInput = keys['ArrowRight'] || keys['KeyD'] || touchInput.right;
      const jumpInput = keys['ArrowUp'] || keys['KeyW'] || keys['Space'] || touchInput.jump;

      // Knockback control loss
      if (invulnerableFrames.current < 100) { 
        if (rightInput) vel.x += MOVE_SPEED;
        if (leftInput) vel.x -= MOVE_SPEED;
      }

      // Jump
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

      // --- Collision ---
      let hitX = false;
      let hitY = false;
      let minMonsterDist = 9999;

      const takeDamage = (amount: number, sourceX?: number, cause: 'void' | 'hazard' = 'hazard') => {
         if (invulnerableFrames.current > 0) return;
         
         health.current -= amount;
         onHealthChange(health.current);
         onPlaySound('die');
         triggerHaptic(300);
         
         if (health.current <= 0) {
           // Start death sequence
           deathCause.current = cause;
           respawnTimer.current = 90; 
         } else {
           spawnParticles(pos.x, pos.y, '#ff0000', 20);
           // Just Hit -> Knockback
           invulnerableFrames.current = 120; // 2 seconds
           vel.y = -8;
           if (sourceX !== undefined) {
             vel.x = (pos.x - sourceX) > 0 ? 10 : -10;
           }
         }
      };

      for (const ent of level.entities) {
        // Collision Check
        const entW = ent.size?.x || 20;
        const entH = ent.size?.y || 20;

        // Solid Blocks
        if (ent.type === EntityType.PLATFORM || ent.type === EntityType.MOVING_PLATFORM) {
          if (nextX + 10 > ent.pos.x && nextX - 10 < ent.pos.x + entW &&
              pos.y + 10 > ent.pos.y && pos.y - 10 < ent.pos.y + entH) {
            vel.x = 0;
            hitX = true;
          }
        }
        
        // Monster & Hazard Logic
        if (ent.type === EntityType.MONSTER) {
           // Distance Check for Mood
           const dist = Math.sqrt(Math.pow(pos.x - ent.pos.x, 2) + Math.pow(pos.y - ent.pos.y, 2));
           if (dist < minMonsterDist) minMonsterDist = dist;

           if (pos.x + 10 > ent.pos.x && pos.x - 10 < ent.pos.x + entW &&
               pos.y + 10 > ent.pos.y && pos.y - 10 < ent.pos.y + entH) {
               takeDamage(0.5, ent.pos.x + entW/2, 'hazard');
           }
        }
        if (ent.type === EntityType.HAZARD) {
           if (pos.x + 10 > ent.pos.x && pos.x - 10 < ent.pos.x + entW &&
               pos.y + 10 > ent.pos.y && pos.y - 10 < ent.pos.y + entH) {
               takeDamage(1.0, undefined, 'hazard'); 
               return; 
           }
        }

        // Interactables
        if (ent.type === EntityType.CHECKPOINT) {
           if (pos.x > ent.pos.x && pos.x < ent.pos.x + entW &&
               pos.y > ent.pos.y && pos.y < ent.pos.y + entH) {
               if (activeCheckpointId.current !== ent.id) {
                 lastCheckpointPos.current = { x: ent.pos.x + entW/2, y: ent.pos.y + entH/2 };
                 activeCheckpointId.current = ent.id;
                 checkpointHealth.current = health.current;
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
               health.current = health.current + 0.5; 
               onHealthChange(health.current);
               if (ent.wisdom) onShowWisdom(ent.wisdom);
               triggerHaptic([50, 50]);
               onPlaySound('pill');
               spawnParticles(ent.pos.x, ent.pos.y, '#ffd700', 15, 'flower');
           }
        }
      }
      if (!hitX) pos.x = nextX;

      // Y Collisions
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

      // Mood Update
      const dx = pos.x - level.goalPos.x;
      const dy = pos.y - level.goalPos.y;
      const distToGoal = Math.sqrt(dx*dx + dy*dy);
      onUpdateMood(distToGoal, minMonsterDist);

      // Victory Check
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

      // Bounds - VOID DEATH
      if (pos.y > level.height + 500) {
        takeDamage(1.0, undefined, 'void');
      }
      
      const targetEyeX = vel.x * 2;
      const targetEyeY = vel.y * 2;
      eyeOffset.current.x += (targetEyeX - eyeOffset.current.x) * 0.2;
      eyeOffset.current.y += (targetEyeY - eyeOffset.current.y) * 0.2;
    }

    // --- Camera ---
    const canvasW = 800;
    const canvasH = 600;
    const targetCamX = pos.x - canvasW / 2;
    const targetCamY = pos.y - canvasH / 2;
    
    cameraPos.current.x += (targetCamX - cameraPos.current.x) * 0.1;
    cameraPos.current.y += (targetCamY - cameraPos.current.y) * 0.1;
    cameraPos.current.x = Math.max(0, Math.min(cameraPos.current.x, level.width - canvasW));
    cameraPos.current.y = Math.max(0, Math.min(cameraPos.current.y, level.height - canvasH));

    // --- Draw Logic ---
    // ... (Particles updates)
    for (let i = particles.current.length - 1; i >= 0; i--) {
      const p = particles.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.015;
      if (p.type === 'flower') {
         p.vy -= 0.02;
         p.vx += Math.sin(p.y * 0.1) * 0.05;
      }
      if (p.life <= 0) particles.current.splice(i, 1);
    }

  }, [status, keys, touchInput, onGameOver, onLevelComplete, onGameWon, settings.haptics, onUpdateMood, currentLevelId, onCheckpointSave]);

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
    // ONLY SHAKE IF CAUSE IS VOID
    if (deathCause.current === 'void' && respawnTimer.current > 30 && respawnTimer.current < 60) {
        shakeX = (Math.random() - 0.5) * 5;
        shakeY = (Math.random() - 0.5) * 5;
    }
    ctx.translate(-(cameraPos.current.x + shakeX), -(cameraPos.current.y + shakeY));

    // Background
    const bgGradient = ctx.createLinearGradient(cameraPos.current.x, cameraPos.current.y, cameraPos.current.x, cameraPos.current.y + 600);
    if (status === GameStatus.VICTORY) {
       const elapsed = (Date.now() - victoryAnimStart.current) / 3000;
       const progress = Math.min(1, elapsed);
       bgGradient.addColorStop(0, `rgba(255, 255, 255, ${progress})`);
       bgGradient.addColorStop(1, `rgba(200, 255, 200, ${progress})`); 
    } else {
       if (levelRef.current.id >= LEVELS.length) {
          bgGradient.addColorStop(0, '#000000');
          bgGradient.addColorStop(1, '#0a0a1a');
       } else {
          bgGradient.addColorStop(0, '#050510');
          bgGradient.addColorStop(1, '#000000');
       }
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(cameraPos.current.x, cameraPos.current.y, 800, 600);

    if (status !== GameStatus.VICTORY) {
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

    // Draw Entities
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
    });

    // Goal/Portal
    const goal = levelRef.current.goalPos;
    ctx.save();
    ctx.translate(goal.x, goal.y);
    ctx.rotate(portalRotation.current);
    if (currentLevelId === LEVELS.length) {
      ctx.rotate(-portalRotation.current); 
      ctx.shadowBlur = 30;
      ctx.shadowColor = COLOR_GOAL_GLOW;
      ctx.fillStyle = COLOR_GOAL;
      ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(-5, -3, 3, 3); ctx.fillRect(2, -3, 3, 3);
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

    // Particles
    particles.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Player
    if (status !== GameStatus.VICTORY) {
      const p = playerPos.current;
      if (health.current <= 0 && respawnTimer.current > 0) {
         const progress = respawnTimer.current / 90;
         const size = 10 * progress;
         ctx.shadowBlur = 20 * progress;
         ctx.shadowColor = COLOR_PLAYER_GLOW;
         ctx.fillStyle = COLOR_PLAYER;
         ctx.globalAlpha = progress;
         ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
         ctx.globalAlpha = 1.0;
      } 
      else if (health.current > 0) {
        if (invulnerableFrames.current <= 0 || Math.floor(globalTime.current * 10) % 2 !== 0) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = COLOR_PLAYER_GLOW;
            ctx.fillStyle = COLOR_PLAYER;
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
       const cy = levelRef.current.goalPos.y;
       const t = (Date.now() - victoryAnimStart.current) / 1000;
       const p1x = cx + Math.cos(t * 2) * (30 - t * 5);
       const p1y = cy + Math.sin(t * 2) * (30 - t * 5);
       const p2x = cx + Math.cos(t * 2 + Math.PI) * (30 - t * 5);
       const p2y = cy + Math.sin(t * 2 + Math.PI) * (30 - t * 5);
       if (t < 5) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = COLOR_PLAYER_GLOW;
        ctx.fillStyle = COLOR_PLAYER;
        ctx.beginPath(); ctx.arc(p1x, p1y, 10, 0, Math.PI * 2); ctx.fill();
        ctx.shadowColor = COLOR_GOAL_GLOW;
        ctx.fillStyle = COLOR_GOAL;
        ctx.beginPath(); ctx.arc(p2x, p2y, 10, 0, Math.PI * 2); ctx.fill();
       }
    }
    ctx.restore();

    // Touch Controls
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
