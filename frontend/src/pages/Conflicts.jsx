import { useEffect, useState } from "react";
import { api, formatError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { toast } from "sonner";
import { Activity, RefreshCw } from "lucide-react";

export default function Conflicts() {
  const [rows, setRows] = useState([]);
  const [checkingAddr, setCheckingAddr] = useState(null);
  const [sweeping, setSweeping] = useState(false);

  const load = () => api.get("/conflicts").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const recheckPing = async (addr) => {
    setCheckingAddr(addr);
    try {
      const { data } = await api.post(`/ips/${addr}/verify`);
      if (data.ping) {
        toast.warning(`${addr} is still alive and replying to ping (${data.rtt || "active"})!`);
      } else {
        toast.success(`${addr} is now offline! Status updated to ${data.status}.`);
      }
      load();
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setCheckingAddr(null);
    }
  };

  const sweepAll = async () => {
    setSweeping(true);
    try {
      await api.post("/sweep/run");
      toast.info("Live network sweep initiated in background. Refreshing list in 3s...");
      setTimeout(load, 3000);
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setSweeping(false);
    }
  };

  const resolveAsFree = async (addr) => {
    try {
      await api.post(`/ips/${addr}/override`, { status: "free", note: "Resolved from conflicts queue" });
      toast.success(`${addr} marked free`);
      load();
    } catch (err) { toast.error(formatError(err)); }
  };

  const reserve = async (addr) => {
    try {
      await api.post(`/ips/${addr}/override`, { status: "reserved", note: "Reserved from conflicts queue" });
      toast.success(`${addr} reserved`);
      load();
    } catch (err) { toast.error(formatError(err)); }
  };

  return (
    <div className="space-y-6" data-testid="conflicts-page">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Conflicts queue</h1>
          <p className="text-sm text-muted-foreground mt-1">Addresses that answered a live ICMP ping despite being unallocated. Investigate before offering these to users.</p>
        </div>
        <Button variant="outline" onClick={sweepAll} disabled={sweeping} data-testid="sweep-all-btn">
          <RefreshCw className={`w-4 h-4 mr-2 ${sweeping ? "animate-spin" : ""}`} />
          {sweeping ? "Sweeping…" : "Scan All Conflicts"}
        </Button>
      </div>
      <Card className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Address</TableHead><TableHead>Network</TableHead><TableHead>Last checked</TableHead><TableHead>DNS</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.address}>
                <TableCell className="font-mono font-medium">{r.address}</TableCell>
                <TableCell className="text-sm">{r.network_name}</TableCell>
                <TableCell className="font-mono text-xs">{r.last_checked_at?.split("T")[0]}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.last_check_result?.dns || "—"}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => recheckPing(r.address)}
                    disabled={checkingAddr === r.address}
                    data-testid={`recheck-${r.address}`}
                    title="Live ICMP ping & DNS check"
                    className="font-mono text-xs"
                  >
                    <Activity className={`w-3.5 h-3.5 mr-1 ${checkingAddr === r.address ? "animate-spin text-primary" : ""}`} />
                    {checkingAddr === r.address ? "Pinging…" : "Re-check"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => resolveAsFree(r.address)} data-testid={`resolve-${r.address}`}>Mark free</Button>
                  <Button size="sm" variant="outline" onClick={() => reserve(r.address)} data-testid={`reserve-conflict-${r.address}`}>Reserve</Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No conflicts — the network is clean.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
