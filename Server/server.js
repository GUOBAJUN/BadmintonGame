/***********************
 * 游戏应用服务器      *
 * 郭钰鑫 段向鑫       *
 ***********************/

const fs = require('fs');                                     // 文件读写模块
const WebSocket = require('ws');                              // 适用于NodeJS的WebSocket模块
const jwt = require('jsonwebtoken')                           // JWT模块
const config = require('./config.js')                         // 配置文件 -> 存储有Token密钥
const Database = require('better-sqlite3');                   // 连接SQLite3数据库
const path = require('path');                                 // 路径处理模块

const PORT = 10086;                                           // WebSocket Server端口
const dbPath = path.join(__dirname, './record.db');           // 游戏记录(战绩)数据库路径

const db = new Database(dbPath);
const query = db.prepare('SELECT * FROM RECORD WHERE ID1 = ? OR ID2 = ?');                                  // 查询玩家战绩
const ins = db.prepare('INSERT INTO RECORD (PLAYER1, ID1, PLAYER2, ID2, WINNER) VALUES (?, ?, ?, ?, ?)');   // 更新战绩信息

const g = 3;                                                  // 模拟重力加速度
const u = 1;                                                  // 模拟空气阻力 (物理学原理u=kv, 此处当作常量处理)
const theMidHeight = 480;                                     // 球网高度
const theGround = 630;                                        // 地面Y值
const BaseV = 80;                                             // 击球初速度
const RacketLen = 180;                                        // 球拍长度 -> 应与贴图长度一致
const Reflect = 0.9;                                          // 基础击球反弹系数 -> 击球后球的速度与球与球拍位置有关
const leftBorder = 0;                                         // 左边界X值
const midLine = 500;                                          // 球网X值
const rightBorder = 1000;                                     // 右边界X值

let PlayerCnt = 0;                                            // 玩家人次计数器
let moveEvent = {};                                           // 左右移动Timer
let PlayerList = {};                                          // 玩家实例存储器
let ClientList = {};                                          // Socket连接存储器
let Sessions = {};                                            // 对局存储器(与HTTP session无关)
let SessionCnt = 0;                                           // 对局计次器
let WaitingPlayer;                                            // 等待队列玩家ID
let theBalls = {};                                            // 羽毛球实例存储器
let user = {}                                                 // 用户信息存储器


/**
 * 功能: 为对局中的玩家发送位置同步广播\
 * 内容: 玩家1坐标 玩家2坐标 羽毛球坐标
 * @param {Number} SessionID 
 */
async function RefreshBoardcast(SessionID) {
    let response = new Object;
    response.type = 'notificationRefresh';
    response.pX4L = PlayerList[Sessions[SessionID].P1].positionX;
    response.pX4R = PlayerList[Sessions[SessionID].P2].positionX;
    response.pY4L = PlayerList[Sessions[SessionID].P1].positionY;
    response.pY4R = PlayerList[Sessions[SessionID].P2].positionY;
    response.d4L = PlayerList[Sessions[SessionID].P1].degree;
    response.d4R = PlayerList[Sessions[SessionID].P2].degree;
    response.j4L = PlayerList[Sessions[SessionID].P1].jumping;
    response.j4R = PlayerList[Sessions[SessionID].P2].jumping;
    if (theBalls[SessionID].state === 1) {
        response.pX4B = theBalls[SessionID].positionX;
        response.pY4B = theBalls[SessionID].positionY;
    } else {
        if (theBalls[SessionID].At === 1) {
            response.pX4B = PlayerList[Sessions[SessionID].P1].positionX + 20;
            response.pY4B = PlayerList[Sessions[SessionID].P1].positionY + 20;
        } else {
            response.pX4B = PlayerList[Sessions[SessionID].P2].positionX + 120;
            response.pY4B = PlayerList[Sessions[SessionID].P2].positionY + 20;
        }
    }
    ClientList[Sessions[SessionID].P1].send(JSON.stringify(response));
    ClientList[Sessions[SessionID].P2].send(JSON.stringify(response));
}

