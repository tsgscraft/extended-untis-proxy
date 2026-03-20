const loading_bar = document.getElementById("loading-bar-color");

let bar_max = 0;

const filtered = [
    "149",
    "151",
    "158",
    "99",
    "102",
    "93",
    "164",
    "114",
    "150",
    "152",
    "153",
    "156",
    "100",
    "103",
    "94",
    "168",
    "115",
    "159",
    "165",
    "104",
    "105",
    "127",
    "223",
    "157",
    "167",
    "155",
    "170",
    "169",
    "112",
    "191",
    "80",
    "43",
    "122",
    "123",
    "234",
    "98",
    "97",
    "101",
    "54",
    "185",
    "189",
    "81",
    "238",
    "235",
    "95",
    "96",
    "201",
    "154",
    "147",
    "148",
    "146",
    "61",
    "62",
    "85",
    "82",
    "63",
    "64",
    "86",
    "65",
    "66",
    "67",
    "68",
    "69",
    "87",
    "70",
    "72",
    "71",
    "73",
    "246",
    "243",
    "241",
    "125",
    "126",
    "124",
    "160",
    "242",
    "120",
    "182",
    "106",
    "121",
    "208",
    "128",
    "91",
    "174",
    "177",
    "175",
    "198",
    "113",
    "108",
    "135",
    "173",
    "161",
    "116",
    "109",
    "107",
    "92",
    "110",
    "137",
    "111",
    "172",
    "171",
    "89",
    "118",
    "138",
    "140",
    "76",
    "141",
    "129",
    "142",
    "131",
    "143",
    "144"
]

let rooms = {}; // id = {name, longname}
let roomIDs = [];

async function rpc(method, params = {}, cookie = "") {
    const response = await fetch("/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=UTF-8",
            ...(cookie && { Cookie: cookie }),
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: "1",
            method,
            params,
        }),
    });

    const data = await response.json(); // ← replace the manual arrayBuffer decode with this

    if (data.error) {
        setStatus(`Error ${data.error.code}: ${data.error.message}`);
        throw new Error(`RPC Error ${data.error.code}: ${data.error.message}`);
    }

    return { result: data.result, cookie: response.headers.get("set-cookie") };
}

async function main() {
    setStatus("authenticating...");
    let auth = await authenticate();

    let klassen = [];
    let klassenName = [];

    setStatus("loading classes...");
    let klassenRpc = JSON.parse(JSON.stringify(await getKlassen(auth), null, 2)).result;

    for (let i = 0; i < klassenRpc.length; i++) {
        klassen.push(klassenRpc[i].id);
        klassenName.push(klassenRpc[i].name);
    }

    setStatus("loading rooms...");
    let roomsRpc = JSON.parse(JSON.stringify(await getRooms(auth), null, 2)).result;
    bar_max = roomsRpc.length + 2;
    loading_bar.style.width = "1%";
    for (let i = 0; i < roomsRpc.length; i++) {
        let room = {
            id: roomsRpc[i].id,
            name: fixEncoding(roomsRpc[i].name),
            longName: fixEncoding(roomsRpc[i].longName)
        }
        rooms[room.id] = room;
        roomIDs.push(room.id);
    }

    const today = new Date();
    const formattedDate = today.toISOString().slice(0, 10).replace(/\-/g, "");

    console.log(formattedDate);

    setStatus("loading timetables... (0/?)");
    for (let i = 0; i < klassen.length; i++) {
        loading_bar.style.width = ((i / klassen.length) * 100 + 1) + "%";
        setStatus("loading timetables... (" + i + "/" + klassen.length + ")");
        let timetable = JSON.parse(JSON.stringify(await getTimetable(auth, klassen[i], formattedDate), null, 2)).result;
        for (let j = 0; j < timetable.length; j++) {
            if (isTimeInRange(timetable[j].startTime, timetable[j].endTime)) {
                for (let k = 0; k < timetable[j].ro.length; k++) {
                    roomIDs.splice(roomIDs.indexOf(timetable[j].ro[k].id), 1);
                }
            }
        }
    }

    setStatus("success");
    loading_bar.style.width = "100%";
    setTimeout(async () => {
        setStatus("Enter Credentials");
        loading_bar.style.width = "0%";
    }, 5000);

    setTable();

    await logout(auth);
}

function setTable() {
    const table = document.getElementById("room-table");
    table.innerHTML = "<tr><th>Raum ID</th><th>Raum Kürzel</th><th>Langer Raumname</th></tr>";
    console.log("Free rooms:");
    for (let i = 0; i < roomIDs.length; i++) {
        let roomID = roomIDs[i];
        if (filtered.includes(roomID.toString()) && !document.getElementById("show-all").checked) {
            continue;
        }
        console.log(`Room (${rooms[roomID].name}) ${rooms[roomID].longName} is free`);
        let newRoom = document.createElement("tr");

        let newRoomID = document.createElement("td");
        newRoomID.textContent = roomID;

        let name = document.createElement("td");
        name.textContent = rooms[roomID].name;

        let longName = document.createElement("td");
        console.log(rooms[roomID].longName);
        console.log([...rooms[roomID].longName].map(c => c.charCodeAt(0).toString(16)));
        longName.textContent = rooms[roomID].longName;

        newRoom.appendChild(newRoomID);
        newRoom.appendChild(name);
        newRoom.appendChild(longName);
        table.appendChild(newRoom);
    }
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

function setStatus(message) {
    document.getElementById("status").innerText = message;
}

document.querySelector('#pass').addEventListener('keypress', function (e) {
    if (13 === e.keyCode) {
        main().catch(console.error);
    }
});
document.querySelector('#user').addEventListener('keypress', function (e) {
    if (13 === e.keyCode) {
        main().catch(console.error);
    }
});

document.querySelector('#show-all').addEventListener('change', function (e) {
    setTable();
});

function fixEncoding(str) {
    try {
        // Try to interpret the string as if it were ISO-8859-1 bytes decoded as UTF-8
        const bytes = new Uint8Array(str.split('').map(c => c.charCodeAt(0)));
        const decoded = new TextDecoder('utf-8').decode(bytes);
        // If decoding succeeded without replacement characters, use it
        if (!decoded.includes('\uFFFD')) {
            return decoded;
        }
    } catch (e) {}
    return str; // fallback to original
}