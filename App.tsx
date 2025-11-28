
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameMode, GameState, VocabularyItem, GameFilters, DamageEffect, Projectile, PlayerStats, Skill, BuffType, BossConfig } from './types';
import { fetchVocabulary, getCorpusMetadata } from './services/geminiService';
import { audioManager } from './services/audioManager';
import { VirtualKeyboard } from './components/VirtualKeyboard';
import { Button } from './components/Button';
import { CORRECT_KEYBOARD_ROWS, ROGUELIKE_SKILLS, BOSS_ROSTER } from './constants';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.LEARNING);
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [availableMetadata, setAvailableMetadata] = useState<{publishers: string[], grades: string[], lessons: string[]}>({ publishers: [], grades: [], lessons: [] });
  const [selectedPublishers, setSelectedPublishers] = useState<string[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);

  // Game Progress State
  const [vocabIndex, setVocabIndex] = useState(0); // Current word index
  const [charIndex, setCharIndex] = useState(0);   // Current character inside the word
  const [keyIndex, setKeyIndex] = useState(0);     // Current key stroke inside the Zhuyin character

  // Interaction State
  const [lastPressedKey, setLastPressedKey] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  
  // Timer for Mode 2
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timeUntilHint, setTimeUntilHint] = useState(10);
  
  // Roguelike Stats
  const [wave, setWave] = useState(1);
  const [score, setScore] = useState(0);
  const [errors, setErrors] = useState(0);

  const [playerStats, setPlayerStats] = useState<PlayerStats>({
    hp: 100,
    maxHp: 100,
    attackMultiplier: 1.0,
    critChance: 0.0,
    critDamageMultiplier: 1.5,
    enemySpeedReduction: 0,
  });

  const [skillCandidates, setSkillCandidates] = useState<Skill[]>([]);

  // Boss Battle State
  const [bossMaxHp, setBossMaxHp] = useState(1000);
  const [bossHp, setBossHp] = useState(1000);
  const [currentBoss, setCurrentBoss] = useState<BossConfig>(BOSS_ROSTER[0]);
  const [isBossShaking, setIsBossShaking] = useState(false);
  const [isBossAttacking, setIsBossAttacking] = useState(false);
  const [isExploding, setIsExploding] = useState(false); // New state for explosion
  
  // Enemy Attack State
  const [enemyAttackProgress, setEnemyAttackProgress] = useState(0);
  const enemyAttackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Visuals
  const [damageEffects, setDamageEffects] = useState<DamageEffect[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const projectileIdCounter = useRef(0);
  const damageIdCounter = useRef(0);

  // Load Metadata on mount
  useEffect(() => {
    const meta = getCorpusMetadata();
    setAvailableMetadata(meta);
    // Default select all
    setSelectedPublishers(meta.publishers);
    setSelectedGrades(meta.grades);
    setSelectedLessons(meta.lessons);
  }, []);

  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    audioManager.setMute(newState);
  };

  const togglePublisher = (pub: string) => {
    setSelectedPublishers(prev => 
      prev.includes(pub) ? prev.filter(p => p !== pub) : [...prev, pub]
    );
  };

  const toggleGrade = (grade: string) => {
    setSelectedGrades(prev => 
      prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]
    );
  };

  const toggleLesson = (lesson: string) => {
    setSelectedLessons(prev => 
      prev.includes(lesson) ? prev.filter(l => l !== lesson) : [...prev, lesson]
    );
  };

  const selectAllLessons = () => {
    setSelectedLessons(availableMetadata.lessons);
  };

  const deselectAllLessons = () => {
    setSelectedLessons([]);
  };

  const isFilterValid = selectedPublishers.length > 0 && selectedGrades.length > 0 && selectedLessons.length > 0;

  // Helper to find the next typeable character index starting from `fromIndex`
  const findNextTypeableIndex = (chars: any[], fromIndex: number): number => {
    for (let i = fromIndex; i < chars.length; i++) {
      if (!chars[i].isContext && chars[i].keys.length > 0) {
        return i;
      }
    }
    return -1; // No more typeable chars in this word
  };

  // Initialize Game
  const startGame = useCallback(async (mode: GameMode) => {
    if (!isFilterValid) {
      alert("請至少選擇一個版本、年級和課次範圍！");
      return;
    }

    // Attempt to start audio context on user interaction
    audioManager.startBGM();

    setIsLoading(true);
    setGameMode(mode);
    try {
      const filters: GameFilters = {
        publishers: selectedPublishers,
        grades: selectedGrades,
        lessons: selectedLessons
      };
      
      const items = await fetchVocabulary(30, filters); // Fetch initial batch
      
      if (items.length === 0) {
        alert("找不到符合條件的題目，請重新選擇！");
        setGameState(GameState.MENU);
        return;
      }

      setVocabulary(items);
      setVocabIndex(0);
      setScore(0);
      setErrors(0);
      setKeyIndex(0);
      setWave(1);

      // Reset Player Stats
      setPlayerStats({
        hp: 100,
        maxHp: 100,
        attackMultiplier: 1.0,
        critChance: 0.05, // Base 5% crit
        critDamageMultiplier: 1.5,
        enemySpeedReduction: 0
      });
      
      // Setup Boss HP for Wave 1
      setupBossForWave(1);
      
      setDamageEffects([]);
      setProjectiles([]);
      setIsExploding(false);
      
      // Find first typeable char for the first word
      if (items.length > 0) {
        const firstTypeable = findNextTypeableIndex(items[0].chars, 0);
        setCharIndex(firstTypeable !== -1 ? firstTypeable : 0);
      } else {
        setCharIndex(0);
      }

      setGameState(GameState.PLAYING);
      
      // Initial Hint Logic
      if (mode === GameMode.MEMORY) {
        setShowHint(false);
        setTimeUntilHint(10);
      } else {
        setShowHint(true);
      }
    } catch (e) {
      console.error("Failed to start game", e);
    } finally {
      setIsLoading(false);
    }
  }, [isFilterValid, selectedPublishers, selectedGrades, selectedLessons]);

  const setupBossForWave = (waveNum: number) => {
    // Select boss based on rotation
    const bossIndex = (waveNum - 1) % BOSS_ROSTER.length;
    setCurrentBoss(BOSS_ROSTER[bossIndex]);
    setIsExploding(false); // Reset explosion

    // Scaling logic
    const baseHp = 1000;
    const hpMultiplier = 1 + (waveNum - 1) * 0.3; // +30% HP per wave
    const newMaxHp = Math.floor(baseHp * hpMultiplier);
    
    setBossMaxHp(newMaxHp);
    setBossHp(newMaxHp);
    setEnemyAttackProgress(0); // Reset attack bar
  };

  // Enemy Attack Logic
  useEffect(() => {
    if (gameState !== GameState.PLAYING) {
      if (enemyAttackTimerRef.current) clearInterval(enemyAttackTimerRef.current);
      return;
    }
    
    // If boss is attacking or exploding, pause timer
    if (isBossAttacking || isExploding) {
       if (enemyAttackTimerRef.current) clearInterval(enemyAttackTimerRef.current);
       return;
    }

    // Base time to fill bar: 10 seconds -> 100%
    // Wave scaling: Boss gets faster by 10% per wave
    // Player skill: enemySpeedReduction reduces speed
    const baseTick = 1.0; // % per 100ms (10 sec total)
    const waveSpeedMult = 1 + (wave - 1) * 0.1;
    const playerSlowMult = 1 - playerStats.enemySpeedReduction;
    
    // Ensure speed doesn't go below 20% of base
    const finalTick = Math.max(0.2, baseTick * waveSpeedMult * playerSlowMult);

    enemyAttackTimerRef.current = setInterval(() => {
       setEnemyAttackProgress(prev => {
          if (prev >= 100) {
             // Trigger Attack Animation Sequence
             if (!isBossAttacking) {
                 handleBossAttackSequence();
             }
             return 100;
          }
          return prev + finalTick;
       });
    }, 100);

    return () => {
      if (enemyAttackTimerRef.current) clearInterval(enemyAttackTimerRef.current);
    };
  }, [gameState, wave, playerStats, isBossAttacking, isExploding]);

  const handleBossAttackSequence = () => {
      setIsBossAttacking(true);
      // Wait for animation hit point
      setTimeout(() => {
         triggerDamageToPlayer(10 + wave * 2);
         // Reset after animation
         setTimeout(() => {
             setIsBossAttacking(false);
             setEnemyAttackProgress(0);
         }, 300); // Allow time for animation to finish return
      }, 300); // Attack impact time
  };

  // Hint Timer (Memory Mode)
  useEffect(() => {
    if (gameState !== GameState.PLAYING || gameMode !== GameMode.MEMORY) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (keyIndex === 0 && !showHint) {
        timerRef.current = setInterval(() => {
            setTimeUntilHint((prev) => {
                if (prev <= 1) {
                    setShowHint(true);
                    if (timerRef.current) clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    } else {
        if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, gameMode, keyIndex, showHint]);

  // Visual Effect Helpers
  const triggerDamageToBoss = (amount: number, isCritical: boolean) => {
    setBossHp(prev => Math.max(0, prev - amount));
    createDamageEffect(amount, isCritical, 'BOSS');
    audioManager.playHitSound(isCritical);
    setIsBossShaking(true);
    setTimeout(() => setIsBossShaking(false), 300);
    
    // Projectile visual
    const pid = projectileIdCounter.current++;
    setProjectiles(prev => [...prev, {
      id: pid,
      startX: 0,
      startY: 200,
      targetX: 0,
      targetY: 0
    }]);
    setTimeout(() => {
      setProjectiles(prev => prev.filter(p => p.id !== pid));
    }, 500);
  };

  const triggerDamageToPlayer = (amount: number) => {
    setPlayerStats(prev => ({
        ...prev,
        hp: Math.max(0, prev.hp - amount)
    }));
    audioManager.playPlayerHurtSound();
    createDamageEffect(amount, false, 'PLAYER');
  };

  const createDamageEffect = (value: number, isCritical: boolean, target: 'BOSS' | 'PLAYER') => {
    const id = damageIdCounter.current++;
    const xOffset = (Math.random() - 0.5) * 60; 
    const yOffset = (Math.random() - 0.5) * 30;

    setDamageEffects(prev => [...prev, {
      id,
      value,
      x: xOffset,
      y: yOffset,
      isCritical,
      target
    }]);

    setTimeout(() => {
      setDamageEffects(prev => prev.filter(e => e.id !== id));
    }, 1000);
  };

  // Skill Logic
  const generateSkillChoices = () => {
      const shuffled = [...ROGUELIKE_SKILLS].sort(() => 0.5 - Math.random());
      setSkillCandidates(shuffled.slice(0, 3));
      setGameState(GameState.CHOOSING_SKILL);
  };

  const selectSkill = (skill: Skill) => {
      setPlayerStats(prev => {
          let newStats = { ...prev };
          switch (skill.type) {
              case BuffType.HEAL:
                  newStats.hp = Math.min(newStats.maxHp, newStats.hp + skill.value);
                  break;
              case BuffType.MAX_HP_UP:
                  newStats.maxHp += skill.value;
                  newStats.hp += skill.value; // Heal the amount increased
                  break;
              case BuffType.ATTACK_UP:
                  newStats.attackMultiplier += skill.value;
                  break;
              case BuffType.CRIT_RATE_UP:
                  newStats.critChance += skill.value;
                  break;
              case BuffType.FREEZE_ENEMY:
                  newStats.enemySpeedReduction = Math.min(0.8, newStats.enemySpeedReduction + skill.value);
                  break;
          }
          return newStats;
      });
      
      // Continue to next wave logic or just resume playing
      setWave(prev => prev + 1);
      setupBossForWave(wave + 1);
      setGameState(GameState.PLAYING);
      audioManager.playVictorySound();
  };

  // Input Handling
  const currentWord = vocabulary[vocabIndex];
  const currentChar = currentWord?.chars[charIndex];
  const currentTargetKey = currentChar?.keys[keyIndex];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') e.preventDefault(); // Stop scrolling

      if (gameState !== GameState.PLAYING || !currentTargetKey || currentChar?.isContext) return;
      if (bossHp <= 0 || playerStats.hp <= 0 || isExploding) return; // Prevent typing during death animation

      const inputKey = e.key.toLowerCase();
      if (['shift', 'control', 'alt', 'meta'].includes(inputKey)) return;

      setLastPressedKey(inputKey);

      if (inputKey === currentTargetKey) {
        // Correct Input
        setScore(s => s + 10);
        audioManager.playTypeSound();
        
        // Calculate Damage
        let damage = 10 * playerStats.attackMultiplier;
        const isCrit = Math.random() < playerStats.critChance;
        if (isCrit) damage *= playerStats.critDamageMultiplier;
        
        triggerDamageToBoss(Math.ceil(damage), isCrit);

        // Slightly push back enemy attack bar (Bonus)
        setEnemyAttackProgress(prev => Math.max(0, prev - 2));

        if (keyIndex < currentChar.keys.length - 1) {
          setKeyIndex(prev => prev + 1);
        } else {
          setKeyIndex(0);
          if (gameMode === GameMode.MEMORY) {
             setShowHint(false);
             setTimeUntilHint(10);
          }

          const nextCharIdx = findNextTypeableIndex(currentWord.chars, charIndex + 1);

          if (nextCharIdx !== -1) {
            setCharIndex(nextCharIdx);
          } else {
            // Word Completed - BIG DAMAGE
            let bigDamage = 100 * playerStats.attackMultiplier;
            const isCritWord = Math.random() < playerStats.critChance;
            if (isCritWord) bigDamage *= playerStats.critDamageMultiplier;
            triggerDamageToBoss(Math.ceil(bigDamage), isCritWord);

            // Move Next Word
            if (vocabIndex < vocabulary.length - 1) {
               const nextVocabIndex = vocabIndex + 1;
               setVocabIndex(nextVocabIndex);
               const firstTypeable = findNextTypeableIndex(vocabulary[nextVocabIndex].chars, 0);
               setCharIndex(firstTypeable !== -1 ? firstTypeable : 0);
            } else {
               // Run out of words in current list -> Reshuffle or Loop
               const shuffled = [...vocabulary].sort(() => 0.5 - Math.random());
               setVocabulary(shuffled);
               setVocabIndex(0);
               const firstTypeable = findNextTypeableIndex(shuffled[0].chars, 0);
               setCharIndex(firstTypeable !== -1 ? firstTypeable : 0);
            }
          }
        }
      } else {
        // Incorrect Input
        setErrors(prev => prev + 1);
        audioManager.playErrorSound();
        // Take Recoil Damage
        triggerDamageToPlayer(2 + Math.floor(wave / 2));
      }
      
      setTimeout(() => setLastPressedKey(null), 200);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, currentTargetKey, keyIndex, charIndex, vocabIndex, vocabulary, gameMode, bossHp, playerStats, isExploding]);

  // Game Over Watchers
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
        // Victory / Next Wave
        if (bossHp <= 0 && !isExploding) {
            setIsExploding(true);
            audioManager.playExplosionSound();
            
            // Wait for explosion animation
            setTimeout(() => {
                // Check if we trigger skill selection (Every 3 waves)
                if (wave % 3 === 0) {
                    generateSkillChoices();
                } else {
                    // Immediate next wave
                    setWave(w => w + 1);
                    setupBossForWave(wave + 1);
                    audioManager.playVictorySound();
                }
            }, 1000);
        }
        // Defeat
        if (playerStats.hp <= 0) {
            setGameState(GameState.FINISHED);
            audioManager.stopBGM();
        }
    }
  }, [bossHp, playerStats.hp, gameState, isExploding, wave]);


  // Render Helpers
  const renderCurrentWordDisplay = () => {
    if (!currentWord) return null;

    return (
      <div className="flex flex-col items-center relative z-10">
        <div className="mb-4 flex gap-2">
           <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full border border-gray-600">
             {currentWord.publisher}
           </span>
           <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full border border-gray-600">
             {currentWord.grade}
           </span>
           <span className="bg-blue-900/50 text-blue-200 text-xs px-2 py-1 rounded-full border border-blue-800">
             {currentWord.lesson}
           </span>
        </div>

        <div className="flex justify-center items-end gap-2 mb-8 min-h-[140px] flex-wrap">
          {currentWord.chars.map((charData, idx) => {
            const isContext = charData.isContext;
            const isPast = idx < charIndex && !isContext;
            const isCurrent = idx === charIndex && !isContext;
            
            let showZhuyinText = true;
            if (gameMode === GameMode.MEMORY && isCurrent) {
                if (!showHint && keyIndex === 0) {
                    showZhuyinText = false;
                }
            }

            if (isContext) {
              return (
                <div key={idx} className="flex flex-col items-center justify-end pb-5 mx-1">
                    <span className="text-4xl text-gray-400 font-bold">{charData.char}</span>
                </div>
              );
            }
            
            return (
              <div key={idx} className={`flex flex-col items-center transition-all duration-300 ${isCurrent ? 'scale-110' : 'opacity-60 scale-95'}`}>
                <div className={`
                      text-xl font-medium text-blue-300 mb-2 min-h-[80px] w-8 flex flex-col justify-end items-center writing-vertical-lr
                      transition-opacity duration-300
                      ${showZhuyinText ? 'opacity-100' : 'opacity-0'}
                `}>
                    {charData.zhuyin.split('').map((z, zIdx) => (
                        <span key={zIdx} className="block py-0.5">{z}</span>
                    ))}
                </div>
                <div className={`
                  text-5xl font-bold rounded-lg p-4 border-2 min-w-[80px] text-center
                  ${isCurrent ? 'bg-gray-700 border-blue-500 text-white shadow-lg shadow-blue-500/20' : ''}
                  ${isPast ? 'bg-green-900/30 border-green-600 text-green-400' : ''}
                  ${!isCurrent && !isPast ? 'bg-gray-800 border-gray-700 text-gray-500' : ''}
                `}>
                  {charData.char}
                </div>
                {isCurrent && (
                    <div className="mt-2 h-2 w-2 rounded-full bg-blue-500 animate-ping"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 overflow-hidden relative font-sans">
      
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-800 to-gray-900 -z-10"></div>

      {/* Header */}
      <header className="w-full max-w-4xl flex justify-between items-center py-4 border-b border-gray-800 mb-4 z-20">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent cursor-pointer" onClick={() => { setGameState(GameState.MENU); audioManager.stopBGM(); }}>
          ㄅㄆㄇ注音大師 <span className="text-xs text-gray-500 ml-2">Roguelike Edition</span>
        </h1>
        <div className="flex items-center gap-4">
            <button 
                onClick={toggleMute} 
                className={`p-2 rounded-full border ${isMuted ? 'bg-red-900/50 border-red-700 text-red-300' : 'bg-green-900/50 border-green-700 text-green-300'} transition-all`}
            >
                {isMuted ? '🔇' : '🔊'}
            </button>
            {gameState === GameState.PLAYING && (
            <div className="flex gap-4 text-sm font-mono items-center">
                <div className="bg-yellow-900/40 border border-yellow-700 text-yellow-200 px-3 py-1 rounded">
                    第 {wave} 波
                </div>
                <div className="bg-gray-800 px-3 py-1 rounded">得分: <span className="text-green-400">{score}</span></div>
            </div>
            )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl flex flex-col items-center justify-start relative z-10">
        
        {/* MENU STATE */}
        {gameState === GameState.MENU && (
          <div className="text-center space-y-8 animate-fade-in w-full max-w-2xl py-4">
             {/* Filter Settings ... (Same as before) */}
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 backdrop-blur-sm">
              <h2 className="text-lg font-bold text-gray-300 mb-4 text-left border-l-4 border-blue-500 pl-3">題庫設定 (可複選)</h2>
              <div className="space-y-6">
                <div className="text-left">
                  <h3 className="text-sm text-gray-400 mb-2">出版社版本</h3>
                  <div className="flex flex-wrap gap-2">
                    {availableMetadata.publishers.map(pub => (
                      <button key={pub} onClick={() => togglePublisher(pub)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedPublishers.includes(pub) ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>{pub}</button>
                    ))}
                  </div>
                </div>
                <div className="text-left">
                  <h3 className="text-sm text-gray-400 mb-2">年級</h3>
                  <div className="flex flex-wrap gap-2">
                    {availableMetadata.grades.map(grade => (
                      <button key={grade} onClick={() => toggleGrade(grade)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedGrades.includes(grade) ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400'}`}>{grade}</button>
                    ))}
                  </div>
                </div>
                <div className="text-left">
                  <div className="flex justify-between items-end mb-2">
                    <h3 className="text-sm text-gray-400">課次範圍</h3>
                    <div className="space-x-2">
                      <button onClick={selectAllLessons} className="text-xs text-blue-400 hover:text-blue-300">全選</button>
                      <button onClick={deselectAllLessons} className="text-xs text-gray-500 hover:text-gray-400">取消全選</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {availableMetadata.lessons.map(lesson => (
                      <button key={lesson} onClick={() => toggleLesson(lesson)} className={`px-2 py-2 rounded-lg text-sm font-medium transition-all truncate ${selectedLessons.includes(lesson) ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'}`}>{lesson}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-2">選擇遊戲模式</h2>
              <div className="grid md:grid-cols-2 gap-6 w-full">
                <div className={`group bg-gray-800 hover:bg-gray-750 p-6 rounded-2xl border border-gray-700 hover:border-blue-500 transition-all cursor-pointer relative overflow-hidden text-left ${!isFilterValid ? 'opacity-50 grayscale' : ''}`} onClick={() => startGame(GameMode.LEARNING)}>
                  <h3 className="text-2xl font-bold text-blue-400 mb-2">練習模式</h3>
                  <p className="text-gray-300 text-sm">無限挑戰，每3波可選技能</p>
                </div>
                <div className={`group bg-gray-800 hover:bg-gray-750 p-6 rounded-2xl border border-gray-700 hover:border-purple-500 transition-all cursor-pointer relative overflow-hidden text-left ${!isFilterValid ? 'opacity-50 grayscale' : ''}`} onClick={() => startGame(GameMode.MEMORY)}>
                  <h3 className="text-2xl font-bold text-purple-400 mb-2">測驗模式</h3>
                  <p className="text-gray-300 text-sm">無限挑戰，每3波可選技能 (隱藏注音)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PLAYING STATE */}
        {(gameState === GameState.PLAYING || gameState === GameState.CHOOSING_SKILL) && (
          <div className="w-full flex flex-col items-center animate-fade-in relative h-full">
            
            {/* PLAYER STATUS BAR */}
            <div className="absolute top-0 left-0 p-2 z-30 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-xl shadow-lg border-2 border-green-400">
                    😊
                </div>
                <div className="flex flex-col">
                    <div className="w-40 h-4 bg-gray-900 rounded-full border border-gray-600 overflow-hidden relative">
                         <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${(playerStats.hp / playerStats.maxHp) * 100}%` }}></div>
                         <span className="absolute inset-0 text-[10px] flex items-center justify-center font-bold drop-shadow">
                            HP: {Math.ceil(playerStats.hp)} / {playerStats.maxHp}
                         </span>
                    </div>
                </div>
            </div>

            {/* BOSS SECTION */}
            <div className="w-full flex flex-col items-center mb-6 relative mt-8">
                {/* Boss HP */}
                <div className="w-full max-w-md h-6 bg-gray-800 rounded-full border border-gray-600 overflow-hidden relative shadow-lg">
                    <div 
                        className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300 ease-out"
                        style={{ width: `${(bossHp / bossMaxHp) * 100}%` }}
                    ></div>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
                         {currentBoss.name}: {Math.ceil(bossHp)} / {bossMaxHp}
                    </span>
                </div>

                {/* Boss Avatar & Animation */}
                <div className="relative mt-2">
                    {isExploding ? (
                        <div className="text-8xl animate-[explosion_0.8s_ease-out_forwards] z-40">
                            💥
                        </div>
                    ) : (
                        <div className={`
                            text-8xl transition-transform duration-300
                            ${isBossShaking ? 'translate-x-1 translate-y-1 rotate-3' : ''}
                            ${isBossAttacking ? 'scale-125 translate-y-8 z-50' : ''}
                        `}>
                            {currentBoss.emoji}
                        </div>
                    )}

                    {/* Enemy Attack Bar */}
                    {!isExploding && (
                        <div className="absolute -bottom-4 left-0 w-full h-2 bg-gray-700 rounded-full overflow-hidden mt-1 opacity-80">
                            <div 
                                className={`h-full transition-all duration-100 ${enemyAttackProgress > 90 ? 'bg-red-500 animate-pulse' : 'bg-orange-400'}`}
                                style={{ width: `${enemyAttackProgress}%` }}
                            ></div>
                        </div>
                    )}
                    
                    {/* Damage Numbers */}
                    {damageEffects.map(effect => (
                        <div 
                            key={effect.id}
                            className={`
                                absolute left-1/2 top-1/2 pointer-events-none font-bold select-none
                                animate-[floatUp_0.8s_ease-out_forwards]
                                ${effect.target === 'BOSS' 
                                    ? (effect.isCritical ? 'text-4xl text-yellow-400 z-50' : 'text-2xl text-white z-40')
                                    : 'text-3xl text-red-500 z-50' // Player damage color
                                }
                            `}
                            style={{ 
                                transform: `translate(-50%, -50%) translate(${effect.x}px, ${effect.y}px)`,
                                textShadow: '2px 2px 0px #000'
                            }}
                        >
                            {effect.target === 'BOSS' ? '-' : '-'}{Math.floor(effect.value)}
                            {effect.isCritical && '!'}
                        </div>
                    ))}
                </div>
            </div>

            {/* COMBAT PROJECTILES */}
            {projectiles.map(p => (
                <div
                    key={p.id}
                    className="absolute w-4 h-4 bg-blue-400 rounded-full shadow-[0_0_10px_#60a5fa] z-30 pointer-events-none"
                    style={{
                        left: '50%',
                        bottom: '250px',
                        animation: 'shootProjectile 0.4s ease-in forwards'
                    }}
                ></div>
            ))}

            <style>{`
                @keyframes floatUp {
                    0% { opacity: 1; margin-top: 0; transform: translate(-50%, -50%) scale(0.5); }
                    20% { transform: translate(-50%, -50%) scale(1.2); }
                    100% { opacity: 0; margin-top: -100px; transform: translate(-50%, -50%) scale(1); }
                }
                @keyframes shootProjectile {
                    0% { transform: translateY(0) scale(1); opacity: 1; }
                    100% { transform: translateY(-300px) scale(0.5); opacity: 0; }
                }
                @keyframes explosion {
                    0% { transform: scale(0.5) rotate(0deg); opacity: 1; }
                    50% { transform: scale(1.5) rotate(15deg); opacity: 1; }
                    100% { transform: scale(2) rotate(-15deg); opacity: 0; }
                }
            `}</style>

            {renderCurrentWordDisplay()}

            <div className="relative z-10 mt-8">
                <VirtualKeyboard 
                  activeKey={currentTargetKey || null}
                  pressedKey={lastPressedKey}
                  showHints={showHint}
                />
            </div>
            
             <Button 
                variant="outline" 
                className="mt-8 text-sm py-2 px-4 border-gray-700 hover:bg-red-900/20 hover:border-red-500 hover:text-red-400 z-10"
                onClick={() => { setGameState(GameState.MENU); audioManager.stopBGM(); }}
            >
                放棄遊戲
            </Button>
          </div>
        )}

        {/* SKILL SELECTION MODAL */}
        {gameState === GameState.CHOOSING_SKILL && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4">
                <h2 className="text-3xl font-bold text-white mb-2">選擇一個技能</h2>
                <p className="text-gray-400 mb-8">準備迎接下一波挑戰！</p>
                <div className="grid md:grid-cols-3 gap-6 w-full max-w-4xl">
                    {skillCandidates.map(skill => (
                        <div 
                            key={skill.id}
                            className={`
                                cursor-pointer p-6 rounded-xl border-2 transition-all hover:scale-105
                                flex flex-col items-center text-center
                                ${skill.rarity === 'COMMON' ? 'bg-gray-800 border-gray-600 hover:border-gray-400' : ''}
                                ${skill.rarity === 'RARE' ? 'bg-blue-900/50 border-blue-600 hover:border-blue-400' : ''}
                                ${skill.rarity === 'EPIC' ? 'bg-purple-900/50 border-purple-600 hover:border-purple-400' : ''}
                            `}
                            onClick={() => selectSkill(skill)}
                        >
                            <div className="text-sm font-bold mb-2 uppercase tracking-widest opacity-70">{skill.rarity}</div>
                            <h3 className="text-2xl font-bold mb-3">{skill.name}</h3>
                            <p className="text-gray-300">{skill.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* FINISHED STATE (GAME OVER) */}
        {gameState === GameState.FINISHED && (
           <div className="text-center bg-gray-800 p-10 rounded-2xl border border-gray-700 shadow-2xl animate-fade-in z-50">
              <h2 className="text-4xl font-bold text-red-500 mb-2">
                  GAME OVER
              </h2>
              <p className="text-gray-400 mb-6 text-lg">你在第 <span className="text-white font-bold">{wave}</span> 波被 <span className={currentBoss.colorClass}>{currentBoss.name}</span> 擊敗了。</p>
              
              <div className="grid grid-cols-2 gap-8 mb-8">
                  <div className="flex flex-col items-center">
                      <span className="text-gray-400 text-sm uppercase tracking-wider">最終得分</span>
                      <span className="text-4xl font-bold text-green-400">{score}</span>
                  </div>
                  <div className="flex flex-col items-center">
                      <span className="text-gray-400 text-sm uppercase tracking-wider">存活波數</span>
                      <span className="text-4xl font-bold text-blue-400">{wave}</span>
                  </div>
              </div>

              <div className="flex gap-4 justify-center">
                  <Button onClick={() => setGameState(GameState.MENU)}>
                      回主選單
                  </Button>
                  <Button variant="secondary" onClick={() => startGame(gameMode)}>
                      再次挑戰
                  </Button>
              </div>
           </div>
        )}

      </main>
    </div>
  );
};

export default App;