/**
 * 功能: 计算飞行中的羽毛球的物理运动并更新羽毛球坐标\
 *       当羽毛球落地时, 调用WinCheck函数更新比分信息
 * @param {Number} SessionID 对局ID
 * @returns 
 */
async function BallFly(SessionID) {
    // 没飞，无需计算
    if (theBalls[SessionID].state === 0 || theBalls[SessionID].BallTimerTag === false)
        return;
    // 在飞，需要计算并判定
    if (theBalls[SessionID].Vx * theBalls[SessionID].direction + theBalls[SessionID].positionX > rightBorder) { // 右墙
        theBalls[SessionID].positionX = 2 * rightBorder - theBalls[SessionID].positionX - theBalls[SessionID].Vx * theBalls[SessionID].direction;
        theBalls[SessionID].direction *= -1;
        theBalls[SessionID].Vx = Math.round(theBalls[SessionID].Vx * 0.50);
    }
    else if (theBalls[SessionID].Vx * theBalls[SessionID].direction + theBalls[SessionID].positionX < leftBorder) { // 左墙
        theBalls[SessionID].positionX = 2 * leftBorder - theBalls[SessionID].positionX - theBalls[SessionID].Vx * theBalls[SessionID].direction;
        theBalls[SessionID].direction *= -1;
        theBalls[SessionID].Vx = Math.round(theBalls[SessionID].Vx * 0.50);
    }
    else if (theBalls[SessionID].positionY > theMidHeight) { // 撞网
        if (Math.abs(midLine - theBalls[SessionID].positionX) < theBalls[SessionID].Vx) {
            theBalls[SessionID].positionX = 2 * midLine - theBalls[SessionID].positionX - theBalls[SessionID].Vx * theBalls[SessionID].direction;
            theBalls[SessionID].direction *= -1;
            theBalls[SessionID].Vx = Math.round(theBalls[SessionID].Vx * 0.50);
        }
    }
    else { // 正常飞过
        theBalls[SessionID].positionX += theBalls[SessionID].Vx * theBalls[SessionID].direction;
        if (theBalls[SessionID].Vx > u) // 水平方向减速
            theBalls[SessionID].Vx -= u;
        else
            theBalls[SessionID].Vx = 0;
    }
    if (theBalls[SessionID].positionY + theBalls[SessionID].Vy < theGround) { // 下一刻未触底
        theBalls[SessionID].positionY += theBalls[SessionID].Vy;
        theBalls[SessionID].Vy += g;
    }
    else { // 触底
        clearInterval(theBalls[SessionID].BallTimer); // 停止位移判定
        theBalls[SessionID].BallTimerTag = false; // 更新标志
        theBalls[SessionID].Vy = 0;
        theBalls[SessionID].Vx = 0;
        theBalls[SessionID].positionY = theGround;
        WinCheck(SessionID); // 检查得分情况
    }
}

/**
 * 功能: 结束对局, 向玩家发送最终战绩信息并回收资源, 结束对局
 * @param {Number} SessionID  对局ID
 * @param {Number} userid  用户ID
 */
async function GameEnd(SessionID, userid) {
    let response = new Object;
    response.type = 'notificationEnd';
    response.winner = userid;
    response.P1 = PlayerList[Sessions[SessionID].P1].score;
    response.P2 = PlayerList[Sessions[SessionID].P2].score;
    ClientList[Sessions[SessionID].P1].send(JSON.stringify(response));
    ClientList[Sessions[SessionID].P2].send(JSON.stringify(response));
    // 此处需添加资源回收
    if (moveEvent[Sessions[SessionID].P1] && moveEvent[Sessions[SessionID].P1]._destroyed === false)
        clearInterval(moveEvent[Sessions[SessionID].P1]);
    if (moveEvent[Sessions[SessionID].P2] && moveEvent[Sessions[SessionID].P2]._destroyed === false)
        clearInterval(moveEvent[Sessions[SessionID].P2]);
    clearInterval(Sessions[SessionID].boardcast);
    user[Sessions[SessionID].P1].state = 'login';
    user[Sessions[SessionID].P2].state = 'login';
    ins.run(user[Sessions[SessionID].P1].username, Sessions[SessionID].P1, user[Sessions[SessionID].P2].username, Sessions[SessionID].P2, user[userid].username);
    delete PlayerList[Sessions[SessionID].P1];
    delete PlayerList[Sessions[SessionID].P2];
    delete Sessions[SessionID];
}

