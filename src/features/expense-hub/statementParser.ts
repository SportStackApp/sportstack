export interface ParsedStatementLine {
  lineNumber: number;
  transactionDate: string;
  description: string;
  reference: string;
  amount: number;
  balance: number | null;
  rawData: Record<string, string>;
}

const DATE_KEYS = ["date", "transaction date", "processed date", "value date"];
const DESCRIPTION_KEYS = ["description", "narrative", "details", "transaction"];
const REFERENCE_KEYS = ["reference", "transaction id", "cheque number"];
const AMOUNT_KEYS = ["amount", "transaction amount"];
const DEBIT_KEYS = ["debit", "withdrawal", "money out"];
const CREDIT_KEYS = ["credit", "deposit", "money in"];
const BALANCE_KEYS = ["balance", "running balance"];

const normaliseKey = (value: string) => value.trim().toLowerCase().replace(/[_-]+/g, " ");
const findValue = (row: Record<string, string>, keys: string[]) => {
  const entry = Object.entries(row).find(([key]) => keys.includes(normaliseKey(key)));
  return entry?.[1]?.trim() || "";
};
const numberValue = (value: string) => {
  const normalised = value.replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : 0;
};
const isoDate = (value: string) => {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) throw new Error(`Unsupported transaction date: ${value}`);
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
};

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else cell += character;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function parseBankCsv(text: string): ParsedStatementLine[] {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("The CSV does not contain a header and transaction rows.");
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values, index) => {
    const rawData = Object.fromEntries(headers.map((header, column) => [header, values[column]?.trim() || ""]));
    const debit = numberValue(findValue(rawData, DEBIT_KEYS));
    const credit = numberValue(findValue(rawData, CREDIT_KEYS));
    const directAmount = findValue(rawData, AMOUNT_KEYS);
    const description = findValue(rawData, DESCRIPTION_KEYS);
    if (!description) throw new Error(`Transaction row ${index + 2} has no description.`);
    return {
      lineNumber: index + 1,
      transactionDate: isoDate(findValue(rawData, DATE_KEYS)),
      description,
      reference: findValue(rawData, REFERENCE_KEYS),
      amount: directAmount ? numberValue(directAmount) : Number((credit - Math.abs(debit)).toFixed(2)),
      balance: findValue(rawData, BALANCE_KEYS) ? numberValue(findValue(rawData, BALANCE_KEYS)) : null,
      rawData,
    };
  });
}

export function parseOfx(text: string): ParsedStatementLine[] {
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  if (!blocks.length) throw new Error("No transactions were found in the OFX file.");
  const value = (block: string, tag: string) => block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, "i"))?.[1]?.trim() || "";
  return blocks.map((block, index) => ({
    lineNumber: index + 1,
    transactionDate: value(block, "DTPOSTED").slice(0, 8).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
    description: value(block, "NAME") || value(block, "MEMO") || "Bank transaction",
    reference: value(block, "FITID"),
    amount: numberValue(value(block, "TRNAMT")),
    balance: null,
    rawData: { type: value(block, "TRNTYPE"), memo: value(block, "MEMO") },
  }));
}

export async function parseBankStatement(file: File) {
  const text = await file.text();
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "ofx" || /<OFX>/i.test(text)) return parseOfx(text);
  if (extension === "csv") return parseBankCsv(text);
  throw new Error("Start with a CSV or OFX bank statement. PDF scanning is handled through invoice scanning.");
}
