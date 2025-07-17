import { ClientApiDataSource } from './dataSource/ClientApiDataSource';
import { DocumentInfo, Document } from './clientApi';

export class DocumentService {
  private clientApi: ClientApiDataSource;

  constructor() {
    this.clientApi = new ClientApiDataSource();
  }

  async uploadDocument(
    contextId: string,
    name: string,
    file: File,
    agreementContextID?: string,
    agreementContextUserID?: string,
  ): Promise<{ data?: string; error?: any }> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfData = new Uint8Array(arrayBuffer);
      const hash = await this.calculateFileHash(pdfData);

      const response = await this.clientApi.uploadDocument(
        contextId,
        name,
        hash,
        pdfData,
        agreementContextID,
        agreementContextUserID,
      );

      return {
        data: response.data || undefined,
        error: response.error,
      };
    } catch (error) {
      console.error('Error uploading document:', error);
      return { error: { message: 'Failed to upload document' } };
    }
  }

  async listDocuments(
    contextId: string,
    agreementContextID?: string,
    agreementContextUserID?: string,
  ): Promise<{ data?: Document[]; error?: any }> {
    try {
      const response = await this.clientApi.listDocuments(
        contextId,
        agreementContextID,
        agreementContextUserID,
      );

      if (response.error) {
        return { error: response.error };
      }

      const documents: DocumentInfo[] = response.data || [];
      const formattedDocuments: Document[] = documents.map((doc) =>
        this.formatDocument(doc),
      );

      return { data: formattedDocuments };
    } catch (error) {
      console.error('Error listing documents:', error);
      return { error: { message: 'Failed to list documents' } };
    }
  }

  async getDocument(
    contextId: string,
    documentId: string,
  ): Promise<{ data?: Document; error?: any }> {
    try {
      const response = await this.clientApi.getDocument(contextId, documentId);

      if (response.error) {
        return { error: response.error };
      }

      const documentInfo = response.data;
      if (!documentInfo) {
        return { error: { message: 'Document not found' } };
      }

      const formattedDocument = this.formatDocument(documentInfo);

      return { data: formattedDocument };
    } catch (error) {
      console.error('Error getting document:', error);
      return { error: { message: 'Failed to get document' } };
    }
  }

  async signDocument(
    contextId: string,
    documentId: string,
    updatedPdfFile: File,
  ): Promise<{ data?: void; error?: any }> {
    try {
      const arrayBuffer = await updatedPdfFile.arrayBuffer();
      const updatedPdfData = new Uint8Array(arrayBuffer);

      const newHash = await this.calculateFileHash(updatedPdfData);

      const response = await this.clientApi.signDocument(
        contextId,
        documentId,
        updatedPdfData,
        newHash,
      );
      return {
        data: response.data === null ? undefined : response.data,
        error: response.error,
      };
    } catch (error) {
      console.error('Error signing document:', error);
      return { error: { message: 'Failed to sign document' } };
    }
  }

  private formatDocument(documentInfo: DocumentInfo): Document {
    return {
      id: documentInfo.id,
      name: documentInfo.name,
      size: this.formatFileSize(documentInfo.size),
      uploadedAt: new Date(documentInfo.uploaded_at).toLocaleDateString(),
      status: documentInfo.status,
      uploadedBy: documentInfo.uploaded_by,
      hash: documentInfo.hash,
      pdfBlobId: documentInfo.pdf_blob_id,
    };
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private async calculateFileHash(data: Uint8Array): Promise<string> {
    const buffer = new Uint8Array(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
