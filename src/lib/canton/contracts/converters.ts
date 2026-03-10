import type { PricingModel } from "@prisma/client";
import type { DamlPricingModel } from "../ledger-api/types";

/**
 * Convert Prisma pricing fields to a Daml pricing model variant.
 */
export function toDamlPricingModel(
  model: PricingModel,
  amount?: string | null,
  currency?: string | null,
  billingPeriodDays?: number | null,
  usageRate?: string | null
): DamlPricingModel {
  switch (model) {
    case "FREE":
      return { tag: "Free" };
    case "ONE_TIME":
      return {
        tag: "OneTime",
        value: { amount: amount ?? "0", currency: currency ?? "USD" },
      };
    case "SUBSCRIPTION":
      return {
        tag: "Subscription",
        value: {
          amount: amount ?? "0",
          currency: currency ?? "USD",
          intervalDays: billingPeriodDays ?? 30,
        },
      };
    case "USAGE_BASED":
      return {
        tag: "UsageBased",
        value: {
          ratePerMarker: usageRate ?? "0",
          currency: currency ?? "USD",
        },
      };
  }
}

/**
 * Convert a Daml pricing model variant back to Prisma fields.
 */
export function fromDamlPricingModel(daml: DamlPricingModel): {
  model: PricingModel;
  amount: string | null;
  currency: string | null;
  billingPeriodDays: number | null;
  usageRate: string | null;
} {
  switch (daml.tag) {
    case "Free":
      return {
        model: "FREE",
        amount: null,
        currency: null,
        billingPeriodDays: null,
        usageRate: null,
      };
    case "OneTime":
      return {
        model: "ONE_TIME",
        amount: daml.value.amount,
        currency: daml.value.currency,
        billingPeriodDays: null,
        usageRate: null,
      };
    case "Subscription":
      return {
        model: "SUBSCRIPTION",
        amount: daml.value.amount,
        currency: daml.value.currency,
        billingPeriodDays: daml.value.intervalDays,
        usageRate: null,
      };
    case "UsageBased":
      return {
        model: "USAGE_BASED",
        amount: null,
        currency: daml.value.currency,
        billingPeriodDays: null,
        usageRate: daml.value.ratePerMarker,
      };
  }
}
