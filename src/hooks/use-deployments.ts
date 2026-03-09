"use client";

import { useState, useEffect } from "react";

interface Deployment {
  id: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  version: {
    version: string;
    app: { name: string; slug: string };
  };
  node: { name: string };
}

export function useDeployments() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchDeployments() {
    try {
      const res = await fetch("/api/deployments");
      if (res.ok) {
        const data = await res.json();
        setDeployments(data.data || []);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDeployments();
  }, []);

  return { deployments, loading, refresh: fetchDeployments };
}
