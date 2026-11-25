// All unit and component tests (Vitest) in one file.
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import { decimals, hasErrors, isDate, validateBed, validateHarvest, validatePlant, validateTask, addDays, daysBetween, toKg, monthKey, parseISO, toISO, lastMonths, toCSV, CATALOG, findCatalog, lookShape, occupancy, area, keep, localMatch, normaliseQuery, tokens, errorRate, healthLabel, type AiStats, type Bed, type Plant, analyseLeaf, chat, recommend, EMPTY_ROWS, applyCreate, applyRemove, applySaved, applyUpdate, draftRow, isPending, newId, toDb, type Rows, enqueue, loadSnapshot, readOutbox, saveSnapshot, writeOutbox, isNetworkError, type OutboxOp, accessFor, authError, canWriteWith, validateCredentials, type Garden, type GardenMember, type Task, EmptyState, Progress, ToastProvider, BedForm, DataCtx, type DataApi } from './app'
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Unmount rendered components between tests.
afterEach(() => cleanup())

// ============================================================
// validate.test.ts
// ============================================================
{
const TODAY = '2026-11-22'
const bed = { name: 'Sunny Corner', length_m: '2.4', width_m: '1.2', soil_type: 'Loamy', zone: '', notes: '' }
const plant = { name: 'Tomato', category: 'Vegetable', status: 'sown', quantity: '4', sowing_date: '2026-11-01', expected_harvest_date: '2027-01-15', notes: '' }
const harvest = { plant_name: 'Tomato', harvested_on: '2026-11-20', quantity: '2.5', unit: 'kg', notes: '' }
const task = { title: 'Water the herb spiral', type: 'water', due_date: '2026-11-25' }

describe('isDate and decimals', () => {
  it('accepts real calendar dates only', () => {
    expect(isDate('2026-02-28')).toBe(true)
    expect(isDate('2024-02-29')).toBe(true) // leap year
    expect(isDate('2026-02-29')).toBe(false)
    expect(isDate('2026-13-01')).toBe(false)
    expect(isDate('2026-1-1')).toBe(false)
    expect(isDate('')).toBe(false)
    expect(isDate(20261122)).toBe(false)
  })
  it('counts decimal places', () => {
    expect(decimals('2')).toBe(0)
    expect(decimals('2.5')).toBe(1)
    expect(decimals('2.125')).toBe(3)
    expect(decimals(1.25)).toBe(2)
  })
})

describe('validateBed', () => {
  it('accepts a valid bed', () => expect(validateBed(bed)).toEqual({}))
  it('requires a trimmed name', () => expect(validateBed({ ...bed, name: '   ' }).name).toMatch(/name/))
  it('rejects names over 60 characters', () => expect(validateBed({ ...bed, name: 'x'.repeat(61) }).name).toBeDefined())
  it('rejects duplicate names, ignoring case and spaces', () => {
    expect(validateBed({ ...bed, name: 'sunny corner ' }, { existingNames: ['Sunny Corner'] }).name).toMatch(/already/)
  })
  it.each([
    ['0', /above 0/], ['-2', /above 0/], ['abc', /above 0/], ['', /above 0/], ['0.05', /0.1/], ['101', /100/], ['2.345', /decimal/]
  ])('rejects length %s', (len, msg) => expect(validateBed({ ...bed, length_m: len }).length_m).toMatch(msg))
  it('accepts the boundary sizes 0.1 and 100', () => {
    expect(validateBed({ ...bed, length_m: '0.1', width_m: '100' })).toEqual({})
  })
  it('requires a known soil type', () => expect(validateBed({ ...bed, soil_type: 'Lava' }).soil_type).toBeDefined())
  it('limits notes to 500 characters', () => expect(validateBed({ ...bed, notes: 'n'.repeat(501) }).notes).toBeDefined())
})

describe('validatePlant', () => {
  it('accepts a valid plant', () => expect(validatePlant(plant, TODAY)).toEqual({}))
  it('accepts a planned plant with no dates', () => {
    expect(validatePlant({ ...plant, status: 'planned', sowing_date: '', expected_harvest_date: '' }, TODAY)).toEqual({})
  })
  it('requires a sowing date once the plant is in the ground', () => {
    expect(validatePlant({ ...plant, sowing_date: '' }, TODAY).sowing_date).toMatch(/sowing date/)
  })
  it('rejects a future sowing date for a plant that is already growing', () => {
    expect(validatePlant({ ...plant, status: 'growing', sowing_date: '2026-12-10', expected_harvest_date: '2027-03-01' }, TODAY).sowing_date).toMatch(/future/)
  })
  it('allows a future sowing date while still planned', () => {
    expect(validatePlant({ ...plant, status: 'planned', sowing_date: '2026-12-10', expected_harvest_date: '2027-03-01' }, TODAY)).toEqual({})
  })
  it('rejects harvest before sowing', () => {
    expect(validatePlant({ ...plant, expected_harvest_date: '2026-10-01' }, TODAY).expected_harvest_date).toMatch(/before sowing/)
  })
  it('rejects impossible and out-of-range dates', () => {
    expect(validatePlant({ ...plant, sowing_date: '2026-02-30' }, TODAY).sowing_date).toMatch(/valid/)
    expect(validatePlant({ ...plant, sowing_date: '1999-12-31' }, TODAY).sowing_date).toMatch(/past/)
    expect(validatePlant({ ...plant, status: 'planned', sowing_date: '2028-01-01', expected_harvest_date: '' }, TODAY).sowing_date).toMatch(/year ahead/)
    expect(validatePlant({ ...plant, expected_harvest_date: '2031-01-01' }, TODAY).expected_harvest_date).toMatch(/3 years/)
  })
  it.each(['0', '1.5', '10001', '-1', ''])('rejects quantity %s', (q) => {
    expect(validatePlant({ ...plant, quantity: q }, TODAY).quantity).toBeDefined()
  })
  it('rejects unknown category and status', () => {
    const e = validatePlant({ ...plant, category: 'Tree', status: 'dead' }, TODAY)
    expect(e.category).toBeDefined(); expect(e.status).toBeDefined()
  })
})

describe('validateHarvest', () => {
  it('accepts a valid harvest', () => expect(validateHarvest(harvest, {}, TODAY)).toEqual({}))
  it('rejects a future harvest date', () => expect(validateHarvest({ ...harvest, harvested_on: '2026-11-23' }, {}, TODAY).harvested_on).toMatch(/future/))
  it('accepts a harvest dated today', () => expect(validateHarvest({ ...harvest, harvested_on: TODAY }, {}, TODAY)).toEqual({}))
  it('rejects a harvest before the plant was sown', () => {
    expect(validateHarvest({ ...harvest, harvested_on: '2026-10-01' }, { sowingDate: '2026-11-01' }, TODAY).harvested_on).toMatch(/sown after/)
  })
  it('requires whole numbers for pieces and bunches', () => {
    expect(validateHarvest({ ...harvest, unit: 'pieces', quantity: '2.5' }, {}, TODAY).quantity).toMatch(/whole/)
    expect(validateHarvest({ ...harvest, unit: 'bunches', quantity: '3' }, {}, TODAY)).toEqual({})
  })
  it.each([['0', /above 0/], ['-3', /above 0/], ['100001', /too large/], ['1.234', /decimal/], ['', /above 0/]])('rejects quantity %s', (q, msg) => {
    expect(validateHarvest({ ...harvest, quantity: q }, {}, TODAY).quantity).toMatch(msg)
  })
  it('requires a known unit and a plant name', () => {
    const e = validateHarvest({ ...harvest, unit: 'tonnes', plant_name: ' ' }, {}, TODAY)
    expect(e.unit).toBeDefined(); expect(e.plant_name).toBeDefined()
  })
})

describe('validateTask', () => {
  it('accepts a valid task', () => expect(validateTask(task, TODAY)).toEqual({}))
  it('requires a title under 80 characters', () => {
    expect(validateTask({ ...task, title: '' }, TODAY).title).toBeDefined()
    expect(validateTask({ ...task, title: 't'.repeat(81) }, TODAY).title).toBeDefined()
  })
  it('keeps due dates within five years', () => {
    expect(validateTask({ ...task, due_date: '2035-01-01' }, TODAY).due_date).toMatch(/five years/)
    expect(validateTask({ ...task, due_date: 'soon' }, TODAY).due_date).toBeDefined()
  })
  it('hasErrors reflects the result', () => {
    expect(hasErrors(validateTask(task, TODAY))).toBe(false)
    expect(hasErrors(validateTask({ ...task, type: 'dance' }, TODAY))).toBe(true)
  })
})
}

