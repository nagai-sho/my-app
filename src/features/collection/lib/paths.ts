export function normalizeFolderPath(value: string) {
  return value
    .trim()
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

export function baseName(path: string) {
  return normalizeFolderPath(path).split("/").filter(Boolean).at(-1) ?? "";
}
