import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { ILedgerApiClient } from "../../ledger-api/types";
import {
  isSandboxAvailable,
  createTestClient,
  parties,
  uniqueId,
} from "./setup";

const LISTING_TEMPLATE = "Canton.Marketplace:AppListing";
const INSTALLATION_TEMPLATE = "Canton.Marketplace:Installation";
const LICENSE_TEMPLATE = "Canton.Marketplace:License";

let sandboxAvailable = false;
let client: ILedgerApiClient;
const contractsToCleanup: { contractId: string; templateId: string }[] = [];

beforeAll(async () => {
  sandboxAvailable = await isSandboxAvailable();
  if (sandboxAvailable) {
    client = createTestClient();
  }
});

afterEach(async () => {
  if (!sandboxAvailable) return;
  // Archive all contracts created during the test
  for (const { contractId, templateId } of contractsToCleanup) {
    try {
      if (templateId === LISTING_TEMPLATE) {
        await client.exerciseChoice(contractId, templateId, "DelistApp", {});
      } else if (templateId === LICENSE_TEMPLATE) {
        await client.exerciseChoice(contractId, templateId, "Revoke", {});
      }
    } catch {
      // Ignore cleanup errors — contract may already be archived
    }
  }
  contractsToCleanup.length = 0;
});

describe.skipIf(!sandboxAvailable)("LedgerApiClient — Sandbox", () => {
  describe("health check", () => {
    it("should report healthy", async () => {
      const healthy = await client.healthCheck();
      expect(healthy).toBe(true);
    });
  });

  describe("create and query contracts", () => {
    it("should create an AppListing and query it back", async () => {
      const appId = uniqueId("listing");
      const contractId = await client.createContract(LISTING_TEMPLATE, {
        operator: parties.operator,
        provider: parties.provider,
        appId,
        appName: "Integration Test App",
        description: "Created by integration test",
        darHash: "sha256:integrationtest",
        pricingModel: { tag: "Free" },
        supportEmail: "test@example.com",
        supportUrl: "",
        active: true,
      });

      contractsToCleanup.push({
        contractId,
        templateId: LISTING_TEMPLATE,
      });

      expect(contractId).toBeTruthy();
      expect(typeof contractId).toBe("string");

      // Query it back
      const contracts = await client.getActiveContracts(LISTING_TEMPLATE);
      const found = contracts.find((c) => c.contractId === contractId);
      expect(found).toBeDefined();
      expect(found!.payload).toMatchObject({
        appId,
        appName: "Integration Test App",
        active: true,
      });
    });

    it("should create an Installation contract", async () => {
      const appId = uniqueId("install");
      const contractId = await client.createContract(INSTALLATION_TEMPLATE, {
        operator: parties.operator,
        provider: parties.provider,
        user: parties.validator,
        appId,
        appName: "Install Test App",
        nodeId: "test-node-1",
        versionId: "v1.0.0",
        darHash: "sha256:installtest",
      });

      expect(contractId).toBeTruthy();

      const contracts = await client.getActiveContracts(INSTALLATION_TEMPLATE);
      const found = contracts.find((c) => c.contractId === contractId);
      expect(found).toBeDefined();
    });

    it("should create a License contract", async () => {
      const contractId = await client.createContract(LICENSE_TEMPLATE, {
        operator: parties.operator,
        provider: parties.provider,
        licensee: parties.validator,
        listingContractId: "test-listing-contract-id",
        appName: "Licensed Test App",
        pricingModel: {
          tag: "Subscription",
          value: { amount: "9.99", currency: "USD", intervalDays: 30 },
        },
        grantedAt: new Date().toISOString(),
        expiresAt: null,
        active: true,
      });

      contractsToCleanup.push({
        contractId,
        templateId: LICENSE_TEMPLATE,
      });

      expect(contractId).toBeTruthy();
    });
  });

  describe("exercise choices", () => {
    it("should exercise UpdateListing on an AppListing", async () => {
      const appId = uniqueId("update");
      const contractId = await client.createContract(LISTING_TEMPLATE, {
        operator: parties.operator,
        provider: parties.provider,
        appId,
        appName: "Update Test App",
        description: "Original description",
        darHash: "sha256:updatetest",
        pricingModel: { tag: "Free" },
        supportEmail: "",
        supportUrl: "",
        active: true,
      });

      const result = await client.exerciseChoice(
        contractId,
        LISTING_TEMPLATE,
        "UpdateListing",
        {
          newDescription: "Updated description",
          newDarHash: null,
          newPricingModel: null,
          newSupportEmail: null,
          newSupportUrl: null,
        }
      );

      expect(result.completionOffset).toBeTruthy();

      // The updated contract should exist
      const created = result.transaction?.events?.find((e) => e.created);
      if (created?.created) {
        contractsToCleanup.push({
          contractId: created.created.contractId,
          templateId: LISTING_TEMPLATE,
        });
      }
    });

    it("should exercise DelistApp to archive a listing", async () => {
      const appId = uniqueId("delist");
      const contractId = await client.createContract(LISTING_TEMPLATE, {
        operator: parties.operator,
        provider: parties.provider,
        appId,
        appName: "Delist Test App",
        description: "Will be delisted",
        darHash: "sha256:delisttest",
        pricingModel: { tag: "Free" },
        supportEmail: "",
        supportUrl: "",
        active: true,
      });

      const result = await client.exerciseChoice(
        contractId,
        LISTING_TEMPLATE,
        "DelistApp",
        {}
      );

      expect(result.completionOffset).toBeTruthy();
    });

    it("should exercise Renew on a License", async () => {
      const contractId = await client.createContract(LICENSE_TEMPLATE, {
        operator: parties.operator,
        provider: parties.provider,
        licensee: parties.validator,
        listingContractId: uniqueId("renew-listing"),
        appName: "Renew Test App",
        pricingModel: { tag: "Free" },
        grantedAt: "2026-01-01T00:00:00Z",
        expiresAt: "2026-02-01T00:00:00Z",
        active: true,
      });

      const result = await client.exerciseChoice(
        contractId,
        LICENSE_TEMPLATE,
        "Renew",
        { renewedAt: "2026-02-01T00:00:00Z" }
      );

      expect(result.completionOffset).toBeTruthy();

      // Cleanup the renewed contract
      const created = result.transaction?.events?.find((e) => e.created);
      if (created?.created) {
        contractsToCleanup.push({
          contractId: created.created.contractId,
          templateId: LICENSE_TEMPLATE,
        });
      }
    });

    it("should exercise Revoke on a License", async () => {
      const contractId = await client.createContract(LICENSE_TEMPLATE, {
        operator: parties.operator,
        provider: parties.provider,
        licensee: parties.validator,
        listingContractId: uniqueId("revoke-listing"),
        appName: "Revoke Test App",
        pricingModel: { tag: "Free" },
        grantedAt: new Date().toISOString(),
        expiresAt: null,
        active: true,
      });

      const result = await client.exerciseChoice(
        contractId,
        LICENSE_TEMPLATE,
        "Revoke",
        {}
      );

      expect(result.completionOffset).toBeTruthy();
    });
  });
});
