// Community Garden Planner - entire frontend (types, libs, contexts, 3D scenes, components, pages, entry point) in one file.
import { StrictMode, Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type ButtonHTMLAttributes, type PointerEvent, useCallback, type DragEvent, createContext, useContext } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, Link, useLocation, NavLink, Outlet, useSearchParams } from 'react-router-dom'
import { Search, Sprout, Rows3, ShoppingBasket, CalendarDays, CornerDownLeft, Loader2, type LucideIcon, ArrowRight, ArrowDown, Sparkle, MousePointer2, X, LayoutDashboard, Box, Sparkles, ScanLine, MessagesSquare, BarChart3, Settings, Menu, RefreshCw, UserRound, WifiOff, Eye, CloudUpload, ChevronDown, Lock, Globe2, ArrowUpRight, ArrowDownRight, Play, Star, Clock, Flame, Leaf, Sun, Droplets, Database, Plus, ChevronLeft, ChevronRight, Bell, CheckCircle2, Circle, Pencil, Trash2, Wand2, GanttChart, Download, PieChart as PieIcon, TrendingUp, Activity, Send, Bot, User, Link2, MousePointerClick, Rotate3d, ZoomIn, Copy, KeyRound, LogIn, LogOut, ShieldCheck, UserPlus, Users, Check, AlertTriangle, ExternalLink, Info, Layers, History, ImagePlus, Lightbulb } from 'lucide-react'
import { Canvas, useFrame, useThree, type ThreeEvent, type ThreeElements } from '@react-three/fiber'
import { OrbitControls, Html, Sparkles as DreiSparkles, Environment, Lightformer, ContactShadows, Float, RoundedBox } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { createClient, type Session, type User as SupabaseUser } from '@supabase/supabase-js'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from 'recharts'
import './styles.css'

// ======================================================================
// lib/supabase.ts
// ======================================================================
// Both values are public by design: the URL and the publishable/anon key only
// grant what the database's row-level security policies allow.
// The Gemini key never reaches the browser; it lives in the edge function.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && key)
// Sessions are kept in localStorage under our own key and refreshed automatically,
// so a signed-in gardener stays signed in across reloads (and offline).
export const supabase = createClient(url || 'https://invalid.supabase.co', key || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'cgp-auth' }
})
export const SUPABASE_URL = url ?? ''

// ======================================================================
// lib/types.ts
// ======================================================================
export const SOIL_TYPES = ['Loamy', 'Sandy', 'Clay', 'Silty', 'Peaty', 'Chalky', 'Potting mix'] as const
export const CATEGORIES = ['Vegetable', 'Leafy green', 'Root', 'Herb', 'Fruit', 'Legume', 'Grain', 'Flower'] as const
export const STATUSES = ['planned', 'sown', 'germinating', 'growing', 'flowering', 'ready', 'harvested'] as const
export const UNITS = ['kg', 'g', 'lb', 'pieces', 'bunches'] as const
export const TASK_TYPES = ['sow', 'water', 'fertilize', 'prune', 'weed', 'harvest', 'other'] as const

export type SoilType = (typeof SOIL_TYPES)[number]
export type Category = (typeof CATEGORIES)[number]
export type PlantStatus = (typeof STATUSES)[number]
export type Unit = (typeof UNITS)[number]
export type TaskType = (typeof TASK_TYPES)[number]

export interface Bed {
  id: string
  code: string
  name: string
  length_m: number
  width_m: number
  soil_type: SoilType
  zone: string | null
  notes: string | null
  created_at: string
  garden_id?: string
}

export interface Plant {
  id: string
  name: string
  category: Category
  bed_id: string | null
  sowing_date: string | null
  expected_harvest_date: string | null
  status: PlantStatus
  quantity: number
  notes: string | null
  created_at: string
  garden_id?: string
}

export interface SowingRecord {
  id: string
  plant_id: string
  bed_id: string | null
  sown_on: string
  quantity: number
  notes: string | null
  created_at: string
  garden_id?: string
}

export interface Harvest {
  id: string
  plant_id: string | null
  plant_name: string
  bed_id: string | null
  harvested_on: string
  quantity: number
  unit: Unit
  notes: string | null
  created_at: string
  garden_id?: string
}

export interface Task {
  id: string
  title: string
  type: TaskType
  due_date: string
  bed_id: string | null
  plant_id: string | null
  done: boolean
  notes: string | null
  created_at: string
  garden_id?: string
}

export type AiKind = 'recommendation' | 'health' | 'chat'
export interface AiHistory {
  id: string
  kind: AiKind
  input: Record<string, unknown>
  output: Record<string, unknown>
  demo: boolean
  created_at: string
  garden_id?: string
}

export const STATUS_LABEL: Record<PlantStatus, string> = {
  planned: 'Planned', sown: 'Sown', germinating: 'Germinating', growing: 'Growing',
  flowering: 'Flowering', ready: 'Ready to harvest', harvested: 'Harvested'
}
/** How far along each status is (0..1), used by the 3D growth animation and progress bars. */
export const STATUS_PROGRESS: Record<PlantStatus, number> = {
  planned: 0, sown: 0.12, germinating: 0.28, growing: 0.6, flowering: 0.82, ready: 1, harvested: 1
}
export const ACTIVE_STATUSES: PlantStatus[] = ['sown', 'germinating', 'growing', 'flowering', 'ready']

/* ---------- accounts & gardens (migration 004) ---------- */
export type GardenVisibility = 'private' | 'public_read' | 'public_open'
export type GardenRole = 'owner' | 'editor' | 'viewer'
export interface Garden {
  id: string
  name: string
  visibility: GardenVisibility
  created_by: string | null
  created_at: string
}
export interface GardenMember {
  garden_id: string
  user_id: string
  role: GardenRole
  email: string | null
  joined_at: string
}
export const DEMO_GARDEN_ID = '0a4de000-0000-4000-8000-000000000001'

// ======================================================================
// context/AuthContext.tsx
// ======================================================================
/* ---------------------------------------------------------------------
   Accounts and gardens (multi-tenant).
   * Supabase Auth (email + password). Signed-out visitors can still use
     the open Community Demo Garden.
   * Each gardener can own several private gardens and invite others with
     a code. Roles: owner (everything), editor (edit data), viewer (read).
   * The database enforces all of this with row-level security; the role
     here only decides what the UI offers.
   --------------------------------------------------------------------- */

export type Access = GardenRole | 'open' | 'public'
const GARDEN_KEY = 'cgp-garden'
const GARDEN_COLS = 'id, name, visibility, created_by, created_at'

interface AuthApi {
  ready: boolean
  session: Session | null
  user: SupabaseUser | null
  gardens: Garden[]
  memberships: GardenMember[]
  gardenId: string
  garden: Garden | undefined
  access: Access
  canWrite: boolean
  setGardenId: (id: string) => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
  refreshGardens: () => Promise<void>
  createGarden: (name: string, visibility: 'private' | 'public_read') => Promise<Garden>
  joinGarden: (code: string) => Promise<string>
}

/** Turns auth / permission errors into plain sentences. */
export function authError(e: unknown): string {
  const m = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e)
  if (/Invalid login credentials/i.test(m)) return 'Email or password is incorrect.'
  if (/Email not confirmed/i.test(m)) return 'Please confirm your email first. Check your inbox for the link, then sign in.'
  if (/already registered|already exists/i.test(m)) return 'An account with this email already exists. Try signing in.'
  if (/Password should be|weak/i.test(m)) return 'Choose a stronger password (at least 8 characters).'
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a minute and try again.'
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Can’t reach the server. Check your connection.'
  return m
}

export function accessFor(g: Garden | undefined, memberships: GardenMember[], userId: string | undefined): Access {
  if (!g) return 'public'
  const m = memberships.find((x) => x.garden_id === g.id && x.user_id === userId)
  if (m) return m.role
  return g.visibility === 'public_open' ? 'open' : 'public'
}
export const canWriteWith = (a: Access) => a === 'owner' || a === 'editor' || a === 'open'

const DEMO: Garden = { id: DEMO_GARDEN_ID, name: 'Community Demo Garden', visibility: 'public_open', created_by: null, created_at: '' }
const AuthCtx = createContext<AuthApi | null>(null)

function storedGarden(): string { try { return localStorage.getItem(GARDEN_KEY) || DEMO_GARDEN_ID } catch { return DEMO_GARDEN_ID } }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supabaseConfigured)
  const [session, setSession] = useState<Session | null>(null)
  const [gardens, setGardens] = useState<Garden[]>([DEMO])
  const [memberships, setMemberships] = useState<GardenMember[]>([])
  const [gardenId, setGardenIdState] = useState<string>(storedGarden)
  const [listed, setListed] = useState(false) // the garden list has loaded for the current session
  const user = session?.user ?? null

  useEffect(() => {
    if (!supabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const refreshGardens = useCallback(async () => {
    if (!supabaseConfigured) return
    const [g, m] = await Promise.all([
      supabase.from('garden_gardens').select(GARDEN_COLS).order('created_at'),
      user ? supabase.from('garden_members').select('*').eq('user_id', user.id) : Promise.resolve({ data: [], error: null })
    ])
    if (!g.error && g.data) {
      const list = g.data as Garden[]
      setGardens(list.some((x) => x.id === DEMO_GARDEN_ID) ? list : [DEMO, ...list])
    }
    if (!m.error) setMemberships((m.data ?? []) as GardenMember[])
    setListed(!g.error)
  }, [user])

  useEffect(() => { if (ready) { setListed(false); refreshGardens() } }, [ready, refreshGardens])

  // If the chosen garden is no longer visible (signed out, removed), fall back to the demo.
  useEffect(() => {
    if (ready && listed && !gardens.some((g) => g.id === gardenId)) setGardenIdState(DEMO_GARDEN_ID)
  }, [ready, listed, gardens, gardenId])

  const setGardenId = useCallback((id: string) => { setGardenIdState(id); try { localStorage.setItem(GARDEN_KEY, id) } catch { /* ignore */ } }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw new Error(authError(error))
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      // `app: 'garden'` tells the shared project's sign-up trigger to skip this user (see migration 004a)
      options: { data: { app: 'garden' }, emailRedirectTo: `${window.location.origin}/account` }
    })
    if (error) throw new Error(authError(error))
    return { needsConfirmation: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setMemberships([]); setGardenId(DEMO_GARDEN_ID)
  }, [setGardenId])

  const createGarden = useCallback(async (name: string, visibility: 'private' | 'public_read') => {
    if (!user) throw new Error('Sign in to create a garden.')
    const n = name.trim()
    if (!n || n.length > 60) throw new Error('Give the garden a name of 1–60 characters.')
    const { data, error } = await supabase.from('garden_gardens').insert({ name: n, visibility, created_by: user.id }).select(GARDEN_COLS).single()
    if (error) throw new Error(authError(error))
    await refreshGardens(); setGardenId((data as Garden).id)
    return data as Garden
  }, [user, refreshGardens, setGardenId])

  const joinGarden = useCallback(async (code: string) => {
    const c = code.trim().toLowerCase()
    if (!/^[0-9a-f]{12}$/.test(c)) throw new Error('Invite codes are 12 characters (letters a–f and numbers).')
    const { data, error } = await supabase.rpc('garden_join', { p_code: c })
    if (error) throw new Error(authError(error))
    await refreshGardens(); setGardenId(data as string)
    return data as string
  }, [refreshGardens, setGardenId])

  const api = useMemo<AuthApi>(() => {
    const garden = gardens.find((g) => g.id === gardenId)
    const access = accessFor(garden, memberships, user?.id)
    return { ready, session, user, gardens, memberships, gardenId, garden, access, canWrite: canWriteWith(access), setGardenId, signIn, signUp, signOut, refreshGardens, createGarden, joinGarden }
  }, [ready, session, user, gardens, memberships, gardenId, setGardenId, signIn, signUp, signOut, refreshGardens, createGarden, joinGarden])

  return <AuthCtx.Provider value={api}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth must be used inside AuthProvider')
  return c
}
/** Safe outside the provider (e.g. in isolated component tests): defaults to writable. */
export function useCanWrite() { return useContext(AuthCtx)?.canWrite ?? true }

// ======================================================================
// lib/optimistic.ts
// ======================================================================
/* ---------------------------------------------------------------------
   Optimistic updates as pure functions.
   The UI changes the moment you act; DataContext then confirms the change
   with the database and either swaps in the saved row or rolls back to
   the snapshot taken before the change. Keeping these pure makes the
   behaviour easy to unit-test.
   --------------------------------------------------------------------- */

export type TableMap = {
  garden_beds: Bed; garden_plants: Plant; garden_harvests: Harvest
  garden_tasks: Task; garden_sowing_records: SowingRecord; garden_ai_history: AiHistory
}
export type TableName = keyof TableMap
export interface Rows { beds: Bed[]; plants: Plant[]; harvests: Harvest[]; tasks: Task[]; sowing: SowingRecord[]; ai: AiHistory[] }
export type RowKey = keyof Rows

export const KEY: Record<TableName, RowKey> = {
  garden_beds: 'beds', garden_plants: 'plants', garden_harvests: 'harvests', garden_tasks: 'tasks', garden_sowing_records: 'sowing', garden_ai_history: 'ai'
}
export const EMPTY_ROWS: Rows = { beds: [], plants: [], harvests: [], tasks: [], sowing: [], ai: [] }

type AnyRow = { id: string; _pending?: boolean }

/** A new id made in the browser, so an optimistic row and the saved row share one id. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16) })
}

/** Fills the columns the database would default, so a new row renders fully before it is saved. */
export function draftRow<T extends TableName>(table: T, row: Partial<TableMap[T]>, gardenId: string): TableMap[T] {
  const base: Record<string, unknown> = { id: newId(), created_at: new Date().toISOString(), notes: null, garden_id: gardenId, _pending: true, ...row }
  if (table === 'garden_beds') base.code ??= 'BED-…'
  if (table === 'garden_plants') { base.status ??= 'planned'; base.quantity ??= 1; base.bed_id ??= null; base.sowing_date ??= null; base.expected_harvest_date ??= null }
  if (table === 'garden_tasks') { base.done ??= false; base.type ??= 'other'; base.bed_id ??= null; base.plant_id ??= null }
  if (table === 'garden_harvests') { base.plant_id ??= null; base.bed_id ??= null }
  return base as unknown as TableMap[T]
}

export function applyCreate<T extends TableName>(rows: Rows, table: T, row: TableMap[T]): Rows {
  const k = KEY[table]
  return { ...rows, [k]: [row, ...(rows[k] as AnyRow[]).filter((r) => r.id !== (row as AnyRow).id)] }
}

export function applyUpdate<T extends TableName>(rows: Rows, table: T, id: string, patch: Partial<TableMap[T]>, pending = true): Rows {
  const k = KEY[table]
  return { ...rows, [k]: (rows[k] as AnyRow[]).map((r) => (r.id === id ? { ...r, ...patch, ...(pending ? { _pending: true } : {}) } : r)) }
}

/** Swaps an optimistic row for the row the database returned. */
export function applySaved<T extends TableName>(rows: Rows, table: T, saved: TableMap[T]): Rows {
  const k = KEY[table], id = (saved as AnyRow).id
  const list = rows[k] as AnyRow[]
  return { ...rows, [k]: list.some((r) => r.id === id) ? list.map((r) => (r.id === id ? saved : r)) : [saved, ...list] }
}

/** Removes a row and mirrors the database's ON DELETE SET NULL / CASCADE rules locally. */
export function applyRemove(rows: Rows, table: TableName, id: string): Rows {
  const k = KEY[table]
  const n: Rows = { ...rows, [k]: (rows[k] as AnyRow[]).filter((r) => r.id !== id) }
  if (table === 'garden_beds') {
    n.plants = rows.plants.map((x) => (x.bed_id === id ? { ...x, bed_id: null } : x))
    n.harvests = rows.harvests.map((x) => (x.bed_id === id ? { ...x, bed_id: null } : x))
    n.tasks = rows.tasks.map((x) => (x.bed_id === id ? { ...x, bed_id: null } : x))
    n.sowing = rows.sowing.map((x) => (x.bed_id === id ? { ...x, bed_id: null } : x))
  }
  if (table === 'garden_plants') {
    n.tasks = rows.tasks.filter((x) => x.plant_id !== id)
    n.sowing = rows.sowing.filter((x) => x.plant_id !== id)
    n.harvests = rows.harvests.map((x) => (x.plant_id === id ? { ...x, plant_id: null } : x))
  }
  return n
}

export const isPending = (r: object) => (r as AnyRow)._pending === true
/** Strips client-only fields before a row is sent to the database. */
export function toDb<T extends object>(row: T): T { const { _pending, ...rest } = row as T & AnyRow; void _pending; return rest as T }

// ======================================================================
// lib/offline.ts
// ======================================================================
/* ---------------------------------------------------------------------
   Offline-first support.
   * The last good copy of each garden's data is kept in localStorage, so
     the app opens instantly and still works with no connection.
   * Writes made while offline go into an outbox (also in localStorage)
     and are replayed in order once the browser is back online.
   The service worker (public/sw.js) separately caches the app shell.
   --------------------------------------------------------------------- */

export type OutboxOp =
  | { kind: 'insert'; table: TableName; gardenId: string; row: Record<string, unknown>; at: number }
  | { kind: 'update'; table: TableName; gardenId: string; id: string; patch: Record<string, unknown>; at: number }
  | { kind: 'delete'; table: TableName; gardenId: string; id: string; at: number }

const SNAP = (g: string) => `cgp-cache:${g}`
const OUTBOX = 'cgp-outbox'

function store(): Storage | null { try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null } }

export function saveSnapshot(gardenId: string, rows: Rows) {
  try { store()?.setItem(SNAP(gardenId), JSON.stringify({ at: Date.now(), rows })) } catch { /* storage full or blocked: caching is best-effort */ }
}
export function loadSnapshot(gardenId: string): { at: number; rows: Rows } | null {
  try { const s = store()?.getItem(SNAP(gardenId)); return s ? JSON.parse(s) : null } catch { return null }
}

export function readOutbox(): OutboxOp[] {
  try { const s = store()?.getItem(OUTBOX); const v = s ? JSON.parse(s) : []; return Array.isArray(v) ? v : [] } catch { return [] }
}
export function writeOutbox(ops: OutboxOp[]) { try { store()?.setItem(OUTBOX, JSON.stringify(ops)) } catch { /* best-effort */ } }

/**
 * Adds a write to the outbox, collapsing it with earlier queued writes to the same row
 * (insert + update -> one insert; anything + delete of a row never sent -> nothing).
 */
export function enqueue(ops: OutboxOp[], op: OutboxOp): OutboxOp[] {
  if (op.kind === 'update') {
    const i = ops.findIndex((o) => o.kind === 'insert' && o.table === op.table && o.row.id === op.id)
    if (i >= 0) { const c = [...ops]; const ins = c[i] as Extract<OutboxOp, { kind: 'insert' }>; c[i] = { ...ins, row: { ...ins.row, ...op.patch } }; return c }
  }
  if (op.kind === 'delete') {
    const neverSent = ops.some((o) => o.kind === 'insert' && o.table === op.table && o.row.id === op.id)
    const rest = ops.filter((o) => !((o.kind === 'insert' && o.row.id === op.id) || (o.kind === 'update' && o.id === op.id)) || o.table !== op.table)
    return neverSent ? rest : [...rest, op]
  }
  return [...ops, op]
}

export const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)
export const isNetworkError = (e: unknown) => /Failed to fetch|NetworkError|Load failed|network|timeout/i.test(e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e))

// ======================================================================
// context/DataContext.tsx
// ======================================================================
/* ---------------------------------------------------------------------
   Single source of truth for the current garden's data.
   * Optimistic: every write changes the screen immediately, then is
     confirmed by Postgres. The saved row replaces the draft; on failure
     the change is rolled back and the error is shown.
   * Offline-first: the last good copy is cached per garden; writes made
     offline are queued and replayed when the connection returns.
   * Multi-tenant: every query is scoped to the selected garden, and
     row-level security enforces the same rule on the server.
   --------------------------------------------------------------------- */


interface DataState extends Rows { loading: boolean; error: string | null; lastSync: Date | null; fromCache: boolean }
interface DataApi extends DataState {
  online: boolean
  queued: number
  canWrite: boolean
  gardenId: string
  reload: () => Promise<void>
  create: <T extends TableName>(table: T, row: Partial<TableMap[T]>) => Promise<TableMap[T]>
  createMany: <T extends TableName>(table: T, rows: Partial<TableMap[T]>[]) => Promise<TableMap[T][]>
  update: <T extends TableName>(table: T, id: string, patch: Partial<TableMap[T]>) => Promise<TableMap[T]>
  remove: (table: TableName, id: string) => Promise<void>
  assignPlants: (bedId: string, plantIds: string[]) => Promise<number>
  flush: () => Promise<void>
  bedById: (id: string | null | undefined) => Bed | undefined
  plantById: (id: string | null | undefined) => Plant | undefined
}

const ORDER: Record<TableName, { col: string; asc: boolean }> = {
  garden_beds: { col: 'code', asc: true }, garden_plants: { col: 'created_at', asc: false }, garden_harvests: { col: 'harvested_on', asc: false },
  garden_tasks: { col: 'due_date', asc: true }, garden_sowing_records: { col: 'sown_on', asc: false }, garden_ai_history: { col: 'created_at', asc: false }
}

/** Turns Postgres / network errors into sentences a gardener can act on. */
export function friendlyError(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  if (/Failed to fetch|NetworkError|timeout/i.test(m)) return 'Can’t reach the database right now. Check your connection and try again.'
  if (/row-level security|permission denied|42501/i.test(m)) return 'You don’t have permission to change this garden. Ask its owner for editor access.'
  if (/different garden/i.test(m)) return m
  if (/violates check constraint/i.test(m)) return 'Some values are outside the allowed range. Please check the form.'
  if (/duplicate key/i.test(m)) return 'That item already exists.'
  if (/foreign key/i.test(m)) return 'This item is linked to something that no longer exists. Refresh and try again.'
  if (/relation .* does not exist/i.test(m)) return 'The garden tables are missing in the database. Run schema.sql in the Supabase SQL Editor.'
  return m
}

const READ_ONLY = 'You have view-only access to this garden. Ask its owner for editor access.'
export const DataCtx = createContext<DataApi | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { gardenId, canWrite, ready } = useAuth()
  const [s, setS] = useState<DataState>(() => ({ ...EMPTY_ROWS, loading: true, error: null, lastSync: null, fromCache: false }))
  const [online, setOnline] = useState(isOnline)
  const [queued, setQueued] = useState(() => readOutbox().length)
  const rowsRef = useRef<Rows>(EMPTY_ROWS)
  rowsRef.current = s
  const gardenRef = useRef(gardenId); gardenRef.current = gardenId

  const setRows = useCallback((f: (r: Rows) => Rows) => setS((p) => ({ ...p, ...f(p) })), [])

  const reload = useCallback(async () => {
    if (!supabaseConfigured) { setS((p) => ({ ...p, loading: false, error: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' })); return }
    const g = gardenRef.current
    setS((p) => ({ ...p, loading: true, error: null }))
    try {
      const tables = Object.keys(KEY) as TableName[]
      const res = await Promise.all(tables.map((t) => {
        const q = supabase.from(t).select('*').eq('garden_id', g).order(ORDER[t].col, { ascending: ORDER[t].asc })
        return t === 'garden_ai_history' ? q.limit(100) : q.limit(2000)
      }))
      if (g !== gardenRef.current) return // the user switched garden meanwhile
      const next = { ...EMPTY_ROWS } as Rows
      res.forEach((r, i) => { if (r.error) throw r.error; (next as unknown as Record<string, unknown>)[KEY[tables[i]]] = r.data ?? [] })
      // keep rows that are still waiting in the outbox so offline edits don't vanish
      const pending = readOutbox().filter((o) => o.gardenId === g && o.kind === 'insert')
      let merged = next
      for (const o of pending) if (o.kind === 'insert') merged = applyCreate(merged, o.table, { ...o.row, _pending: true } as never)
      setS((p) => ({ ...p, ...merged, loading: false, error: null, lastSync: new Date(), fromCache: false }))
      saveSnapshot(g, merged)
    } catch (e) {
      const cached = loadSnapshot(g)
      if (isNetworkError(e) && cached) setS((p) => ({ ...p, ...cached.rows, loading: false, error: null, fromCache: true, lastSync: new Date(cached.at) }))
      else setS((p) => ({ ...p, loading: false, error: friendlyError(e) }))
    }
  }, [])

  // Switching garden: show the cached copy instantly, then refresh from the server.
  useEffect(() => {
    if (!ready) return
    const cached = loadSnapshot(gardenId)
    setS((p) => ({ ...p, ...(cached ? cached.rows : EMPTY_ROWS), loading: true, fromCache: !!cached, lastSync: cached ? new Date(cached.at) : null }))
    reload()
  }, [gardenId, ready, reload])

  // Keep the offline copy up to date with every change.
  useEffect(() => {
    if (s.loading) return
    const t = setTimeout(() => saveSnapshot(gardenId, { beds: s.beds, plants: s.plants, harvests: s.harvests, tasks: s.tasks, sowing: s.sowing, ai: s.ai }), 300)
    return () => clearTimeout(t)
  }, [s.beds, s.plants, s.harvests, s.tasks, s.sowing, s.ai, s.loading, gardenId])

  const refreshSowing = useCallback(() => {
    supabase.from('garden_sowing_records').select('*').eq('garden_id', gardenRef.current).order('sown_on', { ascending: false })
      .then(({ data }) => data && setS((p) => ({ ...p, sowing: data as SowingRecord[] })))
  }, [])

  const queue = useCallback((op: OutboxOp) => { const next = enqueue(readOutbox(), op); writeOutbox(next); setQueued(next.length) }, [])

  /** Replays queued offline writes in order. Stops at the first network failure; drops writes the server rejects. */
  const flush = useCallback(async () => {
    let ops = readOutbox(); if (!ops.length || !isOnline()) return
    let rejected = 0
    while (ops.length) {
      const op = ops[0]
      const r = op.kind === 'insert' ? await supabase.from(op.table).insert(op.row as never)
        : op.kind === 'update' ? await supabase.from(op.table).update(op.patch as never).eq('id', op.id)
        : await supabase.from(op.table).delete().eq('id', op.id)
      if (r.error && isNetworkError(r.error)) break
      if (r.error) rejected++
      ops = ops.slice(1); writeOutbox(ops); setQueued(ops.length)
    }
    if (rejected) setS((p) => ({ ...p, error: `${rejected} offline change${rejected > 1 ? 's were' : ' was'} rejected by the server and not saved.` }))
    await reload()
  }, [reload])

  useEffect(() => {
    const up = () => { setOnline(true); flush() }, down = () => setOnline(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    if (isOnline()) flush()
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [flush])

  const guard = useCallback(() => { if (!canWrite) throw new Error(READ_ONLY) }, [canWrite])

  const create = useCallback(async <T extends TableName>(table: T, row: Partial<TableMap[T]>) => {
    guard()
    const g = gardenRef.current
    const draft = draftRow(table, row, g)
    const id = (draft as { id: string }).id
    const send = { ...row, id, garden_id: g } as Record<string, unknown>
    setRows((r) => applyCreate(r, table, draft))
    if (!isOnline()) { queue({ kind: 'insert', table, gardenId: g, row: send, at: Date.now() }); return draft }
    const { data, error } = await supabase.from(table).insert(send as never).select().single()
    if (error) {
      if (isNetworkError(error)) { queue({ kind: 'insert', table, gardenId: g, row: send, at: Date.now() }); return draft }
      setRows((r) => applyRemove(r, table, id)) // roll back
      throw new Error(friendlyError(error))
    }
    setRows((r) => applySaved(r, table, data as TableMap[T]))
    if (table === 'garden_plants') refreshSowing() // the DB logs sowings with a trigger
    return data as TableMap[T]
  }, [guard, setRows, queue, refreshSowing])

  const createMany = useCallback(async <T extends TableName>(table: T, rows: Partial<TableMap[T]>[]) => {
    guard()
    if (!rows.length) return []
    const g = gardenRef.current
    const drafts = rows.map((row) => draftRow(table, row, g))
    const sends = rows.map((row, i) => ({ ...row, id: (drafts[i] as { id: string }).id, garden_id: g }))
    setRows((r) => drafts.reduce((acc, d) => applyCreate(acc, table, d), r))
    // one INSERT statement = one transaction: either every row is saved or none is
    const { data, error } = await supabase.from(table).insert(sends as never).select()
    if (error) {
      setRows((r) => drafts.reduce((acc, d) => applyRemove(acc, table, (d as { id: string }).id), r))
      throw new Error(friendlyError(error))
    }
    setRows((r) => (data as TableMap[T][]).reduce((acc, d) => applySaved(acc, table, d), r))
    return data as TableMap[T][]
  }, [guard, setRows])

  const update = useCallback(async <T extends TableName>(table: T, id: string, patch: Partial<TableMap[T]>) => {
    guard()
    const g = gardenRef.current
    const before = (rowsRef.current[KEY[table]] as { id: string }[]).find((x) => x.id === id) as TableMap[T] | undefined
    setRows((r) => applyUpdate(r, table, id, patch))
    if (!isOnline()) { queue({ kind: 'update', table, gardenId: g, id, patch: patch as Record<string, unknown>, at: Date.now() }); return { ...before, ...patch } as TableMap[T] }
    const { data, error } = await supabase.from(table).update(patch as never).eq('id', id).select().single()
    if (error) {
      if (isNetworkError(error)) { queue({ kind: 'update', table, gardenId: g, id, patch: patch as Record<string, unknown>, at: Date.now() }); return { ...before, ...patch } as TableMap[T] }
      if (before) setRows((r) => applySaved(r, table, before)) // roll back
      throw new Error(friendlyError(error))
    }
    setRows((r) => applySaved(r, table, data as TableMap[T]))
    if (table === 'garden_plants' && 'sowing_date' in patch) refreshSowing()
    return data as TableMap[T]
  }, [guard, setRows, queue, refreshSowing])

  const remove = useCallback(async (table: TableName, id: string) => {
    guard()
    const g = gardenRef.current
    const snapshot = rowsRef.current
    setRows((r) => applyRemove(r, table, id))
    if (!isOnline()) { queue({ kind: 'delete', table, gardenId: g, id, at: Date.now() }); return }
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) {
      if (isNetworkError(error)) { queue({ kind: 'delete', table, gardenId: g, id, at: Date.now() }); return }
      setRows(() => snapshot) // roll back
      throw new Error(friendlyError(error))
    }
  }, [guard, setRows, queue])

  /** Moves several plants into a bed in one database transaction (all or nothing). */
  const assignPlants = useCallback(async (bedId: string, plantIds: string[]) => {
    guard()
    if (!isOnline()) throw new Error('Moving plants needs a connection, so all of them move together. Try again when you’re online.')
    const snapshot = rowsRef.current
    setRows((r) => plantIds.reduce((acc, id) => applyUpdate(acc, 'garden_plants', id, { bed_id: bedId }), r))
    const { data, error } = await supabase.rpc('garden_assign_plants', { p_bed: bedId, p_plants: plantIds })
    if (error) { setRows(() => snapshot); throw new Error(friendlyError(error)) }
    setRows((r) => plantIds.reduce((acc, id) => applyUpdate(acc, 'garden_plants', id, { bed_id: bedId }, false), r))
    setRows((r) => ({ ...r, plants: r.plants.map((p) => (plantIds.includes(p.id) ? { ...p, _pending: undefined } as Plant : p)) }))
    return (data as number) ?? plantIds.length
  }, [guard, setRows])

  const api = useMemo<DataApi>(() => ({
    ...s, online, queued, canWrite, gardenId, reload, create, createMany, update, remove, assignPlants, flush,
    bedById: (id) => (id ? s.beds.find((b) => b.id === id) : undefined),
    plantById: (id) => (id ? s.plants.find((p) => p.id === id) : undefined)
  }), [s, online, queued, canWrite, gardenId, reload, create, createMany, update, remove, assignPlants, flush])

  return <DataCtx.Provider value={api}>{children}</DataCtx.Provider>
}

export function useData() {
  const c = useContext(DataCtx)
  if (!c) throw new Error('useData must be used inside DataProvider')
  return c
}

// ======================================================================
// lib/search.ts
// ======================================================================
/* =====================================================================
   Search: Postgres full-text search (garden_search RPC: weighted
   tsvector columns + GIN indexes + prefix matching) with an instant
   local fallback so the UI never blocks on the network.
   ===================================================================== */

export type SearchKind = 'plant' | 'bed' | 'harvest' | 'task'
export interface SearchHit { kind: SearchKind; id: string; title: string; detail: string; rank: number }

/** Trims, collapses whitespace and caps length. Returns '' for blank input. */
export function normaliseQuery(q: string | null | undefined): string {
  return (q ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)
}

/** Lower-case word tokens, matching what the database tokenizer keeps. */
export function tokens(q: string): string[] {
  return normaliseQuery(q).toLowerCase().replace(/[^\p{L}\p{N}\s-]+/gu, ' ').split(/\s+/).filter((w) => w && !/^-+$/.test(w))
}

/** Local fallback: every query word must appear somewhere in the text (prefix-friendly, case-insensitive). */
export function localMatch(text: string, q: string): boolean {
  const ws = tokens(q)
  if (!ws.length) return true
  const hay = text.toLowerCase()
  return ws.every((w) => hay.includes(w))
}

/** Calls the full-text search RPC. Throws on network/database errors. */
export async function searchGarden(q: string, limit = 20, gardenId?: string): Promise<SearchHit[]> {
  const query = normaliseQuery(q)
  if (!query || !supabaseConfigured) return []
  const { data, error } = await supabase.rpc('garden_search', { q: query, max_results: limit, ...(gardenId ? { p_garden: gardenId } : {}) })
  if (error) throw new Error(error.message)
  return ((data ?? []) as SearchHit[]).map((h) => ({ ...h, rank: Number(h.rank) || 0 }))
}

/** Keeps an item when it is in the full-text result set or matches locally (so results appear instantly). */
export function keep(id: string, text: string, q: string, ftsIds: Set<string> | null): boolean {
  if (!normaliseQuery(q)) return true
  return (ftsIds?.has(id) ?? false) || localMatch(text, q)
}

/**
 * Debounced full-text search for one kind of record.
 * ids is null while the query is empty or if the database search is unavailable.
 */
export function useFullTextIds(q: string, kind: SearchKind, delay = 250, gardenId?: string) {
  const [state, setState] = useState<{ ids: Set<string> | null; active: boolean; failed: boolean }>({ ids: null, active: false, failed: false })
  useEffect(() => {
    const query = normaliseQuery(q)
    if (!query) { setState({ ids: null, active: false, failed: false }); return }
    let live = true
    const t = setTimeout(() => {
      searchGarden(query, 50, gardenId)
        .then((hits) => { if (live) setState({ ids: new Set(hits.filter((h) => h.kind === kind).map((h) => h.id)), active: true, failed: false }) })
        .catch(() => { if (live) setState({ ids: null, active: false, failed: true }) })
    }, delay)
    return () => { live = false; clearTimeout(t) }
  }, [q, kind, delay, gardenId])
  return state
}

// ======================================================================
// components/CommandPalette.tsx
// ======================================================================
/* =====================================================================
   Command palette (Ctrl/⌘ + K): jump to any page, or search every plant,
   bed, harvest and task with Postgres full-text search. Falls back to an
   in-memory search if the database search is unavailable.
   ===================================================================== */

export interface PageLink { to: string; label: string; icon: LucideIcon }
interface Item { key: string; label: string; detail: string; to: string; icon: LucideIcon; group: string }

const KIND: Record<SearchKind, { icon: LucideIcon; group: string; to: (h: SearchHit) => string }> = {
  plant: { icon: Sprout, group: 'Plants', to: (h) => `/plants?q=${encodeURIComponent(h.title)}` },
  bed: { icon: Rows3, group: 'Beds', to: (h) => `/beds?q=${encodeURIComponent(h.title.split(' · ')[0])}` },
  harvest: { icon: ShoppingBasket, group: 'Harvests', to: (h) => `/harvests?q=${encodeURIComponent(h.title)}` },
  task: { icon: CalendarDays, group: 'Tasks', to: () => '/calendar' }
}

export function CommandPalette({ open, onClose, pages }: { open: boolean; onClose: () => void; pages: PageLink[] }) {
  const nav = useNavigate()
  const { beds, plants, harvests, tasks, gardenId } = useData()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'fts' | 'local'>('fts')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) { setQ(''); setHits([]); setActive(0); setTimeout(() => input.current?.focus(), 20) } }, [open])

  // debounced full-text search, with a local fallback
  useEffect(() => {
    const query = normaliseQuery(q)
    if (!open || !query) { setHits([]); setBusy(false); return }
    let live = true
    setBusy(true)
    const t = setTimeout(async () => {
      try {
        const r = await searchGarden(query, 12, gardenId)
        if (live) { setHits(r); setMode('fts') }
      } catch {
        if (!live) return
        const local: SearchHit[] = [
          ...plants.filter((p) => localMatch(`${p.name} ${p.category} ${p.notes ?? ''}`, query)).map((p) => ({ kind: 'plant' as const, id: p.id, title: p.name, detail: `${p.category} · ${p.status}`, rank: 0 })),
          ...beds.filter((b) => localMatch(`${b.code} ${b.name} ${b.zone ?? ''}`, query)).map((b) => ({ kind: 'bed' as const, id: b.id, title: `${b.code} · ${b.name}`, detail: b.soil_type, rank: 0 })),
          ...harvests.filter((h) => localMatch(`${h.plant_name} ${h.notes ?? ''}`, query)).map((h) => ({ kind: 'harvest' as const, id: h.id, title: h.plant_name, detail: `${h.quantity} ${h.unit} · ${h.harvested_on}`, rank: 0 })),
          ...tasks.filter((x) => localMatch(`${x.title} ${x.notes ?? ''}`, query)).map((x) => ({ kind: 'task' as const, id: x.id, title: x.title, detail: `${x.type} · due ${x.due_date}`, rank: 0 }))
        ].slice(0, 12)
        setHits(local); setMode('local')
      } finally { if (live) setBusy(false) }
    }, 200)
    return () => { live = false; clearTimeout(t) }
  }, [q, open, plants, beds, harvests, tasks, gardenId])

  const items = useMemo<Item[]>(() => {
    const query = normaliseQuery(q)
    const pageItems = pages.filter((p) => !query || localMatch(p.label, query)).slice(0, query ? 4 : 11)
      .map((p) => ({ key: 'p' + p.to, label: p.label, detail: 'Go to page', to: p.to, icon: p.icon, group: 'Pages' }))
    const found = hits.map((h) => ({ key: h.kind + h.id, label: h.title, detail: h.detail, to: KIND[h.kind].to(h), icon: KIND[h.kind].icon, group: KIND[h.kind].group }))
    return [...pageItems, ...found]
  }, [q, hits, pages])

  useEffect(() => { setActive(0) }, [items.length])
  if (!open) return null

  const go = (it?: Item) => { if (!it) return; onClose(); nav(it.to) }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); go(items[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  let lastGroup = ''
  return (
    <div className="fixed inset-0 z-[60] grid place-items-start bg-black/70 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Search the garden" className="glass-strong mx-auto w-full max-w-2xl overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-line px-4">
          {busy ? <Loader2 className="size-5 animate-spin text-lime-300" /> : <Search className="size-5 text-lime-300" />}
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} maxLength={200}
            role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-activedescendant={items[active] ? `cmdk-${active}` : undefined}
            placeholder="Search plants, beds, harvests, tasks… or jump to a page" style={{ outline: 'none' }} className="min-h-14 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-dim" />
          <kbd className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-dim">Esc</kbd>
        </div>
        <ul id="cmdk-list" role="listbox" className="max-h-[52vh] overflow-y-auto scrollbar-thin p-2">
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? (lastGroup = it.group) : null
            const Icon = it.icon
            return (
              <li key={it.key} role="presentation">
                {head && <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-dim">{head}</p>}
                <button id={`cmdk-${i}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(it)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm ${i === active ? 'bg-lime-300/12 text-ink' : 'text-muted'}`}>
                  <Icon className={`size-4 shrink-0 ${i === active ? 'text-lime-300' : 'text-dim'}`} />
                  <span className="min-w-0 flex-1 truncate"><span className="font-semibold text-ink">{it.label}</span> <span className="text-dim">· {it.detail}</span></span>
                  {i === active && <CornerDownLeft className="size-4 text-lime-300" />}
                </button>
              </li>
            )
          })}
          {normaliseQuery(q) && !busy && !hits.length && <li className="px-3 py-6 text-center text-sm text-dim">No plants, beds, harvests or tasks match “{normaliseQuery(q)}”.</li>}
        </ul>
        <p className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-dim">
          <span>↑↓ to move · Enter to open</span>
          <span>{mode === 'fts' ? 'Postgres full-text search · ranked' : 'Offline search (database search unavailable)'}</span>
        </p>
      </div>
    </div>
  )
}

// ======================================================================
// components/Templates.tsx
// ======================================================================
/* =====================================================================
   Decorative template visuals (no WebGL):
   - RibbonLines: flowing neon line ribbons (Connective template)
   - FestRings:   concentric warped rings + gradient wave (Music Fest)
   - GlassArcs:   glowing glass arcs and colour blooms (Consolidator)
   ===================================================================== */

/** Animated bundles of thin neon lines drawn on a 2D canvas; pauses off screen. */
export function RibbonLines({ className = '', bundles = [
  { x: 0.18, color: '#ff3d5a', amp: 0.09 }, { x: 0.47, color: '#a855f7', amp: 0.12 }, { x: 0.78, color: '#3b82f6', amp: 0.1 }
] }: { className?: string; bundles?: { x: number; color: string; amp: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const g = c.getContext('2d'); if (!g) return
    let raf = 0, on = true, w = 0, h = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const size = () => { w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0) }
    size()
    const ro = new ResizeObserver(size); ro.observe(c)
    const io = new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw) } }); io.observe(c)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    function draw(ms: number) {
      if (!g) return
      const t = reduce ? 0 : ms / 1000
      g.clearRect(0, 0, w, h); g.globalCompositeOperation = 'lighter'; g.lineWidth = 1
      bundles.forEach((b, bi) => {
        for (let k = 0; k < 22; k++) {
          const ph = k * 0.11 + bi * 2
          g.strokeStyle = b.color; g.globalAlpha = 0.18 + (k / 22) * 0.45
          g.beginPath()
          for (let y = -10; y <= h + 10; y += 8) {
            const yy = y / h
            const x = w * b.x + Math.sin(yy * 5.2 + t * 0.7 + ph) * w * b.amp + Math.sin(yy * 11 - t * 1.1 + ph * 1.7) * w * 0.018 + (k - 11) * (3 + Math.sin(yy * 3 + t * 0.5) * 2.5)
            if (y === -10) g.moveTo(x, y); else g.lineTo(x, y)
          }
          g.stroke()
        }
      })
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'
      if (on && !reduce) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() }
  }, [bundles])
  return <canvas ref={ref} className={className} aria-hidden="true" />
}

/** Concentric warped rings with a warm gradient, slowly turning. */
export function FestRings({ className = '' }: { className?: string }) {
  const paths = useMemo(() => Array.from({ length: 26 }, (_, i) => {
    const r = 40 + i * 9, pts: string[] = []
    for (let a = 0; a <= 64; a++) {
      const th = (a / 64) * Math.PI * 2
      const k = r * (1 + 0.18 * Math.sin(th * 2 + i * 0.22) + 0.08 * Math.sin(th * 3 - i * 0.15))
      pts.push(`${(300 + Math.cos(th) * k * 1.15).toFixed(1)},${(300 + Math.sin(th) * k * 0.82).toFixed(1)}`)
    }
    return 'M' + pts.join('L') + 'Z'
  }), [])
  return (
    <svg viewBox="0 0 600 600" className={className} aria-hidden="true">
      <defs><linearGradient id="festg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffb36b" /><stop offset=".5" stopColor="#ff4f8b" /><stop offset="1" stopColor="#8b3dff" /></linearGradient></defs>
      <g className="fest-spin" style={{ transformOrigin: '300px 300px' }}>
        {paths.map((d, i) => <path key={i} d={d} fill="none" stroke="url(#festg)" strokeWidth="1.3" opacity={0.25 + (i / 26) * 0.7} />)}
      </g>
    </svg>
  )
}

/** Soft colour blooms and glassy light arcs on black. */
export function GlassArcs({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      <div className="absolute left-[8%] top-[10%] size-[26rem] rounded-full bg-[#7c3aed]/30 blur-[90px]" />
      <div className="arc-bloom absolute right-[18%] top-[30%] size-[22rem] rounded-full bg-[#eef53c]/35 blur-[80px]" />
      <div className="absolute right-[-5%] top-[-10%] size-[20rem] rounded-full bg-[#2563eb]/25 blur-[90px]" />
      <svg viewBox="0 0 1000 600" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id="arc1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#7dd3fc" stopOpacity="0" /></linearGradient>
          <linearGradient id="arc2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#eef53c" stopOpacity="0" /><stop offset=".6" stopColor="#eef53c" stopOpacity=".8" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
          <filter id="arcglow"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>
        <path d="M-50 620 Q 180 60 1050 40" fill="none" stroke="url(#arc1)" strokeWidth="26" opacity=".18" filter="url(#arcglow)" />
        <path className="arc-draw" d="M-50 620 Q 180 60 1050 40" fill="none" stroke="url(#arc1)" strokeWidth="1.6" />
        <path d="M120 640 Q 260 180 1040 150" fill="none" stroke="url(#arc2)" strokeWidth="14" opacity=".25" filter="url(#arcglow)" />
        <path className="arc-draw" style={{ animationDelay: '.4s' }} d="M120 640 Q 260 180 1040 150" fill="none" stroke="url(#arc2)" strokeWidth="1.2" />
      </svg>
    </div>
  )
}

// ======================================================================
// three/TemplateScenes.tsx
// ======================================================================
/* =====================================================================
   3D scenes for the second template pack, restyled for the garden:
   * terrain  – a dusk field of soil drawn as glowing seed-dots (after the
                particle-landscape portfolio template)
   * plexus   – a wireframe "seed brain" with annotated nodes for the AI
                pages (after the network-brain AI template)
   * showroom – a glossy black raised bed with chrome-and-neon plants on a
                mirror floor, behind a giant wordmark (after the detailing
                atelier template)
   Scenes stop rendering when scrolled out of view.
   ===================================================================== */

export type TemplateKind = 'terrain' | 'plexus' | 'showroom'
const NEON = '#eef53c'

/* smooth pseudo-noise (no dependency) */
function field(x: number, z: number, t = 0) {
  return Math.sin(x * 0.35 + t * 0.2) * 0.9 + Math.cos(z * 0.42 - t * 0.15) * 0.8
    + Math.sin((x + z) * 0.18) * 1.6 + Math.sin(x * 0.9 + z * 0.7) * 0.25 + Math.cos(z * 1.3 - x * 0.4) * 0.18
}

/* ------------------------------ terrain ------------------------------ */
function Terrain() {
  const W = 90, D = 50, SX = 200, SZ = 120
  const { geo, dots } = useMemo(() => {
    const g = new THREE.PlaneGeometry(W, D, SX, SZ); g.rotateX(-Math.PI / 2)
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i)
      const ridge = Math.max(0, Math.abs(x) - 5) * 0.3 + Math.max(0, -z - 12) * 0.25 // a valley down the middle, like a path between beds
      p.setY(i, field(x, z) * (0.55 + ridge) + ridge * 1.6)
    }
    g.computeVertexNormals()
    // every 2nd vertex becomes a glowing dot; brighter in the valley
    const pos: number[] = [], col: number[] = []
    const c = new THREE.Color()
    for (let i = 0; i < p.count; i += 2) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
      pos.push(x, y + 0.04, z)
      const glow = Math.max(0.12, 1 - Math.abs(x) / 16) * (0.55 + Math.random() * 0.45)
      c.set(NEON).lerp(new THREE.Color('#ffb86b'), Math.random() * 0.5).multiplyScalar(glow)
      col.push(c.r, c.g, c.b)
    }
    const d = new THREE.BufferGeometry()
    d.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    d.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    return { geo: g, dots: d }
  }, [])
  const grp = useRef<THREE.Group>(null)
  const { camera, pointer } = useThree()
  useFrame((st) => {
    const t = st.clock.elapsedTime
    camera.position.x = Math.sin(t * 0.05) * 2.4 + pointer.x * 1.2
    camera.position.y = 3.4 + Math.sin(t * 0.07) * 0.3 + pointer.y * 0.5
    camera.lookAt(0, 1.6, -14)
    if (grp.current) grp.current.position.z = (t * 0.6) % 0.8 // slow forward drift
  })
  return (
    <group ref={grp}>
      <mesh geometry={geo}><meshStandardMaterial color="#3a2a1c" roughness={0.9} metalness={0} /></mesh>
      <points geometry={dots}><pointsMaterial size={0.075} vertexColors sizeAttenuation transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} /></points>
    </group>
  )
}

/* ------------------------------ plexus ------------------------------ */
function Plexus() {
  const { wire, nodes, hot } = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1.5, 3)
    const p = g.attributes.position as THREE.BufferAttribute
    const v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      // two lobes and a fold, so it reads as a seed / brain rather than a ball
      const lobe = 1 + 0.16 * Math.sin(v.x * 3.1) * Math.cos(v.y * 2.3) + 0.1 * Math.sin(v.z * 4.2 + v.x)
      const fold = 1 - 0.18 * Math.exp(-(v.x * v.x) * 6) * (v.y > 0 ? 1 : 0.3)
      v.multiplyScalar(lobe * fold); v.x *= 1.22; v.y *= 0.92
      p.setXYZ(i, v.x, v.y, v.z)
    }
    const wire = new THREE.WireframeGeometry(g)
    const nodes = new THREE.BufferGeometry(); nodes.setAttribute('position', p.clone())
    const hot: THREE.Vector3[] = []
    for (let i = 0; i < p.count; i += 37) hot.push(new THREE.Vector3().fromBufferAttribute(p, i))
    return { wire, nodes, hot: hot.slice(0, 14) }
  }, [])
  const dust = useMemo(() => {
    const a = new Float32Array(600 * 3)
    for (let i = 0; i < 600; i++) { const r = 2.4 + Math.random() * 3.5, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1); a.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.6, r * Math.sin(ph) * Math.sin(th)], i * 3) }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); return g
  }, [])
  const ref = useRef<THREE.Group>(null)
  const pulse = useRef<THREE.Group>(null)
  const { pointer } = useThree()
  useFrame((st, dt) => {
    if (ref.current) { ref.current.rotation.y += dt * 0.12; ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, -pointer.y * 0.25, 0.05) }
    pulse.current?.children.forEach((c, i) => { const s = 1 + 0.6 * Math.max(0, Math.sin(st.clock.elapsedTime * 1.6 + i * 1.3)); c.scale.setScalar(s) })
  })
  return (
    <>
      <group ref={ref}>
        <lineSegments geometry={wire}><lineBasicMaterial color="#d9d9d9" transparent opacity={0.22} depthWrite={false} /></lineSegments>
        <points geometry={nodes}><pointsMaterial size={0.035} color="#ffffff" transparent opacity={0.8} sizeAttenuation depthWrite={false} /></points>
        <group ref={pulse}>
          {hot.map((p, i) => <mesh key={i} position={p}><sphereGeometry args={[0.035, 10, 10]} /><meshBasicMaterial color={i % 3 ? NEON : '#ffb86b'} toneMapped={false} /></mesh>)}
        </group>
      </group>
      <points geometry={dust}><pointsMaterial size={0.02} color="#c9a86a" transparent opacity={0.55} sizeAttenuation depthWrite={false} /></points>
    </>
  )
}

/* ------------------------------ showroom ------------------------------ */
const GLOSS = new THREE.MeshPhysicalMaterial({ color: '#060606', metalness: 0.6, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 })
const TPL_CHROME = new THREE.MeshStandardMaterial({ color: '#dcdcdc', metalness: 1, roughness: 0.08 })
const TPL_LEAF = new THREE.MeshPhysicalMaterial({ color: '#2b2f12', metalness: 0.7, roughness: 0.18, clearcoat: 1, emissive: NEON, emissiveIntensity: 0.04 })
const TPL_SOIL = new THREE.MeshStandardMaterial({ color: '#17100a', roughness: 1 })

function Sprout({ position, h = 1, s = 1, turn = 0 }: { position: [number, number, number]; h?: number; s?: number; turn?: number }) {
  const leaf = useMemo(() => {
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.quadraticCurveTo(0.28, 0.25, 0, 0.75); shape.quadraticCurveTo(-0.28, 0.25, 0, 0)
    return new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 3, curveSegments: 16 })
  }, [])
  return (
    <group position={position} rotation={[0, turn, 0]} scale={s}>
      <mesh material={TPL_CHROME} position={[0, h / 2, 0]}><cylinderGeometry args={[0.018, 0.03, h, 10]} /></mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={leaf} material={TPL_LEAF} position={[0, h * (0.35 + i * 0.2), 0]} rotation={[0.9 - i * 0.1, i * 1.9, i % 2 ? 0.5 : -0.5]} scale={0.7 - i * 0.08} />
      ))}
      <mesh position={[0, h + 0.05, 0]}><sphereGeometry args={[0.06, 16, 16]} /><meshBasicMaterial color={NEON} toneMapped={false} /></mesh>
    </group>
  )
}

function Showroom() {
  const rig = useRef<THREE.Group>(null)
  const { pointer } = useThree()
  useFrame((st) => {
    if (!rig.current) return
    rig.current.rotation.y = THREE.MathUtils.lerp(rig.current.rotation.y, -0.55 + pointer.x * 0.35 + Math.sin(st.clock.elapsedTime * 0.2) * 0.08, 0.04)
  })
  return (
    <>
      <group ref={rig} position={[0, -0.6, 0]} scale={0.82}>
        <RoundedBox args={[3.4, 0.62, 1.5]} radius={0.12} smoothness={6} position={[0, 0.31, 0]} material={GLOSS} />
        <mesh position={[0, 0.6, 0]} material={TPL_SOIL}><boxGeometry args={[3.15, 0.04, 1.25]} /></mesh>
        {[[-1.1, 0.62, -0.25, 1.1, 1, 0], [-0.35, 0.62, 0.2, 1.5, 1.15, 1], [0.45, 0.62, -0.2, 1.25, 1, 2], [1.15, 0.62, 0.25, 0.9, 0.9, 3]].map(([x, y, z, h, s, t], i) => <Sprout key={i} position={[x, y, z]} h={h} s={s} turn={t} />)}
        {/* neon trim, like a tail-light accent */}
        <mesh position={[1.72, 0.31, 0]}><boxGeometry args={[0.02, 0.22, 1.2]} /><meshBasicMaterial color={NEON} toneMapped={false} /></mesh>
      </group>
      <ContactShadows position={[0, -0.6, 0]} opacity={0.85} scale={9} blur={2.4} far={2} color="#000" />
      <ambientLight intensity={0.25} />
      <spotLight position={[2, 6, 4]} angle={0.4} penumbra={1} intensity={60} color="#fff6e0" />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={6} position={[0, 5, -2]} rotation-x={Math.PI / 2} scale={[10, 0.4, 1]} />
        <Lightformer form="rect" intensity={5} position={[-3, 4, 1]} rotation-x={Math.PI / 2} scale={[0.3, 8, 1]} />
        <Lightformer form="rect" intensity={5} position={[3, 4, 1]} rotation-x={Math.PI / 2} scale={[0.3, 8, 1]} />
        <Lightformer form="ring" intensity={1.5} position={[0, 2, 6]} scale={3} />
        <Lightformer form="rect" color={NEON} intensity={1.2} position={[-6, 1, 0]} rotation-y={Math.PI / 2} scale={[6, 0.25, 1]} />
      </Environment>
    </>
  )
}

/* ------------------------------ wrapper ------------------------------ */
const CAMS: Record<TemplateKind, { position: [number, number, number]; fov: number }> = {
  terrain: { position: [0, 3.4, 12], fov: 55 },
  plexus: { position: [0, 0, 7.2], fov: 40 },
  showroom: { position: [0, 1.5, 7.4], fov: 32 }
}

export function TemplateSceneCanvas({ kind, className = '' }: { kind: TemplateKind; className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = host.current; if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '120px' })
    io.observe(el); return () => io.disconnect()
  }, [])
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return (
    <div ref={host} className={className} aria-hidden="true">
      {visible && (
        <Canvas dpr={[1, 1.75]} camera={CAMS[kind]} frameloop={reduced ? 'demand' : 'always'} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
          {kind === 'terrain' && <><color attach="background" args={['#0b0806']} /><fog attach="fog" args={['#0b0806', 10, 40]} /><hemisphereLight args={['#8a6a45', '#000', 1.1]} /><directionalLight position={[-8, 4, -14]} intensity={2.4} color="#ffcf8a" /><Terrain /></>}
          {kind === 'plexus' && <Float speed={1} rotationIntensity={0.2} floatIntensity={0.5}><Plexus /></Float>}
          {kind === 'showroom' && <Showroom />}
        </Canvas>
      )}
    </div>
  )
}

// ======================================================================
// components/TemplatesV2.tsx
// ======================================================================
/* =====================================================================
   Template pack #2, rebuilt for the garden in the black + neon theme:
   1. Showroom  – giant wide wordmark, 3D object in front, mono side notes
   2. Terrain   – dusk dot-landscape, side section nav, wide-tracked title
   3. Neon bars – glitchy light columns + a running logo strip
   4. Orbit     – a planet-edge arc of light with a centred serif headline
   5. Plexus    – wireframe "seed brain" with annotated callouts (AI pages)
   ===================================================================== */

export function TemplateScene({ kind, className }: { kind: TemplateKind; className?: string }) {
  return <Suspense fallback={null}><TemplateSceneCanvas kind={kind} className={className} /></Suspense>
}

/* ---------- 3. glitchy neon light columns (canvas, pauses off-screen) ---------- */
export function NeonBars({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0, on = true, t = 0
    const cols = Array.from({ length: 90 }, (_, i) => ({ x: i / 90, h: 0.15 + Math.random() * 0.5, y: 0.1 + Math.random() * 0.4, ph: Math.random() * 6, hue: Math.random() }))
    const size = () => { const r = c.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); c.width = r.width * d; c.height = r.height * d }
    size(); const ro = new ResizeObserver(size); ro.observe(c)
    const io = new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on && !raf) loop() }); io.observe(c)
    function draw() {
      const W = c!.width, H = c!.height
      ctx!.clearRect(0, 0, W, H)
      ctx!.globalCompositeOperation = 'lighter'
      const core = 0.62 + Math.sin(t * 0.3) * 0.04
      for (const col of cols) {
        const near = Math.exp(-((col.x - core) ** 2) / 0.02) // brighter towards the core
        const flick = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + col.ph))
        const a = (0.08 + near * 0.6) * flick
        const x = col.x * W, w = Math.max(1.5, W / 260 * (1 + near * 2))
        const y = (col.y - near * 0.08) * H, h = (col.h + near * 0.35) * H
        const g = ctx!.createLinearGradient(0, y, 0, y + h)
        const color = near > 0.85 ? '255,255,235' : col.hue > 0.7 ? '238,245,60' : col.hue > 0.35 ? '40,220,140' : '40,170,190'
        g.addColorStop(0, `rgba(${color},0)`); g.addColorStop(0.5, `rgba(${color},${a})`); g.addColorStop(1, `rgba(${color},0)`)
        ctx!.fillStyle = g
        for (let k = 0; k < 3; k++) ctx!.fillRect(x + k * w * 1.8, y, w, h) // little triplets read as "data"
        if (near > 0.85) { ctx!.fillStyle = `rgba(255,60,60,${0.18 * flick})`; ctx!.fillRect(x - w * 2, y, w, h) } // chromatic fringe
      }
      ctx!.globalCompositeOperation = 'source-over'
      ctx!.fillStyle = 'rgba(0,0,0,0.25)'
      for (let yy = 0; yy < H; yy += 4) ctx!.fillRect(0, yy, W, 1) // scanlines
    }
    function loop() { raf = 0; if (!on) return; t += 0.016; draw(); if (!reduced) raf = requestAnimationFrame(loop) }
    loop()
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() }
  }, [])
  return <canvas ref={ref} className={`pointer-events-none block blur-[0.6px] ${className}`} aria-hidden="true" />
}

/* ---------- 4. orbit arc of light ---------- */
export function OrbitArc({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div className="absolute -left-[10%] top-[18%] size-[46vw] max-h-[520px] max-w-[520px] rounded-full bg-[#ff6a1a]/25 blur-[90px]" />
      <svg className="orbit-svg absolute inset-0 size-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="orbit-g" x1="0.1" y1="0" x2="0.6" y2="1">
            <stop offset="0" stopColor="#ff7a1a" stopOpacity="0" /><stop offset="0.08" stopColor="#ff7a1a" /><stop offset="0.3" stopColor="#ffd27a" />
            <stop offset="0.5" stopColor="#eef53c" stopOpacity="0.8" /><stop offset="0.75" stopColor="#7fc8ff" stopOpacity="0.45" /><stop offset="1" stopColor="#1b3b55" stopOpacity="0" />
          </linearGradient>
          <filter id="orbit-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14" /></filter>
        </defs>
        <circle cx="1700" cy="-250" r="1500" fill="none" stroke="url(#orbit-g)" strokeWidth="26" filter="url(#orbit-blur)" opacity="0.55" />
        <circle cx="1700" cy="-250" r="1500" fill="none" stroke="url(#orbit-g)" strokeWidth="2.2" />
        <circle cx="1700" cy="-250" r="1486" fill="none" stroke="#7fc8ff" strokeOpacity="0.18" strokeWidth="1" />
      </svg>
    </div>
  )
}

/* ---------- 5. plexus callout ---------- */
function Callout({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`absolute hidden max-w-[230px] lg:block ${className}`}>
      <p className="flex items-center gap-2 font-mono text-xs font-bold tracking-wider text-white"><span className="size-2 rounded-full border border-[#eef53c]" />{title}</p>
      <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-white/55">{children}</p>
    </div>
  )
}

/** Banner for the AI pages: the seed-brain network with annotations. */
export function PlexusBanner({ title, sub, kicker, actions, stats }: { title: string; sub?: string; kicker: string; actions?: ReactNode; stats?: ReactNode }) {
  return (
    <section className="banner relative mb-6 overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(60%_80%_at_50%_45%,#16130c,#000_70%)] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgb(238_245_60/.08),transparent_30%),radial-gradient(circle_at_85%_20%,rgb(255_160_80/.08),transparent_30%)]" />
      <TemplateScene kind="plexus" className="absolute inset-0" />
      <svg className="pointer-events-none absolute inset-0 hidden size-full lg:block" viewBox="0 0 1000 420" preserveAspectRatio="none" aria-hidden="true">
        <path d="M230 300 L330 300 L400 260" stroke="rgb(255 255 255 / .35)" strokeDasharray="3 4" fill="none" />
        <path d="M790 50 L700 50 L630 120" stroke="rgb(255 255 255 / .35)" strokeDasharray="3 4" fill="none" />
      </svg>
      <Callout title="WE LISTEN" className="left-[4%] top-[66%]">to your beds, soil, season and harvest history before suggesting anything.</Callout>
      <Callout title="WE SUGGEST" className="right-[5%] top-[8%] max-w-[200px]">crops, care tips and leaf-health estimates. Clearly labelled demo when no AI key is set.</Callout>
      <div className="pointer-events-none absolute right-5 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-3 sm:flex" aria-hidden="true">
        <span className="font-mono text-[10px] text-white/50">01</span><span className="size-1.5 rounded-full bg-[#eef53c]" /><span className="h-10 w-px bg-white/20" /><span className="size-1.5 rounded-full bg-white/40" /><span className="size-1.5 rounded-full bg-white/40" />
      </div>
      <div className="relative z-10 grid min-h-[460px] place-items-center px-6 py-14 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_35%_at_50%_50%,rgb(0_0_0/.55),transparent)]" aria-hidden="true" />
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-[#eef53c]">{kicker}</p>
          <h1 className="mt-4 font-display relative text-[clamp(2.2rem,4.8vw,3.8rem)] font-medium leading-[1.02] tracking-[0.02em] [text-shadow:0_4px_40px_#000]">{title}</h1>
          {sub && <p className="mx-auto mt-4 max-w-lg text-sm text-white/70 [text-shadow:0_2px_20px_#000]">{sub}</p>}
          {actions && <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>}
          {stats}
          <p className="mt-8 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40"><span className="grid size-4 place-items-center rounded-full border border-white/40"><span className="size-1 rounded-full bg-white/70" /></span>Scroll</p>
        </div>
      </div>
    </section>
  )
}

/** Banner for analytics: light columns behind a big left-aligned headline. */
export function NeonBanner({ title, sub, kicker, actions, stats }: { title: string; sub?: string; kicker: string; actions?: ReactNode; stats?: ReactNode }) {
  return (
    <section className="banner relative mb-6 overflow-hidden rounded-[28px] border border-white/10 bg-black text-white">
      <NeonBars className="absolute inset-0 size-full" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#000_10%,rgb(0_0_0/.6)_45%,transparent_80%)]" />
      <div className="relative z-10 flex min-h-[380px] flex-col justify-end px-6 py-10 sm:px-10">
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white/80"><span className="size-3 rounded-sm bg-[#eef53c]" />{kicker}</p>
        <h1 className="mt-4 max-w-2xl text-[clamp(2.4rem,5.4vw,4.4rem)] font-medium leading-[1.05] tracking-[-0.02em]">{title}</h1>
        {sub && <p className="mt-3 max-w-lg text-white/65">{sub}</p>}
        {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
        {stats}
      </div>
    </section>
  )
}

/** Banner for account: orbit arc + centred serif capitals. */
export function OrbitBanner({ title, sub, kicker, actions }: { title: string; sub?: string; kicker: string; actions?: ReactNode }) {
  return (
    <section className="banner relative mb-6 overflow-hidden rounded-[28px] border border-white/10 bg-black text-white">
      <OrbitArc />
      <div className="relative z-10 grid min-h-[380px] place-items-center px-6 py-14 text-center">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/55">{kicker}</p>
          <h1 className="font-orbit mt-5 text-[clamp(2.2rem,5.6vw,4.6rem)] uppercase leading-[1.02]">{title}</h1>
          {sub && <p className="mx-auto mt-4 max-w-lg text-white/75">{sub}</p>}
          {actions && <div className="mt-7 flex flex-wrap justify-center gap-2">{actions}</div>}
        </div>
      </div>
    </section>
  )
}

/* ===================== LANDING SECTIONS ===================== */

/** Template 1: giant wordmark with a glossy raised bed in front of it. */
export function ShowroomSection({ beds, growing }: { beds: number; growing: number }) {
  return (
    <section id="showroom" className="relative h-[100svh] min-h-[640px] scroll-mt-4 overflow-hidden bg-[radial-gradient(90%_70%_at_50%_35%,#2b2d31,#0b0b0c_60%,#000)]">
      <div className="star-dust absolute inset-0 opacity-60" aria-hidden="true" />
      <h2 className="font-wide pointer-events-none absolute inset-x-0 top-[20%] select-none text-center text-[clamp(4.5rem,19vw,17rem)] leading-[0.8] text-[#ece8df]" aria-label="Harvest">HARVEST</h2>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-[radial-gradient(60%_55%_at_50%_0%,rgb(160_160_165/.28),transparent_70%),linear-gradient(180deg,#141416,#000)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 top-[45%] h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" aria-hidden="true" />
      <TemplateScene kind="showroom" className="absolute inset-0 z-10" />
      <div className="pointer-events-none absolute left-5 top-1/2 z-20 hidden font-mono text-[11px] uppercase leading-6 tracking-[0.28em] text-white/45 sm:left-10 md:block">Community garden<br />Planner · live</div>
      <div className="pointer-events-none absolute right-5 top-1/2 z-20 hidden text-right font-mono text-[11px] uppercase leading-6 tracking-[0.28em] text-white/45 sm:right-10 md:block"><span className="mb-3 ml-auto block h-px w-10 bg-white/60" />Plan · sow<br />Track · harvest</div>
      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-end justify-between gap-6 px-5 pb-10 sm:px-10">
        <p className="font-wide text-[clamp(1.8rem,3.6vw,3rem)] leading-[1.02] text-[#ece8df]">Every bed,<br />grown by hand.</p>
        <p className="hidden text-center font-mono text-[11px] uppercase tracking-[0.35em] text-white/45 md:block">{beds} beds · {growing} growing<span className="mx-auto mt-3 block h-8 w-px bg-white/40" /></p>
        <Link to="/beds" className="inline-flex min-h-11 items-center gap-3 rounded-full bg-[#ece8df] px-5 text-sm font-bold text-black transition hover:bg-[#eef53c]">Plan a bed <ArrowRight className="size-4" /></Link>
      </div>
    </section>
  )
}

/** Template 2: dot terrain with a side section index. */
export function TerrainSection({ sections }: { sections: [string, string][] }) {
  const [active, setActive] = useState(sections[0]?.[0])
  useEffect(() => {
    const els = sections.map(([h]) => document.querySelector(h)).filter(Boolean) as Element[]
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(`#${e.target.id}`)), { threshold: 0.4 })
    els.forEach((e) => io.observe(e)); return () => io.disconnect()
  }, [sections])
  return (
    <section id="terrain" className="relative h-[100svh] min-h-[620px] scroll-mt-4 overflow-hidden bg-[#0b0806]">
      <TemplateScene kind="terrain" className="absolute inset-0" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#0b0806_0%,transparent_30%,transparent_65%,#0b0806)]" aria-hidden="true" />
      <nav aria-label="Page sections" className="absolute left-5 top-1/2 z-10 hidden -translate-y-1/2 gap-6 text-sm md:grid">
        {sections.map(([h, l]) => (
          <a key={h} href={h} className={`flex items-center gap-3 transition ${active === h ? 'text-white' : 'text-white/45 hover:text-white/80'}`}>
            <span className={`block w-0.5 transition-all ${active === h ? 'h-8 bg-[#eef53c]' : 'h-1 bg-white/40'}`} />{l}
          </a>
        ))}
      </nav>
      <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-12 sm:px-10 md:pl-[13%]">
        <p className="text-sm text-white/60">Shared soil, mapped</p>
        <h2 className="font-track mt-2 text-[clamp(1.7rem,4.4vw,3.6rem)] leading-none text-white">EVERY SEED COUNTS</h2>
        <p className="mt-4 max-w-xl text-lg text-white/80">Each dot is a seed in the ground. The planner tracks every one, from sowing to harvest.</p>
        <div className="mt-6 flex flex-wrap items-center gap-6 text-sm text-white/60">
          <a href="#live" className="flex items-center gap-3 hover:text-white">Scroll <span className="h-px w-12 bg-white/40" /></a>
          <a href="#how" className="flex items-center gap-2 hover:text-white">Skip intro <ArrowDown className="size-3.5" /></a>
          <span className="text-white/25">|</span>
          <Link to="/garden" className="text-white hover:text-[#eef53c]">Walk the 3D garden</Link>
        </div>
      </div>
    </section>
  )
}

const STACK = ['React 19', 'Supabase', 'PostgreSQL', 'Row-Level Security', 'Google Gemini', 'Three.js', 'Vercel', 'TypeScript', 'Tailwind CSS', 'Playwright', 'Vitest', 'Offline PWA']

/** Template 3: neon data columns, headline, and a running strip of the stack. */
export function NeonStackSection() {
  return (
    <section id="stack" className="relative scroll-mt-4 overflow-hidden bg-black">
      <a href="#how" className="relative z-20 flex items-center justify-center gap-2 overflow-hidden border-b border-white/10 py-2.5 text-center text-xs font-medium text-white sm:text-sm">
        <span className="dither absolute inset-y-0 left-0 w-1/4" aria-hidden="true" /><span className="dither absolute inset-y-0 right-0 w-1/4 scale-x-[-1]" aria-hidden="true" />
        <span className="relative">Private gardens with unlimited members, now for everyone. Invite your plot-mates and grow together.</span><ArrowRight className="relative size-3.5" />
      </a>
      <div className="relative min-h-[620px]">
        <NeonBars className="absolute inset-0 size-full" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#000_0%,transparent_45%)]" aria-hidden="true" />
        <div className="relative z-10 flex min-h-[620px] flex-col justify-end px-5 pb-12 sm:px-10">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white/80"><span className="size-3 rounded-sm bg-[#eef53c]" />A community project</p>
          <h2 className="mt-4 max-w-3xl text-[clamp(2.4rem,5.4vw,4.6rem)] font-medium leading-[1.08] tracking-[-0.02em] text-white">Fast garden data<br />for plots and people</h2>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/account" className="inline-flex min-h-12 items-center rounded-full bg-white px-7 font-medium text-black transition hover:bg-[#eef53c]">Get started</Link>
            <Link to="/settings" className="inline-flex min-h-12 items-center rounded-full border border-white/40 px-7 font-medium text-white transition hover:border-[#eef53c] hover:text-[#eef53c]">How it’s secured</Link>
          </div>
        </div>
      </div>
      <div className="relative mx-5 overflow-hidden border-t border-white/15 py-8 sm:mx-10" aria-label="Built with">
        <div className="marquee flex w-max gap-16">
          {[...STACK, ...STACK].map((s, i) => <span key={i} className="whitespace-nowrap font-display text-2xl font-bold tracking-tight text-white/45">{s}</span>)}
        </div>
      </div>
    </section>
  )
}

/** Template 4: orbit arc with a centred invitation to join a garden. */
export function OrbitJoinSection({ members }: { members: string[] }) {
  return (
    <section id="join" className="relative scroll-mt-4 overflow-hidden bg-black">
      <OrbitArc />
      <div className="relative z-10 grid min-h-[100svh] place-items-center px-5 py-24 text-center">
        <div>
          <h2 className="font-orbit text-[clamp(2.4rem,6.4vw,5.4rem)] uppercase leading-[1.02] text-white">We connect people<br />growing together</h2>
          <p className="mt-5 text-lg text-white/80">A private garden for every plot, street and school, with roles for everyone</p>
          <Link to="/account" className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-white px-8 font-semibold text-black transition hover:bg-[#eef53c]">Create your garden</Link>
          <p className="mt-24 text-xs uppercase tracking-[0.25em] text-white/50">Growing in this garden</p>
          <div className="mt-6 flex flex-wrap justify-center gap-x-10 gap-y-4">
            {members.map((m) => <span key={m} className="font-display text-xl font-bold tracking-wide text-white/55">{m}</span>)}
          </div>
        </div>
      </div>
    </section>
  )
}

// ======================================================================
// lib/format.ts
// ======================================================================
export const todayISO = () => toISO(new Date())
export function toISO(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export function parseISO(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export function addDays(iso: string, n: number) { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d) }
export function daysBetween(a: string, b: string) { return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000) }
export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '—'
  return parseISO(iso.slice(0, 10)).toLocaleDateString('en-IN', opts)
}
export function relDay(iso: string) {
  const n = daysBetween(todayISO(), iso)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  return n > 0 ? `In ${n} days` : `${-n} days ago`
}
export function timeAgo(ts: string) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}
export const num = (v: number, d = 0) => v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })

/** Converts weight-based harvests to kg; count units return null. */
export function toKg(h: Pick<Harvest, 'quantity' | 'unit'>) {
  const q = Number(h.quantity)
  if (h.unit === 'kg') return q
  if (h.unit === 'g') return q / 1000
  if (h.unit === 'lb') return q * 0.453592
  return null
}
export const monthKey = (iso: string) => iso.slice(0, 7)
export function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}
export function lastMonths(n: number) {
  const out: string[] = []; const d = new Date(); d.setDate(1)
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(toISO(x).slice(0, 7)) }
  return out
}

// ======================================================================
// lib/catalog.ts
// ======================================================================
/** The 3D silhouette used to draw a plant in the garden scene. */
export type Shape = 'fruiting' | 'leafy' | 'root' | 'tall' | 'berry' | 'herb' | 'flower' | 'vine'

export interface CatalogEntry {
  name: string
  category: Category
  days: number            // typical days from sowing to first harvest
  shape: Shape
  color: string           // fruit / flower / root accent colour in 3D
  sun: 'Full sun' | 'Partial sun' | 'Shade tolerant'
  water: 'Low' | 'Medium' | 'High'
  soils: SoilType[]
  seasons: Season[]
  spacing_cm: number
}
export type Season = 'Spring' | 'Summer' | 'Monsoon' | 'Autumn' | 'Winter'
export const SEASONS: Season[] = ['Spring', 'Summer', 'Monsoon', 'Autumn', 'Winter']

/** General horticulture reference values; real timings vary with variety and climate. */
export const CATALOG: CatalogEntry[] = [
  { name: 'Tomato', category: 'Vegetable', days: 75, shape: 'fruiting', color: '#e5432a', sun: 'Full sun', water: 'High', soils: ['Loamy', 'Sandy', 'Silty'], seasons: ['Spring', 'Summer', 'Autumn'], spacing_cm: 50 },
  { name: 'Chilli', category: 'Vegetable', days: 90, shape: 'fruiting', color: '#d62828', sun: 'Full sun', water: 'Medium', soils: ['Loamy', 'Sandy'], seasons: ['Spring', 'Summer', 'Monsoon'], spacing_cm: 45 },
  { name: 'Brinjal', category: 'Vegetable', days: 80, shape: 'fruiting', color: '#5b2a86', sun: 'Full sun', water: 'Medium', soils: ['Loamy', 'Clay', 'Silty'], seasons: ['Summer', 'Monsoon', 'Autumn'], spacing_cm: 60 },
  { name: 'Okra', category: 'Vegetable', days: 60, shape: 'fruiting', color: '#7bb661', sun: 'Full sun', water: 'Medium', soils: ['Loamy', 'Sandy', 'Clay'], seasons: ['Summer', 'Monsoon'], spacing_cm: 40 },
  { name: 'Cucumber', category: 'Vegetable', days: 60, shape: 'vine', color: '#4c8b3a', sun: 'Full sun', water: 'High', soils: ['Loamy', 'Sandy'], seasons: ['Spring', 'Summer', 'Monsoon'], spacing_cm: 45 },
  { name: 'Lettuce', category: 'Leafy green', days: 50, shape: 'leafy', color: '#a6df7c', sun: 'Partial sun', water: 'Medium', soils: ['Loamy', 'Silty', 'Potting mix'], seasons: ['Spring', 'Autumn', 'Winter'], spacing_cm: 25 },
  { name: 'Spinach', category: 'Leafy green', days: 45, shape: 'leafy', color: '#3f8f45', sun: 'Shade tolerant', water: 'Medium', soils: ['Loamy', 'Silty', 'Clay'], seasons: ['Autumn', 'Winter', 'Spring'], spacing_cm: 15 },
  { name: 'Kale', category: 'Leafy green', days: 60, shape: 'leafy', color: '#4d8a6c', sun: 'Partial sun', water: 'Medium', soils: ['Loamy', 'Clay', 'Silty'], seasons: ['Autumn', 'Winter', 'Spring'], spacing_cm: 40 },
  { name: 'Cabbage', category: 'Leafy green', days: 90, shape: 'leafy', color: '#8fc08a', sun: 'Full sun', water: 'High', soils: ['Loamy', 'Clay'], seasons: ['Autumn', 'Winter'], spacing_cm: 45 },
  { name: 'Carrot', category: 'Root', days: 75, shape: 'root', color: '#f08a24', sun: 'Full sun', water: 'Medium', soils: ['Sandy', 'Loamy', 'Silty'], seasons: ['Autumn', 'Winter', 'Spring'], spacing_cm: 6 },
  { name: 'Radish', category: 'Root', days: 28, shape: 'root', color: '#d6336c', sun: 'Partial sun', water: 'Medium', soils: ['Sandy', 'Loamy', 'Potting mix'], seasons: ['Autumn', 'Winter', 'Spring'], spacing_cm: 5 },
  { name: 'Beetroot', category: 'Root', days: 60, shape: 'root', color: '#7a1f3d', sun: 'Partial sun', water: 'Medium', soils: ['Loamy', 'Sandy'], seasons: ['Autumn', 'Winter', 'Spring'], spacing_cm: 10 },
  { name: 'Onion', category: 'Root', days: 110, shape: 'root', color: '#c99b6d', sun: 'Full sun', water: 'Low', soils: ['Loamy', 'Sandy', 'Silty'], seasons: ['Autumn', 'Winter'], spacing_cm: 10 },
  { name: 'Potato', category: 'Root', days: 100, shape: 'root', color: '#b08a5a', sun: 'Full sun', water: 'Medium', soils: ['Loamy', 'Sandy', 'Peaty'], seasons: ['Winter', 'Spring'], spacing_cm: 30 },
  { name: 'Basil', category: 'Herb', days: 55, shape: 'herb', color: '#5cb85c', sun: 'Full sun', water: 'Medium', soils: ['Loamy', 'Sandy', 'Potting mix'], seasons: ['Spring', 'Summer', 'Monsoon'], spacing_cm: 25 },
  { name: 'Mint', category: 'Herb', days: 60, shape: 'herb', color: '#3fbf7f', sun: 'Shade tolerant', water: 'High', soils: ['Loamy', 'Clay', 'Potting mix'], seasons: ['Spring', 'Summer', 'Monsoon', 'Autumn'], spacing_cm: 30 },
  { name: 'Coriander', category: 'Herb', days: 45, shape: 'herb', color: '#6fcf62', sun: 'Partial sun', water: 'Medium', soils: ['Loamy', 'Sandy', 'Potting mix'], seasons: ['Autumn', 'Winter', 'Spring'], spacing_cm: 15 },
  { name: 'Strawberry', category: 'Fruit', days: 100, shape: 'berry', color: '#e23b3b', sun: 'Full sun', water: 'Medium', soils: ['Loamy', 'Peaty', 'Sandy'], seasons: ['Autumn', 'Winter', 'Spring'], spacing_cm: 30 },
  { name: 'Watermelon', category: 'Fruit', days: 85, shape: 'vine', color: '#2f7d3a', sun: 'Full sun', water: 'High', soils: ['Sandy', 'Loamy'], seasons: ['Summer'], spacing_cm: 90 },
  { name: 'Beans', category: 'Legume', days: 60, shape: 'vine', color: '#6aa84f', sun: 'Full sun', water: 'Medium', soils: ['Loamy', 'Clay', 'Silty'], seasons: ['Spring', 'Summer', 'Monsoon'], spacing_cm: 15 },
  { name: 'Peas', category: 'Legume', days: 65, shape: 'vine', color: '#8bc34a', sun: 'Full sun', water: 'Medium', soils: ['Loamy', 'Silty'], seasons: ['Autumn', 'Winter'], spacing_cm: 8 },
  { name: 'Sweet corn', category: 'Grain', days: 85, shape: 'tall', color: '#f2cf4a', sun: 'Full sun', water: 'High', soils: ['Loamy', 'Clay', 'Silty'], seasons: ['Spring', 'Summer', 'Monsoon'], spacing_cm: 30 },
  { name: 'Marigold', category: 'Flower', days: 60, shape: 'flower', color: '#f59e0b', sun: 'Full sun', water: 'Low', soils: ['Loamy', 'Sandy', 'Clay', 'Potting mix'], seasons: ['Spring', 'Summer', 'Monsoon', 'Autumn', 'Winter'], spacing_cm: 25 },
  { name: 'Sunflower', category: 'Flower', days: 85, shape: 'flower', color: '#f4c430', sun: 'Full sun', water: 'Low', soils: ['Loamy', 'Sandy', 'Clay'], seasons: ['Spring', 'Summer'], spacing_cm: 45 }
]

const byName = new Map(CATALOG.map((c) => [c.name.toLowerCase(), c]))
export const findCatalog = (name: string) => byName.get(name.trim().toLowerCase())

const SHAPE_BY_CATEGORY: Record<Category, Shape> = {
  Vegetable: 'fruiting', 'Leafy green': 'leafy', Root: 'root', Herb: 'herb', Fruit: 'berry', Legume: 'vine', Grain: 'tall', Flower: 'flower'
}
/** 3D shape + accent colour for any plant, catalogued or not. */
export function lookShape(name: string, category: Category): { shape: Shape; color: string } {
  const c = findCatalog(name)
  return c ? { shape: c.shape, color: c.color } : { shape: SHAPE_BY_CATEGORY[category], color: '#7bc96f' }
}

// ======================================================================
// three/Plant3D.tsx
// ======================================================================
/* Shared geometries: one copy each, reused by every plant in the scene. */
const PlantG = {
  sphere: new THREE.SphereGeometry(1, 10, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 7),
  cone: new THREE.ConeGeometry(1, 1, 7),
  ico: new THREE.IcosahedronGeometry(1, 1)
}
const matCache = new Map<string, THREE.MeshStandardMaterial>()
export function mat(color: string, rough = 0.7, emissive?: string) {
  const k = color + rough + (emissive ?? '')
  let m = matCache.get(k)
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: rough, emissive: emissive ?? '#000000', emissiveIntensity: emissive ? 0.4 : 0 }); matCache.set(k, m) }
  return m
}
const PLANT_LEAF = '#4caf50', LEAF2 = '#3f8f45', STEM = '#4e8f3a'

type P = { shape: Shape; color: string; progress: number; seed?: number; position?: [number, number, number] }

/** A procedural plant whose size follows its growth progress and that sways in the wind. */
export function Plant3D({ shape, color, progress, seed = 0, position = [0, 0, 0] }: P) {
  const g = useRef<THREE.Group>(null)
  const grown = useRef(0)
  const target = 0.18 + 0.82 * progress
  useFrame((s, dt) => {
    if (!g.current) return
    grown.current += (target - grown.current) * Math.min(dt * 1.5, 1)          // grows in smoothly on mount / status change
    const sc = grown.current * (1 + Math.sin(s.clock.elapsedTime * 0.8 + seed) * 0.015)
    g.current.scale.setScalar(sc)
    g.current.rotation.z = Math.sin(s.clock.elapsedTime * 1.4 + seed * 1.7) * 0.05
    g.current.rotation.x = Math.cos(s.clock.elapsedTime * 1.1 + seed) * 0.04
  })
  const parts = useMemo(() => build(shape, color, progress, seed), [shape, color, progress, seed])
  return <group ref={g} position={position} rotation-y={seed * 2.3}>{parts}</group>
}

function ring(n: number, f: (i: number, a: number) => React.ReactNode) { return Array.from({ length: n }, (_, i) => f(i, (i / n) * Math.PI * 2)) }
const M = (geo: keyof typeof PlantG, m: THREE.Material, p: [number, number, number], s: [number, number, number], r: [number, number, number] = [0, 0, 0], key?: string | number) =>
  <mesh key={key} geometry={PlantG[geo]} material={m} position={p} scale={s} rotation={r} castShadow />

function build(shape: Shape, color: string, progress: number, seed: number) {
  const fruit = progress >= 0.8, flower = progress >= 0.7
  switch (shape) {
    case 'fruiting': return [
      M('cyl', mat(STEM), [0, 0.3, 0], [0.018, 0.6, 0.018], undefined, 's'),
      ...ring(7, (i, a) => M('sphere', mat(i % 2 ? PLANT_LEAF : LEAF2), [Math.cos(a) * 0.08, 0.12 + i * 0.065, Math.sin(a) * 0.08], [0.11, 0.02, 0.05], [0, -a, 0.45], 'l' + i)),
      ...(fruit ? ring(4, (i, a) => M('sphere', mat(color, 0.4), [Math.cos(a + 0.6) * 0.08, 0.2 + (i % 2) * 0.12, Math.sin(a + 0.6) * 0.08], [0.045, 0.045, 0.045], undefined, 'f' + i)) : []),
      ...(!fruit && flower ? ring(3, (i, a) => M('sphere', mat('#f4c430', 0.5), [Math.cos(a) * 0.07, 0.4 + i * 0.05, Math.sin(a) * 0.07], [0.025, 0.025, 0.025], undefined, 'b' + i)) : [])
    ]
    case 'leafy': return [
      ...ring(7, (i, a) => M('sphere', mat(i % 2 ? color : shade(color, -0.12)), [Math.cos(a) * 0.08, 0.06, Math.sin(a) * 0.08], [0.12, 0.04, 0.09], [0, -a, 0.5], 'o' + i)),
      ...ring(5, (i, a) => M('sphere', mat(shade(color, 0.12)), [Math.cos(a + 0.5) * 0.04, 0.1, Math.sin(a + 0.5) * 0.04], [0.08, 0.04, 0.06], [0, -a, 0.9], 'i' + i)),
      M('sphere', mat(shade(color, 0.2)), [0, 0.11, 0], [0.05, 0.05, 0.05], undefined, 'c')
    ]
    case 'root': return [
      M('cone', mat(color, 0.6), [0, 0.0, 0], [0.04, 0.1, 0.04], [Math.PI, 0, 0], 'r'),
      ...ring(5, (i, a) => M('cone', mat(i % 2 ? PLANT_LEAF : '#5fbf55'), [Math.cos(a) * 0.025, 0.15, Math.sin(a) * 0.025], [0.016, 0.28, 0.016], [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35], 'l' + i))
    ]
    case 'tall': return [
      M('cyl', mat('#76a84f'), [0, 0.55, 0], [0.022, 1.1, 0.022], undefined, 's'),
      ...ring(6, (i, a) => M('sphere', mat(i % 2 ? '#5f9e45' : '#6fae4f'), [Math.cos(a) * 0.13, 0.22 + i * 0.14, Math.sin(a) * 0.13], [0.26, 0.012, 0.04], [0, -a, -0.25], 'l' + i)),
      ...(fruit ? [M('cyl', mat(color, 0.5), [0.05, 0.7, 0], [0.032, 0.18, 0.032], [0, 0, -0.3], 'cob')] : []),
      M('cone', mat('#d9c27a'), [0, 1.17, 0], [0.026, 0.15, 0.026], undefined, 't')
    ]
    case 'berry': return [
      ...ring(6, (i, a) => M('sphere', mat(i % 2 ? '#3e8e41' : PLANT_LEAF), [Math.cos(a) * 0.07, 0.07 + (i % 2) * 0.03, Math.sin(a) * 0.07], [0.08, 0.02, 0.065], [0, -a, 0.35], 'l' + i)),
      ...(fruit ? ring(4, (i, a) => M('cone', mat(color, 0.45), [Math.cos(a + 0.4) * 0.11, 0.04, Math.sin(a + 0.4) * 0.11], [0.028, 0.055, 0.028], [Math.PI, 0, 0], 'b' + i))
        : flower ? ring(3, (i, a) => M('sphere', mat('#ffffff', 0.6), [Math.cos(a) * 0.09, 0.1, Math.sin(a) * 0.09], [0.022, 0.012, 0.022], undefined, 'w' + i)) : [])
    ]
    case 'herb': return [
      ...ring(4, (i, a) => M('cyl', mat('#5a9a3c'), [Math.cos(a) * 0.025, 0.13, Math.sin(a) * 0.025], [0.008, 0.26, 0.008], [Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15], 's' + i)),
      ...Array.from({ length: 16 }, (_, i) => { const a = i * 2.4 + seed, r = 0.035 + (i % 4) * 0.022
        return M('sphere', mat(i % 3 ? color : shade(color, 0.15)), [Math.cos(a) * r, 0.07 + i * 0.014, Math.sin(a) * r], [0.05, 0.016, 0.034], [0, -a, 0.4], 'l' + i) })
    ]
    case 'flower': return [
      M('cyl', mat(STEM), [0, 0.3, 0], [0.016, 0.6, 0.016], undefined, 's'),
      ...ring(4, (i, a) => M('sphere', mat(LEAF2), [Math.cos(a) * 0.07, 0.15 + i * 0.08, Math.sin(a) * 0.07], [0.09, 0.015, 0.06], [0, -a, 0.3], 'l' + i)),
      ...(flower ? [
        M('cyl', mat('#5a3a1a'), [0, 0.62, 0.02], [0.045, 0.02, 0.045], [1.2, 0, 0], 'h'),
        ...ring(10, (i, a) => M('sphere', mat(color, 0.5), [Math.cos(a) * 0.07, 0.62 + Math.sin(a) * 0.07 * 0.36, 0.02 + Math.sin(a) * 0.07 * 0.93], [0.035, 0.008, 0.016], [1.2, 0, a], 'p' + i))
      ] : [])
    ]
    case 'vine': return [
      M('cyl', mat('#a07a4f'), [0, 0.35, 0], [0.008, 0.7, 0.008], undefined, 'pole'),
      ...Array.from({ length: 9 }, (_, i) => { const a = i * 1.3 + seed
        return M('sphere', mat(i % 2 ? PLANT_LEAF : '#6aa84f'), [Math.cos(a) * 0.05, 0.08 + i * 0.07, Math.sin(a) * 0.05], [0.06, 0.015, 0.05], [0, -a, 0.5], 'l' + i) }),
      ...(fruit ? ring(3, (i, a) => M('cyl', mat(color, 0.5), [Math.cos(a) * 0.06, 0.3 + i * 0.1, Math.sin(a) * 0.06], [0.014, 0.1, 0.014], [0.2, 0, 0.2], 'p' + i)) : [])
    ]
  }
}

function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)))
  return '#' + c.getHexString()
}

// ======================================================================
// three/Showpieces.tsx
// ======================================================================
/* =====================================================================
   Showpiece 3D models for page banners: black + gold "luxe" studio
   pieces with a garden at their heart. All geometry is procedural.
   ===================================================================== */

const GOLD = new THREE.MeshStandardMaterial({ color: '#e0ab55', metalness: 1, roughness: 0.18 })
const COPPER = new THREE.MeshStandardMaterial({ color: '#c8783a', metalness: 1, roughness: 0.25 })
const BLACK = new THREE.MeshPhysicalMaterial({ color: '#0d0d0d', metalness: 0.35, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08 })
const SHOW_CHROME = new THREE.MeshStandardMaterial({ color: '#e4e4e4', metalness: 1, roughness: 0.1 })
const PEARL = new THREE.MeshPhysicalMaterial({ color: '#f3efe8', roughness: 0.3, clearcoat: 1 })
const SHOW_SOIL = new THREE.MeshStandardMaterial({ color: '#3a2414', roughness: 1 })

type ShowG = ThreeElements['group']

/** Reflection studio built from light panels (no downloads needed). */
function Studio({ cool = false }: { cool?: boolean }) {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={4} position={[0, 5, -6]} scale={[10, 3, 1]} color={cool ? '#dbeafe' : '#ffe0b0'} />
      <Lightformer form="rect" intensity={2.4} position={[-6, 1, 2]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} color={cool ? '#f472b6' : '#ff7a3d'} />
      <Lightformer form="rect" intensity={2.4} position={[6, 0, 2]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} color={cool ? '#22d3ee' : '#fde68a'} />
      <Lightformer form="ring" intensity={3} position={[0, 2, 6]} scale={3} color="#ffffff" />
    </Environment>
  )
}

/** Gold tubes along every edge of a geometry: a real metal cage, not hairlines. */
function WireCage({ geo, r = 0.014, material = GOLD, minY = -Infinity, ...rest }: { geo: THREE.BufferGeometry; r?: number; material?: THREE.Material; minY?: number } & ShowG) {
  const segs = useMemo(() => {
    const p = new THREE.EdgesGeometry(geo, 1).attributes.position.array as Float32Array
    const up = new THREE.Vector3(0, 1, 0), out: { m: THREE.Vector3; l: number; q: THREE.Quaternion }[] = []
    for (let i = 0; i < p.length; i += 6) {
      const a = new THREE.Vector3(p[i], p[i + 1], p[i + 2]), b = new THREE.Vector3(p[i + 3], p[i + 4], p[i + 5])
      if (a.y < minY || b.y < minY) continue
      out.push({ m: a.clone().add(b).multiplyScalar(0.5), l: a.distanceTo(b), q: new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize()) })
    }
    return out
  }, [geo, minY])
  return <group {...rest}>{segs.map((s, i) => <mesh key={i} material={material} position={s.m} quaternion={s.q}><cylinderGeometry args={[r, r, s.l, 6]} /></mesh>)}</group>
}

/** Glossy black sphere wrapped in thin gold bands. */
function RingSphere({ r = 0.5, rings = 7, ...rest }: { r?: number; rings?: number } & ShowG) {
  return (
    <group {...rest}>
      <mesh material={BLACK}><sphereGeometry args={[r, 48, 32]} /></mesh>
      {Array.from({ length: rings }, (_, i) => { const y = -r + (2 * r * (i + 1)) / (rings + 1); return <mesh key={i} material={GOLD} position-y={y} rotation-x={Math.PI / 2}><torusGeometry args={[Math.sqrt(r * r - y * y) * 1.004, r * 0.014, 6, 72]} /></mesh> })}
    </group>
  )
}

/** Pearl sphere with a gold "kintsugi" vein. */
function VeinSphere({ r = 0.45, ...rest }: { r?: number } & ShowG) {
  return (
    <group {...rest}>
      <mesh material={PEARL}><sphereGeometry args={[r, 48, 32]} /></mesh>
      <mesh material={GOLD} rotation={[0.6, 0.2, 0.9]}><torusGeometry args={[r * 1.002, r * 0.018, 6, 80]} /></mesh>
      <mesh material={GOLD} rotation={[-0.4, 1.1, 0.2]}><torusGeometry args={[r * 1.002, r * 0.012, 6, 80, Math.PI * 0.9]} /></mesh>
    </group>
  )
}

function Spin({ speed = 0.3, axis = 'y', children, ...rest }: { speed?: number; axis?: 'x' | 'y' | 'z' } & ShowG) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (g.current) g.current.rotation[axis] += dt * speed })
  return <group ref={g} {...rest}>{children}</group>
}

/** Pauses rendering when the canvas is scrolled out of view. */
function useVisible<T extends HTMLElement>() {
  const ref = useRef<T>(null); const [v, setV] = useState(true)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const io = new IntersectionObserver(([e]) => setV(e.isIntersecting)); io.observe(el); return () => io.disconnect()
  }, [])
  return [ref, v] as const
}

/* ============================ 1. GARDEN CORE ============================
   Dashboard hero: a gold geodesic greenhouse over a living tomato plant,
   with an orbit of luxe spheres. Gold orbs are clickable live stats. */
export interface CoreStat { label: string; value: string; to: string }

function Hotspot({ position, stat, onPick, r = 0.24 }: { position: [number, number, number]; stat: CoreStat; onPick?: (to: string) => void; r?: number }) {
  const [h, setH] = useState(false)
  const m = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => { if (m.current) { const t = h ? 1.25 : 1; m.current.scale.lerp(new THREE.Vector3(t, t, t), Math.min(1, dt * 8)) } })
  return (
    <group position={position}>
      <mesh ref={m} material={GOLD}
        onPointerOver={(e) => { e.stopPropagation(); setH(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setH(false); document.body.style.cursor = '' }}
        onClick={(e) => { e.stopPropagation(); onPick?.(stat.to) }}>
        <sphereGeometry args={[r, 48, 32]} />
      </mesh>
      <Html center distanceFactor={4.2} position={[0, r + 0.34, 0]} zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`core-tag ${h ? 'is-hot' : ''}`}><b>{stat.value}</b><span>{stat.label}</span></div>
      </Html>
    </group>
  )
}

function CoreRig({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null)
  // scrolling the page turns the model a little, so it reacts as you scroll
  useFrame((s) => { if (g.current) { g.current.rotation.y = window.scrollY * 0.0025; g.current.position.y = Math.sin(s.clock.elapsedTime * 0.8) * 0.06 } })
  return <group ref={g}>{children}</group>
}

function GardenCore({ stats = [], onPick }: { stats?: CoreStat[]; onPick?: (to: string) => void }) {
  const dome = useMemo(() => new THREE.IcosahedronGeometry(1.4, 1), [])
  const dodeca = useMemo(() => new THREE.DodecahedronGeometry(0.42, 0), [])
  const octa = useMemo(() => new THREE.OctahedronGeometry(0.36, 0), [])
  const orbit = useMemo(() => { const g = new THREE.BufferGeometry(); const n = 420, a = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2, rr = 2.45 + Math.sin(i * 12.9) * 0.08; a[i * 3] = Math.cos(t) * rr; a[i * 3 + 1] = Math.sin(t * 3) * 0.08 - 0.2; a[i * 3 + 2] = Math.sin(t) * rr }
    g.setAttribute('position', new THREE.BufferAttribute(a, 3)); return g }, [])
  const spots: [number, number, number][] = [[2.3, 0.55, 0.6], [-1.9, 0.9, 1.4], [-0.6, -0.15, -2.4], [1.2, 1.35, -1.9]]
  return (
    <>
      <Studio />
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 5, 4]} intensity={1.8} color="#ffe2b8" />
      <pointLight position={[-3, -1, 2]} intensity={25} color="#ff6a2a" distance={10} />
      <CoreRig>
        {/* pedestal + soil + living plant */}
        <mesh material={BLACK} position-y={-1.12}><cylinderGeometry args={[1.12, 1.22, 0.24, 72]} /></mesh>
        <mesh material={GOLD} position-y={-1.0} rotation-x={Math.PI / 2}><torusGeometry args={[1.13, 0.028, 12, 120]} /></mesh>
        <mesh material={SHOW_SOIL} position-y={-0.99}><cylinderGeometry args={[1.02, 1.02, 0.04, 64]} /></mesh>
        <group position-y={-0.98} scale={2.2}><Plant3D shape="fruiting" color="#e5432a" progress={1} seed={2} /></group>
        <group position={[0.55, -0.98, 0.35]} scale={1.3}><Plant3D shape="herb" color="#5cb85c" progress={1} seed={5} /></group>
        <group position={[-0.55, -0.98, 0.25]} scale={1.4}><Plant3D shape="leafy" color="#a6df7c" progress={1} seed={7} /></group>
        {/* geodesic greenhouse dome */}
        <Spin speed={0.08}><WireCage geo={dome} position-y={-1.0} minY={-0.02} r={0.018} /></Spin>
        {/* orbit of luxe pieces */}
        <Spin speed={0.12}>
          <points geometry={orbit}><pointsMaterial color="#f5c16c" size={0.03} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} /></points>
          <Float speed={2} floatIntensity={0.6}><RingSphere r={0.42} position={[-2.4, 0.2, -0.6]} /></Float>
          <Float speed={1.6} floatIntensity={0.8}><RingSphere r={0.3} rings={5} position={[1.6, -0.5, 1.8]} /></Float>
          <Float speed={1.8}><VeinSphere r={0.36} position={[0.4, 0.5, 2.5]} /></Float>
          <Float speed={1.3}><mesh material={BLACK} position={[2.2, -0.2, -1.4]}><sphereGeometry args={[0.32, 48, 32]} /></mesh></Float>
          <Spin speed={0.6} axis="x" position={[-1.6, -0.6, 1.9]}><mesh material={BLACK} geometry={octa} /><WireCage geo={octa} r={0.012} scale={1.001} /></Spin>
          <Spin speed={0.4} position={[1.9, 1.0, 1.2]}><WireCage geo={dodeca} r={0.012} /></Spin>
          {stats.slice(0, 4).map((s, i) => <Hotspot key={s.label} position={spots[i]} stat={s} onPick={onPick} />)}
        </Spin>
      </CoreRig>
      <DreiSparkles count={60} scale={[8, 4, 8]} size={2.6} speed={0.3} color="#f5c16c" />
      <OrbitControls target={[0, -0.35, 0]} enablePan={false} minDistance={4.2} maxDistance={10} autoRotate autoRotateSpeed={0.7} enableDamping minPolarAngle={0.35} maxPolarAngle={2.2} />
    </>
  )
}

/* ============================ 2. GLASS CUBE ============================
   Iridescent glass terrarium with a seedling inside, plus dew bubbles. */
const BUBBLE = new THREE.MeshPhysicalMaterial({ transmission: 1, roughness: 0, thickness: 0.15, ior: 1.33, iridescence: 1, iridescenceIOR: 1.3, clearcoat: 1, color: '#ffffff' })
function Bubbles({ n = 16 }) {
  const seeds = useMemo(() => Array.from({ length: n }, (_, i) => ({ x: (Math.sin(i * 7.1) * 0.5 + 0.5) * 6 - 3, z: Math.cos(i * 3.3) * 1.6, s: 0.05 + ((i * 37) % 10) / 70, sp: 0.15 + ((i * 13) % 7) / 25, o: i * 0.9 })), [n])
  const refs = useRef<(THREE.Mesh | null)[]>([])
  useFrame((st) => seeds.forEach((b, i) => { const m = refs.current[i]; if (m) { m.position.set(b.x + Math.sin(st.clock.elapsedTime * 0.6 + b.o) * 0.2, ((st.clock.elapsedTime * b.sp + b.o) % 5) - 2.5, b.z) } }))
  return <>{seeds.map((b, i) => <mesh key={i} ref={(el) => { refs.current[i] = el }} material={BUBBLE} scale={b.s}><sphereGeometry args={[1, 24, 16]} /></mesh>)}</>
}
function GlassCube() {
  return (
    <>
      <Studio cool />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 3]} intensity={2} />
      <pointLight position={[-2, 0, 2]} intensity={14} color="#ff5a1f" />
      <Float speed={1.4} rotationIntensity={0.5} floatIntensity={0.7}>
        <group rotation={[0.45, 0.7, 0.15]}>
          <RoundedBox args={[1.8, 1.8, 1.8]} radius={0.14} smoothness={4}>
            <meshPhysicalMaterial transmission={1} thickness={0.45} roughness={0.03} ior={1.45} iridescence={1} iridescenceIOR={1.35} iridescenceThicknessRange={[120, 900]} clearcoat={1} color="#ffffff" attenuationColor="#fff4fb" attenuationDistance={6} />
          </RoundedBox>
          <mesh material={SHOW_SOIL} position-y={-0.66}><boxGeometry args={[1.2, 0.3, 1.2]} /></mesh>
          <group position-y={-0.51} scale={2.2}><Plant3D shape="herb" color="#5cb85c" progress={1} seed={3} /></group>
        </group>
      </Float>
      <Bubbles />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1.1} enableDamping />
    </>
  )
}

/* ============================ 3. WIRE ORBS ============================
   Copper wire globes linked by glowing light trails. */
function Trail({ pts, color = '#ffb76b', speed = 0.25 }: { pts: [number, number, number][]; color?: string; speed?: number }) {
  const { line, dots, curve } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)))
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(160)), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }))
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3))
    const dots = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.06, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
    return { line, dots, curve }
  }, [pts, color])
  useFrame((s) => { const a = dots.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < 60; i++) { const p = curve.getPointAt(((s.clock.elapsedTime * speed) + i / 60) % 1); a[i * 3] = p.x; a[i * 3 + 1] = p.y; a[i * 3 + 2] = p.z }
    dots.geometry.attributes.position.needsUpdate = true })
  return <><primitive object={line} /><primitive object={dots} /></>
}
function WireOrb({ r, position, speed = 0.2 }: { r: number; position: [number, number, number]; speed?: number }) {
  return (
    <Spin speed={speed} position={position}>
      <mesh><sphereGeometry args={[r, 18, 12]} /><meshBasicMaterial color="#f0b469" wireframe transparent opacity={0.6} blending={THREE.AdditiveBlending} /></mesh>
      <mesh><sphereGeometry args={[r * 0.18, 16, 12]} /><meshBasicMaterial color="#ffd59a" /></mesh>
    </Spin>
  )
}
function WireOrbs() {
  const g = useRef<THREE.Group>(null)
  useFrame((s) => { if (g.current) { g.current.rotation.y += (s.pointer.x * 0.4 - g.current.rotation.y) * 0.04; g.current.rotation.x += (-s.pointer.y * 0.2 - g.current.rotation.x) * 0.04 } })
  const shards = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ p: [Math.sin(i * 2.1) * 4, Math.cos(i * 1.7) * 2, Math.sin(i * 0.9) * 2 - 1] as [number, number, number], s: 0.12 + (i % 4) * 0.06 })), [])
  return (
    <>
      <Studio />
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 3]} intensity={30} color="#ffb36b" />
      <group ref={g}>
        <WireOrb r={1.3} position={[0.4, 0.1, 0]} />
        <WireOrb r={0.7} position={[-2.6, 0.9, -0.8]} speed={-0.3} />
        <WireOrb r={0.55} position={[2.7, -0.9, -0.4]} speed={0.35} />
        <WireOrb r={0.4} position={[-1.6, -1.3, 0.8]} speed={0.4} />
        <Trail pts={[[-4.5, -1.8, 1], [-2.6, 0.9, -0.8], [0.4, 0.1, 0], [2.7, -0.9, -0.4], [4.6, 0.6, 0.5]]} />
        <Trail pts={[[-4.5, 1.8, -1], [-1.6, -1.3, 0.8], [0.4, 0.1, 0], [3, 1.6, -1]]} color="#ff8a3d" speed={0.18} />
        {shards.map((s, i) => <Float key={i} speed={2} rotationIntensity={2}><mesh material={COPPER} position={s.p} scale={s.s}><tetrahedronGeometry args={[1, 0]} /></mesh></Float>)}
      </group>
      <DreiSparkles count={90} scale={[10, 5, 4]} size={2} speed={0.4} color="#ffcf8a" />
    </>
  )
}

/* ============================ 4. GOLD GLOBE ============================
   Chrome lattice globe with a chrome four-leaf clover at its centre. */
function GoldGlobe() {
  const R = 1.35
  const star = useMemo(() => { const s = new THREE.Shape(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.07 : 0.32; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) s.lineTo(x, y); else s.moveTo(x, y) } s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }) }, [])
  return (
    <>
      <Studio />
      <ambientLight intensity={0.3} />
      <directionalLight position={[2, 4, 3]} intensity={1.6} />
      <Float speed={1.2} floatIntensity={0.5}>
        <Spin speed={0.18}>
          {Array.from({ length: 8 }, (_, i) => <mesh key={'m' + i} material={SHOW_CHROME} rotation-y={(i / 8) * Math.PI}><torusGeometry args={[R, 0.028, 12, 120]} /></mesh>)}
          {[-55, -28, 0, 28, 55].map((lat) => { const t = (lat * Math.PI) / 180; return <mesh key={lat} material={lat === 0 ? GOLD : SHOW_CHROME} position-y={Math.sin(t) * R} rotation-x={Math.PI / 2}><torusGeometry args={[Math.cos(t) * R, lat === 0 ? 0.04 : 0.024, 12, 120]} /></mesh> })}
        </Spin>
        <mesh material={GOLD} rotation={[1.2, 0.3, 0.25]}><torusGeometry args={[R * 1.32, 0.012, 8, 160]} /></mesh>
        <Spin speed={0.7} axis="z">
          {[0, 1, 2, 3].map((i) => <mesh key={i} material={SHOW_CHROME} position={[Math.cos((i * Math.PI) / 2) * 0.28, Math.sin((i * Math.PI) / 2) * 0.28, 0]} scale={[0.32, 0.32, 0.14]}><sphereGeometry args={[1, 40, 24]} /></mesh>)}
          <mesh material={GOLD} scale={0.16}><sphereGeometry args={[1, 32, 24]} /></mesh>
        </Spin>
      </Float>
      <Float speed={3} rotationIntensity={0.3}><mesh geometry={star} material={GOLD} position={[-2.1, 1.2, 0.3]} /></Float>
      <Float speed={2.4}><mesh geometry={star} material={GOLD} position={[2.0, -1.1, 0.2]} scale={0.6} /></Float>
      <DreiSparkles count={40} scale={[6, 4, 4]} size={2} speed={0.25} color="#f5d08a" />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.9} enableDamping />
    </>
  )
}

/* ============================ 5. POLY CLUSTER ============================
   Cluster of black solids with gold edges, gold and banded spheres. */
function PolyCluster() {
  const tetra = useMemo(() => new THREE.TetrahedronGeometry(0.62, 0), [])
  const octa = useMemo(() => new THREE.OctahedronGeometry(0.62, 0), [])
  const ico = useMemo(() => new THREE.IcosahedronGeometry(0.66, 0), [])
  const dodeca = useMemo(() => new THREE.DodecahedronGeometry(0.58, 0), [])
  return (
    <>
      <Studio />
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 4, 3]} intensity={1.8} color="#ffe2b8" />
      <pointLight position={[-3, 1, 2]} intensity={18} color="#ff5a1f" />
      <Spin speed={0.1}>
        <mesh material={BLACK} position={[0.2, 0.25, -0.9]}><sphereGeometry args={[0.95, 64, 40]} /></mesh>
        <Float speed={1.5}><group position={[-1.5, 0.45, 0.2]} rotation={[0.3, 0.5, 0.2]}><mesh material={BLACK} geometry={tetra} /><WireCage geo={tetra} r={0.013} /></group></Float>
        <Float speed={1.2}><WireCage geo={octa} r={0.014} position={[-0.45, -0.2, 0.7]} rotation={[0.2, 0.4, 0]} /></Float>
        <Float speed={1.4}><group position={[0.8, 0.2, 0.5]} rotation={[0.1, 0.3, 0.1]}><mesh material={BLACK} geometry={ico} /><WireCage geo={ico} r={0.013} /></group></Float>
        <Float speed={1.1}><WireCage geo={dodeca} r={0.013} position={[2.0, -0.45, 0.1]} /></Float>
        <RingSphere r={0.42} position={[-0.5, 1.2, -0.2]} />
        <RingSphere r={0.38} rings={6} position={[1.8, 0.85, -0.5]} />
        <RingSphere r={0.48} rings={8} position={[0.35, -1.05, 0.2]} />
        <Float speed={2}><mesh material={GOLD} position={[-2.0, 1.05, 0.3]}><sphereGeometry args={[0.32, 48, 32]} /></mesh></Float>
        <Float speed={2.2}><mesh material={GOLD} position={[2.25, 0.4, 0.6]}><sphereGeometry args={[0.24, 48, 32]} /></mesh></Float>
        <Float speed={1.8}><mesh material={GOLD} position={[1.35, -0.25, 1.0]}><sphereGeometry args={[0.3, 48, 32]} /></mesh></Float>
        <VeinSphere r={0.42} position={[-1.55, -0.85, 0.6]} />
        <mesh material={BLACK} position={[2.9, 0.05, -0.4]}><sphereGeometry args={[0.28, 40, 28]} /></mesh>
      </Spin>
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.6} enableDamping />
    </>
  )
}

/* ============================ 6. SILK ============================
   Flowing black satin for the theme hero. The cloth is a dense plane whose
   vertices are moved by layered waves every frame; mouse adds a slight tilt. */
function Silk() {
  const geo = useMemo(() => new THREE.PlaneGeometry(16, 10, 170, 110), [])
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo])
  const g = useRef<THREE.Group>(null)
  useFrame((s) => {
    const t = s.clock.elapsedTime * 0.32, p = geo.attributes.position.array as Float32Array
    for (let i = 0; i < p.length; i += 3) {
      const x = base[i], y = base[i + 1], u = x * 0.32 + y * 0.6
      p[i + 2] = Math.sin(u * 1.5 + t * 1.4) * 0.6 + Math.sin(x * 0.85 - t + y * 0.35) * 0.38 + Math.sin(y * 2.1 + t * 0.8 + x * 0.45) * 0.14 + Math.sin(u * 4.6 + t * 2.1) * 0.05
    }
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals()
    if (g.current) { g.current.rotation.y += (s.pointer.x * 0.12 - g.current.rotation.y) * 0.03; g.current.rotation.x += (-s.pointer.y * 0.08 - g.current.rotation.x) * 0.03 }
  })
  return (
    <>
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={5} position={[3, 4, 4]} rotation-x={-0.6} scale={[12, 1.2, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={2.5} position={[-6, -1, 3]} rotation-y={Math.PI / 3} scale={[8, 0.8, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.2} position={[0, -4, 2]} rotation-x={0.8} scale={[10, 0.6, 1]} color="#f6ff8a" />
      </Environment>
      <directionalLight position={[2, 3, 5]} intensity={0.6} />
      <group ref={g}>
        <mesh geometry={geo} rotation={[-0.55, 0.25, 0.75]} position={[-1.2, 0.2, 0]}>
          <meshPhysicalMaterial color="#101010" roughness={0.3} metalness={0.6} sheen={1} sheenRoughness={0.3} sheenColor="#ffffff" clearcoat={0.5} clearcoatRoughness={0.25} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </>
  )
}

/* ============================ wrapper ============================ */
export type ShowpieceKind = 'core' | 'glass' | 'wire' | 'globe' | 'poly' | 'silk'
const CAM: Record<ShowpieceKind, { position: [number, number, number]; fov: number }> = {
  core: { position: [0.4, 2.0, 8.4], fov: 38 }, glass: { position: [0, 0.4, 5], fov: 38 }, wire: { position: [0, 0, 7], fov: 45 },
  globe: { position: [0, 0.3, 5.4], fov: 40 }, poly: { position: [0, 0.4, 6.2], fov: 40 }, silk: { position: [0, 0, 7], fov: 42 }
}

export function Showpiece({ kind, stats, onPick, className = '' }: { kind: ShowpieceKind; stats?: CoreStat[]; onPick?: (to: string) => void; className?: string }) {
  const [ref, visible] = useVisible<HTMLDivElement>()
  return (
    <div ref={ref} className={className}>
      <Canvas frameloop={visible ? 'always' : 'never'} dpr={[1, 1.75]} camera={CAM[kind]} gl={{ antialias: true, alpha: true }}>
        {kind === 'core' && <GardenCore stats={stats} onPick={onPick} />}
        {kind === 'glass' && <GlassCube />}
        {kind === 'wire' && <WireOrbs />}
        {kind === 'globe' && <GoldGlobe />}
        {kind === 'poly' && <PolyCluster />}
        {kind === 'silk' && <Silk />}
      </Canvas>
    </div>
  )
}

// ======================================================================
// components/PageBanner.tsx
// ======================================================================
/* =====================================================================
   Styled page banners for the most visited pages. Each page gets its own
   look (luxe gold, iridescent glass, copper wire, light streaks…) and a
   3D showpiece. The dashboard gets the big 360° Garden Core model.
   ===================================================================== */

type BannerVariant = 'core' | 'luxe' | 'glass' | 'wire' | 'streaks' | 'grid' | 'connect' | 'plexus' | 'neon' | 'orbit'
interface Cfg { v: BannerVariant; kicker: string; outline: string; model?: ShowpieceKind; ring: string }
export const BANNERS: Record<string, Cfg> = {
  '/dashboard': { v: 'core', kicker: 'Live garden overview', outline: 'GARDEN', model: 'core', ring: 'DRAG TO ROTATE • 360° GARDEN CORE • CLICK A GOLD ORB • ' },
  '/beds': { v: 'luxe', kicker: 'Mapping every bed, one row at a time', outline: 'BEDS', model: 'globe', ring: 'MAP • MEASURE • ASSIGN • GROW TOGETHER • ' },
  '/plants': { v: 'glass', kicker: 'Plant library', outline: 'PLANTS', model: 'glass', ring: 'SOW • TRACK • GROW • HARVEST • ' },
  '/harvests': { v: 'wire', kicker: 'Log · Weigh · Share', outline: 'HARVEST', model: 'wire', ring: '' },
  '/calendar': { v: 'streaks', kicker: 'Plan · Sow · Track', outline: 'CALENDAR', ring: '' },
  '/analytics': { v: 'neon', kicker: 'Reports & trends', outline: 'ANALYTICS', ring: '' },
  '/recommend': { v: 'plexus', kicker: 'AI plant picks', outline: 'AI PICKS', ring: '' },
  '/account': { v: 'orbit', kicker: 'Accounts & private gardens', outline: 'JOIN', ring: '' },
  '/settings': { v: 'connect', kicker: 'Database · AI · this device', outline: 'CONNECT', ring: '' },
  '/health': { v: 'luxe', kicker: 'Leaf health check', outline: 'HEALTH', model: 'globe', ring: 'AN ESTIMATE • NOT A DIAGNOSIS • ' }
}

function useStats(path: string): CoreStat[] {
  const { beds, plants, harvests, tasks, ai } = useData()
  return useMemo(() => {
    const active = plants.filter((p) => ACTIVE_STATUSES.includes(p.status))
    const kg = harvests.reduce((a, h) => a + (toKg(h) ?? 0), 0)
    const used = new Set(active.map((p) => p.bed_id).filter(Boolean)).size
    const open = tasks.filter((t) => !t.done), today = todayISO()
    switch (path) {
      case '/beds': return [{ label: 'beds', value: String(beds.length), to: '/beds' }, { label: 'in use', value: String(used), to: '/beds' }, { label: 'free', value: String(beds.length - used), to: '/beds' }, { label: 'm² of soil', value: num(beds.reduce((a, b) => a + Number(b.length_m) * Number(b.width_m), 0), 0), to: '/beds' }]
      case '/plants': return [{ label: 'plant entries', value: String(plants.length), to: '/plants' }, { label: 'growing now', value: String(active.length), to: '/plants' }, { label: 'ready to pick', value: String(plants.filter((p) => p.status === 'ready').length), to: '/plants' }]
      case '/harvests': {
        const top = Object.entries(harvests.reduce<Record<string, number>>((m, h) => { const k = toKg(h); if (k) m[h.plant_name] = (m[h.plant_name] ?? 0) + k; return m }, {})).sort((a, b) => b[1] - a[1])[0]
        return [{ label: 'records', value: String(harvests.length), to: '/harvests' }, { label: 'kg harvested', value: num(kg, 1), to: '/harvests' }, { label: 'top crop', value: top?.[0] ?? '—', to: '/harvests' }]
      }
      case '/calendar': return [{ label: 'open tasks', value: String(open.length), to: '/calendar' }, { label: 'overdue', value: String(open.filter((t) => t.due_date < today).length), to: '/calendar' }, { label: 'due this week', value: String(open.filter((t) => t.due_date >= today && t.due_date <= addDays(today, 7)).length), to: '/calendar' }]
      case '/analytics': return [{ label: 'harvest logs', value: String(harvests.length), to: '/harvests' }, { label: 'kg total', value: num(kg, 1), to: '/harvests' }, { label: 'bed usage', value: `${beds.length ? Math.round((used / beds.length) * 100) : 0}%`, to: '/beds' }]
      case '/settings': return [{ label: 'records synced', value: String(beds.length + plants.length + harvests.length + tasks.length + ai.length), to: '/settings' }, { label: 'tables', value: '6', to: '/settings' }, { label: 'AI runs saved', value: String(ai.length), to: '/settings' }]
      case '/recommend': case '/health': case '/chat': return [{ label: 'AI runs saved', value: String(ai.length), to: path }, { label: 'free beds', value: String(beds.length - used), to: '/beds' }]
      default: return [
        { label: 'beds', value: String(beds.length), to: '/beds' }, { label: 'growing', value: String(active.length), to: '/plants' },
        { label: 'kg harvested', value: num(kg, 0), to: '/harvests' }, { label: 'open tasks', value: String(open.length), to: '/calendar' }
      ]
    }
  }, [path, beds, plants, harvests, tasks, ai])
}

function Model({ kind, stats, className }: { kind: ShowpieceKind; stats?: CoreStat[]; className: string }) {
  const nav = useNavigate()
  return <Suspense fallback={<div className={`${className} grid place-items-center`}><span className="size-10 animate-spin rounded-full border-2 border-white/15 border-t-amber-300" /></div>}>
    <Showpiece kind={kind} stats={stats} onPick={(to) => nav(to)} className={className} />
  </Suspense>
}

/** Circular rotating text badge. */
function Ring({ text, children, className = '' }: { text: string; children?: ReactNode; className?: string }) {
  return (
    <div className={`size-28 place-items-center ${className}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" className="spin-slow absolute inset-0 size-full"><defs><path id="ringp" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" /></defs>
        <text fontSize="8.2" letterSpacing="1.6" fill="currentColor"><textPath href="#ringp">{text}</textPath></text></svg>
      <span className="grid size-11 place-items-center rounded-full border border-current/30">{children ?? <Sparkle className="size-5" />}</span>
    </div>
  )
}

const Stats = ({ stats, tone }: { stats: CoreStat[]; tone: string }) => (
  <dl className="mt-7 flex flex-wrap gap-x-8 gap-y-4">
    {stats.map((s) => <div key={s.label}><dt className="sr-only">{s.label}</dt><dd className={`font-display text-3xl font-extrabold tracking-tight ${tone}`}>{s.value}</dd><dd className="text-xs uppercase tracking-wider text-white/50">{s.label}</dd></div>)}
  </dl>
)

export function PageBanner({ path, title, sub, actions }: { path: string; title: string; sub?: string; actions?: ReactNode }) {
  const cfg = BANNERS[path]
  const stats = useStats(path)
  const words = title.split(' '), last = words.pop() ?? '', head = words.join(' ')

  if (cfg.v === 'plexus') return <PlexusBanner title={title} sub={sub} kicker={cfg.kicker} actions={actions} stats={<div className="flex justify-center"><Stats stats={stats} tone="text-[#eef53c]" /></div>} />
  if (cfg.v === 'neon') return <NeonBanner title={title} sub={sub} kicker={cfg.kicker} actions={actions} stats={<Stats stats={stats} tone="text-white" />} />
  if (cfg.v === 'orbit') return <OrbitBanner title={title} sub={sub} kicker={cfg.kicker} actions={actions} />

  /* ---------- core: black grid, orange block, outline type, 360° model ---------- */
  if (cfg.v === 'core') return (
    <section className="banner relative mb-6 overflow-hidden rounded-[28px] border border-white/10 bg-black text-white">
      <div className="bg-grid absolute inset-0" />
      <div className="absolute left-[6%] top-0 h-[42%] w-[36%] bg-gradient-to-b from-[#ff5a1f] via-[#ff5a1f]/40 to-transparent" />
      <div className="relative grid min-h-[560px] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="relative z-10 flex flex-col justify-center px-6 pb-4 pt-10 sm:px-10 lg:pb-28">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/70">{cfg.kicker} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
          <h1 className="mt-4 text-[clamp(2.4rem,5vw,4.2rem)] font-extrabold leading-[1.02]">{title}</h1>
          {sub && <p className="mt-3 max-w-md text-white/70">{sub}</p>}
          {actions && <div className="mt-6 flex flex-wrap gap-2">{actions}</div>}
          <Stats stats={stats} tone="text-white" />
        </div>
        <div className="relative h-[420px] lg:h-auto">
          <Model kind="core" stats={stats} className="absolute inset-0" />
          <Ring text={cfg.ring} className="pointer-events-none absolute bottom-24 right-6 hidden text-amber-200 sm:grid"><MousePointer2 className="size-5" /></Ring>
          <p className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-xs text-white/80 backdrop-blur">● 360° · drag to rotate · scroll to zoom</p>
        </div>
      </div>
      <p className="outline-type pointer-events-none absolute inset-x-0 bottom-[-0.12em] select-none text-center font-display text-[clamp(4rem,15vw,13rem)] font-extrabold leading-none" aria-hidden="true">{cfg.outline}</p>
    </section>
  )

  /* ---------- luxe: black velvet, chrome & gold, rotating ring text ---------- */
  if (cfg.v === 'luxe') return (
    <section className="banner relative mb-6 overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(80%_100%_at_70%_30%,#2a2a2a,#0a0a0a_60%)] text-white">
      <svg className="pointer-events-none absolute inset-0 size-full opacity-40" preserveAspectRatio="none" viewBox="0 0 1000 400" aria-hidden="true"><path d="M0 300 H180 Q200 300 200 280 V90 Q200 70 220 70 H560" stroke="#d4a24c" strokeWidth="1" fill="none" /><path d="M620 380 V300 Q620 280 640 280 H1000" stroke="#ffffff" strokeOpacity=".3" strokeWidth="1" fill="none" /></svg>
      <div className="relative grid min-h-[380px] items-center lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative z-10 px-6 py-10 sm:px-10">
          <p className="flex items-center gap-2 text-sm text-white/60"><Sparkle className="size-4 text-amber-300" />{cfg.kicker}</p>
          {head && <h1 className="mt-4 text-[clamp(2.6rem,6vw,4.8rem)] font-light leading-none tracking-tight">{head}</h1>}
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 py-1.5 pl-4 pr-1.5 text-sm">Live <span className="size-8 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff3c4,#d4a24c_55%,#8a5a1c)]" /></span>
            <span className="text-[clamp(2.6rem,6vw,4.8rem)] font-light leading-none tracking-tight text-white/80">{last}</span>
          </div>
          {sub && <p className="mt-5 max-w-md text-sm text-white/60">{sub}</p>}
          {actions && <div className="mt-6 flex flex-wrap gap-2">{actions}</div>}
          <Stats stats={stats} tone="text-amber-200" />
        </div>
        <div className="relative h-[340px] lg:h-full">
          <Model kind={cfg.model ?? 'globe'} className="absolute inset-0" />
          <Ring text={cfg.ring} className="pointer-events-none absolute right-6 top-6 hidden text-white/70 sm:grid" />
          <span className="pointer-events-none absolute bottom-6 right-6 hidden items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/50 [writing-mode:vertical-rl] sm:flex">Scroll down <ArrowDown className="size-3.5" /></span>
        </div>
      </div>
    </section>
  )

  /* ---------- glass: dark studio, orange italic serif, iridescent cube ---------- */
  if (cfg.v === 'glass') return (
    <section className="banner relative mb-6 overflow-hidden rounded-[28px] border border-white/10 bg-[#0c0c0f] text-white">
      <div className="pointer-events-none absolute -left-20 top-10 size-80 rounded-full bg-[#ff5a1f]/20 blur-3xl" /><div className="pointer-events-none absolute right-10 top-0 size-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="relative grid min-h-[380px] items-center lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="relative z-10 px-6 py-10 sm:px-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70"><span className="size-1.5 rounded-full bg-[#ff7a3d]" />{cfg.kicker}</p>
          <h1 className="mt-5 text-[clamp(2.4rem,5vw,4rem)] font-extrabold leading-[1.02] tracking-tight">{head && <>{head} </>}<span className="font-serif font-medium italic text-[#ff7a3d]">{last}</span></h1>
          {sub && <p className="mt-4 max-w-md text-white/60">{sub}</p>}
          {actions && <div className="mt-6 flex flex-wrap gap-2">{actions}</div>}
          <Stats stats={stats.map((s) => ({ ...s, value: s.value }))} tone="text-white" />
        </div>
        <div className="relative h-[340px] lg:h-full"><Model kind="glass" className="absolute inset-0" /><Ring text={cfg.ring} className="pointer-events-none absolute bottom-6 right-6 hidden text-[#ffb08a] sm:grid" /></div>
      </div>
    </section>
  )

  /* ---------- wire: copper globes behind, big uppercase with // ---------- */
  if (cfg.v === 'wire') return (
    <section className="banner relative mb-6 min-h-[380px] overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0705] text-white">
      <Model kind="wire" className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0705] via-[#0b0705]/40 to-transparent" />
      <div className="relative z-10 flex min-h-[380px] flex-col justify-end px-6 py-8 sm:px-10">
        <h1 className="font-display text-[clamp(2.2rem,5.5vw,4.4rem)] font-extrabold uppercase leading-none tracking-tight text-[#fff4e6]">{title} <span className="text-[#f0b469]">//</span></h1>
        <p className="mt-1 font-display text-[clamp(1.1rem,2.4vw,1.8rem)] font-bold uppercase tracking-wide text-[#f0b469]">{cfg.kicker}</p>
        {sub && <p className="mt-3 max-w-lg text-white/60">{sub}</p>}
        <div className="flex flex-wrap items-end justify-between gap-6"><Stats stats={stats} tone="text-[#ffd59a]" />{actions && <div className="pointer-events-auto flex flex-wrap gap-2">{actions}</div>}</div>
      </div>
    </section>
  )

  /* ---------- streaks: navy, light tunnel, framed title ---------- */
  if (cfg.v === 'streaks') return (
    <section className="banner relative mb-6 overflow-hidden rounded-[28px] border border-white/10 bg-[#061325] text-white">
      <div className="streaks pointer-events-none absolute inset-y-0 left-0 w-full lg:w-[55%]" aria-hidden="true"><div className="streaks-up" /><div className="streaks-floor" /></div>
      <div className="relative grid min-h-[380px] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden lg:block" />
        <div className="relative z-10 m-4 flex flex-col justify-center rounded-r-[28px] border-r border-t border-white/40 bg-[#061325]/60 px-6 py-10 backdrop-blur-[2px] sm:m-6 sm:px-10 lg:bg-transparent">
          <span className="absolute -left-1.5 -top-1.5 size-3 rounded-full bg-white" />
          <p className="text-3xl font-light text-cyan-300/80 sm:text-4xl">{cfg.kicker}</p>
          <h1 className="mt-2 font-condensed text-[clamp(2.8rem,6vw,5rem)] font-normal uppercase leading-[0.95] tracking-wide">{title}</h1>
          {sub && <p className="mt-3 max-w-md text-lg font-light text-cyan-200/70">{sub}</p>}
          {actions && <div className="mt-6 flex flex-wrap gap-2">{actions}</div>}
          <Stats stats={stats} tone="text-cyan-200" />
          <span className="absolute -bottom-px right-10 h-px w-24 border-b border-dashed border-white/50" />
        </div>
      </div>
    </section>
  )

  /* ---------- connect: neon line ribbons (status of connections) ---------- */
  if (cfg.v === 'connect') return (
    <section className="banner relative mb-6 min-h-[400px] overflow-hidden rounded-[28px] border border-white/10 bg-black text-white">
      <RibbonLines className="absolute inset-0 size-full" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" />
      <div className="relative z-10 grid min-h-[400px] gap-6 px-6 py-8 sm:px-10 lg:grid-cols-2">
        <div>
          <h1 className="font-sans text-[clamp(3rem,7vw,5.6rem)] font-bold leading-none tracking-tight" style={{ fontWeight: 800 }}>{title}</h1>
          <p className="mt-3 text-sm text-white/80">{cfg.kicker}</p>
          {actions && <div className="mt-6 flex flex-wrap gap-2">{actions}</div>}
        </div>
        <div className="flex flex-col items-start justify-end gap-6 lg:items-end lg:text-right">
          {sub && <p className="max-w-sm text-lg text-white/85">{sub}</p>}
          <Stats stats={stats} tone="text-white" />
          <p className="flex items-center gap-2 text-xs text-white/60"><ArrowDown className="size-3.5" />Scroll to see each connection</p>
        </div>
      </div>
    </section>
  )

  /* ---------- grid: graphic-design poster with poly cluster ---------- */
  return (
    <section className="banner relative mb-6 overflow-hidden rounded-[28px] border border-white/10 bg-black text-white">
      <div className="bg-grid absolute inset-0" />
      <div className="absolute left-[4%] top-0 h-[38%] w-[30%] bg-gradient-to-b from-[#ff5a1f] to-transparent" />
      <div className="relative grid min-h-[400px] items-center lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="relative z-10 px-6 pb-20 pt-10 sm:px-10">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/70">{cfg.kicker}</p>
          <h1 className="mt-4 text-[clamp(2.4rem,5vw,4rem)] font-extrabold leading-[1.02]">{title}</h1>
          {sub && <p className="mt-3 max-w-md text-white/70">{sub}</p>}
          {actions && <div className="mt-6 flex flex-wrap gap-2">{actions}</div>}
          <Stats stats={stats} tone="text-white" />
        </div>
        <div className="relative h-[340px] lg:h-full"><Model kind={cfg.model ?? 'poly'} className="absolute inset-0" /><Ring text={cfg.ring} className="pointer-events-none absolute bottom-20 right-6 hidden text-amber-200 sm:grid" /></div>
      </div>
      <p className="outline-type pointer-events-none absolute inset-x-0 bottom-[-0.14em] select-none text-center font-display text-[clamp(3rem,11vw,10rem)] font-extrabold leading-none" aria-hidden="true">{cfg.outline}</p>
    </section>
  )
}

// ======================================================================
// components/ui/index.tsx
// ======================================================================
/* ---------------------------- Button ---------------------------- */
type Variant = 'primary' | 'ghost' | 'danger' | 'subtle'
/** `write` marks a button that changes garden data: it is disabled for view-only members. */
export function Button({ variant = 'primary', loading, write, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; write?: boolean }) {
  const canWrite = useCanWrite()
  const locked = write && !canWrite
  const v: Record<Variant, string> = {
    primary: 'bg-gradient-to-r from-emerald-400 via-lime-400 to-lime-300 text-emerald-950 shadow-[0_8px_28px_-10px_rgb(238_245_60/.55)] hover:shadow-[0_14px_36px_-8px_rgb(238_245_60/.8)] hover:-translate-y-0.5',
    ghost: 'border border-line2 bg-emerald-950/40 text-ink hover:bg-emerald-900/50 hover:border-emerald-400/50',
    danger: 'border border-red-400/30 bg-red-500/15 text-red-100 hover:bg-red-500/25',
    subtle: 'text-muted hover:text-ink hover:bg-white/5'
  }
  return (
    <button {...rest} disabled={rest.disabled || loading || locked} title={locked ? 'View-only access' : rest.title}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${v[variant]} ${className}`}>
      {loading && <Loader2 className="size-4 animate-spin" />}{children}
    </button>
  )
}

export function IconButton({ label, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  // Edit / Delete buttons are disabled for view-only members
  const canWrite = useCanWrite()
  const locked = !canWrite && /^(Edit|Delete)\b/.test(label)
  return (
    <button {...rest} disabled={rest.disabled || locked} aria-label={label} title={locked ? `${label} (view-only access)` : label}
      className={`inline-grid size-10 place-items-center rounded-xl text-muted transition hover:bg-white/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 ${className}`}>{children}</button>
  )
}

/* ---------------------------- Card ---------------------------- */
export function Card({ children, className = '', title, action, icon }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <section className={`glass fade-up p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center gap-3">
          {icon && <span className="grid size-9 place-items-center rounded-xl border border-line2 bg-emerald-400/10 text-emerald-200">{icon}</span>}
          {title && <h2 className="flex-1 text-base font-bold">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function StatCard({ label, value, sub, icon, tone = 'emerald' }: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; tone?: 'emerald' | 'lime' | 'cyan' | 'amber' }) {
  const t = { emerald: 'from-emerald-400/25 text-emerald-200', lime: 'from-lime-400/25 text-lime-200', cyan: 'from-cyan-400/25 text-cyan-200', amber: 'from-amber-400/25 text-amber-200' }[tone]
  return (
    <div className="glass fade-up group relative overflow-hidden p-5 transition hover:-translate-y-1 hover:border-line2">
      <div className={`absolute -right-8 -top-8 size-28 rounded-full bg-gradient-to-br ${t} to-transparent opacity-60 blur-2xl transition group-hover:opacity-100`} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="mt-2 font-mono text-4xl font-medium tracking-tight">{value}</p>
          {sub && <p className="mt-1 text-xs text-dim">{sub}</p>}
        </div>
        <span className={`grid size-11 place-items-center rounded-2xl border border-line2 bg-gradient-to-br ${t} to-emerald-950/40`}>{icon}</span>
      </div>
    </div>
  )
}

/* ---------------------------- Page header ---------------------------- */
export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  // frequently visited pages get a styled 3D banner; the rest keep the simple header
  const { pathname } = useLocation()
  if (BANNERS[pathname]) return <PageBanner path={pathname} title={title} sub={sub} actions={actions} />
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="fade-up">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/* ---------------------------- Badge ---------------------------- */
const TONES = {
  emerald: 'bg-emerald-400/12 text-emerald-300 border-emerald-400/25', lime: 'bg-lime-400/12 text-lime-300 border-lime-400/25',
  amber: 'bg-amber-400/12 text-amber-300 border-amber-400/30', cyan: 'bg-cyan-400/12 text-cyan-300 border-cyan-400/25',
  red: 'bg-red-400/12 text-red-300 border-red-400/30', gray: 'bg-white/5 text-muted border-line', violet: 'bg-violet-400/12 text-violet-300 border-violet-400/25'
}
export type Tone = keyof typeof TONES
export function Badge({ tone = 'emerald', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>
}

/* ---------------------------- Modal ---------------------------- */
export function Modal({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    setTimeout(() => ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus(), 30)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus() }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`glass-strong fade-up max-h-[90vh] w-full overflow-y-auto scrollbar-thin p-6 ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <IconButton label="Close" onClick={onClose}><X className="size-5" /></IconButton>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title, body, confirmLabel = 'Delete', onConfirm, onClose, busy }: { open: boolean; title: string; body: ReactNode; confirmLabel?: string; onConfirm: () => void; onClose: () => void; busy?: boolean }) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="text-muted">{body}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} loading={busy}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}

/* ---------------------------- Form field ---------------------------- */
export function Field({ label, error, children, hint, className = '' }: { label: string; error?: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {error ? <em className="err not-italic">{error}</em> : hint ? <em className="text-xs not-italic text-dim">{hint}</em> : null}
    </label>
  )
}

/* ---------------------------- States ---------------------------- */
export function EmptyState({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-line2 px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300">{icon ?? <Sprout className="size-7" />}</span>
      <h3 className="text-lg font-bold">{title}</h3>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {action}
    </div>
  )
}
export function Skeleton({ className = '' }: { className?: string }) { return <div className={`skeleton ${className}`} /> }
export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return <div className="grid gap-2">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
}
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-100">
      <span className="flex-1">{message}</span>
      {onRetry && <Button variant="danger" onClick={onRetry}>Try again</Button>}
    </div>
  )
}
export function DemoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
      <span className="mt-0.5 rounded-md bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold uppercase text-amber-950">Demo</span>
      <span>{children}</span>
    </div>
  )
}

/* ---------------------------- Progress ---------------------------- */
export function Progress({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-white/8 ${className}`} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300 transition-all duration-700" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  )
}

// ======================================================================
// components/ui/garden.tsx
// ======================================================================
const STATUS_TONE: Record<PlantStatus, Tone> = {
  planned: 'gray', sown: 'cyan', germinating: 'cyan', growing: 'emerald', flowering: 'violet', ready: 'lime', harvested: 'amber'
}
export const StatusBadge = ({ status }: { status: PlantStatus }) => <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>

export const TASK_TONE: Record<TaskType, Tone> = { sow: 'cyan', water: 'cyan', fertilize: 'lime', prune: 'violet', weed: 'amber', harvest: 'emerald', other: 'gray' }
export const TASK_LABEL: Record<TaskType, string> = { sow: 'Sow', water: 'Water', fertilize: 'Fertilise', prune: 'Prune', weed: 'Weed / thin', harvest: 'Harvest', other: 'Other' }

/** A bed is occupied when at least one plant that isn't harvested is assigned to it. */
export function occupancy(beds: Bed[], plants: Plant[]) {
  const m = new Map<string, Plant[]>()
  beds.forEach((b) => m.set(b.id, []))
  plants.forEach((p) => { if (p.bed_id && p.status !== 'harvested') m.get(p.bed_id)?.push(p) })
  return m
}
export const area = (b: Pick<Bed, 'length_m' | 'width_m'>) => Number(b.length_m) * Number(b.width_m)

/** Shared Recharts styling so every chart matches the theme. */
export const CHART = {
  grid: 'rgba(255,255,255,.07)', axis: '#6f6f69', tick: { fill: '#a9a9a2', fontSize: 12 },
  tooltip: { contentStyle: { background: 'rgba(10,10,10,.95)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 12, color: '#f4f4ef' }, labelStyle: { color: '#f4f4ef', fontWeight: 600 }, itemStyle: { color: '#a9a9a2' } },
  palette: ['#eef53c', '#f4f4ef', '#9a9a94', '#ff7a3d', '#f472b6', '#a78bfa', '#67e8f9', '#c8cd06', '#5a5a55', '#fde68a']
}

// ======================================================================
// context/ToastContext.tsx
// ======================================================================
type Kind = 'success' | 'error' | 'info'
interface Toast { id: number; kind: Kind; text: string }
const ToastCtx = createContext<(text: string, kind?: Kind) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((text: string, kind: Kind = 'success') => {
    const id = Date.now() + Math.random()
    setItems((p) => [...p.slice(-3), { id, kind, text }])
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500)
  }, [])
  const Icon = { success: CheckCircle2, error: AlertTriangle, info: Info }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
        {items.map((t) => {
          const I = Icon[t.kind]
          return (
            <div key={t.id} className={`toast-in flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl ${t.kind === 'error' ? 'border-red-400/30 bg-red-950/80 text-red-100' : 'border-white/15 bg-[#111]/90 text-white'}`}>
              <I className={`mt-0.5 size-4 shrink-0 ${t.kind === 'error' ? 'text-red-300' : t.kind === 'info' ? 'text-cyan-300' : 'text-lime-300'}`} />
              <span className="flex-1">{t.text}</span>
              <button onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))} className="-m-1 rounded p-1 text-white/50 hover:text-white" aria-label="Dismiss"><X className="size-4" /></button>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

// ======================================================================
// lib/validate.ts
// ======================================================================
/* =====================================================================
   Form validation. Pure functions (no React), so they are unit-tested
   directly. The database enforces the same limits with CHECK constraints;
   these give friendly messages before a request is ever sent.
   ===================================================================== */

export type Errors = Record<string, string>

const EARLIEST = '2000-01-01'
/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30 and similar). */
export const isDate = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
/** Number of digits after the decimal point in a numeric string or number. */
export const decimals = (v: unknown) => { const s = String(v ?? '').trim(); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1 }
const numOrNaN = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? NaN : Number(v))

export interface BedContext { existingNames?: string[] }
export function validateBed(v: Record<string, unknown>, ctx: BedContext = {}): Errors {
  const e: Errors = {}
  const name = text(v.name)
  if (!name) e.name = 'Give the bed a name.'
  else if (name.length > 60) e.name = 'Keep the name under 60 characters.'
  else if ((ctx.existingNames ?? []).some((n) => n.trim().toLowerCase() === name.toLowerCase())) e.name = 'Another bed already has this name.'
  for (const k of ['length_m', 'width_m'] as const) {
    const n = numOrNaN(v[k])
    if (!Number.isFinite(n) || n <= 0) e[k] = 'Enter a size above 0.'
    else if (n < 0.1) e[k] = 'The smallest size is 0.1 m.'
    else if (n > 100) e[k] = 'Maximum is 100 m.'
    else if (decimals(v[k]) > 2) e[k] = 'Use at most 2 decimal places.'
  }
  if (!SOIL_TYPES.includes(v.soil_type as never)) e.soil_type = 'Choose a soil type.'
  if (text(v.zone).length > 40) e.zone = 'Keep the zone under 40 characters.'
  if (text(v.notes).length > 500) e.notes = 'Notes are limited to 500 characters.'
  return e
}

export function validatePlant(v: Record<string, unknown>, today = todayISO()): Errors {
  const e: Errors = {}
  const name = text(v.name)
  if (!name) e.name = 'Enter the plant name.'
  else if (name.length > 60) e.name = 'Keep the name under 60 characters.'
  if (!CATEGORIES.includes(v.category as never)) e.category = 'Choose a category.'
  if (!STATUSES.includes(v.status as never)) e.status = 'Choose a growth status.'
  const q = numOrNaN(v.quantity)
  if (!Number.isInteger(q) || q < 1 || q > 10000) e.quantity = 'Use a whole number from 1 to 10,000.'

  const sow = v.sowing_date, harvest = v.expected_harvest_date
  if (sow && !isDate(sow)) e.sowing_date = 'Enter a valid date.'
  else if (isDate(sow) && sow < EARLIEST) e.sowing_date = 'That date is too far in the past.'
  else if (isDate(sow) && sow > addDays(today, 366)) e.sowing_date = 'Plan sowing at most a year ahead.'
  if (harvest && !isDate(harvest)) e.expected_harvest_date = 'Enter a valid date.'
  else if (isDate(harvest) && harvest > addDays(today, 3 * 366)) e.expected_harvest_date = 'That harvest date is more than 3 years away.'
  if (isDate(sow) && isDate(harvest) && harvest < sow) e.expected_harvest_date = 'Harvest can’t be before sowing.'

  if (v.status !== 'planned' && STATUSES.includes(v.status as never)) {
    if (!sow) e.sowing_date = 'Add the sowing date for a plant that is already in the ground.'
    else if (isDate(sow) && sow > today && !e.sowing_date) e.sowing_date = 'A plant that is already sown can’t have a sowing date in the future.'
  }
  if (text(v.notes).length > 500) e.notes = 'Notes are limited to 500 characters.'
  return e
}

export interface HarvestContext { sowingDate?: string | null }
export function validateHarvest(v: Record<string, unknown>, ctx: HarvestContext = {}, today = todayISO()): Errors {
  const e: Errors = {}
  const pn = text(v.plant_name)
  if (!pn) e.plant_name = 'Choose or type the plant harvested.'
  else if (pn.length > 60) e.plant_name = 'Keep the name under 60 characters.'
  if (!isDate(v.harvested_on)) e.harvested_on = 'Enter the harvest date.'
  else if (v.harvested_on > today) e.harvested_on = 'Harvest date can’t be in the future.'
  else if (v.harvested_on < EARLIEST) e.harvested_on = 'That date is too far in the past.'
  else if (ctx.sowingDate && isDate(ctx.sowingDate) && v.harvested_on < ctx.sowingDate) e.harvested_on = 'This plant was sown after that date.'
  if (!UNITS.includes(v.unit as never)) e.unit = 'Choose a unit.'
  const q = numOrNaN(v.quantity)
  if (!Number.isFinite(q) || q <= 0) e.quantity = 'Enter a quantity above 0.'
  else if (q > 100000) e.quantity = 'That looks too large.'
  else if ((v.unit === 'pieces' || v.unit === 'bunches') && !Number.isInteger(q)) e.quantity = 'Count pieces and bunches in whole numbers.'
  else if (decimals(v.quantity) > 2) e.quantity = 'Use at most 2 decimal places.'
  if (text(v.notes).length > 500) e.notes = 'Notes are limited to 500 characters.'
  return e
}

export function validateTask(v: Record<string, unknown>, today = todayISO()): Errors {
  const e: Errors = {}
  const t = text(v.title)
  if (!t) e.title = 'Describe the task.'
  else if (t.length > 80) e.title = 'Keep it under 80 characters.'
  if (!TASK_TYPES.includes(v.type as never)) e.type = 'Choose a task type.'
  if (!isDate(v.due_date)) e.due_date = 'Pick a due date.'
  else if (v.due_date < EARLIEST || v.due_date > addDays(today, 5 * 366)) e.due_date = 'Pick a date within the next five years.'
  if (text(v.notes).length > 500) e.notes = 'Notes are limited to 500 characters.'
  return e
}

export const hasErrors = (e: Errors) => Object.keys(e).length > 0

/** Sign-in / sign-up form checks (the server enforces its own rules too). */
export function validateCredentials(email: string, password: string, mode: 'in' | 'up'): { email?: string; password?: string } {
  const e: { email?: string; password?: string } = {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) e.email = 'Enter a valid email address.'
  if (!password) e.password = 'Enter your password.'
  else if (mode === 'up' && password.length < 8) e.password = 'Use at least 8 characters.'
  else if (mode === 'up' && (!/[A-Za-z]/.test(password) || !/\d/.test(password))) e.password = 'Use letters and at least one number.'
  return e
}

// ======================================================================
// components/forms.tsx
// ======================================================================
const nullIfEmpty = (s: string) => (s.trim() ? s.trim() : null)

/* ============================ Bed form ============================ */
export function BedForm({ open, bed, onClose }: { open: boolean; bed?: Bed | null; onClose: () => void }) {
  const { create, update, beds } = useData(); const toast = useToast()
  const [v, setV] = useState({ name: '', length_m: '2.4', width_m: '1.2', soil_type: 'Loamy', zone: '', notes: '' })
  const [err, setErr] = useState<Errors>({}); const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) { setErr({}); setV(bed ? { name: bed.name, length_m: String(bed.length_m), width_m: String(bed.width_m), soil_type: bed.soil_type, zone: bed.zone ?? '', notes: bed.notes ?? '' } : { name: '', length_m: '2.4', width_m: '1.2', soil_type: 'Loamy', zone: '', notes: '' }) }
  }, [open, bed])
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errors = validateBed(v, { existingNames: beds.filter((b) => b.id !== bed?.id).map((b) => b.name) }); setErr(errors); if (hasErrors(errors)) return
    setBusy(true)
    const row = { name: v.name.trim(), length_m: Number(v.length_m), width_m: Number(v.width_m), soil_type: v.soil_type as Bed['soil_type'], zone: nullIfEmpty(v.zone), notes: nullIfEmpty(v.notes) }
    try {
      if (bed) { await update('garden_beds', bed.id, row); toast(`Bed ${bed.code} updated`) }
      else { const b = await create('garden_beds', row); toast(`Bed ${b.code} created`) }
      onClose()
    } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })
  const areaM2 = Number(v.length_m) * Number(v.width_m)
  return (
    <Modal open={open} title={bed ? `Edit bed ${bed.code}` : 'Add a garden bed'} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Bed name" error={err.name}><input className="input" value={v.name} onChange={set('name')} placeholder="e.g. Sunny Corner" aria-invalid={!!err.name} maxLength={60} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Length (m)" error={err.length_m}><input className="input" type="number" step="0.1" min="0.1" max="100" value={v.length_m} onChange={set('length_m')} aria-invalid={!!err.length_m} /></Field>
          <Field label="Width (m)" error={err.width_m}><input className="input" type="number" step="0.1" min="0.1" max="100" value={v.width_m} onChange={set('width_m')} aria-invalid={!!err.width_m} /></Field>
        </div>
        {Number.isFinite(areaM2) && areaM2 > 0 && <p className="-mt-2 text-xs text-dim">Area: {areaM2.toFixed(2)} m²</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Soil type" error={err.soil_type}><select className="input" value={v.soil_type} onChange={set('soil_type')}>{SOIL_TYPES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Zone (optional)"><input className="input" value={v.zone} onChange={set('zone')} placeholder="e.g. Zone A" maxLength={40} /></Field>
        </div>
        <Field label="Notes (optional)" error={err.notes}><textarea className="input min-h-20" value={v.notes} onChange={set('notes')} maxLength={500} /></Field>
        <p className="text-xs text-dim">{bed ? `Bed ID ${bed.code} stays the same.` : 'A unique bed ID (like BED-009) is assigned automatically when you save.'}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy}>{bed ? 'Save changes' : 'Create bed'}</Button></div>
      </form>
    </Modal>
  )
}

/* ============================ Plant form ============================ */
export type PlantDraft = Partial<Pick<Plant, 'name' | 'category' | 'bed_id' | 'sowing_date' | 'expected_harvest_date' | 'status' | 'quantity' | 'notes'>>
export function PlantForm({ open, plant, draft, onClose }: { open: boolean; plant?: Plant | null; draft?: PlantDraft; onClose: () => void }) {
  const { create, update, beds, plants } = useData(); const toast = useToast()
  const blank = { name: '', category: 'Vegetable', bed_id: '', sowing_date: todayISO(), expected_harvest_date: '', status: 'sown', quantity: '1', notes: '' }
  const [v, setV] = useState(blank)
  const [err, setErr] = useState<Errors>({}); const [busy, setBusy] = useState(false)
  const occ = occupancy(beds, plants)
  useEffect(() => {
    if (!open) return
    setErr({})
    const src = plant ?? draft
    setV(src ? {
      name: src.name ?? '', category: src.category ?? 'Vegetable', bed_id: src.bed_id ?? '', sowing_date: src.sowing_date ?? '',
      expected_harvest_date: src.expected_harvest_date ?? '', status: src.status ?? 'planned', quantity: String(src.quantity ?? 1), notes: src.notes ?? ''
    } : blank)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plant, draft])

  // picking a known crop fills category and the expected harvest date
  const onName = (name: string) => {
    const c = findCatalog(name)
    setV((p) => ({ ...p, name, ...(c ? { category: c.category, expected_harvest_date: p.sowing_date ? addDays(p.sowing_date, c.days) : p.expected_harvest_date } : {}) }))
  }
  const onSow = (sowing_date: string) => {
    const c = findCatalog(v.name)
    setV((p) => ({ ...p, sowing_date, ...(c && sowing_date ? { expected_harvest_date: addDays(sowing_date, c.days) } : {}) }))
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errors = validatePlant(v); setErr(errors); if (hasErrors(errors)) return
    setBusy(true)
    const row = {
      name: v.name.trim(), category: v.category as Plant['category'], bed_id: v.bed_id || null, sowing_date: v.sowing_date || null,
      expected_harvest_date: v.expected_harvest_date || null, status: v.status as Plant['status'], quantity: Number(v.quantity), notes: nullIfEmpty(v.notes)
    }
    try {
      if (plant) { await update('garden_plants', plant.id, row); toast(`${row.name} updated`) }
      else { await create('garden_plants', row); toast(`${row.name} added${row.sowing_date ? ' and sowing logged' : ''}`) }
      onClose()
    } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })
  const cat = findCatalog(v.name)
  return (
    <Modal open={open} title={plant ? `Edit ${plant.name}` : 'Add a plant'} onClose={onClose} wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Plant name" error={err.name} hint={cat ? `Typically ${cat.days} days to harvest · ${cat.sun.toLowerCase()} · ${cat.water.toLowerCase()} water` : 'Pick from the list or type any plant'}>
          <input className="input" list="catalog" value={v.name} onChange={(e) => onName(e.target.value)} aria-invalid={!!err.name} maxLength={60} placeholder="e.g. Tomato" />
          <datalist id="catalog">{CATALOG.map((c) => <option key={c.name} value={c.name} />)}</datalist>
        </Field>
        <Field label="Category" error={err.category}><select className="input" value={v.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Garden bed" hint="Beds marked “in use” already have growing plants">
          <select className="input" value={v.bed_id} onChange={set('bed_id')}>
            <option value="">Not assigned yet</option>
            {beds.map((b) => { const used = (occ.get(b.id) ?? []).filter((p) => p.id !== plant?.id).length
              return <option key={b.id} value={b.id}>{b.code} · {b.name} ({b.soil_type}){used ? ` · in use (${used})` : ' · available'}</option> })}
          </select>
        </Field>
        <Field label="Growth status" error={err.status}><select className="input" value={v.status} onChange={set('status')}>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></Field>
        <Field label="Sowing date" error={err.sowing_date}><input className="input" type="date" value={v.sowing_date} onChange={(e) => onSow(e.target.value)} aria-invalid={!!err.sowing_date} /></Field>
        <Field label="Estimated harvest date" error={err.expected_harvest_date} hint={cat ? 'Filled in from the crop; you can change it' : undefined}><input className="input" type="date" value={v.expected_harvest_date} onChange={set('expected_harvest_date')} aria-invalid={!!err.expected_harvest_date} /></Field>
        <Field label="Quantity (plants)" error={err.quantity}><input className="input" type="number" min="1" max="10000" step="1" value={v.quantity} onChange={set('quantity')} aria-invalid={!!err.quantity} /></Field>
        <Field label="Notes (optional)" error={err.notes}><input className="input" value={v.notes} onChange={set('notes')} maxLength={500} placeholder="Variety, source, care notes…" /></Field>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy}>{plant ? 'Save changes' : 'Add plant'}</Button></div>
      </form>
    </Modal>
  )
}

/* ============================ Harvest form ============================ */
export function HarvestForm({ open, harvest, onClose }: { open: boolean; harvest?: Harvest | null; onClose: () => void }) {
  const { create, update, plants, beds } = useData(); const toast = useToast()
  const blank = { plant_id: '', plant_name: '', bed_id: '', harvested_on: todayISO(), quantity: '', unit: 'kg', notes: '' }
  const [v, setV] = useState(blank); const [err, setErr] = useState<Errors>({}); const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setErr({})
    setV(harvest ? { plant_id: harvest.plant_id ?? '', plant_name: harvest.plant_name, bed_id: harvest.bed_id ?? '', harvested_on: harvest.harvested_on, quantity: String(harvest.quantity), unit: harvest.unit, notes: harvest.notes ?? '' } : blank)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, harvest])
  const pick = (id: string) => { const p = plants.find((x) => x.id === id); setV((s) => ({ ...s, plant_id: id, plant_name: p?.name ?? s.plant_name, bed_id: p?.bed_id ?? s.bed_id })) }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errors = validateHarvest(v, { sowingDate: plants.find((p) => p.id === v.plant_id)?.sowing_date }); setErr(errors); if (hasErrors(errors)) return
    setBusy(true)
    const row = { plant_id: v.plant_id || null, plant_name: v.plant_name.trim(), bed_id: v.bed_id || null, harvested_on: v.harvested_on, quantity: Number(v.quantity), unit: v.unit as Harvest['unit'], notes: nullIfEmpty(v.notes) }
    try {
      if (harvest) { await update('garden_harvests', harvest.id, row); toast('Harvest updated') }
      else { await create('garden_harvests', row); toast(`Logged ${row.quantity} ${row.unit} of ${row.plant_name}`) }
      onClose()
    } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })
  return (
    <Modal open={open} title={harvest ? 'Edit harvest' : 'Record a harvest'} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Plant from your garden (optional)">
          <select className="input" value={v.plant_id} onChange={(e) => pick(e.target.value)}>
            <option value="">Choose a plant…</option>
            {plants.map((p) => <option key={p.id} value={p.id}>{p.name}{p.bed_id ? ` · ${beds.find((b) => b.id === p.bed_id)?.code ?? ''}` : ''}</option>)}
          </select>
        </Field>
        <Field label="Plant name" error={err.plant_name}><input className="input" value={v.plant_name} onChange={set('plant_name')} aria-invalid={!!err.plant_name} maxLength={60} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Garden bed"><select className="input" value={v.bed_id} onChange={set('bed_id')}><option value="">None</option>{beds.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}</select></Field>
          <Field label="Harvest date" error={err.harvested_on}><input className="input" type="date" max={todayISO()} value={v.harvested_on} onChange={set('harvested_on')} aria-invalid={!!err.harvested_on} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" error={err.quantity}><input className="input" type="number" min="0" step="0.01" value={v.quantity} onChange={set('quantity')} aria-invalid={!!err.quantity} /></Field>
          <Field label="Unit" error={err.unit}><select className="input" value={v.unit} onChange={set('unit')}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></Field>
        </div>
        <Field label="Notes (optional)" error={err.notes}><textarea className="input min-h-20" value={v.notes} onChange={set('notes')} maxLength={500} placeholder="Quality, who picked it, where it went…" /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy}>{harvest ? 'Save changes' : 'Save harvest'}</Button></div>
      </form>
    </Modal>
  )
}

/* ============================ Task form ============================ */
export function TaskForm({ open, task, date, onClose }: { open: boolean; task?: Task | null; date?: string; onClose: () => void }) {
  const { create, update, beds, plants } = useData(); const toast = useToast()
  const [v, setV] = useState({ title: '', type: 'water', due_date: todayISO(), bed_id: '', plant_id: '', notes: '' })
  const [err, setErr] = useState<Errors>({}); const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setErr({})
    setV(task ? { title: task.title, type: task.type, due_date: task.due_date, bed_id: task.bed_id ?? '', plant_id: task.plant_id ?? '', notes: task.notes ?? '' } : { title: '', type: 'water', due_date: date ?? todayISO(), bed_id: '', plant_id: '', notes: '' })
  }, [open, task, date])
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errors = validateTask(v); setErr(errors); if (hasErrors(errors)) return
    setBusy(true)
    const row = { title: v.title.trim(), type: v.type as Task['type'], due_date: v.due_date, bed_id: v.bed_id || null, plant_id: v.plant_id || null, notes: nullIfEmpty(v.notes) }
    try {
      if (task) { await update('garden_tasks', task.id, row); toast('Task updated') }
      else { await create('garden_tasks', row); toast('Task scheduled') }
      onClose()
    } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })
  return (
    <Modal open={open} title={task ? 'Edit task' : 'Schedule a task'} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Task" error={err.title}><input className="input" value={v.title} onChange={set('title')} placeholder="e.g. Water the herb spiral" maxLength={80} aria-invalid={!!err.title} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" error={err.type}><select className="input" value={v.type} onChange={set('type')}>{TASK_TYPES.map((t) => <option key={t} value={t}>{TASK_LABEL[t]}</option>)}</select></Field>
          <Field label="Due date" error={err.due_date}><input className="input" type="date" value={v.due_date} onChange={set('due_date')} aria-invalid={!!err.due_date} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bed (optional)"><select className="input" value={v.bed_id} onChange={set('bed_id')}><option value="">None</option>{beds.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}</select></Field>
          <Field label="Plant (optional)"><select className="input" value={v.plant_id} onChange={set('plant_id')}><option value="">None</option>{plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        </div>
        <Field label="Notes (optional)"><input className="input" value={v.notes} onChange={set('notes')} maxLength={500} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy}>{task ? 'Save changes' : 'Schedule task'}</Button></div>
      </form>
    </Modal>
  )
}

// ======================================================================
// lib/ai.ts
// ======================================================================
/* ---------------------------------------------------------------------
   AI client. Every call goes to the `garden-ai` Supabase edge function,
   which holds the Gemini key server-side. If the key isn't configured
   (or the function can't be reached) we return clearly-labeled demo data.
   --------------------------------------------------------------------- */

export interface AiStatus { configured: boolean; model: string | null; reachable: boolean }
export interface RecommendInputs { location: string; season: Season; soil: string; space: number; sunlight: string; water: string }
export interface Recommendation {
  name: string; category: Category | string; why: string; planting_period: string; growth_duration: string
  watering: string; sunlight: string; soil: string; recommended_bed: string; days_to_harvest: number
}
export interface RecommendResult { demo: boolean; model?: string; summary: string; recommendations: Recommendation[] }
export interface HealthResult {
  demo: boolean; model?: string; confidence: number | null; plant_guess: string; overall: string; image_quality: string
  observations: string[]; possible_causes: { name: string; explanation: string }[]; care_steps: string[]; see_expert_if: string
}
export interface ChatMsg { role: 'user' | 'assistant'; content: string; demo?: boolean; at: string }

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  if (!supabaseConfigured) return { demo: true } as T
  const { data, error } = await supabase.functions.invoke('garden-ai', { body: payload })
  if (error) {
    // surface the function's own error message when there is one
    let msg = error.message
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx) {
        const j = await ctx.json()
        if (j?.error) msg = j.error
        // the request id lets anyone find this exact call in the function logs
        if (j?.request_id) msg += ` (ref ${String(j.request_id).slice(0, 8)})`
      }
    } catch { /* ignore */ }
    throw new Error(msg)
  }
  return data as T
}

let statusCache: Promise<AiStatus> | null = null
export function aiStatus(force = false): Promise<AiStatus> {
  if (!statusCache || force) {
    statusCache = call<{ configured: boolean; model: string | null }>({ action: 'status' })
      .then((s) => ({ configured: Boolean(s?.configured), model: s?.model ?? null, reachable: true }))
      .catch(() => ({ configured: false, model: null, reachable: false }))
  }
  return statusCache
}

/* ------------------------------ Recommend ------------------------------ */
export async function recommend(inputs: RecommendInputs, beds: Bed[], plants: Plant[]): Promise<RecommendResult> {
  const occupied = new Set(plants.filter((p) => p.bed_id && p.status !== 'harvested').map((p) => p.bed_id))
  const bedInfo = beds.map((b) => ({ code: b.code, soil: b.soil_type, area: +(b.length_m * b.width_m).toFixed(2), free: !occupied.has(b.id) }))
  const res = await call<RecommendResult & { demo?: boolean }>({ action: 'recommend', inputs, beds: bedInfo })
  if (res && !res.demo && Array.isArray(res.recommendations)) return { ...res, demo: false }
  return demoRecommend(inputs, bedInfo)
}

function demoRecommend(f: RecommendInputs, beds: { code: string; soil: string; area: number; free: boolean }[]): RecommendResult {
  const sunWant = f.sunlight.startsWith('Full') ? 'Full sun' : f.sunlight.startsWith('Partial') ? 'Partial sun' : 'Shade tolerant'
  const scored = CATALOG.map((c) => {
    let s = 0
    if (c.seasons.includes(f.season)) s += 3
    if (c.soils.includes(f.soil as never)) s += 2
    if (c.sun === sunWant) s += 2; else if (sunWant !== 'Full sun' && c.sun === 'Shade tolerant') s += 1
    const w = f.water.startsWith('Low') ? 'Low' : f.water.startsWith('High') ? 'High' : 'Medium'
    if (c.water === w) s += 1; else if (w === 'Low' && c.water === 'High') s -= 2
    if (f.space < 3 && c.spacing_cm > 45) s -= 2
    return { c, s }
  }).sort((a, b) => b.s - a.s).slice(0, 5)
  const pickBed = (soils: string[]) => beds.find((b) => b.free && soils.includes(b.soil))?.code ?? beds.find((b) => b.free)?.code ?? 'Any free bed'
  return {
    demo: true,
    summary: `Demo picks for ${f.season.toLowerCase()} with ${f.soil.toLowerCase()} soil, ${f.sunlight.toLowerCase()} and ${f.water.toLowerCase()} water, chosen by simple matching rules (not AI).`,
    recommendations: scored.map(({ c }) => ({
      name: c.name, category: c.category,
      why: `${c.seasons.includes(f.season) ? `Grows well in ${f.season.toLowerCase()}` : 'Tolerates this season'}; prefers ${c.soils.slice(0, 2).join(' or ').toLowerCase()} soil and ${c.sun.toLowerCase()}.`,
      planting_period: `Sow at the start of ${c.seasons.filter((s) => s === f.season)[0] ?? c.seasons[0]}`,
      growth_duration: `About ${c.days} days to first harvest`,
      watering: c.water === 'High' ? 'Keep soil evenly moist; water deeply every 1–2 days in heat.' : c.water === 'Low' ? 'Water when the top 3 cm of soil is dry.' : 'Water 2–3 times a week at the base.',
      sunlight: c.sun, soil: c.soils.join(', '), recommended_bed: pickBed(c.soils), days_to_harvest: c.days
    }))
  }
}

/* ------------------------------ Health ------------------------------ */
export async function analyseLeaf(image: string, mime: string, plant: string, notes: string): Promise<HealthResult> {
  const res = await call<HealthResult & { demo?: boolean }>({ action: 'health', image, mime, plant, notes })
  if (res && !res.demo && Array.isArray(res.observations)) return { ...res, demo: false, confidence: typeof res.confidence === 'number' ? res.confidence : null }
  return {
    demo: true, confidence: null, plant_guess: plant || 'Not analysed',
    overall: 'Demo result: this image was not analysed. Add a Gemini API key in Settings to enable real analysis.',
    image_quality: 'Not assessed in demo mode.',
    observations: ['Example: yellowing between leaf veins on older leaves', 'Example: small brown spots with lighter halos'],
    possible_causes: [
      { name: 'Nitrogen or magnesium deficiency (example)', explanation: 'Older leaves often yellow first when the plant moves nutrients to new growth.' },
      { name: 'Early fungal leaf spot (example)', explanation: 'Brown spots with halos are common after long periods of wet foliage.' }
    ],
    care_steps: ['Water at the base in the morning so leaves dry quickly.', 'Remove badly spotted leaves and do not compost them.', 'Feed with compost or a balanced organic fertiliser.', 'Space plants for airflow.'],
    see_expert_if: 'Spots spread quickly, stems wilt, or most of the plant is affected.'
  }
}

/* ------------------------------ Chat ------------------------------ */
export async function chat(messages: ChatMsg[], context: Record<string, unknown>): Promise<{ reply: string; demo: boolean }> {
  const res = await call<{ demo?: boolean; reply?: string }>({ action: 'chat', messages: messages.map(({ role, content }) => ({ role, content })), context })
  if (res && !res.demo && res.reply) return { reply: res.reply, demo: false }
  return { reply: demoReply(messages[messages.length - 1]?.content ?? ''), demo: true }
}

function demoReply(q: string) {
  const t = q.toLowerCase()
  const lead = '**Demo mode** (no AI key yet), so this is a canned tip:\n\n'
  if (/water/.test(t)) return lead + 'Water deeply and less often, early in the morning, at the base of the plant. Check soil 3 cm down: if it is dry, water. Mulch beds to cut evaporation by up to a third.'
  if (/rotat/.test(t)) return lead + 'A simple 4-bed rotation: **legumes → leafy greens → fruiting crops → roots**. Legumes leave nitrogen behind for the leafy crops that follow, and moving families each season breaks pest cycles.'
  if (/soil|compost|ph/.test(t)) return lead + 'Most vegetables like loamy soil with pH 6–7. Add 3–5 cm of compost each season. For clay, add compost and avoid working it wet; for sandy soil, add compost and mulch to hold moisture.'
  if (/harvest/.test(t)) return lead + 'Harvest leafy greens in the morning when they are crisp, pick tomatoes at full colour, and pull roots when the shoulders show the expected size. Log every harvest so the analytics stay accurate.'
  if (/when|sow|plant|season|schedule/.test(t)) return lead + 'Check the Sowing Calendar for what is due. As a rule: sow cool-season crops (lettuce, spinach, carrot, peas) in autumn–winter, and warm-season crops (tomato, chilli, okra, beans) in spring–summer.'
  return lead + 'I can help with planting times, watering, soil, crop rotation, plant choice and harvest planning. Try one of the suggestions below.'
}

// ======================================================================
// components/layout/AppShell.tsx
// ======================================================================
export const NAV = [
  { to: '/dashboard', label: 'Overview Dashboard', icon: LayoutDashboard },
  { to: '/garden', label: '3D Garden', icon: Box },
  { to: '/beds', label: 'Garden Beds', icon: Rows3 },
  { to: '/plants', label: 'Plants', icon: Sprout },
  { to: '/recommend', label: 'AI Plant Recommendations', icon: Sparkles },
  { to: '/health', label: 'AI Plant Health', icon: ScanLine },
  { to: '/chat', label: 'Garden AI Chat', icon: MessagesSquare },
  { to: '/calendar', label: 'Sowing Calendar', icon: CalendarDays },
  { to: '/harvests', label: 'Harvest Records', icon: ShoppingBasket },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/account', label: 'Account & Gardens', icon: UserRound },
  { to: '/settings', label: 'Settings', icon: Settings }
]

export function Logo({ small }: { small?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 font-display font-extrabold tracking-tight" aria-label="Community Garden Planner home">
      <svg viewBox="0 0 32 32" className={small ? 'size-8' : 'size-9'} aria-hidden="true">
        <defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f6ff8a" /><stop offset="1" stopColor="#e4ea12" /></linearGradient></defs>
        <rect x="2" y="2" width="28" height="28" rx="9" fill="url(#lg1)" />
        <path d="M16 25V14m0 5c-4 0-6.5-2.5-6.5-6.5 4 0 6.5 2.5 6.5 6.5Zm0-3c0-4 2.5-6.5 6.5-6.5 0 4-2.5 6.5-6.5 6.5Z" stroke="#000000" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="leading-tight">Garden<br className={small ? 'hidden' : ''} /><span className="text-gradient">{small ? ' ' : ''}Planner</span></span>
    </Link>
  )
}

export function AiPill() {
  const [s, setS] = useState<AiStatus | null>(null)
  useEffect(() => { aiStatus().then(setS) }, [])
  if (!s) return <span className="rounded-full border border-line px-3 py-1 text-xs text-dim">AI…</span>
  return s.configured
    ? <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200"><span className="size-1.5 rounded-full bg-lime-300 shadow-[0_0_8px_#eef53c]" />AI live · Gemini</span>
    : <Link to="/settings" className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200" title="Add a Gemini key to enable live AI"><span className="size-1.5 rounded-full bg-amber-300" />AI demo mode</Link>
}

export function AppShell() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const { loading, reload, lastSync, online, queued, fromCache, canWrite } = useData()
  const auth = useAuth()
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [loc.pathname])
  const current = NAV.find((n) => loc.pathname.startsWith(n.to))
  const mainRef = useRef<HTMLElement>(null)
  const [prog, setProg] = useState(0)
  const [palette, setPalette] = useState(false)

  // Ctrl/⌘ + K (or /) opens the search palette from anywhere in the app
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.closest('input, textarea, select, [contenteditable="true"]') !== null)
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setPalette((p) => !p) }
      else if (e.key === '/' && !typing) { e.preventDefault(); setPalette(true) }
    }
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on)
  }, [])

  // reading-progress bar under the top bar
  useEffect(() => {
    const on = () => { const h = document.documentElement, max = h.scrollHeight - h.clientHeight; setProg(max > 0 ? h.scrollTop / max : 0) }
    on(); window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on)
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on) }
  }, [])

  // cards rise into place as they scroll into view (also catches cards that render later)
  useEffect(() => {
    const root = mainRef.current; if (!root) return
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('rv-in'); io.unobserve(e.target) } }), { threshold: 0.06, rootMargin: '0px 0px -30px 0px' })
    const scan = () => root.querySelectorAll<HTMLElement>('.glass:not(.rv), .banner:not(.rv)').forEach((el) => { el.classList.add('rv'); io.observe(el) })
    scan(); const mo = new MutationObserver(scan); mo.observe(root, { childList: true, subtree: true })
    return () => { io.disconnect(); mo.disconnect() }
  }, [])

  // soft light that follows the cursor across glass cards
  const spot = (e: PointerEvent<HTMLElement>) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('.glass'); if (!t) return
    const r = t.getBoundingClientRect(); t.style.setProperty('--mx', `${e.clientX - r.left}px`); t.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  const nav = (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto scrollbar-thin px-3 py-2">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to}
          className={({ isActive }) => `group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${isActive ? 'bg-gradient-to-r from-emerald-400/20 to-lime-400/5 text-ink shadow-[inset_2px_0_0_#eef53c]' : 'text-muted hover:bg-white/5 hover:text-ink'}`}>
          {({ isActive }) => (<><Icon className={`size-[18px] shrink-0 ${isActive ? 'text-lime-300' : 'text-dim group-hover:text-emerald-300'}`} />{label}</>)}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-full lg:pl-72">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-line bg-forest-950/70 backdrop-blur-xl lg:flex">
        <div className="px-6 py-6"><Logo /></div>
        {nav}
        <div className="m-3 rounded-2xl border border-line bg-emerald-400/5 p-4 text-xs text-muted">
          <p className="font-display text-sm font-bold text-ink">Grow Together.</p>
          <p>Track Better. Harvest Smarter.</p>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-forest-950 transition-transform duration-300 lg:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`} aria-hidden={!open}>
        <div className="flex items-center justify-between px-5 py-5"><Logo /><button onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-xl text-muted hover:bg-white/5" aria-label="Close menu"><X className="size-5" /></button></div>
        {nav}
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-forest-900/70 px-4 backdrop-blur-xl sm:px-6">
        <span className="absolute inset-x-0 bottom-[-1px] h-[2px] origin-left bg-gradient-to-r from-emerald-400 via-lime-300 to-amber-300" style={{ transform: `scaleX(${prog})` }} aria-hidden="true" />
        <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-xl border border-line text-muted lg:hidden" aria-label="Open menu"><Menu className="size-5" /></button>
        <p className="min-w-0 flex-1 truncate font-display font-bold">{current?.label ?? 'Garden'}</p>
        <button onClick={() => setPalette(true)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-3 text-xs text-muted hover:border-lime-300/50 hover:text-ink" aria-label="Search the garden" title="Search (Ctrl+K)">
          <Search className="size-4 shrink-0" /><span className="hidden md:inline">Search</span><kbd className="hidden rounded border border-line px-1 font-mono text-[10px] text-dim md:inline">Ctrl K</kbd>
        </button>
        <GardenSwitcher />
        <span className="hidden md:inline-flex"><AiPill /></span>
        <button onClick={reload} className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-ink sm:inline-flex" title={lastSync ? `Last synced ${lastSync.toLocaleTimeString()}` : 'Sync'}>
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />Sync
        </button>
        <Link to="/account" className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-sm font-bold text-muted hover:border-lime-300/50 hover:text-ink" aria-label={auth.user ? `Account (${auth.user.email})` : 'Sign in'} title={auth.user ? auth.user.email ?? 'Account' : 'Sign in'}>
          {auth.user ? <span className="grid size-8 place-items-center rounded-full bg-lime-300 text-black">{(auth.user.email ?? '?')[0].toUpperCase()}</span> : <UserRound className="size-4" />}
        </Link>
      </header>

      <CommandPalette open={palette} onClose={() => setPalette(false)} pages={NAV} />
      <StatusStrip online={online} queued={queued} fromCache={fromCache} canWrite={canWrite} signedIn={!!auth.user} />
      <main ref={mainRef} onPointerMove={spot} className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8"><Outlet /></main>
    </div>
  )
}

/** Offline, queued-changes and view-only notices, shown under the top bar only when relevant. */
function StatusStrip({ online, queued, fromCache, canWrite, signedIn }: { online: boolean; queued: number; fromCache: boolean; canWrite: boolean; signedIn: boolean }) {
  const items: { key: string; icon: typeof WifiOff; text: string; tone: string }[] = []
  if (!online) items.push({ key: 'off', icon: WifiOff, text: 'You’re offline. Showing the saved copy of this garden; your changes are kept and sent when you reconnect.', tone: 'border-amber-400/30 bg-amber-400/10 text-amber-100' })
  else if (fromCache) items.push({ key: 'cache', icon: WifiOff, text: 'Couldn’t reach the database, so you’re seeing the saved copy.', tone: 'border-amber-400/30 bg-amber-400/10 text-amber-100' })
  if (queued > 0) items.push({ key: 'q', icon: CloudUpload, text: `${queued} change${queued > 1 ? 's' : ''} waiting to sync.`, tone: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100' })
  if (!canWrite) items.push({ key: 'ro', icon: Eye, text: signedIn ? 'View-only: you can read this garden but not change it.' : 'View-only garden. Sign in as a member to make changes.', tone: 'border-white/15 bg-white/5 text-muted' })
  if (!items.length) return null
  return (
    <div role="status" aria-live="polite" className="mx-auto grid max-w-[1400px] gap-2 px-4 pt-4 sm:px-6">
      {items.map(({ key, icon: I, text, tone }) => <p key={key} data-testid={`status-${key}`} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${tone}`}><I className="size-4 shrink-0" />{text}</p>)}
    </div>
  )
}

/** Picks which garden (tenant) the whole app is looking at. */
export function GardenSwitcher() {
  const a = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])
  const g = a.garden
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={`Current garden: ${g?.name ?? 'none'}. Switch garden`}
        className="inline-flex min-h-10 max-w-[38vw] items-center gap-2 rounded-full border border-line px-3 text-xs font-semibold text-ink hover:border-lime-300/50 sm:max-w-56">
        {g?.visibility === 'private' ? <Lock className="size-3.5 shrink-0 text-lime-300" /> : <Globe2 className="size-3.5 shrink-0 text-lime-300" />}
        <span className="truncate">{g?.name ?? 'Garden'}</span><ChevronDown className="size-3.5 shrink-0 text-dim" />
      </button>
      {open && (
        <div role="listbox" aria-label="Gardens" className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-line bg-[#0b0b0b] p-2 shadow-2xl">
          {a.gardens.map((x) => (
            <button key={x.id} role="option" aria-selected={x.id === a.gardenId} onClick={() => { a.setGardenId(x.id); setOpen(false) }}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm ${x.id === a.gardenId ? 'bg-lime-300/10 text-ink' : 'text-muted hover:bg-white/5 hover:text-ink'}`}>
              {x.visibility === 'private' ? <Lock className="size-3.5 shrink-0" /> : <Globe2 className="size-3.5 shrink-0" />}
              <span className="flex-1 truncate">{x.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-dim">{a.memberships.find((m) => m.garden_id === x.id)?.role ?? (x.visibility === 'public_open' ? 'open' : 'public')}</span>
            </button>
          ))}
          <Link to="/account" onClick={() => setOpen(false)} className="mt-1 block rounded-xl border-t border-line px-3 py-2.5 text-sm font-semibold text-lime-300 hover:bg-white/5">{a.user ? '+ New garden or join with a code' : 'Sign in for private gardens →'}</Link>
        </div>
      )}
    </div>
  )
}

// ======================================================================
// lib/csv.ts
// ======================================================================
/** Builds a CSV string (RFC 4180 quoting) and triggers a browser download. */
export function toCSV(rows: Record<string, unknown>[], columns?: string[]) {
  const cols = columns ?? Array.from(rows.reduce((s, r) => { Object.keys(r).forEach((k) => s.add(k)); return s }, new Set<string>()))
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n')
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[], columns?: string[]) {
  const blob = new Blob(['﻿' + toCSV(rows, columns)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ======================================================================
// lib/monitoring.ts
// ======================================================================
/** Aggregate health of the garden-ai edge function, from the garden_ai_stats() RPC. */
export interface AiStats {
  window_hours: number
  total: number
  errors: number
  client_errors: number
  rate_limited: number
  demo: number
  avg_ms: number
  p95_ms: number
  by_action: Record<string, number>
  last_error: { at: string; action: string; status: number; message: string } | null
  last_call_at: string | null
}

export async function fetchAiStats(hours = 24): Promise<AiStats> {
  if (!supabaseConfigured) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('garden_ai_stats', { hours })
  if (error) throw new Error(error.message)
  return data as AiStats
}

/** Share of calls that failed on the server, as a 0–1 number (0 when there were no calls). */
export const errorRate = (s: Pick<AiStats, 'total' | 'errors'>) => (s.total > 0 ? s.errors / s.total : 0)

/** A simple traffic-light status used by the Settings card. */
export function healthLabel(s: AiStats): { label: string; tone: 'lime' | 'amber' | 'red' | 'gray' } {
  if (s.total === 0) return { label: 'No calls yet', tone: 'gray' }
  const r = errorRate(s)
  if (r >= 0.2) return { label: 'Unhealthy', tone: 'red' }
  if (r > 0 || s.p95_ms > 15000) return { label: 'Degraded', tone: 'amber' }
  return { label: 'Healthy', tone: 'lime' }
}

// ======================================================================
// lib/sw.ts
// ======================================================================
/** Registers the offline service worker in production builds only (dev and tests stay uncached). */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || import.meta.env.MODE === 'e2e' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* offline support is optional */ }) })
}

// ======================================================================
// pages/Account.tsx
// ======================================================================
const ACCESS_LABEL: Record<Access, string> = { owner: 'Owner', editor: 'Editor', viewer: 'Viewer', open: 'Open demo', public: 'Public · read only' }
const ACCESS_TONE: Record<Access, Tone> = { owner: 'lime', editor: 'emerald', viewer: 'cyan', open: 'amber', public: 'gray' }
const VIS_LABEL: Record<GardenVisibility, string> = { private: 'Private (members only)', public_read: 'Public read-only', public_open: 'Open to everyone' }
const input = 'min-h-11 w-full rounded-xl border border-line bg-black/30 px-3 text-sm outline-none focus:border-lime-300/60'

export function AccountPage() {
  const a = useAuth()
  return (
    <>
      <PageHeader title="Your gardens, your people" sub="Sign in to keep private gardens, invite your plot-mates and choose who can edit and who can only view." />
      {a.user ? <SignedIn /> : <SignIn />}
    </>
  )
}

function SignIn() {
  const { signIn, signUp } = useAuth()
  const toast = useToast()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [errs, setErrs] = useState<{ email?: string; password?: string }>({})
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [err, setErr] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setMsg('')
    const v = validateCredentials(email, password, mode); setErrs(v); if (v.email || v.password) return
    setBusy(true)
    try {
      if (mode === 'in') { await signIn(email, password); toast('Signed in') }
      else {
        const r = await signUp(email, password)
        if (r.needsConfirmation) setMsg('Account created. Open the confirmation link we emailed you, then come back here and sign in.')
        else toast('Account created — you’re signed in')
      }
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <Card title={mode === 'in' ? 'Sign in' : 'Create an account'} icon={mode === 'in' ? <LogIn className="size-4" /> : <UserPlus className="size-4" />}>
        <div role="tablist" aria-label="Sign in or sign up" className="mb-4 inline-flex rounded-full border border-line p-1 text-sm">
          {(['in', 'up'] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setErr(''); setMsg(''); setErrs({}) }}
              className={`min-h-9 rounded-full px-4 font-semibold transition ${mode === m ? 'bg-lime-300 text-black' : 'text-muted hover:text-ink'}`}>{m === 'in' ? 'Sign in' : 'Sign up'}</button>
          ))}
        </div>
        <form onSubmit={submit} noValidate className="grid gap-3">
          <Field label="Email" error={errs.email}><input className={input} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password" error={errs.password} hint={mode === 'up' ? 'At least 8 characters, with letters and a number.' : undefined}>
            <input className={input} type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {err && <p role="alert" className="rounded-xl bg-red-950/40 p-3 text-sm text-red-200">{err}</p>}
          {msg && <p role="status" className="rounded-xl bg-emerald-950/50 p-3 text-sm text-emerald-100">{msg}</p>}
          <Button type="submit" loading={busy}>{mode === 'in' ? <><LogIn className="size-4" />Sign in</> : <><UserPlus className="size-4" />Create account</>}</Button>
        </form>
      </Card>
      <Card title="Why sign in?" icon={<ShieldCheck className="size-4" />}>
        <ul className="grid gap-3 text-sm text-muted">
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-lime-300" /><span><b className="text-ink">Private gardens.</b> Only members can see them. Postgres row-level security enforces this on the server.</span></li>
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-lime-300" /><span><b className="text-ink">Invite your plot-mates</b> with a code, and choose who edits and who only views.</span></li>
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-lime-300" /><span><b className="text-ink">Several gardens</b> per account, switched from the top bar.</span></li>
          <li className="flex gap-2"><Sprout className="mt-0.5 size-4 shrink-0 text-amber-300" /><span>No account needed to try it: the <b className="text-ink">Community Demo Garden</b> stays open to everyone.</span></li>
        </ul>
      </Card>
    </div>
  )
}

function SignedIn() {
  const a = useAuth()
  const toast = useToast()
  const [name, setName] = useState(''); const [vis, setVis] = useState<'private' | 'public_read'>('private'); const [code, setCode] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, f: () => Promise<unknown>, ok: string) => {
    setBusy(key)
    try { await f(); toast(ok) } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(null) }
  }
  const roleOf = (id: string): Access => {
    const m = a.memberships.find((x) => x.garden_id === id)
    if (m) return m.role
    return a.gardens.find((g) => g.id === id)?.visibility === 'public_open' ? 'open' : 'public'
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Signed in" icon={<KeyRound className="size-4" />} action={<Button variant="ghost" onClick={() => run('out', a.signOut, 'Signed out')} loading={busy === 'out'}><LogOut className="size-4" />Sign out</Button>}>
        <p className="text-sm text-muted">You’re signed in as <span className="font-mono text-ink">{a.user?.email}</span>.</p>
        <h3 className="mt-5 mb-2 text-sm font-bold">Your gardens</h3>
        <ul className="grid gap-2">
          {a.gardens.map((g) => (
            <li key={g.id} className={`flex items-center gap-3 rounded-xl border p-3 ${g.id === a.gardenId ? 'border-lime-300/50 bg-lime-300/5' : 'border-line'}`}>
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{g.name}</p><p className="text-xs text-dim">{VIS_LABEL[g.visibility]}</p></div>
              <Badge tone={ACCESS_TONE[roleOf(g.id)]}>{ACCESS_LABEL[roleOf(g.id)]}</Badge>
              {g.id === a.gardenId ? <span className="text-xs font-semibold text-lime-300">Current</span>
                : <Button variant="subtle" className="min-h-9 px-3" onClick={() => { a.setGardenId(g.id); toast(`Switched to ${g.name}`) }}>Open</Button>}
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-4">
        <Card title="Create a garden" icon={<Plus className="size-4" />}>
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); run('create', async () => { await a.createGarden(name, vis); setName('') }, 'Garden created — you’re its owner') }}>
            <Field label="Garden name"><input className={input} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maple Street Allotment" /></Field>
            <Field label="Who can see it">
              <select className={input} value={vis} onChange={(e) => setVis(e.target.value as 'private' | 'public_read')}>
                <option value="private">Private — members only</option><option value="public_read">Public read-only — anyone can view, members edit</option>
              </select>
            </Field>
            <Button type="submit" loading={busy === 'create'} disabled={!name.trim()}><Plus className="size-4" />Create garden</Button>
          </form>
        </Card>
        <Card title="Join with an invite code" icon={<UserPlus className="size-4" />}>
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run('join', async () => { await a.joinGarden(code); setCode('') }, 'Joined the garden as an editor') }}>
            <input aria-label="Invite code" className={`${input} flex-1 font-mono`} maxLength={12} value={code} onChange={(e) => setCode(e.target.value)} placeholder="12-character code" />
            <Button type="submit" loading={busy === 'join'} disabled={!code.trim()}>Join</Button>
          </form>
        </Card>
      </div>

      {a.gardenId !== DEMO_GARDEN_ID && a.garden && <ManageGarden />}
    </div>
  )
}

function ManageGarden() {
  const a = useAuth()
  const toast = useToast()
  const g = a.garden!
  const owner = a.access === 'owner'
  const [members, setMembers] = useState<GardenMember[]>([])
  const [invite, setInvite] = useState<string | null>(null)
  const [name, setName] = useState(g.name); const [vis, setVis] = useState<GardenVisibility>(g.visibility)
  const [confirm, setConfirm] = useState<'delete' | 'leave' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('garden_members').select('*').eq('garden_id', g.id).order('joined_at')
    setMembers((data ?? []) as GardenMember[])
    if (owner) { const r = await supabase.rpc('garden_invite_code', { p_garden: g.id }); if (!r.error) setInvite(r.data as string) }
  }, [g.id, owner])
  useEffect(() => { setName(g.name); setVis(g.visibility); load() }, [g, load])

  const run = async (key: string, f: () => Promise<{ error: unknown } | void>, ok: string) => {
    setBusy(key)
    try { const r = await f(); if (r && r.error) throw r.error; toast(ok); await load() } catch (e) { toast(authError(e), 'error') } finally { setBusy(null) }
  }

  return (
    <Card title={`Manage “${g.name}”`} icon={<Users className="size-4" />} className="lg:col-span-2" action={<Badge tone={ACCESS_TONE[a.access]}>{ACCESS_LABEL[a.access]}</Badge>}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid content-start gap-4">
          {owner ? (
            <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); run('save', async () => { const r = await supabase.from('garden_gardens').update({ name: name.trim(), visibility: vis }).eq('id', g.id); await a.refreshGardens(); return r }, 'Garden updated') }}>
              <Field label="Name"><input className={input} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Visibility">
                <select className={input} value={vis} onChange={(e) => setVis(e.target.value as GardenVisibility)}>
                  <option value="private">Private — members only</option><option value="public_read">Public read-only</option>
                </select>
              </Field>
              <Button type="submit" variant="ghost" loading={busy === 'save'} disabled={!name.trim()}>Save changes</Button>
            </form>
          ) : <p className="text-sm text-muted">{a.access === 'viewer' ? 'You can view this garden. Ask the owner to make you an editor to change it.' : 'You can view and edit this garden’s beds, plants, harvests and tasks.'}</p>}

          {owner && invite && (
            <div className="rounded-2xl border border-line bg-black/20 p-4">
              <p className="text-sm font-semibold">Invite code</p>
              <p className="mt-1 text-xs text-dim">Anyone signed in with this code joins as an editor. Rotate it to stop old codes working.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code data-testid="invite-code" className="rounded-lg bg-white/10 px-3 py-2 font-mono text-lg tracking-widest text-lime-200">{invite}</code>
                <Button variant="subtle" className="min-h-9 px-3" onClick={() => { navigator.clipboard?.writeText(invite).then(() => toast('Code copied')).catch(() => toast('Copy failed — select the code instead', 'error')) }}><Copy className="size-4" />Copy</Button>
                <Button variant="subtle" className="min-h-9 px-3" loading={busy === 'rotate'} onClick={() => run('rotate', async () => { const r = await supabase.rpc('garden_invite_code', { p_garden: g.id, p_rotate: true }); return r }, 'New code created')}><RefreshCw className="size-4" />New code</Button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {owner
              ? <Button variant="danger" onClick={() => setConfirm('delete')}><Trash2 className="size-4" />Delete garden</Button>
              : <Button variant="danger" onClick={() => setConfirm('leave')}><LogOut className="size-4" />Leave garden</Button>}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Members ({members.length})</p>
          <ul className="grid gap-2">
            {members.map((m) => (
              <li key={m.user_id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{m.email ?? m.user_id.slice(0, 8)}{m.user_id === a.user?.id && <span className="text-dim"> (you)</span>}</span>
                {owner && m.user_id !== a.user?.id ? (
                  <>
                    <select aria-label={`Role for ${m.email ?? 'member'}`} className="min-h-9 rounded-lg border border-line bg-black/30 px-2 text-sm" value={m.role}
                      onChange={(e) => run(`role-${m.user_id}`, async () => supabase.rpc('garden_set_member_role', { p_garden: g.id, p_user: m.user_id, p_role: e.target.value as GardenRole }), 'Role updated')}>
                      <option value="owner">Owner</option><option value="editor">Editor</option><option value="viewer">Viewer</option>
                    </select>
                    <Button variant="subtle" className="min-h-9 px-3" onClick={() => run(`rm-${m.user_id}`, async () => supabase.rpc('garden_remove_member', { p_garden: g.id, p_user: m.user_id }), 'Member removed')}>Remove</Button>
                  </>
                ) : <Badge tone={ACCESS_TONE[m.role]}>{ACCESS_LABEL[m.role]}</Badge>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ConfirmDialog open={confirm === 'delete'} title="Delete this garden?" confirmLabel="Delete garden" busy={busy === 'del'}
        body={<>This permanently deletes <b>{g.name}</b> and all its beds, plants, harvests and tasks for every member.</>}
        onClose={() => setConfirm(null)}
        onConfirm={() => run('del', async () => { const r = await supabase.from('garden_gardens').delete().eq('id', g.id); if (!r.error) { a.setGardenId(DEMO_GARDEN_ID); await a.refreshGardens(); setConfirm(null) } return r }, 'Garden deleted')} />
      <ConfirmDialog open={confirm === 'leave'} title="Leave this garden?" confirmLabel="Leave" busy={busy === 'leave'}
        body={<>You’ll lose access to <b>{g.name}</b> until someone invites you again.</>}
        onClose={() => setConfirm(null)}
        onConfirm={() => run('leave', async () => { const r = await supabase.rpc('garden_remove_member', { p_garden: g.id, p_user: a.user!.id }); if (!r.error) { a.setGardenId(DEMO_GARDEN_ID); await a.refreshGardens(); setConfirm(null) } return r }, 'You left the garden')} />
    </Card>
  )
}

// ======================================================================
// pages/Analytics.tsx
// ======================================================================
const Empty = () => <EmptyState title="Not enough data yet" body="Add plants and harvests to see this chart." />

export function Analytics() {
  const { beds, plants, harvests, tasks, sowing, loading, error, reload, bedById } = useData()
  const occ = useMemo(() => occupancy(beds, plants), [beds, plants])

  const byPlant = useMemo(() => Object.entries(plants.reduce<Record<string, number>>((m, p) => { m[p.name] = (m[p.name] ?? 0) + p.quantity; return m }, {}))
    .map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 12), [plants])
  const byCategory = useMemo(() => Object.entries(plants.reduce<Record<string, number>>((m, p) => { m[p.category] = (m[p.category] ?? 0) + 1; return m }, {}))
    .map(([name, value]) => ({ name, value })), [plants])
  const bedUsage = useMemo(() => beds.map((b) => {
    const ps = occ.get(b.id) ?? []
    return { name: b.code, area: +area(b).toFixed(2), crops: ps.length, plants: ps.reduce((a, p) => a + p.quantity, 0) }
  }), [beds, occ])
  const harvestByPlant = useMemo(() => Object.entries(harvests.reduce<Record<string, number>>((m, h) => { const k = toKg(h); if (k !== null) m[h.plant_name] = (m[h.plant_name] ?? 0) + k; return m }, {}))
    .map(([name, kg]) => ({ name, kg: +kg.toFixed(2) })).sort((a, b) => b.kg - a.kg), [harvests])
  const trends = useMemo(() => lastMonths(6).map((k) => ({
    month: monthLabel(k),
    sowings: sowing.filter((s) => monthKey(s.sown_on) === k).length,
    harvests: harvests.filter((h) => monthKey(h.harvested_on) === k).length
  })), [sowing, harvests])
  const growing = plants.filter((p) => p.status !== 'harvested' && p.sowing_date && p.expected_harvest_date)
    .map((p) => ({ p, pct: Math.min(1, Math.max(0, daysBetween(p.sowing_date!, todayISO()) / Math.max(1, daysBetween(p.sowing_date!, p.expected_harvest_date!)))) }))
    .sort((a, b) => b.pct - a.pct)

  const exp = {
    beds: () => downloadCSV('garden-beds.csv', beds.map((b) => ({ id: b.code, name: b.name, length_m: b.length_m, width_m: b.width_m, area_m2: area(b).toFixed(2), soil: b.soil_type, zone: b.zone ?? '', status: (occ.get(b.id) ?? []).length ? 'occupied' : 'available', crops: (occ.get(b.id) ?? []).map((p) => p.name).join('; ') }))),
    plants: () => downloadCSV('plants.csv', plants.map((p) => ({ name: p.name, category: p.category, bed: bedById(p.bed_id)?.code ?? '', quantity: p.quantity, status: STATUS_LABEL[p.status], sowing_date: p.sowing_date ?? '', expected_harvest: p.expected_harvest_date ?? '', notes: p.notes ?? '' }))),
    harvests: () => downloadCSV('harvests.csv', harvests.map((h) => ({ date: h.harvested_on, plant: h.plant_name, bed: bedById(h.bed_id)?.code ?? '', quantity: h.quantity, unit: h.unit, kg_equivalent: toKg(h)?.toFixed(2) ?? '', notes: h.notes ?? '' }))),
    tasks: () => downloadCSV('tasks.csv', tasks.map((t) => ({ due: t.due_date, title: t.title, type: t.type, bed: bedById(t.bed_id)?.code ?? '', done: t.done ? 'yes' : 'no' }))),
    summary: () => downloadCSV('garden-summary.csv', [
      { metric: 'Garden beds', value: beds.length }, { metric: 'Beds in use', value: [...occ.values()].filter((v) => v.length).length },
      { metric: 'Total bed area (m2)', value: beds.reduce((a, b) => a + area(b), 0).toFixed(2) }, { metric: 'Plant entries', value: plants.length },
      { metric: 'Individual plants', value: plants.reduce((a, p) => a + p.quantity, 0) }, { metric: 'Harvest records', value: harvests.length },
      { metric: 'Harvest weight (kg)', value: harvests.reduce((a, h) => a + (toKg(h) ?? 0), 0).toFixed(2) }, { metric: 'Open tasks', value: tasks.filter((t) => !t.done).length },
      ...harvestByPlant.map((h) => ({ metric: `Harvest kg: ${h.name}`, value: h.kg }))
    ])
  }

  if (loading && !plants.length) return <div className="grid gap-4"><Skeleton className="h-12 w-64" /><div className="grid gap-4 lg:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-80" />)}</div></div>

  return (
    <>
      <PageHeader title="Analytics & reports" sub="How the garden is used and what it produces. Download any dataset as CSV."
        actions={<Button onClick={exp.summary}><Download className="size-4" />Summary report</Button>} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <div className="glass mb-4 flex flex-wrap items-center gap-2 p-3 text-sm">
        <span className="mr-1 text-muted">Download CSV:</span>
        {(['beds', 'plants', 'harvests', 'tasks'] as const).map((k) => <Button key={k} variant="ghost" className="min-h-9 px-4" onClick={exp[k]}><Download className="size-3.5" />{k[0].toUpperCase() + k.slice(1)}</Button>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Plant distribution" icon={<BarChart3 className="size-4" />}>
          {byPlant.length ? <div className="h-72"><ResponsiveContainer><BarChart data={byPlant} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid stroke={CHART.grid} horizontal={false} /><XAxis type="number" tick={CHART.tick} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={CHART.tick} axisLine={false} tickLine={false} width={90} />
            <Tooltip {...CHART.tooltip} cursor={{ fill: 'rgba(255,255,255,.04)' }} formatter={(v) => [v, 'Plants']} />
            <Bar dataKey="n" fill="#eef53c" radius={[0, 8, 8, 0]} animationDuration={1000} />
          </BarChart></ResponsiveContainer></div> : <Empty />}
        </Card>

        <Card title="Plant category distribution" icon={<PieIcon className="size-4" />}>
          {byCategory.length ? <div className="h-72"><ResponsiveContainer><PieChart>
            <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="#050505" strokeWidth={3} animationDuration={1000}>
              {byCategory.map((c, i) => <Cell key={c.name} fill={CHART.palette[i % CHART.palette.length]} />)}
            </Pie>
            <Tooltip {...CHART.tooltip} formatter={(v, n) => [`${v} plant entries`, n]} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#a9a9a2' }} />
          </PieChart></ResponsiveContainer></div> : <Empty />}
        </Card>

        <Card title="Garden bed usage" icon={<Rows3 className="size-4" />}>
          {bedUsage.length ? <div className="h-72"><ResponsiveContainer><BarChart data={bedUsage} margin={{ left: -15, right: 10 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="name" tick={{ ...CHART.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="l" tick={CHART.tick} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis yAxisId="r" orientation="right" tick={CHART.tick} axisLine={false} tickLine={false} unit=" m²" />
            <Tooltip {...CHART.tooltip} cursor={{ fill: 'rgba(255,255,255,.04)' }} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="l" dataKey="plants" name="Plants in bed" fill="#eef53c" radius={[6, 6, 0, 0]} animationDuration={1000} />
            <Bar yAxisId="r" dataKey="area" name="Bed area" fill="#9a9a94" fillOpacity={0.5} radius={[6, 6, 0, 0]} animationDuration={1000} />
          </BarChart></ResponsiveContainer></div> : <Empty />}
        </Card>

        <Card title="Harvest quantity by crop" icon={<ShoppingBasket className="size-4" />}>
          {harvestByPlant.length ? <div className="h-72"><ResponsiveContainer><BarChart data={harvestByPlant} margin={{ left: -10, right: 10 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="name" tick={{ ...CHART.tick, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
            <YAxis tick={CHART.tick} axisLine={false} tickLine={false} unit=" kg" width={60} />
            <Tooltip {...CHART.tooltip} cursor={{ fill: 'rgba(255,255,255,.04)' }} formatter={(v) => [`${v} kg`, 'Harvested']} />
            <Bar dataKey="kg" radius={[8, 8, 2, 2]} animationDuration={1000}>{harvestByPlant.map((h, i) => <Cell key={h.name} fill={CHART.palette[i % CHART.palette.length]} />)}</Bar>
          </BarChart></ResponsiveContainer></div> : <Empty />}
          <p className="mt-2 text-xs text-dim">Weight-based harvests only (kg, g, lb converted to kg). Pieces and bunches are listed in Harvest Records.</p>
        </Card>

        <Card title="Monthly planting trends" icon={<TrendingUp className="size-4" />} className="lg:col-span-2">
          <div className="h-72"><ResponsiveContainer><LineChart data={trends} margin={{ left: -15, right: 10, top: 10 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="month" tick={CHART.tick} axisLine={false} tickLine={false} />
            <YAxis tick={CHART.tick} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip {...CHART.tooltip} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="sowings" name="Sowings" stroke="#f4f4ef" strokeWidth={2.5} dot={{ r: 4 }} animationDuration={1200} />
            <Line type="monotone" dataKey="harvests" name="Harvest records" stroke="#eef53c" strokeWidth={2.5} dot={{ r: 4 }} animationDuration={1200} />
          </LineChart></ResponsiveContainer></div>
        </Card>

        <Card title="Growth tracking" icon={<Sprout className="size-4" />} className="lg:col-span-2">
          {growing.length ? (
            <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
              {growing.map(({ p, pct }) => (
                <li key={p.id} className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-semibold">{p.name} <span className="text-xs font-normal text-dim">{bedById(p.bed_id)?.code ?? 'unassigned'}</span></span>
                    <StatusBadge status={p.status} />
                  </div>
                  <Progress value={Math.max(pct, STATUS_PROGRESS[p.status] * 0.0)} />
                  <p className="text-xs text-dim">{num(pct * 100)}% of the way from sowing ({fmtDate(p.sowing_date, { day: 'numeric', month: 'short' })}) to expected harvest ({fmtDate(p.expected_harvest_date, { day: 'numeric', month: 'short' })})</p>
                </li>))}
            </ul>
          ) : <Empty />}
        </Card>
      </div>
    </>
  )
}

// ======================================================================
// pages/Beds.tsx
// ======================================================================
export function Beds() {
  const { beds, plants, loading, error, reload, remove, assignPlants, gardenId } = useData()
  const toast = useToast()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '');
  const fts = useFullTextIds(q, 'bed', 250, gardenId); const [soil, setSoil] = useState(''); const [state, setState] = useState('')
  const [form, setForm] = useState<{ open: boolean; bed: Bed | null }>({ open: false, bed: null })
  const [del, setDel] = useState<Bed | null>(null); const [busy, setBusy] = useState(false)
  const [assign, setAssign] = useState<Bed | null>(null); const [picked, setPicked] = useState<string[]>([])
  const occ = useMemo(() => occupancy(beds, plants), [beds, plants])

  const list = beds.filter((b) => {
    const used = (occ.get(b.id) ?? []).length > 0
    return keep(b.id, `${b.code} ${b.name} ${b.soil_type} ${b.zone ?? ''} ${b.notes ?? ''}`, q, fts.ids)
      && (!soil || b.soil_type === soil) && (!state || (state === 'occupied') === used)
  })

  const doDelete = async () => {
    if (!del) return; setBusy(true)
    try { await remove('garden_beds', del.id); toast(`Bed ${del.code} deleted`); setDel(null) } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }
  const unassigned = plants.filter((p) => !p.bed_id && p.status !== 'harvested')
  const doAssign = async () => {
    if (!assign || !picked.length) return; setBusy(true)
    try { await assignPlants(assign.id, picked); toast(`${picked.length} plant${picked.length > 1 ? 's' : ''} assigned to ${assign.code}`); setAssign(null); setPicked([]) }
    catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader title="Garden beds" sub="Each bed gets a unique ID. Record its size and soil, and assign plants to it." actions={<Button write onClick={() => setForm({ open: true, bed: null })}><Plus className="size-4" />Add bed</Button>} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <div className="glass mb-4 flex flex-wrap items-center gap-3 p-3">
        <label className="relative min-w-52 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" /><input className="input pl-9" placeholder="Search by ID, name or zone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search beds" />{fts.active && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-lime-300/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-300" title="Ranked Postgres full-text search">Full-text</span>}</label>
        <select className="input w-auto" value={soil} onChange={(e) => setSoil(e.target.value)} aria-label="Filter by soil"><option value="">All soils</option>{SOIL_TYPES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="input w-auto" value={state} onChange={(e) => setState(e.target.value)} aria-label="Filter by status"><option value="">Occupied & available</option><option value="occupied">Occupied</option><option value="available">Available</option></select>
      </div>

      {loading && !beds.length ? <LoadingRows /> : !beds.length ? (
        <EmptyState icon={<Rows3 className="size-7" />} title="No garden beds yet" body="Add your first bed to start planning." action={<Button write onClick={() => setForm({ open: true, bed: null })}><Plus className="size-4" />Add bed</Button>} />
      ) : !list.length ? <EmptyState title="No beds match" body="Try a different search or filter." /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((b) => {
            const inBed = occ.get(b.id) ?? []
            return (
              <article key={b.id} className="glass fade-up flex flex-col p-5 transition hover:-translate-y-1 hover:border-line2">
                <div className="flex items-start justify-between gap-2">
                  <div><p className="font-mono text-sm text-lime-300">{b.code}</p><h2 className="text-lg font-bold">{b.name}</h2></div>
                  <Badge tone={inBed.length ? 'lime' : 'cyan'}>{inBed.length ? 'Occupied' : 'Available'}</Badge>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-xl bg-white/5 p-2.5"><dt className="text-xs text-dim">Size</dt><dd className="font-mono">{Number(b.length_m)}×{Number(b.width_m)} m</dd></div>
                  <div className="rounded-xl bg-white/5 p-2.5"><dt className="text-xs text-dim">Area</dt><dd className="font-mono">{area(b).toFixed(1)} m²</dd></div>
                  <div className="rounded-xl bg-white/5 p-2.5"><dt className="text-xs text-dim">Soil</dt><dd>{b.soil_type}</dd></div>
                </dl>
                <div className="mt-4 flex min-h-8 flex-wrap gap-1.5">
                  {inBed.length ? inBed.map((p) => <span key={p.id} className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-xs">{p.name}<StatusBadge status={p.status} /></span>) : <span className="text-sm text-dim">No plants assigned</span>}
                </div>
                {b.zone && <p className="mt-3 text-xs text-dim">{b.zone}{b.notes ? ` · ${b.notes}` : ''}</p>}
                <div className="mt-auto flex items-center gap-1 pt-4">
                  <Button write variant="ghost" className="min-h-10 flex-1" onClick={() => { setAssign(b); setPicked([]) }}><Link2 className="size-4" />Assign plants</Button>
                  <IconButton label={`Edit ${b.code}`} onClick={() => setForm({ open: true, bed: b })}><Pencil className="size-4" /></IconButton>
                  <IconButton label={`Delete ${b.code}`} onClick={() => setDel(b)} className="hover:text-red-300"><Trash2 className="size-4" /></IconButton>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <BedForm open={form.open} bed={form.bed} onClose={() => setForm({ open: false, bed: null })} />
      <ConfirmDialog open={!!del} title={`Delete bed ${del?.code}?`} busy={busy} onClose={() => setDel(null)} onConfirm={doDelete}
        body={<>This removes “{del?.name}”. {(occ.get(del?.id ?? '') ?? []).length ? `Its ${(occ.get(del?.id ?? '') ?? []).length} plant(s) stay in your list but become unassigned.` : 'No plants are assigned to it.'}</>} />
      <Modal open={!!assign} title={`Assign plants to ${assign?.code}`} onClose={() => setAssign(null)}>
        {unassigned.length ? (
          <>
            <p className="mb-3 text-sm text-muted">Plants without a bed:</p>
            <ul className="grid max-h-72 gap-1.5 overflow-y-auto scrollbar-thin">
              {unassigned.map((p) => (
                <li key={p.id}><label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 hover:bg-white/5">
                  <input type="checkbox" className="size-4 accent-lime-400" checked={picked.includes(p.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, p.id] : picked.filter((x) => x !== p.id))} />
                  <span className="flex-1">{p.name} <span className="text-xs text-dim">×{p.quantity} · {p.category}</span></span><StatusBadge status={p.status} />
                </label></li>
              ))}
            </ul>
            <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setAssign(null)}>Cancel</Button><Button onClick={doAssign} loading={busy} disabled={!picked.length}>Assign {picked.length || ''}</Button></div>
          </>
        ) : <EmptyState title="Every plant already has a bed" body="Add a new plant, or move one from the Plants page by editing its bed." />}
      </Modal>
    </>
  )
}

// ======================================================================
// pages/Calendar.tsx
// ======================================================================
type Ev = { date: string; kind: 'sow' | 'harvest-due' | 'task' | 'harvested'; label: string; task?: Task }
const DOT = { sow: 'bg-cyan-300', 'harvest-due': 'bg-lime-300', task: 'bg-amber-300', harvested: 'bg-emerald-400' }
const KIND_LABEL = { sow: 'Sowing', 'harvest-due': 'Harvest due', task: 'Task', harvested: 'Harvested' }

export function CalendarPage() {
  const { plants, tasks, harvests, error, reload, update, remove, createMany, bedById } = useData()
  const toast = useToast()
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [day, setDay] = useState(todayISO())
  const [form, setForm] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null })
  const [del, setDel] = useState<Task | null>(null)
  const [sched, setSched] = useState(false); const [schedPlant, setSchedPlant] = useState(''); const [busy, setBusy] = useState(false)

  const events = useMemo(() => {
    const m = new Map<string, Ev[]>()
    const push = (e: Ev) => { if (!m.has(e.date)) m.set(e.date, []); m.get(e.date)!.push(e) }
    plants.forEach((p) => {
      if (p.sowing_date) push({ date: p.sowing_date, kind: 'sow', label: `Sow ${p.name}` })
      if (p.expected_harvest_date && p.status !== 'harvested') push({ date: p.expected_harvest_date, kind: 'harvest-due', label: `${p.name} ready` })
    })
    tasks.forEach((t) => push({ date: t.due_date, kind: 'task', label: t.title, task: t }))
    harvests.forEach((h) => push({ date: h.harvested_on, kind: 'harvested', label: `Picked ${h.plant_name}` }))
    return m
  }, [plants, tasks, harvests])

  // 6-week grid starting on Monday
  const cells = useMemo(() => {
    const first = new Date(cursor); const offset = (first.getDay() + 6) % 7
    const start = new Date(first); start.setDate(1 - offset)
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return toISO(d) })
  }, [cursor])
  const month = cursor.getMonth(), today = todayISO()

  const overdue = tasks.filter((t) => !t.done && t.due_date < today)
  const soon = tasks.filter((t) => !t.done && t.due_date >= today && t.due_date <= addDays(today, 7))
  const timeline = plants.filter((p) => p.sowing_date && p.expected_harvest_date && p.status !== 'harvested').sort((a, b) => a.sowing_date!.localeCompare(b.sowing_date!))
  const tlStart = timeline.length ? timeline.reduce((a, p) => (p.sowing_date! < a ? p.sowing_date! : a), timeline[0].sowing_date!) : today
  const tlEnd = timeline.length ? timeline.reduce((a, p) => (p.expected_harvest_date! > a ? p.expected_harvest_date! : a), today) : today
  const span = Math.max(1, daysBetween(tlStart, tlEnd))

  const toggle = async (t: Task) => { try { await update('garden_tasks', t.id, { done: !t.done }); toast(t.done ? 'Task reopened' : 'Task done') } catch (e) { toast((e as Error).message, 'error') } }
  const doDelete = async () => { if (!del) return; try { await remove('garden_tasks', del.id); toast('Task deleted'); setDel(null) } catch (e) { toast((e as Error).message, 'error') } }

  // Builds a simple care schedule for one plant: weekly watering, feeding at a third, and harvest.
  const makeSchedule = async () => {
    const p = plants.find((x) => x.id === schedPlant); if (!p) return
    const start = p.sowing_date && p.sowing_date > today ? p.sowing_date : today
    const end = p.expected_harvest_date ?? addDays(start, 60)
    const items: Partial<Task>[] = []
    for (let d = addDays(start, 7); d < end && items.length < 10; d = addDays(d, 7)) items.push({ title: `Water ${p.name}`, type: 'water', due_date: d })
    items.push({ title: `Feed ${p.name}`, type: 'fertilize', due_date: addDays(start, Math.max(7, Math.round(daysBetween(start, end) / 3))) })
    items.push({ title: `Harvest ${p.name}`, type: 'harvest', due_date: end })
    setBusy(true)
    try { await createMany('garden_tasks', items.map((it) => ({ ...it, bed_id: p.bed_id, plant_id: p.id }))); toast(`${items.length} tasks scheduled for ${p.name}`); setSched(false) }
    catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }

  const dayEvents = events.get(day) ?? []
  return (
    <>
      <PageHeader title="Sowing calendar" sub="Sowing dates, expected harvests, tasks and reminders in one place."
        actions={<><Button write variant="ghost" onClick={() => setSched(true)}><Wand2 className="size-4" />Create care schedule</Button><Button write onClick={() => setForm({ open: true, task: null })}><Plus className="size-4" />Add task</Button></>} />
      {error && <ErrorBanner message={error} onRetry={reload} />}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold">{cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2>
            <div className="flex items-center gap-1">
              <IconButton label="Previous month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft className="size-5" /></IconButton>
              <Button variant="subtle" className="min-h-10 px-3" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setDay(todayISO()) }}>Today</Button>
              <IconButton label="Next month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight className="size-5" /></IconButton>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-dim">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c) => {
              const ev = events.get(c) ?? [], inMonth = parseISO(c).getMonth() === month
              return (
                <button key={c} onClick={() => setDay(c)} aria-label={`${fmtDate(c)}: ${ev.length} events`}
                  className={`relative flex min-h-16 flex-col items-start rounded-xl border p-1.5 text-left transition sm:min-h-20 ${c === day ? 'border-lime-300/70 bg-lime-300/10' : 'border-transparent hover:bg-white/5'} ${inMonth ? '' : 'opacity-40'}`}>
                  <span className={`grid size-6 place-items-center rounded-full font-mono text-xs ${c === today ? 'bg-lime-300 font-bold text-emerald-950' : ''}`}>{parseISO(c).getDate()}</span>
                  <span className="mt-auto flex flex-wrap gap-0.5">{ev.slice(0, 6).map((e, i) => <i key={i} className={`size-1.5 rounded-full ${DOT[e.kind]}`} />)}</span>
                  {ev[0] && <span className="mt-0.5 hidden w-full truncate text-[10px] text-muted lg:block">{ev[0].label}</span>}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">{(Object.keys(DOT) as (keyof typeof DOT)[]).map((k) => <span key={k} className="flex items-center gap-1.5"><i className={`size-2 rounded-full ${DOT[k]}`} />{KIND_LABEL[k]}</span>)}</div>
        </Card>

        <div className="grid content-start gap-4">
          <Card title={fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long' })} action={<Button write variant="subtle" className="min-h-9 px-3" onClick={() => setForm({ open: true, task: null })}><Plus className="size-4" /></Button>}>
            {dayEvents.length ? (
              <ul className="grid gap-2">{dayEvents.map((e, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm">
                  {e.task ? <button onClick={() => toggle(e.task!)} aria-label="Toggle done">{e.task.done ? <CheckCircle2 className="size-4 text-lime-300" /> : <Circle className="size-4 text-dim" />}</button> : <i className={`size-2 rounded-full ${DOT[e.kind]}`} />}
                  <span className={`flex-1 ${e.task?.done ? 'text-dim line-through' : ''}`}>{e.label}</span>
                  {e.task && <><IconButton label="Edit task" className="size-8" onClick={() => setForm({ open: true, task: e.task! })}><Pencil className="size-3.5" /></IconButton><IconButton label="Delete task" className="size-8 hover:text-red-300" onClick={() => setDel(e.task!)}><Trash2 className="size-3.5" /></IconButton></>}
                </li>))}</ul>
            ) : <p className="text-sm text-muted">Nothing on this day.</p>}
          </Card>
          <Card title="Reminders" icon={<Bell className="size-4" />}>
            {overdue.length + soon.length === 0 ? <p className="text-sm text-muted">No tasks due this week.</p> : (
              <ul className="grid gap-1.5">
                {[...overdue, ...soon].map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <button onClick={() => toggle(t)} aria-label={`Mark “${t.title}” done`}><Circle className="size-4 text-dim hover:text-lime-300" /></button>
                    <span className="flex-1 truncate">{t.title}</span>
                    <Badge tone={t.due_date < today ? 'red' : TASK_TONE[t.type]}>{t.due_date < today ? `Overdue · ${relDay(t.due_date)}` : relDay(t.due_date)}</Badge>
                  </li>))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-4" title="Growth timelines" icon={<GanttChart className="size-4" />}>
        {timeline.length ? (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="relative ml-[9.75rem] mr-0 h-6 text-[11px] text-dim sm:mr-[8.75rem]">
                <span className="absolute left-0">{fmtDate(tlStart, { day: 'numeric', month: 'short' })}</span>
                <span className="absolute right-0">{fmtDate(tlEnd, { day: 'numeric', month: 'short' })}</span>
              </div>
              <ul className="relative grid gap-2">
                {timeline.map((p) => {
                  const l = daysBetween(tlStart, p.sowing_date!) / span, w = Math.max(0.02, daysBetween(p.sowing_date!, p.expected_harvest_date!) / span)
                  const done = Math.min(1, Math.max(0, daysBetween(p.sowing_date!, today) / Math.max(1, daysBetween(p.sowing_date!, p.expected_harvest_date!))))
                  return (
                    <li key={p.id} className="flex items-center gap-3 text-sm">
                      <span className="w-36 shrink-0 truncate">{p.name} <span className="text-xs text-dim">{bedById(p.bed_id)?.code ?? ''}</span></span>
                      <div className="relative h-7 flex-1 rounded-lg bg-white/5">
                        <div className="absolute inset-y-1 overflow-hidden rounded-md bg-emerald-400/20 ring-1 ring-emerald-300/30" style={{ left: `${l * 100}%`, width: `${w * 100}%` }} title={`${fmtDate(p.sowing_date)} → ${fmtDate(p.expected_harvest_date)}`}>
                          <div className="h-full bg-gradient-to-r from-emerald-400/70 to-lime-300/70" style={{ width: `${done * 100}%` }} />
                        </div>
                        <i className="absolute inset-y-0 w-0.5 bg-lime-300" style={{ left: `${Math.min(1, Math.max(0, daysBetween(tlStart, today) / span)) * 100}%` }} title="Today" />
                      </div>
                      <span className="hidden w-32 shrink-0 sm:block"><StatusBadge status={p.status} /></span>
                    </li>)
                })}
              </ul>
            </div>
          </div>
        ) : <EmptyState title="No timelines yet" body="Plants with a sowing date and an estimated harvest date appear here." />}
      </Card>

      <TaskForm open={form.open} task={form.task} date={day} onClose={() => setForm({ open: false, task: null })} />
      <ConfirmDialog open={!!del} title="Delete this task?" body={del?.title} onClose={() => setDel(null)} onConfirm={doDelete} />
      <Modal open={sched} title="Create a care schedule" onClose={() => setSched(false)}>
        <p className="mb-4 text-sm text-muted">Adds weekly watering reminders, a feeding reminder about a third of the way through, and a harvest task on the expected date.</p>
        <Field label="Plant"><select className="input" value={schedPlant} onChange={(e) => setSchedPlant(e.target.value)}><option value="">Choose a plant…</option>{plants.filter((p) => p.status !== 'harvested').map((p) => <option key={p.id} value={p.id}>{p.name}{p.expected_harvest_date ? ` · harvest ${fmtDate(p.expected_harvest_date)}` : ''}</option>)}</select></Field>
        <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setSched(false)}>Cancel</Button><Button onClick={makeSchedule} loading={busy} disabled={!schedPlant}>Create tasks</Button></div>
      </Modal>
    </>
  )
}

// ======================================================================
// pages/Chat.tsx
// ======================================================================
const STORE = 'cgp-chat-v1'
const SUGGEST = [
  'What should I plant this month?', 'How often should I water tomatoes in hot weather?', 'Plan a crop rotation for my beds',
  'How do I improve clay soil?', 'When will my plants be ready to harvest?', 'Which plants grow well together?'
]

/** Minimal, safe markdown: bold, bullet and numbered lists, paragraphs. */
function Md({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/)
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>)
  return <div className="prose-chat">{blocks.map((b, i) => {
    const lines = b.split('\n')
    if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) return <ul key={i} className="list-disc">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ''))}</li>)}</ul>
    if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) return <ol key={i} className="list-decimal">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>)}</ol>
    return <p key={i}>{lines.map((l, j) => <span key={j}>{inline(l.replace(/^#+\s*/, ''))}{j < lines.length - 1 && <br />}</span>)}</p>
  })}</div>
}

export function Chat() {
  const { beds, plants, tasks, create } = useData()
  const [msgs, setMsgs] = useState<ChatMsg[]>(() => { try { return JSON.parse(localStorage.getItem(STORE) || '[]') } catch { return [] } })
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(msgs.slice(-60))) } catch { /* storage may be unavailable */ } end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, busy])

  // a compact snapshot of the garden so answers can refer to real beds and plants
  const context = useMemo(() => ({
    today: new Date().toISOString().slice(0, 10),
    beds: beds.map((b) => ({ code: b.code, name: b.name, soil: b.soil_type, size_m: `${b.length_m}x${b.width_m}` })),
    plants: plants.filter((p) => ACTIVE_STATUSES.includes(p.status) || p.status === 'planned').map((p) => ({ name: p.name, bed: beds.find((b) => b.id === p.bed_id)?.code ?? null, status: p.status, sown: p.sowing_date, harvest: p.expected_harvest_date })),
    open_tasks: tasks.filter((t) => !t.done).slice(0, 15).map((t) => ({ title: t.title, due: t.due_date }))
  }), [beds, plants, tasks])

  const send = async (q: string) => {
    const content = q.trim(); if (!content || busy) return
    const next: ChatMsg[] = [...msgs, { role: 'user', content, at: new Date().toISOString() }]
    setMsgs(next); setText(''); setBusy(true); setErr('')
    try {
      const r = await chat(next, context)
      setMsgs((m) => [...m, { role: 'assistant', content: r.reply, demo: r.demo, at: new Date().toISOString() }])
      create('garden_ai_history', { kind: 'chat', input: { question: content }, output: { reply: r.reply }, demo: r.demo }).catch(() => {})
    } catch (e) { setErr((e as Error).message || 'The assistant could not answer. Try again.') } finally { setBusy(false) }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); send(text) }
  const anyDemo = msgs.some((m) => m.demo)

  return (
    <div className="flex h-[calc(100svh-8rem)] min-h-[520px] flex-col">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-extrabold sm:text-4xl">Garden AI Assistant</h1><p className="mt-1 text-muted">Ask about planting, watering, soil, rotation or harvests. It knows your beds and plants.</p></div>
        {msgs.length > 0 && <Button variant="ghost" onClick={() => { setMsgs([]); setErr('') }}><Plus className="size-4" />New chat</Button>}
      </div>
      {anyDemo && <DemoBanner>Replies marked “demo” are canned tips, not AI. Add a Gemini API key in Settings for real answers.</DemoBanner>}

      <div className="glass flex min-h-0 flex-1 flex-col p-0">
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6" aria-live="polite">
          {!msgs.length ? (
            <div className="relative -m-4 flex h-[calc(100%+2rem)] min-h-[420px] flex-col justify-end overflow-hidden rounded-t-[1.25rem] bg-black p-6 sm:-m-6 sm:h-[calc(100%+3rem)] sm:p-10">
              <TemplateScene kind="plexus" className="absolute inset-0 sm:left-[35%]" />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,#000_25%,transparent_75%)]" />
              <p className="relative font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">Garden AI <span className="text-[#eef53c]">/&gt;</span> {beds.length} beds · {plants.length} plants · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              <h2 className="relative mt-3 max-w-2xl font-display text-[clamp(1.9rem,4vw,3.2rem)] font-light leading-[1.1]">Your garden's own AI helper for planting, watering and harvests</h2>
              <p className="relative mt-3 max-w-xl text-white/60">It reads your real beds, plants and open tasks, so answers are about this garden, not a generic one.</p>
              <div className="relative mt-6 flex flex-wrap gap-2">
                {SUGGEST.map((s, i) => <button key={s} onClick={() => send(s)} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${i === 0 ? 'bg-white font-semibold text-black hover:bg-[#eef53c]' : 'border border-white/20 text-white/75 hover:border-[#eef53c] hover:text-white'}`}>{s}{i === 0 && <Plus className="size-4" />}</button>)}
              </div>
            </div>
          ) : (
            <ul className="grid gap-4">
              {msgs.map((m, i) => (
                <li key={i} className={`fade-up flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${m.role === 'user' ? 'bg-white/10 text-ink' : 'bg-gradient-to-br from-emerald-400 to-lime-300 text-emerald-950'}`}>{m.role === 'user' ? <User className="size-4" /> : <Bot className="size-4" />}</span>
                  <div className={`max-w-[78ch] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${m.role === 'user' ? 'rounded-tr-sm bg-gradient-to-br from-emerald-500/30 to-lime-500/15 border border-emerald-300/20' : 'rounded-tl-sm border border-line bg-black/20'}`}>
                    {m.role === 'assistant' ? <Md text={m.content} /> : m.content}
                    {m.demo && <span className="mt-2 inline-block rounded bg-amber-400/20 px-1.5 text-[11px] font-bold uppercase text-amber-200">demo</span>}
                  </div>
                </li>
              ))}
              {busy && <li className="flex gap-3"><span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-lime-300 text-emerald-950"><Bot className="size-4" /></span><div className="typing flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-line bg-black/20 px-4 py-4" aria-label="Assistant is typing"><span /><span /><span /></div></li>}
              {err && <li role="alert" className="rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-100">{err} <button className="ml-2 underline" onClick={() => { const last = [...msgs].reverse().find((m) => m.role === 'user'); if (last) { setMsgs((x) => x.slice(0, -1)); send(last.content) } }}>Retry</button></li>}
              <div ref={end} />
            </ul>
          )}
        </div>
        {msgs.length > 0 && !busy && (
          <div className="flex gap-2 overflow-x-auto scrollbar-thin border-t border-line px-4 py-2">
            {SUGGEST.slice(0, 4).map((s) => <button key={s} onClick={() => send(s)} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-ink">{s}</button>)}
          </div>
        )}
        <form onSubmit={submit} className="flex items-end gap-2 border-t border-line p-3">
          <label className="sr-only" htmlFor="chat-in">Message</label>
          <textarea id="chat-in" value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={2000}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text) } }}
            placeholder="Ask anything about your garden…" className="input max-h-40 min-h-12 flex-1 resize-none" />
          <Button aria-label="Send" disabled={!text.trim() || busy} className="size-12 px-0"><Send className="size-4" /></Button>
        </form>
      </div>
    </div>
  )
}

// ======================================================================
// pages/Dashboard.tsx
// ======================================================================
export function Dashboard() {
  const d = useData()
  const toast = useToast()
  const { beds, plants, harvests, tasks, sowing, loading, error } = d

  const occ = useMemo(() => occupancy(beds, plants), [beds, plants])
  const active = plants.filter((p) => ACTIVE_STATUSES.includes(p.status))
  const kgTotal = harvests.reduce((a, h) => a + (toKg(h) ?? 0), 0)
  const usedBeds = [...occ.values()].filter((v) => v.length).length

  const monthly = useMemo(() => {
    const keys = lastMonths(6)
    return keys.map((k) => ({
      month: monthLabel(k),
      kg: +harvests.filter((h) => monthKey(h.harvested_on) === k).reduce((a, h) => a + (toKg(h) ?? 0), 0).toFixed(1),
      count: harvests.filter((h) => monthKey(h.harvested_on) === k && toKg(h) === null).reduce((a, h) => a + Number(h.quantity), 0)
    }))
  }, [harvests])

  const growth = STATUSES.map((s, i) => ({ status: STATUS_LABEL[s], n: plants.filter((p) => p.status === s).length, fill: CHART.palette[i % CHART.palette.length] }))

  const upcoming = tasks.filter((t) => !t.done && t.due_date <= addDays(todayISO(), 14)).slice(0, 6)

  // a merged, newest-first activity feed across tables
  const activity = useMemo(() => {
    const plantName = (id: string | null) => plants.find((p) => p.id === id)?.name ?? 'a plant'
    const items = [
      ...harvests.map((h) => ({ at: h.created_at, text: `Harvested ${num(Number(h.quantity), 1)} ${h.unit} of ${h.plant_name}`, tone: 'lime' as const })),
      ...sowing.map((s) => ({ at: s.created_at, text: `Sowed ${plantName(s.plant_id)} on ${fmtDate(s.sown_on, { day: 'numeric', month: 'short' })}`, tone: 'cyan' as const })),
      ...beds.map((b) => ({ at: b.created_at, text: `Bed ${b.code} “${b.name}” added`, tone: 'emerald' as const })),
      ...tasks.filter((t) => t.done).map((t) => ({ at: t.created_at, text: `Task done: ${t.title}`, tone: 'violet' as const }))
    ]
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8)
  }, [harvests, sowing, beds, tasks, plants])

  const toggleTask = async (id: string, done: boolean) => {
    try { await d.update('garden_tasks', id, { done }); toast(done ? 'Task completed' : 'Task reopened') } catch (e) { toast((e as Error).message, 'error') }
  }

  if (loading && !beds.length) return <div className="grid gap-4"><Skeleton className="h-12 w-72" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div><Skeleton className="h-80" /></div>

  return (
    <>
      <PageHeader title="Garden overview" sub="What’s growing, what’s due and how the harvest is going." actions={<Link to="/plants"><Button>Add a plant</Button></Link>} />
      {error && <ErrorBanner message={error} onRetry={d.reload} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total garden beds" value={beds.length} sub={`${usedBeds} in use · ${beds.length - usedBeds} available`} icon={<Rows3 className="size-5" />} />
        <StatCard label="Total plants" value={plants.length} sub={`${plants.reduce((a, p) => a + p.quantity, 0)} individual plants`} icon={<Sprout className="size-5" />} tone="lime" />
        <StatCard label="Active growing" value={active.length} sub={`${plants.filter((p) => p.status === 'ready').length} ready to harvest`} icon={<Leaf className="size-5" />} tone="cyan" />
        <StatCard label="Harvest records" value={harvests.length} sub={`${num(kgTotal, 1)} kg by weight`} icon={<ShoppingBasket className="size-5" />} tone="amber" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Monthly harvest" icon={<BarChart3 className="size-4" />} action={<Link to="/analytics" className="text-sm font-semibold text-lime-300 hover:underline">Analytics</Link>}>
          {harvests.length ? (
            <div className="h-72">
              <ResponsiveContainer>
                <AreaChart data={monthly} margin={{ left: -10, right: 10, top: 10 }}>
                  <defs><linearGradient id="hv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eef53c" stopOpacity={0.45} /><stop offset="100%" stopColor="#eef53c" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="month" tick={CHART.tick} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART.tick} axisLine={false} tickLine={false} unit=" kg" width={64} />
                  <Tooltip {...CHART.tooltip} formatter={(v) => [`${v} kg`, 'Harvested']} />
                  <Area type="monotone" dataKey="kg" stroke="#eef53c" strokeWidth={2.5} fill="url(#hv)" animationDuration={1200} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="No harvests yet" body="Log your first harvest to start the chart." action={<Link to="/harvests"><Button>Record a harvest</Button></Link>} />}
        </Card>

        <Card title="Upcoming tasks" icon={<CalendarDays className="size-4" />} action={<Link to="/calendar" className="text-sm font-semibold text-lime-300 hover:underline">Calendar</Link>}>
          {upcoming.length ? (
            <ul className="grid gap-1.5">
              {upcoming.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">
                  <button onClick={() => toggleTask(t.id, !t.done)} aria-label={`Mark “${t.title}” done`} className="text-dim hover:text-lime-300">{t.done ? <CheckCircle2 className="size-5 text-lime-300" /> : <Circle className="size-5" />}</button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className={`text-xs ${t.due_date < todayISO() ? 'text-red-300' : 'text-dim'}`}>{relDay(t.due_date)}{t.bed_id ? ` · ${d.bedById(t.bed_id)?.code ?? ''}` : ''}</p>
                  </div>
                  <Badge tone={TASK_TONE[t.type]}>{TASK_LABEL[t.type]}</Badge>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="All caught up" body="No tasks in the next two weeks." />}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Plant growth statistics" icon={<Sprout className="size-4" />}>
          {plants.length ? (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={growth} margin={{ left: -20, right: 10, top: 10 }}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="status" tick={{ ...CHART.tick, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis allowDecimals={false} tick={CHART.tick} axisLine={false} tickLine={false} />
                  <Tooltip {...CHART.tooltip} cursor={{ fill: 'rgba(255,255,255,.04)' }} formatter={(v) => [v, 'Plants']} />
                  <Bar dataKey="n" radius={[8, 8, 2, 2]} animationDuration={1000}>{growth.map((g) => <Cell key={g.status} fill={g.fill} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="No plants yet" action={<Link to="/plants"><Button>Add a plant</Button></Link>} />}
        </Card>

        <Card title="Garden activity" icon={<Activity className="size-4" />}>
          {activity.length ? (
            <ol className="relative grid gap-3 border-l border-line pl-4">
              {activity.map((a, i) => (
                <li key={i} className="relative">
                  <span className={`absolute -left-[21px] top-1.5 size-2.5 rounded-full ${a.tone === 'lime' ? 'bg-lime-300' : a.tone === 'cyan' ? 'bg-cyan-300' : a.tone === 'violet' ? 'bg-violet-300' : 'bg-emerald-300'}`} />
                  <p className="text-sm">{a.text}</p>
                  <p className="text-xs text-dim">{timeAgo(a.at)}</p>
                </li>
              ))}
            </ol>
          ) : <EmptyState title="Nothing yet" body="Activity appears here as the garden is used." />}
        </Card>
      </div>

      <Link to="/garden" className="glass mt-4 flex items-center justify-between gap-4 p-5 transition hover:border-line2">
        <div><p className="font-display text-lg font-bold">See it in 3D</p><p className="text-sm text-muted">Rotate the garden, click a bed and see what’s growing.</p></div>
        <ArrowRight className="size-5 text-lime-300" />
      </Link>
    </>
  )
}

// ======================================================================
// three/GardenScene.tsx
// ======================================================================
/* =====================================================================
   3D community garden: a night-time diorama on a black plinth.
   Beds come from the database; each bed shows its plants (shape by crop,
   size by growth status). Around them: swaying grass, gravel walks, a
   greenhouse, a pond, lamp posts, string lights and fireflies, with a
   bloom pass so every light glows. Click a bed to select it.
   ===================================================================== */

export interface BedLayout { bed: Bed; x: number; z: number; L: number; W: number; plants: Plant[] }

export function layoutBeds(beds: Bed[], plants: Plant[]): BedLayout[] {
  const cols = Math.max(1, Math.ceil(Math.sqrt(beds.length * 1.4)))
  const cellX = 3.6, cellZ = 2.5
  const rows = Math.ceil(beds.length / cols)
  return beds.map((bed, i) => {
    const c = i % cols, r = Math.floor(i / cols)
    return {
      bed,
      x: (c - (cols - 1) / 2) * cellX,
      z: (r - (rows - 1) / 2) * cellZ,
      L: Math.min(3.0, Math.max(1.1, Number(bed.length_m))),
      W: Math.min(1.6, Math.max(0.7, Number(bed.width_m))),
      plants: plants.filter((p) => p.bed_id === bed.id && p.status !== 'harvested')
    }
  })
}

/* ---------------------------- materials & textures ---------------------------- */
const GLOW = (c: [number, number, number]) => new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), toneMapped: false })
const BULB = GLOW([4, 3.3, 1.1])
const YELLOW_GLOW = GLOW([3.2, 3.4, 0.4])
const WHITE_GLOW = GLOW([1.6, 1.6, 1.6])
const BLACK_METAL = new THREE.MeshStandardMaterial({ color: '#0c0c0c', metalness: 0.8, roughness: 0.35 })
const PLINTH = new THREE.MeshPhysicalMaterial({ color: '#070707', metalness: 0.4, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 })
const BRASS = new THREE.MeshStandardMaterial({ color: '#d8c64a', metalness: 1, roughness: 0.3 })
const BED_SOIL = mat('#2f1d10', 1)
const RIDGE = mat('#3d2613', 0.95)
const PLANK = [mat('#6b4426', 0.85), mat('#5a381f', 0.85), mat('#734a29', 0.8)]
const POND_WATER = new THREE.MeshPhysicalMaterial({ color: '#03080c', metalness: 0.6, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0 })
const STONE = mat('#55534e', 0.95)
const GLASS = new THREE.MeshPhysicalMaterial({ color: '#cfe3ff', transparent: true, opacity: 0.14, roughness: 0.02, metalness: 0.1, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false })

/** Speckled ground textures drawn once on a canvas (gravel and grass). */
function speckle(base: string, dots: string[], n: number) {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!; g.fillStyle = base; g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < n; i++) { g.fillStyle = dots[i % dots.length]; const r = Math.random() * 1.8 + 0.4; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2); g.fill() }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  return t
}

/* ---------------------------- grass (instanced, wind in the shader) ---------------------------- */
function Grass({ count, pick }: { count: number; pick: (x: number, z: number) => [number, number] | null }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const shaderRef = useRef<{ uniforms: { uTime: { value: number } } } | null>(null)
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.04, 0.2, 1, 4); g.translate(0, 0.1, 0)
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 0.2; p.setX(i, p.getX(i) * (1 - y * 0.9)) }
    return g
  }, [])
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide })
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = { value: 0 }; shaderRef.current = sh as never
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vH;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vH = uv.y;
          vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float sway = sin(uTime * 1.5 + ip.x * 0.7 + ip.z * 0.5) * 0.09 + sin(uTime * 3.3 + ip.x * 2.1) * 0.025;
          transformed.x += sway * uv.y * uv.y; transformed.z += sway * 0.6 * uv.y * uv.y;`)
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= mix(0.22, 1.2, vH);')
    }
    return m
  }, [])
  useEffect(() => {
    const m = mesh.current; if (!m) return
    const o = new THREE.Object3D(), c = new THREE.Color(); let placed = 0, guard = 0
    while (placed < count && guard++ < count * 6) {
      const at = pick((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2)
      if (!at) continue
      o.position.set(at[0], 0, at[1]); o.rotation.set(0, Math.random() * Math.PI, (Math.random() - 0.5) * 0.25)
      o.scale.setScalar(0.6 + Math.random() * 0.9); o.updateMatrix(); m.setMatrixAt(placed, o.matrix)
      c.setHSL(0.25 + Math.random() * 0.07, 0.6, 0.3 + Math.random() * 0.16); m.setColorAt(placed, c); placed++
    }
    m.count = placed; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [count, pick])
  useFrame((s) => { if (shaderRef.current) shaderRef.current.uniforms.uTime.value = s.clock.elapsedTime })
  return <instancedMesh ref={mesh} args={[geo, material, count]} frustumCulled={false} />
}

/* ---------------------------- raised bed ---------------------------- */
function BedMesh({ L, W, selected, hovered, occupied }: { L: number; W: number; selected: boolean; hovered: boolean; occupied: boolean }) {
  const t = 0.07, board = 0.17
  const frame = useRef<THREE.Group>(null)
  useFrame((s) => { if (frame.current) { const on = selected || hovered; frame.current.visible = on; frame.current.scale.setScalar(selected ? 1 + Math.sin(s.clock.elapsedTime * 3) * 0.006 : 1) } })
  const rail = (len: number, k: number) => [0, 1].map((b) => <mesh key={k + '-' + b} material={PLANK[(k + b) % 3]} position-y={board / 2 + b * (board + 0.01)} castShadow receiveShadow><boxGeometry args={[len, board, t]} /></mesh>)
  const hH = board * 2 + 0.01
  const ridges = Math.max(2, Math.round(W / 0.35))
  return (
    <group>
      {[W / 2 - t / 2, -W / 2 + t / 2].map((z, i) => <group key={'l' + i} position-z={z}>{rail(L, i)}</group>)}
      {[L / 2 - t / 2, -L / 2 + t / 2].map((x, i) => <group key={'w' + i} position-x={x} rotation-y={Math.PI / 2}>{rail(W - t * 2, i + 2)}</group>)}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <group key={'p' + i} position={[sx * (L / 2 - 0.035), 0, sz * (W / 2 - 0.035)]}>
          <mesh material={BLACK_METAL} position-y={hH / 2 + 0.02} castShadow><boxGeometry args={[0.1, hH + 0.04, 0.1]} /></mesh>
          <mesh material={BRASS} position-y={hH + 0.05}><boxGeometry args={[0.12, 0.025, 0.12]} /></mesh>
        </group>))}
      <mesh material={BED_SOIL} position-y={hH - 0.07} receiveShadow><boxGeometry args={[L - t * 2, 0.1, W - t * 2]} /></mesh>
      {/* furrows */}
      {Array.from({ length: ridges }, (_, i) => (
        <mesh key={'r' + i} material={RIDGE} position={[0, hH - 0.02, -W / 2 + t + 0.12 + (i * (W - t * 2 - 0.24)) / Math.max(1, ridges - 1)]} rotation-z={Math.PI / 2} receiveShadow>
          <cylinderGeometry args={[0.045, 0.045, L - t * 2 - 0.06, 8]} />
        </mesh>))}
      {/* glowing selection frame (bloom) */}
      <group ref={frame} visible={false} position-y={0.015}>
        {[[0, W / 2 + 0.12, L + 0.28, 0.025], [0, -W / 2 - 0.12, L + 0.28, 0.025]].map(([x, z, l, w], i) => <mesh key={'f' + i} material={selected ? YELLOW_GLOW : WHITE_GLOW} position={[x, 0, z]}><boxGeometry args={[l, 0.02, w]} /></mesh>)}
        {[[L / 2 + 0.13, 0], [-L / 2 - 0.13, 0]].map(([x, z], i) => <mesh key={'g' + i} material={selected ? YELLOW_GLOW : WHITE_GLOW} position={[x, 0, z]}><boxGeometry args={[0.025, 0.02, W + 0.27]} /></mesh>)}
      </group>
      {selected && <pointLight position={[0, 1.6, 0]} intensity={occupied ? 5 : 4} distance={4} color="#f2f56a" />}
    </group>
  )
}

function GardenBed({ lay, selected, onSelect, showLabel, interactive }: { lay: BedLayout; selected: boolean; onSelect?: (id: string) => void; showLabel: boolean; interactive: boolean }) {
  const [hover, setHover] = useState(false)
  const { L, W, plants, bed } = lay
  const top = 0.36
  // up to 12 plant models per bed in a neat grid (a bed's quantity can be far larger)
  const spots = useMemo(() => {
    const items: { p: Plant; x: number; z: number; seed: number }[] = []
    const perPlant = plants.length ? Math.max(1, Math.floor(12 / plants.length)) : 0
    plants.forEach((p) => { for (let k = 0; k < Math.min(perPlant, p.quantity); k++) items.push({ p, x: 0, z: 0, seed: items.length * 1.37 + p.name.length }) })
    const n = items.length, cols = Math.max(1, Math.ceil(Math.sqrt(n * (L / W)))), rows = Math.max(1, Math.ceil(n / cols))
    items.forEach((it, i) => {
      const c = i % cols, r = Math.floor(i / cols)
      it.x = cols > 1 ? -L / 2 + 0.22 + (c / (cols - 1)) * (L - 0.44) : 0
      it.z = rows > 1 ? -W / 2 + 0.2 + (r / (rows - 1)) * (W - 0.4) : 0
    })
    return items
  }, [plants, L, W])
  const handle = (e: ThreeEvent<MouseEvent>) => { if (!interactive) return; e.stopPropagation(); onSelect?.(bed.id) }
  return (
    <group position={[lay.x, 0, lay.z]} onClick={handle}
      onPointerOver={(e) => { if (!interactive) return; e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = '' }}>
      <BedMesh L={L} W={W} selected={selected} hovered={hover} occupied={plants.length > 0} />
      {spots.map((s, i) => { const look = lookShape(s.p.name, s.p.category)
        return <group key={s.p.id + i} position={[s.x, top, s.z]} scale={1.65}><Plant3D shape={look.shape} color={look.color} progress={STATUS_PROGRESS[s.p.status]} seed={s.seed} /></group> })}
      {showLabel && (
        <Html position={[0, 1.25, 0]} center distanceFactor={10} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide backdrop-blur ${selected ? 'border-[#eef53c] bg-[#eef53c] text-black' : 'border-white/20 bg-black/70 text-white'}`}>
            {bed.code} · {plants.length ? `${plants.length} crop${plants.length > 1 ? 's' : ''}` : 'Available'}
          </div>
        </Html>
      )}
    </group>
  )
}

/* ---------------------------- scenery ---------------------------- */
function Tree({ position, scale = 1, seed = 0, lights = true }: { position: [number, number, number]; scale?: number; seed?: number; lights?: boolean }) {
  const g = useRef<THREE.Group>(null)
  useFrame((s) => { if (g.current) g.current.rotation.z = Math.sin(s.clock.elapsedTime * 0.6 + seed) * 0.015 })
  const blobs: [number, number, number, number][] = [[0, 2.35, 0, 0.95], [0.55, 2.05, 0.2, 0.7], [-0.5, 2.1, -0.15, 0.7], [0.1, 2.85, -0.1, 0.62], [-0.15, 2.0, 0.55, 0.58], [0.3, 2.5, -0.5, 0.55]]
  const bulbs = useMemo(() => Array.from({ length: 14 }, (_, i) => { const a = i * 2.39 + seed, y = 1.75 + (i % 5) * 0.25, r = 0.95 - Math.abs(y - 2.3) * 0.5; return [Math.cos(a) * r, y, Math.sin(a) * r] as [number, number, number] }), [seed])
  const leaf = useMemo(() => [new THREE.MeshStandardMaterial({ color: '#1f4d2b', roughness: 0.8, flatShading: true }), new THREE.MeshStandardMaterial({ color: '#2a6236', roughness: 0.8, flatShading: true }), new THREE.MeshStandardMaterial({ color: '#173d22', roughness: 0.85, flatShading: true })], [])
  return (
    <group ref={g} position={position} scale={scale}>
      <mesh material={mat('#3b2a1c', 0.9)} position={[0, 0.85, 0]} castShadow><cylinderGeometry args={[0.09, 0.17, 1.7, 8]} /></mesh>
      {blobs.map(([x, y, z, r], i) => <mesh key={i} material={leaf[i % 3]} position={[x, y, z]} scale={[r, r * 0.85, r]} castShadow><icosahedronGeometry args={[1, 1]} /></mesh>)}
      {lights && bulbs.map((p, i) => <mesh key={'b' + i} material={BULB} position={p} scale={0.035}><sphereGeometry args={[1, 8, 6]} /></mesh>)}
    </group>
  )
}

function LampPost({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh material={BLACK_METAL} position-y={0.06}><cylinderGeometry args={[0.14, 0.18, 0.12, 12]} /></mesh>
      <mesh material={BLACK_METAL} position-y={1.0} castShadow><cylinderGeometry args={[0.035, 0.045, 1.9, 10]} /></mesh>
      <mesh material={BLACK_METAL} position-y={2.02}><coneGeometry args={[0.2, 0.16, 4]} /></mesh>
      <mesh material={GLASS} position-y={1.86}><boxGeometry args={[0.22, 0.26, 0.22]} /></mesh>
      <mesh material={BULB} position-y={1.86} scale={0.07}><sphereGeometry args={[1, 12, 10]} /></mesh>
      <pointLight position={[0, 1.8, 0]} intensity={7} distance={7} decay={1.6} color="#ffcf6b" />
    </group>
  )
}

/** Sagging string of glowing bulbs between two posts. */
function StringLights({ a, b, n = 16, sag = 0.45 }: { a: THREE.Vector3; b: THREE.Vector3; n?: number; sag?: number }) {
  const { pts, wire } = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 40; i++) { const t = i / 40; const p = a.clone().lerp(b, t); p.y -= Math.sin(Math.PI * t) * sag; pts.push(p) }
    return { pts, wire: new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#1a1a1a' })) }
  }, [a, b, sag])
  return (
    <group>
      <primitive object={wire} />
      {Array.from({ length: n }, (_, i) => { const p = pts[Math.round(((i + 0.5) / n) * 40)]; return <mesh key={i} material={BULB} position={[p.x, p.y - 0.06, p.z]} scale={0.045}><sphereGeometry args={[1, 8, 6]} /></mesh> })}
    </group>
  )
}

function Greenhouse({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const w = 2.2, d = 1.6, h = 1.2, roof = 0.6
  const bars: [number, number, number, number, number, number][] = []
  for (const x of [-w / 2, 0, w / 2]) for (const z of [-d / 2, d / 2]) bars.push([x, h / 2, z, 0.04, h, 0.04])
  return (
    <group position={position} rotation-y={rotation}>
      <mesh material={GLASS} position-y={h / 2}><boxGeometry args={[w, h, d]} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} material={GLASS} position={[0, h + roof / 2, (s * d) / 4]} rotation-x={s * Math.atan2(d / 2, roof)}><planeGeometry args={[w, Math.hypot(d / 2, roof)]} /></mesh>)}
      {bars.map(([x, y, z, a, b, c], i) => <mesh key={i} material={BLACK_METAL} position={[x, y, z]}><boxGeometry args={[a, b, c]} /></mesh>)}
      <mesh material={BLACK_METAL} position={[0, h + roof, 0]}><boxGeometry args={[w + 0.06, 0.05, 0.05]} /></mesh>
      {[-1, 1].map((s) => <mesh key={'e' + s} material={BLACK_METAL} position={[0, h, (s * d) / 2]}><boxGeometry args={[w + 0.06, 0.05, 0.05]} /></mesh>)}
      <mesh material={mat('#4a3020', 0.9)} position={[0, 0.22, 0]}><boxGeometry args={[w - 0.3, 0.06, d - 0.5]} /></mesh>
      {[-0.7, -0.2, 0.3, 0.8].map((x, i) => <Plant3D key={i} shape={i % 2 ? 'herb' : 'leafy'} color={i % 2 ? '#5cb85c' : '#a6df7c'} progress={0.9} seed={i * 3} position={[x, 0.26, 0]} />)}
      <pointLight position={[0, h - 0.1, 0]} intensity={3} distance={3} color="#fff1c2" />
    </group>
  )
}

function Pond({ position, r = 1.1 }: { position: [number, number, number]; r?: number }) {
  const stones = useMemo(() => Array.from({ length: 22 }, (_, i) => { const a = (i / 22) * Math.PI * 2; return { p: [Math.cos(a) * (r + 0.08), 0.06, Math.sin(a) * (r + 0.08) * 0.75] as [number, number, number], s: 0.11 + ((i * 37) % 7) / 70 } }), [r])
  const pads = useRef<THREE.Group>(null)
  useFrame((s) => { if (pads.current) pads.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.2) * 0.2 })
  return (
    <group position={position}>
      <mesh material={POND_WATER} rotation-x={-Math.PI / 2} position-y={0.03} scale={[1, 0.75, 1]} receiveShadow><circleGeometry args={[r, 48]} /></mesh>
      {stones.map((s, i) => <mesh key={i} material={STONE} position={s.p} scale={[s.s * 1.4, s.s * 0.7, s.s]} castShadow><dodecahedronGeometry args={[1, 0]} /></mesh>)}
      <group ref={pads}>
        {[[0.3, 0.2], [-0.4, -0.15], [0.1, -0.35]].map(([x, z], i) => <mesh key={i} material={mat('#2f6b34', 0.7)} position={[x, 0.045, z]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.16, 16, 0.4, Math.PI * 1.8]} /></mesh>)}
        <mesh material={BULB} position={[-0.15, 0.12, 0.25]} scale={0.05}><sphereGeometry args={[1, 10, 8]} /></mesh>
      </group>
    </group>
  )
}

function Bench({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation-y={rotation}>
      {[0, 1, 2].map((i) => <mesh key={i} material={PLANK[i % 3]} position={[0, 0.42, -0.12 + i * 0.12]} castShadow><boxGeometry args={[1.2, 0.04, 0.1]} /></mesh>)}
      {[0, 1].map((i) => <mesh key={'b' + i} material={PLANK[i]} position={[0, 0.62 + i * 0.12, -0.2]} castShadow><boxGeometry args={[1.2, 0.08, 0.04]} /></mesh>)}
      {[-0.5, 0.5].map((x) => <mesh key={x} material={BLACK_METAL} position={[x, 0.3, 0]}><boxGeometry args={[0.05, 0.6, 0.4]} /></mesh>)}
    </group>
  )
}

/** Swoops the camera in from far away on first load. */
function IntroCamera({ to }: { to: THREE.Vector3 }) {
  const { camera } = useThree()
  const t = useRef(0)
  useEffect(() => { camera.position.set(to.x * 2.4, to.y * 3.2, to.z * 2.4) }, [camera, to])
  useFrame((_, dt) => { if (t.current < 2.4) { t.current += dt; camera.position.lerp(to, Math.min(1, dt * 2.2)) } })
  return null
}

const STILL_TARGET = new THREE.Vector3(0, 0.3, 0)

/** Glides the orbit target to the selected bed (or back to the centre). */
function FocusRig({ target }: { target: THREE.Vector3 }) {
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  useFrame((_, dt) => { if (controls) { controls.target.lerp(target, Math.min(1, dt * 2.5)); controls.update() } })
  return null
}

/* ------------------------------------------------------------------ */
export function GardenScene({ beds, plants, selectedId, onSelect, interactive = true, autoRotate = false, labels = true, className = '', quality = 'high' }:
  { beds: Bed[]; plants: Plant[]; selectedId?: string | null; onSelect?: (id: string | null) => void; interactive?: boolean; autoRotate?: boolean; labels?: boolean; className?: string; quality?: 'high' | 'low' }) {
  const lays = useMemo(() => layoutBeds(beds, plants), [beds, plants])
  const bx = Math.max(3, ...lays.map((l) => Math.abs(l.x) + l.L / 2)), bz = Math.max(2.2, ...lays.map((l) => Math.abs(l.z) + l.W / 2))
  const M = 3.4 // margin around the beds for scenery
  const halfW = bx + M, halfD = bz + M, radius = Math.max(halfW, halfD)
  const gravel = useMemo(() => speckle('#3a3935', ['#4d4b46', '#2a2926', '#5e5b55', '#45433e'], 2600), [])
  const lawn = useMemo(() => speckle('#1d3d22', ['#285030', '#15301a', '#2f5c36'], 1800), [])
  const pond = useMemo(() => new THREE.Vector3(halfW - 1.9, 0, halfD - 1.8), [halfW, halfD])
  const gh = useMemo(() => new THREE.Vector3(-halfW + 1.7, 0, -halfD + 1.5), [halfW, halfD])
  // grass grows everywhere except the gravel walk, the greenhouse and the pond
  const pick = useMemo(() => (x: number, z: number): [number, number] | null => {
    const X = x * (halfW - 0.15), Z = z * (halfD - 0.15)
    if (Math.abs(X) < bx + 0.95 && Math.abs(Z) < bz + 0.95) return null
    if (Math.abs(X - gh.x) < 1.35 && Math.abs(Z - gh.z) < 1.05) return null
    if (Math.hypot(X - pond.x, (Z - pond.z) / 0.75) < 1.35) return null
    return [X, Z]
  }, [halfW, halfD, bx, bz, gh, pond])
  const grassCount = quality === 'high' ? 9000 : 3500
  lawn.repeat.set(halfW / 2, halfD / 2); gravel.repeat.set((bx + 0.9) / 1.2, (bz + 0.9) / 1.2)
  const corners: [number, number, number][] = [[-halfW + 0.45, 0, -halfD + 0.45], [halfW - 0.45, 0, -halfD + 0.45], [halfW - 0.45, 0, halfD - 0.45], [-halfW + 0.45, 0, halfD - 0.45]]
  const post = (c: [number, number, number]) => new THREE.Vector3(c[0], 1.95, c[2])
  const sel = lays.find((l) => l.bed.id === selectedId)
  const focus = useMemo(() => new THREE.Vector3(sel ? sel.x * 0.6 : 0, 0.3, sel ? sel.z * 0.6 : 0), [sel])
  const camTo = useMemo(() => new THREE.Vector3(radius * 1.35, radius * 1.2, radius * 1.65), [radius])

  return (
    <div className={className}>
      <Canvas shadows dpr={[1, quality === 'high' ? 2 : 1.5]} camera={{ position: [camTo.x, camTo.y, camTo.z], fov: 38, near: 0.1, far: 200 }}
        gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        onPointerMissed={() => interactive && onSelect?.(null)}>
        <color attach="background" args={['#030303']} />
        <fog attach="fog" args={['#030303', radius * 2.2, radius * 4.5]} />
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={1.4} position={[0, 6, -8]} scale={[14, 4, 1]} color="#9fb4ff" />
          <Lightformer form="rect" intensity={0.6} position={[-8, 2, 4]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} color="#ffd98a" />
        </Environment>
        <hemisphereLight args={['#b4c2ec', '#1a1a1a', 0.9]} />
        <ambientLight intensity={0.15} />
        <directionalLight position={[-radius * 0.8, radius * 1.4, radius * 0.6]} intensity={2.1} color="#d6e0ff" castShadow shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-radius * 1.3} shadow-camera-right={radius * 1.3} shadow-camera-top={radius * 1.3} shadow-camera-bottom={-radius * 1.3} shadow-bias={-0.0004} shadow-normalBias={0.02} />
        <Suspense fallback={null}>
          {/* plinth with a glowing yellow edge */}
          <mesh material={PLINTH} position-y={-0.42} receiveShadow><boxGeometry args={[halfW * 2 + 0.5, 0.8, halfD * 2 + 0.5]} /></mesh>
          {[[0, halfD + 0.25, halfW * 2 + 0.5, 0.02], [0, -halfD - 0.25, halfW * 2 + 0.5, 0.02]].map(([x, z, l, w], i) => <mesh key={'e' + i} material={YELLOW_GLOW} position={[x, -0.03, z]}><boxGeometry args={[l, 0.02, w]} /></mesh>)}
          {[[halfW + 0.25, 0], [-halfW - 0.25, 0]].map(([x, z], i) => <mesh key={'s' + i} material={YELLOW_GLOW} position={[x, -0.03, z]}><boxGeometry args={[0.02, 0.02, halfD * 2 + 0.5]} /></mesh>)}
          <mesh rotation-x={-Math.PI / 2} position-y={-0.85}><circleGeometry args={[radius * 2.6, 64]} /><meshBasicMaterial color="#0a0a0a" /></mesh>
          {/* lawn + gravel walk */}
          <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[halfW * 2, halfD * 2]} /><meshStandardMaterial map={lawn} roughness={1} /></mesh>
          <mesh rotation-x={-Math.PI / 2} position-y={0.008} receiveShadow><planeGeometry args={[(bx + 0.9) * 2, (bz + 0.9) * 2]} /><meshStandardMaterial map={gravel} roughness={1} /></mesh>
          {[[0, bz + 0.92, (bx + 0.92) * 2, 0.06], [0, -bz - 0.92, (bx + 0.92) * 2, 0.06]].map(([x, z, l, w], i) => <mesh key={'k' + i} material={BLACK_METAL} position={[x, 0.03, z]}><boxGeometry args={[l, 0.06, w]} /></mesh>)}
          {[[bx + 0.92, 0], [-bx - 0.92, 0]].map(([x, z], i) => <mesh key={'q' + i} material={BLACK_METAL} position={[x, 0.03, z]}><boxGeometry args={[0.06, 0.06, (bz + 0.92) * 2]} /></mesh>)}
          <Grass count={grassCount} pick={pick} />

          {lays.map((l) => <GardenBed key={l.bed.id} lay={l} selected={selectedId === l.bed.id} onSelect={onSelect} showLabel={labels} interactive={interactive} />)}

          <Greenhouse position={[gh.x, 0, gh.z]} />
          <Pond position={[pond.x, 0, pond.z]} />
          <Bench position={[pond.x - 1.9, 0, pond.z + 0.6]} rotation={0.4} />
          <Tree position={[halfW - 1.1, 0, -halfD + 1.1]} seed={1} />
          <Tree position={[-halfW + 1.0, 0, halfD - 1.2]} scale={0.85} seed={2} />
          <Tree position={[halfW - 0.9, 0, 0.2]} scale={0.7} seed={3} lights={false} />
          {corners.map((c, i) => <LampPost key={i} position={c} />)}
          <StringLights a={post(corners[0])} b={post(corners[1])} n={22} />
          <StringLights a={post(corners[0])} b={post(corners[3])} n={18} />
          <StringLights a={post(corners[1])} b={post(corners[2])} n={18} />
          <DreiSparkles count={quality === 'high' ? 90 : 50} scale={[halfW * 2, 2.6, halfD * 2]} position={[0, 1.3, 0]} size={4} speed={0.35} color="#f2f56a" opacity={0.9} />
        </Suspense>
        {interactive && <IntroCamera to={camTo} />}
        {interactive && <FocusRig target={focus} />}
        <OrbitControls makeDefault enablePan={false} enableZoom={interactive} enableRotate={interactive} autoRotate={autoRotate} autoRotateSpeed={0.45}
          minDistance={5} maxDistance={radius * 3} maxPolarAngle={Math.PI / 2.2} enableDamping {...(interactive ? {} : { target: STILL_TARGET })} />
        <EffectComposer multisampling={quality === 'high' ? 4 : 0}>
          <Bloom mipmapBlur luminanceThreshold={1} intensity={quality === 'high' ? 1.1 : 0.8} radius={0.75} />
          <Vignette eskil={false} offset={0.2} darkness={0.75} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}

// ======================================================================
// pages/Garden3D.tsx
// ======================================================================
export function Garden3D() {
  const { beds, plants, loading, error, reload } = useData()
  const [sel, setSel] = useState<string | null>(null)
  const [editBed, setEditBed] = useState(false)
  const [addPlant, setAddPlant] = useState(false)
  const occ = useMemo(() => occupancy(beds, plants), [beds, plants])
  const bed = beds.find((b) => b.id === sel)
  const inBed = bed ? occ.get(bed.id) ?? [] : []
  const used = [...occ.values()].filter((v) => v.length).length

  return (
    <>
      <PageHeader title="3D garden" sub="Drag to rotate, scroll or pinch to zoom, and click a bed to see what's growing in it." />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="glass relative h-[74vh] min-h-[460px] overflow-hidden p-0">
          {loading && !beds.length ? <Skeleton className="absolute inset-0 rounded-none" /> : beds.length ? (
            <GardenScene beds={beds} plants={plants} selectedId={sel} onSelect={setSel} className="absolute inset-0" />
          ) : <div className="grid h-full place-items-center p-6"><EmptyState title="No beds to show" body="Add a garden bed and it will appear here in 3D." action={<Link to="/beds"><Button>Add a bed</Button></Link>} /></div>}
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2 text-xs">
            <span className="glass flex items-center gap-1.5 px-2.5 py-1.5"><Rotate3d className="size-3.5 text-lime-300" />Drag to rotate</span>
            <span className="glass flex items-center gap-1.5 px-2.5 py-1.5"><ZoomIn className="size-3.5 text-lime-300" />Scroll to zoom</span>
            <span className="glass flex items-center gap-1.5 px-2.5 py-1.5"><MousePointerClick className="size-3.5 text-lime-300" />Click a bed</span>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 flex gap-3 rounded-full bg-emerald-950/70 px-3 py-1.5 text-xs text-muted backdrop-blur">
            <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-lime-300" />Occupied ({used})</span>
            <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-cyan-300" />Available ({beds.length - used})</span>
          </div>
        </div>

        <aside className="glass p-5" aria-live="polite">
          {bed ? (
            <div className="fade-up">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm text-lime-300">{bed.code}</p>
                  <h2 className="text-2xl font-extrabold">{bed.name}</h2>
                </div>
                <button onClick={() => setSel(null)} className="grid size-9 place-items-center rounded-xl text-muted hover:bg-white/5" aria-label="Clear selection"><X className="size-4" /></button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={inBed.length ? 'lime' : 'cyan'}>{inBed.length ? 'Occupied' : 'Available'}</Badge>
                <Badge tone="gray">{bed.soil_type} soil</Badge>
                {bed.zone && <Badge tone="gray">{bed.zone}</Badge>}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/5 p-3"><dt className="text-dim">Size</dt><dd className="font-mono">{Number(bed.length_m)} × {Number(bed.width_m)} m</dd></div>
                <div className="rounded-xl bg-white/5 p-3"><dt className="text-dim">Area</dt><dd className="font-mono">{area(bed).toFixed(2)} m²</dd></div>
              </dl>
              {bed.notes && <p className="mt-3 text-sm text-muted">{bed.notes}</p>}
              <h3 className="mt-5 mb-2 text-sm font-bold text-muted">Growing here</h3>
              {inBed.length ? (
                <ul className="grid gap-2">
                  {inBed.map((p) => (
                    <li key={p.id} className="rounded-xl border border-line p-3">
                      <div className="flex items-center justify-between gap-2"><span className="font-semibold">{p.name} <span className="text-xs text-dim">×{p.quantity}</span></span><StatusBadge status={p.status} /></div>
                      <Progress value={STATUS_PROGRESS[p.status]} className="mt-2" />
                      <p className="mt-1.5 text-xs text-dim">Sown {fmtDate(p.sowing_date)} · harvest ~{fmtDate(p.expected_harvest_date)}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">Nothing planted yet. This bed is free.</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button write onClick={() => setAddPlant(true)}><Plus className="size-4" />Plant here</Button>
                <Button write variant="ghost" onClick={() => setEditBed(true)}><Pencil className="size-4" />Edit bed</Button>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-bold">Select a bed</h2>
              <p className="mt-1 text-sm text-muted">Click any bed in the scene, or pick one here.</p>
              <ul className="mt-4 grid gap-1.5">
                {beds.map((b) => (
                  <li key={b.id}><button onClick={() => setSel(b.id)} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-sm hover:bg-white/5">
                    <span><span className="font-mono text-lime-300">{b.code}</span> · {b.name}</span>
                    <Badge tone={(occ.get(b.id) ?? []).length ? 'lime' : 'cyan'}>{(occ.get(b.id) ?? []).length ? `${(occ.get(b.id) ?? []).length} crop${(occ.get(b.id) ?? []).length > 1 ? 's' : ''}` : 'Free'}</Badge>
                  </button></li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
      <BedForm open={editBed} bed={bed} onClose={() => setEditBed(false)} />
      <PlantForm open={addPlant} draft={{ bed_id: bed?.id ?? null, status: 'sown' }} onClose={() => setAddPlant(false)} />
    </>
  )
}

// ======================================================================
// pages/Harvests.tsx
// ======================================================================
export function Harvests() {
  const { harvests, beds, loading, error, reload, remove, bedById, gardenId } = useData()
  const toast = useToast()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '');
  const fts = useFullTextIds(q, 'harvest', 250, gardenId); const [bed, setBed] = useState(''); const [unit, setUnit] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('')
  const [form, setForm] = useState<{ open: boolean; h: Harvest | null }>({ open: false, h: null })
  const [del, setDel] = useState<Harvest | null>(null); const [busy, setBusy] = useState(false)

  const list = useMemo(() => harvests.filter((h) =>
    keep(h.id, `${h.plant_name} ${h.unit} ${h.notes ?? ''}`, q, fts.ids) && (!bed || h.bed_id === bed) && (!unit || h.unit === unit)
    && (!from || h.harvested_on >= from) && (!to || h.harvested_on <= to)), [harvests, q, fts.ids, bed, unit, from, to])
  const kg = list.reduce((a, h) => a + (toKg(h) ?? 0), 0)
  const counts = list.filter((h) => toKg(h) === null).reduce((a, h) => a + Number(h.quantity), 0)
  const top = Object.entries(list.reduce<Record<string, number>>((m, h) => { const k = toKg(h); if (k) m[h.plant_name] = (m[h.plant_name] ?? 0) + k; return m }, {})).sort((a, b) => b[1] - a[1])[0]

  const doDelete = async () => {
    if (!del) return; setBusy(true)
    try { await remove('garden_harvests', del.id); toast('Harvest deleted'); setDel(null) } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }
  const exportCsv = () => downloadCSV(`harvests-${new Date().toISOString().slice(0, 10)}.csv`, list.map((h) => ({
    date: h.harvested_on, plant: h.plant_name, bed: bedById(h.bed_id)?.code ?? '', quantity: h.quantity, unit: h.unit, kg_equivalent: toKg(h)?.toFixed(2) ?? '', notes: h.notes ?? ''
  })))

  return (
    <>
      <PageHeader title="Harvest records" sub="Log every pick: what, where, how much and any notes."
        actions={<><Button variant="ghost" onClick={exportCsv} disabled={!list.length}><Download className="size-4" />CSV</Button><Button write onClick={() => setForm({ open: true, h: null })}><Plus className="size-4" />Record harvest</Button></>} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Records shown" value={list.length} icon={<ShoppingBasket className="size-5" />} />
        <StatCard label="Weight harvested" value={`${num(kg, 1)} kg`} sub={counts ? `plus ${num(counts)} pieces / bunches` : undefined} icon={<ShoppingBasket className="size-5" />} tone="lime" />
        <StatCard label="Top crop by weight" value={top ? top[0] : '—'} sub={top ? `${num(top[1], 1)} kg` : undefined} icon={<ShoppingBasket className="size-5" />} tone="amber" />
      </div>
      <div className="glass mb-4 flex flex-wrap items-center gap-3 p-3">
        <label className="relative min-w-52 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" /><input className="input pl-9" placeholder="Search plant or notes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search harvests" />{fts.active && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-lime-300/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-300" title="Ranked Postgres full-text search">Full-text</span>}</label>
        <select className="input w-auto" value={bed} onChange={(e) => setBed(e.target.value)} aria-label="Bed"><option value="">All beds</option>{beds.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select>
        <select className="input w-auto" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit"><option value="">All units</option>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
        <label className="flex items-center gap-2 text-sm text-muted">From<input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm text-muted">To<input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {loading && !harvests.length ? <LoadingRows rows={8} /> : !harvests.length ? (
        <EmptyState icon={<ShoppingBasket className="size-7" />} title="No harvests recorded" body="Record your first harvest to build the history." action={<Button write onClick={() => setForm({ open: true, h: null })}><Plus className="size-4" />Record harvest</Button>} />
      ) : !list.length ? <EmptyState title="No records match these filters" /> : (
        <div className="glass overflow-hidden p-0"><div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-dim">{['Date', 'Plant', 'Bed', 'Quantity', 'Notes', ''].map((h) => <th key={h} className={`px-4 py-3 font-semibold ${h === 'Quantity' ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
            <tbody>{list.map((h) => (
              <tr key={h.id} className="border-b border-line/60 hover:bg-white/[.03]">
                <td className="whitespace-nowrap px-4 py-3">{fmtDate(h.harvested_on)}</td>
                <td className="px-4 py-3 font-semibold">{h.plant_name}</td>
                <td className="px-4 py-3">{bedById(h.bed_id) ? <span className="font-mono text-lime-300">{bedById(h.bed_id)!.code}</span> : <span className="text-dim">—</span>}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono">{num(Number(h.quantity), Number(h.quantity) % 1 ? 2 : 0)} {h.unit}</td>
                <td className="max-w-64 truncate px-4 py-3 text-muted">{h.notes ?? ''}</td>
                <td className="px-4 py-3"><div className="flex justify-end"><IconButton label="Edit harvest" onClick={() => setForm({ open: true, h })}><Pencil className="size-4" /></IconButton><IconButton label="Delete harvest" onClick={() => setDel(h)} className="hover:text-red-300"><Trash2 className="size-4" /></IconButton></div></td>
              </tr>))}</tbody>
          </table>
        </div></div>
      )}
      <HarvestForm open={form.open} harvest={form.h} onClose={() => setForm({ open: false, h: null })} />
      <ConfirmDialog open={!!del} title="Delete this harvest record?" busy={busy} body={`${del?.quantity} ${del?.unit} of ${del?.plant_name} on ${fmtDate(del?.harvested_on)}`} onClose={() => setDel(null)} onConfirm={doDelete} />
    </>
  )
}

// ======================================================================
// pages/Health.tsx
// ======================================================================
const MAX_MB = 8

/** Downscales to max 1024px JPEG so uploads stay small and fast. */
async function prepare(file: File): Promise<{ dataUrl: string; base64: string; mime: string }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That file could not be read as an image.')); i.src = url })
    const s = Math.min(1, 1024 / Math.max(img.width, img.height))
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    const dataUrl = c.toDataURL('image/jpeg', 0.85)
    return { dataUrl, base64: dataUrl.split(',')[1], mime: 'image/jpeg' }
  } finally { URL.revokeObjectURL(url) }
}

export function Health() {
  const { ai, plants, create } = useData()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [img, setImg] = useState<{ dataUrl: string; base64: string; mime: string; name: string } | null>(null)
  const [plant, setPlant] = useState(''); const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false); const [res, setRes] = useState<HealthResult | null>(null); const [err, setErr] = useState(''); const [drag, setDrag] = useState(false)
  const past = ai.filter((h) => h.kind === 'health').slice(0, 6)

  const load = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('Please choose an image file (JPG, PNG or WebP).'); return }
    if (file.size > MAX_MB * 1024 * 1024) { setErr(`That image is over ${MAX_MB} MB. Please use a smaller photo.`); return }
    setErr(''); setRes(null)
    try { setImg({ ...(await prepare(file)), name: file.name }) } catch (e) { setErr((e as Error).message) }
  }
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); load(e.dataTransfer.files?.[0]) }
  const analyse = async () => {
    if (!img) return
    setBusy(true); setErr(''); setRes(null)
    try {
      const r = await analyseLeaf(img.base64, img.mime, plant, notes)
      setRes(r)
      // store the result (not the photo itself) in the analysis history
      create('garden_ai_history', { kind: 'health', input: { plant, notes, file: img.name }, output: r as unknown as Record<string, unknown>, demo: r.demo }).catch(() => {})
    } catch (e) { setErr((e as Error).message); toast('Analysis failed. Try again in a moment.', 'error') } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader title="AI plant health" sub="Upload a clear photo of a leaf to get an AI read on visible stress signs and general care steps." />
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-300" />
        <span>Results are an <strong>estimate from a photo, not a diagnosis</strong>. Lighting, angle and image quality affect them. For serious or spreading problems, ask a local agricultural extension officer or plant expert.</span>
      </div>
      <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card title="Leaf photo" icon={<ImagePlus className="size-4" />}>
          <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
            className={`relative grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl border-2 border-dashed transition ${drag ? 'border-lime-300 bg-lime-300/10' : 'border-line2 bg-black/20'}`}>
            {img ? (
              <>
                <img src={img.dataUrl} alt="Uploaded leaf" className="absolute inset-0 size-full object-contain" />
                <button onClick={() => { setImg(null); setRes(null) }} className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80" aria-label="Remove photo"><X className="size-4" /></button>
                {busy && <div className="absolute inset-x-0 top-0 h-1/3 animate-pulse bg-gradient-to-b from-lime-300/40 to-transparent" />}
              </>
            ) : (
              <button onClick={() => input.current?.click()} className="grid place-items-center gap-2 p-6 text-center">
                <ImagePlus className="size-10 text-lime-300" />
                <span className="font-semibold">Drop a photo here or click to upload</span>
                <span className="text-xs text-dim">JPG, PNG or WebP · up to {MAX_MB} MB · one leaf, in daylight, filling the frame</span>
              </button>
            )}
          </div>
          <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => load(e.target.files?.[0])} />
          <div className="mt-4 grid gap-3">
            <Field label="Which plant is it? (optional)"><input className="input" list="mine" value={plant} onChange={(e) => setPlant(e.target.value)} maxLength={60} placeholder="e.g. Tomato" />
              <datalist id="mine">{[...new Set(plants.map((p) => p.name))].map((n) => <option key={n} value={n} />)}</datalist></Field>
            <Field label="What have you noticed? (optional)"><textarea className="input min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={400} placeholder="e.g. lower leaves yellowing for a week" /></Field>
          </div>
          {err && <p role="alert" className="err mt-3">{err}</p>}
          <div className="mt-4 flex gap-2">
            <Button onClick={analyse} loading={busy} disabled={!img}><ScanLine className="size-4" />Analyse leaf</Button>
            {!img && <Button variant="ghost" onClick={() => input.current?.click()}>Choose photo</Button>}
          </div>
        </Card>

        <div>
          {busy && <div className="grid gap-4"><Skeleton className="h-24" /><Skeleton className="h-48" /><Skeleton className="h-40" /></div>}
          {!busy && !res && <div className="glass p-6"><EmptyState icon={<ScanLine className="size-7" />} title="The analysis appears here" body="Upload a leaf photo and press Analyse leaf." /></div>}
          {!busy && res && (
            <div className="grid gap-4">
              {res.demo && <DemoBanner>This photo was <strong>not analysed</strong>. These are example findings so you can see the layout. Add a Gemini API key in Settings for real image analysis.</DemoBanner>}
              <Card>
                <p className="text-sm text-dim">{res.demo ? 'Example overall impression' : `Likely plant: ${res.plant_guess}`}</p>
                <p className="mt-1 text-xl font-bold">{res.overall}</p>
                <p className="mt-2 text-sm text-muted"><span className="text-dim">Photo quality:</span> {res.image_quality}</p>
                <p className="mt-2 text-xs text-dim">{res.confidence !== null ? `Model confidence: ${Math.round(res.confidence * 100)}%` : 'No confidence score is shown because the model does not provide a reliable one.'}</p>
              </Card>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Visible signs" icon={<Eye className="size-4" />}>
                  {res.observations.length ? <ul className="grid gap-2 text-sm">{res.observations.map((o, i) => <li key={i} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-lime-300" />{o}</li>)}</ul> : <p className="text-sm text-muted">No clear signs of stress were seen.</p>}
                </Card>
                <Card title="Possible causes" icon={<AlertTriangle className="size-4" />}>
                  <ul className="grid gap-3 text-sm">{res.possible_causes.map((c, i) => <li key={i}><p className="font-semibold">{c.name}</p><p className="text-muted">{c.explanation}</p></li>)}</ul>
                </Card>
              </div>
              <Card title="General care steps" icon={<Lightbulb className="size-4" />}>
                <ol className="grid gap-2 text-sm">{res.care_steps.map((s, i) => <li key={i} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-400/15 font-mono text-xs text-lime-300">{i + 1}</span>{s}</li>)}</ol>
                <p className="mt-4 rounded-xl bg-white/5 p-3 text-sm"><span className="font-semibold">See an expert if: </span>{res.see_expert_if}</p>
              </Card>
            </div>
          )}
          {past.length > 0 && (
            <Card className="mt-4" title="Analysis history" icon={<History className="size-4" />}>
              <ul className="grid gap-1.5 text-sm">
                {past.map((h) => { const o = h.output as unknown as HealthResult; const i = h.input as { plant?: string; file?: string }
                  return <li key={h.id}><button onClick={() => setRes(o)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/5">
                    <span className="truncate">{i.plant || 'Unnamed plant'} · <span className="text-muted">{o.overall}</span></span>
                    <span className="shrink-0 text-xs text-dim">{timeAgo(h.created_at)}{h.demo ? ' · demo' : ''}</span></button></li> })}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

// ======================================================================
// three/PlantSpot.tsx
// ======================================================================
/** A single live 3D plant on a small turntable, used as "product photography" on the landing page.
    The WebGL canvas mounts only once it scrolls into view, to keep the page light. */
export function PlantSpot({ shape, color, className = '', soil = true, scale = 2.4 }: { shape: Shape; color: string; className?: string; soil?: boolean; scale?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect() } }, { rootMargin: '200px' })
    io.observe(el); return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={className} aria-hidden="true">
      {on && (
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.9, 2.6], fov: 34 }} gl={{ alpha: true, antialias: true }}>
          <hemisphereLight args={['#ffffff', '#3a2414', 0.9]} />
          <directionalLight position={[2, 3, 2]} intensity={2.2} />
          <directionalLight position={[-2, 1, -1]} intensity={0.6} color="#bef264" />
          <group position={[0, -0.55, 0]} scale={scale}>
            {soil && <mesh material={mat('#4a2f1a', 1)} position={[0, -0.02, 0]}><cylinderGeometry args={[0.16, 0.13, 0.05, 32]} /></mesh>}
            <Plant3D shape={shape} color={color} progress={1} seed={1.3} position={[0, 0, 0]} />
          </group>
          <ContactShadows position={[0, -0.62, 0]} scale={3} blur={2.5} opacity={0.35} far={1.5} />
          <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1.6} minPolarAngle={1.0} maxPolarAngle={1.45} target={[0, 0.05, 0]} />
        </Canvas>
      )}
    </div>
  )
}

// ======================================================================
// pages/Landing.tsx
// ======================================================================
/* =====================================================================
   Landing page in the black-silk theme. Sections, in order:
   1 theme hero (flowing 3D silk)   showroom (giant wordmark + 3D bed)
   2 live 3D garden   3 community (agency style)   dot-terrain + section index
   4 harvest (food style)           5 season (travel style)
   6 Harvest Fest (music-fest style) neon data columns + stack strip
   7 how it works (editorial)        orbit-arc invitation   8 about (bento)
   All numbers come from the live database.
   ===================================================================== */

const seasonNow = (): Season => { const m = new Date().getMonth(); return m <= 1 || m === 11 ? 'Winter' : m <= 4 ? 'Spring' : m <= 5 ? 'Summer' : m <= 8 ? 'Monsoon' : 'Autumn' }

/** Fades sections in as they scroll into view. */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)')
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target) } }), { threshold: 0.12 })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  })
}

/** Counts up to a value the first time it is visible. */
function CountUp({ to, decimals = 0 }: { to: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [v, setV] = useState(0)
  useEffect(() => {
    const el = ref.current; if (!el) return
    let raf = 0
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const t0 = performance.now()
      const step = (t: number) => { const p = Math.min(1, (t - t0) / 1400); setV(to * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(step) }
      raf = requestAnimationFrame(step)
    })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [to])
  return <span ref={ref}>{num(v, decimals)}</span>
}

const NAV_LINKS = [['#live', 'Live garden'], ['#community', 'Community'], ['#harvest', 'Harvest'], ['#season', 'This season'], ['#fest', 'Harvest fest'], ['#how', 'How it works']]

const TERRAIN_NAV: [string, string][] = [['#showroom', 'Showroom'], ['#live', 'Live garden'], ['#community', 'Community'], ['#terrain', 'Mapped'], ['#harvest', 'Harvest'], ['#stack', 'Stack'], ['#how', 'How it works'], ['#join', 'Join']]

export function Landing() {
  const { beds, plants, harvests, tasks, loading } = useData()
  const [menu, setMenu] = useState(false)
  const [ai, setAi] = useState<boolean | null>(null)
  useEffect(() => { aiStatus().then((s) => setAi(s.configured)) }, [])
  useReveal()

  const s = useMemo(() => {
    const active = plants.filter((p) => ACTIVE_STATUSES.includes(p.status))
    const kg = harvests.reduce((a, h) => a + (toKg(h) ?? 0), 0)
    const thisMonth = harvests.filter((h) => monthKey(h.harvested_on) === todayISO().slice(0, 7)).reduce((a, h) => a + (toKg(h) ?? 0), 0)
    const byCrop = Object.entries(harvests.reduce<Record<string, number>>((m, h) => { const k = toKg(h); if (k) m[h.plant_name] = (m[h.plant_name] ?? 0) + k; return m }, {})).sort((a, b) => b[1] - a[1])
    const durations = plants.filter((p) => p.sowing_date && p.expected_harvest_date).map((p) => daysBetween(p.sowing_date!, p.expected_harvest_date!))
    const avgDays = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0
    const used = new Set(active.map((p) => p.bed_id).filter(Boolean)).size
    const open = tasks.filter((t) => !t.done).sort((a, b) => a.due_date.localeCompare(b.due_date))
    const today = todayISO()
    const upcoming = plants.filter((p) => p.status !== 'harvested' && p.expected_harvest_date && p.expected_harvest_date >= today && p.expected_harvest_date <= addDays(today, 60))
      .sort((a, b) => a.expected_harvest_date!.localeCompare(b.expected_harvest_date!))
    return { active, kg, thisMonth, top: byCrop[0], avgDays, used, open, upcoming, ready: plants.filter((p) => p.status === 'ready').length, count: plants.reduce((a, p) => a + p.quantity, 0) }
  }, [plants, harvests, tasks])

  const season = seasonNow()
  const picks = CATALOG.filter((c) => c.seasons.includes(season)).slice(0, 4)
  const crops = [...new Set([...plants.map((p) => p.name), ...CATALOG.map((c) => c.name)])].slice(0, 16)
  const dash = (v: ReactNode) => (loading ? '—' : v)
  const festRange = s.upcoming.length
    ? `${fmtDate(s.upcoming[0].expected_harvest_date, { day: 'numeric', month: 'short' })} – ${fmtDate(s.upcoming[s.upcoming.length - 1].expected_harvest_date, { day: 'numeric', month: 'short' })}`
    : 'All season'

  return (
    <div className="landing overflow-x-clip bg-black text-white">
      {/* ============ 1. THEME HERO: black silk, thin type, neon yellow ============ */}
      <section className="relative h-[100svh] min-h-[640px] overflow-hidden bg-black">
        <Suspense fallback={null}><Showpiece kind="silk" className="absolute inset-0" /></Suspense>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_25%,rgb(0_0_0/.55)_70%,rgb(0_0_0/.75))]" />
        <span className="pointer-events-none absolute inset-y-0 left-[22%] hidden w-px bg-white/15 lg:block" />
        <span className="pointer-events-none absolute right-[13%] top-0 hidden h-24 w-px bg-white/20 lg:block" />

        <header className="relative z-20 flex items-center justify-between px-5 py-6 sm:px-10">
          <div className="flex items-center gap-2">
            <Link to="/garden" className="grid size-10 place-items-center rounded-full border border-white/40 text-[11px] font-bold hover:border-[#eef53c] hover:text-[#eef53c]">3D</Link>
            <Link to="/settings" title={ai ? 'AI live' : 'AI demo mode'} className={`grid size-10 place-items-center rounded-full border text-[11px] font-bold ${ai ? 'border-[#eef53c] text-[#eef53c]' : 'border-white/40 hover:text-[#eef53c]'}`}>AI</Link>
          </div>
          <Link to="/" className="absolute left-1/2 -translate-x-1/2 font-display text-lg font-medium tracking-[0.32em] text-[#eef53c] sm:text-2xl">GARDEN<span className="ml-[0.32em] hidden sm:inline">PLANNER</span></Link>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="hidden min-h-10 items-center gap-2 rounded-full border border-white/30 px-4 text-xs font-bold uppercase tracking-wider hover:border-[#eef53c] hover:text-[#eef53c] sm:inline-flex">Open app</Link>
            <Link to="/chat" className="grid size-10 place-items-center rounded-full border border-[#eef53c] text-[#eef53c]" aria-label="Ask the garden AI"><MessagesSquare className="size-4" /></Link>
            <button onClick={() => setMenu(!menu)} className="grid size-10 place-items-center rounded-full border border-white/40 lg:hidden" aria-label={menu ? 'Close menu' : 'Open menu'}>{menu ? <X className="size-4" /> : <Menu className="size-4" />}</button>
          </div>
        </header>
        {menu && <nav className="relative z-20 mx-5 grid gap-1 rounded-3xl border border-white/10 bg-black/85 p-3 text-sm font-bold uppercase tracking-wider backdrop-blur lg:hidden">{NAV_LINKS.map(([h, l]) => <a key={h} href={h} onClick={() => setMenu(false)} className="rounded-xl px-4 py-3 hover:text-[#eef53c]">{l}</a>)}<Link to="/dashboard" className="rounded-xl bg-[#eef53c] px-4 py-3 text-black">Open app</Link></nav>}

        <nav className="absolute left-10 top-[30%] z-10 hidden gap-3 text-[11px] font-bold uppercase tracking-[0.14em] lg:grid">
          {NAV_LINKS.map(([h, l]) => <a key={h} href={h} className="w-fit transition hover:translate-x-1 hover:text-[#eef53c]">{l}</a>)}
        </nav>
        <p className="absolute right-10 top-[30%] z-10 hidden text-[11px] font-bold uppercase tracking-[0.14em] lg:block">Live · {dash(beds.length)} beds</p>

        <div className="relative z-10 flex h-[calc(100%-88px)] flex-col justify-center px-5 sm:px-10 lg:pl-[22%] lg:pr-[15%]">
          <h1 className="fade-up text-right font-display text-[clamp(2.8rem,6.4vw,6rem)] font-light leading-[1.08] tracking-[-0.01em]">
            Grow together.<br />Track better —<br /><span className="inline-flex items-center gap-4"><Sprout className="size-[0.7em] text-[#eef53c]" strokeWidth={1.2} />harvest smarter</span>
          </h1>
          <div className="fade-up ml-auto mt-10 max-w-md border-t border-white/25 pt-5 text-sm leading-relaxed text-white/75" style={{ animationDelay: '.15s' }}>
            <span className="-mt-[26px] mb-4 block size-2.5 rounded-full bg-white" />
            A shared planner for every bed, seedling and harvest, with live data from the community database and an AI helper that knows your garden. {dash(`${s.active.length} crops growing · ${num(s.kg, 0)} kg harvested so far.`)}
            <Link to="/dashboard" className="mt-4 flex w-fit items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#eef53c] hover:underline">Open the planner <ArrowRight className="size-3.5" /></Link>
          </div>
        </div>
        <a href="#live" className="absolute bottom-10 left-6 z-10 grid size-14 place-items-center rounded-full bg-[#eef53c] text-black shadow-[0_0_40px_-6px_#eef53c] transition hover:scale-110 sm:left-10 lg:left-[calc(22%-28px)]" aria-label="Scroll down"><ArrowDown className="size-5" /></a>
      </section>

      {/* crop marquee */}
      <div className="relative overflow-hidden border-y border-white/10 bg-black py-5" aria-hidden="true">
        <div className="marquee flex w-max gap-12">
          {[...crops, ...crops].map((c, i) => <span key={i} className="flex items-center gap-2 font-display text-lg font-medium text-white/35"><Leaf className="size-5 text-[#eef53c]/60" />{c}</span>)}
        </div>
      </div>

      {/* ============ TEMPLATE: SHOWROOM (giant wordmark + glossy 3D bed) ============ */}
      <ShowroomSection beds={beds.length} growing={s.active.length} />

      {/* ============ 2. LIVE 3D GARDEN ============ */}
      <section id="live" className="relative scroll-mt-4 bg-[#050505]">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div data-reveal>
            <p className="font-mono text-sm uppercase tracking-[0.25em] text-[#eef53c]">01 · Live garden</p>
            <h2 className="mt-4 font-display text-4xl font-light leading-tight sm:text-5xl">Your whole garden, <span className="text-[#eef53c]">rendered live in 3D</span></h2>
            <p className="mt-4 max-w-md text-white/60">Every bed in the database appears here at night under string lights, each plant drawn by crop type and sized by how far it has grown. Open the 3D view to click a bed and see what's growing.</p>
            <ul className="mt-6 grid max-w-md gap-2">
              {beds.slice(0, 4).map((b) => { const n = plants.filter((p) => p.bed_id === b.id && p.status !== 'harvested').length
                return <li key={b.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm"><span><span className="font-mono text-[#eef53c]">{b.code}</span> · {b.name}</span><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${n ? 'bg-[#eef53c]/15 text-[#eef53c]' : 'bg-white/10 text-white/70'}`}>{n ? `${n} crop${n > 1 ? 's' : ''}` : 'Free'}</span></li> })}
            </ul>
            <Link to="/garden" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#eef53c] px-6 font-bold text-black">Explore in 3D <ArrowUpRight className="size-4" /></Link>
          </div>
          <div data-reveal className="relative h-[62vh] min-h-[400px] overflow-hidden rounded-[28px] border border-white/10">
            {beds.length ? <GardenScene beds={beds} plants={plants} interactive={false} autoRotate labels={false} quality="low" className="absolute inset-0" /> : <p className="grid h-full place-items-center text-white/50">{loading ? 'Loading the garden…' : 'Add a bed to see it here.'}</p>}
            <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs backdrop-blur"><span className="size-2 animate-pulse rounded-full bg-[#eef53c]" />Live from the database</span>
          </div>
        </div>
      </section>

      {/* ============ 3. COMMUNITY (agency style) ============ */}
      <section id="community" className="relative scroll-mt-4 overflow-hidden bg-[#151515]">
        <div className="pointer-events-none absolute -bottom-40 -left-40 size-[34rem] rounded-full bg-white/[.03]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div data-reveal>
            <h2 className="font-condensed text-[clamp(3.4rem,8.5vw,7.4rem)] uppercase leading-[0.9] tracking-wide">We are<br />growing</h2>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <span className="border-b-2 border-[#eef53c] pb-1 text-sm font-bold uppercase leading-tight">Food,<br />friends</span>
              <span className="font-condensed text-[clamp(3.4rem,8.5vw,7.4rem)] uppercase leading-[0.9]">and</span>
              <span className="grid h-24 w-14 place-items-center rounded-full bg-[#eef53c] text-black sm:h-28 sm:w-16"><span className="-rotate-90 whitespace-nowrap text-xs font-bold">together</span></span>
              <span className="relative size-20 overflow-hidden rounded-full border-4 border-[#151515] bg-white sm:size-24"><PlantSpot shape="herb" color="#5cb85c" className="absolute inset-0" scale={1.5} /></span>
            </div>
            <div className="mt-12 flex items-start gap-6">
              <a href="#harvest" className="grid h-14 w-8 shrink-0 place-items-center rounded-full border border-white/30 text-white/70 hover:border-[#eef53c] hover:text-[#eef53c]" aria-label="Next section"><ArrowDown className="size-4" /></a>
              <div>
                <p className="max-w-md text-white/65">We're a volunteer-run community garden. Every bed, seed and harvest is shared on one planner, so anyone can see what needs doing and what's ready to pick.</p>
                <Link to="/dashboard" className="mt-5 inline-flex items-center gap-2 border-b border-white/40 pb-1 text-xs font-bold uppercase tracking-wider hover:border-[#eef53c] hover:text-[#eef53c]">Get started now <ArrowRight className="size-3.5" /></Link>
              </div>
            </div>
          </div>
          <div data-reveal className="relative mx-auto aspect-square w-full max-w-[460px]">
            <svg className="absolute -left-6 -top-8 w-20 text-white" viewBox="0 0 80 50" aria-hidden="true"><path d="M5 40 Q 15 5 30 30 T 55 20 M60 8 l8 -6 M66 16 l10 -2 M62 26 l9 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            <div className="absolute inset-0 overflow-hidden rounded-full bg-[radial-gradient(circle_at_60%_40%,#3a3a3a,#111)]">
              <PlantSpot shape="fruiting" color="#e5432a" className="absolute inset-0" scale={1.9} />
              <div className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-[#e0261b] mix-blend-multiply" />
            </div>
            <Link to="/garden" className="absolute bottom-[14%] right-[-2%] flex items-center gap-3 text-[11px] font-bold uppercase leading-tight">
              <span className="grid size-16 place-items-center rounded-full bg-white text-black transition hover:scale-110"><Play className="size-5 fill-black" /></span>Take the<br />3D tour
            </Link>
            <div className="absolute -bottom-10 right-0 flex items-center gap-3">
              <div className="flex -space-x-3">{plants.slice(0, 3).map((p) => <span key={p.id} className="size-11 rounded-full border-2 border-[#151515]" style={{ background: `radial-gradient(circle at 35% 30%, #fff8, ${lookShape(p.name, p.category).color})` }} title={p.name} />)}
                <Link to="/plants" className="grid size-11 place-items-center rounded-full border-2 border-white/60 bg-[#151515]" aria-label="All plants"><Plus className="size-4" /></Link></div>
              <p className="text-sm font-bold leading-tight">We have <span className="text-[#eef53c]">{dash(s.count)}+</span> plants<br /><span className="font-normal text-white/60">growing garden-wide</span></p>
            </div>
            <span className="absolute -right-2 top-[8%] grid size-10 place-items-center rounded-lg border border-white/25 text-white/60"><ArrowDownRight className="size-4" /></span>
          </div>
        </div>
      </section>

      {/* ============ TEMPLATE: DOT TERRAIN + SECTION INDEX ============ */}
      <TerrainSection sections={TERRAIN_NAV} />

      {/* ============ 4. HARVEST (food style, dark) ============ */}
      <section id="harvest" className="relative scroll-mt-4 overflow-hidden bg-[#0b0b0b]">
        <span className="pointer-events-none absolute right-[-4%] top-1/2 -translate-y-1/2 select-none font-serif text-[clamp(10rem,26vw,24rem)] font-bold leading-none text-white/[.035]" aria-hidden="true">Grow</span>
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-2">
          <div data-reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold"><span className="grid size-6 place-items-center rounded-full bg-[#ff4d2e] text-white"><Star className="size-3.5 fill-white" /></span>{s.top ? `#1 crop by weight: ${s.top[0]}` : 'Log a harvest to rank your crops'}</span>
            <h2 className="mt-6 font-serif text-[clamp(2.8rem,6vw,5rem)] font-bold leading-[1.02]">Fresh<br /><span className="text-[#ff4d2e]">Harvests</span><br />for Every Season</h2>
            <p className="mt-5 max-w-md text-white/60">Log every pick by plant, bed and weight. The garden builds its own harvest history, top crops and monthly trends with no spreadsheets needed.</p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link to="/harvests" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#ff4d2e] px-7 font-bold text-white shadow-[0_14px_30px_-10px_#ff4d2e] transition hover:-translate-y-0.5"><ShoppingBasket className="size-4" />Record a harvest</Link>
              <Link to="/analytics" className="group inline-flex items-center gap-3 font-semibold"><span className="grid size-12 place-items-center rounded-full bg-white text-[#ff4d2e] transition group-hover:scale-110"><Play className="size-4 fill-current" /></span>See the trends</Link>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-2 gap-6 border-t border-white/10 pt-8 sm:grid-cols-4">
              {([[s.kg, 'kg harvested'], [s.active.length, 'growing now'], [beds.length, 'garden beds'], [harvests.length, 'harvest logs']] as [number, string][]).map(([v, l]) => (
                <div key={l}><dt className="sr-only">{l}</dt><dd className="font-serif text-4xl font-bold"><CountUp to={v} /><span className="text-[#ff4d2e]">+</span></dd><dd className="text-sm text-white/55">{l}</dd></div>
              ))}
            </dl>
          </div>
          <div data-reveal className="relative mx-auto aspect-square w-full max-w-[520px]">
            <div className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle_at_40%_35%,#3b2a20,#0d0806)] shadow-[0_50px_90px_-30px_rgb(255_77_46/.5)]" />
            <div className="absolute inset-[6%] rounded-full ring-[14px] ring-white/5" />
            <PlantSpot shape="fruiting" color="#e5432a" className="absolute inset-[6%] overflow-hidden rounded-full" scale={1.75} />
            <div className="float-a absolute left-[-2%] top-[14%] flex items-center gap-3 rounded-2xl border border-white/10 bg-[#171717] px-4 py-3 shadow-xl"><span className="grid size-10 place-items-center rounded-xl bg-[#ff4d2e]/15 text-[#ff4d2e]"><Flame className="size-5" /></span><div><p className="text-sm font-bold">Ready to pick</p><p className="text-xs text-white/55">{dash(s.ready)} plant{s.ready === 1 ? '' : 's'} today</p></div></div>
            <div className="float-b absolute right-[-3%] top-[52%] flex items-center gap-3 rounded-2xl border border-white/10 bg-[#171717] px-4 py-3 shadow-xl"><span className="grid size-10 place-items-center rounded-xl bg-[#eef53c]/15 text-[#eef53c]"><Clock className="size-5" /></span><div><p className="text-sm font-bold">{dash(s.avgDays)} days</p><p className="text-xs text-white/55">avg. sow → harvest</p></div></div>
            <div className="float-a absolute bottom-[4%] right-[10%] flex items-center gap-3 rounded-2xl border border-white/10 bg-[#171717] px-4 py-3 shadow-xl [animation-delay:-2s]"><span className="grid size-10 place-items-center rounded-xl bg-amber-400/15 text-amber-300"><ShoppingBasket className="size-5" /></span><div><p className="text-sm font-bold">{dash(num(s.thisMonth, 1))} kg</p><p className="text-xs text-white/55">picked this month</p></div></div>
          </div>
        </div>
      </section>

      {/* ============ 5. THIS SEASON (travel style, dark) ============ */}
      <section id="season" className="relative scroll-mt-4 overflow-hidden bg-[#111]">
        <div className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full bg-[#eef53c]/[.06]" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 py-24 sm:px-8 lg:grid-cols-2">
          <div data-reveal>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#ff7a3d]">Best crops for {season.toLowerCase()} {new Date().getFullYear()}</p>
            <h2 className="mt-5 font-serif text-[clamp(2.6rem,5.5vw,4.6rem)] font-bold leading-[1.08]">Plan, <span className="relative inline-block">sow<svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true"><path className="draw" d="M3 14 Q 60 2 110 10 T 197 7" fill="none" stroke="#eef53c" strokeWidth="6" strokeLinecap="round" /></svg></span> and watch a new garden grow</h2>
            <p className="mt-6 max-w-md text-white/60">Tell the AI your region, soil, sun and water, and it suggests what to plant and which free bed to put it in. Then add it to the plan in one tap.</p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link to="/recommend" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#eef53c] px-6 font-bold text-black shadow-[0_18px_30px_-14px_#eef53c] transition hover:-translate-y-0.5"><Sparkles className="size-4" />Get AI picks</Link>
              <a href="#how" className="group inline-flex items-center gap-3 font-semibold text-white/70"><span className="grid size-12 place-items-center rounded-full bg-[#ff7a3d] text-white transition group-hover:scale-110"><Play className="size-4 fill-white" /></span>How it works</a>
            </div>
          </div>
          <div data-reveal className="relative mx-auto aspect-[5/6] w-full max-w-[460px]">
            <svg className="absolute inset-0 size-full" viewBox="0 0 460 552" aria-hidden="true"><path d="M30 120 C 120 20, 260 30, 330 90 S 440 220, 420 300" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="2" strokeDasharray="7 9" /></svg>
            <span className="float-b absolute left-[2%] top-[14%] grid size-11 place-items-center rounded-full bg-[#1b1b1b] text-[#eef53c] shadow-lg"><Sprout className="size-5" /></span>
            <span className="float-a absolute right-[2%] top-[50%] grid size-11 place-items-center rounded-full bg-[#1b1b1b] text-sky-300 shadow-lg"><Droplets className="size-5" /></span>
            <div className="absolute inset-x-[10%] bottom-0 top-[18%] rounded-[46%_54%_40%_60%/55%_45%_55%_45%] bg-gradient-to-br from-[#f6ff8a] to-[#c8cd06]" />
            <PlantSpot shape="flower" color="#f4c430" className="absolute inset-x-[4%] bottom-[2%] top-[6%]" scale={2.1} />
            <div className="float-a absolute bottom-[6%] left-[-4%] rounded-2xl border border-white/10 bg-[#171717] p-4 shadow-xl"><p className="text-xs text-white/50">Ongoing</p><p className="font-bold">Sunflower · 85 days</p><div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[40%] rounded-full bg-[#eef53c]" /></div></div>
          </div>
        </div>
        <div className="relative mx-auto max-w-7xl px-5 pb-24 sm:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4" data-reveal>
            <div><p className="font-semibold uppercase tracking-wider text-white/50">Top picks</p><h3 className="font-serif text-4xl font-bold">Good to sow this {season.toLowerCase()}</h3></div>
            <Link to="/recommend" className="inline-flex items-center gap-1 font-semibold text-[#eef53c] hover:underline">Personalise with AI <ArrowRight className="size-4" /></Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {picks.map((c, i) => (
              <Link to="/plants" key={c.name} data-reveal style={{ transitionDelay: `${i * 80}ms` }} className="group rounded-3xl border border-white/10 bg-[#181818] transition hover:-translate-y-2 hover:border-[#eef53c]/50">
                <div className="relative h-44 overflow-hidden rounded-t-3xl" style={{ background: `radial-gradient(circle at 50% 70%, ${c.color}40, transparent 70%), #101010` }}>
                  <PlantSpot shape={c.shape} color={c.color} className="absolute inset-0 transition duration-500 group-hover:scale-110" scale={1.6} />
                </div>
                <div className="p-5"><div className="flex items-center justify-between"><h4 className="text-lg font-bold">{c.name}</h4><span className="text-sm text-white/50">{c.days} days</span></div>
                  <p className="mt-2 flex flex-wrap gap-3 text-xs text-white/55"><span className="flex items-center gap-1"><Sun className="size-3.5" />{c.sun}</span><span className="flex items-center gap-1"><Droplets className="size-3.5" />{c.water} water</span></p>
                  <p className="mt-2 text-xs text-white/40">Soil: {c.soils.join(', ')}</p></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 6. HARVEST FEST (music-fest style) ============ */}
      <section id="fest" className="relative scroll-mt-4 overflow-hidden bg-black">
        <FestRings className="pointer-events-none absolute -right-[12%] top-[12%] w-[min(860px,110vw)] opacity-90" />
        <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full" viewBox="0 0 1440 160" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="festwave" x1="0" x2="1"><stop offset="0" stopColor="#5b21b6" /><stop offset=".55" stopColor="#a21caf" /><stop offset="1" stopColor="#ec4899" /></linearGradient></defs>
          <path className="wave-move" d="M0 90 C 240 20 420 150 720 90 S 1200 10 1440 80 V160 H0Z" fill="url(#festwave)" />
        </svg>
        <div className="relative mx-auto max-w-7xl px-5 pb-48 pt-20 sm:px-8">
          <div data-reveal className="flex items-center justify-between">
            <span className="grid size-16 grid-cols-2 place-items-center border-2 border-white p-1.5 font-display text-lg font-bold leading-none">G<span>R</span>O<span>W</span></span>
            <div className="flex gap-3"><Link to="/harvests" className="rounded-full bg-gradient-to-r from-[#ec4899] to-[#ff9f5a] px-5 py-2 text-sm font-bold">Join in</Link><Link to="/calendar" className="rounded-full border border-white/70 px-5 py-2 text-sm font-bold">Calendar</Link></div>
          </div>
          <div data-reveal className="mt-16 max-w-xl">
            <p className="flex flex-wrap gap-x-10 gap-y-1 text-lg">{festRange}<span>Community harvest days</span></p>
            <h2 className="mt-3 font-display text-[clamp(3.4rem,8vw,6.4rem)] font-bold leading-[0.95]">Harvest<br />Fest</h2>
            <p className="mt-5 max-w-md text-white/70">Every crop that's due in the next two months, in one place. Come along, pick what's ready, log it, and take home your share.</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {s.upcoming.slice(0, 6).map((p) => <li key={p.id} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm">{p.name} <span className="text-white/50">· {relDay(p.expected_harvest_date!).toLowerCase()}</span></li>)}
              {!s.upcoming.length && <li className="text-sm text-white/50">No harvests due in the next 60 days yet.</li>}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/harvests" className="inline-flex min-h-11 items-center rounded-full bg-gradient-to-r from-[#a855f7] via-[#ec4899] to-[#ff9f5a] px-6 text-sm font-bold">Record a harvest</Link>
              <Link to="/calendar" className="inline-flex min-h-11 items-center rounded-full border border-white/70 px-6 text-sm font-bold hover:bg-white/10">See the schedule</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ TEMPLATE: NEON DATA COLUMNS + STACK STRIP ============ */}
      <NeonStackSection />

      {/* ============ 7. HOW IT WORKS (editorial) ============ */}
      <section id="how" className="scroll-mt-4 bg-white text-black">
        <div className="mx-auto max-w-[1500px] px-4 pt-14 sm:px-6">
          <div data-reveal className="flex items-start justify-between gap-4 font-condensed uppercase leading-[0.82] tracking-tight">
            <span className="text-[clamp(4rem,15vw,15rem)]">Garden<sup className="align-[1.3em] text-[0.3em]">®</sup></span>
            <span className="text-[clamp(4rem,15vw,15rem)]">Plan</span>
          </div>
          <div className="grid gap-8 border-t-2 border-black py-8 text-xs font-bold uppercase sm:grid-cols-3">
            <p className="max-w-[16rem]">This is a space for growing.<br />Shared by every volunteer.</p>
            <p className="max-w-xs text-[13px] font-medium normal-case leading-snug"><span className="mb-2 flex justify-between font-bold uppercase"><span>Index</span><span>1/4</span></span>Our garden is organised by bed, crop and season. Every record lives in one shared database, open to the whole community and built for clear decisions.</p>
            <div className="flex items-end justify-between gap-4 sm:justify-end"><Link to="/dashboard" className="border-2 border-black px-3 py-2 hover:bg-black hover:text-[#eef53c]">[ Open the planner ]</Link></div>
          </div>
        </div>
        <div className="bg-black px-4 pb-0 pt-14 text-white sm:px-6">
          <div className="mx-auto grid max-w-[1500px] items-end gap-3 sm:grid-cols-[1.2fr_repeat(4,1fr)]">
            <p data-reveal className="self-start pb-10 text-sm font-bold uppercase leading-snug">Four steps,<br />one shared garden.<br /><span className="font-medium normal-case text-white/60">From an empty bed to a logged harvest, with the AI helping at every stage.</span></p>
            {[
              { n: '1', k: 'Step 01 · Beds', t: 'Map the beds', d: 'Give each bed an ID, a size and a soil type.', to: '/beds', h: 'h-[19rem]' },
              { n: '2', k: 'Step 02 · Sow', t: 'Sow & assign', d: 'Add plants to beds; sowing dates are logged automatically.', to: '/plants', h: 'h-[24rem]' },
              { n: '3', k: 'Step 03 · Track', t: 'Track growth', d: 'Follow each crop from sown to ready on the calendar.', to: '/calendar', h: 'h-[29rem]' },
              { n: '4', k: 'Step 04 · Harvest', t: 'Harvest & report', d: 'Log every pick and export reports as CSV.', to: '/harvests', h: 'h-[34rem]' }
            ].map((x, i) => (
              <Link key={x.n} to={x.to} data-reveal style={{ transitionDelay: `${i * 90}ms` }} className={`group relative flex flex-col overflow-hidden bg-white p-4 text-black transition hover:bg-[#eef53c] ${x.h}`}>
                <p className="text-[11px] font-bold uppercase">{x.k}</p>
                <span className="mt-4 font-condensed text-[clamp(9rem,15vw,16rem)] leading-[0.8] transition duration-500 group-hover:-translate-y-2">{x.n}</span>
                <div className="mt-auto"><p className="text-sm font-bold uppercase">{x.t}</p><p className="mt-1 text-xs leading-snug text-black/70">{x.d}</p></div>
              </Link>
            ))}
          </div>
        </div>
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs font-bold uppercase sm:px-6">
          <span>[ Garden planner ]</span><span>Est. {new Date().getFullYear()} · Community-run</span><span className="hidden sm:inline">Grow together — track better — harvest smarter</span>
        </div>
      </section>

      {/* ============ TEMPLATE: ORBIT ARC INVITATION ============ */}
      <OrbitJoinSection members={crops.slice(0, 6)} />

      {/* ============ 8. ABOUT / BENTO ============ */}
      <section id="about" className="scroll-mt-4 bg-black py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p data-reveal className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/50">• About the planner</p>
          <h2 data-reveal className="mx-auto mt-4 max-w-3xl text-center font-display text-[clamp(2rem,4.4vw,3.4rem)] font-light leading-[1.15]">
            A community garden planner <span className="inline-grid size-[1em] translate-y-1 place-items-center rounded-full bg-[#eef53c] align-baseline text-black"><Sprout className="size-[0.6em]" /></span> built for smarter growing <span className="text-white/40">and more shared</span> <span className="inline-grid size-[1em] translate-y-1 place-items-center rounded-full bg-white align-baseline text-black"><Leaf className="size-[0.6em]" /></span> <span className="text-white/40">harvests</span>
          </h2>
          <div className="mt-14 grid gap-4 md:grid-cols-4 md:grid-rows-2">
            <div data-reveal className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#2c2c2c] to-[#0e0e0e] p-5 md:row-span-2">
              <p className="flex items-center justify-between font-display text-xl font-bold tracking-widest text-[#eef53c]">GARDEN <BarChart3 className="size-5" /></p>
              <PlantSpot shape="herb" color="#5cb85c" className="mx-auto mt-2 h-56 w-full" scale={2.6} />
              <div className="rounded-2xl bg-[#eef53c] p-4 text-black"><p className="font-display text-4xl font-bold"><CountUp to={s.count} />+</p><p className="text-sm text-black/70">individual plants tracked across {beds.length} beds</p></div>
            </div>
            <div data-reveal className="rounded-3xl border border-white/10 bg-[#121212] p-6 md:col-span-2">
              <p className="text-sm text-white/50">Commitment to honesty</p>
              <p className="mt-3 font-display text-5xl font-bold">100%</p>
              <p className="mt-3 max-w-sm text-sm text-white/60">“If the AI isn’t connected, it says so. Demo results are always labeled, and leaf checks are estimates, never diagnoses.”</p>
            </div>
            <div data-reveal className="rounded-3xl bg-[#eef53c] p-6 text-black"><p className="text-sm font-medium">Harvest logged</p><p className="mt-3 font-display text-4xl font-bold"><CountUp to={s.kg} decimals={1} /> kg</p><p className="mt-2 text-sm text-black/70">Weight-based picks, converted and totalled automatically.</p></div>
            <div data-reveal className="rounded-3xl border border-white/10 bg-[#121212] p-6"><p className="text-sm text-white/50">Bed usage</p><p className="mt-3 font-display text-4xl font-bold">{beds.length ? Math.round((s.used / beds.length) * 100) : 0}%</p><p className="mt-2 text-sm text-white/60">{s.used} of {beds.length} beds have something growing.</p></div>
            <div data-reveal className="flex flex-col justify-between rounded-3xl border border-white/10 bg-gradient-to-br from-[#1d1d1d] to-black p-6 md:col-span-2"><p className="text-sm text-white/50">Open tasks</p><div className="flex items-end justify-between gap-4"><p className="font-display text-5xl font-bold">{s.open.length}</p><Link to="/calendar" className="inline-flex items-center gap-1 rounded-full bg-[#eef53c] px-4 py-2 text-sm font-bold text-black">Calendar <ArrowUpRight className="size-4" /></Link></div><p className="text-sm text-white/50">{s.open[0] ? `Next: ${s.open[0].title} (${relDay(s.open[0].due_date).toLowerCase()})` : 'Nothing due right now.'}</p></div>
          </div>
          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { i: Box, t: '3D garden', d: 'Rotate, zoom and click any bed.', to: '/garden' },
              { i: Rows3, t: 'Beds & plants', d: 'Sizes, soils, growth stages.', to: '/beds' },
              { i: Sparkles, t: 'AI recommendations', d: 'Plants matched to your conditions.', to: '/recommend' },
              { i: ScanLine, t: 'Leaf health check', d: 'Photo estimate plus care steps.', to: '/health' },
              { i: MessagesSquare, t: 'Garden AI chat', d: 'Ask about watering, soil, rotation.', to: '/chat' },
              { i: CalendarDays, t: 'Sowing calendar', d: 'Sowing, harvests, reminders.', to: '/calendar' },
              { i: ShoppingBasket, t: 'Harvest records', d: 'Every pick, filterable.', to: '/harvests' },
              { i: BarChart3, t: 'Analytics & CSV', d: 'Trends and downloadable reports.', to: '/analytics' }
            ].map(({ i: I, t, d, to }, k) => (
              <Link key={t} to={to} data-reveal style={{ transitionDelay: `${(k % 4) * 70}ms` }} className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-[#0e0e0e] p-4 transition hover:-translate-y-1 hover:border-[#eef53c]/60">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5 text-[#eef53c] transition group-hover:bg-[#eef53c] group-hover:text-black"><I className="size-5" /></span>
                <span><span className="block font-bold">{t}</span><span className="text-sm text-white/55">{d}</span></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA + FOOTER ============ */}
      <section className="relative overflow-hidden border-t border-white/10 bg-black">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_0%,rgb(238_245_60/.14),transparent_70%)]" />
        <div className="relative mx-auto max-w-5xl px-5 py-24 text-center sm:px-8" data-reveal>
          <h2 className="font-display text-[clamp(2.4rem,6vw,4.8rem)] font-light leading-[1.05]">Ready to grow<br /><span className="text-[#eef53c]">together?</span></h2>
          <p className="mx-auto mt-5 max-w-lg text-white/60">Open the planner to see today's tasks, what's ready to pick and how the garden is doing.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/dashboard" className="btn-glow inline-flex min-h-12 items-center gap-2 rounded-full bg-[#eef53c] px-7 font-bold text-black">Open the dashboard <ArrowRight className="size-4" /></Link>
            <Link to="/chat" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/25 px-7 font-bold hover:bg-white/5"><MessagesSquare className="size-4" />Ask the garden AI</Link>
          </div>
        </div>
        <footer className="relative border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-white/45 sm:px-8">
            <Logo small />
            <p className="flex items-center gap-2"><Database className="size-4" />Live data from Supabase · AI by Google Gemini through a secure server function</p>
            <p>Grow Together. Track Better. Harvest Smarter.</p>
          </div>
        </footer>
      </section>
    </div>
  )
}

// ======================================================================
// pages/Plants.tsx
// ======================================================================
export function Plants() {
  const { plants, beds, loading, error, reload, remove, update, bedById, gardenId } = useData()
  const toast = useToast()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '');
  const fts = useFullTextIds(q, 'plant', 250, gardenId); const [cat, setCat] = useState(''); const [st, setSt] = useState(''); const [bed, setBed] = useState('')
  const [form, setForm] = useState<{ open: boolean; plant: Plant | null }>({ open: false, plant: null })
  const [del, setDel] = useState<Plant | null>(null); const [busy, setBusy] = useState(false)

  const list = plants.filter((p) =>
    keep(p.id, `${p.name} ${p.category} ${p.status} ${p.notes ?? ''}`, q, fts.ids) && (!cat || p.category === cat) && (!st || p.status === st)
    && (!bed || (bed === 'none' ? !p.bed_id : p.bed_id === bed)))

  const advance = async (p: Plant) => {
    const i = STATUSES.indexOf(p.status); if (i >= STATUSES.length - 1) return
    const next = STATUSES[i + 1]
    try { await update('garden_plants', p.id, { status: next, ...(next === 'sown' && !p.sowing_date ? { sowing_date: todayISO() } : {}) }); toast(`${p.name} → ${STATUS_LABEL[next]}`) }
    catch (e) { toast((e as Error).message, 'error') }
  }
  const doDelete = async () => {
    if (!del) return; setBusy(true)
    try { await remove('garden_plants', del.id); toast(`${del.name} deleted`); setDel(null) } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader title="Plants" sub="Everything sown or planned, with its bed, sowing date, growth stage and expected harvest." actions={<Button write onClick={() => setForm({ open: true, plant: null })}><Plus className="size-4" />Add plant</Button>} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <div className="glass mb-4 flex flex-wrap items-center gap-3 p-3">
        <label className="relative min-w-52 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" /><input className="input pl-9" placeholder="Search plants or notes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search plants" />{fts.active && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-lime-300/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-300" title="Ranked Postgres full-text search">Full-text</span>}</label>
        <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <select className="input w-auto" value={st} onChange={(e) => setSt(e.target.value)} aria-label="Status"><option value="">All stages</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
        <select className="input w-auto" value={bed} onChange={(e) => setBed(e.target.value)} aria-label="Bed"><option value="">All beds</option><option value="none">Unassigned</option>{beds.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select>
      </div>

      {loading && !plants.length ? <LoadingRows rows={7} /> : !plants.length ? (
        <EmptyState icon={<Sprout className="size-7" />} title="No plants yet" body="Add what you’ve sown, or try AI Recommendations for ideas." action={<Button write onClick={() => setForm({ open: true, plant: null })}><Plus className="size-4" />Add plant</Button>} />
      ) : !list.length ? <EmptyState title="No plants match" body="Clear a filter or try another search." /> : (
        <div className="glass overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-dim">
                {['Plant', 'Bed', 'Sown', 'Est. harvest', 'Growth', ''].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {list.map((p) => {
                  const b = bedById(p.bed_id)
                  const overdue = p.expected_harvest_date && p.expected_harvest_date < todayISO() && !['ready', 'harvested'].includes(p.status)
                  return (
                    <tr key={p.id} className="border-b border-line/60 transition hover:bg-white/[.03]">
                      <td className="px-4 py-3"><p className="font-semibold">{p.name} <span className="text-xs font-normal text-dim">×{p.quantity}</span></p><p className="text-xs text-dim">{p.category}</p></td>
                      <td className="px-4 py-3">{b ? <span><span className="font-mono text-lime-300">{b.code}</span> <span className="text-muted">{b.name}</span></span> : <span className="text-dim">Unassigned</span>}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmtDate(p.sowing_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmtDate(p.expected_harvest_date)}{p.expected_harvest_date && <p className={`text-xs ${overdue ? 'text-amber-300' : 'text-dim'}`}>{relDay(p.expected_harvest_date)}</p>}</td>
                      <td className="px-4 py-3 min-w-44"><div className="flex items-center gap-2"><StatusBadge status={p.status} />
                        {p.status !== 'harvested' && <button onClick={() => advance(p)} className="grid size-7 place-items-center rounded-lg text-dim hover:bg-white/5 hover:text-lime-300" aria-label={`Move ${p.name} to next stage`} title="Next stage"><ChevronRight className="size-4" /></button>}</div>
                        <Progress value={STATUS_PROGRESS[p.status]} className="mt-2 max-w-40" /></td>
                      <td className="px-4 py-3"><div className="flex justify-end">
                        <IconButton label={`Edit ${p.name}`} onClick={() => setForm({ open: true, plant: p })}><Pencil className="size-4" /></IconButton>
                        <IconButton label={`Delete ${p.name}`} onClick={() => setDel(p)} className="hover:text-red-300"><Trash2 className="size-4" /></IconButton>
                      </div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-4 py-2.5 text-xs text-dim">{list.length} of {plants.length} plants</p>
        </div>
      )}
      <PlantForm open={form.open} plant={form.plant} onClose={() => setForm({ open: false, plant: null })} />
      <ConfirmDialog open={!!del} title={`Delete ${del?.name}?`} busy={busy} onClose={() => setDel(null)} onConfirm={doDelete}
        body="Its sowing records and tasks are removed too. Harvests already logged are kept." />
    </>
  )
}

// ======================================================================
// pages/Recommend.tsx
// ======================================================================
const SUN = ['Full sun (6+ hours)', 'Partial sun (3–6 hours)', 'Mostly shade (under 3 hours)']
const WATER_OPTIONS = ['Low (rain-fed, occasional)', 'Medium (2–3 times a week)', 'High (daily watering possible)']
const defaultSeason = (): Season => { const m = new Date().getMonth(); return m <= 1 || m === 11 ? 'Winter' : m <= 4 ? 'Spring' : m <= 5 ? 'Summer' : m <= 8 ? 'Monsoon' : 'Autumn' }

export function Recommend() {
  const { beds, plants, ai, create } = useData()
  const toast = useToast()
  const [f, setF] = useState<RecommendInputs>({ location: '', season: defaultSeason(), soil: 'Loamy', space: 10, sunlight: SUN[0], water: WATER_OPTIONS[1] })
  const [busy, setBusy] = useState(false); const [res, setRes] = useState<RecommendResult | null>(null); const [err, setErr] = useState('')
  const [draft, setDraft] = useState<PlantDraft | null>(null)
  const past = ai.filter((h) => h.kind === 'recommendation').slice(0, 5)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!(f.space > 0)) { setErr('Enter the available space in m².'); return }
    setErr(''); setBusy(true); setRes(null)
    try {
      const r = await recommend(f, beds, plants)
      setRes(r)
      create('garden_ai_history', { kind: 'recommendation', input: f as unknown as Record<string, unknown>, output: r as unknown as Record<string, unknown>, demo: r.demo }).catch(() => {})
    } catch (e) { setErr((e as Error).message); toast('The AI request failed. Try again in a moment.', 'error') } finally { setBusy(false) }
  }
  const addToPlan = (r: Recommendation) => {
    const bed = beds.find((b) => b.code === r.recommended_bed)
    const cat = (CATEGORIES as readonly string[]).includes(r.category) ? (r.category as Category) : findCatalog(r.name)?.category ?? 'Vegetable'
    const days = r.days_to_harvest || findCatalog(r.name)?.days
    setDraft({ name: r.name, category: cat, bed_id: bed?.id ?? null, status: 'planned', sowing_date: todayISO(), expected_harvest_date: days ? addDays(todayISO(), days) : null, quantity: 1, notes: `AI pick: ${r.why}`.slice(0, 480) })
  }
  const set = (k: keyof RecommendInputs) => (e: { target: { value: string } }) => setF({ ...f, [k]: k === 'space' ? Number(e.target.value) : e.target.value })

  return (
    <>
      <PageHeader title="AI plant recommendations" sub="Describe your conditions and get plants matched to them, with the best free bed for each." />
      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card title="Your conditions" icon={<Sparkles className="size-4" />}>
          <form onSubmit={submit} className="grid gap-3.5" noValidate>
            <Field label="Location or region" hint="City, state or climate, e.g. “Hyderabad, semi-arid”"><input className="input" value={f.location} onChange={set('location')} maxLength={80} placeholder="e.g. Hyderabad, India" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Season"><select className="input" value={f.season} onChange={set('season')}>{SEASONS.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Soil type"><select className="input" value={f.soil} onChange={set('soil')}>{SOIL_TYPES.map((s) => <option key={s}>{s}</option>)}</select></Field>
            </div>
            <Field label="Available space (m²)" error={err && !(f.space > 0) ? err : undefined}><input className="input" type="number" min="0.5" step="0.5" value={f.space} onChange={set('space')} /></Field>
            <Field label="Sunlight"><select className="input" value={f.sunlight} onChange={set('sunlight')}>{SUN.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Water availability"><select className="input" value={f.water} onChange={set('water')}>{WATER_OPTIONS.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Button loading={busy} className="mt-1"><Sparkles className="size-4" />Recommend plants</Button>
          </form>
          {past.length > 0 && (
            <div className="mt-6 border-t border-line pt-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted"><History className="size-4" />Recent requests</p>
              <ul className="grid gap-1">
                {past.map((h) => { const i = h.input as unknown as RecommendInputs
                  return <li key={h.id}><button onClick={() => { setF(i); setRes(h.output as unknown as RecommendResult) }} className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-muted hover:bg-white/5 hover:text-ink">{i.season} · {i.soil} · {i.location || 'no location'} <span className="text-dim">· {timeAgo(h.created_at)}{h.demo ? ' · demo' : ''}</span></button></li> })}
              </ul>
            </div>
          )}
        </Card>

        <div>
          {busy && <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-64" />)}</div>}
          {!busy && err && f.space > 0 && <div role="alert" className="glass p-5 text-red-200">{err}</div>}
          {!busy && !res && !err && <div className="glass p-6"><EmptyState icon={<Sparkles className="size-7" />} title="Your recommendations appear here" body="Fill in your conditions and press Recommend plants." /></div>}
          {!busy && res && (
            <>
              {res.demo && <DemoBanner>These are rule-based sample picks, not AI output. Add a Gemini API key in Settings for real AI recommendations.</DemoBanner>}
              <p className="glass mb-4 p-4 text-sm text-muted"><span className="font-semibold text-ink">{res.demo ? 'Demo summary: ' : 'Summary: '}</span>{res.summary}</p>
              <div className="grid gap-4 md:grid-cols-2">
                {res.recommendations.map((r, i) => (
                  <article key={r.name + i} className="glass fade-up flex flex-col p-5" style={{ animationDelay: `${i * 0.06}s` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div><h3 className="text-xl font-extrabold">{r.name}</h3><p className="text-xs text-dim">{r.category}</p></div>
                      <Badge tone="lime"><Rows3 className="size-3" />{r.recommended_bed}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted">{r.why}</p>
                    <dl className="mt-4 grid gap-2 text-sm">
                      {[[CalendarDays, 'Plant', r.planting_period], [Clock, 'Grows in', r.growth_duration], [Droplets, 'Water', r.watering], [Sun, 'Sun', r.sunlight], [Layers, 'Soil', r.soil]].map(([I, l, v]) => {
                        const Icon = I as typeof Sun
                        return <div key={l as string} className="flex gap-2.5"><Icon className="mt-0.5 size-4 shrink-0 text-lime-300" /><dt className="w-16 shrink-0 text-dim">{l as string}</dt><dd>{v as string}</dd></div>
                      })}
                    </dl>
                    <Button variant="ghost" className="mt-auto self-start" onClick={() => addToPlan(r)} style={{ marginTop: 18 }}><Plus className="size-4" />Add to garden plan</Button>
                  </article>
                ))}
              </div>
              {!res.demo && res.model && <p className="mt-3 text-xs text-dim">Generated by {res.model}. Check local conditions before planting.</p>}
            </>
          )}
        </div>
      </div>
      <PlantForm open={!!draft} draft={draft ?? undefined} onClose={() => setDraft(null)} />
    </>
  )
}

// ======================================================================
// pages/Settings.tsx
// ======================================================================
export function SettingsPage() {
  const d = useData()
  const toast = useToast()
  const [ai, setAi] = useState<AiStatus | null>(null); const [checking, setChecking] = useState(false)
  const check = async () => { setChecking(true); setAi(await aiStatus(true)); setChecking(false) }
  useEffect(() => { aiStatus().then(setAi) }, [])
  const ref = SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1]
  const dbOk = supabaseConfigured && !d.error && !!d.lastSync

  return (
    <>
      <PageHeader title="Settings" sub="Connection status, AI configuration, security and local preferences. Manage your account and gardens on the Account page." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Database" icon={<Database className="size-4" />} action={<Badge tone={dbOk ? 'lime' : 'red'}>{dbOk ? 'Connected' : 'Not connected'}</Badge>}>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-dim">Provider</dt><dd>Supabase (Postgres)</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-dim">Project</dt><dd className="font-mono">{ref ?? 'not configured'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-dim">Last sync</dt><dd>{d.lastSync ? d.lastSync.toLocaleTimeString() : '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-dim">Records</dt><dd className="text-right">{d.beds.length} beds · {d.plants.length} plants · {d.harvests.length} harvests · {d.tasks.length} tasks · {d.sowing.length} sowings · {d.ai.length} AI runs</dd></div>
          </dl>
          {d.error && <p className="mt-3 rounded-xl bg-red-950/40 p-3 text-sm text-red-200">{d.error}</p>}
          <Button variant="ghost" className="mt-4" onClick={() => d.reload().then(() => toast('Data refreshed'))} loading={d.loading}><RefreshCw className="size-4" />Sync now</Button>
        </Card>

        <Card title="AI (Google Gemini)" icon={<KeyRound className="size-4" />} action={ai ? <Badge tone={ai.configured ? 'lime' : 'amber'}>{ai.configured ? 'Live' : 'Demo mode'}</Badge> : null}>
          {ai?.configured ? (
            <p className="flex items-start gap-2 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-lime-300" />AI is live using <span className="font-mono">{ai.model}</span>. Recommendations, leaf analysis and chat use real model output.</p>
          ) : (
            <div className="grid gap-3 text-sm">
              <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />{ai && !ai.reachable ? 'The AI function could not be reached, so the app is using demo results.' : 'No Gemini key is configured, so AI features show clearly labeled demo results.'}</p>
              <ol className="ml-5 list-decimal space-y-1 text-muted">
                <li>Create a free key at <a className="text-lime-300 underline" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Google AI Studio <ExternalLink className="inline size-3" /></a>.</li>
                <li>In Supabase, open <span className="text-ink">Edge Functions → Secrets</span>{ref && <> (<a className="text-lime-300 underline" href={`https://supabase.com/dashboard/project/${ref}/functions/secrets`} target="_blank" rel="noreferrer">open</a>)</>}.</li>
                <li>Add a secret named <code className="rounded bg-white/10 px-1.5 font-mono text-ink">GEMINI_API_KEY</code> with your key. Optionally set <code className="rounded bg-white/10 px-1.5 font-mono text-ink">GEMINI_MODEL</code>.</li>
                <li>Press “Check again”.</li>
              </ol>
            </div>
          )}
          <Button variant="ghost" className="mt-4" onClick={check} loading={checking}><RefreshCw className="size-4" />Check again</Button>
        </Card>

        <AiMonitor />

        <Card title="Security" icon={<ShieldCheck className="size-4" />}>
          <ul className="grid gap-2 text-sm text-muted">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-lime-300" />The Gemini key is stored as a server-side secret and used only by the <span className="font-mono text-ink">garden-ai</span> edge function. It never reaches the browser.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-lime-300" />The browser only holds the public Supabase key. Row-level security limits it to the garden tables.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-lime-300" />Accounts use Supabase Auth. Private gardens are visible only to their members, enforced by row-level security in Postgres, not just hidden in the UI.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-lime-300" />Roles per garden: owners manage members and invite codes, editors change data, viewers can only read.</li>
            <li className="flex gap-2"><Info className="mt-0.5 size-4 shrink-0 text-cyan-300" />The Community Demo Garden is deliberately open so anyone can try the app without an account. Don’t store private information there.</li>
          </ul>
        </Card>

        <Card title="This device" icon={<Trash2 className="size-4" />}>
          <p className="text-sm text-muted">Chat conversations and an offline copy of each garden are kept in this browser, so the app opens instantly and keeps working without a connection. Changes made offline ({d.queued} waiting) are sent when you reconnect.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => { try { localStorage.removeItem('cgp-chat-v1') } catch { /* ignore */ } toast('Chat history cleared on this device') }}><Trash2 className="size-4" />Clear chat history</Button>
            <Button variant="ghost" onClick={() => { try { Object.keys(localStorage).filter((k) => k.startsWith('cgp-cache:')).forEach((k) => localStorage.removeItem(k)) } catch { /* ignore */ } toast('Offline copy cleared') }}><Trash2 className="size-4" />Clear offline copy</Button>
          </div>
        </Card>
      </div>
    </>
  )
}

/** Live health of the garden-ai edge function (last 24 h), from the garden_ai_stats() RPC. */
function AiMonitor() {
  const [s, setS] = useState<AiStats | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(true)
  const load = useCallback(async () => {
    setBusy(true); setErr('')
    try { setS(await fetchAiStats(24)) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }, [])
  useEffect(() => { load() }, [load])
  const h = s ? healthLabel(s) : null
  return (
    <Card title="AI service monitoring" icon={<Activity className="size-4" />} className="lg:col-span-2" action={h ? <Badge tone={h.tone}>{h.label}</Badge> : null}>
      {err ? (
        <p className="flex items-start gap-2 text-sm text-red-200"><AlertTriangle className="mt-0.5 size-4 shrink-0" />Could not load monitoring data: {err}</p>
      ) : !s ? (
        <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-20" />)}</div>
      ) : (
        <>
          <dl className="grid gap-3 sm:grid-cols-4">
            {[
              ['Calls (24 h)', num(s.total)],
              ['Server error rate', `${num(errorRate(s) * 100, 1)}%`],
              ['Latency avg / p95', `${num(s.avg_ms)} / ${num(s.p95_ms)} ms`],
              ['Rate-limited', num(s.rate_limited)]
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-white/5 p-3"><dt className="text-xs text-dim">{l}</dt><dd className="mt-1 font-mono text-xl">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>By action:</span>
            {Object.keys(s.by_action).length ? Object.entries(s.by_action).map(([a, n]) => <Badge key={a} tone="gray">{a} · {n}</Badge>) : <span className="text-dim">no calls yet</span>}
            {s.demo > 0 && <Badge tone="amber">{s.demo} demo</Badge>}
            {s.client_errors > 0 && <Badge tone="gray">{s.client_errors} rejected request{s.client_errors === 1 ? '' : 's'}</Badge>}
          </div>
          <p className="mt-3 text-sm text-muted">
            {s.last_error ? <>Last server error {timeAgo(s.last_error.at)} on <span className="font-mono text-ink">{s.last_error.action}</span>: {s.last_error.message}</> : 'No server errors in the last 24 hours.'}
            {s.last_call_at && <span className="text-dim"> · Last call {timeAgo(s.last_call_at)}</span>}
          </p>
        </>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-dim">Every AI call is logged with a request ID, status and timing. Full logs: Supabase → Edge Functions → garden-ai → Logs.</p>
        <Button variant="ghost" onClick={load} loading={busy}><RefreshCw className="size-4" />Refresh</Button>
      </div>
    </Card>
  )
}

// ======================================================================
// main.tsx
// ======================================================================
// Each page is its own chunk so the first load stays light.
const Fallback = () => <div className="grid gap-4 p-2"><Skeleton className="h-10 w-64" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div><Skeleton className="h-80" /></div>

const rootEl = typeof document !== 'undefined' ? document.getElementById('root') : null
if (rootEl) createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
        <DataProvider>
          <Suspense fallback={<Fallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/garden" element={<Garden3D />} />
                <Route path="/beds" element={<Beds />} />
                <Route path="/plants" element={<Plants />} />
                <Route path="/recommend" element={<Recommend />} />
                <Route path="/health" element={<Health />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/harvests" element={<Harvests />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/account" element={<AccountPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
)

if (rootEl) registerServiceWorker()
