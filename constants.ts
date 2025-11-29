
import { KeyConfig, Skill, BuffType, BossConfig, PlayerClassConfig } from './types';

// Map specific Zhuyin symbols to their QWERTY key counterparts
export const ZHUYIN_TO_KEY: Record<string, string> = {
  'ㄅ': '1', 'ㄆ': 'q', 'ㄇ': 'a', 'ㄈ': 'z',
  'ㄉ': '2', 'ㄊ': 'w', 'ㄋ': 's', 'ㄌ': 'x',
  'ㄍ': '3', 'ㄎ': 'e', 'ㄏ': 'd',
  'ㄐ': '4', 'ㄑ': 'r', 'ㄒ': 'f',
  'ㄓ': '5', 'ㄔ': 't', 'ㄕ': 'g', 'ㄖ': 'b',
  'ㄗ': 'y', 'ㄘ': 'h', 'ㄙ': 'n',
  'ㄧ': 'u', 'ㄨ': 'j', 'ㄩ': 'm',
  'ㄚ': '8', 'ㄛ': 'i', 'ㄜ': 'k', 'ㄝ': ',',
  'ㄞ': '9', 'ㄟ': 'o', 'ㄠ': 'l', 'ㄡ': '.',
  'ㄢ': '0', 'ㄣ': 'p', 'ㄤ': ';', 'ㄥ': '/',
  'ㄦ': '-',
  'ˊ': '6', // 2nd tone
  'ˇ': '3', // 3rd tone
  'ˋ': '4', // 4th tone
  '˙': '7', // Neutral tone
};

// Reverse map for display logic
export const KEY_TO_ZHUYIN: Record<string, string> = Object.entries(ZHUYIN_TO_KEY).reduce((acc, [k, v]) => {
  acc[v] = k;
  return acc;
}, {} as Record<string, string>);

// RE-EXPORTING CORRECTED MAPS
export const CORRECT_ZHUYIN_TO_KEY: Record<string, string> = {
  'ㄅ': '1', 'ㄉ': '2', 'ˇ': '3', 'ˋ': '4', 'ㄓ': '5', 'ˊ': '6', '˙': '7', 'ㄚ': '8', 'ㄞ': '9', 'ㄢ': '0', 'ㄦ': '-',
  'ㄆ': 'q', 'ㄊ': 'w', 'ㄍ': 'e', 'ㄐ': 'r', 'ㄔ': 't', 'ㄗ': 'y', 'ㄧ': 'u', 'ㄛ': 'i', 'ㄟ': 'o', 'ㄣ': 'p',
  'ㄇ': 'a', 'ㄋ': 's', 'ㄎ': 'd', 'ㄑ': 'f', 'ㄕ': 'g', 'ㄘ': 'h', 'ㄨ': 'j', 'ㄜ': 'k', 'ㄠ': 'l', 'ㄤ': ';',
  'ㄈ': 'z', 'ㄌ': 'x', 'ㄏ': 'c', 'ㄒ': 'v', 'ㄖ': 'b', 'ㄙ': 'n', 'ㄩ': 'm', 'ㄝ': ',', 'ㄡ': '.', 'ㄥ': '/'
};

