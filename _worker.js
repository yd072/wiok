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
	}

	makeReadableStream(earlyDataHeader) {
		return new ReadableStream({
			start: (controller) => this.handleStreamStart(controller, earlyDataHeader),
			pull: (controller) => this.handleStreamPull(controller),
			cancel: (reason) => this.handleStreamCancel(reason)
		});
	}

	handleStreamStart(controller, earlyDataHeader) {
		// 处理消息事件 - 直接使用流处理
		this.webSocket.addEventListener('message', (event) => {
			if (this.readableStreamCancel) return;
			
			// 直接将数据传入控制器，不使用队列
			controller.enqueue(event.data);
		});

		// 处理关闭事件
		this.webSocket.addEventListener('close', () => {
			safeCloseWebSocket(this.webSocket); 
			if (!this.readableStreamCancel) {
				controller.close();
			}
		});

		// 处理错误事件
		this.webSocket.addEventListener('error', (err) => {
			this.log('WebSocket server error');
			controller.error(err);
		});

		// 处理早期数据
		const { earlyData, error } = utils.base64.toArrayBuffer(earlyDataHeader);
		if (error) {
			controller.error(error);
		} else if (earlyData) {
			controller.enqueue(earlyData);
		}
	}
	
	handleStreamPull(controller) {
		// Web Streams API会自动处理背压，这里不需要额外逻辑
	}

	handleStreamCancel(reason) {
		if (this.readableStreamCancel) return;
		this.log(`Readable stream canceled, reason: ${reason}`);
		this.readableStreamCancel = true;
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
				return new Response('请设置你的UUID变量，或尝试重试部署，检查变量是否生效？', {
					status: 404,
					headers: {
						"Content-Type": "text/plain;charset=utf-8",
					}
				});
			}
			const currentDate = new Date();
			currentDate.setHours(0, 0, 0, 0);
			const timestamp = Math.ceil(currentDate.getTime() / 1000);
			const fakeUserIDMD5 = await 双重哈希(`${userID}${timestamp}`);
			const fakeUserID = [
				fakeUserIDMD5.slice(0, 8),
				fakeUserIDMD5.slice(8, 12),
				fakeUserIDMD5.slice(12, 16),
				fakeUserIDMD5.slice(16, 20),
				fakeUserIDMD5.slice(20)
			].join('-');

			const fakeHostName = `${fakeUserIDMD5.slice(6, 9)}.${fakeUserIDMD5.slice(13, 19)}`;

			proxyIP = env.PROXYIP || env.proxyip || proxyIP;
			proxyIPs = await 整理(proxyIP);
			proxyIP = proxyIPs[Math.floor(Math.random() * proxyIPs.length)];

			socks5Address = env.SOCKS5 || socks5Address;
			socks5s = await 整理(socks5Address);
			socks5Address = socks5s[Math.floor(Math.random() * socks5s.length)];
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
					path = `/?ed=2560&proxyip=${url.searchParams.get('proxyip')}`;
					RproxyIP = 'false';
				} else if (url.searchParams.has('socks5')) {
					path = `/?ed=2560&socks5=${url.searchParams.get('socks5')}`;
					RproxyIP = 'false';
				} else if (url.searchParams.has('socks')) {
					path = `/?ed=2560&socks5=${url.searchParams.get('socks')}`;
					RproxyIP = 'false';
				}

				const 路径 = url.pathname.toLowerCase();
				if (路径 == '/') {
					if (env.URL302) return Response.redirect(env.URL302, 302);
					else if (env.URL) return await 代理URL(env.URL, url);
					else return new Response(JSON.stringify(request.cf, null, 4), {
						status: 200,
						headers: {
							'content-type': 'application/json',
						},
					});
				} else if (路径 == `/${fakeUserID}`) {
					const fakeConfig = await 生成配置信息(userID, request.headers.get('Host'), sub, 'CF-Workers-SUB', RproxyIP, url, fakeUserID, fakeHostName, env);
					return new Response(`${fakeConfig}`, { status: 200 });
				} else if (url.pathname == `/${动态UUID}/edit` || 路径 == `/${userID}/edit`) {
					const html = await KV(request, env);
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
					else return new Response('不用怀疑！你UUID就是错的！！！', { status: 404 });
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
    const merged = new Uint8Array(header.length + chunk.length);
    merged.set(header);
    merged.set(chunk, header.length);
    return merged;
}

