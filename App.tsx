
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameMode, GameState, VocabularyItem, GameFilters, DamageEffect, Projectile, PlayerStats, Skill, BuffType, BossConfig, PlayerClassConfig, Difficulty } from './types';
import { fetchVocabulary, getCorpusMetadata } from './services/geminiService';
import { audioManager } from './services/audioManager';
import { VirtualKeyboard } from './components/VirtualKeyboard';
import { Button } from './components/Button';
import { ROGUELIKE_SKILLS, BOSS_ROSTER, PLAYER_CLASSES } from './constants';

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

  // Settings
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.NORMAL);

  // Class Selection
  const [selectedClass, setSelectedClass] = useState<PlayerClassConfig>(PLAYER_CLASSES[0]);

  // Game Progress State
  const [vocabIndex, setVocabIndex] = useState(0); // Current word index
  const [charIndex, setCharIndex] = useState(0);   // Current character inside the word
  const [keyIndex, setKeyIndex] = useState(0);     // Current key stroke inside the Zhuyin character

  // Interaction State
  const [lastPressedKey, setLastPressedKey] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false); // New: Voice Toggle
  
  // Skill & Performance State
  const [comboStreak, setComboStreak] = useState(0);
  const [lastInputTimestamp, setLastInputTimestamp] = useState<number>(0);
  const [currentWordHasError, setCurrentWordHasError] = useState(false);

  // Timer for Mode 2
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timeUntilHint, setTimeUntilHint] = useState(10);
  
  // Roguelike Stats
  const [wave, setWave] = useState(1);
  const [score, setScore] = useState(0);
  const [errors, setErrors] = useState(0);
  const [acquiredSkills, setAcquiredSkills] = useState<Skill[]>([]);

  const [playerStats, setPlayerStats] = useState<PlayerStats>({
    hp: 100,
    maxHp: 100,
    attackMultiplier: 1.0,
    critChance: 0.0,
    critDamageMultiplier: 1.5,
    damageTakenMultiplier: 1.0,
    enemySpeedReduction: 0,
    hasShield: false,
    lifestealAmount: 0,
    burnDamage: 0,
    comboMissileDamage: 0,
    speedBonusMultiplier: 0,
    perfectBonusMultiplier: 0
  });

  const [skillCandidates, setSkillCandidates] = useState<Skill[]>([]);

  // Boss Battle State
  const [bossMaxHp, setBossMaxHp] = useState(1000);
  const [bossHp, setBossHp] = useState(1000);
  const [currentBoss, setCurrentBoss] = useState<BossConfig>(BOSS_ROSTER[0]);
  const [isBossShaking, setIsBossShaking] = useState(false);
  const [isBossCharging, setIsBossCharging] = useState(false); // New: Charging state
  const [isBossAttacking, setIsBossAttacking] = useState(false);
  const [isExploding, setIsExploding] = useState(false);
  const [isPlayerHit, setIsPlayerHit] = useState(false); // For screen shake
  
  // Stun State for Mage
  const [bossStunTime, setBossStunTime] = useState(0); // in seconds
  const stunTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
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

  const toggleVoice = () => {
    const newState = !isVoiceEnabled;
    setIsVoiceEnabled(newState);
    if (!newState) {
      audioManager.cancelSpeak();
    }
  };

  const togglePause = useCallback(() => {
    setGameState(prev => {
      if (prev === GameState.PLAYING) return GameState.PAUSED;
      if (prev === GameState.PAUSED) return GameState.PLAYING;
      return prev;
    });
  }, []);

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
      setAcquiredSkills([]);
      setComboStreak(0);
      setCurrentWordHasError(false);
      setLastInputTimestamp(0);

      // Reset Player Stats based on Class
      setPlayerStats({
        hp: 100,
        maxHp: 100,
        attackMultiplier: 1.0,
        critChance: selectedClass.baseCritChance,
        critDamageMultiplier: 1.5,
        damageTakenMultiplier: selectedClass.damageTakenMultiplier,
        enemySpeedReduction: 0,
        hasShield: false,
        lifestealAmount: 0,
        burnDamage: 0,
        comboMissileDamage: 0,
        speedBonusMultiplier: 0,
        perfectBonusMultiplier: 0
      });
      
      // Setup Boss HP for Wave 1
      setupBossForWave(1);
      setBossStunTime(0);
      
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
  }, [isFilterValid, selectedPublishers, selectedGrades, selectedLessons, selectedClass]);

  const setupBossForWave = (waveNum: number) => {
    // Select boss based on rotation
    const bossIndex = (waveNum - 1) % BOSS_ROSTER.length;
    setCurrentBoss(BOSS_ROSTER[bossIndex]);
    setIsExploding(false); // Reset explosion
    setBossStunTime(0); // Reset stun
    setIsBossCharging(false);
    setIsBossAttacking(false);

    // Scaling logic
    const baseHp = 1000;
    const hpMultiplier = 1 + (waveNum - 1) * 0.3; // +30% HP per wave
    const newMaxHp = Math.floor(baseHp * hpMultiplier);
    
    setBossMaxHp(newMaxHp);
    setBossHp(newMaxHp);
    setEnemyAttackProgress(0); // Reset attack bar
  };

  // Stun Countdown Logic
  useEffect(() => {
    if (gameState !== GameState.PLAYING) {
        if (stunTimerRef.current) clearInterval(stunTimerRef.current);
        return;
    }

    if (bossStunTime > 0) {
        stunTimerRef.current = setInterval(() => {
            setBossStunTime(prev => Math.max(0, prev - 1));
        }, 1000);
    } else {
        if (stunTimerRef.current) clearInterval(stunTimerRef.current);
    }

    return () => {
        if (stunTimerRef.current) clearInterval(stunTimerRef.current);
    };
  }, [gameState, bossStunTime]);

  // BURN Damage Logic
  useEffect(() => {
    if (gameState !== GameState.PLAYING || bossHp <= 0 || playerStats.burnDamage <= 0) return;

    const burnInterval = setInterval(() => {
        setBossHp(prev => {
            const newVal = Math.max(0, prev - playerStats.burnDamage);
            return newVal;
        });
        createDamageEffect(playerStats.burnDamage, false, 'BOSS');
    }, 1000);

    return () => clearInterval(burnInterval);
  }, [gameState, bossHp, playerStats.burnDamage]);

  // Enemy Attack Logic
  useEffect(() => {
    if (gameState !== GameState.PLAYING) {
      if (enemyAttackTimerRef.current) clearInterval(enemyAttackTimerRef.current);
      return;
    }
    
    // If boss is attacking or charging or exploding or STUNNED, pause timer
    if (isBossAttacking || isBossCharging || isExploding || bossStunTime > 0) {
       if (enemyAttackTimerRef.current) clearInterval(enemyAttackTimerRef.current);
       return;
    }

    // Base time to fill bar: 10 seconds -> 100%
    // Wave scaling: Boss gets faster by 10% per wave
    // Player skill: enemySpeedReduction reduces speed
    const baseTick = 1.0; // % per 100ms (10 sec total)
    const waveSpeedMult = 1 + (wave - 1) * 0.1;
    const playerSlowMult = 1 - playerStats.enemySpeedReduction;
    
    // Difficulty Multiplier
    let diffMult = 1.0;
    if (difficulty === Difficulty.EASY) diffMult = 0.5; // -50% speed
    if (difficulty === Difficulty.NORMAL) diffMult = 0.8; // -20% speed
    if (difficulty === Difficulty.HARD) diffMult = 1.0;

    // Ensure speed doesn't go below 20% of base
    const finalTick = Math.max(0.2, baseTick * waveSpeedMult * playerSlowMult * diffMult);

    enemyAttackTimerRef.current = setInterval(() => {
       setEnemyAttackProgress(prev => {
          if (prev >= 100) {
             // Trigger Attack Animation Sequence
             if (!isBossAttacking && !isBossCharging) {
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
  }, [gameState, wave, playerStats, isBossAttacking, isBossCharging, isExploding, bossStunTime, difficulty]);

  const handleBossAttackSequence = () => {
      // Phase 1: Charge (1s)
      setIsBossCharging(true);
      
      setTimeout(() => {
         // Check if dead during charge
         if (bossHp <= 0) return;

         // Phase 2: Attack Lunge
         setIsBossCharging(false);
         setIsBossAttacking(true);
         
         // Phase 3: Impact (Wait for lunge to hit ~300ms)
         setTimeout(() => {
             if (bossHp <= 0) return;
             
             triggerDamageToPlayer(10 + wave * 2);
             
             // Phase 4: Reset
             setTimeout(() => {
                 setIsBossAttacking(false);
                 setEnemyAttackProgress(0);
             }, 500); // Allow time for animation return
         }, 300); // Lunge impact timing

      }, 1000); // Charge duration
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
  const triggerDamageToBoss = (amount: number, isCritical: boolean, label?: string) => {
    setBossHp(prev => Math.max(0, prev - amount));
    createDamageEffect(amount, isCritical, 'BOSS', label);
    audioManager.playHitSound(isCritical);
    setIsBossShaking(true);
    setTimeout(() => setIsBossShaking(false), 300);
    
    // Projectile visual logic
    const spawnProjectile = (delay = 0) => {
        setTimeout(() => {
            const pid = projectileIdCounter.current++;
            setProjectiles(prev => [...prev, {
                id: pid,
                startX: 0,
                startY: 0,
                targetX: 0,
                targetY: 0,
                variant: selectedClass.id
            }]);
            setTimeout(() => {
                setProjectiles(prev => prev.filter(p => p.id !== pid));
            }, 400); // Match animation duration
        }, delay);
    };

    if (selectedClass.id === 'ASSASSIN') {
        // Combo Effect: 2 rapid projectiles
        spawnProjectile(0);
        spawnProjectile(150);
    } else {
        // Single projectile
        spawnProjectile(0);
    }
  };

  const triggerDamageToPlayer = (amount: number) => {
    // Apply Class Defense Penalty (e.g., Assassin takes more damage)
    const finalAmount = Math.ceil(amount * playerStats.damageTakenMultiplier);
    
    setPlayerStats(prev => ({
        ...prev,
        hp: Math.max(0, prev.hp - finalAmount)
    }));
    audioManager.playPlayerHurtSound();
    
    // Use negative value for player damage visuals
    createDamageEffect(-finalAmount, false, 'PLAYER');
    
    setIsPlayerHit(true);
    setTimeout(() => setIsPlayerHit(false), 500);
  };

  const createDamageEffect = (value: number, isCritical: boolean, target: 'BOSS' | 'PLAYER', label?: string) => {
    const id = damageIdCounter.current++;
    const xOffset = (Math.random() - 0.5) * 60; 
    const yOffset = (Math.random() - 0.5) * 30;

    setDamageEffects(prev => [...prev, {
      id,
      value,
      x: xOffset,
      y: yOffset,
      isCritical,
      target,
      label
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
      setAcquiredSkills(prev => [...prev, skill]);
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
              case BuffType.SHIELD:
                  newStats.hasShield = true;
                  break;
              case BuffType.LIFESTEAL:
                  newStats.lifestealAmount += skill.value;
                  break;
              case BuffType.BURN:
                  newStats.burnDamage += skill.value;
                  break;
              case BuffType.COMBO_ATTACK:
                  newStats.comboMissileDamage += skill.value;
                  break;
              case BuffType.SPEED_BONUS:
                  newStats.speedBonusMultiplier += skill.value;
                  break;
              case BuffType.PERFECT_BONUS:
                  newStats.perfectBonusMultiplier += skill.value;
                  break;
          }
          return newStats;
      });
      
      // Continue to next wave logic or just resume playing
      // Skills every 2 waves
      setWave(prev => prev + 1);
      setupBossForWave(wave + 1);
      setGameState(GameState.PLAYING);
      audioManager.playVictorySound();
  };

  // Input Handling logic separated for mobile/keyboard reuse
  const currentWord = vocabulary[vocabIndex];
  const currentChar = currentWord?.chars[charIndex];
  const currentTargetKey = currentChar?.keys[keyIndex];

  // Voice Logic: Speak when word changes
  useEffect(() => {
    if (gameState === GameState.PLAYING && isVoiceEnabled && currentWord) {
      // Reconstruct the full display text from chars
      const text = currentWord.chars.map(c => c.char).join('');
      // Delay slightly to avoid conflict with "Correct" sound of previous word
      setTimeout(() => {
        audioManager.speak(text);
      }, 300);
    }
  }, [vocabIndex, isVoiceEnabled, gameState, currentWord]);


  const handleInput = useCallback((inputKey: string) => {
      // Input Blockers
      if (gameState === GameState.PAUSED) return;
      if (gameState !== GameState.PLAYING || !currentTargetKey || currentChar?.isContext) return;
      if (bossHp <= 0 || playerStats.hp <= 0 || isExploding) return; // Prevent typing during death animation

      const now = Date.now();
      const timeDiff = now - lastInputTimestamp;
      setLastInputTimestamp(now);
      setLastPressedKey(inputKey);

      if (inputKey === currentTargetKey) {
        // Correct Input
        setScore(s => s + 10);
        audioManager.playTypeSound();
        
        // 1. Calculate Base Damage
        let damage = 10 * playerStats.attackMultiplier;
        const isCrit = Math.random() < playerStats.critChance;
        if (isCrit) damage *= playerStats.critDamageMultiplier;

        // 2. SKILL: Quick Draw (Speed Bonus)
        let speedLabel = undefined;
        if (timeDiff < 300 && playerStats.speedBonusMultiplier > 0) {
            damage *= (1 + playerStats.speedBonusMultiplier);
            speedLabel = "Speed!";
        }
        
        triggerDamageToBoss(Math.ceil(damage), isCrit, speedLabel);

        // 3. SKILL: Combo Missile
        const newCombo = comboStreak + 1;
        setComboStreak(newCombo);
        if (newCombo % 10 === 0 && playerStats.comboMissileDamage > 0) {
            // Trigger Extra Missile
            setTimeout(() => {
                triggerDamageToBoss(playerStats.comboMissileDamage, true, `Combo x${newCombo}!`);
            }, 100);
        }

        // Mage Class Ability: 5% Chance to Stun for 5 seconds
        if (selectedClass.id === 'MAGE') {
            if (Math.random() < 0.05) {
                setBossStunTime(5); // Reset/Set timer to 5s
            }
        }

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

            // 4. SKILL: Precision Strike (Perfect Bonus)
            let perfectLabel = undefined;
            if (!currentWordHasError && playerStats.perfectBonusMultiplier > 0) {
                bigDamage *= playerStats.perfectBonusMultiplier;
                perfectLabel = "Perfect!";
            }

            triggerDamageToBoss(Math.ceil(bigDamage), isCritWord, perfectLabel);

            // Lifesteal Check
            if (playerStats.lifestealAmount > 0) {
                setPlayerStats(prev => ({
                    ...prev,
                    hp: Math.min(prev.maxHp, prev.hp + prev.lifestealAmount)
                }));
                // Heal is positive
                createDamageEffect(playerStats.lifestealAmount, false, 'PLAYER');
            }

            // Move Next Word
            // Reset per-word stats
            setCurrentWordHasError(false);

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
        setComboStreak(0); // Reset Combo
        setCurrentWordHasError(true); // Mark word as dirty
        audioManager.playErrorSound();
        
        // Take Recoil Damage (Unless Shielded)
        if (!playerStats.hasShield) {
            // Self damage is small, use damage effect logic inside
            triggerDamageToPlayer(2 + Math.floor(wave / 2));
        } else {
            // Visual feedback for shield block?
        }
      }
      
      setTimeout(() => setLastPressedKey(null), 200);
  }, [gameState, currentTargetKey, currentChar, keyIndex, charIndex, vocabIndex, currentWord, vocabulary, gameMode, bossHp, playerStats, isExploding, wave, selectedClass, comboStreak, lastInputTimestamp, currentWordHasError]);

  // Keyboard Event Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') e.preventDefault(); // Stop scrolling
      
      // Pause Toggle
      if (e.key === 'Escape') {
          togglePause();
          return;
      }

      const inputKey = e.key.toLowerCase();
      if (['shift', 'control', 'alt', 'meta'].includes(inputKey)) return;

      handleInput(inputKey);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInput, togglePause]);

  // Game Over Watchers
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
        // Victory / Next Wave
        if (bossHp <= 0 && !isExploding) {
            setIsExploding(true);
            audioManager.playExplosionSound();
            
            // Wait for explosion animation
            setTimeout(() => {
                // Check if we trigger skill selection (Every 2 waves now)
                if (wave % 2 === 0) {
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

  const renderAvatar = (avatarStr: string) => {
      if (avatarStr.startsWith('data:image')) {
          return <img src={avatarStr} alt="avatar" className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-lg" style={{ imageRendering: 'pixelated' }} />;
      }
      return <div>{avatarStr}</div>;
  };

  // Compact Render Helper for the Battle Box
  const renderCurrentWordDisplay = () => {
    if (!currentWord) return null;

    return (
      <div className="flex flex-col items-center justify-center h-full w-full relative z-10 px-2">
        <div className="flex justify-center items-end gap-1 flex-wrap">
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
                <div key={idx} className="flex flex-col items-center justify-end mx-0.5">
                    {/* Mimic the box model of the target char to ensure baseline alignment */}
                    <div className="text-2xl sm:text-3xl text-gray-800 font-medium px-2 py-1 border-2 border-transparent text-center">
                      {charData.char}
                    </div>
                </div>
              );
            }
            
            return (
              <div key={idx} className={`flex flex-col items-center transition-all duration-300 ${isCurrent ? 'scale-110' : 'opacity-80 scale-100'}`}>
                <div className={`
                      text-lg font-extrabold text-black mb-1 w-6 flex flex-col justify-end items-center writing-vertical-lr
                      transition-opacity duration-300
                      ${showZhuyinText ? 'opacity-100' : 'opacity-0'}
                `}>
                    {charData.zhuyin.split('').map((z, zIdx) => (
                        <span key={zIdx} className="block leading-none">{z}</span>
                    ))}
                </div>
                
                {/* Memory Hint Timer Overlay */}
                {!showZhuyinText && isCurrent && (
                    <div className="absolute top-0 text-[10px] text-red-500 font-mono animate-pulse">
                        {timeUntilHint}
                    </div>
                )}

                <div className={`
                  text-2xl sm:text-3xl font-extrabold rounded-md px-2 py-1 border-2 min-w-[40px] text-center shadow-sm
                  ${isCurrent ? 'bg-blue-100 border-blue-500 text-black shadow-md' : ''}
                  ${isPast ? 'bg-green-100 border-green-500 text-green-700' : ''}
                  ${!isCurrent && !isPast ? 'bg-white border-gray-400 text-gray-400' : ''}
                `}>
                  {charData.char}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  // Calculate predicted boss damage for UI
  const predictedBossDamage = Math.ceil((10 + wave * 2) * playerStats.damageTakenMultiplier);
  const isFatalAttack = predictedBossDamage >= playerStats.hp;

  return (
    <div className={`min-h-screen bg-gray-900 text-white flex flex-col items-center overflow-hidden relative font-sans ${isPlayerHit ? 'animate-[screenShake_0.5s_linear]' : ''}`}>
      
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-800 to-gray-900 -z-10"></div>

      {/* Main Container */}
      <div className="w-full max-w-3xl flex flex-col h-screen max-h-screen">
          
          {/* Header (Minimal) */}
          <header className="flex justify-between items-center py-2 px-4 border-b border-gray-800 bg-gray-900 z-20 shrink-0">
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent cursor-pointer" onClick={() => { setGameState(GameState.MENU); audioManager.stopBGM(); }}>
              ㄅㄆㄇ大師
            </h1>
            <div className="flex items-center gap-2">
                {(gameState === GameState.PLAYING || gameState === GameState.PAUSED) && (
                    <button onClick={togglePause} className="text-gray-400 hover:text-white px-2 text-sm border border-gray-700 rounded bg-gray-800">{gameState === GameState.PAUSED ? '▶' : '||'}</button>
                )}
                <button onClick={toggleVoice} className={`text-xs px-2 py-1 rounded border ${isVoiceEnabled ? 'bg-blue-900 border-blue-500 text-blue-200' : 'bg-gray-800 border-gray-600 text-gray-500'}`}>
                    {isVoiceEnabled ? '朗讀開啟' : '朗讀關閉'}
                </button>
                <button onClick={toggleMute} className="text-lg">
                    {isMuted ? '🔇' : '🔊'}
                </button>
            </div>
          </header>

          {/* GAME CONTENT */}
          <main className="flex-1 flex flex-col relative w-full overflow-hidden">
            
            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 z-50">
                    <div className="text-2xl font-bold text-blue-400 animate-pulse">載入中...</div>
                </div>
            )}

            {/* MENU STATE */}
            {gameState === GameState.MENU && (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
                 {/* Filter Settings ... (Same as before) */}
                <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 backdrop-blur-sm w-full max-w-2xl mb-8">
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

                {/* Difficulty Selection */}
                <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 backdrop-blur-sm w-full max-w-2xl mb-8">
                    <h2 className="text-lg font-bold text-gray-300 mb-4 text-left border-l-4 border-red-500 pl-3">選擇難易度</h2>
                    <div className="grid grid-cols-3 gap-4">
                         <button onClick={() => setDifficulty(Difficulty.EASY)} className={`p-4 rounded-xl border-2 transition-all ${difficulty === Difficulty.EASY ? 'bg-green-900/50 border-green-500' : 'bg-gray-700 border-gray-600'}`}>
                             <div className="font-bold text-green-400">簡單</div>
                             <div className="text-xs text-gray-400 mt-1">Boss 速度 50%</div>
                         </button>
                         <button onClick={() => setDifficulty(Difficulty.NORMAL)} className={`p-4 rounded-xl border-2 transition-all ${difficulty === Difficulty.NORMAL ? 'bg-yellow-900/50 border-yellow-500' : 'bg-gray-700 border-gray-600'}`}>
                             <div className="font-bold text-yellow-400">一般</div>
                             <div className="text-xs text-gray-400 mt-1">Boss 速度 80%</div>
                         </button>
                         <button onClick={() => setDifficulty(Difficulty.HARD)} className={`p-4 rounded-xl border-2 transition-all ${difficulty === Difficulty.HARD ? 'bg-red-900/50 border-red-500' : 'bg-gray-700 border-gray-600'}`}>
                             <div className="font-bold text-red-400">困難</div>
                             <div className="text-xs text-gray-400 mt-1">Boss 速度 100%</div>
                         </button>
                    </div>
                </div>

                {/* Class Selection */}
                <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 backdrop-blur-sm w-full max-w-2xl mb-8">
                    <h2 className="text-lg font-bold text-gray-300 mb-4 text-left border-l-4 border-yellow-500 pl-3">選擇職業</h2>
                    <div className="grid grid-cols-3 gap-4">
                        {PLAYER_CLASSES.map(cls => (
                            <div 
                                key={cls.id} 
                                onClick={() => setSelectedClass(cls)}
                                className={`
                                    cursor-pointer p-3 rounded-xl border-2 transition-all flex flex-col items-center text-center
                                    ${selectedClass.id === cls.id ? 'bg-yellow-900/40 border-yellow-500 scale-105' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}
                                `}
                            >
                                <div className="text-3xl mb-1 flex justify-center">{renderAvatar(cls.avatar)}</div>
                                <div className="font-bold text-sm mb-1">{cls.name}</div>
                                <div className="text-[10px] text-gray-300 leading-tight">{cls.description}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 w-full max-w-2xl">
                  <h2 className="text-2xl font-bold mb-2 text-center">開始遊戲</h2>
                  <div className="grid md:grid-cols-2 gap-6 w-full">
                    <div className={`group bg-gray-800 hover:bg-gray-750 p-6 rounded-2xl border border-gray-700 hover:border-blue-500 transition-all cursor-pointer relative overflow-hidden text-left ${!isFilterValid ? 'opacity-50 grayscale' : ''}`} onClick={() => startGame(GameMode.LEARNING)}>
                      <h3 className="text-2xl font-bold text-blue-400 mb-2">練習模式</h3>
                      <p className="text-gray-300 text-sm">無限挑戰，鍵盤提示</p>
                    </div>
                    <div className={`group bg-gray-800 hover:bg-gray-750 p-6 rounded-2xl border border-gray-700 hover:border-purple-500 transition-all cursor-pointer relative overflow-hidden text-left ${!isFilterValid ? 'opacity-50 grayscale' : ''}`} onClick={() => startGame(GameMode.MEMORY)}>
                      <h3 className="text-2xl font-bold text-purple-400 mb-2">測驗模式</h3>
                      <p className="text-gray-300 text-sm">無限挑戰，隱藏提示</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PLAYING / PAUSED STATE (POKEMON BATTLE STYLE) */}
            {(gameState === GameState.PLAYING || gameState === GameState.CHOOSING_SKILL || gameState === GameState.PAUSED) && (
              <div className="flex flex-col h-full w-full">
                
                {/* 1. BATTLE SCENE (Top Half) */}
                <div className="relative w-full h-48 sm:h-64 bg-gray-800 border-b-4 border-black overflow-hidden shrink-0">
                    {/* Background Floor */}
                    <div className="absolute inset-0 bg-gradient-to-b from-gray-700 to-gray-800"></div>
                    <div className="absolute bottom-0 w-full h-1/3 bg-gray-600 skew-x-12 origin-bottom-left opacity-30"></div>

                    {/* --- OPPONENT (BOSS) --- */}
                    {/* Boss HP Box (Top Left) */}
                    <div className="absolute top-2 left-2 z-20 bg-gray-100 border-2 border-gray-600 rounded p-2 px-3 shadow-lg min-w-[180px] sm:min-w-[240px]">
                        <div className="flex justify-between items-baseline mb-1">
                            <span className="text-base sm:text-xl font-bold text-black uppercase">{currentBoss.name}</span>
                            <span className="text-sm sm:text-lg font-bold text-black">Lv.{wave * 5}</span>
                        </div>
                        <div className="w-full h-4 sm:h-6 bg-gray-300 rounded-full overflow-hidden border-2 border-gray-400 relative">
                             <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${(bossHp / bossMaxHp) * 100}%` }}></div>
                             <div className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs font-bold text-white drop-shadow-md">
                                 {bossHp} / {bossMaxHp}
                             </div>
                        </div>
                        {/* Attack Bar */}
                        {!isExploding && (
                            <div className="mt-1 w-full h-2 sm:h-3 bg-gray-300 rounded-full overflow-hidden relative">
                                {bossStunTime > 0 ? (
                                    <div className="w-full h-full bg-blue-400 animate-pulse"></div>
                                ) : (
                                    <div className={`h-full transition-all duration-100 ${enemyAttackProgress > 90 ? 'bg-yellow-500 animate-pulse' : 'bg-orange-300'}`} style={{ width: `${enemyAttackProgress}%` }}></div>
                                )}
                            </div>
                        )}
                        {/* Status/Warning Text */}
                        <div className="flex justify-between items-center mt-1">
                             {bossStunTime > 0 ? (
                                <div className="text-[10px] text-blue-600 font-bold text-center">暈眩 {bossStunTime}s</div>
                             ) : (
                                <div className="text-[10px] text-gray-500 font-bold">集氣中...</div>
                             )}
                             
                             {/* Damage Prediction */}
                             {!isExploding && (
                                <div className={`text-[10px] font-bold flex items-center gap-1 ${isFatalAttack ? 'text-red-600 animate-pulse' : 'text-gray-600'}`}>
                                    <span>⚔️ {predictedBossDamage}</span>
                                    {isFatalAttack && <span className="bg-red-600 text-white px-1 rounded ml-1">危!</span>}
                                </div>
                             )}
                        </div>
                    </div>

                    {/* Boss Avatar (Top Right Area) */}
                    <div className="absolute top-2 sm:top-8 right-4 sm:right-8 z-10 flex flex-col items-center">
                         {isExploding ? (
                            <div className="text-8xl animate-[explosion_0.8s_ease-out_forwards]">💥</div>
                        ) : (
                            <div className={`
                                text-6xl sm:text-8xl transition-transform duration-300 drop-shadow-2xl relative 
                                ${isBossShaking ? 'translate-x-1 translate-y-1 rotate-3' : ''} 
                                ${isBossCharging ? 'animate-[bossCharge_1s_ease-in-out_infinite] brightness-125' : ''}
                                ${isBossAttacking ? 'animate-[bossLunge_0.5s_ease-out] z-50' : ''}
                            `}>
                                {currentBoss.emoji}
                                {bossStunTime > 0 && (
                                    <div className="absolute -top-4 left-0 w-full text-center text-4xl animate-spin-slow">💫</div>
                                )}
                                {/* Charging Effect Overlay */}
                                {isBossCharging && (
                                    <div className="absolute inset-0 rounded-full bg-red-500/30 blur-xl animate-pulse -z-10"></div>
                                )}
                            </div>
                        )}
                        {/* Boss Platform */}
                        <div className="w-24 h-6 bg-gray-900/40 rounded-[50%] blur-sm mt-[-10px]"></div>
                    </div>

                    {/* --- PLAYER (PROTAGONIST) --- */}
                    {/* Player Avatar (Bottom Left Area) */}
                    <div className="absolute bottom-0 left-8 z-10 flex flex-col items-center">
                        <div className={`
                            text-6xl sm:text-7xl drop-shadow-2xl transform scale-x-[-1] transition-transform duration-300
                            ${(selectedClass.id === 'SWORDSMAN' || selectedClass.id === 'ASSASSIN') ? '-rotate-12' : ''}
                        `}>
                            {/* Dynamic Avatar based on selected class */}
                            {renderAvatar(selectedClass.avatar)}
                        </div>
                         {/* Player Platform */}
                         <div className="w-20 h-6 bg-gray-900/40 rounded-[50%] blur-sm mt-[-5px]"></div>
                    </div>

                    {/* Player HP Box (Bottom Right) */}
                    <div className="absolute bottom-4 sm:bottom-6 right-2 z-20 bg-gray-100 border-2 border-gray-600 rounded p-2 px-3 shadow-lg min-w-[180px] sm:min-w-[240px]">
                        <div className="flex justify-between items-baseline mb-1">
                            <span className="text-base sm:text-xl font-bold text-black uppercase">{selectedClass.name}</span>
                            <span className="text-sm sm:text-lg font-bold text-black">{Math.ceil(playerStats.hp)}/{playerStats.maxHp}</span>
                        </div>
                        <div className="w-full h-4 sm:h-6 bg-gray-300 rounded-full overflow-hidden border-2 border-gray-400">
                             <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${(playerStats.hp / playerStats.maxHp) * 100}%` }}></div>
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500 text-right mt-0.5">Exp: {score}</div>
                    </div>

                    {/* Damage Numbers Overlay */}
                    {damageEffects.map(effect => {
                        // Render logic based on target and sign
                        // Boss Damage: Yellow/White, always shown as number (usually positive input)
                        // Player Damage: Red negative
                        // Player Heal: Green positive
                        
                        let text = '';
                        let colorClass = '';
                        let positionClass = '';

                        if (effect.target === 'BOSS') {
                            text = (effect.value > 0 ? '' : '') + Math.abs(Math.floor(effect.value)); // Boss usually takes damage
                            colorClass = effect.isCritical ? 'text-4xl text-yellow-400' : 'text-2xl text-white';
                            positionClass = 'left-3/4 top-1/3';
                            
                            // Special Labels (Speed!, Perfect!)
                            if (effect.label) {
                                text = effect.label + " " + text;
                                colorClass = 'text-3xl text-cyan-300 font-extrabold';
                            }

                        } else {
                            // PLAYER
                            if (effect.value > 0) {
                                // HEAL
                                text = '+' + Math.abs(Math.floor(effect.value));
                                colorClass = 'text-3xl text-green-500';
                            } else {
                                // DAMAGE
                                text = '-' + Math.abs(Math.floor(effect.value));
                                colorClass = 'text-3xl text-red-500';
                            }
                            positionClass = 'left-1/4 bottom-1/3';
                        }
                        
                        return (
                            <div key={effect.id} className={`absolute font-bold select-none animate-[floatUp_0.8s_ease-out_forwards] ${colorClass} ${positionClass}`} style={{ transform: `translate(${effect.x}px, ${effect.y}px)`, textShadow: '2px 2px 0px #000' }}>
                                {text} {effect.isCritical && '!'}
                            </div>
                        );
                    })}
                    
                    {/* Projectiles */}
                    {projectiles.map(p => {
                        let styleClass = "";
                        // Apply different styles based on Class Variant
                        if (p.variant === 'MAGE') {
                            styleClass = "w-4 h-4 rounded-full bg-purple-400 shadow-[0_0_10px_#a855f7] shadow-purple-500";
                        } else if (p.variant === 'SWORDSMAN') {
                            // Slash Wave: Rotated bar
                            styleClass = "w-8 h-2 bg-blue-100 shadow-[0_0_10px_#fff] rotate-[45deg] rounded-full";
                        } else if (p.variant === 'ASSASSIN') {
                            // Dagger: Thin, sharp, green
                            styleClass = "w-6 h-1 bg-green-400 shadow-[0_0_5px_#4ade80] rotate-[-45deg]";
                        }

                        return (
                            <div 
                                key={p.id} 
                                className={`absolute z-30 pointer-events-none ${styleClass}`} 
                                style={{ 
                                    // Start Position
                                    left: '20%', 
                                    bottom: '20%', 
                                    animation: 'shootProjectile 0.4s ease-in forwards' 
                                }}
                            ></div>
                        );
                    })}
                </div>

                {/* 2. COMMAND DECK (Middle Section - The "White Box" & Controls) */}
                <div className="w-full bg-gray-900 flex flex-col sm:flex-row gap-2 p-2 shrink-0">
                    {/* Left: The "Question Box" */}
                    <div className="flex-1 bg-white border-4 border-gray-600 rounded-lg p-2 min-h-[100px] flex items-center relative shadow-inner">
                        <div className="absolute top-1 left-2 text-xs text-gray-400">
                             {currentWord ? `${currentWord.publisher} | ${currentWord.lesson}` : ''}
                        </div>
                        {renderCurrentWordDisplay()}
                        {/* Triangle cursor indicator at bottom right to mimic RPG text box */}
                        <div className="absolute bottom-2 right-2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-500 animate-bounce"></div>
                    </div>

                    {/* Right: Info/Stats Panel (Compact) */}
                    <div className="w-full sm:w-32 bg-gray-800 border-2 border-gray-600 rounded-lg p-2 flex flex-row sm:flex-col justify-between items-center text-xs sm:text-sm">
                        <div className="flex flex-col items-center">
                            <span className="text-gray-400">WAVE</span>
                            <span className="text-yellow-400 font-bold text-xl">{wave}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-gray-400">COMBO</span>
                            <span className="text-blue-400 font-bold text-xl">{comboStreak}</span>
                        </div>
                         <Button variant="outline" className="text-xs px-2 py-1 h-auto" onClick={() => { setGameState(GameState.MENU); audioManager.stopBGM(); }}>
                            逃跑
                        </Button>
                    </div>
                </div>

                {/* 3. INPUT AREA (Bottom Section - Keyboard) */}
                <div className="flex-1 bg-gray-900 px-1 pb-1 flex items-start justify-center overflow-y-auto">
                    <VirtualKeyboard 
                      activeKey={currentTargetKey || null}
                      pressedKey={lastPressedKey}
                      showHints={showHint}
                      onKeyPress={handleInput}
                    />
                </div>
              </div>
            )}

            {/* OVERLAYS (Pause, Skills, Game Over) */}
            {gameState === GameState.PAUSED && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4">
                    <h2 className="text-4xl font-bold text-white mb-8">遊戲暫停</h2>
                    <div className="flex flex-col gap-4 w-64 mb-10">
                        <Button onClick={togglePause} className="w-full bg-green-600 hover:bg-green-500 text-lg">▶ 繼續遊戲</Button>
                        <Button onClick={() => startGame(gameMode)} className="w-full bg-blue-600 hover:bg-blue-500">↻ 重新遊戲</Button>
                        <Button onClick={() => setGameState(GameState.MENU)} className="w-full bg-gray-600 hover:bg-gray-500">⌂ 返回主頁</Button>
                    </div>
                    
                    {/* Acquired Skills List */}
                    {acquiredSkills.length > 0 && (
                        <div className="w-full max-w-md bg-gray-800/50 p-4 rounded-lg">
                            <h3 className="text-gray-300 font-bold mb-2 text-center">已獲得技能</h3>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {acquiredSkills.map((skill, idx) => (
                                    <div key={idx} className={`text-xs px-2 py-1 rounded border ${skill.rarity === 'COMMON' ? 'bg-gray-700 text-white border-gray-500' : skill.rarity === 'RARE' ? 'bg-blue-900 text-blue-200 border-blue-500' : 'bg-purple-900 text-purple-200 border-purple-500'}`} title={skill.description}>
                                        {skill.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {gameState === GameState.CHOOSING_SKILL && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4">
                    <h2 className="text-3xl font-bold text-white mb-2">升級！選擇技能</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl mt-4">
                        {skillCandidates.map(skill => (
                            <div key={skill.id} className={`cursor-pointer p-4 rounded-xl border-2 transition-all hover:scale-105 flex flex-col items-center text-center ${skill.rarity === 'COMMON' ? 'bg-gray-800 border-gray-600' : skill.rarity === 'RARE' ? 'bg-blue-900/50 border-blue-600' : 'bg-purple-900/50 border-purple-600'}`} onClick={() => selectSkill(skill)}>
                                <div className="text-xs font-bold mb-1 opacity-70">{skill.rarity}</div>
                                <h3 className="text-lg font-bold mb-2">{skill.name}</h3>
                                <p className="text-sm text-gray-300">{skill.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {gameState === GameState.FINISHED && (
               <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-8">
                  <h2 className="text-5xl font-bold text-red-500 mb-4">GAME OVER</h2>
                  <p className="text-gray-300 mb-2 text-xl">你在第 {wave} 波倒下了。</p>
                  <p className="text-gray-400 mb-8 text-sm">總分: {score} | 失誤: {errors}</p>
                  <div className="flex gap-4">
                      <Button onClick={() => setGameState(GameState.MENU)}>回主選單</Button>
                      <Button variant="secondary" onClick={() => startGame(gameMode)}>再次挑戰</Button>
                  </div>
               </div>
            )}
            
            {/* CSS Animations */}
            <style>{`
                @keyframes floatUp {
                    0% { opacity: 1; margin-top: 0; transform: scale(0.5); }
                    20% { transform: scale(1.2); }
                    100% { opacity: 0; margin-top: -50px; transform: scale(1); }
                }
                @keyframes shootProjectile {
                    0% { left: 20%; bottom: 20%; opacity: 1; transform: scale(1); }
                    100% { left: 85%; bottom: 80%; opacity: 0; transform: scale(0.5); }
                }
                @keyframes explosion {
                    0% { transform: scale(0.5) rotate(0deg); opacity: 1; }
                    50% { transform: scale(1.5) rotate(15deg); opacity: 1; }
                    100% { transform: scale(2) rotate(-15deg); opacity: 0; }
                }
                @keyframes spin-slow {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes bossCharge {
                    0% { transform: scale(1); filter: brightness(1); }
                    50% { transform: scale(1.1); filter: brightness(1.5) drop-shadow(0 0 10px red); }
                    100% { transform: scale(1); filter: brightness(1); }
                }
                @keyframes bossLunge {
                    0% { transform: translate(0, 0); }
                    30% { transform: translate(10px, -10px) rotate(-5deg); } /* Wind up */
                    50% { transform: translate(-50px, 50px) scale(1.5); } /* Strike */
                    100% { transform: translate(0, 0); }
                }
                @keyframes screenShake {
                    0% { transform: translate(0, 0); }
                    25% { transform: translate(-10px, 10px); }
                    50% { transform: translate(10px, -10px); }
                    75% { transform: translate(-10px, -10px); }
                    100% { transform: translate(0, 0); }
                }
                .animate-spin-slow {
                    animation: spin-slow 3s linear infinite;
                }
            `}</style>
          </main>
      </div>
    </div>
  );
};

export default App;
