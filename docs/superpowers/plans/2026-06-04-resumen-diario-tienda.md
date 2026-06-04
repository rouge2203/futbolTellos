# Resumen Diario de Tienda (Daily Store Totals) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an always-on "Resumen Diario" section to the store dashboard that shows, for each day in the selected range, the totals split by SINPE / Efectivo / Transferencia plus a grand total — so the client never has to sum transactions by hand or run a manual cierre to know a day's numbers.

**Architecture:** Extract the day-by-day aggregation into a pure, unit-tested utility (`groupVentasByDay`) that takes the already-fetched/filtered `producto_ventas` rows and returns one summary row per calendar day (Costa Rica timezone), broken down by payment method. The `TiendaDashboard` component computes this with `useMemo` from the existing `filteredVentaRows` (so it automatically respects the current date/location/product filters) and renders a new card. Visibility is gated behind `isSuperuser`, matching the existing "Registrar Cierre" button. No database changes, no backend changes — this is pure frontend on top of data the dashboard already loads.

**Tech Stack:** React 19, TypeScript ~5.9, Vite 7, Tailwind v4, Supabase JS. Tests run with **Vitest** (added in Task 1 — the repo currently has no test runner).

---

## File Structure

- **Create:** `vitest.config.ts` — Vitest configuration (node environment, no DOM needed for pure-function tests).
- **Create:** `src/pages/admin/tienda/utils/dailyTotals.ts` — pure aggregation utility: `getCostaRicaDayKey()` and `groupVentasByDay()` plus the `DailyTotal` type.
- **Create:** `src/pages/admin/tienda/utils/dailyTotals.test.ts` — unit tests for the utility.
- **Modify:** `src/pages/admin/tienda/TiendaDashboard.tsx` — import the utility, add a `dailyTotals` memo from `filteredVentaRows`, render the new "Resumen Diario" card.
- **Modify:** `package.json` — add `vitest` dev dependency and a `"test"` script.

---

## Task 0: Create the working branch

**Files:** none (git only)

- [ ] **Step 1: Create and switch to a feature branch**

Run (from the repo root `/Users/rouge/Projects/Lobster/futboltellos`):

```bash
git checkout main
git pull --ff-only || true
git checkout -b feature/resumen-diario-tienda
```

Expected: `Switched to a new branch 'feature/resumen-diario-tienda'`

- [ ] **Step 2: Confirm clean starting state**

Run: `git status`
Expected: `On branch feature/resumen-diario-tienda`, nothing to commit (or only this plan file untracked).

---

## Task 1: Add Vitest test runner

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install Vitest**

Run:

```bash
npm install -D vitest@^3
```

Expected: vitest added under `devDependencies`, no peer-dependency errors that abort install.

- [ ] **Step 2: Add the test script to `package.json`**

In `package.json`, change the `"scripts"` block from:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
```

to:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 3: Create `vitest.config.ts`**

Create `vitest.config.ts` at the repo root with exactly:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Verify the runner works with no tests yet**

Run: `npm test`
Expected: Vitest runs and reports "No test files found" (exit is non-zero but that's fine — it confirms Vitest is wired up). Proceed to Task 2.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest test runner"
```

---

## Task 2: Costa Rica day-key helper (TDD)

**Files:**
- Create: `src/pages/admin/tienda/utils/dailyTotals.ts`
- Test: `src/pages/admin/tienda/utils/dailyTotals.test.ts`

**Why:** Sales timestamps are stored with timezone info. Two sales at "11:30pm" and "12:30am" must land on the correct *Costa Rica calendar day*, not the UTC day. Costa Rica is UTC−6 year-round (no DST), so `Intl` with `America/Costa_Rica` is reliable.

- [ ] **Step 1: Write the failing test**

Create `src/pages/admin/tienda/utils/dailyTotals.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getCostaRicaDayKey } from "./dailyTotals";

describe("getCostaRicaDayKey", () => {
  it("returns the CR calendar day for a CR-offset timestamp", () => {
    expect(getCostaRicaDayKey("2026-06-02T23:30:00-06:00")).toBe("2026-06-02");
  });

  it("returns the previous CR day for a late-night UTC timestamp", () => {
    // 2026-06-03 04:30 UTC === 2026-06-02 22:30 in Costa Rica
    expect(getCostaRicaDayKey("2026-06-03T04:30:00Z")).toBe("2026-06-02");
  });

  it("handles midnight at CR offset", () => {
    expect(getCostaRicaDayKey("2026-06-02T00:00:00-06:00")).toBe("2026-06-02");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve module `./dailyTotals` / `getCostaRicaDayKey is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/pages/admin/tienda/utils/dailyTotals.ts`:

```ts
/**
 * Returns the Costa Rica (UTC-6, no DST) calendar day for an ISO timestamp,
 * formatted as YYYY-MM-DD. en-CA locale yields ISO-style date parts.
 */
