export function normalizeWord(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

