import { useEffect, useState } from "react";
import { api, STATUS_DOT, STATUS_LABEL } from "../lib/api";
import { Card } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";

export default function SubnetMap() {
  const [networks, setNetworks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [map, setMap] = useState(null);

  useEffect(() => {
    api.get("/networks").then((r) => {
      setNetworks(r.data);
      if (r.data.length) setSelected(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (selected) api.get(`/ips/subnet-map/${selected}`).then((r) => setMap(r.data));
  }, [selected]);

  return (
    <div className="space-y-6" data-testid="map-page">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Subnet map</h1>
        <p className="text-sm text-muted-foreground mt-1">Every address in the selected network, color-coded by status. Hover for details.</p>
      </div>

      <div className="flex gap-3 items-center">
        <Select value={selected || ""} onValueChange={setSelected}>
          <SelectTrigger className="w-96" data-testid="map-network-select"><SelectValue placeholder="Select network" /></SelectTrigger>
          <SelectContent>
            {networks.map((n) => (
              <SelectItem key={n.id} value={n.id}>{n.name} — <span className="font-mono">{n.cidr}</span></SelectItem>
            ))}
          </SelectContent>
        </Select>
        {map && (
          <div className="text-sm text-muted-foreground font-mono">{map.cells.length} addresses</div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
        {Object.keys(STATUS_LABEL).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-sm ${STATUS_DOT[s]}`} />
            <span>{STATUS_LABEL[s]}</span>
          </div>
        ))}
      </div>

      {map && (
        <Card className="p-6 border rounded-md">
          <div className="text-sm mb-3 font-mono text-muted-foreground">{map.network.name} — {map.network.cidr}</div>
          <TooltipProvider delayDuration={100}>
            <div className="grid gap-[2px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(14px, 1fr))" }}>
              {map.cells.map((c) => (
                <Tooltip key={c.address}>
                  <TooltipTrigger asChild>
                    <div className={`cell w-3.5 h-3.5 cell-${c.status}`} data-testid={`cell-${c.address}`} />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="font-mono text-xs">
                    <div className="font-medium">{c.address}</div>
                    <div className="text-muted-foreground">{STATUS_LABEL[c.status]}</div>
                    {c.owner_email && <div className="text-muted-foreground">{c.owner_email}</div>}
                    {c.device_name && <div className="text-muted-foreground">{c.device_name}</div>}
                    {c.vlan_id && <div className="text-muted-foreground">VLAN: {c.vlan_id}</div>}
                    {c.location && <div className="text-muted-foreground">Loc: {c.location}</div>}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </Card>
      )}
    </div>
  );
}
