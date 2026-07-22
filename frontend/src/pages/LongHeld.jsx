import { useEffect, useState } from "react";
import { api, formatError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { toast } from "sonner";

export default function LongHeld() {
  const [rows, setRows] = useState([]);
  const load = () => api.get("/long-held").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const release = async (addr) => {
    try {
      await api.post(`/ips/${addr}/release`);
      toast.success(`${addr} released`);
      load();
    } catch (err) { toast.error(formatError(err)); }
  };

  return (
    <div className="space-y-6" data-testid="long-held-page">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Long-held addresses</h1>
        <p className="text-sm text-muted-foreground mt-1">Currently allocated for more than 90 days. Consider confirming with the owner or releasing.</p>
      </div>
      <Card className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Address</TableHead><TableHead>Owner</TableHead><TableHead>Device</TableHead><TableHead>Purpose</TableHead>
              <TableHead>Days</TableHead><TableHead>Allocated</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.address}>
                <TableCell className="font-mono font-medium">{r.address}</TableCell>
                <TableCell className="font-mono text-xs">{r.owner_email || "—"}</TableCell>
                <TableCell className="text-xs">{r.device_name || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground truncate max-w-[220px]">{r.purpose || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.days_in_use}</TableCell>
                <TableCell className="font-mono text-xs">{r.allocated_at?.split("T")[0]}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => release(r.address)} data-testid={`release-longheld-${r.address}`}>Release</Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nothing has been held that long. Nice.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
