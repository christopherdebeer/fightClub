var fight = {

	init: function(){
		fight.ui.init();
		fight.user.type = "human";

		fight.socket.init();
		$('a.panel').CCCCombo({
			onCombo: fight.match.receiveUserMoves,
			combos: fight.ComboLibrary
		});
	},

	socket: {
		init: function (){
			fight.socket.io = io.connect();
			fight.socket.io.on("handshake", fight.socket.handlers.handshake);
			fight.socket.io.on("fight", fight.socket.handlers.startFight);
			fight.socket.io.on("moves", fight.socket.handlers.receiveMoves);
			fight.socket.io.on("opponent-disconnected", fight.socket.handlers.opponentDisconnected);
			fight.socket.io.on("fight-over", fight.socket.handlers.fightOver);
			fight.socket.io.on("get-users", fight.socket.handlers.receiveUsers);
			fight.socket.io.on("challenge", fight.socket.handlers.challenged);
			fight.socket.io.on("decline-challenge", fight.socket.handlers.challengeDeclined);

		},
		id: null,
		io: null,
		identifier: null,
		opponentIdentifier: null,
		inMatch: false,
		handlers: {
			handshake: function(data) {
				fight.socket.id = data.id;
			},
			startFight: function(data) {
				fight.ui.components.app.$joinQueue.removeClass(".inQueue").find(".ui-btn-text").text("Join Fight Queue");
				console.log("received FIGHT!!!");
				fight.socket.identifier = data.identifier;
				fight.socket.opponentIdentifier = data.opponentIdentifier;
				fight.match.startMatch(data.opponent);
				fight.match.id = data.fightId;
			},
			receiveMoves: function(data) {
				console.log("received moves for fight id: ", data.fightId);						
				fight.match.receiveOpponentMoves(data.moves);
			},
			submitMoves: function(data) {
				fight.socket.io.emit("moves", data);
			},
			joinQueue: function(){
				fight.socket.io.emit("join-queue", fight.user);
			},
			leaveQueue: function(){
				fight.socket.io.emit("leave-queue", fight.user);
			},
			opponentDisconnected: function(){
				$('#fightOver .result').text("Your opponent disconnected. You Win, by default.")
				$.mobile.changePage("#fightOver", {transition: 'pop'})
			},
			endFight: function(isWinner){
				fight.socket.io.emit("end-fight", {
					fightId: fight.match.id,
					winner: isWinner ? fight.socket.indentifier : fight.socket.opponentIdentifier
				})
			},
			fightOver: function(data){
				if (data.winner === fight.socket.identifier) {
					$('#fightOver .result').text("You Win!")
				} else {
					$('#fightOver .result').text("You Lose!")
				}
				
				$.mobile.changePage("#fightOver", {transition: 'pop'})
			},
			getUsers: function(){
				console.log("asking for user list");
				fight.socket.io.emit("get-users");
			},
			receiveUsers: function(users) {
				console.log("receiveing users", users);
				fight.users = users;

				// keep profile page updated
				var currentProfilePageUser = fight.ui.components.app.$userProfilePage.find(".username").text();
				$("#menu #online").html("");
				_.each(users, function(user){
					if (user.username !== fight.user.username) $("#menu #online").append("<li><a class='online-"+user.meta.online+"' data-username='"+user.username+"' href='#userProfile'>"+user.username+"</a></li>");
					if (user.username === currentProfilePageUser) fight.ui.updateUserProfile(user.name);
				})
				$("#menu #online").listview('refresh');
			},
			addUser: function(){
				fight.socket.io.emit("add-user", {
					username: fight.user.username,
					avatar: null,
					combos: [],
					stats: {
						hp: fight.user.hp.max,
						ap: fight.user.ap,
						level: 1
					},
					meta: {
						socketId: fight.socket.id,
						inQueue: false,
						inFight: false,
						online: true
					}
				})
			},
			challenge: function(opponent) {
				fight.challenging = opponent;
				fight.socket.io.emit("challenge", {username: opponent, challenger: fight.user.username});
			},
			challenged: function(challenger) {
				fight.challenging = challenger;
				console.log("challenged by: ", challenger);
				$('#challenge .opponent').text(challenger);
				$.mobile.changePage("#challenge", {transition: 'pop', role: 'dialog'});
			},
			acceptChallenge: function(challenger) {
				fight.challenging = null;
				fight.socket.io.emit("accept-challenge", {username: fight.user.username, challenger: challenger});
			},
			declineChallenge: function(challenger) {
				fight.challenging = null;
				fight.socket.io.emit("decline-challenge", {username: fight.user.username, challenger: challenger});
			},
			challengeDeclined: function() {
				if (fight.challenging) {
					$("#challenging .response").text("DECLINED");
				}
			},
			auth: {
				requestSignIn: function(username, pwd) {
					fight.ui.showFeedback("No", "you may not sign in");
				},
				requestSignUp: function(username, pwd) {
					fight.ui.showFeedback("No", "you may not sign up");
				},
				signInApproved: function(user) {
					fight.ui.showFeedback("No", "you may not sign in");
				},
				signUpApproved: function(user) {
					fight.ui.showFeedback("No", "you may not sign up");
				},
				signInDeclined: function(msg) {
					fight.ui.showFeedback("No", "you may not sign in");
				},
				signUpDeclined: function(msg) {
					fight.ui.showFeedback("No", "you may not sign up");
				}
			}


		}
	},

	user: {
		username: "",
		avatar: "",
		hp: {
			current: 200,
			max: 200
		},
		ap: 5,
		dmg: 5,
		combos: [],
		type: "human",
		waitingForMoves: true,
	},
	users: {},
	challenging: null,
	opponent: {
		hp: {
			current: 200,
			max: 200
		},
		type: "human",
		ap: 4,
		dmg: 5,
		currentMoves: [],
		moveHistory: [],
	},

	match: {

		id: null,
		running: false,
		roundNumber: 0,
		roundLength: 7000,
		currentRound: {
			moves: [],
			moveEq: 0
		},
		roundHistory: [],
		waitingForMoves: {
			user: true,
			opponent: true
		},

		submitUserMoves: function() {

			console.log("submittting my moves",fight.match.id);
			if (fight.match.id) {
				fight.socket.handlers.submitMoves({
					fightId: fight.match.id,
					identifier: fight.socket.identifier,
					opponentIdentifier: fight.socket.opponentIdentifier,
					moves: fight.match.currentRound.moves
				})
			}
		},

		receiveUserMoves: function (combo) {

			//console.log("User AP: ", fight.user.ap);
			if (combo.move.length > 0 && fight.match.running) {

				if (combo.match) {
					
					var move = combo.matched[0];
					move.type = "combo";
					//console.log("before combo eq: ", move.moveEq);
					//console.log("before combo roundEq: ", fight.match.currentRound.moveEq);
					if (move.moveEq + fight.match.currentRound.moveEq > fight.user.ap) {
						fight.user.waitingForMoves = false;
						fight.match.submitUserMoves();
						fight.match.endRound();
					} else {

						if (move.comboType === "block") {
							for (x in move.blockMatrix) {
								fight.ui.indicateBlocking(move.blockMatrix[x]);
							}
						}
						fight.match.currentRound.moveEq += move.moveEq;
						fight.ui.updatePlayerStat("user", "ap", fight.user.ap - fight.match.currentRound.moveEq);
						fight.match.currentRound.moves.push(move);
						//console.log("move: ", combo.matched[0].desc);
						fight.ui.displayString(combo.matched[0].desc);

						if (fight.match.currentRound.moveEq >= fight.user.ap) {
							fight.user.waitingForMoves = false;
							fight.match.submitUserMoves();
							fight.match.endRound();
						}
					}							

				} else {
					var moveString = "";
					var roundOver = false;
					for (x in combo.move) {

						//console.log(combo.move);
						var move = combo.move[x];

						//console.log("before basic eq: ", 1);
						//console.log("before basic roundEq: ", fight.match.currentRound.moveEq);
						//console.log("move: ", move.id + "[" + move.dir + "]");

						if (!roundOver && fight.match.running) {
							if (move.dir === "Dtap") {
								move.type = "block"; 
								fight.ui.indicateBlocking(move.id);
							}
							if (move.dir === "tap") move.type = "punch";
							
							if (fight.match.currentRound.movesEq + 1 > fight.user.ap) {
								roundOver = true;
								fight.user.waitingForMoves = false;
								fight.match.submitUserMoves();
								fight.match.endRound(); 
							} else {
								fight.match.currentRound.moveEq += move.type === "block" ? 0.5 : 1;
								fight.ui.updatePlayerStat("user", "ap", fight.user.ap - fight.match.currentRound.moveEq);
								fight.match.currentRound.moves.push(move);
								fight.ui.displayString(move.type);

								if (fight.match.currentRound.moveEq >= fight.user.ap) {
									roundOver = true;
									fight.user.waitingForMoves = false;
									fight.match.submitUserMoves();
									fight.match.endRound();
								}
							}
						}
					}
				}						
			}
		},
		receiveOpponentMoves: function(moves){

			console.log("receiving opp moves");
			//fight.opponent.moveHistory.push(fight.opponent.currentMoves);

			// rebuild combos from common combo library
			var rebuiltMoves = _.map(moves, function(val, key, list){
				if (val.type==="combo") return _.filter(fight.ComboLibrary, function(combo){return combo.id === val.id})[0];
				else return val;
			})
			console.log("REBUILT combos: ", rebuiltMoves)


			fight.opponent.currentMoves = rebuiltMoves;
			fight.opponent.waitingForMoves = false;
			fight.match.endRound();

		},

		gameOver: function(loser){

			fight.match.running = false;

			if (loser === "user") {
				fight.ui.displayString("Game Over!! You Lose.");
				if (fight.opponent.type ==="human") fight.socket.handlers.endFight(false);
				else fight.socket.handlers.fightOver({winner: fight.socket.opponentIdentifier})
			} else {
				fight.ui.displayString("Game Over!! You Win.");
				if (fight.opponent.type ==="human") fight.socket.handlers.endFight(true);
				else fight.socket.handlers.fightOver({winner: fight.socket.identifier})
			}

			window.clearTimeout(fight.match.roundTimer);
			fight.ui.components.user.$timer.remove();
			
		},
		startMatch: function(opponent){

			console.log("match started")
			fight.ui.components.app.$joinQueue.removeClass("inQueue");
			$.mobile.changePage("#fight", { transition: "slideup"})

			fight.opponent = opponent;
			fight.user.hp.current = fight.user.hp.max;


			fight.match.startRound();
		},
		startRound: function(){

			console.log("round started")
			fight.match.running = true;

			// reset round specific vars
			fight.ui.clearBlocking();
			fight.ui.render.user.ap(fight.user.ap);
			fight.user.waitingForMoves = true;
			fight.opponent.waitingForMoves = true;
			fight.match.currentRound.moves = []; 
			fight.match.currentRound.moveEq = 0;

			fight.ui.startRoundTimer();

		},
		endRound: function(){

			console.log("round ended")
			
			if (fight.opponent.type === "bot" && fight.opponent.waitingForMoves) {
				console.log("calling bot method getTurn();");
				fight.match.receiveOpponentMoves(fight.opponent.getTurn());
			}			

			if (!fight.user.waitingForMoves) {
				window.clearTimeout(fight.ui.roundTimer);
				fight.ui.components.user.$timer.html("");
			}

			if (fight.match.running && !fight.user.waitingForMoves && !fight.opponent.waitingForMoves) {
				console.log("Round: ", fight.match.roundNumber)

				fight.match.roundNumber++;
				// console.log(fight.match.currentRound.moves);

				fight.match.compareMoves(fight.match.currentRound.moves, fight.opponent.currentMoves)
				fight.match.roundHistory.push(fight.match.currentRound.moves);

				//fight.ui.displayString("Round Ended!");
				fight.match.startRound();
			} else {
				console.log(fight.match.running, fight.user.waitingForMoves, fight.opponent.waitingForMoves)
				console.log("waiting for opp moves ... or something")
			}
			
			
		},

		extractBlocks: function (moves) {
			var blocks = _.map(moves, function(m){

				// normal move
				if (m.type === "block") {
					//console.log("move was basic block")
					return m;
				}

				// combo move
				if (m.type === "combo") {
					if (m.comboType === "block") {
						//console.log("move was combo block")
						return m;
					}
				}

			})
			//console.log("blocks: ", blocks);
			return _.filter(_.flatten(blocks), function(x) { return typeof x !== 'undefined'}  );
		},

		extractAttacks: function(moves) {
			var attacks = _.map(moves, function(m){

				// normal move
				if (m.type === "punch") {
					//console.log("move was basic attack")
					return m;
				}

				// combo move
				if (m.type === "combo") {
					if (m.comboType === "attack") {
						//console.log("move was combo attack")
						return m;
					}
				}
			})
			//console.log("attacks: ", attacks);
			return _.filter(_.flatten(attacks), function(x) { return typeof x !== 'undefined'}  );
		},

		compareAttacksToBlocks: function (attacks, blocks, callback, player) {

			var blockAreas = _.map(blocks, function(b){ 
				if (b.type === "block") return b.id
				else if (b.type === "combo") return b.blockMatrix;
			});
			
			var blockAreas = _.flatten(blockAreas);
			console.log("areas blocked for ",player,": ", blockAreas);

			_.each(attacks, function(attack){

				if (attack.type === "combo") {
					//console.log("attack is combo");
					_.each(attack.hitMatrix, function(val, key){
						
						console.log("hit area: ",key);
						var hit = _.indexOf(blockAreas, key) === -1;
						var dmg = fight[player].dmg;
						if (typeof val === 'function') dmg = val(dmg);
						callback(key, hit, player, dmg);
						
					})
				} else {

					var hitArea = attack.id.toString();
					console.log("hit area: ",hitArea);
					//console.log("attack isn't combo");
					var hit = _.indexOf(blockAreas, hitArea) === -1;	
					console.log("hit check: ",hitArea," in ",blockAreas, _.indexOf(blockAreas, attack.id))							
					callback(hitArea, hit, player, fight[player].dmg);
				}							
				
			})
		},

		compareMoves: function(user, opponent) {

			var userAttacks = fight.match.extractAttacks(user),
				userBlocks = fight.match.extractBlocks(user),
				oppAttacks = fight.match.extractAttacks(opponent),
				oppBlocks = fight.match.extractBlocks(opponent);

			console.log("user Blocks: ", userBlocks);
			console.log("opp Blocks: ", oppBlocks);
			console.log("user Attacks: ", userAttacks);
			console.log("opp Attacks: ", oppAttacks);

			// compare user attacks to oppp blocks --> show hit block UI
			fight.match.compareAttacksToBlocks(userAttacks, oppBlocks, fight.ui.showHitBlock, "user");

			// comapre opp attcaks to user blocks --> show hit block UI
			fight.match.compareAttacksToBlocks(oppAttacks, userBlocks, fight.ui.showHitBlock, "opponent")

		}
	},

	ui: {

		init: function(){

			// register ui components as jQuery onjects


			fight.ui.components.app.$signInForm = $('#signIn form');
			fight.ui.components.app.$userProfileLinks = $("#online a");
			
			fight.ui.components.app.$menuPage = $("#menu");
			fight.ui.components.app.$userProfilePage = $("#userProfile");

			fight.ui.components.app.$botFightButtons = $("#practice .bot");
			fight.ui.components.app.$joinQueue = $("#menu .joinQueue");

			fight.ui.components.app.$fightPage = $("#fight");
			fight.ui.components.user.$hp = $('#userStats .HP');
			fight.ui.components.user.$ap = $('#userStats .AP');
			fight.ui.components.user.$moveDesc = $('#combo');
			fight.ui.components.user.$timer = $('#timer');

			fight.ui.components.opponent.$hp = $('#oppStats .HP');


			fight.ui.components.app.$botFightButtons.click(function(e){
				e.preventDefault();
				fight.match.startMatch(bot[$(this).attr("id")]);
			});

			// sign in and signup toggle
			$('#signIn #password2').hide();
			console.log("hid pwd2 and attaching click to checkbox")
			$('body').on('click', '#signup', function(e) {
				console.log(this);
				var  $this = $(this)
				var checked = $this.hasClass('ui-checkbox-on');
				var $pwd2 = $this.closest('form').find('#password2');
				console.log(checked);
				console.log("$pwd2.len : " + $pwd2.length);
				if (checked) {
					$pwd2.hide();
				} else {
					$pwd2.show();
				}
			})

			// sign in signup form submit
			fight.ui.components.app.$signInForm.submit(function(e){
				e.preventDefault();

				var username = $(this).find("#username").val();
				var password = $(this).find("#password").val();
				var password2 = $(this).find("#password2").val();
				var signup = $(this).find('#signup').hasClass('ui-checkbox-on');

				//console.log("un: ",username," pw: ",password," pw2: ",password2," su: ", signup);
				
				if (username === "" && password === "") fight.ui.showFeedback("Error", "Please enter a username & password before submitting the form.")
				else if (username === "") fight.ui.showFeedback("Error", "Please enter a username before submitting the form.")
				else if (password === "") fight.ui.showFeedback("Error", "Please enter a password before submitting the form.")
				else if (signup) {
					if (password === password2) fight.socket.handlers.auth.requestSignUp(username, password);
					else fight.ui.showFeedback("Error", "The passwords you entered didnt match. Please try again.")
				} else {
					fight.socket.handlers.auth.requestSignIn(username, password);
				}

				return false;
			})


			// on click on user in list
			$("body").on("click", "#online a", function(e){
				var isOnline = $(this).hasClass("online-true");
				var username = $(this).attr("data-username");
				fight.ui.updateUserProfile(username);
			});

			// on click on challenge
			$('body').on('click', '#userProfile .challenge', function(){
				var user = $("#userProfile").find('.username').text();
				$('#challenging .opponent').text(user);
				console.log("challenging: ", user);
				fight.socket.handlers.challenge(user)
			})

			$('body').on('click', '#challenge .accept', function(e){
				e.preventDefault()
				var challenger = $('#challenge .opponent').text();
				fight.socket.handlers.acceptChallenge(challenger);
			})

			$('body').on('click', '#challenge .decline', function(e){
				var challenger = $('#challenge .opponent').text();
				fight.socket.handlers.declineChallenge(challenger);
			}) 

			fight.ui.components.app.$joinQueue.click(function(e){
				e.preventDefault();
				if ($(this).hasClass('inQueue')) {
					fight.socket.handlers.leaveQueue();
					$(this).removeClass("inQueue").find('.ui-btn-text').text("Join Fight Queue");
				} else {
					fight.socket.handlers.joinQueue();
					$(this).addClass("inQueue").find('.ui-btn-text').text("You are currently in the queue");
				}
			})

		},
		
		roundTimer: null,
		roundTimerPos: 0,

		components: {
			app: {
				$fightPage: null,
				$menuPage: null,
				$botFightButtons: null
			},
			user: {
				$hp: null,
				$ap: null,
				$moveDesc: null,
				$timer: null
			}, 
			opponent: {
				$hp: null
			}
		},

		render: {
			user: {
				hp: function(value) {

					fight.user.hp.current = value;
					var percent = (value / fight.user.hp.max) * 100;
					fight.ui.components.user.$hp.find(".bar").css("width", percent + "%");

					if (value <= 0) fight.match.gameOver("user");
				},
				ap: function(value) {

					var percent = (value / fight.user.ap) * 100;
					fight.ui.components.user.$ap.find(".bar").css("width", percent + "%");
				}
			},
			opponent: {
				hp: function(value) {

					fight.opponent.hp.current = value;
					var percent = (value / fight.opponent.hp.max) * 100;
					fight.ui.components.opponent.$hp.find(".bar").css("width", percent + "%");

					if (value <= 0) fight.match.gameOver("opponent");
				},
			}
		},
		showFeedback: function(title, msg) {
			$('#feedback .title').text(title);
			$('#feedback .msg').text(msg);
			$.mobile.changePage( "#feedback", { transition: "pop", role:"dialog"} );
		},
		updateUserProfile: function(username){

			if (typeof username !== 'undefined') {
				var user = fight.users[username];
			console.log("updateing profile for:", username, user);

			fight.ui.components.app.$userProfilePage.find(".username").text(username);
			fight.ui.components.app.$userProfilePage.find(".hp").text(user.stats.hp);
			fight.ui.components.app.$userProfilePage.find(".ap").text(user.stats.ap);
			fight.ui.components.app.$userProfilePage.find(".level").text(user.stats.level);

			fight.ui.components.app.$userProfilePage.find(".online").text(user.meta.online).addClass(user.meta.online);
			fight.ui.components.app.$userProfilePage.find(".inQueue").text(user.meta.inQueue).addClass(user.meta.inQueue);
			fight.ui.components.app.$userProfilePage.find(".inFight").text(user.meta.inFight).addClass(user.meta.inFight);


		} else {
			console.log("username was undefined");
		}

		},
		updateUserInfo: function(username) {

			fight.user.username = username;
			fight.socket.handlers.addUser();
			console.log("update user info");
			fight.socket.handlers.getUsers();

			$(".username").text(username);
		},
		showHitBlock: function (area, hit, player, dmg) {

			var type = hit ? "hit" : "block";
			if (player === "opponent") type = hit ? "hited" : "blocked";

			var doneTo = player === "opponent" ? "user" : "opponent";


			console.log("area: ",area," hit: ",hit," player: ",player," dmg: ",dmg)

			if (hit) fight.ui.updatePlayerStat(doneTo, "hp", fight[doneTo].hp.current - dmg)
			var selector = '[data-combo-id="'+area+'"]'
			// console.log("adding type class to: ", selector)
			$(selector).addClass(type);
			window.setTimeout(function(){
				$("[data-combo-id]").removeClass(type);
			},1000);

		},

		displayString: function (s) {
			fight.ui.components.user.$moveDesc.text(s);
			fight.ui.components.user.$moveDesc.fadeIn(300);
			window.setTimeout(function(){
				fight.ui.components.user.$moveDesc.fadeOut(500);
			}, 1000);
		},

		updatePlayerStat: function(player, stat, value) {
			
			console.log("update stats = player:", player, " stat:", stat, " value:", value)
			var reqPlayer = fight.ui.render[player];
			if (typeof fight.ui.render[player] !== 'undefined') {

				var reqStat = fight.ui.render[player][stat];
				if (typeof reqStat !== 'undefined' && typeof reqStat === 'function') {

					reqStat(value);

				} else console.log("invalid stat reference to update: ", stat, "for player: ", player);

			} else console.log("invalid player reference to update stats for: ", player);
			
		},
		clearBlocking: function(){
			var selector = '[data-combo-id]';
			$(selector).removeClass("blocking");
		},
		indicateBlocking: function(area){
			var selector = '[data-combo-id="'+area+'"]';
			$(selector).addClass("blocking");
		},

		startRoundTimer: function (){

				//console.log("setting up timer");
				
				var $canvas = $("<canvas />");

				if (window.devicePixelRatio >= 2) $canvas.addClass("retina");

				fight.ui.components.user.$timer.html($canvas);
                $canvas.pacman({
					 data: [
		                { colour: "blue", degrees: 0 },
		                { colour: "transparent", degrees: 360 }
		            ],
		            height: 15,
		            width: 15,
		            retina: window.devicePixelRatio >= 2,
		            duration: fight.match.roundLength			                   			
				})

				//console.log("round: ", fight.match.roundNumber)					
				

				// setup a timeout
				fight.ui.roundTimer = window.setTimeout(function(){
					fight.user.waitingForMoves = false;
					console.log("timer fired endRound()")
					fight.match.submitUserMoves();
					fight.match.endRound();
				}, fight.match.roundLength);		            
		}
	},
	ComboLibrary: [
			{
				id: "rH2",
				desc: "Reverse RoundHouse!!",
				type: "combo",
				comboType: "attack",
				moves: [
					{dir: ["ldru", "ruld"]}
				],
				moveEq: 3,
				hitMatrix: {
					"tL": function(x){return x + 2;},
					"tM": function(x){return x + 2;},
					"tR": function(x){return x + 2;}
				},
				blockMatrix: ["tR"]
			},
			{
				id: "rH",
				desc: "RoundHouse!",
				type: "combo",
				comboType: "attack",
				moves: [
					{dir: ["lurd","rdlu"]}
				],
				moveEq: 3,
				hitMatrix: {
					"tL": function(x){return x + 2;},
					"tM": function(x){return x + 2;},
					"tR": function(x){return x + 2;}
				},
				blockMatrix: ["tL"]
			},
			{
				id: "slr",
				desc: "Simple left right",
				type: "combo",
				comboType: "attack",
				moves: [
					{dir: ["tap"], areas: ["mL"]},
					{dir: ["tap"], areas: ["mR"]}
				],
				moveEq: 2,
				hitMatrix: {
					"mL": function(x){return x/2;},
					"mR": function(x){return 2.25*x;}
				},
				blockMatrix: ["mL","mR"]
			},
			{
				id: "ffx",
				desc: "ForwardForward Punch!",
				type: "combo",
				comboType: "attack",
				moves: [
					{dir: ["r"]},
					{dir: ["r"]},
					{dir: ["tap"], areas: ["mR"]}
				],
				moveEq: 2,
				hitMatrix: {
					"mR": function(x){return x*3;}
				},
				blockMatrix: ["mR"]
			},
			{
				id: "lrl", 
				desc: "Left Right Left!!",
				type: "combo",
				comboType: "attack",
				moves: [
					{dir: ["lrl"]}
				],
				moveEq: 2,
				hitMatrix: {
					"*": function(x){return x*3;}
				},
				blockMatrix: ["*"]
			},
			{
				id: "uc", 
				desc: "Uppercut!",
				type: "combo",
				comboType: "attack",
				moves: [
					{dir: ["u"], areas: ["bM"]}
				],
				moveEq: 1,
				hitMatrix: {
					"mM": function(x){return x;},
					"tM": function(x){return x;}
				},
				blockMatrix: ["mM"]
			},
			{
				id: "uc2", 
				desc: "Double Uppercut!",
				type: "combo",
				comboType: "attack",
				moves: [
					{dir: ["u"], areas: ["bM"]},
					{dir: ["u"], areas: ["bM"]}
				],
				moveEq: 2,
				hitMatrix: {
					"mM": function(x){return x * 1.5;},
					"tM": function(x){return x * 1.5;}
				},
				blockMatrix: ["mM"]
			},
			{
				id: "dc2", 
				desc: "Slam Down!!",
				type: "combo",
				comboType: "attack",
				moves: [
					{dir: ["d"], areas: ["tM"]},
					{dir: ["d"], areas: ["tM"]}
				],
				moveEq: 2,
				hitMatrix: {
					"mM": function(x){return x * 1.5;},
					"bM": function(x){return x * 1.5;}
				},
				blockMatrix: ["tM"]
			},
			{
				id: "ev1", 
				desc: "Duck!",
				type: "combo",
				comboType: "block",
				moves: [
					{dir: ["d"], areas: ["tM"]}
				],
				moveEq: 1.5,
				blockMatrix: ["tL","tM","tR"]
			}
		]
}

$(document).ready(function() {
	
	document.ontouchmove = function(e){
		// if fighting then stop scroll
		var page = window.location.hash;
		if (page === "#fight") {
			e.preventDefault();
			return false;
		}
	}

	// redirect to home
	if (window.location.hash !== '#' && window.location.hash !== '') {
		//console.log("you are going to be redirected,  you were at: ", window.location.hash )
		window.location.href = "/";
	}
	fight.init();
});