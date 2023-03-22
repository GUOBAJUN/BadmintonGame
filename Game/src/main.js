/***********************
 * 游戏综合客户端      *
 * 郭钰鑫 段向鑫       *
 ***********************/

let GameState = 'Ended';                                     // 玩家状态 默认为 未进行游戏(Ended)
let Player1                                                  // 本地控制玩家实例
let Player2                                                  // 远端控制玩家实例(对手)
let P1Score = document.getElementById('P1Score');            // 玩家1得分(左侧玩家)
let P2Score = document.getElementById('P2Score');            // 玩家2得分(右侧玩家)
let myID = 3;                                                // 玩家身份(玩家1或玩家2) 默认为未分配(3)
let username;                                                // 用户名
let userid;                                                  // 用户ID
let token;                                                   // 登录令牌(有效期1分钟)

const leftBorder = 0;                                        // 球场左边界X值 -> 使用了BattleFieldContainer后, leftBorder变为0

// 升级协议到WebSocket 对应不同情况下的服务器IP
// let client = new WebSocket("ws://192.168.197.155:10086"); // 手机热点
// const client = new WebSocket('ws://47.98.106.205:10086'); // 阿里云服务器
// const client = new WebSocket("ws://10.129.82.124:10086"); // NUDT-WLAN
const client = new WebSocket("ws://127.0.0.1:10086");        // Localhost

let theBall = {                                              // 客户端羽毛球实例
    positionX: 500,
    positionY: 500,
    Div: undefined
}

client.onopen = () => {                                      // 连接到应用服务器 
    const params = new URLSearchParams(window.location.search);
    username = params.get('username');
    userid = params.get('id');
    token = params.get('token');
    client.send(JSON.stringify({ type: 'requestConnect', username: username, userid: userid, token: token }));
}

client.onclose = () => {                                     // 断开连接 
    window.location.href = '/logout';
}

client.onerror = () => {                                     // 服务器崩了
    alert('无法连接到服务器...');
    window.location.href = '/logout';
}

/**
 * 功能: 处理收到的消息, 并根据不同的类型, 调用对应的函数
 * @param {MessageEvent} msg 
 */
client.onmessage = (msg) => {
    let data = JSON.parse(msg.data);
    if (data.type === 'responseID') {
        myID = data.id;
        Player1 = new Object;
        Player1.Div = document.getElementById('Player1Div');
        Player1.Body = document.getElementById('Player1Img');
        Player1.Racket = document.getElementById('Player1Racket');
        if (myID === 0) {
            Player1.positionX = leftBorder;
            Player1.Body.src = 'src/player/P1_0.png';
            Player1.Racket.src = 'src/player/R1.png';
        }
        else if (myID === 1) {
            Player1.positionX = leftBorder + 1000 - 150;
            Player1.Body.src = 'src/player/P2_0.png';
            Player1.Racket.src = 'src/player/R2.png';
        }
        Player1.Div.style.left = `${Player1.positionX}px`;
        Player1.Div.style.display = 'flex';
        Player1.positionY = 500;
        Player1.jumping = false;
        Player1.moving = false;
        Player1.degree = 0;

        let response = new Object;
        response.type = 'generatePlayer';
        response.positionX = Player1.positionX;
        response.positionY = Player1.positionY;
        client.send(JSON.stringify(response));
    }
    else if (data.type === 'notificationRefresh') {
        responseRefresh(data);
    }
    else if (data.type === 'notificationStart') {
        PlayerJoin(data);
    }
    else if (data.type === 'notificationScore') {
        RefreshScore(data);
    } else if (data.type === 'notificationEnd') {
        GameEnd(data);
    }
    else if (data.type === 'notificationHalt') {
        responseHalt();
    } else if (data.type === 'responseConnect') {
        responseConnect(data);
    } else if (data.type === 'responseQuery') {
        printRecord(data);
    }
};

/**
 * 功能: 接收来自服务器的登录反馈
 * @param {Object} data 收到的消息
 * @returns 
 */
