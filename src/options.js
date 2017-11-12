import config from './Config';
import MaterialDesignLite from 'material-design-lite';

function localizeHtmlPage() {
  //Localize by replacing __MSG_***__ meta tags
  let objects = document.getElementsByTagName('html');
	for (let obj of objects) {
    let valStrH = obj.innerHTML.toString();
    let valNewH = valStrH.replace(
			/__MSG_(\w+)__/g,
			(match, v1) => v1 ? chrome.i18n.getMessage(v1) : ''
		);
    if (valNewH != valStrH) {
        obj.innerHTML = valNewH;
    }
  }
}
localizeHtmlPage();

let tokenPolicyRadioGroupSelector = 'input[type="radio"][name="tokens_policy"]';
let lastTokenFoundSpan = document.getElementById('last_token_found');

const GET_USER_URL = 'https://discordapp.com/api/users/@me';
function loadTokenUsername(token) {
	let http = new XMLHttpRequest();
	http.open('GET', GET_USER_URL, true);
	http.setRequestHeader('Authorization', token);
	http.setRequestHeader('Content-Type', 'application/json');
	http.onload = () => {
		if (http.status === 200) {
			let userInfo = JSON.parse(http.responseText);
      let radioLabel = document.querySelector(`.mdl-checkbox input[value="${token}"] + .mdl-checkbox__label`);
      if (radioLabel) {
        radioLabel.innerHTML = `${userInfo.username}#${userInfo.discriminator}`;
      }
      if (lastTokenFoundSpan.innerHTML === `(${token})`) {
        lastTokenFoundSpan.innerHTML = `(${userInfo.username}#${userInfo.discriminator})`;
      }
    }
	};
	var content = JSON.stringify({
		'content': 'get infos'
	});
	http.send(content);
}

