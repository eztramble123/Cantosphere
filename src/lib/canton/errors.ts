export class CantonError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: string
  ) {
    super(message);
    this.name = "CantonError";
  }
}

export class ConnectionError extends CantonError {
  constructor(host: string, port: number, cause?: string) {
    super(
      `Failed to connect to Canton node at ${host}:${port}`,
      "CONNECTION_ERROR",
      cause
    );
    this.name = "ConnectionError";
  }
}

export class UploadError extends CantonError {
  constructor(details?: string) {
    super("Failed to upload DAR file", "UPLOAD_ERROR", details);
    this.name = "UploadError";
  }
}

export class VettingError extends CantonError {
  constructor(details?: string) {
    super("Failed to vet packages", "VETTING_ERROR", details);
    this.name = "VettingError";
  }
}

export class DarValidationError extends CantonError {
  constructor(details?: string) {
    super("Invalid DAR file", "DAR_VALIDATION_ERROR", details);
    this.name = "DarValidationError";
  }
}

export class LedgerApiError extends CantonError {
  constructor(details?: string) {
    super(details || "Ledger API operation failed", "LEDGER_API_ERROR", details);
    this.name = "LedgerApiError";
  }
}
