import React, { useState, useEffect, useCallback } from 'react';
import { PenTool, Plus, Trash2 } from 'lucide-react';
import { MobileLayout } from '../../components/MobileLayout';
import SignaturePadComponent from '../../components/SignaturePad';
import { ClientApiDataSource } from '../../api/dataSource/ClientApiDataSource';
import { useCalimero } from '@calimero-network/calimero-client';

const api = new ClientApiDataSource();

interface SavedSignature {
  id: string;
  name: string;
  dataURL: string;
  createdAt: string;
}

export default function SignaturesPage() {
  const { app } = useCalimero();
  const [signatures, setSignatures] = useState<SavedSignature[]>([]);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [deleteSignatureId, setDeleteSignatureId] = useState<string | null>(
    null,
  );

  const fetchSignatures = useCallback(async () => {
    try {
      // For signatures, we need to use a private context
      let signatureContextId = localStorage.getItem('signatureContextId');
      const agreementContextID = localStorage.getItem('agreementContextID');
      const agreementContextUserID = localStorage.getItem('agreementContextUserID');
      
              // If no signature context exists, create one
        if (!signatureContextId && app) {
          try {
            console.log('Creating private context for signatures...');
            const contextResult = await (app as any).createContext(undefined, {
              is_private: true,
              context_name: 'Signatures Private Context',
            });
            
            if (contextResult && contextResult.contextId) {
              signatureContextId = contextResult.contextId as string;
              const signatureContextUserID = contextResult.memberPublicKey as string;
              localStorage.setItem('signatureContextId', signatureContextId);
              localStorage.setItem('signatureContextUserID', signatureContextUserID);
              console.log('Created signature context:', signatureContextId, 'with user ID:', signatureContextUserID);
            }
          } catch (error) {
            console.error('Failed to create signature context:', error);
            // If we can't create a context, just return empty signatures
            setSignatures([]);
            return;
          }
        }
      
      // If still no signature context, return empty list
      if (!signatureContextId) {
        console.log('No signature context available, returning empty list');
        setSignatures([]);
        return;
      }
      
      const signatureContextUserID = localStorage.getItem('signatureContextUserID');
      
      console.log('Debug signature context:', {
        signatureContextId,
        signatureContextUserID,
        agreementContextID,
        agreementContextUserID
      });
      
      // Try to get the current user's public key from the app object
      let currentUserPublicKey = signatureContextUserID;
      if (app && !currentUserPublicKey) {
        try {
          // Try to get the current user's public key from the app
          const userInfo = await (app as any).getCurrentUser();
          if (userInfo && userInfo.publicKey) {
            currentUserPublicKey = userInfo.publicKey;
            console.log('Got current user public key from app:', currentUserPublicKey);
          }
        } catch (error) {
          console.error('Failed to get current user from app:', error);
        }
      }
      
      // If still no public key, use agreement context user ID as fallback
      if (!currentUserPublicKey && agreementContextUserID) {
        currentUserPublicKey = agreementContextUserID;
        console.log('Using agreement context user ID as fallback:', currentUserPublicKey);
      }
      
      const response = await api.listSignatures(
        signatureContextId!,
        agreementContextID || undefined,
        agreementContextUserID || undefined,
        currentUserPublicKey || undefined,
      );
      if (!response.data || !Array.isArray(response.data)) {
        setSignatures([]);
        return;
      }

      // Use the signature context ID for blob operations
      const contextIdForBlobs = signatureContextId;
      
      const signaturesWithImages = await Promise.all(
        response.data.map(async (sig: any) => {
          let dataURL = '';
          try {
            const blobId =
              typeof sig.blob_id === 'string'
                ? sig.blob_id
                : Buffer.from(sig.blob_id).toString('hex');

            if (app) {
              const result = await (app as any).downloadBlob(blobId);
              if (result && result.data) {
                const blob = result.data;
                dataURL = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                });
              }
            }
          } catch (e) {
            console.error(
              `Failed to fetch signature PNG for blobId ${sig.blob_id}:`,
              e,
            );
          }
          return {
            id: sig.id.toString(),
            name: sig.name,
            dataURL,
            createdAt: new Date(sig.created_at).toLocaleDateString(),
          };
        }),
      );
      setSignatures(signaturesWithImages);
    } catch (error) {
      console.error('Failed to list signatures:', error);
      setSignatures([]);
    }
  }, [app]);

  useEffect(() => {
    fetchSignatures();
  }, [fetchSignatures]);

  const dataURLToBlob = (dataURL: string): Blob => {
    const arr = dataURL.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const uploadSignatureBlob = async (blob: Blob) => {
    const file = new File([blob], 'signature.png', { type: blob.type });
    const signatureContextId = localStorage.getItem('signatureContextId');
    const onProgress = (progress: number) => {};

    if (!app) {
      throw new Error('App not initialized');
    }

    const result = await (app as any).uploadBlob(file, onProgress);

    // Handle different possible return formats (same as agreement page)
    let blobId: string | undefined;
    
    if (result.data && result.data.blobId) {
      // Expected format: { data: { blobId: string } }
      blobId = result.data.blobId;
    } else if (result.blobId) {
      // Alternative format: { blobId: string }
      blobId = result.blobId;
    } else if (typeof result === 'string') {
      // Direct string format: "blobId"
      blobId = result;
    }

    if (!blobId) {
      const errorMessage = 'Failed to get blob ID from upload';
      console.error(`Upload failed:`, errorMessage);
      console.error('uploadBlob result structure:', result);
      throw new Error(errorMessage);
    }

    console.log(`Upload completed: ${blobId}`);
    return {
      blobId: blobId,
      size: file.size,
    };
  };

  const handleCreateSignature = () => {
    setShowSignaturePad(true);
  };

  const handleSaveSignature = async (signatureData: string) => {
    try {
      const blob = dataURLToBlob(signatureData);
      const { blobId, size } = await uploadSignatureBlob(blob);

      // Get current context ID from localStorage
      const currentContextId = localStorage.getItem('currentContextId');
      const agreementContextID = localStorage.getItem('agreementContextID');
      const agreementContextUserID = localStorage.getItem('agreementContextUserID');

      // For signatures, we need to use a private context
      // If we don't have a private context for signatures, create one
      let signatureContextId = localStorage.getItem('signatureContextId');
      
      if (!signatureContextId && app) {
        try {
          console.log('Creating private context for signatures...');
          const contextResult = await (app as any).createContext(undefined, {
            is_private: true,
            context_name: 'Signatures Private Context',
          });
          
          if (contextResult && contextResult.contextId) {
            signatureContextId = contextResult.contextId as string;
            const signatureContextUserID = contextResult.memberPublicKey as string;
            localStorage.setItem('signatureContextId', signatureContextId);
            localStorage.setItem('signatureContextUserID', signatureContextUserID);
            console.log('Created signature context:', signatureContextId, 'with user ID:', signatureContextUserID);
          }
        } catch (error) {
          console.error('Failed to create signature context:', error);
        }
      }

      const newSignatureName = `Signature ${signatures.length + 1}`;
      if (!signatureContextId) {
        throw new Error('Failed to create or retrieve signature context');
      }

      const signatureContextUserID = localStorage.getItem('signatureContextUserID');
      
      await api.createSignature(
        newSignatureName, 
        blobId, 
        size,
        signatureContextId,
        agreementContextID || undefined,
        agreementContextUserID || undefined,
        agreementContextUserID || undefined, // Use agreement context user ID as executor public key
      );

      await fetchSignatures();
    } catch (error) {
      console.error('Failed to save signature:', error);
    } finally {
      setShowSignaturePad(false);
    }
  };

  const handleCancelSignature = () => {
    setShowSignaturePad(false);
  };

  const handleDeleteSignature = (id: string) => {
    setDeleteSignatureId(id);
  };

  const confirmDeleteSignature = async () => {
    if (deleteSignatureId) {
      try {
        // For signatures, we need to use a private context
        const signatureContextId = localStorage.getItem('signatureContextId');
        const agreementContextID = localStorage.getItem('agreementContextID');
        const agreementContextUserID = localStorage.getItem('agreementContextUserID');

        if (!signatureContextId) {
          console.error('No signature context found');
          return;
        }

        const signatureContextUserID = localStorage.getItem('signatureContextUserID');
        
        await api.deleteSignature(
          Number(deleteSignatureId),
          signatureContextId,
          agreementContextID || undefined,
          agreementContextUserID || undefined,
          agreementContextUserID || undefined, // Use agreement context user ID as executor public key
        );
        await fetchSignatures();
      } catch (error) {
        console.error('Failed to delete signature:', error);
      } finally {
        setDeleteSignatureId(null);
      }
    }
  };

  const cancelDeleteSignature = () => {
    setDeleteSignatureId(null);
  };

  return (
    <MobileLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-current mb-2">
          Signature Library
        </h1>
        <p className="text-lg text-secondary">
          Manage your digital signatures for document signing
        </p>
      </div>

      {/* Action Bar */}
      <div className="flex justify-between items-center mb-6 gap-4">
        <button
          onClick={handleCreateSignature}
          className="flex items-center gap-2 px-6 py-3 rounded-lg border border-primary bg-primary text-black font-medium cursor-pointer transition-all duration-200 min-h-[44px] hover:-translate-y-1 hover:shadow-button active:translate-y-0"
        >
          <Plus size={20} />
          Create New Signature
        </button>
      </div>

      {/* Signatures Grid or Empty State */}
      {signatures.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-4">
          {signatures.map((signature) => (
            <div
              key={signature.id}
              className="bg-card border border-current rounded-xl p-6 transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-large hover:border-primary"
            >
              <div className="h-20 bg-surface border border-current rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                {signature.dataURL ? (
                  <img
                    src={signature.dataURL}
                    alt={signature.name}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-sm text-secondary">Loading...</div>
                )}
              </div>
              <div className="text-lg font-semibold text-current mb-2">
                {signature.name}
              </div>
              <div className="text-sm text-secondary mb-4">
                Created: {signature.createdAt}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDeleteSignature(signature.id)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded border border-red-500 bg-red-500 text-white text-sm cursor-pointer transition-all duration-200 min-h-[36px] hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-secondary">
          <PenTool className="w-16 h-16 mx-auto mb-6 text-muted" />
          <div className="text-xl font-semibold text-current mb-2">
            No Signatures Yet
          </div>
          <div className="text-base mb-6">
            Create your first digital signature to start signing documents
          </div>
        </div>
      )}

      {/* Signature Pad Modal */}
      <SignaturePadComponent
        isOpen={showSignaturePad}
        onSave={handleSaveSignature}
        onCancel={handleCancelSignature}
      />

      {/* Delete Confirmation Modal */}
      {deleteSignatureId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-card rounded-lg p-6 shadow-lg max-w-sm w-full border border-current">
            <h2 className="text-lg font-semibold mb-4 text-current">
              Delete Signature
            </h2>
            <p className="mb-6 text-secondary">
              Are you sure you want to delete this signature? This action cannot
              be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelDeleteSignature}
                className="px-4 py-2 rounded border border-current bg-transparent text-current hover:bg-surface"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSignature}
                className="px-4 py-2 rounded border border-red-500 bg-red-500 text-white hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileLayout>
  );
}
