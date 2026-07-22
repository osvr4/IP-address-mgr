import { useEffect, useMemo, useState } from "react";
import { api, formatError, STATUS_DOT, STATUS_LABEL } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { toast } from "sonner";
import { Download } from "lucide-react";

const STATUSES = ["all", ...Object.keys(STATUS_LABEL)];

export default function AllAddresses() {
  const [rows, setRows] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [q, setQ] = useState("");
  const [network, setNetwork] = useState("all");
  const [status, setStatus] = useState("all");

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

  return (
    <div className="space-y-6" data-testid="all-addresses-page">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">All addresses</h1>
          <p className="text-sm text-muted-foreground mt-1">Full inventory across every managed network.</p>
        </div>
        <Button variant="outline" onClick={doExport} data-testid="export-csv-btn">
          <Download className="w-4 h-4 mr-2" strokeWidth={1.75} /> Export CSV
        </Button>
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
              <TableHead>Allocated</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Last checked</TableHead>
              <TableHead className="text-right">Actions</TableHead>
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
                <TableCell className="text-xs">{r.device_name || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">{r.purpose || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.allocated_at?.split("T")[0] || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.days_in_use ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.last_checked_at?.split("T")[0] || "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  {r.status === "in_use" && (
                    <Button size="sm" variant="ghost" onClick={() => forceRelease(r.address)} data-testid={`force-release-${r.address}`}>Force release</Button>
                  )}
                  {r.status !== "reserved" && r.status !== "in_use" && (
                    <Button size="sm" variant="ghost" onClick={() => setReserved(r.address)} data-testid={`reserve-${r.address}`}>Reserve</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No records</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <div className="text-xs text-muted-foreground font-mono">{rows.length} rows</div>
    </div>
  );
}
