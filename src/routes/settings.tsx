import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Building2, ImageUp, Save, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/glass-card";
import { Field, inputCls, primaryBtn, primaryBtnStyle } from "@/components/modal";
import { useSession } from "@/hooks/use-session";
import {
  getCompanySettings, saveCompanySettings, uploadLogo, getProfile, updateProfile,
} from "@/lib/queries-extra";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — TrackNova" },
      { name: "description", content: "Personalize your profile, brand and workspace identity." },
    ],
  }),
  component: SettingsPage,
});

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "PKR", "AED", "SAR"];

function SettingsPage() {
  const { user } = useSession();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
  });
  const { data: company } = useQuery({
    queryKey: ["company", user?.id],
    queryFn: () => getCompanySettings(user!.id),
    enabled: !!user,
  });

  const [p, setP] = useState({ full_name: "", phone: "" });
  const [c, setC] = useState({
    company_name: "", address: "", email: "", phone: "",
    currency: "USD", theme: "dark", logo_url: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) setP({ full_name: profile.full_name ?? "", phone: profile.phone ?? "" });
  }, [profile]);
  useEffect(() => {
    if (company) setC({
      company_name: company.company_name, address: company.address ?? "",
      email: company.email ?? "", phone: company.phone ?? "",
      currency: company.currency, theme: company.theme, logo_url: company.logo_url ?? "",
    });
  }, [company]);

  const saveP = useMutation({
    mutationFn: () => updateProfile(user!.id, p),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["profile"] });
      await logActivity("profile_updated", "data");
      toast.success("Profile updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveC = useMutation({
    mutationFn: () => saveCompanySettings({ owner_id: user!.id, ...c }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["company"] });
      await logActivity("company_updated", "data");
      toast.success("Company saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upload = useMutation({
    mutationFn: (f: File) => uploadLogo(user!.id, f),
    onSuccess: (url) => {
      setC((s) => ({ ...s, logo_url: url }));
      toast.success("Logo uploaded — click Save");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      eyebrow="Workspace"
      title={<>Settings & <span className="neon-text">branding</span></>}
      subtitle="Customize your profile and how TrackNova represents your company."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <UserIcon className="h-4 w-4 text-[color:var(--neon-cyan)]" />
            <h3 className="font-semibold">Profile</h3>
          </div>
          <div className="space-y-3">
            <Field label="Full name">
              <input className={inputCls} value={p.full_name}
                onChange={(e) => setP({ ...p, full_name: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className={inputCls} value={p.phone}
                onChange={(e) => setP({ ...p, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className={inputCls} value={user?.email ?? ""} disabled />
            </Field>
            <button onClick={() => saveP.mutate()} disabled={saveP.isPending}
              className={primaryBtn} style={primaryBtnStyle}>
              <Save className="h-3.5 w-3.5" /> {saveP.isPending ? "Saving…" : "Save profile"}
            </button>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-4 w-4 text-[color:var(--neon-violet)]" />
            <h3 className="font-semibold">Company branding</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-2xl glass grid place-items-center overflow-hidden">
                {c.logo_url ? (
                  <img src={c.logo_url} alt="logo" className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <input type="file" ref={fileRef} accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
                <button onClick={() => fileRef.current?.click()}
                  className="glass rounded-xl px-3 py-2 text-xs inline-flex items-center gap-1.5 hover:bg-white/5">
                  <ImageUp className="h-3.5 w-3.5" />
                  {upload.isPending ? "Uploading…" : "Upload logo"}
                </button>
                <p className="text-[11px] text-muted-foreground mt-1">PNG / JPG · square recommended</p>
              </div>
            </div>
            <Field label="Company name">
              <input className={inputCls} value={c.company_name}
                onChange={(e) => setC({ ...c, company_name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <input className={inputCls} value={c.email}
                  onChange={(e) => setC({ ...c, email: e.target.value })} />
              </Field>
              <Field label="Phone">
                <input className={inputCls} value={c.phone}
                  onChange={(e) => setC({ ...c, phone: e.target.value })} />
              </Field>
            </div>
            <Field label="Address">
              <textarea rows={2} className={inputCls} value={c.address}
                onChange={(e) => setC({ ...c, address: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Currency">
                <select className={inputCls} value={c.currency}
                  onChange={(e) => setC({ ...c, currency: e.target.value })}>
                  {CURRENCIES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Theme">
                <select className={inputCls} value={c.theme}
                  onChange={(e) => setC({ ...c, theme: e.target.value })}>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </Field>
            </div>
            <button onClick={() => saveC.mutate()} disabled={saveC.isPending}
              className={primaryBtn} style={primaryBtnStyle}>
              <Save className="h-3.5 w-3.5" /> {saveC.isPending ? "Saving…" : "Save company"}
            </button>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
