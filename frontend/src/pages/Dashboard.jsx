import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Activity, ShieldAlert, Clock, AlertTriangle } from "lucide-react";
import { STATUS_LABEL, STATUS_DOT } from "../lib/api";

const LEGEND = ["free", "in_use", "dhcp", "stale_dns", "conflict", "reserved"];

function Stat({ label, value, sub, icon: Icon, tone = "" }) {
  return (
    <Card className="p-5 rounded-md border">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="text-3xl font-semibold mt-2 font-mono tracking-tight">{value}</div>
          {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        </div>
        {Icon && (
          <div className={`w-8 h-8 border grid place-items-center ${tone}`}>
            <Icon className="w-4 h-4" strokeWidth={1.75} />
          </div>
        )}
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data));
  }, []);

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3">
            <span>Overview of IP allocation across all managed networks.</span>
            {data.simulated && (
              <Badge variant="outline" className="uppercase text-[9px] tracking-widest font-mono rounded-none">
                Simulated mode
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat label="Utilization" value={`${data.utilization_pct}%`} sub={`${data.total_in_use} in use / ${data.total_eligible} eligible`} icon={Activity} tone="border-blue-500 text-blue-500" />
        <Stat label="Free" value={data.total_free} sub="Available for allocation" icon={Activity} tone="border-emerald-500 text-emerald-500" />
        <Stat label="Conflicts" value={data.conflicts} sub="Ping response on free address" icon={ShieldAlert} tone="border-red-500 text-red-500" />
        <Stat label="Long-Held" value={data.long_held} sub="Allocated > 90 days" icon={Clock} tone="border-yellow-500 text-yellow-500" />
      </div>

      <div>
        <h2 className="text-xl font-medium tracking-tight mb-3">Networks</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.networks.map((n) => {
            const pct = n.total_eligible ? Math.round((n.in_use / n.total_eligible) * 100) : 0;
            const nearFull = pct > 90;
            return (
              <Card key={n.id} className="p-5 border rounded-md" data-testid={`net-card-${n.name}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{n.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{n.cidr}</div>
                  </div>
                  {nearFull && (
                    <Badge className="rounded-none uppercase tracking-widest text-[9px] font-mono bg-yellow-500 text-black">
                      <AlertTriangle className="w-3 h-3 mr-1" /> Near full
                    </Badge>
                  )}
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1.5 font-mono">
                    <span>{pct}% used</span>
                    <span className="text-muted-foreground">{n.in_use} / {n.total_eligible}</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                  <div>
                    <div className="text-muted-foreground text-[10px] uppercase tracking-widest">Free</div>
                    <div className="font-mono font-medium text-emerald-600">{n.free}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[10px] uppercase tracking-widest">DHCP</div>
                    <div className="font-mono font-medium text-muted-foreground">{n.dhcp}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[10px] uppercase tracking-widest">Reserved</div>
                    <div className="font-mono font-medium">{n.reserved}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Card className="p-5 border rounded-md">
        <h3 className="font-medium mb-3">Status legend</h3>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {LEGEND.map((s) => (
            <div key={s} className="flex items-center gap-2 text-sm">
              <span className={`w-3 h-3 rounded-sm ${STATUS_DOT[s]}`} />
              <span>{STATUS_LABEL[s]}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
