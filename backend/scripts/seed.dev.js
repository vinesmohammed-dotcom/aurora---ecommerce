#!/usr/bin/env node

/**
 * Aurora Local Development Seed Script
 * =====================================
 * Populates realistic demo data for Aurora Tech Store:
 *  - 1 Verified Admin Account (admin@aurora.local)
 *  - 1 Verified Customer Account (customer@aurora.local)
 *  - 4 Categories (Mobile Accessories, Computer Accessories, Desk Setup, Audio)
 *  - 4 Fictional Brands (NovaGear, Voltix, Deskora, Auralite)
 *  - 12 Coherent Tech Products with Variants, SKUs, Stock, Prices, and Images
 *  - 3 Coupons (1 active %, 1 active flat ₹200, 1 expired)
 *  - 2 Promotional Offers (1 Product offer, 1 Category offer)
 *  - Demo Customer Address & Initial ₹2,500 Wallet Credit with Ledger Transaction
 *  - Demo Historical Orders for Instant Reports & Fulfillment Testing
 *
 * SAFETY INVARIANT:
 * Strictly refuses to execute against production or remote Atlas environments.
 */

const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load local environment files
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Models
const User = require("../src/modules/users/user.model");
const Category = require("../src/modules/categories/category.model");
const Brand = require("../src/modules/brands/brand.model");
const Product = require("../src/modules/products/product.model");
const Coupon = require("../src/modules/coupons/coupon.model");
const Offer = require("../src/modules/offers/offer.model");
const Address = require("../src/modules/addresses/address.model");
const Wallet = require("../src/modules/wallet/wallet.model");
const WalletTransaction = require("../src/modules/wallet/walletTransaction.model");
const Order = require("../src/modules/orders/order.model");
const Wishlist = require("../src/modules/wishlist/wishlist.model");
const Cart = require("../src/modules/cart/cart.model");

/**
 * Explicit Environment Safety Check
 * Ensures seed data can NEVER be injected into remote or production databases.
 */
function assertSafeDevelopmentEnvironment(mongoUri) {
  const uri = (mongoUri || "").trim();

  if (!uri) {
    throw new Error("SAFETY ABORT: MONGODB_URI is empty or undefined.");
  }

  const lowerUri = uri.toLowerCase();

  // 1. Never connect to Atlas SRV or cloud-hosted domains
  if (lowerUri.startsWith("mongodb+srv://") || lowerUri.includes(".mongodb.net")) {
    throw new Error(
      `SAFETY ABORT: Remote MongoDB Atlas cluster detected (${uri}).\n` +
      "The development seed script is strictly forbidden from running against cloud databases."
    );
  }

  // 2. Reject remote cloud provider domains
  const dangerousDomains = ["amazonaws.com", "azure.com", "digitalocean.com", "render.com", "railway.app"];
  for (const domain of dangerousDomains) {
    if (lowerUri.includes(domain)) {
      throw new Error(`SAFETY ABORT: Remote cloud provider domain detected (${domain}). Aborting.`);
    }
  }

  // 3. Extract and verify host
  const hostMatch = lowerUri.match(/mongodb:\/\/(?:[^@]+@)?([^:/]+)/);
  const host = hostMatch ? hostMatch[1] : "";
  const allowedHosts = ["127.0.0.1", "localhost", "host.docker.internal", "mongo", "0.0.0.0"];

  if (!allowedHosts.includes(host)) {
    throw new Error(
      `SAFETY ABORT: Host '${host}' is not in the list of approved local hosts (${allowedHosts.join(", ")}).`
    );
  }

  // 4. Reject production-named databases
  const dbMatch = lowerUri.match(/mongodb:\/\/[^/]+\/([^?]+)/);
  const dbName = dbMatch ? dbMatch[1] : "";
  if (dbName.includes("prod") || dbName.includes("production") || dbName.includes("live")) {
    throw new Error(
      `SAFETY ABORT: Target database '${dbName}' contains production indicators. Refusing to seed.`
    );
  }

  // 5. Cloud deployment runtime checks
  if (process.env.AWS_EXECUTION_ENV || process.env.IS_PRODUCTION_DEPLOYMENT === "true") {
    throw new Error("SAFETY ABORT: Production deployment runtime detected. Aborting.");
  }

  console.log(`[Safety Guard] Environment safety check passed for host '${host}' and database '${dbName}'.`);
}

