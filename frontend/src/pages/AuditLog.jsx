import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const load = () => api.get("/audit", { params: q ? { q } : {} }).then((r) => setRows(r.data));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6" data-testid="audit-page">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground mt-1">Every allocation, release, override, and conflict — permanent record.</p>
      </div>
      <Card className="p-4 border rounded-md">
        <Input placeholder="Filter by actor, address, action, note…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} data-testid="audit-search" className="font-mono" />
      </Card>
      <Card className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow><TableHead>When</TableHead><TableHead>Action</TableHead><TableHead>Actor</TableHead><TableHead>Address</TableHead><TableHead>Note</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.timestamp?.replace("T", " ").split(".")[0]}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-none uppercase tracking-widest text-[9px] font-mono">{r.action}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.actor_email}</TableCell>
                <TableCell className="font-mono text-xs">{r.ip_address || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.note || "—"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (<TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No events yet</TableCell></TableRow>)}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
