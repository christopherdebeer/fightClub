
/**
 * Module dependencies.
 */

var express = require('express')
	  routes = require('./routes'),
    socketIO = require('socket.io'),
    _ = require('underscore');


var app = module.exports = express.createServer(),
  io = socketIO.listen(app);

io.set('log level', 1);

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views')
  app.set('view engine', 'jade')
  app.use(express.bodyParser())
  app.use(express.methodOverride())
  app.use(app.router);
  app.use(express.static(__dirname + '/public'))
})

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }))
})

app.configure('production', function(){ 
  app.use(express.errorHandler())
})


// fightClub

var fightClub = {
  users: {},
  userSockets: {},
	queue: [],
	matches: {},
  methods: {
    setupSockets: function(socket){

      fightClub.userSockets[socket.id] = {};
      socket.emit('handshake', {id: socket.id});      
      socket.on('join-queue', fightClub.methods.joinQueue.bind(socket));
      socket.on('leave-queue', fightClub.methods.leaveQueue.bind(socket));
      socket.on('disconnect', fightClub.methods.userDisconnect.bind(socket));
      socket.on('moves', fightClub.methods.receiveMoves.bind(socket));
      socket.on('end-fight', fightClub.methods.endFight.bind(socket));
      socket.on('get-users', fightClub.methods.getUsers.bind(socket));
      socket.on('add-user', fightClub.methods.addUser.bind(socket));
      socket.on('challenge', fightClub.methods.challenge.bind(socket));
      socket.on('accept-challenge', fightClub.methods.acceptChallenge.bind(socket));
      socket.on('decline-challenge', fightClub.methods.declineChallenge.bind(socket));
    },
    addUser: function(data){
      console.log("adding user: ", data.username);
      var user = {
        username: data.username,
        avatar: data.avatar,
        combos: data.combos,
        stats: {
          hp: data.stats.hp,
          ap: data.stats.ap,
          level: data.stats.level,
        },
        meta: {
          socketId: data.meta.socketId,
          inQueue: data.meta.inQueue,
          inFight: data.meta.inFight,
          online: data.meta.online
        }
      }

      fightClub.users[data.username] = user;

      var socketId = this.id;
      var userSocket = fightClub.userSockets[socketId] = {
        data: data,
        socket: this,
        id: socketId,
        turnTaken: false
      }

      io.sockets.emit('get-users', fightClub.users);

    },
    getUsers: function(){
      this.emit('get-users', fightClub.users);
    },
    joinQueue: function(data){

        fightClub.users[data.username].meta.inQueue = true;

        var socketId = this.id;
        var userSocket = fightClub.userSockets[socketId] = {
          data: data,
          socket: this,
          id: socketId,
          turnTaken: false
        }

        if (fightClub.queue.length > 0) {
          fightClub.methods.startFight(fightClub.queue.pop(), userSocket);
        } else {
          fightClub.queue.push(userSocket)
          io.sockets.emit('get-users', fightClub.users);
        }
    },
    leaveQueue: function(id) {
      var socketId = id || this.id;
      var indexInQueue = _.indexOf(fightClub.queue, _.filter(fightClub.queue, function(item){ return item.id === socketId;}));
      delete fightClub.queue[indexInQueue];

    },
    userDisconnect: function(data) {
      var socketId = this.id;
      console.log("user disconnected, ", socketId);
      fightClub.methods.droppedUser(socketId);

      var username = fightClub.methods.getUsernameBySocketId(socketId);
      if (username) {
        fightClub.users[username].meta.online = false;
      }
      io.sockets.emit('get-users', fightClub.users);
    },
    getUsernameBySocketId: function(socketId){
      //console.log("getting username for socket: ", socketId)
      var user = _.filter(fightClub.users, function(user){
        if (user.meta.socketId === socketId) {
          return true;
        } else {
          return false;
        }
      });
      //console.log(user);
      if (typeof user[0] !== 'undefined') {
        var username = user[0].username;
        //console.log("found username: ", username);
        return username;
      } else {
        return false;
      }
    },
    getUsersocketByUsername: function(username){
      if (typeof fightClub.users[username] !== 'undefined') {
        var user = fightClub.users[username];
        var socket = fightClub.userSockets[user.meta.socketId];
        if (typeof socket !== 'undefined') return socket;
      }
      return false;
    },
    challenge: function(data) {
      console.log("user: ", data.challenger, " challenged ", data.username);
      var user = fightClub.users[data.username];
      if (typeof user !== 'undefined') {
        var userSocket = fightClub.methods.getUsersocketByUsername(data.username);
        if (userSocket) {
          userSocket.socket.emit("challenge", data.challenger);
        } else {
          console.log("user socket was false: ", userSocket)
        }
      }
    },
    acceptChallenge: function(data){
      console.log("user: ", data.username, " accepted ", data.challenger, "'s challenge");
      var A = fightClub.methods.getUsersocketByUsername(data.username);
      var B = fightClub.methods.getUsersocketByUsername(data.challenger);
      fightClub.methods.startFight(A, B);
    },
    declineChallenge: function(data){
      console.log("user: ", data.username, " declined ", data.challenger, "'s challenge");
      var userSocket = fightClub.methods.getUsersocketByUsername(data.challenger);
      userSocket.socket.emit("decline-challenge");
    },
    startFight: function(A, B) {

        console.log("Starting fight between: A: '", A.data.username, "' and B: '", B.data.username,"'");
        var fightId = A.id + "-" + B.id;
        fightClub.userSockets[A.id].inFight = fightId;
        fightClub.userSockets[B.id].inFight = fightId;
        
        A.socket.emit('fight', {
          opponent: A.data,
          fightId: fightId,
          identifier: "A",
          opponentIdentifier: "B",
        });

        B.socket.emit('fight', {
          opponent: B.data,
          fightId: fightId,
          identifier: "B",
          opponentIdentifier: "A",
        });

        fightClub.matches[fightId] = {
          A: A,
          B: B
        };
    },
    endFight: function(data){

      if (typeof fightClub.matches[data.fightId] !== 'undefined') {
        console.log("fight [",data.fightId,"] over.")
        var fight = fightClub.matches[data.fightId];
        fight.A.socket.emit("fight-over", data);
        fight.B.socket.emit("fight-over", data);
        delete fightClub.matches[data.fightId];
      }
    },
    receiveMoves: function(data) {
     if (typeof fightClub.matches[data.fightId] !== 'undefined') {
        fightClub.matches[data.fightId][data.identifier].turnTaken = true;
        fightClub.matches[data.fightId][data.identifier].moves = data.moves;
        var fight = fightClub.matches[data.fightId];
        if (fight.A.turnTaken && fight.B.turnTaken) fightClub.methods.endRound(data.fightId);
     }
    },
    endRound: function(fightId) {
      var fight = fightClub.matches[fightId];
      fight.A.socket.emit('moves', {fightId: fightId, moves: fight.B.moves});
      fight.A.turnTaken = false;
      fight.B.socket.emit('moves', {fightId: fightId, moves: fight.A.moves});
      fight.B.turnTaken = false;
    },
    droppedUser: function(socketId) {
      //fightClub.users[data.username].meta.online = false;
      if (fightClub.methods.isInFight(socketId)) {
        
        // end fight
        var fightId = fightClub.userSockets[socketId].inFight;
        var opponentId = fightClub.matches[fightId].A.id === socketId ? fightClub.matches[fightId].B.id : fightClub.matches[fightId].A.id;

        // tell opponent user was dropped
        console.log("emitting dropped user to opponent:", opponentId);
        if (typeof fightClub.userSockets[opponentId] !== 'undefined') fightClub.userSockets[opponentId].socket.emit("opponent-disconnected");
      }
      if (fightClub.methods.isInQueue(socketId)) {
        
        // remove from queue
        fightClub.methods.leaveQueue(socketId) 
      }
      delete fightClub.userSockets[socketId];
    },
    isInQueue: function(socketId) {
      if ( _.indexOf(_.pluck(fightClub.queue, "id"), socketId) !== -1) return true;
    },
    isInFight: function(socketId) {
      if (typeof fightClub.userSockets[socketId] !== 'undefined') {
        if ( typeof fightClub.userSockets[socketId].inFight !== 'undefined' ) return true;
      }
      return false;
    }
  }
}


// Routes

app.get('/', function(req, res){
  res.render('index', { title: 'FightClub' })
})

app.get('/admin', function(req, res){
  res.render('admin', {
    title: 'FightCLub',
    users: _.size(fightClub.userSockets),
    queue: fightClub.queue.length,
    matches: _.size(fightClub.matches)
  })
})




// Sockets
io.sockets.on('connection', fightClub.methods.setupSockets)



// Listen

app.listen(8005);
console.log("fightClub server running.")