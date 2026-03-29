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
    "144",
    "84",
    "83",
    "166",
    "230",
    "224",
    "227",
    "233",
    "79",
    "239",
    "139",
    "77"
]

let rooms = {}; // id = {name, longname, free until}
let roomIDs = [];
let timetables = {};
let roomTimetables = {};
let klassen = [];
let klassenName = [];

let running = false;

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
        running = false;
        throw new Error(`RPC Error ${data.error.code}: ${data.error.message}`);
    }

    return { result: data.result, cookie: response.headers.get("set-cookie") };
}

let today = new Date();
let formattedDate = today.toISOString().slice(0, 10).replace(/\-/g, "");

let freeUntilMap = {};

function doesNotContain(roomTimetable, lesson) {
    let contains = false;
    for (let i = 0; i < roomTimetable.length; i++) {
        if (JSON.stringify(roomTimetable[i]) === lesson) {
            contains = true;
            break;
        }
    }
    return !contains;
}

async function main() {
    today = new Date();
    //formattedDate = today.toISOString().slice(0, 10).replace(/\-/g, "");
    formattedDate = "20260325";
    if (running) {
        return;
    }
    running = true;
    setStatus("authenticating...");
    let auth = await authenticate();

    roomIDs = [];
    rooms = {};
    timetables = {};
    klassen = [];
    klassenName = [];

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

    console.log(formattedDate);

    let currentTime = new Date().getHours().toString().padStart(2, "0") + new Date().getMinutes().toString().padStart(2, "0");

    setStatus("loading timetables... (0/?)");
    for (let i = 0; i < klassen.length; i++) {
        loading_bar.style.width = ((i / klassen.length) * 100 + 1) + "%";
        setStatus("loading timetables... (" + i + "/" + klassen.length + ")");
        let timetable = JSON.parse(JSON.stringify(await getTimetable(auth, klassen[i], formattedDate), null, 2)).result;
        timetables[klassen[i]] = timetable;
        for (let j = 0; j < timetable.length; j++) {
            if (isTimeInRange(timetable[j].startTime, timetable[j].endTime) && timetable[j].code !== "cancelled") {
                for (let k = 0; k < timetable[j].ro.length; k++) {
                    roomIDs.splice(roomIDs.indexOf(timetable[j].ro[k].id), 1);
                }
            }
            let start = timetable[j].startTime;
            for (let k = 0; k < timetable[j].ro.length; k++) {
                let roomID = timetable[j].ro[k].id;
                if (start >= currentTime && (freeUntilMap[roomID] >= start || freeUntilMap[roomID] <= 0)) {
                    freeUntilMap[roomID] = start;
                    rooms[roomID].freeUntil = start.substring(0, start.length-2) + ":" + start.substring(start.length-2, start.length);
                }
            }
            for (let k = 0; k < timetable[j].ro.length; k++) {
                if (timetable[j].code !== "cancelled") {
                    let roomID = timetable[j].ro[k].id;
                    const lesson = JSON.stringify({
                        start: timetable[j].startTime,
                        end: timetable[j].endTime,
                        day: (timetable[j].date-formattedDate),
                        classes: getIdsFromJsonArray(timetable[j].kl),
                        teachers: getIdsFromJsonArray(timetable[j].te),
                        vIndex: -1
                    });
                    if (!roomTimetables[roomID]) {
                        roomTimetables[roomID] = [];
                    }
                    if (doesNotContain(roomTimetables[roomID], lesson)) {
                        roomTimetables[roomID].push(JSON.parse(lesson));
                    }
                    roomTimetables[roomID].push();
                }
            }
        }
    }

    setStatus("success");
    loading_bar.style.width = "100%";
    setTimeout(async () => {
        if (running) {
            return;
        }
        setStatus("Enter Credentials");
        loading_bar.style.width = "0%";
    }, 5000);

    setTable();

    await logout(auth);
    running = false;
}

