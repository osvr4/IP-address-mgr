import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { formatError } from "../lib/api";
import { toast } from "sonner";
import { Network, Terminal } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@thinkcloud.in");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast.success("Signed in");
      nav("/");
    } catch (err) {
      toast.error(formatError(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background" data-testid="login-page">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-zinc-950 text-zinc-100 relative overflow-hidden">
        <div className="grid-bg absolute inset-0 opacity-10" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 border border-blue-500 grid place-items-center">
            <Network className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-sm font-mono uppercase tracking-widest text-zinc-500">ThinkCloud</div>
            <div className="font-semibold">IPAM Control</div>
          </div>
        </div>
        <div className="relative z-10 space-y-6">
          <div className="font-mono text-xs text-blue-400 uppercase tracking-widest">Internal Network Tool</div>
          <h1 className="text-4xl xl:text-5xl font-semibold leading-tight tracking-tight">
            One source of truth for every static IP on your network.
          </h1>
          <div className="grid grid-cols-3 gap-3 pt-4 font-mono text-xs">
            {["10.1.0.0/22", "192.168.100.0/24", "172.16.0.0/22"].map((c) => (
              <div key={c} className="border border-zinc-800 p-3">
                <div className="text-zinc-500 uppercase tracking-widest text-[10px]">Network</div>
                <div className="text-zinc-100">{c}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-2 text-zinc-500 font-mono text-xs">
          <Terminal className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>thinkcloud.in — internal use only</span>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md p-8 border rounded-md">
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6">Use your ThinkCloud IPAM credentials</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="login-email" className="mt-1 font-mono" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password" className="mt-1 font-mono" />
            </div>
            <Button type="submit" disabled={busy} className="w-full" data-testid="login-submit">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              No account? <Link to="/register" className="text-primary underline">Create one</Link>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
