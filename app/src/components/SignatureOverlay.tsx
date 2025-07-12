import React, { useState, useRef, useEffect } from 'react';
import { X, RotateCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { SignaturePosition } from '../services/pdfService';

interface SignatureOverlayProps {
  signature: SignaturePosition;
  scale: number;
  onUpdate: (signature: SignaturePosition) => void;
  onDelete: (signatureId: string) => void;
  isSelected: boolean;
  onSelect: (signatureId: string) => void;
}

const SignatureOverlay: React.FC<SignatureOverlayProps> = ({
  signature,
  scale,
  onUpdate,
  onDelete,
  isSelected,
  onSelect,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialBounds, setInitialBounds] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(signature.id);

    const rect = e.currentTarget.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    setDragStart({ x: startX, y: startY });
    setIsDragging(true);
  };

  const handleResizeMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();

    setResizeHandle(handle);
    setIsResizing(true);
    setInitialBounds({
      x: signature.x,
      y: signature.y,
      width: signature.width,
      height: signature.height,
    });

    // Store the mouse position relative to the canvas
    const container = overlayRef.current?.parentElement;
    if (container) {
      const canvas = container.querySelector('canvas');
      if (canvas) {
        const canvasRect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;
        setDragStart({ x: mouseX, y: mouseY });
      }
    }
  };

  const handleMainResizeMouseDown = (e: React.MouseEvent) => {
    handleResizeMouseDown(e, 'bottom-right');
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && overlayRef.current) {
        const container = overlayRef.current.parentElement;
        if (!container) return;

        const canvas = container.querySelector('canvas');
        if (!canvas) return;

        const canvasRect = canvas.getBoundingClientRect();

        // Convert mouse position to canvas coordinates
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;

        const canvasX = (mouseX / canvasRect.width) * canvas.width;
        const canvasY = (mouseY / canvasRect.height) * canvas.height;

        // Adjust for drag offset (convert drag offset to canvas coordinates)
        const dragOffsetX = (dragStart.x / canvasRect.width) * canvas.width;
        const dragOffsetY = (dragStart.y / canvasRect.height) * canvas.height;

        const newX = canvasX - dragOffsetX;
        const newY = canvasY - dragOffsetY;

        onUpdate({
          ...signature,
          x: Math.max(0, newX),
          y: Math.max(0, newY),
        });
      }

      if (isResizing && resizeHandle) {
        const container = overlayRef.current?.parentElement;
        if (!container) return;

        const canvas = container.querySelector('canvas');
        if (!canvas) return;

        const canvasRect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;

        const canvasX = (mouseX / canvasRect.width) * canvas.width;
        const canvasY = (mouseY / canvasRect.height) * canvas.height;

        const initialCanvasX = (dragStart.x / canvasRect.width) * canvas.width;
        const initialCanvasY =
          (dragStart.y / canvasRect.height) * canvas.height;

        const deltaX = canvasX - initialCanvasX;
        const deltaY = canvasY - initialCanvasY;

        let newProps = { ...signature };

        switch (resizeHandle) {
          case 'top-left':
            newProps.x = initialBounds.x + deltaX;
            newProps.y = initialBounds.y + deltaY;
            newProps.width = initialBounds.width - deltaX;
            newProps.height = initialBounds.height - deltaY;
            break;
          case 'top-right':
            newProps.y = initialBounds.y + deltaY;
            newProps.width = initialBounds.width + deltaX;
            newProps.height = initialBounds.height - deltaY;
            break;
          case 'bottom-left':
            newProps.x = initialBounds.x + deltaX;
            newProps.width = initialBounds.width - deltaX;
            newProps.height = initialBounds.height + deltaY;
            break;
          case 'bottom-right':
            newProps.width = initialBounds.width + deltaX;
            newProps.height = initialBounds.height + deltaY;
            break;
        }

        // Ensure minimum size
        newProps.width = Math.max(50, newProps.width);
        newProps.height = Math.max(25, newProps.height);

        onUpdate(newProps);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    isDragging,
    isResizing,
    signature,
    scale,
    dragStart,
    onUpdate,
    resizeHandle,
    initialBounds,
  ]);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(signature.id);
  };

  // Handle keyboard deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSelected && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        onDelete(signature.id);
      }
    };

    if (isSelected) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSelected, signature.id, onDelete]);

  return (
    <motion.div
      ref={overlayRef}
      className={`signature-overlay absolute cursor-move ${
        isSelected
          ? 'border-2 border-blue-500 bg-blue-50/20'
          : 'border-2 border-gray-300 hover:border-blue-400'
      } ${isDragging ? 'opacity-80' : ''}`}
      style={{
        left: signature.x * scale,
        top: signature.y * scale,
        width: signature.width * scale,
        height: signature.height * scale,
        borderRadius: '4px',
        zIndex: isSelected ? 1000 : 100,
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(signature.id);
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Signature Image */}
      <img
        src={signature.signatureData}
        alt="Signature"
        className="w-full h-full object-contain pointer-events-none"
        style={{
          filter: isSelected ? 'brightness(1.1)' : 'none',
        }}
      />

      {/* Controls (only show when selected) */}
      {isSelected && (
        <>
          {/* Delete button */}
          <button
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
            onClick={handleDelete}
            title="Delete signature"
          >
            <X size={12} />
          </button>

          {/* Main resize handle */}
          <div
            className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center cursor-se-resize hover:bg-blue-600 transition-colors shadow-lg"
            onMouseDown={handleMainResizeMouseDown}
            title="Resize signature"
          >
            <RotateCw size={8} />
          </div>

          {/* Corner handles */}
          <div
            className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-full cursor-nw-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'top-left')}
          />
          <div
            className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full cursor-ne-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'top-right')}
          />
          <div
            className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 rounded-full cursor-sw-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'bottom-left')}
          />
          <div
            className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 rounded-full cursor-se-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'bottom-right')}
          />
        </>
      )}

      {/* Timestamp tooltip */}
      {isSelected && (
        <div className="absolute -bottom-8 left-0 bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
          Added: {new Date(signature.timestamp).toLocaleTimeString()}
        </div>
      )}
    </motion.div>
  );
};

export default SignatureOverlay;
