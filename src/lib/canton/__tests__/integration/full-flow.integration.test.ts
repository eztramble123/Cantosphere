import { describe, it, expect, beforeAll } from "vitest";
import type { ILedgerApiClient, DamlAppListing } from "../../ledger-api/types";
import {
  isSandboxAvailable,
  createTestClient,
  parties,
  uniqueId,
} from "./setup";

const LISTING_TEMPLATE = "Canton.Marketplace:AppListing";
const LICENSE_TEMPLATE = "Canton.Marketplace:License";
const INSTALLATION_TEMPLATE = "Canton.Marketplace:Installation";

let sandboxAvailable = false;
let client: ILedgerApiClient;

beforeAll(async () => {
  sandboxAvailable = await isSandboxAvailable();
  if (sandboxAvailable) {
    client = createTestClient();
  }
});

describe.skipIf(!sandboxAvailable)(
  "Full Marketplace Flow — Sandbox",
  () => {
    it("should complete listing → license → installation flow", async () => {
      const appId = uniqueId("flow");

      // 1. Create an AppListing
      const listingContractId = await client.createContract<DamlAppListing>(
        LISTING_TEMPLATE,
        {
          operator: parties.operator,
          provider: parties.provider,
          appId,
          appName: "Full Flow Test App",
          description: "End-to-end flow test",
          darHash: "sha256:fullflow",
          pricingModel: {
            tag: "OneTime",
            value: { amount: "49.99", currency: "USD" },
          },
          supportEmail: "support@test.com",
          supportUrl: "https://test.com/support",
          active: true,
        }
      );

      expect(listingContractId).toBeTruthy();

      // 2. Query the listing to verify
      const listings =
        await client.getActiveContracts<DamlAppListing>(LISTING_TEMPLATE);
      const listing = listings.find(
        (c) => c.contractId === listingContractId
      );
      expect(listing).toBeDefined();
      expect(listing!.payload.appName).toBe("Full Flow Test App");

      // 3. Grant a license
      const licenseContractId = await client.createContract(LICENSE_TEMPLATE, {
        operator: parties.operator,
        provider: parties.provider,
        licensee: parties.validator,
        listingContractId,
        appName: "Full Flow Test App",
        pricingModel: {
          tag: "OneTime",
          value: { amount: "49.99", currency: "USD" },
        },
        grantedAt: new Date().toISOString(),
        expiresAt: null,
        active: true,
      });

      expect(licenseContractId).toBeTruthy();

      // 4. Create an installation record
      const installContractId = await client.createContract(
        INSTALLATION_TEMPLATE,
        {
          operator: parties.operator,
          provider: parties.provider,
          user: parties.validator,
          appId,
          appName: "Full Flow Test App",
          nodeId: "test-node-1",
          versionId: "v1.0.0",
          darHash: "sha256:fullflow",
        }
      );

      expect(installContractId).toBeTruthy();

      // 5. Update the listing
      const updateResult = await client.exerciseChoice(
        listingContractId,
        LISTING_TEMPLATE,
        "UpdateListing",
        {
          newDescription: "Updated by full flow test",
          newDarHash: null,
          newPricingModel: null,
          newSupportEmail: null,
          newSupportUrl: null,
        }
      );

      expect(updateResult.completionOffset).toBeTruthy();

      // Get the new listing contract ID from the update
      const updatedEvent = updateResult.transaction?.events?.find(
        (e) => e.created
      );
      const updatedListingId = updatedEvent?.created?.contractId;
      expect(updatedListingId).toBeTruthy();

      // 6. Renew the license
      const renewResult = await client.exerciseChoice(
        licenseContractId,
        LICENSE_TEMPLATE,
        "Renew",
        { renewedAt: new Date().toISOString() }
      );

      expect(renewResult.completionOffset).toBeTruthy();

      const renewedEvent = renewResult.transaction?.events?.find(
        (e) => e.created
      );
      const renewedLicenseId = renewedEvent?.created?.contractId;

      // 7. Revoke the renewed license
      if (renewedLicenseId) {
        const revokeResult = await client.exerciseChoice(
          renewedLicenseId,
          LICENSE_TEMPLATE,
          "Revoke",
          {}
        );
        expect(revokeResult.completionOffset).toBeTruthy();
      }

      // 8. Delist the app
      if (updatedListingId) {
        const delistResult = await client.exerciseChoice(
          updatedListingId,
          LISTING_TEMPLATE,
          "DelistApp",
          {}
        );
        expect(delistResult.completionOffset).toBeTruthy();
      }
    });

    it("should handle multiple pricing model variants", async () => {
      const pricingModels = [
        { tag: "Free" as const },
        { tag: "OneTime" as const, value: { amount: "100.00", currency: "EUR" } },
        {
          tag: "Subscription" as const,
          value: { amount: "9.99", currency: "USD", intervalDays: 30 },
        },
        {
          tag: "UsageBased" as const,
          value: { ratePerMarker: "0.001", currency: "USD" },
        },
      ];

      for (const pricingModel of pricingModels) {
        const appId = uniqueId(`pricing-${pricingModel.tag.toLowerCase()}`);
        const contractId = await client.createContract(LISTING_TEMPLATE, {
          operator: parties.operator,
          provider: parties.provider,
          appId,
          appName: `${pricingModel.tag} Pricing App`,
          description: `Testing ${pricingModel.tag} pricing model`,
          darHash: "sha256:pricingtest",
          pricingModel,
          supportEmail: "",
          supportUrl: "",
          active: true,
        });

        expect(contractId).toBeTruthy();

        // Cleanup
        await client.exerciseChoice(
          contractId,
          LISTING_TEMPLATE,
          "DelistApp",
          {}
        );
      }
    });
  }
);
