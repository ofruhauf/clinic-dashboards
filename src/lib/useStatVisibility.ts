import { useCallback, useState } from 'react';
import { getHiddenKeys, setHiddenKeys, type StatPage } from './statPrefs';

export function useStatVisibility(page: StatPage) {
  const [hidden, setHidden] = useState<string[]>(() => getHiddenKeys(page));

  const toggle = useCallback(
    (key: string) => {
      setHidden((prev) => {
        const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
        setHiddenKeys(page, next);
        return next;
      });
    },
    [page]
  );

  return { hidden, toggle };
}
