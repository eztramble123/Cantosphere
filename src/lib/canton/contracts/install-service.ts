import { db } from "@/lib/db";
import type { ILedgerApiClient, CommandResult } from "../ledger-api/types";

const LISTING_TEMPLATE_ID = "Canton.Marketplace:AppListing";
const INSTALL_REQUEST_TEMPLATE_ID = "Canton.Marketplace:InstallRequest";
const INSTALLATION_TEMPLATE_ID = "Canton.Marketplace:Installation";

export class InstallContractService {
  constructor(
    private ledger: ILedgerApiClient,
    private operatorParty: string
  ) {}

  /**
   * Exercise RequestInstall choice on an AppListing contract.
   * Updates the InstallRequest in Postgres with the resulting contract ID.
   */
  async requestInstallOnChain(
    listingContractId: string,
    installRequestId: string,
    data: {
      requesterParty: string;
      nodeId: string;
      versionId: string;
    }
  ): Promise<CommandResult> {
    const result = await this.ledger.exerciseChoice(
      listingContractId,
      LISTING_TEMPLATE_ID,
      "RequestInstall",
      {
        requester: data.requesterParty,
        nodeId: data.nodeId,
        versionId: data.versionId,
      }
    );

    // Find the created contract from the transaction events
    const createdEvent = result.transaction?.events?.find((e) => e.created);
    if (createdEvent?.created) {
      await db.installRequest.update({
        where: { id: installRequestId },
        data: { onChainContractId: createdEvent.created.contractId },
      });
    }

    return result;
  }

  /**
   * Create an Installation contract after a successful deployment.
   * Updates Postgres Installation with the on-chain contract ID.
   */
  async completeInstallationOnChain(
    installationId: string,
    data: {
      providerParty: string;
      userParty: string;
      appId: string;
      appName: string;
      nodeId: string;
      versionId: string;
      darHash: string;
    }
  ): Promise<string> {
    const contractId = await this.ledger.createContract(
      INSTALLATION_TEMPLATE_ID,
      {
        operator: this.operatorParty,
        provider: data.providerParty,
        user: data.userParty,
        appId: data.appId,
        appName: data.appName,
        nodeId: data.nodeId,
        versionId: data.versionId,
        darHash: data.darHash,
      }
    );

    await db.installation.update({
      where: { id: installationId },
      data: { onChainContractId: contractId },
    });

    return contractId;
  }

  /**
   * Archive an install request contract (cancel).
   */
  async cancelRequestOnChain(contractId: string): Promise<CommandResult> {
    return this.ledger.exerciseChoice(
      contractId,
      INSTALL_REQUEST_TEMPLATE_ID,
      "CancelRequest",
      {}
    );
  }
}