/**
 * 功能: 根据羽毛球落点更新比分信息\
 *       当有玩家获胜时调用GameEnd函数进行后续处理
 * @param {Number} SessionID 对局ID 
 * @returns 
 */
async function WinCheck(SessionID) {
    try {
        if (theBalls[SessionID].positionX < midLine) {
            // Player2 Win Score ++ & theBalls[SessionID] on one's hand
            PlayerList[Sessions[SessionID].P2].score++;
            if (PlayerList[Sessions[SessionID].P2].score > 6) {
                GameEnd(SessionID, Sessions[SessionID].P2);
                return;
            }
            theBalls[SessionID].At = 2;
        }
        else {
            // Player1 Win
            PlayerList[Sessions[SessionID].P1].score++;
            if (PlayerList[Sessions[SessionID].P1].score > 6) {
                GameEnd(SessionID, Sessions[SessionID].P1);
                return;
            }
            theBalls[SessionID].At = 1;
        }
        let response = new Object;
        response.type = 'notificationScore';
        response.P1 = PlayerList[Sessions[SessionID].P1].score;
        response.P2 = PlayerList[Sessions[SessionID].P2].score;
        ClientList[Sessions[SessionID].P1].send(JSON.stringify(response));
        ClientList[Sessions[SessionID].P2].send(JSON.stringify(response));
        setTimeout((SessionID) => {
            theBalls[SessionID].state = 0;
        }, 1000, SessionID);
    }
    catch (error) {
        return;
    }
}

/**
 * 功能: 为点击开始游戏的用户分配身份(玩家1、玩家2)
 * @param {Number} userid 用户ID 
 */
async function assignID(userid) {
    PlayerList[userid] = new Object;
    PlayerList[userid].id = PlayerCnt % 2;
    PlayerCnt++;
    let response = new Object;
    response.type = 'responseID';
    response.id = PlayerList[userid].id;
    ClientList[userid].send(JSON.stringify(response));
}

/**
 * 功能: 为收到对局身份的玩家创建Player实例\
 *       当配对成功后开始一场对局
 * @param {Object} data 接收到的数据
 * @param {Number} userid 用户ID
 */
async function generatePlayer(data, userid) {
    PlayerList[userid].positionX = data.positionX;
    PlayerList[userid].positionY = data.positionY;
    PlayerList[userid].degree = 0;
    PlayerList[userid].score = 0;
    PlayerList[userid].jumping = false;
    if (PlayerList[userid].id === 0) { WaitingPlayer = userid; user[userid].state = 'wait'; }
    else {
        let response = new Object;
        PlayerList[userid].SessionID = SessionCnt;
        PlayerList[WaitingPlayer].SessionID = SessionCnt;
        response.type = 'notificationStart';
        response.pX4L = PlayerList[WaitingPlayer].positionX;
        response.pX4R = PlayerList[userid].positionX;
        response.pX4B = PlayerList[WaitingPlayer].positionX + 50;
        response.pY4B = 500;
        ClientList[userid].send(JSON.stringify(response));
        ClientList[WaitingPlayer].send(JSON.stringify(response));
        // 对局初始化
        user[WaitingPlayer].state = 'game';
        user[userid].state = 'game';
        Sessions[SessionCnt] = new Object;
        Sessions[SessionCnt].P1 = WaitingPlayer;
        Sessions[SessionCnt].P2 = userid;
        theBalls[SessionCnt] = new Object({
            positionX: PlayerList[WaitingPlayer].positionX + 50,
            positionY: 500,
            Vx: 0,
            Vy: 0,
            direction: 1,
            state: 0,
            At: 1,
            BallTimer: 0,
            BallTimerTag: false
        });
        Sessions[SessionCnt].boardcast = setInterval(RefreshBoardcast, 10, SessionCnt);
        SessionCnt++;
        WaitingPlayer = -1;
    }
}

