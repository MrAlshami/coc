const express = require('express')
const path = require('path');
const app = express()
var expressWs = require('express-ws')(app);
const bodyParser = require('body-parser')
const port = 2001

const cardModel = new Map();
const playerModel = new Map();
const sessionModel = new Map();

let sessionIdCounter = 1000;

function generateSessionId() {
    return sessionIdCounter++;
}

/* Randomize array in-place using Durstenfeld shuffle algorithm */
function shuffleArray(array) {
    for (var i = array.length - 1; i >= 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

function getRandomGameCardStack(username) {
    const cardStack = [];
    const { collection } = playerModel.get(username);
    for (const cardId of collection) {
        cardStack.push(Object.assign({}, cardModel.get(cardId)));
    }

    shuffleArray(cardStack);
    return cardStack;
}

(function main() {
    cardModel.set("95M7", { id: "95M7", name: "Shiba", image: "shiba.jpg", strength: 10, speed: 100, size: 1, endurance: 7 });
    cardModel.set("805E", { id: "805E", name: "Lurchus", image: "lurchus.jpg", strength: 100, speed: 9, size: 5, endurance: 8 });
    cardModel.set("80C7", { id: "80C7", name: "Frosti", image: "frosti.jpg", strength: 70, speed: 8, size: 100, endurance: 2 });
    cardModel.set("151Q", { id: "151Q", name: "Foxi", image: "foxi.jpg", strength: 40, speed: 1, size: 4, endurance: 100 });
    cardModel.set("1A2B", { id: "1A2B", name: "Bulli", image: "bulli.jpg", strength: 100, speed: 100, size: 100, endurance: 100 });

    playerModel.set("Michel", { username: "Michel", password: "1234", websocketConnection: null, collection: [ "95M7", "805E" ] });
    playerModel.set("Besi", { username: "Besi", password: "1234", websocketConnection: null, collection: [ "80C7" ] });
    playerModel.set("Shamess", { username: "Shamess", password: "1234", websocketConnection: null, collection: [ "151Q" ] });
})();

const SERVER_ROOT = path.join(__dirname, "../public");
app.use(express.static(SERVER_ROOT));
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.get('/api/collection/:username', (req, res) => {
    const username = req.params.username;
    collectionData = { cards: [] };

    if (playerModel.has(username)) {
        const player = playerModel.get(username);
        for (const cardId of player.collection) {
            const card = cardModel.get(cardId);
            collectionData.cards.push(card);
        }
    }

    res.send(JSON.stringify(collectionData));
})

app.post('/api/login', (req, res) => {
    const response = {  
        successful: false,
    }

    const { username, password } = req.body;

    if (playerModel.has(username)) {
        const player = playerModel.get(username);
        if (player.password === password) {
            response.successful = true;
        }
    }
    res.send(JSON.stringify(response));
})

app.get('/api/players', (req, res) => {
    let response = {
        players: [],
    }

    for (const player of playerModel.values()) {
        response.players.push({ username: player.username });
    }
    res.send(JSON.stringify(response));
})

app.post('/api/scancard', (req, res) => {
    const { cardId, username } = req.body;

    const response = {  
        scanOk: false,
        card: null,
    }

    const player = playerModel.get(username);
    if (!player.collection.includes(cardId) && cardModel.has(cardId)) {
        player.collection.push(cardId);

        response.scanOk = true;
        response.card = cardModel.get(cardId);
    }

    res.send(JSON.stringify(response));
});

function nextRound(session, messageType) {
    {
        const response = {
            type: messageType,
            sessionId: session.sessionId,
            turn: session.activePlayerId === session.playerA.id,
            card: session.playerA.cardDeck[0],
        }
        session.playerA.websocket.send(JSON.stringify(response));
    }
    {
        const response = {
            type: messageType,
            sessionId: session.sessionId,
            turn: session.activePlayerId === session.playerB.id,
            card: session.playerB.cardDeck[0],
        }
        session.playerB.websocket.send(JSON.stringify(response));
    }
}

app.ws('/gamesession/:username', function(ws, req) {
    const username = req.params.username;
    playerModel.get(username).websocketConnection = ws;
    console.log(`Websocket connection from player ${username}`);

    ws.on('message', function(msg) {
        const request = JSON.parse(msg);
        console.log(`Websocket msg from ${username}: ${msg}`);

        const messageType = request.type;
        if (messageType === "START_SESSION") {
            const playerToInvite = request.to;
            const player = playerModel.get(playerToInvite);

            if (player.websocketConnection) {
                const sessionId = generateSessionId();

                const newSession = {
                    sessionId: sessionId,
                    fromPlayerId: username,
                    toPlayerId: playerToInvite,
                    playerA: {
                        id: username,
                        cardDeck: getRandomGameCardStack(username),
                        websocket: ws,
                    },
                    playerB: {
                        id: playerToInvite,
                        cardDeck: getRandomGameCardStack(playerToInvite),
                        websocket: player.websocketConnection,
                    },
                    activePlayerId: username,
                }

                sessionModel.set(sessionId, newSession);
                console.log(`Create session ${newSession.sessionId}`);

                const response = {
                    type: "INVITE_REQUEST",
                    from: username,
                    playerName: player.name,
                    sessionId: sessionId,
                }
                console.log(response);
                player.websocketConnection.send(JSON.stringify(response));
            }

        } else if (messageType === "INVITE_OK") {
            const session = sessionModel.get(request.sessionId);
            nextRound(session, "INVITE_OK");

        } else if (messageType === "INVITE_REJECTED") {
            const session = sessionModel.get(request.sessionId);
            const invitingPlayer = session.playerA;

            const response = { type: "INVITE_REJECTED" };
            invitingPlayer.websocket.send(JSON.stringify(response));

        } else if (messageType === "GAME_CANCELED") {
            const session = sessionModel.get(request.sessionId);
            sessionModel.delete(request.sessionId);

            const response = { type: "GAME_CANCELED" };
            session.playerA.websocket.send(JSON.stringify(response));
            session.playerB.websocket.send(JSON.stringify(response));
            
        } else if (messageType === "SELECT_ATTRIBUTE") {
            const session = sessionModel.get(request.sessionId);
            let activePlayer = session.playerA;
            let passivePlayer = session.playerB;
            if (session.activePlayerId === session.playerB.id) {
                activePlayer = session.playerB;
                passivePlayer = session.playerA;
            }

            const cardA = activePlayer.cardDeck.shift();
            const cardB = passivePlayer.cardDeck.shift();
            const hasActiveWon = cardA[request.attribute] >= cardB[request.attribute];

            if (hasActiveWon) {
                console.log("Active player won");
            } else {
                console.log("Passive player won");
            }

            const winningPlayer = hasActiveWon ? activePlayer : passivePlayer;
            winningPlayer.cardDeck.push(cardA);
            winningPlayer.cardDeck.push(cardB);

            const isGameOver = activePlayer.cardDeck.length === 0 || passivePlayer.cardDeck.length === 0;
            activePlayer.activePlayerId = winningPlayer.id;

            const response = {
                type: "ROUND_RESULTS",
                sessionId: session.sessionId,
                winningPlayerId: winningPlayer.id,
                gameOver: isGameOver,
                cards: {
                    [activePlayer.id]: activePlayer.cardDeck[0],
                    [passivePlayer.id]: passivePlayer.cardDeck[0],
                }
            }
            session.playerA.websocket.send(JSON.stringify(response));
            session.playerB.websocket.send(JSON.stringify(response));
        }
    });
});


app.listen(port, () => {
    console.log(`Server listening on port ${port}`)
})