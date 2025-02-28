const express = require('express');
const axios = require('axios');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const readline = require('readline');
const chalk = require('chalk');
const figlet = require('figlet');
const Table = require('cli-table3');
const os = require('os');
const path = require('path');

// Configuration
const PORT = 3000;
const OLLAMA_API_BASE = "http://127.0.0.1:11434";

// Création de l'application
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Variables d'état du serveur
let connectedUsers = 0;
let serverStartTime = null;
let requestsCount = 0;
let serverStatus = 'stopped';
let availableModels = [];
let currentRequest = null;
let outputBuffer = [];
const MAX_OUTPUT_LINES = 15; // Augmentation du nombre de lignes visibles
let updateTimer = null;
let lastHeaderHeight = 0;
let isRefreshing = false;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Interface de ligne de commande
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: chalk.cyan('ollama-server> ')
});

// Fonction pour ajouter une ou plusieurs lignes à la zone de sortie
function addOutput(text) {
  if (typeof text === 'string') {
    outputBuffer.push(text);
    if (outputBuffer.length > MAX_OUTPUT_LINES) {
      outputBuffer.shift();
    }
  } else if (Array.isArray(text)) {
    text.forEach(line => {
      if (typeof line === 'string') {
        outputBuffer.push(line);
        if (outputBuffer.length > MAX_OUTPUT_LINES) {
          outputBuffer.shift();
        }
      }
    });
  }

  if (!isRefreshing) {
    isRefreshing = true;
    renderOutputOnly();
    isRefreshing = false;
  }
}

// Fonction pour dessiner uniquement la partie supérieure (statut)
function renderHeaderOnly() {
  if (isRefreshing) return;

  isRefreshing = true;

  console.clear();

  const terminalWidth = process.stdout.columns || 80;

  const logo = figlet.textSync('Ollama Server', {
    font: 'Standard',
    horizontalLayout: 'fitted'
  });

  console.log(chalk.blue(logo));

  const statusBar = new Table({
    chars: {
      'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
      'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
      'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
      'right': '║', 'right-mid': '╢', 'middle': '│'
    },
    style: { 'padding-left': 1, 'padding-right': 1 },
    colWidths: [20, terminalWidth - 24]
  });

  statusBar.push(
    ['Statut', serverStatus === 'running' ? chalk.green('En ligne') : chalk.red('Hors ligne')],
    ['Utilisateurs', chalk.yellow(connectedUsers.toString())],
    ['Requêtes traitées', chalk.yellow(requestsCount.toString())],
    ['Uptime', serverStatus === 'running' ? getUptime() : 'N/A'],
    ['Requête en cours', currentRequest ? chalk.cyan(currentRequest) : chalk.gray('Aucune')]
  );

  console.log(statusBar.toString());

  console.log(chalk.cyan('╔' + '═'.repeat(terminalWidth - 2) + '╗'));
  console.log(chalk.cyan('║ ') + chalk.yellow('Résultats des commandes:') + ' '.repeat(terminalWidth - 28) + chalk.cyan('║'));
  console.log(chalk.cyan('╟' + '─'.repeat(terminalWidth - 2) + '╢'));

  lastHeaderHeight = logo.split('\n').length + 8;

  renderOutputOnly(false);

  isRefreshing = false;
}

// Fonction pour dessiner uniquement la partie sortie (résultats)
function renderOutputOnly(clearScreen = true) {
  if (isRefreshing && clearScreen) return;

  isRefreshing = true;

  const terminalWidth = process.stdout.columns || 80;
  const terminalHeight = process.stdout.rows || 24;

  const outputHeight = Math.min(MAX_OUTPUT_LINES, terminalHeight - lastHeaderHeight - 2);

  if (clearScreen) {
    console.clear();
    renderHeaderOnly();
    isRefreshing = false;
    return;
  }

  const linesToShow = outputBuffer.slice(-outputHeight);

  for (let i = 0; i < outputHeight; i++) {
    if (i < linesToShow.length) {
      let line = linesToShow[i] || '';
      if (stripAnsi(line).length > terminalWidth - 4) {
        line = line.substring(0, terminalWidth - 7) + '...';
      }

      const padding = Math.max(0, terminalWidth - stripAnsi(line).length - 4);

      console.log(chalk.cyan('║ ') + line + ' '.repeat(padding) + chalk.cyan('║'));
    } else {
      console.log(chalk.cyan('║ ') + ' '.repeat(terminalWidth - 4) + chalk.cyan('║'));
    }
  }

  console.log(chalk.cyan('╚' + '═'.repeat(terminalWidth - 2) + '╝'));

  rl.prompt(true);

  isRefreshing = false;
}

