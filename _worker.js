import { connect } from 'cloudflare:sockets';

let userID = '';
let proxyIP = '';
//let sub = '';
let subConverter = atob('U1VCQVBJLkNNTGl1c3Nzcy5uZXQ=');
let subConfig = atob('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0FDTDRTU1IvQUNMNFNTUi9tYXN0ZXIvQ2xhc2gvY29uZmlnL0FDTDRTU1JfT25saW5lX01pbmlfTXVsdGlNb2RlLmluaQ==');
let subProtocol = 'https';
let subEmoji = 'true';
let socks5Address = '';
let parsedSocks5Address = {};
let enableSocks = false;

let noTLS = 'false';
const expire = -1;
let proxyIPs;
let socks5s;
let go2Socks5s = [
	'*ttvnw.net',
	'*tapecontent.net',
	'*cloudatacdn.com',
	'*.loadshare.org',
];
let addresses = [];
let addressesapi = [];
let addressesnotls = [];
let addressesnotlsapi = [];
let addressescsv = [];
let DLS = 8;
let remarkIndex = 1;
let FileName = atob('ZWRnZXR1bm5lbA==');
let BotToken;
let ChatID;
let proxyhosts = [];
let proxyhostsURL = '';
let RproxyIP = 'false';
let httpsPorts = ["2053", "2083", "2087", "2096", "8443"];
let httpPorts = ["8080", "8880", "2052", "2082", "2086", "2095"];
let 有效时间 = 7;
let 更新时间 = 3;
let userIDLow;
let userIDTime = "";
let proxyIPPool = [];
let path = '/?ed=2560';
let 动态UUID;
let link = [];
let banHosts = [atob('c3BlZWQuY2xvdWRmbGFyZS5jb20=')];

// 添加工具函数
const utils = {
	// UUID校验
	isValidUUID(uuid) {
		const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		return uuidPattern.test(uuid);
	},

	// Base64处理
	base64: {
		toArrayBuffer(base64Str) {
			if (!base64Str) return { earlyData: undefined, error: null };
			try {
				base64Str = base64Str.replace(/-/g, '+').replace(/_/g, '/');
				const decoded = atob(base64Str);
				const arrayBuffer = Uint8Array.from(decoded, c => c.charCodeAt(0));
				return { earlyData: arrayBuffer.buffer, error: null };
			} catch (error) {
				return { earlyData: undefined, error };
			}
		}
	},
};

// WebSocket连接管理类
class WebSocketManager {
	constructor(webSocket, log) {
		this.webSocket = webSocket;
		this.log = log;
		this.readableStreamCancel = false;
		this.backpressure = false;
		this.messageQueue = [];
		this.isProcessing = false; // 标志：是否正在处理队列
	}

	makeReadableStream(earlyDataHeader) {
		return new ReadableStream({
			start: (controller) => this.handleStreamStart(controller, earlyDataHeader),
			pull: (controller) => this.handleStreamPull(controller),
			cancel: (reason) => this.handleStreamCancel(reason),
		});
	}

	async handleStreamStart(controller, earlyDataHeader) {
		try {
			this.webSocket.addEventListener('message', (event) => {
				if (this.readableStreamCancel) return;
				
				if (!this.backpressure) {
					this.processMessage(event.data, controller);
				} else {
					this.messageQueue.push(event.data);
					this.log('Backpressure detected, message queued');
				}
			});

			this.webSocket.addEventListener('close', () => this.handleClose(controller));
			this.webSocket.addEventListener('error', (err) => this.handleError(err, controller));

			// 处理早期数据
			await this.handleEarlyData(earlyDataHeader, controller);
		} catch (error) {
			this.log(`Stream start error: ${error.message}`);
			controller.error(error);
		}
	}

	async processMessage(data, controller) {
		// 防止并发执行，保证消息按顺序处理
		if (this.isProcessing) {
			this.messageQueue.push(data);
			return;
		}

		this.isProcessing = true;
		try {
			controller.enqueue(data);
			
			// 处理消息队列
			while (this.messageQueue.length > 0 && !this.backpressure) {
				const queuedData = this.messageQueue.shift();
				controller.enqueue(queuedData);
			}
		} catch (error) {
			this.log(`Message processing error: ${error.message}`);
		} finally {
			this.isProcessing = false;
		}
	}

	handleStreamPull(controller) {
		if (controller.desiredSize > 0) {
			this.backpressure = false;

			// 立即处理排队的消息
			while (this.messageQueue.length > 0 && controller.desiredSize > 0) {
				const data = this.messageQueue.shift();
				this.processMessage(data, controller);
			}
		} else {
			this.backpressure = true;
		}
	}

	handleStreamCancel(reason) {
		if (this.readableStreamCancel) return;
		
		this.log(`Readable stream canceled, reason: ${reason}`);
		this.readableStreamCancel = true;
		this.cleanup();
	}

	handleClose(controller) {
		this.cleanup();
		if (!this.readableStreamCancel) {
			controller.close();
		}
	}

	handleError(err, controller) {
		this.log(`WebSocket error: ${err.message}`);
		if (!this.readableStreamCancel) {
		controller.error(err);
		}
		this.cleanup();
	}

	async handleEarlyData(earlyDataHeader, controller) {
		const { earlyData, error } = utils.base64.toArrayBuffer(earlyDataHeader);
		if (error) {
			controller.error(error);
		} else if (earlyData) {
			controller.enqueue(earlyData);
		}
	}

	cleanup() {
		if (this.readableStreamCancel) return;
		this.readableStreamCancel = true;

		this.messageQueue = [];
		this.isProcessing = false;
		this.backpressure = false;

		safeCloseWebSocket(this.webSocket);
	}
}

export default {
	async fetch(request, env, ctx) {
		try {
			const UA = request.headers.get('User-Agent') || 'null';
			const userAgent = UA.toLowerCase();
			userID = env.UUID || env.uuid || env.PASSWORD || env.pswd || userID;
			if (env.KEY || env.TOKEN || (userID && !utils.isValidUUID(userID))) {
				动态UUID = env.KEY || env.TOKEN || userID;
				有效时间 = Number(env.TIME) || 有效时间;
				更新时间 = Number(env.UPTIME) || 更新时间;
				const userIDs = await 生成动态UUID(动态UUID);
				userID = userIDs[0];
				userIDLow = userIDs[1];
			}

			if (!userID) {
				// 生成美化后的系统信息页面
				const html = `
				<!DOCTYPE html>
						<html>
						<head>
							<meta charset="utf-8">
							<meta name="viewport" content="width=device-width, initial-scale=1">
							<title>系统信息</title>
							<style>
								:root {
									--primary-color: #4CAF50;
									--border-color: #e0e0e0;
									--background-color: #f5f5f5;
									--warning-bg: #fff3f3;
									--warning-border: #ffcdd2;
									--warning-text: #d32f2f;
								}
								
								body {
									margin: 0;
									padding: 20px;
									font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
									line-height: 1.6;
									background-color: var(--background-color);
								}

								.container {
									max-width: 800px;
									margin: 0 auto;
									background: white;
									padding: 25px;
									border-radius: 10px;
									box-shadow: 0 2px 10px rgba(0,0,0,0.1);
								}

								.title {
									font-size: 1.5em;
									color: var(--primary-color);
									margin-bottom: 20px;
									display: flex;
									align-items: center;
									gap: 10px;
								}

								.title .icon {
									font-size: 1.2em;
								}

								.warning-box {
									background-color: var(--warning-bg);
									border: 1px solid var(--warning-border);
									border-radius: 6px;
									padding: 15px;
									margin-bottom: 20px;
									color: var(--warning-text);
									display: flex;
									align-items: center;
									gap: 10px;
								}

								.warning-box .icon {
									font-size: 1.2em;
								}

								.info-grid {
									display: grid;
									grid-template-columns: auto 1fr;
									gap: 12px;
									background: #fff;
									border-radius: 8px;
									overflow: hidden;
								}

								.info-row {
									display: contents;
								}

								.info-row:hover > * {
									background-color: #f8f9fa;
								}

								.info-label {
									padding: 12px 15px;
									color: #666;
									font-weight: 500;
									border-bottom: 1px solid var(--border-color);
								}

								.info-value {
									padding: 12px 15px;
									color: #333;
									border-bottom: 1px solid var(--border-color);
								}

								.info-row:last-child .info-label,
								.info-row:last-child .info-value {
									border-bottom: none;
								}

								@media (max-width: 768px) {
									body {
										padding: 10px;
									}
									
									.container {
										padding: 15px;
									}
								}
							</style>
						</head>
						<body>
							<div class="container">
								<div class="title">
									<span class="icon">🔍</span>
									系统信息
								</div>

								<div class="warning-box">
									<span class="icon">⚠️</span>
									请设置你的 UUID 变量，或尝试重新部署，检查变量是否生效
								</div>

								<div class="info-grid">
									<div class="info-row">
										<div class="info-label">TLS 版本</div>
										<div class="info-value">${request.cf?.tlsVersion || 'TLSv1.3'}</div>
									</div>
									<div class="info-row">
										<div class="info-label">HTTP 协议</div>
										<div class="info-value">${request.cf?.httpProtocol || 'HTTP/2'}</div>
									</div>
									<div class="info-row">
										<div class="info-label">客户端 TCP RTT</div>
										<div class="info-value">${request.cf?.clientTcpRtt || '3'} ms</div>
									</div>
									<div class="info-row">
										<div class="info-label">地理位置</div>
										<div class="info-value">${request.cf?.continent || 'EU'}</div>
									</div>
									<div class="info-row">
										<div class="info-label">时区</div>
										<div class="info-value">${request.cf?.timezone || 'Europe/Vilnius'}</div>
									</div>
									<div class="info-row">
										<div class="info-label">客户端 IP</div>
										<div class="info-value">${request.headers.get('CF-Connecting-IP') || '127.0.0.1'}</div>
									</div>
									<div class="info-row">
										<div class="info-label">User Agent</div>
										<div class="info-value">${request.headers.get('User-Agent') || 'Mozilla/5.0'}</div>
									</div>
								</div>
							</div>
						</body>
						</html>`;

				return new Response(html, {
					status: 200,
					headers: {
						'content-type': 'text/html;charset=utf-8',
					},
				});
			}

			const currentDate = new Date();
			currentDate.setHours(0, 0, 0, 0);
			const timestamp = Math.ceil(currentDate.getTime() / 1000);
			const fakeUserIDSHA256 = await 双重哈希(`${userID}${timestamp}`);
			const fakeUserID = [
                fakeUserIDSHA256.slice(0, 8),
                fakeUserIDSHA256.slice(8, 12),
                fakeUserIDSHA256.slice(12, 16),
                fakeUserIDSHA256.slice(16, 20),
                fakeUserIDSHA256.slice(20, 32) 
			].join('-');

			const fakeHostName = `${fakeUserIDSHA256.slice(6, 9)}.${fakeUserIDSHA256.slice(13, 19)}`;

			// 修改PROXYIP初始化逻辑
			if (env.KV) {
				try {
					const customProxyIP = await env.KV.get('PROXYIP.txt');
					// 只有当KV中有非空值时才覆盖默认设置
					if (customProxyIP && customProxyIP.trim()) {
						proxyIP = customProxyIP;
					}
				} catch (error) {
					console.error('读取自定义PROXYIP时发生错误:', error);
				}
			}
			// 如果proxyIP为空，则使用环境变量或默认值
			proxyIP = proxyIP || env.PROXYIP || env.proxyip || '';
			proxyIPs = await 整理(proxyIP);
			proxyIP = proxyIPs.length > 0 ? proxyIPs[Math.floor(Math.random() * proxyIPs.length)] : '';

			// 修改SOCKS5地址初始化逻辑
			if (env.KV) {
				try {
					const kvSocks5 = await env.KV.get('SOCKS5.txt');
					// 只有当KV中有非空值时才覆盖默认设置
					if (kvSocks5 && kvSocks5.trim()) {
						socks5Address = kvSocks5.split('\n')[0].trim();
					}
				} catch (error) {
					console.error('读取SOCKS5设置时发生错误:', error);
				}
			}
			// 如果socks5Address为空，则使用环境变量或默认值
			socks5Address = socks5Address || env.SOCKS5 || '';
			socks5s = await 整理(socks5Address);
			socks5Address = socks5s.length > 0 ? socks5s[Math.floor(Math.random() * socks5s.length)] : '';
			socks5Address = socks5Address.split('//')[1] || socks5Address;

			if (env.GO2SOCKS5) go2Socks5s = await 整理(env.GO2SOCKS5);
			if (env.CFPORTS) httpsPorts = await 整理(env.CFPORTS);
			if (env.BAN) banHosts = await 整理(env.BAN);
			if (socks5Address) {
				try {
					parsedSocks5Address = socks5AddressParser(socks5Address);
					RproxyIP = env.RPROXYIP || 'false';
					enableSocks = true;
				} catch (err) {
					let e = err;
					console.log(e.toString());
					RproxyIP = env.RPROXYIP || !proxyIP ? 'true' : 'false';
					enableSocks = false;
				}
			} else {
				RproxyIP = env.RPROXYIP || !proxyIP ? 'true' : 'false';
			}

			const upgradeHeader = request.headers.get('Upgrade');
			const url = new URL(request.url);
			if (!upgradeHeader || upgradeHeader !== 'websocket') {
				if (env.ADD) addresses = await 整理(env.ADD);
				if (env.ADDAPI) addressesapi = await 整理(env.ADDAPI);
				if (env.ADDNOTLS) addressesnotls = await 整理(env.ADDNOTLS);
				if (env.ADDNOTLSAPI) addressesnotlsapi = await 整理(env.ADDNOTLSAPI);
				if (env.ADDCSV) addressescsv = await 整理(env.ADDCSV);
				DLS = Number(env.DLS) || DLS;
				remarkIndex = Number(env.CSVREMARK) || remarkIndex;
				BotToken = env.TGTOKEN || BotToken;
				ChatID = env.TGID || ChatID;
				FileName = env.SUBNAME || FileName;
				subEmoji = env.SUBEMOJI || env.EMOJI || subEmoji;
				if (subEmoji == '0') subEmoji = 'false';
				if (env.LINK) link = await 整理(env.LINK);
				let sub = env.SUB || '';
				subConverter = env.SUBAPI || subConverter;
				if (subConverter.includes("http://")) {
					subConverter = subConverter.split("//")[1];
					subProtocol = 'http';
				} else {
					subConverter = subConverter.split("//")[1] || subConverter;
				}
				subConfig = env.SUBCONFIG || subConfig;
				if (url.searchParams.has('sub') && url.searchParams.get('sub') !== '') sub = url.searchParams.get('sub');
				if (url.searchParams.has('notls')) noTLS = 'true';

				if (url.searchParams.has('proxyip')) {
					path = `/?proxyip=${url.searchParams.get('proxyip')}`;
					RproxyIP = 'false';
				} else if (url.searchParams.has('socks5')) {
					path = `/?socks5=${url.searchParams.get('socks5')}`;
					RproxyIP = 'false';
				} else if (url.searchParams.has('socks')) {
					path = `/?socks5=${url.searchParams.get('socks')}`;
					RproxyIP = 'false';
				}

				const 路径 = url.pathname.toLowerCase();
				if (路径 == '/') {
					if (env.URL302) return Response.redirect(env.URL302, 302);
					else if (env.URL) return await 代理URL(env.URL, url);
					else {
						// 生成美化后的系统信息页面
						const html = `
						<!DOCTYPE html>
						<html>
						<head>
							<meta charset="utf-8">
							<meta name="viewport" content="width=device-width, initial-scale=1">
							<title>系统信息</title>
							<style>
								:root {
									--primary-color: #4CAF50;
									--border-color: #e0e0e0;
									--background-color: #f5f5f5;
									--warning-bg: #fff3f3;
									--warning-border: #ffcdd2;
									--warning-text: #d32f2f;
								}
								
								body {
									margin: 0;
									padding: 20px;
									font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
									line-height: 1.6;
									background-color: var(--background-color);
								}

								.container {
									max-width: 800px;
									margin: 0 auto;
									background: white;
									padding: 25px;
									border-radius: 10px;
									box-shadow: 0 2px 10px rgba(0,0,0,0.1);
								}

								.title {
									font-size: 1.5em;
									color: var(--primary-color);
									margin-bottom: 20px;
									display: flex;
									align-items: center;
									gap: 10px;
								}

								.title .icon {
									font-size: 1.2em;
								}

								.warning-box {
									background-color: var(--warning-bg);
									border: 1px solid var(--warning-border);
									border-radius: 6px;
									padding: 15px;
									margin-bottom: 20px;
									color: var(--warning-text);
									display: flex;
									align-items: center;
									gap: 10px;
								}

								.warning-box .icon {
									font-size: 1.2em;
								}

								.info-grid {
									display: grid;
									grid-template-columns: auto 1fr;
									gap: 12px;
									background: #fff;
									border-radius: 8px;
									overflow: hidden;
								}

								.info-row {
									display: contents;
								}

								.info-row:hover > * {
									background-color: #f8f9fa;
								}

								.info-label {
									padding: 12px 15px;
									color: #666;
									font-weight: 500;
									border-bottom: 1px solid var(--border-color);
								}

								.info-value {
									padding: 12px 15px;
									color: #333;
									border-bottom: 1px solid var(--border-color);
								}

								.info-row:last-child .info-label,
								.info-row:last-child .info-value {
									border-bottom: none;
								}

								@media (max-width: 768px) {
									body {
										padding: 10px;
									}
									
									.container {
										padding: 15px;
									}
								}
							</style>
						</head>
						<body>
							<div class="container">
								<div class="title">
									<span class="icon">🔍</span>
									系统信息
								</div>

								<!--<div class="warning-box">
									<span class="icon">⚠️</span>
									请设置你的 UUID 变量，或尝试重新部署，检查变量是否生效
								</div> -->

								<div class="info-grid">
									<div class="info-row">
										<div class="info-label">TLS 版本</div>
										<div class="info-value">${request.cf?.tlsVersion || 'TLSv1.3'}</div>
									</div>
									<div class="info-row">
										<div class="info-label">HTTP 协议</div>
										<div class="info-value">${request.cf?.httpProtocol || 'HTTP/2'}</div>
									</div>
									<div class="info-row">
										<div class="info-label">客户端 TCP RTT</div>
										<div class="info-value">${request.cf?.clientTcpRtt || '3'} ms</div>
									</div>
									<div class="info-row">
										<div class="info-label">地理位置</div>
										<div class="info-value">${request.cf?.continent || 'EU'}</div>
									</div>
									<div class="info-row">
										<div class="info-label">时区</div>
										<div class="info-value">${request.cf?.timezone || 'Europe/Vilnius'}</div>
									</div>
									<div class="info-row">
										<div class="info-label">客户端 IP</div>
										<div class="info-value">${request.headers.get('CF-Connecting-IP') || '127.0.0.1'}</div>
									</div>
									<div class="info-row">
										<div class="info-label">User Agent</div>
										<div class="info-value">${request.headers.get('User-Agent') || 'Mozilla/5.0'}</div>
									</div>
								</div>
							</div>
						</body>
						</html>`;

						return new Response(html, {
							status: 200,
							headers: {
								'content-type': 'text/html;charset=utf-8',
							},
						});
					}
				} else if (路径 == `/${fakeUserID}`) {
					const fakeConfig = await 生成配置信息(userID, request.headers.get('Host'), sub, 'CF-Workers-SUB', RproxyIP, url, fakeUserID, fakeHostName, env);
					return new Response(`${fakeConfig}`, { status: 200 });
				} else if (url.pathname == `/${动态UUID}/edit` || 路径 == `/${userID}/edit`) {
					const html = await KV(request, env);
					return html;
				} else if (url.pathname == `/${动态UUID}/bestip` || 路径 == `/${userID}/bestip`) {
					const html = await 在线优选IP(request, env);
					return html;
				} else if (url.pathname == `/${动态UUID}` || 路径 == `/${userID}`) {
					await sendMessage(`#获取订阅 ${FileName}`, request.headers.get('CF-Connecting-IP'), `UA: ${UA}</tg-spoiler>\n域名: ${url.hostname}\n<tg-spoiler>入口: ${url.pathname + url.search}</tg-spoiler>`);
					const 维列斯Config = await 生成配置信息(userID, request.headers.get('Host'), sub, UA, RproxyIP, url, fakeUserID, fakeHostName, env);
					const now = Date.now();
					//const timestamp = Math.floor(now / 1000);
					const today = new Date(now);
					today.setHours(0, 0, 0, 0);
					const UD = Math.floor(((now - today.getTime()) / 86400000) * 24 * 1099511627776 / 2);
					let pagesSum = UD;
					let workersSum = UD;
					let total = 24 * 1099511627776;

					if (userAgent && userAgent.includes('mozilla')) {
						return new Response(`<div style="font-size:13px;">${维列斯Config}</div>`, {
							status: 200,
							headers: {
								"Content-Type": "text/html;charset=utf-8",
								"Profile-Update-Interval": "6",
								"Subscription-Userinfo": `upload=${pagesSum}; download=${workersSum}; total=${total}; expire=${expire}`,
								"Cache-Control": "no-store",
							}
						});
					} else {
						return new Response(`${维列斯Config}`, {
							status: 200,
							headers: {
								"Content-Disposition": `attachment; filename=${FileName}; filename*=utf-8''${encodeURIComponent(FileName)}`,
								"Content-Type": "text/plain;charset=utf-8",
								"Profile-Update-Interval": "6",
								"Subscription-Userinfo": `upload=${pagesSum}; download=${workersSum}; total=${total}; expire=${expire}`,
							}
						});
					}
				} else {
					if (env.URL302) return Response.redirect(env.URL302, 302);
					else if (env.URL) return await 代理URL(env.URL, url);
					else {
						// 美化错误页面
						const html = `
						<!DOCTYPE html>
						<html>
						<head>
							<meta charset="utf-8">
							<meta name="viewport" content="width=device-width, initial-scale=1">
							<title>错误提示</title>
							<style>
								:root {
									--primary-color: #e74c3c;
									--border-color: #e0e0e0;
									--background-color: #f5f5f5;
									--error-bg: #fef5f5;
									--error-border: #f8d7da;
									--error-text: #721c24;
								}
								
								body {
									margin: 0;
									padding: 20px;
									font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
									line-height: 1.6;
									background-color: var(--background-color);
								}

								.container {
									max-width: 600px;
									margin: 50px auto;
									background: white;
									padding: 25px;
									border-radius: 10px;
									box-shadow: 0 2px 10px rgba(0,0,0,0.1);
									text-align: center;
								}

								.error-icon {
									font-size: 60px;
									color: var(--primary-color);
									margin-bottom: 20px;
								}

								.error-title {
									font-size: 24px;
									color: var(--error-text);
									margin-bottom: 15px;
								}

								.error-message {
									background-color: var(--error-bg);
									border: 1px solid var(--error-border);
									border-radius: 6px;
									padding: 15px;
									margin: 20px 0;
									color: var(--error-text);
									font-size: 16px;
								}

								.back-button {
									display: inline-block;
									padding: 10px 20px;
									background-color: var(--primary-color);
									color: white;
									border-radius: 5px;
									text-decoration: none;
									font-weight: 500;
									margin-top: 20px;
									transition: background-color 0.3s;
								}

								.back-button:hover {
									background-color: #c0392b;
								}

								@media (max-width: 768px) {
									body {
										padding: 10px;
									}
									
									.container {
										padding: 15px;
									}
								}
							</style>
						</head>
						<body>
							<div class="container">
								<div class="error-icon">⚠️</div>
								<div class="error-title">访问错误</div>
								<div class="error-message">
									不用怀疑！你的 UUID 输入错误！请检查配置并重试。
								</div>
								<a href="/" class="back-button">返回首页</a>
							</div>
						</body>
						</html>`;

						return new Response(html, { 
							status: 404,
							headers: {
								'content-type': 'text/html;charset=utf-8',
							},
						});
					}
				}
			} else {
				socks5Address = url.searchParams.get('socks5') || socks5Address;
				if (new RegExp('/socks5=', 'i').test(url.pathname)) socks5Address = url.pathname.split('5=')[1];
				else if (new RegExp('/socks://', 'i').test(url.pathname) || new RegExp('/socks5://', 'i').test(url.pathname)) {
					socks5Address = url.pathname.split('://')[1].split('#')[0];
					if (socks5Address.includes('@')) {
						let userPassword = socks5Address.split('@')[0];
						const base64Regex = /^(?:[A-Z0-9+/]{4})*(?:[A-Z0-9+/]{2}==|[A-Z0-9+/]{3}=)?$/i;
						if (base64Regex.test(userPassword) && !userPassword.includes(':')) userPassword = atob(userPassword);
						socks5Address = `${userPassword}@${socks5Address.split('@')[1]}`;
					}
				}

				if (socks5Address) {
					try {
						parsedSocks5Address = socks5AddressParser(socks5Address);
						enableSocks = true;
					} catch (err) {
						let e = err;
						console.log(e.toString());
						enableSocks = false;
					}
				} else {
					enableSocks = false;
				}

				if (url.searchParams.has('proxyip')) {
					proxyIP = url.searchParams.get('proxyip');
					enableSocks = false;
				} else if (new RegExp('/proxyip=', 'i').test(url.pathname)) {
					proxyIP = url.pathname.toLowerCase().split('/proxyip=')[1];
					enableSocks = false;
				} else if (new RegExp('/proxyip.', 'i').test(url.pathname)) {
					proxyIP = `proxyip.${url.pathname.toLowerCase().split("/proxyip.")[1]}`;
					enableSocks = false;
				} else if (new RegExp('/pyip=', 'i').test(url.pathname)) {
					proxyIP = url.pathname.toLowerCase().split('/pyip=')[1];
					enableSocks = false;
				}

				return await 维列斯OverWSHandler(request);
			}
		} catch (err) {
			let e = err;
			return new Response(e.toString());
		}
	},
};

