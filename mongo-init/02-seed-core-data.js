(function () {
    const dbShop = db.getSiblingDB("shop");

    // Helpers
    const now = new Date();
    const oid = (hex) => new ObjectId(hex);

    // ====== USERS ======
    const u1 = new ObjectId();
    const u2 = new ObjectId();

    dbShop.users.insertMany([
        {
            _id: u1,
            email: "alice@example.com",
            password_hash: null,
            full_name: "Alice Nguyen",
            role: "customer",
            loyalty_points: 120,
            provider: "local",
            is_verified: true,
            createdAt: now, updatedAt: now
        },
        {
            _id: u2,
            email: "admin@example.com",
            password_hash: null,
            full_name: "Shop Admin",
            role: "admin",
            loyalty_points: 0,
            provider: "local",
            is_verified: true,
            createdAt: now, updatedAt: now
        }
    ]);

    // ====== ADDRESSES ======
    const a1 = new ObjectId();
    dbShop.addresses.insertOne({
        _id: a1,
        user: u1,
        address_line: "123 Le Loi, District 1, HCMC",
        is_default: true,
        createdAt: now, updatedAt: now,
    });

    // ====== BRANDS & CATEGORIES ======
    const bNike = new ObjectId();
    const bAdidas = new ObjectId();
    dbShop.brands.insertMany([
        { _id: bNike, name: "Nike", slug: "nike", createdAt: now, updatedAt: now },
        { _id: bAdidas, name: "Adidas", slug: "adidas", createdAt: now, updatedAt: now },
    ]);

    const cShoes = new ObjectId();
    const cTShirt = new ObjectId();
    dbShop.categories.insertMany([
        { _id: cShoes, name: "Shoes", slug: "shoes", description: "Footwear", image: null, createdAt: now, updatedAt: now },
        { _id: cTShirt, name: "T-Shirts", slug: "t-shirts", description: "Tops", image: null, createdAt: now, updatedAt: now },
    ]);

    // ====== COLORS & SIZES ======
    const colRed = new ObjectId();
    const colBlack = new ObjectId();
    dbShop.productcolors.insertMany([
        { _id: colRed, color_name: "Red", color_code: "#FF0000", createdAt: now, updatedAt: now },
        { _id: colBlack, color_name: "Black", color_code: "#000000", createdAt: now, updatedAt: now },
    ]);

    const szM = new ObjectId();
    const szL = new ObjectId();
    dbShop.productsizes.insertMany([
        { _id: szM, size_name: "M", size_order: 2, createdAt: now, updatedAt: now },
        { _id: szL, size_name: "L", size_order: 3, createdAt: now, updatedAt: now },
    ]);

    // ====== PRODUCTS ======
    const pAirZoom = new ObjectId();
    const pBasicT = new ObjectId();

    dbShop.products.insertMany([
        {
            _id: pAirZoom,
            name: "Nike Air Zoom",
            slug: "nike-air-zoom",
            description: "Running shoes",
            brand: bNike,
            category: cShoes,
            base_price: 150,
            images: [{ url: null, is_primary: true }],
            createdAt: now, updatedAt: now
        },
        {
            _id: pBasicT,
            name: "Adidas Basic Tee",
            slug: "adidas-basic-tee",
            description: "Cotton T-shirt",
            brand: bAdidas,
            category: cTShirt,
            base_price: 25,
            images: [{ url: null, is_primary: true }],
            createdAt: now, updatedAt: now
        }
    ]);

    // ====== PRODUCT VARIANTS ======
    const v1 = new ObjectId();
    const v2 = new ObjectId();
    const v3 = new ObjectId();

    dbShop.productvariants.insertMany([
        {
            _id: v1,
            product: pAirZoom,
            color: colBlack,
            size: szM,
            sku: "AIRZOOM-BLK-M",
            price: 150,
            stock_quantity: 50,
            images: [{ url: null, public_id: null, is_primary: true }],
            createdAt: now, updatedAt: now
        },
        {
            _id: v2,
            product: pAirZoom,
            color: colRed,
            size: szL,
            sku: "AIRZOOM-RED-L",
            price: 150,
            stock_quantity: 30,
            images: [{ url: null, public_id: null, is_primary: true }],
            createdAt: now, updatedAt: now
        },
        {
            _id: v3,
            product: pBasicT,
            color: colBlack,
            size: szM,
            sku: "TEE-BLK-M",
            price: 25,
            stock_quantity: 200,
            images: [{ url: null, public_id: null, is_primary: true }],
            createdAt: now, updatedAt: now
        }
    ]);

    const d1 = new ObjectId();
    dbShop.discountcodes.insertOne({
        _id: d1,
        code: "WELCOME10",
        discount_value: 10,
        usage_limit: 100,
        usage_count: 0,
        is_active: true,
        createdAt: now, updatedAt: now
    });

    print("[mongo-init] Seeded core data.");
})();
