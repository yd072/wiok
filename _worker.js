/**
 * =================================================================================
 * Yamux Multiplexing Library (Bundled & Inlined for Cloudflare Workers)
 *
 * This code is a self-contained, worker-compatible version of a Yamux implementation.
 * It is included here directly to make the script deployable as a single file.
 * Based on @chainsafe/yamux.
 * =================================================================================
 */
const yamux = (() => {
	const AbortError = (function() {
		try {
			return new DOMException("", "AbortError")
		} catch (t) {
			try {
				return function() {
					const t = new Error("Aborted");
					return t.name = "AbortError", t
				}()
			} catch (t) {
				return function() {
					const t = new Error("The operation was aborted");
					return t.code = 20, t.name = "AbortError", t
				}()
			}
		}
	})().constructor;

	function writeUvarint(t, e) {
		const i = [];
		for (; e >= 128;) i.push(127 & e | 128), e >>= 7;
		return i.push(e), t.push(...i), i.length
	}
	class Reader {
		constructor() {
			this.buf = new Uint8Array(0), this.pos = 0
		}
		read(t) {
			return this.check(t), this.buf.subarray(this.pos, this.pos += t)
		}
		readUvarint() {
			let t = 0,
				e = 0;
			for (let i = 0; i < 10; i += 1) {
				this.check(1);
				const s = this.buf[this.pos];
				if (this.pos += 1, t |= (127 & s) << e, e += 7, !(128 & s)) return t;
				if (i > 8) throw new Error("varint too long")
			}
			throw new Error("varint too long")
		}
		check(t) {
			if (this.pos + t > this.buf.byteLength) throw new Error("unexpected EOF")
		}
		append(t) {
			const e = new Uint8Array(this.buf.byteLength - this.pos + t.byteLength);
			e.set(this.buf.subarray(this.pos)), e.set(t, this.buf.byteLength - this.pos), this.buf = e, this.pos = 0
		}
	}
	var MessageType;
	! function(t) {
		t[t.Data = 0] = "Data", t[t.WindowUpdate = 1] = "WindowUpdate", t[t.Ping = 2] = "Ping", t[t.GoAway = 3] = "GoAway"
	}(MessageType || (MessageType = {}));
	var Flag;
	! function(t) {
		t[t.SYN = 1] = "SYN", t[t[2] = "ACK"] = "ACK", t[t.FIN = 4] = "FIN", t[t.RST = 8] = "RST"
	}(Flag || (Flag = {}));
	class Header {
		constructor(t, e, i, s) {
			this.type = t, this.flags = e, this.streamId = i, this.length = s
		}
		static decode(t) {
			t.check(12);
			const e = t.read(12);
			if (1 !== e[0]) throw new Error("invalid version");
			return new Header(e[1], e[2] << 8 | e[3], e[4] << 24 | e[5] << 16 | e[6] << 8 | e[7], e[8] << 24 | e[9] << 16 | e[10] << 8 | e[11])
		}
		encode() {
			const t = [1, this.type, this.flags >> 8, 255 & this.flags, this.streamId >> 24, 255 & this.streamId >> 16, 255 & this.streamId >> 8, 255 & this.streamId, this.length >> 24, 255 & this.length >> 16, 255 & this.length >> 8, 255 & this.length];
			return Uint8Array.from(t)
		}
	}
	var GoAwayCode;
	! function(t) {
		t[t.Normal = 0] = "Normal", t[t.ProtocolError = 1] = "ProtocolError", t[t.InternalError = 2] = "InternalError"
	}(GoAwayCode || (GoAwayCode = {}));
	const PROTO_ERR_EOF = new Error("unexpected EOF"),
		PROTO_ERR_INVALID_VERSION = new Error("invalid version"),
		PROTO_ERR_STREAM_ID_ZERO = new Error("stream id cannot be zero"),
		PROTO_ERR_DATA_EXCEEDS_WINDOW = new Error("data size exceeds window"),
		PROTO_ERR_INVALID_PING_STREAM = new Error("ping can only be on stream 0"),
		PROTO_ERR_PING_BAD_PAYLOAD = new Error("ping payload must be 8 bytes"),
		PROTO_ERR_GOAWAY_STREAM_ID = new Error("go away can only be on stream 0"),
		PROTO_ERR_GOAWAY_BAD_PAYLOAD = new Error("go away payload must be 4 bytes"),
		PROTO_ERR_WINDOW_UPDATE_STREAM_ID_ZERO = new Error("window update cannot be on stream 0"),
		PROTO_ERR_WINDOW_UPDATE_BAD_PAYLOAD = new Error("window update payload must be 4 bytes"),
		PROTO_ERR_STREAM_CLOSED = new Error("stream is closed"),
		PROTO_ERR_SESSION_CLOSED = new Error("session is closed"),
		PROTO_ERR_PING_TIMEOUT = new Error("ping timeout");

	function p(t, e) {
		const i = new AbortController;
		let s;
		return e.aborted ? Promise.reject(new AbortError) : (s = setTimeout((() => {
			i.abort(t)
		}), t), {
			signal: i.signal,
			cancel: () => clearTimeout(s)
		})
	}
	const defaultLogger = {
		trace: () => {},
		debug: () => {},
		error: console.error
	};
	class Stream {
		constructor(t) {
			this.readController = null, this.writeController = null, this.id = t.id, this.session = t.session, this.recvWindow = t.acceptInitialWindowSize, this.sendWindow = t.sendInitialWindowSize, this.sendWindowUpdated = new Promise((t => {
				this.sendWindowUpdatedRes = t
			})), this.logger = t.logger;
			const e = new TransformStream;
			this.readable = e.readable;
			const i = new TransformStream;
			this.writable = i.writable, Promise.all([e.writable.getWriter(), i.readable.getReader()]).then((([t, e]) => {
				this.readController = t, this.writeController = e, this.handleWrites()
			}))
		}
		get state() {
			if (this.readController && this.writeController) return "open";
			if (this.readController && !this.writeController) return "closing";
			if (!this.readController && this.writeController) return "remote closed";
			if (this.isRst) return "rst";
			return "closed"
		}
		async handleWrites() {
			for (;;) try {
				const {
					value: t,
					done: e
				} = await this.writeController.read();
				if (e) return void this.session.fin(this);
				const i = t.length;
				if (i > 0) {
					let t = 0;
					for (; t < i;) {
						let e = this.sendWindow;
						for (; 0 === e;) await this.sendWindowUpdated, e = this.sendWindow;
						this.sendWindowUpdated = new Promise((t => {
							this.sendWindowUpdatedRes = t
						}));
						const s = Math.min(i - t, e),
							n = t + s;
						this.session.data(this.id, t.subarray(t, n)), this.sendWindow -= s, t = n
					}
				}
			} catch (t) {
				return
			}
		}
		close() {
			this.writeController.releaseLock(), this.writable.close(), this.logger.trace("Closing stream", {
				stream: this.id
			})
		}
		abort(t) {
			this.readController.abort(t), this.writable.abort(t), this.session.rst(this)
		}
		onData(t) {
			this.recvWindow -= t.length, this.logger.trace("Receiving data", {
				stream: this.id,
				size: t.length
			}), this.readController.write(t)
		}
		onFin() {
			this.readController.close(), this.logger.trace("Remote finished stream", {
				stream: this.id
			})
		}
		onRst() {
			this.isRst = !0, this.logger.trace("Remote reset stream", {
				stream: this.id
			}), this.readController.abort(PROTO_ERR_STREAM_CLOSED)
		}
		onWindowUpdate(t) {
			this.sendWindow += t, this.sendWindowUpdatedRes(), this.logger.trace("Updating send window", {
				stream: this.id,
				size: t,
				window: this.sendWindow
			})
		}
	}
	class Session {
		constructor(t) {
			this.pingId = 0, this.pingTimer = null, this.pings = new Map, this.streams = new Map, this.isClient = t.isClient, this.idCounter = this.isClient ? 1 : 2, this.streamMuxer = t.streamMuxer, this.config = t.config, this.logger = this.config.logger || defaultLogger
		}
		async start() {
			try {
				if (this.pingTimer = setInterval((() => this.doPing()), this.config.keepAliveIntervalMs), !this.streamMuxer.writable) throw new Error("stream muxer is not writable");
				this.writer = this.streamMuxer.writable.getWriter()
			} catch (t) {
				this.logger.error("failed to get writer", t), this.close(GoAwayCode.InternalError)
			}
			try {
				if (!this.streamMuxer.readable) throw new Error("stream muxer is not readable");
				const t = new Reader;
				for await (const e of this.streamMuxer.readable)
					if (t.append(e), !(await this.readLoop(t))) break
			} catch (t) {
				t instanceof AbortError ? this.logger.trace("connection aborted") : (this.logger.error("error in read loop", t), this.close(GoAwayCode.ProtocolError))
			}
		}
		async readLoop(t) {
			let e = !1,
				i = 0;
			for (;;) {
				const s = t.pos;
				try {
					const s = Header.decode(t),
						n = t.read(s.length);
					e = !1, i = 0, this.logger.trace("read header", s), await this.handle(s, n)
				} catch (n) {
					if (this.logger.trace("read failed", n), "unexpected EOF" === n.message) {
						if (e) {
							const t = Math.floor(2e3 * Math.random()) + 500;
							await new Promise((e => setTimeout(e, t))), i += t
						}
						return t.pos = s, !0
					}
					return this.logger.error("unrecoverable read error", n), this.close(GoAwayCode.ProtocolError), !1
				}
			}
		}
		async handle(t, e) {
			switch (t.type) {
				case MessageType.Data:
					return this.handleData(t, e);
				case MessageType.WindowUpdate:
					return this.handleWindowUpdate(t, e);
				case MessageType.Ping:
					return this.handlePing(t, e);
				case MessageType.GoAway:
					return this.handleGoAway(t, e)
			}
		}
		handleData(t, e) {
			const {
				flags: i,
				streamId: s,
				length: n
			} = t;
			if (n > this.config.receiveConnectionWindowSize) return this.close(GoAwayCode.ProtocolError);
			if (i & Flag.SYN) {
				if (this.isClient && 0 == (1 & s) || !this.isClient && 1 == (1 & s)) {
					const t = this.openStream(s);
					t.onData(e), i & Flag.FIN && t.onFin(), i & Flag.RST && t.onRst()
				} else this.close(GoAwayCode.ProtocolError)
			} else {
				const t = this.streams.get(s);
				t ? (t.onData(e), i & Flag.FIN && t.onFin(), i & Flag.RST && t.onRst()) : this.logger.debug(`ignoring data for unknown stream ${s}`)
			}
		}
		handleWindowUpdate(t, e) {
			const {
				flags: i,
				streamId: s,
				length: n
			} = t;
			if (0 === s || n !== (new DataView(e.buffer, e.byteOffset, e.byteLength)).getUint32(0, !1)) return this.close(GoAwayCode.ProtocolError);
			const r = this.streams.get(s);
			r ? (r.onWindowUpdate(n), i & Flag.RST && r.onRst()) : this.logger.debug(`ignoring window update for unknown stream ${s}`)
		}
		handlePing(t, e) {
			const {
				flags: i,
				streamId: s,
				length: n
			} = t;
			if (0 !== s) return this.close(GoAwayCode.ProtocolError);
			const r = (new DataView(e.buffer, e.byteOffset, e.byteLength)).getUint32(0, !1);
			i & Flag.SYN ? this.write(new Header(MessageType.Ping, Flag.ACK, 0, n), e) : this.pings.has(r) && (this.pings.get(r).resolve(performance.now()), this.pings.delete(r))
		}
		handleGoAway(t, e) {
			const {
				length: i
			} = t, s = (new DataView(e.buffer, e.byteOffset, e.byteLength)).getUint32(0, !1);
			this.close(s, !1)
		}
		newStream() {
			if (this.idCounter > 2147483647) throw new Error("max stream id reached");
			const t = this.openStream(this.idCounter);
			return this.idCounter += 2, t
		}
		openStream(t) {
			this.logger.trace("Opening stream", {
				stream: t
			});
			const e = new Stream({
				id: t,
				session: this,
				sendInitialWindowSize: this.config.sendInitialWindowSize,
				acceptInitialWindowSize: this.config.receiveInitialWindowSize,
				logger: this.logger
			});
			return this.streams.set(t, e), this.streamMuxer.onStream(e), e
		}
		close(t = GoAwayCode.Normal, e = !0) {
			if (this.isClosed) return;
			if (this.isClosing) return;
			if (this.isClosing = !0, e) {
				this.logger.trace("Closing session with code", t);
				const e = new Uint8Array(4);
				(new DataView(e.buffer, e.byteOffset, e.byteLength)).setUint32(0, t, !1), this.write(new Header(MessageType.GoAway, 0, 0, 4), e)
			}
			this.writer.close(), this.isClosed = !0, clearInterval(this.pingTimer), this.pingTimer = null;
			for (const t of this.pings.values()) t.reject(PROTO_ERR_SESSION_CLOSED);
			this.pings.clear();
			for (const t of this.streams.values()) t.abort(PROTO_ERR_SESSION_CLOSED);
			this.streams.clear(), this.streamMuxer.close()
		}
		async doPing() {
			if (this.isClosed || this.isClosing) return;
			const t = this.pingId++;
			let e, i;
			const s = new Promise(((s, n) => {
				e = s, i = n
			}));
			this.pings.set(t, {
				resolve: e,
				reject: i,
				time: performance.now()
			});
			const n = new Uint8Array(8);
			(new DataView(n.buffer, n.byteOffset, n.byteLength)).setUint32(0, t, !1), (new DataView(n.buffer, n.byteOffset, n.byteLength)).setUint32(4, 0, !1), this.write(new Header(MessageType.Ping, Flag.SYN, 0, 8), n);
			const {
				signal: r,
				cancel: o
			} = p(this.config.pingTimeoutMs, this.streamMuxer.closeController.signal);
			try {
				await Promise.race([s, new Promise(((t, e) => {
					r.addEventListener("abort", (() => e(PROTO_ERR_PING_TIMEOUT)), {
						once: !0
					})
				}))])
			} catch (t) {
				this.logger.error("ping timeout", t), this.pings.delete(t)
			} finally {
				o()
			}
		}
		data(t, e) {
			this.write(new Header(MessageType.Data, 0, t, e.length), e)
		}
		fin(t) {
			this.logger.trace("Sending fin", {
				stream: t.id
			}), this.write(new Header(MessageType.Data, Flag.FIN, t.id, 0))
		}
		rst(t) {
			this.logger.trace("Sending rst", {
				stream: t.id
			}), this.write(new Header(MessageType.Data, Flag.RST, t.id, 0))
		}
		windowUpdate(t, e) {
			this.write(new Header(MessageType.WindowUpdate, 0, t, e))
		}
		async write(t, e) {
			if (!this.writer) throw new Error("no writer");
			const i = t.encode();
			try {
				if (await this.writer.write(i), e) {
					await this.writer.write(e)
				}
			} catch (t) {
				this.logger.error("failed to write to connection", t), this.close(GoAwayCode.InternalError)
			}
		}
	}
	const defaultConfig = {
		keepAliveIntervalMs: 3e4,
		pingTimeoutMs: 1e4,
		sendInitialWindowSize: 262144,
		receiveInitialWindowSize: 262144,
		receiveConnectionWindowSize: 15728640
	};
	class Yamux {
		constructor(t, e, i, s) {
			this.streams = [], this.isClosed = !1, this.transport = e, this.config = { ...defaultConfig,
				...i
			}, this.logger = this.config.logger || defaultLogger, this.closeController = new AbortController;
			const n = this.closeController.signal;
			if (n.aborted) throw new AbortError;
			n.addEventListener("abort", (() => this.close()), {
				once: !0
			});
			const r = this,
				o = {
					onStream: t => {
						this.streams.push(t), this.onStream && this.onStream(t)
					},
					close: () => {
						this.close()
					},
					closeController: this.closeController,
					readable: this.transport.readable,
					writable: this.transport.writable,
					get logger() {
						return r.logger
					}
				};
			this.session = new Session({
				isClient: t,
				streamMuxer: o,
				config: this.config,
				logger: this.logger
			}), this.session.start()
		}
		newStream() {
			return this.session.newStream()
		}
		close() {
			this.isClosed || (this.isClosed = !0, this.closeController.abort())
		}
		get state() {
			if (this.isClosed) return "closed";
			return "open"
		}
	}
	class Connection {
		constructor(t, e) {
			this.muxer = e, this.transport = t
		}
		newStream() {
			return this.muxer.newStream()
		}
		close() {
			this.muxer.close()
		}
		get streams() {
			return this.muxer.streams
		}
		get state() {
			return this.muxer.state
		}
	}
	return {
		// Public API
		Session: Yamux,
	};
})();
/**
 * =================================================================================
 * End of Inlined Yamux Library
 * =================================================================================
 */


