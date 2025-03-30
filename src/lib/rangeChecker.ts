// // Define possible outcomes
// export type RangeCheckStatus = "in-range" | "out-of-range" | "indeterminate";

// /**
//  * Checks if a numeric value is outside a given reference range string.
//  * Handles formats like: "A - B", "< A", "> A".
//  * Returns 'in-range', 'out-of-range', or 'indeterminate'.
//  */
// export function checkValueRangeStatus( // Renamed for clarity
//   valueStr: string | null | undefined,
//   rangeStr: string | null | undefined
// ): RangeCheckStatus {
//   if (
//     valueStr === null ||
//     valueStr === undefined ||
//     rangeStr === null ||
//     rangeStr === undefined ||
//     rangeStr.trim() === ""
//   ) {
//     return "indeterminate"; // Cannot compare if value or range is missing/empty
//   }

//   const numericValue = parseFloat(valueStr.replace(",", "."));

//   //   let cleanedRange = rangeStr.trim();

//   // --- Check for multi-line or conditional formats FIRST ---
//   if (rangeStr.trim().includes("\n")) {
//     return "indeterminate"; // Contains newlines -> Treat as complex/multi-range
//   }
//   // Basic check for a condition pattern (e.g., "Text:")
//   const conditionMatch = rangeStr.trim().match(/^([a-zA-Z\s]+):\s*(.*)$/);
//   if (conditionMatch) {
//     return "indeterminate"; // Contains a text condition -> Treat as complex
//   }
//   // Basic check for age condition pattern (e.g., "<12y", ">=18a") - adjust regex if needed
//   const ageConditionMatch = rangeStr
//     .trim()
//     .match(/^(<|>|<=|>=)\s*\d+\s*(y|a|ans?)/i);
//   if (ageConditionMatch) {
//     return "indeterminate"; // Contains an age condition -> Treat as complex
//   }
//   // --- End Multi-line/Conditional Check ---

//   //   -----------------------------------------------------
//   // --- Handle Specific Multi-Condition Format: "Label1: Range1; Label2: Range2" ---

//   // ---------------------------------------------------

//   if (isNaN(numericValue)) {
//     // Value is not numeric. If range looks numeric, it's indeterminate.
//     // If range is also non-numeric (e.g., "Negative"), assume 'in-range' or handle specific string logic.
//     const firstRangeChar = rangeStr.trim().charAt(0);
//     if (
//       !isNaN(parseFloat(firstRangeChar)) ||
//       ["<", ">"].includes(firstRangeChar)
//     ) {
//       return "indeterminate"; // Numeric range, non-numeric value
//     } else {
//       // Non-numeric range (like "Positive", "Negative"). Simple check: is value exactly the range?
//       // This might need more complex logic depending on requirements.
//       // For now, assume non-exact match is 'indeterminate' unless specific logic added.
//       return valueStr.trim().toLowerCase() === rangeStr.trim().toLowerCase()
//         ? "in-range"
//         : "indeterminate";
//     }
//   }

//   const cleanedRange = rangeStr.trim();

//   try {
//     // Case 1: Non-numeric range start (excluding <, >) -> Indeterminate for numeric value
//     if (
//       isNaN(parseFloat(cleanedRange.charAt(0))) &&
//       !["<", ">"].includes(cleanedRange.charAt(0))
//     ) {
//       return "indeterminate"; // e.g., Range="Positive", Value=50
//     }

//     // Case 2: Less than (e.g., "< 100")
//     if (cleanedRange.startsWith("<")) {
//       const limit = parseFloat(
//         cleanedRange.substring(1).trim().replace(",", ".")
//       );
//       if (!isNaN(limit)) {
//         return numericValue < limit ? "in-range" : "out-of-range";
//       }
//     }

//     // Case 3: Greater than (e.g., "> 40")
//     else if (cleanedRange.startsWith(">")) {
//       const limit = parseFloat(
//         cleanedRange.substring(1).trim().replace(",", ".")
//       );
//       if (!isNaN(limit)) {
//         return numericValue > limit ? "in-range" : "out-of-range";
//       }
//     }

//     // Case 4: Range (e.g., "10.5 - 20.0")
//     else if (cleanedRange.includes("-")) {
//       const parts = cleanedRange
//         .split("-")
//         .map((part) => parseFloat(part.trim().replace(",", ".")));
//       if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
//         const lowerBound = Math.min(parts[0], parts[1]);
//         const upperBound = Math.max(parts[0], parts[1]);
//         return numericValue >= lowerBound && numericValue <= upperBound
//           ? "in-range"
//           : "out-of-range";
//       }
//     }

