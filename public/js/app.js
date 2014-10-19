
var socket = io.connect(location.host);

var colors = ['#0099cc', '#9933cc', '#669900', '#ff8800', '#cc0000'];
var colorsIndex = 0;

angular.module('irc', [])
	.controller('PostsController', function($scope, $timeout) {

		$scope.colors = {};

		$scope.selectChannel = function(server, channel) {
			$scope.currentChannel = channel;
			$scope.currentServer = server;

			$timeout(function() {
				$messages = $('#messages');
				$messages.scrollTop($messages[0].scrollHeight);

				$('#input').focus();
			});
		};

		$scope.getColorForSender = function(sender) {
			if (!$scope.colors[sender])
				$scope.colors[sender] = colors[colorsIndex++ % colors.length];

			return $scope.colors[sender];
		};

		$scope.connectServer = function(server) {
			socket.emit('connect-server', server);
		};

		$scope.joinChannel = function(server, channel) {
			socket.emit('join-channel', {
				server: server,
				channel: channel
			});
		};

		$scope.sendMessage = function() {
			var channels = $scope.state.servers[$scope.currentServer].channels;

			for (var channel in channels) {
				if (channels[channel] == $scope.currentChannel)
				   break;
			}

			$scope.currentChannel.messages.push({
				sender: $scope.state.nick,
				text: $scope.newMessage,
				read: true
			});

			socket.emit('send-message', {
				server: $scope.currentServer,
				channel: channel,
				message: $scope.newMessage
			});

			$scope.newMessage = '';

			$('#input').focus();
		};

		$scope.resize = function() {
			$messages = $('#messages');
			$messages.height($(document.body).height() - $('#input').outerHeight(true) - $messages.offset().top);
		};

		$scope.resize();
		window.onresize = $scope.resize;

		$scope.$watch('currentChannel.messages', function() {
			$scope.$evalAsync(function() {
				$messages = $('#messages');
				var currentY = $messages.scrollTop() + $messages.height();
				var height = $messages[0].scrollHeight;

				if (height - currentY < 100)
					$messages.scrollTop(height + 9999);
			});
		}, true);

		socket.on('init', function(initdata) {
			$scope.$apply(function() {
				$scope.state = initdata.state;
				return;

				var servers = Object.keys($scope.state.servers);
				if (servers.length) {
					var channels = $scope.state.servers[servers[0]].channels;
					var keys = Object.keys(channels);
					if (keys.length)
						$scope.selectChannel(servers[0], channels[keys[0]]);
				}
			});
		});

		socket.on('data-update', function(updates) {
			$scope.$apply(function() {
				updates.forEach(function(update) {
					var path = update.path.split('|');
					var currentElement = $scope.state;
					var key = path[path.length - 1];

					for (var i = 0; i < path.length - 1; i++) {
						currentElement = currentElement[path[i]];
					}

					switch (update.op) {
						case 'set':
							currentElement[key] = update.val;
							break;
						case 'unset':
							delete currentElement[key];
							break;
						case 'add':
							currentElement[key].push(update.val);
							break;
						case 'remove':
							currentElement[key].splice(currentElement[key].indexOf(update.val), 1);
							break;
					}
				});
			});
		});
	})
	.directive('ngEnter', function () {
		return function (scope, element, attrs) {
			element.bind("keydown keypress", function (e) {
				if (e.which === 13) {
					scope.$apply(function (){
						scope.$eval(attrs.ngEnter);
					});

					e.preventDefault();
				}
			});
		};
	});