function responseConnect(data) {
    if (data.result === 'pass')
        document.getElementById('StartButton').disabled = false;
    else {
        alert(`服务器拒绝了我们的连接！请尝试重新登录\n原因：${data.reason}`);
        window.location.href = '/logout';
        return;
    }
    // 显示用户信息
    document.getElementById('user').textContent = `${data.username}#${data.userid}`;
    document.getElementsByTagName('a')[0].style.display = '';
}

/**
 * 功能: 玩家确认对局结果后关闭弹窗
 */
function ResultConfirm() {
    document.getElementById('gameresult').style.display = 'none';
}

/**
 * 功能: 接收到来自服务器的最终战绩, 处理后反馈给玩家
 * @param {Object} data 收到的消息
 */
function GameEnd(data) {
    GameState = 'Ended';
    P1Score.innerHTML = data.P1;
    P2Score.innerHTML = data.P2;
    if (data.winner == userid)
        document.getElementById('result').innerHTML = 'YOU WIN!';
    else
        document.getElementById('result').innerHTML = 'YOU LOSE.';
    document.getElementById('gameresult').style.display = '';
    document.getElementById('StartButton').innerHTML = 'Restart!';
    Player1.Div.style.display = 'none';
    Player2.Div.style.display = 'none';
    theBall.Div.style.display = 'none';
}

/**
 * 功能: 刷新对局比分
 * @param {Object} data 收到的消息
 */
function RefreshScore(data) {
    P1Score.innerText = data.P1;
    P2Score.innerText = data.P2;
}

/**
 * 功能: 同步玩家和羽毛球的位置信息
 * @param {Object} data 收到的消息
 */
function responseRefresh(data) {
    let playerLeft;
    let playerRight;
    if (myID === 0) {
        playerLeft = Player1;
        playerRight = Player2;
    }
    else {
        playerLeft = Player2;
        playerRight = Player1;
    }
    playerLeft.positionX = data.pX4L;
    playerLeft.positionY = data.pY4L;
    playerLeft.degree = data.d4L;
    playerLeft.jumping = data.j4L;
    playerRight.positionX = data.pX4R;
    playerRight.positionY = data.pY4R;
    playerRight.degree = data.d4R;
    playerRight.jumping = data.j4R;
    theBall.positionX = data.pX4B;
    theBall.positionY = data.pY4B;
    // 更新html
    Player1.Div.style.left = `${Player1.positionX}px`;
    Player1.Div.style.top = `${Player1.positionY}px`;
    Player1.Racket.style.transform = `rotateZ(${Player1.degree}deg)`
    Player2.Div.style.left = `${Player2.positionX}px`;
    Player2.Div.style.top = `${Player2.positionY}px`;
    Player2.Racket.style.transform = `rotateZ(${Player2.degree}deg)`
    theBall.Div.style.left = `${theBall.positionX}px`;
    theBall.Div.style.top = `${theBall.positionY}px`;
}

/**
 * 功能: 配置远端玩家信息, 对局开始
 * @param {Object} data 收到的消息
 */
function PlayerJoin(data) {
    Player2 = new Object;
    Player2.Div = document.getElementById('Player2Div');
    Player2.Body = document.getElementById('Player2Img');
    Player2.Racket = document.getElementById('Player2Racket');
    Player2.Div.style.display = 'flex';
    if (myID === 0) {
        Player2.Body.src = `src/player/P2_1.png`;
        Player2.Racket.src = 'src/Player/R2.png';
        Player2.Div.style.left = `${data.pX4R}px`;
        Player2.positionX = data.pX4R;
    }
    else {
        Player2.Body.src = 'src/player/P1_1.png';
        Player2.Racket.src = 'src/player/R1.png';
        Player2.Div.style.left = `${data.pX4L}px`;
        Player2.positionX = data.pX4L;
    }
    Player2.Div.style.top = '500px';
    Player2.positionY = 500;
    Player2.degree = 0;
    Player2.jumping = false;
    theBall.Div = document.getElementById('theBall');
    theBall.positionX = data.pX4B;
    theBall.positionY = data.pY4B;
    theBall.Div.style.left = `${theBall.positionX}px`;
    theBall.Div.style.top = `${theBall.positionY}px`;
    theBall.Div.style.display = 'flex';
    GameState = 'Started';
}

