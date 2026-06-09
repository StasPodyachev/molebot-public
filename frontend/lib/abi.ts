/**
 * MolebotNFT ABI — синхронизирован с задеплоенным контрактом
 * packages/contracts-evm/contracts/MolebotNFT.sol (Mantle Sepolia).
 * Содержит только функции и ивенты, нужные фронтенду.
 */
export const MOLEBOT_NFT_ABI = [
  // === Read ===
  "function balanceOf(address owner) view returns (uint256)",
  "function getMoleData(uint256 tokenId) view returns (tuple(uint8 mood, uint8 levelIndex, int256 cumulativePnl, uint256 lastTradeTs, bool isMythic))",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function MINT_PRICE() view returns (uint256)",
  "function hasMinted(address owner) view returns (bool)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function revealed() view returns (bool)",
  "function baseURI() view returns (string)",
  "function agentAddress() view returns (address)",
  "function owner() view returns (address)",
  "function levelThresholds(uint256) view returns (uint256)",

  // === Write ===
  "function mint() payable",
  "function approve(address to, uint256 tokenId)",
  "function setApprovalForAll(address operator, bool approved)",

  // === Events ===
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event MoleMinted(address indexed to, uint256 indexed tokenId)",
  "event MoodUpdated(uint256 indexed tokenId, uint8 newMood)",
  "event LevelUp(uint256 indexed tokenId, uint8 newLevel)",
  "event Revealed()",
] as const;
