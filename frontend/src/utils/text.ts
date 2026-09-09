export function normalizeSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeForComparison(value: string) {
  return normalizeSpaces(value).toLocaleLowerCase("en-IN");
}

export function toDisplayName(value: string) {
  return normalizeSpaces(value)
    .split(" ")
    .map((word) =>
      word.replace(/[A-Za-z]+/g, (part) => {
        if (
          part.length > 1 &&
          part.length <= 3 &&
          part === part.toUpperCase()
        ) {
          return part;
        }

        return `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`;
      }),
    )
    .join(" ");
}
