// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Responsive Hook
// Returns { isMobile, isTablet, isDesktop } using
// matchMedia listeners (no resize event spam)
// ═══════════════════════════════════════════════

import { useState, useEffect } from 'react';

const MOBILE_QUERY = '(max-width: 639px)';
const TABLET_QUERY = '(min-width: 640px) and (max-width: 1024px)';

export default function useResponsive() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const [isTablet, setIsTablet] = useState(() => window.matchMedia(TABLET_QUERY).matches);

  useEffect(() => {
    const mobileMedia = window.matchMedia(MOBILE_QUERY);
    const tabletMedia = window.matchMedia(TABLET_QUERY);

    const onMobile = (e) => setIsMobile(e.matches);
    const onTablet = (e) => setIsTablet(e.matches);

    mobileMedia.addEventListener('change', onMobile);
    tabletMedia.addEventListener('change', onTablet);

    return () => {
      mobileMedia.removeEventListener('change', onMobile);
      tabletMedia.removeEventListener('change', onTablet);
    };
  }, []);

  return { isMobile, isTablet, isDesktop: !isMobile && !isTablet };
}
