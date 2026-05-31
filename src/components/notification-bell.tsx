import { useState, useRef, useEffect } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "@/hooks/use-notifications";
import { useSession } from "@/hooks/use-session";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/queries-extra";
import { toast } from "sonner";

export function NotificationBell() {
  const { user } = useSession();
  const { data = [], unread } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const readOne = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(user!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All marked as read");
    },
  });

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((s) => !s)} className="relative p-2 rounded-xl glass">
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full grid place-items-center text-[10px] font-bold bg-[color:var(--neon-pink)] text-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto glass-strong rounded-2xl p-2 z-50 shadow-2xl">
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="text-sm font-semibold">Notifications</div>
            {unread > 0 && (
              <button onClick={() => readAll.mutate()} className="text-[11px] inline-flex items-center gap-1 text-[color:var(--neon-cyan)] hover:underline">
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>
          {data.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-6">No notifications</div>
          ) : (
            <div className="space-y-1">
              {data.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.read_at && readOne.mutate(n.id)}
                  className={`w-full text-left rounded-xl p-2.5 hover:bg-white/5 transition ${
                    n.read_at ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[color:var(--neon-cyan)] shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{n.title}</div>
                      {n.message && <div className="text-[11px] text-muted-foreground line-clamp-2">{n.message}</div>}
                      <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                    {n.read_at && <Check className="h-3 w-3 text-muted-foreground shrink-0" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
