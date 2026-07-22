import { useEffect, useState } from "react";
import { api, formatError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { toast } from "sonner";

export default function Conflicts() {
  const [rows, setRows] = useState([]);
  const load = () => api.get("/conflicts").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Conflicts queue</h1>
        <p className="text-sm text-muted-foreground mt-1">Addresses that answered a ping despite the database marking them free. Investigate before offering these to users.</p>
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
