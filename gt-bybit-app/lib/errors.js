export class AppError extends Error {
  constructor(code, message, status = 400, extra = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

export function assert(condition, code, message, status = 400) {
  if (!condition) throw new AppError(code, message, status);
}

export function publicError(error) {
  return {
    ok: false,
    error: error instanceof AppError ? error.code : 'INTERNAL_ERROR',
    message: error instanceof AppError ? error.message : 'تعذر إتمام الطلب. حاول لاحقًا.',
    ...(error instanceof AppError ? error.extra : {}),
  };
}
