
const Discord = require('discord.js');
const dotenv = require('dotenv');
const sql = require('sqlite3').verbose();

dotenv.config();

// Create an instance of a Discord client
const client = new Discord.Client();

// Create an instance of the database
let db = new sql.Database('./db/competition.db', sql.OPEN_READWRITE | sql.OPEN_CREATE, (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the database!');
});

db.serialize(() => {
  db.run('CREATE TABLE competitors(name text)', (err) => {
    if (err) {
      console.log("Main table already exists! Skipping creation.");
      return;
    }
  });
});

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

  db.run(`INSERT INTO competitors(name) VALUES(?)`, [`${member.user.tag}`], function(err) {
    if (err) {
      return console.log(err.message);
    }
    // get the last insert id
    console.log(`A row has been inserted with id ${this.lastID}`);
  });
}

// Create an event listener for messages
client.on('message', message => {
  var msg = message.content;

  if (msg.startsWith("!ssbb ")) {
    var cmd = msg.split(" ", 2)[1];
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

/* db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Closed database connection.');
}); */