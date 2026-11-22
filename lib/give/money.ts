/** GHS 1,250 or GHS 12.50 (amounts are kept in pesewas). */
export const ghs = (p: number) => `GHS ${(p / 100).toLocaleString('en-GH', { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 })}`
