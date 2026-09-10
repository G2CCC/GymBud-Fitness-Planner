export type ApiError = {
  code: string;
  message: string;
};

export type ApiResponse<T> =
  | { data: T; error?: never }
  | { data?: never; error: ApiError };
