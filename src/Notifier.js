import config from './Config';

const EXTENSION_NAME = chrome.i18n.getMessage('appName');
const ICON_URL = 'discord48.png';

class Notifier {
  notify(message, onClickedCallback) {
    if (config.notificationsEnabled) {
      let callbackIsFunction = typeof onClickedCallback === 'function';
      chrome.notifications.create({
        type: 'basic',
        iconUrl: ICON_URL,
        title: EXTENSION_NAME,
        message: message,
        isClickable: callbackIsFunction,
      }, (notificationId) => {
        if (callbackIsFunction) {
          let notificationCallback = (callbackNotificationId) => {
            if (callbackNotificationId === notificationId) {
              onClickedCallback();
            }
          };
          chrome.notifications.onClicked.addListener(notificationCallback);
          chrome.notifications.onClosed.removeListener(notificationCallback);
        }
      });
      if (config.loggingEnabled) {
        console.log(`New notification '${message}'`);
      }
    }
  }
}

export default (new Notifier);
