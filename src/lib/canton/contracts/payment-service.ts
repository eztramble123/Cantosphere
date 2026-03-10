import type {
  ILedgerApiClient,
  ActiveContract,
  DamlCantonCoin,
  CommandResult,
} from "../ledger-api/types";

const COIN_TEMPLATE_ID = "Canton.Coin:CantonCoin";
const LISTING_TEMPLATE_ID = "Canton.Marketplace:AppListing";

export class PaymentContractService {
  constructor(
    private ledger: ILedgerApiClient,
    private operatorParty: string
  ) {}

  /**
   * Exercise Purchase choice on an AppListing contract.
   * Returns the created license contract ID and optional change coin contract ID.
   */
  async purchaseOnChain(
    listingContractId: string,
    data: {
      buyerParty: string;
      coinContractId: string;
    }
  ): Promise<{ licenseContractId: string; changeContractId?: string }> {
    const result: CommandResult = await this.ledger.exerciseChoice(
      listingContractId,
      LISTING_TEMPLATE_ID,
      "Purchase",
      {
        buyer: data.buyerParty,
        coinCid: data.coinContractId,
      }
    );

    // The Purchase choice creates a License contract and optionally a change CantonCoin.
    // Extract the created contract IDs from the transaction events.
    const createdEvents =
      result.transaction?.events.filter((e) => e.created) ?? [];

    let licenseContractId = "";
    let changeContractId: string | undefined;

    for (const event of createdEvents) {
      if (!event.created) continue;
      if (event.created.templateId.includes("License")) {
        licenseContractId = event.created.contractId;
      } else if (event.created.templateId.includes("CantonCoin")) {
        changeContractId = event.created.contractId;
      }
    }

    if (!licenseContractId) {
      // Fallback: use the first created contract if template matching didn't work
      const firstCreated = createdEvents[0]?.created;
      if (firstCreated) {
        licenseContractId = firstCreated.contractId;
      } else {
        throw new Error("Purchase did not produce a License contract");
      }
    }

    return { licenseContractId, changeContractId };
  }

  /**
   * Query a party's CC balance by summing all their CantonCoin contracts.
   */
  async getBalance(
    ownerParty: string
  ): Promise<{ total: string; coins: ActiveContract<DamlCantonCoin>[] }> {
    const allCoins =
      await this.ledger.getActiveContracts<DamlCantonCoin>(COIN_TEMPLATE_ID);

    const owned = allCoins.filter((c) => c.payload.owner === ownerParty);

    const total = owned.reduce(
      (sum, c) => sum + parseFloat(c.payload.amount),
      0
    );

    return { total: total.toFixed(2), coins: owned };
  }

  /**
   * Mint CC tokens (admin/operator only — for dev/testing).
   * Creates a CantonCoin contract with the operator as issuer.
   */
  async mintCoins(ownerParty: string, amount: string): Promise<string> {
    const payload: DamlCantonCoin = {
      issuer: this.operatorParty,
      owner: ownerParty,
      amount,
      currency: "CC",
    };

    return this.ledger.createContract(COIN_TEMPLATE_ID, payload);
  }
}
