var defaultPlayerNames = [
  'ryan',
  'ellis',
  'fredrik',
  'teddy',
  'will',
  'brandon',
  'elias',
  'owen',
  'hunter',
  'luca'
];

var defaultPositionNames = [
  'keeper',
  'left_back',
  'right_back',
  'left_wing',
  'right_wing'
];

var SHOW_TIMES_AT_POSITION = false;

/** @param {string} type */
function storageAvailable(type) {
  try {
    var storage = window[type],
	x = '__storage_test__';
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  }
  catch(e) {
    return false;
  }
}

/**
 * @param {!Element} element
 * @param {function()} func
 */
function handleTouch(element, func) {
  element.addEventListener('touchstart', func, 
                           /** @type {boolean} */ ({'passive': true}));
}

/** @return {number} */
function currentTimeMs() {
  return new Date().getTime() + 0;
}

/**
 * @param {number} timeMs
 * @return {string}
 */
function formatTime(timeMs) {
  var timeSec = Math.floor(timeMs / 1000);
  var minutes = Math.floor(timeSec / 60);
  var seconds = timeSec % 60;
  if (seconds < 10) {
    seconds = '0' + seconds;
  }
  return '' + minutes + ':' + seconds;
}

/**
 * @param {string} name
 * @param {!Element} headRow
 * @param {!Game} game
 * @constructor 
 */
var Position = function(name, headRow, game) {
  this.name = name;
  this.currentPlayer = null;

  // The position shows up twice in the DOM, once in the field
  // layout, and once as a table header for the players, so we 
  // can see how long they've played at each position.  First
  // the field layout, which will be sensitive to touch events
  // for player assignment, and we will write the player in there
  // when assigned.
  var element = document.getElementById(name);

  // Rebuild the element in case this is a 'reset' and the HTML element
  // already has a touch handler.
  this.element = element.cloneNode(true);
  var parent = element.parentNode;
  parent.removeChild(element);
  parent.appendChild(this.element);

  this.element.style.lineHeight = 'normal';
  this.render();
  handleTouch(this.element, game.assignPosition.bind(game, this));
  
  // Now the table header entry, which we are just going to automatically
  // populate, and don't need to reference it after that.
  if (SHOW_TIMES_AT_POSITION) {
    var th = document.createElement('th');
    th.textContent = name;
    headRow.appendChild(th);
  }
};

/**
 * @return {void}
 */
Position.prototype.render = function() {
  var text = '<b>' + this.name + ':</b><br/>';
  if (this.currentPlayer) {
    text += '' + this.currentPlayer.renderAtPosition();
  } else {
    text += '<i><b>NEEDS PLAYER</b></i>';
  }
  this.element.innerHTML = text;
};

/** @param {string} color */
Position.prototype.setBackgroundColor = function(color) {
  this.element.style.backgroundColor = color;
};

/** @param {?Player} player */
Position.prototype.restorePlayer = function(player) {
  this.currentPlayer = player;
  this.render();
};

/** @param {?Player} player */
Position.prototype.setPlayer = function(player) {
  if (this.currentPlayer != player) {
    if (this.currentPlayer != null) {
      var oldPlayer = this.currentPlayer;
      this.currentPlayer = null;
      oldPlayer.setPosition(null);
    }
    this.restorePlayer(player);
  }
};

/** @param {number} timeMs */
Position.prototype.addTimeToShift = function(timeMs) {
  if (this.currentPlayer != null) {
    this.currentPlayer.addTimeToShift(timeMs);
    this.render();
  }
};

/**
 * @param {string} name
 * @param {Game} game
 * @constructor 
 */
var Player = function(name, game) {
  this.name = name;
  this.game = game;
  this.timeInGameMs = 0;
  this.timeInShiftMs = 0;
  this.timeAtPositionMs = {};
  if (SHOW_TIMES_AT_POSITION) {
    this.elementAtPosition = {};
  }
  this.currentPosition = null;
  this.selected = false;
  for (var i = 0; i < defaultPositionNames.length; ++i) {
    var positionName = defaultPositionNames[i];
    this.timeAtPositionMs[positionName] = 0;
  }
};

/**
 * @param {string} field
 * @return {string}
 */
Player.prototype.getStorage = function(field) {
  return window.localStorage['Player:' + this.name + ':' + field];
};

/**
 * @param {string} field
 * @param {string} value
 */
Player.prototype.setStorage = function(field, value) {
  window.localStorage['Player:' + this.name + ':' + field] = value;
};

