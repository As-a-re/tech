import 'server-only'

/** Typed access to settings in .env.local. Fails fast on missing required values. */
function required(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set — see .env.example`)
  return v
}

export const env = {
  get appUrl() { return process.env.APP_URL ?? 'http://localhost:3000' },
  get authSecret() {
    const v = required('AUTH_SECRET')
    if (v.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters')
    return v
  },
  get isProduction() { return process.env.NODE_ENV === 'production' },
  get churchDbMode(): 'local' | 'api' { return process.env.CHURCH_DB_MODE === 'api' ? 'api' : 'local' },
  get churchDbApiUrl() { return required('CHURCH_DB_API_URL').replace(/\/+$/, '') },
  get churchDbApiKey() { return required('CHURCH_DB_API_KEY') },
  get smsProvider(): 'console' | 'arkesel' { return process.env.SMS_PROVIDER === 'arkesel' ? 'arkesel' : 'console' },
  get smsSender() { return (process.env.SMS_SENDER_ID || 'PAPA').slice(0, 11) },
  get arkeselApiKey() { return required('ARKESEL_API_KEY') },
  get uploadDir() { return process.env.UPLOAD_DIR || './uploads' },
  get supportEmail() { return process.env.SUPPORT_EMAIL || '' },
  get supportPhone() { return process.env.SUPPORT_PHONE || '' },
}