/**
 * 功能: 实现玩家左右移动
 * @param {Object} data 接收到的数据
 * @param {Number} userid 用户ID
 * @returns 
 */
async function PlayerMove(data, userid) {
    let step = 7;
    try {
        if (data.direction === 'left') {
            if (PlayerList[userid].id === 0) {
                moveEvent[userid] = setInterval(() => {
                    if (PlayerList[userid].positionX - step > leftBorder) {
                        PlayerList[userid].positionX -= step;
                    }
                }, 10);
                return;
            }
            else {
                moveEvent[userid] = setInterval(() => {
                    if (PlayerList[userid].positionX - step > midLine) {
                        PlayerList[userid].positionX -= step;
                    }
                }, 10);
                return;
            }
        }
        else if (data.direction === 'right') {
            if (PlayerList[userid].id === 0) {
                moveEvent[userid] = setInterval(() => {
                    if (PlayerList[userid].positionX + 130 + step < midLine) {
                        PlayerList[userid].positionX += step;
                    }
                }, 10);
                return;
            }
            else {
                moveEvent[userid] = setInterval(() => {
                    if (PlayerList[userid].positionX + 150 + step < rightBorder) {
                        PlayerList[userid].positionX += step;
                    };
                }, 10);
                return;
            }
        }
    }
    catch (error) {
        return;
    }
}

/**
 * 功能: 实现玩家跳跃
 * @param {Object} data 接收到的数据
 * @param {Number} userid 用户ID
 * @returns 
 */
async function PlayerJump(data, userid) {
    if (PlayerList[userid].jumping === true)
        return;
    PlayerList[userid].jumping = true;
    let v = -30;
    let jump = setInterval((userid) => {
        try {
            if (v > 0) {
                if (PlayerList[userid].positionY + v >= 500) {
                    PlayerList[userid].positionY = 500;
                    PlayerList[userid].jumping = false;
                    clearInterval(jump);
                    return;
                }
            }
            PlayerList[userid].positionY += v;
            v += g;
        }
        catch (error) {
            clearInterval(jump);
            return;
        }
    }, 15, userid);
}

/**
 * 功能: 计算同一平面上两点的直线距离
 * @param {Number} x1 点1横坐标
 * @param {Number} y1 点1纵坐标
 * @param {Number} x2 点2横坐标
 * @param {Number} y2 点2纵坐标
 * @returns 点1和点2的几何距离
 */
function GetDistance(x1, y1, x2, y2) {
    return Math.round(Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2)));
}

/**
 * 功能: 计算玩家击球结果以及绘制击球动画
 * @param {Object} data 接收到的数据
 * @param {Number} userid 用户ID
 */
