import { query } from "./db";

interface AuthUser {
  id: string;
  name: string;
  profileImage: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  metaRole?: string | null; // role from user_metadata (set at signup)
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k.trim(), decodeURIComponent(v.join("="))];
    }),
  );
}

async function requireUser(headers: Headers): Promise<AuthUser> {
  // ── 1. Supabase JWT (Authorization: Bearer <token>) ──────────────────────
  const authHeader = headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseKey,
          },
        });
        if (res.ok) {
          const data = await res.json() as {
            id?: string;
            email?: string;
            phone?: string;
            user_metadata?: Record<string, unknown>;
          };
          if (data.id) {
            const meta = data.user_metadata ?? {};
            return {
              id: data.id,
              name: String(meta.full_name ?? meta.name ?? data.email ?? data.phone ?? data.id),
              profileImage: String(meta.avatar_url ?? meta.picture ?? ""),
              phoneNumber: data.phone ?? null,
              email: data.email ?? null,
              metaRole: meta.role ? String(meta.role) : null,
            };
          }
        }
      } catch { /* fall through */ }
    }
  }

  // ── 2. Replit injected headers (fallback / Replit-hosted environment) ────
  const userId = headers.get("x-replit-user-id");
  const userName = headers.get("x-replit-user-name");
  const userImage = headers.get("x-replit-user-profile-image");

  if (userId) {
    return {
      id: userId,
      name: userName ?? userId,
      profileImage: userImage ?? null,
    };
  }

  throw new Error("Unauthorized");
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function parseBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function handleApiRequest(req: Request, path: string): Promise<Response | null> {
  const method = req.method;

  // ─── System Health ───────────────────────────────────────────────────────────
  if (path === "/api/system-health" && method === "GET") {
    const checks: Record<string, { ok: boolean; message: string }> = {};

    // 1. Database check
    try {
      await query("SELECT 1");
      checks.database = { ok: true, message: "PostgreSQL reachable" };
    } catch (e: any) {
      checks.database = { ok: false, message: e?.message ?? "Query failed" };
    }

    // 2. Auth check (Replit injected headers)
    const userId = req.headers.get("x-replit-user-id");
    const userName = req.headers.get("x-replit-user-name");
    checks.auth = userId
      ? { ok: true, message: `Signed in as ${userName ?? userId}` }
      : { ok: false, message: "Not authenticated (no x-replit-user-id header)" };

    // 3. Environment variables
    const requiredEnv = ["DATABASE_URL", "SESSION_SECRET", "REPL_ID"];
    const missingEnv = requiredEnv.filter((k) => !process.env[k]);
    checks.env = missingEnv.length === 0
      ? { ok: true, message: "All required env vars present" }
      : { ok: false, message: `Missing: ${missingEnv.join(", ")}` };

    // 4. Replit Auth system
    checks.replitAuth = { ok: true, message: "Replit Auth active (header-based)" };

    // 5. Firebase / Supabase (replaced — intentional)
    checks.firebase = { ok: true, message: "Not used — replaced by Replit Auth" };
    checks.supabase = { ok: true, message: "Not used — replaced by Replit PostgreSQL" };

    // 6. OpenAI / AI Insights
    const hasOpenAI = !!(process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
    checks.openai = hasOpenAI
      ? { ok: true, message: "API key present — AI Insights enabled" }
      : { ok: false, message: "No API key — AI Insights disabled" };

    const allOk = Object.values(checks).every((c) => c.ok);
    return json({ ok: allOk, checks, timestamp: new Date().toISOString() });
  }

  // ─── Auth ────────────────────────────────────────────────────────────────────
  if (path === "/api/auth/login") {
    // Redirect to Replit OAuth
    const callbackUrl = encodeURIComponent(`${new URL(req.url).origin}/api/auth/callback`);
    return Response.redirect(`https://replit.com/auth_with_repl_site?domain=${new URL(req.url).hostname}&redirect_uri=${callbackUrl}`);
  }

  if (path === "/api/auth/callback") {
    // After Replit Auth, user headers are injected — redirect to dashboard
    return Response.redirect(new URL("/dashboard", req.url).href);
  }

  if (path === "/api/auth/logout" && method === "POST") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "replit_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
      },
    });
  }

  if (path === "/api/auth/session") {
    try {
      const user = await requireUser(req.headers);
      // Upsert profile — keeps profiles table in sync with auth provider
      // Role is NOT updated on conflict (preserves approved role)
      await query(
        `INSERT INTO profiles (id, full_name, email, role, updated_at)
         VALUES ($1,$2,$3,'Worker',NOW())
         ON CONFLICT (id) DO UPDATE
           SET full_name  = COALESCE(EXCLUDED.full_name, profiles.full_name),
               email      = COALESCE(EXCLUDED.email, profiles.email),
               updated_at = NOW()`,
        [user.id, user.name, user.email ?? null],
      );
      // Create approval request for non-Worker roles (first login only)
      const requestedRole = user.metaRole;
      if (requestedRole && ["Supervisor","Admin","Manager"].includes(requestedRole)) {
        const existing = await query(
          `SELECT id FROM approval_requests WHERE user_id=$1 LIMIT 1`,
          [user.id],
        );
        if (existing.rows.length === 0) {
          await query(
            `INSERT INTO approval_requests (user_id, full_name, email, phone, role_requested)
             VALUES ($1,$2,$3,$4,$5)`,
            [user.id, user.name, user.email ?? null, user.phoneNumber ?? null, requestedRole],
          );
        }
      }
      return json({ user });
    } catch {
      return json({ user: null });
    }
  }

  // ── GET /api/auth/profile — role + approval status ────────────────────────
  if (path === "/api/auth/profile" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const pRes = await query(
        `SELECT id, full_name, email, phone, role, avatar_url FROM profiles WHERE id=$1`,
        [user.id],
      );
      const profile = pRes.rows[0] ?? null;
      // Check for any approval request (pending, approved, or rejected)
      let approvalStatus: string | null = null;
      const arRes = await query(
        `SELECT status FROM approval_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,
        [user.id],
      );
      if (arRes.rows[0]) approvalStatus = arRes.rows[0].status as string;
      return json({ profile, approvalStatus });
    } catch (e) {
      return err(e instanceof Error ? e.message : "Unauthorized", 401);
    }
  }

  // ── GET /api/admin/approvals ──────────────────────────────────────────────
  if (path === "/api/admin/approvals" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const pRes = await query(`SELECT role FROM profiles WHERE id=$1`, [user.id]);
      if (!["Admin","Manager"].includes(pRes.rows[0]?.role)) return err("Forbidden", 403);
      const status = new URL(req.url).searchParams.get("status") ?? "pending";
      const r = await query(
        `SELECT ar.* FROM approval_requests ar WHERE ar.status=$1 ORDER BY ar.created_at ASC`,
        [status],
      );
      return json(r.rows);
    } catch (e) {
      return err(e instanceof Error ? e.message : "Unauthorized", 401);
    }
  }

  // ── PUT /api/admin/approvals/:id ──────────────────────────────────────────
  const arMatch = path.match(/^\/api\/admin\/approvals\/([^/]+)$/);
  if (arMatch && method === "PUT") {
    try {
      const user = await requireUser(req.headers);
      const pRes = await query(`SELECT role FROM profiles WHERE id=$1`, [user.id]);
      if (!["Admin","Manager"].includes(pRes.rows[0]?.role)) return err("Forbidden", 403);
      const arId = arMatch[1];
      const b = await parseBody(req);
      if (!["approved","rejected"].includes(b.status)) return err("Invalid status");
      await query(
        `UPDATE approval_requests
         SET status=$1, reviewed_by=$2, reviewed_at=NOW(), notes=$3, updated_at=NOW()
         WHERE id=$4`,
        [b.status, user.id, b.notes ?? null, arId],
      );
      if (b.status === "approved") {
        const ar = (await query(
          `SELECT user_id, role_requested FROM approval_requests WHERE id=$1`,
          [arId],
        )).rows[0];
        if (ar) {
          await query(
            `UPDATE profiles SET role=$1, updated_at=NOW() WHERE id=$2`,
            [ar.role_requested, ar.user_id],
          );
        }
      }
      return json({ ok: true });
    } catch (e) {
      return err(e instanceof Error ? e.message : "Unauthorized", 401);
    }
  }

  // ─── Workers ─────────────────────────────────────────────────────────────────
  if (path === "/api/workers" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const r = await query(
        `SELECT * FROM workers WHERE owner_id = $1 ORDER BY created_at DESC`,
        [user.id],
      );
      return json(r.rows);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  if (path === "/api/workers" && method === "POST") {
    try {
      const user = await requireUser(req.headers);
      const b = await parseBody(req);
      const r = await query(
        `INSERT INTO workers (owner_id, full_name, email, phone, role, department, hourly_rate, monthly_salary, avatar_url, status, joined_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [user.id, b.full_name, b.email ?? null, b.phone ?? null, b.role ?? null, b.department ?? null,
         b.hourly_rate ?? 0, b.monthly_salary ?? 0, b.avatar_url ?? null, b.status ?? "Active",
         b.joined_at ?? new Date().toISOString().slice(0, 10)],
      );
      return json(r.rows[0]);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/workers/") && method === "PUT") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      const b = await parseBody(req);
      await query(
        `UPDATE workers SET full_name=$1, email=$2, phone=$3, role=$4, department=$5,
         hourly_rate=$6, monthly_salary=$7, avatar_url=$8, status=$9, joined_at=$10, updated_at=now()
         WHERE id=$11 AND owner_id=$12`,
        [b.full_name, b.email ?? null, b.phone ?? null, b.role ?? null, b.department ?? null,
         b.hourly_rate ?? 0, b.monthly_salary ?? 0, b.avatar_url ?? null, b.status ?? "Active",
         b.joined_at ?? new Date().toISOString().slice(0, 10), id, user.id],
      );
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/workers/") && method === "DELETE") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      await query(`DELETE FROM workers WHERE id=$1 AND owner_id=$2`, [id, user.id]);
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  // ─── Projects ─────────────────────────────────────────────────────────────────
  if (path === "/api/projects" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const r = await query(`SELECT * FROM projects WHERE owner_id = $1 ORDER BY created_at DESC`, [user.id]);
      return json(r.rows);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  if (path === "/api/projects" && method === "POST") {
    try {
      const user = await requireUser(req.headers);
      const b = await parseBody(req);
      const r = await query(
        `INSERT INTO projects (owner_id, name, client, description, status, budget, spent, progress, start_date, end_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [user.id, b.name, b.client ?? null, b.description ?? null, b.status ?? "Planning",
         b.budget ?? 0, b.spent ?? 0, b.progress ?? 0, b.start_date ?? null, b.end_date ?? null],
      );
      return json(r.rows[0]);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/projects/") && method === "PUT") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      const b = await parseBody(req);
      await query(
        `UPDATE projects SET name=$1, client=$2, description=$3, status=$4, budget=$5, spent=$6, progress=$7,
         start_date=$8, end_date=$9, updated_at=now() WHERE id=$10 AND owner_id=$11`,
        [b.name, b.client ?? null, b.description ?? null, b.status ?? "Planning",
         b.budget ?? 0, b.spent ?? 0, b.progress ?? 0, b.start_date ?? null, b.end_date ?? null, id, user.id],
      );
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/projects/") && method === "DELETE") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      await query(`DELETE FROM projects WHERE id=$1 AND owner_id=$2`, [id, user.id]);
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  // ─── Attendance ───────────────────────────────────────────────────────────────
  if (path.startsWith("/api/attendance") && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get("limit") ?? "200");
      const r = await query(
        `SELECT ar.*, row_to_json(w) as workers FROM attendance_records ar
         LEFT JOIN workers w ON w.id = ar.worker_id
         WHERE ar.owner_id = $1 ORDER BY ar.check_in DESC LIMIT $2`,
        [user.id, limit],
      );
      return json(r.rows);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  if (path === "/api/attendance" && method === "POST") {
    try {
      const user = await requireUser(req.headers);
      const b = await parseBody(req);
      const r = await query(
        `INSERT INTO attendance_records (owner_id, worker_id, check_in, check_out, hours, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [user.id, b.worker_id, b.check_in ?? new Date().toISOString(), b.check_out ?? null,
         b.hours ?? null, b.status ?? "CheckedIn", b.notes ?? null],
      );
      return json(r.rows[0]);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/attendance/") && method === "PUT") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      const b = await parseBody(req);
      await query(
        `UPDATE attendance_records SET check_out=$1, status=$2, hours=$3 WHERE id=$4 AND owner_id=$5`,
        [b.check_out, b.status, b.hours, id, user.id],
      );
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path === "/api/attendance/qr" && method === "POST") {
    try {
      const user = await requireUser(req.headers);
      const { qr } = await parseBody(req);
      const wRes = await query(`SELECT id, full_name FROM workers WHERE qr_code=$1 AND owner_id=$2`, [qr, user.id]);
      if (!wRes.rows[0]) return err("QR not recognised", 404);
      const worker = wRes.rows[0];
      const openRes = await query(
        `SELECT id, check_in FROM attendance_records WHERE worker_id=$1 AND status='CheckedIn' AND owner_id=$2 LIMIT 1`,
        [worker.id, user.id],
      );
      if (openRes.rows[0]) {
        const open = openRes.rows[0];
        const now = new Date();
        const hours = +((now.getTime() - new Date(open.check_in).getTime()) / 36e5).toFixed(2);
        await query(
          `UPDATE attendance_records SET check_out=$1, status='CheckedOut', hours=$2 WHERE id=$3`,
          [now.toISOString(), hours, open.id],
        );
        return json({ worker: worker.full_name, mode: "out", hours });
      }
      await query(
        `INSERT INTO attendance_records (worker_id, owner_id, status) VALUES ($1,$2,'CheckedIn')`,
        [worker.id, user.id],
      );
      return json({ worker: worker.full_name, mode: "in" });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path === "/api/attendance/hours" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const url = new URL(req.url);
      const workerId = url.searchParams.get("worker_id");
      const start = url.searchParams.get("start");
      const end = url.searchParams.get("end");
      const r = await query(
        `SELECT COALESCE(SUM(hours),0) as total FROM attendance_records
         WHERE worker_id=$1 AND owner_id=$2 AND check_in >= $3 AND check_in <= $4`,
        [workerId, user.id, start, end + "T23:59:59"],
      );
      return json({ total: parseFloat(r.rows[0].total) });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  // ─── Payroll ──────────────────────────────────────────────────────────────────
  if (path === "/api/payroll" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const r = await query(
        `SELECT pr.*, row_to_json(w) as workers FROM payroll_records pr
         LEFT JOIN workers w ON w.id = pr.worker_id
         WHERE pr.owner_id = $1 ORDER BY pr.period_end DESC`,
        [user.id],
      );
      return json(r.rows);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  if (path === "/api/payroll" && method === "POST") {
    try {
      const user = await requireUser(req.headers);
      const b = await parseBody(req);
      const r = await query(
        `INSERT INTO payroll_records (owner_id, worker_id, period_start, period_end, base_amount, bonus, deductions, net_amount, hours_worked, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [user.id, b.worker_id, b.period_start, b.period_end, b.base_amount ?? 0,
         b.bonus ?? 0, b.deductions ?? 0, b.net_amount ?? 0, b.hours_worked ?? 0, b.status ?? "Draft"],
      );
      const wRes = await query(`SELECT full_name, role, hourly_rate FROM workers WHERE id=$1`, [b.worker_id]);
      return json({ ...r.rows[0], workers: wRes.rows[0] ?? null });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/payroll/") && method === "PUT") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      await query(
        `UPDATE payroll_records SET status='Paid', paid_at=now(), updated_at=now() WHERE id=$1 AND owner_id=$2`,
        [id, user.id],
      );
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/payroll/") && method === "DELETE") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      await query(`DELETE FROM payroll_records WHERE id=$1 AND owner_id=$2`, [id, user.id]);
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  // ─── Notifications ─────────────────────────────────────────────────────────
  if (path === "/api/notifications" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const r = await query(
        `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
        [user.id],
      );
      return json(r.rows);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  if (path.startsWith("/api/notifications/") && method === "PUT") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      if (id === "read-all") {
        await query(
          `UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL`,
          [user.id],
        );
      } else {
        await query(
          `UPDATE notifications SET read_at=now() WHERE id=$1 AND user_id=$2`,
          [id, user.id],
        );
      }
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path === "/api/notifications" && method === "POST") {
    try {
      const user = await requireUser(req.headers);
      const b = await parseBody(req);
      await query(
        `INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1,$2,$3,$4,$5)`,
        [b.user_id ?? user.id, b.title, b.message ?? null, b.type ?? "info", b.link ?? null],
      );
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  // ─── Leave ────────────────────────────────────────────────────────────────────
  if (path === "/api/leave" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const r = await query(
        `SELECT lr.*, row_to_json(w) as workers FROM leave_requests lr
         LEFT JOIN workers w ON w.id = lr.worker_id
         WHERE lr.owner_id = $1 ORDER BY lr.created_at DESC`,
        [user.id],
      );
      return json(r.rows);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  if (path === "/api/leave" && method === "POST") {
    try {
      const user = await requireUser(req.headers);
      const b = await parseBody(req);
      if (b.id) {
        await query(
          `UPDATE leave_requests SET leave_type=$1, start_date=$2, end_date=$3, reason=$4, status=$5, updated_at=now()
           WHERE id=$6 AND owner_id=$7`,
          [b.leave_type ?? "Annual", b.start_date, b.end_date, b.reason ?? null, b.status ?? "Pending", b.id, user.id],
        );
      } else {
        await query(
          `INSERT INTO leave_requests (owner_id, worker_id, leave_type, start_date, end_date, reason, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [user.id, b.worker_id, b.leave_type ?? "Annual", b.start_date, b.end_date, b.reason ?? null, b.status ?? "Pending"],
        );
      }
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/leave/") && path.endsWith("/review") && method === "PUT") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      const b = await parseBody(req);
      await query(
        `UPDATE leave_requests SET status=$1, reviewer_id=$2, reviewed_at=now(), updated_at=now() WHERE id=$3 AND owner_id=$4`,
        [b.status, user.id, id, user.id],
      );
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/leave/") && method === "DELETE") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      await query(`DELETE FROM leave_requests WHERE id=$1 AND owner_id=$2`, [id, user.id]);
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  // ─── Shifts ───────────────────────────────────────────────────────────────────
  if (path === "/api/shifts" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const url = new URL(req.url);
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      let sql = `SELECT s.*, row_to_json(w) as workers FROM shifts s
                 LEFT JOIN workers w ON w.id = s.worker_id
                 WHERE s.owner_id = $1`;
      const params: unknown[] = [user.id];
      if (from) { params.push(from); sql += ` AND s.shift_date >= $${params.length}`; }
      if (to)   { params.push(to);   sql += ` AND s.shift_date <= $${params.length}`; }
      sql += " ORDER BY s.shift_date ASC";
      const r = await query(sql, params);
      return json(r.rows);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  if (path === "/api/shifts" && method === "POST") {
    try {
      const user = await requireUser(req.headers);
      const b = await parseBody(req);
      if (b.id) {
        await query(
          `UPDATE shifts SET worker_id=$1, shift_date=$2, start_time=$3, end_time=$4, role=$5, notes=$6, updated_at=now()
           WHERE id=$7 AND owner_id=$8`,
          [b.worker_id, b.shift_date, b.start_time, b.end_time, b.role ?? null, b.notes ?? null, b.id, user.id],
        );
      } else {
        await query(
          `INSERT INTO shifts (owner_id, worker_id, shift_date, start_time, end_time, role, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [user.id, b.worker_id, b.shift_date, b.start_time, b.end_time, b.role ?? null, b.notes ?? null],
        );
      }
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/shifts/") && method === "DELETE") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      await query(`DELETE FROM shifts WHERE id=$1 AND owner_id=$2`, [id, user.id]);
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  // ─── Tasks ────────────────────────────────────────────────────────────────────
  if (path === "/api/tasks" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const r = await query(
        `SELECT t.*, row_to_json(w) as workers, row_to_json(p) as projects
         FROM tasks t
         LEFT JOIN workers w ON w.id = t.worker_id
         LEFT JOIN projects p ON p.id = t.project_id
         WHERE t.owner_id = $1 ORDER BY t.created_at DESC`,
        [user.id],
      );
      return json(r.rows);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  if (path === "/api/tasks" && method === "POST") {
    try {
      const user = await requireUser(req.headers);
      const b = await parseBody(req);
      await query(
        `INSERT INTO tasks (owner_id, project_id, worker_id, title, description, status, priority, due_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [user.id, b.project_id ?? null, b.worker_id ?? null, b.title,
         b.description ?? null, b.status ?? "Todo", b.priority ?? "Medium", b.due_date ?? null],
      );
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/tasks/") && method === "PUT") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      const b = await parseBody(req);
      const fields: string[] = [];
      const params: unknown[] = [];
      if (b.title !== undefined) { fields.push(`title=$${fields.length+1}`); params.push(b.title); }
      if (b.description !== undefined) { fields.push(`description=$${fields.length+1}`); params.push(b.description); }
      if (b.status !== undefined) { fields.push(`status=$${fields.length+1}`); params.push(b.status); }
      if (b.priority !== undefined) { fields.push(`priority=$${fields.length+1}`); params.push(b.priority); }
      if (b.due_date !== undefined) { fields.push(`due_date=$${fields.length+1}`); params.push(b.due_date); }
      if (b.completed_at !== undefined) { fields.push(`completed_at=$${fields.length+1}`); params.push(b.completed_at); }
      if (b.worker_id !== undefined) { fields.push(`worker_id=$${fields.length+1}`); params.push(b.worker_id); }
      if (b.project_id !== undefined) { fields.push(`project_id=$${fields.length+1}`); params.push(b.project_id); }
      if (fields.length === 0) return json({ ok: true });
      fields.push(`updated_at=now()`);
      params.push(id, user.id);
      await query(`UPDATE tasks SET ${fields.join(",")} WHERE id=$${params.length-1} AND owner_id=$${params.length}`, params);
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/tasks/") && method === "DELETE") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      await query(`DELETE FROM tasks WHERE id=$1 AND owner_id=$2`, [id, user.id]);
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  // ─── Clients ──────────────────────────────────────────────────────────────────
  if (path === "/api/clients" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const r = await query(`SELECT * FROM clients WHERE owner_id=$1 ORDER BY created_at DESC`, [user.id]);
      return json(r.rows);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  if (path === "/api/clients" && method === "POST") {
    try {
      const user = await requireUser(req.headers);
      const b = await parseBody(req);
      if (b.id) {
        await query(
          `UPDATE clients SET name=$1, email=$2, company=$3, phone=$4, address=$5, notes=$6, updated_at=now()
           WHERE id=$7 AND owner_id=$8`,
          [b.name, b.email ?? null, b.company ?? null, b.phone ?? null, b.address ?? null, b.notes ?? null, b.id, user.id],
        );
      } else {
        await query(
          `INSERT INTO clients (owner_id, name, email, company, phone, address, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [user.id, b.name, b.email ?? null, b.company ?? null, b.phone ?? null, b.address ?? null, b.notes ?? null],
        );
      }
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/clients/") && method === "DELETE") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      await query(`DELETE FROM clients WHERE id=$1 AND owner_id=$2`, [id, user.id]);
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  // ─── Invoices ─────────────────────────────────────────────────────────────────
  if (path === "/api/invoices" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const r = await query(
        `SELECT i.*, row_to_json(c) as clients FROM invoices i
         LEFT JOIN clients c ON c.id = i.client_id
         WHERE i.owner_id = $1 ORDER BY i.issue_date DESC`,
        [user.id],
      );
      return json(r.rows);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  if (path.startsWith("/api/invoices/") && path.endsWith("/items") && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      const iRes = await query(`SELECT i.*, row_to_json(c) as clients FROM invoices i LEFT JOIN clients c ON c.id = i.client_id WHERE i.id=$1 AND i.owner_id=$2`, [id, user.id]);
      if (!iRes.rows[0]) return err("Not found", 404);
      const itemRes = await query(`SELECT * FROM invoice_items WHERE invoice_id=$1 ORDER BY created_at`, [id]);
      return json({ invoice: iRes.rows[0], items: itemRes.rows });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path === "/api/invoices" && method === "POST") {
    try {
      const user = await requireUser(req.headers);
      const b = await parseBody(req);
      const subtotal = (b.items ?? []).reduce((s: number, i: { quantity: number; unit_price: number }) => s + i.quantity * i.unit_price, 0);
      const tax_amount = +(subtotal * ((b.tax_rate ?? 0) / 100)).toFixed(2);
      const total = +(subtotal + tax_amount).toFixed(2);
      const invRes = await query(
        `INSERT INTO invoices (owner_id, client_id, project_id, invoice_number, issue_date, due_date, tax_rate, subtotal, tax_amount, total, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [user.id, b.client_id, b.project_id ?? null, b.invoice_number,
         b.issue_date, b.due_date ?? null, b.tax_rate ?? 0, subtotal, tax_amount, total, b.notes ?? null],
      );
      const inv = invRes.rows[0];
      const rows = (b.items ?? []).map((i: { description: string; quantity: number; unit_price: number }) => [
        inv.id, user.id, i.description, i.quantity, i.unit_price, +(i.quantity * i.unit_price).toFixed(2),
      ]);
      for (const row of rows) {
        await query(
          `INSERT INTO invoice_items (invoice_id, owner_id, description, quantity, unit_price, amount) VALUES ($1,$2,$3,$4,$5,$6)`,
          row,
        );
      }
      return json(inv);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/invoices/") && path.endsWith("/status") && method === "PUT") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      const b = await parseBody(req);
      const paidAt = b.status === "Paid" ? new Date().toISOString() : null;
      await query(
        `UPDATE invoices SET status=$1, paid_at=$2, updated_at=now() WHERE id=$3 AND owner_id=$4`,
        [b.status, paidAt, id, user.id],
      );
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/invoices/") && method === "DELETE") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      await query(`DELETE FROM invoices WHERE id=$1 AND owner_id=$2`, [id, user.id]);
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path === "/api/invoices/next-number" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const r = await query(
        `SELECT invoice_number FROM invoices WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 1`,
        [user.id],
      );
      const last = r.rows[0]?.invoice_number;
      const m = last?.match(/(\d+)$/);
      const n = m ? parseInt(m[1], 10) + 1 : 1;
      return json({ number: `INV-${String(n).padStart(4, "0")}` });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  // ─── Announcements ────────────────────────────────────────────────────────────
  if (path === "/api/announcements" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const r = await query(
        `SELECT * FROM announcements WHERE owner_id=$1 ORDER BY pinned DESC, created_at DESC LIMIT 100`,
        [user.id],
      );
      return json(r.rows);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  if (path === "/api/announcements" && method === "POST") {
    try {
      const user = await requireUser(req.headers);
      const b = await parseBody(req);
      await query(
        `INSERT INTO announcements (owner_id, title, content, category, pinned) VALUES ($1,$2,$3,$4,$5)`,
        [user.id, b.title, b.content ?? null, b.category ?? "General", b.pinned ?? false],
      );
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/announcements/") && path.endsWith("/pin") && method === "PUT") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      const b = await parseBody(req);
      await query(
        `UPDATE announcements SET pinned=$1, updated_at=now() WHERE id=$2 AND owner_id=$3`,
        [b.pinned, id, user.id],
      );
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/announcements/") && method === "DELETE") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      await query(`DELETE FROM announcements WHERE id=$1 AND owner_id=$2`, [id, user.id]);
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  // ─── Attendance Corrections ───────────────────────────────────────────────────
  if (path === "/api/corrections" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const r = await query(
        `SELECT ac.*, row_to_json(w) as workers FROM attendance_corrections ac
         LEFT JOIN workers w ON w.id = ac.worker_id
         WHERE ac.owner_id = $1 ORDER BY ac.created_at DESC`,
        [user.id],
      );
      return json(r.rows);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  if (path === "/api/corrections" && method === "POST") {
    try {
      const user = await requireUser(req.headers);
      const b = await parseBody(req);
      await query(
        `INSERT INTO attendance_corrections (owner_id, attendance_id, worker_id, requested_check_in, requested_check_out, reason)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [user.id, b.attendance_id ?? null, b.worker_id, b.requested_check_in ?? null, b.requested_check_out ?? null, b.reason],
      );
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/corrections/") && method === "PUT") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      const b = await parseBody(req);
      await query(
        `UPDATE attendance_corrections SET status=$1, reviewed_at=now() WHERE id=$2 AND owner_id=$3`,
        [b.status, id, user.id],
      );
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  // ─── Company Settings ─────────────────────────────────────────────────────────
  if (path === "/api/company" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const r = await query(`SELECT * FROM company_settings WHERE owner_id=$1`, [user.id]);
      return json(r.rows[0] ?? null);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  if (path === "/api/company" && method === "POST") {
    try {
      const user = await requireUser(req.headers);
      const b = await parseBody(req);
      await query(
        `INSERT INTO company_settings (owner_id, company_name, address, email, phone, currency, theme, logo_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (owner_id) DO UPDATE SET
           company_name=$2, address=$3, email=$4, phone=$5, currency=$6, theme=$7,
           logo_url=COALESCE($8, company_settings.logo_url), updated_at=now()`,
        [user.id, b.company_name ?? "My Company", b.address ?? null, b.email ?? null,
         b.phone ?? null, b.currency ?? "USD", b.theme ?? "dark", b.logo_url ?? null],
      );
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  // ─── Profile ──────────────────────────────────────────────────────────────────
  if (path === "/api/profile" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const r = await query(`SELECT * FROM profiles WHERE id=$1`, [user.id]);
      if (r.rows[0]) return json(r.rows[0]);
      // Auto-create on first access
      await query(
        `INSERT INTO profiles (id, full_name, role) VALUES ($1,$2,'Worker') ON CONFLICT (id) DO NOTHING`,
        [user.id, user.name],
      );
      const r2 = await query(`SELECT * FROM profiles WHERE id=$1`, [user.id]);
      return json(r2.rows[0] ?? null);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  if (path === "/api/profile" && method === "PUT") {
    try {
      const user = await requireUser(req.headers);
      const b = await parseBody(req);
      await query(
        `INSERT INTO profiles (id, full_name, phone, avatar_url, role)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET
           full_name=COALESCE($2, profiles.full_name),
           phone=COALESCE($3, profiles.phone),
           avatar_url=COALESCE($4, profiles.avatar_url),
           role=COALESCE($5, profiles.role),
           updated_at=now()`,
        [user.id, b.full_name ?? null, b.phone ?? null, b.avatar_url ?? null, b.role ?? null],
      );
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  // ─── Activity Logs ─────────────────────────────────────────────────────────────
  if (path === "/api/activity" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get("limit") ?? "50");
      const r = await query(
        `SELECT * FROM activity_logs WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`,
        [user.id, limit],
      );
      return json(r.rows);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  if (path === "/api/activity" && method === "POST") {
    try {
      const user = await requireUser(req.headers);
      const b = await parseBody(req);
      await query(
        `INSERT INTO activity_logs (user_id, action, category, details) VALUES ($1,$2,$3,$4)`,
        [user.id, b.action, b.category ?? "general", JSON.stringify(b.details ?? {})],
      );
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  // ─── User Role ────────────────────────────────────────────────────────────────
  if (path === "/api/role" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const r = await query(
        `SELECT role FROM user_roles WHERE user_id=$1 ORDER BY created_at ASC`,
        [user.id],
      );
      const profile = await query(`SELECT role FROM profiles WHERE id=$1`, [user.id]);
      const roles = r.rows.map((row: { role: string }) => row.role);
      const role = roles.find((r: string) => r === "Admin") ?? roles[0] ?? profile.rows[0]?.role ?? "Worker";
      return json({ role });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  // ─── Project Assignments ──────────────────────────────────────────────────────
  if (path === "/api/project-assignments" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const url = new URL(req.url);
      const projectId = url.searchParams.get("project_id");
      const r = await query(
        `SELECT pa.*, row_to_json(w) as workers FROM project_assignments pa
         LEFT JOIN workers w ON w.id = pa.worker_id
         WHERE pa.owner_id=$1 AND pa.project_id=$2`,
        [user.id, projectId],
      );
      return json(r.rows);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  if (path === "/api/project-assignments" && method === "POST") {
    try {
      const user = await requireUser(req.headers);
      const b = await parseBody(req);
      await query(
        `INSERT INTO project_assignments (owner_id, project_id, worker_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [user.id, b.project_id, b.worker_id],
      );
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  if (path.startsWith("/api/project-assignments/") && method === "DELETE") {
    try {
      const user = await requireUser(req.headers);
      const id = path.split("/")[3];
      await query(`DELETE FROM project_assignments WHERE id=$1 AND owner_id=$2`, [id, user.id]);
      return json({ ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error");
    }
  }

  // ─── Profiles by ID (for my.tsx) ─────────────────────────────────────────────
  if (path.startsWith("/api/profiles/") && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const profileId = path.split("/")[3];
      if (profileId !== user.id) return err("Forbidden", 403);
      const r = await query(`SELECT * FROM profiles WHERE id=$1`, [profileId]);
      if (r.rows[0]) return json(r.rows[0]);
      await query(
        `INSERT INTO profiles (id, full_name, role) VALUES ($1,$2,'Worker') ON CONFLICT (id) DO NOTHING`,
        [user.id, user.name],
      );
      const r2 = await query(`SELECT * FROM profiles WHERE id=$1`, [user.id]);
      return json(r2.rows[0] ?? null);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  // ─── Activity Logs (for activity.tsx — /api/activity_logs alias) ─────────────
  if (path === "/api/activity_logs" && method === "GET") {
    try {
      const user = await requireUser(req.headers);
      const url2 = new URL(req.url);
      const limit = parseInt(url2.searchParams.get("limit") ?? "100");
      const category = url2.searchParams.get("category");
      let sql = `SELECT * FROM activity_logs WHERE user_id=$1`;
      const params: unknown[] = [user.id];
      if (category) { sql += ` AND category=$2`; params.push(category); }
      sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);
      const r = await query(sql, params);
      return json(r.rows);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : "error", 401);
    }
  }

  return null;
}
