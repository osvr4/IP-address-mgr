import { useEffect, useState } from "react";
import { api, formatError, STATUS_DOT, STATUS_LABEL } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { toast } from "sonner";
import { Download, Edit2, Activity, RefreshCw } from "lucide-react";

const STATUSES = ["all", ...Object.keys(STATUS_LABEL)];

export default function AllAddresses() {
  const [rows, setRows] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [q, setQ] = useState("");
  const [network, setNetwork] = useState("all");
  const [status, setStatus] = useState("all");
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({ device_name: "", purpose: "", mac_address: "", vlan_id: "", location: "" });
  const [busy, setBusy] = useState(false);
  const [pingingAddr, setPingingAddr] = useState(null);
  const [sweeping, setSweeping] = useState(false);

  const load = () => {
    const params = {};
    if (network !== "all") params.network_id = network;
    if (status !== "all") params.status = status;
    if (q) params.q = q;
    api.get("/ips", { params }).then((r) => setRows(r.data));
  };

  useEffect(() => { api.get("/networks").then((r) => setNetworks(r.data)); }, []);
  useEffect(() => { load(); }, [network, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const doExport = async () => {
    try {
      const res = await api.get("/export/csv", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "ipam_export.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(formatError(err)); }
  };

  const triggerSweep = async () => {
    setSweeping(true);
    try {
      await api.post("/sweep/run");
      toast.info("Live network ping sweep started in the background", {
        description: "Pinging all managed subnets over VPN...",
      });
      setTimeout(() => {
        load();
        setSweeping(false);
      }, 4000);
    } catch (err) {
      toast.error(formatError(err));
      setSweeping(false);
    }
  };

  const forceRelease = async (addr) => {
    try {
      await api.post(`/ips/${addr}/release`);
      toast.success(`${addr} released`);
      load();
    } catch (err) { toast.error(formatError(err)); }
  };

  const setReserved = async (addr) => {
    try {
      await api.post(`/ips/${addr}/override`, { status: "reserved", note: "Manually reserved by admin" });
      toast.success(`${addr} reserved`);
      load();
    } catch (err) { toast.error(formatError(err)); }
  };

  const openEdit = (r) => {
    setEditItem(r);
    setEditForm({
      device_name: r.device_name || "",
      purpose: r.purpose || "",
      mac_address: r.mac_address || "",
      vlan_id: r.vlan_id || "",
      location: r.location || "",
    });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editItem) return;
    setBusy(true);
    try {
      await api.patch(`/ips/${editItem.address}`, editForm);
      toast.success(`Updated ${editItem.address}`);
      setEditItem(null);
      load();
    } catch (err) { toast.error(formatError(err)); }
    finally { setBusy(false); }
  };

  const verifyIp = async (addr) => {
    setPingingAddr(addr);
    try {
      const { data } = await api.post(`/ips/${addr}/verify`);
      if (data.ping) {
        toast.warning(`${addr} is LIVE! Host responded with TTL (${data.rtt || "active"})`, {
          description: data.dns ? `DNS: ${data.dns}` : "No PTR record",
        });
      } else if (data.dns) {
        toast.info(`${addr}: No ping reply, but Stale DNS record found (${data.dns})`);
      } else {
        toast.success(`${addr}: No ping reply (Host is offline / Free)`);
      }
      load();
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setPingingAddr(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="all-addresses-page">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">All addresses</h1>
          <p className="text-sm text-muted-foreground mt-1">Full inventory across every managed network.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={triggerSweep}
            disabled={sweeping}
            data-testid="sweep-all-btn"
            title="Trigger background ICMP ping sweep across all networks"
            className="border-slate-300 dark:border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 text-primary ${sweeping ? "animate-spin" : ""}`} strokeWidth={1.75} />
            {sweeping ? "Sweeping networks…" : "Recheck All (Sweep)"}
          </Button>
          <Button variant="outline" onClick={doExport} data-testid="export-csv-btn">
            <Download className="w-4 h-4 mr-2" strokeWidth={1.75} /> Export CSV
          </Button>
        </div>
      </div>

      <Card className="p-4 border rounded-md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input placeholder="Search address, device, purpose, email…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} data-testid="search-input" className="font-mono" />
          <Select value={network} onValueChange={setNetwork}>
            <SelectTrigger data-testid="filter-network"><SelectValue placeholder="Network" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All networks</SelectItem>
              {networks.map((n) => (<SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (<SelectItem key={s} value={s}>{s === "all" ? "All statuses" : STATUS_LABEL[s]}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button onClick={load} data-testid="apply-filters">Apply</Button>
        </div>
      </Card>

      <Card className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Address</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>VLAN</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Allocated</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Last checked / Ping</TableHead>
              <TableHead className="text-right min-w-[210px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.address}>
                <TableCell className="font-mono font-medium">{r.address}</TableCell>
                <TableCell className="text-xs">{r.network_name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`w-2.5 h-2.5 rounded-sm ${STATUS_DOT[r.status]}`} />
                    {STATUS_LABEL[r.status]}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.owner_email || "—"}</TableCell>
                <TableCell className="text-xs font-medium">{r.device_name || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">{r.purpose || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.vlan_id || "—"}</TableCell>
                <TableCell className="text-xs">{r.location || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.allocated_at?.split("T")[0] || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.days_in_use ?? "—"}</TableCell>
                <TableCell className="text-xs">
                  {r.last_check_result ? (
                    <div className="flex flex-col gap-0.5">
                      {r.last_check_result.ping ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Live {r.last_check_result.rtt ? `(${r.last_check_result.rtt})` : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Offline
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {r.last_checked_at?.split("T")[0] || "—"}
                      </span>
                    </div>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.last_checked_at?.split("T")[0] || "Never"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap py-2">
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => verifyIp(r.address)}
                      disabled={pingingAddr === r.address}
                      data-testid={`verify-${r.address}`}
                      title={`Recheck live ICMP ping for ${r.address}`}
                      className="h-8 px-2.5 text-xs font-medium border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                    >
                      <Activity className={`w-3.5 h-3.5 mr-1 text-blue-600 dark:text-blue-400 ${pingingAddr === r.address ? "animate-spin text-primary" : ""}`} />
                      {pingingAddr === r.address ? "Pinging…" : "Recheck Ping"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(r)}
                      data-testid={`edit-${r.address}`}
                      title="Edit metadata"
                      className="h-8 w-8 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    {r.status === "in_use" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => forceRelease(r.address)}
                        data-testid={`force-release-${r.address}`}
                        className="h-8 px-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        Force release
                      </Button>
                    )}
                    {r.status !== "reserved" && r.status !== "in_use" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setReserved(r.address)}
                        data-testid={`reserve-${r.address}`}
                        className="h-8 px-2 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      >
                        Reserve
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">No records</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <div className="text-xs text-muted-foreground font-mono">{rows.length} rows</div>

      {/* Edit IP Metadata Modal */}
      {editItem && (
        <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit IP Metadata — <span className="font-mono">{editItem.address}</span></DialogTitle>
              <DialogDescription>
                Update device, VLAN, or physical location info.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={saveEdit} className="space-y-4 py-2">
              <div>
                <Label htmlFor="all-dev">Device / Hostname</Label>
                <Input
                  id="all-dev"
                  value={editForm.device_name}
                  onChange={(e) => setEditForm({ ...editForm, device_name: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="all-pur">Purpose</Label>
                <Input
                  id="all-pur"
                  value={editForm.purpose}
                  onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="all-vlan">VLAN ID / Tag</Label>
                  <Input
                    id="all-vlan"
                    value={editForm.vlan_id}
                    onChange={(e) => setEditForm({ ...editForm, vlan_id: e.target.value })}
                    className="mt-1 font-mono"
                    placeholder="100"
                  />
                </div>
                <div>
                  <Label htmlFor="all-loc">Location</Label>
                  <Input
                    id="all-loc"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="mt-1"
                    placeholder="Rack 4 / Floor 2"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="all-mac">MAC Address</Label>
                <Input
                  id="all-mac"
                  value={editForm.mac_address}
                  onChange={(e) => setEditForm({ ...editForm, mac_address: e.target.value })}
                  className="mt-1 font-mono"
                  placeholder="AA:BB:CC:DD:EE:FF"
                />
              </div>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
                <Button type="submit" disabled={busy} data-testid="save-edit-submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
