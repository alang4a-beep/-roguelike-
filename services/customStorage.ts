
export const CUSTOM_STORAGE_KEY = 'zhuyin_custom_vocab_v1';

// The template structure to make the parser happy
const HEADER = `
【自訂題庫 (Custom)】
自訂等級 (Custom)
• 我的練習: `;

export const getCustomCorpus = (): string => {
  const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
  if (!raw || raw.trim() === '') return '';
  // Wrap the raw item string in the standard corpus format
  return HEADER + raw;
};

export const getRawCustomItems = (): string[] => {
  const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
  if (!raw) return [];
  return raw.split('、').filter(s => s.trim() !== '');
};

// Smartly format a raw input string into the game's expected format
// Input: "紅(ㄏㄨㄥˊ)色" -> Output: "(紅)ㄏㄨㄥˊ色"
// Input: "(紅)ㄏㄨㄥˊ色" -> Output: "(紅)ㄏㄨㄥˊ色" (Keep as is)
const normalizeCustomItem = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return '';

  // Check if it already matches the standard format (Target)Zhuyin
  // Simple check: starts with (
  if (trimmed.startsWith('(')) return trimmed;

  // Regex to find "Char(Zhuyin)" pattern
  // Looks for: any non-parenthesis char, followed by (Zhuyin)
  // Zhuyin range includes Bopomofo, tones, and space
  const regex = /([^(\s])\(([ \u3105-\u3129\u02CA\u02C7\u02CB\u02D9]+)\)/;
  
  const match = trimmed.match(regex);
  if (match) {
    // match[0] is like "紅(ㄏㄨㄥˊ)"
    // match[1] is "紅"
    // match[2] is "ㄏㄨㄥˊ"
    // We want to replace "紅(ㄏㄨㄥˊ)" with "(紅)ㄏㄨㄥˊ"
    return trimmed.replace(regex, '($1)$2');
  }

  // If no pattern matched, return as is (might be invalid but let parser handle or ignore)
  return trimmed;
};

export const saveCustomCorpusFromText = (rawText: string) => {
  // 1. Split by common delimiters: newline, fullwidth semicolon, halfwidth semicolon, ideographic comma
  const segments = rawText.split(/[\n;；、]/);
  
  // 2. Normalize and filter
  const validItems = segments
    .map(s => s.trim())
    .filter(s => s !== '')
    .map(normalizeCustomItem);

  // 3. Join with standard delimiter '、'
  const storageString = validItems.join('、');
  
  localStorage.setItem(CUSTOM_STORAGE_KEY, storageString);
};

export const addCustomItem = (pre: string, target: string, zhuyin: string, post: string) => {
  const newItem = `${pre}(${target})${zhuyin}${post}`;
  const currentItems = getRawCustomItems();
  currentItems.push(newItem);
  localStorage.setItem(CUSTOM_STORAGE_KEY, currentItems.join('、'));
};

export const removeCustomItem = (index: number) => {
  const currentItems = getRawCustomItems();
  if (index >= 0 && index < currentItems.length) {
    currentItems.splice(index, 1);
    localStorage.setItem(CUSTOM_STORAGE_KEY, currentItems.join('、'));
  }
};
