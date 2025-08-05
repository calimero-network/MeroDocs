import { ContextApiDataSource } from './dataSource/nodeApiDataSource';

export interface DefaultContextInfo {
  contextId: string;
  memberPublicKey: string;
  executorId: string;
  applicationId: string;
  context_name: string;
  is_private: boolean;
}

export class DefaultContextService {
  private static instance: DefaultContextService | null = null;
  private static globalCreatingFlag: boolean = false;
  private app: any;
  private nodeApiService: ContextApiDataSource;
  private isCreatingContext: boolean = false;

  private constructor(app: any) {
    this.app = app;
    this.nodeApiService = new ContextApiDataSource(app);
  }

  static getInstance(app: any): DefaultContextService {
    if (
      !DefaultContextService.instance ||
      DefaultContextService.instance.app !== app
    ) {
      DefaultContextService.instance = new DefaultContextService(app);
    }
    return DefaultContextService.instance;
  }

  static clearInstance(): void {
    DefaultContextService.globalCreatingFlag = false;
    DefaultContextService.instance = null;
  }

  /**
   * Check if a default context exists in localStorage
   */
  getStoredDefaultContext(): DefaultContextInfo | null {
    try {
      const stored = localStorage.getItem('defaultContext');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error parsing stored default context:', error);
      return null;
    }
  }

  /**
   * Store default context info in localStorage
   */
  storeDefaultContext(contextInfo: DefaultContextInfo): void {
    try {
      localStorage.setItem('defaultContext', JSON.stringify(contextInfo));
      // Also store individual items for backward compatibility
      localStorage.setItem('defaultContextId', contextInfo.contextId);
      localStorage.setItem('defaultContextUserID', contextInfo.memberPublicKey);
    } catch (error) {
      console.error('Error storing default context:', error);
    }
  }

  /**
   * Check if a context is a default/private context using the backend API
   * This uses the Calimero app.execute pattern directly
   */
  async isDefaultPrivateContextViaApi(
    contextInfo: DefaultContextInfo,
  ): Promise<boolean> {
    try {
      if (!this.app) {
        console.error('App not initialized');
        return false;
      }

      const result = await this.app.execute(
        contextInfo,
        'is_default_private_context',
        {},
      );

      // Handle different response structures
      const isDefaultPrivate = result?.data || result || false;

      return Boolean(isDefaultPrivate);
    } catch (error) {
      console.error('Error in isDefaultPrivateContextViaApi:', error);
      return false;
    }
  }

  /**
   * Create a new default private context
   */
  async createDefaultContext(): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const createResponse = await this.nodeApiService.createContext({
        is_private: true,
        context_name: 'default',
      });

      if (createResponse.error) {
        console.error(
          'Failed to create default context:',
          createResponse.error,
        );
        return { success: false, error: createResponse.error.message };
      }

      return { success: true, data: createResponse.data };
    } catch (error: any) {
      console.error('Error creating default context:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Ensure a default context exists - check storage, fetch contexts, or create new one
   */
  async ensureDefaultContext(): Promise<{
    success: boolean;
    contextInfo?: DefaultContextInfo;
    error?: string;
    wasCreated?: boolean;
  }> {
    if (DefaultContextService.globalCreatingFlag) {
      console.log(
        '[ensureDefaultContext] Global creation in progress, waiting...',
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
      return this.ensureDefaultContext();
    }

    if (this.isCreatingContext) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return this.ensureDefaultContext();
    }

    if (!this.app) {
      return { success: false, error: 'App not initialized' };
    }

    try {
      if (this.isCreatingContext) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return this.ensureDefaultContext();
      }

      const storedContext = this.getStoredDefaultContext();

      if (storedContext) {
        const isStillValidDefault =
          await this.isDefaultPrivateContextViaApi(storedContext);
        if (isStillValidDefault) {
          return {
            success: true,
            contextInfo: storedContext,
            wasCreated: false,
          };
        } else {
          console.log(
            'Stored context is no longer a default private context, clearing...',
          );
          this.clearStoredDefaultContext();
        }
      }

      if (!storedContext && !DefaultContextService.globalCreatingFlag) {
        DefaultContextService.globalCreatingFlag = true;
        this.isCreatingContext = true;
      }

      const contexts = await this.app.fetchContexts();

      for (const context of contexts) {
        const contextInfo: DefaultContextInfo = {
          contextId: context.contextId,
          memberPublicKey: context.memberPublicKey || context.executorId,
          executorId: context.executorId,
          applicationId: context.applicationId,
          context_name: context.context_name || 'default',
          is_private: context.is_private || false,
        };

        const isDefaultPrivate =
          await this.isDefaultPrivateContextViaApi(contextInfo);

        if (isDefaultPrivate) {
          this.storeDefaultContext(contextInfo);

          if (DefaultContextService.globalCreatingFlag) {
            DefaultContextService.globalCreatingFlag = false;
            this.isCreatingContext = false;
          }

          return { success: true, contextInfo, wasCreated: false };
        }
      }

      if (!DefaultContextService.globalCreatingFlag) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return this.ensureDefaultContext();
      }

      try {
        const createResult = await this.createDefaultContext();

        if (!createResult.success) {
          return { success: false, error: createResult.error };
        }

        const contextInfo: DefaultContextInfo = {
          contextId: createResult.data.contextId,
          memberPublicKey:
            createResult.data.memberPublicKey || createResult.data.executorId,
          executorId: createResult.data.executorId,
          applicationId: createResult.data.applicationId,
          context_name: 'default',
          is_private: true,
        };

        this.storeDefaultContext(contextInfo);

        return {
          success: true,
          contextInfo,
          wasCreated: true,
        };
      } finally {
        DefaultContextService.globalCreatingFlag = false;
        this.isCreatingContext = false;
      }
    } catch (error: any) {
      DefaultContextService.globalCreatingFlag = false;
      this.isCreatingContext = false;
      console.error('Error ensuring default context:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Clear stored default context (useful for logout or reset)
   */
  clearStoredDefaultContext(): void {
    try {
      localStorage.removeItem('defaultContext');
      localStorage.removeItem('defaultContextId');
      localStorage.removeItem('defaultContextUserID');
    } catch (error) {
      console.error('Error clearing stored default context:', error);
    }
  }
}
