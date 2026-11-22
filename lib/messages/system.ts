import type { TFunction } from '@/lib/i18n/config'

/** Group events are saved as small JSON notes and written out in the reader's language. */
export function systemText(body: string, t: TFunction, meId?: string): string {
  let e: Record<string, unknown>
  try { e = JSON.parse(body) } catch { return body }
  const whoIds = (e.whoIds as string[] | undefined) ?? []
  // "You" for the reader: capitalised at the start ("You added…"), lower case after ("…added you")
  if (meId && e.byId === meId) e.by = t('messages.you')
  if (meId && whoIds.length) {
    const subject = ['left', 'joined', 'joined_link'].includes(String(e.e))
    const you = subject ? t('messages.you') : t('groups.sys.you')
    if (Array.isArray(e.who)) e.who = (e.who as string[]).map((n, i) => (whoIds[i] === meId ? you : n))
    else if (whoIds[0] === meId) e.who = you
  }
  const s = (k: string) => String(e[k] ?? '')
  switch (e.e) {
    case 'created': return t('groups.sys.created', { by: s('by') })
    case 'added': {
      const who = (e.who as string[] | undefined) ?? []
      return t('groups.sys.added', { by: s('by'), who: who.join(', ') })
    }
    case 'removed': return t('groups.sys.removed', { by: s('by'), who: s('who') })
    case 'left': return t('groups.sys.left', { who: s('who') })
    case 'joined': return t('groups.sys.joined', { who: s('who') })
    case 'joined_link': return t('groups.sys.joinedLink', { who: s('who') })
    case 'approved': return t('groups.sys.approved', { by: s('by'), who: s('who') })
    case 'title': return t('groups.sys.title', { by: s('by'), value: s('value') })
    case 'photo': return t('groups.sys.photo', { by: s('by') })
    case 'description': return t('groups.sys.description', { by: s('by') })
    case 'admin': return t(meId && whoIds[0] === meId ? 'groups.sys.adminYou' : 'groups.sys.admin', { who: s('who') })
    case 'unadmin': return t(meId && whoIds[0] === meId ? 'groups.sys.unadminYou' : 'groups.sys.unadmin', { who: s('who') })
    case 'only_admins': return t(e.on ? 'groups.sys.onlyAdminsOn' : 'groups.sys.onlyAdminsOff', { by: s('by') })
    case 'reset_link': return t('groups.sys.resetLink', { by: s('by') })
    default: return t('messages.kinds.system')
  }
}
