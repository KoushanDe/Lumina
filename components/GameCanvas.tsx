
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EntityType, GameStatus, Level, Particle, Vector2, GameSettings } from '../types';
import { 
  GRAVITY, FRICTION, MOVE_SPEED, MAX_SPEED, JUMP_FORCE, LEVELS, 
  COLOR_PLAYER, COLOR_PLAYER_GLOW, COLOR_GOAL, COLOR_GOAL_GLOW, COLOR_PORTAL, COLOR_PORTAL_GLOW, COLOR_SIGN, COLOR_MONSTER, COLOR_NPC
} from '../constants';
import { ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';

interface GameCanvasProps {
  status: GameStatus;
  currentLevelId: number;
  settings: GameSettings;
  onLevelComplete: () => void;
  onGameOver: () => void;
  onGameWon: () => void;
  onPlaySound: (type: 'jump' | 'die' | 'portal' | 'victory') => void;
  onUpdateMood: (distanceToGoal: number) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ 
  status, 
  currentLevelId, 
  settings,
  onLevelComplete, 
  onGameOver, 
  onGameWon,
  onPlaySound,
  onUpdateMood
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
  
  const particles = useRef<Particle[]>([]);
  // Deep clone to allow modification (like moving platforms) without ruining global constant
  const levelRef = useRef<Level>(JSON.parse(JSON.stringify(LEVELS[0]))); 
  
  // Animation tracking
  const eyeOffset = useRef<Vector2>({ x: 0, y: 0 });
  const portalRotation = useRef<number>(0);
  const globalTime = useRef<number>(0);

  // Victory Animation Refs
  const victoryAnimStart = useRef<number>(0);

  // Init Level
  useEffect(() => {
    // Deep copy level data so we can mutate it (chase logic)
    const baseLevel = LEVELS.find(l => l.id === currentLevelId) || LEVELS[0];
    const level = JSON.parse(JSON.stringify(baseLevel));
    
    levelRef.current = level;
    playerPos.current = { ...level.startPos };
    playerVel.current = { x: 0, y: 0 };
    jumpCount.current = 0;
    particles.current = [];
    cameraPos.current = {
      x: Math.max(0, level.startPos.x - 400),
      y: Math.max(0, level.startPos.y - 300)
    };
    victoryAnimStart.current = 0;
  }, [currentLevelId, status]);

  // Input handling
  useEffect(() => {
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

  const spawnParticles = (x: number, y: number, color: string, count: number, type: 'spark' | 'flower' = 'spark') => {
    for (let i = 0; i < count; i++) {
      particles.current.push({
        x, y,
        vx: (Math.random() - 0.5) * (type === 'flower' ? 3 : 6),
        vy: (Math.random() - 0.5) * (type === 'flower' ? 3 : 6),
        life: 1.0,
        maxLife: 1.0,
        color,
        size: Math.random() * (type === 'flower' ? 8 : 3) + 1,
        type
      });
    }
  };

  const update = useCallback(() => {
    if (status !== GameStatus.PLAYING && status !== GameStatus.VICTORY) return;
    
    globalTime.current += 0.02;
    const level = levelRef.current;
    const pos = playerPos.current;
    const vel = playerVel.current;

    portalRotation.current += 0.02;

    // --- Special Level 4 Logic (Decoy Vanish) ---
    if (currentLevelId === 4 && status === GameStatus.PLAYING) {
      const npcEntity = level.entities.find(e => e.id === 'decoy-npc');
      if (npcEntity) {
        const distToNpc = Math.sqrt(Math.pow(pos.x - npcEntity.pos.x, 2) + Math.pow(pos.y - npcEntity.pos.y, 2));
        
        // Trigger vanish logic
        if (distToNpc < 200) {
           const vanishX = 2300; // Far right
           // Swiftly move NPC and its platform
           npcEntity.pos.x += (vanishX - npcEntity.pos.x) * 0.1; // Lerp fast
           
           const plat = level.entities.find(e => e.id === 'decoy-platform');
           if (plat) {
             plat.pos.x += (vanishX - 75 - plat.pos.x) * 0.1;
           }
        }
      }
    }

    // --- Monster Patrol Logic ---
    level.entities.forEach(ent => {
      if (ent.type === EntityType.MONSTER && ent.initialPos) {
        const range = ent.properties?.range || 50;
        const speed = ent.properties?.speed || 0.05;
        ent.pos.x = ent.initialPos.x + Math.sin(globalTime.current * speed * 20) * range;
      }
    });

    // --- Physics (Player) ---
    if (status === GameStatus.PLAYING) {
      const leftInput = keys['ArrowLeft'] || keys['KeyA'] || touchInput.left;
      const rightInput = keys['ArrowRight'] || keys['KeyD'] || touchInput.right;
      const jumpInput = keys['ArrowUp'] || keys['KeyW'] || keys['Space'] || touchInput.jump;

      if (rightInput) vel.x += MOVE_SPEED;
      if (leftInput) vel.x -= MOVE_SPEED;
      
      // Jump Logic
      if (jumpInput && !wasJumpPressed.current) {
        const canJump = airTime.current < 6; 
        if (canJump || jumpCount.current < 2) {
          if (!canJump && jumpCount.current === 0) jumpCount.current = 1;
          vel.y = JUMP_FORCE;
          jumpCount.current++;
          onPlaySound('jump');
          triggerHaptic(10);
          spawnParticles(pos.x, pos.y + 10, '#fff', 5);
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

      // Check X
      for (const ent of level.entities) {
        if (ent.type === EntityType.PLATFORM) {
          if (nextX + 10 > ent.pos.x && nextX - 10 < ent.pos.x + ent.size.x &&
              pos.y + 10 > ent.pos.y && pos.y - 10 < ent.pos.y + ent.size.y) {
            vel.x = 0;
            hitX = true;
          }
        }
        if (ent.type === EntityType.HAZARD || ent.type === EntityType.MONSTER) {
           const buffer = 8;
           const entW = ent.size?.x || 20;
           const entH = ent.size?.y || 20;
           if (nextX + buffer > ent.pos.x && nextX - buffer < ent.pos.x + entW &&
              pos.y + buffer > ent.pos.y && pos.y - buffer < ent.pos.y + entH) {
              spawnParticles(pos.x, pos.y, COLOR_PLAYER, 30);
              onPlaySound('die');
              triggerHaptic(200);
              onGameOver();
              return;
          }
        }
      }
      if (!hitX) pos.x = nextX;

      // Check Y
      for (const ent of level.entities) {
        if (ent.type === EntityType.PLATFORM) {
          if (pos.x + 10 > ent.pos.x && pos.x - 10 < ent.pos.x + ent.size.x &&
              nextY + 10 > ent.pos.y && nextY - 10 < ent.pos.y + ent.size.y) {
            
            if (vel.y > 0 && pos.y < ent.pos.y) {
               pos.y = ent.pos.y - 10;
               vel.y = 0;
               hitY = true;
               jumpCount.current = 0;
               airTime.current = 0; 
            } else if (vel.y < 0 && pos.y > ent.pos.y + ent.size.y) {
               pos.y = ent.pos.y + ent.size.y + 10;
               vel.y = 0;
               hitY = true;
            }
          }
        }
        if (ent.type === EntityType.HAZARD || ent.type === EntityType.MONSTER) {
           const buffer = 8;
           const entW = ent.size?.x || 20;
           const entH = ent.size?.y || 20;
           if (pos.x + buffer > ent.pos.x && pos.x - buffer < ent.pos.x + entW &&
              nextY + buffer > ent.pos.y && nextY - buffer < ent.pos.y + entH) {
              spawnParticles(pos.x, pos.y, COLOR_PLAYER, 30);
              onPlaySound('die');
              triggerHaptic(200);
              onGameOver();
              return;
          }
        }
      }
      if (!hitY) {
        pos.y = nextY;
        airTime.current += 1;
      }

      // Check Goal & Update Mood
      const dx = pos.x - level.goalPos.x;
      const dy = pos.y - level.goalPos.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      onUpdateMood(dist);

      if (dist < 30) {
        if (currentLevelId === LEVELS.length) { // Final Level
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

      // Bounds Death
      if (pos.y > level.height + 200) {
        onPlaySound('die');
        triggerHaptic(200);
        onGameOver();
      }
      
      // Eye Look
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

    // --- Victory Particles (Bloom) ---
    if (status === GameStatus.VICTORY) {
       // Explode nature from center
       if (Math.random() > 0.5) {
         const angle = Math.random() * Math.PI * 2;
         const dist = Math.random() * 400;
         spawnParticles(level.goalPos.x + Math.cos(angle)*dist, level.goalPos.y + Math.sin(angle)*dist, '#ff77ff', 1, 'flower');
       }
    }

    // Update Particles
    for (let i = particles.current.length - 1; i >= 0; i--) {
      const p = particles.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.015;
      if (p.type === 'flower') {
         p.vy -= 0.02; // Float up
         p.vx += Math.sin(p.y * 0.1) * 0.05;
      }
      if (p.life <= 0) particles.current.splice(i, 1);
    }

  }, [status, keys, touchInput, onGameOver, onLevelComplete, onGameWon, settings.haptics, onUpdateMood, currentLevelId]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 600;

    // Background
    if (status === GameStatus.VICTORY) {
      // Cinematic Bloom Transition
      const elapsed = Date.now() - victoryAnimStart.current;
      const progress = Math.min(elapsed / 4000, 1); // 4 sec transition
      
      const grad = ctx.createRadialGradient(
        canvas.width/2, canvas.height/2, 0, 
        canvas.width/2, canvas.height/2, 600
      );
      // Fade from dark to bright
      grad.addColorStop(0, `rgba(255, 240, 245, ${progress})`);
      grad.addColorStop(1, `rgba(230, 255, 250, ${progress})`);
      
      ctx.fillStyle = progress < 1 ? `rgba(5, 5, 5, ${1 - progress})` : '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = grad;
    } else {
      if (currentLevelId === 5) {
         ctx.fillStyle = '#0a0a12'; // Darker blue/black for final level
      } else {
         ctx.fillStyle = '#050505';
      }
    }
    
    if (status !== GameStatus.VICTORY) {
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Stars for level 5
      if (currentLevelId === 5) {
        ctx.fillStyle = '#ffffff';
        for(let i=0; i<50; i++) {
           const x = (i * 137) % canvas.width;
           const y = (i * 253) % canvas.height;
           ctx.globalAlpha = Math.random() * 0.5;
           ctx.fillRect(x,y,2,2);
        }
        ctx.globalAlpha = 1.0;
      }
    } else {
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.save();
    ctx.translate(-cameraPos.current.x, -cameraPos.current.y);

    const level = levelRef.current;
    const pos = playerPos.current;

    // Particles
    particles.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.type === 'flower') {
         ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      } else {
         ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.fill();
      ctx.globalAlpha = 1.0;
    });

    // Entities
    level.entities.forEach(ent => {
      ctx.shadowBlur = 0;
      
      if (ent.type === EntityType.SIGN) {
        // Draw Sign
        const dir = ent.properties?.direction || 'right';
        ctx.strokeStyle = COLOR_SIGN;
        ctx.lineWidth = 3;
        ctx.shadowColor = COLOR_SIGN;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        const cx = ent.pos.x + 20;
        const cy = ent.pos.y + 20;
        const s = 10;
        if (dir === 'right') {
          ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy);
          ctx.lineTo(cx + s - 5, cy - 5); ctx.moveTo(cx + s, cy); ctx.lineTo(cx + s - 5, cy + 5);
        } else if (dir === 'up' || dir === 'jump') {
          ctx.moveTo(cx, cy + s); ctx.lineTo(cx, cy - s);
          ctx.lineTo(cx - 5, cy - s + 5); ctx.moveTo(cx, cy - s); ctx.lineTo(cx + 5, cy - s + 5);
        }
        ctx.stroke();
        return;
      }

      // Draw Monsters
      if (ent.type === EntityType.MONSTER) {
        ctx.fillStyle = COLOR_MONSTER;
        ctx.shadowColor = COLOR_MONSTER;
        ctx.shadowBlur = 15;
        
        const cx = ent.pos.x + ent.size.x/2;
        const cy = ent.pos.y + ent.size.y/2;
        const r = ent.size.x/2;
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(globalTime.current * 4); // Spin
        
        // Spiky shape
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
           const angle = (i / 8) * Math.PI * 2;
           const len = i % 2 === 0 ? r : r * 0.5;
           ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
      }

      // Draw NPC (Decoy)
      if (ent.type === EntityType.NPC) {
        ctx.shadowColor = COLOR_GOAL_GLOW;
        ctx.shadowBlur = 25;
        ctx.fillStyle = COLOR_GOAL;
        ctx.beginPath();
        const cx = ent.pos.x + ent.size.x/2;
        const cy = ent.pos.y + ent.size.y/2;
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fill();
        // Eyes (looking at player)
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        const dx = pos.x - cx;
        const dy = pos.y - cy;
        const angle = Math.atan2(dy, dx);
        const gx = Math.cos(angle) * 3;
        const gy = Math.sin(angle) * 3;
        ctx.beginPath();
        ctx.arc(cx - 4 + gx, cy - 2 + gy, 3, 0, Math.PI * 2);
        ctx.arc(cx + 4 + gx, cy - 2 + gy, 3, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      ctx.shadowColor = ent.glowColor || ent.color;
      ctx.shadowBlur = 15;
      ctx.fillStyle = ent.color;
      
      if (status === GameStatus.VICTORY && ent.type === EntityType.PLATFORM) {
         ctx.fillStyle = '#2d5a27'; // Dark nature green
         ctx.shadowColor = '#4caf50';
      }

      if (ent.type === EntityType.PLATFORM || ent.type === EntityType.HAZARD) {
        ctx.fillRect(ent.pos.x, ent.pos.y, ent.size.x, ent.size.y);
      }
    });

    // Draw Goal (Pink Ball or Portal)
    const isLastLevel = level.id === LEVELS.length;
    
    if (isLastLevel) {
      if (status === GameStatus.VICTORY) {
         // Cinematic Animation: Spiral Dance
         const elapsed = Date.now() - victoryAnimStart.current;
         // Center of animation
         const centerX = (level.goalPos.x + pos.x) / 2;
         const centerY = (level.goalPos.y + pos.y) / 2;
         
         // Animate balls moving to center
         let p1x = pos.x, p1y = pos.y;
         let p2x = level.goalPos.x, p2y = level.goalPos.y;
         
         if (elapsed < 1500) {
           const t = elapsed / 1500;
           p1x = pos.x + (centerX - pos.x) * t;
           p1y = pos.y + (centerY - pos.y) * t;
           p2x = level.goalPos.x + (centerX - level.goalPos.x) * t;
           p2y = level.goalPos.y + (centerY - level.goalPos.y) * t;
         } else {
           // Spiral
           const t = (elapsed - 1500) / 1500;
           const radius = Math.max(0, 50 - t * 10);
           const angle = t * 4;
           p1x = centerX + Math.cos(angle) * radius;
           p1y = centerY + Math.sin(angle) * radius;
           p2x = centerX + Math.cos(angle + Math.PI) * radius;
           p2y = centerY + Math.sin(angle + Math.PI) * radius;
         }

         // Draw Player (Blue)
         ctx.shadowBlur = 20;
         ctx.shadowColor = COLOR_PLAYER_GLOW;
         ctx.fillStyle = COLOR_PLAYER;
         ctx.beginPath(); ctx.arc(p1x, p1y, 10, 0, Math.PI*2); ctx.fill();

         // Draw Goal (Pink)
         ctx.shadowBlur = 20;
         ctx.shadowColor = COLOR_GOAL_GLOW;
         ctx.fillStyle = COLOR_GOAL;
         ctx.beginPath(); ctx.arc(p2x, p2y, 10, 0, Math.PI*2); ctx.fill();

      } else {
        // Female Character Static
        ctx.shadowColor = COLOR_GOAL_GLOW;
        ctx.shadowBlur = 25;
        ctx.fillStyle = COLOR_GOAL;
        ctx.beginPath();
        ctx.arc(level.goalPos.x, level.goalPos.y, 12, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        const dx = pos.x - level.goalPos.x;
        const dy = pos.y - level.goalPos.y;
        const angle = Math.atan2(dy, dx);
        const gx = Math.cos(angle) * 3;
        const gy = Math.sin(angle) * 3;
        
        ctx.beginPath();
        ctx.arc(level.goalPos.x - 4 + gx, level.goalPos.y - 2 + gy, 3, 0, Math.PI * 2);
        ctx.arc(level.goalPos.x + 4 + gx, level.goalPos.y - 2 + gy, 3, 0, Math.PI * 2);
        ctx.fill();
      }

    } else {
      // Portal
      const cx = level.goalPos.x;
      const cy = level.goalPos.y;
      const size = 25;

      ctx.shadowBlur = 25;
      ctx.shadowColor = COLOR_PORTAL_GLOW;
      
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(portalRotation.current);
      ctx.strokeStyle = COLOR_PORTAL;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(-size, -size, size * 2, size * 2);
      ctx.stroke();
      
      ctx.rotate(-portalRotation.current * 2.5);
      ctx.fillStyle = COLOR_PORTAL_GLOW;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      const innerSize = size * 0.6;
      ctx.rect(-innerSize, -innerSize, innerSize * 2, innerSize * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1.0;
      
      // Core pulse
      const pulse = (Math.sin(portalRotation.current * 4) + 1) / 2;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.4 + (pulse * 0.4);
      ctx.beginPath();
      ctx.arc(cx, cy, 5 + (pulse * 3), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // Player (Only draw if not victory, because Victory handles its own drawing logic for animation)
    if (status !== GameStatus.VICTORY) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = COLOR_PLAYER_GLOW;
      ctx.fillStyle = COLOR_PLAYER;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      let lookX = eyeOffset.current.x;
      let lookY = eyeOffset.current.y;
      ctx.beginPath();
      ctx.arc(pos.x - 3 + lookX, pos.y - 2 + lookY, 2.5, 0, Math.PI * 2);
      ctx.arc(pos.x + 3 + lookX, pos.y - 2 + lookY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (status === GameStatus.VICTORY) {
      ctx.fillStyle = '#ff5555';
      ctx.font = '24px serif';
      const cx = (pos.x + level.goalPos.x)/2;
      const cy = (pos.y + level.goalPos.y)/2;
      // Only show heart after a bit of animation
      if (Date.now() - victoryAnimStart.current > 3000) {
        ctx.fillText('❤', cx, cy - 50 - (Date.now() % 1000) / 20);
      }
    }

    ctx.restore();
  }, [status]);

  useEffect(() => {
    const loop = () => {
      update();
      draw();
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update, draw]);

  return (
    <div className="relative w-full h-full">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full max-w-[800px] max-h-[600px] mx-auto shadow-2xl rounded-lg border border-gray-800 touch-none"
        style={{
          background: status === GameStatus.VICTORY ? '#e0fff0' : '#050505',
          transition: 'background 4s ease-in-out'
        }}
      />
      {settings.controlScheme === 'touch' && status === GameStatus.PLAYING && (
        <>
          <div className="absolute bottom-8 left-8 flex gap-4">
            <button 
              className={`w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm transition ${touchInput.left ? 'bg-cyan-500/30 scale-95' : 'active:bg-cyan-500/30 active:scale-95'}`}
              onTouchStart={() => setTouchInput(p => ({ ...p, left: true }))}
              onTouchEnd={() => setTouchInput(p => ({ ...p, left: false }))}
              onMouseDown={() => setTouchInput(p => ({ ...p, left: true }))}
              onMouseUp={() => setTouchInput(p => ({ ...p, left: false }))}
            >
              <ArrowLeft className="text-cyan-400" size={32} />
            </button>
            <button 
              className={`w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm transition ${touchInput.right ? 'bg-cyan-500/30 scale-95' : 'active:bg-cyan-500/30 active:scale-95'}`}
              onTouchStart={() => setTouchInput(p => ({ ...p, right: true }))}
              onTouchEnd={() => setTouchInput(p => ({ ...p, right: false }))}
              onMouseDown={() => setTouchInput(p => ({ ...p, right: true }))}
              onMouseUp={() => setTouchInput(p => ({ ...p, right: false }))}
            >
              <ArrowRight className="text-cyan-400" size={32} />
            </button>
          </div>
          <div className="absolute bottom-8 right-8">
            <button 
              className={`w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm transition ${touchInput.jump ? 'bg-pink-500/30 scale-95' : 'active:bg-pink-500/30 active:scale-95'}`}
              onTouchStart={() => setTouchInput(p => ({ ...p, jump: true }))}
              onTouchEnd={() => setTouchInput(p => ({ ...p, jump: false }))}
              onMouseDown={() => setTouchInput(p => ({ ...p, jump: true }))}
              onMouseUp={() => setTouchInput(p => ({ ...p, jump: false }))}
            >
              <ArrowUp className="text-pink-400" size={40} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
