var irc = require('irc');
var express = require('express');
var http = require('http');
var socketIo = require('socket.io');

var app = express();
var server = http.Server(app);
var io = socketIo(server);

var state = {
	servers: {
		'pa.dnsdynamic.net': {
			channels: {
				'#testing-stuff': {
					users: [],
					messages: [],
					unreadCount: 0
				}
			}
		}
	},
	nick: 'me'
};

var clients = {};

io.on('connection', function(socket) {
	socket.emit('init', {
		state: state
	});

	socket.on('connect-server', connectServer);
	socket.on('join-channel', joinChannel);
	socket.on('send-message', sendMessage);
});

function joinChannel(info) {
	var client = clients[info.server];

	client.join(info.channel, function() {
		var server = client.opt.server;
		var channelObj = {
			users: [],
			messages: [],
			unreadCount: 0
		};

		state.servers[info.server].channels[info.channel] = channelObj;

		io.emit('data-update', [
			{
				path: 'servers|' + info.server + '|channels|' + info.channel,
				op: 'set',
				val: channelObj
			}
		]);
	});
}

function sendMessage(info) {
	var msgObj = {
		sender: state.nick,
		text: info.message,
		read: true
	};

	var client = clients[info.server];

	state.servers[info.server].channels[info.channel].messages.push(msgObj);
	client.say(info.channel, info.message);
}

function connectServer(host, readyCb) {
	var client = new irc.Client(host, state.nick, {
		userName: state.nick,
		realName: state.nick,
		autoConnect: false
	});

	client.connect(3, function() {
		if (readyCb)
			readyCb(host, client);
	});

	if (!state.servers[host]) {
		state.servers[host] = {
			channels: []
		};

		io.emit('data-update', [
			{
				path: 'servers|' + host,
				op: 'set',
				val: state.servers[host]
			}
		]);
	}

	clients[host] = client;

	client.addListener('message', function(nick, to, text, message) {
		var channel = state.servers[host].channels[to];
		var msgObj = {
			sender: nick,
			text: text,
			read: false
		};

		channel.unreadCount++;
		channel.messages.push(msgObj);

		io.emit('data-update', [
			{
				path: 'servers|' + host + '|channels|' + to + '|unreadCount',
				op: 'set',
				val: channel.unreadCount
			},
			{
				path: 'servers|' + host + '|channels|' + to + '|messages',
				op: 'add',
				val: msgObj
			}
		]);
	});

	client.addListener('names', function(channel, nicks) {
		var channel = state.servers[host].channels[channel];

		channel.users = Object.keys(nicks).map(function(nick) { return nicks[nick] + nick; });

		io.emit('data-update', [
			{
				path: 'servers|' + host + '|channels|' + channel + '|users',
				op: 'set',
				val: channel.users
			}
		]);
	});

	client.addListener('error', function(err) {
		console.log('ERROR:', err);
	});
}

// init given state
var servers = Object.keys(state.servers);
servers.forEach(function(server) {
	connectServer(server, function(server, client) {
		var channels = Object.keys(state.servers[server].channels);
		channels.forEach(function(channel) {
			joinChannel({
				server: server,
				channel: channel
			});
		});
	});
});

app.use(express.static(__dirname + '/public'));

var port = process.env.PORT || 8000;
server.listen(port, function() {
	console.log('HTTP Server started on port', port)
});

