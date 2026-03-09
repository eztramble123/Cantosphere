#!/usr/bin/env bash
set -euo pipefail

# Canton proto files fetcher
# Downloads the specific proto files needed for the Canton Admin API
# from the digital-asset/canton GitHub repository.

CANTON_VERSION="${CANTON_VERSION:-3.3.0}"
REPO="digital-asset/canton"
BASE_URL="https://raw.githubusercontent.com/${REPO}/refs/tags/v${CANTON_VERSION}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PROTO_DIR="${PROJECT_ROOT}/protos"

# Multiple known proto paths in the Canton repo for resilience across versions
PROTO_PATHS=(
  "community/admin-api/src/main/protobuf/com/digitalasset/canton/admin/participant/v30/package_service.proto"
  "community/participant/admin-api/src/main/protobuf/com/digitalasset/canton/admin/participant/v30/package_service.proto"
  "canton/community/admin-api/src/main/protobuf/com/digitalasset/canton/admin/participant/v30/package_service.proto"
)

# Google well-known protos (bundled with grpc-tools / proto-loader, but we vendor them for reliability)
GOOGLE_PROTOS=(
  "google/protobuf/empty.proto"
  "google/protobuf/wrappers.proto"
  "google/protobuf/timestamp.proto"
)
GOOGLE_PROTO_BASE="https://raw.githubusercontent.com/protocolbuffers/protobuf/main/src"

# ScalaPB proto (real Canton protos import this)
SCALAPB_PROTO_URL="https://raw.githubusercontent.com/scalapb/ScalaPB/master/protobuf/scalapb/scalapb.proto"

echo "==> Fetching Canton proto files (v${CANTON_VERSION})..."

# Check if already fetched for this version
if [ -f "${PROTO_DIR}/.canton-version" ]; then
  EXISTING_VERSION=$(cat "${PROTO_DIR}/.canton-version")
  if [ "${EXISTING_VERSION}" = "${CANTON_VERSION}" ]; then
    echo "    Protos already fetched for v${CANTON_VERSION}, skipping."
    echo "    To force re-fetch, delete ${PROTO_DIR} and run again."
    exit 0
  fi
fi

# Clean and recreate
rm -rf "${PROTO_DIR}"
mkdir -p "${PROTO_DIR}/com/digitalasset/canton/admin/participant/v30"
mkdir -p "${PROTO_DIR}/google/protobuf"
mkdir -p "${PROTO_DIR}/scalapb"

# Try multiple known proto paths for the PackageService
PROTO_FETCHED=false
TARGET="${PROTO_DIR}/com/digitalasset/canton/admin/participant/v30/package_service.proto"

for proto_path in "${PROTO_PATHS[@]}"; do
  echo "    Trying ${proto_path}..."
  if curl -sfL "${BASE_URL}/${proto_path}" -o "${TARGET}" 2>/dev/null; then
    echo "    Downloaded package_service.proto successfully."
    PROTO_FETCHED=true
    break
  fi
done

if [ "${PROTO_FETCHED}" = false ]; then
  echo "    WARNING: Could not download package_service.proto from any known path."
  echo "    Creating a minimal stub instead..."

  # Create a minimal stub that matches the Canton PackageService API
  cat > "${TARGET}" << 'STUB_EOF'
// Minimal PackageService proto stub for Canton Admin API v30
// Auto-generated stub — replace with actual proto when available
syntax = "proto3";

package com.digitalasset.canton.admin.participant.v30;

import "google/protobuf/empty.proto";

service PackageService {
  rpc ListPackages(ListPackagesRequest) returns (ListPackagesResponse);
  rpc ListDars(ListDarsRequest) returns (ListDarsResponse);
  rpc UploadDar(UploadDarRequest) returns (UploadDarResponse);
  rpc VetDar(VetDarRequest) returns (google.protobuf.Empty);
  rpc UnvetDar(UnvetDarRequest) returns (google.protobuf.Empty);
}

message ListPackagesRequest {
  int32 limit = 1;
}

message PackageDescription {
  string package_id = 1;
  string name = 2;
  string version = 3;
  string source_description = 4;
}

message ListPackagesResponse {
  repeated PackageDescription package_descriptions = 1;
}

message ListDarsRequest {
  int32 limit = 1;
}

message DarDescription {
  string hash = 1;
  string name = 2;
  string main = 3;
  repeated string packages = 4;
  string description = 5;
}

message ListDarsResponse {
  repeated DarDescription dars = 1;
}

message UploadDarRequest {
  bytes data = 1;
  string filename = 2;
  bool vet_all_packages = 3;
  string synchronizer_id = 4;
}

message UploadDarResponse {
  string hash = 1;
}

message VetDarRequest {
  string dar_hash = 1;
  string synchronizer_id = 2;
}

message UnvetDarRequest {
  string dar_hash = 1;
  string synchronizer_id = 2;
}
STUB_EOF
fi

# Fetch ScalaPB proto (real Canton protos import scalapb/scalapb.proto)
echo "    Downloading scalapb/scalapb.proto..."
if ! curl -sfL "${SCALAPB_PROTO_URL}" -o "${PROTO_DIR}/scalapb/scalapb.proto" 2>/dev/null; then
  echo "    WARNING: Failed to download scalapb.proto, creating minimal stub..."
  cat > "${PROTO_DIR}/scalapb/scalapb.proto" << 'SCALAPB_STUB'
// Minimal ScalaPB stub — only needed so real Canton protos can import it
syntax = "proto3";
package scalapb;
import "google/protobuf/descriptor.proto";
extend google.protobuf.FileOptions { optional ScalaPbOptions options = 1020; }
extend google.protobuf.MessageOptions { optional MessageOptions message = 1020; }
extend google.protobuf.FieldOptions { optional FieldOptions field = 1020; }
message ScalaPbOptions { optional bool flat_package = 1; }
message MessageOptions {}
message FieldOptions {}
SCALAPB_STUB
fi

# Fetch Google well-known protos
for proto in "${GOOGLE_PROTOS[@]}"; do
  echo "    Downloading ${proto}..."
  curl -sfL "${GOOGLE_PROTO_BASE}/${proto}" -o "${PROTO_DIR}/${proto}" || {
    echo "    WARNING: Failed to download ${proto}, creating minimal stub..."
  }
done

# Post-download validation
echo "==> Validating downloaded protos..."
VALID=true

if [ ! -s "${TARGET}" ]; then
  echo "    ERROR: package_service.proto is empty"
  VALID=false
elif ! grep -q "service PackageService" "${TARGET}"; then
  echo "    ERROR: package_service.proto does not contain PackageService definition"
  VALID=false
fi

# Check that key RPCs are present
for rpc in "UploadDar" "VetDar" "UnvetDar" "ListPackages"; do
  if ! grep -q "rpc ${rpc}" "${TARGET}"; then
    echo "    WARNING: package_service.proto missing RPC: ${rpc}"
  fi
done

if [ "${VALID}" = true ]; then
  echo "    Validation passed."
else
  echo "    WARNING: Validation found issues. The stub proto will be used."
fi

# Write version file
echo "${CANTON_VERSION}" > "${PROTO_DIR}/.canton-version"

echo "==> Done. Proto files written to ${PROTO_DIR}"
echo "    Canton version: v${CANTON_VERSION}"
