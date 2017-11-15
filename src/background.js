import config from './Config';
import notifier from './Notifier';
import AudibleTabTitleTracker from './AudibleTabTitleTracker';
import DiscordGateway from './DiscordGateway';
import TokensTracker from './TokensTracker';

const DEEZER_HOSTNAME = 'www.deezer.com';
const DEEZER_TAB_TITLE_DEBOUNCE_DELAY = 3000;
const TITLE_SEPARATOR = ' - ';

let tokensDiscordGateways = {};

const cleanTitleRegexp = new RegExp(TITLE_SEPARATOR + 'Deezer(?=' + TITLE_SEPARATOR + ')', 'g');
function formatTabTitle(title) {
  const splitTitle = title.split(TITLE_SEPARATOR);
  if (splitTitle.length === 3) {
    return splitTitle[1] + TITLE_SEPARATOR + splitTitle[0] + TITLE_SEPARATOR + splitTitle[2];
  } else {
    return title.replace(cleanTitleRegexp, '');
  }
}

/* Track Deezer playing tab title changes */
const audibleTabTitleTracker = new AudibleTabTitleTracker(DEEZER_HOSTNAME, DEEZER_TAB_TITLE_DEBOUNCE_DELAY);
audibleTabTitleTracker.onCurrentAudibleTabChange = (tabInfos) => {
  let discordGateways = Object.values(tokensDiscordGateways);
  if (discordGateways.length > 0) {
    let newStatus = tabInfos ? formatTabTitle(tabInfos.title) : null;
    for (let dg of discordGateways) {
      dg.sendStatusUpdate(newStatus);
    }
    if (config.notificationsEnabled) {
      notifier.notify(
        `${chrome.i18n.getMessage('status')}: ${newStatus ? newStatus : chrome.i18n.getMessage('statusNone')}`,
        tabInfos ? () => {
          chrome.tabs.update(tabInfos.id, { active: true });
          if (config.loggingEnabled) {
            console.log(`Status notification '${newStatus}' clicked, tab switched to ${tabInfos.id}.`);
          }
        } : null
      );
    }
  } else {
    if (config.loggingEnabled) {
      console.log(`Status changed but no Discord token set.`);
    }
  }
};

const tokensTracker = new TokensTracker();
tokensTracker.onFound = (foundToken) => {
  if (config.lastTokenFound !== foundToken) {
    config.lastTokenFound = foundToken;
  }
  if (!config.tokensFound.includes(foundToken)) {
    let newTokensFound = config.tokensFound.slice();
    newTokensFound.push(foundToken);
    config.tokensFound = newTokensFound;
  }
};

function checkGatewaysForTokens(tokens) {
  for (let token in tokensDiscordGateways) {
    if (!tokens.includes(token)) {
      tokensDiscordGateways[token].sendStatusUpdate(null);
      tokensDiscordGateways[token].close();
      delete tokensDiscordGateways[token];
      if (config.loggingEnabled) {
        console.log(`Removed gateway for token ${token}`);
      }
    }
  }
  tokens.forEach((token) => {
    if (!tokensDiscordGateways[token]) {
      let newDiscordGateway = new DiscordGateway(token);
      tokensDiscordGateways[token] = newDiscordGateway;
      let currentAudibleTab = audibleTabTitleTracker.currentAudibleTab;
      let currentStatus = currentAudibleTab ? formatTabTitle(currentAudibleTab.title) : null;
      newDiscordGateway.sendStatusUpdate(currentStatus);
      if (config.loggingEnabled) {
        console.log(`Added gateway for token ${token}`);
      }
    }
  });
}

config.onChanged = (changeInfo) => {
  console.log(`changeInfo: ${JSON.stringify(changeInfo, null, 4)}`);
  switch (config.tokensPolicy) {
  case 'last':
    checkGatewaysForTokens(config.lastTokenFound ? [config.lastTokenFound] : []);
    break;
  case 'all':
    checkGatewaysForTokens(config.tokensFound);
    break;
  case 'selection':
    checkGatewaysForTokens(config.tokensSelection);
    break;
  default:
  }
}

config.load().then(() => {
  tokensTracker.start();
  /* Start tracking Deezer audible tab title */
  audibleTabTitleTracker.start();
});
