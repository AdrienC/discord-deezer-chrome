import config from './Config';

export default class AudibleTabTitleTracker {
  constructor(hostname, debounceDelay = 0) {
    this._hostname = hostname;
    this._tabsQuery = { url: `*://${hostname}/*` };
    this._debounceDelay = debounceDelay;
    this._tabs = {};
    // this._currentAudibleTab; /* null to fire currentAudibleTabChanged on startup */
    this._started = false;
    this._listeners = {
      onCreated: this._onTabCreated.bind(this),
      onUpdated: this._onTabUpdated.bind(this),
      onReplaced: this._onTabReplaced.bind(this),
      onRemoved: this._onTabRemoved.bind(this),
    }
  }
  start() {
    if (!this._started) {
      this._initTabs();
      for (let eventMethod in this._listeners) {
        chrome.tabs[eventMethod].addListener(this._listeners[eventMethod]);
      }
      this._started = true;
    }
  }
  stop() {
    if (this._started) {
      clearTimeout(this._debounceTimer);
      for (let eventMethod in this._listeners) {
        chrome.tabs[eventMethod].removeListener(this._listeners[eventMethod]);
      }
      this._started = false;
      if (config.loggingEnabled) {
        console.log(`AudibleTabTitleTracker stopped`);
      }
    }
  }
  get isStarted() {
    return this._started;
  }
  get currentAudibleTab() {
    return this._currentAudibleTab;
  }
  set onCurrentAudibleTabChange(callback) {
    this._onCurrentAudibleTabChange = callback;
  }
  _initTabs() {
    this._tabs = {};
    chrome.tabs.query(this._tabsQuery, this._initTabsFound.bind(this));
  }
  _initTabsFound(tabs) {
    for (let tab of tabs) {
      this._setTrackedTab(tab);
    }
    this._checkForCurrentAudibleTabChange();
    if (config.loggingEnabled) {
      console.log(`AudibleTabTitleTracker started:\n - host: ${this._hostname}\n - debounce delay: ${this._debounceDelay}\n - ${Object.keys(this._tabs).length} tabs: ${JSON.stringify(this._tabs, null, 4)}`);
    }
  }
  _hostnameMatches(url) {
    try {
      return new URL(url).hostname === this._hostname;
    } catch (e) {
      return false;
    }
  }
  _setTrackedTab(tab) {
    this._tabs[tab.id] = {
      id: tab.id,
      title: tab.title,
      audible: tab.audible
    };
  }
  _onTabCreated(tab) {
    if (this._hostnameMatches(tab.url)) {
      this._setTrackedTab(tab);
      if (tab.audible) {
        this._checkForCurrentAudibleTabChange();
      }
    }
  }
  _onTabUpdated(tabId, changeInfo, tab) {
    if (tabId in this._tabs) {
      let aTabChanged = false;
      if ('url' in changeInfo && !this._hostnameMatches(tab.url)) {
        delete this._tabs[tabId];
        aTabChanged = true;
      } else {
        if ('title' in changeInfo) {
          this._tabs[tabId].title = changeInfo.title;
          aTabChanged = true;
        }
        if ('audible' in changeInfo) {
          this._tabs[tabId].audible = changeInfo.audible;
          aTabChanged = true;
        }
      }
      if (aTabChanged) {
        this._checkForCurrentAudibleTabChange();
      }
    } else {
      this._onTabCreated(tab);
    }
  }
  _onTabReplaced(addedTabId, removedTabId) {
    if (removedTabId in this._tabs) {
      this._tabs[addedTabId] = this._tabs[removedTabId];
      this._tabs[addedTabId].id = addedTabId;
      delete this._tabs[removedTabId];
      this._checkForCurrentAudibleTabChange();
    }
  }
  _onTabRemoved(tabId, removeInfo) {
    if (tabId in this._tabs) {
      delete this._tabs[tabId];
      this._checkForCurrentAudibleTabChange();
    }
  }
  _findCurrentAudibleTab() {
    return Object.values(this._tabs)
      .find((tab) => tab.audible);
    // for (let tab of Object.values(this._tabs)) {
    //   if (tab.audible) {
    //     return tab;
    //   }
    // }
    // for (let tabId in this._tabs) {
    //   if (this._tabs[tabId].audible) {
    //     return this._tabs[tabId];
    //   }
    // }
    // return null;
  }
  _checkForCurrentAudibleTabChange() {
    const newCurrentAudibleTab = this._findCurrentAudibleTab();
    if (newCurrentAudibleTab !== this._currentAudibleTab) {
      // let titleChanged = !newCurrentAudibleTab || !this._currentAudibleTab || newCurrentAudibleTab.title !== this._currentAudibleTab.title;
      this._currentAudibleTab = newCurrentAudibleTab ? {...newCurrentAudibleTab} : undefined;
      // if (titleChanged) {
        if (this._debounceDelay > 0) {
          clearTimeout(this._debounceTimer);
          this._debounceTimer = setTimeout(this._currentAudibleTabChanged.bind(this), this._debounceDelay);
        } else {
          this._currentAudibleTabChanged();
        }
      // }
    }
  }
  _currentAudibleTabChanged() {
    if (typeof this._onCurrentAudibleTabChange === 'function') {
      this._onCurrentAudibleTabChange(this._currentAudibleTab);
    }
  }
}
