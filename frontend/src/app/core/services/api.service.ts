import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { DeploymentRun, SslEntry, Summary, Target, UptimeCheck } from '../../shared/models/dashboard.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getSummary(): Observable<Summary> {
    return this.http.get<Summary>(`${this.baseUrl}/summary`);
  }

  getTargets(): Observable<Target[]> {
    return this.http.get<Target[]>(`${this.baseUrl}/targets`);
  }

  getUptime(target: string, range: string = '24h'): Observable<UptimeCheck[]> {
    return this.http.get<UptimeCheck[]>(`${this.baseUrl}/uptime`, { params: { target, range } });
  }

  getSsl(): Observable<SslEntry[]> {
    return this.http.get<SslEntry[]>(`${this.baseUrl}/ssl`);
  }

  getDeployments(limit: number = 20): Observable<DeploymentRun[]> {
    return this.http.get<DeploymentRun[]>(`${this.baseUrl}/deployments`, { params: { limit } });
  }
}
