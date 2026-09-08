import posthog from 'posthog-js';
import { ANALYTICS_ENABLED } from '@/config/features';

// Get these from env variables in a real deployment
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || 'YOUR_POSTHOG_KEY';
const configuredPosthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.posthog.com';
const POSTHOG_HOST = (() => {
  try {
    const url = new URL(configuredPosthogHost);
    return url.protocol === 'https:' ? url.toString() : 'https://eu.posthog.com';
  } catch {
    return 'https://eu.posthog.com';
  }
})();

export const initAnalytics = () => {
  // Only initialize if we're not in a dev/test environment and have a valid key
  if (ANALYTICS_ENABLED && POSTHOG_KEY && POSTHOG_KEY !== 'YOUR_POSTHOG_KEY') {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: false, // We'll manually capture important events
      capture_pageview: false, // Manually track pageviews via wouter/react
    });
  }
};

export const captureEvent = (eventName: string, properties?: Record<string, any>) => {
  if (ANALYTICS_ENABLED && POSTHOG_KEY && POSTHOG_KEY !== 'YOUR_POSTHOG_KEY') {
    posthog.capture(eventName, properties);
  }
};

export const capturePageView = (url: string) => {
  if (ANALYTICS_ENABLED && POSTHOG_KEY && POSTHOG_KEY !== 'YOUR_POSTHOG_KEY') {
    posthog.capture('$pageview', {
      $current_url: url,
    });
  }
};
