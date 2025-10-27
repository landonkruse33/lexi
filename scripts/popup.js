
class LexiPopup {
  constructor() {
    this.settings = {
      enabled: true,
      predictionKey: 'Tab',
      displayMode: 'inline',
      predictionColor: '#007acc'
    };
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.updateUI();
    await this.loadStats();
    
    console.log('Lexi popup initialized');
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['lexiSettings', 'lexiEnabled']);
      if (result.lexiSettings) {
        this.settings = { ...this.settings, ...result.lexiSettings };
      }
      if (result.lexiEnabled !== undefined) {
        this.settings.enabled = result.lexiEnabled;
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.sync.set({
        lexiSettings: {
          predictionKey: this.settings.predictionKey,
          displayMode: this.settings.displayMode,
          predictionColor: this.settings.predictionColor
        },
        lexiEnabled: this.settings.enabled
      });
      
      // Notify content script of settings change
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateSettings'
        });
      }
      
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  setupEventListeners() {
    // Enable/disable toggle
    document.getElementById('enableToggle').addEventListener('change', (e) => {
      this.settings.enabled = e.target.checked;
      this.saveSettings();
      this.notifyContentScript('toggleEnabled', { enabled: this.settings.enabled });
    });

    // Settings inputs
    document.getElementById('predictionKey').addEventListener('change', (e) => {
      this.settings.predictionKey = e.target.value;
      this.saveSettings();
    });

    document.getElementById('displayMode').addEventListener('change', (e) => {
      this.settings.displayMode = e.target.value;
      this.saveSettings();
    });

    document.getElementById('predictionColor').addEventListener('input', (e) => {
      this.settings.predictionColor = e.target.value;
      document.getElementById('colorHex').textContent = e.target.value;
      this.saveSettings();
    });

    // Model management buttons
    document.getElementById('refreshStats').addEventListener('click', () => {
      this.loadStats();
    });

    document.getElementById('trainModel').addEventListener('click', () => {
      this.trainOnCurrentTab();
    });

    document.getElementById('resetModel').addEventListener('click', () => {
      this.resetModel();
    });

    document.getElementById('exportModel').addEventListener('click', () => {
      this.exportModel();
    });

    document.getElementById('importModel').addEventListener('change', (e) => {
      this.importModel(e.target.files[0]);
    });

    // Test input
    document.getElementById('testInput').addEventListener('input', (e) => {
      this.testPrediction(e.target.value);
    });

    // Footer links
    document.getElementById('helpLink').addEventListener('click', (e) => {
      e.preventDefault();
      this.showHelp();
    });

    document.getElementById('aboutLink').addEventListener('click', (e) => {
      e.preventDefault();
      this.showAbout();
    });
  }

  updateUI() {
    // Update enable toggle
    document.getElementById('enableToggle').checked = this.settings.enabled;
    
    // Update settings inputs
    document.getElementById('predictionKey').value = this.settings.predictionKey;
    document.getElementById('displayMode').value = this.settings.displayMode;
    document.getElementById('predictionColor').value = this.settings.predictionColor;
    document.getElementById('colorHex').textContent = this.settings.predictionColor;
  }

  async loadStats() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getModelStats' });
      if (response && response.stats) {
        this.updateStatsDisplay(response.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
      this.showStatus('Failed to load model statistics', 'error');
    }
  }

  updateStatsDisplay(stats) {
    document.getElementById('vocabSize').textContent = stats.vocabSize.toLocaleString();
    document.getElementById('trigramCount').textContent = stats.uniqueTrigrams.toLocaleString();
    document.getElementById('bigramCount').textContent = stats.uniqueBigrams.toLocaleString();
    document.getElementById('totalWords').textContent = stats.totalUnigrams.toLocaleString();
  }

  async trainOnCurrentTab() {
    try {
      this.showLoading(true);
      
      // Get current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        throw new Error('No active tab found');
      }
      
      const tab = tabs[0];
      
      // Check if we can access the tab
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        throw new Error('Cannot train on this page');
      }
      
      // Extract text from the page
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: this.extractTextFromPage
      });
      
      if (results && results[0] && results[0].result) {
        const text = results[0].result;
        if (text.length > 0) {
          // Train the model
          const response = await chrome.runtime.sendMessage({
            action: 'train',
            text: text
          });
          
          if (response && response.success) {
            this.showStatus(`Successfully trained on ${response.tokensAdded} tokens`, 'success');
            await this.loadStats();
          } else {
            throw new Error(response?.error || 'Training failed');
          }
        } else {
          throw new Error('No text found on this page');
        }
      } else {
        throw new Error('Failed to extract text from page');
      }
      
    } catch (error) {
      console.error('Training failed:', error);
      this.showStatus(`Training failed: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  extractTextFromPage() {
    // Function to extract text content from page
    const textElements = ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th', 'article', 'section'];
    const textContents = [];
    
    textElements.forEach(tag => {
      const elements = document.getElementsByTagName(tag);
      for (let element of elements) {
        if (element.textContent && element.textContent.trim().length > 10) {
          // Skip elements that are likely navigation, ads, etc.
          const text = element.textContent.trim();
          if (!this.isLikelyNoise(text)) {
            textContents.push(text);
          }
        }
      }
    });
    
    return textContents.join('\
');
  }

  isLikelyNoise(text) {
    // Simple heuristic to filter out noise
    const noisePatterns = [
      /^subscribe$/i,
      /^click here$/i,
      /^learn more$/i,
      /^read more$/i,
      /^menu$/i,
      /^home$/i,
      /^contact$/i,
      /^about$/i,
      /^\d+$/,
      /^[^\w\s]+$/,
      /^(Cookie|Privacy|Terms|Legal)/i
    ];
    
    return noisePatterns.some(pattern => pattern.test(text));
  }

  async resetModel() {
    if (!confirm('Are you sure you want to reset the model? This will delete all learned data.')) {
      return;
    }
    
    try {
      this.showLoading(true);
      
      const response = await chrome.runtime.sendMessage({ action: 'resetModel' });
      if (response && response.success) {
        this.showStatus('Model reset successfully', 'success');
        await this.loadStats();
      } else {
        throw new Error(response?.error || 'Reset failed');
      }
      
    } catch (error) {
      console.error('Reset failed:', error);
      this.showStatus(`Reset failed: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async exportModel() {
    try {
      this.showLoading(true);
      
      const response = await chrome.runtime.sendMessage({ action: 'exportModel' });
      if (response && response.success) {
        this.showStatus('Model exported successfully', 'success');
      } else {
        throw new Error(response?.error || 'Export failed');
      }
      
    } catch (error) {
      console.error('Export failed:', error);
      this.showStatus(`Export failed: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async importModel(file) {
    if (!file) return;
    
    try {
      this.showLoading(true);
      
      const text = await file.text();
      const data = JSON.parse(text);
      
      const response = await chrome.runtime.sendMessage({
        action: 'importModel',
        data: data
      });
      
      if (response && response.success) {
        this.showStatus('Model imported successfully', 'success');
        await this.loadStats();
      } else {
        throw new Error(response?.error || 'Import failed');
      }
      
    } catch (error) {
      console.error('Import failed:', error);
      this.showStatus(`Import failed: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
      // Clear the file input
      document.getElementById('importModel').value = '';
    }
  }

  async testPrediction(text) {
    const resultElement = document.getElementById('testResult');
    
    if (!text || text.trim().length < 2) {
      resultElement.textContent = '-';
      return;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'predict',
        text: text
      });
      
      if (response && response.prediction) {
        resultElement.textContent = response.prediction;
      } else {
        resultElement.textContent = 'No prediction';
      }
      
    } catch (error) {
      console.error('Test prediction failed:', error);
      resultElement.textContent = 'Error';
    }
  }

  async notifyContentScript(action, data = {}) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: action,
          ...data
        });
      }
    } catch (error) {
      console.error('Failed to notify content script:', error);
    }
  }

  showStatus(message, type = 'info') {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    statusElement.classList.add('show');
    
    setTimeout(() => {
      statusElement.classList.remove('show');
    }, 3000);
  }

  showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
      overlay.classList.add('show');
    } else {
      overlay.classList.remove('show');
    }
  }

  showHelp() {
    const helpText = `
Lexi - Text Prediction Help

HOW TO USE:
1. Enable Lexi using the toggle at the top
2. Start typing in any text field
3. Lexi will predict the next word based on your typing
4. Press the prediction key (default: Tab) to accept the prediction

SETTINGS:
\u2022 Prediction Key: Choose which key accepts predictions
\u2022 Display Mode: Inline shows predictions as gray text, Floating shows them in a bubble
\u2022 Prediction Color: Customize the color of predicted text

TRAINING:
\u2022 Click "Train on Current Tab" to learn from the current webpage
\u2022 The model automatically learns from your typing
\u2022 Export/Import models to backup or share your training data

TIPS:
\u2022 The model gets better with more training data
\u2022 Start with pages that have lots of text (articles, documentation, etc.)
\u2022 Reset the model if you want to start fresh
\u2022 Check the model statistics to see how much it has learned
    `;
    
    alert(helpText.trim());
  }

  showAbout() {
    const aboutText = `
Lexi - AI Text Prediction
Version 1.0.0

A Chrome extension that provides intelligent text prediction using trigram language models. Lexi learns from your typing and the web pages you visit to provide increasingly accurate predictions.

Features:
\u2022 Real-time text prediction
\u2022 Customizable prediction keys
\u2022 Trigram language model
\u2022 Automatic learning from web content
\u2022 Model import/export functionality

Created with \u2764\ufe0f for faster typing and better productivity.
    `;
    
    alert(aboutText.trim());
  }
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new LexiPopup();
});
