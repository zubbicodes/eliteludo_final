const FEMALE_BOT_NAMES = [
  'Aisha',
  'Maya',
  'Zara',
  'Noor',
  'Sara',
  'Lina',
  'Hana',
  'Amira',
  'Sofia',
  'Layla',
  'Mina',
  'Elena',
  'Nadia',
  'Riya',
  'Anaya',
  'Leena',
];

export function botDisplayName(seed: string | number): string {
  const value = typeof seed === 'number' ? seed : hashSeed(seed);
  return FEMALE_BOT_NAMES[Math.abs(value) % FEMALE_BOT_NAMES.length];
}

export function botAvatarId(seed: string | number): number {
  const value = typeof seed === 'number' ? seed : hashSeed(seed);
  return Math.abs(value) % 8;
}

export function botThinkDelay(rng: () => number = Math.random): number {
  return 650 + Math.floor(rng() * 950);
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return hash;
}
