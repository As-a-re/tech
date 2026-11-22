import { getCurrentUser } from '@/server/identity/session'
import { hit } from '@/server/identity/rate-limit'
import { saveFile, UploadError } from '@/integrations/storage'
import { hasMinistryRole } from '@/server/library/permissions'

/** Media upload for posts and chats (photos are resized in the browser first). Returns the stored file's URL. */
export async function POST(req: Request) {
  const me = await getCurrentUser()
  if (!me) return Response.json({ error: 'auth' }, { status: 401 })
  if (!(await hit(`upload:${me.id}`, 120, 3600))) return Response.json({ error: 'too_many' }, { status: 429 })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return Response.json({ error: 'missing' }, { status: 400 })
  try {
    // Chats also take voice notes and documents
    const target = new URL(req.url).searchParams.get('for')
    // Publication PDFs (editors) and Kids content files (children's ministry): only for those roles
    if (target === 'pub' && !(await hasMinistryRole(me, 'publications_editor'))) return Response.json({ error: 'not_allowed' }, { status: 403 })
    if (target === 'kids' && !(await hasMinistryRole(me, 'childrens_ministry'))) return Response.json({ error: 'not_allowed' }, { status: 403 })
    if (target === 'live' && !(await hasMinistryRole(me, 'media_team'))) return Response.json({ error: 'not_allowed' }, { status: 403 })
    if (target === 'res' && !(await hasMinistryRole(me, 'resource_manager'))) return Response.json({ error: 'not_allowed' }, { status: 403 })
    const saved = target === 'chat' ? await saveFile(file, `chat/${me.id}`, ['image', 'video', 'audio', 'document'])
      : target === 'pub' ? await saveFile(file, `pubs/${me.id}`, ['document'])
        : target === 'kids' ? await saveFile(file, `kids/${me.id}`, ['image', 'video', 'audio', 'document'])
          : target === 'live' ? await saveFile(file, `live/${me.id}`, ['image', 'video'])
          : target === 'res' ? await saveFile(file, `res/${me.id}`, ['document'])
          : await saveFile(file, `posts/${me.id}`, ['image', 'video'])
    return Response.json({ url: saved.url, kind: saved.kind, size: saved.size, mime: saved.mime })
  } catch (e) {
    if (e instanceof UploadError) return Response.json({ error: e.message }, { status: 400 })
    throw e
  }
}
