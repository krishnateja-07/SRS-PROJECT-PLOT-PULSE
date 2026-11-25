// End-to-end tests (Playwright) with an in-memory Supabase mock, all in one file.
import { type Page, type Route, expect, test } from '@playwright/test'

// ---- in-memory Supabase mock ----
/* =====================================================================
   In-memory stand-in for the Supabase REST API, RPCs and the garden-ai
   edge function, so end-to-end tests run offline and deterministically.
   Supports what the app uses: select (garden_id filter), insert, update
   and delete by id, the garden RPCs, email/password auth, and AI status.
   Gardens: the open demo garden, a public read-only garden, and a private
   garden that only the signed-in test user (owner) can see.
   ===================================================================== */

export const MOCK_URL = 'https://mock.supabase.co'
export const DEMO = '0a4de000-0000-4000-8000-000000000001'
export const PUBLIC_READ = '0a4de000-0000-4000-8000-0000000000aa'
export const PRIVATE = '0a4de000-0000-4000-8000-0000000000bb'
export const USER = { id: '0a4de000-0000-4000-8000-00000000cafe', email: 'srikar@garden.test', password: 'grow1234' }
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const TOKEN = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })}.mocksig`
const iso = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10) }
const now = () => new Date().toISOString()
let seq = 0
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`

export function seed() {
  const b = (code: string, name: string, soil = 'Loamy') => ({ id: uuid(), code, name, length_m: 2.4, width_m: 1.2, soil_type: soil, zone: 'Zone A', notes: null, created_at: now() })
  const beds = [b('BED-001', 'Sunny Corner'), b('BED-002', 'Herb Spiral', 'Sandy'), b('BED-003', 'Tomato Row')]
  const p = (name: string, category: string, bed: string | null, status: string, sow: number, harvest: number, notes: string | null = null) =>
    ({ id: uuid(), name, category, bed_id: bed, status, quantity: 6, sowing_date: iso(sow), expected_harvest_date: iso(harvest), notes, created_at: now() })
  const plants = [
    p('Tomato', 'Vegetable', beds[2].id, 'flowering', -60, 15),
    p('Basil', 'Herb', beds[1].id, 'growing', -30, 20, 'companion for tomatoes'),
    p('Carrot', 'Root', beds[0].id, 'sown', -5, 70)
  ]
  const harvests = [
    { id: uuid(), plant_id: plants[0].id, plant_name: 'Tomato', bed_id: beds[2].id, harvested_on: iso(-3), quantity: 2.5, unit: 'kg', notes: null, created_at: now() },
    { id: uuid(), plant_id: plants[1].id, plant_name: 'Basil', bed_id: beds[1].id, harvested_on: iso(-10), quantity: 4, unit: 'bunches', notes: null, created_at: now() }
  ]
  const tasks = [{ id: uuid(), title: 'Water the herb spiral', type: 'water', due_date: iso(1), bed_id: beds[1].id, plant_id: null, done: false, notes: null, created_at: now() }]
  const sowing = plants.map((x) => ({ id: uuid(), plant_id: x.id, bed_id: x.bed_id, sown_on: x.sowing_date, quantity: x.quantity, notes: null, created_at: now() }))
  const all = [beds, plants, harvests, tasks, sowing] as Record<string, unknown>[][]
  all.forEach((list) => list.forEach((r) => { r.garden_id = DEMO }))
  const pubBed = { ...b('BED-101', 'Neighbours’ Plot'), garden_id: PUBLIC_READ }
  const privBed = { ...b('BED-201', 'My Secret Bed'), garden_id: PRIVATE }
  beds.push(pubBed, privBed)
  return { garden_beds: beds, garden_plants: plants, garden_harvests: harvests, garden_tasks: tasks, garden_sowing_records: sowing, garden_ai_history: [] as Record<string, unknown>[] } as Record<string, Record<string, unknown>[]>
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }

export interface MockControl { failNextWrite: boolean; slowWrites: number; signedIn: () => boolean }