async function 维列斯OverWSHandler(request) {
    const webSocketPair = new WebSocketPair();
    const [client, webSocket] = Object.values(webSocketPair);

    webSocket.accept();

    let address = '';
    let portWithRandomLog = '';
    const log = (info, event = '') => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${address}:${portWithRandomLog}] ${info}`, event);
    };

    const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';
    const readableWebSocketStream = new WebSocketManager(webSocket, log).makeReadableStream(earlyDataHeader);

    let remoteSocketWrapper = { value: null };
    let isDns = false;
    const banHostsSet = new Set(banHosts);

    readableWebSocketStream.pipeTo(new WritableStream({
        async write(chunk, controller) {
            try {
                if (isDns) {
                    return handleDNSQuery(chunk, webSocket, null, log);
                }
                if (remoteSocketWrapper.value) {
                    const writer = remoteSocketWrapper.value.writable.getWriter();
                    await writer.write(chunk);
                    writer.releaseLock();
                    return;
                }

                const {
                    hasError,
                    message,
                    addressType,
                    portRemote = 443,
                    addressRemote = '',
                    rawDataIndex,
                    维列斯Version = new Uint8Array([0, 0]),
                    isUDP,
                } = process维列斯Header(chunk, userID);

                address = addressRemote;
                portWithRandomLog = `${portRemote}--${Math.random()} ${isUDP ? 'udp ' : 'tcp '} `;
                if (hasError) {
                    throw new Error(message);
                }
                if (isUDP) {
                    if (portRemote === 53) {
                        isDns = true;
                    } else {
                        throw new Error('UDP 代理仅对 DNS（53 端口）启用');
                    }
                }
                const 维列斯ResponseHeader = new Uint8Array([维列斯Version[0], 0]);
                const rawClientData = chunk.slice(rawDataIndex);

                if (isDns) {
                    return handleDNSQuery(rawClientData, webSocket, 维列斯ResponseHeader, log);
                }
                if (!banHostsSet.has(addressRemote)) {
                    log(`处理 TCP 出站连接 ${addressRemote}:${portRemote}`);
                    handleTCPOutBound(remoteSocketWrapper, addressType, addressRemote, portRemote, rawClientData, webSocket, 维列斯ResponseHeader, log);
                } else {
                    throw new Error(`黑名单关闭 TCP 出站连接 ${addressRemote}:${portRemote}`);
                }
            } catch (error) {
                log('处理数据时发生错误', error.message);
                webSocket.close(1011, '内部错误');
            }
        },
        close() {
            log(`readableWebSocketStream 已关闭`);
        },
        abort(reason) {
            log(`readableWebSocketStream 已中止`, JSON.stringify(reason));
        },
    })).catch((err) => {
        log('readableWebSocketStream 管道错误', err);
        webSocket.close(1011, '管道错误');
    });

    return new Response(null, {
        status: 101,
        // @ts-ignore
        webSocket: client,
    });
}

function mergeData(header, chunk) {
    if (!header || !chunk) {
        throw new Error('Invalid input parameters');
    }

    const totalLength = header.length + chunk.length;
    
    const merged = new Uint8Array(totalLength);
    merged.set(header, 0);
    merged.set(chunk, header.length);
    return merged;
}

async function handleDNSQuery(udpChunk, webSocket, 维列斯ResponseHeader, log) {
    const DNS_SERVER = { hostname: '8.8.4.4', port: 53 };
    
    let tcpSocket;
    const controller = new AbortController();
    const signal = controller.signal;
    let timeoutId; 

    try {
        // 设置全局超时
        timeoutId = setTimeout(() => {
            controller.abort('DNS query timeout');
            if (tcpSocket) {
                try {
                    tcpSocket.close();
                } catch (e) {
                    log(`关闭TCP连接出错: ${e.message}`);
                }
            }
        }, 5000);

        try {
            // 使用Promise.race进行超时控制
            tcpSocket = await Promise.race([
                connect({
                    hostname: DNS_SERVER.hostname,
                    port: DNS_SERVER.port,
                    signal,
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('DNS连接超时')), 1500)
                )
            ]);

            log(`成功连接到DNS服务器 ${DNS_SERVER.hostname}:${DNS_SERVER.port}`);
            
            // 发送DNS查询
            const writer = tcpSocket.writable.getWriter();
            try {
                await writer.write(udpChunk);
            } finally {
                writer.releaseLock();
            }

            // 简化的数据流处理
            let 维列斯Header = 维列斯ResponseHeader;
            const reader = tcpSocket.readable.getReader();

            try {
                // 使用更高效的循环处理数据
                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        log('DNS数据流处理完成');
                        break;
                    }

                    // 检查WebSocket是否仍然开放
                    if (webSocket.readyState !== WS_READY_STATE_OPEN) {
                        break;
                    }

                    try {
                        // 处理数据包
                        if (维列斯Header) {
                            const data = mergeData(维列斯Header, value);
                            webSocket.send(data);
                            维列斯Header = null; // 清除header,只在第一个包使用
                        } else {
                            webSocket.send(value);
                        }
                    } catch (error) {
                        log(`数据处理错误: ${error.message}`);
                        throw error;
                    }
                }
            } catch (error) {
                log(`数据读取错误: ${error.message}`);
                throw error;
            } finally {
                reader.releaseLock();
            }

        } catch (error) {
            log(`DNS查询失败: ${error.message}`);
            throw error;
        }

    } catch (error) {
        log(`DNS查询失败: ${error.message}`);
        safeCloseWebSocket(webSocket);
    } finally {
        clearTimeout(timeoutId);
        if (tcpSocket) {
            try {
                tcpSocket.close();
            } catch (e) {
                log(`关闭TCP连接出错: ${e.message}`);
            }
        }
    }
}

async function handleTCPOutBound(remoteSocket, addressType, addressRemote, portRemote, rawClientData, webSocket, 维列斯ResponseHeader, log) {
    // 优化 SOCKS5 模式检查
    const checkSocks5Mode = async (address) => {
        const patterns = [atob('YWxsIGlu'), atob('Kg==')];
        if (go2Socks5s.some(pattern => patterns.includes(pattern))) return true;
        
        const pattern = go2Socks5s.find(p => 
            new RegExp('^' + p.replace(/\*/g, '.*') + '$', 'i').test(address)
        );
        return !!pattern;
    };

    // 优化连接处理
    const createConnection = async (address, port, socks = false) => {
        log(`建立连接: ${address}:${port} ${socks ? '(SOCKS5)' : ''}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const tcpSocket = await Promise.race([
                socks ? 
                    socks5Connect(addressType, address, port, log) :
                    connect({ 
                        hostname: address,
                        port: port,
                        allowHalfOpen: false,
                        keepAlive: true,
                        keepAliveInitialDelay: 60000,
                        signal: controller.signal
                    })
                ,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('连接超时')), 3000)
                )
            ]);

            clearTimeout(timeoutId);
            remoteSocket.value = tcpSocket;

            // 写入数据
            const writer = tcpSocket.writable.getWriter();
            try {
                await writer.write(rawClientData);
            } finally {
                writer.releaseLock();
            }

            return tcpSocket;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    };

    // 优化重试逻辑
    const retryConnection = async () => {
        try {
            let tcpSocket;
            if (enableSocks) {
                tcpSocket = await createConnection(addressRemote, portRemote, true);
            } else {
                // 处理 proxyIP
                if (!proxyIP || proxyIP === '') {
                    proxyIP = atob('UFJPWFlJUC50cDEuZnh4ay5kZWR5bi5pbw==');
                } else {
                    let port = portRemote;
                    if (proxyIP.includes(']:')) {
                        [proxyIP, port] = proxyIP.split(']:');
                    } else if (proxyIP.includes(':')) {
                        [proxyIP, port] = proxyIP.split(':');
                    }
                    if (proxyIP.includes('.tp')) {
                        port = proxyIP.split('.tp')[1].split('.')[0] || port;
                    }
                    portRemote = port;
                }
                tcpSocket = await createConnection(proxyIP || addressRemote, portRemote);
            }

            // 监听连接关闭
            tcpSocket.closed
                .catch(error => log('重试连接关闭:', error))
                .finally(() => safeCloseWebSocket(webSocket));

            return remoteSocketToWS(tcpSocket, webSocket, 维列斯ResponseHeader, null, log);
        } catch (error) {
            log('重试失败:', error);
        }
    };

    try {
        // 主连接逻辑
        const shouldUseSocks = enableSocks && go2Socks5s.length > 0 ? 
            await checkSocks5Mode(addressRemote) : false;

        const tcpSocket = await createConnection(addressRemote, portRemote, shouldUseSocks);
        return remoteSocketToWS(tcpSocket, webSocket, 维列斯ResponseHeader, retryConnection, log);
    } catch (error) {
        log('主连接失败，尝试重试:', error);
        return retryConnection();
    }
}

function process维列斯Header(维列斯Buffer, userID) {
    if (维列斯Buffer.byteLength < 24) {
        return { hasError: true, message: 'Invalid data' };
    }

    const version = new Uint8Array(维列斯Buffer.slice(0, 1));
    const userIDArray = new Uint8Array(维列斯Buffer.slice(1, 17));
    const userIDString = stringify(userIDArray);
    const isValidUser = userIDString === userID || userIDString === userIDLow;

    if (!isValidUser) {
        return { hasError: true, message: 'Invalid user' };
    }

    const optLength = new Uint8Array(维列斯Buffer.slice(17, 18))[0];
    const command = new Uint8Array(维列斯Buffer.slice(18 + optLength, 18 + optLength + 1))[0];
    let isUDP = false;

    switch (command) {
        case 1: break;
        case 2: isUDP = true; break;
        default:
            return { hasError: true, message: 'Unsupported command' };
    }

    const portIndex = 18 + optLength + 1;
    const portRemote = new DataView(维列斯Buffer).getUint16(portIndex);

    const addressIndex = portIndex + 2;
    const addressType = new Uint8Array(维列斯Buffer.slice(addressIndex, addressIndex + 1))[0];
    let addressValue = '';
    let addressLength = 0;
    let addressValueIndex = addressIndex + 1;

    switch (addressType) {
        case 1:
            addressLength = 4;
            addressValue = new Uint8Array(维列斯Buffer.slice(addressValueIndex, addressValueIndex + addressLength)).join('.');
            break;
        case 2:
            addressLength = new Uint8Array(维列斯Buffer.slice(addressValueIndex, addressValueIndex + 1))[0];
            addressValueIndex += 1;
            addressValue = new TextDecoder().decode(维列斯Buffer.slice(addressValueIndex, addressValueIndex + addressLength));
            break;
        case 3:
            addressLength = 16;
            const dataView = new DataView(维列斯Buffer.slice(addressValueIndex, addressValueIndex + addressLength));
            const ipv6 = [];
            for (let i = 0; i < 8; i++) {
                ipv6.push(dataView.getUint16(i * 2).toString(16));
            }
            addressValue = ipv6.join(':');
            break;
        default:
            return { hasError: true, message: 'Invalid address type' };
    }

    if (!addressValue) {
        return { hasError: true, message: 'Empty address value' };
    }

    return {
        hasError: false,
        addressRemote: addressValue,
        addressType,
        portRemote,
        rawDataIndex: addressValueIndex + addressLength,
        维列斯Version: version,
        isUDP,
    };
}

