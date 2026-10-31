import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { execSync, execFile } from 'child_process';
import { promisify } from 'util';
import { rootDir, dataDir } from '../paths.js';
import { loadHaConfig, saveHaConfig, triggerHaAutomation } from '../haConfig.js';

const router = Router();

const execFileAsync = promisify(execFile);

// --- GIT CREDENTIALS SPEICHER (Dauerhaft auf Server & Pi) ---
const gitConfigPath = path.resolve(rootDir, '.git-credentials.json');
const gitDataConfigPath = path.join(dataDir, 'git-credentials.json');

function loadGitConfig(): { repoUrl: string; token: string; branch: string } {
  try {
    if (fs.existsSync(gitDataConfigPath)) {
      const data = JSON.parse(fs.readFileSync(gitDataConfigPath, 'utf8'));
      if (data && (data.token || data.repoUrl)) {
        return {
          repoUrl: data.repoUrl || '',
          token: data.token || '',
          branch: data.branch || 'main'
        };
      }
    }
    if (fs.existsSync(gitConfigPath)) {
      const data = JSON.parse(fs.readFileSync(gitConfigPath, 'utf8'));
      if (data && (data.token || data.repoUrl)) {
        return {
          repoUrl: data.repoUrl || '',
          token: data.token || '',
          branch: data.branch || 'main'
        };
      }
    }
  } catch {}
  return {
    repoUrl: process.env.GIT_REPO_URL || '',
    token: process.env.GIT_TOKEN || process.env.GITHUB_TOKEN || '',
    branch: process.env.GIT_BRANCH || 'main'
  };
}

function saveGitConfig(config: { repoUrl: string; token: string; branch?: string }) {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(gitConfigPath, JSON.stringify(config, null, 2), 'utf8');
    fs.writeFileSync(gitDataConfigPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Fehler beim Speichern der Git-Konfiguration:', err);
  }
}

// API-Route: Gespeicherte Git Konfiguration abrufen
router.get('/api/git/config', (_req, res) => {
  const config = loadGitConfig();
  return res.json({
    repoUrl: config.repoUrl,
    hasToken: Boolean(config.token && config.token.length > 5),
    tokenPreview: config.token ? `${config.token.slice(0, 4)}••••${config.token.slice(-4)}` : '',
    branch: config.branch || 'main'
  });
});

// API-Route: Git Konfiguration dauerhaft speichern
router.post('/api/git/config', (req, res) => {
  const { repoUrl, token, branch = 'main' } = req.body;
  const current = loadGitConfig();
  const updated = {
    repoUrl: repoUrl !== undefined && repoUrl.trim() ? repoUrl.trim() : current.repoUrl,
    token: token !== undefined ? token.trim() : current.token,
    branch: branch || current.branch || 'main'
  };
  saveGitConfig(updated);
  return res.json({
    success: true,
    message: 'Git-Zugangsdaten dauerhaft auf dem Server gespeichert!',
    config: { repoUrl: updated.repoUrl, hasToken: Boolean(updated.token), branch: updated.branch }
  });
});

// API-Route: GitHub Personal Access Token (PAT) direkt verifizieren
router.post('/api/git/test-token', async (req, res) => {
  try {
    const config = loadGitConfig();
    const token = (req.body.token || config.token || '').trim();

    if (!token) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: 'Kein GitHub Token angegeben. Bitte ein Personal Access Token (classic) eintragen.'
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const apiResp = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'FilamentHub',
        'Accept': 'application/vnd.github.v3+json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (apiResp.ok) {
      const user = await apiResp.json() as any;
      const scopes = apiResp.headers.get('x-oauth-scopes') || '';
      const hasRepoScope = scopes.split(',').map((s: string) => s.trim()).includes('repo');

      return res.json({
        success: true,
        valid: true,
        username: user.login,
        name: user.name || user.login,
        scopes,
        hasRepoScope,
        message: `✅ GitHub Token ist GÜLTIG für Benutzer „${user.login}“! Scopes: [${scopes || 'keine'}].${!hasRepoScope ? ' ⚠️ Achtung: Das Häkchen bei „repo“ fehlt, bitte im Token aktivieren.' : ''}`
      });
    }

    if (apiResp.status === 401) {
      return res.status(401).json({
        success: false,
        valid: false,
        status: 401,
        error: 'GitHub meldet HTTP 401 (Bad credentials): Das Token ist ungültig, gelöscht oder abgelaufen.',
        hint: 'Bitte erstelle ein neues Personal Access Token unter GitHub → Settings → Developer Settings → Personal access tokens (classic) mit Häkchen bei [x] repo.'
      });
    }

    const errText = await apiResp.text();
    return res.status(apiResp.status).json({
      success: false,
      valid: false,
      status: apiResp.status,
      error: `GitHub antwortete mit HTTP ${apiResp.status}: ${errText}`
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      valid: false,
      error: `Netzwerkfehler beim Prüfen des GitHub-Tokens: ${err?.message || String(err)}`
    });
  }
});

