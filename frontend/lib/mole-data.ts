/**
 * MolebotNFT data types for the frontend
 */

/**
 * Raw on-chain MoleData (as returned by getMoleData of the deployed contract).
 * MolebotNFT.sol structure: { mood, levelIndex, cumulativePnl, lastTradeTs, isMythic }.
 * serialNumber/personalityHash fields don't exist in the contract — serial number
 * equals tokenId (1 mole per wallet).
 */
export interface MoleDataRaw {
  mood: number;
  levelIndex: number;
  cumulativePnl: bigint;
  lastTradeTs: bigint;
  isMythic: boolean;
}

/** Processed data for UI */
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

/** Mole levels (from contract: levelThresholds) */
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
  0: 'Grumpy',
  1: 'Neutral',
  2: 'Bold',
};

/** Convert raw on-chain data to UI-friendly format */
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
    serialNumber: tokenId, // contract has no serialNumber — use tokenId
    mood,
    levelIndex,
    levelName: LEVEL_NAMES[levelIndex] ?? `Level ${levelIndex}`,
    cumulativePnl: Number(raw.cumulativePnl) / 1e6, // convert from USDC decimals
    isMythic: raw.isMythic,
    hasRevealed: revealed,
    tokenURI: uri,
  };
}
