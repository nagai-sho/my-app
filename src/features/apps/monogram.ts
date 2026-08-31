const MONOGRAM_COLORS = [
  '#365486',
  '#176b87',
  '#497d74',
  '#8064a2',
  '#9a5b46',
  '#7a6f32',
];

export function getMonogram(value: string): string {
  const firstCharacter = Array.from(value.trim())[0] ?? '?';
  return firstCharacter.toLocaleUpperCase('ja-JP');
}

export function getMonogramColor(value: string): string {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }

  return MONOGRAM_COLORS[Math.abs(hash) % MONOGRAM_COLORS.length];
}
