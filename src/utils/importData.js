/**
 * Import parser and utilities for Splitwise, Splital, and Kasseo backup files (CSV & JSON)
 */
import { CATEGORIES } from "@/constants/categories";

/**
 * Normalizes a date string into YYYY-MM-DD format
 */
export function normalizeDate(dateStr) {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  const trimmed = String(dateStr).trim();

  // If already YYYY-MM-DD or starts with YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Try Date.parse fallback
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * Parses numeric amount from string, handling currency symbols, commas, and dots
 */
export function parseAmount(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : Math.abs(val);

  let str = String(val).trim();
  // Remove currency signs and spaces
  str = str.replace(/[$€£¥₹\s\u00A0]/g, "");

  // Handle European number format: 1.234,56 or 1234,56
  if (str.includes(",") && !str.includes(".")) {
    str = str.replace(",", ".");
  } else if (str.includes(",") && str.includes(".")) {
    // If dot comes before comma: 1.234,56
    if (str.indexOf(".") < str.indexOf(",")) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234.56
      str = str.replace(/,/g, "");
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * Normalizes currency string or symbol to standard 3-letter ISO code
 */
export function normalizeCurrency(currStr) {
  if (!currStr) return "USD";
  const str = String(currStr).trim().toUpperCase();

  const symbolMap = {
    $: "USD",
    "€": "EUR",
    "£": "GBP",
    "¥": "JPY",
    "₹": "INR",
    "FT": "HUF",
    "HUF": "HUF",
    "CHF": "CHF",
    "CAD": "CAD",
    "AUD": "AUD",
    "PLN": "PLN",
    "CZK": "CZK",
    "RON": "RON",
    "SEK": "SEK",
    "NOK": "NOK",
    "DKK": "DKK",
    "BRL": "BRL",
  };

  if (symbolMap[str]) return symbolMap[str];
  const cleaned = str.replace(/[^A-Z]/g, "");
  return cleaned.length === 3 ? cleaned : "USD";
}

/**
 * Normalizes categories from external apps into Kasseo's 8 standard categories
 */
export function normalizeCategory(catStr) {
  if (!catStr) return "Other";
  const trimmed = String(catStr).trim();

  // If already an exact match
  if (CATEGORIES.includes(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();

  // Food & Groceries
  if (
    lower.includes("food") ||
    lower.includes("grocer") ||
    lower.includes("dining") ||
    lower.includes("restaurant") ||
    lower.includes("drink") ||
    lower.includes("cafe") ||
    lower.includes("coffee") ||
    lower.includes("bar") ||
    lower.includes("lunch") ||
    lower.includes("dinner") ||
    lower.includes("breakfast") ||
    lower.includes("supermarket") ||
    lower.includes("snack") ||
    lower.includes("bakery") ||
    lower.includes("étkezés") ||
    lower.includes("kaja") ||
    lower.includes("bevásárlás") ||
    lower.includes("comida") ||
    lower.includes("restaurante")
  ) {
    return "Food & Groceries";
  }

  // Transport (check before general utilities "gas")
  if (
    lower.includes("transport") ||
    lower.includes("taxi") ||
    lower.includes("uber") ||
    lower.includes("lyft") ||
    lower.includes("bolt") ||
    lower.includes("bus") ||
    lower.includes("train") ||
    lower.includes("metro") ||
    lower.includes("subway") ||
    lower.includes("transit") ||
    lower.includes("fuel") ||
    lower.includes("petrol") ||
    lower.includes("diesel") ||
    lower.includes("parking") ||
    lower.includes("toll") ||
    lower.includes("car") ||
    lower.includes("vehicle") ||
    lower.includes("flight") ||
    lower.includes("plane") ||
    lower.includes("airline") ||
    lower.includes("gas/fuel") ||
    lower.includes("gasoline") ||
    lower.includes("utazás") ||
    lower.includes("benzin") ||
    lower.includes("transporte")
  ) {
    return "Transport";
  }

  // Rent & Utilities
  if (
    lower.includes("rent") ||
    lower.includes("utilit") ||
    lower.includes("house") ||
    lower.includes("housing") ||
    lower.includes("home") ||
    lower.includes("apartment") ||
    lower.includes("flat") ||
    lower.includes("water") ||
    lower.includes("electric") ||
    lower.includes("power") ||
    lower.includes("gas") ||
    lower.includes("internet") ||
    lower.includes("wifi") ||
    lower.includes("heat") ||
    lower.includes("trash") ||
    lower.includes("maintenance") ||
    lower.includes("lakbér") ||
    lower.includes("rezsi") ||
    lower.includes("alquiler") ||
    lower.includes("servicios")
  ) {
    return "Rent & Utilities";
  }

  // Entertainment
  if (
    lower.includes("entertain") ||
    lower.includes("game") ||
    lower.includes("gaming") ||
    lower.includes("movie") ||
    lower.includes("cinema") ||
    lower.includes("film") ||
    lower.includes("music") ||
    lower.includes("concert") ||
    lower.includes("event") ||
    lower.includes("sport") ||
    lower.includes("show") ||
    lower.includes("party") ||
    lower.includes("szórakozás") ||
    lower.includes("mozi") ||
    lower.includes("játék") ||
    lower.includes("ocio")
  ) {
    return "Entertainment";
  }

  // Shopping
  if (
    lower.includes("shop") ||
    lower.includes("cloth") ||
    lower.includes("shoe") ||
    lower.includes("electronic") ||
    lower.includes("gadget") ||
    lower.includes("gift") ||
    lower.includes("book") ||
    lower.includes("amazon") ||
    lower.includes("mall") ||
    lower.includes("vásárlás") ||
    lower.includes("ruha") ||
    lower.includes("compras")
  ) {
    return "Shopping";
  }

  // Health
  if (
    lower.includes("health") ||
    lower.includes("medic") ||
    lower.includes("doctor") ||
    lower.includes("pharmacy") ||
    lower.includes("drug") ||
    lower.includes("dentist") ||
    lower.includes("gym") ||
    lower.includes("fitness") ||
    lower.includes("beauty") ||
    lower.includes("hair") ||
    lower.includes("egészség") ||
    lower.includes("orvos") ||
    lower.includes("gyógysz") ||
    lower.includes("salud")
  ) {
    return "Health";
  }

  // Travel
  if (
    lower.includes("travel") ||
    lower.includes("trip") ||
    lower.includes("vacation") ||
    lower.includes("holiday") ||
    lower.includes("hotel") ||
    lower.includes("accommodat") ||
    lower.includes("airbnb") ||
    lower.includes("hostel") ||
    lower.includes("tourism") ||
    lower.includes("sightseeing") ||
    lower.includes("nyaralás") ||
    lower.includes("szállás") ||
    lower.includes("viaje")
  ) {
    return "Travel";
  }

  return "Other";
}

/**
 * RFC 4180 compliant CSV parser with delimiter auto-detection and quote escaping
 */
export function parseCSV(csvText) {
  if (!csvText || typeof csvText !== "string") {
    return { headers: [], rows: [], rawRows: [] };
  }

  // Strip UTF-8 BOM if present
  let text = csvText.replace(/^\uFEFF/, "").trim();
  if (!text) return { headers: [], rows: [], rawRows: [] };

  // Detect delimiter from first line (, ; or \t)
  const firstLine = text.split(/\r\n|\n|\r/)[0] || "";
  let commaCount = 0;
  let semiCount = 0;
  let tabCount = 0;
  let inQuotes = false;

  for (let i = 0; i < firstLine.length; i++) {
    const char = firstLine[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (char === ",") commaCount++;
      else if (char === ";") semiCount++;
      else if (char === "\t") tabCount++;
    }
  }

  let delimiter = ",";
  if (semiCount > commaCount && semiCount > tabCount) delimiter = ";";
  else if (tabCount > commaCount && tabCount > semiCount) delimiter = "\t";

  // Parse state machine
  const rawRows = [];
  let currentRow = [];
  let currentField = "";
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        // Escaped quote: ""
        currentField += '"';
        i++; // skip next quote
      } else {
        // Toggle quote state
        insideQuote = !insideQuote;
      }
    } else if (char === delimiter && !insideQuote) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !insideQuote) {
      // Handle \r\n or \n
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      currentRow.push(currentField.trim());
      currentField = "";

      // Only push non-empty rows
      if (currentRow.some((field) => field.length > 0)) {
        rawRows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  // Flush remaining field
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field.length > 0)) {
      rawRows.push(currentRow);
    }
  }

  if (rawRows.length === 0) {
    return { headers: [], rows: [], rawRows: [] };
  }

  const headers = rawRows[0].map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    const rowObj = {};
    headers.forEach((header, index) => {
      rowObj[header] = rawRow[index] !== undefined ? rawRow[index] : "";
    });
    rows.push(rowObj);
  }

  return { headers, rows, rawRows };
}