function init() {
  let notificationsEnabledCB = document.getElementById('notifications_enabled');
  let loggingEnabledCB = document.getElementById('logging_enabled');
  let tokenPolicyRadioGroup = document.querySelectorAll(tokenPolicyRadioGroupSelector);
  let tokensSelection = document.getElementById('tokens_selection');

  config.onChanged = (changeInfo) => {
    console.log(`changeInfo: ${JSON.stringify(changeInfo, null, 4)}`)
    for (let prop in changeInfo) {
      let newValue = changeInfo[prop].newValue;
      switch (prop) {
      case 'notificationsEnabled':
        notificationsEnabledCB.checked = newValue;
        if (notificationsEnabledCB.parentElement.MaterialCheckbox) {
          if (newValue) {
            notificationsEnabledCB.parentElement.MaterialCheckbox.check();
          } else {
            notificationsEnabledCB.parentElement.MaterialCheckbox.uncheck();
          }
        }
        break;
      case 'loggingEnabled':
        loggingEnabledCB.checked = newValue;
        if (loggingEnabledCB.parentElement.MaterialCheckbox) {
          if (newValue) {
            loggingEnabledCB.parentElement.MaterialCheckbox.check();
          } else {
            loggingEnabledCB.parentElement.MaterialCheckbox.uncheck();
          }
        }
        break;
      case 'lastTokenFound':
        if (newValue) {
          lastTokenFoundSpan.innerHTML = `(${newValue})`;
        } else {
          lastTokenFoundSpan.innerHTML = '';
        }
        loadTokenUsername(newValue);
        break;
      case 'tokensPolicy':
        console.log(`${tokenPolicyRadioGroupSelector}[value="${newValue}"] checked -> true`);
        // let radioToCheck = document.querySelector(`${tokenPolicyRadioGroupSelector}[value="${newValue}"]`);
        let radioToCheck = document.querySelector(`.mdl-radio > ${tokenPolicyRadioGroupSelector}[value="${newValue}"]`);
        if (radioToCheck) {
          radioToCheck.checked = true;
          if (radioToCheck.parentElement.MaterialRadio) {
            radioToCheck.parentElement.MaterialRadio.check();
          }
          // radioToCheck.parentElement.MaterialRadio.check();
        }
        break;
      case 'tokensFound':
        if (newValue.length === 0) {
          tokensSelection.innerHTML = `
            <p class="mdl-checkbox__label">
              None found, <a href="https://discordapp.com/channels/@me" target="_blank">please connect to Discord</a>
            </p>
          `;
        } else {
          tokensSelection.innerHTML = newValue.map((token) => `
            <li>
              <label class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
                <input type="checkbox" class="mdl-checkbox__input" value="${token}">
                <span class="mdl-checkbox__label">${token}</span>
                <button class="mdl-button mdl-js-button mdl-button--icon">
                  <i class="material-icons">delete</i>
                </button>
              </label>
            </li>
          `).join('');
          if (componentHandler) {
            componentHandler.upgradeDom();
          }
          newValue.forEach((token) => {
            loadTokenUsername(token);
            let checkbox = document.querySelector(`.mdl-checkbox input[value="${token}"]`);
            checkbox.checked = config.tokensSelection.includes(checkbox.value);
            if (checkbox.parentElement.MaterialCheckbox) {
              if (checkbox.checked) {
                checkbox.parentElement.MaterialCheckbox.check();
              } else {
                checkbox.parentElement.MaterialCheckbox.uncheck();
              }
            }
            checkbox.onchange = (e) => {
              if (checkbox.checked) {
                if (!config.tokensSelection.includes(token)) {
                  let newTokensSelection = config.tokensSelection.slice();
                  newTokensSelection.push(token);
                  config.tokensSelection = newTokensSelection;
                }
              } else if (config.tokensSelection.includes(token)) {
                config.tokensSelection = config.tokensSelection.filter((t) => t !== token);
              }
            };
            let removeButton = document.querySelector(`.mdl-checkbox input[value="${token}"] ~ button`);
            removeButton.onclick = (e) => {
              if (config.lastTokenFound === token) {
                config.lastTokenFound = null;
              }
              config.tokensFound = config.tokensFound.filter((t) => t !== token);
              config.tokensSelection = config.tokensSelection.filter((t) => t !== token);
            };
          });

        }
        break;
      case 'tokensSelection':
        let checkboxes = document.querySelectorAll(`#tokens_selection .mdl-checkbox input[type="checkbox"]`);
        checkboxes.forEach((checkbox) => {
          checkbox.checked = newValue.includes(checkbox.value);
          if (checkbox.parentElement.MaterialCheckbox) {
            if (checkbox.checked) {
              checkbox.parentElement.MaterialCheckbox.check();
            } else {
              checkbox.parentElement.MaterialCheckbox.uncheck();
            }
          }
        });
        break;
      default:
      }
    }
  }

  config.load().then(() => {
    console.log('config loaded');
    // let notificationsEnabledCB = document.getElementById('notifications_enabled');
    // notificationsEnabledCB.checked = config.notificationsEnabled
    notificationsEnabledCB.onchange = (e) => {
      console.log('notificationsEnabledCB.onchange');
      config.notificationsEnabled = notificationsEnabledCB.checked;
    };

    // let loggingEnabledCB = document.getElementById('logging_enabled');
    // loggingEnabledCB.checked = config.loggingEnabled;
    loggingEnabledCB.onchange = (e) => {
      console.log('loggingEnabledCB.onchange');
      config.loggingEnabled = loggingEnabledCB.checked;
    };

    for(let tokenPolicyRadio of tokenPolicyRadioGroup) {
      tokenPolicyRadio.onchange = (e) => {
        let newValue = document.querySelector(`${tokenPolicyRadioGroupSelector}:checked`).value;
        console.log('tokens policy set to ' + newValue);
        config.tokensPolicy = newValue;
        tokensSelection.disabled = newValue !== 'selection';
      }
    }
  });
}
document.addEventListener('DOMContentLoaded', init);
