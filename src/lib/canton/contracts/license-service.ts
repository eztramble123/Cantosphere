import { db } from "@/lib/db";
import type { ILedgerApiClient, DamlLicense, CommandResult } from "../ledger-api/types";
import { toDamlPricingModel } from "./converters";
import type { PricingModel } from "@prisma/client";

const TEMPLATE_ID = "Canton.Marketplace:License";

export class LicenseContractService {
  constructor(
    private ledger: ILedgerApiClient,
    private operatorParty: string
  ) {}

  /**
   * Create an on-chain License contract and update Postgres with the contract ID.
   */
  async grantLicenseOnChain(
    licenseId: string,
    data: {
      providerParty: string;
      licenseeParty: string;
      listingContractId: string;
      appName: string;
      pricingModel: PricingModel;
      priceAmount?: string | null;
      priceCurrency?: string | null;
      billingPeriodDays?: number | null;
      usageRate?: string | null;
      expiresAt?: Date | null;
    }
  ): Promise<string> {
    const payload: DamlLicense = {
      operator: this.operatorParty,
      provider: data.providerParty,
      licensee: data.licenseeParty,
      listingContractId: data.listingContractId,
      appName: data.appName,
      pricingModel: toDamlPricingModel(
        data.pricingModel,
        data.priceAmount,
        data.priceCurrency,
        data.billingPeriodDays,
        data.usageRate
      ),
      grantedAt: new Date().toISOString(),
      expiresAt: data.expiresAt?.toISOString() ?? null,
      active: true,
    };

    const contractId = await this.ledger.createContract(TEMPLATE_ID, payload);

    await db.license.update({
      where: { id: licenseId },
      data: { onChainContractId: contractId },
    });

    return contractId;
  }

  /**
   * Exercise Renew choice on an existing License contract.
   */
  async renewOnChain(contractId: string): Promise<CommandResult> {
    return this.ledger.exerciseChoice(
      contractId,
      TEMPLATE_ID,
      "Renew",
      { renewedAt: new Date().toISOString() }
    );
  }

  /**
   * Exercise Revoke choice on an existing License contract.
   */
  async revokeOnChain(contractId: string): Promise<CommandResult> {
    return this.ledger.exerciseChoice(
      contractId,
      TEMPLATE_ID,
      "Revoke",
      {}
    );
  }

  /**
   * Exercise Cancel choice on an existing License contract.
   */
  async cancelOnChain(contractId: string): Promise<CommandResult> {
    return this.ledger.exerciseChoice(
      contractId,
      TEMPLATE_ID,
      "Cancel",
      {}
    );
  }
}
