import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { NetClient, NetResponse, NetError } from './NetClient';

describe('NetClient', () => {
  let netClient: NetClient;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    netClient = new NetClient();
  });

  it('performs a successful GET request with JSON response', async () => {
    const mockData = { foo: 'bar' };
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue(mockData),
    };
    (fetch as Mock).mockResolvedValue(mockResponse);

    const result = await netClient.get('/test');

    expect(fetch).toHaveBeenCalledWith('/test', expect.objectContaining({ method: 'GET' }));
    expect(result.data).toEqual(mockData);
    expect(result.status).toBe(200);
  });

  it('performs a successful POST request with JSON response', async () => {
    const mockData = { success: true };
    const payload = { key: 'value' };
    const mockResponse = {
      ok: true,
      status: 201,
      statusText: 'Created',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue(mockData),
    };
    (fetch as Mock).mockResolvedValue(mockResponse);

    const result = await netClient.post('/test', payload);

    expect(fetch).toHaveBeenCalledWith(
      '/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
    expect(result.data).toEqual(mockData);
  });

  it('handles text responses when content-type is not JSON', async () => {
    const mockText = 'plain text';
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: vi.fn().mockResolvedValue(mockText),
    };
    (fetch as Mock).mockResolvedValue(mockResponse);

    const result = await netClient.get<string>('/text');

    expect(result.data).toBe(mockText);
  });

  it('throws an error for non-ok responses', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({ error: 'not found' }),
    };
    (fetch as Mock).mockResolvedValue(mockResponse);

    try {
      await netClient.get('/not-found');
      // should not reach here
      expect(true).toBe(false);
    } catch (error: unknown) {
      const netError = error as NetError;
      expect(netError.response?.status).toBe(404);
      expect(netError.message).toBe('Not Found');
    }
  });

  it('uses response interceptors on success', async () => {
    const mockData = { value: 10 };
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue(mockData),
    };
    (fetch as Mock).mockResolvedValue(mockResponse);

    netClient.interceptors.response.use((response: NetResponse<unknown>) => {
      const data = response.data as { value: number };
      response.data = data.value * 2;
      return response;
    });

    const result = await netClient.get('/intercept');
    expect(result.data).toBe(20);
  });

  it('uses response interceptors on error', async () => {
    const mockResponse = {
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({}),
    };
    (fetch as Mock).mockResolvedValue(mockResponse);

    let errorHandledStatus = 0;
    netClient.interceptors.response.use(
      (res) => res,
      (error: unknown) => {
        const netError = error as NetError;
        if (netError.response?.status === 409) {
          errorHandledStatus = 409;
        }
        throw error;
      }
    );

    try {
      await netClient.get('/conflict');
    } catch (_error: unknown) {
      // expected
    }
    expect(errorHandledStatus).toBe(409);
  });

  it('handles errors in interceptors', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({}),
    };
    (fetch as Mock).mockResolvedValue(mockResponse);

    netClient.interceptors.response.use(() => {
      throw new Error('Interceptor Error');
    });

    await expect(netClient.get('/error')).rejects.toThrow('Interceptor Error');
  });

  it('handles network errors', async () => {
    (fetch as Mock).mockRejectedValue(new Error('Network Error'));

    await expect(netClient.get('/network-error')).rejects.toThrow('Network Error');
  });
});
