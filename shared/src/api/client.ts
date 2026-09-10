import type { ApiResponse } from "./contracts";

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async get<T>(path: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${path}`);
    return response.json() as Promise<ApiResponse<T>>;
  }
}
