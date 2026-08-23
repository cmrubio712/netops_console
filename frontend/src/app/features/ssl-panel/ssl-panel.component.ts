import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ApiService } from '../../core/services/api.service';
import { SslEntry } from '../../shared/models/dashboard.models';

const POLL_INTERVAL_MS = 60_000;
const WARN_THRESHOLD_DAYS = 14;

@Component({
  selector: 'app-ssl-panel',
  imports: [CommonModule],
  templateUrl: './ssl-panel.component.html',
  styleUrl: './ssl-panel.component.scss',
})
export class SslPanelComponent implements OnInit {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  entries: SslEntry[] = [];
  loading = true;
  error = false;
  readonly warnThreshold = WARN_THRESHOLD_DAYS;

  ngOnInit(): void {
    this.refresh();
    const timer = setInterval(() => this.refresh(), POLL_INTERVAL_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  statusClass(daysRemaining: number | null): string {
    if (daysRemaining === null) return '';
    if (daysRemaining < 0) return 'status-down';
    if (daysRemaining <= this.warnThreshold) return 'status-warn';
    return 'status-up';
  }

  private refresh(): void {
    this.api
      .getSsl()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (entries) => {
          this.entries = entries;
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
