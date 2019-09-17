
const Discord = require('discord.js');
const dotenv = require('dotenv');
const sql = require('sqlite3').verbose();

dotenv.config();

// Create an instance of a Discord client
const client = new Discord.Client();

function save(query, params) {
  console.log(' [ ] Beginning query.');

  new sql.Database('./db/competition.db', sql.OPEN_READWRITE | sql.OPEN_CREATE, (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log(' [*] Established database connection.');
  }).run('CREATE TABLE competitors(name TEXT NOT NULL UNIQUE, bio TEXT DEFAULT n00b, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, perf_rate REAL DEFAULT 10000, global_rank INTEGER DEFAULT NULL, prev_tourn_rank INTEGER DEFAULT NULL)', (err) => {
    if (err) {
      console.log(' [-] Primary table exists; skipping creation.');
      return;
    }
  }).run(query, params, (err) => {
    if (err) {
      console.error(err.message);
      return;
    }
    console.log(` [*] Query successful! Created row #${this.lastID}`);
  }).close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log(' [*] Closed database connection.');
  });
}

function elo(name, opponent, won) {
  // set the wins
  if (won) {
    save(`UPDATE competitors SET wins = wins + 1 WHERE name = ${name}`);
  } else {
    save(`UPDATE competitors SET losses = losses + 1 WHERE name = ${name}`);
  }

  // fetch the current elo rank, opponent's elo rank, wins & losses
  var old_elo, opponent_elo, wins, losses;

  new sql.Database('./db/competition.db', sql.OPEN_READONLY, (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log(' [*] Established database connection.');
  }).run(`SELECT name, perf_rate, wins, losses WHERE name = ${name}`, (err, res) => {
    if (err) {
      console.error(err.message);
      return;
    }
    old_elo = res[1];
    wins = res[2];
    losses = res[3];
    console.log(' [*] Fetched necessary competitor information.');
  }).run(`SELECT name, perf_rate WHERE name = ${opponent}`, (err, res) => {
    if (err) {
      console.error(err.message);
      return;
    }
    opponent_elo = res[1];
  }).close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log(' [*] Fetched necessary opponent information.');
  });

  // apply the new elo
  // https://en.wikipedia.org/wiki/Chess_rating_system
  var new_elo = old_elo + 16(wins - losses + (0.5 * ((opponent_elo - old_elo) / 200)));

  save(`UPDATE competitors SET perf_rate = ${new_elo} WHERE name = ${name}`);
}

/**
 * The ready event is vital, it means that only _after_ this will your bot start reacting to information
 * received from Discord
 */
client.on('ready', () => {
  console.log('Online and ready to go!');
});

function registerCompetitor(member) {
  const channel = member.guild.channels.find(c => c.name === 'discussion');

  if (!channel) {
    return;
  }

  channel.send(`Welcome to the battle, ${member}!\nYou've been registered to the competition brackets!`);
  save(`INSERT INTO competitors(name) VALUES(?)`, [`${member.user.tag}`]);
}

// Create an event listener for messages
client.on('message', message => {
  var cmd = message.content;

  if (cmd.startsWith("!ssbb ")) {
    cmd = cmd.split(" ", 2)[1];
    console.log(`${message.member.user.tag} sent a command: ${cmd}`)

    if (cmd === 'register') {
      registerCompetitor(message.member);
    }
  }
});

// Create an event listener for new guild members
client.on('guildMemberAdd', member => {
  registerCompetitor(member);
});

// Log our bot in using the token from https://discordapp.com/developers/applications/me
client.login(process.env.CLIENT_ID);
