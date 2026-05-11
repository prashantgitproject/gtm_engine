/** Label + value shipped to sourcingProfile / Apollo-style actors (values are slugs/strings). */

export const SENIORITY_OPTIONS = [
  { label: "Founder", value: "founder" },
  { label: "Owner", value: "owner" },
  { label: "Executive (C-Suite)", value: "c_suite" },
  { label: "Director", value: "director" },
  { label: "Partner", value: "partner" },
  { label: "Vice president", value: "vp" },
  { label: "Head", value: "head" },
  { label: "Manager", value: "manager" },
  { label: "Senior", value: "senior" },
  { label: "Entry Level", value: "entry_level" },
  { label: "Trainee", value: "trainee" },
];

export const FUNCTIONAL_LEVEL_OPTIONS = [
  { label: "C-Suite", value: "c_suite" },
  { label: "Finance", value: "finance" },
  { label: "Product Management", value: "product_management" },
  { label: "Engineering", value: "engineering" },
  { label: "Design", value: "design" },
  { label: "Education", value: "education" },
  { label: "Human Resources", value: "human_resources" },
  { label: "Information Technology", value: "information_technology" },
  { label: "Legal", value: "legal" },
  { label: "Marketing", value: "marketing" },
  { label: "Operations", value: "operations" },
  { label: "Sales", value: "sales" },
  { label: "Support", value: "support" },
];

export const SIZE_OPTIONS = [
  { label: "1-10", value: "1-10" },
  { label: "11-20", value: "11-20" },
  { label: "21-50", value: "21-50" },
  { label: "51-100", value: "51-100" },
  { label: "101-200", value: "101-200" },
  { label: "201-500", value: "201-500" },
  { label: "501-1000", value: "501-1000" },
  { label: "1001-2000", value: "1001-2000" },
  { label: "2001-5000", value: "2001-5000" },
  { label: "5001-10000", value: "5001-10000" },
  { label: "10001-20000", value: "10001-20000" },
  { label: "20001-50000", value: "20001-50000" },
  { label: "50000+", value: "50000+" },
];

/** Single-select; values match Apollo-style revenue strings */
export const REVENUE_OPTIONS = [
  { label: "100K", value: "100K" },
  { label: "500K", value: "500K" },
  { label: "1M", value: "1M" },
  { label: "5M", value: "5M" },
  { label: "10M", value: "10M" },
  { label: "25M", value: "25M" },
  { label: "50M", value: "50M" },
  { label: "100M", value: "100M" },
  { label: "500M", value: "500M" },
  { label: "1B", value: "1B" },
  { label: "5B", value: "5B" },
  { label: "10B", value: "10B" },
];

export const FUNDING_OPTIONS = [
  { label: "Seed Round", value: "seed_round" },
  { label: "Angel Round", value: "angel" },
  { label: "Series A", value: "series_a" },
  { label: "Series B", value: "series_b" },
  { label: "Series C", value: "series_c" },
  { label: "Series D", value: "series_d" },
  { label: "Series E", value: "series_e" },
  { label: "Series F", value: "series_f" },
  { label: "Venture Round", value: "venture_round" },
  { label: "Debt Financing", value: "debt_financing" },
  { label: "Convertible Note", value: "convertible_note" },
];

export function labelsForSelectedValues(optionList, selectedValues = []) {
  const set = new Set(selectedValues);
  return optionList
    .filter((o) => set.has(o.value))
    .map((o) => o.label)
    .join(", ");
}
