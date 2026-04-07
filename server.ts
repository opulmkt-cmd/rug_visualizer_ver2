import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN || '';
// Clean domain: remove https://, trailing slashes, and ensure .myshopify.com is present if it's just the store name
const SHOPIFY_DOMAIN = rawDomain
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '')
  .includes('.') ? rawDomain.replace(/^https?:\/\//, '').replace(/\/$/, '') : (rawDomain ? `${rawDomain}.myshopify.com` : '');

const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const SHOPIFY_STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' })); // Increase limit for base64 images

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy for ImgBB Upload
  app.post("/api/image/upload", async (req, res) => {
    if (!IMGBB_API_KEY) {
      return res.status(500).json({ error: "ImgBB API Key not configured on server." });
    }

    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "No image data provided" });

    try {
      const formData = new URLSearchParams();
      formData.append('image', image.split(',')[1] || image);

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const result = await response.json();
      if (result.success) {
        res.json({ url: result.data.url });
      } else {
        res.status(500).json({ error: result.error?.message || "ImgBB upload failed" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy for Shopify Storefront GraphQL
  app.post("/api/shopify/storefront", async (req, res) => {
    if (!SHOPIFY_DOMAIN || !SHOPIFY_STOREFRONT_TOKEN) {
      return res.status(500).json({ error: "Shopify Storefront not configured on server." });
    }

    try {
      const response = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
        },
        body: JSON.stringify(req.body),
      });

      const result = await response.json();
      res.status(response.status).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Firebase Config Endpoint
  app.get("/api/config/firebase", (req, res) => {
    const config = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
      firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID
    };

    if (!config.apiKey) {
      console.warn("Firebase API Key is missing in environment variables.");
    }

    res.json(config);
  });

  // Shopify Dynamic Checkout Endpoint (Creates a Product + Checkout)
  app.post("/api/shopify/create-custom-checkout", async (req, res) => {
    if (!SHOPIFY_DOMAIN || !SHOPIFY_ADMIN_TOKEN) {
      return res.status(500).json({ error: "Shopify Admin API not configured on server." });
    }

    const { title, price, imageUrl, attributes, type } = req.body;

    // Customize description based on type
    let descriptionHtml = `<strong>Type: ${type === 'sample' ? 'Sample' : 'Deposit'}</strong>`;
    descriptionHtml += `<br/><br/><ul>${attributes.map((a: any) => `<li><strong>${a.key}:</strong> ${a.value}</li>`).join('')}</ul>`;

    // 1. Create the Product via REST API (More stable for simple product creation)
    const productPayload = {
      product: {
        title: title || "Custom Rug Design",
        status: "active",
        body_html: descriptionHtml,
        images: imageUrl ? [{ src: imageUrl }] : [],
        variants: [
          {
            price: price.toString(),
            inventory_policy: "continue",
            requires_shipping: true,
            taxable: true
          }
        ]
      }
    };

    try {
      const shopifyUrl = `https://${SHOPIFY_DOMAIN}/admin/api/2024-01/products.json`;
      console.log(`Calling Shopify REST API at: ${shopifyUrl}`);

      const productResponse = await fetch(shopifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN,
        },
        body: JSON.stringify(productPayload),
      });

      if (!productResponse.ok) {
        const errorText = await productResponse.text();
        console.error(`Shopify API HTTP Error ${productResponse.status}:`, errorText);
        return res.status(productResponse.status).json({ 
          error: `Shopify API error (${productResponse.status}). Please check your Admin API Token and Scopes.` 
        });
      }

      const productResult = await productResponse.json();
      
      if (!productResult.product || !productResult.product.variants || productResult.product.variants.length === 0) {
        return res.status(500).json({ error: "Failed to retrieve variant ID from created product." });
      }

      // Convert REST ID to GraphQL GID for the Storefront API
      const variantId = `gid://shopify/ProductVariant/${productResult.product.variants[0].id}`;

      // 2. Return the variantId to the client
      res.json({ variantId });
    } catch (error: any) {
      console.error("Shopify Product Creation Error:", error);
      res.status(500).json({ error: `Server error: ${error.message || "Failed to create custom Shopify product."}` });
    }
  });

  // Shopify Plan Upgrade Endpoint (Creates a Draft Order)
  app.post("/api/shopify/create-plan-checkout", async (req, res) => {
    if (!SHOPIFY_DOMAIN || !SHOPIFY_ADMIN_TOKEN) {
      return res.status(500).json({ error: "Shopify Admin API not configured on server." });
    }

    const { email, userId } = req.body;

    const draftOrderPayload = {
      draft_order: {
        line_items: [
          {
            title: "Opul Pro Plan Upgrade",
            price: "20.00",
            quantity: 1,
            requires_shipping: false,
            taxable: false
          }
        ],
        customer: {
          email: email
        },
        use_customer_default_address: false,
        note: `User Upgrade: ${userId}`,
        tags: ["PlanUpgrade", userId]
      }
    };

    try {
      const response = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2024-01/draft_orders.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN,
        },
        body: JSON.stringify(draftOrderPayload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.errors ? JSON.stringify(result.errors) : "Failed to create draft order");
      }

      res.json({ 
        invoiceUrl: result.draft_order.invoice_url,
        draftOrderId: result.draft_order.id 
      });
    } catch (error: any) {
      console.error("Shopify Draft Order Error:", error);
      res.status(500).json({ error: `Failed to create upgrade checkout: ${error.message}` });
    }
  });

  // Verify Shopify Draft Order Status
  app.get("/api/shopify/verify-upgrade/:id", async (req, res) => {
    if (!SHOPIFY_DOMAIN || !SHOPIFY_ADMIN_TOKEN) {
      return res.status(500).json({ error: "Shopify Admin API not configured." });
    }

    const { id } = req.params;

    try {
      const response = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2024-01/draft_orders/${id}.json`, {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN,
        }
      });

      const result = await response.json();
      if (!response.ok) throw new Error("Failed to fetch draft order");

      const isPaid = result.draft_order.status === 'completed' || result.draft_order.order_id !== null;
      res.json({ isPaid });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