import {
	connect
} from 'cloudflare:sockets';

// --- 全局配置缓存 ---
let cachedSettings = null;

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
// --- HTTP 代理相关变量 ---
let httpProxyAddress = '';
let parsedHttpProxyAddress = {};
let enableHttpProxy = false;

let noTLS = 'false';
const expire = -1;
let proxyIPs = [];
let socks5s = [];
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
let BotToken = '';
let ChatID = '';
let proxyhosts = [];
let proxyhostsURL = '';
let RproxyIP = 'false';
let httpsPorts = ["443", "2053", "2083", "2087", "2096", "8443"];
let httpPorts = ["80", "8080", "8880", "2052", "2082", "2086", "2095"];
let 有效时间 = 7;
let 更新时间 = 3;
let userIDLow;
let userIDTime = "";
let proxyIPPool = [];
let path = '/?ed=2560';
let 动态UUID = null;
let link = [];
let banHosts = [atob('c3BlZWQuY2xvdWRmbGFyZS5jb20=')];
let DNS64Server = '';

/**
 * 辅助工具函数
 */
const utils = {
	isValidUUID(uuid) {
		const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		return uuidPattern.test(uuid);
	},
	base64: {
		toArrayBuffer(base64Str) {
			if (!base64Str) return {
				earlyData: undefined,
				error: null
			};
			try {
				base64Str = base64Str.replace(/-/g, '+').replace(/_/g, '/');
				const decoded = atob(base64Str);
				const arrayBuffer = Uint8Array.from(decoded, c => c.charCodeAt(0));
				return {
					earlyData: arrayBuffer.buffer,
					error: null
				};
			} catch (error) {
				return {
					earlyData: undefined,
					error
				};
			}
		}
	},
};

/**
 * 集中加载所有配置，严格执行 KV > 环境变量 > 默认值的优先级
 * @param {any} env
 */
async function loadConfigurations(env) {
	// 1. 检查内存缓存
	if (cachedSettings) {
		return; // 缓存命中，直接返回
	}

	// 2. 从环境变量加载，如果存在则覆盖默认值
	if (env.UUID || env.uuid || env.PASSWORD || env.pswd) userID = env.UUID || env.uuid || env.PASSWORD || env.pswd;
	if (env.PROXYIP || env.proxyip) proxyIP = env.PROXYIP || env.proxyip;
	if (env.SOCKS5) socks5Address = env.SOCKS5;
	if (env.HTTP) httpProxyAddress = env.HTTP;
	if (env.SUBAPI) subConverter = atob(env.SUBAPI);
	if (env.SUBCONFIG) subConfig = atob(env.SUBCONFIG);
	if (env.SUBNAME) FileName = atob(env.SUBNAME);
	if (env.DNS64 || env.NAT64) DNS64Server = env.DNS64 || env.NAT64;

	if (env.ADD) addresses = await 整理(env.ADD);
	if (env.ADDAPI) addressesapi = await 整理(env.ADDAPI);
	if (env.ADDNOTLS) addressesnotls = await 整理(env.ADDNOTLS);
	if (env.ADDNOTLSAPI) addressesnotlsapi = await 整理(env.ADDNOTLSAPI);
	if (env.ADDCSV) addressescsv = await 整理(env.ADDCSV);
	if (env.LINK) link = await 整理(env.LINK);
	if (env.GO2SOCKS5) go2Socks5s = await 整理(env.GO2SOCKS5);
	if (env.BAN) banHosts = (await 整理(env.BAN)).map(h => atob(h));

	if (env.DLS) DLS = Number(env.DLS);
	if (env.CSVREMARK) remarkIndex = Number(env.CSVREMARK);
	if (env.TGTOKEN) BotToken = env.TGTOKEN;
	if (env.TGID) ChatID = env.TGID;
	if (env.SUBEMOJI || env.EMOJI) subEmoji = env.SUBEMOJI || env.EMOJI;

	// 3. 如果存在 KV，则使用 KV 的值覆盖所有之前的值
	if (env.KV) {
		try {
			const advancedSettingsJSON = await env.KV.get('settinggs.txt');
			if (advancedSettingsJSON) {
				const settings = JSON.parse(advancedSettingsJSON);

				// 将新配置存入内存缓存
				cachedSettings = settings;

				// 使用KV中的配置覆盖当前变量
				if (settings.proxyip && settings.proxyip.trim()) proxyIP = settings.proxyip;
				if (settings.socks5 && settings.socks5.trim()) socks5Address = settings.socks5.split('\n')[0].trim();
				if (settings.httpproxy && settings.httpproxy.trim()) httpProxyAddress = settings.httpproxy.split('\n')[0].trim();
				if (settings.sub && settings.sub.trim()) env.SUB = settings.sub.trim().split('\n')[0];
				if (settings.subapi && settings.subapi.trim()) subConverter = settings.subapi.trim().split('\n')[0];
				if (settings.subconfig && settings.subconfig.trim()) subConfig = settings.subconfig.trim().split('\n')[0];
				if (settings.nat64 && settings.nat64.trim()) DNS64Server = settings.nat64.trim().split('\n')[0];
				if (settings.httpsports && settings.httpsports.trim()) {
					httpsPorts = await 整理(settings.httpsports);
				}
				if (settings.httpports && settings.httpports.trim()) {
					httpPorts = await 整理(settings.httpports);
				}
				if (settings.notls) {
					noTLS = settings.notls;
				}
				if (settings.ADD) {
					const 优选地址数组 = await 整理(settings.ADD);
					const 分类地址 = {
						接口地址: new Set(),
						链接地址: new Set(),
						优选地址: new Set()
					};
					for (const 元素 of 优选地址数组) {
						if (元素.startsWith('https://')) 分类地址.接口地址.add(元素);
						else if (元素.includes('://')) 分类地址.链接地址.add(元素);
						else 分类地址.优选地址.add(元素);
					}
					addressesapi = [...分类地址.接口地址];
					link = [...分类地址.链接地址];
					addresses = [...分类地址.优选地址];
				}
			}
		} catch (e) {
			console.error("从KV加载配置时出错: ", e);
		}
	}

	// 4. 最终处理
	if (subConverter.includes("http://")) {
		subConverter = subConverter.split("//")[1];
		subProtocol = 'http';
	} else {
		subConverter = subConverter.split("//")[1] || subConverter;
	}

	proxyIPs = await 整理(proxyIP);
	proxyIP = proxyIPs.length > 0 ? proxyIPs[Math.floor(Math.random() * proxyIPs.length)] : '';

	socks5s = await 整理(socks5Address);
	socks5Address = socks5s.length > 0 ? socks5s[Math.floor(Math.random() * socks5s.length)] : '';
	socks5Address = socks5Address.split('//')[1] || socks5Address;

	if (httpProxyAddress) {
		try {
			parsedHttpProxyAddress = httpProxyAddressParser(httpProxyAddress);
			enableHttpProxy = true;
		} catch (err) {
			console.log(`解析HTTP代理地址时出错: ${err.toString()}`);
			enableHttpProxy = false;
		}
	}
}


/**
 * 解析 PROXYIP 字符串，提取地址和端口
 * @param {string} proxyString
 * @param {number} defaultPort
 * @returns {{address: string, port: number}}
 */
function parseProxyIP(proxyString, defaultPort) {
	let port = defaultPort;
	let address = proxyString;

	if (address.includes(']:')) {
		[address, port] = address.split(']:');
		address += ']';
	} else if (address.includes(':')) {
		[address, port] = address.split(':');
	}

	if (address.includes('.tp')) {
		port = address.split('.tp')[1].split('.')[0] || port;
	}

	return {
		address: address.toLowerCase(),
		port: Number(port)
	};
}


