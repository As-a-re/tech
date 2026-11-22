import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { api, ApiError, type Announcement, type Me } from './api'

const BLUE = '#1E3FA0'

export default function App() {
  const [token, setToken] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    api.loadToken().then(setToken).finally(() => setBooting(false))
  }, [])

  const signOut = useCallback(async () => {
    if (token) await api.logout(token)
    setToken(null)
  }, [token])

  if (booting) return <Center><ActivityIndicator size="large" color={BLUE} /></Center>
  return token ? <Home token={token} onSignOut={signOut} /> : <SignIn onSignedIn={setToken} />
}

function Center({ children }: { children: React.ReactNode }) {
  return <View style={[styles.screen, styles.center]}>{children}</View>
}

function SignIn({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messages: Record<string, string> = {
    missing: 'Enter your details and password.',
    invalid: 'Wrong details or password. Try again.',
    too_many: 'Too many tries. Wait a few minutes.',
    suspended: 'This account is suspended.',
    inactive: 'This account is no longer active.',
  }

  const submit = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const token = await api.login(identifier.trim(), password)
      onSignedIn(token)
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'server'
      setError(messages[code] ?? 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[styles.screen, styles.signIn]}>
      <Text style={styles.logo}>PAPA</Text>
      <Text style={styles.tagline}>Christ Anointed Church</Text>
      <TextInput
        style={styles.input}
        placeholder="Church ID, username or phone"
        placeholderTextColor="#8a8f98"
        autoCapitalize="none"
        autoCorrect={false}
        value={identifier}
        onChangeText={setIdentifier}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#8a8f98"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
    </View>
  )
}

function Home({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const [me, setMe] = useState<Me | null>(null)
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const [{ user }, feed] = await Promise.all([api.me(token), api.announcements(token)])
      setMe(user)
      setItems(feed.items)
      await api.markAnnouncementsSeen(token).catch(() => {})
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onSignOut()
      else setFailed(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token, onSignOut])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <Center><ActivityIndicator size="large" color={BLUE} /></Center>

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Announcements</Text>
          {me ? <Text style={styles.headerSub}>{me.fullName} · {me.assemblyName}</Text> : null}
        </View>
        <Pressable onPress={onSignOut} hitSlop={12}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{failed ? 'Could not load. Pull down to retry.' : 'No announcements yet.'}</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load() }} tintColor={BLUE} colors={[BLUE]} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.author}>{item.author.fullName}</Text>
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f5f7' },
  center: { alignItems: 'center', justifyContent: 'center' },
  signIn: { justifyContent: 'center', padding: 24, backgroundColor: '#fff', gap: 12 },
  logo: { fontSize: 36, fontWeight: '800', color: BLUE, textAlign: 'center', letterSpacing: 2 },
  tagline: { fontSize: 14, color: '#5b6472', textAlign: 'center', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#d4d8de', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#f9fafb', color: '#111' },
  error: { color: '#b3261e', fontSize: 14 },
  button: { backgroundColor: BLUE, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  header: { backgroundColor: BLUE, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerSub: { color: '#c9d3f2', fontSize: 13, marginTop: 2 },
  signOut: { color: '#fff', fontSize: 14, fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 6, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  author: { fontWeight: '700', fontSize: 14, color: '#111' },
  date: { fontSize: 12, color: '#8a8f98' },
  title: { fontSize: 17, fontWeight: '700', color: '#111' },
  body: { fontSize: 15, lineHeight: 21, color: '#3c424b' },
  empty: { textAlign: 'center', color: '#5b6472', marginTop: 48, fontSize: 15 },
})
