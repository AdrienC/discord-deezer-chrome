let userToken = null;
let notificationsEnabled = true;
const DISCORD_GATEWAY_ENDPOINT = 'wss://gateway.discord.gg/?v=6&encoding=json';
const DEEZER_HOSTNAME = 'www.deezer.com';
const ICON_URL = 'discord48.png';

const OS = navigator.platform;
const BROWSER = 'Chrome';
const EXTENSION_NAME = 'Deezer Discord Integration';

const DELAY_CHECK_TABS = 1000;
const DELAY_CLOSE_WS = 180000;
const TITLE_SEPARATOR = ' - ';

let ws;
let currentDiscordStatus = null;
let checkTabsTimer;
let heartbeatTimer;
let closeWsTimer;
let lastSeq = null;

/* Send notification */
const notify = (message) => chrome.notifications.create({
	type: 'basic',
	iconUrl: ICON_URL,
	title: EXTENSION_NAME,
	message: message,
});	

const formatTabTitle = (title) => {
	const splitTitle = title.split(TITLE_SEPARATOR);
	if (splitTitle.length === 3) {
		return splitTitle[1] + TITLE_SEPARATOR + splitTitle[0] + TITLE_SEPARATOR + splitTitle[2];
	} else {
		return title;
	}
};
const getStatusFromTabs = (tabs) => {
	if (tabs.length === 0) {
		return null;
	} else {
		return formatTabTitle(tabs[0].title);
	}
};
const audibleDeezerTabQuery = {
	audible: true,
	url: '*://' + DEEZER_HOSTNAME + '/*',
};
const delayCheckIfStatusUpdateNeeded = () => {
	clearTimeout(checkTabsTimer);
	checkTabsTimer = setTimeout(checkIfStatusUpdateNeeded, DELAY_CHECK_TABS);
};
const checkIfStatusUpdateNeeded = () => {
	chrome.tabs.query(audibleDeezerTabQuery, (tabs) => {
		let newStatus = getStatusFromTabs(tabs);
		if (newStatus !== currentDiscordStatus) {
			setDiscordStatus(newStatus);
		}
	});
};
const start = () => {
	/* Check for deezer playing tab on tabs changes */
	chrome.tabs.onCreated.addListener(delayCheckIfStatusUpdateNeeded);
	chrome.tabs.onUpdated.addListener(delayCheckIfStatusUpdateNeeded);
	chrome.tabs.onReplaced.addListener(delayCheckIfStatusUpdateNeeded);
	chrome.tabs.onRemoved.addListener(delayCheckIfStatusUpdateNeeded);
	/* Check for deezer playing tab on startup */
	delayCheckIfStatusUpdateNeeded();
	/* Track options changes */
	chrome.storage.onChanged.addListener((changes, areaName) => {
		if ('userToken' in changes) {
			userToken = changes.userToken;
			closeWs();
			delayCheckIfStatusUpdateNeeded();
		}
		if ('notificationsEnabled' in changes) {
			notificationsEnabled = changes.notificationsEnabled;
		}
	});
};
chrome.storage.sync.get({
	userToken: userToken,
	notificationsEnabled: notificationsEnabled
}, function(items) {
	userToken = items.userToken;
	notificationsEnabled = items.notificationsEnabled;
	start();
});

/* Get heartbeat operation payload */
const getOpHeartbeatPayload = () => ({
	op: 1,
	d: lastSeq,
});
/* Get status update partial payload */
const getStatusUpdatePayload = (status) => ({
	game: status === null ? null : {
		name: status,
		type: 1,
	},
	status: 'online',
	since: null,
	afk: false,
});
/* Get identify operation payload */
const getOpIdentifyPayload = (status) => ({
	op: 2,
	d: {
		token: userToken,
		properties: {
			$os: OS,
			$browser: BROWSER,
			$device: EXTENSION_NAME,
		},
		compress: false,
		large_threshold: 50,
		presence: getStatusUpdatePayload(status),
	}
});
/* Get status update operation payload */
const getOpStatusUpdatePayload = (status) => ({
	op: 3,
	d: getStatusUpdatePayload(status),
});
/* Send heartbeat */
const sendHeartbeat = () => {
	if (ws !== undefined && ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(getOpHeartbeatPayload()));
	}
};
/* Process received message */
const messageHandler = (data) => {
	lastSeq = data.s;
	switch (data.op) {
	case 1:
		/* heartbeat request */
		sendHeartbeat();
		break;
	case 10:
		/* hello */
		clearInterval(heartbeatTimer);
		heartbeatTimer = setInterval(sendHeartbeat, data.d.heartbeat_interval)
		break;
	default:
	}
};
/* Close connection */
const closeWs = () => {
	if (ws !== undefined && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
		ws.close();
	}
};
/* Track and notify status change */
const discordStatusChanged = (newStatus) => {
	currentDiscordStatus = newStatus;
	notify('Status: ' + (currentDiscordStatus === null ? 'None' : currentDiscordStatus));

	/* Close connection if there's no tab playing for DELAY_CLOSE_WS ms */
	clearTimeout(closeWsTimer);
	if (currentDiscordStatus === null) {
		closeWsTimer = setTimeout(closeWs, DELAY_CLOSE_WS);
	}
};
/* Update status */
const setDiscordStatus = (newStatus) => {
	if (userToken === null || userToken.length === 0) {
		notify('Can\'t set status, user token is not set.');
		return;
	}

	if (ws === undefined || ws.readyState === WebSocket.CLOSED) {
		/* Connect websocket */
		ws = new WebSocket(DISCORD_GATEWAY_ENDPOINT);
		lastSeq = null;
		ws.onopen = (e) => {
			/* Identify and send initial status */
			ws.send(JSON.stringify(getOpIdentifyPayload(newStatus)));
			discordStatusChanged(newStatus);
		};
		ws.onmessage = (e) => messageHandler(JSON.parse(e.data));
		ws.onerror = (e) => console.log('Connection error: %s', JSON.stringify(e, null, 4));
		ws.onclose = (e) => clearInterval(heartbeatTimer);
	} else if (ws.readyState === WebSocket.OPEN) {
		/* Send status update */
		ws.send(JSON.stringify(getOpStatusUpdatePayload(newStatus)));
		discordStatusChanged(newStatus);
	} else if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.CLOSING) {
		/* Retry later */
		delayCheckIfStatusUpdateNeeded();
	}
};
