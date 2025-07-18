// --- START OF FILE _worker.js ---

import { connect } from 'cloudflare:sockets';

// ... (全局变量定义保持不变)
let userID = '';
let proxyIP = '';
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
let validTime = 7;
let updateInterval = 3;
let userIDLow;
let userIDTime = "";
let proxyIPPool = [];
let path = '/?ed=2560';
let dynamicUUID;
let link = [];
let banHosts = [atob('c3BlZWQuY2xvdWRmbGFyZS5jb20=')];
let DNS64Server = '';


// ... (utils, WebSocketManager, resolveToIPv6 函数保持不变)
const utils = {
	isValidUUID(uuid) {
		const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		return uuidPattern.test(uuid);
	},
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
			await this.handleEarlyData(earlyDataHeader, controller);
		} catch (error) {
			this.log(`Stream start error: ${error.message}`);
			controller.error(error);
		}
	}
	async processMessage(data, controller) {
		if (this.isProcessing) {
			this.messageQueue.push(data);
			return;
		}
		this.isProcessing = true;
		try {
			controller.enqueue(data);
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
async function resolveToIPv6(target) {
    function isIPv4(str) {
        const parts = str.split('.');
        return parts.length === 4 && parts.every(part => {
            const num = parseInt(part, 10);
            return num >= 0 && num <= 255 && part === num.toString();
        });
    }
    function isIPv6(str) {
        return str.includes(':') && /^[0-9a-fA-F:]+$/.test(str);
    }
    async function fetchIPv4(domain) {
        const url = `https://cloudflare-dns.com/dns-query?name=${domain}&type=A`;
        const response = await fetch(url, {
            headers: { 'Accept': 'application/dns-json' }
        });
        if (!response.ok) throw new Error('DNS query for IPv4 failed');
        const data = await response.json();
        const ipv4s = (data.Answer || [])
            .filter(record => record.type === 1)
            .map(record => record.data);
        if (ipv4s.length === 0) throw new Error('No IPv4 address found for the domain');
        return ipv4s[Math.floor(Math.random() * ipv4s.length)];
    }
    async function queryNAT64(domain) {
        const socket = connect({
            hostname: isIPv6(DNS64Server) ? `[${DNS64Server}]` : DNS64Server,
            port: 53
        });
        const writer = socket.writable.getWriter();
        const reader = socket.readable.getReader();
        try {
            const query = buildDNSQuery(domain);
            const queryWithLength = new Uint8Array(query.length + 2);
            queryWithLength = query.length >> 8;
            queryWithLength = query.length & 0xFF;
            queryWithLength.set(query, 2);
            await writer.write(queryWithLength);
            const response = await readDNSResponse(reader);
            const ipv6s = parseIPv6(response);
            if (ipv6s.length > 0) {
                return ipv6s;
            } else {
                throw new Error('No IPv6 address found in DNS response from NAT64 server');
            }
        } finally {
            await writer.close();
            await reader.cancel();
        }
    }
    function buildDNSQuery(domain) {
        const buffer = new ArrayBuffer(512);
        const view = new DataView(buffer);
        let offset = 0;
        view.setUint16(offset, Math.floor(Math.random() * 65536)); offset += 2;
        view.setUint16(offset, 0x0100); offset += 2;
        view.setUint16(offset, 1); offset += 2;
        view.setUint16(offset, 0); offset += 6;
        for (const label of domain.split('.')) {
            view.setUint8(offset++, label.length);
            for (let i = 0; i < label.length; i++) {
                view.setUint8(offset++, label.charCodeAt(i));
            }
        }
        view.setUint8(offset++, 0);
        view.setUint16(offset, 28); offset += 2;
        view.setUint16(offset, 1); offset += 2;
        return new Uint8Array(buffer, 0, offset);
    }
    async function readDNSResponse(reader) {
        const chunks = [];
        let totalLength = 0;
        let expectedLength = null;
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalLength += value.length;
            if (expectedLength === null && totalLength >= 2) {
                expectedLength = (chunks << 8) | chunks;
            }
            if (expectedLength !== null && totalLength >= expectedLength + 2) {
                break;
            }
        }
        const fullResponse = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            fullResponse.set(chunk, offset);
            offset += chunk.length;
        }
        return fullResponse.slice(2);
    }
    function parseIPv6(response) {
        const view = new DataView(response.buffer);
        let offset = 12;
        while (view.getUint8(offset) !== 0) {
            offset += view.getUint8(offset) + 1;
        }
        offset += 5;
        const answers = [];
        const answerCount = view.getUint16(6);
        for (let i = 0; i < answerCount; i++) {
            if ((view.getUint8(offset) & 0xC0) === 0xC0) {
                offset += 2;
            } else {
                while (view.getUint8(offset) !== 0) {
                    offset += view.getUint8(offset) + 1;
                }
                offset++;
            }
            const type = view.getUint16(offset); offset += 2;
            offset += 6;
            const dataLength = view.getUint16(offset); offset += 2;
            if (type === 28 && dataLength === 16) {
                const parts = [];
                for (let j = 0; j < 8; j++) {
                    parts.push(view.getUint16(offset + j * 2).toString(16));
                }
                answers.push(parts.join(':'));
            }
            offset += dataLength;
        }
        return answers;
    }
    function convertToNAT64IPv6(ipv4Address) {
        const parts = ipv4Address.split('.');
        if (parts.length !== 4) throw new Error('Invalid IPv4 address for NAT64 conversion');
        const hex = parts.map(part => parseInt(part, 10).toString(16).padStart(2, '0'));
        return DNS64Server.split('/96') + hex + hex + ":" + hex + hex;
    }
    try {
        if (isIPv6(target)) return target;
        const ipv4 = isIPv4(target) ? target : await fetchIPv4(target);
        const nat64 = DNS64Server.endsWith('/96') ? convertToNAT64IPv6(ipv4) : await queryNAT64(ipv4 + atob('LmlwLjA5MDIyNy54eXo='));
        if (isIPv6(nat64)) {
            return nat64;
        } else {
            throw new Error('Resolved NAT64 address is not a valid IPv6 address.');
        }
    } catch (error) {
        throw new Error(`NAT64 resolution failed: ${error.message}`);
    }
}


/**
 * 从KV中读取并解析高级设置 (settings.txt)
 * @param {object} env - Cloudflare environment object
 * @returns {object} - 一个包含所有高级设置的对象
 */