// ============================================================
// lib.test.ts
// ============================================================
{
describe('format helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('counts days between dates', () => {
    expect(daysBetween('2026-11-01', '2026-11-22')).toBe(21)
    expect(daysBetween('2026-11-22', '2026-11-01')).toBe(-21)
  })
  it('round-trips ISO dates', () => expect(toISO(parseISO('2026-07-04'))).toBe('2026-07-04'))
  it('converts weights to kg and leaves counts alone', () => {
    expect(toKg({ quantity: 2, unit: 'kg' })).toBe(2)
    expect(toKg({ quantity: 500, unit: 'g' })).toBe(0.5)
    expect(toKg({ quantity: 1, unit: 'lb' })).toBeCloseTo(0.4536, 4)
    expect(toKg({ quantity: 12, unit: 'pieces' })).toBeNull()
    expect(toKg({ quantity: 3, unit: 'bunches' })).toBeNull()
  })
  it('builds month keys', () => {
    expect(monthKey('2026-11-22')).toBe('2026-11')
    const m = lastMonths(6)
    expect(m).toHaveLength(6)
    expect(m[5]).toBe(toISO(new Date()).slice(0, 7))
  })
})

describe('CSV export', () => {
  it('writes a header and quotes special characters (RFC 4180)', () => {
    const csv = toCSV([{ plant: 'Tomato, cherry', notes: 'said "great"', qty: 2 }, { plant: 'Basil', notes: 'line\nbreak', qty: null }])
    expect(csv.split('\r\n')[0]).toBe('plant,notes,qty')
    expect(csv).toContain('"Tomato, cherry","said ""great""",2')
    expect(csv).toContain('Basil,"line\nbreak",')
  })
  it('respects an explicit column order and handles empty input', () => {
    expect(toCSV([{ a: 1, b: 2 }], ['b', 'a'])).toBe('b,a\r\n2,1')
    expect(toCSV([])).toBe('')
  })
})