/**
 * Detects import format from text content and filename
 */
export function detectImportFormat(fileContent, filename = "") {
  const trimmed = fileContent.trim();

  // 1. Check if JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.version && parsed.group && Array.isArray(parsed.transactions)) {
        return {
          format: "kasseo_json",
          formatName: "Kasseo Backup (JSON)",
          type: "json",
          parsedData: parsed,
        };
      }
      if (Array.isArray(parsed) || Array.isArray(parsed.transactions)) {
        return {
          format: "generic_json",
          formatName: "JSON Backup",
          type: "json",
          parsedData: parsed,
        };
      }
    } catch {
      // Not valid JSON, continue to CSV
    }
  }

  // 2. CSV parsing
  const { headers, rows, rawRows } = parseCSV(fileContent);
  if (headers.length === 0) {
    throw new Error("Could not parse file: empty or invalid file content.");
  }

  const lowerHeaders = headers.map((h) => h.toLowerCase());

  // Kasseo CSV check
  if (
    lowerHeaders.includes("paid by") &&
    lowerHeaders.includes("split among") &&
    (lowerHeaders.includes("original amount") || lowerHeaders.includes("receipt id"))
  ) {
    return {
      format: "kasseo_csv",
      formatName: "Kasseo CSV",
      type: "csv",
      headers,
      rows,
      rawRows,
    };
  }

  // Splitwise CSV check: has Date, Description, Cost (or Total), Currency, and member net columns
  const hasSplitwiseCost =
    lowerHeaders.includes("cost") ||
    lowerHeaders.includes("total") ||
    lowerHeaders.includes("amount");
  const hasSplitwiseDate = lowerHeaders.includes("date");
  const hasSplitwiseDesc =
    lowerHeaders.includes("description") || lowerHeaders.includes("details");

  // In Splitwise, headers after Currency are member names
  const currencyIdx = lowerHeaders.indexOf("currency");
  if (hasSplitwiseDate && hasSplitwiseDesc && hasSplitwiseCost && currencyIdx !== -1 && headers.length > currencyIdx + 1) {
    return {
      format: "splitwise_csv",
      formatName: "Splitwise CSV",
      type: "csv",
      headers,
      rows,
      rawRows,
    };
  }

  // Fallback: Splital / Standard CSV
  return {
    format: "splital_csv",
    formatName: "Splital / Standard CSV",
    type: "csv",
    headers,
    rows,
    rawRows,
  };
}