async function getSettingsFromKV(env) {
    if (!env.KV) {
        return {};
    }

    const settingsText = await env.KV.get('settings.txt') || '';
    if (!settingsText) {
        return {};
    }

    const settings = {};
    const sections = settingsText.split(/\[(.*?)\]/);

    for (let i = 1; i < sections.length; i += 2) {
        const sectionName = sections[i].trim().toLowerCase();
        const content = sections[i + 1].trim();
        settings[sectionName] = content;
    }

    return settings;
}


export default {
	async fetch(request, env, ctx) {
		try {
			// --- 修改：一次性加载所有高级设置 ---
            const kvSettings = await getSettingsFromKV(env);

			const UA = request.headers.get('User-Agent') || 'null';
			const userAgent = UA.toLowerCase();
			userID = env.UUID || env.uuid || env.PASSWORD || env.pswd || userID;
			if (env.KEY || env.TOKEN || (userID && !utils.isValidUUID(userID))) {
				dynamicUUID = env.KEY || env.TOKEN || userID;
				validTime = Number(env.TIME) || validTime;
				updateInterval = Number(env.UPTIME) || updateInterval;
				const userIDs = await 生成动态UUID(dynamicUUID);
				userID = userIDs;
				userIDLow = userIDs;
			}

			if (!userID) {
				// ... (无UUID时的HTML页面保持不变)
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
					headers: { 'content-type': 'text/html;charset=utf-8' },
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

			// --- 修改：从kvSettings对象或环境变量中加载配置 ---
            proxyIP = kvSettings.proxyip || env.PROXYIP || env.proxyip || '';
			proxyIPs = await 整理(proxyIP);
			proxyIP = proxyIPs.length > 0 ? proxyIPs[Math.floor(Math.random() * proxyIPs.length)] : '';

            socks5Address = kvSettings.socks5 || env.SOCKS5 || '';
			socks5s = await 整理(socks5Address);
			socks5Address = socks5s.length > 0 ? socks5s[Math.floor(Math.random() * socks5s.length)] : '';
			socks5Address = socks5Address.split('//') || socks5Address;
            
            DNS64Server = kvSettings.nat64 || env.DNS64 || env.NAT64 || (DNS64Server != '' ? DNS64Server : atob("ZG5zNjQuY21saXVzc3NzLm5ldA=="));

			if (env.GO2SOCKS5) go2Socks5s = await 整理(env.GO2SOCKS5);
			if (env.CFPORTS) httpsPorts = await 整理(env.CFPORTS);
			if (env.BAN) banHosts = await 整理(env.BAN);

			if (socks5Address) {
				try {
					parsedSocks5Address = socks5AddressParser(socks5Address);
					RproxyIP = env.RPROXYIP || 'false';
					enableSocks = true;
				} catch (err) {
					console.log(err.toString());
					RproxyIP = env.RPROXYIP || !proxyIP ? 'true' : 'false';
					enableSocks = false;
				}
			} else {
				RproxyIP = env.RPROXYIP || !proxyIP ? 'true' : 'false';
			}

			const upgradeHeader = request.headers.get('Upgrade');
			const url = new URL(request.url);
			if (!upgradeHeader || upgradeHeader !== 'websocket') {
				DLS = Number(env.DLS) || DLS;
				remarkIndex = Number(env.CSVREMARK) || remarkIndex;
				BotToken = env.TGTOKEN || BotToken;
				ChatID = env.TGID || ChatID;
				FileName = env.SUBNAME || FileName;
				subEmoji = env.SUBEMOJI || env.EMOJI || subEmoji;
				if (subEmoji == '0') subEmoji = 'false';
				
                let sub = kvSettings.sub || env.SUB || '';
                subConverter = kvSettings.subapi || env.SUBAPI || subConverter;
				if (subConverter.includes("http://")) {
					subConverter = subConverter.split("//");
					subProtocol = 'http';
				} else {
					subConverter = subConverter.split("//") || subConverter;
				}
                subConfig = kvSettings.subconfig || env.SUBCONFIG || subConfig;

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

				const pathRoute = url.pathname.toLowerCase();
				if (pathRoute == '/') {
					if (env.URL302) return Response.redirect(env.URL302, 302);
					else if (env.URL) return await 代理URL(env.URL, url);
					else {
						// ... (根路径HTML页面保持不变)
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
							headers: { 'content-type': 'text/html;charset=utf-8' },
						});
					}
				} else if (pathRoute == `/${fakeUserID}`) {
					const fakeConfig = await 生成配置信息(userID, request.headers.get('Host'), sub, 'CF-Workers-SUB', RproxyIP, url, fakeUserID, fakeHostName, env, kvSettings);
					return new Response(`${fakeConfig}`, { status: 200 });
				} else if (url.pathname == `/${dynamicUUID}/edit` || pathRoute == `/${userID}/edit`) {
					return await KV(request, env);
				} else if (url.pathname == `/${dynamicUUID}` || pathRoute == `/${userID}`) {
					await sendMessage(`#获取订阅 ${FileName}`, request.headers.get('CF-Connecting-IP'), `UA: ${UA}</tg-spoiler>\n域名: ${url.hostname}\n<tg-spoiler>入口: ${url.pathname + url.search}</tg-spoiler>`);
					const secureProtoConfig = await 生成配置信息(userID, request.headers.get('Host'), sub, UA, RproxyIP, url, fakeUserID, fakeHostName, env, kvSettings);
					// ... (订阅返回逻辑保持不变)
					const now = Date.now();
					const today = new Date(now);
					today.setHours(0, 0, 0, 0);
					const UD = Math.floor(((now - today.getTime()) / 86400000) * 24 * 1099511627776 / 2);
					let pagesSum = UD;
					let workersSum = UD;
					let total = 24 * 1099511627776;
					if (userAgent && userAgent.includes('mozilla')) {
						return new Response(`<div style="font-size:13px;">${secureProtoConfig}</div>`, {
							status: 200,
							headers: {
								"Content-Type": "text/html;charset=utf-8",
								"Profile-Update-Interval": "6",
								"Subscription-Userinfo": `upload=${pagesSum}; download=${workersSum}; total=${total}; expire=${expire}`,
								"Cache-Control": "no-store",
							}
						});
					} else {
						return new Response(`${secureProtoConfig}`, {
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
						// ... (404页面保持不变)
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
							headers: { 'content-type': 'text/html;charset=utf-8' },
						});
					}
				}
			} else {
				// ... (WebSocket处理逻辑保持不变)
				socks5Address = url.searchParams.get('socks5') || socks5Address;
				if (new RegExp('/socks5=', 'i').test(url.pathname)) socks5Address = url.pathname.split('5=');
				else if (new RegExp('/socks://', 'i').test(url.pathname) || new RegExp('/socks5://', 'i').test(url.pathname)) {
					socks5Address = url.pathname.split('://').split('#');
					if (socks5Address.includes('@')) {
						let userPassword = socks5Address.split('@');
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
						console.log(err.toString());
						enableSocks = false;
					}
				} else {
					enableSocks = false;
				}
				if (url.searchParams.has('proxyip')) {
					proxyIP = url.searchParams.get('proxyip');
					enableSocks = false;
				} else if (new RegExp('/proxyip=', 'i').test(url.pathname)) {
					proxyIP = url.pathname.toLowerCase().split('/proxyip=');
					enableSocks = false;
				} else if (new RegExp('/proxyip.', 'i').test(url.pathname)) {
					proxyIP = `proxyip.${url.pathname.toLowerCase().split("/proxyip.")[1]}`;
					enableSocks = false;
				} else if (new RegExp('/pyip=', 'i').test(url.pathname)) {
					proxyIP = url.pathname.toLowerCase().split('/pyip=');
					enableSocks = false;
				}
				return await secureProtoOverWSHandler(request);
			}
		} catch (err) {
			return new Response(err.toString());
		}
	},
};

