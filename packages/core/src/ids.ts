let sequence = 0

export function createId(prefix: string): string {
  sequence += 1
  return `${prefix}-${String(sequence).padStart(4, '0')}`
}

export function resetIdSequenceForTests(): void {
  sequence = 0
}