export const CORRECT_KEYBOARD_ROWS: KeyConfig[][] = [
  [
    { label: 'ㄅ', subLabel: '1', code: '1' }, { label: 'ㄉ', subLabel: '2', code: '2' }, { label: 'ˇ', subLabel: '3', code: '3', isTone: true }, { label: 'ˋ', subLabel: '4', code: '4', isTone: true }, { label: 'ㄓ', subLabel: '5', code: '5' }, { label: 'ˊ', subLabel: '6', code: '6', isTone: true }, { label: '˙', subLabel: '7', code: '7', isTone: true }, { label: 'ㄚ', subLabel: '8', code: '8' }, { label: 'ㄞ', subLabel: '9', code: '9' }, { label: 'ㄢ', subLabel: '0', code: '0' }, { label: 'ㄦ', subLabel: '-', code: '-' },
  ],
  [
    { label: 'ㄆ', subLabel: 'q', code: 'q' }, { label: 'ㄊ', subLabel: 'w', code: 'w' }, { label: 'ㄍ', subLabel: 'e', code: 'e' }, { label: 'ㄐ', subLabel: 'r', code: 'r' }, { label: 'ㄔ', subLabel: 't', code: 't' }, { label: 'ㄗ', subLabel: 'y', code: 'y' }, { label: 'ㄧ', subLabel: 'u', code: 'u' }, { label: 'ㄛ', subLabel: 'i', code: 'i' }, { label: 'ㄟ', subLabel: 'o', code: 'o' }, { label: 'ㄣ', subLabel: 'p', code: 'p' },
  ],
  [
    { label: 'ㄇ', subLabel: 'a', code: 'a' }, { label: 'ㄋ', subLabel: 's', code: 's' }, { label: 'ㄎ', subLabel: 'd', code: 'd' }, { label: 'ㄑ', subLabel: 'f', code: 'f' }, { label: 'ㄕ', subLabel: 'g', code: 'g' }, { label: 'ㄘ', subLabel: 'h', code: 'h' }, { label: 'ㄨ', subLabel: 'j', code: 'j' }, { label: 'ㄜ', subLabel: 'k', code: 'k' }, { label: 'ㄠ', subLabel: 'l', code: 'l' }, { label: 'ㄤ', subLabel: ';', code: ';' },
  ],
  [
    { label: 'ㄈ', subLabel: 'z', code: 'z' }, { label: 'ㄌ', subLabel: 'x', code: 'x' }, { label: 'ㄏ', subLabel: 'c', code: 'c' }, { label: 'ㄒ', subLabel: 'v', code: 'v' }, { label: 'ㄖ', subLabel: 'b', code: 'b' }, { label: 'ㄙ', subLabel: 'n', code: 'n' }, { label: 'ㄩ', subLabel: 'm', code: 'm' }, { label: 'ㄝ', subLabel: ',', code: ',' }, { label: 'ㄡ', subLabel: '.', code: '.' }, { label: 'ㄥ', subLabel: '/', code: '/' },
  ],
  [
    { label: '一聲', subLabel: 'Space', code: ' ', isTone: true }
  ]
];

// Fallback vocabulary in case API fails
export const FALLBACK_VOCABULARY = [
  { chars: "題目", zhuyin: ["ㄊ一ˊ", "ㄇㄨˋ"] },
  { chars: "練習", zhuyin: ["ㄌ一ㄢˋ", "ㄒ一ˊ"] },
  { chars: "電腦", zhuyin: ["ㄉ一ㄢˋ", "ㄋㄠˇ"] },
  { chars: "快樂", zhuyin: ["ㄎㄨㄞˋ", "ㄌㄜˋ"] },
  { chars: "台灣", zhuyin: ["ㄊㄞˊ", "ㄨㄢ"] },
];

export const PLAYER_CLASSES: PlayerClassConfig[] = [
  {
    id: 'SWORDSMAN',
    name: '劍士',
    avatar: '🤺',
    description: '攻守平衡，無特殊副作用',
    baseCritChance: 0.05,
    damageTakenMultiplier: 1.0
  },
  {
    id: 'ASSASSIN',
    name: '刺客',
    avatar: '⚔️',
    description: '自帶 30% 爆擊率，但防禦力低，承受傷害增加 20%',
    baseCritChance: 0.30,
    damageTakenMultiplier: 1.2
  },
  {
    id: 'MAGE',
    name: '法師',
    avatar: '🧙‍♂️',
    description: '法術攻擊成功時，有 5% 機率使 BOSS 暈眩 5 秒，但受傷害增加 30%',
    baseCritChance: 0.05,
    damageTakenMultiplier: 1.3
  }
];