export async function mockSupabase(page: Page) {
  const db = seed()
  let nextBed = 10
  const gardens = [
    { id: DEMO, name: 'Community Demo Garden', visibility: 'public_open', created_by: null, created_at: now() },
    { id: PUBLIC_READ, name: 'Neighbours (read-only)', visibility: 'public_read', created_by: null, created_at: now() },
    { id: PRIVATE, name: 'Srikar’s Private Plot', visibility: 'private', created_by: USER.id, created_at: now() }
  ]
  const members = [{ garden_id: PRIVATE, user_id: USER.id, role: 'owner', email: USER.email, joined_at: now() }]
  const control: MockControl = { failNextWrite: false, slowWrites: 0, signedIn: () => false }
  const session = () => ({ access_token: TOKEN, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'mock-refresh',
    user: { id: USER.id, aud: 'authenticated', role: 'authenticated', email: USER.email, app_metadata: { provider: 'email' }, user_metadata: { app: 'garden' }, created_at: now() } })

  const handle = async (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) })

    const authed = (req.headers()['authorization'] ?? '').includes('mocksig')
    const visible = (gid: unknown) => gid === DEMO || gid === PUBLIC_READ || (gid === PRIVATE && authed)
    const writable = (gid: unknown) => gid === DEMO || (gid === PRIVATE && authed)

    if (url.pathname.startsWith('/auth/v1/')) {
      if (url.pathname === '/auth/v1/token') {
        const body = JSON.parse(req.postData() || '{}')
        if (body.refresh_token || (body.email === USER.email && body.password === USER.password)) return json(session())
        return json({ error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400)
      }
      if (url.pathname === '/auth/v1/signup') return json({ ...session().user, id: uuid(), email: JSON.parse(req.postData() || '{}').email, confirmation_sent_at: now() })
      if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS })
      if (url.pathname === '/auth/v1/user') return authed ? json(session().user) : json({ msg: 'not signed in' }, 401)
      return json({}, 200)
    }
    if (url.pathname === '/rest/v1/garden_gardens') return json(gardens.filter((g) => visible(g.id)))
    if (url.pathname === '/rest/v1/garden_members') return json(authed ? members : [])
    if (url.pathname === '/rest/v1/rpc/garden_invite_code') return json('a1b2c3d4e5f6')
    if (url.pathname === '/rest/v1/rpc/garden_assign_plants') {
      const { p_bed, p_plants } = JSON.parse(req.postData() || '{}') as { p_bed: string; p_plants: string[] }
      p_plants.forEach((id) => { const r = db.garden_plants.find((x) => x.id === id); if (r) r.bed_id = p_bed })
      return json(p_plants.length)
    }
    if (url.pathname === '/functions/v1/garden-ai') {
      const body = JSON.parse(req.postData() || '{}')
      return json(body.action === 'status' ? { configured: false, model: null } : { demo: true })
    }
    if (url.pathname === '/rest/v1/rpc/garden_search') {
      const { q } = JSON.parse(req.postData() || '{}') as { q: string }
      const words = q.toLowerCase().split(/\s+/).filter(Boolean)
      const hit = (t: string) => words.every((w) => t.toLowerCase().split(/[^a-z0-9-]+/).some((tok) => tok.startsWith(w)))
      return json([
        ...db.garden_plants.filter((x) => hit(`${x.name} ${x.category} ${x.status} ${x.notes ?? ''}`)).map((x) => ({ kind: 'plant', id: x.id, title: x.name, detail: `${x.category} · ${x.status}`, rank: 0.6 })),
        ...db.garden_beds.filter((x) => hit(`${x.code} ${x.name}`)).map((x) => ({ kind: 'bed', id: x.id, title: `${x.code} · ${x.name}`, detail: String(x.soil_type), rank: 0.5 })),
        ...db.garden_harvests.filter((x) => hit(String(x.plant_name))).map((x) => ({ kind: 'harvest', id: x.id, title: x.plant_name, detail: `${x.quantity} ${x.unit}`, rank: 0.4 }))
      ])
    }
    if (url.pathname === '/rest/v1/rpc/garden_ai_stats') {
      return json({ window_hours: 24, total: 42, errors: 0, client_errors: 1, rate_limited: 0, demo: 42, avg_ms: 120, p95_ms: 310, by_action: { recommend: 20, chat: 22 }, last_error: null, last_call_at: now() })
    }

    const table = url.pathname.replace('/rest/v1/', '')
    const rows = db[table]
    if (!rows) return json({ message: `relation "${table}" does not exist` }, 404)
    const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
    const idEq = url.searchParams.get('id')?.replace('eq.', '')

    if (req.method() === 'GET') {
      const g = url.searchParams.get('garden_id')?.replace('eq.', '')
      return json(rows.filter((r) => visible(r.garden_id) && (!g || r.garden_id === g)))
    }
    if (control.slowWrites) await new Promise((r) => setTimeout(r, control.slowWrites))
    if (control.failNextWrite) { control.failNextWrite = false; return json({ code: '23514', message: 'new row for relation violates check constraint "mock_failure"' }, 400) }
    const target = req.method() === 'POST' ? (Array.isArray(JSON.parse(req.postData() || '{}')) ? JSON.parse(req.postData()!)[0] : JSON.parse(req.postData() || '{}')).garden_id ?? DEMO : rows.find((r) => r.id === idEq)?.garden_id
    if (!writable(target)) return json({ code: '42501', message: 'new row violates row-level security policy' }, 403)
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}')
      const list = (Array.isArray(body) ? body : [body]).map((r: Record<string, unknown>) => ({
        id: uuid(), created_at: now(), notes: null, ...(table === 'garden_beds' ? { code: `BED-0${nextBed++}`, zone: null } : {}), ...r
      }))
      rows.unshift(...list)
      return json(single ? list[0] : list, 201)
    }
    if (req.method() === 'PATCH') {
      const row = rows.find((r) => r.id === idEq)
      if (!row) return json({ message: 'not found' }, 404)
      Object.assign(row, JSON.parse(req.postData() || '{}'))
      return json(single ? row : [row])
    }
    if (req.method() === 'DELETE') {
      db[table] = rows.filter((r) => r.id !== idEq)
      return route.fulfill({ status: 204, headers: CORS })
    }
    return json({ message: 'unsupported' }, 400)
  }

  await page.route(`${MOCK_URL}/**`, handle)
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort())
  return Object.assign(db, { control }) as typeof db & { control: MockControl }
}

