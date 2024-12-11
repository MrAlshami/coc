let socket = null;
let gameSessionId = 0;

function getUsername() {
    return sessionStorage.getItem("username");;
}

function setUsername(username) {
    sessionStorage.setItem("username", username);
}

function postJSON(url, obj) {
    return fetch(url, { 
        method: "POST", 
        body: JSON.stringify(obj),
        headers: {
            "Content-Type": "application/json",
        }
    });
}

function isLoggedIn() {
    return sessionStorage.getItem("username") != null;
}

function hideInvitePopup() {
    const invitePopup = document.querySelector(".invite_popup");
    invitePopup.style.display = "none";
}

function rejectInvite() {
    const response = {
        type: "INVITE_REJECTED",
        sessionId: gameSessionId,
    }
    socket.send(JSON.stringify(response));

    const invitePopup = document.querySelector(".invite_request_popup");
    invitePopup.style.display = "none";
}

function acceptInvite() {
    const response = {
        type: "INVITE_OK",
        sessionId: gameSessionId,
    }
    socket.send(JSON.stringify(response));

    const invitePopup = document.querySelector(".invite_request_popup");
    invitePopup.style.display = "none";
}

function invitePlayer(playerToInvite) {
    const invitePopup = document.querySelector(".invite_popup");
    invitePopup.style.display = "block";

    const gameRequest = {
        type: "START_SESSION",
        from: getUsername(),
        to: playerToInvite,
    }
    socket.send(JSON.stringify(gameRequest));
}

function selectCardAttribute(attribute) {
    console.log(attribute);
    const request = {
        type: "SELECT_ATTRIBUTE",
        sessionId: gameSessionId,
        attribute,
    }
    socket.send(JSON.stringify(request));
}

function nextRound(card, isMyTurn) {
    const msgMyTurn = document.querySelector(".message_my_turn");
    const msgOtherTurn = document.querySelector(".message_other_turn");

    if (isMyTurn) {
        msgMyTurn.style.display = "block";
        msgOtherTurn.style.display = "none";
    } else {
        msgMyTurn.style.display = "none";
        msgOtherTurn.style.display = "block";
    }

    const cardContainer = document.querySelector(".current_card");

    const cardElement = createCardElement(card, isMyTurn, selectCardAttribute);

    cardContainer.innerHTML = "";
    cardContainer.appendChild(cardElement);
}

function hideGameCanceledPopup() {
    const gameCanceledPopup = document.querySelector(".game_canceled_popup");
    gameCanceledPopup.style.display = "none";
}

function hideInviteRejectedPopup() {
    const inviteRejectedPopup = document.querySelector(".invite_reject_popup");
    inviteRejectedPopup.style.display = "none";
}

function hideGameResultPopup() {
    const gameResultPopup = document.querySelector(".game_result_popup");
    gameResultPopup.style.display = "none";
}

function hideRoundResultPopup() {
    const gameResultPopup = document.querySelector(".round_result_popup");
    gameResultPopup.style.display = "none";
}

function showGameResultPopup(isWinner) {
    const gameResultPopup = document.querySelector(".game_result_popup");
    gameResultPopup.style.display = "block";

    const resultMsg = document.querySelector(".game_result_msg");
    if (isWinner) {
        resultMsg.textContent = "YOU WON! 🎉";
    } else {
        resultMsg.textContent = "YOU LOST...!";
    }
}

function showRoundResultPopup(isWinner) {
    const gameResultPopup = document.querySelector(".round_result_popup");
    gameResultPopup.style.display = "block";

    const resultMsg = document.querySelector(".round_result_msg");
    if (isWinner) {
        resultMsg.textContent = "Your card wins 🎉 and you will receive your opponents card";
    } else {
        resultMsg.textContent = "Your card lost and will be handed over to opponents oponent...";
    }

    setTimeout(() => hideRoundResultPopup(), 3000);
}

