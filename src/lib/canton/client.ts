import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "path";
import * as fs from "fs";
import type { NodeConnectionConfig } from "./types";
import { ConnectionError } from "./errors";

// ─── Proto Loading ───────────────────────────────────────

const PROTO_DIR = process.env.CANTON_PROTO_PATH || path.resolve(process.cwd(), "protos");

const PACKAGE_SERVICE_PROTO = path.join(
  PROTO_DIR,
  "com/digitalasset/canton/admin/participant/v30/package_service.proto"
);

let packageDefinition: grpc.GrpcObject | null = null;

function loadPackageDefinition(): grpc.GrpcObject {
  if (packageDefinition) return packageDefinition;

  const proto = protoLoader.loadSync(PACKAGE_SERVICE_PROTO, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [PROTO_DIR],
  });

  packageDefinition = grpc.loadPackageDefinition(proto);
  return packageDefinition;
}

// ─── Service Client Type ─────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = any;

function getServiceConstructor(): grpc.ServiceClientConstructor {
  const pkgDef = loadPackageDefinition();

  // Navigate the package definition to find PackageService
  // Path: com.digitalasset.canton.admin.participant.v30.PackageService
  const ns = pkgDef.com as grpc.GrpcObject;
  const digitalasset = ns.digitalasset as grpc.GrpcObject;
  const canton = digitalasset.canton as grpc.GrpcObject;
  const admin = canton.admin as grpc.GrpcObject;
  const participant = admin.participant as grpc.GrpcObject;
  const v30 = participant.v30 as grpc.GrpcObject;

  return v30.PackageService as grpc.ServiceClientConstructor;
}

// ─── Connection Pool ─────────────────────────────────────

const clientPool = new Map<string, ServiceClient>();

function connectionKey(config: NodeConnectionConfig): string {
  return `${config.host}:${config.port}`;
}

function createCredentials(config: NodeConnectionConfig): grpc.ChannelCredentials {
  if (!config.useTls) {
    return grpc.credentials.createInsecure();
  }

  const rootCerts = config.tlsCaPath
    ? fs.readFileSync(config.tlsCaPath)
    : null;

  // mTLS: both client cert and key provided
  if (config.tlsCertPath && config.tlsKeyPath) {
    return grpc.credentials.createSsl(
      rootCerts,
      fs.readFileSync(config.tlsKeyPath),
      fs.readFileSync(config.tlsCertPath)
    );
  }

  // TLS with custom CA only
  return grpc.credentials.createSsl(rootCerts);
}

/**
 * Get or create a PackageService gRPC client for the given node config.
 * Clients are pooled by host:port and reused if healthy.
 */
export function getPackageServiceClient(config: NodeConnectionConfig): ServiceClient {
  const key = connectionKey(config);

  const existing = clientPool.get(key);
  if (existing) {
    const state = existing.getChannel().getConnectivityState(false);
    if (
      state !== grpc.connectivityState.SHUTDOWN &&
      state !== grpc.connectivityState.TRANSIENT_FAILURE
    ) {
      return existing;
    }
    existing.close();
    clientPool.delete(key);
  }

  const ServiceConstructor = getServiceConstructor();
  const credentials = createCredentials(config);

  const client = new ServiceConstructor(
    `${config.host}:${config.port}`,
    credentials,
    {
      "grpc.keepalive_time_ms": 10000,
      "grpc.keepalive_timeout_ms": 5000,
      "grpc.max_receive_message_length": 256 * 1024 * 1024, // 256MB for large DARs
    }
  );

  clientPool.set(key, client);
  return client;
}

// ─── Health Check ────────────────────────────────────────

export async function checkNodeHealth(
  config: NodeConnectionConfig
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const client = getPackageServiceClient(config);
      const deadline = new Date(Date.now() + 5000);

      client.waitForReady(deadline, (error: Error | null) => {
        resolve(!error);
      });
    } catch {
      resolve(false);
    }
  });
}

// ─── Generic Unary Call Helper ───────────────────────────

/**
 * Make a unary RPC call on the PackageService client with timeout and error wrapping.
 */
export function makeServiceCall<TRequest, TResponse>(
  client: ServiceClient,
  method: string,
  request: TRequest,
  config: NodeConnectionConfig,
  timeoutMs: number = 30000
): Promise<TResponse> {
  const deadline = new Date(Date.now() + timeoutMs);

  return new Promise((resolve, reject) => {
    if (typeof client[method] !== "function") {
      reject(new ConnectionError(config.host, config.port, `Unknown RPC method: ${method}`));
      return;
    }

    client[method](
      request,
      new grpc.Metadata(),
      { deadline },
      (error: grpc.ServiceError | null, response: TResponse) => {
        if (error) {
          reject(new ConnectionError(config.host, config.port, error.message));
        } else {
          resolve(response);
        }
      }
    );
  });
}

// ─── Cleanup ─────────────────────────────────────────────

export function closeAllConnections(): void {
  for (const client of clientPool.values()) {
    client.close();
  }
  clientPool.clear();
}
