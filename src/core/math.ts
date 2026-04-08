export function dot(a: number[], b: number[]): number {
  let total = 0;
  const limit = Math.min(a.length, b.length);
  for (let index = 0; index < limit; index += 1) {
    total += a[index]! * b[index]!;
  }
  return total;
}

export function magnitude(vector: number[]): number {
  let sum = 0;
  for (const value of vector) {
    sum += value * value;
  }
  return Math.sqrt(sum);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const denom = magnitude(a) * magnitude(b);
  if (!denom) {
    return 0;
  }
  return dot(a, b) / denom;
}

export function normalizeVector(vector: number[]): number[] {
  const size = magnitude(vector);
  if (!size) {
    return vector;
  }

  return vector.map((value) => value / size);
}

export function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