// API-Route: Git Status abfragen
router.get('/api/git/status', (_req, res) => {
  try {
    const isGit = fs.existsSync(path.resolve(process.cwd(), '.git'));
    if (!isGit) {
      return res.json({ initialized: false, message: 'Git noch nicht initialisiert.' });
    }
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    const lastCommit = execSync('git log -1 --pretty=format:"%h - %s (%cd)" --date=short', { encoding: 'utf-8' }).trim();
    let remote = '';
    try {
      remote = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    } catch {}
    return res.json({
      initialized: true,
      branch,
      lastCommit,
      remote: remote || null
    });
  } catch (err: any) {
    return res.json({ initialized: false, error: err?.message });
  }
});

// API-Route: Direkt zu GitHub pushen (mit Token oder Remote URL) & HA Automation triggern
router.post('/api/git/push', async (req, res) => {
  let secretToMask = '';
  const mask = (text: string) =>
    secretToMask ? text.split(secretToMask).join('***').split(encodeURIComponent(secretToMask)).join('***') : text;
  try {
    const gitStored = loadGitConfig();
    let { repoUrl, token, branch = 'main', commitMsg = 'FilamentHub v1.53 Update', haUrl, haToken } = req.body;
    
    // Fallback auf gespeicherte Git-Konfiguration
    if (!repoUrl || !repoUrl.trim()) {
      repoUrl = gitStored.repoUrl;
    }
    if (!token || !token.trim()) {
      token = gitStored.token;
    }

    if (!repoUrl || !repoUrl.trim()) {
      return res.status(400).json({ success: false, error: 'Bitte GitHub Repository URL angeben.' });
    }

    // Eingaben prüfen, bevor sie irgendwo verwendet oder gespeichert werden
    if (typeof branch !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._\/-]{0,99}$/.test(branch)) {
      return res.status(400).json({ success: false, error: 'Ungültiger Branch-Name.' });
    }
    const checkedUrl = String(repoUrl).trim().replace(/^https?:\/\/[^@]+@/, 'https://');
    if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(checkedUrl)) {
      return res.status(400).json({ success: false, error: 'Ungültige Repository URL. Erwartet: https://github.com/BESITZER/REPO' });
    }

    // Falls Token im repoUrl eingebettet war (z.B. https://ghp_xxx@github.com/...)
    let cleanToken = (token || '').trim();
    const embeddedMatch = repoUrl.match(/https:\/\/(?:([^:]+):)?([^@]+)@github\.com/);
    if (!cleanToken && embeddedMatch) {
      cleanToken = embeddedMatch[2] || embeddedMatch[1] || '';
    }

    secretToMask = cleanToken;

    // Git-Konfiguration dauerhaft sichern
    if (cleanToken || repoUrl) {
      saveGitConfig({
        repoUrl: repoUrl.trim().replace(/^https:\/\/[^@]+@/, 'https://'),
        token: cleanToken,
        branch
      });
    }

    const gitEnv = {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: 'echo'
    };
    // Kein Shell-Aufruf: Argumente werden einzeln übergeben, damit Eingaben nicht als Befehle laufen
    const git = (args: string[]) =>
      execFileAsync('git', args, { env: gitEnv, timeout: 35000, maxBuffer: 10 * 1024 * 1024 });

    const gitDir = path.resolve(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) {
      await git(['init']);
    }

    const repoPath = checkedUrl.replace('https://github.com/', '').replace(/\.git$/, '');
    const cleanUrl = `https://github.com/${repoPath}.git`;
    // Das Token wird nur für diesen einen Push genutzt und nicht in .git/config gespeichert
    const pushUrl = cleanToken
      ? `https://x-access-token:${encodeURIComponent(cleanToken)}@github.com/${repoPath}.git`
      : cleanUrl;

    await git(['config', 'user.name', 'FilamentHub Builder']);
    await git(['config', 'user.email', process.env.GIT_AUTHOR_EMAIL || 'filamenthub@users.noreply.github.com']);
    await git(['add', '-A']);

    // Stets einen Zeitstempel-Commit erzwingen (--allow-empty), damit GitHub garantiert
    // das Datum "Zuletzt geändert" auf der Repository-Seite aktualisiert!
    const timestampStr = new Date().toLocaleString('de-DE');
    const fullCommitMsg = `${String(commitMsg).slice(0, 200)} [${timestampStr}]`;
    await git(['commit', '--allow-empty', '-m', fullCommitMsg]);

    try {
      await git(['remote', 'remove', 'origin']);
    } catch {}
    await git(['remote', 'add', 'origin', cleanUrl]);
    await git(['branch', '-M', branch]);

    const pushResult = await git(['push', pushUrl, `HEAD:refs/heads/${branch}`, '--force']);
    const pushOutput = mask(`${pushResult.stdout || ''}${pushResult.stderr || ''}`);

    // Falls HA Zugangsdaten mitgegeben wurden, dauerhaft speichern
    if (haUrl || haToken) {
      const currentHa = loadHaConfig();
      saveHaConfig({
        ...currentHa,
        haUrl: haUrl !== undefined && haUrl.trim().length > 0 ? haUrl.trim().replace(/\/+$/, '') : currentHa.haUrl,
        haToken: haToken !== undefined && haToken.trim().length > 0 ? haToken.trim() : currentHa.haToken
      });
    }

    // Nach erfolgreichem Push: Home Assistant Automation automatisch auslösen
    let haTriggerResult: any = null;
    try {
      haTriggerResult = await triggerHaAutomation('automation.filament_website_auto_pull_github', haUrl, haToken);
    } catch (err: any) {
      haTriggerResult = { success: false, error: err?.message || String(err) };
    }

    let haNotice = '';
    if (haTriggerResult?.triggered) {
      haNotice = ` 🚀 Home Assistant Automation „automation.filament_website_auto_pull_github“ wurde erfolgreich ausgelöst!`;
    } else if (haTriggerResult?.error) {
      haNotice = ` (⚠️ HA Automation Hinweis: ${haTriggerResult.error})`;
    }

    return res.json({
      success: true,
      message: `Erfolgreich alle Dateien zu GitHub (${branch}) gepusht & Release aktualisiert!${haNotice}`,
      output: pushOutput,
      haAutomation: haTriggerResult,
      timestamp: timestampStr
    });
  } catch (err: any) {
    const errMsg = mask(err?.message || String(err));
    let hint = 'Falls GitHub Authentifizierung fehlschlägt, erstelle ein Personal Access Token (classic) unter GitHub -> Settings -> Developer settings -> Personal access tokens (classic) mit Häkchen bei "repo".';
    if (errMsg.includes('401') || errMsg.includes('Authentication failed') || errMsg.includes('could not read Password') || errMsg.includes('device or address') || errMsg.includes('Bad credentials')) {
      hint = 'GitHub Authentifizierung abgewiesen (HTTP 401 Bad credentials). Bitte erstelle ein neues Personal Access Token (PAT) unter GitHub -> Settings -> Developer settings -> Personal access tokens (classic) mit Häkchen bei [x] repo.';
    }
    return res.status(500).json({
      success: false,
      error: `Git Push fehlgeschlagen: ${errMsg}`,
      hint
    });
  }
});

export default router;
