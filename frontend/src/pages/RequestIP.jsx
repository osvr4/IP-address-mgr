import { useEffect, useState } from "react";
import { api, formatError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Check, AlertTriangle } from "lucide-react";

export default function RequestIP() {
  const [networks, setNetworks] = useState([]);
  const [chosen, setChosen] = useState("any");
  const [candidate, setCandidate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ device_name: "", purpose: "", device_type: "", mac_address: "" });
  const [tried, setTried] = useState([]);

  useEffect(() => { api.get("/networks").then((r) => setNetworks(r.data)); }, []);

  const findAddress = async () => {
    setBusy(true);
    setCandidate(null);
    try {
      const body = chosen === "any" ? {} : { network_id: chosen };
      const { data } = await api.post("/ips/request", body);
      setCandidate(data);
    } catch (err) { toast.error(formatError(err)); }
    finally { setBusy(false); }
  };

  const tryAnother = async () => {
    if (candidate) setTried((t) => [...t, candidate.address]);
    setCandidate(null);
    await findAddress();
  };

  const finalize = async (e) => {
    e.preventDefault();
    if (!candidate) return;
    setBusy(true);
    try {
      await api.post("/ips/finalize", { address: candidate.address, ...form });
      toast.success(`Allocated ${candidate.address}`);
      setCandidate(null);
      setForm({ device_name: "", purpose: "", device_type: "", mac_address: "" });
      setTried([]);
    } catch (err) { toast.error(formatError(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-3xl space-y-6" data-testid="request-page">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Request a static IP</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The system will ping the candidate address and check reverse DNS before offering it to you.
        </p>
      </div>

      <Card className="p-6 border rounded-md">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <Label className="mb-1 block">Choose a network</Label>
            <Select value={chosen} onValueChange={setChosen}>
              <SelectTrigger data-testid="network-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any network (most free capacity)</SelectItem>
                {networks.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name} — <span className="font-mono">{n.cidr}</span> ({n.counts.free} free)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={findAddress} disabled={busy} data-testid="find-address-btn">
            {busy ? "Searching…" : "Find address"}
          </Button>
        </div>
      </Card>

      {candidate && (
        <Card className="p-6 border-2 border-primary rounded-md" data-testid="candidate-card">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Suggested address</div>
              <div className="text-4xl font-mono font-semibold mt-2 text-primary" data-testid="candidate-address">
                {candidate.address}
              </div>
              <div className="text-sm text-muted-foreground mt-1 font-mono">{candidate.network_name}</div>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <Badge className="rounded-none font-mono uppercase text-[10px] tracking-widest bg-emerald-500 text-white">
                <Check className="w-3 h-3 mr-1" /> Ping: no reply
              </Badge>
              {candidate.stale ? (
                <Badge className="rounded-none font-mono uppercase text-[10px] tracking-widest bg-yellow-500 text-black">
                  <AlertTriangle className="w-3 h-3 mr-1" /> Stale DNS
                </Badge>
              ) : (
                <Badge variant="outline" className="rounded-none font-mono uppercase text-[10px] tracking-widest">No DNS record</Badge>
              )}
              <Badge variant="outline" className="rounded-none font-mono uppercase text-[9px] tracking-widest">{candidate.mode}</Badge>
            </div>
          </div>

          {candidate.stale && candidate.dns && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-500 rounded-sm text-sm">
              <div className="font-medium text-yellow-800 dark:text-yellow-300">Heads up</div>
              <div className="text-muted-foreground text-xs mt-1">
                No live host here, but DNS still has an old record for{" "}
                <span className="font-mono">{candidate.dns}</span> pointing at this address — you may want IT to clean that up.
              </div>
            </div>
          )}

          <form onSubmit={finalize} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Device / Hostname *</Label>
                <Input required value={form.device_name} onChange={(e) => setForm({ ...form, device_name: e.target.value })} data-testid="device-name-input" className="mt-1" placeholder="dev-server-01" />
              </div>
              <div>
                <Label>Purpose *</Label>
                <Input required value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} data-testid="purpose-input" className="mt-1" placeholder="Build agent" />
              </div>
              <div>
                <Label>Device type (optional)</Label>
                <Input value={form.device_type} onChange={(e) => setForm({ ...form, device_type: e.target.value })} data-testid="device-type-input" className="mt-1" placeholder="Linux VM / Printer / Router" />
              </div>
              <div>
                <Label>MAC address (optional)</Label>
                <Input value={form.mac_address} onChange={(e) => setForm({ ...form, mac_address: e.target.value })} data-testid="mac-input" className="mt-1 font-mono" placeholder="AA:BB:CC:DD:EE:FF" />
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={busy} data-testid="finalize-btn">
                <Check className="w-4 h-4 mr-2" strokeWidth={1.75} /> Confirm allocation
              </Button>
              <Button type="button" variant="outline" onClick={tryAnother} disabled={busy} data-testid="try-another-btn">
                <RefreshCw className="w-4 h-4 mr-2" strokeWidth={1.75} /> Try another
              </Button>
            </div>
            {candidate.hold_expires_at && (
              <div className="text-xs text-muted-foreground font-mono">
                Soft hold expires at {new Date(candidate.hold_expires_at).toLocaleTimeString()}
              </div>
            )}
          </form>
        </Card>
      )}

      {tried.length > 0 && (
        <div className="text-xs text-muted-foreground font-mono">
          Passed over: {tried.join(", ")}
        </div>
      )}
    </div>
  );
}
