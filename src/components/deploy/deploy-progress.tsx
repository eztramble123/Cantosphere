"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Check,
  Loader2,
  X,
  FileCheck,
  Search,
  Upload,
  Shield,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

interface DeploymentStep {
  step: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "SKIPPED";
  message?: string;
}

interface DeploymentStatusResponse {
  id: string;
  status: string;
  errorMessage?: string;
  steps: DeploymentStep[];
}

const STEP_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  VALIDATE_DAR: { label: "Validate DAR", icon: FileCheck },
  CHECK_DEPENDENCIES: { label: "Check Dependencies", icon: Search },
  UPLOAD_DAR: { label: "Upload to Node", icon: Upload },
  VET_PACKAGES: { label: "Vet Packages", icon: Shield },
  VERIFY_DEPLOYMENT: { label: "Verify Deployment", icon: CheckCircle },
};

interface DeployProgressProps {
  deploymentId: string;
  onComplete?: () => void;
}

export function DeployProgress({
  deploymentId,
  onComplete,
}: DeployProgressProps) {
  const [status, setStatus] = useState<DeploymentStatusResponse | null>(
    null
  );
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!polling) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/deployments/${deploymentId}/status`
        );
        if (res.ok) {
          const json = await res.json();
          const data: DeploymentStatusResponse = json.data;
          setStatus(data);

          if (data.status === "COMPLETED") {
            setPolling(false);
            toast.success("Deployment completed");
          } else if (data.status === "FAILED") {
            setPolling(false);
            toast.error("Deployment failed");
          }
        }
      } catch {
        // Retry on next interval
      }
    }, 2000);

    // Initial fetch
    fetch(`/api/deployments/${deploymentId}/status`)
      .then((res) => res.json())
      .then((json) => setStatus(json.data))
      .catch(() => {});

    return () => clearInterval(interval);
  }, [deploymentId, polling]);

  if (!status) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isComplete = status.status === "COMPLETED";
  const isFailed = status.status === "FAILED";

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-3">
        {status.steps.map((step) => {
          const config = STEP_CONFIG[step.step] || {
            label: step.step,
            icon: Check,
          };
          const StepIcon = config.icon;

          return (
            <div key={step.step} className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {step.status === "COMPLETED" ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
                    <Check className="h-4 w-4" />
                  </div>
                ) : step.status === "IN_PROGRESS" ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : step.status === "FAILED" ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <X className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <StepIcon className="h-4 w-4" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    step.status === "PENDING"
                      ? "text-muted-foreground"
                      : ""
                  }`}
                >
                  {config.label}
                </p>
                {step.message && (
                  <p className="text-xs text-muted-foreground truncate">
                    {step.message}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isFailed && status.errorMessage && (
        <div className="rounded-md bg-destructive/10 p-3">
          <p className="text-sm text-destructive">
            {status.errorMessage}
          </p>
        </div>
      )}

      {(isComplete || isFailed) && onComplete && (
        <Button
          onClick={onComplete}
          variant={isComplete ? "default" : "outline"}
          className="w-full"
        >
          {isComplete ? "Done" : "Close"}
        </Button>
      )}
    </div>
  );
}
