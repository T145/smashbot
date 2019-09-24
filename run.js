const discord = require('discord.js');
const dotenv = require('dotenv');
const sqlite = require('sqlite3').verbose();

const client = new discord.Client({
  messageCacheMaxSize: 20,
  retryLimit: 14,
  ws: {
    large_threshold: 100
  }
});

dotenv.config();

let connection = new sqlite.Database('./db/competition.db', sqlite.OPEN_READWRITE | sqlite.OPEN_CREATE, (err) => {
  console.log(err ? ` [!] ERROR: ${err.message}` : ' [?] Establishing database connection..');
}).run('CREATE TABLE competitors(name TEXT NOT NULL UNIQUE, bio TEXT DEFAULT n00b, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, perf_rate REAL DEFAULT 1000, global_rank INTEGER DEFAULT NULL, prev_tourn_rank INTEGER DEFAULT NULL)', (err) => {
  console.log(err ? ' [?] Primary table exists; skipping creation.' : ' [*] Created the primary table \"competitors\"!');
  console.log(' [*] Connected to the database!');
});

client.on('ready', () => {
  console.log(' [*] Discord client is ready!');

  client.user.setStatus('dnd');
  client.user.setPresence({
    game: {
      name: 'btssmash',
      type: 'STREAMING',
      url: 'https://www.twitch.tv/btssmash'
    }
  });
});

function standingUpdate(winner, loser) {
  connection.run('UPDATE competitors SET wins = wins + 1 WHERE name = ?', [winner], (err) => {
    console.log(err ? ` [!] ERROR: ${err.message}` : ` [*] ${winner} won! Standings updated.`);
  });
  connection.run('UPDATE competitors SET losses = losses + 1 WHERE name = ?', [loser], (err) => {
    console.log(err ? ` [!] ERROR: ${err.message}` : ` [*] ${loser} lost! Standings updated.`);
  });
}

function calcEloDiff(pelo, oelo) {
  return 1.0 * 1.0 / (1 + 1.0 * Math.pow(10, 1.0 * (pelo - oelo) / 400));
}

function calcElo(winner_elo, loser_elo) {
  const K = 30;
  var winner_diff = calcEloDiff(winner_elo, loser_elo);
  var loser_diff = calcEloDiff(loser_elo, winner_elo);
  return [winner_elo + K * (1 - winner_diff), loser_diff + K * (0 - loser_diff)];
}

function updateElo(winner, loser) {
  standingUpdate(winner, loser);

  connection.all('SELECT perf_rate FROM competitors WHERE name = ? OR name = ?', [winner, loser], (err, rows) => {
    if (err) {
      console.log(err.message);
      return;
    }

    var elos = calcElo(rows[0].perf_rate, rows[1].perf_rate);

    for (var i = 0; i < 2; ++i) {
      var elo = elos[i];
      var row = rows[i];

      connection.run('UPDATE competitors SET perf_rate = ? WHERE name = ?', [elo, row.name], (err) => {
        console.log(err ? ` [!] ERROR: ${err.message}` : ` [*] Applied ELO for ${row.name} successfully!`);
      });
    }
  });
}

function registerCompetitor(name) {
  console.log(` [?] Registering competitor: ${name}`);

  connection.run('INSERT INTO competitors(name) VALUES(?)', [name], (err) => {
    console.log(err ? err.message : ` [*] Registration successful!`);
  });
}

function sendUserInfo(name, channel) {
  connection.all(`SELECT bio, wins, losses, perf_rate FROM competitors WHERE name = ?`, [name], (err, rows) => {
    if (err) {
      console.log(err.message);
      channel.send(err.message);
    } else {
      var row = rows[0];
      channel.send(`✨ ${name.split('#')[0]} ✨\n\n__***Bio:***__ ${row.bio}\n__***Wins:***__ ${[row.wins]}\n__***Losses:***__ ${row.losses}\n__***ELO:***__ ${row.perf_rate}`);
    }
  });
}

client.on('message', message => {
  if (!(message.channel.type === 'text')) {
    return;
  }

  var cmd = message.content;

  if (cmd.startsWith("!!")) {
    cmd = cmd.substring(2);
    var params = cmd.replace(/\s+/g, ' ').trim().split(' ');
    cmd = params[0];
    var name = message.member.user.tag;
    var channel = message.member.guild.channels.find(c => c.name.startsWith('bot'));

    console.log(`${name} sent a command: ${cmd}`);

    // splice returns the deleted elements, so it needs to not be in the initializer
    params.splice(0, 1);

    if (message.member.roles.some(r => ["Owner"].includes(r.name))) {
      if (cmd === 'register') {
        registerCompetitor(params.join(' '));
      } else if (cmd === 'elo') {
        // TODO: Validate names in the params
        updateElo(params[0], params[1]);
      }
    }

    if (cmd === 'bio') {
      const bio = params.join(' ');

      connection.run(`UPDATE competitors SET bio = ? WHERE name = ?`, [bio, name], (err) => {
        if (err) {
          console.log(err.message);
        } else {
          console.log(` [*] Bio update successful!`);
        }
      });
      //channel.send(`${name} updated their bio!\n\n${bio}`);
    }

    if (cmd === 'whois') {
      // TODO: Add support for partial username queries, including no discriminator and nicknames
      sendUserInfo(params[0], channel);
    } else if (cmd === 'whoami') {
      sendUserInfo(name, channel);
    }
  }
});

// Log our bot in using the token from https://discordapp.com/developers/applications/me
client.login(process.env.CLIENT_ID);