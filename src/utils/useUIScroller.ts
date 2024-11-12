import { useRef, useEffect } from 'react';
import { RealtimeEvent } from './useRealtimeClient';

export function useUIScroller(realtimeEvents: RealtimeEvent[]) {
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (eventsScrollRef.current) {
      const eventsEl = eventsScrollRef.current;
      const scrollHeight = eventsEl.scrollHeight;
      if (scrollHeight !== eventsScrollHeightRef.current) {
        eventsEl.scrollTop = scrollHeight;
        eventsScrollHeightRef.current = scrollHeight;
      }
    }
  }, [realtimeEvents]);

  return { eventsScrollHeightRef, eventsScrollRef };
}
