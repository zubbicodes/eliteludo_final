import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/src/theme/colors';

export type AvatarOption = {
  id: number;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
};

export const AVATARS: AvatarOption[] = [
  { id: 0, icon: 'diamond', bg: '#3F92D2' },
  { id: 1, icon: 'flame', bg: '#E2574C' },
  { id: 2, icon: 'leaf', bg: '#3DB45A' },
  { id: 3, icon: 'flash', bg: '#F0C419' },
  { id: 4, icon: 'shield', bg: '#7B5BD0' },
  { id: 5, icon: 'rocket', bg: '#F08A2A' },
  { id: 6, icon: 'heart', bg: '#E64A8C' },
  { id: 7, icon: 'star', bg: '#D4AF37' },
];

export type TokenColorId = 'red' | 'green' | 'yellow' | 'blue';

export const TOKEN_COLORS: { id: TokenColorId; label: string; value: string }[] = [
  { id: 'red', label: 'Red', value: colors.red },
  { id: 'green', label: 'Green', value: colors.green },
  { id: 'yellow', label: 'Yellow', value: colors.yellow },
  { id: 'blue', label: 'Blue', value: colors.blue },
];

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 12;
export const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

export function validateUsername(raw: string): string | null {
  const t = raw.trim();
  if (t.length === 0) return null;
  if (t.length < USERNAME_MIN) return `Min ${USERNAME_MIN} characters`;
  if (t.length > USERNAME_MAX) return `Max ${USERNAME_MAX} characters`;
  if (!USERNAME_REGEX.test(t)) return 'Letters, numbers, and _ only';
  return null;
}

export function isUsernameValid(raw: string): boolean {
  const t = raw.trim();
  return t.length >= USERNAME_MIN && t.length <= USERNAME_MAX && USERNAME_REGEX.test(t);
}

export function getAvatar(id: number | null | undefined): AvatarOption {
  if (id == null) return AVATARS[0];
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}

export function getTokenColor(id: TokenColorId | null | undefined) {
  if (id == null) return TOKEN_COLORS[0];
  return TOKEN_COLORS.find((c) => c.id === id) ?? TOKEN_COLORS[0];
}