// =================================================================
//  服务状态页 (Status Page)
// =================================================================
async function statusPage() {
	const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Service Status</title>
        <link rel="icon" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI0ZGRiI+PHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik05IDE2LjE3TDQuODMgMTJsLTEuNDIgMS40MUw5IDE5IDIxIDdsLTEuNDEtMS40MXoiIGZpbGw9IiMyZGNlODkiLz48L3N2Zz4=">
        <style>
            :root {
                --bg-color: #f4f7f9;
                --card-bg-color: #ffffff;
                --text-color: #333;
                --primary-color: #0d6efd;
                --secondary-color: #8898aa;
                --border-color: #e9ecef;
                --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            body {
                margin: 0;
                font-family: var(--font-family);
                background-color: var(--bg-color);
                color: var(--text-color);
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                padding: 20px;
                box-sizing: border-box;
            }
            .container {
                max-width: 800px;
                width: 100%;
                background-color: var(--card-bg-color);
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                padding: 40px;
                box-sizing: border-box;
            }
            .header {
                border-bottom: 1px solid var(--border-color);
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .header h1 {
                margin: 0;
                font-size: 24px;
            }
            .header .all-systems-operational {
                color: var(--primary-color);
                font-size: 18px;
                font-weight: 600;
                margin-top: 10px;
            }
            .service-group h2 {
                font-size: 18px;
                color: var(--text-color);
                margin-bottom: 15px;
            }
            .service-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 0;
                border-bottom: 1px solid var(--border-color);
            }
            .service-item:last-child {
                border-bottom: none;
            }
            .service-name {
                font-size: 16px;
            }
            .service-status {
                font-size: 16px;
                font-weight: 600;
                color: var(--primary-color);
            }
            .footer {
                margin-top: 30px;
                text-align: center;
                font-size: 14px;
                color: var(--secondary-color);
            }
            .footer a {
                color: var(--secondary-color);
                text-decoration: none;
            }
            .footer a:hover {
                text-decoration: underline;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Service Status</h1>
                <div class="all-systems-operational">✔ All Systems Operational</div>
            </div>

            <div class="service-group">
                <h2>Backend Infrastructure</h2>
                <div class="service-item">
                    <span class="service-name">API Gateway</span>
                    <span class="service-status">Operational</span>
                </div>
                <div class="service-item">
                    <span class="service-name">Authentication Service</span>
                    <span class="service-status">Operational</span>
                </div>
                 <div class="service-item">
                    <span class="service-name">Storage Cluster</span>
                    <span class="service-status">Operational</span>
                </div>
            </div>

            <div class="service-group" style="margin-top: 30px;">
                <h2>Real-time Data Services</h2>
                <div class="service-item">
                    <span class="service-name">WebSocket Push Service</span>
                    <span class="service-status">Operational</span>
                </div>
                <div class="service-item">
                    <span class="service-name">Real-time Data Pipeline</span>
                    <span class="service-status">Operational</span>
                </div>
            </div>

            <div class="footer">
                <p>
                    Last Updated:
                    <span id="date-container"></span>
                    <span id="time-container" class="notranslate"></span>
                </p>
                <a href="#" target="_blank" rel="noopener noreferrer">Powered by EdgeTunnel</a>
            </div>
        </div>
        <script>
            let lastDate = '';
            function updateTimestamp() {
                const now = new Date();
                const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
                const currentDate = now.toLocaleDateString('en-US', dateOptions);
                if (currentDate !== lastDate) {
                    document.getElementById('date-container').textContent = currentDate;
                    lastDate = currentDate;
                }
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                const currentTimeString = ' ' + hours + ':' + minutes + ':' + seconds;
                document.getElementById('time-container').textContent = currentTimeString;
            }
            setInterval(updateTimestamp, 1000);
            updateTimestamp();
        </script>
    </body>
    </html>
    `;
	return new Response(html, {
		status: 200,
		headers: {
			'Content-Type': 'text/html; charset=utf-8'
		},
	});
}

async function resolveToIPv6(target) {
	// 检查是否为IPv4
	function isIPv4(str) {
		const parts = str.split('.');
		return parts.length === 4 && parts.every(part => {
			const num = parseInt(part, 10);
			return num >= 0 && num <= 255 && part === num.toString();
		});
	}

	// 检查是否为IPv6
	function isIPv6(str) {
		return str.includes(':') && /^[0-9a-fA-F:]+$/.test(str);
	}

	// 获取域名的IPv4地址
	async function fetchIPv4(domain) {
		const url = `https://cloudflare-dns.com/dns-query?name=${domain}&type=A`;
		const response = await fetch(url, {
			headers: {
				'Accept': 'application/dns-json'
			}
		});

		if (!response.ok) throw new Error('DNS查询失败');

		const data = await response.json();
		const ipv4s = (data.Answer || [])
			.filter(record => record.type === 1)
			.map(record => record.data);

		if (ipv4s.length === 0) throw new Error('未找到IPv4地址');
		return ipv4s[Math.floor(Math.random() * ipv4s.length)];
	}

	// 查询NAT64 IPv6地址
	async function queryNAT64(domain) {
		const socket = connect({
			hostname: isIPv6(DNS64Server) ? `[${DNS64Server}]` : DNS64Server,
			port: 53
		});

		const writer = socket.writable.getWriter();
		const reader = socket.readable.getReader();

		try {
			// 发送DNS查询
			const query = buildDNSQuery(domain);
			const queryWithLength = new Uint8Array(query.length + 2);
			queryWithLength[0] = query.length >> 8;
			queryWithLength[1] = query.length & 0xFF;
			queryWithLength.set(query, 2);
			await writer.write(queryWithLength);

			// 读取响应
			const response = await readDNSResponse(reader);
			const ipv6s = parseIPv6(response);

			if (ipv6s.length > 0) {
				return ipv6s[0];
			} else {
				throw new Error('No IPv6 address found in DNS response from NAT64 server');
			}
		} finally {
			await writer.close();
			await reader.cancel();
		}
	}

	// 构建DNS查询包
	function buildDNSQuery(domain) {
		const buffer = new ArrayBuffer(512);
		const view = new DataView(buffer);
		let offset = 0;
		view.setUint16(offset, Math.floor(Math.random() * 65536));
		offset += 2;
		view.setUint16(offset, 0x0100);
		offset += 2;
		view.setUint16(offset, 1);
		offset += 2;
		view.setUint16(offset, 0);
		offset += 6;
		// 域名编码
		for (const label of domain.split('.')) {
			view.setUint8(offset++, label.length);
			for (let i = 0; i < label.length; i++) {
				view.setUint8(offset++, label.charCodeAt(i));
			}
		}
		view.setUint8(offset++, 0);
		// 查询类型和类
		view.setUint16(offset, 28);
		offset += 2; // AAAA记录
		view.setUint16(offset, 1);
		offset += 2; // IN类

		return new Uint8Array(buffer, 0, offset);
	}

	// 读取DNS响应
	async function readDNSResponse(reader) {
		const chunks = [];
		let totalLength = 0;
		let expectedLength = null;
		while (true) {
			const {
				value,
				done
			} = await reader.read();
			if (done) break;
			chunks.push(value);
			totalLength += value.length;
			if (expectedLength === null && totalLength >= 2) {
				expectedLength = (chunks[0][0] << 8) | chunks[0][1];
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

	// 解析IPv6地址
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
			const type = view.getUint16(offset);
			offset += 2;
			offset += 6;
			const dataLength = view.getUint16(offset);
			offset += 2;
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
		return DNS64Server.split('/96')[0] + hex[0] + hex[1] + ":" + hex[2] + hex[3];
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

export default {
	async fetch(request, env, ctx) {
		try {
			// 1. 统一加载所有配置 (此函数现在使用内存缓存)
			await loadConfigurations(env);

			// 2. 处理动态 UUID
			const UA = request.headers.get('User-Agent') || 'null';
			const userAgent = UA.toLowerCase();
			if (env.KEY || env.TOKEN || (userID && !utils.isValidUUID(userID))) {
				动态UUID = env.KEY || env.TOKEN || userID;
				有效时间 = Number(env.TIME) || 有效时间;
				更新时间 = Number(env.UPTIME) || 更新时间;
				const userIDs = await 生成动态UUID(动态UUID);
				userID = userIDs[0];
				userIDLow = userIDs[1];
				userIDTime = userIDs[2];
			}

			// 3. 检查 UUID 是否有效，若无效则显示新的伪装页面
			if (!userID) {
				return await statusPage();
			}

			// 4. 生成伪装信息
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

			// 5. 处理 SOCKS5
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

			// 6. 根据请求类型（WebSocket 或 HTTP）进行路由
			const upgradeHeader = request.headers.get('Upgrade');
			const url = new URL(request.url);
			if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
				// HTTP 请求处理
				let sub = env.SUB || '';
				if (url.searchParams.has('sub') && url.searchParams.get('sub') !== '') sub = url.searchParams.get('sub').toLowerCase();
				if (url.searchParams.has('notls')) noTLS = 'true';

				if (url.searchParams.has('proxyip')) {
					path = `/?proxyip=${url.searchParams.get('proxyip')}`;
					RproxyIP = 'false';
				} else if (url.searchParams.has('socks5') || url.searchParams.has('socks')) {
					path = `/?socks5=${url.searchParams.get('socks5') || url.searchParams.get('socks')}`;
					RproxyIP = 'false';
				}

				const 路径 = url.pathname.toLowerCase();
				if (路径 == '/') {
					if (env.URL302) return Response.redirect(env.URL302, 302);
					else if (env.URL) return await 代理URL(env.URL, url);
					else {
						// 显示新的伪装页面
						return await statusPage();
					}
				} else if (路径 === `/${fakeUserID}`) {
					const fakeConfig = await 生成配置信息(userID, request.headers.get('Host'), sub, 'CF-Workers-SUB', RproxyIP, url, fakeUserID, fakeHostName, env);
					return new Response(`${fakeConfig}`, {
						status: 200
					});
				} else if ((动态UUID && url.pathname === `/${动态UUID}/edit`) || 路径 === `/${userID}/edit`) {
					return await KV(request, env);
				} else if ((动态UUID && url.pathname === `/${动态UUID}`) || 路径 === `/${userID}`) {
					await sendMessage(`#获取订阅 ${FileName}`, request.headers.get('CF-Connecting-IP'), `UA: ${UA}</tg-spoiler>\n域名: ${url.hostname}\n<tg-spoiler>入口: ${url.pathname + url.search}</tg-spoiler>`);

					const uuid_to_use = (动态UUID && url.pathname === `/${动态UUID}`) ? 动态UUID : userID;
					const secureProtoConfig = await 生成配置信息(uuid_to_use, request.headers.get('Host'), sub, UA, RproxyIP, url, fakeUserID, fakeHostName, env);

					const now = Date.now();
					const today = new Date(now);
					today.setHours(0, 0, 0, 0);
					const UD = Math.floor(((now - today.getTime()) / 86400000) * 24 * 1099511627776 / 2);
					let pagesSum = UD;
					let workersSum = UD;
					let total = 24 * 1099511627776;

					if (userAgent && userAgent.includes('mozilla')) {
						return new Response(secureProtoConfig, {
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
						// 对于所有其他未知路径，显示新的伪装页面
						return await statusPage();
					}
				}
			} else {
				// WebSocket 请求处理
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
					proxyIP = url.pathname.toLowerCase().split('/proxyip=')[1];
					enableSocks = false;
				} else if (new RegExp('/proxyip.', 'i').test(url.pathname)) {
					proxyIP = `proxyip.${url.pathname.toLowerCase().split("/proxyip.")[1]}`;
					enableSocks = false;
				} else if (new RegExp('/pyip=', 'i').test(url.pathname)) {
					proxyIP = url.pathname.toLowerCase().split('/pyip=')[1];
					enableSocks = false;
				}

				// This now calls our new, multiplexing-aware handler.
				return await secureProtoOverWSHandler(request, env);
			}
		} catch (err) {
			console.error(err.stack);
			return new Response(err.toString(), {
				status: 500
			});
		}
	},
};

/**
 * =================================================================
 * START OF MULTIPLEXING LOGIC REPLACEMENT
 * The following functions implement the new WebSocket + Yamux logic.
 * =================================================================
 */

/**
 * Handles incoming WebSocket connections and establishes a Yamux multiplexing session.
 * @param {Request} request
 * @param {any} env
 */
async function secureProtoOverWSHandler(request, env) {
	const webSocketPair = new WebSocketPair();
	const [client, webSocket] = Object.values(webSocketPair);

	webSocket.accept();

	// Create a transform stream to bridge WebSocket and Yamux
	const {
		readable: wsReadable,
		writable: wsWritable
	} = new TransformStream();
	const wsWriter = wsWritable.getWriter();
	const wsReader = wsReadable.getReader();

	// Forward WebSocket messages to the Yamux session
	const messagePromise = (async () => {
		for (;;) {
			try {
				const {
					value,
					done
				} = await wsReader.read();
				if (done) break;
				webSocket.send(value);
			} catch (e) {
				console.error("Error reading from wsReader and sending to WebSocket:", e);
				break;
			}
		}
	})();

	webSocket.addEventListener("message", (event) => {
		wsWriter.write(event.data);
	});

	const closeOrErrorHandler = (evt) => {
		console.log(`WebSocket event: ${evt.type}. Aborting connection.`);
		wsWriter.abort();
		wsReader.cancel();
		// Abort any pending reads from the WebSocket
		if (webSocket.readyState === WebSocket.READY_STATE_OPEN || webSocket.readyState === WebSocket.READY_STATE_CONNECTING) {
			webSocket.close(1001, "Upstream connection closed");
		}
	};
	webSocket.addEventListener("close", closeOrErrorHandler);
	webSocket.addEventListener("error", closeOrErrorHandler);

	// Create a new Yamux session over the transformed streams
	const muxer = new yamux.Session(false, {
		readable: wsWritable.readable,
		writable: wsReadable.writable
	}, {
		onStream: (stream) => {
			console.log(`New Yamux stream opened: ID ${stream.id}`);
			// Process each stream concurrently and independently.
			processMuxStream(stream, env).catch(err => {
				console.error(`Error processing stream ${stream.id}:`, err);
				stream.abort(err); // Ensure the stream is closed on error
			});
		}
	});

	// Return the other end of the WebSocket to the client.
	return new Response(null, {
		status: 101,
		webSocket: client,
	});
}

/**
 * Processes a single Yamux virtual stream, handling the proxy logic for it.
 * @param {Stream} stream - A Yamux stream object.
 * @param {any} env
 */
async function processMuxStream(stream, env) {
	const reader = stream.readable.getReader();
	const {
		value: firstChunk,
		done
	} = await reader.read();

	if (done || !firstChunk) {
		throw new Error(`Stream ${stream.id} closed before receiving header.`);
	}

	const {
		hasError,
		message,
		addressRemote,
		portRemote,
		rawDataIndex,
		secureProtoVersion
	} = processsecureProtoHeader(firstChunk, userID);

	if (hasError) {
		reader.releaseLock();
		throw new Error(message);
	}

	const log = (info) => console.log(`[${addressRemote}:${portRemote} (Mux ${stream.id})] ${info}`);
	log(`Handling outbound request`);

	const rawClientData = firstChunk.slice(rawDataIndex);
	reader.releaseLock();

	// Reconstruct the readable stream with the initial data.
	const clientReadable = new ReadableStream({
		async start(controller) {
			if (rawClientData.byteLength > 0) {
				controller.enqueue(rawClientData);
			}
			try {
				for await (const chunk of stream.readable) {
					controller.enqueue(chunk);
				}
				controller.close();
			} catch (e) {
				controller.error(e);
			}
		}
	});

	const responseHeader = new Uint8Array([secureProtoVersion[0], 0]);
	await handleTCPOutBoundMux(clientReadable, stream.writable, addressRemote, portRemote, responseHeader, log, env);
}

/**
 * Modified outbound handler for Yamux streams.
 * @param {ReadableStream} clientReadable
 * @param {WritableStream} clientWritable
 * @param {string} addressRemote
 * @param {number} portRemote
 * @param {Uint8Array} responseHeader
 * @param {function} log
 * @param {any} env
 */
async function handleTCPOutBoundMux(clientReadable, clientWritable, addressRemote, portRemote, responseHeader, log, env) {
	async function connectAndPipe(strategy) {
		log(`Attempting connection with strategy: '${strategy.name}'`);
		const tcpSocket = await strategy.execute();
		log(`Strategy '${strategy.name}' connected successfully. Piping data.`);

		const writer = clientWritable.getWriter();
		try {
			await writer.write(responseHeader);
		} finally {
			writer.releaseLock();
		}

		// Pipe data in both directions.
		const remoteToClient = tcpSocket.readable.pipeTo(clientWritable, {
			preventClose: true
		});
		const clientToRemote = clientReadable.pipeTo(tcpSocket.writable, {
			preventClose: true
		});

		// Wait for either pipe to close, then clean up.
		try {
			await Promise.race([remoteToClient, clientToRemote]);
		} catch (err) {
			log(`Piping race error: ${err.message}`);
		}

		log('Pipe closed, cleaning up TCP socket.');
		tcpSocket.close();
	}

	async function tryConnectionStrategies(strategies) {
		if (!strategies || strategies.length === 0) {
			throw new Error('All connection strategies failed.');
		}
		const [currentStrategy, ...nextStrategies] = strategies;
		try {
			await connectAndPipe(currentStrategy);
		} catch (error) {
			log(`Strategy '${currentStrategy.name}' failed: ${error.message}.`);
			await tryConnectionStrategies(nextStrategies);
		}
	}

	// --- THIS IS THE FULL, ORIGINAL CONNECTION STRATEGY LOGIC ---
	const connectionStrategies = [];
	const shouldUseSocks = enableSocks && go2Socks5s.some(pattern => new RegExp(`^${pattern.replace(/\*/g, '.*')}$`, 'i').test(addressRemote));

	// 1. 主要连接策略
	if (enableHttpProxy) {
		connectionStrategies.push({
			name: 'HTTP Proxy',
			execute: () => httpConnect(addressRemote, portRemote, log)
		});
	} else if (shouldUseSocks) {
		connectionStrategies.push({
			name: 'SOCKS5 Proxy (go2Socks5s)',
			execute: () => socks5Connect(addressType, addressRemote, portRemote, log)
		});
	} else {
		connectionStrategies.push({
			name: 'Direct Connection',
			execute: () => connect({
				hostname: addressRemote,
				port: portRemote
			})
		});
	}

	// 2. 备用 (Fallback) 策略
	if (enableSocks && !shouldUseSocks) {
		connectionStrategies.push({
			name: 'SOCKS5 Proxy (Fallback)',
			execute: () => socks5Connect(addressType, addressRemote, portRemote, log)
		});
	}

	if (proxyIP && proxyIP.trim() !== '') {
		connectionStrategies.push({
			name: '用户配置的 PROXYIP',
			execute: () => {
				const {
					address,
					port
				} = parseProxyIP(proxyIP, portRemote);
				return connect({
					hostname: address,
					port: port
				});
			}
		});
	}

	const userNat64Server = DNS64Server && DNS64Server.trim() !== '' && DNS64Server !== atob("ZG5zNjQuY21saXVzc3NzLm5ldA==");
	if (userNat64Server) {
		connectionStrategies.push({
			name: '用户配置的 NAT64',
			execute: async () => {
				const nat64Address = await resolveToIPv6(addressRemote);
				return connect({
					hostname: `[${nat64Address}]`,
					port: 443
				});
			}
		});
	}

	connectionStrategies.push({
		name: '内置的默认 PROXYIP',
		execute: () => {
			const defaultProxyIP = atob('UFJPWFlJUC50cDEuZnh4ay5kZWR5bi5pbw==');
			const {
				address,
				port
			} = parseProxyIP(defaultProxyIP, portRemote);
			return connect({
				hostname: address,
				port: port
			});
		}
	});

	connectionStrategies.push({
		name: '内置的默认 NAT64',
		execute: async () => {
			if (!DNS64Server || DNS64Server.trim() === '') {
				DNS64Server = atob("ZG5zNjQuY21pLnp0dmkub3Jn");
			}
			const nat64Address = await resolveToIPv6(addressRemote);
			return connect({
				hostname: `[${nat64Address}]`,
				port: 443
			});
		}
	});
	// --- END OF CONNECTION STRATEGY LOGIC ---

	try {
		await tryConnectionStrategies(connectionStrategies);
	} catch (err) {
		log(`All connection attempts failed. Aborting stream. Error: ${err.message}`);
		await clientWritable.abort(err.message);
	}
}


function processsecureProtoHeader(secureProtoBuffer, userID) {
	if (secureProtoBuffer.byteLength < 24) {
		return {
			hasError: true,
			message: 'Invalid data'
		};
	}

	const version = new Uint8Array(secureProtoBuffer.slice(0, 1));
	const userIDArray = new Uint8Array(secureProtoBuffer.slice(1, 17));
	const userIDString = stringify(userIDArray);
	const isValidUser = userIDString === userID || userIDString === userIDLow;

	if (!isValidUser) {
		return {
			hasError: true,
			message: 'Invalid user'
		};
	}

	const optLength = new Uint8Array(secureProtoBuffer.slice(17, 18))[0];
	const command = new Uint8Array(secureProtoBuffer.slice(18 + optLength, 18 + optLength + 1))[0];
	let isUDP = false;

	switch (command) {
		case 1:
			break;
		case 2:
			isUDP = true;
			break;
		default:
			return {
				hasError: true,
				message: 'Unsupported command'
			};
	}

	const portIndex = 18 + optLength + 1;
	const portRemote = new DataView(secureProtoBuffer.buffer, secureProtoBuffer.byteOffset, secureProtoBuffer.byteLength).getUint16(portIndex);


	const addressIndex = portIndex + 2;
	const addressType = new Uint8Array(secureProtoBuffer.slice(addressIndex, addressIndex + 1))[0];
	let addressValue = '';
	let addressLength = 0;
	let addressValueIndex = addressIndex + 1;

	switch (addressType) {
		case 1:
			addressLength = 4;
			addressValue = new Uint8Array(secureProtoBuffer.slice(addressValueIndex, addressValueIndex + addressLength)).join('.');
			break;
		case 2:
			addressLength = new Uint8Array(secureProtoBuffer.slice(addressValueIndex, addressValueIndex + 1))[0];
			addressValueIndex += 1;
			addressValue = new TextDecoder().decode(secureProtoBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
			break;
		case 3:
			addressLength = 16;
			const dataView = new DataView(secureProtoBuffer.buffer, secureProtoBuffer.byteOffset, secureProtoBuffer.byteLength);
			const ipv6 = [];
			for (let i = 0; i < 8; i++) {
				ipv6.push(dataView.getUint16(addressValueIndex + i * 2).toString(16));
			}
			addressValue = ipv6.join(':');
			break;
		default:
			return {
				hasError: true,
				message: `Invalid address type: ${addressType}`
			};
	}

	if (!addressValue) {
		return {
			hasError: true,
			message: 'Empty address value'
		};
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


const byteToHexArray = Array.from({
	length: 256
}, (_, i) => (i + 256).toString(16).slice(1));

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
	const {
		username,
		password,
		hostname,
		port
	} = parsedSocks5Address;
	const socket = connect({
		hostname,
		port
	});

	const socksGreeting = new Uint8Array([5, 2, 0, 2]);
	const writer = socket.writable.getWriter();
	await writer.write(socksGreeting);
	log('SOCKS5 greeting sent');

	const reader = socket.readable.getReader();
	const encoder = new TextEncoder();
	let res = (await reader.read()).value;

	if (res[0] !== 0x05) {
		log(`SOCKS5 version error: received ${res[0]}, expected 5`);
		socket.close();
		throw new Error("SOCKS5 version error");
	}
	if (res[1] === 0xff) {
		log("No acceptable authentication methods");
		socket.close();
		throw new Error("SOCKS5 no acceptable auth");
	}

	if (res[1] === 0x02) {
		log("SOCKS5 requires authentication");
		if (!username || !password) {
			log("Username and password required");
			socket.close();
			throw new Error("SOCKS5 auth required but not provided");
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
			socket.close();
			throw new Error("SOCKS5 auth failed");
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
			DSTADDR = new Uint8Array([4, ...addressRemote.split(':').flatMap(x => {
				const hex = x.padStart(4, '0');
				return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2), 16)];
			})]);
			break;
		default:
			log(`Invalid address type: ${addressType}`);
			socket.close();
			throw new Error(`Invalid address type: ${addressType}`);
	}
	const socksRequest = new Uint8Array([5, 1, 0, ...DSTADDR, portRemote >> 8, portRemote & 0xff]);
	await writer.write(socksRequest);
	log('SOCKS5 request sent');

	res = (await reader.read()).value;
	if (res[1] === 0x00) {
		log("SOCKS5 connection established");
	} else {
		log("SOCKS5 connection failed");
		socket.close();
		throw new Error("SOCKS5 connection failed");
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

//  HTTP 代理地址解析函数
function httpProxyAddressParser(address) {
	let [latter, former] = address.split("@").reverse();
	let username, password, hostname, port;

	if (former) {
		const formers = former.split(":");
		if (formers.length > 2) { // 密码中可能包含冒号，但用户名不能
			const userSeparatorIndex = former.indexOf(":");
			username = former.substring(0, userSeparatorIndex);
			password = former.substring(userSeparatorIndex + 1);
		} else if (formers.length === 2) {
			[username, password] = formers;
		} else {
			throw new Error('Invalid HTTP proxy address format: "username:password" required');
		}
	}

	const latters = latter.split(":");
	port = Number(latters.pop());
	if (isNaN(port)) {
		throw new Error('Invalid HTTP proxy address format: port must be a number');
	}

	hostname = latters.join(":");

	const regex = /^\[.*\]$/;
	if (hostname.includes(":") && !regex.test(hostname)) {
		throw new Error('Invalid HTTP proxy address format: IPv6 must be in brackets');
	}

	return {
		username,
		password,
		hostname,
		port,
	}
}

async function httpConnect(addressRemote, portRemote, log) {
	const {
		username,
		password,
		hostname,
		port
	} = parsedHttpProxyAddress;
	const sock = await connect({
		hostname: hostname,
		port: port
	});

	let connectRequest = `CONNECT ${addressRemote}:${portRemote} HTTP/1.1\r\n`;
	connectRequest += `Host: ${addressRemote}:${portRemote}\r\n`;

	if (username && password) {
		const authString = `${username}:${password}`;
		const base64Auth = btoa(authString);
		connectRequest += `Proxy-Authorization: Basic ${base64Auth}\r\n`;
	}

	connectRequest += `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n`;
	connectRequest += `Proxy-Connection: Keep-Alive\r\n`;
	connectRequest += `Connection: Keep-Alive\r\n`;
	connectRequest += `\r\n`;

	log(`正在连接到 ${addressRemote}:${portRemote} 通过代理 ${hostname}:${port}`);

	const writer = sock.writable.getWriter();
	await writer.write(new TextEncoder().encode(connectRequest));
	writer.releaseLock();

	const reader = sock.readable.getReader();
	let responseBuffer = new Uint8Array(0);

	while (true) {
		const {
			value,
			done
		} = await reader.read();
		if (done) {
			throw new Error('HTTP代理连接在响应头完成前中断');
		}

		const newBuffer = new Uint8Array(responseBuffer.length + value.length);
		newBuffer.set(responseBuffer);
		newBuffer.set(value, responseBuffer.length);
		responseBuffer = newBuffer;

		const respText = new TextDecoder().decode(responseBuffer);
		if (respText.includes('\r\n\r\n')) {
			const headersEndPos = respText.indexOf('\r\n\r\n') + 4;
			const headers = respText.substring(0, headersEndPos);

			log(`收到HTTP代理响应: ${headers.split('\r\n')[0]}`);
			if (headers.startsWith('HTTP/1.1 200') || headers.startsWith('HTTP/1.0 200')) {
				const remainingData = responseBuffer.slice(headersEndPos);
				reader.releaseLock();

				const [original, branch] = sock.readable.tee();
				const newReader = branch.getReader();

				(async () => {
					while (true) {
						const {
							value,
							done
						} = await newReader.read();
						if (done) break;
					}
				})();

				const finalReadable = new ReadableStream({
					start(controller) {
						if (remainingData.length > 0) {
							controller.enqueue(remainingData);
						}
						const promise = original.pipeTo(new WritableStream({
							write(chunk) {
								controller.enqueue(chunk);
							},
							close() {
								controller.close();
							},
							abort(err) {
								controller.error(err);
							}
						}));
					}
				});

				log(`HTTP代理连接成功: ${addressRemote}:${portRemote}`);
				return {
					readable: finalReadable,
					writable: sock.writable,
					close: () => sock.close()
				};
			} else {
				throw new Error(`HTTP代理连接失败: ${headers.split('\r\n')[0]}`);
			}
		}
	}
}


function 恢复伪装信息(content, userID, hostName, fakeUserID, fakeHostName, isBase64) {
	if (isBase64) {
		try {
			content = atob(content);
		} catch (e) {
			console.error("Base64 decoding failed, returning original content.", e);
			return content;
		}
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
	const 第一次十六进制 = [...new Uint8Array(第一次哈希)].map(byte => byte.toString(16).padStart(2, '0')).join('');
	const 截取部分 = 第一次十六进制.substring(7, 27);
	const 第二次哈希 = await crypto.subtle.digest('SHA-256', 编码器.encode(截取部分));
	return [...new Uint8Array(第二次哈希)].map(byte => byte.toString(16).padStart(2, '0')).join('').toLowerCase();
}

async function 代理URL(request, 代理网址, 目标网址, 调试模式 = false) {
	try {
		const 网址列表 = await 整理(代理网址);
		if (!网址列表 || 网址列表.length === 0) {
			throw new Error('代理网址列表为空');
		}
		const 完整网址 = 网址列表[Math.floor(Math.random() * 网址列表.length)];
		const 解析后的网址 = new URL(完整网址);
		const 目标URL = new URL(目标网址.pathname + 目标网址.search, 解析后的网址);
		const newHeaders = new Headers(request.headers);
		newHeaders.set('Host', 解析后的网址.hostname);
		newHeaders.set('Referer', 解析后的网址.origin);

		const 响应 = await fetch(目标URL.toString(), {
			method: request.method,
			headers: newHeaders,
			body: request.body,
			redirect: 'manual'
		});

		const 新响应 = new Response(响应.body, {
			status: 响应.status,
			statusText: 响应.statusText,
			headers: new Headers(响应.headers)
		});
		新响应.headers.delete('cf-ray');
		新响应.headers.delete('cf-connecting-ip');
		新响应.headers.delete('x-forwarded-proto');
		新响应.headers.delete('x-real-ip');
		return 新响应;
	} catch (error) {
		console.error(`代理请求失败: ${error.message}`);
		return new Response(`代理请求失败: ${error.message}`, {
			status: 500
		});
	}
}

const protocolEncodedFlag = atob('ZG14bGMzTT0=');
function 配置信息(UUID, 域名地址) {
	const 协议类型 = atob(protocolEncodedFlag);

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

	if (域名地址.includes('.workers.dev') || noTLS === 'true') {
		地址 = atob('dmlzYS5jbg==');
		端口 = 80;
		传输层安全 = ['', false];
	}

	const 威图瑞 = `${协议类型}://${用户ID}@${地址}:${端口}\u003f\u0065\u006e\u0063\u0072\u0079` + 'p' + `${atob('dGlvbj0=') + 加密方式}\u0026\u0073\u0065\u0063\u0075\u0072\u0069\u0074\u0079\u003d${传输层安全[0]}&sni=${SNI}&fp=${指纹}&type=${传输层协议}&host=${伪装域名}&path=${encodeURIComponent(路径)}#${encodeURIComponent(别名)}`;
	const 猫猫猫 = `- {name: ${FileName}, server: ${地址}, port: ${端口}, type: ${协议类型}, uuid: ${用户ID}, tls: ${传输层安全[1]}, alpn: [h3], udp: false, sni: ${SNI}, tfo: false, skip-cert-verify: true, servername: ${伪装域名}, client-fingerprint: ${指纹}, network: ${传输层协议}, ws-opts: {path: "${路径}", headers: {${伪装域名}}}}`;
	return [威图瑞, 猫猫猫];
}

let subParams = ['sub', 'base64', 'b64', 'clash', 'singbox', 'sb'];
const cmad = decodeURIComponent(atob('dGVsZWdyYW0lMjAlRTQlQkElQTQlRTYlQjUlODElRTclQkUlQTQlMjAlRTYlOEElODAlRTYlOUMlQUYlRTUlQTQlQTclRTQlQkQlQUMlN0UlRTUlOUMlQTglRTclQkElQkYlRTUlOEYlOTElRTclODklOEMhJTNDYnIlM0UKJTNDYSUyMGhyZWYlM0QlMjdodHRwcyUzQSUyRiUyRnQubWUlMkZDTUxpdXNzc3MlMjclM0VodHRwcyUzQSUyRiUyRnQubWUlMkZDTUxpdXNzc3MlM0MlMkZhJTNFJTNDYnIlM0UKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tJTNDYnIlM0UKZ2l0aHViJTIwJUU5JUExJUI5JUU3JTlCJUFFJUU1JTlDJUIwJUU1JTlEJTgwJTIwU3RhciFTdGFyIVN0YXIhISElM0NiciUzRQolM0NhJTIwaHJlZiUzRCUyN2h0dHBzJTNBJTJGJTJGZ2l0aHViLmNvbSUyRmNtbGl1JTJGZWRnZXR1bm5lbCUyNyUzRWh0dHBzJTNBJTJGJTJGZ2l0aHViLmNvbSUyRmNtbGl1JTJGZWRnZXR1bm5lbCUzQyUyRmElM0UlM0NiciUzRQotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0lM0NiciUzRQo='));

async function 生成配置信息(uuid, hostName, sub, UA, RproxyIP, _url, fakeUserID, fakeHostName, env) {

	if (sub) {
		const match = sub.match(/^(?:https?:\/\/)?([^\/]+)/);
		sub = match ? match[1] : sub;
		const subs = await 整理(sub);
		sub = subs.length > 1 ? subs[0] : sub;
	}

	if ((addresses.length + addressesapi.length + addressesnotls.length + addressesnotlsapi.length + addressescsv.length) == 0) {
	    		let cfips = [
		            '104.16.0.0/14',
		            '104.21.0.0/16',
		            '188.114.96.0/20',

	    		];

    		function ipToInt(ip) {
        			return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    		}

    			function intToIp(int) {
        			return [
            			(int >>> 24) & 255,
            			(int >>> 16) & 255,
            			(int >>> 8) & 255,
            			int & 255
        				].join('.');
    				}

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

	    if (hostName.includes("worker") || hostName.includes("notls") || noTLS === 'true') {
		    const randomPorts = httpPorts.length > 0 ? httpPorts : ['80'];
		    for (let i = 0; i < totalIPsToGenerate; i++) {
			    const randomCIDR = cfips[Math.floor(Math.random() * cfips.length)];
			    const randomIP = generateRandomIPFromCIDR(randomCIDR);
			    const port = randomPorts[Math.floor(Math.random() * randomPorts.length)];
			    addressesnotls.push(`${randomIP}:${port}#CF随机节点${String(counter++).padStart(2, '0')}`);
		    }
	    } else {
		    const randomPorts = httpsPorts.length > 0 ? httpsPorts : ['443'];
		        for (let i = 0; i < totalIPsToGenerate; i++) {
			    const randomCIDR = cfips[Math.floor(Math.random() * cfips.length)];
			    const randomIP = generateRandomIPFromCIDR(randomCIDR);
			    const port = randomPorts[Math.floor(Math.random() * randomPorts.length)];
			    addresses.push(`${randomIP}:${port}#CF随机节点${String(counter++).padStart(2, '0')}`);
		    }
	    }
    }

	const userAgent = UA.toLowerCase();
	const Config = 配置信息(uuid, hostName);
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
		let 判断是否绑定KV空间 = env.KV ? ` <a href='${_url.pathname}/edit'>编辑优选列表</a>` : '';

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
			<html lang="zh-CN">
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1">
				<title>${FileName} 配置信息</title>
				<style>
					:root {
						--primary-color: #0d6efd;
						--secondary-color: #0b5ed7;
						--border-color: #e0e0e0;
						--text-color: #212529;
						--background-color: #f5f5f5;
						--section-bg: #ffffff;
						--link-color: #1a0dab;
						--visited-link-color: #6c00a2;
					}

					html.dark-mode {
						--primary-color: #589bff;
						--secondary-color: #458cff;
						--border-color: #3c3c3c;
						--text-color: #e0e0e0;
						--background-color: #1c1c1e;
						--section-bg: #2a2a2a;
						--link-color: #8ab4f8;
						--visited-link-color: #c58af9;
					}

					body {
						margin: 0;
						padding: 20px;
						font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
						line-height: 1.6;
						color: var(--text-color);
						background-color: var(--background-color);
					}

					a {
						color: var(--link-color);
						text-decoration: none;
					}

					a:visited {
						color: var(--visited-link-color);
					}

					a:hover {
						text-decoration: underline;
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
						color: var(--text-color);
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

					html.dark-mode .subscription-link {
						background: #3a3a3a;
					}

					.qrcode-container {
						margin: 10px 0;
						text-align: center;
					}

					.notice-toggle {
						color: var(--primary-color);
						cursor: pointer;
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
						word-break: break-all;
						overflow-wrap: break-word;
					}
					
					html.dark-mode .notice-content {
						background: #3a3a3a;
					}
					
					.config-info {
						background: #f8f9fa;
						padding: 15px;
						border-radius: 6px;
						font-family: Monaco, Consolas, "Courier New", monospace;
						font-size: 13px;
						overflow-x: auto;
					}
					
					html.dark-mode .config-info {
						background: #3a3a3a;
					}

					.copy-button {
						display: inline-block;
						padding: 6px 12px;
						background: var(--primary-color);
						color: #fff;
						border: none;
						border-radius: 4px;
						cursor: pointer;
						font-size: 14px;
						margin: 5px 0;
						transition: background-color: 0.2s;
					}

					.copy-button:hover {
						background: var(--secondary-color);
					}
					
					.theme-switch-wrapper {
						display: flex;
						align-items: center;
						position: fixed;
						top: 15px;
						right: 15px;
					}

					.theme-switch {
						display: inline-block;
						height: 20px;
						position: relative;
						width: 36px;
					}

					.theme-switch input {
						display:none;
					}

					.slider {
						background-color: #ccc;
						bottom: 0;
						cursor: pointer;
						left: 0;
						position: absolute;
						right: 0;
						top: 0;
						transition: .4s;
					}

					.slider:before {
						background-color: #fff;
						bottom: 3px;
						content: "";
						height: 14px;
						left: 3px;
						position: absolute;
						transition: .4s;
						width: 14px;
					}

					input:checked + .slider {
						background-color: var(--primary-color);
					}

					input:checked + .slider:before {
						transform: translateX(16px);
					}

					.slider.round {
						border-radius: 20px;
					}

					.slider.round:before {
						border-radius: 50%;
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
                <script>
                    (function() {
                        try {
                            const theme = localStorage.getItem('theme');
                            if (theme === 'dark-mode') {
                                document.documentElement.classList.add('dark-mode');
                            }
                        } catch (e) { console.error(e); }
                    })();
                </script>
			</head>
			<body>
				<div class="theme-switch-wrapper">
					<label class="theme-switch" for="checkbox">
						<input type="checkbox" id="checkbox" />
						<div class="slider round"></div>
					</label>
				</div>
				<div class="container">
					<div class="section">
						<div class="section-title">📋 订阅信息</div>
						<div class="subscription-link">
							自适应订阅地址:<br>
							<a href="javascript:void(0)" onclick="copyToClipboard('https://${proxyhost}${hostName}/${uuid}?sub','qrcode_0')">
								https://${proxyhost}${hostName}/${uuid}
							</a>
							<div id="qrcode_0" class="qrcode-container"></div>
						</div>

						<div class="subscription-link">
							Base64订阅地址:<br>
							<a href="javascript:void(0)" onclick="copyToClipboard('https://${proxyhost}${hostName}/${uuid}?b64','qrcode_1')">
								https://${proxyhost}${hostName}/${uuid}?b64
							</a>
							<div id="qrcode_1" class="qrcode-container"></div>
						</div>

						<div class="subscription-link">
							clash订阅地址:<br>
							<a href="javascript:void(0)" onclick="copyToClipboard('https://${proxyhost}${hostName}/${uuid}?clash','qrcode_2')">
								https://${proxyhost}${hostName}/${uuid}?clash
							</a>
							<div id="qrcode_2" class="qrcode-container"></div>
						</div>

						<div class="subscription-link">
							singbox订阅地址:<br>
							<a href="javascript:void(0)" onclick="copyToClipboard('https://${proxyhost}${hostName}/${uuid}?sb','qrcode_3')">
								https://${proxyhost}${hostName}/${uuid}?sb
							</a>
							<div id="qrcode_3" class="qrcode-container"></div>
						</div>

						<div class="subscription-link">
							Loon订阅地址:<br>
							<a href="javascript:void(0)" onclick="copyToClipboard('https://${proxyhost}${hostName}/${uuid}?loon','qrcode_4')">
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
					
					const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
					
					(function() {
						const currentTheme = localStorage.getItem('theme');
						if (currentTheme === 'dark-mode') {
							toggleSwitch.checked = true;
						}
					})();
					

					function switchTheme(e) {
						if (e.target.checked) {
							document.documentElement.classList.add('dark-mode');
							localStorage.setItem('theme', 'dark-mode');
						} else {
							document.documentElement.classList.remove('dark-mode');
							localStorage.setItem('theme', 'light-mode');
						}    
					}

					toggleSwitch.addEventListener('change', switchTheme, false);

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

		if (hostName.includes(".workers.dev") || noTLS === 'true') {
			noTLS = 'true';
			fakeHostName = `${fakeHostName}.workers.dev`;
			newAddressesnotlsapi = await 整理优选列表(addressesnotlsapi);
			newAddressesnotlscsv = await 整理测速结果('FALSE');
		} else if (hostName.includes(".pages.dev")) {
			fakeHostName = `${fakeHostName}.pages.dev`;
		} else if (hostName.includes("worker") || hostName.includes("notls")) {
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
						'User-Agent': (isBase64 ? 'v2rayN' : UA) + atob('IENGLVdvcmtlcnMtZWRnZXR1bm5lbC9jbWxpdQ==')
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

			const localHttpPorts = httpPorts.length > 0 ? httpPorts : ["80", "8080", "8880", "2052", "2082", "2086", "2095"];
			if (!isValidIPv4(address) && port == "-1") {
				for (let httpPort of localHttpPorts) {
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
			const 协议类型 = atob(protocolEncodedFlag);

            const secureProtoLink = `${协议类型}://${UUID}@${address}:${port}?` +
                `encryption=none&` +
                `security=none&` +
                `type=ws&` +
                `host=${伪装域名}&` +
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
		
		const localHttpsPorts = httpsPorts.length > 0 ? httpsPorts : ["443", "2053", "2083", "2087", "2096", "8443"];
		if (!isValidIPv4(address) && port == "-1") {
			for (let httpsPort of localHttpsPorts) {
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

		const 协议类型 = atob(protocolEncodedFlag);

		const secureProtoLink = `${协议类型}://${UUID}@${address}:${port}?` +
			`encryption=none&` +
			`security=tls&` +
			`sni=${伪装域名}&` +
			`fp=randomized&` +
			`alpn=h3&` +
			`type=ws&` +
			`host=${伪装域名}&` +
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
        return new Response("未绑定KV空间", { status: 400 });
    }
    try {
        const url = new URL(request.url);
        const type = url.searchParams.get('type');

        // 获取当前的 settings 对象
        const settingsJSON = await env.KV.get('settinggs.txt');
        let settings = settingsJSON ? JSON.parse(settingsJSON) : {};

        if (type === 'advanced') {
            // 更新高级设置
            const advancedSettingsUpdate = JSON.parse(await request.text());
            settings = { ...settings, ...advancedSettingsUpdate };
        } else {
            // 更新主列表内容 (ADD)
            settings.ADD = await request.text();
        }

        // 将合并后的 settings 对象写回 KV
        await env.KV.put('settinggs.txt', JSON.stringify(settings, null, 2));

        // --- 清除内存缓存以实现即时生效 ---
		cachedSettings = null;
		console.log("配置已更新，内存缓存已清除。");
		
        return new Response("保存成功");
    } catch (error) {
        console.error('保存KV时发生错误:', error);
        return new Response("保存失败: " + error.message, { status: 500 });
    }
}

async function handleGetRequest(env) {
    let content = '';
    let hasKV = !!env.KV;
    let proxyIPContent = '';
    let socks5Content = '';
    let httpProxyContent = '';
    let subContent = '';
    let subAPIContent = '';
    let subConfigContent = '';
    let nat64Content = '';
	let httpsPortsContent = '';
    let httpPortsContent = '';
    let noTLSContent = 'false';

    if (hasKV) {
        try {
            const advancedSettingsJSON = await env.KV.get('settinggs.txt');
            if (advancedSettingsJSON) {
                const settings = JSON.parse(advancedSettingsJSON);
                content = settings.ADD || ''; // 从 'ADD' 字段加载主内容
                proxyIPContent = settings.proxyip || '';
                socks5Content = settings.socks5 || '';
                httpProxyContent = settings.httpproxy || '';
                subContent = settings.sub || '';
                subAPIContent = settings.subapi || '';
                subConfigContent = settings.subconfig || '';
                nat64Content = settings.nat64 || '';
				httpsPortsContent = settings.httpsports || httpsPorts.join(',');
                httpPortsContent = settings.httpports || httpPorts.join(',');
                noTLSContent = settings.notls || 'false';
            } else {
				httpsPortsContent = httpsPorts.join(',');
				httpPortsContent = httpPorts.join(',');
			}
        } catch (error) {
            console.error('读取KV时发生错误:', error);
            content = '读取数据时发生错误: ' + error.message;
        }
    }
	
	// 为端口选择框生成HTML
    const defaultHttpsPorts = ["443", "2053", "2083", "2087", "2096", "8443"];
    const defaultHttpPorts = ["80", "8080", "8880", "2052", "2082", "2086", "2095"];

    const savedHttpsPorts = httpsPortsContent.split(',');
    const allHttpsPorts = [...new Set([...defaultHttpsPorts, ...savedHttpsPorts])].filter(p => p.trim() !== "");
    const httpsCheckboxesHTML = allHttpsPorts.map(port => {
        const isChecked = savedHttpsPorts.includes(port.trim());
        return `<div class="checkbox-item">
                    <input type="checkbox" id="https-port-${port.trim()}" name="httpsports" value="${port.trim()}" ${isChecked ? 'checked' : ''}>
                    <label for="https-port-${port.trim()}">${port.trim()}</label>
                </div>`;
    }).join('\n');

    const savedHttpPorts = httpPortsContent.split(',');
    const allHttpPorts = [...new Set([...defaultHttpPorts, ...savedHttpPorts])].filter(p => p.trim() !== "");
    const httpCheckboxesHTML = allHttpPorts.map(port => {
        const isChecked = savedHttpPorts.includes(port.trim());
        return `<div class="checkbox-item">
                    <input type="checkbox" id="http-port-${port.trim()}" name="httpports" value="${port.trim()}" ${isChecked ? 'checked' : ''}>
                    <label for="http-port-${port.trim()}">${port.trim()}</label>
                </div>`;
    }).join('\n');


    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>优选订阅列表</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                :root {
                    --primary-color: #0d6efd;
                    --secondary-color: #0b5ed7;
                    --border-color: #e0e0e0;
                    --text-color: #212529;
                    --background-color: #f5f5f5;
					--section-bg: white;
					--link-color: #1a0dab;
					--visited-link-color: #6c00a2;
                }

                html.dark-mode {
                    --primary-color: #589bff;
                    --secondary-color: #458cff;
                    --border-color: #3c3c3c;
                    --text-color: #e0e0e0;
                    --background-color: #1c1c1e;
					--section-bg: #2a2a2a;
					--link-color: #8ab4f8;
					--visited-link-color: #c58af9;
                }

                body {
                    margin: 0;
                    padding: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    line-height: 1.6;
                    color: var(--text-color);
                    background-color: var(--background-color);
                }
				
				a {
					color: var(--link-color);
					text-decoration: none;
				}
				
				a:visited {
					color: var(--visited-link-color);
				}

				a:hover {
					text-decoration: underline;
				}

                .container {
                    max-width: 1000px;
                    margin: 0 auto;
                    background: var(--section-bg, white);
                    padding: 25px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                
                html.dark-mode .container {
                    background: #242526;
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

                .editor, .setting-editor {
                    background-color: var(--section-bg, white);
                    color: var(--text-color);
                }
                
                html.dark-mode .editor, html.dark-mode .setting-editor {
                    background-color: #2a2a2a;
                }

                .editor:focus, .setting-editor:focus {
                    outline: none;
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25);
                }
				
				html.dark-mode .editor:focus,
				html.dark-mode .setting-editor:focus {
					outline: none;
					border-color: var(--primary-color);
					box-shadow: 0 0 0 2px rgba(88, 155, 255, 0.25);
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
                }
				
                .button-group {
                    display: flex;
					align-items: center;
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
                    transition: all 0.2s ease;
                }

                .btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .btn-primary {
                    background: var(--primary-color);
                    color: #fff;
                }

                .btn-primary:hover:not(:disabled) {
                    background: var(--secondary-color);
                }

                .btn-secondary {
                    background: #6c757d;
                    color: #fff;
                }

                .btn-secondary:hover:not(:disabled) {
                    background: #5c636a;
                }

                .save-status {
                    font-size: 14px;
                    color: #666;
                }
				
				html.dark-mode .save-status {
                    color: var(--text-color);
                }

                .notice-toggle {
                    color: var(--primary-color);
                    cursor: pointer;
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
                    word-break: break-all;
                }
                
                html.dark-mode .notice-content {
						background: #3a3a3a;
				}

                .divider {
                    height: 1px;
                    background: var(--border-color);
                    margin: 20px 0;
                }

                .advanced-settings {
                    margin: 20px 0;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                }
                
                 html.dark-mode .advanced-settings {
						background: #3a3a3a;
				}

                .advanced-settings-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    cursor: pointer;
                }

                #advanced-settings-content {
                    display: none;
                }

                .setting-item {
                    margin-bottom: 10px;
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    overflow: hidden;
                }

                .setting-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 15px;
                    background-color: #f0f0f0;
                    cursor: pointer;
                    font-weight: 500;
                }
                
                 html.dark-mode .setting-header {
						background: #424242;
				}

                .setting-content {
                    display: none; /* Initially hidden */
                    padding: 15px;
                    background-color: #fafafa;
                }
                
                 html.dark-mode .setting-content {
						background: #3a3a3a;
				}
				 
				 .setting-content p {
					 margin: 5px 0 10px 0;
					 color: #666;
				 }

				 html.dark-mode .setting-content p {
					 color: #bbb;
				 }
				 
                .setting-editor {
                    width: 100%;
                    min-height: 80px;
                    margin-top: 10px;
                    padding: 10px;
                    box-sizing: border-box;
                    border: 1px solid var(--border-color);
                    border-radius: 4px;
                    font-family: Monaco, Consolas, "Courier New", monospace;
                    font-size: 14px;
                    resize: vertical;
                }
				
				.setting-editor::placeholder {
					color: #aaa;
				}
				
				html.dark-mode .setting-editor::placeholder {
					color: #666;
				}
				
				.switch-container {
					display: flex;
					align-items: center;
					gap: 10px;
                    margin-bottom: 15px;
				}
                
                .checkbox-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                    gap: 10px;
                    margin-top: 10px;
                }

                .checkbox-item {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }

                .checkbox-item input[type="checkbox"] {
                    cursor: pointer;
                }
                
                .checkbox-item label {
                    cursor: pointer;
                    user-select: none;
                }

                .theme-switch-wrapper {
						display: flex;
						align-items: center;
						position: fixed;
						top: 15px;
						right: 15px;
					}

					.theme-switch {
						display: inline-block;
						height: 20px;
						position: relative;
						width: 36px;
					}

					.theme-switch input {
						display:none;
					}

					.slider {
						background-color: #ccc;
						bottom: 0;
						cursor: pointer;
						left: 0;
						position: absolute;
						right: 0;
						top: 0;
						transition: .4s;
					}

					.slider:before {
						background-color: #fff;
						bottom: 3px;
						content: "";
						height: 14px;
						left: 3px;
						position: absolute;
						transition: .4s;
						width: 14px;
					}

					input:checked + .slider {
						background-color: var(--primary-color);
					}

					input:checked + .slider:before {
						transform: translateX(16px);
					}

					.slider.round {
						border-radius: 20px;
					}

					.slider.round:before {
						border-radius: 50%;
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

                    .checkbox-grid {
                        grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
                    }
                }
            </style>
            <script>
                (function() {
                    try {
                        const theme = localStorage.getItem('theme');
                        if (theme === 'dark-mode') {
                            document.documentElement.classList.add('dark-mode');
                        }
                    } catch (e) { console.error(e); }
                })();
            </script>
        </head>
        <body>
            <div class="theme-switch-wrapper">
                <label class="theme-switch" for="checkbox">
                    <input type="checkbox" id="checkbox" />
                    <div class="slider round"></div>
                </label>
            </div>
            <div class="container">
                <div class="title">📝 ${FileName} 优选订阅列表</div>

                <div class="advanced-settings">
                    <div class="advanced-settings-header" onclick="toggleAdvancedSettings()">
                        <h3 style="margin: 0;">⚙️ 高级设置</h3>
                    </div>
                    <div id="advanced-settings-content">
                        <!-- PROXYIP设置 -->
                        <div class="setting-item">
                            <div class="setting-header" onclick="toggleSetting(this)">
                                <span><strong>PROXYIP </strong></span>
                            </div>
                            <div class="setting-content">
                                <p>每行一个IP，格式：IP:端口(可不添加端口)</p>
                                <textarea id="proxyip" class="setting-editor" placeholder="${decodeURIComponent(atob('JUU0JUJFJThCJUU1JUE2JTgyJTNBCjEuMi4zLjQlM0E0NDMKcHJveHkuZXhhbXBsZS5jb20lM0E4NDQz'))}">${proxyIPContent}</textarea>
                            </div>
                        </div>

                        <!-- SOCKS5设置 -->
                        <div class="setting-item">
                             <div class="setting-header" onclick="toggleSetting(this)">
                                <span><strong>SOCKS5 </strong></span>
                            </div>
                            <div class="setting-content">
                                <p>每行一个地址，格式：[用户名:密码@]主机:端口</p>
                                <textarea id="socks5" class="setting-editor" placeholder="${decodeURIComponent(atob('JUU0JUJFJThCJUU1JUE2JTgyJTNBCnVzZXIlM0FwYXNzJTQwMTI3LjAuMC4xJTNBMTA4MAoxMjcuMC4wLjElM0ExMDgw'))}">${socks5Content}</textarea>
                            </div>
                        </div>

                        <!-- HTTP Proxy 设置 -->
                        <div class="setting-item">
                            <div class="setting-header" onclick="toggleSetting(this)">
                                <span><strong>HTTP </strong></span>
                            </div>
                            <div class="setting-content">
                                <p>每行一个地址，格式：[用户名:密码@]主机:端口</p>
                                <textarea id="httpproxy" class="setting-editor" placeholder="${decodeURIComponent(atob('JUU0JUJFJThCJUU1JUE2JTgyJTNBCnVzZXI6cGFzc0AxLjIuMy40OjgwODAKMS4yLjMuNDo4MDgw'))}">${httpProxyContent}</textarea>
                            </div>
                        </div>

                        <!-- SUB设置 -->
                        <div class="setting-item">
                            <div class="setting-header" onclick="toggleSetting(this)">
                                <span><strong>SUB </strong> (优选订阅生成器)</span>
                            </div>
                            <div class="setting-content">
                                <p>只支持单个优选订阅生成器地址</p>
                                <textarea id="sub" class="setting-editor" placeholder="${decodeURIComponent(atob('JUU0JUJFJThCJUU1JUE2JTgyJTNBCnN1Yi5nb29nbGUuY29tCnN1Yi5leGFtcGxlLmNvbQ=='))}">${subContent}</textarea>
                            </div>
                        </div>

                        <!-- SUBAPI设置 -->
                        <div class="setting-item">
                            <div class="setting-header" onclick="toggleSetting(this)">
                                <span><strong>SUBAPI </strong> (订阅转换后端)</span>
                            </div>
                            <div class="setting-content">
                                <p>订阅转换后端地址</p>
                                <textarea id="subapi" class="setting-editor" placeholder="${decodeURIComponent(atob('JUU0JUJFJThCJUU1JUE2JTgyJTNBCmFwaS52MS5tawpzdWIueGV0b24uZGV2'))}">${subAPIContent}</textarea>
                            </div>
                        </div>

                        <!-- SUBCONFIG设置 -->
                        <div class="setting-item">
                            <div class="setting-header" onclick="toggleSetting(this)">
                                <span><strong>SUBCONFIG </strong> (订阅转换配置)</span>
                            </div>
                            <div class="setting-content">
                                <p>订阅转换配置文件地址</p>
                                <textarea id="subconfig" class="setting-editor" placeholder="${decodeURIComponent(atob('JUU0JUJFJThCJUU1JUE2JTgyJTNBCmh0dHBzJTNBJTJGJTJGcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSUyRkFDTDRTU1IlMkZBQ0w0U1NSJTI1MkZtYXN0ZXIlMkZDbGFzaCUyRmNvbmZpZyUyRkFDTDRTU1JfT25saW5lX01pbmlfTXVsdGlNb2RlLmluaQ=='))}">${subConfigContent}</textarea>
                            </div>
                        </div>

                        <!-- NAT64/DNS64 设置 -->
                        <div class="setting-item">
                           <div class="setting-header" onclick="toggleSetting(this)">
                                <span><strong>NAT64/DNS64 </strong></span>
                            </div>
                             <div class="setting-content">
                                <p>
                                    <a id="nat64-link" target="_blank">自行查询</a>
                                </p>
                                <textarea id="nat64" class="setting-editor" placeholder="${decodeURIComponent(atob('JUU0JUJFJThCJUU1JUE2JTgyJTNBJTBBZG5zNjQuZXhhbXBsZS5jb20lMEEyYTAxJTNBNGY4JTNBYzJjJTNBMTIzZiUzQSUzQSUyRjk2'))}">${nat64Content}</textarea>
                            </div>
                        </div>
						<script>
  							const encodedURL = 'aHR0cHM6Ly9uYXQ2NC54eXo=';
  							const decodedURL = atob(encodedURL);
  							document.getElementById('nat64-link').setAttribute('href', decodedURL);
						</script>
						
						<!-- HTTPS Ports Setting -->
                        <div class="setting-item">
                            <div class="setting-header" onclick="toggleSetting(this)">
                                <span><strong>随机节点 TLS 端口</strong></span>
                            </div>
                            <div class="setting-content">
                                <p>请选择用于随机生成 TLS 节点时使用的端口。</p>
                                <div class="checkbox-grid" id="httpsports-grid">
                                    ${httpsCheckboxesHTML}
                                </div>
                            </div>
                        </div>

                        <!-- HTTP Ports Setting -->
                        <div class="setting-item">
                            <div class="setting-header" onclick="toggleSetting(this)">
                                <span><strong>随机节点 noTLS 端口</strong></span>
                            </div>
                            <div class="setting-content">
                                <div class="switch-container">
                                    <label class="theme-switch" for="notls-checkbox">
                                        <input type="checkbox" id="notls-checkbox" ${noTLSContent === 'true' ? 'checked' : ''}>
                                        <div class="slider round"></div>
                                    </label>
                                    <span>启用 noTLS (将不使用 TLS 加密)</span>
                                </div>
                                <p>请选择用于随机生成 noTLS 节点时使用的端口。</p>
                                <div class="checkbox-grid" id="httpports-grid">
                                    ${httpCheckboxesHTML}
                                </div>
                            </div>
                        </div>

                        <!-- 统一的保存按钮 -->
                        <div style="margin-top: 20px;">
                            <button class="btn btn-primary" onclick="saveSettings()">保存</button>
                            <span id="settings-save-status" class="save-status"></span>
                        </div>
                    </div>
                </div>

                <!-- 保持现有内容 -->
                <a href="javascript:void(0);" id="noticeToggle" class="notice-toggle" onclick="toggleNotice()">
                    ℹ️ 注意事项 ∨
                </a>

                <div id="noticeContent" class="notice-content" style="display: none">
				    ${decodeURIComponent(atob('JTNDc3Ryb25nJTNFMS4lM0MlMkZzdHJvbmclM0UlMjBBREQlRTYlQTAlQkMlRTUlQkMlOEYlRTglQUYlQjclRTYlQUMlQTElRTclQUMlQUMlRTQlQjglODAlRTglQTElOEMlRTQlQjglODAlRTQlQjglQUElRTUlOUMlQjAlRTUlOUQlODAlRUYlQkMlOEMlRTYlQTAlQkMlRTUlQkMlOEYlRTQlQjglQkElMjAlRTUlOUMlQjAlRTUlOUQlODAlM0ElRTclQUIlQUYlRTUlOEYlQTMlMjMlRTUlQTQlODclRTYlQjMlQTglRUYlQkMlOENJUHY2JUU1JTlDJUIwJUU1JTlEJTgwJUU5JTgwJTlBJUU1JUI4JUI4JUU4JUE2JTgxJUU3JTk0JUE4JUU0JUI4JUFEJUU2JThCJUFDJUU1JThGJUI3JUU2JThCJUFDJUU4JUI1JUI3JUU1JUI5JUI2JUU1JThBJUEwJUU3JUFCJUFGJUU1JThGJUEzJUVGJUJDJThDJUU0JUI4JThEJUU1JThBJUEwJUU3JUFCJUFGJUU1JThGJUEzJUU5JUJCJTk4JUU4JUFFJUE0JUU0JUI4JUJBJTIyNDQzJTIyJUUzJTgwJTgyJUU0JUJFJThCJUU1JUE2JTgyJUVGJUJDJTlBJTNDYnIlM0UlMEExMjcuMC4wLjElM0EyMDUzJTIzJUU0JUJDJTk4JUU5JTgwJTg5SVAlM0NiciUzRSUwQXZpc2EuY24lM0EyMDUzJTIzJUU0JUJDJTk4JUU5JTgwJTg5JUU1JTlGJTlGJUU1JTkwJThEJTNDYnIlM0UlMEElNUIyNjA2JTNBNDcwMCUzQSUzQSU1RCUzQTIwNTMlMjMlRTQlQkMlOTglRTklODAlODlJUHY2JTNDYnIlM0UlM0NiciUzRSUwQSUwQSUzQ3N0cm9uZyUzRTIuJTNDJTJGc3Ryb25nJTNFJTIwQUREQVBJJTIwJUU1JUE2JTgyJUU2JTlFJTlDJUU2JTk4JUFGJUU0JUJCJUEzJUU3JTkwJTg2SVAlRUYlQkMlOEMlRTUlOEYlQUYlRTQlQkQlOUMlRTQlQjglQkFQUk9YWUlQJUU3JTlBJTg0JUU4JUFGJTlEJUVGJUJDJThDJUU1JThGJUFGJUU1JUIwJTg2JTIyJTNGcHJveHlpcCUzRHRydWUlMjIlRTUlOEYlODIlRTYlOTUlQjAlRTYlQjclQkIlRTUlOEElQTAlRTUlODglQjAlRTklOTMlQkUlRTYlOEUlQTUlRTYlOUMlQUIlRTUlQjAlQkUlRUYlQkMlOEMlRTQlQkUlOEIlRTUlQTYlODIlRUYlQkMlOUElM0NiciUzRSUwQWh0dHBzJTNBJTJGJTJGcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSUyRmNtbGl1JTJGV29ya2VyVmxlc3Myc3ViJTJGbWFpbiUyRmFkZHJlc3Nlc2FwaS50eHQlM0Zwcm94eWlwJTNEdHJ1ZSUzQ2JyJTNFJTNDYnIlM0UlMEElMEElM0NzdHJvbmclM0UzLiUzQyUyRnN0cm9uZyUzRSUyMEFEREFQSSUyMCVFNSVBNiU4MiVFNiU5RSU5QyVFNiU5OCVBRiUyMCUzQ2ElMjBocmVmJTNEJ2h0dHBzJTNBJTJGJTJGZ2l0aHViLmNvbSUyRlhJVTIlMkZDbG91ZGZsYXJlU3BlZWRUZXN0JyUzRUNsb3VkZmxhcmVTcGVlZFRlc3QlM0MlMkZhJTNFJTIwJUU3JTlBJTg0JTIwY3N2JTIwJUU3JUJCJTkzJUU2JTlFJTlDJUU2JTk2JTg3JUU0JUJCJUI2JUUzJTgwJTgyJUU0JUJFJThCJUU1JUE2JTgyJUVGJUJDJTlBJTNDYnIlM0UlMEFodHRwcyUzQSUyRiUyRnJhdy5naXRodWJ1c2VyY29udGVudC5jb20lMkZjbWxpdSUyRldvcmtlclZsZXNzMnN1YiUyRm1haW4lMkZDbG91ZGZsYXJlU3BlZWRUZXN0LmNzdiUzQ2JyJTNF'))}
                </div>

                <div class="editor-container">
                    ${hasKV ? `
                        <textarea class="editor"
                            placeholder="${decodeURIComponent(atob('QUREJUU3JUE0JUJBJUU0JUJFJThCJUVGJUJDJTlBCnZpc2EuY24lMjMlRTQlQkMlOTglRTklODAlODklRTUlOUYlOUYlRTUlOTAlOEQKMTI3LjAuMC4xJTNBMTIzNCUyM0NGbmF0CiU1QjI2MDYlM0E0NzAwJTNBJTNBJTVEJTNBMjA1MyUyM0lQdjYKCiVFNiVCMyVBOCVFNiU4NCU4RiVFRiVCQyU5QQolRTYlQUYlOEYlRTglQTElOEMlRTQlQjglODAlRTQlQjglQUElRTUlOUMlQjAlRTUlOUQlODAlRUYlQkMlOEMlRTYlQTAlQkMlRTUlQkMlOEYlRTQlQjglQkElMjAlRTUlOUMlQjAlRTUlOUQlODAlM0ElRTclQUIlQUYlRTUlOEYlQTMlMjMlRTUlQTQlODclRTYlQjMlQTgKSVB2NiVFNSU5QyVCMCVFNSU5RCU4MCVFOSU5QyU4MCVFOCVBNiU4MSVFNyU5NCVBOCVFNCVCOCVBRCVFNiU4QiVBQyVFNSU4RiVCNyVFNiU4QiVBQyVFOCVCNSVCNyVFNiU5RCVBNSVFRiVCQyU4QyVFNSVBNiU4MiVFRiVCQyU5QSU1QjI2MDYlM0E0NzAwJTNBJTNBJTVEJTNBMjA1MwolRTclQUIlQUYlRTUlOEYlQTMlRTQlQjglOEQlRTUlODYlOTklRUYlQkMlOEMlRTklQkIlOTglRTglQUUlQTQlRTQlQjglQkElMjA0NDMlMjAlRTclQUIlQUYlRTUlOEYlQTMlRUYlQkMlOEMlRTUlQTYlODIlRUYlQkMlOUF2aXNhLmNuJTIzJUU0JUJDJTk4JUU5JTgwJTg5JUU1JTlGJTlGJUU1JTkwJThECgoKQUREQVBJJUU3JUE0JUJBJUU0JUJFJThCJUVGJUJDJTlBCmh0dHBzJTNBJTJGJTJGcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSUyRmNtbGl1JTJGV29ya2VyVmxlc3Myc3ViJTJGcmVmcyUyRmhlYWRzJTJGbWFpbiUyRmFkZHJlc3Nlc2FwaS50eHQKCiVFNiVCMyVBOCVFNiU4NCU4RiVFRiVCQyU5QUFEREFQSSVFNyU5QiVCNCVFNiU4RSVBNSVFNiVCNyVCQiVFNSU4QSVBMCVFNyU5QiVCNCVFOSU5MyVCRSVFNSU4RCVCMyVFNSU4RiVBRg=='))}"
                            id="content">${content}</textarea>
                        <div class="button-group">
                            <button class="btn btn-secondary" onclick="goBack()">返回配置页</button>
                            <button class="btn btn-primary" onclick="saveContent(this)">保存</button>
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
                            saveStatus.textContent = '保存成功';
                            setTimeout(() => {
                                saveStatus.textContent = '';
                            }, 3000);
                        } else {
                            throw new Error('保存失败: ' + await response.text());
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
                    const isOpening = content.style.display === 'none' || !content.style.display;

                    if (isOpening) {
                        content.style.display = 'block';
                    } else {
                        content.style.display = 'none';
                        
                        const allSettings = document.querySelectorAll('.setting-content');
                        allSettings.forEach(setting => {
                            setting.style.display = 'none';
                        });
                        const allHeaders = document.querySelectorAll('.setting-header');
                        allHeaders.forEach(header => {
                            header.classList.remove('open');
                        });
                    }
                }

                function toggleSetting(headerElement) {
                    const content = headerElement.nextElementSibling;
                    headerElement.classList.toggle('open');
                    if (content.style.display === 'none' || content.style.display === '') {
                        content.style.display = 'block';
                    } else {
                        content.style.display = 'none';
                    }
                }

                async function saveSettings() {
                    const saveStatus = document.getElementById('settings-save-status');
                    saveStatus.textContent = '保存中...';

                    try {
						const selectedHttpsPorts = Array.from(document.querySelectorAll('input[name="httpsports"]:checked')).map(cb => cb.value).join(',');
						const selectedHttpPorts = Array.from(document.querySelectorAll('input[name="httpports"]:checked')).map(cb => cb.value).join(',');

                        const advancedSettings = {
                            proxyip: document.getElementById('proxyip').value,
                            socks5: document.getElementById('socks5').value,
                            httpproxy: document.getElementById('httpproxy').value,
                            sub: document.getElementById('sub').value,
                            subapi: document.getElementById('subapi').value,
                            subconfig: document.getElementById('subconfig').value,
                            nat64: document.getElementById('nat64').value,
							notls: document.getElementById('notls-checkbox').checked.toString(),
							httpsports: selectedHttpsPorts,
                            httpports: selectedHttpPorts
                        };

                        const response = await fetch(window.location.href + '?type=advanced', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(advancedSettings)
                        });

                        if (response.ok) {
                            saveStatus.textContent = '保存成功';
                            setTimeout(() => {
                                saveStatus.textContent = '';
                            }, 3000);
                        } else {
                            throw new Error('保存失败: ' + await response.text());
                        }
                    } catch (error) {
                        saveStatus.textContent = '❌ ' + error.message;
                        console.error('保存设置时发生错误:', error);
                    }
                }
                const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
                
                (function() {
                    const currentTheme = localStorage.getItem('theme');
                    if (currentTheme === 'dark-mode') {
                        toggleSwitch.checked = true;
                    }
                })();

                function switchTheme(e) {
                    if (e.target.checked) {
                        document.documentElement.classList.add('dark-mode');
                        localStorage.setItem('theme', 'dark-mode');
                    } else {
                        document.documentElement.classList.remove('dark-mode');
                        localStorage.setItem('theme', 'light-mode');
                    }    
                }
                toggleSwitch.addEventListener('change', switchTheme, false);
            </script>
        </body>
        </html>
    `;

    return new Response(html, {
        headers: { "Content-Type": "text/html;charset=utf-8" }
    });
}
