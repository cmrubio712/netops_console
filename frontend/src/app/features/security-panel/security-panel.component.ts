import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ApiService } from '../../core/services/api.service';
import { SecurityHeadersEntry } from '../../shared/models/dashboard.models';

const POLL_INTERVAL_MS = 60_000;

@Component({
  selector: 'app-security-panel',
  imports: [CommonModule],
  templateUrl: './security-panel.component.html',
  styleUrl: './security-panel.component.scss',
})
export class SecurityPanelComponent implements OnInit {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  entries: SecurityHeadersEntry[] = [];
  loading = true;
  error = false;

  ngOnInit(): void {
    this.refresh();
    const timer = setInterval(() => this.refresh(), POLL_INTERVAL_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  gradeClass(grade: string | null): string {
    if (grade === null) return '';
    if (grade === 'A' || grade === 'B') return 'status-up';
    if (grade === 'C') return 'status-warn';
    return 'status-down';
  }

  private refresh(): void {
    this.api
      .getSecurityHeaders()
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