function setTable() {
    const table = document.getElementById("room-table");
    const tbody = table.tBodies[0];

    let header = `<tr>`
    if (debug) {
        header = header + `<th>ID</th>`;
    }
    header = header + `<th>Kürzel</th><th>Langer Raumname</th><th>Frei Bis</th></tr>`;

    tbody.innerHTML = header;

    for (let i = 0; i < roomIDs.length; i++) {
        let roomID = roomIDs[i];
        if (filtered.includes(roomID.toString()) && !show_all) {
            continue;
        }
        let newRoom = document.createElement("tr");

        let name = document.createElement("td");
        name.textContent = rooms[roomID].name;

        let longName = document.createElement("td");
        longName.textContent = rooms[roomID].longName;

        let freeUntil = document.createElement("td");
        freeUntil.textContent = rooms[roomID].freeUntil;
        freeUntil.style.textAlign = "right";

        if (debug) {
            let newRoomID = document.createElement("td");
            newRoomID.textContent = roomID;
            newRoom.appendChild(newRoomID);
        }

        newRoom.appendChild(name);
        newRoom.appendChild(longName);
        newRoom.appendChild(freeUntil);
        tbody.appendChild(newRoom);
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



const options = document.querySelectorAll('.option');
const indicator = document.getElementById('indicator');

const option_free = document.getElementById('content-free');
const option_room = document.getElementById('content-room');
const option_teacher = document.getElementById('content-teacher');

const room_table_content = document.getElementById('room-table-content');
const room_schedule_content = document.getElementById('room-schedule-content');
const teacher_schedule_content = document.getElementById('teacher-schedule-content');

options.forEach(option => {
    option.addEventListener('click', () => {
        options.forEach(o => {
            o.classList.remove('active')
        });
        option.classList.add('active');
        moveIndicator(option);
        if (option.id === "option-free") {
            option_free.style.display = "flex";
            option_room.style.display = "none";
            option_teacher.style.display = "none";

            room_table_content.style.display = "block";
            room_schedule_content.style.display = "none";
            teacher_schedule_content.style.display = "none";
        }else if (option.id === "option-room") {
            option_free.style.display = "none";
            option_room.style.display = "flex";
            option_teacher.style.display = "none";

            room_table_content.style.display = "none";
            room_schedule_content.style.display = "block";
            teacher_schedule_content.style.display = "none";
        }else if (option.id === "option-teacher") {
            option_free.style.display = "none";
            option_room.style.display = "none";
            option_teacher.style.display = "flex";

            room_table_content.style.display = "none";
            room_schedule_content.style.display = "none";
            teacher_schedule_content.style.display = "block";
        }
    });
});

function moveIndicator(element) {
    indicator.style.width = `${element.offsetWidth-10}px`;
    indicator.style.left = `${element.offsetLeft+5}px`;
}

window.addEventListener('load', () => {
    const active = document.querySelectorAll('.option.active');
    active.forEach(o => {
        moveIndicator(o);
    });
    indicator.style.transition = 'all 0.2s ease';
});

window.addEventListener('resize', () => {
    const active = document.querySelectorAll('.option.active');
    active.forEach(o => {
        moveIndicator(o);
    });
});

let show_all = false;
let debug = false;

const checkBoxes = document.querySelectorAll('.custom-checkbox');

checkBoxes.forEach(o => {
    o.addEventListener('click', () => {
        o.classList.toggle('active');
        if (o.id === "show-all") {
            show_all = !show_all;
            setTable();
        } else if (o.id === "debug") {
            debug = !debug;
            setTable();
        }
    });
});

setTable();

function searchRoom() {
    const input = document.getElementById("room-filter").value.toLowerCase();
    let room = "";
    console.log(rooms)
    for (let i = 0; i < roomIDs.length; i++) {
        console.log(rooms[i]);
        if (rooms[roomIDs[i]].name.toLowerCase() === input) {
            room = rooms[roomIDs[i]].id;
            break;
        }
    }
    console.log(input + " - " + room);
    setScheduleHtml(document.getElementById("room-schedule"), roomTimetables[room]);
}

/*
 * mainBody: div
 * timetable: 
 * [
 *   {
 *     start: "HHMM",
 *     end: "HHMM",
 *     day: 0-4,
 *     room: "123N",
 *     classes: ["10A", "10B"],
 *     teachers: ["Mr. Smith", "Ms. Johnson"],
 *     vIndex: 0... (for overlapping classes)
 *   },
 *   ...
 * ]
 */
function setScheduleHtml(mainBody, timetable) {
    let days = 1;
    let start = 755; // 7:55
    let end = 1845; // 18:45
    const scaleFactor = 0.75; // 4 minutes = 3px
    mainBody.innerHTML = ``;
    for (let i = 0; i < days; i++) {
        let day = document.createElement("div");
        day.classList.add("schedule-day");
        for (let j = 0; j < timetable.length; j++) {
            const lStart = timetable[j].start;
            const lEnd = timetable[j].end;
            if (lStart >= start && lEnd <= end && timetable[j].day === i) {
                const lesson = document.createElement("div");
                lesson.classList.add("schedule-lesson");
                lesson.style.top = ((lStart - start) * scaleFactor) + "px";
                lesson.style.height = ((lEnd - lStart) * scaleFactor) + "px";
                if (timetable[j].vIndex !== -1) {
                    lesson.style.left = (timetable[j].vIndex * 100) + "%";
                    lesson.style.width = (100 / (timetable[j].vIndex + 1)) + "%";
                }else {
                    lesson.style.width = "100%"
                }
                const classes = document.createElement("p");
                classes.classList.add("schedule-class");
                classes.textContent = getFormattedClasses(timetable[j].classes);
                const teachers = document.createElement("p");
                teachers.classList.add("schedule-teacher");
                teachers.textContent = timetable[j].teachers.join(", ");
                lesson.appendChild(classes);
                lesson.appendChild(teachers);
                day.appendChild(lesson);
            }
        }
        mainBody.appendChild(day);
    }
}

function getFormattedClasses(classes){
    let result = '';
    classes.forEach(o => {
        const i = klassen.indexOf(o);
        if (i !== -1) {
            result = result + klassenName[i];
        }else {
            result = result + o;
        }
        if (classes.indexOf(o) !== classes.length-1) {
            result = result + ", ";
        }
    });
    return result;
}

function getIdsFromJsonArray(jsonArray) {
    let ids = [];
    for (let i = 0; i < jsonArray.length; i++) {
        ids.push(jsonArray[i].id);
    }
    return ids;
}