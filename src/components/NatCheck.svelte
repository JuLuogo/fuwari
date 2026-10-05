<script lang="ts">
import { tick } from "svelte";
import { natCheckConfig } from "../config.ts";

let logs: string[] = ["System ready."];
let isTesting = false;
let resultData: any = null;

let logsContainer: HTMLElement;

function scrollToBottom() {
	if (logsContainer) {
		logsContainer.scrollTop = logsContainer.scrollHeight;
	}
}

function logItem(msg: string) {
	logs = [...logs, `> ${msg}`];
	scrollToBottom();
}

async function gatherCandidates(primaryHost: string, secHost: string) {
	logItem(`Initializing WebRTC ICE Agent...`);
	const iceServers = [
		{ urls: "stun:" + primaryHost + ":3478" },
		{ urls: "stun:" + primaryHost + ":3479" },
	];
	if (secHost) {
		iceServers.push({ urls: "stun:" + secHost + ":3478" });
	}

	const pc = new RTCPeerConnection({ iceServers });
	pc.createDataChannel("probe");

	const hostSet = new Set<string>();
	const srflxSet = new Map<string, any>();
	let resolved = false;

	let bUfrag = "",
		bPwd = "";
	// Fake secondary peer to force ICE into checking state
	const sUfrag = Math.random().toString(36).substring(2, 10);
	const sPwd = (
		Math.random().toString(36).substring(2) +
		Math.random().toString(36).substring(2) +
		"abcdefghijklmnop"
	).substring(0, 26);

	return new Promise((resolve, reject) => {
		const complete = () => {
			if (resolved) return;
			resolved = true;
			logItem(`Gathered ${srflxSet.size} unique srflx mappings.`);
			resolve({
				data: {
					localIPs: [...hostSet],
					srflx: [...srflxSet.values()],
					browser_ufrag: bUfrag,
					browser_pwd: bPwd,
					server_ufrag: sUfrag,
				},
				pc,
			});
		};

		pc.onicecandidate = (e) => {
			if (!e.candidate) {
				logItem("ICE gathering completed.");
				logItem(
					`Collected ${hostSet.size} host IPs: ${[...hostSet].join(", ") || "none"}`,
				);
				complete();
				return;
			}
			const cand = e.candidate.candidate;
			logItem(`Candidate: ${cand.split(" ").slice(4, 8).join(" ")}`);

			const parts = cand.split(" ");
			const ip = parts[4],
				port = Number.parseInt(parts[5]),
				typ = parts[7];

			// 收集 host 类型的 IP（包括 IPv4 和 IPv6）
			if (
				typ === "host" &&
				ip &&
				!ip.startsWith("169.254") &&
				ip !== "0.0.0.0"
			) {
				hostSet.add(ip);
				logItem(`Added host IP: ${ip}`);
			}
			if (typ === "srflx") {
				srflxSet.set(ip + ":" + port, { ip, port });
				logItem(`Added srflx mapping: ${ip}:${port}`);
			}
		};

		pc.createOffer()
			.then(async (offer) => {
				await pc.setLocalDescription(offer);
				logItem(`Offer created. Listening on local port...`);

				const sdp = offer.sdp || "";
				const uMatch = sdp.match(/a=ice-ufrag:(.+)/);
				const pMatch = sdp.match(/a=ice-pwd:(.+)/);
				if (uMatch) bUfrag = uMatch[1].trim();
				if (pMatch) bPwd = pMatch[1].trim();

				// Munge SDP answer to simulate remote peer
				let lines = sdp.split("\n");
				let ansLines = [];
				for (let l of lines) {
					l = l.trim();
					if (!l) continue;
					if (l.startsWith("a=setup:")) ansLines.push("a=setup:active");
					else if (l.startsWith("a=ice-ufrag:"))
						ansLines.push("a=ice-ufrag:" + sUfrag);
					else if (l.startsWith("a=ice-pwd:"))
						ansLines.push("a=ice-pwd:" + sPwd);
					else if (l.includes("candidate:")) continue;
					else if (l.startsWith("a=ice-options:")) continue;
					else ansLines.push(l);
				}
				// Add fake remote candidate to enter checking state
				ansLines.push("a=candidate:1 1 udp 2113937151 192.0.2.1 9 typ host");

				await pc.setRemoteDescription({
					type: "answer",
					sdp: ansLines.join("\r\n") + "\r\n",
				});
				logItem(`Dummy RemoteDescription applied. Active response enabled.`);
			})
			.catch(reject);

		// Wait max 3.5 seconds using Promise
		Promise.race([
			new Promise(resolve => {
				pc.addEventListener('iceconnectionstatechange', () => {
					if (pc.iceConnectionState === 'completed' || pc.iceConnectionState === 'failed') {
						resolve(null);
					}
				});
			}),
			new Promise(resolve => {
				const start = Date.now();
				const check = () => {
					if (Date.now() - start >= 3500) {
						resolve(null);
					} else {
						requestAnimationFrame(check);
					}
				};
				check();
			})
		]).then(complete);
	});
}

