import React, { useRef, useEffect, useState } from 'react';
import SignaturePad from 'signature_pad';
import { Save, RotateCcw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui';

interface SignaturePadComponentProps {
  onSave: (signatureData: string) => void;
  onCancel: () => void;
  isOpen: boolean;
}

const SignaturePadComponent: React.FC<SignaturePadComponentProps> = ({
  onSave,
  onCancel,
  isOpen,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [signaturePad, setSignaturePad] = useState<SignaturePad | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;

      // Check if dark mode is active
      const isDarkMode =
        document.documentElement.classList.contains('dark') ||
        document.documentElement.classList.contains('theme-dark');
      
      // Check if light mode is explicitly set
      const isLightMode = document.documentElement.classList.contains('theme-light');
      
      // Use light theme colors if explicitly set, otherwise use dark theme detection
      const backgroundColor = isLightMode ? '#ffffff' : (isDarkMode ? '#1a1d1f' : '#ffffff');
      const penColor = isLightMode ? '#0e1011' : (isDarkMode ? '#e8e4e1' : '#0e1011');

      const pad = new SignaturePad(canvas, {
        backgroundColor: backgroundColor,
        penColor: penColor,
        minWidth: 2,
        maxWidth: 4,
      });

      const updateSignaturePadColors = () => {
        // Check for theme classes
        const isDark =
          document.documentElement.classList.contains('dark') ||
          document.documentElement.classList.contains('theme-dark');
        const isLight = document.documentElement.classList.contains('theme-light');

        // Use light theme colors if explicitly set, otherwise use dark theme detection
        const newBgColor = isLight ? '#ffffff' : (isDark ? '#1a1d1f' : '#ffffff');
        const newPenColor = isLight ? '#0e1011' : (isDark ? '#e8e4e1' : '#0e1011');

        // Store current signature data
        const currentData = pad.toData();

        // Update colors
        pad.penColor = newPenColor;
        pad.backgroundColor = newBgColor;

        // Clear and fill with new background
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = newBgColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Restore signature data if any
        if (currentData.length > 0) {
          pad.fromData(currentData);
        }
      };

      const resizeCanvas = () => {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const rect = canvas.getBoundingClientRect();

        // Store the current signature data
        const data = pad.toData();

        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(ratio, ratio);
          canvas.style.width = rect.width + 'px';
          canvas.style.height = rect.height + 'px';

          // Apply background color
          ctx.fillStyle = pad.backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Restore the signature data
        pad.fromData(data);
      };

      // Initial resize and background setup
      setTimeout(() => {
        resizeCanvas();
        // Force apply initial background color
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const isDark =
            document.documentElement.classList.contains('dark') ||
            document.documentElement.classList.contains('theme-dark');
          const isLight = document.documentElement.classList.contains('theme-light');
          
          // Use light theme colors if explicitly set, otherwise use dark theme detection
          const bgColor = isLight ? '#ffffff' : (isDark ? '#1a1d1f' : '#ffffff');
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }, 100);

      // Listen for theme changes
      const observer = new MutationObserver(updateSignaturePadColors);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });

      window.addEventListener('resize', resizeCanvas);

      pad.addEventListener('beginStroke', () => setIsEmpty(false));
      pad.addEventListener('endStroke', () => setIsEmpty(pad.isEmpty()));

      // Override the clear method to ensure background is always applied
      const originalClear = pad.clear.bind(pad);
      pad.clear = () => {
        originalClear();
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = pad.backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      };

      setSignaturePad(pad);

      return () => {
        window.removeEventListener('resize', resizeCanvas);
        observer.disconnect();
        pad.off();
      };
    }
  }, [isOpen]);

  const handleSave = () => {
    if (signaturePad && !signaturePad.isEmpty()) {
      const dataURL = signaturePad.toDataURL('image/png');
      onSave(dataURL);
    }
  };

  const handleClear = () => {
    if (signaturePad && canvasRef.current) {
      signaturePad.clear();

      // Manually apply background color after clearing
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = signaturePad.backgroundColor;
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }

      setIsEmpty(true);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-2xl border border-border shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Create Your Signature
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="p-1 h-auto w-auto"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Draw your signature in the box below
                </p>
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-48 border-2 border-dashed border-border rounded-lg bg-background cursor-crosshair"
                    width={600}
                    height={200}
                  />
                  {isEmpty && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-muted-foreground text-sm">
                        Sign here using your mouse or touch screen
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleClear}
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Clear
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isEmpty}
                    className="flex items-center gap-2 text-white dark:text-black"
                  >
                    <Save className="w-4 h-4" />
                    Save Signature
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SignaturePadComponent;
