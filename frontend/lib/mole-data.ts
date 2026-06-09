/**
 * Типы данных MolebotNFT для фронтенда
 */

/**
 * Raw on-chain MoleData (как возвращает getMoleData задеплоенного контракта).
 * Структура MolebotNFT.sol: { mood, levelIndex, cumulativePnl, lastTradeTs, isMythic }.
 * Поля serialNumber/personalityHash в контракте нет — серийный номер
 * равен tokenId (1 крот на кошелёк).
 */
export interface MoleDataRaw {
  mood: number;
  levelIndex: number;
  cumulativePnl: bigint;
  lastTradeTs: bigint;
  isMythic: boolean;
}

/** Обработанные данные для UI */
export interface MoleNFTInfo {
  tokenId: number;
  serialNumber: number;
  mood: number;
  levelIndex: number;
  levelName: string;
  cumulativePnl: number;
  isMythic: boolean;
  hasRevealed: boolean;
  tokenURI: string;
}

/** Уровни крота (из контракта: levelThresholds) */
export const LEVEL_NAMES: Record<number, string> = {
  0: 'Slumbering Mole',
  1: 'Digger',
  2: 'Scout',
  3: 'Tunneler',
  4: 'Excavator',
  5: 'Prospector',
  6: 'Treasure Hunter',
  7: 'Crypt Keeper',
  8: 'Shadow Mole',
};

/** Mood emoji */
export const MOOD_EMOJI: Record<number, string> = {
  0: '😒',
  1: '😐',
  2: '😏',
};

export const MOOD_LABEL: Record<number, string> = {
  0: 'Угрюмый',
  1: 'Нейтральный',
  2: 'Дерзкий',
};

/** Преобразование raw on-chain данных в UI-friendly формат */
export function parseMoleData(
  tokenId: number,
  raw: MoleDataRaw | null,
  revealed: boolean,
  uri: string,
): MoleNFTInfo | null {
  if (!raw) return null;
  const mood = Number(raw.mood);
  const levelIndex = Number(raw.levelIndex);
  return {
    tokenId,
    serialNumber: tokenId, // в контракте нет serialNumber — используем tokenId
    mood,
    levelIndex,
    levelName: LEVEL_NAMES[levelIndex] ?? `Level ${levelIndex}`,
    cumulativePnl: Number(raw.cumulativePnl) / 1e6, // конвертируем из USDC decimals
    isMythic: raw.isMythic,
    hasRevealed: revealed,
    tokenURI: uri,
  };
}
