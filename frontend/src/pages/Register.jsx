import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { formatError } from "../lib/api";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register(name, email, password);
      toast.success("Account created");
      nav("/");
    } catch (err) {
      toast.error(formatError(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background" data-testid="register-page">
      <Card className="w-full max-w-md p-8">
        <h2 className="text-2xl font-semibold tracking-tight">Create account</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-6">ThinkCloud IPAM · internal network tool</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="register-name" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="register-email" className="mt-1 font-mono" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} data-testid="register-password" className="mt-1 font-mono" />
          </div>
          <Button type="submit" disabled={busy} className="w-full" data-testid="register-submit">
            {busy ? "Creating…" : "Create account"}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Have an account? <Link to="/login" className="text-primary underline">Sign in</Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