// Fonction pour rendre l'interface complète
function renderScreen() {
  renderHeaderOnly();
}

// Fonction pour retirer les séquences ANSI des chaînes (pour calculer correctement la longueur)
function stripAnsi(str) {
  return str.replace(/\u001b\[\d+m/g, '');
}

// Démarrer le timer de mise à jour
function startUpdateTimer() {
  if (updateTimer) {
    clearInterval(updateTimer);
  }

  updateTimer = setInterval(() => {
    if (serverStatus === 'running' && !isRefreshing) {
      renderHeaderOnly();
    }
  }, 1000);
}

// Affichage de l'aide
function displayHelp() {
  const commandsList = [
    ['start', 'Démarrer le serveur'],
    ['stop', 'Arrêter le serveur'],
    ['restart', 'Redémarrer le serveur'],
    ['status', 'Afficher l\'état du serveur'],
    ['users', 'Afficher le nombre d\'utilisateurs connectés'],
    ['models', 'Afficher les modèles disponibles'],
    ['stats', 'Afficher les statistiques complètes'],
    ['clear', 'Effacer la zone de résultats'],
    ['help', 'Afficher cette aide'],
    ['exit', 'Quitter l\'application']
  ];

  const helpLines = [chalk.cyan('=== Commandes disponibles ===')];
  commandsList.forEach(([cmd, desc]) => {
    helpLines.push(`${chalk.green(cmd.padEnd(10))} - ${desc}`);
  });

  addOutput(helpLines);
}

// Affichage des statistiques
function displayStats() {
  if (serverStatus !== 'running') {
    addOutput(chalk.yellow('⚠️ Le serveur n\'est pas en cours d\'exécution.'));
    return;
  }

  const uptime = getUptime();

  const statsLines = [
    chalk.cyan('=== Statistiques du serveur ==='),
    `État: ${chalk.green('En cours d\'exécution')}`,
    `Temps d\'activité: ${uptime}`,
    `Utilisateurs connectés: ${chalk.yellow(connectedUsers.toString())}`,
    `Requêtes traitées: ${chalk.yellow(requestsCount.toString())}`,
    `Port: ${chalk.yellow(PORT.toString())}`,
    `CPU Usage: ${chalk.yellow(getCpuUsage())}%`,
    `Mémoire utilisée: ${chalk.yellow(getMemoryUsage())}`,
    `OS: ${chalk.yellow(os.type() + ' ' + os.release())}`
  ];

  addOutput(statsLines);
}

// Afficher la liste des modèles disponibles
async function displayModels() {
  if (serverStatus !== 'running') {
    addOutput(chalk.yellow('⚠️ Le serveur n\'est pas en cours d\'exécution.'));
    return;
  }

  try {
    currentRequest = 'Récupération des modèles';
    renderHeaderOnly();

    await fetchModels();
    currentRequest = null;
    renderHeaderOnly();

    if (availableModels.length === 0) {
      addOutput(chalk.yellow('Aucun modèle disponible.'));
      return;
    }

    const modelLines = [chalk.cyan('=== Modèles disponibles ===')];
    availableModels.forEach((model, index) => {
      modelLines.push(`${chalk.yellow((index + 1).toString().padStart(2))}. ${chalk.green(model)}`);
    });

    addOutput(modelLines);
  } catch (error) {
    addOutput(chalk.red(`Erreur lors de la récupération des modèles: ${error.message}`));
    currentRequest = null;
    renderHeaderOnly();
  }
}

// Récupérer les modèles disponibles
async function fetchModels() {
  try {
    const response = await axios.get(`${OLLAMA_API_BASE}/api/tags`);
    availableModels = response.data.models.map(model => model.name);
    return availableModels;
  } catch (error) {
    availableModels = [];
    throw error;
  }
}

// Calculer le temps d'activité
function getUptime() {
  if (!serverStartTime) return 'N/A';

  const uptime = Date.now() - serverStartTime;
  const seconds = Math.floor(uptime / 1000) % 60;
  const minutes = Math.floor(uptime / 1000 / 60) % 60;
  const hours = Math.floor(uptime / 1000 / 60 / 60);

  return `${hours}h ${minutes}m ${seconds}s`;
}

// Obtenir l'utilisation CPU
function getCpuUsage() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  }

  const usage = 100 - ((idle / total) * 100);
  return usage.toFixed(2);
}

