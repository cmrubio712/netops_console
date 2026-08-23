export const db = {
  // "localhost" can resolve to the IPv6 loopback (::1) depending on the
  // host's DNS config, which MySQL treats as a different grant than
  // 'user'@'localhost' — 127.0.0.1 sidesteps the ambiguity.
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? "3306"),
  user: process.env.DB_USER ?? "",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "",
};

export const githubToken = process.env.GITHUB_TOKEN ?? "";

export const corsOrigins = (process.env.CORS_ORIGINS ?? "https://status.cmrubio.com")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export const retentionDays = Number(process.env.RETENTION_DAYS ?? "90");

export const port = Number(process.env.PORT ?? "8000");

export interface TargetConfig {
  name: string;
  url: string;
}

// Sites/subdomains to monitor. Edit this list to match real infrastructure.
export const targets: TargetConfig[] = [
  { name: "cmrubio.com", url: "https://cmrubio.com" },
  { name: "status.cmrubio.com", url: "https://status.cmrubio.com" },
];

// Repos to pull GitHub Actions run history from, "owner/repo" format.
export const githubRepos: string[] = ["cmrubio712/netops_console"];
