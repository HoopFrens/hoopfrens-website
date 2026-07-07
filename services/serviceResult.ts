export type ServiceResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

export const foundationOnly = <T>(serviceName: string): ServiceResult<T> => ({
  ok: false,
  error: `${serviceName} is a foundation stub. Production behavior has not been implemented yet.`,
});
