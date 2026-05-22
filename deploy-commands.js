require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandFolders = fs.readdirSync(path.join(__dirname, 'commands'));

for (const folder of commandFolders) {
  const files = fs
    .readdirSync(path.join(__dirname, 'commands', folder))
    .filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const cmd = require(path.join(__dirname, 'commands', folder, file));
    if ('data' in cmd) commands.push(cmd.data.toJSON());
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Registering ${commands.length} slash commands...`);
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registered!');
  } catch (error) {
    console.error(error);
  }
})();