//     // Case 5: Single numeric value (e.g., "0") - Less common for range
//     const exactValue = parseFloat(cleanedRange.replace(",", "."));
//     if (!isNaN(exactValue)) {
//       // Decide if only exact match is in-range, or if it acts like <= or >=
//       // Let's assume exact match IS the range boundary for now
//       // If you want ONLY exact match to be in range: return numericValue === exactValue ? 'in-range' : 'out-of-range';
//       // For now, treat single number range as indeterminate unless specified otherwise
//       return "indeterminate";
//     }
//   } catch (e) {
//     console.error("Error parsing range string:", rangeStr, e);
//     return "indeterminate"; // Error during parsing
//   }

//   // If range format wasn't recognized or value couldn't be compared
//   return "indeterminate";
// }

// ##########################################################################################

// Define possible outcomes
export type RangeCheckStatus = "in-range" | "out-of-range" | "indeterminate";

// ==================================================
// START: Copy or define your checkSingleRangeLine helper function here
// (Make sure it handles <, >, <=, >=, X-Y and returns RangeCheckStatus)
// ==================================================
function checkSingleRangeLine(
  valueNum: number,
  rangeLine: string
): RangeCheckStatus {
  const cleanedRange = rangeLine.trim();
  try {
    // Less than "< X"
    if (cleanedRange.startsWith("<") && !cleanedRange.startsWith("<=")) {
      const limit = parseFloat(
        cleanedRange.substring(1).trim().replace(",", ".")
      );
      if (!isNaN(limit)) {
        return valueNum < limit ? "in-range" : "out-of-range";
      }
    }
    // Greater than "> X"
    else if (cleanedRange.startsWith(">") && !cleanedRange.startsWith(">=")) {
      const limit = parseFloat(
        cleanedRange.substring(1).trim().replace(",", ".")
      );
      if (!isNaN(limit)) {
        return valueNum > limit ? "in-range" : "out-of-range";
      }
    }
    // Less than or equal "<= X"
    else if (cleanedRange.startsWith("<=") || cleanedRange.startsWith("≤")) {
      const limit = parseFloat(
        cleanedRange.substring(2).trim().replace(",", ".")
      );
      if (!isNaN(limit)) {
        return valueNum <= limit ? "in-range" : "out-of-range";
      }
    }
    // Greater than or equal ">= X"
    else if (cleanedRange.startsWith(">=") || cleanedRange.startsWith("≥")) {
      const limit = parseFloat(
        cleanedRange.substring(2).trim().replace(",", ".")
      );
      if (!isNaN(limit)) {
        return valueNum >= limit ? "in-range" : "out-of-range";
      }
    }
    // Range "X - Y"
    else if (cleanedRange.includes("-")) {
      const parts = cleanedRange
        .split("-")
        .map((part) => parseFloat(part.trim().replace(",", ".")));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const lower = Math.min(parts[0], parts[1]);
        const upper = Math.max(parts[0], parts[1]);
        return valueNum >= lower && valueNum <= upper
          ? "in-range"
          : "out-of-range";
      }
    }
    // Single numeric value (Treat as indeterminate for now)
    const exactValue = parseFloat(cleanedRange.replace(",", "."));
    if (!isNaN(exactValue)) {
      return "indeterminate";
    }
  } catch (e) {
    console.error("Error parsing single range line:", rangeLine, e);
  }
  return "indeterminate"; // Format not recognized or error
}
// ==================================================
// END: checkSingleRangeLine helper function
// ==================================================

/**
 * Checks if a numeric value is outside a given reference range string.
 * Handles formats like: "A - B", "< A", "> A", and "Label1: Range1; Label2: Range2".
 * Returns 'in-range', 'out-of-range', or 'indeterminate'.
 */
