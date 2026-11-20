/**
 * Interactive Context-Aware AI Trading Co-Pilot & Platform Guide Widget.
 * Floating and docked AI assistant powered by Gemini API with live state injection,
 * quick-action prompts, and Web Speech API (TTS voice output + STT voice input).
 */

import { sendCopilotChat, AICopilotResponse, MTFSetupReport } from './api';

export class AICopilotWidget {
  private container: HTMLElement;
  private isMinimized: boolean = true;
  private isSpeaking: boolean = false;
  private isListening: boolean = false;
  private recognition: any = null;
  private activeSymbol: string = 'RELIANCE';
  private currentPrice: number = 1363.0;
  private activeBlueprint: any = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'ai-copilot-widget';
    this.container.className = 'copilot-widget minimized';
    document.body.appendChild(this.container);

    this.initSpeechRecognition();
    this.render();
  }

  public setContext(symbol: string, price: number, mtfReport?: MTFSetupReport | null) {
    this.activeSymbol = symbol;
    this.currentPrice = price;
    this.activeBlueprint = mtfReport?.blueprint || null;
    this.updateContextBar();
  }

  public open() {
    this.isMinimized = false;
    this.container.classList.remove('minimized');
    const input = this.container.querySelector('#copilot-input') as HTMLInputElement;
    if (input) input.focus();
  }

  public close() {
    this.isMinimized = true;
    this.container.classList.add('minimized');
    this.stopSpeaking();
  }

  public toggle() {
    if (this.isMinimized) this.open();
    else this.close();
  }

  private initSpeechRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        const input = this.container.querySelector('#copilot-input') as HTMLInputElement;
        if (input) {
          input.value = text;
          this.sendMessage(text);
        }
        this.setListening(false);
      };

      this.recognition.onerror = () => {
        this.setListening(false);
      };

      this.recognition.onend = () => {
        this.setListening(false);
      };
    }
  }

  private render() {
    this.container.innerHTML = `
      <!-- Backdrop for mobile tap-to-close -->
      <div class="copilot-backdrop" id="copilot-backdrop"></div>

      <!-- Minimized Floating Trigger Button -->
      <button class="copilot-launcher" id="btn-copilot-launch" title="Open AI Trading Co-Pilot">
        <span class="launcher-icon">✨</span>
        <span class="launcher-pulse"></span>
        <span class="launcher-text">AI Co-Pilot</span>
      </button>

      <!-- Expanded Drawer / Panel / Bottom Sheet -->
      <div class="copilot-panel">
        <div class="copilot-sheet-handle"></div>
        <div class="copilot-header">
          <div class="copilot-title-row">
            <span class="robot-avatar">🤖</span>
            <div>
              <div class="copilot-title">QuantumFloor Co-Pilot</div>
              <div class="copilot-subtitle">Institutional Multi-Agent Intelligence</div>
            </div>
          </div>
          <div class="copilot-header-actions">
            <button class="copilot-btn-icon" id="btn-voice-toggle" title="Voice Guidance">${this.isSpeaking ? '🔊' : '🔈'}</button>
            <button class="copilot-btn-close" id="btn-copilot-close" title="Close Co-Pilot">✕ Close</button>
          </div>
        </div>

        <!-- Live Injected Context Strip -->
        <div class="copilot-context-bar" id="copilot-context-strip">
          <span class="ctx-pill">Chart: <strong id="ctx-sym">${this.activeSymbol}</strong></span>
          <span class="ctx-pill">Price: <strong id="ctx-price">${this.currentPrice.toFixed(2)}</strong></span>
          <span class="ctx-pill" id="ctx-bias">Bias: <strong>Analyzing...</strong></span>
        </div>

        <!-- Message History -->
        <div class="copilot-chat-body" id="copilot-chat-thread">
          <div class="copilot-msg bot-msg welcome-msg">
            <div class="msg-content">
              <strong>Hello! I am your QuantumFloor Trading Co-Pilot.</strong><br/>
              I am actively monitoring the live market across Indian Equities, Global Forex, SMC market structure, and macro calendars.
              <br/><br/>
              How can I assist your execution right now?
            </div>
          </div>
        </div>

        <!-- Quick Action Chips -->
        <div class="copilot-chips-row" id="copilot-chips-container">
          <button class="copilot-chip" data-query="Explain Current Chart Setup">📊 Explain Chart Setup</button>
          <button class="copilot-chip" data-query="What Should I Trade Right Now?">🎯 What Should I Trade?</button>
          <button class="copilot-chip" data-query="Best IPOs to Apply?">💼 Best IPOs to Apply?</button>
          <button class="copilot-chip" data-query="How Do I Use This App?">🧭 Platform Walkthrough</button>
        </div>

        <!-- Input Bar -->
        <div class="copilot-footer">
          <button class="copilot-mic-btn ${this.isListening ? 'listening' : ''}" id="btn-mic" title="Voice Input (Speak)">
            ${this.isListening ? '🔴' : '🎙️'}
          </button>
          <input type="text" id="copilot-input" class="copilot-input-field" placeholder="Ask about active setups, BOS/CHoCH, IPOs, or guidance..." />
          <button class="copilot-send-btn" id="btn-send-chat" title="Send Question">➤</button>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-copilot-launch')?.addEventListener('click', () => this.open());
    this.container.querySelector('#btn-copilot-close')?.addEventListener('click', () => this.close());
    this.container.querySelector('#copilot-backdrop')?.addEventListener('click', () => this.close());
    this.container.querySelector('#btn-voice-toggle')?.addEventListener('click', () => {
      if (this.isSpeaking) this.stopSpeaking();
    });

    const sendBtn = this.container.querySelector('#btn-send-chat');
    const inputField = this.container.querySelector('#copilot-input') as HTMLInputElement;

    sendBtn?.addEventListener('click', () => {
      const q = inputField?.value?.trim();
      if (q) {
        inputField.value = '';
        this.sendMessage(q);
      }
    });

    inputField?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = inputField.value.trim();
        if (q) {
          inputField.value = '';
          this.sendMessage(q);
        }
      }
    });

    // Mic button
    this.container.querySelector('#btn-mic')?.addEventListener('click', () => this.toggleListening());

    // Chips
    this.attachChipListeners();
  }

  private attachChipListeners() {
    this.container.querySelectorAll('.copilot-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const q = target.dataset.query;
        if (q) this.sendMessage(q);
      });
    });
  }

  private updateContextBar() {
    const symEl = this.container.querySelector('#ctx-sym');
    const priceEl = this.container.querySelector('#ctx-price');
    const biasEl = this.container.querySelector('#ctx-bias');

    if (symEl) symEl.textContent = this.activeSymbol;
    if (priceEl) priceEl.textContent = this.currentPrice.toFixed(2);
    if (biasEl && this.activeBlueprint) {
      biasEl.innerHTML = `Action: <strong class="${this.activeBlueprint.action === 'BUY' ? 'txt-buy' : 'txt-sell'}">${this.activeBlueprint.action}</strong>`;
    }
  }

  private toggleListening() {
    if (!this.recognition) {
      alert('Speech recognition is not supported in this browser. Please type your query.');
      return;
    }
    if (this.isListening) {
      this.recognition.stop();
      this.setListening(false);
    } else {
      try {
        this.recognition.start();
        this.setListening(true);
      } catch (e) {
        this.setListening(false);
      }
    }
  }

  private setListening(val: boolean) {
    this.isListening = val;
    const mic = this.container.querySelector('#btn-mic');
    if (mic) {
      mic.innerHTML = val ? '🔴' : '🎙️';
      mic.classList.toggle('listening', val);
    }
  }

  public async sendMessage(query: string) {
    const thread = this.container.querySelector('#copilot-chat-thread');
    if (!thread) return;

    // Append User Message
    const userMsg = document.createElement('div');
    userMsg.className = 'copilot-msg user-msg';
    userMsg.innerHTML = `<div class="msg-content">${this.escapeHtml(query)}</div>`;
    thread.appendChild(userMsg);

    // Append Thinking Indicator
    const thinkingMsg = document.createElement('div');
    thinkingMsg.className = 'copilot-msg bot-msg thinking';
    thinkingMsg.innerHTML = `<div class="msg-content"><span class="dots-pulse">Synthesizing institutional quantitative setup...</span></div>`;
    thread.appendChild(thinkingMsg);
    thread.scrollTop = thread.scrollHeight;

    try {
      const res = await sendCopilotChat({
        user_query: query,
        active_symbol: this.activeSymbol,
        current_price: this.currentPrice,
        mtf_blueprint: this.activeBlueprint,
      });

      thinkingMsg.remove();

      // Append Bot Response
      const botMsg = document.createElement('div');
      botMsg.className = 'copilot-msg bot-msg';
      botMsg.innerHTML = `
        <div class="msg-content">
          ${this.formatMarkdown(res.markdown_answer)}
        </div>
        <div class="msg-actions">
          <button class="small-voice-btn" data-voice="${encodeURIComponent(res.voice_script)}">
            🔊 Read Trade Plan Aloud
          </button>
          <span class="model-badge">${res.model_used}</span>
        </div>
      `;

      thread.appendChild(botMsg);
      thread.scrollTop = thread.scrollHeight;

      // Attach voice read aloud listener
      botMsg.querySelector('.small-voice-btn')?.addEventListener('click', (e) => {
        const btn = e.currentTarget as HTMLElement;
        const voiceText = decodeURIComponent(btn.dataset.voice || '');
        this.speakText(voiceText);
      });

      // Update chips if returned
      if (res.suggested_chips && res.suggested_chips.length > 0) {
        const chipsContainer = this.container.querySelector('#copilot-chips-container');
        if (chipsContainer) {
          chipsContainer.innerHTML = res.suggested_chips.map(chip => `
            <button class="copilot-chip" data-query="${chip}">${chip}</button>
          `).join('');
          this.attachChipListeners();
        }
      }

    } catch (e: any) {
      thinkingMsg.remove();
      const err = document.createElement('div');
      err.className = 'copilot-msg bot-msg error-msg';
      err.textContent = `Co-Pilot communication error: ${e.message}`;
      thread.appendChild(err);
      thread.scrollTop = thread.scrollHeight;
    }
  }

  private speakText(text: string) {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in this browser.');
      return;
    }

    this.stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      this.isSpeaking = true;
      const toggle = this.container.querySelector('#btn-voice-toggle');
      if (toggle) toggle.textContent = '🔊';
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      const toggle = this.container.querySelector('#btn-voice-toggle');
      if (toggle) toggle.textContent = '🔈';
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      const toggle = this.container.querySelector('#btn-voice-toggle');
      if (toggle) toggle.textContent = '🔈';
    };

    window.speechSynthesis.speak(utterance);
  }

  private stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
      const toggle = this.container.querySelector('#btn-voice-toggle');
      if (toggle) toggle.textContent = '🔈';
    }
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private formatMarkdown(md: string): string {
    // Simple fast markdown parser for bold, headers, and bullet lists
    let html = md
      .replace(/^### (.*$)/gim, '<h4>$1</h4>')
      .replace(/^#### (.*$)/gim, '<h5>$1</h5>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>')
      .replace(/\n\n/g, '<br/><br/>');

    if (html.includes('<li>')) {
      html = html.replace(/(<li>[\s\S]*?<\/li>)/gm, '<ul>$1</ul>');
    }
    return html;
  }
}
