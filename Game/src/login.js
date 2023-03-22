$(document).ready(function () {
    // 切换到注册表单
    $('#register_link').on('click', function (event) {
        event.preventDefault();
        $('#login_form').slideUp('normal', function () {
            $('#register_form').slideDown('normal');
        });
    });
    // 切换到登录表单
    $('#login_link').on('click', function (event) {
        event.preventDefault();
        $('#register_form').slideUp('normal', function () {
            $('#login_form').slideDown('normal');
        });
    });
    // 使用Ajax提交登录表单
    $('#login_form').submit(function (event) {
        event.preventDefault();
        const form = $(this);
        const username = form.find('#username').val();
        const password = form.find('#password').val();
        const type = 'login';
        const loginData = { type, username, password };
        $.ajax({
            url: '/login',
            method: 'POST',
            data: JSON.stringify(loginData),
            contentType: 'application/json',
            xhrFields: {
                withCredentials: true
            }, // 使用cookie
            success: (data) => {
                console.log(data);
                const url = `/index?username=${data.username}&id=${data.id}&token=${data.token}`;
                window.location.href = url;
            },
            error: (data) => {
                console.error('Login failed');
                document.getElementById('tips').textContent = data.msg;
                document.getElementById('tips').style.display = '';
            }
        })
    });
    // 使用Ajax提交注册表单
    $('#register_form').submit(function (event) {
        event.preventDefault();
        const form = $(this);
        const username = form.find('#register_username').val();
        const password = form.find('#register_password').val();
        const repeat = form.find('#repeat_password').val();
        console.log(form.find('#register_password'))
        console.log(password);
        //正则表达式判断是否符合要求
        const uppercasRegex = /[A-Z]/;
        const lowercasRegex = /[a-z]/;
        const numberRegex = /[0-9]/;
        const charRegex = /[^A-Za-z0-9_]/;
        let cnt = 0;
        if (password !== repeat) {
            document.getElementById('regtips').textContent = '两次密码不一致哦';
            document.getElementById('regtips').style.display = '';
            return;
        }
        if (password.length < 8 || password.length>16) {
            document.getElementById('regtips').textContent = '密码不符合要求哦';
            document.getElementById('regtips').style.display = '';
            return;
        }
        if (uppercasRegex.test(password)) cnt++;
        if (lowercasRegex.test(password)) cnt++;
        if (numberRegex.test(password)) cnt++;
        if (charRegex.test(password)) cnt++;
        if (cnt < 3) {
            console.log(cnt);
            console.log(password);
            document.getElementById('regtips').textContent = '密码不符合要求哦';
            document.getElementById('regtips').style.display = '';
            return;
        }
        const type = 'register';
        const registerData = { type, username, password };
        $.ajax({
            url: '/login',
            method: 'POST',
            data: JSON.stringify(registerData),
            contentType: 'application/json',
            xhrFields: {
                withCredentials: true
            },
            success: (data) => {
                const url = `/login`;
                document.getElementById('regtips').textContent = '注册成功！即将回到登录界面';
                document.getElementById('regtips').style.display = '';
                setTimeout(() => { window.location.href = url; }, 1000);
            },
            error: (data) => {
                console.error('Register failed');
                document.getElementById('regtips').textContent = data.msg;
                document.getElementById('regtips').style.display = '';
            }
        })
    })
});
