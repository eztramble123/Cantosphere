"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface NodeHealthProps {
  nodeId: string;
  initialStatus?: string;
}

export function NodeHealth({ nodeId, initialStatus }: NodeHealthProps) {
  const [status, setStatus] = useState(initialStatus || "UNKNOWN");
  const [checking, setChecking] = useState(false);

  async function checkHealth() {
    setChecking(true);
    try {
      const res = await fetch(`/api/nodes/${nodeId}/health`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
      }
    } catch {
      setStatus("UNREACHABLE");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    checkHealth();
  }, [nodeId]);

  if (checking) {
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking
      </Badge>
    );
  }

  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    HEALTHY: { variant: "default", label: "Healthy" },
    UNHEALTHY: { variant: "destructive", label: "Unhealthy" },
    UNREACHABLE: { variant: "destructive", label: "Unreachable" },
    UNKNOWN: { variant: "outline", label: "Unknown" },
  };

  const config = variants[status] || variants.UNKNOWN;

  return (
    <Badge
      variant={config.variant}
      className="cursor-pointer"
      onClick={checkHealth}
    >
      {config.label}
    </Badge>
  );
}
