export function normalizeFolderPath(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) =>
      segment
        .trim()
        .replaceAll(/[^\p{L}\p{N}._ -]+/gu, "_")
        .replace(/^\.{1,2}$/g, "")
        .slice(0, 80),
    )
    .filter(Boolean)
    .join("/")
    .slice(0, 240);
}

export function parentPath(path: string): string {
  const normalized = normalizeFolderPath(path);
  const separator = normalized.lastIndexOf("/");
  return separator === -1 ? "" : normalized.slice(0, separator);
}

export function baseName(path: string): string {
  const normalized = normalizeFolderPath(path);
  const separator = normalized.lastIndexOf("/");
  return separator === -1 ? normalized : normalized.slice(separator + 1);
}

export function isSameOrChildPath(path: string, parent: string): boolean {
  const normalizedPath = normalizeFolderPath(path);
  const normalizedParent = normalizeFolderPath(parent);
  return (
    normalizedPath === normalizedParent ||
    normalizedPath.startsWith(`${normalizedParent}/`)
  );
}

export function replacePathPrefix(
  path: string,
  previous: string,
  next: string,
): string {
  const normalizedPath = normalizeFolderPath(path);
  const normalizedPrevious = normalizeFolderPath(previous);
  const normalizedNext = normalizeFolderPath(next);

  if (normalizedPath === normalizedPrevious) return normalizedNext;
  if (!normalizedPath.startsWith(`${normalizedPrevious}/`)) {
    return normalizedPath;
  }

  const suffix = normalizedPath.slice(normalizedPrevious.length + 1);
  return normalizedNext ? `${normalizedNext}/${suffix}` : suffix;
}
