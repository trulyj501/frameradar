export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const countWords = (text: string): number => {
  const tokens = text
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}'’-]/gu, ""))
    .filter(Boolean);

  return tokens.length;
};

export const countSentences = (text: string): number => {
  const sentences = text
    .split(/[.!?。！？]+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return Math.max(sentences.length, 1);
};

export const sanitizeText = (text: string): string =>
  text
    .replace(/\r\n/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const extractJsonObject = (input: string): string => {
  const firstBrace = input.indexOf("{");
  const lastBrace = input.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Gemini did not return a valid JSON object");
  }

  return input.slice(firstBrace, lastBrace + 1);
};
