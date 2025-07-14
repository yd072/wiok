// --- START OF FINAL, COMPLETE, AND RUNNABLE _worker.js ---

import { connect } from 'cloudflare:sockets';

// --- 全局常量和默认值 (Global Constants & Defaults) ---
const protocolEncodedFlag = 'dmxlc3M='; // atob('dmxlc3M=') -> vless
const defaultSubConverter = 'subapi.cmliussss.net'; // atob('U1VCQVBJLkNNTGl1c3Nzcy5uZXQ=')
const defaultSubConfig = 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Mini_MultiMode.ini'; // atob(...)
const cmad = decodeURIComponent(atob('dGVsZWdyYW0lMjAlRTQlQkElQTQlRTYlQjUlODElRTclQkUlQTQlMjAlRTYlOEElODAlRTYlOUMlQUYlRTUlQTQlQTclRTQlQkQlQUMlN0UlRTUlOUMlQTglRTclQkElQkYlRTUlOEYlOTElRTclODklOEMhJTNDYnIlM0UKJTNDYSUyMGhyZWYlM0QlMjdodHRwcyUzQSUyRiUyRnQubWUlMkZDTUxpdXNzc3MlMjclM0VodHRwcyUzQSUyRiUyRnQubWUlMkZDTUxpdXNzc3MlM0MlMkZhJTNFJTNDYnIlM0UKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tJTNDYnIlM0UKZ2l0aHViJTIwJUU5JUExJUI5JUU3JTlCJUFFJUU1JTlDJUIwJUU1JTlEJTgwJTIwU3RhciFTdGFyIVN0YXIhISElM0NiciUzRQolM0NhJTIwaHJlZiUzRCUyN2h0dHBzJTNBJTJGJTJGZ2l0aHViLmNvbSUyRmNtbGl1JTJGZWRnZXR1bm5lbCUyNyUzRWh0dHBzJTNBJTJGJTJGZ2l0aHViLmNvbSUyRmNtbGl1JTJGZWRnZXR1bm5lbCUzQyUyRmElM0UlM0NiciUzRQotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0lM0NiciUzRQolMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjMlMjM='));
const defaultPath = '/?ed=2560';

// --- 全局变量 (现在已大幅减少) ---
let proxyIPPool = []; // 用于临时存储从API获取的proxyIP

// ===================================================================================
// START: 优化后的核心逻辑 (Core Refactored Logic)
// ===================================================================================

