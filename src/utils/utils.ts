import { getConfig } from '@openmrs/esm-framework';

export async function getHieBaseUrl() {
  const { hieBaseUrl } = await getConfig('@ampath/esm-dha-workflow-app');
  return hieBaseUrl ?? null;
}

export async function postJson<T>(url: string, payload: unknown = null, method: string = 'POST'): Promise<T> {
  const request = {
    method: method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (payload) {
    request['body'] = JSON.stringify(payload);
  }

  const response = await fetch(url, request);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed with ${response.status}: ${errorText}`);
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return Promise.resolve({} as T);
  }

  return response.json() as Promise<T>;
}