async function seedDatabase() {
  console.log("\n==================================================");
  console.log("🚀 Aurora E-Commerce Local Development Seed");
  console.log("==================================================\n");

  // Determine target URI: default to local development database ecommerce_dev
  const targetUri =
    process.env.SEED_MONGODB_URI ||
    (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes("ecommerce_test_suite")
      ? process.env.MONGODB_URI
      : "mongodb://127.0.0.1:27017/ecommerce_dev");

  // Normalize host.docker.internal if running from host machine
  const connectionUri = targetUri.replace("host.docker.internal", "127.0.0.1");

  // Run strict safety gate
  assertSafeDevelopmentEnvironment(connectionUri);

  console.log(`[Database] Connecting to ${connectionUri}...`);
  await mongoose.connect(connectionUri, {
    serverSelectionTimeoutMS: 5000
  });
  console.log("[Database] Connected successfully.\n");

  // --------------------------------------------------------------------------
  // 1. Seed Demo Admin & Customer Users
  // --------------------------------------------------------------------------
  console.log("👤 Seeding Authentication Accounts...");

  const adminEmail = "admin@aurora.local";
  const customerEmail = "customer@aurora.local";

  // Password rules require min 8 chars, 1 uppercase, 1 number
  const adminPasswordPlain = "Admin@12345";
  const customerPasswordPlain = "Customer@12345";

  const adminPasswordHash = await User.hashPassword(adminPasswordPlain);
  const customerPasswordHash = await User.hashPassword(customerPasswordPlain);

  // Upsert Admin
  const adminUser = await User.findOneAndUpdate(
    { email: adminEmail },
    {
      name: "Aurora Admin",
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      isVerified: true,
      isBlocked: false
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`  ✔ Admin Account:    ${adminEmail} (Role: ADMIN, Verified: true)`);

  // Upsert Customer
  const customerUser = await User.findOneAndUpdate(
    { email: customerEmail },
    {
      name: "Demo Customer",
      email: customerEmail,
      passwordHash: customerPasswordHash,
      role: "USER",
      isVerified: true,
      isBlocked: false
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`  ✔ Customer Account: ${customerEmail} (Role: USER, Verified: true)\n`);

  // --------------------------------------------------------------------------
  // 2. Seed Categories
  // --------------------------------------------------------------------------
  console.log("📂 Seeding Categories...");
  const categoriesData = [
    {
      name: "Mobile Accessories",
      slug: "mobile-accessories",
      description: "Fast GaN chargers, durable braided cables, and magnetic desktop accessories for mobile devices.",
      isActive: true
    },
    {
      name: "Computer Accessories",
      slug: "computer-accessories",
      description: "High-precision ergonomic mice, mechanical keyboards, and versatile multi-port USB-C hubs.",
      isActive: true
    },
    {
      name: "Desk Setup",
      slug: "desk-setup",
      description: "Ergonomic laptop risers, dual-sided vegan leather desk pads, and modular cable organizers.",
      isActive: true
    },
    {
      name: "Audio",
      slug: "audio",
      description: "Precision headphone stands, audiophile desktop accessories, and armored protective cases.",
      isActive: true
    }
  ];

  const categoryMap = {};
  for (const cat of categoriesData) {
    const doc = await Category.findOneAndUpdate(
      { slug: cat.slug },
      cat,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    categoryMap[cat.slug] = doc;
    console.log(`  ✔ Category: ${doc.name} (${doc.slug})`);
  }
  console.log("");

  // --------------------------------------------------------------------------
  // 3. Seed Fictional Brands
  // --------------------------------------------------------------------------
  console.log("🏷️  Seeding Fictional Brands...");
  const brandsData = [
    {
      name: "NovaGear",
      slug: "novagear",
      description: "Precision-engineered mechanical keyboards and high-performance workstation peripherals.",
      logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=160&q=80",
      isActive: true
    },
    {
      name: "Voltix",
      slug: "voltix",
      description: "Next-gen Gallium Nitride (GaN) fast-charging tech, reinforced cables, and docking solutions.",
      logoUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=160&q=80",
      isActive: true
    },
    {
      name: "Deskora",
      slug: "deskora",
      description: "Minimalist ergonomic desk setup accessories and premium workstation organization essentials.",
      logoUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=160&q=80",
      isActive: true
    },
    {
      name: "Auralite",
      slug: "auralite",
      description: "Precision studio acoustic hardware, aluminum headphone hangers, and audio protective cases.",
      logoUrl: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=160&q=80",
      isActive: true
    }
  ];

  const brandMap = {};
  for (const b of brandsData) {
    const doc = await Brand.findOneAndUpdate(
      { slug: b.slug },
      b,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    brandMap[b.slug] = doc;
    console.log(`  ✔ Brand: ${doc.name} (${doc.slug})`);
  }
  console.log("");

  // --------------------------------------------------------------------------
  // 4. Seed 12 Realistic Tech Products with Variants
  // --------------------------------------------------------------------------
  console.log("📦 Seeding Demo Products Catalog...");

  const productsData = [
    {
      name: "Wireless Mouse",
      slug: "wireless-mouse",
      description:
        "NovaGear Precision Pro ergonomic 2.4GHz and Bluetooth wireless mouse featuring a 16,000 DPI sensor, silent optical micro-switches, and 70-hour battery life with USB-C quick charge.",
      brand: brandMap["novagear"]._id,
      category: categoryMap["computer-accessories"]._id,
      images: [
        "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80"
      ],
      tags: ["mouse", "wireless", "ergonomic", "bluetooth", "office", "computer-accessories"],
      isActive: true,
      variants: [
        {
          sku: "WM-BLK-001",
          price: 1499,
          costPrice: 900,
          stock: 25,
          attributes: { Color: "Midnight Black" },
          isActive: true
        },
        {
          sku: "WM-WHT-001",
          price: 1499,
          costPrice: 900,
          stock: 8,
          attributes: { Color: "Arctic White" },
          isActive: true
        },
        {
          sku: "WM-GRY-001",
          price: 1599,
          costPrice: 950,
          stock: 15,
          attributes: { Color: "Space Grey" },
          isActive: true
        }
      ]
    },
    {
      name: "Mechanical Keyboard",
      slug: "mechanical-keyboard",
      description:
        "NovaGear Pulse 75% hot-swappable mechanical gaming and typing keyboard with factory pre-lubed switches, sound-dampening silicone gasket mount, and per-key RGB backlight.",
      brand: brandMap["novagear"]._id,
      category: categoryMap["computer-accessories"]._id,
      images: [
        "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=800&q=80"
      ],
      tags: ["keyboard", "mechanical", "rgb", "hot-swap", "type-c", "computer-accessories"],
      isActive: true,
      variants: [
        {
          sku: "KB-RED-BLK",
          price: 3999,
          costPrice: 2400,
          stock: 18,
          attributes: { Switch: "Linear Red", Color: "Midnight Black" },
          isActive: true
        },
        {
          sku: "KB-BLU-WHT",
          price: 3999,
          costPrice: 2400,
          stock: 12,
          attributes: { Switch: "Clicky Blue", Color: "Arctic White" },
          isActive: true
        },
        {
          sku: "KB-BRN-BLK",
          price: 4199,
          costPrice: 2500,
          stock: 6,
          attributes: { Switch: "Tactile Brown", Color: "Midnight Black" },
          isActive: true
        }
      ]
    },
    {
      name: "USB-C Hub",
      slug: "usb-c-hub",
      description:
        "Voltix HyperPort multi-port aluminum USB-C hub adapter featuring 4K@60Hz HDMI video output, 100W Power Delivery pass-through charging, Gigabit Ethernet, and dual USB 3.2 Gen 2 ports.",
      brand: brandMap["voltix"]._id,
      category: categoryMap["computer-accessories"]._id,
      images: [
        "https://images.unsplash.com/photo-1544652478-6653e09f18a2?auto=format&fit=crop&w=800&q=80"
      ],
      tags: ["hub", "usb-c", "hdmi", "dongle", "dock", "computer-accessories"],
      isActive: true,
      variants: [
        {
          sku: "HUB-7IN1-SGRY",
          price: 2299,
          costPrice: 1400,
          stock: 30,
          attributes: { Ports: "7-in-1", Color: "Space Grey" },
          isActive: true
        },
        {
          sku: "HUB-9IN1-SGRY",
          price: 3199,
          costPrice: 1900,
          stock: 14,
          attributes: { Ports: "9-in-1", Color: "Space Grey" },
          isActive: true
        }
      ]
    },
    {
      name: "Laptop Stand",
      slug: "laptop-stand",
      description:
        "Deskora ErgoLift ventilated aluminum riser stand. Precision CNC crafted for up to 17-inch MacBooks and PC laptops, raising screens 6 inches to eye level for neck relief.",
      brand: brandMap["deskora"]._id,
      category: categoryMap["desk-setup"]._id,
      images: [
        "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80"
      ],
      tags: ["laptop-stand", "aluminum", "ergonomic", "riser", "desk-setup"],
      isActive: true,
      variants: [
        {
          sku: "LS-ALU-SLV",
          price: 1899,
          costPrice: 1100,
          stock: 22,
          attributes: { Material: "Aluminum", Color: "Silver" },
          isActive: true
        },
        {
          sku: "LS-ALU-BLK",
          price: 1999,
          costPrice: 1150,
          stock: 16,
          attributes: { Material: "Aluminum", Color: "Matte Black" },
          isActive: true
        }
      ]
    },
    {
      name: "Phone Stand",
      slug: "phone-stand",
      description:
        "Deskora PivotDock foldable dual-axis aluminum mobile phone and mini-tablet desktop stand with silicone anti-scratch padding and charging cable passthrough.",
      brand: brandMap["deskora"]._id,
      category: categoryMap["mobile-accessories"]._id,
      images: [
        "https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&w=800&q=80"
      ],
      tags: ["phone-stand", "mobile", "dock", "holder", "mobile-accessories"],
      isActive: true,
      variants: [
        {
          sku: "PS-ADJ-BLK",
          price: 699,
          costPrice: 350,
          stock: 40,
          attributes: { Color: "Matte Black" },
          isActive: true
        },
        {
          sku: "PS-MAG-SLV",
          price: 1199,
          costPrice: 650,
          stock: 20,
          attributes: { Compatibility: "MagSafe", Color: "Silver" },
          isActive: true
        }
      ]
    },
    {
      name: "Charging Adapter",
      slug: "charging-adapter",
      description:
        "Voltix GaNFlow high-efficiency Gallium Nitride wall adapter with dual USB-C Power Delivery ports, dynamic thermal management, and ultra-compact folding prongs.",
      brand: brandMap["voltix"]._id,
      category: categoryMap["mobile-accessories"]._id,
      images: [
        "https://images.unsplash.com/photo-1622445262464-84b1456045b6?auto=format&fit=crop&w=800&q=80"
      ],
      tags: ["charger", "gan", "fast-charging", "power-delivery", "mobile-accessories"],
      isActive: true,
      variants: [
        {
          sku: "CHG-35W-WHT",
          price: 1299,
          costPrice: 750,
          stock: 35,
          attributes: { Power: "35W Dual Port", Color: "White" },
          isActive: true
        },
        {
          sku: "CHG-65W-BLK",
          price: 2199,
          costPrice: 1300,
          stock: 28,
          attributes: { Power: "65W GaN Triple Port", Color: "Black" },
          isActive: true
        }
      ]
    },
    {
      name: "Wireless Earbuds Case",
      slug: "wireless-earbuds-case",
      description:
        "Auralite ShieldFit rugged earbud case crafted with shock-absorbent TPU and carbon-fiber accents. Includes secure anodized aluminum locking carabiner.",
      brand: brandMap["auralite"]._id,
      category: categoryMap["audio"]._id,
      images: [
        "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80"
      ],
      tags: ["earbuds", "case", "shockproof", "protective", "audio"],
      isActive: true,
      variants: [
        {
          sku: "EBC-NAV-01",
          price: 499,
          costPrice: 200,
          stock: 50,
          attributes: { Color: "Navy Blue" },
          isActive: true
        },
        {
          sku: "EBC-CRB-01",
          price: 799,
          costPrice: 350,
          stock: 30,
          attributes: { Color: "Carbon Fiber" },
          isActive: true
        }
      ]
    },
    {
      name: "Desk Mat",
      slug: "desk-mat",
      description:
        "Deskora StudioDesk 900x400mm extended surface desk pad made of splash-resistant smooth vegan leather on one side and non-slip textured felt on the other.",
      brand: brandMap["deskora"]._id,
      category: categoryMap["desk-setup"]._id,
      images: [
        "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80"
      ],
      tags: ["desk-mat", "mousepad", "leather", "ergonomic", "desk-setup"],
      isActive: true,
      variants: [
        {
          sku: "DM-9040-DGY",
          price: 999,
          costPrice: 500,
          stock: 45,
          attributes: { Size: "900x400mm", Color: "Dark Grey" },
          isActive: true
        },
        {
          sku: "DM-9040-GRN",
          price: 999,
          costPrice: 500,
          stock: 15,
          attributes: { Size: "900x400mm", Color: "Forest Green" },
          isActive: true
        }
      ]
    },
    {
      name: "Cable Organizer",
      slug: "cable-organizer",
      description:
        "Deskora MagSnap magnetic silicone cable management system with heavy zinc base and 5 magnetic clips to keep charging cords neatly in place.",
      brand: brandMap["deskora"]._id,
      category: categoryMap["desk-setup"]._id,
      images: [
        "https://images.unsplash.com/photo-1541689592655-f5f52825a3b8?auto=format&fit=crop&w=800&q=80"
      ],
      tags: ["cable-organizer", "management", "clips", "desk-accessories", "desk-setup"],
      isActive: true,
      variants: [
        {
          sku: "CO-MAG-5PK",
          price: 449,
          costPrice: 180,
          stock: 60,
          attributes: { Pack: "5-Pack Magnetic Clips", Color: "Black" },
          isActive: true
        },
        {
          sku: "CO-TRAY-BLK",
          price: 1249,
          costPrice: 700,
          stock: 18,
          attributes: { Type: "Under-Desk Tray", Color: "Black" },
          isActive: true
        }
      ]
    },
    {
      name: "Webcam Cover",
      slug: "webcam-cover",
      description:
        "NovaGear NanoShield ultra-thin 0.7mm sliding webcam privacy shutter. Seamless 3M adhesive installation for laptops, tablets, and external monitors.",
      brand: brandMap["novagear"]._id,
      category: categoryMap["computer-accessories"]._id,
      images: [
        "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=800&q=80"
      ],
      tags: ["webcam", "privacy", "security", "shutter", "computer-accessories"],
      isActive: true,
      variants: [
        {
          sku: "WBC-SLD-3PK",
          price: 299,
          costPrice: 90,
          stock: 100,
          attributes: { Pack: "3-Pack Slider", Color: "Matte Black" },
          isActive: true
        }
      ]
    },
    {
      name: "USB-C Cable",
      slug: "usb-c-cable",
      description:
        "Voltix PowerWeave double-braided nylon 100W Power Delivery USB-C to USB-C charging cable with reinforced strain relief and 480Mbps data sync.",
      brand: brandMap["voltix"]._id,
      category: categoryMap["mobile-accessories"]._id,
      images: [
        "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&w=800&q=80"
      ],
      tags: ["cable", "usb-c", "100w", "fast-charging", "braided", "mobile-accessories"],
      isActive: true,
      variants: [
        {
          sku: "CBL-100W-12M",
          price: 599,
          costPrice: 250,
          stock: 70,
          attributes: { Length: "1.2m", Color: "Space Grey" },
          isActive: true
        },
        {
          sku: "CBL-100W-20M",
          price: 749,
          costPrice: 320,
          stock: 40,
          attributes: { Length: "2.0m", Color: "Space Grey" },
          isActive: true
        }
      ]
    },
    {
      name: "Headphone Stand",
      slug: "headphone-stand",
      description:
        "Auralite Apex solid aluminum desktop headphone cradle with soft silicone curved rest to protect headband cushion shape and non-slip weighted base.",
      brand: brandMap["auralite"]._id,
      category: categoryMap["audio"]._id,
      images: [
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80"
      ],
      tags: ["headphone-stand", "aluminum", "audio", "desk-setup", "accessories"],
      isActive: true,
      variants: [
        {
          sku: "HPS-ALU-SLV",
          price: 1399,
          costPrice: 750,
          stock: 25,
          attributes: { Material: "Aluminum", Color: "Silver" },
          isActive: true
        },
        {
          sku: "HPS-RGB-BLK",
          price: 2199,
          costPrice: 1200,
          stock: 12,
          attributes: { Material: "Aluminum + Acrylic", Color: "RGB Chroma Black" },
          isActive: true
        }
      ]
    }
  ];

  const productMap = {};
  for (const prodData of productsData) {
    // Delete existing by slug to allow clean update of variants
    await Product.deleteOne({ slug: prodData.slug });
    const product = await Product.create(prodData);
    productMap[prodData.slug] = product;
    console.log(
      `  ✔ Product: ${product.name} (Base Price: ₹${product.basePrice}, Variants: ${product.variants.length})`
    );
  }
  console.log("");

  // --------------------------------------------------------------------------
  // 5. Seed Coupons
  // --------------------------------------------------------------------------
  console.log("🎟️  Seeding Promotional Coupons...");
  await Coupon.deleteMany({});

  const couponsData = [
    {
      code: "AURORA15",
      description: "15% off on tech gear for orders above ₹1,000 (Max ₹500 discount)",
      discountType: "PERCENTAGE",
      discountValue: 15,
      minOrderValue: 1000,
      maxDiscount: 500,
      startDate: new Date(Date.now() - 7 * 86400000),
      expiryDate: new Date(Date.now() + 60 * 86400000),
      isActive: true,
      perUserLimit: 5
    },
    {
      code: "FLAT200",
      description: "Flat ₹200 instant savings on orders of ₹1,500 or more",
      discountType: "FLAT",
      discountValue: 200,
      minOrderValue: 1500,
      maxDiscount: 200,
      startDate: new Date(Date.now() - 7 * 86400000),
      expiryDate: new Date(Date.now() + 60 * 86400000),
      isActive: true,
      perUserLimit: 3
    },
    {
      code: "EXPIRED50",
      description: "Expired 50% discount promotional coupon for validation and error checks",
      discountType: "PERCENTAGE",
      discountValue: 50,
      minOrderValue: 500,
      maxDiscount: 1000,
      startDate: new Date(Date.now() - 90 * 86400000),
      expiryDate: new Date(Date.now() - 10 * 86400000), // In the past
      isActive: true,
      perUserLimit: 1
    }
  ];

  for (const c of couponsData) {
    const doc = await Coupon.create(c);
    console.log(
      `  ✔ Coupon '${doc.code}': ${doc.discountType} ${doc.discountValue}${
        doc.discountType === "PERCENTAGE" ? "%" : "₹"
      } (Active: ${doc.isActive}, Expires: ${doc.expiryDate.toISOString().slice(0, 10)})`
    );
  }
  console.log("");

  // --------------------------------------------------------------------------
  // 6. Seed Promotional Offers
  // --------------------------------------------------------------------------
  console.log("🎁 Seeding Promotional Offers...");
  await Offer.deleteMany({});

  const productTarget = productMap["wireless-mouse"];
  const categoryTarget = categoryMap["desk-setup"];

  const offersData = [
    {
      name: "NovaGear Wireless Mouse Special",
      targetType: "PRODUCT",
      product: productTarget._id,
      category: null,
      discountPercentage: 10,
      startDate: new Date(Date.now() - 7 * 86400000),
      endDate: new Date(Date.now() + 30 * 86400000),
      isActive: true
    },
    {
      name: "Desk Setup Seasonal Refresh",
      targetType: "CATEGORY",
      product: null,
      category: categoryTarget._id,
      discountPercentage: 12,
      startDate: new Date(Date.now() - 7 * 86400000),
      endDate: new Date(Date.now() + 30 * 86400000),
      isActive: true
    }
  ];

  for (const off of offersData) {
    const doc = await Offer.create(off);
    console.log(
      `  ✔ Offer '${doc.name}': ${doc.discountPercentage}% off on ${doc.targetType}`
    );
  }
  console.log("");

  // --------------------------------------------------------------------------
  // 7. Seed Customer Address & Customer Wallet
  // --------------------------------------------------------------------------
  console.log("🏠 Seeding Demo Customer Address & Wallet...");

  await Address.deleteMany({ userId: customerUser._id });
  const demoAddress = await Address.create({
    userId: customerUser._id,
    fullName: "Demo Customer",
    phone: "9876543210",
    addressLine1: "Flat 402, Aurora Heights, Cyber City",
    addressLine2: "Near Tech Park, Whitefield",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560066",
    country: "India",
    label: "HOME",
    isDefault: true
  });
  console.log(`  ✔ Default Address created for ${customerUser.email}`);

  // Wallet: ₹2,500 = 250,000 paise (integer minor units)
  await Wallet.deleteMany({ userId: customerUser._id });
  await WalletTransaction.deleteMany({ userId: customerUser._id });

  const initialPaise = 250000; // ₹2,500.00
  const customerWallet = await Wallet.create({
    userId: customerUser._id,
    balance: initialPaise,
    currency: "INR",
    isActive: true
  });

  await WalletTransaction.create({
    walletId: customerWallet._id,
    userId: customerUser._id,
    type: "CREDIT",
    amount: initialPaise,
    balanceBefore: 0,
    balanceAfter: initialPaise,
    referenceType: "PROMOTIONAL_CREDIT",
    referenceId: "DEMO-WELCOME-CREDIT",
    description: "Aurora local development welcome bonus credit"
  });
  console.log(`  ✔ Wallet Initialized: ₹2,500.00 (250,000 paise) with append-only ledger transaction`);

  // Wishlist: Seed with 1 item
  await Wishlist.deleteMany({ userId: customerUser._id });
  await Wishlist.create({
    userId: customerUser._id,
    products: [productMap["mechanical-keyboard"]._id]
  });
  console.log(`  ✔ Wishlist seeded with: Mechanical Keyboard`);

  // Cart: Clear existing demo cart
  await Cart.deleteMany({ userId: customerUser._id });
  console.log(`  ✔ Cart initialized empty for fresh customer checkout testing`);

  // --------------------------------------------------------------------------
  // 8. Seed Demo Orders for Immediate Fulfillment & Admin Reporting
  // --------------------------------------------------------------------------
  console.log("\n📑 Seeding Historical Demo Orders for Reports & Fulfillment Testing...");
  await Order.deleteMany({ userId: customerUser._id });

  const mouseProduct = productMap["wireless-mouse"];
  const mouseVariant = mouseProduct.variants[0];

  const standProduct = productMap["laptop-stand"];
  const standVariant = standProduct.variants[0];

  // Order 1: Delivered COD Order (Generates Sales Report, PDF & CSV data)
  const deliveredOrder = await Order.create({
    orderNumber: `ORD-${Date.now().toString(36).toUpperCase()}-1001`,
    userId: customerUser._id,
    shippingAddress: {
      fullName: demoAddress.fullName,
      phone: demoAddress.phone,
      addressLine1: demoAddress.addressLine1,
      addressLine2: demoAddress.addressLine2,
      city: demoAddress.city,
      state: demoAddress.state,
      postalCode: demoAddress.postalCode,
      country: demoAddress.country
    },
    items: [
      {
        productId: mouseProduct._id,
        variantId: mouseVariant._id,
        sku: mouseVariant.sku,
        name: mouseProduct.name,
        slug: mouseProduct.slug,
        image: mouseProduct.images[0],
        attributes: mouseVariant.attributes,
        unitPrice: 1499,
        offer: {
          name: "NovaGear Mouse Special",
          targetType: "PRODUCT",
          discountPercentage: 10
        },
        discountedUnitPrice: 1349.1,
        quantity: 1,
        itemTotal: 1349.1
      }
    ],
    priceSummary: {
      grossSubtotal: 1499,
      offerDiscountTotal: 149.9,
      netSubtotal: 1349.1,
      couponDiscount: 0,
      shippingFee: 0,
      grandTotal: 1349.1
    },
    appliedCoupon: null,
    paymentMethod: "COD",
    paymentStatus: "COMPLETED",
    orderStatus: "DELIVERED",
    statusHistory: [
      { status: "CONFIRMED", changedAt: new Date(Date.now() - 5 * 86400000), note: "Order placed via COD" },
      { status: "PROCESSING", changedAt: new Date(Date.now() - 4 * 86400000), note: "Packed at Bangalore warehouse" },
      { status: "SHIPPED", changedAt: new Date(Date.now() - 3 * 86400000), note: "Dispatched via BlueDart" },
      { status: "DELIVERED", changedAt: new Date(Date.now() - 1 * 86400000), note: "Delivered to customer" }
    ]
  });

  // Order 2: Processing COD Order (Ready for Admin Status Transition Testing)
  const processingOrder = await Order.create({
    orderNumber: `ORD-${Date.now().toString(36).toUpperCase()}-1002`,
    userId: customerUser._id,
    shippingAddress: {
      fullName: demoAddress.fullName,
      phone: demoAddress.phone,
      addressLine1: demoAddress.addressLine1,
      addressLine2: demoAddress.addressLine2,
      city: demoAddress.city,
      state: demoAddress.state,
      postalCode: demoAddress.postalCode,
      country: demoAddress.country
    },
    items: [
      {
        productId: standProduct._id,
        variantId: standVariant._id,
        sku: standVariant.sku,
        name: standProduct.name,
        slug: standProduct.slug,
        image: standProduct.images[0],
        attributes: standVariant.attributes,
        unitPrice: 1899,
        offer: null,
        discountedUnitPrice: 1899,
        quantity: 1,
        itemTotal: 1899
      }
    ],
    priceSummary: {
      grossSubtotal: 1899,
      offerDiscountTotal: 0,
      netSubtotal: 1899,
      couponDiscount: 200,
      shippingFee: 0,
      grandTotal: 1699
    },
    appliedCoupon: {
      code: "FLAT200",
      discountType: "FLAT",
      discountValue: 200,
      discountAmount: 200
    },
    paymentMethod: "COD",
    paymentStatus: "PENDING",
    orderStatus: "PROCESSING",
    statusHistory: [
      { status: "CONFIRMED", changedAt: new Date(Date.now() - 12 * 3600000), note: "Order placed via COD" },
      { status: "PROCESSING", changedAt: new Date(Date.now() - 6 * 3600000), note: "Processing in packing queue" }
    ]
  });

  console.log(`  ✔ Order 1: ${deliveredOrder.orderNumber} (Status: DELIVERED, COD ₹1,349.10)`);
  console.log(`  ✔ Order 2: ${processingOrder.orderNumber} (Status: PROCESSING, COD ₹1,699.00)`);

  // --------------------------------------------------------------------------
  // Summary & Credentials Report
  // --------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log("🎉 SEED COMPLETED SUCCESSFULLY!");
  console.log("==================================================");
  console.log("\nDEVELOPMENT DEMO CREDENTIALS (DEVELOPMENT ONLY):");
  console.log("--------------------------------------------------");
  console.log("👑 ADMIN:");
  console.log(`   Email:    ${adminEmail}`);
  console.log(`   Password: ${adminPasswordPlain}`);
  console.log(`   Role:     ADMIN`);
  console.log("\n🛍️  CUSTOMER:");
  console.log(`   Email:    ${customerEmail}`);
  console.log(`   Password: ${customerPasswordPlain}`);
  console.log(`   Role:     USER`);
  console.log(`   Wallet:   ₹2,500.00 (Ready for use)`);
  console.log(`   Address:  Bengaluru, Karnataka (Seeded)`);
  console.log("--------------------------------------------------");
  console.log("Catalog Seeded:");
  console.log(`   - 4 Categories`);
  console.log(`   - 4 Brands`);
  console.log(`   - 12 Tech Products with Variants`);
  console.log(`   - 3 Coupons (AURORA15, FLAT200, EXPIRED50)`);
  console.log(`   - 2 Offers (Mouse 10%, Desk Setup 12%)`);
  console.log(`   - 2 Demo Orders (1 DELIVERED, 1 PROCESSING)`);
  console.log("==================================================\n");

  await mongoose.disconnect();
  console.log("[Database] Disconnected gracefully. Ready to explore Aurora!\n");
}

seedDatabase().catch((err) => {
  console.error("\n❌ SEED FAILED WITH ERROR:");
  console.error(err);
  process.exit(1);
});
