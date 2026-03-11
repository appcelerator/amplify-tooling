import { writeFileSync } from "fs-extra";

export const writeToFile = (path: string, data: any): void => {
  try {
    writeFileSync(path, data);
  } catch (e) {
    // if parser is failing, rethrow with our own error
    throw new Error(`Error while writing the yaml file to: ${path}`);
  }
};

/**
 * Checks if the passed item can be converted to a JSON or is a valid JSON object.
 * @param item item to check
 * @returns true if the item can be converted, false otherwise.
 */
export const isValidJson = (item: any) => {
  let parsedItem = typeof item !== "string" ? JSON.stringify(item) : item;
  try {
    parsedItem = JSON.parse(parsedItem);
  } catch (e) {
    return false;
  }
  return typeof parsedItem === "object" && item !== null;
};
