import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  FileText,
  AlertCircle,
  Save,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { LoadingSpinner } from './ui/Loading';
import {
  pdfService,
  type PDFPage,
  type SignaturePosition,
} from '../services/pdfService';
import SignatureOverlay from './SignatureOverlay';
import * as pdfjsLib from 'pdfjs-dist';
import './PDFViewer.css';

interface PDFViewerProps {
  file: File | null;
  onClose?: () => void;
  className?: string;
  title?: string;
  showDownload?: boolean;
  showClose?: boolean;
  maxHeight?: string;
  // Signature-related props
  signatures?: SignaturePosition[];
  onSignaturePlace?: (signature: SignaturePosition) => void;
  onSignatureUpdate?: (signature: SignaturePosition) => void;
  onSignatureDelete?: (signatureId: string) => void;
  selectedSignature?: string | null;
  showSignatureControls?: boolean;
  onSaveSignedPDF?: (blob: Blob) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  file,
  onClose,
  className = '',
  title,
  showDownload = true,
  showClose = true,
  maxHeight = '70vh',
  signatures = [],
  onSignaturePlace,
  onSignatureUpdate,
  onSignatureDelete,
  selectedSignature,
  showSignatureControls = false,
  onSaveSignedPDF,
}) => {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PDFPage[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(
    null,
  );
  const [savingPDF, setSavingPDF] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load PDF document
  const loadPDF = useCallback(async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Loading PDF file:', file.name, file.type, file.size);
      const pdfDoc = await pdfService.loadPDF(file);
      console.log('PDF loaded successfully:', pdfDoc.numPages, 'pages');
      setPdf(pdfDoc);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load PDF. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [file]);

  // Render all pages
  const renderPages = useCallback(async () => {
    if (!pdf) return;

    try {
      console.log('Rendering pages for PDF with', pdf.numPages, 'pages');
      const renderedPages = await pdfService.renderAllPages(pdf, scale);
      console.log('Pages rendered successfully');
      setPages(renderedPages);
    } catch (err) {
      console.error('Error rendering pages:', err);
      setError('Failed to render PDF pages.');
    }
  }, [pdf, scale]);

  // Handle signature selection
  const handleSignatureSelect = useCallback((signatureId: string) => {
    setSelectedSignatureId(signatureId);
  }, []);

  // Handle signature updates
  const handleSignatureUpdate = useCallback(
    (updatedSignature: SignaturePosition) => {
      if (onSignatureUpdate) {
        onSignatureUpdate(updatedSignature);
      }
    },
    [onSignatureUpdate],
  );

  // Handle signature deletion
  const handleSignatureDelete = useCallback(
    (signatureId: string) => {
      if (onSignatureDelete) {
        onSignatureDelete(signatureId);
      }
      setSelectedSignatureId(null);
    },
    [onSignatureDelete],
  );

  // Handle canvas click for signature placement
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      // Deselect any selected signatures when clicking on empty space
      if (selectedSignatureId) {
        setSelectedSignatureId(null);
      }

      if (!selectedSignature || !onSignaturePlace) return;

      // Check if click is on an existing signature overlay
      const target = event.target as HTMLElement;
      if (target.closest('.signature-overlay')) {
        return; // Don't place signature if clicking on existing overlay
      }

      const canvas = event.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;

      // Convert click coordinates to actual canvas coordinates
      // Since we're using CSS width/height that matches the scale, we need to convert back to original coordinates
      const canvasX = (clickX / rect.width) * canvas.width;
      const canvasY = (clickY / rect.height) * canvas.height;

      const signaturePosition: SignaturePosition = {
        id: Date.now().toString(),
        x: canvasX - 50, // Center the signature
        y: canvasY - 25,
        width: 100,
        height: 50,
        pageNumber: currentPage,
        signatureData: selectedSignature,
        timestamp: Date.now(),
      };

      onSignaturePlace(signaturePosition);
    },
    [selectedSignature, selectedSignatureId, currentPage, onSignaturePlace],
  );

  // Handle save signed PDF
  const handleSaveSignedPDF = useCallback(async () => {
    if (!file || !onSaveSignedPDF || signatures.length === 0) return;

    setSavingPDF(true);
    try {
      const signedPDFBlob = await pdfService.generateSignedPDF(
        file,
        signatures,
        scale,
      );
      onSaveSignedPDF(signedPDFBlob);
    } catch (err) {
      console.error('Error saving signed PDF:', err);
      setError('Failed to save signed PDF.');
    } finally {
      setSavingPDF(false);
    }
  }, [file, signatures, scale, onSaveSignedPDF]);

  // Load PDF when file changes
  useEffect(() => {
    if (file) {
      loadPDF();
    }
  }, [file, loadPDF]);

  // Render all pages when PDF loads or scale changes
  useEffect(() => {
    if (pdf) {
      renderPages();
    }
  }, [pdf, scale, renderPages]);

  // Canvas drawing is now handled by ref callback in the JSX

  // Navigation handlers
  const nextPage = () => {
    if (pdf && currentPage < pdf.numPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  // Zoom handlers
  const zoomIn = () => {
    setScale((prev) => {
      const newScale = Math.min(prev + 0.2, 3);
      return newScale;
    });
  };

  const zoomOut = () => {
    setScale((prev) => {
      const newScale = Math.max(prev - 0.2, 0.5);
      return newScale;
    });
  };

  // Download handler
  const handleDownload = () => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentPageData = pages.find((p) => p.pageNumber === currentPage);
  const signaturesOnCurrentPage = signatures.filter(
    (sig) => sig.pageNumber === currentPage,
  );

  if (loading) {
    return (
      <div
        className={`pdf-viewer-container ${className}`}
        style={{
          maxHeight,
          backgroundColor: 'var(--current-surface)',
          border: '1px solid var(--current-border)',
        }}
      >
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-secondary">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`pdf-viewer-container ${className}`}
        style={{
          maxHeight,
          backgroundColor: 'var(--current-surface)',
          border: '1px solid var(--current-border)',
        }}
      >
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] space-y-4">
          <AlertCircle size={48} className="text-red-500" />
          <p className="text-center text-secondary px-4">{error}</p>
          <Button
            variant="outline"
            onClick={() => file && loadPDF()}
            className="mt-4"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!file || !pdf) {
    return (
      <div
        className={`pdf-viewer-container ${className}`}
        style={{
          maxHeight,
          backgroundColor: 'var(--current-surface)',
          border: '1px solid var(--current-border)',
        }}
      >
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] space-y-4">
          <FileText size={48} className="text-secondary" />
          <p className="text-center text-secondary px-4">
            No PDF selected. Please upload a PDF to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`pdf-viewer-container ${className}`}
      style={{
        maxHeight,
        backgroundColor: 'var(--current-surface)',
        border: '1px solid var(--current-border)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b"
        style={{
          borderColor: 'var(--current-border)',
          backgroundColor: 'var(--current-surface)',
        }}
      >
        <div className="flex items-center space-x-3">
          <FileText size={20} className="text-primary" />
          <div>
            <h3
              className="font-semibold text-sm"
              style={{ color: 'var(--current-text)' }}
            >
              {title || file.name}
            </h3>
            <p className="text-xs text-secondary">
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {showDownload && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-8 w-8 p-0"
            >
              <Download size={16} />
            </Button>
          )}
          {showSignatureControls && signatures.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveSignedPDF}
              disabled={savingPDF}
              className="h-8 w-8 p-0"
              title="Save signed PDF"
            >
              {savingPDF ? <LoadingSpinner size="sm" /> : <Save size={16} />}
            </Button>
          )}
          {showClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X size={16} />
            </Button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div
        className="flex items-center justify-between p-3 border-b"
        style={{
          borderColor: 'var(--current-border)',
          backgroundColor: 'var(--current-card)',
        }}
      >
        {/* Page controls */}
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={prevPage}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft size={16} />
          </Button>

          <span className="text-sm font-medium px-2">
            <span style={{ color: 'var(--current-text)' }}>{currentPage}</span>
            <span className="text-secondary"> / {pdf.numPages}</span>
            {signaturesOnCurrentPage.length > 0 && (
              <span className="text-secondary">
                {' '}
                ({signaturesOnCurrentPage.length} signature
                {signaturesOnCurrentPage.length !== 1 ? 's' : ''})
              </span>
            )}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={nextPage}
            disabled={currentPage === pdf.numPages}
            className="h-8 w-8 p-0"
          >
            <ChevronRight size={16} />
          </Button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="h-8 w-8 p-0"
          >
            <ZoomOut size={16} />
          </Button>

          <span className="text-sm font-medium px-2 text-secondary">
            {Math.round(scale * 100)}%
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={zoomIn}
            disabled={scale >= 3}
            className="h-8 w-8 p-0"
          >
            <ZoomIn size={16} />
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div
        className="flex-1 overflow-auto p-4 bg-gray-50"
        style={{
          backgroundColor: 'var(--current-bg)',
          maxHeight: `calc(${maxHeight} - 120px)`,
        }}
        ref={containerRef}
      >
        <div className="flex justify-center">
          <div className="relative">
            <AnimatePresence mode="wait">
              {currentPageData ? (
                <motion.div
                  key={`page-${currentPage}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="relative"
                >
                  <canvas
                    className={`max-w-full h-auto border border-gray-300 rounded-lg shadow-sm ${
                      selectedSignature ? 'cursor-crosshair' : ''
                    }`}
                    onClick={handleCanvasClick}
                    style={{
                      backgroundColor: 'white',
                      borderColor: 'var(--current-border)',
                      width: currentPageData.width * scale,
                      height: currentPageData.height * scale,
                      display: 'block',
                    }}
                    ref={(canvas) => {
                      if (canvas && currentPageData) {
                        canvas.width = currentPageData.width;
                        canvas.height = currentPageData.height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.clearRect(0, 0, canvas.width, canvas.height);
                          ctx.drawImage(currentPageData.canvas, 0, 0);
                        }
                      }
                    }}
                  />

                  {/* Signature Overlays */}
                  {signatures
                    .filter((sig) => sig.pageNumber === currentPage)
                    .map((signature) => (
                      <SignatureOverlay
                        key={signature.id}
                        signature={signature}
                        scale={scale}
                        onUpdate={handleSignatureUpdate}
                        onDelete={handleSignatureDelete}
                        isSelected={selectedSignatureId === signature.id}
                        onSelect={handleSignatureSelect}
                      />
                    ))}

                  {/* Signature placement hint */}
                  {selectedSignature && (
                    <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
                      Click on the document to place your signature
                    </div>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PDFViewer;
