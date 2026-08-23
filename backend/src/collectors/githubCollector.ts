import { githubToken } from "../config";

export interface DeploymentRunResult {
  run_id: number;
  workflow_name: string;
  status: string;
  conclusion: string | null;
  started_at: Date;
  duration_s: number;
  html_url: string;
}

const API_BASE = "https://api.github.com";

interface GithubWorkflowRun {
  id: number;
  name: string | null;
  workflow_id: number;
  status: string;
  conclusion: string | null;
  run_started_at: string;
  updated_at: string;
  html_url: string;
}

export async function fetchRecentRuns(fullName: string, perPage = 10): Promise<DeploymentRunResult[]> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;

  const response = await fetch(
    `${API_BASE}/repos/${fullName}/actions/runs?per_page=${perPage}`,
    { headers },
  );
  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status}: ${await response.text()}`);
  }

  const body = (await response.json()) as { workflow_runs: GithubWorkflowRun[] };

  return body.workflow_runs.map((run) => {
    const startedAt = new Date(run.run_started_at);
    const updatedAt = new Date(run.updated_at);
    const durationS = Math.max(
      Math.round((updatedAt.getTime() - startedAt.getTime()) / 1000),
      0,
    );

    return {
      run_id: run.id,
      workflow_name: run.name ?? String(run.workflow_id),
      status: run.status,
      conclusion: run.conclusion,
      started_at: startedAt,
      duration_s: durationS,
      html_url: run.html_url,
    };
  });
}
