import {
  type ApiResponse,
  type RpcQueryParams,
  rpcClient,
  getAuthConfig,
  getAppEndpointKey,
  WsSubscriptionsClient,
} from '@calimero-network/calimero-client';
import {
  ClientApi,
  ClientMethod,
  ContextDetails,
  PermissionLevel,
  UserId,
} from '../clientApi';
import { DefaultContextService } from '../defaultContextService';

const RequestConfig = { timeout: 30000 };

function getErrorMessage(error: any): string {
  if (
    error?.type === 'Uninitialized' ||
    error?.message?.includes('Uninitialized')
  ) {
    return 'Syncing state, Please wait and retry.';
  }
  if (
    error?.error?.name === 'UnknownServerError' &&
    error?.error?.cause?.info?.message?.includes(
      'Verify that the node server is running',
    )
  ) {
    return 'Syncing state, Please wait and retry.';
  }
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.data) return JSON.stringify(error.data);
  return 'An unexpected error occurred';
}
function getContextSpecificAuthConfig(
  agreementContextID: string,
  agreementContextUserID: string,
) {
  const baseAuthConfig = getAuthConfig();
  return {
    appEndpointKey: getAppEndpointKey(),
    contextId: agreementContextID,
    executorPublicKey: agreementContextUserID,
    jwtToken: baseAuthConfig.jwtToken,
    error: null,
  };
}

export class ClientApiDataSource implements ClientApi {
  private app: any;

  constructor(app?: any) {
    this.app = app;
  }
  async addParticipant(
    contextId: string,
    userId: UserId,
    permission: PermissionLevel,
    agreementContextID?: string,
    agreementContextUserID?: string,
  ): ApiResponse<void> {
    try {
      const authConfig =
        agreementContextID && agreementContextUserID
          ? getContextSpecificAuthConfig(
              agreementContextID,
              agreementContextUserID,
            )
          : getAuthConfig();

      const response = await rpcClient.execute({
        ...authConfig,
        method: ClientMethod.ADD_PARTICIPANT,
        argsJson: {
          context_id: contextId,
          user_id: userId,
          permission: permission,
        },
      } as RpcQueryParams<any>);

      if (response?.error) {
        return {
          data: undefined,
          error: {
            code: response.error.code ?? 500,
            message: getErrorMessage(response.error),
          },
        };
      }

      return {
        data: undefined,
        error: null,
      };
    } catch (error: any) {
      console.error('ClientApiDataSource: Error in addParticipant:', error);
      return {
        data: undefined,
        error: {
          code: 500,
          message: getErrorMessage(error),
        },
      };
    }
  }

