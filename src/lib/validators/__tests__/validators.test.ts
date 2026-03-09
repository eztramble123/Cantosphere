import { describe, it, expect } from "vitest";
import {
  createAppSchema,
  createVersionSchema,
  createNodeSchema,
  createReviewSchema,
  updateProfileSchema,
  createListingSchema,
  paginationSchema,
  createDeploymentSchema,
  createInstallRequestSchema,
} from "../index";

describe("createAppSchema", () => {
  it("accepts valid input", () => {
    const result = createAppSchema.safeParse({
      name: "My App",
      description: "A valid description for an app",
    });
    expect(result.success).toBe(true);
  });

  it("rejects name shorter than 2 chars", () => {
    const result = createAppSchema.safeParse({
      name: "A",
      description: "A valid description for an app",
    });
    expect(result.success).toBe(false);
  });

  it("rejects description shorter than 10 chars", () => {
    const result = createAppSchema.safeParse({
      name: "My App",
      description: "Too short",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields", () => {
    const result = createAppSchema.safeParse({
      name: "My App",
      description: "A valid description for an app",
      license: "Apache-2.0",
      repoUrl: "https://github.com/example/repo",
      categoryIds: ["cat1", "cat2"],
      tags: ["finance", "defi"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty string for optional URL fields", () => {
    const result = createAppSchema.safeParse({
      name: "My App",
      description: "A valid description for an app",
      repoUrl: "",
      websiteUrl: "",
    });
    expect(result.success).toBe(true);
  });
});

describe("createVersionSchema", () => {
  it("accepts valid semver", () => {
    expect(createVersionSchema.safeParse({ version: "1.0.0" }).success).toBe(true);
    expect(createVersionSchema.safeParse({ version: "0.1.0" }).success).toBe(true);
    expect(createVersionSchema.safeParse({ version: "10.20.30" }).success).toBe(true);
    expect(createVersionSchema.safeParse({ version: "1.0.0-beta.1" }).success).toBe(true);
  });

  it("rejects invalid versions", () => {
    expect(createVersionSchema.safeParse({ version: "1.0" }).success).toBe(false);
    expect(createVersionSchema.safeParse({ version: "v1.0.0" }).success).toBe(false);
    expect(createVersionSchema.safeParse({ version: "abc" }).success).toBe(false);
  });
});

describe("createNodeSchema", () => {
  it("accepts valid node with defaults", () => {
    const result = createNodeSchema.safeParse({
      name: "my-node",
      host: "localhost",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.port).toBe(5002);
      expect(result.data.useTls).toBe(false);
    }
  });

  it("rejects invalid port", () => {
    const result = createNodeSchema.safeParse({
      name: "my-node",
      host: "localhost",
      port: 99999,
    });
    expect(result.success).toBe(false);
  });

  it("rejects port 0", () => {
    const result = createNodeSchema.safeParse({
      name: "my-node",
      host: "localhost",
      port: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("createReviewSchema", () => {
  it("accepts rating 1-5", () => {
    for (let i = 1; i <= 5; i++) {
      expect(createReviewSchema.safeParse({ rating: i }).success).toBe(true);
    }
  });

  it("rejects rating 0 and 6", () => {
    expect(createReviewSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(createReviewSchema.safeParse({ rating: 6 }).success).toBe(false);
  });

  it("rejects non-integer rating", () => {
    expect(createReviewSchema.safeParse({ rating: 3.5 }).success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("accepts valid username", () => {
    const result = updateProfileSchema.safeParse({ username: "my-user_123" });
    expect(result.success).toBe(true);
  });

  it("rejects username with special chars", () => {
    const result = updateProfileSchema.safeParse({ username: "user@name" });
    expect(result.success).toBe(false);
  });

  it("rejects username shorter than 3 chars", () => {
    const result = updateProfileSchema.safeParse({ username: "ab" });
    expect(result.success).toBe(false);
  });
});

describe("createListingSchema", () => {
  it("accepts FREE listing", () => {
    const result = createListingSchema.safeParse({
      appId: "app1",
      pricingModel: "FREE",
    });
    expect(result.success).toBe(true);
  });

  it("accepts SUBSCRIPTION listing with billing period", () => {
    const result = createListingSchema.safeParse({
      appId: "app1",
      pricingModel: "SUBSCRIPTION",
      priceAmount: 9.99,
      billingPeriodDays: 30,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid pricing model", () => {
    const result = createListingSchema.safeParse({
      appId: "app1",
      pricingModel: "INVALID",
    });
    expect(result.success).toBe(false);
  });
});

describe("paginationSchema", () => {
  it("applies defaults", () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("coerces string values", () => {
    const result = paginationSchema.safeParse({ page: "3", pageSize: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(50);
    }
  });

  it("rejects page 0", () => {
    expect(paginationSchema.safeParse({ page: "0" }).success).toBe(false);
  });

  it("rejects pageSize over 100", () => {
    expect(paginationSchema.safeParse({ pageSize: "101" }).success).toBe(false);
  });
});

describe("createDeploymentSchema", () => {
  it("accepts valid input", () => {
    const result = createDeploymentSchema.safeParse({
      nodeId: "node1",
      versionId: "ver1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing fields", () => {
    expect(createDeploymentSchema.safeParse({ nodeId: "node1" }).success).toBe(false);
    expect(createDeploymentSchema.safeParse({ versionId: "ver1" }).success).toBe(false);
  });
});

describe("createInstallRequestSchema", () => {
  it("accepts valid input", () => {
    const result = createInstallRequestSchema.safeParse({
      listingId: "list1",
      nodeId: "node1",
      versionId: "ver1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing fields", () => {
    expect(
      createInstallRequestSchema.safeParse({ listingId: "list1" }).success
    ).toBe(false);
  });
});
