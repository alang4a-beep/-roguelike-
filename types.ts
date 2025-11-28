
export enum GameMode {
  LEARNING = 'LEARNING', // Mode 1: Show Zhuyin immediately
  MEMORY = 'MEMORY',     // Mode 2: Hide Zhuyin, show hint after 10s
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  CHOOSING_SKILL = 'CHOOSING_SKILL', // New state for Roguelike skill selection
  FINISHED = 'FINISHED',
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
}

export interface Projectile {
  id: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
}

// Roguelike Specific Types
export enum BuffType {
  HEAL = 'HEAL',
  MAX_HP_UP = 'MAX_HP_UP',
  ATTACK_UP = 'ATTACK_UP',
  CRIT_RATE_UP = 'CRIT_RATE_UP',
  FREEZE_ENEMY = 'FREEZE_ENEMY', // Slows down enemy attack bar
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  type: BuffType;
  value: number; // e.g., 20 for heal, 0.1 for 10% attack up
  rarity: 'COMMON' | 'RARE' | 'EPIC';
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  attackMultiplier: number;
  critChance: number;
  critDamageMultiplier: number;
  enemySpeedReduction: number; // Percentage to slow down enemy
}

export interface BossConfig {
  name: string;
  emoji: string;
  colorClass: string; // Tailwind color class for text/glow
  description?: string;
}