function serverMessageHandler(event) {
    console.log("Server msg: ", event.data);

    const request = JSON.parse(event.data);
    if (request.type === "INVITE_REQUEST") {
        gameSessionId = request.sessionId;

        const invitePopup = document.querySelector(".invite_request_popup");
        invitePopup.style.display = "block";

        const playerName = document.querySelector(".invite_request_player_name");
        playerName.textContent = request.playerName;

    } else if (request.type == "INVITE_OK") {
        console.log(`Invitation accepted start session: ${request.sessionId}`);
        gameSessionId = request.sessionId;
        hideInvitePopup();
        showPage(PAGE.game);
        nextRound(request.card, request.turn);

    } else if (request.type == "INVITE_REJECTED") {
        hideInvitePopup();

        const inviteRejectedPopup = document.querySelector(".invite_reject_popup");
        inviteRejectedPopup.style.display = "block";

    } else if (request.type == "GAME_CANCELED") {
        showPlayerSelection();

        const gameCanceledPopup = document.querySelector(".game_canceled_popup");
        gameCanceledPopup.style.display = "block";

    } else if (request.type == "ROUND_RESULTS") {
        const myTurn = request.winningPlayerId == getUsername();

        if (request.gameOver) {
            if (myTurn) {
                showGameResultPopup(true);
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 },
                });
            } else {
                showGameResultPopup(false);
            }
            showCollection();

        } else {
            const nextCard = request.cards[getUsername()];
            showRoundResultPopup(myTurn);
            nextRound(nextCard, myTurn);
        }
    }
}

const pages = new Map();
const PAGE = { login: 0, playerList: 1, game: 2, collection: 3, scan: 4 }

function showPage(pageId) {
    for (const page of pages.values()) {
        page.style.display = "none";
    }
    pages.get(pageId).style.display = "block";

    const collectionButton = document.querySelector(".collection_button");
    const playersButton = document.querySelector(".players_button");
    const scanButton = document.querySelector(".scan_button");

    if (pageId === PAGE.collection) {
        collectionButton.classList.add("navbar_button_active");
        playersButton.classList.remove("navbar_button_active");
        scanButton.classList.remove("navbar_button_active");
        
    } else if (pageId === PAGE.playerList) {
        collectionButton.classList.remove("navbar_button_active");
        playersButton.classList.add("navbar_button_active");
        scanButton.classList.remove("navbar_button_active");
        
    } else if (pageId === PAGE.scan) {
        scanButton.classList.add("navbar_button_active");
        playersButton.classList.remove("navbar_button_active");
        collectionButton.classList.remove("navbar_button_active");

    } else {

    }
}

async function showPlayerSelection() {
    showPage(PAGE.playerList);

    const playerResponse = await fetch("/api/players");
    const playerData = await playerResponse.json();

    const playerList = document.querySelector(".player_list");
    playerList.innerHTML = "";

    for (const player of playerData.players) {
        if (player.username === getUsername()) {
            continue;
        }

        const playerElement = document.querySelector(".player_item_template").content.cloneNode(true);
        playerElement.querySelector(".player_name").textContent = player.username;
        playerElement.querySelector(".invite_button").addEventListener("click", () => {
            invitePlayer(player.username);
        });

        playerList.appendChild(playerElement);
    }
}

function createCardElement(cardData, isSelectable, callback) {
    const cardElement = document.querySelector(".card_template").content.cloneNode(true);
        
    cardElement.querySelector(".card_image").src = `/res/${cardData.image}`;
    cardElement.querySelector(".card_name").textContent = cardData.name;

    const attr0 = cardElement.querySelector(".card_attr0");
    const attr1 = cardElement.querySelector(".card_attr1");
    const attr2 = cardElement.querySelector(".card_attr2");
    const attr3 = cardElement.querySelector(".card_attr3");

    attr0.textContent = cardData.strength;
    attr1.textContent = cardData.speed;
    attr2.textContent = cardData.size;
    attr3.textContent = cardData.endurance;

    if (isSelectable) {
        const btn0 = cardElement.querySelector(".card_attr_btn_0");
        const btn1 = cardElement.querySelector(".card_attr_btn_1");
        const btn2 = cardElement.querySelector(".card_attr_btn_2");
        const btn3 = cardElement.querySelector(".card_attr_btn_3");

        btn0.addEventListener("click", () => callback("strength"));
        btn1.addEventListener("click", () => callback("speed"));
        btn2.addEventListener("click", () => callback("size"));
        btn3.addEventListener("click", () => callback("endurance"));

        btn0.removeAttribute("disabled");
        btn1.removeAttribute("disabled");
        btn2.removeAttribute("disabled");
        btn3.removeAttribute("disabled");
    }

    return cardElement;
}

