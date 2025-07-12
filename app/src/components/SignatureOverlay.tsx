import React, { useState, useRef, useEffect } from 'react';
import { X, Move, RotateCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { SignaturePosition } from '../services/pdfService';

interface SignatureOverlayProps {
  signature: SignaturePosition;
  scale: number;
  onUpdate: (signature: SignaturePosition) => void;
  onDelete: (signatureId: string) => void;
  isSelected: boolean;
  onSelect: (signatureId: string) => void;
  isReadOnly?: boolean;
}

const SignatureOverlay: React.FC<SignatureOverlayProps> = ({
  signature,
  scale,
  onUpdate,
  onDelete,
  isSelected,
  onSelect,
  isReadOnly = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isReadOnly) return;

    e.preventDefault();
    e.stopPropagation();

    onSelect(signature.id);
    setIsDragging(true);
    setDragStart({
      x: e.clientX - signature.x * scale,
      y: e.clientY - signature.y * scale,
    });
  };

  const handleMouseMove = React.useCallback(
    (e: MouseEvent) => {
      if (!isDragging || isReadOnly) return;

      const newX = (e.clientX - dragStart.x) / scale;
      const newY = (e.clientY - dragStart.y) / scale;

      onUpdate({
        ...signature,
        x: Math.max(0, newX),
        y: Math.max(0, newY),
      });
    },
    [isDragging, isReadOnly, dragStart, scale, signature, onUpdate],
  );

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(signature.id);
  };

  const handleResize = (e: React.MouseEvent) => {
    if (isReadOnly) return;

    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleResizeMove = React.useCallback(
    (e: MouseEvent) => {
      if (!isResizing || isReadOnly) return;

      const deltaX = (e.clientX - dragStart.x) / scale;
      const deltaY = (e.clientY - dragStart.y) / scale;

      onUpdate({
        ...signature,
        width: Math.max(50, signature.width + deltaX),
        height: Math.max(25, signature.height + deltaY),
      });

      setDragStart({
        x: e.clientX,
        y: e.clientY,
      });
    },
    [isResizing, isReadOnly, dragStart, scale, signature, onUpdate],
  );

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    isDragging,
    isResizing,
    handleMouseMove,
    handleMouseUp,
    handleResizeMove,
  ]);

  return (
    <motion.div
      ref={overlayRef}
      className={`signature-overlay absolute border-2 cursor-move ${
        isSelected
          ? 'border-blue-500 bg-blue-50/20'
          : 'border-gray-300 hover:border-blue-400'
      } ${isDragging ? 'opacity-80' : ''} ${isReadOnly ? 'cursor-default' : 'cursor-move'}`}
      style={{
        left: signature.x * scale,
        top: signature.y * scale,
        width: signature.width * scale,
        height: signature.height * scale,
        borderRadius: '4px',
        zIndex: isSelected ? 1000 : 999,
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

      {/* Controls (only show when selected and not read-only) */}
      {isSelected && !isReadOnly && (
        <>
          {/* Delete button */}
          <button
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
            onClick={handleDelete}
            title="Delete signature"
          >
            <X size={12} />
          </button>

          {/* Move indicator */}
          <div className="absolute top-1 left-1 w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center">
            <Move size={10} />
          </div>

          {/* Resize handle */}
          <div
            className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center cursor-se-resize hover:bg-blue-600 transition-colors shadow-lg"
            onMouseDown={handleResize}
            title="Resize signature"
          >
            <RotateCw size={8} />
          </div>

          {/* Selection indicators */}
          <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-full"></div>
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 rounded-full"></div>
          <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
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
