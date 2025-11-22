
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameStatus, GameSettings, ControlScheme } from './types';
import { LEVELS } from './constants';
import { generateLevelNarrative } from './services/geminiService';
import { Play, RotateCcw, Heart, Settings, X, Volume2, VolumeX, Music, HelpCircle, Map, Gamepad2, Smartphone, Home } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.MENU);
  const [levelId, setLevelId] = useState(1);
  const [narrative, setNarrative] = useState<string>("");
  const [loadingStory, setLoadingStory] = useState(false);
  
  // Persistence
  const [maxReachedLevel, setMaxReachedLevel] = useState(1);

  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [showObjective, setShowObjective] = useState(false);
  const [showJourney, setShowJourney] = useState(false);
  const [settings, setSettings] = useState<GameSettings>({
    musicVolume: 0.4,
    sfxVolume: 0.5,
    haptics: true,
    controlScheme: 'keyboard'
  });

  // Load Max Level
  useEffect(() => {
    const savedMax = localStorage.getItem('lumina_max_level');
    if (savedMax) setMaxReachedLevel(parseInt(savedMax, 10));
    
    const savedSettings = localStorage.getItem('lumina_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, []);

  // Save Max Level & Settings
  useEffect(() => {
    localStorage.setItem('lumina_max_level', maxReachedLevel.toString());
  }, [maxReachedLevel]);

  useEffect(() => {
    localStorage.setItem('lumina_settings', JSON.stringify(settings));
  }, [settings]);

  // Mood System
  const [mood, setMood] = useState<'curious' | 'calm' | 'hopeful'>('curious');
  const deathCountRef = useRef(0);

  // --- Audio System (Soft Felt Piano) ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const bgmIntervalRef = useRef<number | null>(null);
  
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;

      // Create Delay Node for Mystical Echo/Reverb
      const delay = ctx.createDelay();
      delay.delayTime.value = 0.4; // Slower echo for piano
      
      const feedback = ctx.createGain();
      feedback.gain.value = 0.3; 

      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.9;

      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(masterGain);
      masterGain.connect(ctx.destination);
      
      delayNodeRef.current = delay;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  // Synthesize a Soft Piano note
  const playPianoNote = useCallback((freq: number, volume: number, duration: number = 2.0) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    const dest = delayNodeRef.current || ctx.destination;

    const osc = ctx.createOscillator();
    // Triangle wave gives a mellower, piano-like fundamental than sine
    osc.type = 'triangle'; 
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    
    // Piano Envelope: Fast attack, long exponential decay
    // Adjusted attack to be slightly crisper
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * settings.musicVolume * 1.5, now + 0.02); 
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration); 

    osc.connect(gain);
    gain.connect(dest); 
    // Direct connection too for clarity
    if (delayNodeRef.current) gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.1); 
  }, [settings.musicVolume]);

  const playBgmSequence = useCallback(() => {
    if (status !== GameStatus.PLAYING && status !== GameStatus.VICTORY) return;

    // Piano Scales (Lower octave for soothing effect)
    // C Major / A Minor variations
    const curiousScale = [261.63, 293.66, 329.63, 392.00, 440.00]; // C4, D4, E4, G4, A4
    const calmScale = [196.00, 220.00, 246.94, 261.63, 293.66];     // G3, A3, B3, C4, D4
    const hopefulScale = [329.63, 392.00, 440.00, 523.25, 659.25];  // E4, G4, A4, C5, E5 (Brightened)

    let currentScale = curiousScale;

    if (mood === 'calm') {
      currentScale = calmScale;
    } else if (mood === 'hopeful') {
      currentScale = hopefulScale;
    }

    // Play slower, more sparse notes for piano feel
    if (Math.random() < 0.35) {
      const note = currentScale[Math.floor(Math.random() * currentScale.length)];
      // Vary volume for dynamics
      const velocity = 0.1 + Math.random() * 0.05;
      setTimeout(() => playPianoNote(note, velocity), Math.random() * 100);
    }
  }, [mood, status, playPianoNote]);

  const startBgm = () => {
    stopBgm();
    if (settings.musicVolume <= 0) return;
    initAudio();
    // Slower interval for piano (600ms)
    bgmIntervalRef.current = window.setInterval(playBgmSequence, 600);
  };

  const stopBgm = () => {
    if (bgmIntervalRef.current) {
      clearInterval(bgmIntervalRef.current);
      bgmIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (settings.musicVolume > 0 && (status === GameStatus.PLAYING || status === GameStatus.VICTORY)) {
      startBgm();
    } else {
      stopBgm();
    }
    return () => stopBgm();
  }, [settings.musicVolume, status, mood]);

  const playSound = (type: 'jump' | 'die' | 'portal' | 'victory') => {
    if (settings.sfxVolume <= 0) return; 
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    const vol = settings.sfxVolume;

    if (type === 'jump') {
      osc.type = 'triangle'; 
      osc.frequency.setValueAtTime(300, now); // Lower pitch jump
      osc.frequency.linearRampToValueAtTime(450, now + 0.1);
      gain.gain.setValueAtTime(0.08 * vol, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'die') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.4);
      gain.gain.setValueAtTime(0.15 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'portal') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(880, now + 1);
      gain.gain.setValueAtTime(0.05 * vol, now);
      gain.gain.linearRampToValueAtTime(0, now + 1);
      osc.start(now);
      osc.stop(now + 1);
    } 
  };

  // --- Logic & Handlers ---

  const handleStartNew = () => {
    initAudio();
    setLevelId(1);
    setStatus(GameStatus.PLAYING);
    setMood('curious');
    deathCountRef.current = 0;
  };
  
  const handleResume = () => {
    initAudio();
    setLevelId(maxReachedLevel);
    setStatus(GameStatus.PLAYING);
    setMood('curious');
    deathCountRef.current = 0;
  };

  const handleGameOver = () => {
    setStatus(GameStatus.GAME_OVER);
    deathCountRef.current += 1;
    if (deathCountRef.current > 2) setMood('calm');
  };

  const handleRetry = () => {
    setStatus(GameStatus.PLAYING);
  };

  const handleGoHome = () => {
    setStatus(GameStatus.MENU);
  };

  const handleLevelComplete = async () => {
    const nextId = levelId + 1;
    if (nextId > maxReachedLevel) setMaxReachedLevel(nextId);
    
    deathCountRef.current = 0;
    setMood('curious');
    
    if (nextId > LEVELS.length) {
      setStatus(GameStatus.VICTORY);
    } else {
      setStatus(GameStatus.LEVEL_COMPLETE);
      setLoadingStory(true);
      const nextLevelName = LEVELS.find(l => l.id === nextId)?.name || "Unknown";
      const text = await generateLevelNarrative(nextLevelName, false);
      setNarrative(text);
      setLoadingStory(false);
    }
  };

  const handleNextLevel = () => {
    setLevelId(prev => prev + 1);
    setStatus(GameStatus.PLAYING);
  };

  const handleVictory = async () => {
    setStatus(GameStatus.VICTORY);
    setLoadingStory(true);
    const text = await generateLevelNarrative("Paradise", true);
    setNarrative(text);
    setLoadingStory(false);
  };

  const handleMoodUpdate = (distanceToGoal: number) => {
     if (status !== GameStatus.PLAYING) return;
     if (distanceToGoal < 400 && mood !== 'hopeful') {
        setMood('hopeful');
     } else if (distanceToGoal >= 400 && mood === 'hopeful') {
        setMood(deathCountRef.current > 2 ? 'calm' : 'curious');
     }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 font-sans text-white overflow-hidden relative selection:bg-cyan-500/30">
      
      {/* Header HUD */}
      <div className={`absolute top-4 left-0 right-0 flex justify-between px-8 pointer-events-none transition-opacity duration-1000 ${status === GameStatus.VICTORY ? 'opacity-0' : 'opacity-100'}`}>
        <div className="text-left">
           <h1 className="text-xl font-bold tracking-widest text-cyan-400" style={{ fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 10px cyan' }}>LUMINA</h1>
           <p className="text-[10px] text-gray-500 tracking-widest uppercase">Level {levelId}</p>
        </div>
      </div>

      {/* Controls (Top Right) */}
      <div className="absolute top-4 right-4 flex gap-2 z-50">
        <button onClick={() => setShowObjective(true)} className="p-2 bg-zinc-900/50 text-cyan-500 hover:text-cyan-300 hover:bg-zinc-800 rounded-full transition border border-zinc-700"><HelpCircle size={20} /></button>
        <button onClick={() => setShowSettings(true)} className="p-2 bg-zinc-900/50 text-cyan-500 hover:text-cyan-300 hover:bg-zinc-800 rounded-full transition border border-zinc-700"><Settings size={20} /></button>
      </div>

      {/* --- JOURNEY MODAL --- */}
      {showJourney && (
        <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in">
           <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-700 max-w-3xl w-full relative">
              <button onClick={() => setShowJourney(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>
              <h2 className="text-2xl font-bold text-cyan-400 mb-8 text-center tracking-widest uppercase">Your Journey</h2>
              
              <div className="flex justify-between items-center px-12 py-8 relative">
                <div className="absolute top-1/2 left-12 right-12 h-1 bg-zinc-800 -z-0"></div>
                {LEVELS.map((lvl, idx) => {
                   const isUnlocked = lvl.id <= maxReachedLevel;
                   const isCurrent = lvl.id === maxReachedLevel;
                   return (
                     <div key={lvl.id} className="relative z-10 flex flex-col items-center gap-4">
                        <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${isCurrent ? 'bg-cyan-900 border-cyan-400 scale-125 shadow-[0_0_20px_cyan]' : isUnlocked ? 'bg-zinc-800 border-cyan-700 text-cyan-500' : 'bg-black border-zinc-800 text-zinc-700'}`}>
                           {isUnlocked ? (isCurrent ? <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div> : <span>{lvl.id}</span>) : <span>?</span>}
                        </div>
                        <span className={`text-xs tracking-wider uppercase ${isUnlocked ? 'text-gray-300' : 'text-zinc-700'}`}>{lvl.name}</span>
                     </div>
                   )
                })}
                <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-2 border-zinc-800 bg-black flex items-center justify-center text-zinc-700">
                      <Heart size={14} />
                    </div>
                    <span className="text-xs text-zinc-700 uppercase">Union</span>
                </div>
              </div>

              <div className="mt-8 text-center">
                <button onClick={() => setShowJourney(false)} className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded">Close</button>
              </div>
           </div>
        </div>
      )}

      {/* --- HELP / OBJECTIVE / TUTORIAL MODAL --- */}
      {showObjective && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-sm">
           <div className="bg-zinc-900 p-8 rounded-2xl border border-cyan-900/50 max-w-lg w-full relative">
             <button onClick={() => setShowObjective(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>
             
             <div className="mb-8 text-center">
                <h2 className="text-2xl font-bold text-cyan-400 mb-2">Mission & Controls</h2>
             </div>

             <div className="grid grid-cols-2 gap-8 mb-8">
               {/* Narrative Side */}
               <div className="space-y-4 text-sm text-gray-300 border-r border-zinc-800 pr-4">
                 <h3 className="text-white font-bold uppercase tracking-wider text-xs mb-2">Objective</h3>
                 <p>You are a spark in the void. Navigate the dark realms.</p>
                 <p>Avoid the <span className="text-red-500">Spiky Monsters</span>.</p>
                 <p>Reach the <span className="text-indigo-400">Mystical Portal</span> to ascend.</p>
               </div>

               {/* Tutorial Side */}
               <div className="space-y-4">
                 <h3 className="text-white font-bold uppercase tracking-wider text-xs mb-2">Tutorial</h3>
                 {settings.controlScheme === 'keyboard' ? (
                   <div className="flex flex-col gap-4 items-center py-4">
                     <div className="flex gap-1">
                        <div className="w-8 h-8 border border-gray-500 rounded flex items-center justify-center text-xs text-gray-400 animate-bounce">W</div>
                     </div>
                     <div className="flex gap-1">
                        <div className="w-8 h-8 border border-gray-500 rounded flex items-center justify-center text-xs text-gray-400">A</div>
                        <div className="w-8 h-8 border border-gray-500 rounded flex items-center justify-center text-xs text-gray-400">S</div>
                        <div className="w-8 h-8 border border-gray-500 rounded flex items-center justify-center text-xs text-gray-400">D</div>
                     </div>
                     <p className="text-xs text-center text-gray-500">Use WASD or Arrow Keys to Move & Jump</p>
                   </div>
                 ) : (
                   <div className="flex flex-col gap-4 items-center py-4">
                      <div className="flex gap-8">
                         <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 flex items-center justify-center animate-pulse"><span className="text-[8px] text-cyan-500">MOVE</span></div>
                         <div className="w-10 h-10 rounded-full border-2 border-pink-500/30 flex items-center justify-center animate-bounce"><span className="text-[8px] text-pink-500">JUMP</span></div>
                      </div>
                      <p className="text-xs text-center text-gray-500">Use On-screen Buttons</p>
                   </div>
                 )}
               </div>
             </div>

             <div className="flex justify-center">
               <button onClick={() => setShowObjective(false)} className="px-6 py-2 bg-cyan-900 text-cyan-100 rounded hover:bg-cyan-800">Resume</button>
             </div>
           </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-md">
           <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-700 max-w-sm w-full shadow-2xl relative">
             <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>
             <h2 className="text-xl font-bold text-cyan-400 mb-8 text-center uppercase tracking-wider">Settings</h2>
             
             <div className="space-y-6">
               {/* Controls Toggle */}
               <div className="bg-zinc-800/50 p-1 rounded-lg flex mb-4">
                 <button 
                   onClick={() => setSettings(s => ({...s, controlScheme: 'keyboard'}))}
                   className={`flex-1 py-2 rounded text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition ${settings.controlScheme === 'keyboard' ? 'bg-cyan-900 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                 >
                   <Gamepad2 size={14} /> Keyboard
                 </button>
                 <button 
                   onClick={() => setSettings(s => ({...s, controlScheme: 'touch'}))}
                   className={`flex-1 py-2 rounded text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition ${settings.controlScheme === 'touch' ? 'bg-cyan-900 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                 >
                   <Smartphone size={14} /> Touch
                 </button>
               </div>

               {/* Music Slider */}
               <div className="space-y-2">
                 <div className="flex justify-between text-sm text-gray-400">
                   <div className="flex items-center gap-2"><Music size={16}/> Music</div>
                   <span>{Math.round(settings.musicVolume * 100)}%</span>
                 </div>
                 <input type="range" min="0" max="1" step="0.05" value={settings.musicVolume} onChange={(e) => setSettings(s => ({...s, musicVolume: parseFloat(e.target.value)}))} className="w-full accent-cyan-500 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
               </div>

               {/* SFX Slider */}
               <div className="space-y-2">
                 <div className="flex justify-between text-sm text-gray-400">
                    <div className="flex items-center gap-2">{settings.sfxVolume > 0 ? <Volume2 size={16}/> : <VolumeX size={16}/>} SFX</div>
                   <span>{Math.round(settings.sfxVolume * 100)}%</span>
                 </div>
                 <input type="range" min="0" max="1" step="0.05" value={settings.sfxVolume} onChange={(e) => setSettings(s => ({...s, sfxVolume: parseFloat(e.target.value)}))} className="w-full accent-green-500 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
               </div>

               {/* Haptics Toggle */}
               <label className="flex items-center justify-between p-2 cursor-pointer group">
                 <span className="text-gray-400 group-hover:text-white transition">Haptic Feedback</span>
                 <div onClick={() => setSettings(s => ({ ...s, haptics: !s.haptics }))} className={`w-12 h-6 rounded-full relative transition duration-300 ${settings.haptics ? 'bg-pink-600' : 'bg-zinc-700'}`}>
                   <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${settings.haptics ? 'left-7' : 'left-1'}`}></div>
                 </div>
               </label>
             </div>
           </div>
        </div>
      )}

      {/* Game Container */}
      <div className="relative w-full max-w-[800px] aspect-[4/3] shadow-2xl rounded-lg overflow-hidden ring-1 ring-zinc-800 bg-black">
        <GameCanvas 
          status={status} 
          currentLevelId={levelId}
          settings={settings}
          onGameOver={handleGameOver}
          onLevelComplete={handleLevelComplete}
          onGameWon={handleVictory}
          onPlaySound={playSound}
          onUpdateMood={handleMoodUpdate}
        />

        {/* Menu */}
        {status === GameStatus.MENU && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-black to-black"></div>
            
            <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-700">
              <div className="mb-8 relative">
                 <div className="absolute -inset-4 bg-cyan-500/20 rounded-full blur-xl animate-pulse"></div>
                 <div className="w-20 h-20 rounded-full bg-cyan-400 shadow-[0_0_50px_#00ffff] animate-bounce"></div>
              </div>
              
              <h1 className="text-6xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-b from-white to-cyan-400 tracking-tighter" style={{ fontFamily: 'Cinzel, serif' }}>
                LUMINA
              </h1>
              <div className="h-px w-32 bg-cyan-800 mb-8"></div>

              <div className="flex flex-col gap-4 w-64">
                {maxReachedLevel > 1 && (
                  <button onClick={handleResume} className="group relative px-4 py-3 bg-zinc-900 border border-zinc-700 hover:border-cyan-500 hover:text-cyan-400 text-gray-300 transition uppercase tracking-widest text-xs">
                    Resume Journey
                  </button>
                )}
                
                <button onClick={handleStartNew} className="group relative px-4 py-3 bg-zinc-900 border border-zinc-700 hover:border-cyan-500 hover:text-cyan-400 text-gray-300 transition uppercase tracking-widest text-xs">
                  New Game
                </button>
                
                <button onClick={() => setShowJourney(true)} className="group relative px-4 py-3 bg-zinc-900 border border-zinc-700 hover:border-purple-500 hover:text-purple-400 text-gray-300 transition uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                  <Map size={14} /> Journey
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game Over */}
        {status === GameStatus.GAME_OVER && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm z-10">
            <h2 className="text-5xl font-bold text-red-600 mb-2 font-serif tracking-widest opacity-80">FADED</h2>
            <p className="text-red-900/50 text-sm tracking-[0.5em] uppercase mb-8">The light dims...</p>
            <div className="flex gap-4">
              <button onClick={handleRetry} className="px-8 py-3 bg-red-950 text-red-200 border border-red-900 hover:bg-red-900 hover:border-red-500 transition-all rounded flex items-center gap-2">
                <RotateCcw size={16} /> REIGNITE
              </button>
              <button onClick={handleGoHome} className="px-4 py-3 bg-zinc-900 text-gray-400 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-all rounded flex items-center gap-2">
                <Home size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Level Complete & Victory Screens */}
        {status === GameStatus.LEVEL_COMPLETE && (
          <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center z-10">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 to-black"></div>
             <div className="relative z-10 text-center max-w-md px-6">
               <div className="w-12 h-12 mx-auto mb-6 border-2 border-indigo-500 rotate-45 flex items-center justify-center">
                 <div className="w-8 h-8 bg-indigo-500/50"></div>
               </div>
               <h2 className="text-2xl text-indigo-300 mb-8 tracking-[0.2em] font-light">TRANSITION COMPLETE</h2>
               <div className="min-h-[100px] flex items-center justify-center mb-8 relative">
                 {loadingStory ? <span className="animate-pulse text-gray-500">Consulting the stars...</span> : <p className="text-lg font-serif italic text-gray-400 leading-relaxed">"{narrative}"</p>}
               </div>
               <button onClick={handleNextLevel} disabled={loadingStory} className="px-10 py-3 bg-indigo-900/50 text-indigo-200 border border-indigo-800 hover:bg-indigo-800 transition-all uppercase tracking-wider text-sm disabled:opacity-50">
                 Enter Level {levelId + 1}
               </button>
            </div>
          </div>
        )}
        
        {status === GameStatus.VICTORY && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
             {/* Background gradient handled by canvas, this is just overlay UI */}
             <div className="relative z-20 text-center p-8 animate-in fade-in duration-2000 delay-1000">
                <Heart className="w-12 h-12 text-pink-600 mx-auto mb-6 animate-pulse" fill="currentColor" />
                <h1 className="text-4xl font-bold text-zinc-800 mb-6 tracking-[0.2em]" style={{ fontFamily: 'Cinzel, serif' }}>UNION</h1>
                <div className="min-h-[60px] mb-10">
                  {!loadingStory && <p className="text-xl text-zinc-700 font-serif italic max-w-md mx-auto leading-relaxed">"{narrative}"</p>}
                </div>
                <button onClick={() => { setLevelId(1); setStatus(GameStatus.MENU); }} className="px-8 py-3 bg-white/80 hover:bg-white text-zinc-900 border border-zinc-300 rounded-sm shadow-lg transition backdrop-blur-md uppercase tracking-widest text-xs">
                  Return to Void
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
