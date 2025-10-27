
class LexiBackground {
  constructor() {
    this.trigramModel = new TrigramModel();
    this.isProcessing = false;
    this.init();
  }

  async init() {
    // Load existing model from storage
    await this.loadModel();
    
    // Set up message listeners
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });
    
    // Set up tab listeners for text capture
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        this.setupTabTextCapture(tabId);
      }
    });
    
    console.log('Lexi background script initialized');
  }

  async loadModel() {
    try {
      const result = await chrome.storage.local.get(['lexiTrigramModel']);
      if (result.lexiTrigramModel) {
        this.trigramModel.loadFromJSON(result.lexiTrigramModel);
        console.log('Loaded trigram model with', Object.keys(this.trigramModel.trigrams).length, 'trigrams');
      }
    } catch (error) {
      console.error('Failed to load model:', error);
    }
  }

  async saveModel() {
    try {
      const modelData = this.trigramModel.toJSON();
      await chrome.storage.local.set({ lexiTrigramModel: modelData });
      console.log('Saved trigram model');
    } catch (error) {
      console.error('Failed to save model:', error);
    }
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'predict':
        this.handlePrediction(message.text, sendResponse);
        break;
        
      case 'train':
        this.handleTraining(message.text, sendResponse);
        break;
        
      case 'getModelStats':
        this.handleGetStats(sendResponse);
        break;
        
      case 'resetModel':
        this.handleResetModel(sendResponse);
        break;
        
      case 'exportModel':
        this.handleExportModel(sendResponse);
        break;
        
      case 'importModel':
        this.handleImportModel(message.data, sendResponse);
        break;
        
      default:
        sendResponse({ error: 'Unknown action' });
    }
  }

  async handlePrediction(text, sendResponse) {
    try {
      const prediction = this.trigramModel.predict(text);
      sendResponse({ prediction });
    } catch (error) {
      console.error('Prediction failed:', error);
      sendResponse({ prediction: null });
    }
  }

  async handleTraining(text, sendResponse) {
    try {
      // Preprocess and tokenize text
      const processedText = this.preprocessText(text);
      const tokens = this.tokenize(processedText);
      
      // Train the model
      this.trigramModel.train(tokens);
      
      // Save the updated model
      await this.saveModel();
      
      sendResponse({ 
        success: true, 
        tokensAdded: tokens.length,
        totalTrigrams: Object.keys(this.trigramModel.trigrams).length
      });
    } catch (error) {
      console.error('Training failed:', error);
      sendResponse({ error: error.message });
    }
  }

  async handleGetStats(sendResponse) {
    try {
      const stats = this.trigramModel.getStats();
      sendResponse({ stats });
    } catch (error) {
      console.error('Failed to get stats:', error);
      sendResponse({ error: error.message });
    }
  }

  async handleResetModel(sendResponse) {
    try {
      this.trigramModel.reset();
      await chrome.storage.local.remove(['lexiTrigramModel']);
      sendResponse({ success: true });
    } catch (error) {
      console.error('Failed to reset model:', error);
      sendResponse({ error: error.message });
    }
  }

  async handleExportModel(sendResponse) {
    try {
      const modelData = this.trigramModel.toJSON();
      const blob = new Blob([JSON.stringify(modelData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const downloadId = await chrome.downloads.download({
        url: url,
        filename: `lexi-model-${new Date().toISOString().split('T')[0]}.json`,
        saveAs: true
      });
      
      // Clean up the URL
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      sendResponse({ success: true, downloadId });
    } catch (error) {
      console.error('Failed to export model:', error);
      sendResponse({ error: error.message });
    }
  }

  async handleImportModel(modelData, sendResponse) {
    try {
      this.trigramModel.loadFromJSON(modelData);
      await this.saveModel();
      sendResponse({ success: true });
    } catch (error) {
      console.error('Failed to import model:', error);
      sendResponse({ error: error.message });
    }
  }

  setupTabTextCapture(tabId) {
    // Inject a script to capture text from the page for training
    chrome.scripting.executeScript({
      target: { tabId },
      func: this.capturePageText,
      args: []
    }, (results) => {
      if (results && results[0] && results[0].result) {
        this.handleTraining(results[0].result, () => {});
      }
    });
  }

  capturePageText() {
    // This function runs in the content script context
    const textElements = ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th'];
    const textContents = [];
    
    textElements.forEach(tag => {
      const elements = document.getElementsByTagName(tag);
      for (let element of elements) {
        if (element.textContent && element.textContent.trim().length > 10) {
          textContents.push(element.textContent.trim());
        }
      }
    });
    
    return textContents.join('\
');
  }

  preprocessText(text) {
    if (!text) return '';
    
    return text
      .toLowerCase()
      .replace(/[^\w\s\.\!\?\,\;\:]/g, '') // Remove special characters except punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\
+/g, '\
') // Normalize newlines
      .trim();
  }

  tokenize(text) {
    if (!text) return [];
    
    // Split by whitespace and punctuation, keeping punctuation as separate tokens
    const tokens = text
      .split(/(\s+|[\.!?]+|[,;:]|['"])/)
      .filter(token => token.trim().length > 0);
    
    return tokens;
  }
}

class TrigramModel {
  constructor() {
    this.trigrams = new Map(); // Maps trigram (3-word sequence) to following words and their frequencies
    this.bigrams = new Map();  // Maps bigram (2-word sequence) to following words
    this.unigrams = new Map(); // Maps single words to their frequencies
    this.vocabSize = 0;
  }

  train(tokens) {
    if (tokens.length < 3) return;

    // Build n-gram models
    for (let i = 0; i < tokens.length; i++) {
      // Unigrams
      const word = tokens[i];
      this.unigrams.set(word, (this.unigrams.get(word) || 0) + 1);
      
      // Bigrams
      if (i < tokens.length - 1) {
        const bigram = `${tokens[i]} ${tokens[i + 1]}`;
        const nextWord = tokens[i + 2] || null;
        
        if (!this.bigrams.has(bigram)) {
          this.bigrams.set(bigram, new Map());
        }
        if (nextWord) {
          this.bigrams.get(bigram).set(nextWord, (this.bigrams.get(bigram).get(nextWord) || 0) + 1);
        }
      }
      
      // Trigrams
      if (i < tokens.length - 2) {
        const trigram = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
        const nextWord = tokens[i + 3] || null;
        
        if (!this.trigrams.has(trigram)) {
          this.trigrams.set(trigram, new Map());
        }
        if (nextWord) {
          this.trigrams.get(trigram).set(nextWord, (this.trigrams.get(trigram).get(nextWord) || 0) + 1);
        }
      }
    }
    
    this.vocabSize = this.unigrams.size;
  }

  predict(context) {
    if (!context || typeof context !== 'string') return null;
    
    const words = context.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return null;
    
    let prediction = null;
    
    // Try trigram prediction first
    if (words.length >= 2) {
      const lastTwo = words.slice(-2).join(' ');
      prediction = this.getMostLikelyNext(this.trigrams, lastTwo);
    }
    
    // Fall back to bigram prediction
    if (!prediction && words.length >= 1) {
      const lastWord = words[words.length - 1];
      prediction = this.getMostLikelyNext(this.bigrams, lastWord);
    }
    
    // Fall back to unigram (most common word)
    if (!prediction) {
      prediction = this.getMostCommonWord();
    }
    
    return prediction;
  }

  getMostLikelyNext(model, context) {
    if (!model.has(context)) return null;
    
    const predictions = model.get(context);
    let maxCount = 0;
    let bestWord = null;
    
    for (const [word, count] of predictions) {
      if (count > maxCount) {
        maxCount = count;
        bestWord = word;
      }
    }
    
    return bestWord;
  }

  getMostCommonWord() {
    let maxCount = 0;
    let bestWord = null;
    
    for (const [word, count] of this.unigrams) {
      // Skip very short words and common stop words for better predictions
      if (word.length > 1 && !this.isStopWord(word) && count > maxCount) {
        maxCount = count;
        bestWord = word;
      }
    }
    
    return bestWord;
  }

  isStopWord(word) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further',
      'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
      'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
      'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
      'can', 'will', 'just', 'don', 'should', 'now'
    ]);
    return stopWords.has(word.toLowerCase());
  }

  getStats() {
    let totalTrigrams = 0;
    let totalBigrams = 0;
    let totalUnigrams = this.unigrams.size;
    
    for (const predictions of this.trigrams.values()) {
      for (const count of predictions.values()) {
        totalTrigrams += count;
      }
    }
    
    for (const predictions of this.bigrams.values()) {
      for (const count of predictions.values()) {
        totalBigrams += count;
      }
    }
    
    for (const count of this.unigrams.values()) {
      totalUnigrams += count;
    }
    
    return {
      vocabSize: this.vocabSize,
      totalTrigrams,
      totalBigrams,
      totalUnigrams,
      uniqueTrigrams: this.trigrams.size,
      uniqueBigrams: this.bigrams.size
    };
  }

  reset() {
    this.trigrams.clear();
    this.bigrams.clear();
    this.unigrams.clear();
    this.vocabSize = 0;
  }

  toJSON() {
    const data = {
      trigrams: {},
      bigrams: {},
      unigrams: {},
      vocabSize: this.vocabSize
    };
    
    // Convert Maps to plain objects for JSON serialization
    for (const [key, value] of this.trigrams) {
      data.trigrams[key] = Object.fromEntries(value);
    }
    
    for (const [key, value] of this.bigrams) {
      data.bigrams[key] = Object.fromEntries(value);
    }
    
    data.unigrams = Object.fromEntries(this.unigrams);
    
    return data;
  }

  loadFromJSON(data) {
    this.reset();
    
    if (data.trigrams) {
      for (const [key, value] of Object.entries(data.trigrams)) {
        this.trigrams.set(key, new Map(Object.entries(value)));
      }
    }
    
    if (data.bigrams) {
      for (const [key, value] of Object.entries(data.bigrams)) {
        this.bigrams.set(key, new Map(Object.entries(value)));
      }
    }
    
    if (data.unigrams) {
      this.unigrams = new Map(Object.entries(data.unigrams));
    }
    
    this.vocabSize = data.vocabSize || 0;
  }
}

// Initialize the background script
const lexiBackground = new LexiBackground();
