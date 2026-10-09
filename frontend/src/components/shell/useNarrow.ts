import { useEffect, useState } from 'react';

// Below 960 px the app uses the mobile layout (plan Phase 8). Rendering only one
// layout avoids duplicate controls, ids and queries in the hidden one.
const NARROW_QUERY = '(max-width: 959px)';

const matches = () => {
  try {
    return window.matchMedia(NARROW_QUERY).matches;
  } catch {
    return false;
  }
};

export function useNarrow() {
  const [narrow, setNarrow] = useState(matches);
  useEffect(() => {
    const query = window.matchMedia(NARROW_QUERY);
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return narrow;
}
