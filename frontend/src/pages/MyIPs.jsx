import { useEffect, useState } from "react";
import { api, formatError, STATUS_DOT, STATUS_LABEL } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { Server } from "lucide-react";

export default function MyIPs() {
  const [rows, setRows] = useState([]);
  const load = () => api.get("/ips/mine").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const release = async (address) => {
    try {
      await api.post(`/ips/${address}/release`);
      toast.success(`${address} released`);
      load();
    } catch (err) { toast.error(formatError(err)); }
  };

  return (
    <div className="space-y-6" data-testid="my-ips-page">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My IPs</h1>
        <p className="text-sm text-muted-foreground mt-1">Addresses currently allocated to you.</p>
      </div>

      <Card className="border rounded-md">
        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <Server className="w-8 h-8 mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
            <div className="text-muted-foreground text-sm">You don&apos;t hold any addresses yet.</div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>MAC</TableHead>
                <TableHead>Allocated</TableHead>
                <TableHead>Days</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.address}>
                  <TableCell className="font-mono font-medium">{r.address}</TableCell>
                  <TableCell className="text-sm">{r.network_name}</TableCell>
                  <TableCell className="text-sm">{r.device_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.purpose}</TableCell>
                  <TableCell className="font-mono text-xs">{r.mac_address || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.allocated_at?.split("T")[0]}</TableCell>
                  <TableCell className="font-mono text-xs">{r.days_in_use ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" data-testid={`release-${r.address}`}>Release</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Release {r.address}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            The address will return to the free pool. This is logged in the audit history.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => release(r.address)} data-testid={`confirm-release-${r.address}`}>
                            Release
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