async function PlayerHit(data, userid) {
    let theBall = theBalls[PlayerList[userid].SessionID];
    if (theBall.state === 0 && theBall.At === PlayerList[userid].id + 1) {
        theBall.Vx = BaseV / 2;
        theBall.Vy = -BaseV / 2;
        if (PlayerList[userid].id === 0)
            theBall.direction = 1;
        else theBall.direction = -1;
        theBall.positionX = PlayerList[userid].positionX + 20;
        theBall.positionY = PlayerList[userid].positionY + 20;
        theBall.state = 1;
        theBall.At = 0;
        theBall.BallTimer = setInterval(BallFly, 60, PlayerList[userid].SessionID);
        theBall.BallTimerTag = true;
    } else {
        let x = PlayerList[userid].positionX + 75;
        let y = PlayerList[userid].positionY + 75;
        let dist = GetDistance(x, y, theBall.positionX, theBall.positionY)
        if (dist < RacketLen && theBall.positionY < y - Math.abs(x - theBall.positionX)) {
            if (PlayerList[userid].id === 0) {
                if (theBall.positionX < x) {
                    theBall.Vx = Math.round(BaseV * (y - theBall.positionY) / dist * Reflect);
                    theBall.Vy = Math.round(-BaseV * (x - theBall.positionX) / dist * Reflect);
                }
                else if (theBall.positionX > x) {
                    theBall.Vx = Math.round(BaseV * (y - theBall.positionY) / dist * Reflect);
                    theBall.Vy = Math.round(BaseV * (theBall.positionX - x) / dist * Reflect);
                }
                theBall.direction = 1;
            } else {
                if (theBall.positionX < x) {
                    theBall.Vx = Math.round(BaseV * (y - theBall.positionY) / dist * Reflect);
                    theBall.Vy = Math.round(BaseV * (x - theBall.positionX) / dist * Reflect);
                } else if (theBall.positionX > x) {
                    theBall.Vx = Math.round(BaseV * (y - theBall.positionY) / dist * Reflect);
                    theBall.Vy = Math.round(-BaseV * (theBall.positionX - x) / dist * Reflect);
                }
                theBall.direction = -1;
            }
        }
    }
    var flag = 0;
    if (PlayerList[userid].id === 0)
        flag = 90;
    else flag = -90;
    let hit = setInterval(() => {
        if (flag === 0) {
            try { PlayerList[userid].degree = 0; }
            catch (error) { clearInterval(hit); }
            clearInterval(hit);
        }
        try { PlayerList[userid].degree = flag; }
        catch (error) {
            clearInterval(hit);
        }
        if (flag < 0)
            flag += 10;
        else if (flag > 0)
            flag -= 10;
    }, 20);
}

/**
 * 功能: 日志打印
 * @param {String} msg 
 */