async function remoteSocketToWS(remoteSocket, webSocket, responseHeader, retry, log) {
    let hasIncomingData = false;
    let header = responseHeader;
    let isSocketClosed = false;
    let retryAttempted = false;
    let retryCount = 0; // 记录重试次数
    const MAX_RETRIES = 3; // 限制最大重试次数

    // 控制超时
    const controller = new AbortController();
    const signal = controller.signal;

    // 设置全局超时
    const timeout = setTimeout(() => {
        if (!hasIncomingData) {
            controller.abort('连接超时');
        }
    }, 5000);

    try {
        // 发送数据的函数，确保 WebSocket 处于 OPEN 状态
    const writeData = async (chunk) => {
        if (webSocket.readyState !== WS_READY_STATE_OPEN) {
                throw new Error('WebSocket 未连接');
        }

        if (header) {
                // 预分配足够的 buffer，避免重复分配
                const combinedData = new Uint8Array(header.byteLength + chunk.byteLength);
                combinedData.set(new Uint8Array(header), 0);
                combinedData.set(new Uint8Array(chunk), header.byteLength);
                webSocket.send(combinedData);
                header = null; // 清除 header 引用
        } else {
            webSocket.send(chunk);
        }
        
            hasIncomingData = true;
        };

        await remoteSocket.readable
            .pipeTo(
                new WritableStream({
                    async write(chunk, controller) {
                        try {
                            await writeData(chunk);
                        } catch (error) {
                            log(`数据写入错误: ${error.message}`);
                            controller.error(error);
                        }
                    },
                    close() {
                        isSocketClosed = true;
                        clearTimeout(timeout);
                        log(`远程连接已关闭, 接收数据: ${hasIncomingData}`);
                        
                        // 仅在没有数据时尝试重试，且不超过最大重试次数
                        if (!hasIncomingData && retry && !retryAttempted && retryCount < MAX_RETRIES) {
                            retryAttempted = true;
                            retryCount++;
                            log(`未收到数据, 正在进行第 ${retryCount} 次重试...`);
                            retry();
                        }
                    },
                    abort(reason) {
                        isSocketClosed = true;
                        clearTimeout(timeout);
                        log(`远程连接被中断: ${reason}`);
                    }
                }),
                {
                    signal,
                    preventCancel: false
                }
            )
            .catch((error) => {
                log(`数据传输异常: ${error.message}`);
                if (!isSocketClosed) {
                    safeCloseWebSocket(webSocket);
                }
                
                // 仅在未收到数据时尝试重试，并限制重试次数
                if (!hasIncomingData && retry && !retryAttempted && retryCount < MAX_RETRIES) {
                    retryAttempted = true;
                    retryCount++;
                    log(`连接失败, 正在进行第 ${retryCount} 次重试...`);
                    retry();
                }
            });

    } catch (error) {
        clearTimeout(timeout);
        log(`连接处理异常: ${error.message}`);
        if (!isSocketClosed) {
            safeCloseWebSocket(webSocket);
        }
        
        // 仅在发生异常且未收到数据时尝试重试，并限制重试次数
        if (!hasIncomingData && retry && !retryAttempted && retryCount < MAX_RETRIES) {
            retryAttempted = true;
            retryCount++;
            log(`发生异常, 正在进行第 ${retryCount} 次重试...`);
            retry();
        }
        
        throw error;
    } finally {
        clearTimeout(timeout);
        if (signal.aborted) {
            safeCloseWebSocket(webSocket);
        }
    }
}

const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CLOSING = 2;

function safeCloseWebSocket(socket) {
    try {
        if (socket.readyState === WS_READY_STATE_OPEN || socket.readyState === WS_READY_STATE_CLOSING) {
            socket.close();
        }
    } catch (error) {
        console.error('safeCloseWebSocket error', error);
    }
}

const byteToHexArray = Array.from({ length: 256 }, (_, i) => (i + 256).toString(16).slice(1));

function unsafeStringify(arr, offset = 0) {
    return `${byteToHexArray[arr[offset + 0]]}${byteToHexArray[arr[offset + 1]]}${byteToHexArray[arr[offset + 2]]}${byteToHexArray[arr[offset + 3]]}-` +
           `${byteToHexArray[arr[offset + 4]]}${byteToHexArray[arr[offset + 5]]}-` +
           `${byteToHexArray[arr[offset + 6]]}${byteToHexArray[arr[offset + 7]]}-` +
           `${byteToHexArray[arr[offset + 8]]}${byteToHexArray[arr[offset + 9]]}-` +
           `${byteToHexArray[arr[offset + 10]]}${byteToHexArray[arr[offset + 11]]}${byteToHexArray[arr[offset + 12]]}` +
           `${byteToHexArray[arr[offset + 13]]}${byteToHexArray[arr[offset + 14]]}${byteToHexArray[arr[offset + 15]]}`.toLowerCase();
}

function stringify(arr, offset = 0) {
    const uuid = unsafeStringify(arr, offset);
    if (!utils.isValidUUID(uuid)) {
        throw new TypeError(`Invalid UUID: ${uuid}`);
    }
    return uuid;
}

async function socks5Connect(addressType, addressRemote, portRemote, log) {
    const { username, password, hostname, port } = parsedSocks5Address;
    const socket = connect({ hostname, port });

    const socksGreeting = new Uint8Array([5, 2, 0, 2]);
    const writer = socket.writable.getWriter();
    await writer.write(socksGreeting);
    log('SOCKS5 greeting sent');

    const reader = socket.readable.getReader();
    const encoder = new TextEncoder();
    let res = (await reader.read()).value;

    if (res[0] !== 0x05) {
        log(`SOCKS5 version error: received ${res[0]}, expected 5`);
        return;
    }
    if (res[1] === 0xff) {
        log("No acceptable authentication methods");
        return;
    }

    if (res[1] === 0x02) {
        log("SOCKS5 requires authentication");
        if (!username || !password) {
            log("Username and password required");
            return;
        }
        const authRequest = new Uint8Array([
            1,
            username.length,
            ...encoder.encode(username),
            password.length,
            ...encoder.encode(password)
        ]);
        await writer.write(authRequest);
        res = (await reader.read()).value;
        if (res[0] !== 0x01 || res[1] !== 0x00) {
            log("SOCKS5 authentication failed");
            return;
        }
    }

    let DSTADDR;
    switch (addressType) {
        case 1:
            DSTADDR = new Uint8Array([1, ...addressRemote.split('.').map(Number)]);
            break;
        case 2:
            DSTADDR = new Uint8Array([3, addressRemote.length, ...encoder.encode(addressRemote)]);
            break;
        case 3:
            DSTADDR = new Uint8Array([4, ...addressRemote.split(':').flatMap(x => [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2), 16)])]);
            break;
        default:
            log(`Invalid address type: ${addressType}`);
            return;
    }
    const socksRequest = new Uint8Array([5, 1, 0, ...DSTADDR, portRemote >> 8, portRemote & 0xff]);
    await writer.write(socksRequest);
    log('SOCKS5 request sent');

    res = (await reader.read()).value;
    if (res[1] === 0x00) {
        log("SOCKS5 connection established");
    } else {
        log("SOCKS5 connection failed");
        return;
    }
    writer.releaseLock();
    reader.releaseLock();
    return socket;
}

function socks5AddressParser(address) {
    let [latter, former] = address.split("@").reverse();
    let username, password, hostname, port;

    if (former) {
        const formers = former.split(":");
        if (formers.length !== 2) {
            throw new Error('Invalid SOCKS address format: "username:password" required');
        }
        [username, password] = formers;
    }

    const latters = latter.split(":");
    port = Number(latters.pop());
    if (isNaN(port)) {
        throw new Error('Invalid SOCKS address format: port must be a number');
    }

    hostname = latters.join(":");

    const regex = /^\[.*\]$/;
    if (hostname.includes(":") && !regex.test(hostname)) {
        throw new Error('Invalid SOCKS address format: IPv6 must be in brackets');
    }

    return {
        username,
        password,
        hostname,
        port,
    }
}

function 恢复伪装信息(content, userID, hostName, fakeUserID, fakeHostName, isBase64) {
    if (isBase64) {
        content = atob(content);
    }

    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fakeUserIDRegExp = new RegExp(escapeRegExp(fakeUserID), 'g');
    const fakeHostNameRegExp = new RegExp(escapeRegExp(fakeHostName), 'g');

    content = content.replace(fakeUserIDRegExp, userID)
                     .replace(fakeHostNameRegExp, hostName);

    return isBase64 ? btoa(content) : content;
}

