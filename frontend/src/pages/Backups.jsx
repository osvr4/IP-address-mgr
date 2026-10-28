import { useEffect, useState } from "react";
import { api, formatError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { toast } from "sonner";
import { Download, RefreshCw, Archive, Clock, ShieldCheck } from "lucide-react";

export default function Backups() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const res = await api.get("/backups");
      setBackups(res.data);
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const generateBackup = async () => {
    setGenerating(true);
    try {
      const res = await api.post("/backups/generate");
      toast.success(`Backup generated: ${res.data.filename}`);
      loadBackups();
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setGenerating(false);
    }
  };

  const downloadBackup = async (filename) => {
    try {
      const res = await api.get(`/backups/${filename}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${filename}`);
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6" data-testid="backups-page">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Automated Backups</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Nightly scheduled snapshots and on-demand CSV backups of the complete IPAM inventory.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadBackups} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button onClick={generateBackup} disabled={generating} data-testid="generate-backup-btn">
            <Archive className="w-4 h-4 mr-2" />
            {generating ? "Generating..." : "Generate Backup Now"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border rounded-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-blue-500/10 text-blue-500 flex items-center justify-center font-mono">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Schedule</div>
              <div className="text-sm font-semibold">Every Night (00:00 UTC)</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 border rounded-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-mono">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Data Scope</div>
              <div className="text-sm font-semibold">IPs, VLANs, Locations, Owners</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 border rounded-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-purple-500/10 text-purple-500 flex items-center justify-center font-mono">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Total Backups</div>
              <div className="text-sm font-semibold font-mono">{backups.length} snapshots</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="border rounded-md overflow-x-auto" data-testid="backups-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Snapshot Filename</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>File Size</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {backups.map((b) => (
              <TableRow key={b.filename}>
                <TableCell className="font-mono font-medium text-sm flex items-center gap-2">
                  <Archive className="w-4 h-4 text-muted-foreground" />
                  {b.filename}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {b.created_at ? new Date(b.created_at).toLocaleString() : "—"}
                </TableCell>
                <TableCell className="font-mono text-xs">{formatSize(b.size_bytes)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadBackup(b.filename)}
                    data-testid={`download-backup-${b.filename}`}
                  >
                    <Download className="w-3.5 h-3.5 mr-1" /> Download
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {backups.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                  <Archive className="w-8 h-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                  No backups found. Click &quot;Generate Backup Now&quot; to create a snapshot.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
