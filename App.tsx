import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameStatus, GameSettings, ControlScheme } from './types';
import { LEVELS, WISDOM_QUOTES } from './constants';
import { generateLevelNarrative } from './services/geminiService';
import { Play, RotateCcw, Heart, Settings, X, Volume2, VolumeX, Music, HelpCircle, Map, Gamepad2, Smartphone, Home, ChevronLeft, ChevronRight, Anchor, Pause, BookOpen, User, ExternalLink, Coffee } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.MENU);
  const [levelId, setLevelId] = useState(1);
  const [narrative, setNarrative] = useState<string>("");
  const [loadingStory, setLoadingStory] = useState(false);
  
  const [maxReachedLevel, setMaxReachedLevel] = useState(1);

  const [showSettings, setShowSettings] = useState(false);
  const [showObjective, setShowObjective] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [showJourney, setShowJourney] = useState(false);
  const [showCredits, setShowCredits] = useState(false);

  const [settings, setSettings] = useState<GameSettings>({
    musicVolume: 0.4,
    sfxVolume: 0.5,
    haptics: true,
    controlScheme: 'keyboard'
  });

  const [health, setHealth] = useState(1.0);
  const [wisdomToast, setWisdomToast] = useState<string | null>(null);
  const [checkpointToast, setCheckpointToast] = useState(false);
  
  const [resetKey, setResetKey] = useState(0);
  const [isChaosMode, setIsChaosMode] = useState(false);

  const journeyScrollRef = useRef<HTMLDivElement>(null);

  const [mood, setMood] = useState<'curious' | 'calm' | 'hopeful' | 'tense'>('curious');
  const deathCountRef = useRef(0);
  const wisdomThreshold = useRef(Math.floor(Math.random() * 5) + 6); 

  useEffect(() => {
    // Restore Persistence
    const savedMax = localStorage.getItem('lumina_max_level');
    if (savedMax) setMaxReachedLevel(parseInt(savedMax, 10));
    
    const savedSettings = localStorage.getItem('lumina_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, []);

  useEffect(() => {
    localStorage.setItem('lumina_max_level', maxReachedLevel.toString());
  }, [maxReachedLevel]);

  useEffect(() => {
    localStorage.setItem('lumina_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (wisdomToast) {
      const t = setTimeout(() => setWisdomToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [wisdomToast]);

  useEffect(() => {
    if (checkpointToast) {
      const t = setTimeout(() => setCheckpointToast(false), 3000);
      return () => clearTimeout(t);
    }
  }, [checkpointToast]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const bgmIntervalRef = useRef<number | null>(null);
  const seqStepRef = useRef<number>(0);
  
  const HARP_SCALES = useRef({
    curious: [196.00, 220.00, 261.63, 293.66, 349.23, 392.00], 
    tense: [164.81, 185.00, 233.08, 261.63], 
    calm: [130.81, 164.81, 196.00, 261.63], 
    hopeful: [349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25, 698.46] 
  }).current;

  const initAudio = () => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;

      const delay = ctx.createDelay();
      delay.delayTime.value = 0.4; 
      
      const feedback = ctx.createGain();
      feedback.gain.value = 0.5; 

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200; 

      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.8;

      delay.connect(filter);
      filter.connect(feedback);
      feedback.connect(delay);
      delay.connect(masterGain);
      masterGain.connect(ctx.destination);
      
      delayNodeRef.current = delay;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playHarpNote = useCallback((freq: number, volume: number = 1.0, duration: number = 3.0) => {
    if (!audioCtxRef.current || settings.musicVolume <= 0) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    const dest = delayNodeRef.current || ctx.destination;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(volume * settings.musicVolume * 0.5, now + 0.02); 
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    masterGain.connect(dest);
    masterGain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = freq;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 1.005; 
    
    osc1.connect(masterGain);
    osc2.connect(masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  }, [settings.musicVolume]);

  const playChaosSound = useCallback(() => {
    if (!audioCtxRef.current || settings.musicVolume <= 0) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    
    // Create dissonant loop
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100 + Math.random() * 500, now);
    osc.frequency.linearRampToValueAtTime(100 + Math.random() * 500, now + 0.15);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1 * settings.musicVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }, [settings.musicVolume]);

  const playBgmStep = useCallback(() => {
    if (status !== GameStatus.PLAYING && status !== GameStatus.VICTORY && status !== GameStatus.GAME_OVER) return;
    
    if (isChaosMode) {
        playChaosSound();
        return;
    }

    seqStepRef.current = (seqStepRef.current + 1) % 32;
    const step = seqStepRef.current;

    if (status === GameStatus.VICTORY) {
       const scale = HARP_SCALES.hopeful;
       const noteIdx = [0, 2, 4, 7, 8, 7, 4, 2]; 
       
       if (step % 2 === 0) {
          const idx = (step / 2) % noteIdx.length;
          const note = scale[noteIdx[idx] % scale.length] * (noteIdx[idx] >= scale.length ? 2 : 1);
          playHarpNote(note, 0.25, 3.0);
       }
       if (step % 16 === 0) playHarpNote(scale[0]/2, 0.3, 6.0);
       if (step % 8 === 0) playHarpNote(scale[0]*2, 0.1, 4.0);
       return;
    }

    if (mood === 'tense') {
       const scale = HARP_SCALES.tense;
       if (step % 4 === 0) {
          const note = scale[Math.floor(Math.random() * scale.length)];
          playHarpNote(note, 0.25, 1.0);
       }
       if (step % 16 === 0) playHarpNote(scale[0] / 2, 0.3, 2.0); 
    }
    else if (mood === 'curious') {
       if (Math.random() < 0.15 && step % 2 === 0) {
          const scale = HARP_SCALES.curious;
          const note = scale[Math.floor(Math.random() * scale.length)];
          const octave = Math.random() > 0.7 ? 2 : 1;
          playHarpNote(note * octave, 0.3, 3.0);
       }
    } 
    else if (mood === 'calm') {
       if (step % 16 === 0) {
          const scale = HARP_SCALES.calm;
          playHarpNote(scale[0], 0.3, 5.0);
          setTimeout(() => playHarpNote(scale[2], 0.2, 5.0), 200); 
       }
    }
    else if (mood === 'hopeful') {
       const scale = HARP_SCALES.hopeful;
       if (step % 4 === 0) {
          const idx = (step / 4) % scale.length;
          playHarpNote(scale[idx], 0.25, 2.5);
       }
       if (step % 16 === 0) playHarpNote(scale[0]/2, 0.25, 4.0);
    }
  }, [mood, status, playHarpNote, HARP_SCALES, isChaosMode, playChaosSound]);

  const startBgm = () => {
    stopBgm();
    if (settings.musicVolume <= 0) return;
    initAudio();
    bgmIntervalRef.current = window.setInterval(playBgmStep, isChaosMode ? 100 : 150); // Faster during chaos
  };

  const stopBgm = () => {
    if (bgmIntervalRef.current) {
      clearInterval(bgmIntervalRef.current);
      bgmIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (settings.musicVolume > 0 && (status === GameStatus.PLAYING || status === GameStatus.VICTORY || status === GameStatus.GAME_OVER)) {
      startBgm();
    } else {
      stopBgm();
    }
    return () => stopBgm();
  }, [settings.musicVolume, status, mood, isChaosMode]);

  const playSound = (type: 'jump' | 'die' | 'portal' | 'victory' | 'checkpoint' | 'pill' | 'respawn' | 'sad' | 'hopeful_pill' | 'panic') => {
    if (settings.sfxVolume <= 0) return; 
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = settings.sfxVolume;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'jump') {
      osc.type = 'triangle'; 
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(500, now + 0.1);
      gain.gain.setValueAtTime(0.1 * vol, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'die') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
      gain.gain.setValueAtTime(0.2 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now); osc.stop(now + 0.5);
    } else if (type === 'portal') {
      const pOsc = ctx.createOscillator();
      pOsc.type = 'sine';
      pOsc.frequency.setValueAtTime(880, now);
      pOsc.frequency.exponentialRampToValueAtTime(1760, now + 0.5);
      const pGain = ctx.createGain();
      pGain.gain.setValueAtTime(0.1 * vol, now);
      pGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      pOsc.connect(pGain);
      pGain.connect(ctx.destination);
      pOsc.start(now); pOsc.stop(now + 1.0);
    } else if (type === 'checkpoint') {
       osc.type = 'sine';
       osc.frequency.setValueAtTime(800, now);
       osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
       osc.frequency.exponentialRampToValueAtTime(2000, now + 2.0); 
       gain.gain.setValueAtTime(0, now);
       gain.gain.linearRampToValueAtTime(0.2 * vol, now + 0.05); 
       gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5); 
       osc.start(now); osc.stop(now + 2.5);
    } else if (type === 'pill') {
       const baseFreq = 600;
       [0, 1, 2, 3].forEach((i) => {
           const tOsc = ctx.createOscillator();
           const tGain = ctx.createGain();
           tOsc.type = 'triangle';
           tOsc.frequency.value = baseFreq + (i * 200);
           tGain.gain.setValueAtTime(0.05 * vol, now + (i * 0.05));
           tGain.gain.linearRampToValueAtTime(0, now + (i * 0.05) + 0.3);
           tOsc.connect(tGain);
           tGain.connect(ctx.destination);
           tOsc.start(now + (i * 0.05));
           tOsc.stop(now + (i * 0.05) + 0.3);
       });
    } else if (type === 'respawn') {
       const notes = [220, 330, 440]; 
       notes.forEach((freq, i) => {
          const rOsc = ctx.createOscillator();
          const rGain = ctx.createGain();
          rOsc.type = 'sine';
          rOsc.frequency.setValueAtTime(freq, now);
          rOsc.frequency.linearRampToValueAtTime(freq * 1.5, now + 1.0); 
          rGain.gain.setValueAtTime(0, now);
          rGain.gain.linearRampToValueAtTime(0.1 * vol, now + 0.5);
          rGain.gain.linearRampToValueAtTime(0, now + 1.5);
          rOsc.connect(rGain);
          rGain.connect(ctx.destination);
          rOsc.start(now); rOsc.stop(now + 1.5);
       });
    } else if (type === 'sad') {
        // Extended Sad Sound
        const notes = [196.00, 233.08, 293.66, 174.61]; // G Minor with F
        notes.forEach((freq, i) => {
           const sOsc = ctx.createOscillator();
           const sGain = ctx.createGain();
           sOsc.type = 'sine';
           sOsc.frequency.value = freq;
           sGain.gain.setValueAtTime(0, now + i*0.5);
           sGain.gain.linearRampToValueAtTime(0.15 * vol, now + 1.0 + i*0.5);
           sGain.gain.exponentialRampToValueAtTime(0.001, now + 6.0 + i*0.5);
           sOsc.connect(sGain);
           sGain.connect(ctx.destination);
           sOsc.start(now + i*0.5); sOsc.stop(now + 6.0 + i*0.5);
        });
    } else if (type === 'hopeful_pill') {
        const notes = [261.63, 329.63, 392.00, 523.25]; // C Major
        notes.forEach((freq, i) => {
           const hOsc = ctx.createOscillator();
           const hGain = ctx.createGain();
           hOsc.type = 'triangle';
           hOsc.frequency.value = freq;
           hGain.gain.setValueAtTime(0, now + (i * 0.1));
           hGain.gain.linearRampToValueAtTime(0.1 * vol, now + (i * 0.1) + 0.1);
           hGain.gain.exponentialRampToValueAtTime(0.001, now + (i * 0.1) + 2.0);
           hOsc.connect(hGain);
           hGain.connect(ctx.destination);
           hOsc.start(now + (i * 0.1));
           hOsc.stop(now + (i * 0.1) + 2.0);
        });
    } else if (type === 'panic') {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.linearRampToValueAtTime(200, now + 0.5);
        gain.gain.setValueAtTime(0.3 * vol, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
    }
  };

  const handleStartNew = () => {
    initAudio();
    setLevelId(1);
    setStatus(GameStatus.PLAYING);
    setMood('curious');
    deathCountRef.current = 0;
    setHealth(1.0);
    setResetKey(0);
    setIsChaosMode(false);
  };
  
  const handleResume = () => {
    if (status === GameStatus.PAUSED) {
      setStatus(GameStatus.PLAYING);
      return;
    }
    initAudio();
    setLevelId(maxReachedLevel);
    setStatus(GameStatus.PLAYING);
    setMood('curious');
    deathCountRef.current = 0;
    setHealth(1.0);
    setResetKey(0);
    setIsChaosMode(false);
  };

  const handlePause = () => {
    if (status === GameStatus.PLAYING) setStatus(GameStatus.PAUSED);
  };

  const handleRestartLevel = () => {
    setResetKey(prev => prev + 1);
    setStatus(GameStatus.PLAYING);
    setHealth(1.0);
    setMood('curious');
    deathCountRef.current = 0;
    setIsChaosMode(false);
  };

  const handleGameOver = () => {
    setStatus(GameStatus.GAME_OVER);
    setIsChaosMode(false);
    deathCountRef.current += 1;
    
    if (deathCountRef.current >= wisdomThreshold.current) {
        const quote = WISDOM_QUOTES[Math.floor(Math.random() * WISDOM_QUOTES.length)];
        setWisdomToast(quote);
        playSound('pill'); 
        wisdomThreshold.current += Math.floor(Math.random() * 5) + 6;
    }

    if (deathCountRef.current > 2) setMood('calm');
  };

  const handleRetry = () => {
    setStatus(GameStatus.PLAYING);
    setHealth(1.0);
    setIsChaosMode(false);
  };

  const handleGoHome = () => {
    setStatus(GameStatus.MENU);
    setIsChaosMode(false);
  };

  const handleLevelComplete = async () => {
    const nextId = levelId + 1;
    if (nextId > maxReachedLevel) setMaxReachedLevel(nextId);
    deathCountRef.current = 0;
    setMood('curious');
    setIsChaosMode(false);
    
    setHealth(h => Math.max(1.0, h));
    
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
    setResetKey(0);
  };

  const handleVictory = async () => {
    setStatus(GameStatus.VICTORY);
    setIsChaosMode(false);
    setLoadingStory(true);
    const text = await generateLevelNarrative("Paradise", true);
    setNarrative(text);
    setLoadingStory(false);
  };

  const handleMoodUpdate = (distanceToGoal: number, distanceToMonster: number) => {
     if (status !== GameStatus.PLAYING) return;
     
     if (distanceToMonster < 200) {
        if (mood !== 'tense') setMood('tense');
     } else if (distanceToGoal < 1000) { 
        if (mood !== 'hopeful') setMood('hopeful');
     } else {
        if (mood === 'tense' || mood === 'hopeful') {
           setMood(deathCountRef.current > 2 ? 'calm' : 'curious');
        }
     }
  };

  const scrollJourney = (direction: 'left' | 'right') => {
    if (journeyScrollRef.current) {
      const scrollAmount = 200;
      journeyScrollRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  const renderHearts = () => {
    const heartCount = Math.ceil(health);
    const displayCount = Math.max(1, heartCount);
    const hearts = [];
    for (let i = 0; i < displayCount; i++) {
       let fill = 0;
       if (health >= i + 1) fill = 1;
       else if (health > i) fill = 0.5;
       hearts.push(
         <div key={i} className="relative w-5 h-5">
           <Heart size={20} className="text-gray-800 absolute inset-0" />
           {fill > 0 && (
             <div className="absolute inset-0 overflow-hidden" style={{ width: fill === 0.5 ? '50%' : '100%' }}>
                <Heart size={20} className="text-red-500 fill-red-500 min-w-[20px]" />
             </div>
           )}
         </div>
       );
    }
    return hearts;
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 font-sans text-white overflow-hidden relative selection:bg-cyan-500/30">
      <div className={`absolute top-4 left-0 right-0 flex justify-between px-8 pointer-events-none transition-opacity duration-1000 ${status === GameStatus.VICTORY ? 'opacity-0' : 'opacity-100'} z-40`}>
        <div className="text-left flex flex-col gap-2">
           <div>
             <h1 className="text-xl font-bold tracking-widest text-cyan-400" style={{ fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 10px cyan' }}>LUMINA</h1>
             <p className="text-[10px] text-gray-500 tracking-widest uppercase">Level {levelId}</p>
           </div>
           {status === GameStatus.PLAYING && (
             <div className="flex gap-1 animate-in slide-in-from-left-4 duration-500">{renderHearts()}</div>
           )}
        </div>
      </div>

      <div className="absolute top-4 right-4 flex gap-2 z-50">
        {status === GameStatus.PLAYING && (
          <button onClick={handlePause} className="p-2 bg-zinc-900/50 text-cyan-500 hover:text-cyan-300 hover:bg-zinc-800 rounded-full transition border border-zinc-700">
             <Pause size={20} />
          </button>
        )}
        <button onClick={() => setShowStory(true)} className="p-2 bg-zinc-900/50 text-cyan-500 hover:text-cyan-300 hover:bg-zinc-800 rounded-full transition border border-zinc-700"><BookOpen size={20} /></button>
        <button onClick={() => setShowObjective(true)} className="p-2 bg-zinc-900/50 text-cyan-500 hover:text-cyan-300 hover:bg-zinc-800 rounded-full transition border border-zinc-700"><HelpCircle size={20} /></button>
        <button onClick={() => setShowSettings(true)} className="p-2 bg-zinc-900/50 text-cyan-500 hover:text-cyan-300 hover:bg-zinc-800 rounded-full transition border border-zinc-700"><Settings size={20} /></button>
      </div>

      {wisdomToast && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-500">
           <div className="bg-cyan-950/90 border border-cyan-500/50 px-6 py-3 rounded-full shadow-[0_0_30px_rgba(0,255,255,0.2)] flex items-center gap-3">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse shadow-[0_0_10px_yellow]"></div>
              <span className="text-cyan-100 text-sm font-serif italic">"{wisdomToast}"</span>
           </div>
        </div>
      )}
      {checkpointToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in zoom-in duration-300">
           <div className="bg-emerald-900/80 border border-emerald-500/30 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 backdrop-blur-md">
              <Anchor size={16} className="text-emerald-400" />
              <span className="text-emerald-200 text-xs font-bold tracking-wider uppercase">Light Anchored</span>
           </div>
        </div>
      )}
      
      {showJourney && (
        <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in">
           <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-700 max-w-4xl w-full relative mx-4">
              <button onClick={() => setShowJourney(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>
              <h2 className="text-2xl font-bold text-cyan-400 mb-8 text-center tracking-widest uppercase">Your Journey</h2>
              <div className="flex items-center gap-4">
                <button onClick={() => scrollJourney('left')} className="p-2 hover:bg-zinc-800 rounded-full text-gray-400 hover:text-white transition"><ChevronLeft size={32} /></button>
                <div ref={journeyScrollRef} className="flex-1 overflow-x-auto scrollbar-hide snap-x snap-mandatory" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <div className="flex items-center px-8 py-12 relative min-w-max">
                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-zinc-800 -z-0 translate-y-[-50%]"></div>
                    {LEVELS.map((lvl) => {
                      const isUnlocked = lvl.id <= maxReachedLevel;
                      const isCurrent = lvl.id === maxReachedLevel;
                      const isLast = lvl.id === LEVELS.length;
                      return (
                        <div key={lvl.id} className="relative z-10 flex flex-col items-center gap-4 snap-center mx-6 min-w-[100px]">
                            <div 
                              onClick={() => { if (isUnlocked) { setLevelId(lvl.id); setShowJourney(false); setStatus(GameStatus.PLAYING); setResetKey(0); }}}
                              className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-300 cursor-pointer ${isCurrent ? 'bg-cyan-900 border-cyan-400 scale-125 shadow-[0_0_20px_cyan]' : isUnlocked ? 'bg-zinc-800 border-cyan-700 text-cyan-500 hover:bg-zinc-700' : 'bg-black border-zinc-800 text-zinc-800 cursor-not-allowed'}`}>
                              {isUnlocked ? (isCurrent ? <div className="w-4 h-4 bg-cyan-400 rounded-full animate-pulse"></div> : (isLast ? <Heart size={20} /> : <span className="text-lg font-bold">{lvl.id}</span>)) : <span className="opacity-30">?</span>}
                            </div>
                            <span className={`text-xs tracking-wider uppercase text-center font-bold ${isUnlocked ? 'text-cyan-200' : 'text-zinc-800'}`}>{isUnlocked ? lvl.name : '???'}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <button onClick={() => scrollJourney('right')} className="p-2 hover:bg-zinc-800 rounded-full text-gray-400 hover:text-white transition"><ChevronRight size={32} /></button>
              </div>
           </div>
        </div>
      )}

      {showObjective && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-sm">
           <div className="bg-zinc-900 p-8 rounded-2xl border border-cyan-900/50 max-w-lg w-full relative">
             <button onClick={() => setShowObjective(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>
             <div className="mb-8 text-center"><h2 className="text-2xl font-bold text-cyan-400 mb-2">Guide</h2></div>
             <div className="grid grid-cols-2 gap-8 mb-8">
               <div className="space-y-4 text-sm text-gray-300 border-r border-zinc-800 pr-4">
                 <h3 className="text-white font-bold uppercase tracking-wider text-xs mb-2">Mechanics</h3>
                 <p className="flex items-center gap-2"><div className="w-3 h-3 bg-cyan-400 rounded-full"></div> You are the Light.</p>
                 <p className="flex items-center gap-2"><Heart size={12} className="text-red-500 fill-red-500"/> Hazards = Death.</p>
                 <p className="flex items-center gap-2"><div className="w-3 h-3 bg-green-400"></div> Checkpoints save progress.</p>
                 <p className="flex items-center gap-2"><div className="w-3 h-3 bg-yellow-400 rounded-full shadow-[0_0_5px_yellow]"></div> Wisdom Pills restore health.</p>
               </div>
               <div className="space-y-4">
                 <h3 className="text-white font-bold uppercase tracking-wider text-xs mb-2">Controls</h3>
                 {settings.controlScheme === 'keyboard' ? <div className="flex flex-col gap-4 items-center py-4"><p className="text-xs text-center text-gray-500">WASD / Arrows to Move & Jump</p></div> : <p className="text-xs text-center text-gray-500">Use On-screen Buttons</p>}
               </div>
             </div>
             <div className="flex justify-center"><button onClick={() => setShowObjective(false)} className="px-6 py-2 bg-cyan-900 text-cyan-100 rounded hover:bg-cyan-800">Resume</button></div>
           </div>
        </div>
      )}
      
      {showStory && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-sm">
           <div className="bg-zinc-900 p-8 rounded-2xl border border-cyan-900/50 max-w-xl w-full relative max-h-[80vh] overflow-y-auto">
             <button onClick={() => setShowStory(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>
             <div className="mb-8 text-center"><h2 className="text-2xl font-bold text-cyan-400 mb-2 font-serif tracking-widest">THE LEGEND OF LUMINA</h2></div>
             <div className="space-y-6 text-sm text-gray-300 font-serif leading-relaxed px-4">
               <p>
                 In the beginning, there was only the Void—a vast, silent expanse of eternal night. Within this darkness, two twin stars were born: <strong>Lumina</strong>, the blue spark of Resolve, and <strong>Aura</strong>, the pink essence of Hope.
               </p>
               <p>
                 Together, they danced through the cosmos, creating nebulae and painting the universe with color. But the Void grew jealous of their brilliance. A great cosmic storm, the "Silent Storm," tore them apart, casting Aura into the deepest, furthest reaches of existence where light had never touched.
               </p>
               <p>
                 Alone and fading, Lumina refused to let his light die. He sensed Aura's faint pulse calling from beyond the shadows. He knew the journey would be perilous—filled with monsters born of fear, illusions of despair, and the crushing weight of solitude.
               </p>
               <p>
                 Your objective is simple yet profound: <strong>Reunite with Aura.</strong>
               </p>
               <p className="italic text-cyan-100 border-l-2 border-cyan-500 pl-4">
                 "Travel through the treacherous realms, gather wisdom to keep your spirit bright, and overcome the darkness. For only when Resolve meets Hope can the universe bloom once more."
               </p>
             </div>
             <div className="mt-8 flex justify-center"><button onClick={() => setShowStory(false)} className="px-8 py-2 bg-cyan-900 text-cyan-100 rounded hover:bg-cyan-800 tracking-widest uppercase text-xs">Begin Journey</button></div>
           </div>
        </div>
      )}

      {showSettings && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-md">
           <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-700 max-w-sm w-full shadow-2xl relative">
             <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>
             <h2 className="text-xl font-bold text-cyan-400 mb-8 text-center uppercase tracking-wider">Settings</h2>
             <div className="space-y-6">
               <div className="bg-zinc-800/50 p-1 rounded-lg flex mb-4">
                 <button onClick={() => setSettings(s => ({...s, controlScheme: 'keyboard'}))} className={`flex-1 py-2 rounded text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition ${settings.controlScheme === 'keyboard' ? 'bg-cyan-900 text-white' : 'text-gray-500 hover:text-gray-300'}`}><Gamepad2 size={14} /> Keyboard</button>
                 <button onClick={() => setSettings(s => ({...s, controlScheme: 'touch'}))} className={`flex-1 py-2 rounded text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition ${settings.controlScheme === 'touch' ? 'bg-cyan-900 text-white' : 'text-gray-500 hover:text-gray-300'}`}><Smartphone size={14} /> Touch</button>
               </div>
               <div className="space-y-2">
                 <div className="flex justify-between text-sm text-gray-400"><div className="flex items-center gap-2"><Music size={16}/> Music</div><span>{Math.round(settings.musicVolume * 100)}%</span></div>
                 <input type="range" min="0" max="1" step="0.05" value={settings.musicVolume} onChange={(e) => setSettings(s => ({...s, musicVolume: parseFloat(e.target.value)}))} className="w-full accent-cyan-500 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
               </div>
               <div className="space-y-2">
                 <div className="flex justify-between text-sm text-gray-400"><div className="flex items-center gap-2">{settings.sfxVolume > 0 ? <Volume2 size={16}/> : <VolumeX size={16}/>} SFX</div><span>{Math.round(settings.sfxVolume * 100)}%</span></div>
                 <input type="range" min="0" max="1" step="0.05" value={settings.sfxVolume} onChange={(e) => setSettings(s => ({...s, sfxVolume: parseFloat(e.target.value)}))} className="w-full accent-green-500 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"/>
               </div>
               <label className="flex items-center justify-between p-2 cursor-pointer group">
                 <span className="text-gray-400 group-hover:text-white transition">Haptics</span>
                 <div onClick={() => setSettings(s => ({ ...s, haptics: !s.haptics }))} className={`w-12 h-6 rounded-full relative transition duration-300 ${settings.haptics ? 'bg-pink-600' : 'bg-zinc-700'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${settings.haptics ? 'left-7' : 'left-1'}`}></div></div>
               </label>
             </div>
           </div>
        </div>
      )}
      
      {showCredits && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-md">
           <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-700 max-w-sm w-full shadow-2xl relative text-center">
             <button onClick={() => setShowCredits(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>
             <h2 className="text-xl font-bold text-cyan-400 mb-2 uppercase tracking-wider">Developer</h2>
             <div className="w-16 h-1 bg-cyan-500 mx-auto mb-8 rounded"></div>
             
             <div className="mb-8">
               <div className="w-20 h-20 bg-zinc-800 rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-cyan-500/50">
                 <User size={40} className="text-cyan-500" />
               </div>
               <h3 className="text-xl font-bold text-white mb-1">Koushan De</h3>
               <p className="text-gray-500 text-sm">Creator & Developer</p>
             </div>

             <div className="space-y-4">
               <a href="https://www.linkedin.com/in/koushan-de-04a966192/" target="_blank" rel="noopener noreferrer" 
                  className="block w-full py-3 bg-[#0077b5] hover:bg-[#006396] text-white rounded transition flex items-center justify-center gap-2 text-sm font-bold tracking-wide">
                  <ExternalLink size={16} /> Connect on LinkedIn
               </a>
               <a href="https://www.linkedin.com/in/koushan-de-04a966192/" target="_blank" rel="noopener noreferrer"
                  className="block w-full py-3 bg-zinc-800 border border-zinc-600 hover:bg-zinc-700 text-white rounded transition flex items-center justify-center gap-2 text-sm font-bold tracking-wide">
                  <Coffee size={16} className="text-yellow-500" /> Support Developer
               </a>
             </div>
           </div>
        </div>
      )}

      {status === GameStatus.PAUSED && (
         <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-in fade-in duration-200">
            <h2 className="text-4xl font-bold text-cyan-400 mb-8 tracking-[0.2em] font-serif" style={{ textShadow: '0 0 20px cyan' }}>PAUSED</h2>
            <div className="flex flex-col gap-4 w-64">
               <button onClick={handleResume} className="px-6 py-3 bg-zinc-900 border border-zinc-700 hover:border-cyan-500 hover:text-cyan-400 text-gray-300 transition uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                 <Play size={14} /> Resume
               </button>
               <button onClick={handleRestartLevel} className="px-6 py-3 bg-zinc-900 border border-zinc-700 hover:border-red-500 hover:text-red-400 text-gray-300 transition uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                 <RotateCcw size={14} /> Restart Level
               </button>
               <button onClick={handleGoHome} className="px-6 py-3 bg-zinc-900 border border-zinc-700 hover:border-gray-500 hover:text-white text-gray-300 transition uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                 <Home size={14} /> Menu
               </button>
            </div>
         </div>
      )}

      <div className="relative w-full max-w-[800px] aspect-[4/3] shadow-2xl rounded-lg overflow-hidden ring-1 ring-zinc-800 bg-black">
        <GameCanvas 
          key={`${levelId}-${resetKey}`} 
          status={status} 
          currentLevelId={levelId}
          settings={settings}
          initialHealth={health}
          onGameOver={handleGameOver}
          onLevelComplete={handleLevelComplete}
          onGameWon={handleVictory}
          onPlaySound={playSound}
          onUpdateMood={handleMoodUpdate}
          onHealthChange={setHealth}
          onShowWisdom={(msg) => setWisdomToast(msg)}
          onCheckpointSave={() => setCheckpointToast(true)}
          onChaosStart={(active) => setIsChaosMode(active)}
        />

        {status === GameStatus.MENU && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-black to-black"></div>
            <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-700">
              <div className="mb-8 relative">
                 <div className="absolute -inset-4 bg-cyan-500/20 rounded-full blur-xl animate-pulse"></div>
                 <div className="w-20 h-20 rounded-full bg-cyan-400 shadow-[0_0_50px_#00ffff] animate-bounce"></div>
              </div>
              <h1 className="text-6xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-b from-white to-cyan-400 tracking-tighter" style={{ fontFamily: 'Cinzel, serif' }}>LUMINA</h1>
              <div className="h-px w-32 bg-cyan-800 mb-8"></div>
              <div className="flex flex-col gap-4 w-64">
                {maxReachedLevel > 1 && <button onClick={handleResume} className="group relative px-4 py-3 bg-zinc-900 border border-zinc-700 hover:border-cyan-500 hover:text-cyan-400 text-gray-300 transition uppercase tracking-widest text-xs">Resume Journey</button>}
                <button onClick={handleStartNew} className="group relative px-4 py-3 bg-zinc-900 border border-zinc-700 hover:border-cyan-500 hover:text-cyan-400 text-gray-300 transition uppercase tracking-widest text-xs">New Game</button>
                <button onClick={() => setShowJourney(true)} className="group relative px-4 py-3 bg-zinc-900 border border-zinc-700 hover:border-purple-500 hover:text-purple-400 text-gray-300 transition uppercase tracking-widest text-xs flex items-center justify-center gap-2"><Map size={14} /> Journey</button>
              </div>
              <button onClick={() => setShowCredits(true)} className="mt-8 text-xs text-gray-600 hover:text-cyan-500 transition uppercase tracking-widest">Credits</button>
            </div>
          </div>
        )}

        {status === GameStatus.GAME_OVER && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm z-10">
            <h2 className="text-5xl font-bold text-red-600 mb-2 font-serif tracking-widest opacity-80">FADED</h2>
            <p className="text-red-900/50 text-sm tracking-[0.5em] uppercase mb-8">The light dims...</p>
            <div className="flex gap-4">
              <button onClick={handleRetry} className="px-8 py-3 bg-red-950 text-red-200 border border-red-900 hover:bg-red-900 hover:border-red-500 transition-all rounded flex items-center gap-2"><RotateCcw size={16} /> REIGNITE</button>
              <button onClick={handleGoHome} className="px-4 py-3 bg-zinc-900 text-gray-400 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-all rounded flex items-center gap-2"><Home size={16} /></button>
            </div>
          </div>
        )}

        {status === GameStatus.LEVEL_COMPLETE && (
          <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center z-10">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 to-black"></div>
             <div className="relative z-10 text-center max-w-md px-6">
               <div className="w-12 h-12 mx-auto mb-6 border-2 border-indigo-500 rotate-45 flex items-center justify-center"><div className="w-8 h-8 bg-indigo-500/50"></div></div>
               <h2 className="text-2xl text-indigo-300 mb-8 tracking-[0.2em] font-light">TRANSITION COMPLETE</h2>
               <div className="min-h-[100px] flex items-center justify-center mb-8 relative">
                 {loadingStory ? <span className="animate-pulse text-gray-500">Consulting the stars...</span> : <p className="text-lg font-serif italic text-gray-400 leading-relaxed">"{narrative}"</p>}
               </div>
               <div className="flex flex-col gap-3">
                 <button onClick={handleNextLevel} disabled={loadingStory} className="px-10 py-3 bg-indigo-900/50 text-indigo-200 border border-indigo-800 hover:bg-indigo-800 transition-all uppercase tracking-wider text-sm disabled:opacity-50">Enter Level {levelId + 1}</button>
                 <button onClick={handleGoHome} className="px-10 py-3 bg-zinc-900/50 text-gray-400 border border-zinc-800 hover:bg-zinc-800 transition-all uppercase tracking-wider text-sm">Main Menu</button>
               </div>
            </div>
          </div>
        )}
        
        {status === GameStatus.VICTORY && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
             <div className="relative z-20 text-center p-8 animate-in fade-in duration-2000 delay-1000">
                <Heart className="w-12 h-12 text-pink-600 mx-auto mb-6 animate-pulse" fill="currentColor" />
                <h1 className="text-4xl font-bold text-zinc-800 mb-6 tracking-[0.2em]" style={{ fontFamily: 'Cinzel, serif' }}>UNION</h1>
                <div className="min-h-[60px] mb-10">
                  {!loadingStory && <p className="text-xl text-zinc-700 font-serif italic max-w-md mx-auto leading-relaxed">"{narrative}"</p>}
                </div>
                <button onClick={() => { setLevelId(1); setStatus(GameStatus.MENU); setHealth(1.0); }} className="px-8 py-3 bg-white/80 hover:bg-white text-zinc-900 border border-zinc-300 rounded-sm shadow-lg transition backdrop-blur-md uppercase tracking-widest text-xs">Return to Void</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;