export function checkValueRangeStatus(
  valueStr: string | null | undefined,
  rangeStr: string | null | undefined
): RangeCheckStatus {
  if (
    valueStr === null ||
    valueStr === undefined ||
    rangeStr === null ||
    rangeStr === undefined ||
    rangeStr.trim() === ""
  ) {
    return "indeterminate"; // Cannot compare if value or range is missing/empty
  }

  //   SOME EDGE CASES
  if (rangeStr.trim() === "-") {
    switch (valueStr.trim().toLocaleLowerCase()) {
      case "0 negatif":
      case "0 négatif":
      case "negatif":
      case "négatif":
      case "neant":
      case "néant":
      case "0":
        return "in-range";
    }

    // if valueStr is a number return out-of-range
    if (!isNaN(parseFloat(valueStr))) {
      return "out-of-range";
    }
  }

  // --- Get values ready ---
  const numericValue = parseFloat(valueStr.replace(",", "."));
  const cleanedRange = rangeStr.trim(); // Use cleanedRange consistently
  const lowerValueStr = valueStr.trim().toLowerCase();
  const isNumericInput = !isNaN(numericValue);

  // --- Early checks for formats we definitely treat as indeterminate ---
  if (cleanedRange.includes("Homme") || cleanedRange.includes("HOMME")) {
    return "indeterminate"; // Contains newlines -> Treat as complex/multi-range
  }
  const ageConditionMatch = cleanedRange.match(
    /^(<|>|<=|>=)\s*\d+\s*(y|a|ans?)/i
  );
  if (ageConditionMatch) {
    return "indeterminate"; // Contains an age condition -> Treat as complex
  }
  // General text condition check (e.g., "Male: ...")
  const generalConditionMatch = cleanedRange.match(
    /^([a-zA-Z\s][a-zA-Z\s\d]*):\s*(.*)$/
  );
  const isSpecificMultiFormat =
    cleanedRange.includes(":") && cleanedRange.includes(";"); // Is it the specific format we handle below?

  if (generalConditionMatch && !isSpecificMultiFormat) {
    // It looks like a condition, but not the specific "Label: Range; Label: Range" one
    return "indeterminate";
  }
  // --- End Early Indeterminate Checks ---

  // --- START: Handle Specific "NEGATIF: Range1; POSITIF: Range2" Format ---
  const isSpecificNegPosFormat =
    cleanedRange.toLowerCase().includes("negatif:") &&
    cleanedRange.toLowerCase().includes("positif:") &&
    cleanedRange.includes(";");

  if (isSpecificNegPosFormat) {
    const conditions = cleanedRange
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    let negatifRangeSegment: string | null = null;
    let positifRangeSegment: string | null = null;

    // 1. Extract the specific ranges for NEGATIF and POSITIF
    for (const conditionPart of conditions) {
      const match = conditionPart.match(/^(.+?):\s*(.*)$/);
      if (match) {
        const label = match[1].trim().toLowerCase();
        const rangeSegment = match[2].trim();
        if (label === "negatif") {
          negatifRangeSegment = rangeSegment;
        } else if (label === "positif") {
          positifRangeSegment = rangeSegment;
        }
      } else {
        // Malformed segment within the expected format
        return "indeterminate";
      }
    }

    // If we didn't find both required segments, the format is invalid/incomplete
    if (!negatifRangeSegment || !positifRangeSegment) {
      console.warn(
        "NEGATIF/POSITIF format detected, but couldn't extract both range segments."
      );
      return "indeterminate";
    }

    // 2. Check direct label matches first (These define 'in-range' or 'out-of-range' directly)
    if (lowerValueStr === "negatif") {
      return "in-range"; // Input "NEGATIF" means in-range per rule 1
    }
    if (lowerValueStr === "positif") {
      return "out-of-range"; // Input "POSITIF" means out-of-range per rule 2
    }

    // 3. If input value is numeric, apply the specific range checks
    if (isNumericInput) {
      // Check against NEGATIF range (Rule 1)
      const statusNegatif = checkSingleRangeLine(
        numericValue,
        negatifRangeSegment
      );
      if (statusNegatif === "in-range") {
        return "in-range"; // If it meets NEGATIF criteria, it's in-range
      }

      // Check against POSITIF range (Rule 2)
      const statusPositif = checkSingleRangeLine(
        numericValue,
        positifRangeSegment
      );
      if (statusPositif === "in-range") {
        // NOTE: checkSingleRangeLine returns 'in-range' if "> 1" is met
        return "out-of-range"; // If it meets POSITIF criteria, it's out-of-range
      }

      // If it didn't meet Negatif criteria and didn't meet Positif criteria numerically
      return "indeterminate"; // Or should this be out-of-range too? Let's stick to indeterminate for now.
    } else {
      // Value is NOT numeric, and did NOT match "negatif" or "positif" labels exactly
      return "indeterminate";
    }
  }
  // --- END: Handle Specific "NEGATIF: Range1; POSITIF: Range2" Format ---

  // Handle cases where the VALUE is non-numeric
  if (!isNumericInput) {
    // Replaced isNaN(numericValue) check for clarity
    // Check if the RANGE looks like simple non-numeric text
    if (
      isNaN(parseFloat(cleanedRange.charAt(0))) &&
      !["<", ">", "-"].some((op) => cleanedRange.includes(op))
    ) {
      // Compare non-numeric value to non-numeric range (case-insensitive)
      return lowerValueStr === cleanedRange.toLowerCase()
        ? "in-range"
        : "out-of-range";
    } else {
      // Value is non-numeric, but range looks numeric -> indeterminate
      return "indeterminate";
    }
  }

  // If value IS numeric, proceed with simple numeric range parsing using the helper
  try {
    // Call the helper function which handles "<", ">", "<=", ">=", "X-Y"
    return checkSingleRangeLine(numericValue, cleanedRange);
  } catch (e) {
    console.error("Error parsing simple range string:", cleanedRange, e);
    return "indeterminate"; // Error during parsing
  }

  // This part should ideally not be reached if checkSingleRangeLine covers all simple cases or returns indeterminate
  // return "indeterminate";
}
