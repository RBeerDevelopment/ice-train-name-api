import { readdir, readFile } from "fs/promises";
import { join } from "path";

interface TrainRecord {
  classId: string;
  tz: string;
  comment?: string;
  name: string;
  nameSince: string;
  nameUntil?: string;
  isActive: boolean;
}

// Helper function to extract Tz number from the first column
function extractTzNumber(value: string): string {
  if (!value) return "";
  const match = value.match(/Tz\s*(\d+[a-z]*)/i);
  return match ? match[1] : "";
}

interface NameWithDates {
  name: string;
  nameSince?: string;
  nameUntil?: string;
}

// Helper function to extract multiple names with their date ranges from the first column
function extractNamesWithDates(value: string): NameWithDates[] {
  if (!value) return [];
  
  const tz = extractTzNumber(value);
  if (!tz) return [];
  
  // Split by newlines
  const lines = value.split(/\n/).map(l => l.trim()).filter(l => l);
  
  const names: NameWithDates[] = [];
  let currentName: NameWithDates | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip Tz line
    if (/^Tz\s*\d+/i.test(line)) {
      continue;
    }
    
    // Check if line contains a date range in parentheses
    const dateRangeMatch = line.match(/\(([^)]+)\)/);
    
    if (dateRangeMatch) {
      const dateRange = dateRangeMatch[1];
      
      // Parse "von DD.MM.YYYY bis DD.MM.YYYY" or "seit DD.MM.YYYY"
      // Also handle German month names: "von DD. Month YYYY bis DD. Month YYYY"
      const vonBisMatch = dateRange.match(/von\s+([^b]+?)\s+bis\s+(.+)/i);
      const seitMatch = dateRange.match(/seit\s+(.+)/i);
      
      if (vonBisMatch) {
        // Date range: von ... bis ...
        const sinceDate = normalizeDate(vonBisMatch[1].trim());
        const untilDate = normalizeDate(vonBisMatch[2].trim());
        
        if (currentName) {
          // We have a pending name, assign dates to it
          currentName.nameSince = sinceDate || vonBisMatch[1].trim();
          currentName.nameUntil = untilDate || vonBisMatch[2].trim();
          names.push(currentName);
          currentName = null;
        } else {
          // Date range without current name - check previous line for name
          if (i > 0 && lines[i - 1] && !/^Tz\s*\d+/i.test(lines[i - 1]) && !lines[i - 1].includes("(")) {
            const name = lines[i - 1].trim();
            names.push({
              name,
              nameSince: sinceDate || vonBisMatch[1].trim(),
              nameUntil: untilDate || vonBisMatch[2].trim(),
            });
          }
        }
      } else if (seitMatch) {
        // "seit" means active from this date
        const sinceDate = normalizeDate(seitMatch[1].trim());
        
        if (currentName) {
          // We have a pending name, assign date to it
          currentName.nameSince = sinceDate || seitMatch[1].trim();
          // nameUntil remains undefined (active)
          names.push(currentName);
          currentName = null;
        } else {
          // Check previous line for name
          if (i > 0 && lines[i - 1] && !/^Tz\s*\d+/i.test(lines[i - 1]) && !lines[i - 1].includes("(")) {
            const name = lines[i - 1].trim();
            names.push({
              name,
              nameSince: sinceDate || seitMatch[1].trim(),
            });
          }
        }
      }
    } else {
      // This is likely a name line (no parentheses)
      // If we have a pending name without dates, save it first
      if (currentName && currentName.name) {
        names.push(currentName);
      }
      
      // Start a new name
      const cleanName = line.replace(/\([^)]*\)/g, "").trim();
      if (cleanName) {
        currentName = { name: cleanName };
      }
    }
  }
  
  // Add the last name if exists
  if (currentName && currentName.name) {
    names.push(currentName);
  }
  
  // If no names found, try to extract a single name (fallback to old method)
  if (names.length === 0) {
    let name = value
      .replace(/Tz\s*\d+[a-z]*/i, "")
      .replace(/\([^)]*\)/g, "")
      .trim();
    name = name.replace(/^\||\|$/g, "").trim();
    name = name.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
    
    if (name) {
      return [{ name }];
    }
    // Last resort: use Tz number
    return [{ name: `Tz ${tz}` }];
  }
  
  return names;
}

// Helper function to extract name from the first column (legacy, for single name)
function extractName(value: string): string {
  const names = extractNamesWithDates(value);
  if (names.length > 0) {
    return names[0].name;
  }
  return "";
}

// Month names in German
const monthMap: Record<string, string> = {
  "januar": "01", "january": "01",
  "februar": "02", "february": "02",
  "märz": "03", "march": "03", "mär": "03",
  "april": "04",
  "mai": "05", "may": "05",
  "juni": "06", "june": "06",
  "juli": "07", "july": "07",
  "august": "08",
  "september": "09", "sep": "09",
  "oktober": "10", "october": "10", "okt": "10",
  "november": "11", "nov": "11",
  "dezember": "12", "december": "12", "dez": "12"
};

