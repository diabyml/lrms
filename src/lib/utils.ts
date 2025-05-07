import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function validateId(input: string) {
  if (!input || !/^0\d+$/.test(input)) {
    console.error(
      "Error: Please enter 0 followed by a number as ID (e.g., 01, 02, 010)."
    );
    return false;
  }
  console.log("Valid ID:", input);
  return true;
}

export function generateId(x: string) {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0"); // 'a'
  const month = String(today.getMonth() + 1).padStart(2, "0"); // 'b' (0-indexed)
  const year = String(today.getFullYear()).slice(-2); // 'c'

  return `${x}-${day}-${month}${year}`;
}

export function validateIdOnEdit(original: string, updated: string) {
  const originalParts = original.split("-");
  const updatedParts = updated.split("-");

  // Check that both strings have at least 2 hyphen-separated parts
  if (originalParts.length < 2 || updatedParts.length < 2) {
    console.error(
      "Error: Invalid format. Expected format like 'ID-day-monthYear'"
    );
    return false;
  }

  // Compare the parts after the first hyphen
  const originalRest = originalParts.slice(1).join("-");
  const updatedRest = updatedParts.slice(1).join("-");

  if (originalRest !== updatedRest) {
    console.error(
      "Error: Only the ID (before the first hyphen) can be changed."
    );
    return false;
  }

  console.log("Only ID was changed.");
  return true;
}

export function extractId(input: string): string {
  const index = input.indexOf("#");
  if (index === -1) {
    return input; // Return the whole string if no '#' is found
  }
  return input.substring(0, index);
}

// Example usage:
// console.log(extractId("abc#123")); // Output: "abc"
// console.log(extractId("no-hash")); // Output: "no-hash"

export function extractTestTypeName(input: string): string {
  const index = input.indexOf("#");
  if (index === -1) {
    return input; // Return the whole string if no '#' is found
  }
  return input.substring(0, index);
}
