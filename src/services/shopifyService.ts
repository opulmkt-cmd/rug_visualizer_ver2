
const rawDomain = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN || '';
// Clean domain: remove https://, trailing slashes, and ensure .myshopify.com is present if it's just the store name
const SHOPIFY_DOMAIN = rawDomain
  ? (rawDomain.replace(/^https?:\/\//, '').replace(/\/$/, '').includes('.') 
      ? rawDomain.replace(/^https?:\/\//, '').replace(/\/$/, '') 
      : `${rawDomain}.myshopify.com`)
  : '';

interface ShopifyCheckoutInput {
  variantId: string;
  quantity: number;
  customAttributes: { key: string; value: string }[];
}

export const shopifyService = {
  isConfigured: !!rawDomain,

  async createCheckout(input: ShopifyCheckoutInput) {
    if (!SHOPIFY_DOMAIN) {
      console.error('Shopify Configuration Missing:', { domain: !!SHOPIFY_DOMAIN });
      throw new Error('Shopify Configuration Missing. Please check your Settings for VITE_SHOPIFY_STORE_DOMAIN.');
    }

    console.log(`Creating Shopify checkout via proxy for domain: ${SHOPIFY_DOMAIN}`);

    const query = `
      mutation cartCreate($input: CartInput) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        lines: [
          {
            merchandiseId: input.variantId.includes('gid://shopify/') 
              ? input.variantId 
              : `gid://shopify/ProductVariant/${input.variantId}`,
            quantity: input.quantity,
            attributes: input.customAttributes,
          },
        ],
      },
    };

    try {
      const response = await fetch('/api/shopify/storefront', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });

      const result = await response.json();

      if (result.errors) {
        console.error('Shopify GraphQL Errors:', result.errors);
        throw new Error(result.errors[0].message || 'Shopify API Error');
      }

      if (result.data?.cartCreate?.userErrors?.length > 0) {
        console.error('Shopify Cart Errors:', result.data.cartCreate.userErrors);
        const firstError = result.data.cartCreate.userErrors[0];
        throw new Error(`${firstError.message} (${firstError.field})`);
      }

      const checkoutUrl = result.data?.cartCreate?.cart?.checkoutUrl;
      if (!checkoutUrl) {
        throw new Error('Shopify did not return a checkout URL. Please check your product availability.');
      }

      return checkoutUrl;
    } catch (error: any) {
      console.error('Failed to create Shopify checkout:', error);
      throw error;
    }
  },

  // Helper to format rug config for Shopify attributes
  formatRugAttributes(config: any, imageUrl: string) {
    const attributes = [
      { key: '_image', value: imageUrl }, // Hidden attribute often used by Shopify themes/checkout
      { key: 'Design URL', value: imageUrl },
      { key: 'Prompt', value: config.prompt || 'Custom Design' },
      { key: 'Construction', value: config.construction || 'Hand-knotted' },
      { key: 'Material', value: config.materialTypes?.join(', ') || 'Wool' },
      { key: 'Size', value: `${config.width}x${config.length} ${config.shape}` },
      { key: 'Pile', value: `${config.pileType} (${config.pileHeight})` },
    ];
    return attributes;
  },

  async createDynamicCheckout(input: { title: string, price: number, imageUrl: string, attributes: any[], email?: string, type: 'deposit' | 'sample' }) {
    try {
      // 1. Create the custom product on the server (Admin API)
      const response = await fetch('/api/shopify/create-custom-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create custom product');
      }

      const variantId = result.variantId;

      // 2. Create a checkout using the new variant (Storefront API)
      const checkoutUrl = await this.createCheckout({
        variantId,
        quantity: 1,
        customAttributes: input.attributes,
      });

      return checkoutUrl;
    } catch (error: any) {
      console.error('Dynamic Checkout Error:', error);
      throw error;
    }
  },

  async createPlanUpgradeCheckout(email: string, userId: string) {
    try {
      const response = await fetch('/api/shopify/create-plan-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, userId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create upgrade checkout');
      return result; // { invoiceUrl, draftOrderId }
    } catch (error) {
      console.error('Plan Upgrade Error:', error);
      throw error;
    }
  },

  async verifyUpgrade(draftOrderId: string) {
    try {
      const response = await fetch(`/api/shopify/verify-upgrade/${draftOrderId}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to verify upgrade');
      return result.isPaid;
    } catch (error) {
      console.error('Verify Upgrade Error:', error);
      throw error;
    }
  }
};