// Helper function to convert German date format to DD.MM.YYYY
function normalizeDate(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  
  // Try DD.MM.YYYY format first
  const ddmmyyyy = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    return `${day}.${month}.${ddmmyyyy[3]}`;
  }
  
  // Try DD. Month YYYY format (German)
  const dMonthYyyy = dateStr.match(/(\d{1,2})\.\s*([a-zäöü]+)\s+(\d{4})/i);
  if (dMonthYyyy) {
    const day = dMonthYyyy[1].padStart(2, "0");
    const monthName = dMonthYyyy[2].toLowerCase();
    const month = monthMap[monthName];
    if (month) {
      return `${day}.${month}.${dMonthYyyy[3]}`;
    }
  }
  
  return undefined;
}

// Helper function to extract date from a date field
function extractDate(value: string, isUntil: boolean = false): string | undefined {
  if (!value || value.trim() === "") return undefined;
  
  // Split by newlines and get the relevant date
  const lines = value.split(/\n/).map(l => l.trim()).filter(l => l);
  
  if (isUntil) {
    // For nameUntil, look for the last date or keywords like "Ausmusterung", "Verschrottung"
    // Check if there's a date after keywords
    const lastLine = lines[lines.length - 1];
    if (lastLine) {
      const normalized = normalizeDate(lastLine);
      if (normalized) return normalized;
    }
    // Check for keywords indicating decommissioning
    if (value.toLowerCase().includes("ausmusterung") || 
        value.toLowerCase().includes("verschrottung") ||
        value.toLowerCase().includes("außerbetriebnahme") ||
        value.toLowerCase().includes("außerbetriebsetzung")) {
      // Try to find a date near these keywords
      // Look for "ausgemustert DD. Month YYYY" or similar
      const datePatterns = [
        /(?:ausgemustert|verschrottet|außerbetrieb)\s+(\d{1,2}\.\s*[a-zäöü]+\s+\d{4})/i,
        /(\d{1,2}\.\d{2}\.\d{4})/,
        /(\d{1,2}\.\s*[a-zäöü]+\s+\d{4})/i
      ];
      
      for (const pattern of datePatterns) {
        const match = value.match(pattern);
        if (match) {
          const normalized = normalizeDate(match[1]);
          if (normalized) return normalized;
        }
      }
    }
    return undefined;
  } else {
    // For nameSince, get the first date
    const firstLine = lines[0];
    if (firstLine) {
      const normalized = normalizeDate(firstLine);
      if (normalized) return normalized;
    }
    // Try to find any date in the value
    const datePatterns = [
      /(\d{1,2}\.\d{2}\.\d{4})/,
      /(\d{1,2}\.\s*[a-zäöü]+\s+\d{4})/i
    ];
    
    for (const pattern of datePatterns) {
      const match = value.match(pattern);
      if (match) {
        const normalized = normalizeDate(match[1]);
        if (normalized) return normalized;
      }
    }
    return undefined;
  }
}

// Helper function to find column index by possible names
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const index = headers.findIndex(h => 
      h.toLowerCase().includes(name.toLowerCase())
    );
    if (index !== -1) return index;
  }
  return -1;
}

// Parse a CSV file with multi-line entries
function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];
    const nextChar = i + 1 < content.length ? content[i + 1] : null;

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (!inQuotes && char === ',') {
      currentRow.push(currentField.trim());
      currentField = "";
      i++;
      continue;
    }

    if (!inQuotes && char === '\n') {
      // Row break only when not in quotes
      currentRow.push(currentField.trim());
      if (currentRow.length > 0 && currentRow.some(f => f !== "")) {
        rows.push([...currentRow]);
      }
      currentRow = [];
      currentField = "";
      i++;
      // Skip \r if present
      if (nextChar === '\r') i++;
      continue;
    }

    if (!inQuotes && char === '\r' && nextChar === '\n') {
      // Handle \r\n
      currentRow.push(currentField.trim());
      if (currentRow.length > 0 && currentRow.some(f => f !== "")) {
        rows.push([...currentRow]);
      }
      currentRow = [];
      currentField = "";
      i += 2;
      continue;
    }

    currentField += char;
    i++;
  }

  // Add the last field and row
  if (currentField.trim() || currentRow.length > 0) {
    currentRow.push(currentField.trim());
  }
  if (currentRow.length > 0 && currentRow.some(f => f !== "")) {
    rows.push(currentRow);
  }

  return rows;
}

