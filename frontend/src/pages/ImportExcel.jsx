import { useState } from "react";
import { api, formatError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export default function ImportExcel() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/import/excel", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      toast.success(`Imported ${data.imported} rows`);
    } catch (err) { toast.error(formatError(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl" data-testid="import-page">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Import Excel</h1>
        <p className="text-sm text-muted-foreground mt-1">One-time bulk import of your existing IP spreadsheet.</p>
      </div>
      <Card className="p-6 border rounded-md">
        <div className="text-sm mb-4">
          <div className="font-medium mb-2">Expected columns (case-insensitive)</div>
          <ul className="list-disc list-inside text-muted-foreground text-xs space-y-0.5 font-mono">
            <li>address (or ip / ip_address) — required</li>
            <li>owner (or email / owner_email)</li>
            <li>device (or hostname / device_name)</li>
            <li>purpose (or notes)</li>
            <li>mac (or mac_address)</li>
            <li>allocated_at (or date)</li>
          </ul>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} data-testid="import-file-input" className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer hover:file:bg-primary/90" />
          <Button type="submit" disabled={!file || busy} data-testid="import-submit">
            <Upload className="w-4 h-4 mr-2" strokeWidth={1.75} /> {busy ? "Importing…" : "Import"}
          </Button>
        </form>
      </Card>
      {result && (
        <Card className="p-4 border rounded-md">
          <div className="font-medium mb-2">Result</div>
          <div className="text-sm text-muted-foreground font-mono">
            Imported: {result.imported} · Skipped: {result.skipped}
          </div>
        </Card>
      )}
    </div>
  );
}
