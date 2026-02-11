import * as XLSX from "xlsx";

export function generateXlsx(
  data: Record<string, unknown>[],
  sheetName = "Users"
): Buffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return buffer as Buffer;
}
