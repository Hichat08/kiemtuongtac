export type AdminCsvValue = string | number | boolean | null | undefined;

export interface AdminCsvColumn<Row> {
  header: string;
  value: (row: Row) => AdminCsvValue;
}

const normalizeCsvValue = (value: AdminCsvValue) => `${value ?? ""}`;

const escapeCsvValue = (value: AdminCsvValue) => {
  const normalizedValue = normalizeCsvValue(value);

  if (/[",\n]/.test(normalizedValue)) {
    return `"${normalizedValue.replace(/"/g, '""')}"`;
  }

  return normalizedValue;
};

export const downloadAdminCsv = <Row>(
  filename: string,
  rows: Row[],
  columns: Array<AdminCsvColumn<Row>>
) => {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const csvLines = [
    columns.map((column) => escapeCsvValue(column.header)).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(column.value(row))).join(",")),
  ];

  const blob = new Blob([`\uFEFF${csvLines.join("\n")}`], {
    type: "text/csv;charset=utf-8;",
  });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 250);
};

export const buildAdminCsvFileName = (prefix: string) => {
  const timestamp = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date())
    .replace(/[,:]/g, "")
    .replace(/\s+/g, "-");

  return `${prefix}-${timestamp}.csv`;
};

export const normalizeAdminSearchTerm = (value?: string | null) => value?.trim().toLowerCase() ?? "";

export const matchesAdminSearchTerm = (
  searchTerm: string,
  values: Array<string | number | null | undefined>
) => {
  if (!searchTerm) {
    return true;
  }

  return values.some((value) => `${value ?? ""}`.toLowerCase().includes(searchTerm));
};

export const isWithinAdminNumberRange = (
  value: number,
  minimumValue?: number | null,
  maximumValue?: number | null
) => {
  if (typeof minimumValue === "number" && Number.isFinite(minimumValue) && value < minimumValue) {
    return false;
  }

  if (typeof maximumValue === "number" && Number.isFinite(maximumValue) && value > maximumValue) {
    return false;
  }

  return true;
};

export const parseAdminNumberFilter = (value: string) => {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number(normalizedValue.replace(/,/g, ""));
  return Number.isFinite(parsedValue) ? parsedValue : null;
};
