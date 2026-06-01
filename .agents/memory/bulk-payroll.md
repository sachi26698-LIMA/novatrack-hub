---
name: Bulk payroll pattern
description: BulkPayrollModal uses createPayroll directly, not mutation callback, for sequential async bulk ops
---

# Bulk Payroll Pattern

`BulkPayrollModal` imports `createPayroll` from queries.ts and calls it directly in a for-loop with await.

**Why:** TanStack mutation's `mutate()` returns void (fire-and-forget). For sequential bulk operations where you need to track progress and handle per-item errors, calling the underlying async function directly is the only reliable pattern. After the loop, manually call `qc.invalidateQueries`.

**How to apply:** The modal takes `workers`, `ownerId`, `existingPayroll` props. Skips workers who already have a payroll record for the same period. Shows a real-time progress bar. Reports per-item errors without stopping the whole batch.
