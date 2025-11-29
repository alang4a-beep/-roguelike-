
import { VocabularyItem, ZhuyinChar, GameFilters } from '../types';
import { CORRECT_ZHUYIN_TO_KEY } from '../constants';
import { CORPUS_DATA } from './corpus';
import { getCustomCorpus } from './customStorage';

// Helper to convert raw zhuyin string to keys array
const convertZhuyinToKeys = (zhuyin: string): string[] => {
  const keys: string[] = [];
  // Specific tone marks in Zhuyin: ˊ (2nd), ˇ (3rd), ˋ (4th), ˙ (Neutral)
  // If none of these exist, it implies First Tone (Space)
  const toneChars = ['ˊ', 'ˇ', 'ˋ', '˙'];
  let hasTone = false;

  for (const char of zhuyin) {
    if (toneChars.includes(char)) hasTone = true;

    const key = CORRECT_ZHUYIN_TO_KEY[char];
    if (key) {
      keys.push(key);
    } else if (char === ' ') {
        // Ignore spaces inside the raw string if they exist, handled by logic below
    }
  }

  // If there are keys (it's not empty/context) AND no explicit tone mark was found,
  // it means it is a First Tone character, which requires the Space bar.
  if (keys.length > 0 && !hasTone) {
    keys.push(' ');
  }

  return keys;
};

// Parse a single question item line from the corpus
const parseCorpusItem = (text: string, idPrefix: string, publisher: string, grade: string, lesson: string): VocabularyItem | null => {
  // Regex to handle filled characters: (Char)Zhuyin
  // Format: PreContext(TargetChar)ZhuyinPostContext
  const regex = /^(.*?)(\((.*?)\))([\u3105-\u3129\u02CA\u02C7\u02CB\u02D9\s]+)(.*)$/;
  const match = text.trim().match(regex);

  if (!match) return null;

  const preContext = match[1].trim();
  const targetCharRaw = match[3]; // The character inside ()
  const zhuyinRaw = match[4].trim();
  const postContext = match[5].trim();

  const chars: ZhuyinChar[] = [];

  // 1. Add Pre-Context chars (no typing required)
  for (const char of preContext) {
    chars.push({
      char: char,
      zhuyin: '',
      keys: [],
      isContext: true
    });
  }

  // 2. Add Target (Typing required)
  const displayChar = targetCharRaw && targetCharRaw.trim() !== '' ? targetCharRaw : '( )';

  chars.push({
    char: displayChar,
    zhuyin: zhuyinRaw,
    keys: convertZhuyinToKeys(zhuyinRaw),
    isContext: false
  });

  // 3. Add Post-Context chars (no typing required)
  for (const char of postContext) {
    chars.push({
      char: char,
      zhuyin: '',
      keys: [],
      isContext: true
    });
  }

  return {
    id: idPrefix,
    text: text,
    chars: chars,
    publisher,
    grade,
    lesson
  };
};

let CACHED_ITEMS: VocabularyItem[] | null = null;
let CACHED_METADATA: { publishers: string[], grades: string[], lessons: string[] } | null = null;

export const parseCorpusData = () => {
  const items: VocabularyItem[] = [];
  const publishersSet = new Set<string>();
  const gradesSet = new Set<string>();
  const lessonsSet = new Set<string>();

  // Combine Static Corpus + Custom User Corpus
  const customData = getCustomCorpus();
  const fullData = CORPUS_DATA + '\n' + customData;

  const lines = fullData.split('\n');
  
  let currentPublisher = '通用';
  let currentGrade = '通用';

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('_')) return;

    // Detect Publisher: 【康軒 (Kangxuan)】
    const pubMatch = trimmed.match(/^【(.*?)(?:\s*\(.*\))?】/);
    if (pubMatch) {
      // Extract just the Chinese part usually, e.g. "康軒" from "康軒 (Kangxuan)"
      const rawPub = pubMatch[1]; 
      const cleanPub = rawPub.split(' ')[0]; 
      currentPublisher = cleanPub;
      publishersSet.add(cleanPub);
      return;
    }

    // Detect Grade: 一年級 (Grade 1) or 自訂等級
    const gradeMatch = trimmed.match(/^([一二三四五六]年級|自訂等級)/);
    if (gradeMatch) {
      currentGrade = gradeMatch[1];
      gradesSet.add(currentGrade);
      return;
    }

    // Parse Content Items: •	第 1 課: ...
    if (trimmed.startsWith('•')) {
      // Extract Lesson Name
      const parts = trimmed.split(':');
      const lessonRaw = parts[0].replace('•', '').trim(); // "第 1 課"
      lessonsSet.add(lessonRaw);
      
      const content = parts.slice(1).join(':'); 
      if (!content) return;

      const segments = content.split('、');
      segments.forEach((segment, segIdx) => {
        const parsed = parseCorpusItem(segment, `item-${lineIdx}-${segIdx}`, currentPublisher, currentGrade, lessonRaw);
        if (parsed) {
          items.push(parsed);
        }
      });
    }
  });

  // Natural sort for lessons
  const sortedLessons = Array.from(lessonsSet).sort((a, b) => {
    // Custom logic: keep "我的練習" at the top or bottom
    if (a.includes('我的練習')) return -1;
    if (b.includes('我的練習')) return 1;

    const extractNum = (s: string) => parseInt(s.match(/\d+/)?.[0] || '0', 10);
    return extractNum(a) - extractNum(b);
  });

  CACHED_ITEMS = items;
  CACHED_METADATA = {
    publishers: Array.from(publishersSet),
    grades: Array.from(gradesSet),
    lessons: sortedLessons
  };
};

// Initialize parsing immediately
parseCorpusData();

export const getCorpusMetadata = () => {
  // Always re-parse to ensure custom items added are reflected immediately
  parseCorpusData();
  return CACHED_METADATA || { publishers: [], grades: [], lessons: [] };
};

export const fetchVocabulary = async (count: number = 10, filters?: GameFilters): Promise<VocabularyItem[]> => {
  // Re-parse to catch updates
  parseCorpusData();

  if (!CACHED_ITEMS || CACHED_ITEMS.length === 0) {
    return []; 
  }

  // Filter items
  let filteredItems = CACHED_ITEMS;
  if (filters) {
    filteredItems = CACHED_ITEMS.filter(item => {
      const pubMatch = !filters.publishers.length || (item.publisher && filters.publishers.includes(item.publisher));
      const gradeMatch = !filters.grades.length || (item.grade && filters.grades.includes(item.grade));
      const lessonMatch = !filters.lessons.length || (item.lesson && filters.lessons.includes(item.lesson));
      return pubMatch && gradeMatch && lessonMatch;
    });
  }

  if (filteredItems.length === 0) {
    return [];
  }

  // Shuffle and pick `count` items
  const shuffled = [...filteredItems].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};