  async isDefaultPrivateContext(): ApiResponse<boolean> {
    try {
      if (this.app) {
        const defaultContextService = new DefaultContextService(this.app);
        const defaultContext = defaultContextService.getStoredDefaultContext();

        if (!defaultContext) {
          throw new Error(
            'Default context not found. Please ensure you are connected to Calimero and have a default context initialized.',
          );
        }

        const result = await this.app.execute(
          defaultContext,
          ClientMethod.IS_DEFAULT_PRIVATE_CONTEXT,
          {},
        );

        return {
          data: result.data || result,
          error: null,
        };
      } else {
        // Fallback to old API
        const authConfig = getAuthConfig();

        const response = await rpcClient.execute({
          ...authConfig,
          method: ClientMethod.IS_DEFAULT_PRIVATE_CONTEXT,
          argsJson: {},
        } as RpcQueryParams<any>);

        if (response?.error) {
          return {
            data: undefined,
            error: {
              code: response.error.code ?? 500,
              message: getErrorMessage(response.error),
            },
          };
        }

        const data = response.result?.output || response.result;

        return {
          data: data as boolean,
          error: null,
        };
      }
    } catch (error: any) {
      console.error(
        'ClientApiDataSource: Error in isDefaultPrivateContext:',
        error,
      );
      return {
        data: undefined,
        error: {
          code: 500,
          message: getErrorMessage(error),
        },
      };
    }
  }
  async getContextDetails(
    contextId: string,
    agreementContextID?: string,
    agreementContextUserID?: string,
  ): ApiResponse<ContextDetails> {
    try {
      const authConfig =
        agreementContextID && agreementContextUserID
          ? getContextSpecificAuthConfig(
              agreementContextID,
              agreementContextUserID,
            )
          : getAuthConfig();

      const response = await rpcClient.execute({
        ...authConfig,
        method: ClientMethod.GET_CONTEXT_DETAILS,
        argsJson: {
          context_id: contextId,
        },
      } as RpcQueryParams<any>);

      if (response?.error) {
        return {
          data: undefined,
          error: {
            code: response.error.code ?? 500,
            message: getErrorMessage(response.error),
          },
        };
      }

      const data = response.result?.output || response.result;

      return {
        data: data as ContextDetails,
        error: null,
      };
    } catch (error: any) {
      console.error('ClientApiDataSource: Error in getContextDetails:', error);
      return {
        data: null,
        error: {
          code: error.code || 500,
          message: getErrorMessage(error),
        },
      };
    }
  }
  async signDocument(
    contextId: string,
    documentId: string,
    pdfBlobIdStr: string,
    fileSize: number,
    newHash: string,
    signerId: string,
    agreementContextID?: string,
    agreementContextUserID?: string,
  ): ApiResponse<void> {
    try {
      const authConfig =
        agreementContextID && agreementContextUserID
          ? getContextSpecificAuthConfig(
              agreementContextID,
              agreementContextUserID,
            )
          : getAuthConfig();

      if (!authConfig || !authConfig.contextId || !signerId) {
        return {
          data: null,
          error: {
            code: 500,
            message: 'Authentication configuration not found',
          },
        };
      }

      const params: RpcQueryParams<{
        context_id: string;
        document_id: string;
        pdf_blob_id_str: string;
        file_size: number;
        new_hash: string;
        signer_id: string;
      }> = {
        contextId: contextId,
        method: ClientMethod.SIGN_DOCUMENT,
        argsJson: {
          context_id: contextId,
          document_id: documentId,
          pdf_blob_id_str: pdfBlobIdStr,
          file_size: fileSize,
          new_hash: newHash,
          signer_id: signerId,
        },
        executorPublicKey: signerId,
      };

      const response = await rpcClient.execute<
        {
          context_id: string;
          document_id: string;
          pdf_blob_id_str: string;
          file_size: number;
          new_hash: string;
          signer_id: string;
        },
        void
      >(params, RequestConfig);

      if (response?.error) {
        return {
          error: {
            code: response.error.code ?? 500,
            message: getErrorMessage(response.error),
          },
        };
      }

      return {
        data: undefined,
        error: null,
      };
    } catch (error) {
      console.error('ClientApiDataSource: Error in signDocument:', error);
      return {
        error: {
          code: 500,
          message:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred',
        },
      };
    }
  }

  // private dataURLToUint8Array(dataURL: string): Uint8Array {
  //   const base64String = dataURL.split(',')[1];
  //   const binaryString = atob(base64String);
  //   const bytes = new Uint8Array(binaryString.length);
  //   for (let i = 0; i < binaryString.length; i++) {
  //     bytes[i] = binaryString.charCodeAt(i);
  //   }
  //   return bytes;
  // }

  // private uint8ArrayToDataURL(uint8Array: Uint8Array): string {
  //   const base64String = btoa(String.fromCharCode(...uint8Array));
  //   return `data:image/png;base64,${base64String}`;
  // }