/**
 * 功能: 监听键盘按下事件, 向服务器发送向左/向右移动请求
 */
document.addEventListener('keydown', (e) => {
    if (GameState !== 'Started')
        return;
    let request = new Object;
    switch (e.code) {
        case 'KeyA':
            if (Player1.moving === true)
                return;
            Player1.moving = true;
            request.type = 'requestMove';
            request.direction = 'left';
            client.send(JSON.stringify(request));
            break;
        case 'KeyD':
            if (Player1.moving === true)
                return;
            Player1.moving = true;
            request.type = 'requestMove';
            request.direction = 'right';
            client.send(JSON.stringify(request));
            break;
        case 'KeyJ':
            if (Player1.degree !== 0)
                return;
            request.type = 'requestHit';
            client.send(JSON.stringify(request));
            break;
        case 'KeyK':
            if (Player1.jumping === true)
                break;
            request.type = 'requestJump';
            client.send(JSON.stringify(request));
            break;
        default:
            break;
    }
}, false);

/**
 * 功能: 监听按键抬起事件, 向服务器发送停止移动请求
 */
document.addEventListener('keyup', (e) => {
    if (GameState !== 'Started')
        return;
    switch (e.code) {
        case 'KeyA':
        case 'KeyD':
            let request = new Object;
            request.type = 'requestStand';
            request.id = myID;
            client.send(JSON.stringify(request));
            Player1.moving = false;
            break;
        default:
            break;
    }
}, false);

/**
 * 功能: 刷新或关闭网页前先断开WebSocket连接
 */
window.addEventListener('beforeunload', (e) => {
    client.close();
})

/**
 * 功能: 点击开始按钮后, 请求服务器分配玩家身份(左侧玩家, 右侧玩家)
 */
function requestID() {
    let request = new Object;
    request.type = 'requestID';
    client.send(JSON.stringify(request));
}

/**
 * 功能: 对手断线后续处理
 */
function responseHalt() {
    alert('对手已离线...');
    GameState = 'Ended';
    Player1.Div.style.display = 'none';
    Player2.Div.style.display = 'none';
    theBall.Div.style.display = 'none';
    document.getElementById('StartButton').textContent='restart!';
}

/**
 * 功能: 请求查询战绩
 */
function queryRecord() {
    client.send(JSON.stringify({ type: 'requestQuery' }));
}

/**
 * 功能: 根据服务器发回的数据, 显示战绩信息
 * @param {Object} data 收到的消息
 * @returns 
 */
function printRecord(data) {
    let res = data.res.split('|');
    let listContainer = document.getElementById('list-container');
    listContainer.innerHTML = '';
    if (res.length === 0) {
        let listItem = document.createElement('div');
        listItem.className = 'list-item';
        listItem.textContent = `还没有战绩记录哦`;
        listContainer.appendChild(listItem);
        return;
    }
    let flag = 1;
    res.forEach((row) => {
        let listItem = document.createElement('div');
        item = JSON.parse(row);
        listItem.className = 'list-item';
        listItem.textContent = `${item.PLAYER1} vs ${item.PLAYER2} win ${item.WINNER}`;
        if (flag === 0) {
            listItem.style.backgroundColor = '#f9f9f9';
            flag = 1;
        } else {
            listItem.style.backgroundColor = '#f0f0f0';
            flag = 0;
        }
        listContainer.appendChild(listItem);
    })
}

// 开始按钮处理模块
document.getElementById('StartButton').onclick = () => {
    if (GameState === 'Ended') { // new start
        document.getElementById('P1Score').textContent = '0';
        document.getElementById('P2Score').textContent = '0';
        document.getElementById('StartButton').textContent = 'Clicked!'
        GameState = 'Waiting';
        requestID();
    }
}
