async function rpc(method, params = {}, cookie = "") {
    const response = await fetch("/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(cookie && { Cookie: cookie }),
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: "1",
            method,
            params,
        }),
    });

    //console.log(JSON.stringify({
    //    jsonrpc: "2.0",
    //    id: "1",
    //    method,
    //    params,
    //}, null, 2));

    const data = await response.json();

    if (data.error) throw new Error(`RPC Error ${data.error.code}: ${data.error.message}`);

    return { result: data.result, cookie: response.headers.get("set-cookie") };
}

async function main() {
    // 1. Authenticate
    let auth = await authenticate();

    // 2. Get classes
    //const { result: klassen } = await rpc("getRooms", {}, `JSESSIONID=${auth.sessionId}`);
    //console.log("Classes:", klassen);

    let klassen = [];
    let klassenName = [];
    let rooms = {}; // id = {name, longname}
    let roomIDs = [];

    let klassenRpc = JSON.parse(JSON.stringify(await getKlassen(auth), null, 2)).result;

    for (let i = 0; i < klassenRpc.length; i++) {
        klassen.push(klassenRpc[i].id);
        klassenName.push(klassenRpc[i].name);
    }

    let roomsRpc = JSON.parse(JSON.stringify(await getRooms(auth), null, 2)).result;
    for (let i = 0; i < roomsRpc.length; i++) {
        let room = {
            id: roomsRpc[i].id,
            name: roomsRpc[i].name,
            longName: roomsRpc[i].longName
        }
        rooms[room.id] = room;
        roomIDs.push(room.id);
    }
    //console.log(rooms);

    // format day in YYYYMMDD
    const today = new Date();
    const formattedDate = today.toISOString().slice(0, 10).replace(/\-/g, "");

    console.log(formattedDate);

    for (let i = 0; i < klassen.length; i++) {
        let timetable = JSON.parse(JSON.stringify(await getTimetable(auth, klassen[i], formattedDate), null, 2)).result;
        for (let j = 0; j < timetable.length; j++) {
            if (isTimeInRange(timetable[j].startTime, timetable[j].endTime)) {
                for (let k = 0; k < timetable[j].ro.length; k++) {
                    //console.log(`Room ${rooms[timetable[j].ro[k].id].longName} (${rooms[timetable[j].ro[k].id].name}) is occupied by class ${klassenName[i]} from ${timetable[j].startTime} to ${timetable[j].endTime}`);
                    // Remove room id from roomIDs
                    roomIDs.splice(roomIDs.indexOf(timetable[j].ro[k].id), 1);
                }
            }
        }
    }

    const table = document.getElementById("room-table");
    console.log("Free rooms:");
    for (let i = 0; i < roomIDs.length; i++) {
        let roomID = roomIDs[i];
        console.log(`Room (${rooms[roomID].name}) ${rooms[roomID].longName} is free`);
        let newRoom = document.createElement("tr");
        let name = document.createElement("td");
        name.textContent = rooms[roomID].name;
        let longName = document.createElement("td");
        longName.textContent = rooms[roomID].longName;
        newRoom.appendChild(name);
        newRoom.appendChild(longName);
        table.appendChild(newRoom);
    }
    //console.log("Free rooms:", await getFreeRooms(auth));

    // 3. Logout
    await logout(auth);
}

function isTimeInRange(startTime, endTime) {
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, "0") + now.getMinutes().toString().padStart(2, "0");
    return currentTime >= startTime && currentTime <= endTime;
}

async function authenticate() {
    const USERNAME = document.getElementById("user").value;
    const PASSWORD = document.getElementById("pass").value;
    const { result: auth, cookie } = await rpc("authenticate", {
        user: USERNAME,
        password: PASSWORD,
        client: "extended-untis",
    });
    console.log("Logged in, session:", auth.sessionId);
    return auth;
}

async function logout(auth) {
    await rpc("logout", {}, `JSESSIONID=${auth.sessionId}`);
    console.log("Logged out");
}

async function getTimetable(auth, id, day) {
    return await rpc("getTimetable", {
        "id": id,
        "type": 1,
        "startDate": day,
        "endDate": day
    }, `JSESSIONID=${auth.sessionId}`);
}

async function getRooms(auth) {
    return await rpc("getRooms", {}, `JSESSIONID=${auth.sessionId}`);
}

async function getKlassen(auth) {
    return await rpc("getKlassen", {}, `JSESSIONID=${auth.sessionId}`);
}