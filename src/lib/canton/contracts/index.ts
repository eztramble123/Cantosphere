import { createLedgerApiClient } from "../ledger-api";
import { ListingContractService } from "./listing-service";
import { InstallContractService } from "./install-service";
import { LicenseContractService } from "./license-service";
import { PaymentContractService } from "./payment-service";

export { ListingContractService } from "./listing-service";
export { InstallContractService } from "./install-service";
export { LicenseContractService } from "./license-service";
export { PaymentContractService } from "./payment-service";
export { toDamlPricingModel, fromDamlPricingModel } from "./converters";

function getOperatorParty(): string {
  return (
    process.env.CANTON_PARTY_MARKETPLACE_OPERATOR ||
    "MarketplaceOperator::mock"
  );
}

/**
 * Create all contract service instances backed by the same ledger client.
 */
export function createContractServices() {
  const ledger = createLedgerApiClient();
  const operatorParty = getOperatorParty();

  return {
    listings: new ListingContractService(ledger, operatorParty),
    installs: new InstallContractService(ledger, operatorParty),
    licenses: new LicenseContractService(ledger, operatorParty),
    payments: new PaymentContractService(ledger, operatorParty),
  };
}
