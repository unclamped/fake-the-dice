import Rcon from 'rcon';
import { join } from 'path';
import fs from 'fs';
import readline from 'readline';
import { promisify } from 'util';

// CHAT_PREFIX FFD700
// PERK_COLOR_GOOD 32CD32
// PERK_COLOR_BAD 8650AC

// For parsing the config file
const readFileAsync = promisify(fs.readFile);

// Store the parsed perks
let perks = [];

// Track the last time a message was sent
let lastMessageTime = 0;

// RCON connection setup
const conn = new Rcon('0.0.0.0', 27015, 'pene');

conn.on('auth', async function() {
  console.log("Authenticated");
  console.log("Sending command: help")
  conn.send("help");
  
  // Parse perks before watching log file
  await parsePerksConfig();
  watchLogFile();
  
  // Set up the periodic reminder message
  setupReminderMessage();
}).on('response', function(str) {
  console.log("Response: " + str);
}).on('error', function(err) {
  console.log("Error: " + err);
}).on('end', function() {
  console.log("Connection closed");
  process.exit();
});

// Connect to RCON
conn.connect();

// Function to set up periodic reminder message
function setupReminderMessage() {
  setInterval(() => {
    const currentTime = Date.now();
    const timeSinceLastMessage = currentTime - lastMessageTime;
    
    // Only send reminder if at least 5 seconds have passed since the last message
    if (timeSinceLastMessage >= 5000) {
      conn.send('kill');
      setTimeout(() => {
        conn.send('say "color!FFD700[Server_Message] Type color!FF0000!rtd in chat to roll the dice!"');
        lastMessageTime = Date.now();
        console.log('Sent reminder message about RTD');
      }, 500);
    } else {
      console.log(`Skipping reminder message - cooldown active (${Math.floor((5000 - timeSinceLastMessage) / 1000)}s remaining)`);
    }
  }, 60000);
}

// Path to the TF2 console log file
const logFilePath = join(process.env.HOME, '.steam/steam/steamapps/common/Team Fortress 2/tf/console.log');

// Path to the perks config file
const perksConfigPath = './rtd2_perks.default.cfg';

// Parse the perks config file
async function parsePerksConfig() {
  try {
    console.log(`Reading perks config from ${perksConfigPath}`);
    const data = await readFileAsync(perksConfigPath, 'utf8');
    
    // Find the "Effects" section in the config
    const effectsMatch = data.match(/"Effects"\s*{([\s\S]*)}/);
    
    if (!effectsMatch) {
      console.error("Could not find Effects section in config");
      return;
    }
    
    const effectsSection = effectsMatch[1];
    
    // Extract each numbered effect section
    // We need a regex that can handle nested braces properly
    const effectRegex = /"(\d+)"\s*{([^}]*?(?:{[^}]*}[^}]*)*?)}/g;
    let match;
    
    while ((match = effectRegex.exec(effectsSection)) !== null) {
      const effectId = match[1];
      const effectContent = match[2];
      
      // Extract name
      const nameMatch = effectContent.match(/"name"\s*"([^"]*)"/);
      // Extract good/bad
      const goodMatch = effectContent.match(/"good"\s*"(\d+)"/);
      
      if (nameMatch && goodMatch) {
        const name = nameMatch[1];
        const isGood = goodMatch[1] === "1";
        
        perks.push({
          id: parseInt(effectId),
          name,
          isGood
        });
      }
    }
    
    console.log(`Successfully parsed ${perks.length} perks`);
  } catch (error) {
    console.error(`Error parsing perks config: ${error.message}`);
  }
}

// Get a random perk regardless of type
function getRandomPerk() {
  if (perks.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * perks.length);
  return perks[randomIndex];
}

// Create a real-time file watcher for the log file
function watchLogFile() {
  console.log(`Watching log file: ${logFilePath}`);
  
  // Check if file exists before attempting to watch it
  if (!fs.existsSync(logFilePath)) {
    console.error(`Error: Log file not found at ${logFilePath}`);
    return;
  }
  
  // Get the current size of the file to start reading from the end
  const stats = fs.statSync(logFilePath);
  let lastSize = stats.size;
  
  // Create a watcher for file changes
  fs.watch(logFilePath, (eventType) => {
    if (eventType === 'change') {
      // Open the file for reading
      const stream = fs.createReadStream(logFilePath, {
        start: lastSize
      });
      
      // Update the last size for next read
      lastSize = fs.statSync(logFilePath).size;
      
      // Create readline interface to read line by line
      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
      });
      
      // Process each new line
      rl.on('line', (line) => {
        console.log(`[LOG] ${line}`);
        
        // Check if the line contains a "!rtd" command
        const rtdMatch = line.match(/(.*): !rtd/);
        if (rtdMatch) {
          // Extract the player name
          const playerName = rtdMatch[1];
          playerName = playerName.replace(/^\*DEAD\*\s+/, '');
          console.log(`Player ${playerName} used !rtd command`);
          
          // Check if enough time has passed since last message
          const currentTime = Date.now();
          const timeSinceLastMessage = currentTime - lastMessageTime;
          
          if (timeSinceLastMessage >= 5000) {
            // Determine if the player gets a good or bad perk (50/50 chance)
            const isLucky = Math.random() >= 0.5;
            const selectedPerk = getRandomPerk();
            
            conn.send('kill');
            setTimeout(() => {
              if (selectedPerk) {
                const perkColor = selectedPerk.isGood ? 'color!32CD32' : 'color!8650AC';
                conn.send(`say "color!FFD700[Server_Message] ${playerName} has rolled ${perkColor}${selectedPerk.name}!"`);
              }
              
              // Update the last message time
              lastMessageTime = Date.now();
            }, 500);
          } else {
            console.log(`Ignoring !rtd command from ${playerName} - cooldown active (${Math.floor((5000 - timeSinceLastMessage) / 1000)}s remaining)`);
          }
        }
      });
    }
  });
}
