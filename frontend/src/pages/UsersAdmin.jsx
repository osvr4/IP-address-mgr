import { useEffect, useState } from "react";
import { api, formatError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { toast } from "sonner";

export default function UsersAdmin() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const load = () => api.get("/users").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isSuper = user?.role === "super_admin";

  const setRole = async (uid, role) => {
    try {
      await api.post(`/users/${uid}/role`, null, { params: { role } });
      toast.success("Role updated");
      load();
    } catch (err) { toast.error(formatError(err)); }
  };

  const deactivate = async (uid) => {
    try {
      const { data } = await api.post(`/users/${uid}/deactivate`);
      toast.success("User deactivated");
      if (data.orphaned_addresses?.length) {
        toast.warning(`${data.orphaned_addresses.length} addresses still allocated — reassign or release.`);
      }
      load();
    } catch (err) { toast.error(formatError(err)); }
  };

  const activate = async (uid) => {
    try {
      await api.post(`/users/${uid}/activate`);
      toast.success("User activated");
      load();
    } catch (err) { toast.error(formatError(err)); }
  };

  return (
    <div className="space-y-6" data-testid="users-page">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage roles and access. Only super admin can promote/demote.</p>
      </div>
      <Card className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell className="font-mono text-xs">{u.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-none uppercase tracking-widest text-[9px] font-mono">
                    {u.role.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={`text-xs ${u.active ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {u.active ? "Active" : "Deactivated"}
                  </span>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {u.role !== "super_admin" && isSuper && (
                    u.role === "admin"
                      ? <Button size="sm" variant="ghost" onClick={() => setRole(u.id, "user")} data-testid={`demote-${u.email}`}>Demote to user</Button>
                      : <Button size="sm" variant="ghost" onClick={() => setRole(u.id, "admin")} data-testid={`promote-${u.email}`}>Promote to admin</Button>
                  )}
                  {u.role !== "super_admin" && (
                    u.active
                      ? <Button size="sm" variant="outline" onClick={() => deactivate(u.id)} data-testid={`deactivate-${u.email}`}>Deactivate</Button>
                      : <Button size="sm" variant="outline" onClick={() => activate(u.id)} data-testid={`activate-${u.email}`}>Activate</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
