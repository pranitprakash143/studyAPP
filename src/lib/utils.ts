// src/lib/utils.ts

export const formatDisplayName = (name: string): string => {
  if (!name) return "";
  
  // 1. Decode URL encoded values
  let cleaned = decodeURIComponent(name);
  
  // 2. Remove common document file extensions
  cleaned = cleaned.replace(/\.(pdf|md|docx|txt|html|xlsx|json)$/i, "");
  
  // 3. Convert underscores, hyphens, and multiple dots to spaces
  cleaned = cleaned.replace(/[_\-\.]/g, " ");
  
  // 4. Handle camelCase strings by injecting spaces
  cleaned = cleaned.replace(/([a-z])([A-Z])/g, "$1 $2");
  
  // 5. Trim whitespace and capitalize words
  return cleaned
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b([a-z])/g, (_, char) => char.toUpperCase());
};