/**
 * @return {void}
 */
Player.prototype.restore = function() {
  this.timeInGameMs = parseInt(this.getStorage('timeInGameMs'), 10);
  this.timeInShiftMs = parseInt(this.getStorage('timeInShiftMs'), 10);
  // timeAtPositionMs ...
  this.currentPosition = this.game.findPosition(this.getStorage('currentPosition'));
  if (this.currentPosition != null) {
    this.currentPosition.restorePlayer(this);
  }
};

/**
 * @return {void}
 */
Player.prototype.save = function() {
  this.setStorage('timeInGameMs', '' + this.timeInGameMs);
  this.setStorage('timeInShiftMs', '' + this.timeInShiftMs);
  this.setStorage('currentPosition', this.currentPosition ? 
                  this.currentPosition.name : '');
};

/** @return {boolean} */
Player.prototype.isPlaying = function() {
  return this.currentPosition != null;
};

/**
 * Compare two players in terms of play-time, returning the difference
 * in milliseconds between the amount the two players have played in the
 * game.  If the game-times are equal, return the difference beween the
 * shift-times in milliseconds.
 *
 * @param {!Player} player1
 * @param {!Player} player2
 * @return {number}
 */
Player.comparePlayingTimeMs = function(player1, player2) {
  var cmp = player1.timeInGameMs - player2.timeInGameMs;
  if (cmp == 0) {
    cmp = player1.timeInShiftMs - player2.timeInShiftMs;
  }
  return cmp;
}

/**
 * @param {!Player} player1
 * @param {!Player} player2
 * @return {number}
 */
Player.compare = function(player1, player2) {
  var cmp = Player.comparePlayingTimeMs(player1, player2);
  if (cmp == 0) {
    if (player1.name < player2.name) {
      cmp = -1;
    } else if (player1.name > player2.name) {
      cmp = 1;
    }
  }
  return cmp;
}

/**
 * @param {!Element} tableBody
 */
Player.prototype.render = function(tableBody) {
  var row = document.createElement('tr');
  this.nameElement = document.createElement('td');
  handleTouch(this.nameElement, this.game.selectPlayer.bind(this.game, this));
  this.nameElement.textContent = this.name;
  row.appendChild(this.nameElement);
  this.gameTimeElement = document.createElement('td');
  this.gameTimeElement.textContent = formatTime(this.timeInGameMs);
  row.appendChild(this.gameTimeElement);
  if (SHOW_TIMES_AT_POSITION) {
    for (var i = 0; i < this.game.positionNames.length; ++i) {
      var positionName = this.game.positionNames[i];
      var td = document.createElement('td');
      row.appendChild(td);
      this.elementAtPosition[positionName] = td;
    }
  }
  this.updateColor();
  tableBody.appendChild(row);
};

/**
 * @param {Position} position
 */
Player.prototype.setPosition = function(position) {
  if (this.currentPosition != position) {
    if (this.currentPosition != null) {
      var oldPos = this.currentPosition;
      this.currentPosition = null;
      oldPos.setPlayer(null);
    } else {
      this.timeInShiftMs = 0;
    }
    this.currentPosition = position;
    this.timeInShift = 0;
    this.updateColor();
    this.save();
  }
};

/**
 * @return {void}
 */
Player.prototype.updateColor = function() {
  var color = 'white';
  if (this.currentPosition != null) {
    if (this.selected) {
      color = 'red';
      this.currentPosition.setBackgroundColor('red');
    } else if (this.currentPosition == this.game.positionWithLongestShift) {
      color = 'orange';
      this.currentPosition.setBackgroundColor('orange');
    } else {
      color = 'yellow';
      this.currentPosition.setBackgroundColor('white');
    }
  } else if (this.selected) {
    color = 'blue';
  }
  this.nameElement.style.backgroundColor = color;
};

/**
 * @return {string}
 */
Player.prototype.renderAtPosition = function() {
  return this.name + ' ' + formatTime(this.timeInShiftMs);
};

/**
 * @param {number} timeMs
 */
Player.prototype.addTimeToShift = function(timeMs) {
  this.timeInShiftMs += timeMs;
  this.timeInGameMs += timeMs;
  this.gameTimeElement.textContent = formatTime(this.timeInGameMs);
  this.timeAtPositionMs[this.currentPosition.name] += timeMs;
  //if (SHOW_TIMES_AT_POSITION) {
    //var positionMs = ...;
    //var elt = this.elementAtPosition[this.currentPosition.name];
    //elt.textContent = formatTime(positionMs);
  //}
};

