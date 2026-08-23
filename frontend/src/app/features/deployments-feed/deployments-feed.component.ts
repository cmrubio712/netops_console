import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ApiService } from '../../core/services/api.service';
import { DeploymentRun } from '../../shared/models/dashboard.models';

const POLL_INTERVAL_MS = 60_000;

@Component({
  selector: 'app-deployments-feed',
  imports: [CommonModule],
  templateUrl: './deployments-feed.component.html',
  styleUrl: './deployments-feed.component.scss',
})
export class DeploymentsFeedComponent implements OnInit {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  runs: DeploymentRun[] = [];
  loading = true;
  error = false;

  ngOnInit(): void {
    this.refresh();
    const timer = setInterval(() => this.refresh(), POLL_INTERVAL_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  statusClass(run: DeploymentRun): string {
    if (run.status !== 'completed') return 'status-warn';
    return run.conclusion === 'success' ? 'status-up' : 'status-down';
  }

  statusLabel(run: DeploymentRun): string {
    if (run.status !== 'completed') return run.status.toUpperCase();
    return (run.conclusion ?? 'unknown').toUpperCase();
  }

  private refresh(): void {
    this.api
      .getDeployments(20)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (runs) => {
          this.runs = runs;
          this.loading = false;
          this.error = false;
        },
        error: () => {
          this.error = true;
          this.loading = false;
        },
      });
  }
}