  async createSignature(
    name: string,
    blobIdStr: string,
    dataSize: number,
    contextId?: string,
    agreementContextID?: string,
    agreementContextUserID?: string,
    signatureContextUserID?: string,
  ): Promise<any> {
    try {
      if (this.app) {
        const defaultContextService = new DefaultContextService(this.app);
        const defaultContext = defaultContextService.getStoredDefaultContext();

        if (!defaultContext) {
          throw new Error(
            'Default context not found. Please ensure you are connected to Calimero and have a default context initialized.',
          );
        }

        const params = {
          name,
          blob_id_str: blobIdStr,
          data_size: dataSize,
        };

        const result = await this.app.execute(
          defaultContext,
          ClientMethod.CREATE_SIGNATURE,
          params,
        );

        return {
          data: result.data || result,
        };
      } else {
        // Fallback to old API

        let authConfig;
        if (contextId) {
          // Use the signature context as the main context
          const baseAuthConfig = getAuthConfig();
          authConfig = {
            ...baseAuthConfig,
            contextId: contextId,
            executorPublicKey:
              signatureContextUserID || baseAuthConfig.executorPublicKey,
          };
        } else {
          authConfig =
            agreementContextID && agreementContextUserID
              ? getContextSpecificAuthConfig(
                  agreementContextID,
                  agreementContextUserID,
                )
              : getAuthConfig();
        }

        const argsJson: any = {
          name,
          blob_id_str: blobIdStr,
          data_size: dataSize,
        };

        const response = await rpcClient.execute({
          ...authConfig,
          method: ClientMethod.CREATE_SIGNATURE,
          argsJson,
        } as RpcQueryParams<any>);
        return {
          data: response.result,
        };
      }
    } catch (error: any) {
      console.error('ClientApiDataSource: Error in createSignature:', error);
      return {
        error: error,
      };
    }
  }

  async deleteSignature(
    signatureId: number,
    contextId?: string,
    agreementContextID?: string,
    agreementContextUserID?: string,
    signatureContextUserID?: string,
  ): Promise<any> {
    try {
      if (this.app) {
        const defaultContextService = new DefaultContextService(this.app);
        const defaultContext = defaultContextService.getStoredDefaultContext();

        if (!defaultContext) {
          throw new Error(
            'Default context not found. Please ensure you are connected to Calimero and have a default context initialized.',
          );
        }

        const params = {
          signature_id: signatureId,
        };

        const result = await this.app.execute(
          defaultContext,
          ClientMethod.DELETE_SIGNATURE,
          params,
        );

        return {
          data: result.data || result,
        };
      } else {
        // Fallback to old API
        let authConfig;
        if (contextId) {
          const baseAuthConfig = getAuthConfig();
          authConfig = {
            ...baseAuthConfig,
            contextId: contextId,
            executorPublicKey:
              signatureContextUserID || baseAuthConfig.executorPublicKey,
          };
        } else {
          authConfig =
            agreementContextID && agreementContextUserID
              ? getContextSpecificAuthConfig(
                  agreementContextID,
                  agreementContextUserID,
                )
              : getAuthConfig();
        }

        const argsJson: any = {
          signature_id: signatureId,
        };

        const response = await rpcClient.execute({
          ...authConfig,
          method: ClientMethod.DELETE_SIGNATURE,
          argsJson,
        } as RpcQueryParams<any>);
        return {
          data: response.result,
        };
      }
    } catch (error: any) {
      console.error('ClientApiDataSource: Error in deleteSignature:', error);
      return {
        error: error,
      };
    }
  }

  async listSignatures(
    contextId?: string,
    agreementContextID?: string,
    agreementContextUserID?: string,
    signatureContextUserID?: string,
  ): Promise<any> {
    try {
      if (this.app) {
        const defaultContextService = new DefaultContextService(this.app);
        const defaultContext = defaultContextService.getStoredDefaultContext();

        if (!defaultContext) {
          throw new Error(
            'Default context not found. Please ensure you are connected to Calimero and have a default context initialized.',
          );
        }

        const result = await this.app.execute(
          defaultContext,
          ClientMethod.LIST_SIGNATURES,
          {},
        );

        const extractedData = result.data || result;

        if (
          Array.isArray(extractedData) &&
          extractedData.length > 0 &&
          typeof extractedData[0] === 'number'
        ) {
          return {
            data: {
              output: extractedData,
              isPngData: true,
            },
          };
        }

        return {
          data: extractedData,
        };
      } else {
        // Fallback to old API

        let authConfig;
        if (contextId) {
          const baseAuthConfig = getAuthConfig();
          authConfig = {
            ...baseAuthConfig,
            contextId: contextId,
            executorPublicKey:
              signatureContextUserID || baseAuthConfig.executorPublicKey,
          };
        } else {
          authConfig =
            agreementContextID && agreementContextUserID
              ? getContextSpecificAuthConfig(
                  agreementContextID,
                  agreementContextUserID,
                )
              : getAuthConfig();
        }

        const response = await rpcClient.execute({
          ...authConfig,
          method: ClientMethod.LIST_SIGNATURES,
          argsJson: {},
        } as RpcQueryParams<any>);

        const extractedData = response.result?.output || response.result;

        if (
          Array.isArray(extractedData) &&
          extractedData.length > 0 &&
          typeof extractedData[0] === 'number'
        ) {
          return {
            data: {
              output: extractedData,
              isPngData: true,
            },
          };
        }

        return {
          data: extractedData,
        };
      }
    } catch (error: any) {
      console.error('ClientApiDataSource: Error in listSignatures:', error);
      return {
        error: {
          code: error.code || 500,
          message: getErrorMessage(error),
        },
      };
    }
  }

