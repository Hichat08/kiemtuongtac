export interface LockedAccountSnapshot {
  message: string;
  note?: string;
  lockedAt?: string | null;
}

const ACCOUNT_LOCK_STORAGE_KEY = "kiem-tuong-tac-account-locked";

const isBrowser = () => typeof window !== "undefined";

export const readLockedAccountSnapshot = (): LockedAccountSnapshot | null => {
  if (!isBrowser()) {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(ACCOUNT_LOCK_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as LockedAccountSnapshot;

    if (!parsed?.message) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const persistLockedAccountSnapshot = (snapshot: LockedAccountSnapshot) => {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.setItem(ACCOUNT_LOCK_STORAGE_KEY, JSON.stringify(snapshot));
};

export const clearLockedAccountSnapshot = () => {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.removeItem(ACCOUNT_LOCK_STORAGE_KEY);
};

export const redirectToAccountLockedPage = () => {
  if (!isBrowser()) {
    return;
  }

  if (window.location.pathname === "/account-locked") {
    return;
  }

  window.location.assign("/account-locked");
};
