export const decodeHtmlEntities = (value: string): string => {
  if (!value.includes("&")) {
    return value;
  }

  if (typeof window === "undefined") {
    return value;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(value, "text/html");
  return doc.documentElement.textContent ?? value;
};