/**
 * unselects player
 */
Player.prototype.unselect = function() {
  this.selected = false;
  this.updateColor();
};

/**
 * @return {void}
 */
Player.prototype.select = function() {
  this.selected = true;
  this.updateColor();
};

/** @constructor */
var Game = function() {
  // Set up HTML element connections & handlers.
  this.gameClockElement = document.getElementById('game_clock');
  //handleTouch(this.gameClockElement, this.toggleClock.bind(this));
  /** @type {!Element} */
  this.toggleClockButton = 
    /** @type {!Element} */ (document.getElementById('clock_toggle'));
  handleTouch(this.toggleClockButton, this.toggleClock.bind(this));

  /** @type {Position} */
  this.positionWithLongestShift = null;

  this.statusBar = document.getElementById('status_bar');
  this.statusBarWriteMs = 0;
  var resetTag = /** @type {!Element} */ (document.getElementById('reset'));
  handleTouch(resetTag, this.reset.bind(this));

  if (!this.restore()) {
    this.reset();
  }
};    

/**
 * @return {void}
 */
Game.prototype.reset = function() {
  this.elapsedTimeMs = 0;
  this.timeOfLastUpdateMs = 0;
  this.positions = [];
  this.selectedPlayer = null;
  this.positionNames = defaultPositionNames;
  this.playerNames = defaultPlayerNames;
  this.constructPlayersAndPositions();
  window.localStorage.playerNames = this.playerNames.join(',');
  window.localStorage.positionNames = this.positionNames.join(',');
  this.sortAndRenderPlayers();
  this.timeRunning = false;
  this.update();
};

/**
 * @return {void}
 */
Game.prototype.constructPlayersAndPositions = function() {
  var headRow = /** @type {!Element} */ (document.getElementById('table-head-row'));
  this.positions = [];
  for (var i = 0; i < this.positionNames.length; ++i) {
    this.positions.push(new Position(this.positionNames[i], headRow, this));
  }
  this.players = [];
  for (var i = 0; i < this.playerNames.length; ++i) {
    var player = new Player(this.playerNames[i], this);
    this.players.push(player);
  }
};

/**
 * @return {boolean}
 */
Game.prototype.restore = function() {
  if (!storageAvailable('localStorage') || 
      !window.localStorage.playerNames || 
      !window.localStorage.positionNames) {
    return false;
  }
  this.playerNames = window.localStorage.playerNames.split(',');
  this.positionNames = window.localStorage.positionNames.split(',');
  if ((this.playerNames.length == 0) || (this.positionNames.length == 0)) {
    return false;
  }
  this.constructPlayersAndPositions();
  for (var i = 0; i < this.players.length; ++i) {
    var player = this.players[i];
    player.restore();
  }
/*
  for (var i = 0; i < this.positions.length; ++i) {
    var position = this.position[i];
    position.restore();
  }
*/
  this.elapsedTimeMs = parseInt(window.localStorage.elapsedTimeMs, 10);
  this.timeRunning = window.localStorage.timeRunning != 'false';
  this.timeOfLastUpdateMs = parseInt(window.localStorage.timeOfLastUpdateMs, 10);
  this.sortAndRenderPlayers();
  for (var i = 0; i < this.players.length; ++i) {
    var player = this.players[i];
    player.updateColor();
  }
  this.update();
  return true;
};

/**
 * @param {string} name
 * @return {?Position}
 */
Game.prototype.findPosition = function(name) {
  for (var i = 0; i < this.positions.length; ++i) {
    var position = this.positions[i];
    if (position.name == name) {
      return position;
    }
  }
  return null;
}

/**
 * @return {void}
 */
Game.prototype.save = function() {
  window.localStorage.elapsedTimeMs = '' + this.elapsedTimeMs;
  window.localStorage.timeRunning = this.timeRunning ? 'true' : 'false';
  window.localStorage.timeOfLastUpdateMs = '' + this.timeOfLastUpdateMs;
  for (var i = 0; i < this.players.length; ++i) {
    var player = this.players[i];
    player.save();
  }
};

/**
 * @return {void}
 */