describe('crop catalogue', () => {
  it('has unique crop names and sensible values', () => {
    expect(new Set(CATALOG.map((c) => c.name)).size).toBe(CATALOG.length)
    for (const c of CATALOG) {
      expect(c.days).toBeGreaterThan(0)
      expect(c.seasons.length).toBeGreaterThan(0)
      expect(c.soils.length).toBeGreaterThan(0)
    }
  })
  it('finds crops case-insensitively and falls back for unknown plants', () => {
    expect(findCatalog('  tomato ')?.name).toBe('Tomato')
    expect(findCatalog('Dragonfruit')).toBeUndefined()
    expect(lookShape('Dragonfruit', 'Fruit').shape).toBe('berry')
  })
})

describe('bed occupancy', () => {
  const beds = [{ id: 'b1', length_m: 2, width_m: 1.5 }, { id: 'b2', length_m: 3, width_m: 1 }] as Bed[]
  const plants = [
    { id: 'p1', bed_id: 'b1', status: 'growing' }, { id: 'p2', bed_id: 'b1', status: 'harvested' }, { id: 'p3', bed_id: null, status: 'sown' }
  ] as Plant[]
  it('counts only unharvested plants in each bed', () => {
    const occ = occupancy(beds, plants)
    expect(occ.get('b1')?.map((p) => p.id)).toEqual(['p1'])
    expect(occ.get('b2')).toEqual([])
  })
  it('computes bed area', () => expect(area(beds[0])).toBe(3))
})

describe('search helpers', () => {
  it('normalises and tokenises queries like the database does', () => {
    expect(normaliseQuery('  cherry   tomato ')).toBe('cherry tomato')
    expect(normaliseQuery(null)).toBe('')
    expect(tokens("Tom's BED-003!!")).toEqual(['tom', 's', 'bed-003'])
    expect(tokens('--- ')).toEqual([])
  })
  it('matches every word, case-insensitively', () => {
    expect(localMatch('Tomato Vegetable flowering', 'tom flow')).toBe(true)
    expect(localMatch('Tomato Vegetable', 'tom basil')).toBe(false)
    expect(localMatch('anything', '   ')).toBe(true)
  })
  it('keeps items found by full-text search even when the local text does not match', () => {
    expect(keep('p1', 'Basil', 'companion', new Set(['p1']))).toBe(true)
    expect(keep('p2', 'Basil', 'companion', new Set(['p1']))).toBe(false)
    expect(keep('p2', 'Basil', 'bas', null)).toBe(true)
    expect(keep('p2', 'Basil', '', null)).toBe(true)
  })
})

