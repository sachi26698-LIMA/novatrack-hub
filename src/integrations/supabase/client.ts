// Supabase is not used in this Replit deployment.
// All data access goes through /api/* routes backed by Replit PostgreSQL.
// This stub prevents import errors from files that still reference this module.

export const supabase = new Proxy({} as never, {
  get(_target, prop) {
    if (prop === "then") return undefined;
    const noop: unknown = new Proxy(
      (() => Promise.resolve({ data: null, error: null })) as unknown as object,
      {
        get: () => noop,
        apply: () => Promise.resolve({ data: null, error: null }),
      },
    );
    return noop;
  },
});
