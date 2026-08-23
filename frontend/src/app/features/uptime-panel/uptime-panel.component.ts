import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { Target, UptimeCheck } from '../../shared/models/dashboard.models';

interface TargetStatus {
  target: Target;
  latest: UptimeCheck | null;
}

const POLL_INTERVAL_MS = 60_000;

@Component({
  selector: 'app-uptime-panel',
  imports: [CommonModule],
  templateUrl: './uptime-panel.component.html',
  styleUrl: './uptime-panel.component.scss',
})
export class UptimePanelComponent implements OnInit {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  statuses: TargetStatus[] = [];
  loading = true;
  error = false;

  ngOnInit(): void {
    this.refresh();
    const timer = setInterval(() => this.refresh(), POLL_INTERVAL_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  private refresh(): void {
    this.api
      .getTargets()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (targets) => this.loadLatestChecks(targets),
        error: () => {
          this.error = true;
          this.loading = false;
        },
      });
  }

  private loadLatestChecks(targets: Target[]): void {
    if (targets.length === 0) {
      this.statuses = [];
      this.loading = false;
      return;
    }

    forkJoin(targets.map((t) => this.api.getUptime(t.name, '24h')))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (histories) => {
          this.statuses = targets.map((target, i) => ({
            target,
            latest: histories[i].length ? histories[i][histories[i].length - 1] : null,
          }));
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
