import {
  type ApiResponse,
  type RpcQueryParams,
  rpcClient,
  getAuthConfig,
  getAppEndpointKey,
} from '@calimero-network/calimero-client';
import { ClientApi, ClientMethod, ContextDetails, UserId } from '../clientApi';

const RequestConfig = { timeout: 30000 };

function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.data) return JSON.stringify(error.data);
  return 'An unexpected error occurred';
}

function getContextSpecificAuthConfig(
  agreementContextID: string,
  agreementContextUserID: string,
) {
  return {
    appEndpointKey: getAppEndpointKey(),
    contextId: agreementContextID,
    executorPublicKey: agreementContextUserID,
    jwtToken: null,
    error: null,
  };
}

export class ClientApiDataSource implements ClientApi {
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
          data: null,
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
    updatedPdfData: Uint8Array,
    newHash: string,
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

      if (
        !authConfig ||
        !authConfig.contextId ||
        !authConfig.executorPublicKey
      ) {
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
        updated_pdf_data: number[];
        new_hash: string;
      }> = {
        contextId: contextId,
        method: ClientMethod.SIGN_DOCUMENT,
        argsJson: {
          context_id: contextId,
          document_id: documentId,
          updated_pdf_data: Array.from(updatedPdfData),
          new_hash: newHash,
        },
        executorPublicKey: authConfig.executorPublicKey,
      };

      const response = await rpcClient.execute<
        {
          context_id: string;
          document_id: string;
          updated_pdf_data: number[];
          new_hash: string;
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

  private dataURLToUint8Array(dataURL: string): Uint8Array {
    const base64String = dataURL.split(',')[1];
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private uint8ArrayToDataURL(uint8Array: Uint8Array): string {
    const base64String = btoa(String.fromCharCode(...uint8Array));
    return `data:image/png;base64,${base64String}`;
  }

  async createSignature(name: string, pngData: Uint8Array): Promise<any> {
    try {
      const response = await rpcClient.execute({
        ...getAuthConfig(),
        method: ClientMethod.CREATE_SIGNATURE,
        argsJson: {
          name,
          png_data: Array.from(pngData),
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

  async deleteSignature(signatureId: number): Promise<any> {
    try {
      const response = await rpcClient.execute({
        ...getAuthConfig(),
        method: ClientMethod.DELETE_SIGNATURE,
        argsJson: {
          signature_id: signatureId,
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

  async listSignatures(): Promise<any> {
    try {
      const response = await rpcClient.execute({
        ...getAuthConfig(),
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

  async getSignatureData(signatureId: number): Promise<any> {
    try {
      const response = await rpcClient.execute({
        ...getAuthConfig(),
        method: ClientMethod.GET_SIGNATURE_DATA,
        argsJson: {
          signature_id: signatureId,
        },
      } as RpcQueryParams<any>);

      const uint8Array = new Uint8Array(response.result as number[]);

      return {
        data: uint8Array,
      };
    } catch (error: any) {
      return {
        error: error,
      };
    }
  }

  async joinSharedContext(
    contextId: string,
    contextName: string,
    role: string,
    sharedIdentity: UserId,
  ): Promise<any> {
    try {
      const response = await rpcClient.execute({
        ...getAuthConfig(),
        method: ClientMethod.JOIN_SHARED_CONTEXT,
        argsJson: {
          context_id: contextId,
          context_name: contextName,
          role,
          shared_identity: sharedIdentity,
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

  async listJoinedContexts(): Promise<any> {
    try {
      const response = await rpcClient.execute({
        ...getAuthConfig(),
        method: ClientMethod.LIST_JOINED_CONTEXTS,
        argsJson: {},
      } as RpcQueryParams<any>);

      const data = response.result?.output || response.result;

      return {
        data: data,
      };
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
    pdfData: Uint8Array,
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
          pdf_data: Array.from(pdfData),
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

  async getDocument(contextId: string, documentId: string): Promise<any> {
    try {
      const response = await rpcClient.execute({
        ...getAuthConfig(),
        method: ClientMethod.GET_DOCUMENT,
        argsJson: {
          context_id: contextId,
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

      const data = response.result?.output || response.result;

      return {
        data: data,
        error: null,
      };
    } catch (error: any) {
      console.error('ClientApiDataSource: Error in getDocument:', error);
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
