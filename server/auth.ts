export interface ReplitUser {
  id: string;
  name: string;
  profileImage: string | null;
}

export function getReplitUser(req: Request): ReplitUser | null {
  try {
    const header = req.headers.get("X-Replit-User-Id");
    const name = req.headers.get("X-Replit-User-Name");
    const profileImage = req.headers.get("X-Replit-User-Profile-Image");
    if (!header || !name) return null;
    return { id: header, name, profileImage };
  } catch {
    return null;
  }
}
