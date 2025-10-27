
class LexiContentScript {
  constructor() {
    this.currentInput = null;
    this.currentPrediction = null;
    this.predictionElement = null;
    this.isEnabled = true;
    this.settings = {
      predictionKey: 'Tab',
      predictionColor: '#007acc',
      showInline: true
    };
    
    this.init();
  }

  async init() {
    // Load settings from storage
    await this.loadSettings();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Inject prediction display styles
    this.injectStyles();
    
    console.log('Lexi content script initialized');
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['lexiSettings', 'lexiEnabled']);
      if (result.lexiSettings) {
        this.settings = { ...this.settings, ...result.lexiSettings };
      }
      if (result.lexiEnabled !== undefined) {
        this.isEnabled = result.lexiEnabled;
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  setupEventListeners() {
    // Focus events for text inputs
    document.addEventListener('focus', (e) => this.handleInputFocus(e), true);
    document.addEventListener('blur', (e) => this.handleInputBlur(e), true);
    
    // Input events for text capture
    document.addEventListener('input', (e) => this.handleInput(e), true);
    document.addEventListener('keyup', (e) => this.handleKeyUp(e), true);
    
    // Keyboard events for prediction insertion
    document.addEventListener('keydown', (e) => this.handleKeyDown(e), true);
    
    // Click events to hide prediction
    document.addEventListener('click', () => this.hidePrediction());
  }

  handleInputFocus(event) {
    const element = event.target;
    if (!this.isTextInput(element) || !this.isEnabled) return;
    
    this.currentInput = element;
    this.attachInputListeners(element);
  }

  handleInputBlur(event) {
    if (event.target === this.currentInput) {
      this.currentInput = null;
      this.hidePrediction();
    }
  }

  attachInputListeners(input) {
    // Additional listeners might be needed for dynamic content
    if (input.tagName === 'TEXTAREA' || (input.tagName === 'INPUT' && input.type === 'text')) {
      input.addEventListener('compositionstart', () => this.hidePrediction());
      input.addEventListener('compositionend', () => this.handleInput({ target: input }));
    }
  }

  handleInput(event) {
    if (!this.isEnabled || !this.currentInput || event.target !== this.currentInput) return;
    
    const text = this.getCurrentText();
    if (text.length < 2) {
      this.hidePrediction();
      return;
    }
    
    this.requestPrediction(text);
  }

  handleKeyUp(event) {
    if (!this.isEnabled || !this.currentInput) return;
    
    const text = this.getCurrentText();
    if (text.length < 2) {
      this.hidePrediction();
      return;
    }
    
    this.requestPrediction(text);
  }

  handleKeyDown(event) {
    if (!this.isEnabled || !this.currentInput || !this.currentPrediction) return;
    
    // Check if the pressed key matches the prediction key
    if (this.isPredictionKey(event)) {
      event.preventDefault();
      this.insertPrediction();
    }
    
    // Hide prediction on certain keys
    if (['Escape', 'ArrowUp', 'ArrowDown', 'Enter'].includes(event.key)) {
      this.hidePrediction();
    }
  }

  isPredictionKey(event) {
    switch (this.settings.predictionKey) {
      case 'Tab':
        return event.key === 'Tab';
      case 'Enter':
        return event.key === 'Enter';
      case 'Space':
        return event.key === ' ';
      case 'Ctrl+Space':
        return event.ctrlKey && event.key === ' ';
      default:
        return false;
    }
  }

  getCurrentText() {
    if (!this.currentInput) return '';
    
    if (this.currentInput.tagName === 'INPUT' || this.currentInput.tagName === 'TEXTAREA') {
      return this.currentInput.value;
    } else if (this.currentInput.isContentEditable) {
      return this.currentInput.textContent || this.currentInput.innerText;
    }
    
    return '';
  }

  async requestPrediction(text) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'predict',
        text: text
      });
      
      if (response && response.prediction) {
        this.currentPrediction = response.prediction;
        this.showPrediction(response.prediction);
      } else {
        this.hidePrediction();
      }
    } catch (error) {
      console.error('Prediction request failed:', error);
      this.hidePrediction();
    }
  }

  showPrediction(prediction) {
    if (!this.currentInput || !prediction) return;
    
    if (this.settings.showInline) {
      this.showInlinePrediction(prediction);
    } else {
      this.showFloatingPrediction(prediction);
    }
  }

  showInlinePrediction(prediction) {
    this.hidePrediction();
    
    // Create prediction element
    this.predictionElement = document.createElement('span');
    this.predictionElement.className = 'lexi-prediction-inline';
    this.predictionElement.textContent = prediction;
    this.predictionElement.style.cssText = `
      color: ${this.settings.predictionColor};
      opacity: 0.6;
      font-style: italic;
      pointer-events: none;
      position: absolute;
      background: transparent;
      border: none;
      outline: none;
      white-space: pre;
      z-index: 10000;
    `;
    
    // Position the prediction element
    this.positionPredictionElement();
    
    // Add to DOM
    document.body.appendChild(this.predictionElement);
  }

  showFloatingPrediction(prediction) {
    this.hidePrediction();
    
    // Create floating prediction bubble
    this.predictionElement = document.createElement('div');
    this.predictionElement.className = 'lexi-prediction-floating';
    this.predictionElement.innerHTML = `
      <div class="lexi-prediction-content">
        <span class="lexi-prediction-text">${prediction}</span>
        <span class="lexi-prediction-hint">(${this.settings.predictionKey})</span>
      </div>
    `;
    this.predictionElement.style.cssText = `
      position: absolute;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10000;
      pointer-events: none;
    `;
    
    // Position the floating prediction
    this.positionFloatingPrediction();
    
    // Add to DOM
    document.body.appendChild(this.predictionElement);
  }

  positionPredictionElement() {
    if (!this.currentInput || !this.predictionElement) return;
    
    const rect = this.currentInput.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(this.currentInput);
    
    // Copy font styles from input element
    this.predictionElement.style.font = computedStyle.font;
    this.predictionElement.style.fontSize = computedStyle.fontSize;
    this.predictionElement.style.fontFamily = computedStyle.fontFamily;
    this.predictionElement.style.lineHeight = computedStyle.lineHeight;
    
    // Calculate position
    const text = this.getCurrentText();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = this.predictionElement.style.font;
    const textWidth = context.measureText(text).width;
    
    let left = rect.left + textWidth;
    let top = rect.top + parseInt(computedStyle.paddingTop) || 0;
    
    // Handle text area vs input
    if (this.currentInput.tagName === 'TEXTAREA') {
      const lines = text.split('\
');
      const lastLine = lines[lines.length - 1];
      const lastLineWidth = context.measureText(lastLine).width;
      left = rect.left + lastLineWidth;
      top = rect.top + (lines.length - 1) * parseInt(computedStyle.lineHeight) + parseInt(computedStyle.paddingTop);
    }
    
    this.predictionElement.style.left = `${left + window.scrollX}px`;
    this.predictionElement.style.top = `${top + window.scrollY}px`;
  }

  positionFloatingPrediction() {
    if (!this.currentInput || !this.predictionElement) return;
    
    const rect = this.currentInput.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    this.predictionElement.style.left = `${rect.left + scrollLeft}px`;
    this.predictionElement.style.top = `${rect.bottom + scrollTop + 2}px`;
  }

  hidePrediction() {
    if (this.predictionElement) {
      this.predictionElement.remove();
      this.predictionElement = null;
    }
    this.currentPrediction = null;
  }

  insertPrediction() {
    if (!this.currentInput || !this.currentPrediction) return;
    
    const currentText = this.getCurrentText();
    const cursorPos = this.getCursorPosition();
    
    if (this.currentInput.tagName === 'INPUT' || this.currentInput.tagName === 'TEXTAREA') {
      const newText = currentText + this.currentPrediction;
      this.currentInput.value = newText;
      
      // Set cursor position after inserted text
      this.setCursorPosition(cursorPos + this.currentPrediction.length);
    } else if (this.currentInput.isContentEditable) {
      // Handle content editable elements
      const textNode = document.createTextNode(this.currentPrediction);
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    
    this.hidePrediction();
    
    // Trigger input event for any listeners
    const event = new Event('input', { bubbles: true });
    this.currentInput.dispatchEvent(event);
  }

  getCursorPosition() {
    if (!this.currentInput) return 0;
    
    if (this.currentInput.tagName === 'INPUT' || this.currentInput.tagName === 'TEXTAREA') {
      return this.currentInput.selectionStart || 0;
    }
    
    return 0;
  }

  setCursorPosition(position) {
    if (!this.currentInput) return;
    
    if (this.currentInput.tagName === 'INPUT' || this.currentInput.tagName === 'TEXTAREA') {
      this.currentInput.setSelectionRange(position, position);
      this.currentInput.focus();
    }
  }

  isTextInput(element) {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    const type = element.type ? element.type.toLowerCase() : '';
    
    return (
      tagName === 'textarea' ||
      (tagName === 'input' && (type === 'text' || type === 'search' || type === 'email' || type === 'url')) ||
      element.isContentEditable
    );
  }

  injectStyles() {
    const styleId = 'lexi-content-styles';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .lexi-prediction-inline {
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
      }
      
      .lexi-prediction-floating {
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
      }
      
      .lexi-prediction-content {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      
      .lexi-prediction-text {
        font-weight: 500;
        color: #333;
      }
      
      .lexi-prediction-hint {
        font-size: 12px;
        color: #666;
        opacity: 0.7;
      }
    `;
    document.head.appendChild(style);
  }
}

// Initialize the content script
const lexi = new LexiContentScript();

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateSettings') {
    lexi.loadSettings().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.action === 'toggleEnabled') {
    lexi.isEnabled = message.enabled;
    if (!message.enabled) {
      lexi.hidePrediction();
    }
    sendResponse({ success: true });
  }
});
