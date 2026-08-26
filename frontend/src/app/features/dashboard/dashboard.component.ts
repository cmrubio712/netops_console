import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ApiService } from '../../core/services/api.service';
import { Summary } from '../../shared/models/dashboard.models';
import { DeploymentsFeedComponent } from '../deployments-feed/deployments-feed.component';
import { SecurityPanelComponent } from '../security-panel/security-panel.component';
import { SslPanelComponent } from '../ssl-panel/ssl-panel.component';
import { UptimePanelComponent } from '../uptime-panel/uptime-panel.component';

const POLL_INTERVAL_MS = 60_000;

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    UptimePanelComponent,
    SslPanelComponent,
    SecurityPanelComponent,
    DeploymentsFeedComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  summary: Summary | null = null;

  ngOnInit(): void {
    this.refresh();
    const timer = setInterval(() => this.refresh(), POLL_INTERVAL_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  private refresh(): void {
    this.api
      .getSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (summary) => (this.summary = summary) });
  }
}
