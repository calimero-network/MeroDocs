import type {
  CreateContextProps,
  CreateContextResponse,
  InviteToContextProps,
  JoinContextProps,
  JoinContextResponse,
  NodeApi,
  VerifyContextProps,
  VerifyContextResponse,
} from '../nodeApi';

// This class now needs to be instantiated with the app object from useCalimero
export class ContextApiDataSource implements NodeApi {
  private app: any;

  constructor(app: any) {
    this.app = app;
  }

  async createContext(
    props: CreateContextProps,
  ): Promise<{ data?: CreateContextResponse; error?: any }> {
    try {
      if (!this.app) {
        throw new Error('App not initialized');
      }

      // Prepare the initialization parameters
      const initParams = {
        is_private: props.is_private,
        context_name: props.context_name,
      };

      // Use the new API with correct parameter order:
      // createContext(protocol, initParams)
      const result = await this.app.createContext(undefined, initParams);

      return {
        data: result,
        error: null,
      };
    } catch (error) {
      let errorMessage = 'An unexpected error occurred during createContext';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return {
        data: undefined,
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async inviteToContext(
    props: InviteToContextProps,
  ): Promise<{ data?: string; error?: any }> {
    try {
      if (!this.app) {
        throw new Error('App not initialized');
      }

      // Use the new app.inviteToContext() method
      const result = await this.app.inviteToContext({
        contextId: props.contextId,
        inviterId: props.inviter,
        inviteeId: props.invitee,
      });

      return {
        data: result,
        error: null,
      };
    } catch (error) {
      console.error('inviteToContext failed:', error);
      let errorMessage = 'An unexpected error occurred during inviteToContext';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return {
        data: undefined,
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async joinContext(
    props: JoinContextProps,
  ): Promise<{ data?: JoinContextResponse; error?: any }> {
    try {
      if (!this.app) {
        throw new Error('App not initialized');
      }

      // Use the new app.joinContext() method
      const result = await this.app.joinContext({
        invitationPayload: props.invitationPayload,
      });

      return {
        data: result,
        error: null,
      };
    } catch (error) {
      console.error('joinContext failed:', error);
      let errorMessage = 'An unexpected error occurred during joinContext';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return {
        data: undefined,
        error: {
          code: 500,
          message: errorMessage,
        },
      };
    }
  }

  async verifyContext(
    props: VerifyContextProps,
  ): Promise<{ data?: VerifyContextResponse; error?: any }> {
    try {
      if (!this.app) {
        throw new Error('App not initialized');
      }

      // Use the new app.verifyContext() method
      const result = await this.app.verifyContext({
        contextId: props.contextId,
      });

      return {
        data: { joined: result.joined || false },
        error: null,
      };
    } catch (error) {
      console.error('Error fetching context:', error);
      return {
        data: undefined,
        error: { code: 500, message: 'Failed to fetch context data.' },
      };
    }
  }
}
