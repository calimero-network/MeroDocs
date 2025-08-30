// src/services/embeddingService.ts
import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';
import * as pdfjsLib from 'pdfjs-dist';
import { Buffer } from 'buffer';

// Set the worker source for pdfjs-dist (required for browser)
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Global variable to cache the model (avoids reloading)
let embeddingModel: use.UniversalSentenceEncoder | null = null;

// Load the embedding model (Universal Sentence Encoder)
async function loadEmbeddingModel() {
  if (!embeddingModel) {
    try {
      // Set TensorFlow.js backend (WebGL for GPU acceleration, fallback to CPU)
      await tf.setBackend('webgl');
      await tf.ready();
      console.log('TensorFlow.js backend:', tf.getBackend());

      embeddingModel = await use.load();
    } catch (error) {
      console.error('Error loading embedding model:', error);
      throw new Error('Failed to load embedding model');
    }
  }
  return embeddingModel;
}

// Extract text from PDF (using pdfjs-dist for browser compatibility)
export async function extractTextFromPDF(pdfFile: File): Promise<string> {
  try {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + ' ';
    }

    return fullText.trim() || 'No text extracted';
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

// Generate embeddings from text
export async function generateEmbeddings(text: string): Promise<number[]> {
  try {
    if (!text || typeof text !== 'string' || text.trim() === '') {
      throw new Error('Text must be a non-empty string');
    }

    // Sanitize text: trim and remove any null characters
    const sanitizedText = text.trim().replace(/\0/g, '');
    if (sanitizedText === '') {
      throw new Error('Text is empty after sanitization');
    }

    console.log(
      'Generating embeddings for text:',
      sanitizedText.substring(0, 100) + '...',
    ); // Log first 100 chars for debugging

    const model = await loadEmbeddingModel();
    const embeddings = await model.embed([sanitizedText]);

    console.log('Embeddings tensor:', embeddings); // Log tensor for debugging

    if (!embeddings || embeddings.size === 0) {
      throw new Error('Embeddings are invalid or empty');
    }

    // Convert tensor to array
    const dataArray = await embeddings.array();
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      throw new Error('Failed to convert embeddings to array');
    }

    return dataArray[0] as number[]; // Return the first (and only) embedding
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new Error('Failed to generate embeddings');
  }
}

// Combined function: Extract text and generate embeddings
export async function processPDFAndGenerateEmbeddings(
  pdfFile: File,
): Promise<{ text: string; embeddings: number[] }> {
  try {
    const text = await extractTextFromPDF(pdfFile);
    const embeddings = await generateEmbeddings(text);
    return { text, embeddings };
  } catch (error) {
    console.error('Error processing PDF and generating embeddings:', error);
    throw error; // Re-throw to propagate the error
  }
}
