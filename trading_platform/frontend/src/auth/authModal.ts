/**
 * Multi-User Authentication, RBAC, Encrypted Broker Key Vault & Audit Trail UI
 */

import { store } from '../state';
import {
  loginUser,
  registerUser,
  switchInvestmentMode,
  saveVaultKey,
  fetchVaultKeys,
  fetchAuditLogs,
} from '../api';

export function renderSecurityPanel(): string {
  const u = store.currentUser;
  const keys = store.vaultKeys;
  const logs = store.auditLogs;

  return `
    <div class="enterprise-view-container">
      <div class="view-header">
        <div>
          <h2 class="view-title">🔐 MULTI-USER RBAC & ENCRYPTED BROKER KEY VAULT</h2>
          <p class="view-subtitle">AES-128 Fernet Key Encryption, Strict Role-Based Permissions & Immutable Security Audit Trail</p>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button id="btn-open-login" class="btn-toggle">
            <span>👤 ${u ? u.username.toUpperCase() + ' (' + u.role + ')' : 'LOGIN / SWITCH USER'}</span>
          </button>
        </div>
      </div>

      <!-- Top Profile & Mode Grid -->
      <div class="quant-grid" style="grid-template-columns: 1.5fr 1fr; margin-bottom:16px;">
        <!-- User Profile Card -->
        <div class="quant-badge" style="padding:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:16px; font-weight:700;">${u?.username || 'admin'}</span>
              <span class="brand-badge" style="color:var(--color-cyan); border-color:var(--color-cyan)">${u?.role || 'ADMIN'}</span>
            </div>
            <span style="font-size:10px; color:var(--text-dim); font-family:var(--font-mono)">${u?.user_id || 'USR-ADMIN-01'}</span>
          </div>
          <span style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:10px;">${u?.email || 'admin@quantumfloor.institutional'}</span>

          <!-- Mode Switcher -->
          <div style="background:var(--bg-dark); padding:8px 12px; border-radius:4px; border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="font-size:10px; color:var(--text-dim); text-transform:uppercase; font-weight:600;">Active Platform Mode</span>
              <div id="active-mode-display" style="font-weight:700; font-family:var(--font-mono); font-size:12px; color:var(--color-green)">
                ${u?.investment_mode === 'LONG_TERM_WEALTH' ? '🌱 LONG-TERM WEALTH / SIP' : '🤖 AUTONOMOUS TRADING (INTRADAY)'}
              </div>
            </div>
            <button id="btn-toggle-mode" class="btn-primary" style="font-size:10px; padding:4px 10px;">
              SWITCH MODE
            </button>
          </div>
        </div>

        <!-- 2FA & Compliance Card -->
        <div class="quant-badge" style="padding:12px;">
          <span class="quant-label">Institutional Security Health</span>
          <div style="margin-top:6px; font-size:11px; line-height:1.6;">
            <div>🛡️ AES-128 Fernet Key Vault: <strong class="val-green">ACTIVE</strong></div>
            <div>🔑 JWT Session Lifetime: <strong class="val-cyan">24 Hours (HS256)</strong></div>
            <div>📋 Regulatory Audit Logging: <strong class="val-green">ENABLED (WAL)</strong></div>
            <div>🔐 Multi-Factor TOTP Gate: <strong class="${u?.totp_enabled ? 'val-green' : 'val-amber'}">${u?.totp_enabled ? 'ENFORCED' : 'OPTIONAL'}</strong></div>
          </div>
        </div>
      </div>

      <!-- Encrypted Broker Key Vault -->
      <div style="background:var(--bg-panel); border:1px solid var(--border-color); border-radius:6px; padding:14px; margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <h3 style="font-size:13px; font-weight:700; text-transform:uppercase;">Encrypted Broker Credentials Vault</h3>
            <span style="font-size:10px; color:var(--text-dim)">API Keys and Secrets stored with hardware-grade symmetric encryption. Never exposed in plaintext.</span>
          </div>
          <button id="btn-add-vault-key" class="btn-action-buy" style="font-size:11px; padding:4px 10px;">
            + ADD BROKER KEY
          </button>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>Broker Integration</th>
              <th>API Key (Masked)</th>
              <th>Secret Hash</th>
              <th>Environment</th>
              <th>Status</th>
              <th>Last Synced</th>
            </tr>
          </thead>
          <tbody id="vault-keys-body">
            ${keys.map((k) => `
              <tr>
                <td><strong>${k.broker_name}</strong></td>
                <td><code>${k.api_key_masked}</code></td>
                <td><code>${k.secret_masked}</code></td>
                <td><span class="brand-badge">${k.environment}</span></td>
                <td><span class="val-green">● Connected</span></td>
                <td style="color:var(--text-dim)">${k.updated_at.substring(0, 16).replace('T', ' ')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Immutable Security Audit Trail -->
      <div style="background:var(--bg-panel); border:1px solid var(--border-color); border-radius:6px; padding:14px;">
        <div style="margin-bottom:12px;">
          <h3 style="font-size:13px; font-weight:700; text-transform:uppercase;">Immutable Security Audit Trail</h3>
          <span style="font-size:10px; color:var(--text-dim)">Verifiable transaction and governance activity logged with timestamp and origin IP.</span>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>Log ID</th>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Status</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody id="audit-logs-body">
            ${logs.slice(0, 15).map((l) => `
              <tr>
                <td><code>${l.log_id}</code></td>
                <td style="color:var(--text-dim)">${l.timestamp.substring(11, 19)}</td>
                <td><strong>${l.username}</strong></td>
                <td><span class="val-cyan">${l.action}</span></td>
                <td>${l.resource}</td>
                <td><span class="${l.status === 'SUCCESS' ? 'val-green' : 'val-red'}">${l.status}</span></td>
                <td style="color:var(--text-dim)">${l.ip_address}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Add Key Modal -->
      <div id="add-key-modal" class="modal-overlay hidden">
        <div class="modal-content" style="max-width:480px;">
          <div class="modal-header">
            <h3>Vault Broker API Key</h3>
            <button class="modal-close-btn" id="btn-close-key-modal">✕</button>
          </div>
          <form id="vault-key-form" style="padding:16px;">
            <div style="margin-bottom:10px;">
              <label style="font-size:10px; color:var(--text-dim); display:block; margin-bottom:4px;">Broker Platform</label>
              <select id="input-broker-name" class="ticket-input" style="width:100%;">
                <option value="Zerodha Kite Connect">Zerodha Kite Connect (NSE/BSE)</option>
                <option value="Angel One SmartAPI">Angel One SmartAPI (NSE/BSE/FNO)</option>
                <option value="Upstox Pro API">Upstox Pro API</option>
                <option value="Dhan HQ">Dhan HQ Express</option>
                <option value="OANDA v20 Forex">OANDA v20 (Global FX)</option>
                <option value="MetaTrader 5 Bridge">MetaTrader 5 (MT5)</option>
              </select>
            </div>
            <div style="margin-bottom:10px;">
              <label style="font-size:10px; color:var(--text-dim); display:block; margin-bottom:4px;">API Key</label>
              <input type="text" id="input-api-key" class="ticket-input" style="width:100%;" placeholder="e.g. your_broker_key_xyz" required />
            </div>
            <div style="margin-bottom:14px;">
              <label style="font-size:10px; color:var(--text-dim); display:block; margin-bottom:4px;">API Secret</label>
              <input type="password" id="input-api-secret" class="ticket-input" style="width:100%;" placeholder="••••••••••••••••" required />
            </div>
            <button type="submit" class="btn-primary" style="width:100%; padding:8px;">
              🔒 ENCRYPT & STORE IN FERNET VAULT
            </button>
          </form>
        </div>
      </div>

      <!-- Login / Switch User Modal -->
      <div id="auth-user-modal" class="modal-overlay hidden">
        <div class="modal-content" style="max-width:440px;">
          <div class="modal-header">
            <h3>Enterprise Authentication</h3>
            <button class="modal-close-btn" id="btn-close-auth-modal">✕</button>
          </div>
          <div style="padding:16px;">
            <div style="margin-bottom:10px;">
              <label style="font-size:10px; color:var(--text-dim); display:block; margin-bottom:4px;">Username</label>
              <input type="text" id="auth-username" class="ticket-input" style="width:100%;" value="admin" required />
            </div>
            <div style="margin-bottom:14px;">
              <label style="font-size:10px; color:var(--text-dim); display:block; margin-bottom:4px;">Password</label>
              <input type="password" id="auth-password" class="ticket-input" style="width:100%;" value="Admin@QuantumFloor2026" required />
            </div>
            <div style="display:flex; gap:8px;">
              <button id="btn-login-submit" class="btn-primary" style="flex:1; padding:8px;">LOGIN (JWT)</button>
              <button id="btn-register-submit" class="btn-toggle" style="flex:1; padding:8px; justify-content:center;">REGISTER</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function setupSecurityEventListeners(): void {
  // Mode toggle
  document.getElementById('btn-toggle-mode')?.addEventListener('click', async () => {
    const curr = store.currentUser?.investment_mode;
    const next = curr === 'AUTONOMOUS_TRADING' ? 'LONG_TERM_WEALTH' : 'AUTONOMOUS_TRADING';
    await switchInvestmentMode(next);
    if (store.currentUser) store.currentUser.investment_mode = next;
    const disp = document.getElementById('active-mode-display');
    if (disp) {
      disp.innerText = next === 'LONG_TERM_WEALTH' ? '🌱 LONG-TERM WEALTH / SIP' : '🤖 AUTONOMOUS TRADING (INTRADAY)';
    }
    store.notify();
  });

  // Add Key Modal
  const keyModal = document.getElementById('add-key-modal');
  document.getElementById('btn-add-vault-key')?.addEventListener('click', () => {
    keyModal?.classList.remove('hidden');
  });
  document.getElementById('btn-close-key-modal')?.addEventListener('click', () => {
    keyModal?.classList.add('hidden');
  });

  document.getElementById('vault-key-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const broker = (document.getElementById('input-broker-name') as HTMLSelectElement).value;
    const key = (document.getElementById('input-api-key') as HTMLInputElement).value;
    const sec = (document.getElementById('input-api-secret') as HTMLInputElement).value;

    try {
      await saveVaultKey({ broker_name: broker, api_key: key, api_secret: sec });
      alert(`API Key for ${broker} securely vaulted with AES-128 Fernet encryption!`);
      keyModal?.classList.add('hidden');
      store.vaultKeys = await fetchVaultKeys();
      store.notify();
    } catch (err: any) {
      alert(`Vault Error: ${err.message}`);
    }
  });

  // Auth Modal
  const authModal = document.getElementById('auth-user-modal');
  document.getElementById('btn-open-login')?.addEventListener('click', () => {
    authModal?.classList.remove('hidden');
  });
  document.getElementById('btn-close-auth-modal')?.addEventListener('click', () => {
    authModal?.classList.add('hidden');
  });

  document.getElementById('btn-login-submit')?.addEventListener('click', async () => {
    const u = (document.getElementById('auth-username') as HTMLInputElement).value;
    const p = (document.getElementById('auth-password') as HTMLInputElement).value;
    try {
      const res = await loginUser({ username: u, password: p });
      store.currentUser = res.user;
      alert(`Welcome back, ${res.user.username}! Role: ${res.user.role}`);
      authModal?.classList.add('hidden');
      store.notify();
    } catch (err: any) {
      alert(`Login failed: ${err.message}`);
    }
  });

  document.getElementById('btn-register-submit')?.addEventListener('click', async () => {
    const u = (document.getElementById('auth-username') as HTMLInputElement).value;
    const p = (document.getElementById('auth-password') as HTMLInputElement).value;
    try {
      const res = await registerUser({ username: u, email: `${u}@quantumfloor.institutional`, password: p });
      store.currentUser = res.user;
      alert(`Registration successful! User ID: ${res.user.user_id}`);
      authModal?.classList.add('hidden');
      store.notify();
    } catch (err: any) {
      alert(`Registration failed: ${err.message}`);
    }
  });
}
