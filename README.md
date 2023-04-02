# BadmintonGame

这是我们的课程作业，我们是第一次接触网络程序设计，因此代码可能有很多不完善的地方（屎山）。如果您有更好的建议，欢迎与我们联系帮助我们优化代码。

# 开发环境

我们的开发时使用的工具如下：

- Windows 11
- Python 3.11
- NodeJS 18.15.0 on Windows x64
- Windows 11 SDK 22000 (VS2022) (用于编译better-sqlite3模块)
- Microsoft Edge 111

我们测试时使用过的环境如下：

- NodeJS 19.6.1 on Android 13 aarch64 Termux 0.118.0
- NodeJS 18.15.0 on Ubuntu 22.04 amd64
- Safari on iPadOS 16.5
- Safari on macOS 13
- Chrome 111

# 使用方法  

0. 我们的项目主要使用NodeJS来运行，但是您需要安装除了NodeJS以外的工具才能确保不出现意外情况。具体而言，您需要在电脑中安装：Python3、C语言编译器（Linux环境下为gcc/clang/llvm，Windows下需要Visual Studio的桌面C/C++开发模块）。您可以运行NodeJS提供的`Install Additional Tools for Node.js`来在Windows系统下补全开发环境。最重要的是，我们采用了SQLite3作为数据库工具，您需要安装SQLite3来支持我们的数据库功能。

1. 您可以使用`git clone https://github.com/GUOBAJUN/BadmintonGame.git`命令将我们的项目克隆到您的本地设备。或者在GitHub界面中下载本项目的zip压缩包，并解压到本地文件夹。

2. 分别进入Game和Server文件夹，在此处打开终端，并输入`npm install`安装所需的NodeJS模块。再次注意，安装这些模块时，您的电脑上需要安装NodeJS，Python3以及C语言编译器。特别当您需要将项目部署到Windows电脑中时，需要注意开发环境是否完善。

3. 参考databases文件夹下的readme.txt，将数据库放至对应文件夹下。

4. 分别在Game和Server目录下运行`node express.js`和`node server.js`命令，服务器即可正常运行。通过浏览器访问服务器的8080端口，例如在浏览器地址栏输入`http://localhost:8080/`，即可进入登录注册界面。

# 我们踩的坑

1. 在开发环境齐全的情况下，NodeJS模块安装不成功。如果您发现输出日志中包含访问GitHub失败的情况下，就是您的网络状况较差，需要处理一下网络再运行`npm install`

2. 我们测试时有将服务器部署进Android手机。我们使用的设备为Redmi K40 (Snapdragon 870 device)，运行的操作系统为MIUI14 based on Android 13，没有root权限。您可能需要在Termux中安装`termux-chroot`包，才能解决在编译better-sqlite3权限不足的问题。如果您的手机获取了root权限，也可以试试直接在特权模式下安装。此外Termux中的开发环境不是特别完善，您可能需要安装`binutils`包才能安装better-sqlite3模块。

# 注意

1. 请不要将本项目部署到不可信的网络中。由于这是我们的课程作业，因此它并没有设计较强的安全性，无法在不可信网络中保证用户数据和服务器的安全。至少我们没有避免用户信息的明文传输，也没有配置https。

2. 因此，也不建议在测试登录注册功能时使用自己的常用密码。