  async joinSharedContext(
    contextId: string,
    sharedIdentity: UserId,
    name: string,
  ): Promise<any> {
    try {
      if (!sharedIdentity) {
        throw new Error(
          'sharedIdentity parameter is required but was not provided',
        );
      }

      if (this.app) {
        const defaultContextService = new DefaultContextService(this.app);
        const defaultContext = defaultContextService.getStoredDefaultContext();

        if (!defaultContext) {
          throw new Error(
            'Default context not found. Please ensure you are connected to Calimero and have a default context initialized.',
          );
        }

        const params = {
          context_id: contextId,
          shared_identity: sharedIdentity,
          context_name: name,
        };

        const result = await this.app.execute(
          defaultContext,
          ClientMethod.JOIN_SHARED_CONTEXT,
          params,
        );

        return {
          data: result.data || result,
        };
      } else {
        // Fallback to old API
        const argsJson: any = {
          context_id: contextId,
          shared_identity: sharedIdentity,
          context_name: name,
        };
        const response = await rpcClient.execute({
          ...getAuthConfig(),
          method: ClientMethod.JOIN_SHARED_CONTEXT,
          argsJson,
        } as RpcQueryParams<any>);
        return {
          data: response.result,
        };
      }
    } catch (error: any) {
      console.error('ClientApiDataSource: Error in joinSharedContext:', error);
      return {
        error: error,
      };
    }
  }

  async listJoinedContexts(): Promise<any> {
    try {
      if (this.app) {
        // Get default context using the service
        const defaultContextService = new DefaultContextService(this.app);
        const defaultContext = defaultContextService.getStoredDefaultContext();

        if (!defaultContext) {
          throw new Error(
            'Default context not found. Please ensure you are connected to Calimero and have a default context initialized.',
          );
        }

        const result = await this.app.execute(
          defaultContext,
          ClientMethod.LIST_JOINED_CONTEXTS,
          {},
        );

        return {
          data: result.data || result,
        };
      } else {
        // Fallback to old API

        const authConfig = getAuthConfig();

        const response = await rpcClient.execute({
          ...authConfig,
          method: ClientMethod.LIST_JOINED_CONTEXTS,
          argsJson: {},
        } as RpcQueryParams<any>);

        const data = response.result?.output || response.result;

        return {
          data: data,
        };
      }
    } catch (error: any) {
      console.error('ClientApiDataSource: Error in listJoinedContexts:', error);
      return {
        error: error,
      };
    }
  }

  async leaveSharedContext(contextId: string): Promise<any> {
    try {
      const response = await rpcClient.execute({
        ...getAuthConfig(),
        method: ClientMethod.LEAVE_SHARED_CONTEXT,
        argsJson: {
          context_id: contextId,
        },
      } as RpcQueryParams<any>);
      return {
        data: response.result,
      };
    } catch (error: any) {
      return {
        error: error,
      };
    }
  }