// ROGUELIKE SKILLS POOL
export const ROGUELIKE_SKILLS: Skill[] = [
  {
    id: 'heal_small',
    name: 'OK繃',
    description: '回復 20 點生命值',
    type: BuffType.HEAL,
    value: 20,
    rarity: 'COMMON'
  },
  {
    id: 'heal_large',
    name: '急救箱',
    description: '回復 50 點生命值',
    type: BuffType.HEAL,
    value: 50,
    rarity: 'RARE'
  },
  {
    id: 'max_hp_up',
    name: '強身健體',
    description: '最大生命值增加 30',
    type: BuffType.MAX_HP_UP,
    value: 30,
    rarity: 'COMMON'
  },
  {
    id: 'attack_up_small',
    name: '磨刀石',
    description: '攻擊力增加 10%',
    type: BuffType.ATTACK_UP,
    value: 0.1,
    rarity: 'COMMON'
  },
  {
    id: 'attack_up_large',
    name: '雷霆之力',
    description: '攻擊力增加 25%',
    type: BuffType.ATTACK_UP,
    value: 0.25,
    rarity: 'RARE'
  },
  {
    id: 'crit_rate_up',
    name: '幸運四葉草',
    description: '爆擊率增加 10%',
    type: BuffType.CRIT_RATE_UP,
    value: 0.1,
    rarity: 'RARE'
  },
  {
    id: 'freeze_enemy',
    name: '寒冰咒',
    description: '敵人攻擊速度減緩 15%',
    type: BuffType.FREEZE_ENEMY,
    value: 0.15,
    rarity: 'EPIC'
  },
  {
    id: 'divine_shield',
    name: '神聖護盾',
    description: '打錯字不會扣生命',
    type: BuffType.SHIELD,
    value: 1,
    rarity: 'EPIC'
  },
  {
    id: 'lifesteal',
    name: '吸血',
    description: '輸入完一個題目，回復 5 點生命',
    type: BuffType.LIFESTEAL,
    value: 5,
    rarity: 'RARE'
  },
  {
    id: 'burning_curse',
    name: '燃燒咒',
    description: '每秒扣除 BOSS 20 點血量',
    type: BuffType.BURN,
    value: 20,
    rarity: 'RARE'
  },
  {
    id: 'combo_missile',
    name: '連擊飛彈',
    description: '每連續 10 次正確輸入，發射飛彈攻擊 BOSS (50傷害)',
    type: BuffType.COMBO_ATTACK,
    value: 50,
    rarity: 'EPIC'
  },
  {
    id: 'quick_draw',
    name: '拔刀術',
    description: '打字間隔小於 0.3 秒，該次傷害增加 50%',
    type: BuffType.SPEED_BONUS,
    value: 0.5,
    rarity: 'EPIC'
  },
  {
    id: 'precision_strike',
    name: '弱點擊破',
    description: '單字零失誤完成，造成 300% 爆發傷害',
    type: BuffType.PERFECT_BONUS,
    value: 3.0,
    rarity: 'EPIC'
  }
];

export const BOSS_ROSTER: BossConfig[] = [
  { name: '暗影惡龍', emoji: '🐉', colorClass: 'text-purple-500' },
  { name: '獨眼巨人', emoji: '👹', colorClass: 'text-red-600' },
  { name: '機械戰神', emoji: '🤖', colorClass: 'text-blue-400' },
  { name: '宇宙侵略者', emoji: '👽', colorClass: 'text-green-500' },
  { name: '幽靈船長', emoji: '👻', colorClass: 'text-gray-400' },
  { name: '骷髏領主', emoji: '☠️', colorClass: 'text-gray-200' },
  { name: '吸血鬼伯爵', emoji: '🧛', colorClass: 'text-red-700' },
  { name: '生化喪屍', emoji: '🧟', colorClass: 'text-green-700' },
  { name: '暴龍王', emoji: '🦖', colorClass: 'text-orange-600' },
  { name: '深海巨怪', emoji: '🦑', colorClass: 'text-pink-600' },
  { name: '深淵惡魔', emoji: '👿', colorClass: 'text-purple-800' },
  { name: '瘋狂小丑', emoji: '🤡', colorClass: 'text-yellow-500' },
];
