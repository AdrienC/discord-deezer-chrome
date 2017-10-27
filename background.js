let userToken = null;
let notificationsEnabled = true;
let loggingEnabled = false;
const DISCORD_GATEWAY_ENDPOINT = 'wss://gateway.discord.gg/?v=6&encoding=json';
const DEEZER_HOSTNAME = 'www.deezer.com';
const ICON_URL = 'discord48.png';

const OS = navigator.platform;
const BROWSER = 'Chrome';
const EXTENSION_NAME = 'Deezer Discord Integration';

const DELAY_CHECK_TABS = 2000;
const DELAY_CLOSE_WS = 180000;
const TITLE_SEPARATOR = ' - ';

let ws;
let currentDiscordStatus = null;
let checkTabsTimer;
let heartbeatTimer;
let closeWsTimer;
let lastSeq = null;

const log = (message, force = false) => {
	if (loggingEnabled || force) {
		console.log(message);
	}
};
/* Send notification */
const notify = (message) => {
	if (notificationsEnabled) {
			chrome.notifications.create({
				type: 'basic',
				iconUrl: ICON_URL,
				title: EXTENSION_NAME,
				message: message,
			});
			log(`new notification '${message}'`);
	}
};

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
		if ('loggingEnabled' in changes) {
			loggingEnabled = changes.loggingEnabled.newValue;
			log(`loggingEnabled updated to ${loggingEnabled}`, true);
		}
		if ('userToken' in changes) {
			userToken = changes.userToken.newValue;
			closeWs();
			delayCheckIfStatusUpdateNeeded();
			log(`userToken updated to ${userToken}`);
		}
		if ('notificationsEnabled' in changes) {
			notificationsEnabled = changes.notificationsEnabled.newValue;
			log(`notificationsEnabled updated to ${notificationsEnabled}`);
		}
	});
};
chrome.storage.sync.get({
	userToken: userToken,
	notificationsEnabled: notificationsEnabled,
	loggingEnabled: loggingEnabled
}, function(items) {
	userToken = items.userToken;
	notificationsEnabled = items.notificationsEnabled;
	loggingEnabled = items.loggingEnabled;
	log(`options set to:\n- userToken: ${userToken}\n- notificationsEnabled: ${notificationsEnabled}\n- loggingEnabled: ${loggingEnabled}`);
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
		log(`sent heartbeat: ${JSON.stringify(getOpHeartbeatPayload(), null, 4)}`);
	}
};
/* Process received message */
const messageHandler = (data) => {
	lastSeq = data.s;
	switch (data.op) {
	case 1:
		/* heartbeat request */
		log(`received heartbeat request: ${JSON.stringify(data, null, 4)}`);
		sendHeartbeat();
		break;
	case 10:
		/* hello */
		log(`received hello message: ${JSON.stringify(data, null, 4)}`);
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
		log('extension closed websocket');
	}
};
/* Track and notify status change */
const discordStatusChanged = (newStatus) => {
	currentDiscordStatus = newStatus;
	let statusText = currentDiscordStatus === null ? chrome.i18n.getMessage('statusNone') : currentDiscordStatus;
	notify(chrome.i18n.getMessage('status') + ': ' + statusText);

	/* Close connection if there's no tab playing for DELAY_CLOSE_WS ms */
	clearTimeout(closeWsTimer);
	if (currentDiscordStatus === null) {
		closeWsTimer = setTimeout(closeWs, DELAY_CLOSE_WS);
	}
};
/* Update status */
const setDiscordStatus = (newStatus) => {
	if (userToken === null || userToken.length === 0) {
		notify(chrome.i18n.getMessage('cantSetStatusUserTokenNotSet'));
		return;
	}

	if (ws === undefined || ws.readyState === WebSocket.CLOSED) {
		/* Connect websocket */
		log('initialize websocket...');
		ws = new WebSocket(DISCORD_GATEWAY_ENDPOINT);
		lastSeq = null;
		ws.onopen = (e) => {
			/* Identify and send initial status */
			ws.send(JSON.stringify(getOpIdentifyPayload(newStatus)));
			log(`sent IDENTIFY operation on new connection: ${JSON.stringify(getOpIdentifyPayload(newStatus), null, 4)}`);
			discordStatusChanged(newStatus);
		};
		ws.onmessage = (e) => messageHandler(JSON.parse(e.data));
		ws.onerror = (e) => log(`Connection error: ${JSON.stringify(e, null, 4)}`, true);
		ws.onclose = (e) => {
			log(`Connection closed, code: ${e.code}, reason: ${e.reason}, wasClean: ${e.wasClean}`);
			clearInterval(heartbeatTimer);
		};
	} else if (ws.readyState === WebSocket.OPEN) {
		/* Send status update */
		ws.send(JSON.stringify(getOpStatusUpdatePayload(newStatus)));
		log(`sent STATUS_UPDATE operation: ${JSON.stringify(getOpStatusUpdatePayload(newStatus), null, 4)}`);
		discordStatusChanged(newStatus);
	} else if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.CLOSING) {
		/* Retry later */
		delayCheckIfStatusUpdateNeeded();
	}
};