describe('AI monitoring helpers', () => {
  const base: AiStats = { window_hours: 24, total: 0, errors: 0, client_errors: 0, rate_limited: 0, demo: 0, avg_ms: 0, p95_ms: 0, by_action: {}, last_error: null, last_call_at: null }
  it('reports no calls, healthy, degraded and unhealthy states', () => {
    expect(healthLabel(base).label).toBe('No calls yet')
    expect(healthLabel({ ...base, total: 50, avg_ms: 900, p95_ms: 2000 }).label).toBe('Healthy')
    expect(healthLabel({ ...base, total: 50, errors: 2 }).label).toBe('Degraded')
    expect(healthLabel({ ...base, total: 50, p95_ms: 20000 }).label).toBe('Degraded')
    expect(healthLabel({ ...base, total: 10, errors: 3 }).label).toBe('Unhealthy')
  })
  it('computes the server error rate safely', () => {
    expect(errorRate({ total: 0, errors: 0 })).toBe(0)
    expect(errorRate({ total: 8, errors: 2 })).toBe(0.25)
  })
})
}

// ============================================================
// ai.test.ts
// ============================================================
{
// The test environment has no Supabase URL/key, so every AI call must fall
// back to clearly labelled demo results instead of failing or pretending.

const beds = [
  { id: 'b1', code: 'BED-001', soil_type: 'Loamy', length_m: 2, width_m: 1 },
  { id: 'b2', code: 'BED-002', soil_type: 'Sandy', length_m: 2, width_m: 1 }
] as Bed[]
const plants = [{ id: 'p1', bed_id: 'b1', status: 'growing' }] as Plant[]
const inputs = { location: 'Hyderabad', season: 'Winter' as const, soil: 'Sandy', space: 10, sunlight: 'Full sun (6+ hours)', water: 'Medium (2–3 times a week)' }

describe('AI demo mode', () => {
  it('returns labelled, rule-based recommendations', async () => {
    const r = await recommend(inputs, beds, plants)
    expect(r.demo).toBe(true)
    expect(r.summary).toMatch(/not AI/i)
    expect(r.recommendations.length).toBe(5)
    for (const rec of r.recommendations) expect(rec.days_to_harvest).toBeGreaterThan(0)
  })
  it('only suggests free beds', async () => {
    const r = await recommend(inputs, beds, plants)
    for (const rec of r.recommendations) expect(['BED-002', 'Any free bed']).toContain(rec.recommended_bed)
  })
  it('never claims to have analysed a leaf photo in demo mode', async () => {
    const r = await analyseLeaf('aGVsbG8=', 'image/jpeg', 'Tomato', '')
    expect(r.demo).toBe(true)
    expect(r.confidence).toBeNull()
    expect(r.overall).toMatch(/not analysed/i)
  })
  it('labels chat replies as demo and answers by topic', async () => {
    const r = await chat([{ role: 'user', content: 'How often should I water?', at: '' }], {})
    expect(r.demo).toBe(true)
    expect(r.reply).toMatch(/Demo mode/)
    expect(r.reply).toMatch(/water/i)
  })
})
}