// ... (secureProtoOverWSHandler, mergeData, handleDNSQuery, handleTCPOutBound, processsecureProtoHeader, remoteSocketToWS, safeCloseWebSocket, stringify, socks5Connect, socks5AddressParser, 恢复伪装信息, 双重哈希, 代理URL, 配置信息, cmad 保持不变)
async function secureProtoOverWSHandler(request) {
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
                    secureProtoVersion = new Uint8Array(),
                    isUDP,
                } = processsecureProtoHeader(chunk, userID);
                address = addressRemote;
                portWithRandomLog = `${portRemote}--${Math.random()} ${isUDP ? 'udp ' : 'tcp '} `;
                if (hasError) {
                    throw new Error(message);
                }
                if (isUDP) {
                    if (portRemote === 53) {
                        isDns = true;
                    } else {
                        throw new Error('UDP 代理仅对 DNS（53 port）启用');
                    }
                }
                const secureProtoResponseHeader = new Uint8Array([secureProtoVersion, 0]);
                const rawClientData = chunk.slice(rawDataIndex);
                if (isDns) {
                    return handleDNSQuery(rawClientData, webSocket, secureProtoResponseHeader, log);
                }
                if (!banHostsSet.has(addressRemote)) {
                    log(`处理 TCP 出站连接 ${addressRemote}:${portRemote}`);
                    handleTCPOutBound(remoteSocketWrapper, addressType, addressRemote, portRemote, rawClientData, webSocket, secureProtoResponseHeader, log);
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
async function handleDNSQuery(udpChunk, webSocket, secureProtoResponseHeader, log) {
    const DNS_SERVER = { hostname: '8.8.4.4', port: 53 };
    let tcpSocket;
    const controller = new AbortController();
    const signal = controller.signal;
    let timeoutId; 
    try {
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
            const writer = tcpSocket.writable.getWriter();
            try {
                await writer.write(udpChunk);
            } finally {
                writer.releaseLock();
            }
            let secureProtoHeader = secureProtoResponseHeader;
            const reader = tcpSocket.readable.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        log('DNS数据流处理完成');
                        break;
                    }
                    if (webSocket.readyState !== WS_READY_STATE_OPEN) {
                        break;
                    }
                    try {
                        if (secureProtoHeader) {
                            const data = mergeData(secureProtoHeader, value);
                            webSocket.send(data);
                            secureProtoHeader = null;
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
async function handleTCPOutBound(remoteSocket, addressType, addressRemote, portRemote, rawClientData, webSocket, secureProtoResponseHeader, log) {
    const checkSocks5Mode = async (address) => {
        const patterns = [atob('YWxsIGlu'), atob('Kg==')];
        if (go2Socks5s.some(pattern => patterns.includes(pattern))) return true;
        const pattern = go2Socks5s.find(p => 
            new RegExp('^' + p.replace(/\*/g, '.*') + '$', 'i').test(address)
        );
        return !!pattern;
    };
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
    const retryConnection = async () => {
        let tcpSocket;
        if (enableSocks) {
            try {
                log('重试：尝试使用 SOCKS5...');
                tcpSocket = await createConnection(addressRemote, portRemote, true);
                log('✅ SOCKS5 连接成功！');
            } catch (socksError) {
                log(`❌ SOCKS5 连接失败: ${socksError.message}`);
                safeCloseWebSocket(webSocket);
                return;
            }
        } else {
            const strategies = [
                {
                    name: '用户配置的 PROXYIP',
                    enabled: proxyIP && proxyIP.trim() !== '',
                    execute: async () => {
                        let port = portRemote;
                        let parsedIP = proxyIP;
                        if (parsedIP.includes(']:')) { [parsedIP, port] = parsedIP.split(']:'); parsedIP += ']'; }
                        else if (parsedIP.includes(':')) { [parsedIP, port] = parsedIP.split(':'); }
                        if (parsedIP.includes('.tp')) { port = parsedIP.split('.tp').split('.') || port; }
                        return createConnection(parsedIP.toLowerCase(), port);
                    }
                },
                {
                    name: '用户配置的 NAT64',
                    enabled: DNS64Server && DNS64Server.trim() !== '' && DNS64Server !== atob("ZG5zNjQuY21saXVzc3NzLm5ldA=="),
                    execute: async () => {
                        const nat64Address = await resolveToIPv6(addressRemote);
                        const nat64Proxyip = `[${nat64Address}]`;
                        return createConnection(nat64Proxyip, 443);
                    }
                },
                {
                    name: '内置的默认 PROXYIP',
                    enabled: true,
                    execute: async () => {
                        const defaultProxyIP = atob('UFJPWFlJUC50cDEuZnh4ay5kZWR5bi5pbw==');
                        let port = portRemote;
                        let parsedIP = defaultProxyIP;
                        if (parsedIP.includes(']:')) { [parsedIP, port] = parsedIP.split(']:'); parsedIP += ']'; }
                        else if (parsedIP.includes(':')) { [parsedIP, port] = parsedIP.split(':'); }
                        if (parsedIP.includes('.tp')) { port = parsedIP.split('.tp').split('.') || port; }
                        return createConnection(parsedIP.toLowerCase(), port);
                    }
                },
                {
                    name: '内置的默认 NAT64',
                    enabled: true,
                    execute: async () => {
                        if (!DNS64Server || DNS64Server.trim() === '') {
                           DNS64Server = atob("ZG5zNjQuY21saXVzc3NzLm5ldA==");
                        }
                        const nat64Address = await resolveToIPv6(addressRemote);
                        const nat64Proxyip = `[${nat64Address}]`;
                        return createConnection(nat64Proxyip, 443);
                    }
                }
            ];
            for (const strategy of strategies) {
                if (strategy.enabled && !tcpSocket) {
                    try {
                        log(`重试：尝试策略 '${strategy.name}'...`);
                        tcpSocket = await strategy.execute();
                        log(`✅ 策略 '${strategy.name}' 连接成功！`);
                    } catch (error) {
                        log(`❌ 策略 '${strategy.name}' 失败: ${error.message}`);
                    }
                }
            }
            if (!tcpSocket) {
                log('所有回退尝试均已失败，关闭连接。');
                safeCloseWebSocket(webSocket);
                return;
            }
        }
        if (tcpSocket) {
            log('建立从远程服务器到客户端的数据流...');
            remoteSocketToWS(tcpSocket, webSocket, secureProtoResponseHeader, null, log);
        }
    };
    try {
        log('主流程：第一阶段 - 尝试直接连接...');
        const shouldUseSocks = enableSocks && go2Socks5s.length > 0 ? 
            await checkSocks5Mode(addressRemote) : false;
        const tcpSocket = await createConnection(addressRemote, portRemote, shouldUseSocks);
        log('✅ 直接连接成功！');
        return remoteSocketToWS(tcpSocket, webSocket, secureProtoResponseHeader, retryConnection, log);
    } catch (error) {
        log(`❌ 主连接失败 (${error.message})，将启动重试流程...`);
        return retryConnection();
    }
}
function processsecureProtoHeader(secureProtoBuffer, userID) {
    if (secureProtoBuffer.byteLength < 24) {
        return { hasError: true, message: 'Invalid data' };
    }
    const version = new Uint8Array(secureProtoBuffer.slice(0, 1));
    const userIDArray = new Uint8Array(secureProtoBuffer.slice(1, 17));
    const userIDString = stringify(userIDArray);
    const isValidUser = userIDString === userID || userIDString === userIDLow;
    if (!isValidUser) {
        return { hasError: true, message: 'Invalid user' };
    }
    const optLength = new Uint8Array(secureProtoBuffer.slice(17, 18));
    const command = new Uint8Array(secureProtoBuffer.slice(18 + optLength, 18 + optLength + 1));
    let isUDP = false;
    switch (command) {
        case 1: break;
        case 2: isUDP = true; break;
        default:
            return { hasError: true, message: 'Unsupported command' };
    }
    const portIndex = 18 + optLength + 1;
    const portRemote = new DataView(secureProtoBuffer).getUint16(portIndex);
    const addressIndex = portIndex + 2;
    const addressType = new Uint8Array(secureProtoBuffer.slice(addressIndex, addressIndex + 1));
    let addressValue = '';
    let addressLength = 0;
    let addressValueIndex = addressIndex + 1;
    switch (addressType) {
        case 1:
            addressLength = 4;
            addressValue = new Uint8Array(secureProtoBuffer.slice(addressValueIndex, addressValueIndex + addressLength)).join('.');
            break;
        case 2:
            addressLength = new Uint8Array(secureProtoBuffer.slice(addressValueIndex, addressValueIndex + 1));
            addressValueIndex += 1;
            addressValue = new TextDecoder().decode(secureProtoBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
            break;
        case 3:
            addressLength = 16;
            const dataView = new DataView(secureProtoBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
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
        secureProtoVersion: version,
        isUDP,
    };
}
async function remoteSocketToWS(remoteSocket, webSocket, responseHeader, retry, log) {
    let hasIncomingData = false;
    let header = responseHeader;
    let isSocketClosed = false;
    let retryAttempted = false;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const controller = new AbortController();
    const signal = controller.signal;
    const timeout = setTimeout(() => {
        if (!hasIncomingData) {
            controller.abort('连接超时');
        }
    }, 5000);
    try {
        const writeData = async (chunk) => {
            if (webSocket.readyState !== WS_READY_STATE_OPEN) {
                throw new Error('WebSocket 未连接');
            }
            if (header) {
                const combinedData = new Uint8Array(header.byteLength + chunk.byteLength);
                combinedData.set(new Uint8Array(header), 0);
                combinedData.set(new Uint8Array(chunk), header.byteLength);
                webSocket.send(combinedData);
                header = null;
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
    const socksGreeting = new Uint8Array();
    const writer = socket.writable.getWriter();
    await writer.write(socksGreeting);
    log('SOCKS5 greeting sent');
    const reader = socket.readable.getReader();
    const encoder = new TextEncoder();
    let res = (await reader.read()).value;
    if (res !== 0x05) {
        log(`SOCKS5 version error: received ${res[0]}, expected 5`);
        return;
    }
    if (res === 0xff) {
        log("No acceptable authentication methods");
        return;
    }
    if (res === 0x02) {
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
        if (res !== 0x01 || res !== 0x00) {
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
    if (res === 0x00) {
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
    const 第一次哈希 = await crypto.subtle.digest('SHA-256', 编码器.encode(文本));
    const 第一次十六进制 = [...new Uint8Array(第一次哈希)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
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
const protocolEncodedFlag = atob('ZG14bGMzTT0=');
function 配置信息(UUID, 域名地址) {
	const protocolType = atob(protocolEncodedFlag);
	const aliasName = FileName;
	let address = 域名地址;  
	let port = 443;
	const userId = UUID;
	const encryptionMethod = 'none';
	const transportProtocol = 'ws';
	const fakeDomain = 域名地址;
	const pathRoute = path;
	let tlsSetting = ['tls', true];
	const sniHost = 域名地址;  
	const fingerprint = 'randomized';
	if (域名地址.includes('.workers.dev')) {
		address = atob('dmlzYS5jbg==');  
		port = 80;
		tlsSetting = ['', false];
	}
	const 威图瑞 = `${protocolType}://${userId}@${address}:${port}\u003f\u0065\u006e\u0063\u0072\u0079` + 'p' + `${atob('dGlvbj0=') + encryptionMethod}\u0026\u0073\u0065\u0063\u0075\u0072\u0069\u0074\u0079\u003d${tlsSetting[0]}&sni=${sniHost}&fp=${fingerprint}&type=${transportProtocol}&host=${fakeDomain}&path=${encodeURIComponent(pathRoute)}#${encodeURIComponent(aliasName)}`;
	const 猫猫猫 = `- {name: ${FileName}, server: ${address}, port: ${port}, type: ${protocolType}, uuid: ${userId}, tls: ${tlsSetting[1]}, alpn: [h3], udp: false, sni: ${sniHost}, tfo: false, skip-cert-verify: true, servername: ${fakeDomain}, client-fingerprint: ${fingerprint}, network: ${transportProtocol}, ws-opts: {path: "${pathRoute}", headers: {${fakeDomain}}}}`;
	return [威图瑞, 猫猫猫];
}
let subParams = ['sub', 'base64', 'b64', 'clash', 'singbox', 'sb'];
const cmad = decodeURIComponent(atob('dGVsZWdyYW0lMjAlRTQlQkElQTQlRTYlQjUlODElRTclQkUlQTQlMjAlRTYlOEElODAlRTYlOUMlQUYlRTUlQTQlQTclRTQlQkQlQUMlN0UlRTUlOUMlQTglRTclQkElQkYlRTUlOEYlOTElRTclODklOEMhJTNDYnIlM0UKJTNDYSUyMGhyZWYlM0QlMjdodHRwcyUzQSUyRiUyRnQubWUlMkZDTUxpdXNzc3MlMjclM0VodHRwcyUzQSUyRiUyRnQubWUlMkZDTUxpdXNzc3MlM0MlMkZhJTNFJTNDYnIlM0UKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tJTNDYnIlM0UKZ2l0aHViJTIwJUU5JUExJUI5JUU3JTlCJUFFJUU1JTlDJUIwJUU1JTlEJTgwJTIwU3RhciFTdGFyIVN0YXIhISElM0NiciUzRQolM0NhJTIwaHJlZiUzRCUyN2h0dHBzJTNBJTJGJTJGZ2l0aHViLmNvbSUyRmNtbGl1JTJGZWRnZXR1bm5lbCUyNyUzRWh0dHBzJTNBJTJGJTJGZ2l0aHViLmNvbSUyRmNtbGl1JTJGZWRnZXR1bm5lbCUzQyUyRmElM0UlM0NiciUzRQotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0lM0NiciUzRQolMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjM='));


async function 生成配置信息(userID, hostName, sub, UA, RproxyIP, _url, fakeUserID, fakeHostName, env, kvSettings) {
	let currentSub = sub; // URL参数里的sub优先级最高
    if (!currentSub) {
        currentSub = kvSettings.sub || env.SUB || '';
    }

	if (currentSub) {
		const match = currentSub.match(/^(?:https?:\/\/)?([^\/]+)/);
		currentSub = match ? match : currentSub;
		const subs = await 整理(currentSub);
		currentSub = subs.length > 1 ? subs : currentSub;
	}
	
	// --- 修改：从独立的 ADD.txt 加载优选列表 ---
    const addContent = await env.KV.get('ADD.txt') || '';
	const allAddresses = await 整理(addContent);

	const 分类地址 = {
		接口地址: new Set(),
		链接地址: new Set(),
		优选地址: new Set()
	};

	for (const 元素 of allAddresses) {
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
	
	// 为了兼容旧版环境变量，如果ADD.txt为空，则尝试读取环境变量
	if (addresses.length === 0 && addressesapi.length === 0 && link.length === 0) {
		if (env.ADD) addresses = await 整理(env.ADD);
		if (env.ADDAPI) addressesapi = await 整理(env.ADDAPI);
		if (env.ADDNOTLS) addressesnotls = await 整理(env.ADDNOTLS);
		if (env.ADDNOTLSAPI) addressesnotlsapi = await 整理(env.ADDNOTLSAPI);
		if (env.ADDCSV) addressescsv = await 整理(env.ADDCSV);
        if (env.LINK) link = await 整理(env.LINK);
	}

	// ... (随机节点生成逻辑保持不变)
	if ((addresses.length + addressesapi.length + addressesnotls.length + addressesnotlsapi.length + addressescsv.length) == 0) {
	    let cfips = [ '104.16.0.0/14', '104.21.0.0/16', '188.114.96.0/20' ];
    	function ipToInt(ip) { return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0; }
    	function intToIp(int) { return [ (int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255 ].join('.'); }
	    function generateRandomIPFromCIDR(cidr) {
		    const [base, mask] = cidr.split('/');
        	const baseInt = ipToInt(base);
        	const maskBits = parseInt(mask, 10);
        	const hostBits = 32 - maskBits;
        	const maxHosts = Math.pow(2, hostBits);
        	const randomOffset = Math.floor(Math.random() * maxHosts);
        	const randomIPInt = baseInt + randomOffset;
        	return intToIp(randomIPInt);
	    }
	    let counter = 1;
	    const totalIPsToGenerate = 10;
	    if (hostName.includes("worker") || hostName.includes("notls")) {
		    const randomPorts = httpPorts.concat('80');
		    for (let i = 0; i < totalIPsToGenerate; i++) {
			    const randomCIDR = cfips[Math.floor(Math.random() * cfips.length)];
			    const randomIP = generateRandomIPFromCIDR(randomCIDR);
			    const port = randomPorts[Math.floor(Math.random() * randomPorts.length)];
			    addressesnotls.push(`${randomIP}:${port}#CF随机节点${String(counter++).padStart(2, '0')}`);
		    }
	    } else {
		    const randomPorts = httpsPorts.concat('443');
		    for (let i = 0; i < totalIPsToGenerate; i++) {
			    const randomCIDR = cfips[Math.floor(Math.random() * cfips.length)];
			    const randomIP = generateRandomIPFromCIDR(randomCIDR);
			    const port = randomPorts[Math.floor(Math.random() * randomPorts.length)];
			    addresses.push(`${randomIP}:${port}#CF随机节点${String(counter++).padStart(2, '0')}`);
		    }
	    }
    }

	// ... (后续的生成配置页面和订阅链接的逻辑基本不变)
	const uuid = (_url.pathname == `/${dynamicUUID}`) ? dynamicUUID : userID;
	const userAgent = UA.toLowerCase();
	const Config = 配置信息(userID, hostName);
	const proxyConfig = Config;
	const clash = Config;
	let proxyhost = "";
	if (hostName.includes(".workers.dev")) {
		if (proxyhostsURL && (!proxyhosts || proxyhosts.length == 0)) {
			try {
				const response = await fetch(proxyhostsURL);
				if (!response.ok) { console.error('获取地址时出错:', response.status, response.statusText); return; }
				const text = await response.text();
				const lines = text.split('\n');
				const nonEmptyLines = lines.filter(line => line.trim() !== '');
				proxyhosts = proxyhosts.concat(nonEmptyLines);
			} catch (error) { }
		}
		if (proxyhosts.length != 0) proxyhost = proxyhosts[Math.floor(Math.random() * proxyhosts.length)] + "/";
	}
	const isUserAgentMozilla = userAgent.includes('mozilla');
	if (isUserAgentMozilla && !subParams.some(_searchParams => _url.searchParams.has(_searchParams))) {
		const newSocks5s = socks5s.map(socks5Address => {
			if (socks5Address.includes('@')) return socks5Address.split('@');
			else if (socks5Address.includes('//')) return socks5Address.split('//');
			else return socks5Address;
		});
		let socks5List = '';
		if (go2Socks5s.length > 0 && enableSocks) {
			socks5List = `${decodeURIComponent('SOCKS5%EF%BC%88%E7%99%BD%E5%90%8D%E5%8D%95%EF%BC%89%3A%20')}`;
			if (go2Socks5s.includes(atob('YWxsIGlu')) || go2Socks5s.includes(atob('Kg=='))) socks5List += `${decodeURIComponent('%E6%89%80%E6%9C%89%E6%B5%81%E9%87%8F')}<br>`;
			else socks5List += `<br>  ${go2Socks5s.join('<br>  ')}<br>`;
		}
		let 订阅器 = '<br>';
		let 判断是否绑定KV空间 = env.KV ? ` <a href='${_url.pathname}/edit'>编辑优选列表</a>` : '';
		if (currentSub) {
			if (enableSocks) 订阅器 += `CFCDN（访问方式）: Socks5<br>  ${newSocks5s.join('<br>  ')}<br>${socks5List}`;
			else if (proxyIP && proxyIP != '') 订阅器 += `CFCDN（访问方式）: ProxyIP<br>  ${proxyIPs.join('<br>  ')}<br>`;
			else if (RproxyIP == 'true') 订阅器 += `CFCDN（访问方式）: 自动获取ProxyIP<br>`;
			else 订阅器 += `CFCDN（访问方式）: 无法访问, 需要您设置 proxyIP/PROXYIP ！！！<br>`
			订阅器 += `<br>SUB（优选订阅生成器）: ${currentSub}${判断是否绑定KV空间}<br>`;
		} else {
			if (enableSocks) 订阅器 += `CFCDN（访问方式）: Socks5<br>  ${newSocks5s.join('<br>  ')}<br>${socks5List}`;
			else if (proxyIP && proxyIP != '') 订阅器 += `CFCDN（访问方式）: ProxyIP<br>  ${proxyIPs.join('<br>  ')}<br>`;
			else 订阅器 += `CFCDN（访问方式）: 无法访问, 需要您设置 proxyIP/PROXYIP ！！！<br>`;
			订阅器 += `<br>您的订阅内容由 优选订阅列表(ADD.txt) 提供${判断是否绑定KV空间}<br>`;
			if (addresses.length > 0) 订阅器 += `优选地址 (ADD): <br>  ${[...new Set(addresses)].join('<br>  ')}<br>`;
			if (link.length > 0) 订阅器 += `直链 (LINK): <br>  ${[...new Set(link)].join('<br>  ')}<br>`;
			if (addressesapi.length > 0) 订阅器 += `优选地址API (ADDAPI): <br>  ${[...new Set(addressesapi)].join('<br>  ')}<br>`;
		}
		if (dynamicUUID && _url.pathname !== `/${dynamicUUID}`) 订阅器 = '';
		else 订阅器 += `<br>SUBAPI（订阅转换后端）: ${subProtocol}://${subConverter}<br>SUBCONFIG（订阅转换配置文件）: ${subConfig}`;
		const 动态UUID信息 = (uuid != userID) ? `TOKEN: ${uuid}<br>UUIDNow: ${userID}<br>UUIDLow: ${userIDLow}<br>${userIDTime}TIME（动态UUID有效时间）: ${validTime} 天<br>UPTIME（动态UUID更新时间）: ${updateInterval} 时（北京时间）<br><br>` : `${userIDTime}`;
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
							  https://${proxyhost}${hostName}/${uuid}<strong>?sub=sub.google.com</strong><br><br>
							<strong>4.</strong> 快速更换 PROXYIP 至：proxyip.fxxk.dedyn.io:443，您可将"?proxyip=proxyip.fxxk.dedyn.io:443"参数添加到链接末尾，例如：<br>
							  https://${proxyhost}${hostName}/${uuid}<strong>?proxyip=proxyip.fxxk.dedyn.io:443</strong><br><br>
							<strong>5.</strong> 快速更换 SOCKS5 至：user:password@127.0.0.1:1080，您可将"?socks5=user:password@127.0.0.1:1080"参数添加到链接末尾，例如：<br>
							  https://${proxyhost}${hostName}/${uuid}<strong>?socks5=user:password@127.0.0.1:1080</strong><br><br>
							<strong>6.</strong> 如需指定多个参数则需要使用'&'做间隔，例如：<br>
							  https://${proxyhost}${hostName}/${uuid}?sub=sub.google.com<strong>&</strong>proxyip=proxyip.fxxk.dedyn.io
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
		if (typeof fetch != 'function') { return 'Error: fetch is not available in this environment.'; }
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
		if (!currentSub || currentSub == "") {
			if (hostName.includes('workers.dev')) {
				if (proxyhostsURL && (!proxyhosts || proxyhosts.length == 0)) {
					try {
						const response = await fetch(proxyhostsURL);
						if (!response.ok) { console.error('获取地址时出错:', response.status, response.statusText); return; }
						const text = await response.text();
						const lines = text.split('\n');
						const nonEmptyLines = lines.filter(line => line.trim() !== '');
						proxyhosts = proxyhosts.concat(nonEmptyLines);
					} catch (error) { console.error('获取地址时出错:', error); }
				}
				proxyhosts = [...new Set(proxyhosts)];
			}
			newAddressesapi = await 整理优选列表(addressesapi);
			newAddressescsv = await 整理测速结果('TRUE');
			url = `https://${hostName}/${fakeUserID + _url.search}`;
			if (hostName.includes("worker") || hostName.includes("notls") || noTLS == 'true') {
				if (_url.search) url += '¬ls';
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
				url = `${subProtocol}://${subConverter}/sub?target=loon&url=${encodeURIComponent(url)}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=${subEmoji}&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
				isBase64 = false;
			}
		}
		try {
			let content;
			if ((!currentSub || currentSub == "") && isBase64 == true) {
				content = await 生成本地订阅(fakeHostName, fakeUserID, noTLS, newAddressesapi, newAddressescsv, newAddressesnotlsapi, newAddressesnotlscsv);
			} else {
				const response = await fetch(url, {
					headers: { 'User-Agent': UA + atob('IENGLVdvcmtlcnMtZWRnZXR1bm5lbC9jbWxpdQ==') }
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

// ... (整理优选列表, 整理测速结果, 生成本地订阅, 整理, sendMessage, isValidIPv4, 生成动态UUID 函数保持不变)
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
				if (lines.split(',').length > 3) {
					const idMatch = api[index].match(/id=([^&]*)/);
					if (idMatch) 节点备注 = idMatch;
					const portMatch = api[index].match(/port=([^&]*)/);
					if (portMatch) 测速端口 = portMatch;
					for (let i = 1; i < lines.length; i++) {
						const columns = lines[i].split(',');
						if (columns) {
							newapi += `${columns}:${测速端口}${节点备注 ? `#${节点备注}` : ''}\n`;
							if (api[index].includes('proxyip=true')) proxyIPPool.push(`${columns}:${测速端口}`);
						}
					}
				} else {
					if (api[index].includes('proxyip=true')) {
						proxyIPPool = proxyIPPool.concat((await 整理(content)).map(item => {
							const baseItem = item.split('#') || item;
							if (baseItem.includes(':')) {
								const port = baseItem.split(':');
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
			const header = lines.split(',');
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
				if (columns[tlsIndex].toUpperCase() === tls && parseFloat(columns[speedIndex]) > DLS) {
					const ipAddress = columns[ipAddressIndex];
					const port = columns[portIndex];
					const dataCenter = columns[dataCenterIndex];
					const formattedAddress = `${ipAddress}:${port}#${dataCenter}`;
					newAddressescsv.push(formattedAddress);
					if (csvUrl.includes('proxyip=true') && columns[tlsIndex].toUpperCase() == 'true' && !httpsPorts.includes(port)) {
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
					address = parts;
					const subParts = parts.split('#');
					port = subParts;
					addressid = subParts;
				} else if (address.includes(':')) {
					const parts = address.split(':');
					address = parts;
					port = parts;
				} else if (address.includes('#')) {
					const parts = address.split('#');
					address = parts;
					addressid = parts;
				}
				if (addressid.includes(':')) {
					addressid = addressid.split(':');
				}
			} else {
				address = match;
				port = match || port;
				addressid = match || address;
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
			let fakeDomain = host;
			let 最终路径 = path;
			let 节点备注 = '';
			const protocolType = atob(protocolEncodedFlag);
            const secureProtoLink = `${protocolType}://${UUID}@${address}:${port}?` + 
                `encryption=none&` + 
                `security=none&` + 
                `type=ws&` + 
                `host=${fakeDomain}&` +
                `path=${encodeURIComponent(最终路径)}` +
                `#${encodeURIComponent(addressid + 节点备注)}`;
			return secureProtoLink;
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
				address = parts;
				const subParts = parts.split('#');
				port = subParts;
				addressid = subParts;
			} else if (address.includes(':')) {
				const parts = address.split(':');
				address = parts;
				port = parts;
			} else if (address.includes('#')) {
				const parts = address.split('#');
				address = parts;
				addressid = parts;
			}
			if (addressid.includes(':')) {
				addressid = addressid.split(':');
			}
		} else {
			address = match;
			port = match || port;
			addressid = match || address;
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
		let fakeDomain = host;
		let 最终路径 = path;
		let 节点备注 = '';
		const matchingProxyIP = proxyIPPool.find(proxyIP => proxyIP.includes(address));
		if (matchingProxyIP) 最终路径 = `/?proxyip=${matchingProxyIP}`;
		if (proxyhosts.length > 0 && (fakeDomain.includes('.workers.dev'))) {
			最终路径 = `/${fakeDomain}${最终路径}`;
			fakeDomain = proxyhosts[Math.floor(Math.random() * proxyhosts.length)];
			节点备注 = ` 已启用临时域名中转服务，请尽快绑定自定义域！`;
		}
		const protocolType = atob(protocolEncodedFlag);
		const secureProtoLink = `${protocolType}://${UUID}@${address}:${port}?` + 
			`encryption=none&` +
			`security=tls&` +
			`sni=${fakeDomain}&` +
			`fp=randomized&` +
			`alpn=h3&` + 
			`type=ws&` +
			`host=${fakeDomain}&` +
            `path=${encodeURIComponent(最终路径)}` +
			`#${encodeURIComponent(addressid + 节点备注)}`;
		return secureProtoLink;
	}).join('\n');
	let base64Response = responseBody; 
	if (noTLS == 'true') base64Response += `\n${notlsresponseBody}`;
	if (link.length > 0) base64Response += '\n' + link.join('\n');
	return btoa(base64Response);
}
async function 整理(内容) {
    if (!内容) return [];
    const 替换后的内容 = 内容.replace(/[	|"'\r\n]+/g, ',').replace(/,+/g, ',')
        .replace(/^,|,$/g, '');
    return 替换后的内容.split(',').filter(item => item.trim() !== '');
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
	const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|?[0-9][0-9]?)$/;
	return ipv4Regex.test(address);
}
function 生成动态UUID(密钥) {
	const 时区偏移 = 8; 
	const 起始日期 = new Date(2007, 6, 7, updateInterval, 0, 0);
	const 一周的毫秒数 = 1000 * 60 * 60 * 24 * validTime;
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
	const 到期时间UTC = new Date(结束时间.getTime() - 时区偏移 * 60 * 60 * 1000);
	const 到期时间字符串 = `到期时间(UTC): ${到期时间UTC.toISOString().slice(0, 19).replace('T', ' ')} (UTC+8): ${结束时间.toISOString().slice(0, 19).replace('T', ' ')}\n`;
	return Promise.all([当前UUIDPromise, 上一个UUIDPromise, 到期时间字符串]);
}


// --- 修改：KV编辑页面的处理逻辑 ---

async function KV(request, env) {
	try {
		if (request.method === "POST") {
			return await handlePostRequest(request, env);
		}
		return await handleGetRequest(env);
	} catch (error) {
		console.error('处理请求时发生错误:', error);
		return new Response("服务器错误: " + error.message, {
			status: 500,
			headers: { "Content-Type": "text/plain;charset=utf-8" }
		});
	}
}

async function handlePostRequest(request, env) {
    if (!env.KV) {
        return new Response("未绑定KV空间", { status: 400, headers: { "Content-Type": "text/plain;charset=utf-8" } });
    }
    try {
        const url = new URL(request.url);
        const type = url.searchParams.get('type');
        const content = await request.text();

        if (type === 'settings') {
            await env.KV.put('settings.txt', content);
        } else if (type === 'add') {
            await env.KV.put('ADD.txt', content);
        } else {
            return new Response("无效的保存类型", { status: 400, headers: { "Content-Type": "text/plain;charset=utf-8" } });
        }
        
        return new Response("保存成功", { status: 200, headers: { "Content-Type": "text/plain;charset=utf-8" } });
    } catch (error) {
        console.error('保存KV时发生错误:', error);
        return new Response("保存失败: " + error.message, { status: 500, headers: { "Content-Type": "text/plain;charset=utf-8" } });
    }
}

async function handleGetRequest(env) {
    let hasKV = !!env.KV;
    let addContent = '';
    let settingsContent = '';

    if (hasKV) {
        try {
            addContent = await env.KV.get('ADD.txt') || '';
            settingsContent = await env.KV.get('settings.txt') || '';
        } catch (error) {
            console.error('读取KV时发生错误:', error);
            addContent = '读取[优选列表]时发生错误: ' + error.message;
            settingsContent = '读取[高级设置]时发生错误: ' + error.message;
        }
    }
	
	// --- 修改：直接使用字符串模板，不再使用Base64 ---
    const settingsTemplate = `[PROXYIP]
# PROXYIP: 回源IP
# 每行一个IP，格式：IP:端口 (端口可选)
# 例如:
# 1.2.3.4:443
# proxyip.example.com

[SOCKS5]
# SOCKS5: SOCKS5代理
# 每行一个地址，格式：[用户名:密码@]主机:端口
# 例如:
# user:pass@127.0.0.1:1080
# 127.0.0.1:1080

[SUB]
# SUB: 外部优选订阅生成器
# 只支持单个地址
# 例如:
# sub.google.com

[SUBAPI]
# SUBAPI: 订阅转换后端API
# 例如:
# api.v1.mk
# sub.xeton.dev

[SUBCONFIG]
# SUBCONFIG: 订阅转换配置文件


[NAT64]
# NAT64/DNS64 服务器

`;

    if (settingsContent.trim() === '' && hasKV) {
        settingsContent = settingsTemplate;
    }

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>设置中心</title>
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
                body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: var(--text-color); background-color: var(--background-color); }
                .container { max-width: 1000px; margin: 0 auto; background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .title { font-size: 1.5em; color: var(--text-color); margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid var(--border-color); }
                .editor-section { margin-bottom: 30px; }
                .editor { width: 100%; min-height: 300px; padding: 15px; box-sizing: border-box; border: 1px solid var(--border-color); border-radius: 8px; font-family: Monaco, Consolas, "Courier New", monospace; font-size: 14px; line-height: 1.5; resize: vertical; }
                .button-group { display: flex; gap: 12px; margin-top: 15px; align-items: center;}
                .btn { padding: 8px 20px; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background-color 0.2s; }
                .btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .btn-primary { background: var(--primary-color); color: white; }
                .btn-primary:hover:not(:disabled) { background: var(--secondary-color); }
                .btn-secondary { background: #666; color: white; }
                .btn-secondary:hover:not(:disabled) { background: #555; }
                .save-status { font-size: 14px; color: #666; }
                .divider { height: 1px; background: var(--border-color); margin: 30px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="title">📝 ${FileName} 设置中心</div>
                
                ${hasKV ? `
                    <div class="editor-section">
                        <h3>优选订阅列表 (ADD.txt)</h3>
                        <p style="color: #666;">每行一个，支持IP/域名/API/直链。#号开头为注释。</p>
                        <textarea class="editor" id="add_content" placeholder="1.2.3.4:443#备注\nhttps://example.com/api/add.txt">${addContent}</textarea>
                        <div class="button-group">
                            <button class="btn btn-primary" onclick="saveContent('add', this)">保存优选列表</button>
                            <span class="save-status" id="add_status"></span>
                        </div>
                    </div>

                    <div class="divider"></div>

                    <div class="editor-section">
                        <h3>高级设置 (settings.txt)</h3>
                         <p style="color: #666;">请遵循INI文件格式，即 <code>[SECTION]</code>。</p>
                        <textarea class="editor" id="settings_content">${settingsContent}</textarea>
                        <div class="button-group">
                            <button class="btn btn-primary" onclick="saveContent('settings', this)">保存高级设置</button>
                             <span class="save-status" id="settings_status"></span>
                        </div>
                    </div>

                    <div class="divider"></div>
                    <div class="button-group">
                        <button class="btn btn-secondary" onclick="goBack()">返回配置页</button>
                    </div>
                    
                ` : '<p>未绑定KV空间，无法进行配置。</p>'}
            </div>

            <script>
            function goBack() {
                const pathParts = window.location.pathname.split('/');
                pathParts.pop(); // 移除 "edit"
                const newPath = pathParts.join('/');
                window.location.href = newPath;
            }

            async function saveContent(type, button) {
                const contentEl = document.getElementById(type + '_content');
                const statusEl = document.getElementById(type + '_status');
                
                try {
                    button.disabled = true;
                    statusEl.textContent = '保存中...';
                    
                    const response = await fetch(window.location.href + '?type=' + type, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                        body: contentEl.value
                    });

                    if (response.ok) {
                        statusEl.textContent = '✅ 保存成功';
                    } else {
                        const errorText = await response.text();
                        throw new Error(errorText || '保存失败');
                    }
                } catch (error) {
                    statusEl.textContent = '❌ ' + error.message;
                    console.error('保存 ' + type + ' 时发生错误:', error);
                } finally {
                    button.disabled = false;
                    setTimeout(() => {
                        statusEl.textContent = '';
                    }, 3000);
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
