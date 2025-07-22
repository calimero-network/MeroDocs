import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAppEndpointKey,
  getApplicationId,
  blobClient,
} from '@calimero-network/calimero-client';
import {
  ArrowLeft,
  Plus,
  Search,
  Users,
  Upload,
  FileText,
  Eye,
  X,
  Trash2,
  Download,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button, Card, CardContent } from '../../components/ui';
import { MobileLayout } from '../../components/MobileLayout';
import PDFViewer from '../../components/PDFViewer';
import { useTheme } from '../../contexts/ThemeContext';
import { DocumentService } from '../../api/documentService';
import { ClientApiDataSource } from '../../api/dataSource/ClientApiDataSource';
import { ContextApiDataSource } from '../../api/dataSource/nodeApiDataSource';
import { ContextDetails } from '../../api/clientApi';

// Constants

const ANIMATION_VARIANTS = {
  container: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  },
  item: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  },
} as const;

interface UploadedDocument {
  id: string;
  name: string;
  size: string;
  file?: File;
  uploadedAt: string;
  status: string;
  uploadedBy?: string;
  hash?: string;
  pdfBlobId?: string;
}

interface FileUpload {
  file: File;
  progress: number;
  uploading: boolean;
  uploaded: boolean;
  error?: string;
  blob_id?: string;
}

