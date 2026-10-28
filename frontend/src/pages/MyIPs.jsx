import { useEffect, useState } from "react";
import { api, formatError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { toast } from "sonner";
import { Server, Edit2 } from "lucide-react";

export default function MyIPs() {
  const [rows, setRows] = useState([]);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({ device_name: "", purpose: "", mac_address: "", vlan_id: "", location: "" });
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/ips/mine").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const release = async (address) => {
    try {
      await api.post(`/ips/${address}/release`);
      toast.success(`${address} released`);
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
                <TableHead>VLAN</TableHead>
                <TableHead>Location</TableHead>
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
                  <TableCell className="text-sm font-medium">{r.device_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.purpose}</TableCell>
                  <TableCell className="font-mono text-xs">{r.vlan_id || "—"}</TableCell>
                  <TableCell className="text-xs">{r.location || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.mac_address || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.allocated_at?.split("T")[0]}</TableCell>
                  <TableCell className="font-mono text-xs">{r.days_in_use ?? "—"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(r)}
                      data-testid={`edit-${r.address}`}
                      title="Edit metadata"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
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
                <Label htmlFor="m-dev">Device / Hostname</Label>
                <Input
                  id="m-dev"
                  value={editForm.device_name}
                  onChange={(e) => setEditForm({ ...editForm, device_name: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="m-pur">Purpose</Label>
                <Input
                  id="m-pur"
                  value={editForm.purpose}
                  onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="m-vlan">VLAN ID / Tag</Label>
                  <Input
                    id="m-vlan"
                    value={editForm.vlan_id}
                    onChange={(e) => setEditForm({ ...editForm, vlan_id: e.target.value })}
                    className="mt-1 font-mono"
                    placeholder="100"
                  />
                </div>
                <div>
                  <Label htmlFor="m-loc">Location</Label>
                  <Input
                    id="m-loc"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="mt-1"
                    placeholder="Rack 4 / Floor 2"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="m-mac">MAC Address</Label>
                <Input
                  id="m-mac"
                  value={editForm.mac_address}
                  onChange={(e) => setEditForm({ ...editForm, mac_address: e.target.value })}
                  className="mt-1 font-mono"
                  placeholder="AA:BB:CC:DD:EE:FF"
                />
              </div>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
                <Button type="submit" disabled={busy}>Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