async function handleDNSQuery(udpChunk, webSocket, 维列斯ResponseHeader, log) {
    try {
        // 只使用Google的备用DNS服务器,更快更稳定
        const dnsServer = '8.8.4.4';
        const dnsPort = 53;
        
        let 维列斯Header = 维列斯ResponseHeader;
        
        const tcpSocket = await connect({
            hostname: dnsServer,
            port: dnsPort
        });

        log(`成功连接到DNS服务器 ${dnsServer}:${dnsPort}`);

        const writer = tcpSocket.writable.getWriter();
        await writer.write(udpChunk);
        writer.releaseLock();

        await tcpSocket.readable.pipeTo(new WritableStream({
            async write(chunk) {
                if (webSocket.readyState === WS_READY_STATE_OPEN) {
                    try {
                        const combinedData = 维列斯Header ? mergeData(维列斯Header, chunk) : chunk;
                        webSocket.send(combinedData);
                        if (维列斯Header) 维列斯Header = null;
                    } catch (error) {
                        console.error(`发送数据时发生错误: ${error.message}`);
                        safeCloseWebSocket(webSocket);
                    }
                }
            },
            close() {
                log(`DNS连接已关闭`);
            },
            abort(reason) {
                console.error(`DNS连接异常中断`, reason);
            }
        }));
    } catch (error) {
        console.error(`DNS查询异常: ${error.message}`, error.stack);
        safeCloseWebSocket(webSocket);
    }
}

