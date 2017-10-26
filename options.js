// Saves options to chrome.storage
function save_options() {
	var userToken = document.getElementById('user_token').value;
	var notificationsEnabled = document.getElementById('notifications_enabled').checked;
	var loggingEnabled = document.getElementById('logging_enabled').checked;
	chrome.storage.sync.set({
		userToken: userToken,
		notificationsEnabled: notificationsEnabled,
		loggingEnabled: loggingEnabled
	}, function() {
		// Update status to let user know options were saved.
		var status = document.getElementById('status');
		status.textContent = 'Options saved.';
		setTimeout(function() {
			status.textContent = ' ';
		}, 750);
	});
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
	chrome.storage.sync.get({
		userToken: null,
		notificationsEnabled: true,
		loggingEnabled: false
	}, function(items) {
		document.getElementById('user_token').value = items.userToken;
		document.getElementById('notifications_enabled').checked = items.notificationsEnabled;
		document.getElementById('logging_enabled').checked = items.loggingEnabled;
	});
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);

const DISCORDAPP_HOSTNAME = 'discordapp.com';
const GET_USER_URL = 'https://discordapp.com/api/users/@me';
const discordTabQuery = {
	url: '*://' + DISCORDAPP_HOSTNAME + '/*',
};
let tokensFound = {};
const updateShownTokensFound = () => {
	let elTokensFound = document.getElementById('tokensfound');
	let tokensFoundKeys = Object.keys(tokensFound)
	elTokensFound.innerHTML = tokensFoundKeys.length === 0 ?
		'<li>None</li>'
		: tokensFoundKeys.map((token) => `<li>${tokensFound[token].username}#${tokensFound[token].discriminator}: <a class="token" href="#">${token}</a></li>`).join('');
	for (tokenLink of document.getElementsByClassName('token')) {
		tokenLink.addEventListener('click', (e) => {document.getElementById('user_token').value = tokenLink.innerHTML;});
	}
};
updateShownTokensFound();
const addTokenFound = (token, userInfo) => {
	tokensFound[token] = userInfo;
	console.log('addedTokenFound: %s', JSON.stringify(tokensFound[token], null, 4));
	updateShownTokensFound();
};
const getUserInfo = (token) => {
	let http = new XMLHttpRequest();
	http.open('GET', GET_USER_URL, true);
	http.setRequestHeader('Authorization', token);
	http.setRequestHeader('Content-Type', 'application/json');
	http.onload = () => {
		if (http.status === 200) {
			let userInfo = JSON.parse(http.responseText);
			addTokenFound(token, userInfo)
		}
	};
	var content = JSON.stringify({
		'content': 'get infos'
	});
	http.send(content);
};
const DELAY_FIND_TOKENS = 500;
let findTokensTimer;
const delayFindDiscordToken = () => {
	clearTimeout(findTokensTimer);
	findTokensTimer = setTimeout(findDiscordTokens, DELAY_FIND_TOKENS);
};
const findDiscordTokens = () => {
	chrome.tabs.query(discordTabQuery, (tabs) => {
		console.log('found %d discord tabs.', tabs.length);
		for (tab of tabs) {
			chrome.tabs.executeScript(tab.id, {
				code: 'localStorage.getItem(\'token\');'
			}, (tokens) => {
				for (token of tokens) {
					let tokenValue = JSON.parse(token);
					console.log('check token %s...', tokenValue);
					getUserInfo(tokenValue);
				}
			});
		}
	});
};
chrome.tabs.onCreated.addListener(delayFindDiscordToken);
chrome.tabs.onUpdated.addListener(delayFindDiscordToken);
chrome.tabs.onReplaced.addListener(delayFindDiscordToken);
chrome.tabs.onRemoved.addListener(delayFindDiscordToken);
delayFindDiscordToken();
