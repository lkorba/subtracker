export type PlanOption = {
  name: string;
  cost: number;
  currency?: string;
  billing_cycle?: "weekly" | "monthly" | "quarterly" | "yearly";
};

export type Preset = {
  name: string;
  category: string;
  color: string;
  url?: string;
  plans: PlanOption[];
};

export const CATEGORIES = [
  "Entertainment",
  "Music",
  "AI",
  "Education",
  "Productivity",
  "Cloud & Storage",
  "News",
  "Fitness",
  "Gaming",
  "Shopping",
  "Utilities",
  "Other",
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  Entertainment: "#ef4444",
  Music: "#22c55e",
  AI: "#8b5cf6",
  Education: "#0ea5e9",
  Productivity: "#f59e0b",
  "Cloud & Storage": "#14b8a6",
  News: "#64748b",
  Fitness: "#ec4899",
  Gaming: "#6366f1",
  Shopping: "#f97316",
  Utilities: "#84cc16",
  Other: "#94a3b8",
};

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "JPY", "BRL", "MXN", "CHF", "SEK", "NOK", "DKK", "PLN", "SGD", "HKD", "CNY", "KRW", "ZAR", "AED"] as const;

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", CAD: "CA$", AUD: "A$", INR: "₹", JPY: "¥",
  BRL: "R$", MXN: "MX$", CHF: "CHF", SEK: "kr", NOK: "kr", DKK: "kr", PLN: "zł",
  SGD: "S$", HKD: "HK$", CNY: "¥", KRW: "₩", ZAR: "R", AED: "AED",
};

// Approximate FX rates to USD (static; good enough for local totals).
export const FX_TO_USD: Record<string, number> = {
  USD: 1, EUR: 1.08, GBP: 1.27, CAD: 0.73, AUD: 0.66, INR: 0.012, JPY: 0.0064,
  BRL: 0.18, MXN: 0.055, CHF: 1.13, SEK: 0.094, NOK: 0.092, DKK: 0.145, PLN: 0.25,
  SGD: 0.74, HKD: 0.128, CNY: 0.14, KRW: 0.00073, ZAR: 0.054, AED: 0.27,
};

export function formatMoney(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? "";
  return `${sym}${amount.toFixed(2)}`;
}