// Obtenir l'utilisation mémoire
function getMemoryUsage() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const percentUsed = (usedMem / totalMem) * 100;

  return `${(usedMem / 1024 / 1024 / 1024).toFixed(2)} GB / ${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB (${percentUsed.toFixed(2)}%)`;
}

// Démarrer le serveur
function startServer() {
  if (serverStatus === 'running') {
    addOutput(chalk.yellow('⚠️ Le serveur est déjà en cours d\'exécution.'));
    return;
  }

  currentRequest = 'Démarrage du serveur';
  renderHeaderOnly();

  server.listen(PORT, async () => {
    serverStatus = 'running';
    serverStartTime = Date.now();
    startUpdateTimer();

    try {
      await fetchModels();
      addOutput([
        chalk.green(`✅ Serveur démarré sur http://localhost:${PORT}`),
        chalk.green('Vous pouvez ouvrir cette URL dans votre navigateur')
      ]);
      currentRequest = null;
      renderHeaderOnly();
    } catch (error) {
      addOutput(chalk.red(`Erreur de connexion à Ollama API: ${error.message}`));
      currentRequest = null;
      renderHeaderOnly();
    }
  });
}

// Arrêter le serveur
function stopServer() {
    if (serverStatus !== 'running') {
      addOutput(chalk.yellow('⚠️ Le serveur n\'est pas en cours d\'exécution.'));
      return;
    }
  
    currentRequest = 'Arrêt du serveur';
    renderHeaderOnly();
  
    // Émettre l'événement pour rediriger les clients
    io.emit('server_shutdown');
  
    // Attendre 2 secondes avant de fermer le serveur
    setTimeout(() => {
      server.close(() => {
        serverStatus = 'stopped';
        addOutput([
          chalk.red('❌ Serveur arrêté'),
          chalk.cyan(`Temps d'activité total: ${getUptime()}`),
          chalk.cyan(`Total des requêtes traitées: ${requestsCount}`)
        ]);
  
        serverStartTime = null;
        requestsCount = 0;
        connectedUsers = 0;
        currentRequest = null;
  
        if (updateTimer) {
          clearInterval(updateTimer);
          updateTimer = null;
        }
  
        renderHeaderOnly();
      });
  
      // Forcer la fermeture de toutes les connexions socket
      io.sockets.sockets.forEach(socket => {
        socket.disconnect(true);
      });
    }, 1000); // Délai de 2 secondes
  }


// Redémarrer le serveur
function restartServer() {
    if (serverStatus !== 'running') {
      addOutput(chalk.yellow('⚠️ Le serveur n\'est pas en cours d\'exécution.'));
      startServer();
      return;
    }
  
    currentRequest = 'Redémarrage du serveur';
    renderHeaderOnly();
  
    // Émettre l'événement pour rediriger les clients
    io.emit('server_restart');
  
    // Attendre 3 secondes avant de redémarrer le serveur
    setTimeout(() => {
      server.close(() => {
        serverStatus = 'stopped';
        serverStartTime = null;
        requestsCount = 0;
        connectedUsers = 0;
  
        addOutput(chalk.cyan('🔄 Serveur redémarré'));
        startServer();
      });
  
      // Forcer la fermeture de toutes les connexions socket
      io.sockets.sockets.forEach(socket => {
        socket.disconnect(true);
      });
    }, 3000); // Délai de 3 secondes
  }
  