async function 双重哈希(文本) {
    const 编码器 = new TextEncoder();

    // 计算第一次哈希 (SHA-256)
    const 第一次哈希 = await crypto.subtle.digest('SHA-256', 编码器.encode(文本));
    const 第一次十六进制 = [...new Uint8Array(第一次哈希)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');

    // 截取部分哈希值，并进行二次哈希
    const 截取部分 = 第一次十六进制.substring(7, 27);
    const 第二次哈希 = await crypto.subtle.digest('SHA-256', 编码器.encode(截取部分));
    const 第二次十六进制 = [...new Uint8Array(第二次哈希)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');

    return 第二次十六进制.toLowerCase();
}

async function 代理URL(代理网址, 目标网址, 调试模式 = false) {
    try {
    const 网址列表 = await 整理(代理网址);
        if (!网址列表 || 网址列表.length === 0) {
            throw new Error('代理网址列表为空');
        }
    const 完整网址 = 网址列表[Math.floor(Math.random() * 网址列表.length)];

    const 解析后的网址 = new URL(完整网址);
        if (调试模式) console.log(`代理 URL: ${解析后的网址}`);

        const 目标URL = new URL(目标网址, 解析后的网址);

        const 响应 = await fetch(目标URL.toString(), { method: 'GET' });

    const 新响应 = new Response(响应.body, {
        status: 响应.status,
        statusText: 响应.statusText,
            headers: new Headers(响应.headers)
    });

        新响应.headers.set('X-New-URL', 目标URL.toString());

    return 新响应;
    } catch (error) {
        console.error(`代理请求失败: ${error.message}`);
        return new Response(`代理请求失败: ${error.message}`, { status: 500 });
    }
}

const 啥啥啥_写的这是啥啊 = atob('ZG14bGMzTT0=');
function 配置信息(UUID, 域名地址) {
	const 协议类型 = atob(啥啥啥_写的这是啥啊);

	const 别名 = FileName;
	let 地址 = 域名地址;
	let 端口 = 443;

	const 用户ID = UUID;
	const 加密方式 = 'none';

	const 传输层协议 = 'ws';
	const 伪装域名 = 域名地址;
	const 路径 = path;

	let 传输层安全 = ['tls', true];
	const SNI = 域名地址;
	const 指纹 = 'randomized';

	if (域名地址.includes('.workers.dev')) {
		地址 = atob('dmlzYS5jbg==');
		端口 = 80;
		传输层安全 = ['', false];
	}

	const 威图瑞 = `${协议类型}://${用户ID}@${地址}:${端口}\u003f\u0065\u006e\u0063\u0072\u0079` + 'p' + `${atob('dGlvbj0=') + 加密方式}\u0026\u0073\u0065\u0063\u0075\u0072\u0069\u0074\u0079\u003d${传输层安全[0]}&sni=${SNI}&fp=${指纹}&type=${传输层协议}&host=${伪装域名}&path=${encodeURIComponent(路径)}#${encodeURIComponent(别名)}`;
	const 猫猫猫 = `- {name: ${FileName}, server: ${地址}, port: ${端口}, type: ${协议类型}, uuid: ${用户ID}, tls: ${传输层安全[1]}, alpn: [h3], udp: false, sni: ${SNI}, tfo: false, skip-cert-verify: true, servername: ${伪装域名}, client-fingerprint: ${指纹}, network: ${传输层协议}, ws-opts: {path: "${路径}", headers: {${伪装域名}}}}`;
	return [威图瑞, 猫猫猫];
}

let subParams = ['sub', 'base64', 'b64', 'clash', 'singbox', 'sb'];
const cmad = decodeURIComponent(atob('dGVsZWdyYW0lMjAlRTQlQkElQTQlRTYlQjUlODElRTclQkUlQTQlMjAlRTYlOEElODAlRTYlOUMlQUYlRTUlQTQlQTclRTQlQkQlQUMlN0UlRTUlOUMlQTglRTclQkElQkYlRTUlOEYlOTElRTclODklOEMhJTNDYnIlM0UKJTNDYSUyMGhyZWYlM0QlMjdodHRwcyUzQSUyRiUyRnQubWUlMkZDTUxpdXNzc3MlMjclM0VodHRwcyUzQSUyRiUyRnQubWUlMkZDTUxpdXNzc3MlM0MlMkZhJTNFJTNDYnIlM0UKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tJTNDYnIlM0UKZ2l0aHViJTIwJUU5JUExJUI5JUU3JTlCJUFFJUU1JTlDJUIwJUU1JTlEJTgwJTIwU3RhciFTdGFyIVN0YXIhISElM0NiciUzRQolM0NhJTIwaHJlZiUzRCUyN2h0dHBzJTNBJTJGJTJGZ2l0aHViLmNvbSUyRmNtbGl1JTJGZWRnZXR1bm5lbCUyNyUzRWh0dHBzJTNBJTJGJTJGZ2l0aHViLmNvbSUyRmNtbGl1JTJGZWRnZXR1bm5lbCUzQyUyRmElM0UlM0NiciUzRQotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0lM0NiciUzRQolMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjM='));

async function 生成配置信息(userID, hostName, sub, UA, RproxyIP, _url, fakeUserID, fakeHostName, env) {
	// 在获取其他配置前,先尝试读取自定义的设置
	if (env.KV) {
		try {
			// 修改PROXYIP设置逻辑
			const customProxyIP = await env.KV.get('PROXYIP.txt');
			if (customProxyIP && customProxyIP.trim()) {
				// 如果KV中有PROXYIP设置，使用KV中的设置
				proxyIP = customProxyIP;
				proxyIPs = await 整理(proxyIP);
				proxyIP = proxyIPs.length > 0 ? proxyIPs[Math.floor(Math.random() * proxyIPs.length)] : '';
				console.log('使用KV中的PROXYIP:', proxyIP);
				RproxyIP = 'false';
			} else if (env.PROXYIP) {
				// 如果KV中没有设置但环境变量中有，使用环境变量中的设置
				proxyIP = env.PROXYIP;
				proxyIPs = await 整理(proxyIP);
				proxyIP = proxyIPs.length > 0 ? proxyIPs[Math.floor(Math.random() * proxyIPs.length)] : '';
				console.log('使用环境变量中的PROXYIP:', proxyIP);
				RproxyIP = 'false';
			} else {
				// 如果KV和环境变量中都没有设置，使用代码默认值
				console.log('使用默认PROXYIP设置');
				proxyIP = '';
				RproxyIP = env.RPROXYIP || !proxyIP ? 'true' : 'false';
			}

			// 修改SOCKS5设置逻辑
			const customSocks5 = await env.KV.get('SOCKS5.txt');
			if (customSocks5 && customSocks5.trim()) {
				// 如果KV中有SOCKS5设置，使用KV中的设置
				socks5Address = customSocks5.trim().split('\n')[0];
				socks5s = await 整理(socks5Address);
				socks5Address = socks5s.length > 0 ? socks5s[Math.floor(Math.random() * socks5s.length)] : '';
				socks5Address = socks5Address.split('//')[1] || socks5Address;
				console.log('使用KV中的SOCKS5:', socks5Address);
				enableSocks = true; 
			} else if (env.SOCKS5) {
				// 如果KV中没有设置但环境变量中有，使用环境变量中的设置
				socks5Address = env.SOCKS5;
				socks5s = await 整理(socks5Address);
				socks5Address = socks5s.length > 0 ? socks5s[Math.floor(Math.random() * socks5s.length)] : '';
				socks5Address = socks5Address.split('//')[1] || socks5Address;
				console.log('使用环境变量中的SOCKS5:', socks5Address);
				enableSocks = true; 
			} else {
				// 如果KV和环境变量中都没有设置，使用代码默认值
				console.log('使用默认SOCKS5设置');
				enableSocks = false;
				socks5Address = '';
			}

			// 读取自定义SUB设置
			const customSub = await env.KV.get('SUB.txt');
			// 明确检查是否为null或空字符串
			if (customSub !== null && customSub.trim() !== '') {
				// 如果KV中有SUB设置，使用KV中的设置
				sub = customSub.trim().split('\n')[0];
				console.log('使用KV中的SUB:', sub);
			} else if (env.SUB) {
				// 如果KV中没有设置但环境变量中有，使用环境变量中的设置
				sub = env.SUB;
				console.log('使用环境变量中的SUB:', sub);
			} else {
				// 如果KV和环境变量中都没有设置，使用默认值
				sub = '';
				console.log('使用默认SUB设置:', sub);
			}

			// 读取自定义SUBAPI设置
			const customSubAPI = await env.KV.get('SUBAPI.txt');
			// 明确检查是否为null或空字符串
			if (customSubAPI !== null && customSubAPI.trim() !== '') {
				// 如果KV中有SUBAPI设置，使用KV中的设置
				subConverter = customSubAPI.trim().split('\n')[0];
				console.log('使用KV中的SUBAPI:', subConverter);
			} else if (env.SUBAPI) {
				// 如果KV中没有设置但环境变量中有，使用环境变量中的设置
				subConverter = env.SUBAPI;
				console.log('使用环境变量中的SUBAPI:', subConverter);
			} else {
				// 如果KV和环境变量中都没有设置，使用代码默认值
				subConverter = atob('U1VCQVBJLkNNTGl1c3Nzcy5uZXQ=');
				console.log('使用默认SUBAPI设置:', subConverter);
			}

			// 读取自定义SUBCONFIG设置
			const customSubConfig = await env.KV.get('SUBCONFIG.txt');
			// 明确检查是否为null或空字符串
			if (customSubConfig !== null && customSubConfig.trim() !== '') {
				// 如果KV中有SUBCONFIG设置，使用KV中的设置
				subConfig = customSubConfig.trim().split('\n')[0];
				console.log('使用KV中的SUBCONFIG:', subConfig);
			} else if (env.SUBCONFIG) {
				// 如果KV中没有设置但环境变量中有，使用环境变量中的设置
				subConfig = env.SUBCONFIG;
				console.log('使用环境变量中的SUBCONFIG:', subConfig);
			} else {
				// 如果KV和环境变量中都没有设置，使用代码默认值
				subConfig = atob('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0FDTDRTU1IvQUNMNFNTUi9tYXN0ZXIvQ2xhc2gvY29uZmlnL0FDTDRTU1JfT25saW5lX01pbmlfTXVsdGlNb2RlLmluaQ==');
				console.log('使用默认SUBCONFIG设置:', subConfig);
			}
		} catch (error) {
			console.error('读取自定义设置时发生错误:', error);
		}
	}

	if (sub) {
		const match = sub.match(/^(?:https?:\/\/)?([^\/]+)/);
		sub = match ? match[1] : sub;
		const subs = await 整理(sub);
		sub = subs.length > 1 ? subs[0] : sub;
	}
	
	if (env.KV) {
		await 迁移地址列表(env);
		const 优选地址列表 = await env.KV.get('ADD.txt');
		if (优选地址列表) {
				const 优选地址数组 = await 整理(优选地址列表);
				const 分类地址 = {
					接口地址: new Set(),
					链接地址: new Set(),
					优选地址: new Set()
				};

				for (const 元素 of 优选地址数组) {
					if (元素.startsWith('https://')) {
						分类地址.接口地址.add(元素);
					} else if (元素.includes('://')) {
						分类地址.链接地址.add(元素);
					} else {
						分类地址.优选地址.add(元素);
					}
				}

			addressesapi = [...分类地址.接口地址];
			link = [...分类地址.链接地址];
			addresses = [...分类地址.优选地址];
		}
	}

	if ((addresses.length + addressesapi.length + addressesnotls.length + addressesnotlsapi.length + addressescsv.length) == 0) {
		let cfips = [
			        '103.21.244.0/24',
				'104.16.0.0/13',
				'104.24.0.0/14',
				'172.64.0.0/14',
				'104.16.0.0/14',
				'104.24.0.0/15',
				'141.101.64.0/19',
				'172.64.0.0/14',
				'188.114.96.0/21',
				'190.93.240.0/21',
				'162.159.152.0/23',
				'104.16.0.0/13',
				'104.24.0.0/14',
				'172.64.0.0/14',
				'104.16.0.0/14',
				'104.24.0.0/15',
				'141.101.64.0/19',
				'172.64.0.0/14',
				'188.114.96.0/21',
				'190.93.240.0/21',
		];

		function generateRandomIPFromCIDR(cidr) {
			const [base, mask] = cidr.split('/');
			const baseIP = base.split('.').map(Number);
			const subnetMask = 32 - parseInt(mask, 10);
			const maxHosts = Math.pow(2, subnetMask) - 1;
			const randomHost = Math.floor(Math.random() * maxHosts);

			return baseIP.map((octet, index) => {
				if (index < 2) return octet;
				if (index === 2) return (octet & (255 << (subnetMask - 8))) + ((randomHost >> 8) & 255);
				return (octet & (255 << subnetMask)) + (randomHost & 255);
			}).join('.');
		}

		let counter = 1;
		if (hostName.includes("worker") || hostName.includes("notls")) {
			const randomPorts = httpPorts.concat('80');
			addressesnotls = addressesnotls.concat(
				cfips.map(cidr => generateRandomIPFromCIDR(cidr) + ':' + 
					randomPorts[Math.floor(Math.random() * randomPorts.length)] + 
					'#CF随机节点' + String(counter++).padStart(2, '0'))
			);
		} else {
			const randomPorts = httpsPorts.concat('443');
			addresses = addresses.concat(
				cfips.map(cidr => generateRandomIPFromCIDR(cidr) + ':' + 
					randomPorts[Math.floor(Math.random() * randomPorts.length)] + 
					'#CF随机节点' + String(counter++).padStart(2, '0'))
			);
		}
	}

	const uuid = (_url.pathname == `/${动态UUID}`) ? 动态UUID : userID;
	const userAgent = UA.toLowerCase();
	const Config = 配置信息(userID, hostName);
	const proxyConfig = Config[0];
	const clash = Config[1];
	let proxyhost = "";
	if (hostName.includes(".workers.dev")) {
		if (proxyhostsURL && (!proxyhosts || proxyhosts.length == 0)) {
			try {
				const response = await fetch(proxyhostsURL);

				if (!response.ok) {
					console.error('获取地址时出错:', response.status, response.statusText);
					return; 
				}

				const text = await response.text();
				const lines = text.split('\n');
				const nonEmptyLines = lines.filter(line => line.trim() !== '');

				proxyhosts = proxyhosts.concat(nonEmptyLines);
			} catch (error) {
				//console.error('获取地址时出错:', error);
			}
		}
		if (proxyhosts.length != 0) proxyhost = proxyhosts[Math.floor(Math.random() * proxyhosts.length)] + "/";
	}

	const isUserAgentMozilla = userAgent.includes('mozilla');
	if (isUserAgentMozilla && !subParams.some(_searchParams => _url.searchParams.has(_searchParams))) {
		const newSocks5s = socks5s.map(socks5Address => {
			if (socks5Address.includes('@')) return socks5Address.split('@')[1];
			else if (socks5Address.includes('//')) return socks5Address.split('//')[1];
			else return socks5Address;
		});

		let socks5List = '';
		if (go2Socks5s.length > 0 && enableSocks) {
			socks5List = `${decodeURIComponent('SOCKS5%EF%BC%88%E7%99%BD%E5%90%8D%E5%8D%95%EF%BC%89%3A%20')}`;
			if (go2Socks5s.includes(atob('YWxsIGlu')) || go2Socks5s.includes(atob('Kg=='))) socks5List += `${decodeURIComponent('%E6%89%80%E6%9C%89%E6%B5%81%E9%87%8F')}<br>`;
			else socks5List += `<br>&nbsp;&nbsp;${go2Socks5s.join('<br>&nbsp;&nbsp;')}<br>`;
		}

		let 订阅器 = '<br>';
		if (env.KV) 判断是否绑定KV空间 = ` [<a href='${_url.pathname}/edit'>编辑优选列表</a>]  [<a href='${_url.pathname}/bestip'>在线优选IP</a>]`;
		
		if (sub) {
			if (enableSocks) 订阅器 += `CFCDN（访问方式）: Socks5<br>&nbsp;&nbsp;${newSocks5s.join('<br>&nbsp;&nbsp;')}<br>${socks5List}`;
			else if (proxyIP && proxyIP != '') 订阅器 += `CFCDN（访问方式）: ProxyIP<br>&nbsp;&nbsp;${proxyIPs.join('<br>&nbsp;&nbsp;')}<br>`;
			else if (RproxyIP == 'true') 订阅器 += `CFCDN（访问方式）: 自动获取ProxyIP<br>`;
			else 订阅器 += `CFCDN（访问方式）: 无法访问, 需要您设置 proxyIP/PROXYIP ！！！<br>`
			订阅器 += `<br>SUB（优选订阅生成器）: ${sub}${判断是否绑定KV空间}<br>`;
		} else {
			if (enableSocks) 订阅器 += `CFCDN（访问方式）: Socks5<br>&nbsp;&nbsp;${newSocks5s.join('<br>&nbsp;&nbsp;')}<br>${socks5List}`;
			else if (proxyIP && proxyIP != '') 订阅器 += `CFCDN（访问方式）: ProxyIP<br>&nbsp;&nbsp;${proxyIPs.join('<br>&nbsp;&nbsp;')}<br>`;
			else 订阅器 += `CFCDN（访问方式）: 无法访问, 需要您设置 proxyIP/PROXYIP ！！！<br>`;
			订阅器 += `<br>您的订阅内容由 内置 addresses/ADD* 参数变量提供${判断是否绑定KV空间}<br>`;
			if (addresses.length > 0) 订阅器 += `ADD（TLS优选域名&IP）: <br>&nbsp;&nbsp;${addresses.join('<br>&nbsp;&nbsp;')}<br>`;
			if (addressesnotls.length > 0) 订阅器 += `ADDNOTLS（noTLS优选域名&IP）: <br>&nbsp;&nbsp;${addressesnotls.join('<br>&nbsp;&nbsp;')}<br>`;
			if (addressesapi.length > 0) 订阅器 += `ADDAPI（TLS优选域名&IP 的 API）: <br>&nbsp;&nbsp;${addressesapi.join('<br>&nbsp;&nbsp;')}<br>`;
			if (addressesnotlsapi.length > 0) 订阅器 += `ADDNOTLSAPI（noTLS优选域名&IP 的 API）: <br>&nbsp;&nbsp;${addressesnotlsapi.join('<br>&nbsp;&nbsp;')}<br>`;
			if (addressescsv.length > 0) 订阅器 += `ADDCSV（IPTest测速csv文件 限速 ${DLS} ）: <br>&nbsp;&nbsp;${addressescsv.join('<br>&nbsp;&nbsp;')}<br>`;
		}

		if (动态UUID && _url.pathname !== `/${动态UUID}`) 订阅器 = '';
		else 订阅器 += `<br>SUBAPI（订阅转换后端）: ${subProtocol}://${subConverter}<br>SUBCONFIG（订阅转换配置文件）: ${subConfig}`;
		const 动态UUID信息 = (uuid != userID) ? `TOKEN: ${uuid}<br>UUIDNow: ${userID}<br>UUIDLow: ${userIDLow}<br>${userIDTime}TIME（动态UUID有效时间）: ${有效时间} 天<br>UPTIME（动态UUID更新时间）: ${更新时间} 时（北京时间）<br><br>` : `${userIDTime}`;
		const 节点配置页 = `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1">
				<title>${FileName} 配置信息</title>
				<style>
					:root {
						--primary-color: #4CAF50;
						--secondary-color: #45a049;
						--border-color: #e0e0e0;
						--text-color: #333;
						--background-color: #f5f5f5;
						--section-bg: #ffffff;
					}
					
					body {
						margin: 0;
						padding: 20px;
						font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
						line-height: 1.6;
						color: var(--text-color);
						background-color: var(--background-color);
					}

					.container {
						max-width: 1000px;
						margin: 0 auto;
						background: var(--section-bg);
						padding: 25px;
						border-radius: 10px;
						box-shadow: 0 2px 10px rgba(0,0,0,0.1);
					}

					.section {
						margin: 20px 0;
						padding: 20px;
						background: var(--section-bg);
						border-radius: 8px;
						border: 1px solid var(--border-color);
					}

					.section-title {
						font-size: 1.2em;
						color: var(--primary-color);
						margin-bottom: 15px;
						padding-bottom: 10px;
						border-bottom: 2px solid var(--border-color);
					}

					.divider {
						height: 1px;
						background: var(--border-color);
						margin: 15px 0;
					}

					.subscription-link {
						display: block;
						margin: 10px 0;
						padding: 12px;
						background: #f8f9fa;
						border-radius: 6px;
						border: 1px solid var(--border-color);
						word-break: break-all;
					}

					.subscription-link a {
						color: #0066cc;
						text-decoration: none;
					}

					.subscription-link a:hover {
						text-decoration: underline;
					}

					.qrcode-container {
						margin: 10px 0;
						text-align: center;
					}

					.notice-toggle {
						color: var(--primary-color);
						cursor: pointer;
						text-decoration: none;
						display: inline-block;
						margin: 10px 0;
						font-weight: 500;
					}

					.notice-content {
						background: #f8f9fa;
						border-left: 4px solid var(--primary-color);
						padding: 15px;
						margin: 10px 0;
						border-radius: 0 8px 8px 0;
					}

					.config-info {
						background: #f8f9fa;
						padding: 15px;
						border-radius: 6px;
						font-family: Monaco, Consolas, "Courier New", monospace;
						font-size: 13px;
						overflow-x: auto;
					}

					.copy-button {
						display: inline-block;
						padding: 6px 12px;
						background: var(--primary-color);
						color: white;
						border: none;
						border-radius: 4px;
						cursor: pointer;
						font-size: 14px;
						margin: 5px 0;
					}

					.copy-button:hover {
						background: var(--secondary-color);
					}

					@media (max-width: 768px) {
						body {
							padding: 10px;
						}
						
						.container {
							padding: 15px;
						}
						
						.section {
							padding: 15px;
						}
					}
				</style>
			</head>
			<body>
				<div class="container">
					<div class="section">
						<div class="section-title">📋 订阅信息</div>
						<div class="subscription-link">
							自适应订阅地址:<br>
							<a href="javascript:void(0)" onclick="copyToClipboard('https://${proxyhost}${hostName}/${uuid}?sub','qrcode_0')" style="color:blue;">
								https://${proxyhost}${hostName}/${uuid}
							</a>
							<div id="qrcode_0" class="qrcode-container"></div>
						</div>

						<div class="subscription-link">
							Base64订阅地址:<br>
							<a href="javascript:void(0)" onclick="copyToClipboard('https://${proxyhost}${hostName}/${uuid}?b64','qrcode_1')" style="color:blue;">
								https://${proxyhost}${hostName}/${uuid}?b64
							</a>
							<div id="qrcode_1" class="qrcode-container"></div>
						</div>

						<div class="subscription-link">
							clash订阅地址:<br>
							<a href="javascript:void(0)" onclick="copyToClipboard('https://${proxyhost}${hostName}/${uuid}?clash','qrcode_2')" style="color:blue;">
								https://${proxyhost}${hostName}/${uuid}?clash
							</a>
							<div id="qrcode_2" class="qrcode-container"></div>
						</div>

						<div class="subscription-link">
							singbox订阅地址:<br>
							<a href="javascript:void(0)" onclick="copyToClipboard('https://${proxyhost}${hostName}/${uuid}?sb','qrcode_3')" style="color:blue;">
								https://${proxyhost}${hostName}/${uuid}?sb
							</a>
							<div id="qrcode_3" class="qrcode-container"></div>
						</div>

						<div class="subscription-link">
							Loon订阅地址:<br>
							<a href="javascript:void(0)" onclick="copyToClipboard('https://${proxyhost}${hostName}/${uuid}?loon','qrcode_4')" style="color:blue;">
								https://${proxyhost}${hostName}/${uuid}?loon
							</a>
							<div id="qrcode_4" class="qrcode-container"></div>
						</div>
					</div>

					<div class="section">
						<div class="section-title">ℹ️ 使用说明</div>
						<a href="javascript:void(0);" id="noticeToggle" class="notice-toggle" onclick="toggleNotice()">
							实用订阅技巧 ∨
						</a>
						<div id="noticeContent" class="notice-content" style="display: none">
							<strong>1.</strong> 如您使用的是 PassWall、PassWall2 路由插件，订阅编辑的 <strong>用户代理(User-Agent)</strong> 设置为 <strong>PassWall</strong> 即可；<br><br>
							<strong>2.</strong> 如您使用的是 SSR+ 等路由插件，推荐使用 <strong>Base64订阅地址</strong> 进行订阅；<br><br>
							<strong>3.</strong> 快速切换 <a href='${atob('aHR0cHM6Ly9naXRodWIuY29tL2NtbGl1L1dvcmtlclZsZXNzMnN1Yg==')}'>优选订阅生成器</a> 至：sub.google.com，您可将"?sub=sub.google.com"参数添加到链接末尾，例如：<br>
							&nbsp;&nbsp;https://${proxyhost}${hostName}/${uuid}<strong>?sub=sub.google.com</strong><br><br>
							<strong>4.</strong> 快速更换 PROXYIP 至：proxyip.fxxk.dedyn.io:443，您可将"?proxyip=proxyip.fxxk.dedyn.io:443"参数添加到链接末尾，例如：<br>
							&nbsp;&nbsp;https://${proxyhost}${hostName}/${uuid}<strong>?proxyip=proxyip.fxxk.dedyn.io:443</strong><br><br>
							<strong>5.</strong> 快速更换 SOCKS5 至：user:password@127.0.0.1:1080，您可将"?socks5=user:password@127.0.0.1:1080"参数添加到链接末尾，例如：<br>
							&nbsp;&nbsp;https://${proxyhost}${hostName}/${uuid}<strong>?socks5=user:password@127.0.0.1:1080</strong><br><br>
							<strong>6.</strong> 如需指定多个参数则需要使用'&'做间隔，例如：<br>
							&nbsp;&nbsp;https://${proxyhost}${hostName}/${uuid}?sub=sub.google.com<strong>&</strong>proxyip=proxyip.fxxk.dedyn.io
						</div>
					</div>

					<div class="section">
						<div class="section-title">🔧 配置信息</div>
						<div class="config-info">
							${动态UUID信息.replace(/\n/g, '<br>')}
							HOST: ${hostName}<br>
							UUID: ${userID}<br>
							FKID: ${fakeUserID}<br>
							UA: ${UA}<br>
							${订阅器.replace(/\n/g, '<br>')}
						</div>
					</div>

					<div class="section">
						<div class="section-title">📝 proxyConfig</div>
						<div class="config-info" style="overflow-x: auto; max-width: 100%;">
							<button class="copy-button" onclick="copyToClipboard('${proxyConfig}','qrcode_proxyConfig')">复制配置</button>
							<div style="word-break: break-all; overflow-wrap: anywhere;">${proxyConfig}</div>
							<div id="qrcode_proxyConfig" class="qrcode-container"></div>
						</div>
					</div>

					<div class="section">
						<div class="section-title">⚙️ Clash Meta 配置</div>
						<div class="config-info" style="overflow-x: auto; max-width: 100%;">
							<div style="word-break: break-all; overflow-wrap: anywhere;">${clash}</div>
						</div>
					</div>

					<div class="divider"></div>
					${cmad}
				</div>

				<script src="https://cdn.jsdelivr.net/npm/@keeex/qrcodejs-kx@1.0.2/qrcode.min.js"></script>
				<script>
					function copyToClipboard(text, qrcode) {
						navigator.clipboard.writeText(text).then(() => {
							alert('已复制到剪贴板');
						}).catch(err => {
							console.error('复制失败:', err);
						});
						const qrcodeDiv = document.getElementById(qrcode);
						qrcodeDiv.innerHTML = '';
						new QRCode(qrcodeDiv, {
							text: text,
							width: 220,
							height: 220,
							colorDark: "#000000",
							colorLight: "#ffffff",
							correctLevel: QRCode.CorrectLevel.Q,
							scale: 1
						});
					}

					function toggleNotice() {
						const noticeContent = document.getElementById('noticeContent');
						const noticeToggle = document.getElementById('noticeToggle');
						if (noticeContent.style.display === 'none') {
							noticeContent.style.display = 'block';
							noticeToggle.textContent = '实用订阅技巧 ∧';
						} else {
							noticeContent.style.display = 'none';
							noticeToggle.textContent = '实用订阅技巧 ∨';
						}
					}
				</script>
			</body>
			</html>
		`;
		return 节点配置页;
	} else {
		if (typeof fetch != 'function') {
			return 'Error: fetch is not available in this environment.';
		}

		let newAddressesapi = [];
		let newAddressescsv = [];
		let newAddressesnotlsapi = [];
		let newAddressesnotlscsv = [];

		if (hostName.includes(".workers.dev")) {
			noTLS = 'true';
			fakeHostName = `${fakeHostName}.workers.dev`;
			newAddressesnotlsapi = await 整理优选列表(addressesnotlsapi);
			newAddressesnotlscsv = await 整理测速结果('FALSE');
		} else if (hostName.includes(".pages.dev")) {
			fakeHostName = `${fakeHostName}.pages.dev`;
		} else if (hostName.includes("worker") || hostName.includes("notls") || noTLS == 'true') {
			noTLS = 'true';
			fakeHostName = `notls${fakeHostName}.net`;
			newAddressesnotlsapi = await 整理优选列表(addressesnotlsapi);
			newAddressesnotlscsv = await 整理测速结果('FALSE');
		} else {
			fakeHostName = `${fakeHostName}.xyz`
		}
		console.log(`虚假HOST: ${fakeHostName}`);
		let url = `${subProtocol}://${sub}/sub?host=${fakeHostName}&uuid=${fakeUserID + atob('JmVkZ2V0dW5uZWw9Y21saXUmcHJveHlpcD0=') + RproxyIP}&path=${encodeURIComponent(path)}`;
		let isBase64 = true;

		if (!sub || sub == "") {
			if (hostName.includes('workers.dev')) {
				if (proxyhostsURL && (!proxyhosts || proxyhosts.length == 0)) {
					try {
						const response = await fetch(proxyhostsURL);

						if (!response.ok) {
							console.error('获取地址时出错:', response.status, response.statusText);
							return; 
						}

						const text = await response.text();
						const lines = text.split('\n');
						const nonEmptyLines = lines.filter(line => line.trim() !== '');

						proxyhosts = proxyhosts.concat(nonEmptyLines);
					} catch (error) {
						console.error('获取地址时出错:', error);
					}
				}
				proxyhosts = [...new Set(proxyhosts)];
			}

			newAddressesapi = await 整理优选列表(addressesapi);
			newAddressescsv = await 整理测速结果('TRUE');
			url = `https://${hostName}/${fakeUserID + _url.search}`;
			if (hostName.includes("worker") || hostName.includes("notls") || noTLS == 'true') {
				if (_url.search) url += '&notls';
				else url += '?notls';
			}
			console.log(`虚假订阅: ${url}`);
		}

		if (!userAgent.includes(('CF-Workers-SUB').toLowerCase()) && !_url.searchParams.has('b64')  && !_url.searchParams.has('base64')) {
			if ((userAgent.includes('clash') && !userAgent.includes('nekobox')) || (_url.searchParams.has('clash') && !userAgent.includes('subconverter'))) {
				url = `${subProtocol}://${subConverter}/sub?target=clash&url=${encodeURIComponent(url)}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=${subEmoji}&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
				isBase64 = false;
			} else if (userAgent.includes('sing-box') || userAgent.includes('singbox') || ((_url.searchParams.has('singbox') || _url.searchParams.has('sb')) && !userAgent.includes('subconverter'))) {
				url = `${subProtocol}://${subConverter}/sub?target=singbox&url=${encodeURIComponent(url)}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=${subEmoji}&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
				isBase64 = false;
			} else if (userAgent.includes('loon') || (_url.searchParams.has('loon') && !userAgent.includes('subconverter'))) {
				// 添加Loon支持
				url = `${subProtocol}://${subConverter}/sub?target=loon&url=${encodeURIComponent(url)}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=${subEmoji}&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
				isBase64 = false;
			}
		}

		try {
			let content;
			if ((!sub || sub == "") && isBase64 == true) {
				content = await 生成本地订阅(fakeHostName, fakeUserID, noTLS, newAddressesapi, newAddressescsv, newAddressesnotlsapi, newAddressesnotlscsv);
			} else {
				const response = await fetch(url, {
					headers: {
						'User-Agent': UA + atob('IENGLVdvcmtlcnMtZWRnZXR1bm5lbC9jbWxpdQ==')
					}
				});
				content = await response.text();
			}

			if (_url.pathname == `/${fakeUserID}`) return content;

			return 恢复伪装信息(content, userID, hostName, fakeUserID, fakeHostName, isBase64);

		} catch (error) {
			console.error('Error fetching content:', error);
			return `Error fetching content: ${error.message}`;
		}
	}
}

async function 整理优选列表(api) {
	if (!api || api.length === 0) return [];

	let newapi = "";

	const controller = new AbortController();

	const timeout = setTimeout(() => {
		controller.abort(); 
	}, 2000); 

	try {
		const responses = await Promise.allSettled(api.map(apiUrl => fetch(apiUrl, {
			method: 'get',
			headers: {
				'Accept': 'text/html,application/xhtml+xml,application/xml;',
				'User-Agent': atob('Q0YtV29ya2Vycy1lZGdldHVubmVsL2NtbGl1')
			},
			signal: controller.signal 
		}).then(response => response.ok ? response.text() : Promise.reject())));

		for (const [index, response] of responses.entries()) {
			if (response.status === 'fulfilled') {
				const content = await response.value;

				const lines = content.split(/\r?\n/);
				let 节点备注 = '';
				let 测速端口 = '443';

				if (lines[0].split(',').length > 3) {
					const idMatch = api[index].match(/id=([^&]*)/);
					if (idMatch) 节点备注 = idMatch[1];

					const portMatch = api[index].match(/port=([^&]*)/);
					if (portMatch) 测速端口 = portMatch[1];

					for (let i = 1; i < lines.length; i++) {
						const columns = lines[i].split(',')[0];
						if (columns) {
							newapi += `${columns}:${测速端口}${节点备注 ? `#${节点备注}` : ''}\n`;
							if (api[index].includes('proxyip=true')) proxyIPPool.push(`${columns}:${测速端口}`);
						}
					}
				} else {
					if (api[index].includes('proxyip=true')) {
						// 如果URL带有'proxyip=true'，则将内容添加到proxyIPPool
						proxyIPPool = proxyIPPool.concat((await 整理(content)).map(item => {
							const baseItem = item.split('#')[0] || item;
							if (baseItem.includes(':')) {
								const port = baseItem.split(':')[1];
								if (!httpsPorts.includes(port)) {
									return baseItem;
								}
							} else {
								return `${baseItem}:443`;
							}
							return null; 
						}).filter(Boolean));
					}
					newapi += content + '\n';
				}
			}
		}
	} catch (error) {
		console.error(error);
	} finally {
		clearTimeout(timeout);
	}

	const newAddressesapi = await 整理(newapi);

	return newAddressesapi;
}

async function 整理测速结果(tls) {
	if (!addressescsv || addressescsv.length === 0) {
		return [];
	}

	let newAddressescsv = [];

	for (const csvUrl of addressescsv) {
		try {
			const response = await fetch(csvUrl);

			if (!response.ok) {
				console.error('获取CSV地址时出错:', response.status, response.statusText);
				continue;
			}

			const text = await response.text();
			let lines;
			if (text.includes('\r\n')) {
				lines = text.split('\r\n');
			} else {
				lines = text.split('\n');
			}

			const header = lines[0].split(',');
			const tlsIndex = header.indexOf('TLS');

			const ipAddressIndex = 0;
			const portIndex = 1;
			const dataCenterIndex = tlsIndex + remarkIndex; 

			if (tlsIndex === -1) {
				console.error('CSV文件缺少必需的字段');
				continue;
			}

			for (let i = 1; i < lines.length; i++) {
				const columns = lines[i].split(',');
				const speedIndex = columns.length - 1; 
				// 检查TLS是否为"TRUE"且速度大于DLS
				if (columns[tlsIndex].toUpperCase() === tls && parseFloat(columns[speedIndex]) > DLS) {
					const ipAddress = columns[ipAddressIndex];
					const port = columns[portIndex];
					const dataCenter = columns[dataCenterIndex];

					const formattedAddress = `${ipAddress}:${port}#${dataCenter}`;
					newAddressescsv.push(formattedAddress);
					if (csvUrl.includes('proxyip=true') && columns[tlsIndex].toUpperCase() == 'true' && !httpsPorts.includes(port)) {
						// 如果URL带有'proxyip=true'，则将内容添加到proxyIPPool
						proxyIPPool.push(`${ipAddress}:${port}`);
					}
				}
			}
		} catch (error) {
			console.error('获取CSV地址时出错:', error);
			continue;
		}
	}

	return newAddressescsv;
}

function 生成本地订阅(host, UUID, noTLS, newAddressesapi, newAddressescsv, newAddressesnotlsapi, newAddressesnotlscsv) {
	const regex = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[.*\]):?(\d+)?#?(.*)?$/;
	addresses = addresses.concat(newAddressesapi);
	addresses = addresses.concat(newAddressescsv);
	let notlsresponseBody;
	if (noTLS == 'true') {
		addressesnotls = addressesnotls.concat(newAddressesnotlsapi);
		addressesnotls = addressesnotls.concat(newAddressesnotlscsv);
		const uniqueAddressesnotls = [...new Set(addressesnotls)];

		notlsresponseBody = uniqueAddressesnotls.map(address => {
			let port = "-1";
			let addressid = address;

			const match = addressid.match(regex);
			if (!match) {
				if (address.includes(':') && address.includes('#')) {
					const parts = address.split(':');
					address = parts[0];
					const subParts = parts[1].split('#');
					port = subParts[0];
					addressid = subParts[1];
				} else if (address.includes(':')) {
					const parts = address.split(':');
					address = parts[0];
					port = parts[1];
				} else if (address.includes('#')) {
					const parts = address.split('#');
					address = parts[0];
					addressid = parts[1];
				}

				if (addressid.includes(':')) {
					addressid = addressid.split(':')[0];
				}
			} else {
				address = match[1];
				port = match[2] || port;
				addressid = match[3] || address;
			}

			const httpPorts = ["8080", "8880", "2052", "2082", "2086", "2095"];
			if (!isValidIPv4(address) && port == "-1") {
				for (let httpPort of httpPorts) {
					if (address.includes(httpPort)) {
						port = httpPort;
						break;
					}
				}
			}
			if (port == "-1") port = "80";

			let 伪装域名 = host;
			let 最终路径 = path;
			let 节点备注 = '';
			const 协议类型 = atob(啥啥啥_写的这是啥啊);

            const 维列斯Link = `${协议类型}://${UUID}@${address}:${port}?` + 
                `encryption=none&` + 
                `security=none&` + 
                `type=ws&` + 
                `host=${伪装域名}&` + 
                `path=${encodeURIComponent(最终路径)}` + 
                `#${encodeURIComponent(addressid + 节点备注)}`;

			return 维列斯Link;

		}).join('\n');

	}

	const uniqueAddresses = [...new Set(addresses)];

	const responseBody = uniqueAddresses.map(address => {
		let port = "-1";
		let addressid = address;

		const match = addressid.match(regex);
		if (!match) {
			if (address.includes(':') && address.includes('#')) {
				const parts = address.split(':');
				address = parts[0];
				const subParts = parts[1].split('#');
				port = subParts[0];
				addressid = subParts[1];
			} else if (address.includes(':')) {
				const parts = address.split(':');
				address = parts[0];
				port = parts[1];
			} else if (address.includes('#')) {
				const parts = address.split('#');
				address = parts[0];
				addressid = parts[1];
			}

			if (addressid.includes(':')) {
				addressid = addressid.split(':')[0];
			}
		} else {
			address = match[1];
			port = match[2] || port;
			addressid = match[3] || address;
		}

		if (!isValidIPv4(address) && port == "-1") {
			for (let httpsPort of httpsPorts) {
				if (address.includes(httpsPort)) {
					port = httpsPort;
					break;
				}
			}
		}
		if (port == "-1") port = "443";

		let 伪装域名 = host;
		let 最终路径 = path;
		let 节点备注 = '';
		const matchingProxyIP = proxyIPPool.find(proxyIP => proxyIP.includes(address));
		if (matchingProxyIP) 最终路径 = `/?proxyip=${matchingProxyIP}`;

		if (proxyhosts.length > 0 && (伪装域名.includes('.workers.dev'))) {
			最终路径 = `/${伪装域名}${最终路径}`;
			伪装域名 = proxyhosts[Math.floor(Math.random() * proxyhosts.length)];
			节点备注 = ` 已启用临时域名中转服务，请尽快绑定自定义域！`;
		}

		const 协议类型 = atob(啥啥啥_写的这是啥啊);

		const 维列斯Link = `${协议类型}://${UUID}@${address}:${port}?` + 
			`encryption=none&` +
			`security=tls&` +
			`sni=${伪装域名}&` +
			`fp=randomized&` +
			`alpn=h3&` + 
			`type=ws&` +
			`host=${伪装域名}&` +
                        `path=${encodeURIComponent(最终路径)}` + 
			`#${encodeURIComponent(addressid + 节点备注)}`;

		return 维列斯Link;
	}).join('\n');

	let base64Response = responseBody; 
	if (noTLS == 'true') base64Response += `\n${notlsresponseBody}`;
	if (link.length > 0) base64Response += '\n' + link.join('\n');
	return btoa(base64Response);
}