function LogMsg(msg) {
    let date = new Date()
    console.log(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}]${msg}`);
}

/**
 * 功能: 根据收到的消息的类型, 调用对应的函数, 实现相应的功能
 * @param {Object} data 收到的数据
 * @param {Number} userid 玩家ID
 * @returns 
 */
async function MessageHandler(data, userid) {
    if (data.type === 'requestMove') {
        PlayerMove(data, userid);
        return;
    }
    if (data.type === 'requestJump') {
        PlayerJump(data, userid);
        return;
    }
    if (data.type === 'requestStand') {
        clearInterval(moveEvent[userid]);
        return;
    }
    if (data.type === 'requestID') {
        assignID(userid);
        return;
    }
    if (data.type === 'generatePlayer') {
        generatePlayer(data, userid);
        return;
    }
    if (data.type === 'requestHit') {
        PlayerHit(data, userid);
        return;
    }
    if (data.type === 'requestQuery') {
        RecordQuery(data, userid);
        return;
    }
}

/**
 * 功能: 处理某个用户网络中断事件
 * @param {Number} userid 用户ID
 * @returns 
 */
async function NetworkHaltHandler(userid) {
    //尚未进行任何有效通信
    if (userid === -1)
        return;
    //等待中结束通信 -> 结束排队
    if (user[userid].state === 'wait') {
        PlayerCnt--;
        delete PlayerList[userid];
        WaitingPlayer = -1;
        delete ClientList[userid];
        delete user[userid];
        return;
    } else if (WaitingPlayer !== -1 && WaitingPlayer !== userid) {
        delete PlayerList[userid];
        delete ClientList[userid];
        delete user[userid];
        return;
    }
    //游戏结束后退出
    if (user[userid].state === 'login') {
        delete user[userid];
        return;
    }
    //游戏中结束通信 -> 结束对局
    let SessionID = 0;
    if (user[userid].state === 'game') {
        SessionID = PlayerList[userid].SessionID;
        let response = new Object;
        response.type = 'notificationHalt';
        if (moveEvent[Sessions[SessionID].P1] && moveEvent[Sessions[SessionID].P1]._destroyed === false)
            clearInterval(moveEvent[Sessions[SessionID].P1]);
        if (moveEvent[Sessions[SessionID].P2] && moveEvent[Sessions[SessionID].P2]._destroyed === false)
            clearInterval(moveEvent[Sessions[SessionID].P2]);
        clearInterval(Sessions[SessionID].boardcast);
        if (ClientList[Sessions[SessionID].P1].readyState === WebSocket.OPEN) {
            ClientList[Sessions[SessionID].P1].send(JSON.stringify(response));
            user[Sessions[SessionID].P1].state = 'login';
        }
        if (ClientList[Sessions[SessionID].P2].readyState === WebSocket.OPEN) {
            ClientList[Sessions[SessionID].P2].send(JSON.stringify(response));
            user[Sessions[SessionID].P2].state = 'login';
        }
        delete PlayerList[Sessions[SessionID].P1];
        delete PlayerList[Sessions[SessionID].P2];
        delete Sessions[SessionID];
        delete ClientList[userid];
        delete user[userid];
    }
}

/**
 * 功能: 查询用户战绩
 * @param {Object} data 收到的数据
 * @param {Number} userid 用户ID
 */
async function RecordQuery(data, userid) {
    let rows = query.all(userid, userid);
    let res = [];
    rows.forEach((row) => { res.push(JSON.stringify(row)) });
    ClientList[userid].send(JSON.stringify({ type: 'responseQuery', res: res.join('|') }));
}

// 启用WebSocket服务器, 监听(默认)10086端口, 支持压缩传输
const server = new WebSocket.Server({ port: PORT, perMessageDeflate: true }, () => {
    LogMsg('Info: Game Server UP!')
});

// 处理连接
server.on('connection', async (connect, req) => {
    let userid = -1;
    connect.on('message', async (msg) => {
        let data = JSON.parse(msg);
        if (data.type === 'requestConnect') {
            // 通过打印结果可知, 客户端会发送SessionID。因此可保存来自express的会话 需要会话数据库或本地会话存储
            // 由于设计为网页和应用服务器分离, 因此升级版可以采用MySQL等联网数据库作为会话数据库
            // console.log(req.headers.cookie);
            jwt.verify(data.token, config.tokenSecret, { algorithms: 'HS256' }, (error, decryped) => {
                if (error) {
                    LogMsg(`Audit: Invalid token - ${data.username}`);
                    connect.send(JSON.stringify({ type: 'responseConnect', result: 'failed', reason: '凭据错误，请重新登录' }));
                    connect.close();
                    return;
                } else {
                    if (data.userid != decryped.userid || data.username !== decryped.username) {
                        LogMsg(`Audit: Invalid token - ${data.username}`);
                        connect.send(JSON.stringify({ type: 'responseConnect', result: 'failed', reason: '凭据错误，请重新登录' }));
                        connect.close();
                        return;
                    }
                    if (user[decryped.userid] !== undefined) {
                        LogMsg(`Audit: Repeated login - ${data.username}`);
                        connect.send(JSON.stringify({ type: 'responseConnect', result: 'failed', reason: '已在别处登录' }));
                        connect.close();
                        return;
                    }
                    userid = decryped.userid;
                    ClientList[userid] = connect;
                    user[userid] = new Object;
                    user[userid].username = decryped.username;
                    user[userid].state = 'login';
                    LogMsg(`Info: ${data.username} has logged in & the socket is ${req.socket.remoteAddress}:${req.socket.remotePort}`);
                    connect.send(JSON.stringify({ type: 'responseConnect', result: 'pass', userid: decryped.userid, username: decryped.username }));
                }
            })
        }
        MessageHandler(data, userid);
    })

    connect.on('close', async (code, reason) => {
        LogMsg(`Info: connection from ${req.socket.remoteAddress}:${req.socket.remotePort} closed`);
        // console.log(`code: ${code}`);
        // console.log(`reason: ${reason}`);
        NetworkHaltHandler(userid);
    })

    connect.on('error', async (code, reason) => {
        LogMsg(`Warn: an error occurred from ${req.socket.remoteAddress}`);
        console.log(`code: ${code}`);
        console.log(`reason: ${reason}`);
        NetworkHaltHandler(userid);
    })
})