  async uploadDocument(
    contextId: string,
    name: string,
    hash: string,
    pdfBlobIdStr: string,
    fileSize: number,
    agreementContextID?: string,
    agreementContextUserID?: string,
  ): Promise<any> {
    try {
      const authConfig =
        agreementContextID && agreementContextUserID
          ? getContextSpecificAuthConfig(
              agreementContextID,
              agreementContextUserID,
            )
          : getAuthConfig();

      const response = await rpcClient.execute({
        ...authConfig,
        method: ClientMethod.UPLOAD_DOCUMENT,
        argsJson: {
          context_id: contextId,
          name,
          hash,
          pdf_blob_id_str: pdfBlobIdStr,
          file_size: fileSize,
        },
      } as RpcQueryParams<any>);

      if (response?.error) {
        return {
          data: null,
          error: {
            code: response.error.code ?? 500,
            message: getErrorMessage(response.error),
          },
        };
      }

      const data = response.result?.output || response.result;

      return {
        data: data,
        error: null,
      };
    } catch (error: any) {
      console.error('ClientApiDataSource: Error in uploadDocument:', error);
      return {
        data: null,
        error: {
          code: error.code || 500,
          message: getErrorMessage(error),
        },
      };
    }
  }

  async deleteDocument(
    documentId: string,
    agreementContextID?: string,
    agreementContextUserID?: string,
  ): Promise<any> {
    try {
      const authConfig =
        agreementContextID && agreementContextUserID
          ? getContextSpecificAuthConfig(
              agreementContextID,
              agreementContextUserID,
            )
          : getAuthConfig();

      const response = await rpcClient.execute({
        ...authConfig,
        method: ClientMethod.DELETE_DOCUMENT,
        argsJson: {
          context_id: agreementContextID || '',
          document_id: documentId,
        },
      } as RpcQueryParams<any>);

      if (response?.error) {
        return {
          data: null,
          error: {
            code: response.error.code ?? 500,
            message: getErrorMessage(response.error),
          },
        };
      }

      return {
        data: undefined,
        error: null,
      };
    } catch (error: any) {
      console.error('ClientApiDataSource: Error in deleteDocument:', error);
      return {
        data: null,
        error: {
          code: error.code || 500,
          message: getErrorMessage(error),
        },
      };
    }
  }

  async listDocuments(
    contextId: string,
    agreementContextID?: string,
    agreementContextUserID?: string,
  ): Promise<any> {
    try {
      const authConfig =
        agreementContextID && agreementContextUserID
          ? getContextSpecificAuthConfig(
              agreementContextID,
              agreementContextUserID,
            )
          : getAuthConfig();

      const response = await rpcClient.execute({
        ...authConfig,
        method: ClientMethod.LIST_DOCUMENTS,
        argsJson: {
          context_id: contextId,
        },
      } as RpcQueryParams<any>);

      if (response?.error) {
        return {
          data: null,
          error: {
            code: response.error.code ?? 500,
            message: getErrorMessage(response.error),
          },
        };
      }

      const data = response.result?.output || response.result;

      return {
        data: data,
        error: null,
      };
    } catch (error: any) {
      console.error('ClientApiDataSource: Error in listDocuments:', error);
      return {
        data: null,
        error: {
          code: error.code || 500,
          message: getErrorMessage(error),
        },
      };
    }
  }

  async markParticipantSigned(
    contextId: string,
    documentId: string,
    userId: string,
    agreementContextID?: string,
    agreementContextUserID?: string,
  ): ApiResponse<void> {
    try {
      const authConfig =
        agreementContextID && agreementContextUserID
          ? getContextSpecificAuthConfig(
              agreementContextID,
              agreementContextUserID,
            )
          : getAuthConfig();

      const response = await rpcClient.execute({
        ...authConfig,
        method: ClientMethod.MARK_PARTICIPANT_SIGNED,
        argsJson: {
          context_id: contextId,
          document_id: documentId,
          user_id: userId,
        },
      } as RpcQueryParams<any>);

      if (response?.error) {
        return {
          data: undefined,
          error: {
            code: response.error.code ?? 500,
            message: getErrorMessage(response.error),
          },
        };
      }

      return {
        data: undefined,
        error: null,
      };
    } catch (error: any) {
      console.error(
        'ClientApiDataSource: Error in markParticipantSigned:',
        error,
      );
      return {
        data: null,
        error: {
          code: error.code || 500,
          message: getErrorMessage(error),
        },
      };
    }
  }
}

export function getWsSubscriptionsClient() {
  const appEndpointKey = getAppEndpointKey();
  if (!appEndpointKey) {
    throw new Error(
      'Application endpoint key is missing. Please check your configuration.',
    );
  }
  return new WsSubscriptionsClient(appEndpointKey, '/ws');
}
