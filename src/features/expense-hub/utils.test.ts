import { describe, expect, it } from "vitest";
import {
  calculateExpenseAmounts,
  calculateGstFromInclusiveTotal,
  financialYearForDate,
  normaliseSupplierName,
  supplierSimilarity,
} from "./utils";

describe("Expense Hub calculations", () => {
  it("splits a mixed-use GST-inclusive expense without rounding drift", () => {
    expect(calculateExpenseAmounts(120, 10.91, 75)).toEqual({
      amountExcludingGst: 109.09,
      businessAmount: 90,
      personalAmount: 30,
      businessGstAmount: 8.18,
    });
  });

  it("keeps credit notes negative", () => {
    expect(calculateExpenseAmounts(-55, -5, 60)).toEqual({
      amountExcludingGst: -50,
      businessAmount: -33,
      personalAmount: -22,
      businessGstAmount: -3,
    });
  });

  it("uses the Australian July to June financial year", () => {
    expect(financialYearForDate("2026-06-30")).toBe("2025–26");
    expect(financialYearForDate("2026-07-01")).toBe("2026–27");
  });

  it("calculates GST as one eleventh of a GST-inclusive total", () => {
    expect(calculateGstFromInclusiveTotal(120)).toBe(10.91);
  });
});

describe("Supplier matching", () => {
  it("normalises common Australian company suffixes", () => {
    expect(normaliseSupplierName("Microsoft Australia Pty Ltd")).toBe("microsoft");
  });

  it("suggests close supplier wordings without silently merging them", () => {
    expect(supplierSimilarity("MICROSOFT*365", "Microsoft")).toBeGreaterThan(0.7);
    expect(supplierSimilarity("Microsoft", "Telstra")).toBeLessThan(0.3);
  });
});
