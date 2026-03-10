import { db } from "@/lib/db";
import type { ILedgerApiClient, DamlAppListing, ActiveContract } from "../ledger-api/types";
import { toDamlPricingModel } from "./converters";

const TEMPLATE_ID = "Canton.Marketplace:AppListing";

export class ListingContractService {
  constructor(
    private ledger: ILedgerApiClient,
    private operatorParty: string
  ) {}

  /**
   * Create an on-chain AppListing contract and update Postgres with the contract ID.
   */
  async createOnChainListing(
    listingId: string,
    data: {
      providerParty: string;
      appId: string;
      appName: string;
      description: string;
      darHash: string;
      pricingModel: string;
      priceAmount?: string | null;
      priceCurrency?: string | null;
      billingPeriodDays?: number | null;
      usageRate?: string | null;
      supportEmail?: string | null;
      supportUrl?: string | null;
    }
  ): Promise<string> {
    const payload: DamlAppListing = {
      operator: this.operatorParty,
      provider: data.providerParty,
      appId: data.appId,
      appName: data.appName,
      description: data.description,
      darHash: data.darHash,
      pricingModel: toDamlPricingModel(
        data.pricingModel as Parameters<typeof toDamlPricingModel>[0],
        data.priceAmount,
        data.priceCurrency,
        data.billingPeriodDays,
        data.usageRate
      ),
      supportEmail: data.supportEmail ?? "",
      supportUrl: data.supportUrl ?? "",
      active: true,
    };

    const contractId = await this.ledger.createContract(TEMPLATE_ID, payload);

    await db.appListing.update({
      where: { id: listingId },
      data: { onChainContractId: contractId },
    });

    return contractId;
  }

  /**
   * Exercise UpdateListing choice on an existing contract.
   */
  async updateOnChainListing(
    contractId: string,
    updates: Record<string, unknown>
  ) {
    return this.ledger.exerciseChoice(
      contractId,
      TEMPLATE_ID,
      "UpdateListing",
      updates
    );
  }

  /**
   * Exercise DelistApp choice to deactivate an on-chain listing.
   */
  async delistOnChain(contractId: string) {
    return this.ledger.exerciseChoice(
      contractId,
      TEMPLATE_ID,
      "DelistApp",
      {}
    );
  }

  /**
   * Query all active AppListing contracts from the ledger.
   */
  async queryActiveListings(): Promise<ActiveContract<DamlAppListing>[]> {
    return this.ledger.getActiveContracts<DamlAppListing>(TEMPLATE_ID);
  }
}
