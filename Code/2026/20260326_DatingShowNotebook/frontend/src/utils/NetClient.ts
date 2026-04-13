export interface NetResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  config: RequestInit;
}

export interface NetError<T = unknown> extends Error {
  response?: NetResponse<T>;
}

type ResponseInterceptor = {
  onFulfilled?: (
    response: NetResponse<unknown>
  ) => NetResponse<unknown> | Promise<NetResponse<unknown>>;
  onRejected?: (error: unknown) => unknown;
};

export class NetClient {
  private responseInterceptors: ResponseInterceptor[] = [];

  public interceptors: {
    response: {
      use: (
        onFulfilled?: (
          response: NetResponse<unknown>
        ) => NetResponse<unknown> | Promise<NetResponse<unknown>>,
        onRejected?: (error: unknown) => unknown
      ) => void;
    };
  };

  constructor() {
    this.interceptors = {
      response: {
        use: (
          onFulfilled?: (
            response: NetResponse<unknown>
          ) => NetResponse<unknown> | Promise<NetResponse<unknown>>,
          onRejected?: (error: unknown) => unknown
        ) => {
          this.responseInterceptors.push({ onFulfilled, onRejected });
        },
      },
    };
  }

  async request<T>(url: string, options: RequestInit): Promise<NetResponse<T>> {
    try {
      const response = await fetch(url, options);

      let data: T;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = (await response.text()) as unknown as T;
      }

      const result: NetResponse<T> = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        config: options,
      };

      if (!response.ok) {
        const error = new Error(response.statusText) as NetError<T>;
        error.response = result;
        throw error;
      }

      let interceptedResult: NetResponse<unknown> = result;
      for (const interceptor of this.responseInterceptors) {
        if (interceptor.onFulfilled) {
          interceptedResult = await interceptor.onFulfilled(interceptedResult);
        }
      }

      return interceptedResult as NetResponse<T>;
    } catch (error: unknown) {
      let interceptedError: unknown = error;
      for (const interceptor of this.responseInterceptors) {
        if (interceptor.onRejected) {
          try {
            interceptedError = await interceptor.onRejected(interceptedError);
          } catch (e: unknown) {
            interceptedError = e;
          }
        }
      }
      throw interceptedError;
    }
  }

  async get<T>(url: string): Promise<NetResponse<T>> {
    return this.request<T>(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
  }

  async post<T>(url: string, data?: unknown): Promise<NetResponse<T>> {
    return this.request<T>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

export const netClient = new NetClient();
export default netClient;