export default {
	/**
	 * 主入口函数，现在作为一个路由器。
	 * @param {Request} request
	 * @param {object} env
	 * @param {object} ctx
	 * @returns {Promise<Response>}
	 */
	async fetch(request, env, ctx) {
		try {
			const upgradeHeader = request.headers.get('Upgrade');
			if (upgradeHeader && upgradeHeader === 'websocket') {
				// 1. 处理 WebSocket 请求
				return await handleWebSocketRequest(request, env);
			}

			// 2. 创建包含所有配置和信息的上下文对象
			const context = await createContext(request, env);

			if (!context.userID) {
				// 如果没有设置 UUID，显示引导页面
				return handleNoIdPage(request);
			}

			// 3. 简单的路由逻辑
			const url = new URL(request.url);
			const pathRoute = url.pathname.toLowerCase();
			const { userID, dynamicUUID, fakeUserID } = context;

			if (pathRoute === '/') {
				return handleHomepage(request, context);
			}
			
			// 此路径为内部 subconverter 调用时的伪装路径
			if (pathRoute === `/${fakeUserID}`) {
				const configContent = await 生成配置信息(context);
				return new Response(configContent, { status: 200 });
			}
			
			// 用户实际访问的订阅路径
			if (pathRoute === `/${userID}` || (dynamicUUID && pathRoute === `/${dynamicUUID}`)) {
				return handleSubscriptionRequest(request, context);
			}

			// 编辑配置的管理后台路径
			if (pathRoute === `/${userID}/edit` || (dynamicUUID && pathRoute === `/${dynamicUUID}/edit`)) {
				return handleAdminPanel(request, context);
			}
			
			// 4. 处理其他情况 (如代理URL或404)
			if (env.URL302) return Response.redirect(env.URL302, 302);
			if (env.URL) return await 代理URL(env.URL, new URL(request.url));
			
			return handleNotFoundPage();

		} catch (err) {
			console.error(err);
			const errorResponse = `<h1>Worker Error</h1><p>An error occurred:</p><pre>${err.stack || err}</pre>`;
			return new Response(errorResponse, { status: 500, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
		}
	},
};

/**
 * 创建并填充请求上下文对象，包含所有需要传递的信息。
 * @param {Request} request 
 * @param {object} env 
 * @returns {Promise<object>} context
 */
async function createContext(request, env) {
	const context = {
		request,
		env,
		userID: env.UUID || env.uuid || env.PASSWORD || env.pswd,
		dynamicUUID: null,
		userIDLow: null,
		userIDTime: "",
		// **优化点**: 一次性读取所有KV配置
		kvConfig: await getKVConfig(env) 
	};

	// 处理动态 UUID
	if (env.KEY || env.TOKEN || (context.userID && !utils.isValidUUID(context.userID))) {
		context.dynamicUUID = env.KEY || env.TOKEN || context.userID;
		const validTime = Number(env.TIME) || 7;
		const updateInterval = Number(env.UPTIME) || 3;
		const [newUserID, newUserIDLow, userIDTime] = await 生成动态UUID(context.dynamicUUID, validTime, updateInterval);
		
		context.userID = newUserID;
		context.userIDLow = newUserIDLow;
		context.userIDTime = userIDTime;
	}

	// 生成伪装 ID 和 Host
	const currentDate = new Date();
	currentDate.setHours(0, 0, 0, 0);
	const timestamp = Math.ceil(currentDate.getTime() / 1000);
	const fakeUserIDSHA256 = await 双重哈希(`${context.userID}${timestamp}`);
	context.fakeUserID = [
		fakeUserIDSHA256.slice(0, 8),
		fakeUserIDSHA256.slice(8, 12),
		fakeUserIDSHA256.slice(12, 16),
		fakeUserIDSHA256.slice(16, 20),
		fakeUserIDSHA256.slice(20, 32)
	].join('-');
	context.fakeHostName = `${fakeUserIDSHA256.slice(6, 9)}.${fakeUserIDSHA256.slice(13, 19)}`;

	return context;
}

/**
 * **【优化核心】**
 * 从 KV 中获取配置。将多个文本配置合并到一个 JSON 对象中，减少读取次数。
 * @param {object} env
 * @returns {Promise<object>}
 */
async function getKVConfig(env) {
    const defaultConfig = {
        proxyIP: '',
        socks5: '',
        sub: '',
        add: '',
        add_notls: '',
        add_api: '',
        add_notls_api: '',
        add_csv: '',
        links: '',
        subAPI: defaultSubConverter,
        subConfig: defaultSubConfig,
    };

    if (!env.KV) {
        return defaultConfig;
    }

    try {
        const configStr = await env.KV.get('CONFIG');
        if (configStr) {
            return { ...defaultConfig, ...JSON.parse(configStr) };
        } else {
            // **向后兼容逻辑**：如果 'CONFIG' 不存在，则尝试从旧的 .txt 文件迁移
            console.log("KV 'CONFIG' not found, attempting to migrate from old .txt files...");
            const [oldProxyIP, oldSocks5, oldSub, oldAdd, oldSubAPI, oldSubConfig] = await Promise.all([
				env.KV.get('PROXYIP.txt'),
				env.KV.get('SOCKS5.txt'),
				env.KV.get('SUB.txt'),
				env.KV.get('ADD.txt'),
				env.KV.get('SUBAPI.txt'),
				env.KV.get('SUBCONFIG.txt'),
			]);

            if (oldProxyIP || oldSocks5 || oldSub || oldAdd || oldSubAPI || oldSubConfig) {
                const migratedConfig = {
                    proxyIP: oldProxyIP || '',
                    socks5: oldSocks5 || '',
                    sub: oldSub || '',
                    add: oldAdd || '',
					subAPI: oldSubAPI || defaultConfig.subAPI,
					subConfig: oldSubConfig || defaultConfig.subConfig,
                };
                // 将迁移后的配置写入新的 'CONFIG' 键，并格式化
                await env.KV.put('CONFIG', JSON.stringify(migratedConfig, null, 2));
                console.log("Migration successful. New 'CONFIG' key created.");
                // 可选：迁移后删除旧的键以保持整洁
                // await Promise.all([ env.KV.delete('PROXYIP.txt'), env.KV.delete('SOCKS5.txt'), ... ]);
                return { ...defaultConfig, ...migratedConfig };
            }
            // 如果没有旧文件，则创建一个空的配置
            await env.KV.put('CONFIG', JSON.stringify({}, null, 2));
            return defaultConfig;
        }
    } catch (error) {
        console.error('Error reading or migrating KV config:', error);
        return defaultConfig; // 出错时返回默认配置
    }
}

/**
 * 处理 WebSocket 升级请求。
 * @param {Request} request 
 * @param {object} env 
 */
async function handleWebSocketRequest(request, env) {
	return await secureProtoOverWSHandler(request, env);
}

/**
 * 处理订阅请求，返回最终给用户的订阅内容。
 * @param {Request} request 
 * @param {object} context 
 */
async function handleSubscriptionRequest(request, context) {
	const { userID, fakeUserID, fakeHostName, env } = context;
	const url = new URL(request.url);
	const UA = request.headers.get('User-Agent') || 'null';
	const userAgent = UA.toLowerCase();
	const FileName = env.SUBNAME || 'edgetunnel';
	
	await sendMessage(context, `#获取订阅 ${FileName}`, request.headers.get('CF-Connecting-IP'), `UA: ${UA}\n域名: ${url.hostname}\n入口: ${url.pathname + url.search}`);

	// 生成原始（伪装后的）订阅内容
	const rawConfigContent = await 生成配置信息(context);
	
	const isClientExpectingPlainText = 
		(userAgent.includes('clash') && !userAgent.includes('nekobox')) || (url.searchParams.has('clash')) ||
		(userAgent.includes('sing-box') || userAgent.includes('singbox')) || (url.searchParams.has('singbox') || url.searchParams.has('sb')) ||
		(userAgent.includes('loon')) || (url.searchParams.has('loon'));

	const isBase64 = !isClientExpectingPlainText || url.searchParams.has('b64') || url.searchParams.has('base64');

	// 恢复伪装信息
	const finalContent = 恢复伪装信息(rawConfigContent, userID, url.hostname, fakeUserID, fakeHostName, isBase64);
	
	return new Response(finalContent, {
		status: 200,
		headers: {
			"Content-Disposition": `attachment; filename=${FileName}; filename*=utf-8''${encodeURIComponent(FileName)}`,
			"Content-Type": "text/plain;charset=utf-8",
			"Profile-Update-Interval": "6",
		}
	});
}

/**
 * **【优化核心】**
 * 处理管理后台的 GET 和 POST 请求。
 * @param {Request} request 
 * @param {object} context 
 */
async function handleAdminPanel(request, context) {
    const { env, kvConfig } = context;

    if (!env.KV) {
        return new Response("未绑定KV空间 (KV namespace not bound)", { status: 400 });
    }

    if (request.method === "POST") {
        try {
            const content = await request.text();
            JSON.parse(content); // 验证是否为有效的JSON
            await env.KV.put('CONFIG', content);
            return new Response("保存成功 (Save successful)", { status: 200 });
        } catch (error) {
            console.error('保存KV时发生错误 (Error saving to KV):', error);
            return new Response(`保存失败: 无效的JSON格式 (Save failed: Invalid JSON format)\n${error.message}`, { status: 400 });
        }
    }

    // GET 请求，显示编辑器页面
    const contentForEditor = JSON.stringify(kvConfig, null, 2);
	const FileName = env.SUBNAME || 'edgetunnel';
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>编辑配置 - ${FileName}</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bulma/0.9.3/css/bulma.min.css">
            <style>
                .notice { white-space: pre-wrap; word-break: break-all; font-family: 'Courier New', monospace; background-color: #f5f5f5; padding: 1em; }
                .status { font-weight: bold; }
            </style>
        </head>
        <body>
            <section class="section">
                <div class="container">
                    <h1 class="title">${FileName} - 编辑配置</h1>
                    <p class="subtitle">所有配置项已整合到一个JSON对象中，请直接在此编辑。</p>
                    
                    <div class="field">
                        <div class="control">
                            <textarea id="content" class="textarea is-medium" rows="25">${contentForEditor}</textarea>
                        </div>
                    </div>

                    <div class="field is-grouped">
                        <div class="control">
                            <button class="button is-link" onclick="saveContent()">保存</button>
                        </div>
                        <div class="control">
                            <button class="button" onclick="goBack()">返回</button>
                        </div>
                        <div class="control">
                             <p id="saveStatus" class="status"></p>
                        </div>
                    </div>

                    <div class="notification is-info is-light mt-5">
                        <h2 class="title is-5">格式说明</h2>
                        <div class="content">
                            <p class="notice">
<strong>"proxyIP"</strong>: "优选反代IP，多个请用\\n分隔",
<strong>"socks5"</strong>: "SOCKS5代理地址，多个请用\\n分隔",
<strong>"sub"</strong>: "远程订阅地址，仅支持一个",
<strong>"add"</strong>: "自定义节点列表（TLS），多个请用\\n分隔",
<strong>"add_notls"</strong>: "自定义节点列表（noTLS），多个请用\\n分隔",
<strong>"add_api"</strong>: "节点API地址，多个请用\\n分隔",
<strong>"add_csv"</strong>: "测速CSV地址，多个请用\\n分隔",
<strong>"links"</strong>: "其他协议链接，多个请用\\n分隔",
<strong>"subAPI"</strong>: "订阅转换器后端API",
<strong>"subConfig"</strong>: "订阅转换器配置文件URL"
                            </p>
                        </div>
                    </div>
                </div>
            </section>
            <script>
                function goBack() {
                    const pathParts = window.location.pathname.split('/');
                    pathParts.pop(); // 移除 "edit"
                    const newPath = pathParts.join('/');
                    window.location.href = newPath || '/';
                }

                async function saveContent() {
                    const button = document.querySelector('.button.is-link');
                    const saveStatus = document.getElementById('saveStatus');
                    try {
                        const content = document.getElementById('content').value;
                        // 尝试解析以验证JSON格式
                        JSON.parse(content);

                        button.classList.add('is-loading');
                        saveStatus.textContent = '保存中...';
                        saveStatus.className = 'status has-text-info';

                        const response = await fetch(window.location.href, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: content
                        });

                        if (response.ok) {
                            saveStatus.textContent = '✅ 保存成功';
                            saveStatus.className = 'status has-text-success';
                        } else {
                            const errorText = await response.text();
                            throw new Error('保存失败: ' + errorText);
                        }
                    } catch (error) {
                        saveStatus.textContent = '❌ ' + error.message;
                        saveStatus.className = 'status has-text-danger';
                        console.error('保存时发生错误:', error);
                        alert('保存失败，请检查JSON格式是否正确！\\n\\n' + error.message);
                    } finally {
                        button.classList.remove('is-loading');
                        setTimeout(() => { saveStatus.textContent = ''; }, 3000);
                    }
                }
            </script>
        </body>
        </html>
    `;
    return new Response(html, { headers: { "Content-Type": "text/html;charset=utf-8" } });
}

function handleHomepage(request, context) {
	const { userID, dynamicUUID, env } = context;
	const url = new URL(request.url);
	const hostName = url.hostname;
	const uuid = dynamicUUID || userID;
	const FileName = env.SUBNAME || 'edgetunnel';
	
	const html = `
	<!DOCTYPE html>
	<html>
	<head>
		<title>${FileName} 配置信息</title>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bulma/0.9.3/css/bulma.min.css">
	</head>
	<body>
		<section class="section">
			<div class="container">
				<div class="box">
					<h1 class="title">${FileName} 订阅信息</h1>
					<p class="mb-2"><strong>订阅地址:</strong></p>
					<div class="field">
						<div class="control">
							<input class="input" type="text" value="https://${hostName}/${uuid}" readonly>
						</div>
					</div>
					<div class="buttons">
						<a href="/${uuid}?clash" class="button">Clash</a>
						<a href="/${uuid}?sb" class="button">Sing-Box</a>
						<a href="/${uuid}?b64" class="button">Base64</a>
					</div>
					<hr>
					<a href="/${uuid}/edit" class="button is-link is-outlined">编辑在线配置</a>
				</div>
				<div class="box">${cmad}</div>
			</div>
		</section>
	</body>
	</html>`;
	
	return new Response(html, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
}

function handleNoIdPage(request) {
    const html = `
    <!DOCTYPE html><html><head><title>错误</title><meta charset="utf-8"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bulma/0.9.3/css/bulma.min.css"></head>
    <body><section class="section"><div class="container"><div class="notification is-danger">
    <h1 class="title">错误：未设置UUID</h1><p>请在Cloudflare后台设置环境变量 <strong>UUID</strong>。</p>
    </div></div></section></body></html>`;
    return new Response(html, { status: 400, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
}

function handleNotFoundPage() {
    const html = `
    <!DOCTYPE html><html><head><title>404 Not Found</title><meta charset="utf-8"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bulma/0.9.3/css/bulma.min.css"></head>
    <body><section class="section"><div class="container"><div class="notification is-warning">
    <h1 class="title">404 - 页面未找到</h1><p>您访问的路径不正确，或UUID错误。</p>
    </div></div></section></body></html>`;
    return new Response(html, { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
}

// ===================================================================================
// END: 优化后的核心逻辑
// ===================================================================================


// ===================================================================================
// START: 辅助函数 (HELPER FUNCTIONS)
// ===================================================================================

const utils = {
	isValidUUID(uuid) {
		if (!uuid || typeof uuid !== 'string') return false;
		const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
	}

	makeReadableStream(earlyDataHeader) {
		let readableStream = this;
		return new ReadableStream({
			start(controller) {
				readableStream.webSocket.addEventListener('message', event => {
					if (readableStream.readableStreamCancel) return;
					controller.enqueue(event.data);
				});

				readableStream.webSocket.addEventListener('close', () => {
					if (readableStream.readableStreamCancel) return;
					try { controller.close(); } catch (error) { console.log('controller.close error', error); }
				});

				readableStream.webSocket.addEventListener('error', (err) => {
					readableStream.log('webSocket error', err);
					controller.error(err);
				});

				const { earlyData, error } = utils.base64.toArrayBuffer(earlyDataHeader);
				if (error) {
					controller.error(error);
				} else if (earlyData) {
					controller.enqueue(earlyData);
				}
			},
			pull(controller) {},
			cancel(reason) {
				if (readableStream.readableStreamCancel) return;
				readableStream.log(`readableStream is canceled, reason is: ${reason}`);
				readableStream.readableStreamCancel = true;
				try { readableStream.webSocket.close(); } catch (error) { console.log('webSocket.close error', error); }
			}
		});
	}
}

async function secureProtoOverWSHandler(request, env) {
	const userID = env.UUID || env.uuid || env.PASSWORD || env.pswd;
    const webSocketPair = new WebSocketPair();
    const [client, webSocket] = Object.values(webSocketPair);
    webSocket.accept();

    let address = '';
    let portWithRandomLog = '';
    const log = (info, event = '') => console.log(`[${address}:${portWithRandomLog}] ${info}`, event);
    const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';
    const readableWebSocketStream = new WebSocketManager(webSocket, log).makeReadableStream(earlyDataHeader);
    let remoteSocketWrapper = { value: null };
    let isDns = false;
    let isTls = false;

    readableWebSocketStream.pipeTo(new WritableStream({
        async write(chunk, controller) {
            if (isDns) return;

            if (remoteSocketWrapper.value) {
                const writer = remoteSocketWrapper.value.writable.getWriter();
                await writer.write(chunk);
                writer.releaseLock();
                return;
            }

            const { hasError, message, addressType, portRemote, addressRemote, rawDataIndex, vlessVersion, isUDP } = processVlessHeader(chunk, userID);
            if (hasError) {
                throw new Error(message);
            }

            address = addressRemote;
            portWithRandomLog = `${portRemote}--${Math.random()} ${isUDP ? 'udp' : 'tcp'}`;

            if (isUDP) {
                if (portRemote === 53) isDns = true;
                else throw new Error('UDP proxy only support for DNS queries for now.');
            }

            const vlessResponseHeader = new Uint8Array([vlessVersion[0], 0]);
            const rawClientData = chunk.slice(rawDataIndex);
            if (isDns) return;

            await handleTCPOutBound(remoteSocketWrapper, addressType, addressRemote, portRemote, rawClientData, webSocket, vlessResponseHeader, log, env);
        },
        close() { log(`readableWebSocketStream is close`); },
        abort(reason) { log(`readableWebSocketStream is abort`, JSON.stringify(reason)); },
    })).catch((err) => log('readableWebSocketStream pipeTo error', err));

    return new Response(null, { status: 101, webSocket: client });
}

async function handleTCPOutBound(remoteSocket, addressType, addressRemote, portRemote, rawClientData, webSocket, vlessResponseHeader, log, env) {
	async function connectAndWrite(address, port, socks = false) {
		const options = { hostname: address, port: port };
		const tcpSocket = socks ? await socks5Connect(addressType, address, port, log, env) : await connect(options);
		remoteSocket.value = tcpSocket;
		log(`connected to ${address}:${port}`);
		const writer = tcpSocket.writable.getWriter();
		await writer.write(rawClientData);
		writer.releaseLock();
		return tcpSocket;
	}

	async function retry(isSocks = false) {
		const proxyIP = isSocks ? (env.SOCKS5 || '').split('@')[1].split(':')[0] : (env.PROXYIP || addressRemote);
		const proxyPort = isSocks ? parseInt((env.SOCKS5 || '').split('@')[1].split(':')[1] || '1080') : portRemote;
		const tcpSocket = await connectAndWrite(proxyIP, proxyPort, isSocks);
		tcpSocket.closed.catch(error => log('retry tcpSocket.closed error', error)).finally(() => safeCloseWebSocket(webSocket));
		remoteSocketToWS(tcpSocket, webSocket, vlessResponseHeader, null, log);
	}
	
	const socks5Address = env.SOCKS5 || '';
	const enableSocks = socks5Address !== '';

	try {
		const tcpSocket = enableSocks 
			? await connectAndWrite(addressRemote, portRemote, true)
			: await connectAndWrite(env.PROXYIP || addressRemote, portRemote, false);
		remoteSocketToWS(tcpSocket, webSocket, vlessResponseHeader, () => retry(enableSocks), log);
	} catch (error) {
		log(`connect failed: ${error.message}, try to retry`);
		try {
			await retry(enableSocks);
		} catch (retryError) {
			log(`retry failed: ${retryError.message}`);
			safeCloseWebSocket(webSocket);
		}
	}
}

function processVlessHeader(vlessBuffer, userID) {
	if (vlessBuffer.byteLength < 24) return { hasError: true, message: 'invalid vless header: insufficient length' };
	
	const version = new Uint8Array(vlessBuffer.slice(0, 1));
	const uuid = new Uint8Array(vlessBuffer.slice(1, 17));
	if (stringify(uuid) !== userID) return { hasError: true, message: 'invalid user' };

	const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];
	const command = new Uint8Array(vlessBuffer.slice(18 + optLength, 18 + optLength + 1))[0];
	const isUDP = command === 2;

	const portIndex = 18 + optLength + 1;
	const portRemote = new DataView(vlessBuffer.slice(portIndex, portIndex + 2)).getUint16(0);

	let addressIndex = portIndex + 2;
	const addressType = new Uint8Array(vlessBuffer.slice(addressIndex, addressIndex + 1))[0];
	let addressLength = 0, addressValue = '';
	let addressValueIndex = addressIndex + 1;

	switch (addressType) {
		case 1: // IPv4
			addressLength = 4;
			addressValue = new Uint8Array(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)).join('.');
			break;
		case 2: // Domain
			addressLength = new Uint8Array(vlessBuffer.slice(addressValueIndex, addressValueIndex + 1))[0];
			addressValueIndex += 1;
			addressValue = new TextDecoder().decode(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
			break;
		case 3: // IPv6
			addressLength = 16;
			const dataView = new DataView(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
			const ipv6 = Array.from({ length: 8 }, (_, i) => dataView.getUint16(i * 2).toString(16));
			addressValue = ipv6.join(':');
			break;
		default: return { hasError: true, message: `invalid address type: ${addressType}` };
	}

	if (!addressValue) return { hasError: true, message: `address is empty, type: ${addressType}` };

	return {
		hasError: false,
		addressRemote: addressValue,
		portRemote,
		rawDataIndex: addressValueIndex + addressLength,
		vlessVersion: version,
		isUDP,
		addressType: addressType,
	};
}

async function remoteSocketToWS(remoteSocket, webSocket, vlessResponseHeader, retry, log) {
	let hasIncomingData = false;
	await remoteSocket.readable
		.pipeTo(new WritableStream({
			async write(chunk, controller) {
				hasIncomingData = true;
				if (webSocket.readyState !== WS_READY_STATE_OPEN) {
					controller.error('webSocket.readyState is not open');
				}
				if (vlessResponseHeader) {
					webSocket.send(await new Blob([vlessResponseHeader, chunk]).arrayBuffer());
					vlessResponseHeader = null;
				} else {
					webSocket.send(chunk);
				}
			},
			close() { log(`remoteSocket all data has been sent`); },
			abort(reason) { console.error(`remoteSocket abort`, reason); },
		}))
		.catch(error => console.error(`remoteSocket pipeTo error`, error));

	if (retry && !hasIncomingData) {
		log(`no incoming data, try to retry`);
		retry();
	}
}

const WS_READY_STATE_OPEN = 1;
function safeCloseWebSocket(socket) {
	try {
		if (socket && socket.readyState === WS_READY_STATE_OPEN) socket.close();
	} catch (error) {
		console.error('safeCloseWebSocket error', error);
	}
}

const byteToHex = Array.from({ length: 256 }, (_, i) => (i + 256).toString(16).slice(1));
function unsafeStringify(arr, offset = 0) {
	return (byteToHex[arr[offset+0]]+byteToHex[arr[offset+1]]+byteToHex[arr[offset+2]]+byteToHex[arr[offset+3]]+'-'+byteToHex[arr[offset+4]]+byteToHex[arr[offset+5]]+'-'+byteToHex[arr[offset+6]]+byteToHex[arr[offset+7]]+'-'+byteToHex[arr[offset+8]]+byteToHex[arr[offset+9]]+'-'+byteToHex[arr[offset+10]]+byteToHex[arr[offset+11]]+byteToHex[arr[offset+12]]+byteToHex[arr[offset+13]]+byteToHex[arr[offset+14]]+byteToHex[arr[offset+15]]).toLowerCase();
}
function stringify(arr, offset = 0) {
	const uuid = unsafeStringify(arr, offset);
	if (!utils.isValidUUID(uuid)) throw new TypeError('Invalid UUID');
	return uuid;
}

async function socks5Connect(addressType, addressRemote, portRemote, log, env) {
	const [username, password, hostname, port] = (env.SOCKS5 || '').match(/(?:(.*):(.*)@)?(.*):(.*)/).slice(1);
	if (!hostname) throw new Error('Invalid SOCKS5 address');

	const socket = await connect({ hostname, port: parseInt(port) });
	const writer = socket.writable.getWriter();
	const reader = socket.readable.getReader();
	
	await writer.write(new Uint8Array([5, username ? 2 : 1, 0, 2])); // Greeting
	let response = (await reader.read()).value;
	if (response[0] !== 5 || response[1] === 255) throw new Error('SOCKS5 greeting failed');

	if (response[1] === 2) { // Auth needed
		if (!username) throw new Error('SOCKS5 auth required but no credentials provided');
		const authRequest = new Uint8Array([1, username.length, ...new TextEncoder().encode(username), password.length, ...new TextEncoder().encode(password)]);
		await writer.write(authRequest);
		response = (await reader.read()).value;
		if (response[0] !== 1 || response[1] !== 0) throw new Error('SOCKS5 authentication failed');
	}

	const requestCmd = new Uint8Array([5, 1, 0, addressType]);
	const portBigEndian = new Uint8Array([(portRemote >> 8) & 0xff, portRemote & 0xff]);
	let addressBytes;
	if (addressType === 1) addressBytes = new Uint8Array(addressRemote.split('.').map(Number));
	else if (addressType === 2) addressBytes = new Uint8Array([addressRemote.length, ...new TextEncoder().encode(addressRemote)]);
	else if (addressType === 3) addressBytes = new Uint8Array(addressRemote.split(':').flatMap(x => [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2), 16)]));

	await writer.write(new Uint8Array([...requestCmd, ...addressBytes, ...portBigEndian]));
	response = (await reader.read()).value;
	if (response[0] !== 5 || response[1] !== 0) throw new Error(`SOCKS5 connection failed, status: ${response[1]}`);
	
	writer.releaseLock();
	reader.releaseLock();
	return socket;
}

function 恢复伪装信息(content, userID, hostName, fakeUserID, fakeHostName, isBase64) {
    if (!content) return '';
    const originalContent = isBase64 ? atob(content) : content;
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const restoredContent = originalContent
        .replace(new RegExp(escapeRegExp(fakeUserID), 'g'), userID)
        .replace(new RegExp(escapeRegExp(fakeHostName), 'g'), hostName);
    return isBase64 ? btoa(restoredContent) : restoredContent;
}

async function 双重哈希(文本) {
    const 编码器 = new TextEncoder();
    const 第一次哈希 = await crypto.subtle.digest('SHA-256', 编码器.encode(文本));
    const 第一次十六进制 = [...new Uint8Array(第一次哈希)].map(b => b.toString(16).padStart(2, '0')).join('');
    const 截取部分 = 第一次十六进制.substring(7, 27);
    const 第二次哈希 = await crypto.subtle.digest('SHA-256', 编码器.encode(截取部分));
    return [...new Uint8Array(第二次哈希)].map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
}

async function 代理URL(代理网址, 目标网址) {
	const 网址列表 = await 整理(代理网址);
	if (!网址列表 || 网址列表.length === 0) throw new Error('代理网址列表为空');
	const 完整网址 = 网址列表[Math.floor(Math.random() * 网址列表.length)];
	const 解析后的网址 = new URL(完整网址);
	const 目标URL = new URL(目标网址.pathname + 目标网址.search, 解析后的网址);
	const 响应 = await fetch(目标URL, { method: 'GET', headers: 目标网址.headers });
	const 新响应 = new Response(响应.body, 响应);
	新响应.headers.set('access-control-allow-origin', '*');
	return 新响应;
}

async function 生成配置信息(context) {
	const { request, env, fakeUserID, fakeHostName, kvConfig } = context;
	const url = new URL(request.url);
	const hostName = url.hostname;
	const UA = request.headers.get('User-Agent') || 'null';
	const userAgent = UA.toLowerCase();

	let sub = url.searchParams.get('sub') || kvConfig.sub || '';
	let subConverter = url.searchParams.get('subapi') || kvConfig.subAPI || defaultSubConverter;
	let subConfig = url.searchParams.get('subconfig') || kvConfig.subConfig || defaultSubConfig;
	let noTLS = url.searchParams.has('notls') ? 'true' : 'false';
	
	const subProtocol = subConverter.startsWith("http://") ? 'http' : 'https';
	subConverter = subConverter.replace(/^https?:\/\//, '');

	const DLS = Number(env.DLS) || 8;
	const remarkIndex = Number(env.CSVREMARK) || 1;
	const subEmoji = env.SUBEMOJI || env.EMOJI || 'true';
	
	let addresses = kvConfig.add ? await 整理(kvConfig.add) : [];
	let addressesnotls = kvConfig.add_notls ? await 整理(kvConfig.add_notls) : [];
	let addressesapi = kvConfig.add_api ? await 整理(kvConfig.add_api) : [];
	let addressesnotlsapi = kvConfig.add_notls_api ? await 整理(kvConfig.add_notls_api) : [];
	let addressescsv = kvConfig.add_csv ? await 整理(kvConfig.add_csv) : [];
	let link = kvConfig.links ? await 整理(kvConfig.links) : [];

	let effectiveFakeHostName = fakeHostName;

	// 如果没有外部订阅，则生成本地订阅
	if (!sub) {
		let newAddressesapi = [], newAddressescsv = [], newAddressesnotlsapi = [], newAddressesnotlscsv = [];
		if (hostName.includes(".workers.dev") || hostName.includes("worker") || hostName.includes("notls") || noTLS === 'true') {
			noTLS = 'true';
			effectiveFakeHostName = `${fakeHostName}.notls.net`;
			newAddressesnotlsapi = await 整理优选列表(addressesnotlsapi, DLS, remarkIndex);
			newAddressesnotlscsv = await 整理测速结果(addressescsv, 'FALSE', DLS, remarkIndex);
		} else {
			effectiveFakeHostName = `${fakeHostName}.xyz`;
			newAddressesapi = await 整理优选列表(addressesapi, DLS, remarkIndex);
			newAddressescsv = await 整理测速结果(addressescsv, 'TRUE', DLS, remarkIndex);
		}
		return 生成本地订阅(effectiveFakeHostName, fakeUserID, noTLS, addresses, addressesnotls, newAddressesapi, newAddressescsv, newAddressesnotlsapi, newAddressesnotlscsv, link, env);
	}
	
	// 处理外部订阅
	let RproxyIP = url.searchParams.has('proxyip') ? 'false' : (env.RPROXYIP || !kvConfig.proxyIP ? 'true' : 'false');
	const subUrl = new URL(url.protocol + "//" + sub);
	subUrl.pathname = '/sub';
	subUrl.searchParams.set('host', fakeHostName);
	subUrl.searchParams.set('uuid', fakeUserID);
	subUrl.searchParams.set('edgetunnel', 'cmliu');
	subUrl.searchParams.set('proxyip', RproxyIP);
	subUrl.searchParams.set('path', encodeURIComponent(defaultPath));
	let fetchUrl = subUrl.toString();

	const isClientExpectingPlainText = (userAgent.includes('clash') && !userAgent.includes('nekobox')) || url.searchParams.has('clash') || (userAgent.includes('sing-box') || userAgent.includes('singbox')) || url.searchParams.has('singbox') || url.searchParams.has('sb') || userAgent.includes('loon') || url.searchParams.has('loon');

	if (isClientExpectingPlainText) {
		const target = userAgent.includes('clash') ? 'clash' : ((userAgent.includes('sing-box') || userAgent.includes('singbox')) ? 'singbox' : 'loon');
		fetchUrl = `${subProtocol}://${subConverter}/sub?target=${target}&url=${encodeURIComponent(fetchUrl)}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=${subEmoji}&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
	}

	try {
		const response = await fetch(fetchUrl, { headers: { 'User-Agent': `${UA} CF-Workers-edgetunnel/cmliu` } });
		return await response.text();
	} catch (error) {
		console.error('Error fetching sub content:', error);
		return `Error fetching content: ${error.message}`;
	}
}

async function 整理优选列表(api, DLS, remarkIndex) {
	if (!api || api.length === 0) return [];
	let newapi = "";
	for (const apiUrl of api) {
		try {
			const response = await fetch(apiUrl);
			if (response.ok) newapi += await response.text() + '\n';
		} catch (error) { console.error('整理优选列表时出错:', error); }
	}
	return await 整理(newapi);
}

async function 整理测速结果(addressescsv, tls, DLS, remarkIndex) {
	if (!addressescsv || addressescsv.length === 0) return [];
	let newAddressescsv = [];
	for (const csvUrl of addressescsv) {
		try {
			const response = await fetch(csvUrl);
			if (!response.ok) continue;
			const text = await response.text();
			const lines = text.split('\n');
			const header = lines[0].split(',');
			const tlsIndex = header.indexOf('TLS');
			const ipAddressIndex = 0, portIndex = 1, dataCenterIndex = tlsIndex + remarkIndex;
			if (tlsIndex === -1) continue;
			for (let i = 1; i < lines.length; i++) {
				const columns = lines[i].split(',');
				if (columns[tlsIndex] && columns[tlsIndex].toUpperCase() === tls && parseFloat(columns[columns.length - 1]) > DLS) {
					newAddressescsv.push(`${columns[ipAddressIndex]}:${columns[portIndex]}#${columns[dataCenterIndex]}`);
				}
			}
		} catch (error) { console.error('整理测速结果时出错:', error); }
	}
	return newAddressescsv;
}

async function 生成本地订阅(host, UUID, noTLS, addresses, addressesnotls, newAddressesapi, newAddressescsv, newAddressesnotlsapi, newAddressesnotlscsv, link, env) {
	const all_addresses = [...new Set(addresses.concat(newAddressesapi, newAddressescsv))];
	const all_addresses_notls = [...new Set(addressesnotls.concat(newAddressesnotlsapi, newAddressesnotlscsv))];
	let responseBody = '';
	const httpPorts = ["80", "8080", "8880", "2052", "2082", "2086", "2095"];
	const httpsPorts = ["443", "2053", "2083", "2087", "2096", "8443"];

	const generateLinks = (list, is_tls) => {
		return list.map(addressLine => {
			let address = addressLine, port = is_tls ? '443' : '80', remark = addressLine;
			const match = addressLine.match(/^(.+?)(?::(\d+))?#(.+)$/);
			if (match) {
				[_, address, port, remark] = match;
				port = port || (is_tls ? '443' : '80');
			}
			
			const security = is_tls ? `security=tls&sni=${host}&fp=randomized&alpn=h2,http/1.1` : 'security=none';
			const vlessLink = `vless://${UUID}@${address}:${port}?encryption=none&${security}&type=ws&host=${host}&path=${encodeURIComponent(defaultPath)}#${encodeURIComponent(remark)}`;
			return vlessLink;
		}).join('\n');
	}
	
	responseBody += generateLinks(all_addresses, true);
	if (noTLS === 'true') {
		responseBody += (responseBody ? '\n' : '') + generateLinks(all_addresses_notls, false);
	}
	if (link.length > 0) {
		responseBody += (responseBody ? '\n' : '') + link.join('\n');
	}

	return btoa(responseBody);
}

async function 整理(内容) {
    if (!内容 || typeof 内容 !== 'string') return [];
    return 内容.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
}

async function sendMessage(context, type, ip, add_data = "") {
	const BotToken = context.env.TGTOKEN;
	const ChatID = context.env.TGID;
	if (!BotToken || !ChatID) return;
	try {
		const response = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN`);
		const ipInfo = response.ok ? await response.json() : {};
		const msg = `${type}\nIP: ${ip}\n国家: ${ipInfo.country || 'N/A'}\n<tg-spoiler>城市: ${ipInfo.city || 'N/A'}\n组织: ${ipInfo.org || 'N/A'}\n${add_data}</tg-spoiler>`;
		const url = `https://api.telegram.org/bot${BotToken}/sendMessage?chat_id=${ChatID}&parse_mode=HTML&text=${encodeURIComponent(msg)}`;
		await fetch(url, { method: 'GET' });
	} catch (error) { console.error('sendMessage error:', error); }
}

async function 生成动态UUID(密钥, validTime, updateInterval) {
	const 时区偏移 = 8; 
	const 起始日期 = new Date(2007, 6, 7, updateInterval, 0, 0);
	const 一周的毫秒数 = 1000 * 60 * 60 * 24 * validTime;

	function 获取当前周数() {
		const 现在 = new Date();
		const 调整后的现在 = new Date(现在.getTime() + 时区偏移 * 60 * 60 * 1000);
		return Math.ceil((Number(调整后的现在) - Number(起始日期)) / 一周的毫秒数);
	}

	async function 生成UUID(基础字符串) {
		const 哈希缓冲区 = new TextEncoder().encode(基础字符串);
		const 哈希 = await crypto.subtle.digest('SHA-256', 哈希缓冲区);
		const 十六进制哈希 = [...new Uint8Array(哈希)].map(b => b.toString(16).padStart(2, '0')).join('');
		return `${十六进制哈希.substr(0, 8)}-${十六进制哈希.substr(8, 4)}-4${十六进制哈希.substr(13, 3)}-${((parseInt(十六进制哈希.substr(16, 2), 16) & 0x3f) | 0x80).toString(16)}${十六进制哈希.substr(18, 2)}-${十六进制哈希.substr(20, 12)}`;
	}

	const 当前周数 = 获取当前周数(); 
	const 结束时间 = new Date(起始日期.getTime() + 当前周数 * 一周的毫秒数);
	const 到期时间UTC = new Date(结束时间.getTime() - 时区偏移 * 60 * 60 * 1000);
	const 到期时间字符串 = `到期时间(UTC): ${到期时间UTC.toISOString().slice(0, 19).replace('T', ' ')} (UTC+8): ${结束时间.toISOString().slice(0, 19).replace('T', ' ')}\n`;

	return Promise.all([
		生成UUID(密钥 + 当前周数), 
		生成UUID(密钥 + (当前周数 - 1)),
		到期时间字符串
	]);
}

// --- END OF HELPER FUNCTIONS ---
