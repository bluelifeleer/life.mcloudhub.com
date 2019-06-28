'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const http2 = require('spdy');
const express = require('express');
const assert = require('assert');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const csurf = require('csurf');
const session = require('express-session');
const morgan = require('morgan');
const rfs = require('rotating-file-stream');
const sillyDateTime = require('silly-datetime');
const MongoDBStore = require('connect-mongodb-session')(session);
const mongoose = require('mongoose');
mongoose.Promise = require('bluebird');
const uuidv4 = require('uuid/v4');
const expressRequestId = require('express-request-id')();
const favicon = require('serve-favicon')
const md5 = require('md5');
const swig = require('swig');
const app = express();
const START_LOG = true;
// let ssloptions = {
//     key: fs.readFileSync(path.join(__dirname + '/ssl/blog.mcloudhub.com.key')),
//     cert: fs.readFileSync(path.join(__dirname + '/ssl/blog.mcloudhub.com.pem'))
// };

//设置模板引擎
app.engine('html', swig.renderFile);
//  设置模板路径
app.set('views', path.join(__dirname, '/application/views'));
// 注册模板
app.set('view engine', 'html');
// 不保存视图缓存
app.set('view cache', false);
// 将模板缓存设置false
swig.setDefaults({
    cache: false
});
app.use(helmet());
app.use(cors());
// 设置request id
app.use(expressRequestId);
// extends设置true表示接收的数据是数组，false表示是字符串
app.use(bodyParser.urlencoded({
    extended: true
}));
// 将提交的数据转成json,并且设置请求实体大小
app.use(bodyParser.json({
    limit: '50mb'
}));
app.use(bodyParser.urlencoded({
    limit: '50mb',
    extended: true
}));
app.use(cookieParser('session_id', {
    maxAge: 1800000,
    secure: true
}));
// app.use(expressCurl);

const store = new MongoDBStore({
    uri: 'mongodb://localhost:27017',
    databaseName: 'life',
    collection: 'sessions'
}, err => {
    if (err) throw err;
});

store.on('error', error => {
    assert.ifError(error);
    assert.ok(false);
});

app.use(session({
    genid: function(req) {
        return uuidv4() // use UUIDs for session IDs
    },
    secret: 'session_id', // 与cookieParser中的一致
    resave: true,
    store: store, // 将session保存到mongodb中
    saveUninitialized: true,
    cookie: {
        secure: true,
        maxAge: 1800000,
    },
    rolling: true
}));

// 服务器启动时默认配置/动作
app.use(function(req, res, next) {
    // //将登录后的用户信息附加到request头信息中
    if (req.cookies.uid && req.cookies.uid != '') {
        try {
            req.session.uid = req.cookies.uid;
        } catch (e) {
            console.log(e);
        }
    }
    // 将系统类型添加到cookies和请求头中;
    // os.platform return now node runing systems : darwin=>MAC win32=>windows
    res.cookie('platform', os.platform);
    req.platform = os.platform;
    next();
});

app.use(csurf({
    cookie: true,
    ignoreMethods: ['GET', 'POST']
}));
app.use(function(err, req, res, next) {
    if (err.code !== 'EBADCSRFTOKEN') return next(err)
        // handle CSRF token errors here
    res.status(403)
    res.send('form tampered with')
});

// 记录访问日志
if (START_LOG) {
    const logDirectory = path.join(__dirname, '/','logs');
    fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory); // 日志目录不存在创建目录
    const logerFile = 'access_' + sillyDateTime.format(new Date(), 'YYYY_MMM_DD') + '.log';
    const accessLogStream = rfs(logerFile, {
        interval: '1d', // 日志切割间隔为1天，以s,m,h,d为单位
        path: logDirectory, // 日志保存路径，
        size: '1M', // 单个日志文件的大小，以B,K,M,G为单位
        compress: true // 压缩日志
    });
    app.use(morgan('combined', {
        stream: accessLogStream
    }));
}

//设置静态文件托管
app.use('/static', express.static(path.join(__dirname, '/application/statics')));
// app.use(favicon(path.join(__dirname, '/', 'favicon.ico')))
app.use('/', require(path.join(__dirname,'/application/routers/index')));
// app.user('/note', require(path.join(__dirname,'/application/routers/note'));
// app.use('/api', require(path.join(__dirname,'/application/routers/api')));
// app.use('/task', require(path.join(__dirname,'/application/routers/task')));

mongoose.connect('mongodb://localhost:27017/life', {
    useNewUrlParser: true
}, (err, res) => {
    if (err) {
        console.log(err);
    } else {
        // 数据库连接成功后监听80/443端口
        // app.listen(80);
        http.createServer(app).listen(3000);
        // https.createServer(options, app).listen(443);
        // const server = http2.createServer(options, app);
        // 返回进程环境信息
        // console.log(process.env);
        // server.listen(443);
    }
});
module.exports = app;