const Discord = require('discord.js');
const dotenv = require('dotenv');
const sql = require('sqlite3').verbose();

dotenv.config();

// In a production environment, the database is always live
let db = new sql.Database('./db/competition.db', sql.OPEN_READWRITE | sql.OPEN_CREATE, (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log(' [*] Established database connection.');
}).run('CREATE TABLE competitors(name TEXT NOT NULL UNIQUE, bio TEXT DEFAULT n00b, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, perf_rate REAL DEFAULT 10000, global_rank INTEGER DEFAULT NULL, prev_tourn_rank INTEGER DEFAULT NULL)', (err) => {
  if (err) {
    console.log(' [!] Primary table exists; skipping creation.');
    return;
  }
  console.log(' [*] The database is live!');
});

// Create an instance of a Discord client
const client = new Discord.Client();

function updateStandings(name, opponent, won) {
  db.run(`UPDATE competitors SET ${ won ? 'wins = wins + 1' : 'losses = losses + 1' } WHERE name = '${name}'`, (err) => {
    if (err) {
      console.error(err.message);
      return;
    }
    console.log(` [*] ${name} ${ won ? 'defeated' : 'lost to'} ${opponent}!`);
  });
}

function probability(elo, opponent_elo) {
  return 1.0 * 1.0 / (1 + 1.0 * Math.pow(10, 1.0 * (elo - opponent_elo) / 400));
}

function elo(name, opponent, won) {
  // ensure both players have their results pre-calculated, so the elo calculation isn't off-balanced by one loss
  updateStandings(name, opponent, won);
  updateStandings(opponent, name, !won);

  db.all(`SELECT perf_rate FROM competitors WHERE name = '${name}' OR name = '${opponent}'`, (err, res) => {
    if (err) {
      console.log(err.message);
      return;
    }

    var K = 30,
      pelo = res[0].perf_rate,
      oelo = res[1].perf_rate;
    var pa = probability(pelo, oelo);
    var pb = probability(oelo, pelo);

    if (won) {
      pelo = pelo + K * (1 - pa);
      oelo = oelo + K * (0 - pb);
    } else {
      pelo = pelo + K * (0 - pa);
      oelo = oelo + K * (1 - pb);
    }

    db.run(`UPDATE competitors SET perf_rate = ${ pelo } WHERE name = '${ name }'`, (err) => {
      if (err) {
        console.error(err.message);
        return;
      }
      console.log(` [*] ${ name }: Elo applied successfully!`);
    });

    db.run(`UPDATE competitors SET perf_rate = ${ oelo } WHERE name = '${ opponent }'`, (err) => {
      if (err) {
        console.error(err.message);
        return;
      }
      console.log(` [*] ${ opponent }: Elo applied successfully!`);
    });
  });
}

/**
 * The ready event is vital, it means that only _after_ this will your bot start reacting to information
 * received from Discord
 */
client.on('ready', () => {
  console.log('Online and ready to go!');
});

function registerCompetitor(name) {
  console.log(` [ ] Registering competitor: ${name}`);

  db.run(`INSERT INTO competitors(name) VALUES(?)`, [name], (err) => {
    if (err) {
      console.error(err.message);
      return;
    }
    console.log(` [*] Registration successful!`);
  });
}

// Create an event listener for messages
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

    console.log(`${name} sent a command: ${cmd}`);

    // splice returns the deleted elements, so it needs to not be in the initializer
    params.splice(0, 1);

    if (message.member.roles.some(r => ["Owner"].includes(r.name))) {
      if (cmd === 'register') {
        registerCompetitor(params.join(' '));
      } else if (cmd === 'elo') {
        // TODO: Validate these params
        console.log(params);
        elo(params[0], params[1], params[2]);
      }
    }

    if (cmd === 'bio') {
      const bio = params.join(' ');

      db.run(`UPDATE competitors SET bio = '${bio}' WHERE name = '${name}'`, (err) => {
        if (err) {
          console.error(err.message);
          return;
        }
        console.log(` [*] Bio update successful!`);
      });

      message.member.guild.channels.find(c => c.name === 'discussion').send(`${name} updated their bio!\n\n${bio}`)
    }
  }
});

// Create an event listener for new guild members
client.on('guildMemberAdd', member => {
  registerCompetitor(member.user.tag);
});

// Log our bot in using the token from https://discordapp.com/developers/applications/me
client.login(process.env.CLIENT_ID);