// 优化 整理 函数
async function 整理(内容) {
    const 替换后的内容 = 内容.replace(/[	|"'\r\n]+/g, ',').replace(/,+/g, ',')
        .replace(/^,|,$/g, '');
    
    return 替换后的内容.split(',');
}

async function sendMessage(type, ip, add_data = "") {
	if (!BotToken || !ChatID) return;

	try {
		let msg = "";
		const response = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN`);
		if (response.ok) {
			const ipInfo = await response.json();
			msg = `${type}\nIP: ${ip}\n国家: ${ipInfo.country}\n<tg-spoiler>城市: ${ipInfo.city}\n组织: ${ipInfo.org}\nASN: ${ipInfo.as}\n${add_data}`;
		} else {
			msg = `${type}\nIP: ${ip}\n<tg-spoiler>${add_data}`;
		}

		const url = `https://api.telegram.org/bot${BotToken}/sendMessage?chat_id=${ChatID}&parse_mode=HTML&text=${encodeURIComponent(msg)}`;
		return fetch(url, {
			method: 'GET',
			headers: {
				'Accept': 'text/html,application/xhtml+xml,application/xml;',
				'Accept-Encoding': 'gzip, deflate, br',
				'User-Agent': 'Mozilla/5.0 Chrome/90.0.4430.72'
			}
		});
	} catch (error) {
		console.error('Error sending message:', error);
	}
}

function isValidIPv4(address) {
	const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
	return ipv4Regex.test(address);
}

function 生成动态UUID(密钥) {
	const 时区偏移 = 8; 
	const 起始日期 = new Date(2007, 6, 7, 更新时间, 0, 0); 
	const 一周的毫秒数 = 1000 * 60 * 60 * 24 * 有效时间;

	function 获取当前周数() {
		const 现在 = new Date();
		const 调整后的现在 = new Date(现在.getTime() + 时区偏移 * 60 * 60 * 1000);
		const 时间差 = Number(调整后的现在) - Number(起始日期);
		return Math.ceil(时间差 / 一周的毫秒数);
	}

	function 生成UUID(基础字符串) {
		const 哈希缓冲区 = new TextEncoder().encode(基础字符串);
		return crypto.subtle.digest('SHA-256', 哈希缓冲区).then((哈希) => {
			const 哈希数组 = Array.from(new Uint8Array(哈希));
			const 十六进制哈希 = 哈希数组.map(b => b.toString(16).padStart(2, '0')).join('');
			return `${十六进制哈希.substr(0, 8)}-${十六进制哈希.substr(8, 4)}-4${十六进制哈希.substr(13, 3)}-${(parseInt(十六进制哈希.substr(16, 2), 16) & 0x3f | 0x80).toString(16)}${十六进制哈希.substr(18, 2)}-${十六进制哈希.substr(20, 12)}`;
		});
	}

	const 当前周数 = 获取当前周数(); 
	const 结束时间 = new Date(起始日期.getTime() + 当前周数 * 一周的毫秒数);

	const 当前UUIDPromise = 生成UUID(密钥 + 当前周数);
	const 上一个UUIDPromise = 生成UUID(密钥 + (当前周数 - 1));

	const 到期时间UTC = new Date(结束时间.getTime() - 时区偏移 * 60 * 60 * 1000); // UTC时间
	const 到期时间字符串 = `到期时间(UTC): ${到期时间UTC.toISOString().slice(0, 19).replace('T', ' ')} (UTC+8): ${结束时间.toISOString().slice(0, 19).replace('T', ' ')}\n`;

	return Promise.all([当前UUIDPromise, 上一个UUIDPromise, 到期时间字符串]);
}

async function 迁移地址列表(env, txt = 'ADD.txt') {
	const 旧数据 = await env.KV.get(`/${txt}`);
	const 新数据 = await env.KV.get(txt);

	if (旧数据 && !新数据) {
		await env.KV.put(txt, 旧数据);
		await env.KV.delete(`/${txt}`);
		return true;
	}
	return false;
}

async function KV(request, env, txt = 'ADD.txt') {
	try {
		if (request.method === "POST") {
			return await handlePostRequest(request, env, txt);
		}
		return await handleGetRequest(env, txt);
	} catch (error) {
		console.error('处理请求时发生错误:', error);
		return new Response("服务器错误: " + error.message, {
			status: 500,
			headers: { "Content-Type": "text/plain;charset=utf-8" }
		});
	}
}

async function handlePostRequest(request, env, txt) {
    if (!env.KV) {
        return new Response("未绑定KV空间", { status: 400 });
    }
    try {
        const content = await request.text();
        const url = new URL(request.url);
        const type = url.searchParams.get('type');

        // 根据类型保存到不同的KV
        switch(type) {
            case 'proxyip':
                await env.KV.put('PROXYIP.txt', content);
                break;
            case 'socks5':
                await env.KV.put('SOCKS5.txt', content);
                break;
            case 'sub':
                await env.KV.put('SUB.txt', content);
                break;
            case 'subapi':
                await env.KV.put('SUBAPI.txt', content);
                break;
            case 'subconfig':
                await env.KV.put('SUBCONFIG.txt', content);
                break;
            default:
                await env.KV.put(txt, content);
        }
        
        return new Response("保存成功");
    } catch (error) {
        console.error('保存KV时发生错误:', error);
        return new Response("保存失败: " + error.message, { status: 500 });
    }
}

async function handleGetRequest(env, txt) {
    let content = '';
    let hasKV = !!env.KV;
    let proxyIPContent = '';
    let socks5Content = '';
    let subContent = ''; 
    let subAPIContent = ''; // 添加SUBAPI内容变量
    let subConfigContent = ''; // 添加SUBCONFIG内容变量

    if (hasKV) {
        try {
            content = await env.KV.get(txt) || '';
            proxyIPContent = await env.KV.get('PROXYIP.txt') || '';
            socks5Content = await env.KV.get('SOCKS5.txt') || '';
            subContent = await env.KV.get('SUB.txt') || '';
            // 修改这里：不要使用默认值，只读取KV中的值
            subAPIContent = await env.KV.get('SUBAPI.txt') || '';
            subConfigContent = await env.KV.get('SUBCONFIG.txt') || '';
        } catch (error) {
            console.error('读取KV时发生错误:', error);
            content = '读取数据时发生错误: ' + error.message;
        }
    }

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>优选订阅列表</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                :root {
                    --primary-color: #4CAF50;
                    --secondary-color: #45a049;
                    --border-color: #e0e0e0;
                    --text-color: #333;
                    --background-color: #f5f5f5;
                }
                
                body {
                    margin: 0;
                    padding: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    line-height: 1.6;
                    color: var(--text-color);
                    background-color: var(--background-color);
                }

                .container {
                    max-width: 1000px;
                    margin: 0 auto;
                    background: white;
                    padding: 25px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }

                .title {
                    font-size: 1.5em;
                    color: var(--text-color);
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid var(--border-color);
                }

                .editor-container {
                    width: 100%;
                    margin: 20px 0;
                }

                .editor {
                    width: 100%;
                    height: 520px;
                    padding: 15px;
                    box-sizing: border-box;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    font-family: Monaco, Consolas, "Courier New", monospace;
                    font-size: 14px;
                    line-height: 1.5;
                    resize: vertical;
                    transition: border-color 0.3s ease;
                }

                .editor:focus {
                    outline: none;
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
                }

                .button-group {
                    display: flex;
                    gap: 12px;
                    margin-top: 15px;
                }

                .btn {
                    padding: 8px 20px;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .btn-primary {
                    background: var(--primary-color);
                    color: white;
                }

                .btn-primary:hover:not(:disabled) {
                    background: var(--secondary-color);
                }

                .btn-secondary {
                    background: #666;
                    color: white;
                }

                .btn-secondary:hover:not(:disabled) {
                    background: #555;
                }

                .save-status {
                    margin-left: 10px;
                    font-size: 14px;
                    color: #666;
                }

                .notice-toggle {
                    color: var(--primary-color);
                    cursor: pointer;
                    text-decoration: none;
                    display: inline-block;
                    margin: 10px 0;
                    font-weight: 500;
                }

                .notice-content {
                    background: #f8f9fa;
                    border-left: 4px solid var(--primary-color);
                    padding: 15px;
                    margin: 10px 0;
                    border-radius: 0 8px 8px 0;
                }

                .divider {
                    height: 1px;
                    background: var(--border-color);
                    margin: 20px 0;
                }

                @media (max-width: 768px) {
                    body {
                        padding: 10px;
                    }
                    
                    .container {
                        padding: 15px;
                    }
                    
                    .editor {
                        height: 400px;
                    }
                }

                .advanced-settings {
                    margin: 20px 0;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                }

                .advanced-settings-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    cursor: pointer;
                }

                .advanced-settings-content {
                    display: none;
                }

                .proxyip-editor {
                    width: 100%;
                    height: 100px;
                    margin-top: 10px;
                    padding: 10px;
                    border: 1px solid var(--border-color);
                    border-radius: 4px;
                    font-family: Monaco, Consolas, "Courier New", monospace;
                    font-size: 14px;
                    resize: vertical;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="title">📝 ${FileName} 优选订阅列表</div>
                
                <!-- 修改高级设置部分 -->
                <div class="advanced-settings">
                    <div class="advanced-settings-header" onclick="toggleAdvancedSettings()">
                        <h3 style="margin: 0;">⚙️ 高级设置</h3>
                        <span id="advanced-settings-toggle">∨</span>
                    </div>
                    <div id="advanced-settings-content" class="advanced-settings-content">
                        <!-- PROXYIP设置 -->
                        <div style="margin-bottom: 20px;">
                            <label for="proxyip"><strong>PROXYIP 设置</strong></label>
                            <p style="margin: 5px 0; color: #666;">每行一个IP，格式：IP:端口</p>
                            <textarea 
                                id="proxyip" 
                                class="proxyip-editor" 
                                placeholder="${decodeURIComponent(atob('JUU0JUJFJThCJUU1JUE2JTgyJTNBCjEuMi4zLjQlM0E0NDMKcHJveHkuZXhhbXBsZS5jb20lM0E4NDQz'))}"
                            >${proxyIPContent}</textarea>
                        </div>

                        <!-- SOCKS5设置 -->
                        <div style="margin-bottom: 20px;">
                            <label for="socks5"><strong>SOCKS5 设置</strong></label>
                            <p style="margin: 5px 0; color: #666;">每行一个地址，格式：[用户名:密码@]主机:端口</p>
                            <textarea 
                                id="socks5" 
                                class="proxyip-editor" 
                                placeholder="${decodeURIComponent(atob('JUU0JUJFJThCJUU1JUE2JTgyJTNBCnVzZXIlM0FwYXNzJTQwMTI3LjAuMC4xJTNBMTA4MAoxMjcuMC4wLjElM0ExMDgw'))}"
                            >${socks5Content}</textarea>
                        </div>

                        <!-- SUB设置 -->
                        <div style="margin-bottom: 20px;">
                            <label for="sub"><strong>SUB 设置</strong></label>
                            <p style="margin: 5px 0; color: #666;">只支持单个优选订阅生成器地址</p>
                            <textarea 
                                id="sub" 
                                class="proxyip-editor" 
                                placeholder="${decodeURIComponent(atob('JUU0JUJFJThCJUU1JUE2JTgyJTNBCnN1Yi5nb29nbGUuY29tCnN1Yi5leGFtcGxlLmNvbQ=='))}"
                            >${subContent}</textarea>
                        </div>
                        
                        <!-- SUBAPI设置 -->
                        <div style="margin-bottom: 20px;">
                            <label for="subapi"><strong>SUBAPI 设置</strong></label>
                            <p style="margin: 5px 0; color: #666;">订阅转换后端地址</p>
                            <textarea 
                                id="subapi" 
                                class="proxyip-editor" 
                                placeholder="${decodeURIComponent(atob('JUU0JUJFJThCJUU1JUE2JTgyJTNBCmFwaS52MS5tawpzdWIueGV0b24uZGV2'))}"
                            >${subAPIContent}</textarea>
                        </div>
                        
                        <!-- SUBCONFIG设置 -->
                        <div style="margin-bottom: 20px;">
                            <label for="subconfig"><strong>SUBCONFIG 设置</strong></label>
                            <p style="margin: 5px 0; color: #666;">订阅转换配置文件地址</p>
                            <textarea 
                                id="subconfig" 
                                class="proxyip-editor" 
                                placeholder="${decodeURIComponent(atob('JUU0JUJFJThCJUU1JUE2JTgyJTNBCmh0dHBzJTNBJTJGJTJGcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSUyRkFDTDRTU1IlMkZBQ0w0U1NSJTI1MkZtYXN0ZXIlMkZDbGFzaCUyRmNvbmZpZyUyRkFDTDRTU1JfT25saW5lX01pbmlfTXVsdGlNb2RlLmluaQ=='))}"
                            >${subConfigContent}</textarea>
                        </div>

                        <!-- 统一的保存按钮 -->
                        <div>
                            <button class="btn btn-primary" onclick="saveSettings()">保存设置</button>
                            <span id="settings-save-status" class="save-status"></span>
                        </div>
                    </div>
                </div>

                <!-- 保持现有内容 -->
                <a href="javascript:void(0);" id="noticeToggle" class="notice-toggle" onclick="toggleNotice()">
                    ℹ️ 注意事项 ∨
                </a>
                
                <div id="noticeContent" class="notice-content" style="display: none">
				    ${decodeURIComponent(atob('JTA5JTA5JTA5JTA5JTA5JTNDc3Ryb25nJTNFMS4lM0MlMkZzdHJvbmclM0UlMjBBREQlRTYlQTAlQkMlRTUlQkMlOEYlRTglQUYlQjclRTYlQUMlQTElRTclQUMlQUMlRTQlQjglODAlRTglQTElOEMlRTQlQjglODAlRTQlQjglQUElRTUlOUMlQjAlRTUlOUQlODAlRUYlQkMlOEMlRTYlQTAlQkMlRTUlQkMlOEYlRTQlQjglQkElMjAlRTUlOUMlQjAlRTUlOUQlODAlM0ElRTclQUIlQUYlRTUlOEYlQTMlMjMlRTUlQTQlODclRTYlQjMlQTglRUYlQkMlOENJUHY2JUU1JTlDJUIwJUU1JTlEJTgwJUU5JTgwJTlBJUU4JUE2JTgxJUU3JTk0JUE4JUU0JUI4JUFEJUU2JThCJUFDJUU1JThGJUIzJUU2JThDJUE1JUU4JUI1JUI3JUU1JUI5JUI2JUU1JThBJUEwJUU3JUFCJUFGJUU1JThGJUEzJUVGJUJDJThDJUU0JUI4JThEJUU1JThBJUEwJUU3JUFCJUFGJUU1JThGJUEzJUU5JUJCJTk4JUU4JUFFJUEwJUU0JUI4JUJBJTIyNDQzJTIyJUUzJTgwJTgyJUU0JUJFJThCJUU1JUE2JTgyJUVGJUJDJTlBJTNDYnIlM0UKJTIwJTIwMTI3LjAuMC4xJTNBMjA1MyUyMyVFNCVCQyU5OCVFOSU4MCU4OUlQJTNDYnIlM0UKJTIwJTIwJUU1JTkwJThEJUU1JUIxJTk1JTNBMjA1MyUyMyVFNCVCQyU5OCVFOSU4MCU4OSVFNSVBRiU5RiVFNSU5MCU4RCUzQ2JyJTNFCiUyMCUyMCU1QjI2MDYlM0E0NzAwJTNBJTNBJTVEJTNBMjA1MyUyMyVFNCVCQyU5OCVFOSU4MCU4OUlQVjYlM0NiciUzRSUzQ2JyJTNFCgolMDklMDklMDklMDklMDklM0NzdHJvbmclM0UyLiUzQyUyRnN0cm9uZyUzRSUyMEFEREFQSSUyMCVFNSVBNiU4MiVFNiU5OCVBRiVFNiU5OCVBRiVFNCVCQiVBMyVFNCVCRCU5Q0lQJUVGJUJDJThDJUU1JThGJUFGJUU0JUJEJTlDJUU0JUI4JUJBUFJPWFlJUCVFNyU5QSU4NCVFOCVBRiU5RCVFRiVCQyU4QyVFNSU4RiVBRiVFNSVCMCU4NiUyMiUzRnByb3h5aXAlM0R0cnVlJTIyJUU1JThGJTgyJUU2JTk1JUIwJUU2JUI3JUJCJUU1JThBJUEwJUU1JTg4JUIwJUU5JTkzJUJFJUU2JThFJUE1JUU2JTlDJUFCJUU1JUIwJUJFJUVGJUJDJThDJUU0JUJFJThCJUU1JUE2JTgyJUVGJUJDJTlBJTNDYnIlM0UKJTIwJTIwaHR0cHMlM0ElMkYlMkZyYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tJTJGY21saXUlMkZXb3JrZXJWbGVzczJzdWIlMkZtYWluJTJGYWRkcmVzc2VzYXBpLnR4dCUzRnByb3h5aXAlM0R0cnVlJTNDYnIlM0UlM0NiciUzRQoKJTA5JTA5JTA5JTA5JTA5JTNDc3Ryb25nJTNFMy4lM0MlMkZzdHJvbmclM0UlMjBBRERBUEklMjAlRTUlQTYlODIlRTYlOTglQUYlMjAlM0NhJTIwaHJlZiUzRCUyN2h0dHBzJTNBJTJGJTJGZ2l0aHViLmNvbSUyRlhJVTIlMkZDbG91ZGZsYXJlU3BlZWRUZXN0JTI3JTNFQ2xvdWRmbGFyZVNwZWVkVGVzdCUzQyUyRmElM0UlMjAlRTclOUElODQlMjBjc3YlMjAlRTclQkIlOTMlRTYlOUUlOUMlRTYlOTYlODclRTQlQkIlQjclRTMlODAlODIlRTQlQkUlOEIlRTUlQTYlODIlRUYlQkMlOUElM0NiciUzRQolMjAlMjBodHRwcyUzQSUyRiUyRnJhdy5naXRodWJ1c2VyY29udGVudC5jb20lMkZjbWxpdSUyRldvcmtlclZsZXNzMnN1YiUyRm1haW4lMkZDbG91ZGZsYXJlU3BlZWRUZXN0LmNzdiUzQ2JyJTNF'))}
                </div>

                <div class="editor-container">
                    ${hasKV ? `
                        <textarea class="editor" 
                            placeholder="${decodeURIComponent(atob('QUREJUU3JUE0JUJBJUU0JUJFJThCJUVGJUJDJTlBCnZpc2EuY24lMjMlRTQlQkMlOTglRTklODAlODklRTUlOUYlOUYlRTUlOTAlOEQKMTI3LjAuMC4xJTNBMTIzNCUyM0NGbmF0CiU1QjI2MDYlM0E0NzAwJTNBJTNBJTVEJTNBMjA1MyUyM0lQdjYKCiVFNiVCMyVBOCVFNiU4NCU4RiVFRiVCQyU5QQolRTYlQUYlOEYlRTglQTElOEMlRTQlQjglODAlRTQlQjglQUElRTUlOUMlQjAlRTUlOUQlODAlRUYlQkMlOEMlRTYlQTAlQkMlRTUlQkMlOEYlRTQlQjglQkElMjAlRTUlOUMlQjAlRTUlOUQlODAlM0ElRTclQUIlQUYlRTUlOEYlQTMlMjMlRTUlQTQlODclRTYlQjMlQTgKSVB2NiVFNSU5QyVCMCVFNSU5RCU4MCVFOSU5QyU4MCVFOCVBNiU4MSVFNyU5NCVBOCVFNCVCOCVBRCVFNiU4QiVBQyVFNSU4RiVCNyVFNiU4QiVBQyVFOCVCNSVCNyVFNiU5RCVBNSVFRiVCQyU4QyVFNSVBNiU4MiVFRiVCQyU5QSU1QjI2MDYlM0E0NzAwJTNBJTNBJTVEJTNBMjA1MwolRTclQUIlQUYlRTUlOEYlQTMlRTQlQjglOEQlRTUlODYlOTklRUYlQkMlOEMlRTklQkIlOTglRTglQUUlQTQlRTQlQjglQkElMjA0NDMlMjAlRTclQUIlQUYlRTUlOEYlQTMlRUYlQkMlOEMlRTUlQTYlODIlRUYlQkMlOUF2aXNhLmNuJTIzJUU0JUJDJTk4JUU5JTgwJTg5JUU1JTlGJTlGJUU1JTkwJThECgoKQUREQVBJJUU3JUE0JUJBJUU0JUJFJThCJUVGJUJDJTlBCmh0dHBzJTNBJTJGJTJGcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSUyRmNtbGl1JTJGV29ya2VyVmxlc3Myc3ViJTJGcmVmcyUyRmhlYWRzJTJGbWFpbiUyRmFkZHJlc3Nlc2FwaS50eHQKCiVFNiVCMyVBOCVFNiU4NCU4RiVFRiVCQyU5QUFEREFQSSVFNyU5QiVCNCVFNiU4RSVBNSVFNiVCNyVCQiVFNSU4QSVBMCVFNyU5QiVCNCVFOSU5MyVCRSVFNSU4RCVCMyVFNSU4RiVBRg=='))}"
                            id="content">${content}</textarea>
                        <div class="button-group">
                            <button class="btn btn-secondary" onclick="goBack()">返回配置页</button>
                            <button class="btn btn-primary" onclick="saveContent(this)">保存</button>
                            <button class="btn" style="background-color: #673AB7; color: white;" onclick="goBestIP()">在线优选IP</button>
                            <span class="save-status" id="saveStatus"></span>
                        </div>
                        <div class="divider"></div>
                        ${cmad}
                    ` : '<p>未绑定KV空间</p>'}
                </div>
            </div>

            <script>
            function goBack() {
                const pathParts = window.location.pathname.split('/');
                pathParts.pop(); // 移除 "edit"
                const newPath = pathParts.join('/');
                window.location.href = newPath;
            }
            
            function goBestIP() {
                // 跳转到在线优选IP页面
                const pathParts = window.location.pathname.split('/');
                pathParts.pop(); // 移除 "edgetunnel"
                pathParts.push('bestip'); // 添加 "bestip"
                const newPath = pathParts.join('/');
                window.location.href = newPath;
            }

            async function saveContent(button) {
                try {
                    button.disabled = true;
                    const content = document.getElementById('content').value;
                    const saveStatus = document.getElementById('saveStatus');
                    
                    saveStatus.textContent = '保存中...';
                    
                    const response = await fetch(window.location.href, {
                        method: 'POST',
                        body: content
                    });

                    if (response.ok) {
                        saveStatus.textContent = '✅ 保存成功';
                        setTimeout(() => {
                            saveStatus.textContent = '';
                        }, 3000);
                    } else {
                        throw new Error('保存失败');
                    }
                } catch (error) {
                    const saveStatus = document.getElementById('saveStatus');
                    saveStatus.textContent = '❌ ' + error.message;
                    console.error('保存时发生错误:', error);
                } finally {
                    button.disabled = false;
                }
            }

            function toggleNotice() {
                const noticeContent = document.getElementById('noticeContent');
                const noticeToggle = document.getElementById('noticeToggle');
                if (noticeContent.style.display === 'none') {
                    noticeContent.style.display = 'block';
                    noticeToggle.textContent = 'ℹ️ 注意事项 ∧';
                } else {
                    noticeContent.style.display = 'none';
                    noticeToggle.textContent = 'ℹ️ 注意事项 ∨';
                }
            }

            function toggleAdvancedSettings() {
                const content = document.getElementById('advanced-settings-content');
                const toggle = document.getElementById('advanced-settings-toggle');
                if (content.style.display === 'none' || !content.style.display) {
                    content.style.display = 'block';
                    toggle.textContent = '∧';
                } else {
                    content.style.display = 'none';
                    toggle.textContent = '∨';
                }
            }

            // 修改保存设置函数
            async function saveSettings() {
                const saveStatus = document.getElementById('settings-save-status');
                saveStatus.textContent = '保存中...';
                
                try {
                    // 保存PROXYIP设置
                    const proxyipContent = document.getElementById('proxyip').value;
                    const proxyipResponse = await fetch(window.location.href + '?type=proxyip', {
                        method: 'POST',
                        body: proxyipContent
                    });

                    // 保存SOCKS5设置
                    const socks5Content = document.getElementById('socks5').value;
                    const socks5Response = await fetch(window.location.href + '?type=socks5', {
                        method: 'POST',
                        body: socks5Content
                    });

                    // 保存SUB设置
                    const subContent = document.getElementById('sub').value;
                    const subResponse = await fetch(window.location.href + '?type=sub', {
                        method: 'POST',
                        body: subContent
                    });
                    
                    // 保存SUBAPI设置
                    const subapiContent = document.getElementById('subapi').value;
                    const subapiResponse = await fetch(window.location.href + '?type=subapi', {
                        method: 'POST',
                        body: subapiContent
                    });
                    
                    // 保存SUBCONFIG设置
                    const subconfigContent = document.getElementById('subconfig').value;
                    const subconfigResponse = await fetch(window.location.href + '?type=subconfig', {
                        method: 'POST',
                        body: subconfigContent // 即使是空字符串也会被保存
                    });

                    if (proxyipResponse.ok && socks5Response.ok && subResponse.ok && 
                        subapiResponse.ok && subconfigResponse.ok) {
                        saveStatus.textContent = '✅ 保存成功';
                        setTimeout(() => {
                            saveStatus.textContent = '';
                        }, 3000);
                    } else {
                        throw new Error('保存失败');
                    }
                } catch (error) {
                    saveStatus.textContent = '❌ ' + error.message;
                    console.error('保存设置时发生错误:', error);
                }
            }
            </script>
        </body>
        </html>
    `;

    return new Response(html, {
        headers: { "Content-Type": "text/html;charset=utf-8" }
    });
}

async function bestIP(request, env, txt = 'ADD.txt') {
    const country = request.cf?.country || 'CN';
    const url = new URL(request.url);

    async function GetCFIPs(ipSource = 'official', targetPort = '443') {
        try {
            let response;
            if (ipSource === 'as13335') {
                // AS13335列表
                response = await fetch('https://raw.githubusercontent.com/ipverse/asn-ip/master/as/13335/ipv4-aggregated.txt');
            } else if (ipSource === 'as209242') {
                // AS209242列表
                response = await fetch('https://raw.githubusercontent.com/ipverse/asn-ip/master/as/209242/ipv4-aggregated.txt');
            } else if (ipSource === 'as24429') {
                // AS24429列表
                response = await fetch('https://raw.githubusercontent.com/ipverse/asn-ip/master/as/24429/ipv4-aggregated.txt');
            } else if (ipSource === 'as199524') {
                // AS199524列表
                response = await fetch('https://raw.githubusercontent.com/ipverse/asn-ip/master/as/199524/ipv4-aggregated.txt');
            } else if (ipSource === 'cm') {
                // CM整理列表
                response = await fetch('https://raw.githubusercontent.com/cmliu/cmliu/main/CF-CIDR.txt');
            } else if (ipSource === 'proxyip') {
                // 反代IP列表 (直接IP，非CIDR)
                response = await fetch('https://raw.githubusercontent.com/cmliu/ACL4SSR/main/baipiao.txt');
                const text = response.ok ? await response.text() : '';
                
                // 解析并过滤符合端口的IP
                const allLines = text.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));
                
                const validIps = [];
                
                for (const line of allLines) {
                    const parsedIP = parseProxyIPLine(line, targetPort);
                    if (parsedIP) {
                        validIps.push(parsedIP);
                    }
                }
                
                console.log(`反代IP列表解析完成，端口${targetPort}匹配到${validIps.length}个有效IP`);
                
                // 如果超过1000个IP，随机选择1000个
                if (validIps.length > 1000) {
                    const shuffled = [...validIps].sort(() => 0.5 - Math.random());
                    const selectedIps = shuffled.slice(0, 1000);
                    console.log(`IP数量超过1000个，随机选择了${selectedIps.length}个IP`);
                    return selectedIps;
                } else {
                    return validIps;
                }
            } else {
                // CF官方列表 (默认)
                response = await fetch('https://www.cloudflare.com/ips-v4/');
            }

            const text = response.ok ? await response.text() : `173.245.48.0/20
103.21.244.0/22
103.22.200.0/22
103.31.4.0/22
141.101.64.0/18
108.162.192.0/18
190.93.240.0/20
188.114.96.0/20
197.234.240.0/22
198.41.128.0/17
162.158.0.0/15
104.16.0.0/13
104.24.0.0/14
172.64.0.0/13
131.0.72.0/22`;
            const cidrs = text.split('\n').filter(line => line.trim() && !line.startsWith('#'));

            const ips = new Set(); // 使用Set去重
            const targetCount = 1000;
            let round = 1;

            // 不断轮次生成IP直到达到目标数量
            while (ips.size < targetCount) {
                console.log(`第${round}轮生成IP，当前已有${ips.size}个`);

                // 每轮为每个CIDR生成指定数量的IP
                for (const cidr of cidrs) {
                    if (ips.size >= targetCount) break;

                    const cidrIPs = generateIPsFromCIDR(cidr.trim(), round);
                    cidrIPs.forEach(ip => ips.add(ip));

                    console.log(`CIDR ${cidr} 第${round}轮生成${cidrIPs.length}个IP，总计${ips.size}个`);
                }

                round++;

                // 防止无限循环
                if (round > 100) {
                    console.warn('达到最大轮次限制，停止生成');
                    break;
                }
            }

            console.log(`最终生成${ips.size}个不重复IP`);
            return Array.from(ips).slice(0, targetCount);
        } catch (error) {
            console.error('获取CF IPs失败:', error);
            return [];
        }
    }

    // 新增：解析反代IP行的函数
    function parseProxyIPLine(line, targetPort) {
        try {
            // 移除首尾空格
            line = line.trim();
            if (!line) return null;
            
            let ip = '';
            let port = '';
            let comment = '';
            
            // 处理注释部分
            if (line.includes('#')) {
                const parts = line.split('#');
                const mainPart = parts[0].trim();
                comment = parts[1].trim();
                
                // 检查主要部分是否包含端口
                if (mainPart.includes(':')) {
                    const ipPortParts = mainPart.split(':');
                    if (ipPortParts.length === 2) {
                        ip = ipPortParts[0].trim();
                        port = ipPortParts[1].trim();
                    } else {
                        // 格式不正确，如":844347.254.171.15:8443"
                        console.warn(`无效的IP:端口格式: ${line}`);
                        return null;
                    }
                } else {
                    // 没有端口，默认443
                    ip = mainPart;
                    port = '443';
                }
            } else {
                // 没有注释
                if (line.includes(':')) {
                    const ipPortParts = line.split(':');
                    if (ipPortParts.length === 2) {
                        ip = ipPortParts[0].trim();
                        port = ipPortParts[1].trim();
                    } else {
                        // 格式不正确
                        console.warn(`无效的IP:端口格式: ${line}`);
                        return null;
                    }
                } else {
                    // 只有IP，默认443端口
                    ip = line;
                    port = '443';
                }
            }
            
            // 验证IP格式
            if (!isValidIP(ip)) {
                console.warn(`无效的IP地址: ${ip} (来源行: ${line})`);
                return null;
            }
            
            // 验证端口格式
            const portNum = parseInt(port);
            if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                console.warn(`无效的端口号: ${port} (来源行: ${line})`);
                return null;
            }
            
            // 检查端口是否匹配
            if (port !== targetPort) {
                return null; // 端口不匹配，过滤掉
            }
            
            // 构建返回格式
            if (comment) {
                return `${ip}:${port}#${comment}`;
            } else {
                return `${ip}:${port}`;
            }
            
        } catch (error) {
            console.error(`解析IP行失败: ${line}`, error);
            return null;
        }
    }
    
    // 新增：验证IP地址格式的函数
    function isValidIP(ip) {
        const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        const match = ip.match(ipRegex);
        
        if (!match) return false;
        
        // 检查每个数字是否在0-255范围内
        for (let i = 1; i <= 4; i++) {
            const num = parseInt(match[i]);
            if (num < 0 || num > 255) {
                return false;
            }
        }
        
        return true;
    }

    function generateIPsFromCIDR(cidr, count = 1) {
        const [network, prefixLength] = cidr.split('/');
        const prefix = parseInt(prefixLength);

        // 将IP地址转换为32位整数
        const ipToInt = (ip) => {
            return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
        };

        // 将32位整数转换为IP地址
        const intToIP = (int) => {
            return [
                (int >>> 24) & 255,
                (int >>> 16) & 255,
                (int >>> 8) & 255,
                int & 255
            ].join('.');
        };

        const networkInt = ipToInt(network);
        const hostBits = 32 - prefix;
        const numHosts = Math.pow(2, hostBits);

        // 限制生成数量不超过该CIDR的可用主机数
        const maxHosts = numHosts - 2; // -2 排除网络地址和广播地址
        const actualCount = Math.min(count, maxHosts);
        const ips = new Set();

        // 如果可用主机数太少，直接返回空数组
        if (maxHosts <= 0) {
            return [];
        }

        // 生成指定数量的随机IP
        let attempts = 0;
        const maxAttempts = actualCount * 10; // 防止无限循环

        while (ips.size < actualCount && attempts < maxAttempts) {
            const randomOffset = Math.floor(Math.random() * maxHosts) + 1; // +1 避免网络地址
            const randomIP = intToIP(networkInt + randomOffset);
            ips.add(randomIP);
            attempts++;
        }

        return Array.from(ips);
    }

    // POST请求处理
    if (request.method === "POST") {
        if (!env.KV) return new Response("未绑定KV空间", { status: 400 });

        try {
            const contentType = request.headers.get('Content-Type');

            // 处理JSON格式的保存/追加请求
            if (contentType && contentType.includes('application/json')) {
                const data = await request.json();
                const action = url.searchParams.get('action') || 'save';

                if (!data.ips || !Array.isArray(data.ips)) {
                    return new Response(JSON.stringify({ error: 'Invalid IP list' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                if (action === 'append') {
                    // 追加模式
                    const existingContent = await env.KV.get(txt) || '';
                    const newContent = data.ips.join('\n');

                    // 合并内容并去重
                    const existingLines = existingContent ?
                        existingContent.split('\n').map(line => line.trim()).filter(line => line) :
                        [];
                    const newLines = newContent.split('\n').map(line => line.trim()).filter(line => line);

                    // 使用Set进行去重
                    const allLines = [...existingLines, ...newLines];
                    const uniqueLines = [...new Set(allLines)];
                    const combinedContent = uniqueLines.join('\n');

                    // 检查合并后的内容大小
                    if (combinedContent.length > 24 * 1024 * 1024) {
                        return new Response(JSON.stringify({
                            error: `追加失败：合并后内容过大（${(combinedContent.length / 1024 / 1024).toFixed(2)}MB），超过KV存储限制（24MB）`
                        }), {
                            status: 400,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }

                    await env.KV.put(txt, combinedContent);

                    const addedCount = uniqueLines.length - existingLines.length;
                    const duplicateCount = newLines.length - addedCount;

                    let message = `成功追加 ${addedCount} 个新的优选IP（原有 ${existingLines.length} 个，现共 ${uniqueLines.length} 个）`;
                    if (duplicateCount > 0) {
                        message += `，已去重 ${duplicateCount} 个重复项`;
                    }

                    return new Response(JSON.stringify({
                        success: true,
                        message: message
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                } else {
                    // 保存模式（覆盖）
                    const content = data.ips.join('\n');

                    // 检查内容大小
                    if (content.length > 24 * 1024 * 1024) {
                        return new Response(JSON.stringify({
                            error: '内容过大，超过KV存储限制（24MB）'
                        }), {
                            status: 400,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }

                    await env.KV.put(txt, content);

                    return new Response(JSON.stringify({
                        success: true,
                        message: `成功保存 ${data.ips.length} 个优选IP`
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            } else {
                // 处理普通文本格式的保存请求（兼容原有功能）
                const content = await request.text();
                await env.KV.put(txt, content);
                return new Response("保存成功");
            }

        } catch (error) {
            console.error('处理POST请求时发生错误:', error);
            return new Response(JSON.stringify({
                error: '操作失败: ' + error.message
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // GET请求部分
    let content = '';
    let hasKV = !!env.KV;

    if (hasKV) {
        try {
            content = await env.KV.get(txt) || '';
        } catch (error) {
            console.error('读取KV时发生错误:', error);
            content = '读取数据时发生错误: ' + error.message;
        }
    }

    // 移除初始IP加载，改为在前端动态加载
    const cfIPs = []; // 初始为空数组

    // 判断是否为中国用户
    const isChina = country === 'CN';
    const countryDisplayClass = isChina ? '' : 'proxy-warning';
    const countryDisplayText = isChina ? `${country}` : `${country} ⚠️`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
    <title>Cloudflare IP优选</title>
    <style>
        body {
            width: 80%;
            margin: 0 auto;
            font-family: Tahoma, Verdana, Arial, sans-serif;
            padding: 20px;
        }
        .ip-list {
            background-color: #f5f5f5;
            padding: 10px;
            border-radius: 5px;
            max-height: 400px;
            overflow-y: auto;
        }
        .ip-item {
            margin: 2px 0;
            font-family: monospace;
        }
        .stats {
            background-color: #e3f2fd;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .test-info {
            margin-top: 15px;
            padding: 12px;
            background-color: #f3e5f5;
            border: 1px solid #ce93d8;
            border-radius: 6px;
            color: #4a148c;
        }
        .test-info p {
            margin: 0;
            font-size: 14px;
            line-height: 1.5;
        }
        .proxy-warning {
            color: #d32f2f !important;
            font-weight: bold !important;
            font-size: 1.1em;
        }
        .warning-notice {
            background-color: #ffebee;
            border: 2px solid #f44336;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
            color: #c62828;
        }
        .warning-notice h3 {
            margin: 0 0 10px 0;
            color: #d32f2f;
            font-size: 1.2em;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .warning-notice p {
            margin: 8px 0;
            line-height: 1.5;
        }
        .warning-notice ul {
            margin: 10px 0 10px 20px;
            line-height: 1.6;
        }
        .test-controls {
            margin: 20px 0;
            padding: 15px;
            background-color: #f9f9f9;
            border-radius: 5px;
        }
        .port-selector {
            margin: 10px 0;
        }
        .port-selector label {
            font-weight: bold;
            margin-right: 10px;
        }
        .port-selector select {
            padding: 5px 10px;
            font-size: 14px;
            border: 1px solid #ccc;
            border-radius: 3px;
        }
        .button-group {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 15px;
        }
        .test-button {
            background-color: #4CAF50;
            color: white;
            padding: 15px 32px;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            font-size: 16px;
            cursor: pointer;
            border: none;
            border-radius: 4px;
            transition: background-color 0.3s;
        }
        .test-button:disabled {
            background-color: #cccccc;
            cursor: not-allowed;
        }
        .save-button {
            background-color: #2196F3;
            color: white;
            padding: 15px 32px;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            font-size: 16px;
            cursor: pointer;
            border: none;
            border-radius: 4px;
            transition: background-color 0.3s;
        }
        .save-button:disabled {
            background-color: #cccccc;
            cursor: not-allowed;
        }
        .save-button:not(:disabled):hover {
            background-color: #1976D2;
        }
        .append-button {
            background-color: #FF9800;
            color: white;
            padding: 15px 32px;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            font-size: 16px;
            cursor: pointer;
            border: none;
            border-radius: 4px;
            transition: background-color 0.3s;
        }
        .append-button:disabled {
            background-color: #cccccc;
            cursor: not-allowed;
        }
        .append-button:not(:disabled):hover {
            background-color: #F57C00;
        }
        .edit-button {
            background-color: #9C27B0;
            color: white;
            padding: 15px 32px;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            font-size: 16px;
            cursor: pointer;
            border: none;
            border-radius: 4px;
            transition: background-color 0.3s;
        }
        .edit-button:hover {
            background-color: #7B1FA2;
        }
        .back-button {
            background-color: #607D8B;
            color: white;
            padding: 15px 32px;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            font-size: 16px;
            cursor: pointer;
            border: none;
            border-radius: 4px;
            transition: background-color 0.3s;
        }
        .back-button:hover {
            background-color: #455A64;
        }
        .save-warning {
            margin-top: 10px;
            background-color: #fff3e0;
            border: 2px solid #ff9800;
            border-radius: 6px;
            padding: 12px;
            color: #e65100;
            font-weight: bold;
        }
        .save-warning small {
            font-size: 14px;
            line-height: 1.5;
            display: block;
        }
        .message {
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
            display: none;
        }
        .message.success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .message.error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .progress {
            width: 100%;
            background-color: #f0f0f0;
            border-radius: 5px;
            margin: 10px 0;
        }
        .progress-bar {
            width: 0%;
            height: 20px;
            background-color: #4CAF50;
            border-radius: 5px;
            transition: width 0.3s;
        }
        .good-latency { color: #4CAF50; font-weight: bold; }
        .medium-latency { color: #FF9800; font-weight: bold; }
        .bad-latency { color: #f44336; font-weight: bold; }
        .show-more-section {
            text-align: center;
            margin: 10px 0;
            padding: 10px;
            background-color: #f0f0f0;
            border-radius: 5px;
        }
        .show-more-btn {
            background-color: #607D8B;
            color: white;
            padding: 8px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.3s;
        }
        .show-more-btn:hover {
            background-color: #455A64;
        }
        .ip-display-info {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
        }
        .save-tip {
            margin-top: 15px;
            padding: 12px;
            background-color: #e8f5e8;
            border: 1px solid #4CAF50;
            border-radius: 6px;
            color: #2e7d32;
            font-size: 14px;
            line-height: 1.5;
        }
        .save-tip strong {
            color: #1b5e20;
        }
        .warm-tips {
            margin: 20px 0;
            padding: 15px;
            background-color: #fff3e0;
            border: 2px solid #ff9800;
            border-radius: 8px;
            color: #e65100;
        }
        .warm-tips h3 {
            margin: 0 0 10px 0;
            color: #f57c00;
            font-size: 1.1em;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .warm-tips p {
            margin: 8px 0;
            line-height: 1.6;
            font-size: 14px;
        }
        .warm-tips ul {
            margin: 10px 0 10px 20px;
            line-height: 1.6;
        }
        .warm-tips li {
            margin: 5px 0;
            font-size: 14px;
        }
        .warm-tips strong {
            color: #e65100;
            font-weight: bold;
        }
    </style>
    </head>
    <body>
    <h1>在线优选IP</h1>
    
    ${!isChina ? `
    <div class="warning-notice">
        <h3>🚨 代理检测警告</h3>
        <p><strong>检测到您当前很可能处于代理/VPN环境中！</strong></p>
        <p>在代理状态下进行的IP优选测试结果将不准确，可能导致：</p>
        <ul>
            <li>延迟数据失真，无法反映真实网络状况</li>
            <li>优选出的IP在直连环境下表现不佳</li>
            <li>测试结果对实际使用场景参考价值有限</li>
        </ul>
        <p><strong>建议操作：</strong>请关闭所有代理软件（VPN、科学上网工具等），确保处于直连网络环境后重新访问本页面。</p>
    </div>
    ` : ''}

    <div class="stats">
        <h2>统计信息</h2>
        <p><strong>您的国家：</strong><span class="${countryDisplayClass}">${countryDisplayText}</span></p>
        <p><strong>获取到的IP总数：</strong><span id="ip-count">点击开始测试后加载</span></p>
        <p><strong>测试进度：</strong><span id="progress-text">未开始</span></p>
        <div class="progress">
            <div class="progress-bar" id="progress-bar"></div>
        </div>
        <div class="test-info">
            <p><strong>📊 测试说明：</strong>当前优选方式仅进行网络延迟测试，主要评估连接响应速度，并未包含带宽速度测试。延迟测试可快速筛选出响应最快的IP节点，适合日常使用场景的初步优选。</p>
        </div>
    </div>
    
    <div class="warm-tips" id="warm-tips">
        <h3>💡 温馨提示</h3>
        <p><strong>优选完成但测试"真连接延迟"为 -1？</strong>这很有可能是您的网络运营商对你的请求进行了阻断。</p>
        <p><strong>建议尝试以下解决方案：</strong></p>
        <ul>
            <li><strong>更换端口：</strong>尝试使用其他端口（如 2053、2083、2087、2096、8443）</li>
            <li><strong>更换IP库：</strong>切换到不同的IP来源（CM整理列表、AS13335、AS209242列表等，但如果你不明白AS24429和AS199524意味着什么，那就不要选。）</li>
            <li><strong>更换自定义域名：</strong>如果您使用的还是免费域名，那么您更应该尝试一下更换自定义域</li>
        </ul>
        <p>💡 <strong>小贴士：</strong>不同地区和网络环境对各端口的支持情况可能不同，多尝试几个端口组合通常能找到适合的IP。</p>
    </div>

    <div class="test-controls">
        <div class="port-selector">
            <label for="ip-source-select">IP库：</label>
            <select id="ip-source-select">
                <option value="official">CF官方列表</option>
                <option value="cm">CM整理列表</option>
                <option value="as13335">AS13335列表</option>
                <option value="as209242">AS209242列表</option>
                <option value="as24429">AS24429列表(Alibaba)</option>
                <option value="as199524">AS199524列表(G-Core)</option>
                <option value="proxyip">反代IP列表</option>
            </select>

            <label for="port-select" style="margin-left: 20px;">端口：</label>
            <select id="port-select">
                <option value="443">443</option>
                <option value="2053">2053</option>
                <option value="2083">2083</option>
                <option value="2087">2087</option>
                <option value="2096">2096</option>
                <option value="8443">8443</option>
            </select>
        </div>
        <div class="button-group">
            <button class="test-button" id="test-btn" onclick="startTest()">开始延迟测试</button>
            <button class="save-button" id="save-btn" onclick="saveIPs()" disabled>覆盖保存优选IP</button>
            <button class="append-button" id="append-btn" onclick="appendIPs()" disabled>追加保存优选IP</button>
            <button class="edit-button" id="edit-btn" onclick="goEdit()">编辑优选列表</button>
            <button class="back-button" id="back-btn" onclick="goBack()">返回配置页</button>
        </div>
        <div class="save-warning">
            <small>⚠️ 重要提醒："覆盖保存优选IP"会完全覆盖当前 addresses/ADD 优选内容，请慎重考虑！建议优先使用"追加保存优选IP"功能。</small>
        </div>
        <div class="save-tip">
            <strong>💡 保存提示：</strong>[<strong>覆盖保存优选IP</strong>] 和 [<strong>追加保存优选IP</strong>] 功能仅会保存延迟最低的<strong>前16个优选IP</strong>。如需添加更多IP或进行自定义编辑，请使用 [<strong>编辑优选列表</strong>] 功能。
        </div>
        <div id="message" class="message"></div>
    </div>
    
    <h2>IP列表 <span id="result-count"></span></h2>
    <div class="ip-display-info" id="ip-display-info"></div>
    <div class="ip-list" id="ip-list">
        <div class="ip-item">请选择端口和IP库，然后点击"开始延迟测试"加载IP列表</div>
    </div>
    <div class="show-more-section" id="show-more-section" style="display: none;">
        <button class="show-more-btn" id="show-more-btn" onclick="toggleShowMore()">显示更多</button>
    </div>
    
    <script>
        let originalIPs = []; // 改为动态加载
        let testResults = [];
        let displayedResults = []; // 新增：存储当前显示的结果
        let showingAll = false; // 新增：标记是否显示全部内容
        let currentDisplayType = 'loading'; // 新增：当前显示类型 'loading' | 'results'
        
        // 新增：本地存储管理
        const StorageKeys = {
            PORT: 'cf-ip-test-port',
            IP_SOURCE: 'cf-ip-test-source'
        };
        
        // 初始化页面设置
        function initializeSettings() {
            const portSelect = document.getElementById('port-select');
            const ipSourceSelect = document.getElementById('ip-source-select');
            
            // 从本地存储读取上次的选择
            const savedPort = localStorage.getItem(StorageKeys.PORT);
            const savedIPSource = localStorage.getItem(StorageKeys.IP_SOURCE);
            
            // 恢复端口选择
            if (savedPort && portSelect.querySelector(\`option[value="\${savedPort}"]\`)) {
                portSelect.value = savedPort;
            } else {
                portSelect.value = '8443'; // 默认值
            }
            
            // 恢复IP库选择
            if (savedIPSource && ipSourceSelect.querySelector(\`option[value="\${savedIPSource}"]\`)) {
                ipSourceSelect.value = savedIPSource;
            } else {
                ipSourceSelect.value = 'official'; // 默认值改为CF官方列表
            }
            
            // 添加事件监听器保存选择
            portSelect.addEventListener('change', function() {
                localStorage.setItem(StorageKeys.PORT, this.value);
            });
            
            ipSourceSelect.addEventListener('change', function() {
                localStorage.setItem(StorageKeys.IP_SOURCE, this.value);
            });
        }
        
        // 页面加载完成后初始化设置
        document.addEventListener('DOMContentLoaded', initializeSettings);
        
        // 新增：切换显示更多/更少
        function toggleShowMore() {
            // 在测试过程中不允许切换显示
            if (currentDisplayType === 'testing') {
                return;
            }
            
            showingAll = !showingAll;
            
            if (currentDisplayType === 'loading') {
                displayLoadedIPs();
            } else if (currentDisplayType === 'results') {
                displayResults();
            }
        }
        
        // 新增：显示加载的IP列表
        function displayLoadedIPs() {
            const ipList = document.getElementById('ip-list');
            const showMoreSection = document.getElementById('show-more-section');
            const showMoreBtn = document.getElementById('show-more-btn');
            const ipDisplayInfo = document.getElementById('ip-display-info');
            
            if (originalIPs.length === 0) {
                ipList.innerHTML = '<div class="ip-item">加载IP列表失败，请重试</div>';
                showMoreSection.style.display = 'none';
                ipDisplayInfo.textContent = '';
                return;
            }
            
            const displayCount = showingAll ? originalIPs.length : Math.min(originalIPs.length, 16);
            const displayIPs = originalIPs.slice(0, displayCount);
            
            // 更新显示信息
            if (originalIPs.length <= 16) {
                ipDisplayInfo.textContent = \`显示全部 \${originalIPs.length} 个IP\`;
                showMoreSection.style.display = 'none';
            } else {
                ipDisplayInfo.textContent = \`显示前 \${displayCount} 个IP，共加载 \${originalIPs.length} 个IP\`;
                // 只在非测试状态下显示"显示更多"按钮
                if (currentDisplayType !== 'testing') {
                    showMoreSection.style.display = 'block';
                    showMoreBtn.textContent = showingAll ? '显示更少' : '显示更多';
                    showMoreBtn.disabled = false;
                } else {
                    showMoreSection.style.display = 'none';
                }
            }
            
            // 显示IP列表
            ipList.innerHTML = displayIPs.map(ip => \`<div class="ip-item">\${ip}</div>\`).join('');
        }
        
        function showMessage(text, type = 'success') {
            const messageDiv = document.getElementById('message');
            messageDiv.textContent = text;
            messageDiv.className = \`message \${type}\`;
            messageDiv.style.display = 'block';
            
            // 3秒后自动隐藏消息
            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 3000);
        }
        
        function updateButtonStates() {
            const saveBtn = document.getElementById('save-btn');
            const appendBtn = document.getElementById('append-btn');
            const hasResults = displayedResults.length > 0;
            
            saveBtn.disabled = !hasResults;
            appendBtn.disabled = !hasResults;
        }
        
        function disableAllButtons() {
            const testBtn = document.getElementById('test-btn');
            const saveBtn = document.getElementById('save-btn');
            const appendBtn = document.getElementById('append-btn');
            const editBtn = document.getElementById('edit-btn');
            const backBtn = document.getElementById('back-btn');
            const portSelect = document.getElementById('port-select');
            const ipSourceSelect = document.getElementById('ip-source-select');
            
            testBtn.disabled = true;
            saveBtn.disabled = true;
            appendBtn.disabled = true;
            editBtn.disabled = true;
            backBtn.disabled = true;
            portSelect.disabled = true;
            ipSourceSelect.disabled = true;
        }
        
        function enableButtons() {
            const testBtn = document.getElementById('test-btn');
            const editBtn = document.getElementById('edit-btn');
            const backBtn = document.getElementById('back-btn');
            const portSelect = document.getElementById('port-select');
            const ipSourceSelect = document.getElementById('ip-source-select');
            
            testBtn.disabled = false;
            editBtn.disabled = false;
            backBtn.disabled = false;
            portSelect.disabled = false;
            ipSourceSelect.disabled = false;
            updateButtonStates();
        }
        
        async function saveIPs() {
            if (displayedResults.length === 0) {
                showMessage('没有可保存的IP结果', 'error');
                return;
            }
            
            const saveBtn = document.getElementById('save-btn');
            const originalText = saveBtn.textContent;
            
            // 禁用所有按钮
            disableAllButtons();
            saveBtn.textContent = '保存中...';
            
            try {
                // 只保存前16个最优IP
                const saveCount = Math.min(displayedResults.length, 16);
                const ips = displayedResults.slice(0, saveCount).map(result => result.display);
                
                const response = await fetch('?action=save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ips })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showMessage(\`\${data.message}（已保存前\${saveCount}个最优IP）\`, 'success');
                } else {
                    showMessage(data.error || '保存失败', 'error');
                }
                
            } catch (error) {
                showMessage('保存失败: ' + error.message, 'error');
            } finally {
                saveBtn.textContent = originalText;
                enableButtons();
            }
        }
        
        async function appendIPs() {
            if (displayedResults.length === 0) {
                showMessage('没有可追加的IP结果', 'error');
                return;
            }
            
            const appendBtn = document.getElementById('append-btn');
            const originalText = appendBtn.textContent;
            
            // 禁用所有按钮
            disableAllButtons();
            appendBtn.textContent = '追加中...';
            
            try {
                // 只追加前16个最优IP
                const saveCount = Math.min(displayedResults.length, 16);
                const ips = displayedResults.slice(0, saveCount).map(result => result.display);
                
                const response = await fetch('?action=append', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ips })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showMessage(\`\${data.message}（已追加前\${saveCount}个最优IP）\`, 'success');
                } else {
                    showMessage(data.error || '追加失败', 'error');
                }
                
            } catch (error) {
                showMessage('追加失败: ' + error.message, 'error');
            } finally {
                appendBtn.textContent = originalText;
                enableButtons();
            }
        }
        
        function goEdit() {
            const currentUrl = window.location.href;
            const parentUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/'));
            window.location.href = parentUrl + '/edit';
        }
        
        function goBack() {
            const currentUrl = window.location.href;
            const parentUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/'));
            window.location.href = parentUrl;
        }
        
        async function testIP(ip, port) {
            const timeout = 999;
            
            // 解析IP格式
            const parsedIP = parseIPFormat(ip, port);
            if (!parsedIP) {
                return null;
            }
            
            // 第一次测试
            const firstResult = await singleTest(parsedIP.host, parsedIP.port, timeout);
            if (!firstResult) {
                return null; // 第一次测试失败，直接返回
            }
            
            // 第一次测试成功，再进行第二次测试
            console.log(\`IP \${parsedIP.host}:\${parsedIP.port} 第一次测试成功: \${firstResult.latency}ms，进行第二次测试...\`);
            
            const results = [firstResult];
            
            // 进行第二次测试
            const secondResult = await singleTest(parsedIP.host, parsedIP.port, timeout);
            if (secondResult) {
                results.push(secondResult);
                console.log(\`IP \${parsedIP.host}:\${parsedIP.port} 第二次测试: \${secondResult.latency}ms\`);
            }
            
            // 取最低延迟
            const bestResult = results.reduce((best, current) => 
                current.latency < best.latency ? current : best
            );
            
            const displayLatency = Math.floor(bestResult.latency / 2);
            
            console.log(\`IP \${parsedIP.host}:\${parsedIP.port} 最终结果: \${displayLatency}ms (原始: \${bestResult.latency}ms, 共\${results.length}次有效测试)\`);
            
            // 生成显示格式
            const comment = parsedIP.comment || 'CF优选IP';
            const display = \`\${parsedIP.host}:\${parsedIP.port}#\${comment} \${displayLatency}ms\`;
            
            return {
                ip: parsedIP.host,
                port: parsedIP.port,
                latency: displayLatency,
                originalLatency: bestResult.latency,
                testCount: results.length,
                comment: comment,
                display: display
            };
        }
        
        // 新增：解析IP格式的函数
        function parseIPFormat(ipString, defaultPort) {
            try {
                let host, port, comment;
                
                // 先处理注释部分（#之后的内容）
                let mainPart = ipString;
                if (ipString.includes('#')) {
                    const parts = ipString.split('#');
                    mainPart = parts[0];
                    comment = parts[1];
                }
                
                // 处理端口部分
                if (mainPart.includes(':')) {
                    const parts = mainPart.split(':');
                    host = parts[0];
                    port = parseInt(parts[1]);
                } else {
                    host = mainPart;
                    port = parseInt(defaultPort);
                }
                
                // 验证IP格式
                if (!host || !port || isNaN(port)) {
                    return null;
                }
                
                return {
                    host: host.trim(),
                    port: port,
                    comment: comment ? comment.trim() : null
                };
            } catch (error) {
                console.error('解析IP格式失败:', ipString, error);
                return null;
            }
        }
        
        async function singleTest(ip, port, timeout) {
            const startTime = Date.now();
            
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                
                const response = await fetch(\`https://\${ip}:\${port}/cdn-cgi/trace\`, {
                    signal: controller.signal,
                    mode: 'cors'
                });
                
                clearTimeout(timeoutId);
                // 如果请求成功了，说明这个IP不是我们要的
                return null;
                
            } catch (error) {
                const latency = Date.now() - startTime;
                
                // 检查是否是真正的超时（接近设定的timeout时间）
                if (latency >= timeout - 50) {
                    return null;
                }
                
                // 检查是否是 Failed to fetch 错误（通常是SSL/证书错误）
                if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                    return {
                        ip: ip,
                        port: port,
                        latency: latency
                    };
                }
                
                return null;
            }
        }
        
        async function testIPsWithConcurrency(ips, port, maxConcurrency = 32) {
            const results = [];
            const totalIPs = ips.length;
            let completedTests = 0;
            
            const progressBar = document.getElementById('progress-bar');
            const progressText = document.getElementById('progress-text');
            
            // 创建工作队列
            let index = 0;
            
            async function worker() {
                while (index < ips.length) {
                    const currentIndex = index++;
                    const ip = ips[currentIndex];
                    
                    const result = await testIP(ip, port);
                    if (result) {
                        results.push(result);
                    }
                    
                    completedTests++;
                    
                    // 更新进度
                    const progress = (completedTests / totalIPs) * 100;
                    progressBar.style.width = progress + '%';
                    progressText.textContent = \`\${completedTests}/\${totalIPs} (\${progress.toFixed(1)}%) - 有效IP: \${results.length}\`;
                }
            }
            
            // 创建工作线程
            const workers = Array(Math.min(maxConcurrency, ips.length))
                .fill()
                .map(() => worker());
            
            await Promise.all(workers);
            
            return results;
        }
        
        async function startTest() {
            const testBtn = document.getElementById('test-btn');
            const portSelect = document.getElementById('port-select');
            const ipSourceSelect = document.getElementById('ip-source-select');
            const progressBar = document.getElementById('progress-bar');
            const progressText = document.getElementById('progress-text');
            const ipList = document.getElementById('ip-list');
            const resultCount = document.getElementById('result-count');
            const ipCount = document.getElementById('ip-count');
            const ipDisplayInfo = document.getElementById('ip-display-info');
            const showMoreSection = document.getElementById('show-more-section');
            
            const selectedPort = portSelect.value;
            const selectedIPSource = ipSourceSelect.value;
            
            // 保存当前选择到本地存储
            localStorage.setItem(StorageKeys.PORT, selectedPort);
            localStorage.setItem(StorageKeys.IP_SOURCE, selectedIPSource);
            
            testBtn.disabled = true;
            testBtn.textContent = '加载IP列表...';
            portSelect.disabled = true;
            ipSourceSelect.disabled = true;
            testResults = [];
            displayedResults = []; // 重置显示结果
            showingAll = false; // 重置显示状态
            currentDisplayType = 'loading'; // 设置当前显示类型
            ipList.innerHTML = '<div class="ip-item">正在加载IP列表，请稍候...</div>';
            ipDisplayInfo.textContent = '';
            showMoreSection.style.display = 'none';
            updateButtonStates(); // 更新按钮状态
            
            // 重置进度条
            progressBar.style.width = '0%';
            
            // 根据IP库类型显示对应的加载信息
            let ipSourceName = '';
            switch(selectedIPSource) {
                case 'official':
                    ipSourceName = 'CF官方';
                    break;
                case 'cm':
                    ipSourceName = 'CM整理';
                    break;
                case 'as13335':
                    ipSourceName = 'CF全段';
                    break;
                case 'as209242':
                    ipSourceName = 'CF非官方';
                    break;
                case 'as24429':
                    ipSourceName = 'Alibaba';
                    break;
                case 'as199524':
                    ipSourceName = 'G-Core';
                    break;
                case 'proxyip':
                    ipSourceName = '反代IP';
                    break;
                default:
                    ipSourceName = '未知';
            }
            
            progressText.textContent = \`正在加载 \${ipSourceName} IP列表...\`;
            
            // 加载IP列表
            originalIPs = await loadIPs(selectedIPSource, selectedPort);

            if (originalIPs.length === 0) {
                ipList.innerHTML = '<div class="ip-item">加载IP列表失败，请重试</div>';
                ipCount.textContent = '0 个';
                testBtn.disabled = false;
                testBtn.textContent = '开始延迟测试';
                portSelect.disabled = false;
                ipSourceSelect.disabled = false;
                progressText.textContent = '加载失败';
                return;
            }
            
            // 更新IP数量显示
            ipCount.textContent = \`\${originalIPs.length} 个\`;
            
            // 显示加载的IP列表（默认显示前16个）
            displayLoadedIPs();
            
            // 开始测试
            testBtn.textContent = '测试中...';
            progressText.textContent = \`开始测试端口 \${selectedPort}...\`;
            currentDisplayType = 'testing'; // 切换到测试状态
            
            // 在测试开始时隐藏显示更多按钮
            showMoreSection.style.display = 'none';
            
            // 使用16个并发线程测试
            const results = await testIPsWithConcurrency(originalIPs, selectedPort, 16);
            
            // 按延迟排序
            testResults = results.sort((a, b) => a.latency - b.latency);
            
            // 显示结果
            currentDisplayType = 'results'; // 切换到结果显示状态
            showingAll = false; // 重置显示状态
            displayResults();
            
            testBtn.disabled = false;
            testBtn.textContent = '重新测试';
            portSelect.disabled = false;
            ipSourceSelect.disabled = false;
            progressText.textContent = \`完成 - 有效IP: \${testResults.length}/\${originalIPs.length} (端口: \${selectedPort}, IP库: \${ipSourceName})\`;
        }
        
        // 新增：加载IP列表的函数
        async function loadIPs(ipSource, port) {
            try {
                const response = await fetch(\`?loadIPs=\${ipSource}&port=\${port}\`, {
                    method: 'GET'
                });
                
                if (!response.ok) {
                    throw new Error('Failed to load IPs');
                }
                
                const data = await response.json();
                return data.ips || [];
            } catch (error) {
                console.error('加载IP列表失败:', error);
                return [];
            }
        }
        
        function displayResults() {
            const ipList = document.getElementById('ip-list');
            const resultCount = document.getElementById('result-count');
            const showMoreSection = document.getElementById('show-more-section');
            const showMoreBtn = document.getElementById('show-more-btn');
            const ipDisplayInfo = document.getElementById('ip-display-info');
            
            if (testResults.length === 0) {
                ipList.innerHTML = '<div class="ip-item">未找到有效的IP</div>';
                resultCount.textContent = '';
                ipDisplayInfo.textContent = '';
                showMoreSection.style.display = 'none';
                displayedResults = [];
                updateButtonStates();
                return;
            }
            
            // 确定显示数量
            const maxDisplayCount = showingAll ? testResults.length : Math.min(testResults.length, 16);
            displayedResults = testResults.slice(0, maxDisplayCount);
            
            // 更新结果计数显示
            if (testResults.length <= 16) {
                resultCount.textContent = \`(共测试出 \${testResults.length} 个有效IP)\`;
                ipDisplayInfo.textContent = \`显示全部 \${testResults.length} 个测试结果\`;
                showMoreSection.style.display = 'none';
            } else {
                resultCount.textContent = \`(共测试出 \${testResults.length} 个有效IP)\`;
                ipDisplayInfo.textContent = \`显示前 \${maxDisplayCount} 个测试结果，共 \${testResults.length} 个有效IP\`;
                showMoreSection.style.display = 'block';
                showMoreBtn.textContent = showingAll ? '显示更少' : '显示更多';
                showMoreBtn.disabled = false; // 确保在结果显示时启用按钮
            }
            
            const resultsHTML = displayedResults.map(result => {
                let className = 'good-latency';
                if (result.latency > 200) className = 'bad-latency';
                else if (result.latency > 100) className = 'medium-latency';
                
                return \`<div class="ip-item \${className}">\${result.display}</div>\`;
            }).join('');
            
            ipList.innerHTML = resultsHTML;
            updateButtonStates();
        }
    </script>
    
    </body>
    </html>
    `;

    // 处理加载IP的请求
    if (url.searchParams.get('loadIPs')) {
        const ipSource = url.searchParams.get('loadIPs');
        const port = url.searchParams.get('port') || '443';
        const ips = await GetCFIPs(ipSource, port);
        
        return new Response(JSON.stringify({ ips }), {
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=UTF-8',
        },
    });
}