/**
 * Parses Splitwise CSV export data
 */
export function parseSplitwiseCSV(headers, rows, filename = "") {
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  const dateIdx = lowerHeaders.findIndex((h) => h === "date");
  const descIdx = lowerHeaders.findIndex(
    (h) => h === "description" || h === "details",
  );
  const catIdx = lowerHeaders.findIndex((h) => h === "category");
  const costIdx = lowerHeaders.findIndex(
    (h) => h === "cost" || h === "amount" || h === "total",
  );
  const currIdx = lowerHeaders.findIndex((h) => h === "currency");

  // Member columns are all columns not matching standard metadata
  const metadataIdxs = new Set(
    [dateIdx, descIdx, catIdx, costIdx, currIdx].filter((i) => i !== -1),
  );
  const memberHeaders = headers.filter((_, idx) => !metadataIdxs.has(idx));

  const allMembersSet = new Set(memberHeaders.map((m) => m.trim()).filter(Boolean));
  const transactions = [];
  let defaultCurrency = "USD";

  for (const row of rows) {
    const dateRaw = dateIdx !== -1 ? row[headers[dateIdx]] : "";
    const descRaw = descIdx !== -1 ? row[headers[descIdx]] : "Expense";
    const catRaw = catIdx !== -1 ? row[headers[catIdx]] : "";
    const costRaw = costIdx !== -1 ? row[headers[costIdx]] : "0";
    const currRaw = currIdx !== -1 ? row[headers[currIdx]] : "";

    const date = normalizeDate(dateRaw);
    const amount = parseAmount(costRaw);
    if (amount <= 0) continue; // Skip zero amount transactions

    const currency = normalizeCurrency(currRaw);
    if (currency) defaultCurrency = currency;

    const description = String(descRaw || "Expense").trim();
    const category = normalizeCategory(catRaw);

    // Analyze member balance changes
    const memberBalances = {};
    let positiveMembers = [];
    let negativeMembers = [];

    for (const member of memberHeaders) {
      const valStr = row[member];
      const val = parseFloat(String(valStr).replace(/[$€£\s]/g, "").replace(",", "."));
      if (!isNaN(val) && Math.abs(val) > 0.001) {
        memberBalances[member] = val;
        if (val > 0) positiveMembers.push({ member, val });
        else negativeMembers.push({ member, val: Math.abs(val) });
      }
    }

    // Check if this row is a settlement/payment
    const isPaymentCategory = String(catRaw).toLowerCase() === "payment";
    const isPaymentDesc =
      /paid|settle|payment|transfer/i.test(description) &&
      positiveMembers.length <= 1 &&
      negativeMembers.length <= 1;

    if (isPaymentCategory || isPaymentDesc) {
      // In Splitwise, payer has positive balance change, recipient has negative
      let paidByName = "";
      let toName = "";

      if (positiveMembers.length > 0) {
        paidByName = positiveMembers[0].member;
      }
      if (negativeMembers.length > 0) {
        toName = negativeMembers[0].member;
      }

      // Regex fallback on description "Alice paid Bob"
      if (!paidByName || !toName) {
        const match = description.match(/^(.+?)\s+paid\s+(.+?)(\s+|$)/i);
        if (match) {
          if (!paidByName) paidByName = match[1].trim();
          if (!toName) toName = match[2].trim();
        }
      }

      if (paidByName && toName) {
        allMembersSet.add(paidByName);
        allMembersSet.add(toName);
      }

      transactions.push({
        date,
        type: "settlement",
        category: "Settlement",
        description,
        amount,
        currency,
        paidByName: paidByName || (memberHeaders[0] || "User"),
        toName: toName || (memberHeaders[1] || "Member"),
      });
    } else {
      // Expense row
      // Payer is member with highest positive balance (or only positive)
      positiveMembers.sort((a, b) => b.val - a.val);
      const payer = positiveMembers.length > 0 ? positiveMembers[0].member : memberHeaders[0] || "User";
      allMembersSet.add(payer);

      // Split participants: all members with negative balance
      const splitAmongNames = negativeMembers.map((n) => n.member);

      // Check if payer is also part of the split:
      // If payer's positive net balance is less than total amount (i.e. amount - sum(owed by others) > 0)
      const sumOwedByOthers = negativeMembers.reduce((sum, n) => sum + n.val, 0);
      const payerShare = amount - sumOwedByOthers;

      if (payerShare > 0.01 && !splitAmongNames.includes(payer)) {
        splitAmongNames.push(payer);
      }

      // If no members were parsed (e.g. all empty), default to all member headers
      const finalSplitAmong = splitAmongNames.length > 0 ? splitAmongNames : memberHeaders;

      // Check if split is unequal shares (percentage)
      let splitType = "equal";
      let splitShares = null;

      if (finalSplitAmong.length > 1) {
        const shares = {};
        let isUnequal = false;
        const expectedEqualShare = amount / finalSplitAmong.length;

        for (const m of finalSplitAmong) {
          let shareAmount = expectedEqualShare;
          if (m === payer && payerShare > 0.01) {
            shareAmount = payerShare;
          } else {
            const neg = negativeMembers.find((n) => n.member === m);
            if (neg) shareAmount = neg.val;
          }
          const pct = Math.round((shareAmount / amount) * 100);
          shares[m] = pct;
          if (Math.abs(shareAmount - expectedEqualShare) > 0.05 * amount) {
            isUnequal = true;
          }
        }

        if (isUnequal) {
          splitType = "percent";
          splitShares = shares;
        }
      }

      transactions.push({
        date,
        type: "expense",
        category,
        description,
        amount,
        currency,
        paidByName: payer,
        splitAmongNames: finalSplitAmong,
        splitType,
        splitShares,
      });
    }
  }

  // Derive group name from filename or default
  const sanitizedName = filename
    ? filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")
    : "Splitwise Import";

  return {
    transactions,
    members: Array.from(allMembersSet),
    defaultCurrency,
    groupName: sanitizedName,
    mode: "split",
  };
}

