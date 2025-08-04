import { useEffect, useState, useCallback } from 'react';
import { useCalimero } from '@calimero-network/calimero-client';
import {
  DefaultContextService,
  DefaultContextInfo,
} from '../api/defaultContextService';

export const useDefaultContext = () => {
  const { app } = useCalimero();
  const [isCreating, setIsCreating] = useState(false);
  const [defaultContextInfo, setDefaultContextInfo] =
    useState<DefaultContextInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ensureDefaultContext = useCallback(async () => {
    if (!app) return;

    try {
      setIsCreating(true);
      setError(null);

      const defaultContextService = new DefaultContextService(app);
      const result = await defaultContextService.ensureDefaultContext();

      if (result.success && result.contextInfo) {
        setDefaultContextInfo(result.contextInfo);

        if (result.wasCreated) {
        } else {
        }
      } else {
        console.error('Failed to ensure default context:', result.error);
        setError(result.error || 'Failed to ensure default context');
      }
    } catch (error: any) {
      console.error('Error in ensureDefaultContext:', error);
      setError(error.message || 'Unknown error occurred');
    } finally {
      setIsCreating(false);
    }
  }, [app]);

  // Auto-run when app becomes available
  useEffect(() => {
    if (app) {
      const timer = setTimeout(ensureDefaultContext, 1000);
      return () => clearTimeout(timer);
    }
  }, [app, ensureDefaultContext]);

  // Clear context on app disconnect
  useEffect(() => {
    if (!app && defaultContextInfo) {
      setDefaultContextInfo(null);
      setError(null);
    }
  }, [app, defaultContextInfo]);

  return {
    isCreating,
    defaultContextInfo,
    error,
    ensureDefaultContext,
    clearContext: () => {
      const service = new DefaultContextService(app);
      service.clearStoredDefaultContext();
      setDefaultContextInfo(null);
      setError(null);
    },
  };
};