Game.prototype.sortAndRenderPlayers = function() {
  this.computePositionWithLongestShift();
  this.players.sort(Player.compare);
  var tableBody = document.getElementById('table-body');
  tableBody.innerHTML = '';
  for (var i = 0; i < this.players.length; ++i) {
    var player = this.players[i];
    player.render(tableBody);
  }
  this.sortDelayMs = Number.MAX_VALUE;
  for (var i = 1; i < this.players.length; ++i) {
    if (!this.players[i].isPlaying() && this.players[i - 1].isPlaying()) {
      var delayMs = Player.comparePlayingTimeMs(this.players[i], this.players[i - 1]);
      this.sortDelayMs = Math.min(this.sortDelayMs, delayMs);
    }
  }
}

/**
 * @return {void}
 */
Game.prototype.toggleClock = function() {
  this.timeRunning = !this.timeRunning;
  this.timeOfLastUpdateMs = currentTimeMs();
  this.update();
};

/**
 * @return {void}
 */
Game.prototype.redrawClock = function() {
  if (this.timeRunning) {
    this.gameClockElement.style.backgroundColor = 'green';
    this.toggleClockButton.textContent = 'Stop Clock';
  } else {
    this.gameClockElement.style.backgroundColor = 'red';
    this.toggleClockButton.textContent = 'Resume Clock';
  }
};


/**
 * @param {?Player} player
 */
Game.prototype.selectPlayer = function(player) {
  if (this.selectedPlayer == player) {
    // If current player is selected, simply unselect.
    this.selectedPlayer = null;
    if (player != null) {
      player.unselect();
    }
  } else {
    if (this.selectedPlayer != null) {
      this.selectedPlayer.unselect();
    }
    this.selectedPlayer = player;
    if (player != null) {
      player.select();
    }
  }
};

/**
 * @return {void}
 */
Game.prototype.computePositionWithLongestShift = function() {
  var pos = null;
  for (var i = 0; i < this.positions.length; ++i) {
    var position = this.positions[i];
    if ((position.name != 'keeper') && (position.currentPlayer != null)) {
      if ((pos == null) || 
          (position.currentPlayer.timeInShiftMs > pos.currentPlayer.timeInShiftMs)) {
        pos = position;
      }
    }
  }
  this.positionWithLongestShift = pos;
  
  for (var i = 0; i < this.positions.length; ++i) {
    var position = this.positions[i];
    if (position.currentPlayer == null) {
      position.setBackgroundColor('yellow');
    } else if (position.currentPlayer.selected) {
      position.setBackgroundColor('red');
    } else if (position == this.positionWithLongestShift) {
      position.setBackgroundColor('orange');
    } else {
      position.setBackgroundColor('white');
    }
  }
};

/**
 * @param {?Position} position
 */
Game.prototype.assignPosition = function(position) {
  if (this.selectedPlayer == null) {
    this.writeStatus('Select a player before assigning a position');
  } else {
    this.selectedPlayer.setPosition(position);
    if (position != null) {
      position.setPlayer(this.selectedPlayer);
    }
    
    // Unselect the player so we are less likely to double-assign.
    this.selectPlayer(null);
  }
  this.sortAndRenderPlayers();
};

/**
 * @param {string} text
 */
Game.prototype.writeStatus = function(text) {
  this.statusBar.textContent = text;
  this.statusBarWriteMs = currentTimeMs();
};

/**
 * @return {void}
 */
Game.prototype.update = function() {
  if (this.timeRunning) {
    var timeMs = currentTimeMs();
    var timeSinceLastUpdate = timeMs - this.timeOfLastUpdateMs;
    this.elapsedTimeMs += timeSinceLastUpdate;
    this.timeOfLastUpdateMs = timeMs;
    for (var i = 0; i < this.positions.length; ++i) {
      this.positions[i].addTimeToShift(timeSinceLastUpdate);
    }
    if (this.sortDelayMs == Number.MAX_VALUE) {
      this.writeStatus('no re-sort will occur');
    } else {
      this.sortDelayMs -= timeSinceLastUpdate;
      if (this.sortDelayMs <= 0) {
        this.writeStatus('resorting...');
        this.sortAndRenderPlayers();
      } else {
        this.writeStatus('next sort in ' + this.sortDelayMs / 1000 + ' sec');
      }
    }
    window.setTimeout(this.update.bind(this), 1000);
  }
  if ((this.statusBarWriteMs != 0) &&
      (timeMs - this.statusBarWriteMs) > 5000) {
    this.statusBar.textContent = '';
    this.statusBarWriteMs = 0;
  }
  this.redrawClock();
  this.gameClockElement.innerHTML = '<b>Game Clock: </b>' +
    formatTime(this.elapsedTimeMs);
  this.save();
};

var game;
window.onload = function() {
  game = new Game();
};