// ============================================================
// tenancy.test.ts
// ============================================================
{
const G = 'g-1'
const bed = { id: 'b1', code: 'BED-001', name: 'A', length_m: 1, width_m: 1, soil_type: 'Loamy', zone: null, notes: null, created_at: '' } as Bed
const plant = { id: 'p1', name: 'Tomato', category: 'Vegetable', bed_id: 'b1', sowing_date: null, expected_harvest_date: null, status: 'growing', quantity: 1, notes: null, created_at: '' } as Plant
const task = { id: 't1', title: 'Water', type: 'water', due_date: '2026-01-01', bed_id: 'b1', plant_id: 'p1', done: false, notes: null, created_at: '' } as Task
const base: Rows = { ...EMPTY_ROWS, beds: [bed], plants: [plant], tasks: [task] }

describe('optimistic state changes', () => {
  it('draft rows get an id, the garden and DB-style defaults, and are marked pending', () => {
    const d = draftRow('garden_plants', { name: 'Basil', category: 'Herb' }, G) as Plant & { garden_id: string }
    expect(d.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(d.garden_id).toBe(G)
    expect(d.status).toBe('planned')
    expect(d.quantity).toBe(1)
    expect(isPending(d)).toBe(true)
    expect((draftRow('garden_beds', { name: 'X' }, G) as Bed).code).toBe('BED-…')
  })
  it('newId makes unique ids', () => { expect(new Set(Array.from({ length: 200 }, newId)).size).toBe(200) })
  it('create puts the row first and replaces a row with the same id', () => {
    const d = draftRow('garden_beds', { name: 'B' }, G)
    const r = applyCreate(base, 'garden_beds', d)
    expect(r.beds[0]).toBe(d)
    expect(applyCreate(r, 'garden_beds', d).beds).toHaveLength(2)
  })
  it('saved row replaces the draft (clearing pending), and update marks pending', () => {
    const r = applyUpdate(base, 'garden_tasks', 't1', { done: true })
    expect(r.tasks[0].done).toBe(true); expect(isPending(r.tasks[0])).toBe(true)
    const s = applySaved(r, 'garden_tasks', { ...task, done: true })
    expect(isPending(s.tasks[0])).toBe(false)
    expect(base.tasks[0].done).toBe(false) // the original state is untouched, so rollback is just "use the old state"
  })
  it('removing a bed unlinks plants and tasks; removing a plant cascades its tasks', () => {
    const r = applyRemove(base, 'garden_beds', 'b1')
    expect(r.beds).toHaveLength(0); expect(r.plants[0].bed_id).toBeNull(); expect(r.tasks[0].bed_id).toBeNull()
    expect(applyRemove(base, 'garden_plants', 'p1').tasks).toHaveLength(0)
  })
  it('toDb strips client-only fields', () => { expect(toDb({ id: 'x', _pending: true })).toEqual({ id: 'x' }) })
})

describe('offline outbox and cache', () => {
  beforeEach(() => localStorage.clear())
  const ins: OutboxOp = { kind: 'insert', table: 'garden_tasks', gardenId: G, row: { id: 'n1', title: 'A' }, at: 1 }
  it('collapses an update into a queued insert of the same row', () => {
    const q = enqueue([ins], { kind: 'update', table: 'garden_tasks', gardenId: G, id: 'n1', patch: { title: 'B' }, at: 2 })
    expect(q).toHaveLength(1); expect((q[0] as typeof ins).row.title).toBe('B')
  })
  it('deleting a row that was never sent drops it entirely', () => {
    expect(enqueue([ins], { kind: 'delete', table: 'garden_tasks', gardenId: G, id: 'n1', at: 3 })).toHaveLength(0)
  })
  it('deleting a saved row replaces its queued updates with one delete', () => {
    const up: OutboxOp = { kind: 'update', table: 'garden_tasks', gardenId: G, id: 's1', patch: { done: true }, at: 1 }
    const q = enqueue([up], { kind: 'delete', table: 'garden_tasks', gardenId: G, id: 's1', at: 2 })
    expect(q).toEqual([{ kind: 'delete', table: 'garden_tasks', gardenId: G, id: 's1', at: 2 }])
  })
  it('persists the outbox and per-garden snapshots', () => {
    writeOutbox([ins]); expect(readOutbox()).toEqual([ins])
    saveSnapshot(G, base); expect(loadSnapshot(G)?.rows.beds[0].id).toBe('b1'); expect(loadSnapshot('other')).toBeNull()
  })
  it('survives corrupted storage', () => { localStorage.setItem('cgp-outbox', '{bad'); expect(readOutbox()).toEqual([]) })
  it('recognises network failures', () => {
    expect(isNetworkError(new Error('TypeError: Failed to fetch'))).toBe(true)
    expect(isNetworkError({ message: 'violates check constraint' })).toBe(false)
  })
})

describe('roles and access', () => {
  const g = (visibility: Garden['visibility']): Garden => ({ id: 'g', name: 'G', visibility, created_by: null, created_at: '' })
  const m = (role: GardenMember['role']): GardenMember[] => [{ garden_id: 'g', user_id: 'u', role, email: null, joined_at: '' }]
  it('members get their role; everyone can edit the open demo; public gardens are read-only for outsiders', () => {
    expect(accessFor(g('private'), m('owner'), 'u')).toBe('owner')
    expect(accessFor(g('private'), m('viewer'), 'u')).toBe('viewer')
    expect(accessFor(g('public_open'), [], undefined)).toBe('open')
    expect(accessFor(g('public_read'), [], undefined)).toBe('public')
    expect(accessFor(g('public_read'), m('editor'), 'someone-else')).toBe('public')
  })
  it('only owner, editor and the open demo can write', () => {
    expect(['owner', 'editor', 'open', 'viewer', 'public'].map((a) => canWriteWith(a as never))).toEqual([true, true, true, false, false])
  })
  it('auth errors become plain sentences', () => {
    expect(authError(new Error('Invalid login credentials'))).toBe('Email or password is incorrect.')
    expect(authError({ message: 'User already registered' })).toMatch(/already exists/)
  })
  it('validates sign-in and sign-up input', () => {
    expect(validateCredentials('bad', 'x', 'in').email).toBeTruthy()
    expect(validateCredentials('a@b.co', '', 'in').password).toBe('Enter your password.')
    expect(validateCredentials('a@b.co', 'short1', 'up').password).toMatch(/8 characters/)
    expect(validateCredentials('a@b.co', 'longpassword', 'up').password).toMatch(/number/)
    expect(validateCredentials('a@b.co', 'grow1234', 'up')).toEqual({})
  })
})
}

// ============================================================
// components.test.tsx
// ============================================================
{
// BedForm talks to the data layer through useData(); replace it with an in-memory fake.
const create = vi.fn(async (_t: string, row: Record<string, unknown>) => ({ id: 'new', code: 'BED-010', ...row }))
const fakeData = { create, update: vi.fn(), beds: [{ id: 'b1', name: 'Sunny Corner' }], plants: [] } as unknown as DataApi

const renderForm = () => render(<MemoryRouter><ToastProvider><DataCtx.Provider value={fakeData}><BedForm open onClose={() => {}} /></DataCtx.Provider></ToastProvider></MemoryRouter>)

describe('UI components', () => {
  it('EmptyState shows its title, body and action', () => {
    render(<EmptyState title="No beds yet" body="Add one to start" action={<button>Add bed</button>} />)
    expect(screen.getByText('No beds yet')).toBeTruthy()
    expect(screen.getByText('Add one to start')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add bed' })).toBeTruthy()
  })
  it('Progress clamps its value and exposes it to screen readers', () => {
    render(<Progress value={1.7} />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('170')
    const bar = screen.getByRole('progressbar').firstElementChild as HTMLElement
    expect(bar.style.width).toBe('100%')
  })
})

describe('BedForm', () => {
  it('blocks an empty name and does not save', async () => {
    renderForm()
    fireEvent.change(screen.getByPlaceholderText('e.g. Sunny Corner'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create bed' }))
    expect(await screen.findByText('Give the bed a name.')).toBeTruthy()
    expect(create).not.toHaveBeenCalled()
  })
  it('blocks a duplicate bed name', async () => {
    renderForm()
    fireEvent.change(screen.getByPlaceholderText('e.g. Sunny Corner'), { target: { value: 'sunny corner' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create bed' }))
    expect(await screen.findByText('Another bed already has this name.')).toBeTruthy()
    expect(create).not.toHaveBeenCalled()
  })
  it('saves a valid bed with trimmed, typed values', async () => {
    renderForm()
    fireEvent.change(screen.getByPlaceholderText('e.g. Sunny Corner'), { target: { value: '  Herb Spiral  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create bed' }))
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    const [table, row] = create.mock.calls[0]
    expect(table).toBe('garden_beds')
    expect(row).toMatchObject({ name: 'Herb Spiral', length_m: 2.4, width_m: 1.2, soil_type: 'Loamy', zone: null, notes: null })
  })
})
}