/**
 * Parses Splital / Standard CSV export data
 */
export function parseSplitalCSV(headers, rows, filename = "") {
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  const findCol = (keywords) => {
    return headers.find((h) => {
      const l = h.toLowerCase();
      return keywords.some((k) => l === k || l.includes(k));
    });
  };

  const dateCol = findCol(["date", "dátum", "fecha", "datum"]);
  const descCol = findCol(["description", "title", "details", "desc", "leírás", "concepto", "name"]);
  const catCol = findCol(["category", "kategória", "categoría", "kategori"]);
  const amountCol = findCol(["amount", "cost", "total", "összeg", "importe", "price", "érték"]);
  const currCol = findCol(["currency", "pénznem", "moneda", "valuta"]);
  const payerCol = findCol(["paid by", "paid_by", "payer", "fizette", "pagado por", "paidby", "from"]);
  const splitCol = findCol(["split with", "split among", "participants", "members", "résztvevők", "dividido entre", "split"]);
  const toCol = findCol(["settlement to", "to", "kinek", "para", "recipient", "paid to"]);
  const typeCol = findCol(["type", "típus", "tipo"]);

  const allMembersSet = new Set();
  const transactions = [];
  let defaultCurrency = "USD";

  for (const row of rows) {
    const dateRaw = dateCol ? row[dateCol] : "";
    const descRaw = descCol ? row[descCol] : "Expense";
    const catRaw = catCol ? row[catCol] : "";
    const amountRaw = amountCol ? row[amountCol] : "0";
    const currRaw = currCol ? row[currCol] : "";
    const payerRaw = payerCol ? row[payerCol] : "";
    const splitRaw = splitCol ? row[splitCol] : "";
    const toRaw = toCol ? row[toCol] : "";
    const typeRaw = typeCol ? row[typeCol] : "";

    const date = normalizeDate(dateRaw);
    const amount = parseAmount(amountRaw);
    if (amount <= 0) continue;

    const currency = normalizeCurrency(currRaw);
    if (currency) defaultCurrency = currency;

    const description = String(descRaw || "Expense").trim();
    const category = normalizeCategory(catRaw);

    // Determine type
    let type = "expense";
    const typeLower = String(typeRaw).toLowerCase();
    const catLower = String(catRaw).toLowerCase();
    const descLower = String(descRaw).toLowerCase();

    if (
      typeLower.includes("settle") ||
      typeLower.includes("payment") ||
      catLower.includes("settle") ||
      catLower.includes("payment") ||
      descLower.includes("paid") ||
      Boolean(toRaw)
    ) {
      type = "settlement";
    } else if (
      typeLower.includes("deposit") ||
      typeLower.includes("income") ||
      catLower.includes("deposit") ||
      catLower.includes("income") ||
      typeLower.includes("befizetés")
    ) {
      type = "deposit";
    }

    const paidByName = String(payerRaw || "User").trim();
    if (paidByName) allMembersSet.add(paidByName);

    if (type === "settlement") {
      let toName = String(toRaw || "").trim();
      // If toName not directly specified in a 'To' column, infer from split column or description
      if (!toName && splitRaw) {
        const splitParts = splitRaw.split(/[,;\n|]/).map((s) => s.trim()).filter(Boolean);
        if (splitParts.length === 1 && splitParts[0] !== paidByName) {
          toName = splitParts[0];
        }
      }
      if (!toName) {
        const match = description.match(/(?:to|paid)\s+([A-Za-z0-9_\s]+)/i);
        if (match) toName = match[1].trim();
      }
      if (!toName) toName = "Member";

      allMembersSet.add(toName);

      transactions.push({
        date,
        type: "settlement",
        category: "Settlement",
        description,
        amount,
        currency,
        paidByName,
        toName,
      });
    } else if (type === "deposit") {
      transactions.push({
        date,
        type: "deposit",
        category: "Deposit",
        description,
        amount,
        currency,
        paidByName,
      });
    } else {
      // Split participants
      let splitAmongNames = [];
      if (splitRaw) {
        // Split by comma, semicolon, or newline
        splitAmongNames = splitRaw
          .split(/[,;\n|]/)
          .map((s) => s.trim())
          .filter(Boolean);
      }

      if (splitAmongNames.length === 0) {
        splitAmongNames = [paidByName];
      }

      splitAmongNames.forEach((m) => allMembersSet.add(m));

      transactions.push({
        date,
        type: "expense",
        category,
        description,
        amount,
        currency,
        paidByName,
        splitAmongNames,
        splitType: "equal",
      });
    }
  }

  const sanitizedName = filename
    ? filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")
    : "Splital Import";

  return {
    transactions,
    members: Array.from(allMembersSet),
    defaultCurrency,
    groupName: sanitizedName,
    mode: "split",
  };
}

