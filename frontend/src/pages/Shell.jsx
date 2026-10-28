import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  LayoutDashboard, PlusCircle, Server, ShieldAlert, Users, ScrollText,
  Upload, Map, Network, LogOut, Clock, Bell, Archive,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { api, NOTIFICATION_POLL_MS } from "../lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";

function NavItem({ to, icon: Icon, children, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2 text-sm rounded-sm border-l-2 transition-colors duration-150 ${
          isActive
            ? "border-blue-500 bg-zinc-100 dark:bg-zinc-800 text-foreground font-medium"
            : "border-transparent text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-foreground"
        }`
      }
    >
      <Icon className="w-4 h-4" strokeWidth={1.75} />
      {children}
    </NavLink>
  );
}

export default function Shell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [notifs, setNotifs] = useState([]);

  const fetchNotifs = useCallback(async () => {
    try {
      const r = await api.get("/notifications");
      setNotifs(r.data);
    } catch (err) {
      // Non-blocking: log to console but keep the UI responsive
      console.warn("Failed to load notifications:", err?.message || err);
    }
  }, []);

  useEffect(() => {
    fetchNotifs();
    const t = setInterval(fetchNotifs, NOTIFICATION_POLL_MS);
    return () => clearInterval(t);
  }, [fetchNotifs]);

  const unread = notifs.filter((n) => !n.read).length;
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const markRead = async () => {
    await api.post("/notifications/mark-read");
    await fetchNotifs();
  };

  return (
    <div className="min-h-screen bg-background text-foreground grid grid-cols-[240px_1fr]">
      <aside className="border-r border-border bg-card flex flex-col" data-testid="sidebar">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <div className="w-8 h-8 border border-blue-500 grid place-items-center">
            <Network className="w-4 h-4 text-blue-600" strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">ThinkCloud</div>
            <div className="font-semibold text-sm">IPAM</div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-3 pt-3 pb-1">Workspace</div>
          <NavItem to="/" icon={LayoutDashboard} end>Dashboard</NavItem>
          <NavItem to="/request" icon={PlusCircle}>Request IP</NavItem>
          <NavItem to="/mine" icon={Server}>My IPs</NavItem>
          <NavItem to="/map" icon={Map}>Subnet Map</NavItem>

          {isAdmin && (
            <>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-3 pt-4 pb-1">Admin</div>
              <NavItem to="/admin/addresses" icon={Server}>All Addresses</NavItem>
              <NavItem to="/admin/conflicts" icon={ShieldAlert}>Conflicts</NavItem>
              <NavItem to="/admin/long-held" icon={Clock}>Long-Held</NavItem>
              <NavItem to="/admin/users" icon={Users}>Users</NavItem>
              <NavItem to="/admin/audit" icon={ScrollText}>Audit Log</NavItem>
              <NavItem to="/admin/import" icon={Upload}>Import Excel</NavItem>
              <NavItem to="/admin/backups" icon={Archive}>Backups</NavItem>
            </>
          )}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs">
              <div className="font-medium">{user?.name}</div>
              <div className="text-muted-foreground font-mono text-[10px]">{user?.email}</div>
            </div>
            <Badge variant="outline" className="uppercase text-[9px] tracking-widest rounded-none font-mono">
              {user?.role?.replace("_", " ")}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={() => { logout(); nav("/login"); }} data-testid="logout-btn">
            <LogOut className="w-3.5 h-3.5 mr-2" strokeWidth={1.75} /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex flex-col min-h-screen">
        <header className="h-14 border-b border-border bg-card px-6 flex items-center justify-between">
          <div className="text-sm text-muted-foreground font-mono">
            {new Date().toISOString().split("T")[0]} · Internal Network Console
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="relative" data-testid="notifications-btn">
                <Bell className="w-4 h-4" strokeWidth={1.75} />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <div className="font-medium text-sm">Notifications</div>
                {unread > 0 && (
                  <button className="text-xs text-primary underline" onClick={markRead} data-testid="mark-read">Mark all read</button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifs.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>}
                {notifs.map((n) => (
                  <div key={n.id} className={`p-3 border-b border-border text-sm ${n.read ? "opacity-70" : ""}`}>
                    <div className="font-medium">{n.title}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">{n.body}</div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-1">{n.created_at?.split("T")[0]}</div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </header>

        <div className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
