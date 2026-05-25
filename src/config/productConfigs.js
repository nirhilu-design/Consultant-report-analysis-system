// NEW FILE
// Path in project: src/config/productConfigs.js

export const PRODUCT_TYPES = {
  PENSION: "pension",
  HISHTALMUT: "hishtalmut",
};

export const productConfigs = {
  [PRODUCT_TYPES.PENSION]: {
    label: "קרן פנסיה",
    hasDepositFee: true,
    hasAccumulationFee: true,
    hasInsuranceTrack: true,
    hasInvestmentTrack: true,

    // Rule for issuers without agreement.
    // Units are percent:
    // 1 = 1%, 0.2 = 0.2%.
    baseline: {
      depositFee: 1,
      accumulationFee: 0.2,
    },
  },

  [PRODUCT_TYPES.HISHTALMUT]: {
    label: "קרן השתלמות",
    hasDepositFee: false,
    hasAccumulationFee: true,
    hasInsuranceTrack: false,
    hasInvestmentTrack: true,

    // Can be changed later per business agreement.
    baseline: {
      depositFee: null,
      accumulationFee: 0.8,
    },
  },
};

export function getProductConfig(productType) {
  return productConfigs[productType] || productConfigs[PRODUCT_TYPES.PENSION];
}