async function startTest() {
	isTesting = true;
	resultData = null;
	logs = [];
	logItem("System ready.");

	let pc: any = null;

	try {
		// 按照配置写死主节点和副节点 IP
		const primaryHost = "64.110.118.255";
		const secHost = "161.33.17.215";

		const res_gather: any = await gatherCandidates(primaryHost, secHost);
		const data = res_gather.data;
		pc = res_gather.pc;
		if (!natCheckConfig.apiUrl) {
			logItem("未配置检测后端（需自建，见 src/config.ts 的 natCheckConfig），已跳过主动探测。");
			if (pc) pc.close();
			return;
		}
		logItem(`Sending context to server for deep active inspection...`);
		logItem(`Awaiting active filtering UDP probes...`);

		// Server performs active probes
		// 默认后端 Python 代码 API 运行在 8080 端口，若使用了反向代理可移除 :8080
		const apiUrl = natCheckConfig.apiUrl;
		const res = await fetch(apiUrl, {
			method: "POST",
			body: JSON.stringify(data),
			headers: { "Content-Type": "application/json" },
		});

		const json = await res.json();
		logItem(`Server detection result: ${json.type}`);
		resultData = json;
		scrollToBottom();
	} catch (e: any) {
		logItem(`Error: ${e.message}`);
		logItem(`提示: 后端可能未启动，或者存在CORS跨域限制。`);
	} finally {
		if (pc) {
			pc.close();
			logItem("WebRTC connection closed.");
		}
		isTesting = false;
	}
}

function getResultStyle(type: string) {
	const config: Record<string, string> = {
		open: "border-green-500 bg-green-500/15 text-green-400",
		cone: "border-blue-500 bg-blue-500/15 text-blue-400",
		full_cone: "border-blue-500 bg-blue-500/15 text-blue-400",
		addr_rest_cone: "border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-400",
		port_rest_cone: "border-amber-500 bg-amber-500/15 text-amber-400",
		symmetric: "border-red-500 bg-red-500/15 text-red-500",
		blocked: "border-slate-500 bg-slate-500/15 text-slate-400",
	};
	return config[type] || "border-gray-500 bg-gray-500/15 text-gray-500";
}
</script>

<div class="flex flex-col gap-6 w-full max-w-4xl mx-auto">
  <div class="flex flex-col gap-4 bg-[var(--card-bg)] border border-[var(--line-color)] rounded-2xl p-6 relative">
    
    <div class="text-sm text-50 mb-4 px-2">
      点击下方按钮开始检测。将会通过 WebRTC 在您的网络建立 STUN 探测通道来分析 NAT 环境。
    </div>

    <button 
      on:click={startTest}
      disabled={isTesting}
      class="w-full md:w-auto self-center md:px-12 py-3 bg-[var(--primary)] text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-wait"
    >
      {isTesting ? '检测中...' : '开始检测'}
    </button>
  </div>

  <div class="flex flex-col bg-[var(--card-bg)] border border-[var(--line-color)] rounded-2xl p-6 h-48 overflow-hidden">
    <h3 class="text-sm font-bold text-75 mb-4">执行日志</h3>
    <div 
      bind:this={logsContainer}
      class="flex-1 overflow-y-auto font-mono text-sm space-y-1 text-50"
    >
      {#each logs as l}
        <div class="break-all">{l}</div>
      {/each}
    </div>
  </div>

  {#if resultData}
    <div class={`p-6 rounded-2xl border ${getResultStyle(resultData.type)} flex flex-col items-center justify-center text-center`}>
      <h2 class="text-xl md:text-2xl font-bold mb-3">{resultData.label}</h2>
      <p class="text-sm md:text-base opacity-90">{resultData.details}</p>
    </div>
  {/if}
</div>


