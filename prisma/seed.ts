import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import "dotenv/config";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const categories = [
  {
    name: "DeFi",
    slug: "defi",
    description: "Decentralized finance applications",
    icon: "coins",
  },
  {
    name: "Supply Chain",
    slug: "supply-chain",
    description: "Supply chain management and tracking",
    icon: "truck",
  },
  {
    name: "Identity",
    slug: "identity",
    description: "Digital identity and credential management",
    icon: "fingerprint",
  },
  {
    name: "Tokenization",
    slug: "tokenization",
    description: "Asset tokenization platforms",
    icon: "gem",
  },
  {
    name: "Data Management",
    slug: "data-management",
    description: "Data sharing and governance",
    icon: "database",
  },
  {
    name: "Compliance",
    slug: "compliance",
    description: "Regulatory compliance tools",
    icon: "shield-check",
  },
  {
    name: "Infrastructure",
    slug: "infrastructure",
    description: "Core infrastructure and utilities",
    icon: "server",
  },
  {
    name: "Governance",
    slug: "governance",
    description: "Organizational governance tools",
    icon: "landmark",
  },
];

async function main() {
  console.log("Seeding database...");

  // ─── Categories ──────────────────────────────────────────
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
  }
  console.log(`Seeded ${categories.length} categories`);

  // ─── Users ───────────────────────────────────────────────
  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      name: "Alice Validator",
      email: "alice@example.com",
      username: "alice",
      role: "VALIDATOR",
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      name: "Bob Developer",
      email: "bob@example.com",
      username: "bob",
      role: "DEVELOPER",
    },
  });

  const carol = await prisma.user.upsert({
    where: { email: "carol@example.com" },
    update: {},
    create: {
      name: "Carol Admin",
      email: "carol@example.com",
      username: "carol",
      role: "ADMIN",
    },
  });
  console.log(`Seeded 3 users: ${alice.id}, ${bob.id}, ${carol.id}`);

  // ─── Lookup category IDs ────────────────────────────────
  const defiCat = await prisma.category.findUniqueOrThrow({ where: { slug: "defi" } });
  const supplyCat = await prisma.category.findUniqueOrThrow({ where: { slug: "supply-chain" } });
  const complianceCat = await prisma.category.findUniqueOrThrow({ where: { slug: "compliance" } });
  const identityCat = await prisma.category.findUniqueOrThrow({ where: { slug: "identity" } });
  const govCat = await prisma.category.findUniqueOrThrow({ where: { slug: "governance" } });

  // ─── Tags ────────────────────────────────────────────────
  const tagUpsert = async (name: string) =>
    prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name, slug: name.toLowerCase().replace(/\s+/g, "-") },
    });

  const bridgeTag = await tagUpsert("bridge");
  const tokensTag = await tagUpsert("tokens");
  const logisticsTag = await tagUpsert("logistics");
  const trackingTag = await tagUpsert("tracking");

  // ─── Apps ────────────────────────────────────────────────
  const tokenBridge = await prisma.app.upsert({
    where: { slug: "canton-token-bridge" },
    update: {},
    create: {
      name: "Canton Token Bridge",
      slug: "canton-token-bridge",
      description: "Bridge tokens across Canton sub-networks with atomic settlement guarantees.",
      longDescription:
        "The Canton Token Bridge enables seamless token transfers between Canton sub-networks. " +
        "It leverages Daml's composability guarantees to ensure atomic settlement, " +
        "preventing double-spending and partial transfers.",
      status: "PUBLISHED",
      developerId: bob.id,
    },
  });

  const supplyChain = await prisma.app.upsert({
    where: { slug: "supply-chain-tracker" },
    update: {},
    create: {
      name: "Supply Chain Tracker",
      slug: "supply-chain-tracker",
      description: "End-to-end supply chain visibility with privacy-preserving data sharing.",
      status: "PUBLISHED",
      developerId: bob.id,
    },
  });

  const kycValidator = await prisma.app.upsert({
    where: { slug: "kyc-validator" },
    update: {},
    create: {
      name: "KYC Validator",
      slug: "kyc-validator",
      description: "Automated KYC/AML compliance checks with multi-party verification workflows.",
      status: "IN_REVIEW",
      developerId: bob.id,
    },
  });

  const govToolkit = await prisma.app.upsert({
    where: { slug: "governance-toolkit" },
    update: {},
    create: {
      name: "Governance Toolkit",
      slug: "governance-toolkit",
      description: "On-chain governance primitives: proposals, voting, and delegation.",
      status: "DRAFT",
      developerId: bob.id,
    },
  });
  console.log("Seeded 4 apps");

  // ─── App ↔ Category links ───────────────────────────────
  const linkAppCategory = async (appId: string, categoryId: string) => {
    await prisma.appCategory.upsert({
      where: { appId_categoryId: { appId, categoryId } },
      update: {},
      create: { appId, categoryId },
    });
  };
  await linkAppCategory(tokenBridge.id, defiCat.id);
  await linkAppCategory(supplyChain.id, supplyCat.id);
  await linkAppCategory(kycValidator.id, complianceCat.id);
  await linkAppCategory(kycValidator.id, identityCat.id);
  await linkAppCategory(govToolkit.id, govCat.id);

  // ─── App ↔ Tag links ────────────────────────────────────
  const linkAppTag = async (appId: string, tagId: string) => {
    await prisma.appTag.upsert({
      where: { appId_tagId: { appId, tagId } },
      update: {},
      create: { appId, tagId },
    });
  };
  await linkAppTag(tokenBridge.id, bridgeTag.id);
  await linkAppTag(tokenBridge.id, tokensTag.id);
  await linkAppTag(supplyChain.id, logisticsTag.id);
  await linkAppTag(supplyChain.id, trackingTag.id);

  // ─── Versions + DarPackages ──────────────────────────────
  const tbV1 = await prisma.appVersion.upsert({
    where: { appId_version: { appId: tokenBridge.id, version: "1.0.0" } },
    update: {},
    create: {
      appId: tokenBridge.id,
      version: "1.0.0",
      changelog: "Initial release with basic bridge functionality.",
      darFileKey: "dars/token-bridge/v1.0.0.dar",
      darFileHash: "sha256:tb100aabbccdd",
      darFileSize: 524288,
      mainPackageId: "tb-main-pkg-100",
      sdkVersion: "3.1.0",
      isLatest: false,
    },
  });
  await prisma.darPackage.upsert({
    where: { versionId_packageId: { versionId: tbV1.id, packageId: "tb-main-pkg-100" } },
    update: {},
    create: { versionId: tbV1.id, packageId: "tb-main-pkg-100", packageName: "TokenBridge", lfVersion: "1.17" },
  });

  const tbV11 = await prisma.appVersion.upsert({
    where: { appId_version: { appId: tokenBridge.id, version: "1.1.0" } },
    update: {},
    create: {
      appId: tokenBridge.id,
      version: "1.1.0",
      changelog: "Added multi-hop bridge support and improved settlement times.",
      darFileKey: "dars/token-bridge/v1.1.0.dar",
      darFileHash: "sha256:tb110eeffgghh",
      darFileSize: 614400,
      mainPackageId: "tb-main-pkg-110",
      sdkVersion: "3.1.0",
      isLatest: true,
    },
  });
  await prisma.darPackage.upsert({
    where: { versionId_packageId: { versionId: tbV11.id, packageId: "tb-main-pkg-110" } },
    update: {},
    create: { versionId: tbV11.id, packageId: "tb-main-pkg-110", packageName: "TokenBridge", lfVersion: "1.17" },
  });
  await prisma.darPackage.upsert({
    where: { versionId_packageId: { versionId: tbV11.id, packageId: "tb-multihop-pkg" } },
    update: {},
    create: { versionId: tbV11.id, packageId: "tb-multihop-pkg", packageName: "MultiHopBridge", lfVersion: "1.17" },
  });

  const scV1 = await prisma.appVersion.upsert({
    where: { appId_version: { appId: supplyChain.id, version: "0.9.0" } },
    update: {},
    create: {
      appId: supplyChain.id,
      version: "0.9.0",
      changelog: "Beta release with shipment tracking and provenance.",
      darFileKey: "dars/supply-chain/v0.9.0.dar",
      darFileHash: "sha256:sc090aabbccdd",
      darFileSize: 409600,
      mainPackageId: "sc-main-pkg-090",
      sdkVersion: "3.1.0",
      isLatest: true,
    },
  });
  await prisma.darPackage.upsert({
    where: { versionId_packageId: { versionId: scV1.id, packageId: "sc-main-pkg-090" } },
    update: {},
    create: { versionId: scV1.id, packageId: "sc-main-pkg-090", packageName: "SupplyChainTracker", lfVersion: "1.17" },
  });

  const kycV1 = await prisma.appVersion.upsert({
    where: { appId_version: { appId: kycValidator.id, version: "1.0.0" } },
    update: {},
    create: {
      appId: kycValidator.id,
      version: "1.0.0",
      changelog: "Initial KYC workflow implementation.",
      darFileKey: "dars/kyc-validator/v1.0.0.dar",
      darFileHash: "sha256:kyc100aabbccdd",
      darFileSize: 327680,
      mainPackageId: "kyc-main-pkg-100",
      sdkVersion: "3.1.0",
      isLatest: true,
    },
  });
  await prisma.darPackage.upsert({
    where: { versionId_packageId: { versionId: kycV1.id, packageId: "kyc-main-pkg-100" } },
    update: {},
    create: { versionId: kycV1.id, packageId: "kyc-main-pkg-100", packageName: "KYCValidator", lfVersion: "1.17" },
  });

  const govV1 = await prisma.appVersion.upsert({
    where: { appId_version: { appId: govToolkit.id, version: "0.1.0" } },
    update: {},
    create: {
      appId: govToolkit.id,
      version: "0.1.0",
      changelog: "Early draft with proposal creation.",
      darFileKey: "dars/governance/v0.1.0.dar",
      darFileHash: "sha256:gov010aabbccdd",
      darFileSize: 204800,
      mainPackageId: "gov-main-pkg-010",
      sdkVersion: "3.1.0",
      isLatest: true,
    },
  });
  await prisma.darPackage.upsert({
    where: { versionId_packageId: { versionId: govV1.id, packageId: "gov-main-pkg-010" } },
    update: {},
    create: { versionId: govV1.id, packageId: "gov-main-pkg-010", packageName: "GovernanceToolkit", lfVersion: "1.17" },
  });
  console.log("Seeded versions and packages");

  // ─── Validator Node ──────────────────────────────────────
  const aliceNode = await prisma.validatorNode.upsert({
    where: { ownerId_name: { ownerId: alice.id, name: "alice-node-1" } },
    update: {},
    create: {
      ownerId: alice.id,
      name: "alice-node-1",
      host: "localhost",
      port: 5002,
      useTls: false,
      healthStatus: "UNKNOWN",
    },
  });
  console.log(`Seeded validator node: ${aliceNode.id}`);

  // ─── App Listings ────────────────────────────────────────
  await prisma.appListing.upsert({
    where: { appId: tokenBridge.id },
    update: {},
    create: {
      appId: tokenBridge.id,
      providerId: bob.id,
      pricingModel: "FREE",
      listingStatus: "ACTIVE",
      darHash: "sha256:tb110eeffgghh",
    },
  });

  // ONE_TIME paid listing for Supply Chain Tracker (for CC payment testing)
  await prisma.appListing.upsert({
    where: { appId: supplyChain.id },
    update: {},
    create: {
      appId: supplyChain.id,
      providerId: bob.id,
      pricingModel: "ONE_TIME",
      priceAmount: 50,
      priceCurrency: "CC",
      listingStatus: "ACTIVE",
      darHash: "sha256:sc090aabbccdd",
    },
  });
  console.log("Seeded 2 app listings");

  // ─── Installations ───────────────────────────────────────
  await prisma.installation.upsert({
    where: { userId_appId: { userId: alice.id, appId: tokenBridge.id } },
    update: {},
    create: {
      userId: alice.id,
      appId: tokenBridge.id,
      versionId: tbV11.id,
      nodeId: aliceNode.id,
    },
  });
  await prisma.installation.upsert({
    where: { userId_appId: { userId: alice.id, appId: supplyChain.id } },
    update: {},
    create: {
      userId: alice.id,
      appId: supplyChain.id,
    },
  });
  console.log("Seeded 2 installations");

  // ─── Reviews ─────────────────────────────────────────────
  await prisma.review.upsert({
    where: { appId_userId: { appId: tokenBridge.id, userId: alice.id } },
    update: {},
    create: {
      appId: tokenBridge.id,
      userId: alice.id,
      rating: 5,
      title: "Excellent bridge implementation",
      body: "Seamless token transfers with rock-solid settlement guarantees. Highly recommended.",
    },
  });
  await prisma.review.upsert({
    where: { appId_userId: { appId: supplyChain.id, userId: alice.id } },
    update: {},
    create: {
      appId: supplyChain.id,
      userId: alice.id,
      rating: 4,
      title: "Works well, needs more docs",
      body: "Good tracking functionality but the documentation could be more comprehensive.",
    },
  });
  console.log("Seeded 2 reviews");

  // ─── Canton Party Mappings ────────────────────────────
  const participantId = process.env.CANTON_PARTICIPANT_ID || "participant1";

  const partyMappings = [
    {
      userId: alice.id,
      partyId:
        process.env.CANTON_PARTY_VALIDATOR1 || "Validator1::sandbox",
      participantId,
      role: "VALIDATOR",
    },
    {
      userId: bob.id,
      partyId:
        process.env.CANTON_PARTY_APP_PROVIDER || "AppProvider::sandbox",
      participantId,
      role: "DEVELOPER",
    },
    {
      userId: carol.id,
      partyId:
        process.env.CANTON_PARTY_MARKETPLACE_OPERATOR ||
        "MarketplaceOperator::sandbox",
      participantId,
      role: "ADMIN",
    },
  ];

  for (const mapping of partyMappings) {
    await prisma.cantonPartyMapping.upsert({
      where: {
        userId_participantId: {
          userId: mapping.userId,
          participantId: mapping.participantId,
        },
      },
      update: {
        partyId: mapping.partyId,
        role: mapping.role,
      },
      create: mapping,
    });
  }
  console.log(`Seeded ${partyMappings.length} Canton party mappings`);

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
