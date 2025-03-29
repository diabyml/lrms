// // src/utils/rangeChecker.ts (Create a new utility file or place within the component)

// /**
//  * Checks if a numeric value is outside a given reference range string.
//  * Handles formats like: "A - B", "< A", "> A", "A".
//  * Returns true if out of range, false if within range or comparison is not possible.
//  */
// export function isValueOutOfRange(
//   valueStr: string | null | undefined,
//   rangeStr: string | null | undefined
// ): boolean {
//   if (
//     valueStr === null ||
//     valueStr === undefined ||
//     rangeStr === null ||
//     rangeStr === undefined
//   ) {
//     return false; // Cannot compare if value or range is missing
//   }

//   // Attempt to convert value to a number. Handle non-numeric gracefully.
//   const numericValue = parseFloat(valueStr.replace(",", ".")); // Handle comma decimal separator
//   if (isNaN(numericValue)) {
//     return false; // Value is not numeric, cannot compare range
//   }

//   const cleanedRange = rangeStr.trim();

//   try {
//     // Case 1: Simple equality range (e.g., "Negative", "Positive") - Assume these are always "in range" for highlighting purposes
//     // Or handle specific string matches if needed. For now, we focus on numeric.
//     if (
//       isNaN(parseFloat(cleanedRange.charAt(0))) &&
//       !["<", ">"].includes(cleanedRange.charAt(0))
//     ) {
//       return false; // If range starts with non-numeric char (not < or >), assume non-numeric range like "Positive"
//     }

//     // Case 2: Less than (e.g., "< 100", "<100")
//     if (cleanedRange.startsWith("<")) {
//       const limit = parseFloat(
//         cleanedRange.substring(1).trim().replace(",", ".")
//       );
//       if (!isNaN(limit)) {
//         return numericValue >= limit; // Out of range if value is >= limit
//       }
//     }

//     // Case 3: Greater than (e.g., "> 40", ">40")
//     else if (cleanedRange.startsWith(">")) {
//       const limit = parseFloat(
//         cleanedRange.substring(1).trim().replace(",", ".")
//       );
//       if (!isNaN(limit)) {
//         return numericValue <= limit; // Out of range if value is <= limit
//       }
//     }

//     // Case 4: Range (e.g., "10.5 - 20.0", "10.5-20.0")
//     else if (cleanedRange.includes("-")) {
//       const parts = cleanedRange
//         .split("-")
//         .map((part) => parseFloat(part.trim().replace(",", ".")));
//       if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
//         const lowerBound = Math.min(parts[0], parts[1]);
//         const upperBound = Math.max(parts[0], parts[1]);
//         return numericValue < lowerBound || numericValue > upperBound; // Out of range if outside bounds
//       }
//     }

//     // Case 5: Single value exact match (less common for numeric ranges, but possible)
//     // Treat as always in range unless specific logic is needed
//     // const exactValue = parseFloat(cleanedRange.replace(',', '.'));
//     // if (!isNaN(exactValue)) {
//     //     return numericValue !== exactValue; // Out of range if not equal
//     // }
//   } catch (e) {
//     console.error("Error parsing range string:", rangeStr, e);
//     return false; // Error during parsing, treat as in-range
//   }

//   // If range format wasn't recognized or value couldn't be compared
//   return false;
// }



// src/utils/rangeChecker.ts

// Define possible outcomes
export type RangeCheckStatus = 'in-range' | 'out-of-range' | 'indeterminate';

/**
 * Checks if a numeric value is outside a given reference range string.
 * Handles formats like: "A - B", "< A", "> A".
 * Returns 'in-range', 'out-of-range', or 'indeterminate'.
 */
export function checkValueRangeStatus( // Renamed for clarity
    valueStr: string | null | undefined,
    rangeStr: string | null | undefined
): RangeCheckStatus {
    if (valueStr === null || valueStr === undefined || rangeStr === null || rangeStr === undefined || rangeStr.trim() === '') {
        return 'indeterminate'; // Cannot compare if value or range is missing/empty
    }

    const numericValue = parseFloat(valueStr.replace(',', '.'));
    if (isNaN(numericValue)) {
        // Value is not numeric. If range looks numeric, it's indeterminate.
        // If range is also non-numeric (e.g., "Negative"), assume 'in-range' or handle specific string logic.
        const firstRangeChar = rangeStr.trim().charAt(0);
         if (!isNaN(parseFloat(firstRangeChar)) || ['<', '>'].includes(firstRangeChar)) {
             return 'indeterminate'; // Numeric range, non-numeric value
         } else {
             // Non-numeric range (like "Positive", "Negative"). Simple check: is value exactly the range?
             // This might need more complex logic depending on requirements.
             // For now, assume non-exact match is 'indeterminate' unless specific logic added.
             return valueStr.trim().toLowerCase() === rangeStr.trim().toLowerCase() ? 'in-range' : 'indeterminate';
         }
    }

    const cleanedRange = rangeStr.trim();

    try {
        // Case 1: Non-numeric range start (excluding <, >) -> Indeterminate for numeric value
        if (isNaN(parseFloat(cleanedRange.charAt(0))) && !['<', '>'].includes(cleanedRange.charAt(0))) {
             return 'indeterminate'; // e.g., Range="Positive", Value=50
        }

        // Case 2: Less than (e.g., "< 100")
        if (cleanedRange.startsWith('<')) {
            const limit = parseFloat(cleanedRange.substring(1).trim().replace(',', '.'));
            if (!isNaN(limit)) {
                return numericValue < limit ? 'in-range' : 'out-of-range';
            }
        }

        // Case 3: Greater than (e.g., "> 40")
        else if (cleanedRange.startsWith('>')) {
            const limit = parseFloat(cleanedRange.substring(1).trim().replace(',', '.'));
            if (!isNaN(limit)) {
                return numericValue > limit ? 'in-range' : 'out-of-range';
            }
        }

        // Case 4: Range (e.g., "10.5 - 20.0")
        else if (cleanedRange.includes('-')) {
            const parts = cleanedRange.split('-').map(part => parseFloat(part.trim().replace(',', '.')));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                const lowerBound = Math.min(parts[0], parts[1]);
                const upperBound = Math.max(parts[0], parts[1]);
                return (numericValue >= lowerBound && numericValue <= upperBound) ? 'in-range' : 'out-of-range';
            }
        }

        // Case 5: Single numeric value (e.g., "0") - Less common for range
         const exactValue = parseFloat(cleanedRange.replace(',', '.'));
         if (!isNaN(exactValue)) {
             // Decide if only exact match is in-range, or if it acts like <= or >=
             // Let's assume exact match IS the range boundary for now
             // If you want ONLY exact match to be in range: return numericValue === exactValue ? 'in-range' : 'out-of-range';
             // For now, treat single number range as indeterminate unless specified otherwise
             return 'indeterminate';
         }


    } catch (e) {
        console.error("Error parsing range string:", rangeStr, e);
        return 'indeterminate'; // Error during parsing
    }

    // If range format wasn't recognized or value couldn't be compared
    return 'indeterminate';
}