// ---- app.spec.ts ----
test.describe('app', () => {
test.beforeEach(async ({ page }) => { await mockSupabase(page) })

test('landing page renders and opens the app', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Grow together.')
  await page.getByRole('link', { name: 'Open app' }).first().click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Garden overview' })).toBeVisible()
})

test('dashboard shows live numbers from the database', async ({ page }) => {
  await page.goto('/dashboard')
  const beds = page.locator('p', { hasText: 'Total garden beds' }).locator('xpath=following-sibling::p[1]')
  await expect(beds).toHaveText('3')
  await expect(page.getByText('Water the herb spiral').first()).toBeVisible()
})

test('creating a bed validates input, then saves with a database-assigned ID', async ({ page }) => {
  await page.goto('/beds')
  await page.getByRole('button', { name: 'Add bed' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add a garden bed' })
  await dialog.getByRole('button', { name: 'Create bed' }).click()
  await expect(dialog.getByText('Give the bed a name.')).toBeVisible()

  await dialog.getByPlaceholder('e.g. Sunny Corner').fill('sunny corner')
  await dialog.getByRole('button', { name: 'Create bed' }).click()
  await expect(dialog.getByText('Another bed already has this name.')).toBeVisible()

  await dialog.getByPlaceholder('e.g. Sunny Corner').fill('Pollinator Patch')
  await dialog.getByRole('button', { name: 'Create bed' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Bed BED-010 created')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pollinator Patch' })).toBeVisible()
})

test('plant search uses full-text search, including words only in notes', async ({ page }) => {
  await page.goto('/plants')
  await page.getByLabel('Search plants').fill('companion')
  await expect(page.getByText('Full-text')).toBeVisible()
  const rows = page.locator('tbody tr')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Basil')
})

test('Ctrl+K command palette finds records and opens them', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Garden overview' })).toBeVisible()
  await page.keyboard.press('Control+k')
  const dialog = page.getByRole('dialog', { name: 'Search the garden' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('combobox').fill('tom')
  await expect(dialog.getByRole('option', { name: /Tomato · Vegetable/ })).toBeVisible()
  await expect(dialog.getByText('Postgres full-text search · ranked')).toBeVisible()
  await dialog.getByRole('option', { name: /Tomato · Vegetable/ }).click()
  await expect(page).toHaveURL(/\/plants\?q=Tomato/)
  await expect(page.getByLabel('Search plants')).toHaveValue('Tomato')
})

test('AI recommendations are clearly labelled as demo without a key', async ({ page }) => {
  await page.goto('/recommend')
  await page.getByRole('button', { name: 'Recommend plants' }).click()
  await expect(page.getByText('These are rule-based sample picks, not AI output.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add to garden plan' }).first()).toBeVisible()
})

test('harvest form rejects fractional piece counts', async ({ page }) => {
  await page.goto('/harvests')
  await page.getByRole('button', { name: 'Record harvest' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Record a harvest' })
  await dialog.getByLabel('Plant name').fill('Okra')
  await dialog.getByLabel('Quantity').fill('2.5')
  await dialog.getByLabel('Unit').selectOption('pieces')
  await dialog.getByRole('button', { name: 'Save harvest' }).click()
  await expect(dialog.getByText('Count pieces and bunches in whole numbers.')).toBeVisible()
})

test('settings shows AI service monitoring', async ({ page }) => {
  await page.goto('/settings')
  const card = page.locator('section', { hasText: 'AI service monitoring' })
  await expect(card.getByText('Healthy')).toBeVisible()
  await expect(card.getByText('120 / 310 ms')).toBeVisible()
  await expect(card.getByText('recommend · 20')).toBeVisible()
})

test('unknown routes return to the landing page', async ({ page }) => {
  await page.goto('/does-not-exist')
  await expect(page).toHaveURL(/\/$/)
})

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('dashboard fits the screen with no sideways scrolling', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Garden overview' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await expect(page.getByRole('link', { name: 'Harvest Records' }).last()).toBeVisible()
  })
})
})

