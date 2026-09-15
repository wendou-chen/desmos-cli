const { DesmosEngine } = require('./engine');
const { createCli } = require('./cli');
const { formatObsidianMarkdown, processVaultOutput } = require('./obsidian');
const { normalizeLatex, parseBounds, generateOutputFilename, openInViewer } = require('./utils');
const { launchBrowser, findBrowserExecutable } = require('./browser');
const { openInteractiveWorkspace, openOnlineDesmos } = require('./web-launcher');
const { startLiveSession, sendToLive, clearLive, isPortOpen } = require('./daemon');

module.exports = {
  DesmosEngine,
  createCli,
  formatObsidianMarkdown,
  processVaultOutput,
  normalizeLatex,
  parseBounds,
  generateOutputFilename,
  openInViewer,
  launchBrowser,
  findBrowserExecutable,
  openInteractiveWorkspace,
  openOnlineDesmos,
  startLiveSession,
  sendToLive,
  clearLive,
  isPortOpen
};
