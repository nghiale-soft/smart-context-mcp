import http from 'http';
import https from 'https';
import { URL } from 'url';

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export interface SafeFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<any>;
  text(): Promise<string>;
}

export function safeFetch(url: string, options: SafeFetchOptions = {}): Promise<SafeFetchResponse> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      const headers: Record<string, string> = {};
      if (options.headers) {
        for (const [key, value] of Object.entries(options.headers)) {
          headers[key.toLowerCase()] = value;
        }
      }

      if (options.body && !headers['content-length']) {
        headers['content-length'] = Buffer.byteLength(options.body).toString();
      }

      const reqOptions: http.RequestOptions = {
        method: options.method || 'GET',
        headers: headers,
      };

      const req = protocol.request(url, reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          resolve({
            ok: (res.statusCode || 200) >= 200 && (res.statusCode || 200) < 300,
            status: res.statusCode || 200,
            statusText: res.statusMessage || '',
            json: async () => JSON.parse(data),
            text: async () => data,
          });
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          req.destroy();
          const abortErr = new Error('The user aborted a request.');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      }

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}