export function getCostaRicaDayKey(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    timeZone: "America/Costa_Rica",
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 3 passing tests for `getCostaRicaDayKey`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/tienda/utils/dailyTotals.ts src/pages/admin/tienda/utils/dailyTotals.test.ts
git commit -m "feat: add Costa Rica day-key helper for tienda daily totals"
```

---

## Task 3: `groupVentasByDay` aggregation (TDD)

**Files:**
- Modify: `src/pages/admin/tienda/utils/dailyTotals.ts`
- Test: `src/pages/admin/tienda/utils/dailyTotals.test.ts`

**Behavior:** Take raw `producto_ventas` line rows and produce one `DailyTotal` per CR day, sorted newest day first. Each line's value is `precio_unitario * cantidad`. Split into `efectivo` / `sinpe` / `transferencia`; any other method folds into `otros` but always counts toward `total`. `transacciones` is the count of distinct `transaccion_id` (falling back to `legacy-<id>` for rows without one), matching how the dashboard groups transactions elsewhere.

- [ ] **Step 1: Write the failing test (append to the existing test file)**

Append to `src/pages/admin/tienda/utils/dailyTotals.test.ts`:

```ts
import { groupVentasByDay, type VentaForDaily } from "./dailyTotals";

const v = (over: Partial<VentaForDaily>): VentaForDaily => ({
  id: 0,
  transaccion_id: null,
  fecha_venta: null,
  created_at: "2026-06-02T10:00:00-06:00",
  metodo_pago: "efectivo",
  precio_unitario: 0,
  cantidad: 1,
  ...over,
});

describe("groupVentasByDay", () => {
  it("groups by CR day, splits by method, counts distinct transactions, sorts desc", () => {
    const ventas: VentaForDaily[] = [
      // Day A 2026-06-02, transaction t1 (efectivo) with two lines: 500 + 1000
      v({ id: 1, transaccion_id: "t1", fecha_venta: "2026-06-02T09:00:00-06:00", metodo_pago: "efectivo", precio_unitario: 500, cantidad: 1 }),
      v({ id: 2, transaccion_id: "t1", fecha_venta: "2026-06-02T09:00:00-06:00", metodo_pago: "efectivo", precio_unitario: 1000, cantidad: 1 }),
      // Day A, transaction t2 (sinpe): 1000
      v({ id: 3, transaccion_id: "t2", fecha_venta: "2026-06-02T18:00:00-06:00", metodo_pago: "sinpe", precio_unitario: 1000, cantidad: 1 }),
      // Day B 2026-06-03, t3 (transferencia): 800
      v({ id: 4, transaccion_id: "t3", fecha_venta: "2026-06-03T08:00:00-06:00", metodo_pago: "Transferencia", precio_unitario: 800, cantidad: 1 }),
      // Day B, t4 (efectivo): 300 x 2 = 600
      v({ id: 5, transaccion_id: "t4", fecha_venta: "2026-06-03T20:00:00-06:00", metodo_pago: "efectivo", precio_unitario: 300, cantidad: 2 }),
    ];

    const result = groupVentasByDay(ventas);

    expect(result).toHaveLength(2);

    // Newest day first
    expect(result[0]).toEqual({
      dateKey: "2026-06-03",
      efectivo: 600,
      sinpe: 0,
      transferencia: 800,
      otros: 0,
      total: 1400,
      transacciones: 2,
    });

    expect(result[1]).toEqual({
      dateKey: "2026-06-02",
      efectivo: 1500,
      sinpe: 1000,
      transferencia: 0,
      otros: 0,
      total: 2500,
      transacciones: 2,
    });
  });

  it("uses created_at when fecha_venta is null and folds unknown methods into otros", () => {
    const ventas: VentaForDaily[] = [
      v({ id: 9, transaccion_id: null, fecha_venta: null, created_at: "2026-06-01T12:00:00-06:00", metodo_pago: "tarjeta", precio_unitario: 250, cantidad: 1 }),
    ];
    const result = groupVentasByDay(ventas);
    expect(result).toEqual([
      { dateKey: "2026-06-01", efectivo: 0, sinpe: 0, transferencia: 0, otros: 250, total: 250, transacciones: 1 },
    ]);
  });

  it("returns an empty array for no ventas", () => {
    expect(groupVentasByDay([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `groupVentasByDay is not a function` / no export `VentaForDaily`.

- [ ] **Step 3: Write the implementation (append to `dailyTotals.ts`)**

Append to `src/pages/admin/tienda/utils/dailyTotals.ts`:

```ts
export interface VentaForDaily {
  id: number;
  transaccion_id: string | null;
  fecha_venta: string | null;
  created_at: string;
  metodo_pago: string;
  precio_unitario: number;
  cantidad: number;
}

export interface DailyTotal {
  dateKey: string; // YYYY-MM-DD in Costa Rica time
  efectivo: number;
  sinpe: number;
  transferencia: number;
  otros: number;
  total: number;
  transacciones: number; // distinct transaction count
}

const ventaDate = (venta: VentaForDaily): string =>
  venta.fecha_venta ?? venta.created_at;

const transaccionKey = (venta: VentaForDaily): string =>
  venta.transaccion_id ?? `legacy-${venta.id}`;

/**
 * Aggregates raw producto_ventas line rows into one summary per Costa Rica
 * calendar day, split by payment method, sorted newest day first.
 */
export function groupVentasByDay(ventas: VentaForDaily[]): DailyTotal[] {
  const byDay = new Map<
    string,
    { totals: DailyTotal; transacciones: Set<string> }
  >();

  for (const venta of ventas) {
    const dateKey = getCostaRicaDayKey(ventaDate(venta));
    let entry = byDay.get(dateKey);
    if (!entry) {
      entry = {
        totals: {
          dateKey,
          efectivo: 0,
          sinpe: 0,
          transferencia: 0,
          otros: 0,
          total: 0,
          transacciones: 0,
        },
        transacciones: new Set<string>(),
      };
      byDay.set(dateKey, entry);
    }

    const lineValue = venta.precio_unitario * venta.cantidad;
    entry.totals.total += lineValue;
    entry.transacciones.add(transaccionKey(venta));

    switch (venta.metodo_pago.toLowerCase()) {
      case "efectivo":
        entry.totals.efectivo += lineValue;
        break;
      case "sinpe":
        entry.totals.sinpe += lineValue;
        break;
      case "transferencia":
        entry.totals.transferencia += lineValue;
        break;
      default:
        entry.totals.otros += lineValue;
        break;
    }
  }

  return Array.from(byDay.values())
    .map(({ totals, transacciones }) => ({
      ...totals,
      transacciones: transacciones.size,
    }))
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : a.dateKey > b.dateKey ? -1 : 0));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all `getCostaRicaDayKey` and `groupVentasByDay` tests green.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/tienda/utils/dailyTotals.ts src/pages/admin/tienda/utils/dailyTotals.test.ts
git commit -m "feat: add groupVentasByDay aggregation for tienda daily totals"
```

---

## Task 4: Render the "Resumen Diario" section in the dashboard

**Files:**
- Modify: `src/pages/admin/tienda/TiendaDashboard.tsx`

**Notes for the engineer:**
- `filteredVentaRows` (defined ~line 370) already holds the sales for the active date/location/product filters. Use it as the input — the daily view then automatically reflects whatever range the user picked ("Hoy" → one row, "Esta Semana" → up to 7 rows, custom → one row per day).
- `formatCurrency` (line 90), `isSuperuser` (from `useAuth`, line 179) already exist. Do not redefine them.
- Place the new card so it is visible regardless of the analytics grid. Put it directly **above** the "Sales List" block (i.e. right after the Filters `</div>` that closes at line 918, before the `{/* Sales List */}` comment at line 920).

- [ ] **Step 1: Import the utility**

At the top of `TiendaDashboard.tsx`, just below the existing import of `generateCierreTienda` (lines 10-13), add:

```ts
import { groupVentasByDay } from "./utils/dailyTotals";
```

- [ ] **Step 2: Add the `dailyTotals` memo**

Immediately after the `paymentBreakdown` memo (ends at line 523, before `const cierreResumen` at line 525), add:

```ts
  const dailyTotals = useMemo(
    () => groupVentasByDay(filteredVentaRows),
    [filteredVentaRows],
  );
```

(`filteredVentaRows` rows are `Venta` objects, which already include `id`, `transaccion_id`, `fecha_venta`, `created_at`, `metodo_pago`, `precio_unitario`, `cantidad` — a structural superset of `VentaForDaily`, so no mapping is needed.)

- [ ] **Step 3: Add a Spanish day-label formatter**

Add this helper alongside the other module-level formatters (e.g. right after `formatShortDate` at line 151):

```ts
const formatDayKeyLabel = (dateKey: string): string => {
  // Anchor at noon CR to avoid any timezone rollover when re-parsing.
  const d = new Date(`${dateKey}T12:00:00-06:00`);
  return d.toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};
```

- [ ] **Step 4: Render the section**

Between the Filters block and the Sales List block (after the `</div>` on line 918 that closes the Filters `<div className="space-y-3">`, and before `{/* Sales List */}` on line 920), insert:

```tsx
        {/* Daily Totals (Resumen Diario) */}
        {isSuperuser && !loading && dailyTotals.length > 0 && (
          <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
              <DocumentTextIcon className="size-5 text-primary" />
              <h3 className="text-sm font-semibold text-gray-900">
                Resumen Diario
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {dailyTotals.map((day) => (
                <div key={day.dateKey} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 capitalize">
                        {formatDayKeyLabel(day.dateKey)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {day.transacciones} transacción
                        {day.transacciones === 1 ? "" : "es"}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(day.total)}
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="rounded-md bg-blue-50 px-2 py-1.5">
                      <p className="font-medium text-blue-700">SINPE</p>
                      <p className="font-semibold text-blue-800">
                        {formatCurrency(day.sinpe)}
                      </p>
                    </div>
                    <div className="rounded-md bg-green-50 px-2 py-1.5">
                      <p className="font-medium text-green-700">Efectivo</p>
                      <p className="font-semibold text-green-800">
                        {formatCurrency(day.efectivo)}
                      </p>
                    </div>
                    <div className="rounded-md bg-purple-50 px-2 py-1.5">
                      <p className="font-medium text-purple-700">Transferencia</p>
                      <p className="font-semibold text-purple-800">
                        {formatCurrency(day.transferencia)}
                      </p>
                    </div>
                    {day.otros > 0 && (
                      <div className="rounded-md bg-gray-100 px-2 py-1.5">
                        <p className="font-medium text-gray-600">Otros</p>
                        <p className="font-semibold text-gray-800">
                          {formatCurrency(day.otros)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

```

- [ ] **Step 5: Type-check and build**

Run: `npm run build`
Expected: `tsc -b` passes with no type errors and Vite build completes. (If `tsc` complains that `useMemo` or `DocumentTextIcon` is unused — it is not; both are already imported and used.)

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: no new ESLint errors in `TiendaDashboard.tsx` or `dailyTotals.ts`.

- [ ] **Step 7: Re-run unit tests (regression)**

Run: `npm test`
Expected: all daily-totals tests still PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/admin/tienda/TiendaDashboard.tsx
git commit -m "feat: show Resumen Diario daily totals on tienda dashboard"
```

---

## Task 5: Manual verification in the running app

**Files:** none (manual QA)

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`
Open the printed local URL, sign in as a **superuser** account, and navigate to `/admin/tienda`.

- [ ] **Step 2: Verify "Hoy"**

With the "Hoy" filter active, confirm the new **Resumen Diario** card appears above the sales list and shows a single row for today with SINPE / Efectivo / Transferencia sub-totals and a grand total. Mentally cross-check the grand total against the "Ingresos Hoy" stat card — they should match when no location/product filter is applied.

- [ ] **Step 3: Verify "Esta Semana" / a custom multi-day range**

Switch to "Esta Semana" (or pick a custom range spanning several days). Confirm one row per day appears, newest day first, and that each day's `SINPE + Efectivo + Transferencia (+ Otros)` equals that day's grand total.

- [ ] **Step 4: Verify "Ayer" (the core complaint)**

Switch to "Ayer". Confirm yesterday's totals show immediately — **no manual cierre required**. This is the scenario the client described ("a veces no hacemos cierres diarios").

- [ ] **Step 5: Verify filters interact correctly**

Select a single location pill (and/or a product). Confirm the Resumen Diario numbers shrink to match only the filtered sales.

- [ ] **Step 6: Verify gating**

Sign in as a **non-superuser** admin (or temporarily flip the role) and confirm the Resumen Diario card is hidden, while regular admins still see the sales list. (Superuser-only is intentional, consistent with the existing "Registrar Cierre" button.)

---

## Self-Review (completed by plan author)

- **Spec coverage:** Daily totals view (Task 4) ✓; SINPE total ✓; Efectivo total ✓; grand total ✓; works without a manual cierre, including past days via "Ayer"/custom range (Task 5 Step 4) ✓; "show the whole week as daily rows" (Task 5 Step 3) ✓. Transferencia and Otros are included because the data model has three+ methods.
- **Placeholder scan:** none — every step has concrete code/commands.
- **Type consistency:** `VentaForDaily` / `DailyTotal` defined in Task 3 and consumed unchanged in Task 4; `groupVentasByDay` / `getCostaRicaDayKey` names consistent across tasks; `filteredVentaRows` (`Venta[]`) is a structural superset of `VentaForDaily`.