export const PRESETS: Preset[] = [
  {
    name: "Netflix", category: "Entertainment", color: "#e50914", url: "https://www.netflix.com",
    plans: [
      { name: "Standard with ads", cost: 6.99 },
      { name: "Standard", cost: 15.49 },
      { name: "Premium", cost: 22.99 },
    ],
  },
  {
    name: "Disney+", category: "Entertainment", color: "#0e2a56", url: "https://www.disneyplus.com",
    plans: [
      { name: "With ads", cost: 7.99 },
      { name: "Premium", cost: 13.99 },
      { name: "Premium (yearly)", cost: 139.99, billing_cycle: "yearly" },
    ],
  },
  {
    name: "Hulu", category: "Entertainment", color: "#1ce783", url: "https://www.hulu.com",
    plans: [
      { name: "With ads", cost: 7.99 },
      { name: "No ads", cost: 17.99 },
    ],
  },
  {
    name: "HBO Max", category: "Entertainment", color: "#9b8cff", url: "https://www.max.com",
    plans: [
      { name: "With ads", cost: 9.99 },
      { name: "Ad-free", cost: 15.99 },
      { name: "Ultimate", cost: 20.99 },
    ],
  },
  {
    name: "Prime Video", category: "Entertainment", color: "#00a8e1", url: "https://www.primevideo.com",
    plans: [
      { name: "Monthly", cost: 8.99 },
      { name: "Prime (yearly)", cost: 139, billing_cycle: "yearly" },
    ],
  },
  {
    name: "Apple TV+", category: "Entertainment", color: "#000000", url: "https://tv.apple.com",
    plans: [
      { name: "Monthly", cost: 9.99 },
      { name: "Yearly", cost: 99, billing_cycle: "yearly" },
    ],
  },
  {
    name: "YouTube Premium", category: "Entertainment", color: "#ff0000", url: "https://www.youtube.com/premium",
    plans: [
      { name: "Individual", cost: 13.99 },
      { name: "Family", cost: 22.99 },
      { name: "Student", cost: 7.99 },
    ],
  },
  {
    name: "Spotify", category: "Music", color: "#1db954", url: "https://www.spotify.com",
    plans: [
      { name: "Individual", cost: 10.99 },
      { name: "Duo", cost: 14.99 },
      { name: "Family", cost: 16.99 },
      { name: "Student", cost: 5.99 },
    ],
  },
  {
    name: "Apple Music", category: "Music", color: "#fa243c", url: "https://music.apple.com",
    plans: [
      { name: "Individual", cost: 10.99 },
      { name: "Family", cost: 16.99 },
      { name: "Student", cost: 5.99 },
    ],
  },
  {
    name: "Tidal", category: "Music", color: "#000000", url: "https://tidal.com",
    plans: [
      { name: "Individual", cost: 10.99 },
      { name: "Family", cost: 16.99 },
    ],
  },
  {
    name: "ChatGPT Plus", category: "AI", color: "#10a37f", url: "https://chat.openai.com",
    plans: [
      { name: "Plus", cost: 20 },
      { name: "Pro", cost: 200 },
      { name: "Team (per user)", cost: 25 },
    ],
  },
  {
    name: "Claude Pro", category: "AI", color: "#d97757", url: "https://claude.ai",
    plans: [
      { name: "Pro", cost: 20 },
      { name: "Max 5x", cost: 100 },
      { name: "Max 20x", cost: 200 },
    ],
  },
  {
    name: "Midjourney", category: "AI", color: "#1a1a1a", url: "https://www.midjourney.com",
    plans: [
      { name: "Basic", cost: 10 },
      { name: "Standard", cost: 30 },
      { name: "Pro", cost: 60 },
      { name: "Mega", cost: 120 },
    ],
  },
  {
    name: "GitHub Copilot", category: "AI", color: "#24292e", url: "https://github.com/features/copilot",
    plans: [
      { name: "Individual", cost: 10 },
      { name: "Pro+", cost: 39 },
      { name: "Business", cost: 19 },
    ],
  },
  {
    name: "Perplexity Pro", category: "AI", color: "#20808d", url: "https://www.perplexity.ai",
    plans: [
      { name: "Pro", cost: 20 },
      { name: "Pro (yearly)", cost: 200, billing_cycle: "yearly" },
    ],
  },
  {
    name: "Notion", category: "Productivity", color: "#000000", url: "https://www.notion.so",
    plans: [
      { name: "Plus", cost: 10 },
      { name: "Business", cost: 18 },
    ],
  },
  {
    name: "Figma", category: "Productivity", color: "#f24e1e", url: "https://www.figma.com",
    plans: [
      { name: "Professional", cost: 15 },
      { name: "Organization", cost: 45 },
    ],
  },
  {
    name: "Linear", category: "Productivity", color: "#5e6ad2", url: "https://linear.app",
    plans: [
      { name: "Basic", cost: 8 },
      { name: "Business", cost: 14 },
    ],
  },
  {
    name: "1Password", category: "Productivity", color: "#0572ec", url: "https://1password.com",
    plans: [
      { name: "Individual", cost: 2.99 },
      { name: "Families", cost: 4.99 },
    ],
  },
  {
    name: "iCloud+", category: "Cloud & Storage", color: "#3693f3", url: "https://www.icloud.com",
    plans: [
      { name: "50 GB", cost: 0.99 },
      { name: "200 GB", cost: 2.99 },
      { name: "2 TB", cost: 9.99 },
      { name: "6 TB", cost: 29.99 },
    ],
  },
  {
    name: "Google One", category: "Cloud & Storage", color: "#4285f4", url: "https://one.google.com",
    plans: [
      { name: "100 GB", cost: 1.99 },
      { name: "200 GB", cost: 2.99 },
      { name: "2 TB", cost: 9.99 },
    ],
  },
  {
    name: "Dropbox", category: "Cloud & Storage", color: "#0061ff", url: "https://www.dropbox.com",
    plans: [
      { name: "Plus", cost: 11.99 },
      { name: "Family", cost: 19.99 },
      { name: "Professional", cost: 19.99 },
    ],
  },
  {
    name: "Coursera Plus", category: "Education", color: "#0056d2", url: "https://www.coursera.org",
    plans: [
      { name: "Monthly", cost: 59 },
      { name: "Yearly", cost: 399, billing_cycle: "yearly" },
    ],
  },
  {
    name: "Duolingo Super", category: "Education", color: "#58cc02", url: "https://www.duolingo.com",
    plans: [
      { name: "Monthly", cost: 6.99 },
      { name: "Yearly", cost: 83.99, billing_cycle: "yearly" },
    ],
  },
  {
    name: "MasterClass", category: "Education", color: "#000000", url: "https://www.masterclass.com",
    plans: [
      { name: "Individual (yearly)", cost: 120, billing_cycle: "yearly" },
      { name: "Duo (yearly)", cost: 180, billing_cycle: "yearly" },
      { name: "Family (yearly)", cost: 240, billing_cycle: "yearly" },
    ],
  },
  {
    name: "NYT", category: "News", color: "#000000", url: "https://www.nytimes.com",
    plans: [
      { name: "Basic", cost: 17 },
      { name: "All Access", cost: 25 },
    ],
  },
  {
    name: "Peloton", category: "Fitness", color: "#df1e2d", url: "https://www.onepeloton.com",
    plans: [
      { name: "App One", cost: 12.99 },
      { name: "App+", cost: 24 },
    ],
  },
  {
    name: "Strava", category: "Fitness", color: "#fc4c02", url: "https://www.strava.com",
    plans: [
      { name: "Monthly", cost: 11.99 },
      { name: "Yearly", cost: 79.99, billing_cycle: "yearly" },
    ],
  },
  {
    name: "Xbox Game Pass", category: "Gaming", color: "#107c10", url: "https://www.xbox.com/game-pass",
    plans: [
      { name: "Core", cost: 9.99 },
      { name: "Standard", cost: 14.99 },
      { name: "Ultimate", cost: 19.99 },
    ],
  },
  {
    name: "PlayStation Plus", category: "Gaming", color: "#003791", url: "https://www.playstation.com/ps-plus",
    plans: [
      { name: "Essential", cost: 9.99 },
      { name: "Extra", cost: 14.99 },
      { name: "Premium", cost: 17.99 },
    ],
  },
];

export function monthlyAmount(cost: number, cycle: string): number {
  switch (cycle) {
    case "yearly": return cost / 12;
    case "quarterly": return cost / 3;
    case "weekly": return cost * 4.345;
    default: return cost;
  }
}

export function monthlyAmountInUsd(cost: number, cycle: string, currency: string): number {
  const rate = FX_TO_USD[currency] ?? 1;
  return monthlyAmount(cost, cycle) * rate;
}