const generateInvitePayload = async (
  nodeApiService: ContextApiDataSource,
  contextId: string,
  inviter: string,
  invitee: string,
): Promise<string> => {
  try {
    const response = await nodeApiService.inviteToContext({
      contextId,
      inviter,
      invitee,
    });

    if (response && typeof response === 'object' && 'data' in response) {
      return response.data as string;
    }

    if (typeof response === 'string') {
      return response;
    }

    return JSON.stringify(response, null, 2);
  } catch (error) {
    console.error('Failed to generate invite:', error);

    return `INVITE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
};

const AgreementPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mode } = useTheme();

  const documentService = useMemo(() => new DocumentService(), []);
  const clientApiService = useMemo(() => new ClientApiDataSource(), []);
  const nodeApiService = useMemo(() => new ContextApiDataSource(), []);

  const [searchQuery, setSearchQuery] = useState('');
  const [showParticipants, setShowParticipants] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteId, setInviteId] = useState('');
  const [generatedPayload, setGeneratedPayload] = useState('');
  const [showPayloadDialog, setShowPayloadDialog] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [uploadFiles, setUploadFiles] = useState<FileUpload[]>([]);
  const [selectedDocument, setSelectedDocument] =
    useState<UploadedDocument | null>(null);
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loadingPDFPreview, setLoadingPDFPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextDetails, setContextDetails] = useState<ContextDetails | null>(
    null,
  );
  const [contextLoading, setContextLoading] = useState(true);

  const currentContextId = useMemo(() => {
    const storedContextId = localStorage.getItem('agreementContextID');

    if (!storedContextId) {
      console.warn('No agreement context ID found in localStorage');
      navigate('/');
      return null;
    }
    return storedContextId;
  }, [navigate]);

  const loadContextDetails = useCallback(async () => {
    if (!currentContextId) return;

    try {
      setContextLoading(true);
      setError(null);

      const agreementContextID = localStorage.getItem('agreementContextID');
      const agreementContextUserID = localStorage.getItem(
        'agreementContextUserID',
      );

      const response = await clientApiService.getContextDetails(
        currentContextId,
        agreementContextID || undefined,
        agreementContextUserID || undefined,
      );

      if (response.error) {
        setError(response.error.message);
        setContextDetails(null);
      } else {
        setContextDetails(response.data);
      }
    } catch (err) {
      console.error('Failed to load context details:', err);
      setError('Failed to load context details');
      setContextDetails(null);
    } finally {
      setContextLoading(false);
    }
  }, [clientApiService, currentContextId]);

  const loadDocuments = useCallback(async () => {
    if (!currentContextId) return;

    try {
      setLoading(true);
      setError(null);

      const agreementContextID = localStorage.getItem('agreementContextID');
      const agreementContextUserID = localStorage.getItem(
        'agreementContextUserID',
      );

      const response = await documentService.listDocuments(
        currentContextId,
        agreementContextID || undefined,
        agreementContextUserID || undefined,
      );

      if (response.error) {
        setError(response.error.message);
        setDocuments([]);
      } else {
        const uploadedDocs: UploadedDocument[] = (response.data || []).map(
          (doc) => ({
            id: doc.id,
            name: doc.name,
            size: doc.size,
            uploadedAt: doc.uploadedAt,
            status: doc.status,
            uploadedBy: doc.uploadedBy,
            hash: doc.hash,
            pdfBlobId: doc.pdfBlobId,
          }),
        );
        setDocuments(uploadedDocs);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
      setError('Failed to load documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [documentService, currentContextId]);

  const filteredDocuments = useMemo(
    () =>
      documents.filter((doc) =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [documents, searchQuery],
  );

  useEffect(() => {
    const url = getAppEndpointKey();
    const applicationId = getApplicationId();

    if (!url || !applicationId) {
      navigate('/setup');
      return;
    }

    if (!currentContextId) {
      console.error('No context ID available');
      return;
    }

    loadContextDetails();
    loadDocuments();
  }, [navigate, loadContextDetails, loadDocuments, currentContextId]);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || !currentContextId) return;

      setUploading(true);
      setError(null);

      const agreementContextID = localStorage.getItem('agreementContextID');
      const agreementContextUserID = localStorage.getItem(
        'agreementContextUserID',
      );

   
      const file = files[0];
      if (!file) {
        setUploading(false);
        setError('No file selected');
        return;
      }

      if (file.type !== 'application/pdf') {
        setUploading(false);
        setError(
          `"${file.name}" is not a PDF file. Please upload only PDF files.`,
        );
        return;
      }

      setUploadFiles([
        {
          file,
          progress: 0,
          uploading: true,
          uploaded: false,
          error: undefined,
          blob_id: undefined,
        },
      ]);

      const response = await documentService.uploadDocument(
        currentContextId,
        file.name,
        file,
        agreementContextID || undefined,
        agreementContextUserID || undefined,
        (progress: number) => {
          setUploadFiles((prev) => prev.map((f) => ({ ...f, progress })));
        },
      );

      if (response.error) {
        setUploadFiles((prev) =>
          prev.map((f) => ({
            ...f,
            uploading: false,
            error: response.error.message,
          })),
        );
        setUploading(false);
        setError(response.error.message);
        console.error(`Failed to upload ${file.name}:`, response.error);
      } else {
        setUploadFiles((prev) =>
          prev.map((f) => ({
            ...f,
            uploading: false,
            uploaded: true,
            progress: 100,
          })),
        );
        setUploading(false);
        setError(null);
        setShowUploadModal(false);
        setUploadFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        alert('Document uploaded successfully!');
        await loadDocuments();
      }
    },
    [documentService, currentContextId, loadDocuments],
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemoveDocument = useCallback((documentId: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
  }, []);

  const handleOpenDocument = useCallback(async (document: UploadedDocument) => {
    if (!document.pdfBlobId) {
      alert('Document blob ID not available for preview');
      return;
    }

    try {
      setLoadingPDFPreview(true);

      const blob = await blobClient.downloadBlob(document.pdfBlobId, currentContextId || undefined);

      const file = new File([blob], document.name, { type: 'application/pdf' });

      setSelectedDocument({
        ...document,
        file: file,
      });
      setShowPDFViewer(true);
    } catch (error) {
      console.error(`Failed to load PDF for preview: ${document.name}`, error);
      alert(
        `Failed to load PDF for preview: "${document.name}". Please try again.`,
      );
    } finally {
      setLoadingPDFPreview(false);
    }
  }, []);

  const handleClosePDFViewer = useCallback(() => {
    setShowPDFViewer(false);
    setSelectedDocument(null);
  }, []);

  const handleDownloadDocument = useCallback(async (doc: UploadedDocument) => {
    if (!doc.pdfBlobId) {
      alert('Document blob ID not available for download');
      return;
    }

    try {
      const blob = await blobClient.downloadBlob(doc.pdfBlobId, currentContextId || undefined);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Failed to download document: ${doc.name}`, error);
      alert(`Failed to download "${doc.name}". Please try again.`);
    }
  }, []);

  const handleGenerateInvite = useCallback(async () => {
    if (!currentContextId || !inviteId.trim()) {
      alert('Please enter a valid invitee ID');
      return;
    }

    const agreementContextUserID = localStorage.getItem(
      'agreementContextUserID',
    );

    if (!agreementContextUserID) {
      alert('User ID not found. Please ensure you are logged in.');
      return;
    }

    try {
      setGeneratingInvite(true);
      const payload = await generateInvitePayload(
        nodeApiService,
        currentContextId,
        agreementContextUserID,
        inviteId.trim(),
      );
      setGeneratedPayload(payload);
      setShowPayloadDialog(true);
      setShowInviteModal(false);
      setInviteId(''); // Clear the input
    } catch (error) {
      console.error('Failed to generate invite:', error);
      alert('Failed to generate invite. Please try again.');
    } finally {
      setGeneratingInvite(false);
    }
  }, [currentContextId, inviteId, nodeApiService]);

  const handleCopyPayload = useCallback(() => {
    navigator.clipboard.writeText(generatedPayload);
    alert('Payload copied to clipboard!');
    setShowPayloadDialog(false);
  }, [generatedPayload]);

  return (
    <MobileLayout>
      <motion.div
        variants={ANIMATION_VARIANTS.container}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header */}
        <motion.section variants={ANIMATION_VARIANTS.item}>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/')}
                    className="p-2 h-auto w-auto"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div>
                    <h1 className="text-lg font-semibold text-foreground">
                      {contextDetails?.context_name || 'Loading...'}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {contextDetails?.participant_count || 0} participants
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowParticipants(!showParticipants)}
                    className="p-2 h-auto w-auto"
                  >
                    <Users className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Participants Panel */}
        {showParticipants && (
          <motion.section
            variants={ANIMATION_VARIANTS.item}
            initial="hidden"
            animate="visible"
            className="bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-800 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                className={`font-medium ${mode === 'dark' ? 'text-green-300' : 'text-green-900'}`}
              >
                Participants
              </h3>
              <Button
                onClick={() => setShowInviteModal(true)}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Plus className="w-4 h-4 mr-1" />
                Invite
              </Button>
            </div>
            <div className="space-y-3">
              {contextDetails?.participants?.map((participant, index) => (
                <div
                  key={participant.user_id}
                  className="flex items-center space-x-3"
                >
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {participant.user_id.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {participant.user_id.slice(0, 8)}...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {participant.permission_level}
                    </p>
                  </div>
                </div>
              )) || (
                <div className="text-sm text-muted-foreground">
                  {contextLoading
                    ? 'Loading participants...'
                    : 'No participants found'}
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* Search Bar */}
        <motion.section variants={ANIMATION_VARIANTS.item} className="px-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 sm:py-3 text-sm sm:text-base border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300"
            />
          </div>
        </motion.section>

        {/* Documents List */}
        <motion.section variants={ANIMATION_VARIANTS.item}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              Uploaded Documents
            </h3>
            <span className="text-sm text-muted-foreground">
              {filteredDocuments.length} documents
            </span>
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading documents...</p>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={loadDocuments} variant="outline">
                Try Again
              </Button>
            </div>
          )}

          {!loading && !error && filteredDocuments.length === 0 && (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No documents uploaded yet. Upload your first PDF to get
                  started.
                </p>
              </CardContent>
            </Card>
          )}

          {!loading && !error && filteredDocuments.length > 0 && (
            <div className="space-y-4">
              {filteredDocuments.map((document) => (
                <motion.div
                  key={document.id}
                  variants={ANIMATION_VARIANTS.item}
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 border-border/50 hover:border-primary/20">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3 flex-1">
                          <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                            <FileText className="w-6 h-6 text-red-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground mb-1 truncate">
                              {document.name}
                            </h4>
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                              <span>{document.size}</span>
                              <span>•</span>
                              <span>{document.uploadedAt}</span>
                              {document.uploadedBy && (
                                <>
                                  <span>•</span>
                                  <span>
                                    by {document.uploadedBy.slice(0, 8)}...
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div
                            className={`text-sm px-2 py-1 rounded-full ${
                              document.status === 'FullySigned'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                                : document.status === 'PartiallySigned'
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-300'
                            }`}
                          >
                            {document.status === 'FullySigned'
                              ? 'Fully Signed'
                              : document.status === 'PartiallySigned'
                                ? 'Partially Signed'
                                : 'Pending'}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDocument(document)}
                            disabled={loadingPDFPreview}
                            className="p-2 h-auto w-auto"
                          >
                            {loadingPDFPreview ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadDocument(document)}
                            className="p-2 h-auto w-auto text-blue-600 hover:text-blue-700"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveDocument(document.id)}
                            className="p-2 h-auto w-auto text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>

        {/* Floating Action Button */}
        <motion.div
          variants={ANIMATION_VARIANTS.item}
          className="fixed bottom-6 right-6 z-50"
        >
          <Button
            onClick={() => setShowUploadModal(true)}
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 aspect-square"
            size="lg"
          >
            <Plus className="w-6 h-6 text-white dark:text-black" />
          </Button>
        </motion.div>
      </motion.div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`rounded-lg p-6 w-full max-w-md border border-border shadow-2xl ${
              mode === 'dark' ? 'bg-gray-900' : 'bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Manage Members
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInviteModal(false)}
                disabled={generatingInvite}
                className="p-1 h-auto w-auto"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <h5 className="font-medium text-foreground mb-2">
                  Create Invite
                </h5>
                <input
                  type="text"
                  placeholder="Enter the ID of invitee"
                  value={inviteId}
                  onChange={(e) => setInviteId(e.target.value)}
                  disabled={generatingInvite}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="text-center text-sm text-muted-foreground mb-3">
                  OR
                </div>
                <select
                  disabled={generatingInvite}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option>Enter From Contacts</option>
                </select>
                <Button
                  onClick={handleGenerateInvite}
                  disabled={generatingInvite || !inviteId.trim()}
                  className="w-full text-white dark:text-black text-lg"
                >
                  {generatingInvite ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    'Generate Invite'
                  )}
                </Button>
              </div>

              <Button variant="outline" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add A Member
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Payload Dialog */}
      {showPayloadDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`rounded-lg p-6 w-full max-w-md border border-border shadow-2xl ${
              mode === 'dark' ? 'bg-gray-900' : 'bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Generated Invite Payload
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPayloadDialog(false)}
                className="p-1 h-auto w-auto"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Your invite payload:
                </p>
                <div className="bg-background border border-border rounded-lg p-3 break-all text-sm font-mono min-h-[100px] flex items-center">
                  {generatedPayload || 'Loading...'}
                </div>
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={handleCopyPayload}
                  className="flex-1 text-white dark:text-black"
                >
                  Copy Payload
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPayloadDialog(false)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`rounded-lg p-6 w-full max-w-md border border-border shadow-2xl ${
              mode === 'dark' ? 'bg-gray-900' : 'bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Upload Document
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUploadModal(false)}
                className="p-1 h-auto w-auto"
                disabled={uploading}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              {uploading && uploadFiles.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground mb-2">
                    Upload Progress
                  </h4>
                  {uploadFiles.map((fileUpload, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground truncate flex-1 mr-2">
                          {fileUpload.file.name}
                        </span>
                        <span className="text-muted-foreground">
                          {fileUpload.uploaded
                            ? 'Complete'
                            : fileUpload.error
                              ? 'Error'
                              : `${Math.round(fileUpload.progress)}%`}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            fileUpload.error
                              ? 'bg-red-500'
                              : fileUpload.uploaded
                                ? 'bg-green-500'
                                : 'bg-primary'
                          }`}
                          style={{
                            width: `${fileUpload.uploaded ? 100 : fileUpload.progress}%`,
                          }}
                        />
                      </div>
                      {fileUpload.error && (
                        <p className="text-xs text-red-500 mt-1">
                          {fileUpload.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {uploading && uploadFiles.length === 0 && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">
                    Preparing upload...
                  </p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {!uploading && (
                <div className="text-center">
                  <Upload className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h4 className="text-lg font-semibold text-foreground mb-2 ">
                    Upload PDF Document
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Select a PDF file to upload for document signing
                  </p>
                  <Button
                    onClick={handleUploadClick}
                    className="w-full mb-3 text-white dark:text-black"
                    disabled={uploading}
                  >
                    <Upload className="w-4 h-4 mr-2 text-white dark:text-black" />
                    Choose PDF File
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports: PDF files only
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* PDF Viewer Modal */}
      {showPDFViewer && selectedDocument && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full max-w-4xl h-[90vh] max-h-[90vh]"
          >
            <PDFViewer
              file={selectedDocument.file || null}
              onClose={handleClosePDFViewer}
              title={selectedDocument.name}
              showDownload={true}
              showClose={true}
              maxHeight="90vh"
              className="w-full h-full"
              contextId={currentContextId || undefined}
              documentId={selectedDocument.id}
              documentHash={selectedDocument.hash}
              showSaveToContext={true}
              onDocumentSaved={() => {
                setShowPDFViewer(false);
                setSelectedDocument(null);

                loadDocuments();
              }}
            />
          </motion.div>
        </div>
      )}
    </MobileLayout>
  );
};

export default AgreementPage;