// Process a single CSV file
async function processCSVFile(filePath: string, classId: string): Promise<TrainRecord[]> {
  const content = await readFile(filePath, "utf-8");
  const rows = parseCSV(content);
  
  if (rows.length < 2) {
    console.warn(`File ${filePath} has insufficient rows`);
    return [];
  }

  // First few rows might be headers - find the actual header row
  // Headers typically contain column names
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    const headerText = row.join(" ").toLowerCase();
    if (headerText.includes("triebzug") || headerText.includes("zugnummer") || 
        headerText.includes("name") || headerText.includes("abnahme") ||
        headerText.includes("indienststellung")) {
      headerRowIndex = i;
      break;
    }
  }

  const headerRow = rows[headerRowIndex];
  const dataRows = rows.slice(headerRowIndex + 1);

  // Find column indices
  const firstColIndex = 0; // First column always contains Tz and possibly Name
  const tzNameColIndex = 0;
  
  const nameSinceColIndex = findColumnIndex(headerRow, [
    "abnahme", "indienststellung"
  ]);
  
  const nameUntilColIndex = findColumnIndex(headerRow, [
    "ausmusterung", "verschrottung", "außerbetriebnahme", "außerbetriebsetzung"
  ]);
  
  const commentColIndex = findColumnIndex(headerRow, [
    "bemerkung", "unfälle", "allgemeine bemerkungen", "besondere vorkommnisse"
  ]);

  const records: TrainRecord[] = [];

  // Process data rows
  for (const row of dataRows) {
    if (row.length === 0 || !row[0] || row[0].trim() === "") continue;

    const firstCol = row[tzNameColIndex] || "";
    const tz = extractTzNumber(firstCol);

    if (!tz) {
      // Skip rows without valid Tz
      continue;
    }

    // Extract all names with their date ranges from the first column
    const namesWithDates = extractNamesWithDates(firstCol);

    // Get the main date columns (used as fallback)
    const mainNameSince = nameSinceColIndex !== -1 && row[nameSinceColIndex]
      ? extractDate(row[nameSinceColIndex], false) || ""
      : "";

    const mainNameUntil = nameUntilColIndex !== -1 && row[nameUntilColIndex]
      ? extractDate(row[nameUntilColIndex], true)
      : undefined;

    const comment = commentColIndex !== -1 && row[commentColIndex]
      ? row[commentColIndex].trim()
      : undefined;

    // Clean up comment - remove newlines and extra spaces
    const cleanComment = comment
      ? comment.replace(/\n+/g, " ").replace(/\s+/g, " ").trim()
      : undefined;

    // If no names found, create a single record with fallback
    if (namesWithDates.length === 0) {
      records.push({
        classId,
        tz,
        name: `Tz ${tz}`,
        nameSince: mainNameSince || "",
        nameUntil: mainNameUntil,
        isActive: !mainNameUntil,
        comment: cleanComment,
      });
      continue;
    }

    // Create a record for each name
    for (const nameData of namesWithDates) {
      // Use dates from the name's date range if available, otherwise use main dates
      // If the date from parentheses is incomplete (just a year), prefer main date
      let nameSince = nameData.nameSince || mainNameSince || "";
      let nameUntil = nameData.nameUntil !== undefined ? nameData.nameUntil : mainNameUntil;
      
      // If nameUntil from parentheses is just a year (4 digits), use main date instead
      if (nameUntil && /^\d{4}$/.test(nameUntil.trim())) {
        nameUntil = mainNameUntil;
      }
      
      // If nameSince from parentheses is just a year, use main date instead
      if (nameSince && /^\d{4}$/.test(nameSince.trim())) {
        nameSince = mainNameSince || "";
      }

      records.push({
        classId,
        tz,
        name: nameData.name,
        nameSince,
        nameUntil,
        isActive: !nameUntil,
        comment: cleanComment,
      });
    }
  }

  return records;
}

// Main function
async function main() {
  const rawDir = join(process.cwd(), "src/db/seed/raw");
  const files = await readdir(rawDir);
  const csvFiles = files.filter(f => f.endsWith(".csv"));

  const allRecords: TrainRecord[] = [];

  for (const file of csvFiles) {
    const classId = file.replace(".csv", "").replace(/^br-/, "");
    const filePath = join(rawDir, file);
    
    console.log(`Processing ${file}...`);
    try {
      const records = await processCSVFile(filePath, classId);
      allRecords.push(...records);
      console.log(`  Extracted ${records.length} records`);
    } catch (error) {
      console.error(`  Error processing ${file}:`, error);
    }
  }

  // Write output JSON file
  const outputPath = join(process.cwd(), "src/db/seed/trains.json");
  await Bun.write(outputPath, JSON.stringify(allRecords, null, 2));
  
  console.log(`\nTotal records: ${allRecords.length}`);
  console.log(`Output written to: ${outputPath}`);
}

main().catch(console.error);

