import * as dns from "dns";

export interface DnsResult {
  a_records: string[];
  resolution_ms: number | null;
  error: string | null;
}

export function resolve(host: string): Promise<DnsResult> {
  return new Promise((resolve) => {
    const result: DnsResult = { a_records: [], resolution_ms: null, error: null };
    const start = Date.now();

    dns.lookup(host, { all: true }, (err, addresses) => {
      if (err) {
        result.error = err.message;
        return resolve(result);
      }
      result.resolution_ms = Date.now() - start;
      result.a_records = [...new Set(addresses.map((a) => a.address))].sort();
      resolve(result);
    });
  });
}
