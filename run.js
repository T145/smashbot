
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
  }).run('CREATE TABLE competitors(name TEXT NOT NULL UNIQUE, perf_rate REAL DEFAULT 10000, global_rank INTEGER DEFAULT NULL, prev_tourn_rank INTEGER DEFAULT NULL, bio TEXT DEFAULT NULL)', (err) => {
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