// Gestion des connexions socket
io.on('connection', (socket) => {
  connectedUsers++;
  renderHeaderOnly();

  socket.on('disconnect', () => {
    connectedUsers--;
    renderHeaderOnly();
  });
});

// Route pour récupérer la liste des modèles
app.get('/api/models', async (req, res) => {
  requestsCount++;
  currentRequest = 'GET /api/models';
  renderHeaderOnly();

  try {
    await fetchModels();
    res.json({ models: availableModels });
    currentRequest = null;
    renderHeaderOnly();
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
    currentRequest = null;
    renderHeaderOnly();
  }
});

// Route pour le chat
app.post('/api/chat', async (req, res) => {
  requestsCount++;
  const model = req.body.model || 'inconnu';
  currentRequest = `POST /api/chat (modèle: ${model})`;
  renderHeaderOnly();

  try {
    const payload = req.body;
    const response = await axios.post(`${OLLAMA_API_BASE}/api/chat`, payload, {
      responseType: 'stream'
    });

    response.data.pipe(res);

    res.on('finish', () => {
      currentRequest = null;
      renderHeaderOnly();
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
    currentRequest = null;
    renderHeaderOnly();
  }
});

// Routes pour les pages HTML de redirection
app.get('/shutdown.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'redirect', 'shutdown.html'));
  });

app.get('/restart.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'redirect', 'restart.html'));
});

// Gestionnaire de commandes
rl.on('line', async (line) => {
  const command = line.trim();

  switch (command) {
    case 'start':
      startServer();
      break;
    case 'stop':
      stopServer();
      break;
    case 'restart':
      restartServer();
      break;
    case 'status':
      if (serverStatus === 'running') {
        addOutput(chalk.green(`✅ Le serveur est en cours d'exécution depuis ${getUptime()}`));
      } else {
        addOutput(chalk.red('❌ Le serveur est arrêté'));
      }
      break;
    case 'users':
      addOutput(chalk.cyan(`👥 Utilisateurs connectés: ${chalk.yellow(connectedUsers)}`));
      break;
    case 'models':
      await displayModels();
      break;
    case 'stats':
      displayStats();
      break;
    case 'clear':
      outputBuffer = [];
      renderOutputOnly();
      break;
    case 'help':
      displayHelp();
      break;
    case 'exit':
      if (serverStatus === 'running') {
        currentRequest = 'Arrêt avant de quitter';
        renderHeaderOnly();
        server.close(() => {
          console.clear();
          console.log(chalk.green('👋 Au revoir!'));
          process.exit(0);
        });
      } else {
        console.clear();
        console.log(chalk.green('👋 Au revoir!'));
        process.exit(0);
      }
      break;
    default:
      addOutput([
        chalk.red(`❌ Commande inconnue: ${command}`),
        chalk.yellow('Tapez "help" pour voir les commandes disponibles.')
      ]);
  }

  rl.prompt();
}).on('close', () => {
  if (updateTimer) {
    clearInterval(updateTimer);
  }
  console.clear();
  console.log(chalk.green('👋 Au revoir!'));
  process.exit(0);
});

// Initialisation
outputBuffer = [
  chalk.green('Bienvenue dans Ollama Server Console!'),
  chalk.yellow('Le serveur va démarrer automatiquement...'),
  chalk.cyan('Tapez "help" pour voir les commandes disponibles.')
];

// Afficher l'interface
renderScreen();

// Démarrer automatiquement le serveur
startServer();

// Export pour les tests
module.exports = { app, server };