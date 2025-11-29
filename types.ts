
export enum GameMode {
  LEARNING = 'LEARNING', // Mode 1: Show Zhuyin immediately
  MEMORY = 'MEMORY',     // Mode 2: Hide Zhuyin, show hint after 10s
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED', // New state for Pause Menu
  CHOOSING_SKILL = 'CHOOSING_SKILL', // New state for Roguelike skill selection
  FINISHED = 'FINISHED',
}

export enum Difficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARD = 'HARD'
}

export interface ZhuyinChar {
  char: string;
  zhuyin: string; // e.g., "ㄊ一ˊ"
  keys: string[]; // The required keystrokes, e.g., ['w', 'u', '6']
  isContext?: boolean; // If true, this character is just for display/context and not typed
}

export interface VocabularyItem {
  id: string;
  text: string;     // Full word string for reference
  chars: ZhuyinChar[];
  publisher?: string;
  grade?: string;
  lesson?: string;
}

export interface KeyConfig {
  label: string;    // The Zhuyin symbol, e.g., "ㄅ"
  subLabel: string; // The English key, e.g., "1"
  code: string;     // The event.key code usually
  isTone?: boolean;
}

export interface GameFilters {
  publishers: string[];
  grades: string[];
  lessons: string[];
}

export interface DamageEffect {
  id: number;
  value: number;
  x: number;
  y: number;
  isCritical: boolean;
  target: 'BOSS' | 'PLAYER'; // Who took damage
  label?: string; // New: For text effects like "Speed!" or "Perfect!"
}

export interface Projectile {
  id: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  variant: PlayerClassType; // Visual style based on class
}

// Roguelike Specific Types
export enum BuffType {
  HEAL = 'HEAL',
  MAX_HP_UP = 'MAX_HP_UP',
  ATTACK_UP = 'ATTACK_UP',
  CRIT_RATE_UP = 'CRIT_RATE_UP',
  FREEZE_ENEMY = 'FREEZE_ENEMY', // Slows down enemy attack bar
  SHIELD = 'SHIELD',             // Prevents damage from wrong inputs
  LIFESTEAL = 'LIFESTEAL',       // Heals on word completion
  BURN = 'BURN',                 // DOT damage to boss
  COMBO_ATTACK = 'COMBO_ATTACK', // Missiles on streak
  SPEED_BONUS = 'SPEED_BONUS',   // Damage up on fast typing
  PERFECT_BONUS = 'PERFECT_BONUS' // Massive damage on no-error word
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  type: BuffType;
  value: number; // e.g., 20 for heal, 0.1 for 10% attack up
  rarity: 'COMMON' | 'RARE' | 'EPIC';
}

export type PlayerClassType = 'SWORDSMAN' | 'ASSASSIN' | 'MAGE';

export interface PlayerClassConfig {
  id: PlayerClassType;
  name: string;
  avatar: string; // Emoji or Description
  description: string;
  baseCritChance: number;
  damageTakenMultiplier: number; // 1.0 = normal, 1.2 = +20% damage taken
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  attackMultiplier: number;
  critChance: number;
  critDamageMultiplier: number;
  damageTakenMultiplier: number; // New: For Assassin class
  enemySpeedReduction: number; // Percentage to slow down enemy
  hasShield: boolean;          // New: Divine Shield
  lifestealAmount: number;     // New: HP healed per word
  burnDamage: number;          // New: Damage per second to boss
  comboMissileDamage: number;  // New: Damage of missile fired every 10 hits
  speedBonusMultiplier: number; // New: Damage multiplier for fast typing
  perfectBonusMultiplier: number; // New: Damage multiplier for perfect words
}

export interface BossConfig {
  name: string;
  emoji: string;
  colorClass: string; // Tailwind color class for text/glow
  description?: string;
}
