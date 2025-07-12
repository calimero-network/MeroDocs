#!/bin/bash
# PDF.js Worker Setup Script

echo "Setting up PDF.js worker..."

# Check if public directory exists
if [ ! -d "public" ]; then
    echo "Error: public directory not found. Please run this script from the app directory."
    exit 1
fi

# Download PDF.js worker file
echo "Downloading PDF.js worker..."
curl -o public/pdf.worker.min.js https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js

# Check if download was successful
if [ -f "public/pdf.worker.min.js" ]; then
    echo "✅ PDF.js worker file downloaded successfully!"
    echo "📄 File saved to: public/pdf.worker.min.js"
else
    echo "❌ Failed to download PDF.js worker file"
    exit 1
fi

echo "🎉 PDF.js setup complete!"
echo "📋 The PDF viewer is now ready to use."
