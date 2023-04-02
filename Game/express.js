/***********************
 * 游戏界面服务器      *
 * 郭钰鑫 段向鑫       *
 ***********************/


const express = require('express');                // express框架
const cors = require('cors');                      // 路由源控制中间件
const compression = require('compression');        // 启用压缩中间件
const Database = require('better-sqlite3');        // 连接SQLite3数据库
const session = require('express-session');        // 启用Session-Cookie中间件
const bodyparser = require('body-parser');         // 将body转换为JSON中间件
const cookieParser = require('cookie-parser');     // 将Cookie转换为JSON中间件
const path = require('path');                      // 路径处理模块
const md5 = require('blueimp-md5');                // md5计算
const jwt = require('jsonwebtoken');               // JWT生成与校验 json web token
const config = require('./config.js');             // 读取config -> 存储有密钥

const port = process.env.port || process.env.PORT || 8080
const dbPath = path.join(__dirname, 'game.db');
const apiRoot = '/api';
const cookieLive = 60 * 60 * 1000;                                              //session过期时间1h

const db = new Database(dbPath);                                                // 连接到账户数据库
const stmt = db.prepare('SELECT * FROM USER WHERE USERNAME = ?');               // 查询账户信息
const ins = db.prepare('INSERT INTO USER (USERNAME, PASSWORD) VALUES (?, ?)');  // 添加账户信息

const app = express();                                                          // 创建express实例

app.use(express.static(__dirname, { index: false }));                           // 将css、img等文件所在路径进行静态路由

app.use(cookieParser(config.sessionSecret));                                    // 使用cookie转换为json中间件
app.use(bodyparser.urlencoded({ extended: true }));                             // 启用url解析中间件
app.use(bodyparser.json());                                                     // 启用body转换为json中间件
app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false
    } // not safe but just for the lecture work
}))                                                                             // 启用Session中间件
app.use(compression());
// app.use(cors({ origin: 'http://localhost/' }));                              // 只允许loclahost访问
app.use(cors());                                                                // 启用路由源控制(cors)中间件
app.options('*', cors());


const router = new express.Router();                                                // 创建'/'目录路由器

/*
 *处理: GET / 请求
 *功能: 在登录会话有效期内直接跳转到游戏主界面index.html; 非登录状态进入登录注册界面login.html
 */
router.get('/', (req, res) => {
    if (req.session !== undefined && req.session.isLogin == true) {
        let token = jwt.sign({ username: data.USERNAME, userid: data.ID }, config.tokenSecret, { expiresIn: '1m', algorithm: 'HS256' });
        req.session.token = token;
        return res.status(200).redirect(`index.html?username=${req.session.username}&id=${req.session.userid}&token=${req.session.token}`)
    }
    res.sendFile(path.join(__dirname, 'login.html'));
})

/*
 *处理: GET /login请求
 *功能: 在登录会话有效期内直接跳转到游戏主界面index.html; 非登录状态进入登录注册界面login.html
 */
router.get('/login', (req, res) => {
    if (req.session !== undefined && req.session.isLogin === true) {
        let token = jwt.sign({ username: data.USERNAME, userid: data.ID }, config.tokenSecret, { expiresIn: '1m', algorithm: 'HS256' });
        req.session.token = token;
        return res.status(200).redirect(`index.html?username=${req.session.username}&id=${req.session.id}&token=${req.session.token}`)
    }
    res.sendFile(path.join(__dirname, 'login.html'));
})

/**
 * 处理: GET /index请求
 * 功能: 在登录会话有效期内直接跳转到游戏主界面index.html; 非登录状态进入登录注册界面login.html
 */
router.get('/index', (req, res) => {
    if (req.session.isLogin === undefined || req.session.isLogin === false) {
        return res.status(401).redirect(`/login.html`);
    } else {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
})

const apiRouter = new express.Router(); // API路由，处理账号相关请求

/**
 * 处理: POST /api/login请求
 * 功能: 处理登录请求并返回结果
 * Further Develop: 启用会话存储或会话数据库, 保存会话信息便于多服务器共享 -> 数据库应当使用MySQL等联网数据库
*/
apiRouter.post('/login', (req, res) => {
    const body = req.body;
    let row;
    new Promise((resolve, rejects) => {
        // 查询账户数据库, 检查是否有该用户
        try {
            row = stmt.get(body.username);
            resolve(row);
        } catch (err) {
            console.log(err.message);
            rejects(err);
        }
    }).then((data) => {
        if (data === undefined) {
            return res.status(404).send({ success: false, msg: '找不到该用户' })
        } else {
            // 检查密码
            if (md5(body.password) === data.PASSWORD) {
                req.session.cookie.expires = new Date(Date.now() + cookieLive);
                req.session.cookie.maxAge = cookieLive;
                req.session.cookie.username = data.USERNAME;
                req.session.cookie.userid = data.ID;
                req.session.isLogin = true;
                req.session.username = data.USERNAME;
                req.session.userid = data.ID; // 配置Session
                let token = jwt.sign({ username: data.USERNAME, userid: data.ID }, config.tokenSecret, { expiresIn: '1m', algorithm: 'HS256' });
                req.session.token = token;
                LogMsg(`Info: ${data.USERNAME} has logged in`);
                return res.status(200).setHeader('set-cookies', req.session.cookie).send({ success: true, msg: '登录成功', username: body.username, id: data.ID, token: token });
            } else {
                LogMsg(`Audit: Wrong passwd - ${data.USERNAME}`);
                return res.status(401).send({ success: false, msg: '密码错误，请检查用户名或密码' });
            }
        }
    })
})

/**
 * 处理: POST /api/register请求
 * 功能: 处理注册请求并返回结果
 * Further Develop: 启用会话存储或会话数据库, 保存会话信息便于多服务器共享 -> 数据库应当使用MySQL等联网数据库
*/
apiRouter.post('/register', (req, res) => {
    const body = req.body;
    let row;
    new Promise((resolve, rejects) => {
        // 查询数据库,是否已存在该用户
        try {
            row = stmt.get(body.username);
            resolve(row);
        } catch (err) {
            console.log(err.message);
            rejects(err);
        }
    }).then((data) => {
        if (data !== undefined) {
            LogMsg(`Audit: Repeated Register ${body.username}`);
            return res.status(400).send({ success: false, msg: '该用户已存在' })
        } else {
            let pwd = md5(body.password);
            let result = ins.run(body.username, pwd);
            LogMsg(`Info: New user registered - ${body.username}`);
            res.status(200).send({ success: true, msg: '注册成功' }) // 更新数据库
        }
    })
})

/**
 * 处理: GET /api/logout请求
 * 功能: 推出登录并返回登录界面
 */
apiRouter.get('/logout', (req, res) => {
    req.session.isLogin = false;
    req.session.token = '';
    LogMsg(`Info: ${req.session.username} has logged out`);
    return res.status(200).redirect('/login')
})

app.use('/', router);  // 启用'/'路由
app.use(apiRoot, apiRouter); //启用api路由

app.listen(port, () => { // 监听(默认)8080端口,并打印日志
    LogMsg('Info: Web Server UP!')
})

/**
 * 功能: 日志打印
 * @param {String} msg 
 */
function LogMsg(msg) {
    let date = new Date()
    console.log(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}]${msg}`);
}