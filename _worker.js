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
		let 判断是否绑定KV空间 = env.KV ? ` [<a href='${_url.pathname}/edit'>编辑优选列表</a>]  [<a href='${_url.pathname}/bestip'>在线优选IP</a>]` : '';
		
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

    async function 在线优选IP(request, env) {
    // 默认端口列表
    const DEFAULT_PORTS = ['443', '2053', '2083', '2087', '2096', '8443'];

    // 从Cloudflare官方网站获取IP范围列表
    async function 获取Cloudflare_IP范围() {
        try {
            console.log('开始从Cloudflare官方网站获取IP范围列表...');
            const response = await fetch('https://www.cloudflare.com/ips-v4/');
            
            if (!response.ok) {
                throw new Error(`获取失败，状态码: ${response.status}`);
            }
            
            const text = await response.text();
            const ranges = text.trim().split(/\s+/);
            
            console.log(`成功获取到${ranges.length}个Cloudflare IP范围`);
            return ranges;
        } catch (error) {
            console.error('获取Cloudflare IP范围失败:', error);
            // 返回一些默认值作为备份
            return [
                '173.245.48.0/20',
                '103.21.244.0/22',
                '103.22.200.0/22',
                '103.31.4.0/22',
                '141.101.64.0/18',
                '108.162.192.0/18',
                '190.93.240.0/20',
                '188.114.96.0/20',
                '197.234.240.0/22',
                '198.41.128.0/17',
                '162.158.0.0/15',
                '104.16.0.0/13',
                '104.24.0.0/14',
                '172.64.0.0/13',
                '131.0.72.0/22'
            ];
        }
    }

    // 生成随机IP，并计算有效主机地址
    async function 生成随机IP(ranges, numHosts) {
        const ips = [];
        
        // 添加最大有效主机数量
        const maxHosts = numHosts - 2; // 排除网络地址和广播地址
        
        for (let i = 0; i < maxHosts; i++) {
            const randomRange = ranges[Math.floor(Math.random() * ranges.length)];
            const [network, mask] = randomRange.split('/');
            const networkParts = network.split('.').map(Number);
            const bitmask = parseInt(mask, 10);
            const startIp = ipToLong(networkParts);
            const endIp = startIp + (2 ** (32 - bitmask)) - 1;

            const randomIp = startIp + Math.floor(Math.random() * (endIp - startIp));
            const randomIpStr = longToIp(randomIp);
            ips.push(randomIpStr);
        }

        return ips;
    }

    // 将IP地址转换为数字
    function ipToLong(ip) {
        return ip.reduce((acc, part) => (acc << 8) + part, 0);
    }

    // 将数字转换为IP地址
    function longToIp(long) {
        return [(long >> 24) & 255, (long >> 16) & 255, (long >> 8) & 255, long & 255].join('.');
    }

    // 测试IP连通性
    async function 测试IP连通性(ips, ports, timeout) {
        const testResults = [];

        for (const ip of ips) {
            for (const port of ports) {
                try {
                    const url = `https://${ip}:${port}`;
                    const startTime = Date.now();
                    
                    // 在 fetch 请求中加入超时控制
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), timeout);  // 设置超时
                    
                    const response = await fetch(url, { signal: controller.signal });
                    const endTime = Date.now();
                    
                    clearTimeout(timeoutId);  // 清除超时
                    const timeTaken = endTime - startTime;
                    
                    // 处理响应状态，这里只是示范
                    if (response.ok) {
                        testResults.push({
                            ip,
                            port,
                            time: timeTaken,
                            type: 'direct', // 假设返回的是直连类型
                            comment: '直接连接'
                        });
                    }
                } catch (error) {
                    if (error.name === 'AbortError') {
                        console.log(`IP ${ip}:${port} 请求超时`);
                    } else {
                        console.log(`IP ${ip}:${port} 请求失败: ${error.message}`);
                    }
                }
            }
        }
        return testResults;
    }

    // 检测VPN状态的函数
    async function 检测VPN状态(request) {
        try {
            // 获取用户IP和国家信息
            const clientIP = request.headers.get('CF-Connecting-IP') || '';
            const geoInfo = request.cf || {};
            const cfIpCountry = request.headers.get('CF-IPCountry') || '';
            const country = geoInfo.country || cfIpCountry || '';
            
            // 判断是否为中国用户
            const isChina = country === 'CN';
            
            // 如果不是中国用户，很可能使用了VPN
            const isVpn = !isChina;
            
            // 获取其他详细信息用于调试
            const asn = geoInfo.asn || '';
            const asOrganization = geoInfo.asOrganization || '';
            const userAgent = request.headers.get('User-Agent') || '';
            const acceptLanguage = request.headers.get('Accept-Language') || '';
            const xForwardedFor = request.headers.get('X-Forwarded-For') || '';
            
            // 返回检测结果
            return {
                isVpn,
                details: {
                    clientIP,
                    country,
                    isChina,
                    asn,
                    asOrganization,
                    headers: {
                        userAgent: userAgent.substring(0, 100),
                        acceptLanguage,
                        xForwardedFor: xForwardedFor.substring(0, 100)
                    }
                }
            };
        } catch (error) {
            console.error('检测VPN状态时出错:', error);
            return { isVpn: false, details: {} };
        }
    }

    // 处理POST请求
    if (request.method === 'POST') {
        try {
            const formData = await request.formData();
            const action = formData.get('action');
            
            // 处理保存请求
            if (action === 'save') {
                // 检查是否有KV存储
                if (!env.KV) {
                    return new Response(JSON.stringify({
                        success: false,
                        message: '服务器未配置KV存储，无法保存IP列表'
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                
                try {
                    // 获取要保存的IP列表
                    const ips = formData.getAll('ips[]');
                    
                    if (!ips || ips.length === 0) {
                        return new Response(JSON.stringify({
                            success: false,
                            message: '没有提供要保存的IP'
                        }), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                    
                    // 获取保存模式
                    const saveMode = formData.get('saveMode') || 'append';
                    
                    // 获取现有内容
                    const existingContent = await env.KV.get('ADD.txt') || '';
                    let newContent = '';
                    
                    if (saveMode === 'replaceAll') {
                        // 完全替换模式：仅保留新的优选IP
                        newContent = ips.join('\n');
                    } else {
                        // 追加模式：保留所有现有内容，添加新的优选IP
                        // 或替换模式：保留所有非优选IP行，然后添加新的优选IP
                        if (saveMode === 'replace') {
                            // 替换模式：过滤掉已有的优选IP
                            const existingLines = existingContent.split('\n').filter(line => 
                                !line.includes('#优选IP') && !line.includes('#CF优选IP'));
                            newContent = [...existingLines, ...ips].join('\n');
                        } else {
                            // 追加模式
                            newContent = existingContent ? existingContent + '\n' + ips.join('\n') : ips.join('\n');
                        }
                    }
                    
                    // 保存到KV
                    await env.KV.put('ADD.txt', newContent);
                    
                    return new Response(JSON.stringify({
                        success: true,
                        message: '保存成功',
                        count: ips.length
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                } catch (error) {
                    console.error('保存IP时出错:', error);
                    return new Response(JSON.stringify({
                        success: false,
                        message: '保存失败: ' + error.message
                    }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            }
            else if (action === 'test') {
                // 检测VPN状态
                const vpnStatus = await 检测VPN状态(request);
                
                // 如果检测到VPN，返回提示信息
                if (vpnStatus.isVpn) {
                    return new Response(JSON.stringify({
                        success: false,
                        message: '检测到您正在使用VPN或代理服务，这可能会影响IP优选结果的准确性。请关闭VPN后再进行测试。',
                        vpnDetails: vpnStatus.details
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                
                // 从Cloudflare官方获取IP范围
                const ranges = await 获取Cloudflare_IP范围();
                console.log(`使用从Cloudflare官方获取的${ranges.length}个IP范围`);
                
                const count = 15; // 固定优选IP数量为15
                const portSelection = formData.get('ports') || '443';
                
                // 处理端口选择
                let ports;
                if (portSelection === 'all') {
                    // 使用所有预设端口
                    ports = DEFAULT_PORTS;
                    console.log(`使用全部端口: ${ports.join(', ')}`);
                } else {
                    // 只使用选定的端口
                    ports = [portSelection];
                    console.log(`使用单一端口: ${portSelection}`);
                }
                
                // 生成随机IP
                const ips = await 生成随机IP(ranges, 1000); // 固定生成1000个IP进行测试
                
                // 测试IP连通性
                let results = [];
                try {
                    results = await 测试IP连通性(ips, ports, 2000);
                    console.log(`获取到 ${results.length} 个测试结果`);
                } catch (error) {
                    console.error('测试IP连通性时出错:', error);
                }
                
                // 排序并返回最优IP
                if (results.length === 0) {
                    return new Response(JSON.stringify({
                        success: true,
                        message: '未找到可用IP',
                        bestIPs: []
                    }), {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                }

                results.sort((a, b) => {
                    // 按类型排序
                    const typeOrder = {
                        'cert_error': 0,
                        'other_error': 1,
                        'direct': 2,
                        'unknown': 3
                    };
                    
                    const typeA = a.type || 'unknown';
                    const typeB = b.type || 'unknown';
                    
                    if (typeOrder[typeA] !== typeOrder[typeB]) {
                        return typeOrder[typeA] - typeOrder[typeB];
                    }
                    
                    // 类型相同，按时间排序
                    return a.time - b.time;
                });

                // 返回最优IP
                const bestIPs = results.slice(0, count).map(item => 
                    `${item.ip}:${item.port}#${item.comment} ${Math.round(item.time)}ms`
                );
                
                return new Response(JSON.stringify({
                    success: true,
                    message: '优选IP测试完成',
                    bestIPs
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            return new Response(JSON.stringify({
                success: false,
                message: '未知操作'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            return new Response(JSON.stringify({
                success: false,
                message: '处理请求时出错: ' + error.message
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    }
    
    // 生成HTML页面
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Cloudflare IP优选工具</title>
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
            
            .vpn-warning {
                background-color: #f8d7da;
                border: 1px solid #f5c6cb;
                color: #721c24;
                padding: 15px;
                border-radius: 4px;
                margin-bottom: 20px;
                display: none;
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
                padding-bottom: 10px;
                border-bottom: 2px solid var(--border-color);
            }

            .form-group {
                margin-bottom: 15px;
            }

            label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
            }

            input[type="text"], 
            input[type="number"],
            textarea {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid var(--border-color);
                border-radius: 4px;
                box-sizing: border-box;
                font-family: inherit;
                font-size: 14px;
            }

            textarea {
                height: 120px;
                resize: vertical;
            }

            .btn {
                display: inline-block;
                padding: 10px 20px;
                background-color: var(--primary-color);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
            }

            .btn:hover {
                background-color: var(--secondary-color);
            }

            .btn:disabled {
                background-color: #cccccc;
                cursor: not-allowed;
            }

            .result-container {
                margin-top: 20px;
                padding: 15px;
                border: 1px solid var(--border-color);
                border-radius: 4px;
                background-color: #f8f9fa;
            }

            .result-title {
                font-weight: 500;
                margin-bottom: 10px;
            }

            .result-list {
                font-family: monospace;
                white-space: pre-wrap;
                word-break: break-all;
            }

            .loading {
                display: none;
                margin-top: 20px;
                text-align: center;
            }

            .spinner {
                border: 4px solid rgba(0, 0, 0, 0.1);
                border-radius: 50%;
                border-top: 4px solid var(--primary-color);
                width: 30px;
                height: 30px;
                animation: spin 1s linear infinite;
                margin: 0 auto 10px;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* 小型加载动画也使用相同的旋转动画 */

            .back-link {
                display: inline-block;
                margin-top: 20px;
                color: var(--primary-color);
                text-decoration: none;
            }

            .back-link:hover {
                text-decoration: underline;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1 class="title">Cloudflare IP优选工具</h1>
            
            <div id="vpnWarning" class="vpn-warning">
                <h4 style="margin-top: 0; margin-bottom: 10px; display: flex; align-items: center;">
                    <span style="font-size: 20px; margin-right: 8px;">⚠️</span> 代理/VPN环境检测警告
                </h4>
                <p>检测到您正在使用VPN或代理服务，这可能会影响IP优选结果的准确性。请关闭VPN后再进行测试。</p>
                <p style="margin-bottom: 0; font-size: 14px; color: #666;">
                    请关闭VPN后再次点击"开始测试"按钮
                </p>
            </div>
            
            <form id="testForm">
                                <div class="form-group">
                    <label for="port-select">测试端口</label>
                    <select id="port-select" name="ports">
                        <option value="443" selected>443</option>
                        <option value="2053">2053</option>
                        <option value="2083">2083</option>
                        <option value="2087">2087</option>
                        <option value="2096">2096</option>
                        <option value="8443">8443</option>
                        <option value="all">全部端口</option>
                    </select>
                </div>
                
                <div class="form-group" style="margin-top: 15px;">
                    <div style="font-size: 13px; color: #666; background-color: #f5f5f5; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
                        <strong>说明：</strong><br>
                        • 系统将从Cloudflare官方IP范围中随机抽取1000个IP进行测试<br>
                        • 测试完成后，可以选择"追加"或"替换"将结果保存到订阅列表<br>
                        • 如果您使用VPN，可能会影响测试结果的准确性
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <button type="submit" id="testButton" class="btn">开始测试</button>
                    <button type="button" id="appendButton" class="btn" style="background-color: #2196F3;" disabled>追加到列表</button>
                    <button type="button" id="replaceButton" class="btn" style="background-color: #FF9800;" disabled>替换列表</button>
                    <button type="button" id="listButton" class="btn" style="background-color: #673AB7;">优选订阅列表</button>
                </div>
            </form>
            
            <div class="loading" id="loading">
                <div class="spinner"></div>
                <p>正在测试IP，请稍候...</p>
            </div>
            
                         <div class="result-container" id="resultContainer" style="display: none;">
                 <div class="result-title">优选IP结果: <span id="saveMessage" style="color: #4CAF50; font-size: 14px; margin-left: 10px;"></span></div>
                 <div class="result-list" id="resultList"></div>
             </div>
            
            <a href="#" class="back-link" id="backLink">返回配置页</a>
        </div>
        
        <script>
            document.addEventListener('DOMContentLoaded', function() {
                const testForm = document.getElementById('testForm');
                const testButton = document.getElementById('testButton');
                const loading = document.getElementById('loading');
                const resultContainer = document.getElementById('resultContainer');
                const resultList = document.getElementById('resultList');
                const backLink = document.getElementById('backLink');
                const vpnWarning = document.getElementById('vpnWarning');
                
                                // 设置返回链接
                backLink.href = window.location.pathname.replace('/bestip', '');
                
                // 设置优选订阅列表按钮
                const listButton = document.getElementById('listButton');
                listButton.addEventListener('click', function() {
                    // 跳转到优选订阅列表页面
                    window.location.href = window.location.pathname.replace('/bestip', '/edit');
                });
                
                // 全局变量存储测试结果
                 let testResults = [];
                 
                 // 保存结果函数
                 async function saveResults(mode) {
                     if (!testResults || testResults.length === 0) {
                         alert('没有可保存的测试结果');
                         return;
                     }
                     
                     const saveButton = mode === 'append' ? 
                         document.getElementById('appendButton') : 
                         document.getElementById('replaceButton');
                     
                     try {
                         saveButton.disabled = true;
                         saveButton.textContent = '保存中...';
                         
                         // 创建一个新的FormData对象
                         const saveFormData = new FormData();
                         saveFormData.append('action', 'save'); // 使用不同的action
                         saveFormData.append('saveMode', mode === 'append' ? 'append' : 'replaceAll');
                         
                         // 添加测试结果
                         testResults.forEach(ip => {
                             saveFormData.append('ips[]', ip);
                         });
                         
                         const response = await fetch(window.location.href, {
                             method: 'POST',
                             body: saveFormData
                         });
                         
                         const result = await response.json();
                         
                         if (result.success) {
                             const saveMessage = mode === 'append' ? '已追加到列表' : '已替换列表';
                             document.getElementById('saveMessage').textContent = saveMessage;
                             setTimeout(() => {
                                 document.getElementById('saveMessage').textContent = '';
                             }, 3000);
                         } else {
                             alert('保存失败: ' + (result.message || '未知错误'));
                         }
                     } catch (error) {
                         alert('保存出错: ' + error.message);
                     } finally {
                         saveButton.disabled = false;
                         saveButton.textContent = mode === 'append' ? '追加到列表' : '替换列表';
                     }
                 }
                 
                 // 测试表单提交
                 testForm.addEventListener('submit', async function(e) {
                     e.preventDefault();
                     
                     // 显示加载状态
                     testButton.disabled = true;
                     document.getElementById('appendButton').disabled = true;
                     document.getElementById('replaceButton').disabled = true;
                     loading.style.display = 'block';
                     resultContainer.style.display = 'none';
                     document.getElementById('saveMessage').textContent = '';
                     vpnWarning.style.display = 'none';
                     
                     const formData = new FormData(testForm);
                     formData.append('action', 'test');
                     
                     try {
                         const response = await fetch(window.location.href, {
                             method: 'POST',
                             body: formData
                         });
                         
                         const result = await response.json();
                         
                         if (result.success) {
                             if (result.bestIPs && result.bestIPs.length > 0) {
                                 // 保存测试结果到全局变量
                                 testResults = result.bestIPs;
                                 
                                 resultList.textContent = result.bestIPs.join('\\n');
                                 resultContainer.style.display = 'block';
                                 // 启用按钮
                                 document.getElementById('appendButton').disabled = false;
                                 document.getElementById('replaceButton').disabled = false;
                             } else {
                                 resultList.textContent = '未能获取到有效的测试结果，请尝试更改端口或增加超时时间后重试';
                                 resultContainer.style.display = 'block';
                                 document.getElementById('appendButton').disabled = true;
                                 document.getElementById('replaceButton').disabled = true;
                             }
                         } else {
                             // 显示错误信息
                             if (result.message && result.message.includes('VPN')) {
                                 // 显示VPN警告
                                 vpnWarning.style.display = 'block';
                                 // 滚动到警告区域
                                 vpnWarning.scrollIntoView({ behavior: 'smooth', block: 'center' });
                             } else {
                                 // 其他错误使用普通alert
                                 alert('测试失败: ' + result.message);
                             }
                         }
                     } catch (error) {
                         alert('请求出错: ' + error.message);
                     } finally {
                         // 隐藏加载状态
                         testButton.disabled = false;
                         loading.style.display = 'none';
                         // 按钮状态根据测试结果在前面的代码中设置
                     }
                 });
                 
                 // 添加按钮事件监听
                 document.getElementById('appendButton').addEventListener('click', function() {
                     saveResults('append');
                 });
                 
                 document.getElementById('replaceButton').addEventListener('click', function() {
                     saveResults('replace');
                 });
                 
                 // 调试功能已移除
            });
        </script>
    </body>
    </html>
    `;
    
    return new Response(html, {
        headers: {
            'Content-Type': 'text/html;charset=utf-8'
        }
    });


// 生成随机IP函数
async function 生成随机IP(ranges, count) {
    const ips = [];
    const MAX_SAMPLE_SIZE = 1000; // 最大抽样数量
    const actualCount = Math.min(count, MAX_SAMPLE_SIZE); // 限制最大数量
    
    console.log(`从Cloudflare IP范围中抽取${actualCount}个IP进行测试`);
    
    // CIDR转换为IP范围函数
    function cidrToIPRange(cidr) {
        const [baseIP, prefixLength] = cidr.split('/');
        const baseIPNum = baseIP.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);
        const mask = ~((1 << (32 - parseInt(prefixLength, 10))) - 1);
        const networkIP = baseIPNum & mask;
        const maxHost = (1 << (32 - parseInt(prefixLength, 10))) - 1;
        return { networkIP, maxHost };
    }
    
    // 生成随机IP函数
    function generateIPFromCIDR(cidr) {
        const { networkIP, maxHost } = cidrToIPRange(cidr);
        
        // 生成随机主机部分
        const randomHostPart = Math.floor(Math.random() * maxHost) + 1; // 避免使用网络地址(0)和广播地址(maxHost)
        const ipNum = networkIP | randomHostPart;
        
        // 转换回点分十进制
        return [
            (ipNum >> 24) & 255,
            (ipNum >> 16) & 255,
            (ipNum >> 8) & 255,
            ipNum & 255
        ].join('.');
    }
    
    // 计算每个CIDR块的IP数量
    const cidrSizes = ranges.map(cidr => {
        const { maxHost } = cidrToIPRange(cidr);
        return maxHost;
    });
    
    // 计算总IP数量
    const totalIPs = cidrSizes.reduce((sum, size) => sum + size, 0);
    console.log(`Cloudflare IP范围包含约${totalIPs}个IP地址`);
    
    // 为每个范围分配权重，确保大范围有更多的抽样
    const weights = cidrSizes.map(size => size / totalIPs);
    
    // 根据权重分配每个CIDR块应该生成的IP数量
    const ipCountPerRange = weights.map(weight => Math.ceil(actualCount * weight));
    
    // 为每个范围生成随机IP
    for (let i = 0; i < ranges.length; i++) {
        const cidr = ranges[i];
        const ipCount = Math.min(ipCountPerRange[i], cidrSizes[i]); // 不超过该CIDR块的最大IP数
        
        // 生成指定数量的随机IP
        const rangeIPs = new Set();
        let attempts = 0;
        const maxAttempts = ipCount * 2; // 最大尝试次数，避免无限循环
        
        while (rangeIPs.size < ipCount && attempts < maxAttempts) {
            const ip = generateIPFromCIDR(cidr);
            rangeIPs.add(ip);
            attempts++;
        }
        
        // 将该范围的IP添加到总列表
        ips.push(...Array.from(rangeIPs));
    }
    
    // 如果生成的IP数量超过要求，随机选择指定数量
    if (ips.length > actualCount) {
        // Fisher-Yates洗牌算法
        for (let i = ips.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ips[i], ips[j]] = [ips[j], ips[i]];
        }
        ips.length = actualCount;
    }
    
    console.log(`成功生成${ips.length}个随机IP用于测试`);
    return ips;
}

// 测试IP连通性函数
async function 测试IP连通性(ips, ports, timeout) {
    const results = [];
    const MAX_CONCURRENT = 50; // 最大并发测试数
    const MAX_TEST_DURATION = 30000; // 最长测试时间(毫秒)
    const minResults = 15; // 最少需要的结果数
    
    // 强制使用较短的超时时间，这对于证书错误测试方法很重要
    const actualTimeout = Math.min(timeout, 999);
    
    console.log(`开始测试${ips.length}个IP，端口列表: ${ports.join(', ')}`);
    
    // 测试单个IP函数
    async function testSingleIP(ip, port) {
        // 第一次测试
        const firstResult = await singleTest(ip, port, actualTimeout);
        if (!firstResult) {
            return { success: false, ip, port };
        }
        
        console.log(`IP ${ip}:${port} 第一次测试成功: ${firstResult.time}ms (类型: ${firstResult.type})，进行第二次测试...`);
        
        // 第二次测试
        const secondResult = await singleTest(ip, port, actualTimeout);
        
        // 如果两次测试都成功，选择延迟较低的
        if (secondResult) {
            console.log(`IP ${ip}:${port} 第二次测试成功: ${secondResult.time}ms (类型: ${secondResult.type})`);
            
            // 如果延迟较低，选择第二次结果
            if (secondResult.time < firstResult.time) {
                console.log(`IP ${ip}:${port} 选择第二次结果(延迟更低)`);
                return secondResult;
            }
        }
        
        // 默认使用第一次结果
        console.log(`IP ${ip}:${port} 使用第一次结果: ${firstResult.time}ms (类型: ${firstResult.type})`);
        return firstResult;
    }
    
    // 单次测试函数
    async function singleTest(ip, port, timeout) {
        const startTime = Date.now();
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            // 使用cdn-cgi/trace路径
            const response = await fetch(`https://${ip}:${port}/cdn-cgi/trace`, {
                signal: controller.signal,
                mode: 'cors'
            });
            
            clearTimeout(timeoutId);
            
            // 连接成功的IP也可以是有用的
            const endTime = Date.now();
            const latency = endTime - startTime;
            
            console.log(`IP ${ip}:${port} 连接成功，延迟: ${latency}ms`);
            return {
                success: true,
                ip,
                port,
                time: latency,
                type: 'direct' // 标记为直连成功的IP
            };
            
        } catch (error) {
            const endTime = Date.now();
            const latency = endTime - startTime;
            
            // 检查是否是真正的超时（接近设定的timeout时间）
            if (latency >= timeout - 50) {
                return null; // 真正的超时，认为测试失败
            }
            
            // 其他类型的错误也可能有用
            console.log(`IP ${ip}:${port} 其他错误，延迟: ${latency}ms，错误: ${error.name}`);
            return {
                success: true,
                ip,
                port,
                time: latency,
                type: 'other_error' // 标记为其他错误的IP
            };
        }
    }
    
    // 随机打乱IP列表，确保公平测试
    const shuffledIPs = [...ips];
    for (let i = shuffledIPs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledIPs[i], shuffledIPs[j]] = [shuffledIPs[j], shuffledIPs[i]];
    }
    
    // 创建测试任务队列
    const testTasks = [];
    for (const ip of shuffledIPs) {
        // 为每个IP随机选择一个端口
        const port = ports[Math.floor(Math.random() * ports.length)];
        testTasks.push({ ip, port });
    }
    
    console.log(`创建了${testTasks.length}个测试任务`);
    
    // 批量执行测试任务
    const startTestTime = Date.now();
    let taskIndex = 0;
    
    while (taskIndex < testTasks.length && results.length < minResults && (Date.now() - startTestTime) < MAX_TEST_DURATION) {
        // 创建当前批次的测试任务
        const currentBatch = [];
        const batchSize = Math.min(MAX_CONCURRENT, testTasks.length - taskIndex);
        
        for (let i = 0; i < batchSize; i++) {
            const task = testTasks[taskIndex++];
            currentBatch.push(testSingleIP(task.ip, task.port));
        }
        
        // 等待当前批次完成
        const batchResults = await Promise.all(currentBatch);
        
        // 处理结果
        for (const result of batchResults) {
            if (result && result.success) {
                const displayTime = Math.floor(result.time);
                
                results.push({
                    ip: result.ip,
                    port: result.port,
                    time: displayTime,
                    originalTime: result.time,
                    status: 'success',
                    type: result.type,
                    comment: 'CF优选IP' // 取消特殊标记
                });
                
                // 记录进度
                if (results.length % 10 === 0) {
                    console.log(`已找到${results.length}个可用IP，已测试${taskIndex}/${testTasks.length}`);
                }
                
                // 如果已经有足够的结果，可以提前结束
                if (results.length >= minResults * 2) {
                    console.log(`已找到足够的可用IP (${results.length})，提前结束测试`);
                    break;
                }
            }
        }
        
        // 如果结果太少，但已经测试了很多IP，降低标准
        if (results.length < 5 && taskIndex > testTasks.length / 2) {
            console.log(`测试进度过半但结果太少(${results.length})，降低标准继续测试`);
        }
    }
    
    console.log(`测试完成，共测试了${taskIndex}/${testTasks.length}个IP，找到${results.length}个可用IP`);
    
    // 如果没有找到任何可用IP，记录警告信息
    if (results.length === 0) {
        console.log('警告：未找到任何可用的IP，请检查网络连接或尝试其他端口');
    }
    
    return results;
}
