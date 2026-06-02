type TokenRefresher = () => Promise<string | null>;

let _refresher: TokenRefresher | null = null;

export function setTokenRefresher(fn: TokenRefresher): void {
  _refresher = fn;
}

export async function getAuthToken(): Promise<string | null> {
  if (!_refresher) return null;
  try {
    return await _refresher();
  } catch {
    return null;
  }
}
