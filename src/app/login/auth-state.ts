export type AuthActionState = {
  error: string | null;
  info?: string | null;
};

export const INITIAL_STATE: AuthActionState = { error: null };