/**
 * Parses Kasseo CSV format
 */
export function parseKasseoCSV(headers, rows, filename = "") {
  const allMembersSet = new Set();
  const transactions = [];
  let defaultCurrency = "USD";

  for (const row of rows) {
    const date = normalizeDate(row["Date"]);
    const typeStr = String(row["Type"] || "Expense").toLowerCase();
    const type = typeStr.includes("settle")
      ? "settlement"
      : typeStr.includes("deposit")
        ? "deposit"
        : "expense";

    const category = normalizeCategory(row["Category"]);
    const description = row["Description"] || "";
    const amount = parseAmount(row["Amount"]);
    if (amount <= 0) continue;

    const currency = normalizeCurrency(row["Currency"] || row["Original Currency"]);
    if (currency) defaultCurrency = currency;

    const paidByName = String(row["Paid By"] || "User").trim();
    if (paidByName) allMembersSet.add(paidByName);

    if (type === "settlement") {
      const toName = String(row["Settlement To"] || "").trim();
      if (toName) allMembersSet.add(toName);

      transactions.push({
        date,
        type: "settlement",
        category: "Settlement",
        description,
        amount,
        currency,
        paidByName,
        toName,
      });
    } else if (type === "deposit") {
      transactions.push({
        date,
        type: "deposit",
        category: "Deposit",
        description,
        amount,
        currency,
        paidByName,
      });
    } else {
      const splitRaw = row["Split Among"] || "";
      let splitAmongNames = splitRaw
        .split(/[,;\n|]/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (splitAmongNames.length === 0) {
        splitAmongNames = [paidByName];
      }
      splitAmongNames.forEach((m) => allMembersSet.add(m));

      // Parse split details if percent
      const splitDetails = row["Split Details"] || "";
      let splitType = "equal";
      let splitShares = null;

      if (splitDetails && splitDetails.includes("%")) {
        splitType = "percent";
        splitShares = {};
        const pairs = splitDetails.split(";");
        for (const p of pairs) {
          const match = p.match(/(.+?):\s*(\d+)%/);
          if (match) {
            splitShares[match[1].trim()] = parseInt(match[2], 10);
          }
        }
      }

      transactions.push({
        date,
        type: "expense",
        category,
        description,
        amount,
        currency,
        paidByName,
        splitAmongNames,
        splitType,
        splitShares,
        receiptId: row["Receipt ID"] || null,
      });
    }
  }

  const sanitizedName = filename
    ? filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")
    : "Kasseo Import";

  return {
    transactions,
    members: Array.from(allMembersSet),
    defaultCurrency,
    groupName: sanitizedName,
    mode: "split",
  };
}

/**
 * Parses JSON backup payload (Kasseo or generic JSON)
 */
export function parseJSONData(jsonData, filename = "") {
  const allMembersSet = new Set();
  const transactions = [];
  let defaultCurrency = "USD";
  let groupName = "Imported Fund";
  let mode = "split";
  let customCategories = [];

  if (jsonData.group) {
    groupName = jsonData.group.name || groupName;
    defaultCurrency = jsonData.group.currency || defaultCurrency;
    mode = jsonData.group.mode || mode;
  }

  if (Array.isArray(jsonData.categories)) {
    customCategories = jsonData.categories;
  }

  // Create member lookup if Kasseo format
  const memberIdToName = {};
  if (Array.isArray(jsonData.members)) {
    jsonData.members.forEach((m) => {
      const name = m.displayName || m.nickname || m.name || m.id;
      if (m.id) memberIdToName[m.id] = name;
      allMembersSet.add(name);
    });
  }

  const rawTxList = Array.isArray(jsonData.transactions)
    ? jsonData.transactions
    : Array.isArray(jsonData)
      ? jsonData
      : [];

  for (const tx of rawTxList) {
    const date = normalizeDate(tx.date);
    const amount = parseAmount(tx.amount || tx.originalAmount);
    if (amount <= 0) continue;

    const currency = normalizeCurrency(tx.baseCurrency || tx.originalCurrency || tx.currency || defaultCurrency);
    if (currency) defaultCurrency = currency;

    const type = tx.type || "expense";
    const description = tx.description || "Expense";
    const category = normalizeCategory(tx.category);

    const paidByName = typeof tx.paidBy === "object"
      ? tx.paidBy.name || tx.paidBy.id || "User"
      : memberIdToName[tx.paidBy] || tx.paidByName || tx.paidBy || "User";

    allMembersSet.add(paidByName);

    if (type === "settlement") {
      const toName = typeof tx.to === "object"
        ? tx.to?.name || tx.to?.id || "Member"
        : memberIdToName[tx.to] || tx.toName || tx.to || "Member";

      allMembersSet.add(toName);

      transactions.push({
        date,
        type: "settlement",
        category: "Settlement",
        description,
        amount,
        currency,
        paidByName,
        toName,
      });
    } else if (type === "deposit") {
      transactions.push({
        date,
        type: "deposit",
        category: "Deposit",
        description,
        amount,
        currency,
        paidByName,
      });
    } else {
      let splitAmongNames = [];
      if (Array.isArray(tx.splitAmong)) {
        splitAmongNames = tx.splitAmong.map((idOrName) => memberIdToName[idOrName] || idOrName);
      } else if (typeof tx.splitAmong === "string") {
        splitAmongNames = tx.splitAmong.split(/[,;]/).map((s) => s.trim());
      }

      if (splitAmongNames.length === 0) {
        splitAmongNames = [paidByName];
      }
      splitAmongNames.forEach((m) => allMembersSet.add(m));

      let splitShares = null;
      if (tx.splitShares && typeof tx.splitShares === "object") {
        splitShares = {};
        for (const [k, v] of Object.entries(tx.splitShares)) {
          const name = memberIdToName[k] || k;
          splitShares[name] = v;
        }
      }

      transactions.push({
        date,
        type: "expense",
        category,
        description,
        amount,
        currency,
        paidByName,
        splitAmongNames,
        splitType: tx.splitType || (splitShares ? "percent" : "equal"),
        splitShares,
        receiptId: tx.receiptId || null,
        splitOption: tx.splitOption || null,
      });
    }
  }

  const sanitizedName = filename
    ? filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")
    : groupName;

  return {
    transactions,
    members: Array.from(allMembersSet),
    defaultCurrency,
    groupName: sanitizedName,
    mode,
    customCategories,
  };
}

/**
 * Universal entry point to parse any supported import file content
 */
export function parseImportFile(fileContent, filename = "") {
  const detection = detectImportFormat(fileContent, filename);

  let result;
  if (detection.format === "kasseo_json" || detection.format === "generic_json") {
    result = parseJSONData(detection.parsedData, filename);
  } else if (detection.format === "splitwise_csv") {
    result = parseSplitwiseCSV(detection.headers, detection.rows, filename);
  } else if (detection.format === "kasseo_csv") {
    result = parseKasseoCSV(detection.headers, detection.rows, filename);
  } else {
    result = parseSplitalCSV(detection.headers, detection.rows, filename);
  }

  return {
    ...result,
    detection,
  };
}

/**
 * Matches source member names to existing fund members using fuzzy/normalized name matching
 */
export function generateDefaultMemberMapping(sourceMemberNames = [], existingMembers = {}) {
  const mapping = {};
  const existingEntries = Object.entries(existingMembers).map(([uid, m]) => ({
    uid,
    name: (m.nickname || m.displayName || m.email || "").toLowerCase().trim(),
  }));

  for (const srcName of sourceMemberNames) {
    const srcLower = String(srcName).toLowerCase().trim();
    const matched = existingEntries.find(
      (e) => e.name && (e.name === srcLower || e.name.includes(srcLower) || srcLower.includes(e.name)),
    );

    mapping[srcName] = matched ? matched.uid : null;
  }

  return mapping;
}