// ---- tenancy.spec.ts ----
test.describe('tenancy', () => {
/* Accounts, multi-garden tenancy, roles, optimistic updates and offline mode. */

test('optimistic update: a change shows instantly and rolls back if the server rejects it', async ({ page }) => {
  const db = await mockSupabase(page)
  await page.goto('/dashboard')
  const task = page.getByText('Water the herb spiral').first()
  await expect(task).toBeVisible()
  db.control.slowWrites = 800
  db.control.failNextWrite = true
  await page.getByRole('button', { name: 'Mark “Water the herb spiral” done' }).click()
  await expect(task).toBeHidden({ timeout: 500 }) // before the server has answered
  await expect(page.getByText('Some values are outside the allowed range')).toBeVisible()
  await expect(page.getByText('Water the herb spiral').first()).toBeVisible() // rolled back
})

test('optimistic create: a new bed appears before the database confirms it', async ({ page }) => {
  const db = await mockSupabase(page)
  await page.goto('/beds')
  await page.getByRole('button', { name: 'Add bed' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add a garden bed' })
  await dialog.getByPlaceholder('e.g. Sunny Corner').fill('Rooftop Box')
  db.control.slowWrites = 1500
  await dialog.getByRole('button', { name: 'Create bed' }).click()
  await expect(page.getByRole('heading', { name: 'Rooftop Box' })).toBeAttached({ timeout: 700 })
  await expect(page.getByText(/Bed BED-0\d+ created/)).toBeVisible()
})

test('sign in, switch to a private garden, and see only its data', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/account')
  await page.getByLabel('Email').fill('not-an-email')
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
  await expect(page.getByText('Enter a valid email address.')).toBeVisible()

  await page.getByLabel('Email').fill(USER.email)
  await page.getByLabel('Password').fill('wrong-pass1')
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.')

  await page.getByLabel('Password').fill(USER.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
  await expect(page.getByText(`You’re signed in as ${USER.email}`)).toBeVisible()

  await page.getByRole('button', { name: /Current garden/ }).click()
  await page.getByRole('option', { name: /Srikar’s Private Plot/ }).click()
  await expect(page.getByTestId('invite-code')).toHaveText('a1b2c3d4e5f6')
  await page.goto('/beds')
  await expect(page.getByRole('heading', { name: 'My Secret Bed' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sunny Corner' })).toHaveCount(0)

  // session survives a reload
  await page.reload()
  await expect(page.getByRole('heading', { name: 'My Secret Bed' })).toBeVisible()
})

test('signed-out visitors cannot see private gardens; read-only gardens disable editing', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/beds')
  await page.getByRole('button', { name: /Current garden/ }).click()
  await expect(page.getByRole('option', { name: /Private Plot/ })).toHaveCount(0)
  await page.getByRole('option', { name: /Neighbours/ }).click()
  await expect(page.getByRole('heading', { name: 'Neighbours’ Plot' })).toBeVisible()
  await expect(page.getByTestId('status-ro')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add bed' }).first()).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Edit BED-101' })).toBeDisabled()
})

test('offline: edits are queued, then synced when the connection returns', async ({ page, context }) => {
  const db = await mockSupabase(page)
  await page.goto('/dashboard')
  await expect(page.getByText('Water the herb spiral').first()).toBeVisible()
  await context.setOffline(true)
  await expect(page.getByTestId('status-off')).toBeVisible()
  await page.getByRole('button', { name: 'Mark “Water the herb spiral” done' }).click()
  await expect(page.getByTestId('status-q')).toContainText('1 change waiting to sync')
  expect(db.garden_tasks.find((t) => t.title === 'Water the herb spiral')?.done).toBe(false)
  await context.setOffline(false)
  await expect(page.getByTestId('status-q')).toBeHidden()
  await expect.poll(() => db.garden_tasks.find((t) => t.title === 'Water the herb spiral')?.done).toBe(true)
})
})
