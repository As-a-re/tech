/** Device-level display settings (also saved on the account and restored at sign-in). */
export const DISPLAY_COOKIES = { textSize: 'papa_text', dataSaver: 'papa_saver' } as const
export const TEXT_SIZES = ['small', 'default', 'large', 'xlarge'] as const
export type TextSize = (typeof TEXT_SIZES)[number]
export const isTextSize = (v: unknown): v is TextSize => typeof v === 'string' && (TEXT_SIZES as readonly string[]).includes(v)
