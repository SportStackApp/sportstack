import { describe, expect, it } from "vitest";
import { parseBankCsv, parseOfx } from "./statementParser";

describe("bank statement parser", () => {
  it("parses Australian CSV dates and debit/credit columns", () => {
    const rows = parseBankCsv('Date,Description,Debit,Credit,Balance\n04/08/2026,"Vercel, Inc",20.00,,180.00');
    expect(rows[0]).toMatchObject({ transactionDate: "2026-08-04", description: "Vercel, Inc", amount: -20, balance: 180 });
  });

  it("parses OFX transactions", () => {
    const rows = parseOfx('<OFX><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260804120000<TRNAMT>-12.50<FITID>abc<NAME>HOSTING</STMTTRN></OFX>');
    expect(rows[0]).toMatchObject({ transactionDate: "2026-08-04", description: "HOSTING", amount: -12.5, reference: "abc" });
  });
});