async function handleTCPOutBound(remoteSocket, addressType, addressRemote, portRemote, rawClientData, webSocket, 维列斯ResponseHeader, log) {
    async function useSocks5Pattern(address) {
        if (go2Socks5s.includes(atob('YWxsIGlu')) || go2Socks5s.includes(atob('Kg=='))) return true;
        return go2Socks5s.some(pattern => {
            let regexPattern = pattern.replace(/\*/g, '.*');
            let regex = new RegExp(`^${regexPattern}$`, 'i');
            return regex.test(address);
        });
    }

    async function connectAndWrite(address, port, socks = false) {
        log(`正在连接 ${address}:${port}`);
        
        const tcpSocket = await (socks ? 
            await socks5Connect(addressType, address, port, log) :
            connect({ 
                hostname: address,
                port: port,
                allowHalfOpen: false,
                keepAlive: true
            })
        );

        remoteSocket.value = tcpSocket;
        
        const writer = tcpSocket.writable.getWriter();
        await writer.write(rawClientData);
        writer.releaseLock();
        
        return tcpSocket;
    }

    async function retry() {
        try {
            if (enableSocks) {
                tcpSocket = await connectAndWrite(addressRemote, portRemote, true);
            } else {
                if (!proxyIP || proxyIP === '') {
                    proxyIP = atob(`UFJPWFlJUC50cDEuZnh4ay5kZWR5bi5pbw==`);
                } else {
                    const proxyParts = proxyIP.split(':');
                    if (proxyIP.includes(']:')) {
                        [proxyIP, portRemote] = proxyIP.split(']:');
                    } else if (proxyParts.length === 2) {
                        [proxyIP, portRemote] = proxyParts;
                    }
                    if (proxyIP.includes('.tp')) {
                        portRemote = proxyIP.split('.tp')[1].split('.')[0] || portRemote;
                    }
                }
                tcpSocket = await connectAndWrite(proxyIP || addressRemote, portRemote);
            }
            tcpSocket.closed.catch(error => {
                console.log('Retry tcpSocket closed error', error);
            }).finally(() => {
                safeCloseWebSocket(webSocket);
            });
            remoteSocketToWS(tcpSocket, webSocket, 维列斯ResponseHeader, null, log);
        } catch (error) {
            log('Retry error:', error);
        }
    }

    let shouldUseSocks = false;
    if (go2Socks5s.length > 0 && enableSocks) {
        shouldUseSocks = await useSocks5Pattern(addressRemote);
    }
    let tcpSocket = await connectAndWrite(addressRemote, portRemote, shouldUseSocks);
    remoteSocketToWS(tcpSocket, webSocket, 维列斯ResponseHeader, retry, log);
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

// 改进remoteSocketToWS函数，使用更高效的流处理和批量传输
async function remoteSocketToWS(remoteSocket, webSocket, responseHeader, retry, log) {
    let hasIncomingData = false;
    let header = responseHeader;
    
    // 使用TransformStream进行高效的数据处理
    const transformStream = new TransformStream({
        start(controller) {
            // 初始化时不做任何操作
        },
        async transform(chunk, controller) {
            hasIncomingData = true;
            
            if (webSocket.readyState !== WS_READY_STATE_OPEN) {
                controller.error('WebSocket not open');
                return;
            }
            
            // 如果有头部数据，与第一个块合并后发送
            if (header) {
                webSocket.send(await new Blob([header, chunk]).arrayBuffer());
                header = null;
            } else {
                // 直接发送二进制数据，避免不必要的转换
                webSocket.send(chunk);
            }
        },
        flush(controller) {
            log(`Transform stream flush, data received: ${hasIncomingData}`);
        }
    });
    
    try {
        // 使用管道直接连接数据流，减少中间环节
        await remoteSocket.readable
            .pipeThrough(transformStream)
            .pipeTo(new WritableStream({
                write() {
                    // 数据已在transform中处理，这里不需要额外操作
                },
                close() {
                    log(`Remote connection closed, data received: ${hasIncomingData}`);
                    if (!hasIncomingData && retry) {
                        log(`No data received, retrying connection`);
                        retry();
                    }
                },
                abort(reason) {
                    console.error(`Remote connection aborted`, reason);
                    safeCloseWebSocket(webSocket);
                }
            }));
    } catch (error) {
        console.error(`remoteSocketToWS exception`, error);
        safeCloseWebSocket(webSocket);
        
        // 如果没有收到数据且提供了重试函数，则尝试重试
        if (!hasIncomingData && retry) {
            log(`Connection failed, retrying`);
            retry();
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

// 完全重写 socks5Connect 函数，使用更简单可靠的方法
async function socks5Connect(addressType, addressRemote, portRemote, log) {
    try {
        const { username, password, hostname, port } = parsedSocks5Address;
        log(`连接到SOCKS5服务器 ${hostname}:${port}`);
        
        const socket = await connect({ 
            hostname, 
            port,
            allowHalfOpen: false,
            keepAlive: true
        });
        
        // 创建读写器
        const writer = socket.writable.getWriter();
        const reader = socket.readable.getReader();
        
        // 1. 发送握手请求
        log('发送SOCKS5握手');
        await writer.write(new Uint8Array([
            0x05, // SOCKS版本
            0x02, // 认证方法数量
            0x00, // 无认证
            0x02  // 用户名密码认证
        ]));
        
        // 2. 接收握手响应
        const { value: handshakeResponse, done: handshakeDone } = await reader.read();
        if (handshakeDone || !handshakeResponse || handshakeResponse.length < 2) {
            throw new Error('SOCKS5握手失败: 无响应或响应不完整');
        }
        
        if (handshakeResponse[0] !== 0x05) {
            throw new Error(`SOCKS5握手失败: 不支持的版本 ${handshakeResponse[0]}`);
        }
        
        // 3. 处理认证
        if (handshakeResponse[1] === 0x02) {
            // 需要用户名密码认证
            if (!username || !password) {
                throw new Error('SOCKS5需要认证，但未提供用户名或密码');
            }
            
            log('发送SOCKS5认证');
            const usernameBytes = new TextEncoder().encode(username);
            const passwordBytes = new TextEncoder().encode(password);
            
            const authRequest = new Uint8Array(3 + usernameBytes.length + passwordBytes.length);
            authRequest[0] = 0x01; // 认证子版本
            authRequest[1] = usernameBytes.length;
            authRequest.set(usernameBytes, 2);
            authRequest[2 + usernameBytes.length] = passwordBytes.length;
            authRequest.set(passwordBytes, 3 + usernameBytes.length);
            
            await writer.write(authRequest);
            
            // 接收认证响应
            const { value: authResponse, done: authDone } = await reader.read();
            if (authDone || !authResponse || authResponse.length < 2) {
                throw new Error('SOCKS5认证失败: 无响应或响应不完整');
            }
            
            if (authResponse[0] !== 0x01 || authResponse[1] !== 0x00) {
                throw new Error(`SOCKS5认证失败: 状态码 ${authResponse[1]}`);
            }
            
            log('SOCKS5认证成功');
        } else if (handshakeResponse[1] !== 0x00) {
            throw new Error(`SOCKS5握手失败: 不支持的认证方法 ${handshakeResponse[1]}`);
        }
        
        // 4. 发送连接请求
        log(`发送SOCKS5连接请求: ${addressRemote}:${portRemote}`);
        let connectRequest;
        
        switch (addressType) {
            case 1: // IPv4
                const ipv4Parts = addressRemote.split('.').map(Number);
                connectRequest = new Uint8Array([
                    0x05, // SOCKS版本
                    0x01, // 连接命令
                    0x00, // 保留字段
                    0x01, // IPv4地址类型
                    ...ipv4Parts,
                    (portRemote >> 8) & 0xFF, // 端口高字节
                    portRemote & 0xFF        // 端口低字节
                ]);
                break;
                
            case 2: // 域名
                const domainBytes = new TextEncoder().encode(addressRemote);
                connectRequest = new Uint8Array(7 + domainBytes.length);
                connectRequest[0] = 0x05; // SOCKS版本
                connectRequest[1] = 0x01; // 连接命令
                connectRequest[2] = 0x00; // 保留字段
                connectRequest[3] = 0x03; // 域名地址类型
                connectRequest[4] = domainBytes.length; // 域名长度
                connectRequest.set(domainBytes, 5); // 域名
                connectRequest[5 + domainBytes.length] = (portRemote >> 8) & 0xFF; // 端口高字节
                connectRequest[6 + domainBytes.length] = portRemote & 0xFF;       // 端口低字节
                break;
                
            case 3: // IPv6
                // 简化IPv6处理
                const ipv6Bytes = new Uint8Array(16);
                const ipv6Parts = addressRemote.split(':');
                
                // 处理IPv6地址
                let expandedAddress = addressRemote;
                if (expandedAddress.includes('::')) {
                    // 展开双冒号缩写
                    const parts = expandedAddress.split('::');
                    const left = parts[0] ? parts[0].split(':') : [];
                    const right = parts[1] ? parts[1].split(':') : [];
                    const missing = 8 - left.length - right.length;
                    
                    expandedAddress = [
                        ...left,
                        ...Array(missing).fill('0'),
                        ...right
                    ].join(':');
                }
                
                // 解析展开后的地址
                const fullParts = expandedAddress.split(':');
                for (let i = 0; i < 8; i++) {
                    const value = parseInt(fullParts[i] || '0', 16);
                    ipv6Bytes[i * 2] = (value >> 8) & 0xFF;
                    ipv6Bytes[i * 2 + 1] = value & 0xFF;
                }
                
                connectRequest = new Uint8Array([
                    0x05, // SOCKS版本
                    0x01, // 连接命令
                    0x00, // 保留字段
                    0x04, // IPv6地址类型
                    ...ipv6Bytes,
                    (portRemote >> 8) & 0xFF, // 端口高字节
                    portRemote & 0xFF        // 端口低字节
                ]);
                break;
                
            default:
                throw new Error(`不支持的地址类型: ${addressType}`);
        }
        
        await writer.write(connectRequest);
        
        // 5. 接收连接响应
        const { value: connectResponse, done: connectDone } = await reader.read();
        if (connectDone || !connectResponse || connectResponse.length < 2) {
            throw new Error('SOCKS5连接失败: 无响应或响应不完整');
        }
        
        if (connectResponse[0] !== 0x05) {
            throw new Error(`SOCKS5连接失败: 不支持的版本 ${connectResponse[0]}`);
        }
        
        if (connectResponse[1] !== 0x00) {
            const errorMessages = {
                0x01: '一般性失败',
                0x02: '规则集不允许连接',
                0x03: '网络不可达',
                0x04: '主机不可达',
                0x05: '连接被拒绝',
                0x06: 'TTL已过期',
                0x07: '不支持的命令',
                0x08: '不支持的地址类型',
            };
            
            const errorMessage = errorMessages[connectResponse[1]] || `未知错误 ${connectResponse[1]}`;
            throw new Error(`SOCKS5连接失败: ${errorMessage}`);
        }
        
        log('SOCKS5连接成功建立');
        
        // 释放读写器锁
        writer.releaseLock();
        reader.releaseLock();
        
        return socket;
    } catch (error) {
        log(`SOCKS5连接错误: ${error.message}`);
        return null;
    }
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

    const 第一次哈希 = await crypto.subtle.digest('MD5', 编码器.encode(文本));
    const 第一次十六进制 = Array.from(new Uint8Array(第一次哈希))
        .map(字节 => 字节.toString(16).padStart(2, '0'))
        .join('');

    const 第二次哈希 = await crypto.subtle.digest('MD5', 编码器.encode(第一次十六进制.slice(7, 27)));
    const 第二次十六进制 = Array.from(new Uint8Array(第二次哈希))
        .map(字节 => 字节.toString(16).padStart(2, '0'))
        .join('');

    return 第二次十六进制.toLowerCase();
}

async function 代理URL(代理网址, 目标网址) {
    const 网址列表 = await 整理(代理网址);
    const 完整网址 = 网址列表[Math.floor(Math.random() * 网址列表.length)];

    const 解析后的网址 = new URL(完整网址);
    console.log(解析后的网址);

    const 协议 = 解析后的网址.protocol.slice(0, -1) || 'https';
    const 主机名 = 解析后的网址.hostname;
    let 路径名 = 解析后的网址.pathname;
    const 查询参数 = 解析后的网址.search;

    if (路径名.endsWith('/')) {
        路径名 = 路径名.slice(0, -1);
    }
    路径名 += 目标网址.pathname;

    const 新网址 = `${协议}://${主机名}${路径名}${查询参数}`;

    const 响应 = await fetch(新网址);

    const 新响应 = new Response(响应.body, {
        status: 响应.status,
        statusText: 响应.statusText,
        headers: 响应.headers
    });

    新响应.headers.set('X-New-URL', 新网址);

    return 新响应;
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
	
	// 添加 Clash for Android 配置
	const CFA配置 = `
port: 7890
socks-port: 7891
allow-lan: true
mode: Rule
log-level: info
external-controller: 127.0.0.1:9090
proxies:
  - name: ${encodeURIComponent(FileName)}_SS
    type: ss
    server: ${地址}
    port: ${端口}
    cipher: aes-128-gcm
    password: ${用户ID}
    udp: true
    plugin: v2ray-plugin
    plugin-opts:
      mode: websocket
      tls: ${传输层安全[1]}
      skip-cert-verify: true
      host: ${伪装域名}
      path: "${路径}"
      mux: true
  - name: ${encodeURIComponent(FileName)}_Trojan
    type: trojan
    server: ${地址}
    port: ${端口}
    password: ${用户ID}
    udp: true
    sni: ${伪装域名}
    skip-cert-verify: true
    network: ws
    ws-opts:
      path: "${路径}"
      headers:
        Host: ${伪装域名}
proxy-groups:
  - name: 🚀 节点选择
    type: select
    proxies:
      - ${encodeURIComponent(FileName)}_SS
      - ${encodeURIComponent(FileName)}_Trojan
      - DIRECT
  - name: 🌍 国外媒体
    type: select
    proxies:
      - 🚀 节点选择
      - DIRECT
  - name: 📲 电报信息
    type: select
    proxies:
      - 🚀 节点选择
      - DIRECT
  - name: 🎯 全球直连
    type: select
    proxies:
      - DIRECT
      - 🚀 节点选择
rules:
  - DOMAIN-SUFFIX,google.com,🚀 节点选择
  - DOMAIN-KEYWORD,google,🚀 节点选择
  - DOMAIN-SUFFIX,ad.com,REJECT
  - DOMAIN-SUFFIX,qq.com,🎯 全球直连
  - DOMAIN-SUFFIX,baidu.com,🎯 全球直连
  - DOMAIN-KEYWORD,telegram,📲 电报信息
  - MATCH,🚀 节点选择
`;

	return [威图瑞, 猫猫猫, CFA配置];
}

// 添加整理函数的定义
async function 整理(文本) {
    if (!文本 || 文本 === '') return [];
    
    // 处理可能的数组格式
    if (文本.startsWith('[') && 文本.endsWith(']')) {
        try {
            return JSON.parse(文本);
        } catch (e) {
            // 如果解析失败，继续使用下面的方法处理
        }
    }
    
    // 处理多行文本
    return 文本.split(/[,\n]/)
        .map(item => item.trim())
        .filter(item => item !== '');
}