async function showCollection() {
    showPage(PAGE.collection);

    const collectionResponse = await fetch(`/api/collection/${getUsername()}`);
    const collectionJSON = await collectionResponse.json();

    const collectionContainer = document.querySelector(".card_collection");
    collectionContainer.innerHTML = "";

    for (const card of collectionJSON.cards) {
        const cardElement = createCardElement(card, false, null);
        collectionContainer.appendChild(cardElement);
    }
}

function onCollectionNavClick() {
    showCollection();
}

function onPlayerNavClick() {
    showPlayerSelection();
}

function showScanError() {
    window.confirm("Error while reading NFC Card, try again.");
}

function onScanNewCard() {
    const scanSpinner = document.querySelector(".scan_spinner");
    scanSpinner.style.display = "flex";

    const cardDisplay = document.querySelector(".new_card");
    cardDisplay.innerHTML = "";

    const scanButton = document.querySelector(".scan_next_button");
    scanButton.style.display = "none";

    scanCard();
}

async function scanCard() {
    const output = document.querySelector(".output");
    output.textContent = JSON.stringify({ lol: 2 });

    try {
        const ndef = new NDEFReader();
        await ndef.scan();
        console.log("Scanning...");

        ndef.addEventListener("readingerror", () => {
            console.error("NFC readingerror");
            showScanError();
        });

        ndef.addEventListener("reading", async ({ message, serialNumber }) => {
            output.textContent = JSON.stringify(message);
            output.textContent = serialNumber;
            output.textContent = message.records[0].data;
            console.log(message);

            const scanedCardResponse = await postJSON("/api/scancard/", {
                username: getUsername(),
                cardId: message,
            });
            const scanResponse = await scanedCardResponse.json();
            if (!scanResponse.scanOk) {
                showScanError();
            }
        
            const cardDisplay = document.querySelector(".new_card");
            cardDisplay.innerHTML = "";
        
            const cardElement = createCardElement(scanResponse.card, false, null);
            cardDisplay.appendChild(cardElement);
        
            const scanSpinner = document.querySelector(".scan_spinner");
            scanSpinner.style.display = "none";

            const scanButton = document.querySelector(".scan_next_button");
            scanButton.style.display = "block";
        });

    } catch (error) {
        console.error(error);
        showScanError();
    }
}

async function showScanPage() {
    showPage(PAGE.scan);
    scanCard();
}

function onScanCardClick() {
    showScanPage();
}

function connectWebsocket() {
    socket = new WebSocket(`ws://localhost:2001/gamesession/${getUsername()}`);
    socket.addEventListener("open", () => { console.log("Websocket open") });
    socket.addEventListener("message", serverMessageHandler);
}

function onCancelGameClick() {
    const request = {
        type: "GAME_CANCELED",
        sessionId: gameSessionId,
    }
    socket.send(JSON.stringify(request));
}

document.addEventListener("DOMContentLoaded", async () => {
    pages.set(PAGE.login, document.querySelector(".page_login"));
    pages.set(PAGE.playerList, document.querySelector(".page_players"));
    pages.set(PAGE.game, document.querySelector(".page_game"));
    pages.set(PAGE.collection, document.querySelector(".page_collection"));
    pages.set(PAGE.scan, document.querySelector(".page_scan"));

    const loginForm = document.querySelector(".login_form");
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(loginForm);

        const loginRequest = {
            username: formData.get("username"),
            password: formData.get("password"),
        }

        const loginResponse = await postJSON("/api/login", loginRequest);
        const responseData = await loginResponse.json();
        if (responseData.successful) {
            setUsername(loginRequest.username);
            showCollection();
            connectWebsocket();
        } else {
            window.alert("Invalid username or password!");
        }
    })

    if (!isLoggedIn()) {
        return;
    }

    console.log(`Logged in as ID: ${getUsername()}`);

    connectWebsocket();
    showCollection();
});