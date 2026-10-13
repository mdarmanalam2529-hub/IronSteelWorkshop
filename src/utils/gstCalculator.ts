// GST Calculation and Compliance Utilities for Workshop Management

export interface IndianState {
  code: string;
  name: string;
  type: 'state' | 'ut'; // State or Union Territory
}

export const INDIAN_STATES: IndianState[] = [
  { code: '01', name: 'Jammu and Kashmir', type: 'ut' },
  { code: '02', name: 'Himachal Pradesh', type: 'state' },
  { code: '03', name: 'Punjab', type: 'state' },
  { code: '04', name: 'Chandigarh', type: 'ut' },
  { code: '05', name: 'Uttarakhand', type: 'state' },
  { code: '06', name: 'Haryana', type: 'state' },
  { code: '07', name: 'Delhi', type: 'ut' },
  { code: '08', name: 'Rajasthan', type: 'state' },
  { code: '09', name: 'Uttar Pradesh', type: 'state' },
  { code: '10', name: 'Bihar', type: 'state' },
  { code: '11', name: 'Sikkim', type: 'state' },
  { code: '12', name: 'Arunachal Pradesh', type: 'state' },
  { code: '13', name: 'Nagaland', type: 'state' },
  { code: '14', name: 'Manipur', type: 'state' },
  { code: '15', name: 'Mizoram', type: 'state' },
  { code: '16', name: 'Tripura', type: 'state' },
  { code: '17', name: 'Meghalaya', type: 'state' },
  { code: '18', name: 'Assam', type: 'state' },
  { code: '19', name: 'West Bengal', type: 'state' },
  { code: '20', name: 'Jharkhand', type: 'state' },
  { code: '21', name: 'Odisha', type: 'state' },
  { code: '22', name: 'Chhattisgarh', type: 'state' },
  { code: '23', name: 'Madhya Pradesh', type: 'state' },
  { code: '24', name: 'Gujarat', type: 'state' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu', type: 'ut' },
  { code: '27', name: 'Maharashtra', type: 'state' },
  { code: '28', name: 'Andhra Pradesh', type: 'state' },
  { code: '29', name: 'Karnataka', type: 'state' },
  { code: '30', name: 'Goa', type: 'state' },
  { code: '31', name: 'Lakshadweep', type: 'ut' },
  { code: '32', name: 'Kerala', type: 'state' },
  { code: '33', name: 'Tamil Nadu', type: 'state' },
  { code: '34', name: 'Puducherry', type: 'ut' },
  { code: '35', name: 'Andaman and Nicobar Islands', type: 'ut' },
  { code: '36', name: 'Telangana', type: 'state' },
  { code: '37', name: 'Andhra Pradesh (New)', type: 'state' },
  { code: '38', name: 'Ladakh', type: 'ut' },
];

export const STANDARD_GST_RATES = [0, 5, 12, 18, 28] as const;

export interface WorkshopHsnSac {
  code: string;
  type: 'HSN' | 'SAC';
  description: string;
  defaultRate: number;
}

export const COMMON_WORKSHOP_HSN_SAC: WorkshopHsnSac[] = [
  { code: '7308', type: 'HSN', description: 'Structures & parts of structures (iron or steel), plates, rods, angles', defaultRate: 18 },
  { code: '7214', type: 'HSN', description: 'Bars & rods of iron/non-alloy steel, hot-rolled/forged', defaultRate: 18 },
  { code: '7326', type: 'HSN', description: 'Other articles of iron or steel (fabricated metal goods)', defaultRate: 18 },
  { code: '7208', type: 'HSN', description: 'Flat-rolled products of iron/non-alloy steel (plates/sheets)', defaultRate: 18 },
  { code: '8481', type: 'HSN', description: 'Taps, valves, cocks and pipe fittings', defaultRate: 18 },
  { code: '9988', type: 'SAC', description: 'Job work & fabrication services (manufacturing services)', defaultRate: 18 },
  { code: '9987', type: 'SAC', description: 'Maintenance, repair & installation services', defaultRate: 18 },
  { code: '9954', type: 'SAC', description: 'General construction & civil fabrication contracts', defaultRate: 18 },
];

export interface GstCalculationParams {
  amount: number;             // Amount before tax or gross amount
  rate: number;               // GST rate percentage (e.g. 18)
  isInclusive?: boolean;      // If true, amount already includes GST (reverse calculation)
  gstType?: 'cgst_sgst' | 'igst'; // Split or combined
  roundOffResult?: boolean;   // Round final grand total to nearest integer
}

export interface GstCalculationResult {
  taxableAmount: number;      // Base value before tax
  gstRate: number;            // Total GST rate %
  gstType: 'cgst_sgst' | 'igst';
  isInclusive: boolean;
  cgstRate: number;           // CGST % (half rate for cgst_sgst, 0 for igst)
  cgstAmount: number;
  sgstRate: number;           // SGST % (half rate for cgst_sgst, 0 for igst)
  sgstAmount: number;
  igstRate: number;           // IGST % (full rate for igst, 0 for cgst_sgst)
  igstAmount: number;
  totalTax: number;           // Total GST tax amount
  rawTotal: number;           // taxableAmount + totalTax (exact decimals)
  roundOff: number;           // +/- adjustment to round to nearest Rupee
  grandTotal: number;         // Final payable total
}

/**
 * Perform exact dynamic GST calculations for both Tax Exclusive and Tax Inclusive modes.
 */
export function calculateGstTax({
  amount,
  rate,
  isInclusive = false,
  gstType = 'cgst_sgst',
  roundOffResult = true,
}: GstCalculationParams): GstCalculationResult {
  const cleanAmount = Number(amount) || 0;
  const cleanRate = Math.max(0, Number(rate) || 0);

  let taxableAmount = 0;
  let totalTax = 0;

  if (cleanRate === 0 || cleanAmount === 0) {
    taxableAmount = cleanAmount;
    totalTax = 0;
  } else if (isInclusive) {
    // Reverse GST calculation: Gross = Base * (1 + Rate / 100)
    // Base = Gross / (1 + Rate / 100)
    taxableAmount = cleanAmount / (1 + cleanRate / 100);
    totalTax = cleanAmount - taxableAmount;
  } else {
    // Forward GST calculation: Base = amount, Tax = Base * Rate / 100
    taxableAmount = cleanAmount;
    totalTax = (cleanAmount * cleanRate) / 100;
  }

  // Round tax components to 2 decimal places
  taxableAmount = Math.round(taxableAmount * 100) / 100;
  totalTax = Math.round(totalTax * 100) / 100;

  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;

  if (gstType === 'igst') {
    igstRate = cleanRate;
    igstAmount = totalTax;
  } else {
    cgstRate = cleanRate / 2;
    sgstRate = cleanRate / 2;
    // Split tax evenly
    cgstAmount = Math.round((totalTax / 2) * 100) / 100;
    sgstAmount = Math.round((totalTax - cgstAmount) * 100) / 100;
  }

  const rawTotal = taxableAmount + totalTax;
  const grandTotal = roundOffResult ? Math.round(rawTotal) : Math.round(rawTotal * 100) / 100;
  const roundOff = roundOffResult ? Math.round((grandTotal - rawTotal) * 100) / 100 : 0;

  return {
    taxableAmount,
    gstRate: cleanRate,
    gstType,
    isInclusive,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    totalTax,
    rawTotal,
    roundOff,
    grandTotal,
  };
}

/**
 * Determine if GST is Intra-state (CGST + SGST) or Inter-state (IGST) based on State Codes.
 */
export function determineGstTypeFromStates(
  workshopStateCode?: string | null,
  customerStateCode?: string | null
): 'cgst_sgst' | 'igst' {
  if (!workshopStateCode || !customerStateCode) {
    return 'cgst_sgst'; // default to intra-state
  }
  const wsClean = workshopStateCode.trim().padStart(2, '0');
  const custClean = customerStateCode.trim().padStart(2, '0');
  return wsClean === custClean ? 'cgst_sgst' : 'igst';
}

/**
 * Extract Indian State from GSTIN (First 2 digits represent the state code).
 */
export function getStateFromGstin(gstin?: string | null): IndianState | null {
  if (!gstin || gstin.trim().length < 2) return null;
  const stateCode = gstin.trim().substring(0, 2);
  return INDIAN_STATES.find((s) => s.code === stateCode) || null;
}

/**
 * Validate standard 15-character Indian GSTIN format.
 * Format: 2 digits (State) + 10 chars (PAN) + 1 digit (Entity) + 'Z' + 1 checksum digit/char
 */
export function validateGstin(gstin: string): { isValid: boolean; state?: IndianState; message?: string } {
  const trimmed = gstin.trim().toUpperCase();
  if (!trimmed) {
    return { isValid: false, message: 'GSTIN is required.' };
  }
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstRegex.test(trimmed)) {
    return {
      isValid: false,
      message: 'Invalid GSTIN format. Must be 15 characters (e.g. 27AAAAA0000A1Z5)',
    };
  }
  const state = getStateFromGstin(trimmed);
  return { isValid: true, state: state || undefined };
}

/**
 * Quick reverse GST calculator helper for converting total paid into base + tax.
 */
export function extractBaseAndGst(grossAmount: number, rate: number = 18): { baseAmount: number; gstAmount: number } {
  const base = grossAmount / (1 + rate / 100);
  const gst = grossAmount - base;
  return {
    baseAmount: Math.round(base * 100) / 100,
    gstAmount: Math.round(gst * 100) / 100,
  };
}
