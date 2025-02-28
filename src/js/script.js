document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    let conversation = [];
    let streaming = false;
    let currentController = null;
    const chatArea = document.getElementById('chatArea');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const resetBtn = document.getElementById('resetBtn');
    const modelBtn = document.getElementById('modelBtn');
    const modelPanel = document.getElementById('modelPanel');
    const stopContainer = document.getElementById('stopContainer');
    const stopBtn = document.getElementById('stopBtn');
    const initialLoader = document.getElementById('initialLoader');
    const welcomeLabel = document.getElementById('welcomeLabel');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const lightThemeBtn = document.getElementById('lightThemeBtn');
    const darkThemeBtn = document.getElementById('darkThemeBtn');
    const systemPrompt = document.getElementById('systemPrompt');
    const savePromptBtn = document.getElementById('savePromptBtn');
    const clearPromptBtn = document.getElementById('clearPromptBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const toastNotification = document.getElementById('toastNotification');
    const toastMessage = document.getElementById('toastMessage');
    let currentModel = '';
    let currentTheme = localStorage.getItem('theme') || 'dark';
    let systemPromptText = localStorage.getItem('systemPrompt') || '';
    
    // Appliquer le thème sauvegardé
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeButtons();
    
    // Charger le prompt système sauvegardé
    systemPrompt.value = systemPromptText;
    
    // Simuler un chargement initial avec étapes
    simulateLoading();
    
    function simulateLoading() {
        const loaderSteps = document.querySelectorAll('.loader-step');
        let currentStep = 0;
        
        const interval = setInterval(() => {
            if (currentStep > 0) {
                loaderSteps[currentStep - 1].classList.remove('active');
            }
            
            loaderSteps[currentStep].classList.add('active');
            currentStep++;
            
            if (currentStep >= loaderSteps.length) {
                clearInterval(interval);
                setTimeout(() => {
                    initialLoader.style.display = 'none';
                }, 800);
            }
        }, 800);
    }

    // Auto-resize pour le textarea
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.scrollHeight > 150) {
            this.style.overflowY = 'auto';
        } else {
            this.style.overflowY = 'hidden';
        }
    });
    
    // Gestion du hover pour les actions des messages
    document.addEventListener('mouseover', function(e) {
        const message = e.target.closest('.message.assistant');
        if (message) {
            message.classList.add('action-visible');
            clearTimeout(message.dataset.actionTimeout);
        }
    });
    
    document.addEventListener('mouseout', function(e) {
        const message = e.target.closest('.message.assistant');
        if (message) {
            const timeout = setTimeout(() => {
                message.classList.remove('action-visible');
            }, 1000); // Reste visible 1 seconde après que la souris quitte
            message.dataset.actionTimeout = timeout;
        }
    });
    
    // Ouvrir/fermer le panneau des paramètres
    settingsBtn.addEventListener('click', () => {
        settingsPanel.classList.add('open');
    });
    
    closeSettingsBtn.addEventListener('click', () => {
        settingsPanel.classList.remove('open');
    });
    
    // Fermer le panneau des paramètres en cliquant en dehors
    document.addEventListener('click', (e) => {
        if (settingsPanel.classList.contains('open') && 
            !settingsPanel.contains(e.target) && 
            !settingsBtn.contains(e.target)) {
            settingsPanel.classList.remove('open');
        }
    });
    
    // Changement de thème
    lightThemeBtn.addEventListener('click', () => {
        setTheme('light');
    });
    
    darkThemeBtn.addEventListener('click', () => {
        setTheme('dark');
    });
    
    function setTheme(theme) {
        currentTheme = theme;
        document.documentElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem('theme', currentTheme);
        updateThemeButtons();
        showToast(`Thème ${currentTheme === 'dark' ? 'sombre' : 'clair'} activé`);
    }
    
    function updateThemeButtons() {
        if (currentTheme === 'dark') {
            darkThemeBtn.classList.add('active');
            lightThemeBtn.classList.remove('active');
        } else {
            lightThemeBtn.classList.add('active');
            darkThemeBtn.classList.remove('active');
        }
    }
    
    // Gestion du prompt système
    savePromptBtn.addEventListener('click', () => {
        systemPromptText = systemPrompt.value.trim();
        localStorage.setItem('systemPrompt', systemPromptText);
        showToast("Prompt système enregistré");
        settingsPanel.classList.remove('open');
    });
    
    clearPromptBtn.addEventListener('click', () => {
        systemPrompt.value = '';
        systemPromptText = '';
        localStorage.setItem('systemPrompt', '');
        showToast("Prompt système effacé");
    });
    
    // Fonction pour afficher une notification toast
    function showToast(message, duration = 3000) {
        toastMessage.textContent = message;
        toastNotification.classList.add('show');
        
        setTimeout(() => {
            toastNotification.classList.remove('show');
        }, duration);
    }
    
    // Simuler l'upload de fichier
    uploadBtn.addEventListener('click', () => {
        showToast("Fonctionnalité d'upload en développement");
    });

    // Charger la liste des modèles depuis l'API
    function loadModels() {
        fetch('/api/models')
            .then(res => res.json())
            .then(data => {
                modelPanel.innerHTML = '';
                data.models.forEach((m, index) => {
                    const div = document.createElement('div');
                    div.textContent = m;
                    div.style.animationDelay = `${index * 0.05}s`; // Animation staggered
                    div.addEventListener('click', () => {
                        currentModel = m;
                        const modelName = document.querySelector('.model-name');
                        modelName.textContent = m;
                        modelPanel.style.display = 'none';
                        showToast(`Modèle ${m} sélectionné`);
                    });
                    modelPanel.appendChild(div);
                });
                // Sélection par défaut du premier modèle
                if(data.models.length > 0) {
                    currentModel = data.models[0];
                    const modelName = document.querySelector('.model-name');
                    modelName.textContent = currentModel;
                } else {
                    const modelName = document.querySelector('.model-name');
                    modelName.textContent = 'Aucun modèle';
                }
            })
            .catch(err => {
                console.error('Erreur chargement modèles:', err);
                const modelName = document.querySelector('.model-name');
                modelName.textContent = 'Erreur';
                showToast("Erreur lors du chargement des modèles");
            });
    }
    loadModels();

    // Afficher/masquer le panneau de modèles
    modelBtn.addEventListener('click', () => {
        modelPanel.style.display = (modelPanel.style.display === 'block') ? 'none' : 'block';
    });

    // Fermer le panneau de modèles en cliquant ailleurs
    document.addEventListener('click', (e) => {
        if (modelPanel.style.display === 'block' && !modelBtn.contains(e.target) && !modelPanel.contains(e.target)) {
            modelPanel.style.display = 'none';
        }
    });

    // Réinitialiser la conversation
    resetBtn.addEventListener('click', () => {
        // Animation de suppression
        const messages = document.querySelectorAll('.message');
        messages.forEach((msg, index) => {
            setTimeout(() => {
                msg.style.opacity = '0';
                msg.style.transform = 'translateY(-10px)';
            }, index * 50);
        });

        setTimeout(() => {
            conversation = [];
            chatArea.innerHTML = '';
            // Réafficher le welcome label
            welcomeLabel.style.display = 'flex';
            showToast("Conversation réinitialisée");
        }, messages.length * 50 + 100);
    });

    // Envoi du message via la touche Entrée
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Bouton d'envoi
    sendBtn.addEventListener('click', () => {
        if (!streaming) {
            sendMessage();
        }
    });

    // Bouton Stop pour interrompre l'IA
    stopBtn.addEventListener('click', () => {
        if(currentController) {
            currentController.abort();
            streaming = false;
            stopContainer.style.display = 'none';
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            
            // Ajouter les actions au dernier message même s'il est incomplet
            const lastMessage = chatArea.querySelector('.message.assistant:last-child');
            if (lastMessage && !lastMessage.querySelector('.message-actions')) {
                addMessageActions(lastMessage, true);
            }
            
            showToast("Génération interrompue");
        }
    });

    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;
        
        // Masquer le welcome label au premier message
        if (welcomeLabel.style.display !== 'none') {
            welcomeLabel.style.display = 'none';
        }
        
        // Masquer tous les boutons "Régénérer" précédents
        const messageActions = document.querySelectorAll('.message-actions');
        messageActions.forEach(actions => {
            actions.style.display = 'none';
        });
        
        appendMessage('user', text);
        
        // Préparer la conversation avec le prompt système si défini
        if (conversation.length === 0 && systemPromptText) {
            conversation.push({ role: 'system', content: systemPromptText });
        }
        
        conversation.push({ role: 'user', content: text });
        chatInput.value = '';
        chatInput.style.height = 'auto';
        
        // Ajouter un indicateur de frappe
        addTypingIndicator();
        
        sendToAPI();
    }

    // Ajouter un indicateur de frappe
    function addTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.classList.add('typing-indicator');
        typingDiv.id = 'typingIndicator';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.classList.add('typing-dot');
            typingDiv.appendChild(dot);
        }
        
        chatArea.appendChild(typingDiv);
        chatArea.scrollTop = chatArea.scrollHeight;
    }
    
    // Supprimer l'indicateur de frappe
    function removeTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    // Utilisation de marked pour convertir le Markdown
    function renderMarkdown(text) {
        // Configuration de marked pour préserver les retours à la ligne
        marked.setOptions({
            breaks: true
        });
        return marked.parse(text);
    }

    // Ajoute un message à l'affichage du chat
    function appendMessage(role, text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role);
        
        // Pour le Markdown, on insère le HTML rendu
        messageDiv.innerHTML = renderMarkdown(text);
        
        // Supprimer l'indicateur de frappe s'il existe
        removeTypingIndicator();
        
        chatArea.appendChild(messageDiv);
        chatArea.scrollTop = chatArea.scrollHeight;
        
        // Pour les messages assistant, ajouter les actions (régénérer, copier et stats)
        if (role === 'assistant') {
            addMessageActions(messageDiv);
        }
    }
    
    // Ajouter les actions aux messages de l'assistant
    function addMessageActions(messageDiv, isInterrupted = false) {
        // Créer le conteneur d'actions s'il n'existe pas déjà
        if (!messageDiv.querySelector('.message-actions')) {
            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('message-actions');
            
            // Bouton régénérer
            const regenBtn = document.createElement('button');
            regenBtn.classList.add('action-btn', 'regenerate-btn');
            regenBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            regenBtn.setAttribute('data-tooltip', 'Régénérer');
            regenBtn.addEventListener('click', () => {
                chatArea.removeChild(messageDiv);
                // Retirer le dernier message assistant dans la conversation
                for (let i = conversation.length - 1; i >= 0; i--) {
                    if (conversation[i].role === 'assistant') {
                        conversation.splice(i, 1);
                        break;
                    }
                }
                // Ajouter un indicateur de frappe
                addTypingIndicator();
                sendToAPI();
            });
            
            actionsDiv.appendChild(regenBtn);
            
            // Bouton copier
            const copyBtn = document.createElement('button');
            copyBtn.classList.add('action-btn', 'copy-btn');
            copyBtn.innerHTML = '<i class="far fa-copy"></i>';
            copyBtn.setAttribute('data-tooltip', 'Copier');
            copyBtn.addEventListener('click', () => {
                // Extraire le texte du message
                const textToCopy = messageDiv.innerText;
                copyToClipboard(textToCopy);
                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="far fa-copy"></i>';
                    copyBtn.classList.remove('copied');
                }, 2000);
            });
            
            actionsDiv.appendChild(copyBtn);
            
            // Bouton statistiques (si des stats sont disponibles ou si c'est un message interrompu)
            if (messageDiv.dataset.responseTime || messageDiv.dataset.tokens || isInterrupted) {
                const statsBtn = document.createElement('button');
                statsBtn.classList.add('action-btn', 'stats-btn');
                statsBtn.innerHTML = '<i class="fas fa-chart-bar"></i>';
                
                // Tooltip pour les statistiques
                const statsTooltip = document.createElement('div');
                statsTooltip.classList.add('stats-tooltip');
                
                // Titre du tooltip
                const statsHeader = document.createElement('div');
                statsHeader.classList.add('stats-tooltip-header');
                statsHeader.textContent = 'Statistiques';
                statsTooltip.appendChild(statsHeader);
                
                // Ajouter les statistiques
                const statsItems = [
                    { 
                        label: 'Temps de réponse', 
                        value: messageDiv.dataset.responseTime ? messageDiv.dataset.responseTime + ' s' : isInterrupted ? 'Interrompu' : 'N/A' 
                    },
                    { 
                        label: 'Tokens générés', 
                        value: messageDiv.dataset.tokens || (isInterrupted ? 'Partiel' : 'N/A') 
                    },
                    { 
                        label: 'Tokens/seconde', 
                        value: messageDiv.dataset.tokensPerSecond ? messageDiv.dataset.tokensPerSecond + ' t/s' : 'N/A' 
                    },
                    {
                        label: 'Statut',
                        value: isInterrupted ? 'Interrompu' : 'Complété'
                    }
                ];
                
                statsItems.forEach(item => {
                    const statsItem = document.createElement('div');
                    statsItem.classList.add('stats-item');
                    
                    const statsLabel = document.createElement('span');
                    statsLabel.classList.add('stats-label');
                    statsLabel.textContent = item.label + ':';
                    
                    const statsValue = document.createElement('span');
                    statsValue.classList.add('stats-value');
                    statsValue.textContent = item.value;
                    
                    statsItem.appendChild(statsLabel);
                    statsItem.appendChild(statsValue);
                    statsTooltip.appendChild(statsItem);
                });
                
                statsBtn.appendChild(statsTooltip);
                actionsDiv.appendChild(statsBtn);
            }
            
            messageDiv.appendChild(actionsDiv);
        }
    }
    
    // Copier du texte dans le presse-papier
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text)
            .then(() => {
                showToast("Texte copié dans le presse-papier");
            })
            .catch(err => {
                console.error('Erreur lors de la copie:', err);
                showToast("Impossible de copier le texte");
            });
    }

    // Mettre à jour les boutons "Régénérer" (ne garder que le dernier)
    function updateRegenerateButtons() {
        const messageActions = document.querySelectorAll('.message-actions');
        if (messageActions.length > 1) {
            for (let i = 0; i < messageActions.length - 1; i++) {
                messageActions[i].style.display = 'none';
            }
        }
    }

    function sendToAPI() {
        streaming = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        stopContainer.style.display = 'flex';
        const payload = { model: currentModel, messages: conversation, stream: true };
        currentController = new AbortController();
        
        // Variables pour les statistiques
        const startTime = new Date();
        let tokenCount = 0;
        
        fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: currentController.signal
        })
        .then(response => {
            if (!response.ok) throw new Error("Erreur du serveur");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMsg = '';
            
            // Supprimer l'indicateur de frappe
            removeTypingIndicator();
            
            // Créer le conteneur pour le message de l'IA
            let assistantDiv = document.createElement('div');
            assistantDiv.classList.add('message', 'assistant');
            chatArea.appendChild(assistantDiv);
            chatArea.scrollTop = chatArea.scrollHeight;
        
            function read() {
                return reader.read().then(({ done, value }) => {
                    if (done) {
                        streaming = false;
                        stopContainer.style.display = 'none';
                        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
                        conversation.push({ role: 'assistant', content: assistantMsg });
                        
                        // Calculer les statistiques
                        const endTime = new Date();
                        const responseTime = ((endTime - startTime) / 1000).toFixed(2);
                        const tokensPerSecond = tokenCount > 0 ? Math.round(tokenCount / (responseTime)) : 0;
                        
                        // Ajouter les statistiques au message
                        assistantDiv.dataset.responseTime = responseTime;
                        assistantDiv.dataset.tokens = tokenCount;
                        assistantDiv.dataset.tokensPerSecond = tokensPerSecond;
                        
                        // Ajouter les actions après la fin du streaming
                        addMessageActions(assistantDiv);
                        
                        // Mettre à jour les boutons "Régénérer"
                        updateRegenerateButtons();
                        return;
                    }
                    
                    let chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n').filter(line => line.trim() !== '');
                    
                    lines.forEach(line => {
                        try {
                            const data = JSON.parse(line);
                            if (data.message && data.message.content) {
                                assistantMsg += data.message.content;
                                assistantDiv.innerHTML = renderMarkdown(assistantMsg);
                                
                                // Incrémenter le compteur de tokens (estimation)
                                tokenCount += data.message.content.split(/\s+/).length;
                                
                                chatArea.scrollTop = chatArea.scrollHeight;
                            }
                        } catch (e) {
                            console.error('Erreur de parsing du chunk', e);
                        }
                    });
                    
                    return read();
                });
            }
            
            return read();
        })
        .catch(err => {
            console.error('Erreur:', err);
            streaming = false;
            stopContainer.style.display = 'none';
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            
            // Supprimer l'indicateur de frappe
            removeTypingIndicator();
            
            if (err.name !== 'AbortError') {
                appendMessage('system', 'Une erreur est survenue lors de la communication avec le serveur.');
                showToast("Erreur de communication avec le serveur");
            }
        });
    }
});